// WebSocket client for the shared Ohio. Never blocks the game: if the server is down or
// not configured, everything keeps working single-player and it quietly retries.
export function createNet(url) {
  const listeners = {};
  const st = { ws: null, id: null, connected: false, retry: 1000, closed: false, hello: null, sent: 0 };
  const on = (t, f) => (listeners[t] ||= []).push(f);
  const emit = (t, m) => (listeners[t] || []).forEach((f) => f(m));

  function send(msg) {
    if (!st.connected || st.ws.readyState !== 1) return false;
    st.ws.send(JSON.stringify(msg));
    st.sent++;
    return true;
  }

  function connect() {
    if (!url || st.closed) return;
    let ws;
    try {
      ws = new WebSocket(url);
    } catch {
      return schedule();
    }
    st.ws = ws;
    ws.onopen = () => {
      st.retry = 1000;
      ws.send(JSON.stringify({ t: 'hello', ...st.hello() }));
    };
    ws.onmessage = (e) => {
      let m;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.t === 'welcome') {
        st.id = m.you;
        st.connected = true;
        emit('status', true);
      }
      if (m.t === 'full') emit('full', m);
      emit(m.t, m);
    };
    ws.onclose = () => {
      const was = st.connected;
      st.connected = false;
      st.id = null;
      if (was) emit('status', false);
      schedule();
    };
    ws.onerror = () => {};
  }
  function schedule() {
    if (st.closed) return;
    setTimeout(connect, st.retry);
    st.retry = Math.min(30000, st.retry * 2);
  }

  return {
    enabled: !!url,
    get connected() {
      return st.connected;
    },
    get id() {
      return st.id;
    },
    get sent() {
      return st.sent;
    },
    on,
    send,
    // hello() returns {name, skin, pet}; called on every (re)connect
    start(hello) {
      st.hello = hello;
      connect();
    },
    close() {
      st.closed = true;
      st.ws?.close();
    },
  };
}

// Snapshot interpolation: buffer of {t, d} in arrival order. Drops entries older than the
// render time and returns [from, to, f] to blend between.
export function sampleBuffer(b, t) {
  while (b.length > 2 && b[1].t <= t) b.shift();
  const a = b[0];
  const c = b[1] || a;
  if (c === a || t <= a.t) return [a, a, 0];
  const span = c.t - a.t;
  return [a, c, span > 0 ? Math.min(1, (t - a.t) / span) : 1];
}
