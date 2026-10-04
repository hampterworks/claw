// Claw skins, Glorp Coins and the inventory. All play money, saved per device.
import { read, write } from '../../scores.js';

export const RARITY = {
  common: { name: 'Common', color: '#b9c4cc', weight: 55 },
  rare: { name: 'Rare', color: '#4fa3ff', weight: 28 },
  epic: { name: 'Epic', color: '#c25cff', weight: 13 },
  legendary: { name: 'Legendary', color: '#ffb000', weight: 4 },
};

// body / belly+paws / ears+nose, plus optional material tweaks and animation.
export const SKINS = [
  { id: 'classic', name: 'Classic Glorp', rarity: 'common', body: '#5fe03a', belly: '#d4ffad', ears: '#ff8fb1' },
  { id: 'lime', name: 'Lime Time', rarity: 'common', body: '#b6ff3c', belly: '#f4ffd0', ears: '#ff8fb1' },
  { id: 'mint', name: 'Mint Condition', rarity: 'common', body: '#7dffc4', belly: '#e8fff6', ears: '#ff9fc0' },
  { id: 'forest', name: 'Touch Grass', rarity: 'common', body: '#2f8f3a', belly: '#9fd88a', ears: '#e07a9a' },
  { id: 'banana', name: 'Banana Claw', rarity: 'common', body: '#ffe135', belly: '#fff6c4', ears: '#c98a2a' },
  { id: 'bubblegum', name: 'Bubblegum', rarity: 'common', body: '#ff8fd0', belly: '#ffe0f2', ears: '#ff4f9a' },
  { id: 'sky', name: 'Sky Glorp', rarity: 'common', body: '#6ec8ff', belly: '#e0f4ff', ears: '#ff8fb1' },
  { id: 'ginger', name: 'Orange Cat Energy', rarity: 'common', body: '#ff9a3c', belly: '#ffe2c4', ears: '#ff6a6a' },
  { id: 'midnight', name: 'Midnight Zoomies', rarity: 'rare', body: '#243a8a', belly: '#5f7ae0', ears: '#9fb6ff' },
  { id: 'lava', name: 'Boiled Claw', rarity: 'rare', body: '#ff3b1f', belly: '#ffb347', ears: '#ffe14d', emissive: '#ff3b1f', glow: 0.25 },
  { id: 'grape', name: 'Grape Soda', rarity: 'rare', body: '#8a3cff', belly: '#d8b8ff', ears: '#ff8fe0' },
  { id: 'snow', name: 'Snow Leopurrd', rarity: 'rare', body: '#f4f7ff', belly: '#ffffff', ears: '#ffb3c6' },
  { id: 'maxwell', name: 'Maxwell Cosplay', rarity: 'rare', body: '#161616', belly: '#f2f2f2', ears: '#5a4a4a' },
  { id: 'gold', name: 'Solid Gold Glorp', rarity: 'epic', body: '#ffcc33', belly: '#ffe28a', ears: '#ffb000', metal: 0.9, rough: 0.25 },
  { id: 'chrome', name: 'Chrome Claw', rarity: 'epic', body: '#dfe6ee', belly: '#ffffff', ears: '#b9c4cc', metal: 1, rough: 0.12 },
  { id: 'ghost', name: 'Ghost Glorp', rarity: 'epic', body: '#bfffd9', belly: '#ffffff', ears: '#d8fff0', opacity: 0.45 },
  { id: 'toxic', name: 'Toxic Waste', rarity: 'epic', body: '#7CFF4F', belly: '#e8ff4f', ears: '#4fff9a', emissive: '#4cff2a', glow: 0.7 },
  { id: 'rainbow', name: 'Nyan Mode', rarity: 'legendary', body: '#ff0000', belly: '#ffffff', ears: '#ffffff', anim: 'rainbow' },
  { id: 'galaxy', name: 'Galaxy Brain', rarity: 'legendary', body: '#2a0b5a', belly: '#7a3cff', ears: '#ff7bf2', emissive: '#7a3cff', glow: 0.4, anim: 'pulse' },
  { id: 'mattclaw', name: 'Mattpog Claw', rarity: 'legendary', body: '#f1c7a8', belly: '#ffe6d6', ears: '#d98c7a', mattFace: true },
];

export const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];

// Coins + owned skins. Points earn coins at 10 points = 1 coin.
export function createWallet(hud) {
  const saved = read('simwallet', null);
  const st = saved || { coins: 200, owned: ['classic'], equipped: 'classic', welcomed: false };
  let frac = 0;
  const save = () => write('simwallet', st);
  hud.setCoins(st.coins);
  const listeners = new Set();
  return {
    get coins() {
      return st.coins;
    },
    get owned() {
      return st.owned;
    },
    get equipped() {
      return st.equipped;
    },
    get welcomed() {
      return st.welcomed;
    },
    markWelcomed() {
      st.welcomed = true;
      save();
    },
    earnFromPoints(pts) {
      frac += pts / 10;
      const whole = Math.floor(frac);
      if (whole > 0) {
        frac -= whole;
        this.add(whole);
      }
    },
    add(n) {
      st.coins += n;
      save();
      hud.setCoins(st.coins);
    },
    spend(n) {
      if (st.coins < n) return false;
      st.coins -= n;
      save();
      hud.setCoins(st.coins);
      return true;
    },
    own(id) {
      if (st.owned.includes(id)) return false;
      st.owned.push(id);
      save();
      return true;
    },
    equip(id) {
      st.equipped = id;
      save();
      listeners.forEach((f) => f(skinById(id)));
    },
    onEquip: (f) => listeners.add(f),
  };
}

// Weighted rarity roll, then a random skin of that rarity.
export function rollSkin() {
  const total = Object.values(RARITY).reduce((a, r) => a + r.weight, 0);
  let x = Math.random() * total;
  let rarity = 'common';
  for (const [k, r] of Object.entries(RARITY)) {
    if ((x -= r.weight) < 0) {
      rarity = k;
      break;
    }
  }
  const pool = SKINS.filter((s) => s.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}
