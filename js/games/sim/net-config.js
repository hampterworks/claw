// Multiplayer server (the Cloudflare Worker in server/). Empty = single-player only.
// Override for testing with ?mp=ws://localhost:8787/ws, or turn it off with ?mp=off.
export const MP_URL = 'wss://claw-ohio.hampterworks.workers.dev/ws';

export function mpUrl() {
  const q = new URLSearchParams(location.search).get('mp');
  if (q === 'off') return '';
  return q || MP_URL;
}
