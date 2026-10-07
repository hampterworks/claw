// claw-ohio: the multiplayer relay for Claw Simulator.
// Every player simulates their own Claw and streams it here; the Durable Object relays it to
// everyone else. Props use an ownership model: whoever knocks a prop simulates it and streams
// its transform until it settles. Settled props are stored so late joiners see the same mess.
import { DurableObject } from 'cloudflare:workers';

const MAX_PLAYERS = 12;
const RATE = 60; // messages per second per socket
const CLAIM_TIMEOUT = 2000; // ms of owner silence before a prop can be taken over
const RESET_AFTER = 15 * 60 * 1000; // Ohio resets this long after the last player leaves
const BOUND = 200;
const MAX_PROP = 5000;
// Hide and Seek round timings (ms)
const HS_LOBBY = 20000;
const HS_HIDE = 25000;
const HS_SEEK = 150000;
const HS_TAG_RANGE = 6; // metres; a little slack for latency
// Zombie Tag round timings (ms): the whole map, bonks infect
const ZB_LOBBY = 20000;
const ZB_GRACE = 10000; // patient zero rises from the grave while everyone runs
const ZB_PLAY = 180000;
const DUEL_ACTS = ['ask', 'yes', 'no', 'mv', 'quit'];
const EMOTE_IDS = ['chipi', 'spin', 'caramell', 'loaf', 'pog', 'wave', 'cry', 'scream']; // js/games/sim/emotes.js
const DUEL_MOVES = ['bonk', 'guard', 'special'];
// The Battle of Ohio (Clicky's kaiju): timings in ms, same song clock as the client
const EV_LEAD = 2500; // so everyone starts together
const EV_DECIDE = 60000; // the crowd's verdict, just before the finale (bar 38)
const EV_LEN = 80000;
const EV_COOLDOWN = 10 * 60 * 1000;
const kaijuWinner = (m, g) => (g > m * 1.5 + 10 ? 'g' : 'm');
const int = (v, hi) => (Number.isInteger(v) && v >= 0 && v <= hi ? v : 0);

const num = (v, lo = -BOUND, hi = BOUND) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0);
const nums = (a, n, lo, hi) => (Array.isArray(a) && a.length === n ? a.map((v) => num(v, lo, hi)) : null);
const text = (s, max) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '');
const ident = (s) => (typeof s === 'string' ? s.replace(/[^a-z0-9_-]/gi, '').slice(0, 24) : '');
const propId = (v) => (Number.isInteger(v) && v >= 0 && v < MAX_PROP ? v : -1);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected a websocket', { status: 426 });
      const origin = req.headers.get('Origin') || '';
      const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (!allowed.some((a) => origin === a || origin.startsWith(a + ':'))) return new Response('origin not allowed', { status: 403 });
      const stub = env.OHIO.get(env.OHIO.idFromName('ohio'));
      return stub.fetch(req);
    }
    return new Response('claw-ohio is up. Glorp.', { headers: { 'content-type': 'text/plain' } });
  },
};

export class Ohio extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.players = new Map(); // id -> { name, skin, pet, d }
    this.owners = new Map(); // propId -> { by, t }
    this.lastS = new Map(); // propId -> latest streamed transform (for releases on leave)
    this.rate = new Map(); // ws -> { n, t }
    this.hs = null; // the Hide and Seek round, if any (memory only: a hibernation just ends it)
    this.zb = null; // the Zombie Tag round, same rules
    this.ev = null; // the Battle of Ohio, if one is on
    this.evNext = 0;
    // after hibernation, rebuild who is connected from the socket attachments
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (a) this.players.set(a.id, { name: a.name, skin: a.skin, pet: a.pet, d: null });
    }
  }

  async fetch() {
    const sockets = this.ctx.getWebSockets();
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    if (sockets.length >= MAX_PLAYERS) {
      server.send(JSON.stringify({ t: 'full' }));
      server.close(1013, 'Ohio is full');
    } else {
      await this.ctx.storage.deleteAlarm();
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  send(ws, msg) {
    try {
      ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } catch {
      /* socket already closing */
    }
  }

  broadcast(msg, except) {
    const s = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const a = ws.deserializeAttachment();
      if (a) this.send(ws, s);
    }
  }

  socketOf(id) {
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (a && a.id === id) return ws;
    }
    return null;
  }

  limited(ws) {
    const now = Date.now();
    let r = this.rate.get(ws);
    if (!r || now - r.t > 1000) this.rate.set(ws, (r = { n: 0, t: now }));
    return ++r.n > RATE;
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 16384 || this.limited(ws)) return;
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    if (!m || typeof m.t !== 'string') return;
    const me = ws.deserializeAttachment();

    if (m.t === 'hello') {
      if (me) return;
      const id = crypto.randomUUID().slice(0, 8);
      const p = { id, name: text(m.name, 20) || 'Glorp', skin: ident(m.skin) || 'classic', pet: ident(m.pet) || null };
      ws.serializeAttachment(p);
      this.players.set(id, { name: p.name, skin: p.skin, pet: p.pet, d: null });
      // a newer world layout (props renumbered): forget the old saved mess
      const v = Number.isInteger(m.v) ? m.v : 0;
      const stored = (await this.ctx.storage.get('meta:v')) || 0;
      if (v > stored) {
        for (const k of (await this.ctx.storage.list({ prefix: 'p:' })).keys()) await this.ctx.storage.delete(k);
        this.owners.clear();
        this.lastS.clear();
        await this.ctx.storage.put('meta:v', v);
      }
      const props = {};
      for (const [k, v] of await this.ctx.storage.list({ prefix: 'p:' })) props[k.slice(2)] = v;
      for (const [pid, d] of this.lastS) props[pid] = d.slice(0, 7);
      const owners = {};
      for (const [pid, o] of this.owners) owners[pid] = o.by;
      const players = [];
      for (const [pid, pl] of this.players) if (pid !== id) players.push({ id: pid, name: pl.name, skin: pl.skin, pet: pl.pet, d: pl.d });
      this.send(ws, { t: 'welcome', you: id, players, owners, props, hs: this.hsSnap(), zb: this.zbSnap(), ev: this.evSnap(), now: Date.now() });
      this.broadcast({ t: 'join', id, name: p.name, skin: p.skin, pet: p.pet }, ws);
      return;
    }
    if (!me) return; // everything else needs a hello first
    const id = me.id;
    this.hsTick();
    this.zbTick();
    this.evTick();

    switch (m.t) {
      case 'p': {
        const d = nums(m.d, 13, -BOUND, BOUND);
        if (!d) return;
        d[12] = Math.round(num(m.d[12], 0, 1023)); // flags
        const pl = this.players.get(id);
        if (pl) pl.d = d;
        this.broadcast({ t: 'p', id, d }, ws);
        break;
      }
      case 'look': {
        const skin = ident(m.skin) || 'classic';
        const pet = ident(m.pet) || null;
        ws.serializeAttachment({ ...me, skin, pet });
        const pl = this.players.get(id);
        if (pl) Object.assign(pl, { skin, pet });
        this.broadcast({ t: 'look', id, skin, pet }, ws);
        break;
      }
      case 'claim': {
        const pid = propId(m.id);
        if (pid < 0) return;
        const o = this.owners.get(pid);
        const now = Date.now();
        if (!o || o.by === id || now - o.t > CLAIM_TIMEOUT) {
          this.owners.set(pid, { by: id, t: now });
          this.broadcast({ t: 'owner', id: pid, by: id });
        } else {
          this.send(ws, { t: 'owner', id: pid, by: o.by }); // you lost: follow the owner
        }
        break;
      }
      case 's': {
        if (!Array.isArray(m.d) || m.d.length > 64) return;
        const now = Date.now();
        const out = [];
        for (const row of m.d) {
          if (!Array.isArray(row) || row.length !== 11) continue;
          const pid = propId(row[0]);
          if (pid < 0) continue;
          const o = this.owners.get(pid);
          if (o && o.by !== id) continue; // not yours
          if (!o) this.owners.set(pid, { by: id, t: now }); // implicit claim (e.g. after a hibernation)
          else o.t = now;
          const d = [pid, ...row.slice(1).map((v, i) => num(v, i >= 3 && i < 7 ? -1 : -BOUND, i >= 3 && i < 7 ? 1 : BOUND))];
          this.lastS.set(pid, d.slice(1));
          out.push(d);
        }
        if (out.length) this.broadcast({ t: 's', by: id, d: out }, ws);
        break;
      }
      case 'rel': {
        const pid = propId(m.id);
        const d = nums(m.d, 7);
        if (pid < 0 || !d) return;
        for (let i = 3; i < 7; i++) d[i] = num(d[i], -1, 1);
        const o = this.owners.get(pid);
        if (o && o.by !== id) return;
        this.owners.delete(pid);
        this.lastS.delete(pid);
        await this.ctx.storage.put('p:' + pid, d);
        this.broadcast({ t: 'rel', id: pid, d }, ws);
        break;
      }
      case 'hit': {
        const target = this.socketOf(ident(m.to));
        const d = nums(m.d, 3, -40, 40);
        if (target && d) this.send(target, { t: 'hit', from: id, d });
        break;
      }
      case 'unlock': {
        // the dungeon lever: open every cell door for everyone
        this.broadcast({ t: 'unlock', id }, ws);
        break;
      }
      case 'duel': {
        // pet battles are peer to peer: just pass the (cleaned up) message to the opponent
        const target = this.socketOf(ident(m.to));
        if (!target || target === ws || !DUEL_ACTS.includes(m.a)) return;
        this.send(target, {
          t: 'duel',
          from: id,
          a: m.a,
          pet: ident(m.pet) || null,
          bet: int(m.bet, 1000),
          r: int(m.r, 99),
          mv: DUEL_MOVES.includes(m.mv) ? m.mv : 'bonk',
          seed: int(m.seed, 2147483647),
          why: ident(m.why),
        });
        break;
      }
      case 'emote': {
        const e = EMOTE_IDS.includes(m.e) || m.e === 'stop' ? m.e : null;
        if (e) this.broadcast({ t: 'emote', id, e }, ws);
        break;
      }
      case 'hs':
        this.hsMessage(ws, id, m);
        break;
      case 'zb':
        this.zbMessage(ws, id, m);
        break;
      case 'ev':
        this.evMessage(ws, id, m);
        break;
      case 'chat': {
        const s = text(m.text, 80);
        if (s) this.broadcast({ t: 'chat', id, text: s });
        break;
      }
      case 'fx': {
        const s = text(m.text, 80);
        if (s) this.broadcast({ t: 'fx', id, text: s }, ws);
        break;
      }
    }
  }

  // ---------- the Battle of Ohio: start time, seed, cheers and the verdict ----------
  evSnap() {
    const e = this.ev;
    return e ? { start: e.start, seed: e.seed, host: e.host, m: e.m, g: e.g, winner: e.winner } : null;
  }

  evTick() {
    const e = this.ev;
    if (!e) return;
    const now = Date.now();
    if (!e.winner && now >= e.start + EV_DECIDE) {
      e.winner = kaijuWinner(e.m, e.g);
      this.broadcast({ t: 'ev', ev: 'end', winner: e.winner, m: e.m, g: e.g, now });
    }
    if (now >= e.start + EV_LEN + 5000) this.ev = null;
  }

  evMessage(ws, id, m) {
    const now = Date.now();
    const e = this.ev;
    if (m.a === 'start') {
      if (e || now < this.evNext) return this.send(ws, { t: 'ev', ev: 'busy', wait: e ? e.start + EV_LEN - now : this.evNext - now, now });
      this.ev = { start: now + EV_LEAD, seed: Math.floor(Math.random() * 2147483647), host: id, m: 0, g: 0, winner: null };
      this.evNext = now + EV_COOLDOWN;
      this.broadcast({ t: 'ev', ev: 'start', by: id, s: this.evSnap(), now });
      return;
    }
    if (m.a === 'cheer') {
      if (!e || e.winner || now < e.start) return;
      e.m += int(m.m, 40);
      e.g += int(m.g, 40);
      this.broadcast({ t: 'ev', ev: 'cheer', m: e.m, g: e.g, now }); // clients batch to 1/s each
    }
    // 'tick' needs nothing: evTick already ran
  }

  // ---------- Hide and Seek: the server is the referee ----------
  hsSnap() {
    const h = this.hs;
    return h ? { phase: h.phase, host: h.host, ids: h.ids, seekers: h.seekers, first: h.first || null, lobbyEnd: h.lobbyEnd, hideEnd: h.hideEnd || 0, end: h.end || 0 } : null;
  }

  hsSend(ev, extra = {}) {
    this.broadcast({ t: 'hs', ev, s: this.hsSnap(), now: Date.now(), ...extra });
  }

  hsEnd(win, why = '') {
    const h = this.hs;
    if (!h) return;
    this.hs = null;
    this.broadcast({ t: 'hs', ev: 'end', win, why, ids: h.ids, seekers: h.seekers, first: h.first || null, s: null, now: Date.now() });
  }

  // timers run lazily: every message (and the clients' 'tick' at each deadline) moves the round on
  hsTick() {
    const h = this.hs;
    if (!h) return;
    const now = Date.now();
    if (h.phase === 'lobby' && now >= h.lobbyEnd) {
      if (h.ids.length < 2) return this.hsEnd(null, 'Not enough players joined.');
      const seeker = h.ids[Math.floor(Math.random() * h.ids.length)];
      Object.assign(h, { phase: 'play', seekers: [seeker], first: seeker, hideEnd: now + HS_HIDE, end: now + HS_HIDE + HS_SEEK });
      this.hsSend('begin', { seeker });
    } else if (h.phase === 'play' && now >= h.end) this.hsEnd('hiders');
  }

  hsCheck() {
    const h = this.hs;
    if (!h || h.phase !== 'play') return;
    if (h.ids.length < 2) this.hsEnd(null, 'Not enough players left.');
    else if (!h.seekers.length) this.hsEnd('hiders', 'The seeker left.');
    else if (h.seekers.length >= h.ids.length) this.hsEnd('seekers');
  }

  hsDrop(id) {
    const h = this.hs;
    if (!h || !h.ids.includes(id)) return;
    h.ids = h.ids.filter((x) => x !== id);
    h.seekers = h.seekers.filter((x) => x !== id);
    if (h.phase === 'lobby') {
      if (!h.ids.length) this.hsEnd(null, 'Everyone left.');
      else {
        if (h.host === id) h.host = h.ids[0];
        this.hsSend('state');
      }
      return;
    }
    this.hsSend('state');
    this.hsCheck();
  }

  hsMessage(ws, id, m) {
    const h = this.hs;
    const now = Date.now();
    switch (m.a) {
      case 'start':
        if (h || this.zb) return this.send(ws, { t: 'hs', ev: 'state', s: this.hsSnap(), busy: !!this.zb, now });
        this.hs = { phase: 'lobby', host: id, ids: [id], seekers: [], lobbyEnd: now + HS_LOBBY };
        this.hsSend('open', { by: id });
        break;
      case 'join':
        if (!h || h.phase !== 'lobby' || h.ids.includes(id)) return;
        h.ids.push(id);
        this.hsSend('join', { by: id });
        break;
      case 'leave':
        this.hsDrop(id);
        break;
      case 'tag': {
        // a seeker bonked a hider
        const who = ident(m.who);
        if (!h || h.phase !== 'play' || now < h.hideEnd || !h.seekers.includes(id) || !h.ids.includes(who) || h.seekers.includes(who)) return;
        const a = this.players.get(id)?.d;
        const b = this.players.get(who)?.d;
        if (a && b && Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > HS_TAG_RANGE) return;
        h.seekers.push(who);
        this.hsSend('tag', { by: id, who });
        this.hsCheck();
        break;
      }
      case 'out':
        // a hider ran out of the play area: that counts as found
        if (!h || h.phase !== 'play' || !h.ids.includes(id) || h.seekers.includes(id)) return;
        h.seekers.push(id);
        this.hsSend('tag', { by: null, who: id });
        this.hsCheck();
        break;
      case 'state':
        this.send(ws, { t: 'hs', ev: 'state', s: this.hsSnap(), now });
        break;
      // 'tick' needs nothing: hsTick already ran
    }
  }

  // ---------- Zombie Tag: the server is the referee ----------
  zbSnap() {
    const z = this.zb;
    return z ? { phase: z.phase, host: z.host, ids: z.ids, zombies: z.zombies, first: z.first || null, lobbyEnd: z.lobbyEnd, graceEnd: z.graceEnd || 0, end: z.end || 0 } : null;
  }

  zbSend(ev, extra = {}) {
    this.broadcast({ t: 'zb', ev, s: this.zbSnap(), now: Date.now(), ...extra });
  }

  zbEnd(win, why = '') {
    const z = this.zb;
    if (!z) return;
    this.zb = null;
    this.broadcast({ t: 'zb', ev: 'end', win, why, ids: z.ids, zombies: z.zombies, first: z.first || null, last: z.last || null, s: null, now: Date.now() });
  }

  zbTick() {
    const z = this.zb;
    if (!z) return;
    const now = Date.now();
    if (z.phase === 'lobby' && now >= z.lobbyEnd) {
      if (z.ids.length < 2) return this.zbEnd(null, 'Not enough players joined.');
      const first = z.ids[Math.floor(Math.random() * z.ids.length)];
      Object.assign(z, { phase: 'play', zombies: [first], first, graceEnd: now + ZB_GRACE, end: now + ZB_GRACE + ZB_PLAY });
      this.zbSend('begin', { first });
    } else if (z.phase === 'play' && now >= z.end) this.zbEnd('survivors');
  }

  zbCheck() {
    const z = this.zb;
    if (!z || z.phase !== 'play') return;
    const left = z.ids.filter((x) => !z.zombies.includes(x));
    if (z.ids.length < 2) this.zbEnd(null, 'Not enough players left.');
    else if (!z.zombies.length) this.zbEnd('survivors', 'The zombies left.');
    else if (left.length === 1) z.last = left[0]; // the last one standing (wins if the clock runs out)
    if (this.zb && !left.length) this.zbEnd('zombies');
  }

  zbDrop(id) {
    const z = this.zb;
    if (!z || !z.ids.includes(id)) return;
    z.ids = z.ids.filter((x) => x !== id);
    z.zombies = z.zombies.filter((x) => x !== id);
    if (z.phase === 'lobby') {
      if (!z.ids.length) this.zbEnd(null, 'Everyone left.');
      else {
        if (z.host === id) z.host = z.ids[0];
        this.zbSend('state');
      }
      return;
    }
    this.zbSend('state');
    this.zbCheck();
  }

  zbMessage(ws, id, m) {
    const z = this.zb;
    const now = Date.now();
    switch (m.a) {
      case 'start':
        if (z || this.hs) return this.send(ws, { t: 'zb', ev: 'state', s: this.zbSnap(), busy: !!this.hs, now });
        this.zb = { phase: 'lobby', host: id, ids: [id], zombies: [], lobbyEnd: now + ZB_LOBBY };
        this.zbSend('open', { by: id });
        break;
      case 'join':
        if (!z || z.phase !== 'lobby' || z.ids.includes(id)) return;
        z.ids.push(id);
        this.zbSend('join', { by: id });
        break;
      case 'leave':
        this.zbDrop(id);
        break;
      case 'tag': {
        // a zombie bonked a survivor
        const who = ident(m.who);
        if (!z || z.phase !== 'play' || now < z.graceEnd || !z.zombies.includes(id) || !z.ids.includes(who) || z.zombies.includes(who)) return;
        const a = this.players.get(id)?.d;
        const b = this.players.get(who)?.d;
        if (a && b && Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > HS_TAG_RANGE) return;
        z.zombies.push(who);
        this.zbSend('tag', { by: id, who });
        this.zbCheck();
        break;
      }
      case 'state':
        this.send(ws, { t: 'zb', ev: 'state', s: this.zbSnap(), now });
        break;
      // 'tick' needs nothing: zbTick already ran
    }
  }

  async leave(ws) {
    const me = ws.deserializeAttachment();
    this.rate.delete(ws);
    if (!me) return;
    ws.serializeAttachment(null);
    this.players.delete(me.id);
    this.hsDrop(me.id);
    this.zbDrop(me.id);
    // hand back everything they were holding, where it last was
    for (const [pid, o] of this.owners) {
      if (o.by !== me.id) continue;
      this.owners.delete(pid);
      const d = this.lastS.get(pid);
      this.lastS.delete(pid);
      if (d) {
        const s = d.slice(0, 7);
        await this.ctx.storage.put('p:' + pid, s);
        this.broadcast({ t: 'rel', id: pid, d: s }, ws);
      } else this.broadcast({ t: 'owner', id: pid, by: null }, ws);
    }
    this.broadcast({ t: 'leave', id: me.id }, ws);
    const left = this.ctx.getWebSockets().filter((s) => s !== ws && s.deserializeAttachment());
    if (!left.length) await this.ctx.storage.setAlarm(Date.now() + RESET_AFTER);
  }

  async webSocketClose(ws, code) {
    await this.leave(ws);
    try {
      ws.close(code === 1005 ? 1000 : code, 'bye');
    } catch {
      /* already closed */
    }
  }

  async webSocketError(ws) {
    await this.leave(ws);
  }

  // nobody has played for a while: put Ohio back the way it was
  async alarm() {
    const active = this.ctx.getWebSockets().filter((s) => s.deserializeAttachment());
    if (active.length) return;
    this.owners.clear();
    this.lastS.clear();
    await this.ctx.storage.deleteAll();
  }
}
