// Seasonal themes. Spooktober runs Oct 1 to Oct 31 (local time).
// ?halloween forces it on, ?halloween=0 forces it off (for testing).
export function isHalloween(now = new Date()) {
  const q = new URLSearchParams(location.search);
  if (q.has('halloween')) return q.get('halloween') !== '0';
  return now.getMonth() === 9;
}
