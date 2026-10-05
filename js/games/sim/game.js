// CLAW SIMULATOR: the 3D sandbox. three.js renders, Rapier simulates.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import RAPIER from '../../../vendor/rapier/rapier.mjs';
import { createClaw } from './claw.js';
import { buildWorld, HOUSE, PARK_POT, TOWER, STATUE, STUDIO, CORN, TRAMP, BOUNDS } from './world.js';
import { CAFE, TOWERS, MATT_HOUSE, RACE, UFO, LAKE, CAT_TREE, CASINO, HAMPTER_HOUSE, BANK, CASTLE } from './districts.js';
import { MEOWTOWN, WINDMILL, GOLF } from './town.js';
import { ARENA, MAZE, HS_ZONE } from './park.js';
import { createControls, isTouchDevice } from './controls.js';
import { createHud } from './hud.js';
import { createChallenges } from './challenges.js';
import { loadTexture } from './textures.js';
import { createGraphics, createSky, applyWind } from './graphics.js';
import { createMusic } from './music.js';
import { createWallet, skinById } from './skins.js';
import { createCasino } from './casino.js';
import { createWinty } from './winty.js';
import { createFishing } from './fishing.js';
import { createPetCompanion, petById, PET_BONUS } from './pets.js';
import { createVash, buildVash } from './vash.js';
import { mpUrl, WORLD_VERSION } from './net-config.js';
import { createNet } from './net.js';
import { createPlayers, createMpUi, FLAG } from './players.js';
import { createPropSync } from './props-sync.js';
import { mergeStaticMeshes } from './merge.js';
import { createHampter } from './hampter.js';
import { createRomni } from './romni.js';
import { createCastle } from './castle.js';
import { createLoans } from './loan.js';
import { createBattles } from './battle.js';
import { createHideSeek } from './hideseek.js';
import { createClicky } from './wizard.js';
import { createKaiju } from './kaiju.js';
import { createDucky } from './ducky.js';
import { refreshDetailTextures } from './detail.js';
import { createEnvironment } from './environment.js';
import { createEmotes } from './emotes.js';
import { createDaily, trackDaily } from './daily.js';
import { createSpeedrun, resetProgress } from './speedrun.js';
import { showOverlay, hideOverlay } from '../../engine.js';
import { sfx, isMuted, getVolume, setVolume, audioBus } from '../../audio.js';
import { bump, read, write, stat } from '../../scores.js';

const CLAW_ROASTS = [
  'Claw is 85% soup by volume.',
  "Claw was not consulted about any of this. Claw's opinion was not needed.",
  'ArcticGemstone beat this game before Claw did. In a game about Claw.',
  'Claw lost a staring contest to a Baby Glorp.',
  "Claw's aura: lukewarm. Like his bath water.",
  'Vash is fun-sized and still has more aura than Claw.',
  'Claw once tried to be the main character. He was cast as an ingredient.',
  'Doctors say Claw is legally a vegetable. A soup vegetable.',
  'Claw thinks "glorp" is a personality. It is.',
  'Claw needed a tutorial to sit in a box.',
  'Every great soup starts with one green cat.',
  'Claw fell in Lake Meowchigan and blamed the lake.',
  'Matt pogged at everyone in Ohio except Claw.',
  'Claw is the reason the pot needs a bigger lid.',
  'Skill issue: Claw.',
];

const KNOCK = ['KNOCKED IT OFF THE TABLE', 'GRAVITY CHECK', 'IT WAS IN MY WAY', 'OOPS (NOT SORRY)', 'CAT BEHAVIOR', 'SIGMA SWIPE'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function loadImage(src) {
  return new Promise((resolve) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => resolve(null);
    i.src = src;
  });
}

export async function startGame(wrap, { onStatus, isCancelled, fullscreen, exitToArcade }) {
  const touch = isTouchDevice();
  wrap.classList.toggle('touch', touch);
  const params = new URLSearchParams(location.search);
  const debug = params.has('debug');
  const forceHigh = params.has('hq');

  onStatus('Booting physics...');
  await RAPIER.init();
  if (isCancelled()) return null;

  onStatus('Summoning Claw...');
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder); // world.glb + pets.glb are meshopt-compressed
  const [catGltf, maxGltf, worldGltf, petsGltf, vashGltf, vashStatueGltf, vashTex, matt, huh, baby, dance, forp, face, wintyTex, newsImg, clawImg, mattImg] = await Promise.all([
    loader.loadAsync('assets/models/claw.glb'),
    loader.loadAsync('assets/models/claw.glb'),
    loader.loadAsync('assets/models/world.glb'),
    loader.loadAsync('assets/models/pets.glb'),
    loader.loadAsync('assets/models/vash.glb'),
    loader.loadAsync('assets/models/vash.glb'), // second copy for the shrine statue
    loadTexture('assets/sim-vash.webp'),
    loadTexture('assets/sim-matt.webp'),
    loadTexture('assets/sim-huh.webp'),
    loadTexture('assets/sim-baby.webp'),
    loadTexture('assets/sim-dance.webp'),
    loadTexture('assets/sim-forp.webp'),
    loadTexture('assets/claw-alien.webp'),
    loadTexture('assets/sim-winty.webp'),
    loadImage('assets/sim-news.webp'),
    loadImage('assets/claw-alien.webp'),
    loadImage('assets/sim-matt.webp'),
  ]);
  if (isCancelled()) return null;
  // the Hampter Works gallery (small, loaded alongside)
  // Clicky the wizard and Mega Matt (Kenney Mini Characters)
  const [clickyGltf, megaMattGltf] = await Promise.all([loader.loadAsync('assets/models/wizard.glb'), loader.loadAsync('assets/models/megamatt.glb')]);
  const hampterArt = await Promise.all([1, 2, 3, 4, 5].map((i) => loadTexture(`assets/sim-hampter-${i}.webp`)));
  const winterArt = await Promise.all([1, 2, 3, 4].map((i) => loadTexture(`assets/sim-winter-${i}.webp`)));
  onStatus('Building Ohio...');

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: !touch, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.25 : 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // shadows are re-rendered every other frame (with the sun moving in step), see frame()
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const canvas = renderer.domElement;
  canvas.className = 'sim-canvas';
  wrap.appendChild(canvas);
  const scene = new THREE.Scene();
  // far plane = where the fog (world.js, 70..210) has hidden everything anyway
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 215);
  const gfx = createGraphics(renderer, scene, camera);

  function resize() {
    const top = wrap.getBoundingClientRect().top;
    const h = Math.max(320, window.innerHeight - Math.max(0, top) - (fullscreen ? 0 : 8));
    wrap.style.height = h + 'px';
    const w = wrap.clientWidth;
    renderer.setSize(w, h, false);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    gfx.setSize(w, h);
  }
  resize();
  window.addEventListener('resize', resize);

  // ---------- world ----------
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  const W = buildWorld({
    RAPIER,
    world,
    scene,
    models: worldGltf.scene,
    catGltf: maxGltf,
    images: { news: newsImg, claw: clawImg, matt: mattImg },
    textures: { matt, huh, baby, dance, forp, vash: vashTex, hampterArt, winterArt },
  });
  const S = W.special;
  const sky = createSky(scene, new THREE.Vector3(14, 26, 9));
  scene.traverse((o) => {
    if (o.isMesh) [].concat(o.material).forEach((m) => m.name === 'Wood' && m.color.set('#8d5e3b'));
  });
  const windy = new Set(['Green', 'DarkGreen', 'Berry', 'Cyan', 'Yellow', 'plant']);
  scene.traverse((o) => {
    if (o.isMesh) [].concat(o.material).forEach((m) => windy.has(m.name) && applyWind(m, m.name === 'plant' ? 0.05 : 0.02));
  });
  // fewer draw calls: fold static code-built decoration into a few vertex-coloured meshes
  const merged = mergeStaticMeshes(scene, W, [sky]);
  if (debug) console.info('static merge', merged);
  // time of day + weather (shared clock), lamps glow at night, snow at Winter's Castle
  const env = createEnvironment({
    scene,
    renderer,
    sky,
    sun: S.sun,
    camera,
    claw: null, // set below, once Claw exists
    lampSets: [S.districts.lamps, S.lamps],
    fireflyAt: [[4, 22, 16], [106, 12, 30], [-20, 30, 14]],
    snowAt: CASTLE,
    glowSpots: [
      { x: CASTLE.x + 15.2, y: 3.4, z: CASTLE.z - 2.3, color: '#9fd4ff', size: 2.5 },
      { x: CASTLE.x + 15.2, y: 3.4, z: CASTLE.z + 2.3, color: '#9fd4ff', size: 2.5 },
      { x: CASINO.x, y: 3.2, z: CASINO.z - 4.6, color: '#ff7bf2', size: 7 },
      { x: BANK.x, y: 4.2, z: BANK.z - 6.6, color: '#ffd28a', size: 6 },
      { x: ARENA.x - 2.6, y: 5.2, z: ARENA.z - 17, color: '#ff9a3c' },
      { x: ARENA.x + 2.6, y: 5.2, z: ARENA.z - 17, color: '#ff9a3c' },
      { x: HAMPTER_HOUSE.x, y: 2.6, z: HAMPTER_HOUSE.z + 4.4, color: '#ffb347' },
      { x: MATT_HOUSE.x, y: 2.6, z: MATT_HOUSE.z + 4.4, color: '#ffe14d' },
    ],
  });
  // Quality ladder, stepped down automatically while the frame rate is poor.
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const LADDER = [
    { q: 'high', pr: Math.min(DPR, 1.5) },
    { q: 'high', pr: Math.min(DPR, 1) },
    { q: 'low', pr: Math.min(DPR, 1) },
    { q: 'low', pr: Math.min(DPR, 0.75) },
  ];
  const savedGfx = read('simgfx', null);
  let rung = forceHigh ? 0 : savedGfx === 'low' ? 2 : savedGfx === 'high' ? 0 : touch ? 2 : 0;
  function setRung(i) {
    rung = i;
    gfx.setQuality(LADDER[i].q);
    env?.setQuality(LADDER[i].q);
    renderer.setPixelRatio(LADDER[i].pr);
    resize();
  }
  setRung(rung);
  const spawn = new THREE.Vector3(HOUSE.x + 2, 0.8, HOUSE.z + 2.8);
  const claw = createClaw({ RAPIER, world, scene, gltf: catGltf, faceTex: face, spawn });
  env.setClaw(claw); // the night lantern follows Claw
  // Let everything settle before scoring starts, so nothing counts as "knocked" on load.
  for (let i = 0; i < 90; i++) world.step();
  for (const p of W.props) {
    const t = p.body.translation();
    p.spawn.set(t.x, t.y, t.z);
    const r = p.body.rotation();
    p.spawnQ = { x: r.x, y: r.y, z: r.z, w: r.w };
    p.elevated = t.y - p.baseOff > 0.3 && p.kind !== 'golf';
    p.body.sleep();
  }
  W.syncAll();

  const music = createMusic();
  function setMusic(on) {
    music.setEnabled(on);
    write('simmusic', on);
    hud.setMusic(on);
    if (on && !kaiju?.active) music.start(); // also counts as the user gesture some browsers need
    kaiju?.refreshMusic();
  }
  claw.setGlow(read('simglow', true));

  const propByHandle = new Map(W.props.map((p) => [p.body.handle, p]));
  // big furniture blocks the camera like walls do, so it never ends up inside a table
  const camBlockers = new Set(W.props.filter((p) => p.half && p.half.x * p.half.y * p.half.z > 0.04).map((p) => p.body.handle));

  // tongue
  const tongue = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1, 6), new THREE.MeshStandardMaterial({ color: '#ff6f9a', roughness: 0.4 }));
  tongue.visible = false;
  scene.add(tongue);

  // ---------- game state ----------
  let menuOpen = false;
  let playing = false;
  const mut = { gravity: false, cursed: false, big: false, oiia: false, popcat: false, tiny: false, matt: false };

  const hud = createHud(wrap, { onMenu: () => openMenu(), onQuests: () => openQuests(), onMusic: () => setMusic(!music.enabled), touch });
  const ch = createChallenges(hud);
  // speedrun timer + splits (only while a run is on), and the reset buttons
  const sr = createSpeedrun({ wrap, hud, sfx, ch, total: ch.CHALLENGES.length });

  // Glorp Coins, skins and the casino
  const wallet = createWallet(hud);
  ch.onPoints((pts) => {
    const pet = petById(wallet.pet);
    wallet.earnFromPoints(pts, pet ? PET_BONUS[pet.rarity] : 0);
  });
  function refreshFace() {
    const skin = skinById(wallet.equipped);
    claw.setFaceTexture((mut.matt || skin.mattFace) && matt ? matt : face);
  }
  function equipSkin(id) {
    wallet.equip(id);
    claw.setSkin(skinById(id));
    refreshFace();
    net?.send({ t: 'look', skin: id, pet: wallet.pet });
  }
  // small studio environment so Gold / Chrome skins have something to reflect
  {
    const pmrem = new THREE.PMREMGenerator(renderer);
    claw.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }
  claw.setSkin(skinById(wallet.equipped));
  // the pet that follows Claw around
  const pets = createPetCompanion({ gltf: petsGltf, scene, world, RAPIER, claw });
  pets.set(wallet.pet);
  function equipPet(id) {
    wallet.equipPet(id);
    pets.set(id);
    net?.send({ t: 'look', skin: wallet.equipped, pet: id });
    const pet = petById(id);
    if (pet) {
      hud.popup(`${pet.name.toUpperCase()} JOINED THE SQUAD`, '#7CFF4F');
      pets.celebrate(3);
    }
  }
  // daily quests (📅 chip, and the top of the quest log)
  const daily = createDaily({ wrap, hud, sfx, wallet, onOpen: () => openQuests() });
  ch.onPoints((pts) => trackDaily('points', pts));
  // the casino gets a wallet that counts every game played (for daily quests)
  const casinoWallet = Object.create(wallet);
  casinoWallet.spend = (n) => {
    const ok = wallet.spend(n);
    if (ok) trackDaily('casino');
    return ok;
  };
  const casino = createCasino({
    wallet: casinoWallet,
    sfx,
    hud,
    ch,
    onEquip: equipSkin,
    onPet: equipPet,
    onBigWin: () => {
      pets.celebrate(5);
      net?.send({ t: 'fx', text: 'hit it big at the Glorp Casino 🎰' });
    },
  });
  const winty = wintyTex ? createWinty({ scene, texture: wintyTex, hud, sfx, ch, onOutran: () => ducky?.escaped(), bounds: BOUNDS - 6 }) : null;
  // Lyonia (Vash), next to Matt, and his gold statue in the secret shrine
  // Bank of Romni, Winter's Castle, and what happens when you don't pay
  const romni = createRomni({ scene, world, RAPIER, hud, claw, at: S.districts.bank.romni });
  const castle = createCastle({ scene, world, RAPIER, castle: S.districts.castle });
  function dragToDungeon() {
    const took = loans.settle();
    castle.jail(claw);
    sfx.boom();
    sfx.fail();
    hud.banner('WINTY DRAGGED YOU TO HER DUNGEON', `She took ${took} 🪙. Respawn from the menu to escape, or get a friend to pull the lever outside your cell.`);
    net?.send({ t: 'fx', text: "got dragged to Winty's dungeon ⛓️" });
  }
  const loans = createLoans({
    wallet,
    hud,
    sfx,
    onCollect: () => {
      hud.banner('WINTY IS COMING', 'Romni called in your debt. Pay up at the bank, or run.');
      if (winty) winty.collect(claw, dragToDungeon);
      else dragToDungeon();
    },
  });
  // where Ducky hangs out (one is picked when he shows up): the lake shore, Meowtown square, beside the bank
  const DUCKY_SPOTS = [
    Object.assign(new THREE.Vector3(5, 0, 40), { ry: Math.PI }),
    Object.assign(new THREE.Vector3(MEOWTOWN.x + 5, 0, MEOWTOWN.z), { ry: Math.PI / 2 }),
    Object.assign(new THREE.Vector3(BANK.x + 8.7, 0, BANK.z + 5), { ry: 0 }),
  ];
  // Ducky: shows up after you outrun Winty 3 times; his prank quest unlocks Ducky Mode
  var ducky = createDucky({ // var: Winty's onOutran is wired up before this line
    scene, world, RAPIER, hud, sfx, ch, claw, winty, loans,
    castle: S.districts.castle,
    spots: DUCKY_SPOTS,
  });
  function pullLever() {
    castle.openCell();
    sfx.click();
    sfx.boom();
    hud.popup('CELL DOOR OPENED', '#7CFF4F');
    net?.send({ t: 'unlock' });
  }
  const hampter = createHampter({ scene, world, RAPIER, hud, sfx, claw, home: S.districts.hampterHome, wheelAt: S.districts.hampterWheel });
  const vash = createVash({ scene, world, RAPIER, gltf: vashGltf, hud, sfx, ch, claw, home: S.districts.vashHome });
  {
    const statue = buildVash(vashStatueGltf, { gold: true }).model;
    statue.scale.setScalar(1.3);
    statue.position.copy(S.districts.shrine.statue);
    statue.rotation.y = Math.PI / 2;
    scene.add(statue);
  }
  // the sword prop disappears once Vash has it (he holds his own copy)
  function retireVashSword() {
    const pr = S.districts.vashSword;
    if (!pr || pr.gone) return;
    if (net?.connected) {
      // shared world: Vash keeps a copy, the real one goes back up for the next player
      if (st.held === pr) st.held = null;
      setTimeout(() => propSync.reset(pr), 4000);
      return;
    }
    pr.gone = true;
    pr.mesh.visible = false;
    pr.body.setEnabled(false);
    if (st.held === pr) st.held = null;
  }
  ch.onComplete((id) => id === 'vashshelf' && retireVashSword());
  let respectCd = 0;
  function payRespects() {
    if (respectCd > 0) return;
    respectCd = 2.5;
    sfx.ding();
    sfx.purr?.();
    if (!ch.isDone('shrine')) {
      hud.banner('THE SHRINE ACCEPTS YOUR OFFERING', 'Secret skin unlocked: VASH MODE');
      ch.chaos(400, '🙏 RESPECTS PAID', '#b48cff');
      ch.complete('shrine');
      wallet.own('vash');
      equipSkin('vash');
    } else {
      hud.popup(pick(['🙏 respects paid', '🙏 Vash is pleased', '🙏 +1 fun-size blessing', '🙏 the shrine purrs']), '#b48cff');
    }
  }
  const fishing = createFishing({ wallet, ch, sfx, hud });
  ch.onComplete(() => {
    pets.celebrate(3);
    wallet.add(50);
    hud.popup('+50 🪙', '#ffe14d');
  });
  // a panel can ask to hear when it goes away (closed, or replaced by another panel or the menu)
  let panelClose = null;
  function runPanelClose() {
    const f = panelClose;
    panelClose = null;
    f?.();
  }
  let overlayKind = null; // what's on screen: 'menu' | 'quests' | 'controls' | 'panel'
  function openPanel(title, content, onClose, kind = 'panel') {
    if (!playing) return;
    runPanelClose();
    panelClose = onClose || null;
    overlayKind = kind;
    emotes?.close();
    menuOpen = true;
    music.duck(true);
    controls.setEnabled(false);
    showOverlay(wrap, { title, extra: content, buttons: [{ label: 'Close', primary: true, onClick: closeMenu }] });
  }
  // the machine Claw is standing at (if any)
  const MACHINES = {
    slots: { prompt: '🎰 GLORP SLOTS', title: 'GLORP SLOTS', open: () => casino.slots() },
    crate: { prompt: '📦 OPEN A CAT CRATE', title: 'CAT CRATES', open: () => casino.crate() },
    petcrate: { prompt: '🐾 OPEN A PET CRATE', title: 'PET CRATES', open: () => casino.petCrate() },
    wheel: { prompt: '🎡 WHEEL OF GLORP', title: 'WHEEL OF GLORP', open: () => casino.wheel() },
    plinko: { prompt: '🧶 PLINKO PAWS', title: 'PLINKO PAWS', open: () => casino.plinko() },
    derby: { prompt: '🏁 PET DERBY', title: 'PET DERBY', open: () => casino.derby() },
    fish: {
      prompt: () => `🎣 GO FISHING${fishing.bucket.length ? ` · 🪣 ${fishing.bucket.length} TO SELL` : ''}`,
      title: "GONE FISHIN'",
      open: () => fishing.panel(),
    },
  };
  MACHINES.shrine = { prompt: '🙏 PAY RESPECTS', run: payRespects };
  MACHINES.hampter = { prompt: '🐹 PET HAMPTER', run: () => (hampter.squeak(), trackDaily('hampter')) };
  MACHINES.bank = { prompt: '💰 TALK TO ROMNI', title: 'BANK OF ROMNI', open: () => (romni.wave(), loans.panel()) };
  MACHINES.lever = { prompt: '🔓 OPEN THE CELL', run: pullLever };
  MACHINES.arena = { prompt: '⚔️ PET BATTLES', title: 'PET BATTLE ARENA', open: () => battles.arenaPanel() };
  MACHINES.hideseek = {
    prompt: () => (hs.hunting ? '🐹 HAMPTER HUNT (GIVE UP?)' : '🙈 HIDE AND SEEK'),
    title: 'HIDE AND SEEK',
    open: () => hs.panel(),
  };
  MACHINES.ducky = { prompt: '🦆 TALK TO DUCKY', title: 'DUCKY', open: () => ducky.panel() };
  MACHINES.throne = {
    prompt: () => ducky.thronePrompt(),
    run: () => ducky.throneAction(),
  };
  MACHINES.bookcase = { prompt: '📚 PULL THE SUSPICIOUS BOOK', run: () => (castle.pullBook(), sfx.boom(), hud.popup('...a secret room?!', '#ff7bf2')) };
  const playMachine = (m) => (MACHINES[m].run ? MACHINES[m].run() : openPanel(MACHINES[m].title, MACHINES[m].open()));
  let machine = null;
  let machineLabel = null;
  function updateMachines() {
    const p = claw.position();
    let m = null;
    for (const [id, pos] of Object.entries(S.districts.casino)) {
      if (Math.hypot(p.x - pos.x, p.z - pos.z) < 2.3) m = id;
    }
    const sh = S.districts.shrine.altar;
    if (!m && Math.hypot(p.x - sh.x, p.z - sh.z) < 1.6) m = 'shrine';
    if (!m && Math.hypot(p.x - hampter.pos.x, p.z - hampter.pos.z) < 1.7) m = 'hampter';
    const bc = S.districts.bank.counter;
    if (!m && Math.hypot(p.x - bc.x, p.z - bc.z) < 2.2) m = 'bank';
    if (!m && Math.hypot(p.x - castle.leverAt.x, p.z - castle.leverAt.z) < 1.6) m = 'lever';
    if (!m && !castle.shelfOpen && Math.hypot(p.x - castle.shelfAt.x, p.z - castle.shelfAt.z) < 1.5) m = 'bookcase';
    const pk = S.park;
    if (!m && Math.hypot(p.x - pk.arenaDesk.x, p.z - pk.arenaDesk.z) < 2.2 && p.y < 2) m = 'arena';
    if (!m && Math.hypot(p.x - S.districts.clickyHome.x, p.z - S.districts.clickyHome.z) < 3.0 && p.y < 2.5) m = 'clicky';
    if (!m) m = ducky.machine(p);
    if (!m && Math.hypot(p.x - pk.hsBoard.x, p.z - pk.hsBoard.z) < 2.2 && p.y < 2) m = 'hideseek';
    const fs = S.districts.fishSpot;
    if (!m && Math.hypot(p.x - fs.x, p.z - fs.z) < 2.2 && p.y > 0.7) m = 'fish';
    // (prompts can change while you stand there: eggs left, fish to sell)
    const label = m ? (typeof MACHINES[m].prompt === 'function' ? MACHINES[m].prompt() : MACHINES[m].prompt) : null;
    if (m === machine && label === machineLabel) return;
    machine = m;
    machineLabel = label;
    const verb = touch ? 'TAP' : 'E';
    if (m) hud.prompt(`${label} (${verb})`, () => playMachine(m));
    else hud.prompt(null);
  }
  music.setEnabled(read('simmusic', true));
  hud.setMusic(music.enabled);
  const controls = createControls(wrap, canvas, { touch, onMenu: () => openMenu(), onMusic: () => setMusic(!music.enabled), onChat: () => online && mpUi?.openChat() });

  ch.state.babies.forEach((i) => S.babies[i] && (S.babies[i].visible = false));
  S.districts.reset(ch);

  // minimap
  hud.setupMap(BOUNDS, [
    { x: 0, z: -52, w: 2 * BOUNDS, d: 6, color: '#3b3f4a' },
    { x: ARENA.x, z: -38.5, w: 4, d: 19, color: '#3b3f4a' },
    { x: ARENA.x, z: ARENA.z, w: 34, d: 34, color: '#c9b48a', round: true, label: '⚔️ ARENA' },
    { x: MAZE.x, z: MAZE.z, w: 35, d: 35, color: '#2f6b2c', label: 'MAZE' },
    { x: LAKE.x, z: LAKE.z, w: 48, d: 32, color: '#2a9fd6', round: true, label: 'LAKE' },
    { x: RACE.x, z: RACE.z, w: 39, d: 53, color: '#b8875a', round: true, label: 'RACE' },
    { x: HOUSE.x, z: HOUSE.z, w: 13, d: 11, color: '#c99a6b', label: 'HOME' },
    { x: STUDIO.x, z: STUDIO.z, w: 11, d: 7, color: '#2b2f4a', label: 'NEWS' },
    { x: CORN.x, z: CORN.z, w: 12, d: 12, color: '#d9c27a', label: 'OHIO' },
    { x: PARK_POT.x, z: PARK_POT.z, w: 5, d: 5, color: '#ff9a3c', round: true, label: 'POT' },
    { x: TOWER.x, z: TOWER.z, w: 5, d: 5, color: '#d33f2f', round: true },
    { x: CAFE.x, z: CAFE.z, w: 9, d: 7, color: '#ff7bf2', label: 'CAFÉ' },
    { x: TOWERS.x, z: TOWERS.z, w: 9, d: 7, color: '#9aa3b5' },
    { x: MATT_HOUSE.x, z: MATT_HOUSE.z, w: 7, d: 7, color: '#ffe14d', label: 'MATT' },
    { x: HAMPTER_HOUSE.x, z: HAMPTER_HOUSE.z, w: 9, d: 7, color: '#ffb347', label: 'HAMPTER' },
    { x: BANK.x, z: BANK.z, w: 13, d: 11, color: '#efe9dc', label: 'BANK' },
    { x: CASTLE.x, z: CASTLE.z, w: 28, d: 24, color: '#9fb4c6', label: 'CASTLE' },
    { x: UFO.x, z: UFO.z, w: 9, d: 9, color: '#9dff6a', round: true, label: 'UFO' },
    { x: CAT_TREE.x, z: CAT_TREE.z, w: 7, d: 7, color: '#c98bdb', round: true, label: 'CAT TREE' },
    { x: MEOWTOWN.x, z: MEOWTOWN.z, w: 30, d: 30, color: '#b9b2a6', label: 'MEOWTOWN' },
    { x: CASINO.x, z: CASINO.z, w: 11, d: 8, color: '#a03cff', label: '🎰' },
    { x: WINDMILL.x, z: WINDMILL.z, w: 5, d: 5, color: '#cfc6b4', round: true },
    { x: GOLF.x + 3, z: GOLF.z + 7, w: 9, d: 18, color: '#4fc46a', label: 'GOLF' },
  ]);
  const QUEST_SPOTS = {
    boil: PARK_POT, tower: TOWER, news: STUDIO, huh: CORN, maxwell: STATUE, sky: TRAMP, flop: null, box: null, knock: null, babies: null,
    market: MEOWTOWN, windmill: WINDMILL, wish: MEOWTOWN, golf: GOLF,
    fishing: LAKE, golden: LAKE,
    arena: ARENA, hunt: MAZE, clicky1: CAFE, clicky2: null, clicky3: null, kaiju: CASTLE,
    mugs: CAFE, fish: LAKE, headphones: CAT_TREE, vashshelf: MATT_HOUSE, shrine: null, roof: TOWERS, cannonball: TOWERS, lap: RACE, ufo: UFO, swim: LAKE, king: CAT_TREE, gold: null,
  };
  let mapT = 0;
  function updateMap(dt) {
    mapT -= dt;
    if (mapT > 0) return;
    mapT = 0.12;
    const p = claw.position();
    const pois = [...clicky.pois(), ...ducky.pois()];
    for (const [id, spot] of Object.entries(QUEST_SPOTS)) if (spot && !ch.isDone(id)) pois.push({ x: spot.x, z: spot.z });
    hud.updateMap(p.x, p.z, claw.st.yaw, pois);
  }

  const sunAt = spawn.clone();
  const cam = { yaw: Math.PI, pitch: 0.32, dist: 4.4, target: spawn.clone() };
  const st = {
    bonkCd: 0,
    held: null,
    boilCd: 0,
    launchT: 0,
    newsT: 0,
    liveT: 0,
    towerHere: false,
    huhCd: 0,
    danceCd: 0,
    boundsCd: 0,
    sitT: 0,
    sitCd: 0,
    spin: 0,
    oiiaT: 0,
    lowFps: 0,
    saveT: 0,
    trampT: 0,
  };

  const v3 = new THREE.Vector3();
  const v3b = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const ballShape = new RAPIER.Ball(0.9);
  const ident = { x: 0, y: 0, z: 0, w: 1 };
  const camRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });

  const dist2 = (p, x, z) => Math.hypot(p.x - x, p.z - z);

  // ---------- actions ----------
  function bonk() {
    if (st.bonkCd > 0) return;
    st.bonkCd = 0.3;
    claw.lungeNow();
    const k = claw.st.scaleK;
    const p = claw.position();
    claw.forward(fwd);
    const center = { x: p.x + fwd.x * 0.75 * k, y: p.y + 0.1 * k, z: p.z + fwd.z * 0.75 * k };
    ballShape.radius = 0.9 * k;
    const hits = [];
    world.intersectionsWithShape(center, ident, ballShape, (col) => {
      const b = col.parent();
      if (!b || b.handle === claw.body.handle) return true;
      const pr = propByHandle.get(b.handle);
      if (b.isDynamic()) hits.push(b);
      else if (pr && propSync?.isFollowed(pr)) {
        // someone else is moving it: take it over and bonk it anyway
        propSync.claimProp(pr);
        hits.push(b);
      }
      return true;
    });
    // bonk other players' Claws (they get knocked back on their own screen)
    if (players) {
      for (const r of players.near(center, 0.9 * k)) {
        net.send({ t: 'hit', to: r.id, d: [fwd.x * 9 * k, 6 * k, fwd.z * 9 * k] });
        hs.onBonk(r); // Hide and Seek: a seeker found a hider
        ch.chaos(25, `BONKED ${r.name.toUpperCase()}`, '#ff7bf2');
      }
    }
    if (mut.popcat) sfx.pop();
    else sfx.stoke();
    for (const b of hits) {
      const m = b.mass();
      b.wakeUp();
      if (propByHandle.get(b.handle)?.kind === 'golf') {
        // golf: a flat putt, and it counts as a stroke
        b.applyImpulse({ x: fwd.x * 5 * m, y: 0, z: fwd.z * 5 * m }, true);
        S.town.golf.strokes++;
        hud.popup(`BONK ${S.town.golf.strokes}`, '#7CFF4F');
        continue;
      }
      b.applyImpulse({ x: fwd.x * 7 * m * k, y: 3.5 * m * k, z: fwd.z * 7 * m * k }, true);
      b.applyTorqueImpulse({ x: (Math.random() - 0.5) * m, y: (Math.random() - 0.5) * m, z: (Math.random() - 0.5) * m }, true);
      const pr = propByHandle.get(b.handle);
      if (pr && !pr.bonked) {
        pr.bonked = true;
        if (pr.kind === 'matt') {
          ch.chaos(67, 'MATT GOT BONKED', '#ffe14d');
          sfx.meow(900);
        }
        else if (mut.popcat) ch.chaos(15, 'POP', '#ffe14d');
        else ch.chaos(10, 'BONK', '#5ff2ff');
      }
    }
    clicky.onBonk(p); // summoning stones
    ducky.onBonk(p); // Winter's castle sign
    if (dist2(p, WINDMILL.x, WINDMILL.z) < 5 && p.y < 5) {
      S.town.windmill.spin = 14;
      sfx.boom();
      if (!ch.isDone('windmill')) ch.chaos(150, 'WINDMILL GO BRRR', '#fff');
      ch.complete('windmill');
    }
    if (dist2(p, STATUE.x, STATUE.z) < 2.9 && p.y < 4) {
      S.maxwell.spin = 30;
      sfx.oiia();
      ch.chaos(100, 'MAXWELL APPROVES', '#fff');
      ch.complete('maxwell');
    }
  }

  function lick() {
    if (st.held) {
      const b = st.held.body;
      const m = b.mass();
      claw.forward(fwd);
      b.applyImpulse({ x: fwd.x * 6 * m, y: 3 * m, z: fwd.z * 6 * m }, true);
      propSync?.hold(st.held, false);
      st.held = null;
      tongue.visible = false;
      sfx.flap();
      return;
    }
    const k = claw.st.scaleK;
    claw.headPos(v3);
    claw.forward(fwd);
    let best = null;
    let bestD = 2.6 * k;
    for (const pr of W.props) {
      if (pr.gone) continue;
      const t = pr.body.translation();
      v3b.set(t.x - v3.x, t.y - v3.y, t.z - v3.z);
      const d = v3b.length();
      if (d < bestD && v3b.normalize().dot(fwd) > 0.15) {
        best = pr;
        bestD = d;
      }
    }
    if (!best) {
      claw.st.lunge = 0.6;
      hud.popup('*lick* (nothing)', '#ff8fb1');
      return;
    }
    st.held = best;
    trackDaily('lick');
    propSync?.hold(best, true);
    best.body.wakeUp();
    sfx.glorp();
    ch.chaos(5, 'LICKED', '#ff8fb1');
  }

  function holdSpring(dt) {
    const pr = st.held;
    if (!pr) return;
    if (propSync?.isFollowed(pr)) {
      // someone else grabbed it first
      st.held = null;
      tongue.visible = false;
      return;
    }
    const k = claw.st.scaleK;
    const p = claw.position();
    claw.forward(fwd);
    const tx = p.x + fwd.x * 1.1 * k;
    const ty = p.y + 0.55 * k;
    const tz = p.z + fwd.z * 1.1 * k;
    const b = pr.body;
    const t = b.translation();
    const v = b.linvel();
    const m = b.mass();
    const d = Math.hypot(tx - t.x, ty - t.y, tz - t.z);
    if (d > 4 * k) {
      propSync?.hold(pr, false);
      st.held = null;
      tongue.visible = false;
      hud.popup('IT SLIPPED', '#ff8fb1');
      return;
    }
    const gain = 12;
    b.applyImpulse(
      { x: ((tx - t.x) * gain - v.x) * m * 0.35, y: ((ty - t.y) * gain - v.y) * m * 0.35 + 20 * m * dt, z: ((tz - t.z) * gain - v.z) * m * 0.35 },
      true
    );
    const av = b.angvel();
    b.setAngvel({ x: av.x * 0.9, y: av.y * 0.9, z: av.z * 0.9 }, true);
  }

  function drawTongue() {
    if (!st.held) {
      tongue.visible = false;
      return;
    }
    claw.headPos(v3);
    claw.forward(fwd);
    v3.addScaledVector(fwd, 0.15 * claw.st.scaleK);
    const t = st.held.body.translation();
    v3b.set(t.x, t.y, t.z);
    const len = v3.distanceTo(v3b);
    tongue.visible = true;
    tongue.position.copy(v3).add(v3b).multiplyScalar(0.5);
    tongue.scale.set(claw.st.scaleK, len, claw.st.scaleK);
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v3b.sub(v3).normalize());
    tongue.quaternion.copy(q);
  }

  // ---------- gameplay checks ----------
  function checks(dt, t) {
    const p = claw.position();
    const k = claw.st.scaleK;

    // knocked props
    for (const pr of W.props) {
      if (pr.body.isSleeping() || !mine(pr)) continue;
      const tr = pr.body.translation();
      if (!pr.moved && Math.hypot(tr.x - pr.spawn.x, tr.z - pr.spawn.z) > 0.7) {
        pr.moved = true;
        if (!pr.elevated) ch.chaos(5, null);
      }
      if (pr.elevated && !pr.knocked && tr.y < pr.spawn.y - 0.45) {
        pr.knocked = true;
        ch.chaos(50, pick(KNOCK), '#ffe14d');
        ch.progress('knock');
        trackDaily('knock');
        if (pr.kind === 'mug') trackDaily('mug');
        if (pr.kind === 'mug') ch.progress('mugs');
        if (pr.kind === 'market') ch.progress('market');
      }
    }

    // giant soup pot
    st.boilCd -= dt;
    if (st.boilCd <= 0 && dist2(p, PARK_POT.x, PARK_POT.z) < W.POT_R - 0.25 && p.y < S.soupY + 0.6) {
      st.boilCd = 4;
      st.launchT = 1.3;
      sfx.splash();
      sfx.boom();
      sfx.meow(700);
      bump('boiled');
      trackDaily('boil');
      net?.send({ t: 'fx', text: 'got boiled 🍲' });
      ch.chaos(200, 'SELF-BOILED', '#ff9a3c');
      ch.complete('boil');
      hud.hint('Claw has been boiled. He seems fine.', 2500);
    }
    if (st.launchT > 0) {
      st.launchT -= dt;
      if (st.launchT <= 0) {
        const v = claw.body.linvel();
        claw.body.setLinvel({ x: v.x + (Math.random() - 0.5) * 4, y: 15, z: v.z - 5 }, true);
        hud.popup('TOO SPICY', '#ff4f6d');
      }
    }

    // radio tower top
    const onTower = p.y > S.towerTop - 0.3 && dist2(p, TOWER.x, TOWER.z) < 3;
    if (onTower && !st.towerHere) {
      sfx.ding();
      ch.chaos(150, 'PHONE HOME', '#5ff2ff');
      ch.complete('tower');
    }
    st.towerHere = onTower;

    // higher than the tower (only counts when the trampoline launched you)
    st.trampT -= dt;
    if (p.y > S.towerTop + 2 && st.trampT > 0) {
      if (!ch.isDone('sky')) ch.chaos(300, 'SKY CLAW', '#5ff2ff');
      ch.complete('sky');
    }

    // news spot
    const spot = S.newsSpot;
    if (dist2(p, spot.x, spot.z) < 1.0 && p.y < spot.y + 1.3) {
      st.newsT += dt;
      if (st.newsT > 1.2 && st.liveT <= 0) {
        st.liveT = 10;
        sfx.win();
        ch.chaos(150, 'LIVE ON GLORP CAT NEWS', '#ff4f6d');
        ch.complete('news');
      }
    } else {
      st.newsT = 0;
    }
    st.liveT -= dt;
    S.news.update(t, st.liveT > 0);
    S.newsRing.material.color.setHSL(st.newsT > 0 ? 0.33 : 0.14, 1, 0.55 + 0.1 * Math.sin(t * 6));

    // if I fits I sits
    st.sitCd -= dt;
    let sitting = null;
    if (claw.st.speed < 1.2) {
      for (const pr of W.props) {
        if (pr.kind !== 'box') continue;
        const tr = pr.body.translation();
        const r = pr.body.rotation();
        q.set(r.x, r.y, r.z, r.w).invert();
        v3.set(p.x - tr.x, p.y - tr.y, p.z - tr.z).applyQuaternion(q);
        const h = pr.half;
        if (Math.abs(v3.x) < h.x + 0.15 && Math.abs(v3.z) < h.z + 0.15 && v3.y > -h.y && v3.y < h.y + 0.6) {
          sitting = pr;
          // inside beats on top: keep looking in case Claw is in the MEGA BOX
          if (pr.mega) break;
        }
      }
    }
    st.sitT = sitting ? st.sitT + dt : 0;
    if (sitting && st.sitT > 1 && st.sitCd <= 0) {
      st.sitCd = 6;
      sfx.purr();
      const inside = sitting.mega && p.y - sitting.body.translation().y < 0;
      ch.chaos(inside ? 300 : 100, inside ? 'ABSOLUTE UNIT OF A BOX' : 'IF I FITS I SITS', '#7CFF4F');
      ch.complete('box');
    }

    // Huh Cat
    st.huhCd -= dt;
    if (S.huh && st.huhCd <= 0 && dist2(p, S.huh.position.x, S.huh.position.z) < 2.4) {
      st.huhCd = 4;
      sfx.oiia();
      hud.popup('huh?', '#fff');
      S.huh.scale.set(2.3, 2.3, 1);
      setTimeout(() => S.huh && S.huh.scale.set(1.8, 1.8, 1), 400);
      if (!ch.isDone('huh')) ch.chaos(150, 'FOUND HUH CAT', '#fff');
      ch.complete('huh');
    }

    // dancer
    st.danceCd -= dt;
    if (S.dancer && st.danceCd <= 0 && dist2(p, S.dancer.position.x, S.dancer.position.z) < 2.4) {
      st.danceCd = 3.5;
      hud.popup(pick(['CHIPI CHIPI CHAPA CHAPA', 'DUBI DUBI DABA DABA', 'MAGICO MI DUBI DUBI']), '#7CFF4F');
    }

    // Baby Glorps
    S.babies.forEach((b, i) => {
      if (!b.visible) return;
      if (b.position.distanceTo(v3.set(p.x, p.y, p.z)) < 1.1 * k + 0.2) {
        b.visible = false;
        if (ch.babyFound(i)) {
          sfx.ding();
          ch.chaos(120, `BABY GLORP ${ch.state.babies.length}/5`, '#7CFF4F');
        }
      }
    });

    // flop
    if (claw.st.flopping && claw.st.flopTime > 5 && !ch.isDone('flop')) {
      ch.chaos(150, 'LIQUID CAT', '#ff7bf2');
      ch.complete('flop');
    }
    if (claw.st.flopping && !claw.st.grounded) {
      const av = claw.body.angvel();
      st.spin += Math.hypot(av.x, av.y, av.z) * dt;
    }

    // leaving Ohio
    st.boundsCd -= dt;
    if ((Math.abs(p.x) > BOUNDS - 2 || Math.abs(p.z) > BOUNDS - 2) && st.boundsCd <= 0) {
      st.boundsCd = 3;
      hud.popup("YOU CAN'T LEAVE OHIO", '#ff4f6d');
    }
    if (p.y < -6) claw.teleport(spawn.x, 2, spawn.z);

    const reset = (pr, delay = 3000) => setTimeout(() => (propSync ? propSync.reset(pr) : null), delay);
    S.districts.check(dt, t, { claw, ch, hud, sfx, mine, reset, online: !!net?.connected });
    S.town.check(dt, t, { claw, ch, hud, sfx, mine, reset, online: !!net?.connected });
    updateMachines();
    winty?.update(dt, t, claw);
    pets.update(dt);
    vash.update(dt, t);
    hampter.update(dt, t);
    clicky.update(dt, t, { props: W.props, mine, reset, online: !!net?.connected });
    emotes.update(dt);
    // timed daily quests
    if (emotes.dancing) trackDaily('danceSec', dt);
    if (claw.st.zooming) trackDaily('zoomSec', dt);
    if (claw.st.flopping) trackDaily('flopSec', dt);
    const castleD = dist2(p, CASTLE.x, CASTLE.z);
    if (castleD < 40) trackDaily('snowSec', dt);
    if (castleD < 16 && env.isNight) trackDaily('nightcastle');
    daily.update(dt);
    kaiju.control(dt);
    romni.update(dt, t);
    castle.update(dt);
    loans.update(dt);
    hs.update(dt, t);
    if (winty?.mode === 'collect' && !loans.collecting) winty.stopCollect(ducky.mode ? 'ducky' : null); // paid (or Ducky) while she was on the way
    ducky.update(dt, t);
    respectCd -= dt;

    // OIIA mode soundtrack
    if (mut.oiia) {
      st.oiiaT -= dt;
      if (st.oiiaT <= 0) {
        st.oiiaT = 0.7;
        sfx.oiia();
      }
    }
  }

  // ---------- multiplayer (shared Ohio via the claw-ohio Worker) ----------
  const url = mpUrl();
  var net = url ? createNet(url) : null; // var: equipSkin/equipPet above may run first
  let players = null;
  let propSync = null;
  let mpUi = null;
  let myName = read('simname', '') || `Glorp${Math.floor(100 + Math.random() * 900)}`;
  if (net) {
    propSync = createPropSync({ RAPIER, world, W, net });
    mpUi = createMpUi(wrap, {
      touch,
      onSend: (text) => net.send({ t: 'chat', text }),
      onOpenChange: () => {},
      onToggle: () => setOnline(!online),
    });
    players = createPlayers({
      RAPIER,
      world,
      scene,
      net,
      petsGltf,
      envMap: claw.envMap,
      faceTex: face,
      mattTex: matt,
      onFeed: (text, color) => mpUi.feed(text, color),
      onHit: (d, name) => {
        const v = claw.body.linvel();
        claw.body.setLinvel({ x: v.x + d[0], y: Math.max(v.y, 0) + d[1], z: v.z + d[2] }, true);
        claw.lungeNow();
        sfx.boing();
        hud.popup(`BONKED BY ${name.toUpperCase()}`, '#ff7bf2');
      },
    });
    net.on('status', (up) => {
      mpUi.setStatus(up, players.count, !online);
      if (up) mpUi.feed('Connected to the shared Ohio 🌐', '#7CFF4F');
      else if (online) mpUi.feed('Lost connection, retrying…', '#ff4f6d');
    });
    net.on('full', () => mpUi.feed('Ohio is full right now (12 Claws). Playing solo.', '#ff4f6d'));
    // someone pulled the dungeon lever: every cell door opens for a few seconds
    net.on('unlock', (m) => {
      castle.openCell();
      const who = players.remotes.get(m.id)?.name || 'Someone';
      mpUi.feed(`${who} opened the dungeon cell 🔓`, '#7CFF4F');
      if (castle.inCell(claw.position())) hud.banner('YOU ARE FREE', `${who} opened your cell. RUN.`);
    });
    ch.onComplete((id) => {
      const c = ch.CHALLENGES.find((x) => x.id === id);
      if (c) net.send({ t: 'fx', text: `finished "${c.name}" 🏆` });
    });
    mpUi.setStatus(false, 0, true);
  }
  // Pet Battles (arena) and Hide and Seek (maze), both work offline and online
  const fx = (text) => net?.connected && net.send({ t: 'fx', text });
  const battles = createBattles({ wallet, hud, sfx, ch, net, players, openPanel, onFx: fx });
  // Clicky the Wizard (Winter's Castle) and the Battle of Ohio his quest chain ends in
  const D = S.districts;
  const clicky = createClicky({
    scene,
    world,
    RAPIER,
    gltf: clickyGltf,
    hud,
    sfx,
    ch,
    claw,
    home: D.clickyHome,
    pageSpots: [
      new THREE.Vector3(BANK.x + 4.0, 1.5, BANK.z + 3.2), // in the bank, by the vault
      new THREE.Vector3(MAZE.x, 2.0, MAZE.z), // over the hedge maze fountain
      new THREE.Vector3(CAT_TREE.x, D.treeTop + 0.9, CAT_TREE.z), // the Cat Tree crown
      new THREE.Vector3(UFO.x, 1.3, UFO.z), // under the UFO
    ],
    stoneSpots: [
      Object.assign(new THREE.Vector3(ARENA.x, 0.4, ARENA.z), { ry: Math.PI }), // centre of the arena
      Object.assign(new THREE.Vector3(LAKE.x + 11, 0, LAKE.z - 19), { ry: 0.3 }), // the lake shore
      Object.assign(new THREE.Vector3(TOWER.x + 5.5, 0, TOWER.z + 1), { ry: -0.6 }), // the radio tower
    ],
    onSummon: () => {
      const err = kaiju.summon();
      if (!err) setTimeout(closeMenu, 400);
      return err;
    },
  });
  MACHINES.clicky = { prompt: '🧙 TALK TO CLICKY', title: 'CLICKY THE WIZARD', open: () => clicky.panel(!!net?.connected) };
  var kaiju = createKaiju( // var: setMusic and updateCamera above may run first
    { RAPIER, scene, camera, wrap, hud, sfx, ch, wallet, claw, world, W, sky, music, mattGltf: megaMattGltf, mattTex: matt, applyMutators, net, players, onFx: fx, env });
  if (net) {
    net.on('welcome', (m) => typeof m.now === 'number' && env.setServerOffset(m.now - Date.now()));
    net.on('ev', (m) => kaiju.onEv(m));
    net.on('welcome', (m) => kaiju.onWelcome(m));
  }
  // emote wheel (G) and dances
  var emotes = createEmotes({ wrap, scene, claw, hud, sfx, net, players, touch, hampter, isPlaying: () => playing, isPaused: () => menuOpen, onEmote: () => trackDaily('emote') });
  const hs = createHideSeek({ scene, wrap, claw, hud, sfx, ch, wallet, net, players, park: S.park, feed: (t, c) => mpUi?.feed(t, c), onFx: fx, closePanel: () => closeMenu() });
  if (net) {
    net.on('duel', (m) => battles.onDuel(m));
    net.on('leave', (m) => battles.onLeave(m.id));
  }
  // Online (shared Ohio) or offline (solo). Progress, coins and skins are the same either way.
  let online = false;
  function setOnline(on) {
    if (!net) return;
    online = on;
    write('simonline', on);
    if (on) {
      net.start(() => ({ name: myName, skin: wallet.equipped, pet: wallet.pet, v: WORLD_VERSION }));
      mpUi.setStatus(false, 0);
      mpUi.feed('Going online…', '#7CFF4F');
    } else {
      net.stop();
      mpUi.setStatus(false, 0, true);
      mpUi.feed('Playing offline 🎮 (your progress is the same either way)', '#9aa0a8');
    }
  }
  const mine = (pr) => !propSync || propSync.mine(pr);
  let netT = 0;
  function sendState(dt) {
    netT -= dt;
    if (!net?.connected || netT > 0) return;
    netT = 0.1;
    const p = claw.position();
    const v = claw.body.linvel();
    const r = claw.body.rotation();
    const c = claw.st;
    const flags =
      (c.grounded ? FLAG.grounded : 0) |
      (c.flopping ? FLAG.flopping : 0) |
      (c.zooming ? FLAG.zooming : 0) |
      (mut.oiia ? FLAG.oiia : 0) |
      (mut.cursed ? FLAG.cursed : 0) |
      (mut.matt ? FLAG.matt : 0) |
      (ducky.mode ? FLAG.ducky : 0);
    const R2 = (x) => Math.round(x * 100) / 100;
    const R3 = (x) => Math.round(x * 1000) / 1000;
    net.send({ t: 'p', d: [R2(p.x), R2(p.y), R2(p.z), R3(c.yaw), R2(v.x), R2(v.y), R2(v.z), R3(r.x), R3(r.y), R3(r.z), R3(r.w), R2(c.scaleK), flags] });
    mpUi.setStatus(true, players.count);
  }

  if (ch.isDone('vashshelf')) retireVashSword();

  const events = {
    land(air) {
      if (st.spin > Math.PI * 2) {
        const n = Math.floor(st.spin / (Math.PI * 2));
        ch.chaos(40 * n, `OIIA SPIN x${n}`, '#ff7bf2');
      }
      st.spin = 0;
      if (air > 1.5) sfx.mrrp();
      if (air > 0.9) ch.chaos(Math.round(air * 30), air > 2 ? 'SKIBIDI AIRTIME' : 'BIG AIR', '#5ff2ff');
    },
  };

  function applyMutators() {
    world.gravity = { x: 0, y: mut.gravity ? -6.5 : -20, z: 0 };
    claw.setScale(mut.big ? 2.6 : mut.tiny ? 0.45 : 1);
    cam.dist = mut.big ? 8.5 : mut.tiny ? 2.6 : 4.4;
    refreshFace();
  }

  // ---------- camera ----------
  function updateCamera(dt, input) {
    if (kaiju?.camera(cam, dt)) {
      // locked on the titans while Claw flies around
      const p = claw.position();
      cam.target.set(p.x, p.y + 0.55, p.z);
      hideBlockingTrees();
      sunAt.set(p.x, p.y, p.z);
      return;
    }
    const sens = touch ? 0.006 : 0.0035;
    cam.yaw -= input.lookX * sens;
    cam.pitch = Math.max(-0.25, Math.min(1.2, cam.pitch + input.lookY * sens));
    const p = claw.position();
    const k = claw.st.scaleK;
    v3.set(p.x, p.y + 0.55 * k, p.z);
    cam.target.lerp(v3, 1 - Math.exp(-14 * dt));
    const cp = Math.cos(cam.pitch);
    const dir = v3b.set(Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp);
    let d = cam.dist;
    camRay.origin = { x: cam.target.x, y: cam.target.y, z: cam.target.z };
    camRay.dir = { x: dir.x, y: dir.y, z: dir.z };
    const hit = world.castRay(camRay, d, true, undefined, undefined, undefined, claw.body, (c) => !c.parent() || c.parent().isFixed() || camBlockers.has(c.parent().handle));
    if (hit) d = Math.max(0.6, hit.timeOfImpact - 0.25);
    camera.position.copy(cam.target).addScaledVector(dir, d);
    camera.lookAt(cam.target);
    hideBlockingTrees();
    // where the shadow camera should be (applied when the shadow map is next refreshed)
    sunAt.set(p.x, p.y, p.z);
  }

  // Trees between the camera and Claw get hidden so the canopy never blocks the view.
  function hideBlockingTrees() {
    const ax = camera.position.x;
    const az = camera.position.z;
    const bx = cam.target.x;
    const bz = cam.target.z;
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    for (const tr of S.trees) {
      let u = ((tr.x - ax) * dx + (tr.z - az) * dz) / len2;
      u = Math.max(0, Math.min(1, u));
      const px = ax + dx * u - tr.x;
      const pz = az + dz * u - tr.z;
      tr.handle.setVisible(!(px * px + pz * pz < 6.5 && camera.position.y < tr.h));
    }
  }

  // ---------- loop ----------
  const timer = new THREE.Timer();
  let acc = 0;
  let raf = 0;
  let alive = true;
  let fpsT = 0;
  let fpsN = 0;

  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.1);
    const t = timer.getElapsed();
    if (playing && !menuOpen) {
      const input = controls.consume();
      if (kaiju.frozen) {
        // the Battle of Ohio: you're along for the ride. BONK cheers for Matt, LICK for Godzilla.
        if (input.bonk) kaiju.cheer('m');
        if (input.lick) kaiju.cheer('g');
        input.moveX = input.moveY = 0;
        input.jump = input.bonk = input.lick = input.flop = input.zoom = false;
      }
      if (hs.frozen) {
        // the blindfolded Hide and Seek seeker waits (looking around is fine, it's all black anyway)
        input.moveX = input.moveY = 0;
        input.jump = input.bonk = input.lick = input.flop = input.zoom = false;
      }
      updateCameraYawOnly(input);
      claw.control(dt, input, cam.yaw, events);
      // trampoline bounce
      if (claw.st.grounded && claw.st.groundCollider && claw.st.groundCollider.handle === S.trampCollider.handle) {
        const v = claw.body.linvel();
        claw.body.setLinvel({ x: v.x, y: 29 * Math.sqrt(claw.st.scaleK), z: v.z }, true);
        sfx.boing();
        if (st.trampT <= 3) trackDaily('tramp'); // one per bounce, not per frame on the mat
        st.trampT = 4;
        S.trampMat.scale.y = 0.2;
        ch.chaos(20, 'BOING', '#5ff2ff');
      }
      if (input.bonk) bonk();
      if (input.lick) {
        // at a casino machine, E / LICK plays it instead of licking
        if (machine) playMachine(machine);
        else lick();
      }
      holdSpring(dt);
      st.bonkCd -= dt;
      propSync?.update(dt);
      players?.update();
      acc += dt;
      let steps = 0;
      while (acc >= 1 / 60 && steps < 4) {
        world.step();
        acc -= 1 / 60;
        steps++;
      }
      W.syncProps();
      propSync?.syncFollowed();
      claw.sync(dt, t, mut);
      players?.sync(dt, t);
      sendState(dt);
      drawTongue();
      checks(dt, t);
      ch.update(dt);
      hud.setEnergy(claw.st.energy);
      updateMap(dt);
      updateCamera(dt, { lookX: 0, lookY: 0 });
      st.saveT += dt;
      if (st.saveT > 5) {
        st.saveT = 0;
        ch.saveBest();
      }
    } else {
      claw.sync(0, t, mut);
      updateCamera(dt, { lookX: 0, lookY: 0 });
      if (!playing) cam.yaw += dt * 0.25;
    }
    S.trampMat.scale.y += (1 - S.trampMat.scale.y) * Math.min(1, dt * 8);
    W.update(dt, t);
    sr.update(dt, playing && !menuOpen);
    kaiju.update(dt);
    env.update(dt, t);
    sky.position.copy(camera.position);
    // Behind a menu, panel or the start screen the world barely shows: render a fraction of
    // the frames. Nothing at all in a background tab.
    idleN++;
    const covered = !playing || menuOpen;
    if (!document.hidden && (!covered || idleN % (playing ? 8 : 4) === 0)) {
      // Shadow pass (~35% of draw calls) only every other rendered frame. The sun follows Claw
      // on the same frames, so shadows never slide against the map.
      shadowFlip = !shadowFlip;
      if (shadowFlip) {
        S.sun.position.copy(sunAt).add(env.sunOffset);
        S.sun.target.position.copy(sunAt);
        renderer.shadowMap.needsUpdate = true;
      }
      gfx.render(t);
    }

    // drop to Low graphics once if the device is struggling
    fpsT += dt;
    fpsN++;
    if (fpsT > 4) {
      const fps = fpsN / fpsT;
      if (playing && !menuOpen && !forceHigh && fps < 40 && rung < LADDER.length - 1) {
        setRung(rung + 1);
        if (LADDER[rung].q === 'low' && LADDER[rung - 1].q === 'high') hud.hint('Graphics set to Low for smoother glorping (change it in the menu).', 4000);
      }
      fpsT = 0;
      fpsN = 0;
    }
  }

  function updateCameraYawOnly(input) {
    const sens = touch ? 0.006 : 0.0035;
    cam.yaw -= input.lookX * sens;
    cam.pitch = Math.max(-0.25, Math.min(1.2, cam.pitch + input.lookY * sens));
  }

  // ---------- menus ----------
  function menuContent() {
    const box = document.createElement('div');
    box.className = 'sim-menu';
    if (net) {
      const oh = document.createElement('h3');
      const others = players ? [...players.remotes.values()].map((r) => r.name) : [];
      oh.textContent = net.connected ? `In Ohio right now (${others.length + 1})` : 'Shared Ohio: offline (retrying)';
      box.appendChild(oh);
      if (net.connected) {
        const p = document.createElement('p');
        p.className = 'mp-names';
        p.textContent = [`${myName} (you)`, ...others].join(' · ');
        box.appendChild(p);
      }
    }
    const quick = document.createElement('div');
    quick.className = 'sim-mutators';
    for (const [label, fn] of [[`📜 Quests ${ch.count()}/${ch.CHALLENGES.length}${touch ? '' : ' (J)'}`, openQuests], [`🎮 Controls${touch ? '' : ' (H)'}`, openControls]]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn small primary';
      b.textContent = label;
      b.addEventListener('click', () => {
        sfx.click();
        fn();
      });
      quick.appendChild(b);
    }
    box.appendChild(quick);
    const h2 = document.createElement('h3');
    h2.textContent = 'Mutators';
    box.appendChild(h2);
    const row = document.createElement('div');
    row.className = 'sim-mutators';
    for (const m of ch.MUTATORS) {
      const b = document.createElement('button');
      b.type = 'button';
      const ok = ch.unlocked(m.id);
      b.className = 'btn small' + (mut[m.id] ? ' primary' : '');
      b.disabled = !ok;
      b.textContent = ok ? `${mut[m.id] ? '✔ ' : ''}${m.name}` : `🔒 ${m.name} (${m.need})`;
      b.title = m.desc;
      b.addEventListener('click', () => {
        mut[m.id] = !mut[m.id];
        if (m.id === 'big' && mut.big) mut.tiny = false;
        if (m.id === 'tiny' && mut.tiny) mut.big = false;
        applyMutators();
        sfx.click();
        openMenu();
      });
      row.appendChild(b);
    }
    {
      const b = document.createElement('button');
      b.type = 'button';
      const ok = ducky.stage === 'done';
      b.className = 'btn small' + (ducky.mode ? ' primary' : '');
      b.disabled = !ok;
      b.textContent = ok ? `${ducky.mode ? '✔ ' : ''}🦆 Ducky Mode` : "🔒 Ducky Mode (Ducky's quest)";
      b.title = 'Ducky is your bodyguard: Winty runs from you and your Romni loan never comes due';
      b.addEventListener('click', () => {
        ducky.setMode(!ducky.mode);
        sfx.quack();
        openMenu();
      });
      row.appendChild(b);
    }
    box.appendChild(row);
    const h3 = document.createElement('h3');
    h3.textContent = 'Graphics';
    box.appendChild(h3);
    const gfxRow = document.createElement('div');
    gfxRow.className = 'sim-mutators';
    for (const qv of ['high', 'low']) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn small' + (gfx.quality === qv ? ' primary' : '');
      b.textContent = qv === 'high' ? 'High (bloom, shadows)' : 'Low (fast)';
      b.addEventListener('click', () => {
        setRung(qv === 'high' ? 0 : 2);
        write('simgfx', qv);
        sfx.click();
        openMenu();
      });
      gfxRow.appendChild(b);
    }
    box.appendChild(gfxRow);
    // volume sliders (saved; the 🔊 button is still the quick mute)
    const hv = document.createElement('h3');
    hv.textContent = 'Sound';
    box.appendChild(hv);
    const vol = document.createElement('div');
    vol.className = 'sim-volume';
    for (const [kind, label] of [['master', '🔊 Master'], ['music', '🎵 Music'], ['sfx', '💥 Sound effects'], ['ambient', '🌧️ Rain & weather']]) {
      const row = document.createElement('label');
      row.className = 'sim-vol';
      const name = document.createElement('span');
      name.textContent = label;
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '100';
      slider.step = '5';
      slider.dataset.kind = kind;
      slider.value = String(Math.round(getVolume(kind) * 100));
      const pct = document.createElement('b');
      pct.textContent = `${slider.value}%`;
      slider.addEventListener('input', () => {
        setVolume(kind, slider.value / 100);
        pct.textContent = `${slider.value}%`;
      });
      if (kind === 'master' || kind === 'sfx') slider.addEventListener('change', () => sfx.click()); // preview
      row.append(name, slider, pct);
      vol.appendChild(row);
    }
    if (isMuted()) {
      const p = document.createElement('p');
      p.className = 'fine';
      p.textContent = 'Sound is muted: tap 🔊 (bottom right) to unmute.';
      vol.appendChild(p);
    }
    box.appendChild(vol);
    const h4 = document.createElement('h3');
    h4.textContent = 'Settings';
    box.appendChild(h4);
    const setRow = document.createElement('div');
    setRow.className = 'sim-mutators';
    const toggles = [
      ...(net ? [['Online', online, setOnline]] : []),
      ['Music', music.enabled, setMusic],
      ['Antenna glow', read('simglow', true), (v) => { claw.setGlow(v); write('simglow', v); }],
    ];
    for (const [label, on, set] of toggles) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn small' + (on ? ' primary' : '');
      b.textContent = `${label}: ${on ? 'On' : 'Off'}`;
      b.addEventListener('click', () => {
        set(!on);
        sfx.click();
        openMenu();
      });
      setRow.appendChild(b);
    }
    box.appendChild(setRow);
    return box;
  }

  // ---------- quest log (J) ----------
  function questsContent() {
    const box = document.createElement('div');
    box.className = 'sim-menu sim-quests';
    const section = (title) => {
      const h = document.createElement('h3');
      h.textContent = title;
      box.appendChild(h);
    };
    const list = (rows) => {
      const ul = document.createElement('ul');
      for (const [text, done, now] of rows) {
        const li = document.createElement('li');
        li.textContent = `${done ? '✅' : now ? '👉' : '⬜'} ${text}`;
        if (done) li.className = 'done';
        if (now) li.className = 'now';
        ul.appendChild(li);
      }
      box.appendChild(ul);
    };
    section('📅 Daily quests');
    box.appendChild(daily.section());
    if (ducky.escapes > 0) {
      section(ducky.here ? "🦆 Ducky's quest (prank Winter)" : '🦆 ???');
      list(ducky.steps());
    }
    section("🧙 Clicky's quest (Winter's Castle)");
    list(clicky.steps());
    section(`🏆 Claw-lenges ${ch.count()}/${ch.CHALLENGES.length}`);
    const bar = document.createElement('div');
    bar.className = 'sim-qbar';
    bar.innerHTML = '<i></i>';
    bar.firstChild.style.width = `${(ch.count() / ch.CHALLENGES.length) * 100}%`;
    box.appendChild(bar);
    const rows = ch.CHALLENGES.map((c) => {
      const done = ch.isDone(c.id);
      const prog = c.goal && !done ? ` (${ch.state.progress[c.id] || 0}/${c.goal})` : '';
      return [`${c.name}${prog}`, done, false];
    });
    list([...rows.filter((r) => !r[1]), ...rows.filter((r) => r[1])]); // to-do first
    return box;
  }
  function openQuests() {
    if (!playing) return;
    openPanel('QUEST LOG', questsContent(), null, 'quests');
  }

  // ---------- controls (H, and once on the first visit) ----------
  function controlsContent() {
    const box = document.createElement('div');
    box.className = 'sim-controls';
    const rows = touch
      ? [
          ['Left stick', 'Move'],
          ['Drag the screen', 'Look around'],
          ['JUMP', 'Jump (tap twice for a glorp jump)'],
          ['BONK', 'Bonk things (and other Claws)'],
          ['LICK', 'Grab / throw with your tongue, use machines and talk'],
          ['FLOP', 'Ragdoll'],
          ['Hold ZOOM', 'Zoomies (uses 3AM energy)'],
          ['😀', 'Emote wheel: dances and emotes'],
          ['🏆 chip', 'Quest log'],
          ['☰', 'Menu: mutators, skins & pets, settings'],
          ['💬', 'Chat (online)'],
        ]
      : [
          ['W A S D', 'Move'],
          ['Mouse', 'Look (click the game to lock the mouse)'],
          ['Space', 'Jump (twice for a glorp jump)'],
          ['F / Left click', 'Bonk things (and other Claws)'],
          ['E / Right click', 'Lick: grab / throw, use machines, talk'],
          ['R', 'Flop (ragdoll)'],
          ['Shift', 'Zoomies (uses 3AM energy)'],
          ['G', 'Emote wheel: dances and emotes (then 1-8)'],
          ['T / Enter', 'Chat (online)'],
          ['J', 'Quest log'],
          ['H', 'This controls card'],
          ['P / Tab', 'Menu (press again to close)'],
          ['M', 'Music on / off (volume sliders are in the P menu)'],
          ['Y / N', 'Answer invites (Hide and Seek, pet battles)'],
        ];
    for (const [k, what] of rows) {
      const row = document.createElement('div');
      row.className = 'sim-ctl';
      const keys = document.createElement('span');
      keys.className = 'sim-keycaps';
      for (const part of k.split(' / ')) {
        const kb = document.createElement('kbd');
        kb.textContent = part;
        keys.appendChild(kb);
      }
      const d = document.createElement('span');
      d.textContent = what;
      row.append(keys, d);
      box.appendChild(row);
    }
    return box;
  }
  function openControls() {
    if (!playing) return;
    openPanel('CONTROLS', controlsContent(), null, 'controls');
  }

  // P / Tab / Esc close whatever is open; J and H toggle their windows.
  // (window + capture: runs before the game's own keys, so P doesn't instantly reopen the menu)
  function onUiKey(e) {
    if (!playing || e.repeat || (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'))) return;
    const toggle = { KeyJ: ['quests', openQuests], KeyH: ['controls', openControls] }[e.code];
    if (toggle) {
      e.preventDefault();
      e.stopPropagation();
      if (overlayKind === toggle[0]) closeMenu();
      else toggle[1]();
      return;
    }
    if (menuOpen && (e.code === 'KeyP' || e.code === 'Tab' || e.code === 'Escape')) {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
    }
  }
  window.addEventListener('keydown', onUiKey, true);

  function openMenu() {
    if (!playing) return;
    runPanelClose();
    menuOpen = true;
    overlayKind = 'menu';
    emotes?.close();
    music.duck(true);
    controls.setEnabled(false);
    showOverlay(wrap, {
      title: 'PAUSED',
      extra: menuContent(),
      buttons: [
        { label: 'Resume', primary: true, onClick: closeMenu },
        {
          label: 'Respawn',
          onClick: () => {
            claw.setFlop(false);
            claw.teleport(spawn.x, spawn.y + 0.5, spawn.z);
            closeMenu();
          },
        },
        { label: 'Skins & Pets', onClick: () => openPanel('SKINS & PETS', casino.wardrobe()) },
        { label: sr.running ? '🏁 Speedrun' : '🏁 Speedrun / Reset', onClick: () => openPanel('SPEEDRUN & RESET', sr.panel({ onReset: resetProgress })) },
        { label: 'Credits', onClick: openCredits },
        { label: '← Back to Arcade', onClick: exitToArcade },
      ],
    });
  }

  function openCredits() {
    sfx.click();
    const box = document.createElement('div');
    box.className = 'sim-credits';
    const add = (tag, text, cls) => {
      const el = document.createElement(tag);
      el.textContent = text;
      if (cls) el.className = cls;
      box.appendChild(el);
      return el;
    };
    const pogs = document.createElement('div');
    pogs.className = 'credits-pogs';
    for (let i = 0; i < 5; i++) {
      const img = document.createElement('img');
      img.src = 'assets/sim-matt.webp';
      img.alt = i === 2 ? 'Mattpog' : '';
      img.style.animationDelay = `${-i * 0.18}s`;
      pogs.appendChild(img);
    }
    box.appendChild(pogs);
    add('p', 'HALL OF FAME', 'credits-label');
    add('p', '🏆 ArcticGemstone 🏆', 'credits-champ');
    add('p', 'First to play Claw Simulator. First to beat it.', 'credits-sub');
    add('p', 'CLAW MUST BE BOILED', 'credits-boil');
    add('h3', 'Claw facts (verified by Matt)');
    const facts = [...CLAW_ROASTS].sort(() => Math.random() - 0.5).slice(0, 4);
    facts.push(`Times Claw has been boiled: ${stat('boiled')}. Not enough.`);
    const ul = document.createElement('ul');
    ul.className = 'credits-roasts';
    for (const f of facts) {
      const li = document.createElement('li');
      li.textContent = f;
      ul.appendChild(li);
    }
    box.appendChild(ul);
    add('h3', 'Starring');
    add('p', 'Claw (deathclaw1551) as himself, a seasoning. Matt as the Mayor of Ohio and the face of pog. Ms Winter (Winty) as the unlicensed Ohio pharmacist and part-time debt collector. Romni as a totally legit banker. Clicky as Winter’s wizard (former). Ducky as Winty’s little brother and Romni’s oldest business associate. Mega Matt and Mega Godzilla as themselves. Lyonia (Vash) as himself, fun-sized. Maxwell, Popcat, OIIA Cat, Banana Cat, Huh Cat, Grumpy Cat, Smudge, Nyan Cat and the Baby Glorps.');
    add('h3', 'Made with');
    add('p', '3D models: Quaternius (cat, nature) and Kenney (furniture, Fantasy Town, Minigolf, Cube Pets, Mini Characters), all CC0. Engine: three.js + Rapier physics. Music: "Glorp Groove", an original chiptune with real fake meows.');
    add('p', 'No real cats were harmed. Claw must still be boiled.', 'credits-sub');
    showOverlay(wrap, {
      title: 'CREDITS',
      extra: box,
      buttons: [{ label: 'Back', primary: true, onClick: openMenu }],
    });
  }

  function closeMenu() {
    runPanelClose();
    hideOverlay(wrap);
    menuOpen = false;
    overlayKind = null;
    music.duck(false);
    controls.setEnabled(true);
    controls.requestLock();
  }

  function onLockChange() {
    if (!touch && playing && !menuOpen && !controls.isLocked() && st.hadLock) openMenu();
    st.hadLock = controls.isLocked();
  }
  document.addEventListener('pointerlockchange', onLockChange);

  ch.onComplete(() => {
    // tell players about new toys
    const n = ch.count();
    const m = ch.MUTATORS.find((x) => x.need === n);
    if (m) setTimeout(() => hud.hint(`Mutator unlocked: ${m.name}. Open the menu (${touch ? '☰' : 'P'}) to turn it on.`, 5000), 3400);
  });

  function onVisibility() {
    if (document.hidden && playing && !menuOpen) openMenu();
  }
  document.addEventListener('visibilitychange', onVisibility);

  if (debug) {
    window.__clawSim = { audio: { getVolume, setVolume, audioBus }, claw, W, ch, mut, cam, gfx, music, wallet, winty, ducky, vash, hampter, romni, castle, loans, battles, hs, clicky, kaiju, env, emotes, daily, sr, fishing, casino, pets, net, players, propSync, get mine() { return mine; }, equipSkin, equipPet, openPanel, openQuests, openControls, setRung, get rung() { return rung; }, applyMutators, world, camera, scene, renderer, openMenu, closeMenu, get state() { return st; } };
  }

  // compile every shader now (behind the loading screen) instead of hitching on first sight
  onStatus('Warming up shaders...');
  try {
    await renderer.compileAsync(scene, camera);
    gfx.render(0);
    refreshDetailTextures();
  } catch (e) {
    console.warn('shader warm-up skipped', e);
  }
  let idleN = 0;
  let shadowFlip = false;
  raf = requestAnimationFrame(frame);

  const start = (name, goOnline = read('simonline', true)) => {
    if (typeof name === 'string' && name.trim()) {
      myName = name.trim().slice(0, 20);
      write('simname', myName);
    }
    if (net && !st.netStarted) {
      st.netStarted = true;
      setOnline(goOnline);
    }
    hideOverlay(wrap);
    playing = true;
    music.start();
    controls.setEnabled(true);
    controls.requestLock();
    hud.hint(touch ? 'Left stick to move, drag to look. Go knock stuff off tables.' : 'Click to lock the mouse. Go knock stuff off tables.', 5000);
    if (!read('simcontrolsSeen', false)) {
      write('simcontrolsSeen', true);
      setTimeout(() => !menuOpen && openControls(), 1200);
    }
    if (!wallet.welcomed) {
      wallet.markWelcomed();
      setTimeout(() => hud.banner('MATT GAVE YOU 200 GLORP COINS', 'Spend them at the Glorp Casino downtown. Points earn more coins.', { pog: true }), 5500);
    }
  };

  return {
    start,
    touch,
    mp: !!net,
    get wantsOnline() {
      return read('simonline', true);
    },
    get name() {
      return myName;
    },
    dispose() {
      alive = false;
      net?.close();
      players?.dispose();
      mpUi?.dispose();
      cancelAnimationFrame(raf);
      ch.saveBest();
      controls.destroy();
      hud.destroy();
      window.removeEventListener('resize', resize);
      document.removeEventListener('pointerlockchange', onLockChange);
      window.removeEventListener('keydown', onUiKey, true);
      document.removeEventListener('visibilitychange', onVisibility);
      claw.dispose();
      winty?.dispose();
      pets.dispose();
      vash.dispose();
      hampter.dispose();
      clicky.dispose();
      ducky.dispose();
      emotes.dispose();
      sr.dispose();
      daily.dispose();
      kaiju.dispose();
      env.dispose();
      romni.dispose();
      castle.dispose();
      hs.dispose();
      battles.leaveFight();
      W.dispose();
      gfx.dispose();
      music.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) [].concat(o.material).forEach((m) => m.dispose());
      });
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      world.free();
      if (window.__clawSim) delete window.__clawSim;
    },
  };
}
