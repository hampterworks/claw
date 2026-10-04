// Multiplayer server (the Cloudflare Worker in server/). Empty = single-player only.
// Override for testing with ?mp=ws://localhost:8787/ws, or turn it off with ?mp=off.
// Bump when props are added/removed/reordered in the world, so the server drops saved prop positions.
export const WORLD_VERSION = 2;
export const MP_URL = 'wss://claw-ohio.hampterworks.workers.dev/ws';

export function mpUrl() {
  const q = new URLSearchParams(location.search).get('mp');
  if (q === 'off') return '';
  return q || MP_URL;
}
