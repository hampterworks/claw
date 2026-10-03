// localStorage wrapper. Every access is guarded so private mode / blocked
// storage just means "no saves", never a crash.
const PREFIX = 'claw.';

export function read(key, fallback) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export const best = (id) => read('best.' + id, 0);

// Returns true when this is a new high score.
export function submit(id, score) {
  if (score > best(id)) {
    write('best.' + id, Math.floor(score));
    return true;
  }
  return false;
}

export const stat = (name) => read('stat.' + name, 0);

export function bump(name, n = 1) {
  const v = stat(name) + n;
  write('stat.' + name, v);
  return v;
}
