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
      this.send(ws, { t: 'welcome', you: id, players, owners, props });
      this.broadcast({ t: 'join', id, name: p.name, skin: p.skin, pet: p.pet }, ws);
      return;
    }
    if (!me) return; // everything else needs a hello first
    const id = me.id;

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

  async leave(ws) {
    const me = ws.deserializeAttachment();
    this.rate.delete(ws);
    if (!me) return;
    ws.serializeAttachment(null);
    this.players.delete(me.id);
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
