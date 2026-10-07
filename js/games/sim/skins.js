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
  // Spooktober (Spooky Crates in October; Zombie Claw is also the Zombie Tag look)
  { id: 'zombie', name: 'Zombie Claw', rarity: 'epic', body: '#7f9b6e', belly: '#b7c4a3', ears: '#8a3b3b', emissive: '#2f5a1a', glow: 0.25, spooky: true },
  // paint: a pattern drawn over the body in paintCols (claw.js PAINTS); acc: a head accessory
  { id: 'pumpkin', name: 'Pumpkin Claw', rarity: 'rare', body: '#ff7a1a', belly: '#d9520a', ears: '#3f8a2a', paint: 'pumpkin', paintCols: ['#d9520a', '#3f8a2a'], spooky: true },
  { id: 'blackcat', name: 'Black Cat', rarity: 'rare', body: '#151318', belly: '#232027', ears: '#2c2830', acc: 'cateyes', spooky: true },
  { id: 'candycorn', name: 'Candy Corn Claw', rarity: 'rare', body: '#ff8a1f', belly: '#ffd23f', ears: '#fff8ea', paint: 'bands', paintCols: ['#fff8ea', '#ff8a1f', '#ffd23f'], spooky: true },
  { id: 'skeleton', name: 'Skeleton Claw', rarity: 'epic', body: '#161616', belly: '#161616', ears: '#161616', paint: 'bones', paintCols: ['#f4f1e6'], spooky: true },
  { id: 'mummy', name: 'Mummy Claw', rarity: 'epic', body: '#efe8d2', belly: '#f5f0e2', ears: '#efe8d2', paint: 'wraps', paintCols: ['#a39270'], acc: 'cateyes', spooky: true },
  { id: 'franken', name: 'Frankenclaw', rarity: 'epic', body: '#79a85a', belly: '#a6cc86', ears: '#4d6e3a', paint: 'stitch', paintCols: ['#1d2618'], acc: 'bolts', spooky: true },
  { id: 'werewolf', name: 'Werewolf Claw', rarity: 'epic', body: '#9a8a78', belly: '#c4b6a2', ears: '#3e3026', paint: 'shaggy', paintCols: ['#4a3a2e', '#7a6a5a'], balls: '#fff1c2', acc: 'cateyes', spooky: true },
  { id: 'witch', name: 'Witch Claw', rarity: 'legendary', body: '#7a3cc8', belly: '#b98cff', ears: '#3a1a5a', acc: 'witchhat', spooky: true },
  { id: 'vampire', name: 'Vampire Claw', rarity: 'legendary', body: '#d9d9e2', belly: '#f2f2f7', ears: '#8a2030', acc: 'cape', spooky: true },
  { id: 'glowbones', name: 'Glow-in-the-Dark Bones', rarity: 'legendary', body: '#101010', belly: '#101010', ears: '#101010', paint: 'bones', paintCols: ['#4dff2a'], emissive: '#ffffff', glow: 0.8, glowPaint: true, spooky: true },
  { id: 'jackoclaw', name: "Jack-o'-Claw", rarity: 'legendary', body: '#141216', belly: '#221f25', ears: '#141216', acc: 'pumpkinhead', spooky: true },
  // free for everyone: heart shades, a hibiscus and a polka-dot bikini
  { id: 'bikini', name: 'Bikini Claw', rarity: 'epic', body: '#5fe03a', belly: '#d4ffad', ears: '#ff8fb1', outfit: 'bikini', paint: 'bikini', paintCols: ['#ff7ad0', '#ffffff'], free: true },
  // secret: only from paying respects at the Vash Shrine
  { id: 'vash', name: 'Vash Mode', rarity: 'legendary', body: '#3a2c34', belly: '#8a5cff', ears: '#b48cff', emissive: '#7a3cff', glow: 0.25, secret: true },
];

export const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];

// Coins + owned skins. Points earn coins at 10 points = 1 coin.
export function createWallet(hud) {
  const saved = read('simwallet', null);
  const st = saved || { coins: 200, owned: ['classic'], equipped: 'classic', welcomed: false };
  st.pets ||= [];
  for (const s of SKINS) if (s.free && !st.owned.includes(s.id)) st.owned.push(s.id);
  st.pet ||= null;
  let frac = 0;
  const save = () => write('simwallet', st);
  hud.setCoins(st.coins);
  const listeners = new Set();
  const petListeners = new Set();
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
    get pets() {
      return st.pets;
    },
    get pet() {
      return st.pet;
    },
    get welcomed() {
      return st.welcomed;
    },
    markWelcomed() {
      st.welcomed = true;
      save();
    },
    earnFromPoints(pts, bonus = 0) {
      frac += (pts / 10) * (1 + bonus);
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
    ownPet(id) {
      if (st.pets.includes(id)) return false;
      st.pets.push(id);
      save();
      return true;
    },
    equipPet(id) {
      st.pet = id;
      save();
      petListeners.forEach((f) => f(id));
    },
    onPet: (f) => petListeners.add(f),
  };
}

export function rollRarity() {
  const total = Object.values(RARITY).reduce((a, r) => a + r.weight, 0);
  let x = Math.random() * total;
  for (const [k, r] of Object.entries(RARITY)) if ((x -= r.weight) < 0) return k;
  return 'common';
}

// Weighted rarity roll, then a random skin of that rarity.
export function rollSkin() {
  const rarity = rollRarity();
  const pool = SKINS.filter((s) => s.rarity === rarity && !s.secret && !s.free && !s.spooky);
  return pool[Math.floor(Math.random() * pool.length)];
}
