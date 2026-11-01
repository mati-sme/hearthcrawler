// Hearthcrawler 2.0: first-person 3D caravan survival. Glue: loop, actions, night waves, travel, build mode, events.
import * as THREE from 'three';
import * as D from './data.js';
import * as C from './core.js';
import { terrainH, zoneAt } from './terrain.js';
import { Sky } from './sky.js';
import { World } from './world.js';
import { Caravan } from './caravan.js';
import { Player, EYE } from './player.js';
import { inp, initInput } from './input.js';
import { ViewModel } from './viewmodel.js';
import { FX, glowTexture, glowSprite } from './fx.js';
import { Enemies } from './enemies.js';
import { UI } from './ui.js';
import { icon } from './icons.js';
import * as Audio from './audio.js';
import * as Save from './save.js';

const { SLOTS, GEAR, NODES, REACH, SWING, MODS, MOD_IDS, DECK, SLOT_POS, NIGHT_AT, CYCLE, ZONE_LEN, FOES } = D;
const qs = new URLSearchParams(location.search);
const DEBUG = qs.get('debug') === '1';
const $ = (id) => document.getElementById(id);

// ---------- boot state
const loaded = Save.load();
const state = loaded.state;
if (loaded.gift) { C.giftBundle(state); Save.markMigrated(); }

// ---------- renderer
const dpr = window.devicePixelRatio || 1;
const qmode = qs.get('q') || 'auto';
const quality = { pr: Math.min(dpr, 1.5), shadows: qmode !== 'low', mode: qmode };
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: dpr < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(quality.pr);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.autoClear = false; renderer.info.autoReset = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 2, 0.1, 125);
camera.rotation.order = 'YXZ';
const glowTex = glowTexture();
const sky = new Sky(scene, quality);
const world = new World(scene, quality);
const fx = new FX(scene, $('popups'));
const car = new Caravan(scene, glowTex);
const player = new Player();
const vm = new ViewModel(glowTex, 2);
const enemies = new Enemies(scene, fx, car);
const torch = new THREE.PointLight(0xffa050, 0, 30, 1.5); scene.add(torch);
const ghostFlame = glowSprite(glowTex, 0xffa050, 1); ghostFlame.visible = false;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  vm.cam.aspect = w / h; vm.cam.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

// ---------- game runtime
const R = {
  state, renderer, scene, camera, sky, world, car, player, enemies, fx, vm,
  sel: 0, t: 0, paused: false, swingCd: 0, hitT: -1, shake: 0, saveT: 0, autoQ: [], nightActive: false, nightNo: 0, killsThisNight: 0,
  travel: null, building: false, buildType: 'palisade', buildSlot: 0, manualSlot: 0, target: null, interact: null, muted: false, fade: 0, lastInfo: null,
};
const G = {
  state, player, get qualityMode() { return quality.mode; }, get muted() { return R.muted; },
  sfx: (n) => Audio.sfx[n] && Audio.sfx[n](),
  select, eat: () => { if (C.eat(state)) { G.sfx('pickup'); } },
  craft: (id) => { if (C.craft(state, id)) return true; G.sfx('error'); return false; },
  upgrade: (slot) => { if (C.upgradeModule(state, slot)) return true; G.sfx('error'); return false; },
  upgradeBeast: () => { if (C.upgradeBeast(state)) return true; G.sfx('error'); return false; },
  repair: (slot) => { if (C.repair(state, slot)) return true; G.sfx('error'); return false; },
  startBuild: (type) => { if (state.level < MODS[type].unlock) { G.sfx('error'); ui.notify(`${MODS[type].name.toUpperCase()} UNLOCKS AT LEVEL ${MODS[type].unlock}`, 'warn'); return false; } R.buildType = type; ui.closePanel(); enterBuild(); return true; },
  pickType: (t) => { if (state.level >= MODS[t].unlock) { R.buildType = t; Audio.sfx.click(); } else ui.notify(`UNLOCKS AT LEVEL ${MODS[t].unlock}`, 'warn'); },
  travel: () => startTravel(false),
  setQuality, toggleMute: () => { R.muted = !R.muted; Audio.setMuted(R.muted); },
  saveNow: () => save(),
  onPause: (p) => { R.uiPause = p; },
};
const ui = new UI(G);
const stat = initInput({
  canLock: () => !ui.isOpen() && !R.building && matchMedia('(pointer:fine)').matches,
  interact: () => doInteract(), build: () => toggleBuild(), menu: () => ui.togglePanel(), cancelBuild: () => exitBuild(),
  slot: (d) => cycleSlot(d), select, escape: () => { if (ui.modalOpen) return; if (ui.open) ui.closePanel(); else if (R.building) exitBuild(); },
});
document.addEventListener('pointerdown', () => Audio.unlock(), { once: false });
window.addEventListener('keydown', () => Audio.unlock());

function setQuality(m) {
  quality.mode = m;
  if (m === 'low') { quality.pr = 1; quality.shadows = false; } else if (m === 'high') { quality.pr = Math.min(dpr, 1.5); quality.shadows = true; }
  renderer.setPixelRatio(quality.pr); sky.setQuality(quality); resize();
}

// ---------- init world position
const startZ = state.cz;
car.setPos(startZ, terrainH(0, startZ));
car.sync(state);
const pl = loaded.pl;
if (pl && isFinite(pl.x) && isFinite(pl.z)) { player.teleport(pl.x, startZ + pl.z, car); player.yaw = +pl.yaw || 0; player.pitch = +pl.pitch || 0; R.sel = Math.max(0, Math.min(5, pl.sel | 0)); }
else { player.teleport(0, startZ + 16, car); player.yaw = 0; player.pitch = -0.08; }
world.stream(player.x, player.z, 100);
world.update(0, 0); world.updateGrass(player.x, player.z, car.cz, true);
function equip() { const slot = SLOTS[R.sel], tier = state.gear[slot]; vm.set(tier === 0 && (slot === 'axe' || slot === 'pick' || slot === 'melee' || slot === 'ranged' || slot === 'torch') ? 'fist' : slot, tier); }
equip();

// ---------- selection / building
function select(i) {
  if (R.building) exitBuild();
  R.sel = i; equip(); Audio.sfx.click();
  const slot = SLOTS[i];
  if (state.gear[slot] === 0 && (slot === 'ranged' || slot === 'torch')) ui.notify(`CRAFT A ${D.SLOT_NAMES[slot].toUpperCase()} FIRST — OPEN THE MENU`, 'warn');
}
function enterBuild() {
  if (!player.onDeck) { ui.notify('CLIMB ABOARD THE SHELLBACK TO BUILD', 'warn'); Audio.sfx.error(); return false; }
  R.building = true; R.sel = 5; vm.set('hammer', 1); R.manualSlot = 0;
  if (state.level < MODS[R.buildType].unlock) R.buildType = 'palisade';
  return true;
}
function exitBuild() { R.building = false; car.showRings(false, 0, state); car.setGhost(null); ui.buildBar(false); equip(); }
function toggleBuild() {
  if (ui.isOpen()) return;
  if (!R.building) { if (enterBuild()) ui.notify('LOOK AT A SLOT · PICK A MODULE · PRESS PLACE'); return; }
  placeModule();
}
function cycleSlot(d) { R.manualSlot = performance.now() + 2500; R.buildSlot = (R.buildSlot + d + SLOT_POS.length) % SLOT_POS.length; }
const _f = new THREE.Vector3(), _e = new THREE.Vector3(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
function lookDir(out) { return out.set(-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch)); }
function eyePos(out) { return out.set(player.x, player.y + EYE, player.z); }
function slotFromLook() {
  lookDir(_f); eyePos(_e);
  let best = 0, bs = -2;
  for (let i = 0; i < SLOT_POS.length; i++) {
    car.slotWorld(i, _v); _v.y += 0.5; _v.sub(_e); const d = _v.length(); if (d > 12) continue;
    const c = _v.dot(_f) / d; const s = c - d * 0.01; if (s > bs) { bs = s; best = i; }
  }
  return best;
}
function placeModule() {
  const i = R.buildSlot, m = state.mods[i], type = R.buildType;
  if (m && m.type === type) { if (C.upgradeModule(state, i)) { afterBuild(i); } else Audio.sfx.error(), ui.notify(C.canUpgrade(state, i).why ? C.canUpgrade(state, i).why.toUpperCase() : 'CANNOT UPGRADE', 'warn'); return; }
  const ok = C.canBuild(state, i, type);
  if (!ok.ok) { Audio.sfx.error(); ui.notify((ok.why || 'CANNOT BUILD').toUpperCase(), 'warn'); return; }
  C.buildModule(state, i, type); afterBuild(i);
}
function afterBuild(i) {
  car.sync(state); car.hit(i);
  car.slotWorld(i, _v); fx.burst(_v.x, _v.y + 0.3, _v.z, 0xc8924f, 14, 4); fx.sparkle(_v.x, _v.y + 0.8, _v.z, 0x6fe0d0, 10, 3);
  Audio.sfx.build();
}

// ---------- targeting
function findTarget() {
  lookDir(_f); eyePos(_e);
  let best = null, bt = 99;
  const test = (cx, cy, cz, rad, maxT, make) => {
    _v.set(cx, cy, cz).sub(_e); const t = _v.dot(_f); if (t < 0.2 || t > maxT) return;
    _w.copy(_f).multiplyScalar(t); const perp = _v.sub(_w).length();
    if (perp < rad && t < bt) { bt = t; best = make(); }
  };
  for (const e of enemies.list) if (e.alive) test(e.x, e.y + 0.9, e.z, 1.1 * (e.boss ? 1.7 : 1), 8, () => ({ kind: 'foe', ref: e, label: FOES[e.type].name, sub: Math.round(e.hp / e.max * 100) + '% HP', ic: 'foe' }));
  for (const n of world.nodesNear(player.x, player.z, 6)) {
    const d = NODES[n.kind];
    test(n.x, n.y + n.h * 0.5, n.z, n.r + 0.7 + n.h * 0.12, 5.5, () => {
      const need = d.tool && d.minTier > state.gear[d.tool];
      return { kind: 'node', ref: n, label: d.name, sub: need ? `NEEDS ${GEAR[d.tool][d.minTier].name}` : `${d.res === 'wood' ? 'CHOP' : d.tool === 'pick' ? 'MINE' : 'GATHER'} · ${D.RES[d.res].name}`, ic: n.kind === 'crystal' ? 'crystal' : n.kind };
    });
  }
  if (player.onDeck) {
    for (const k in state.mods) {
      const m = state.mods[k];
      car.slotWorld(+k, _w); test(_w.x, _w.y + 0.8, _w.z, 1.15, 5, () => ({ kind: 'mod', slot: +k, ref: m, label: `${MODS[m.type].name} LV ${m.lv}`, sub: m.hp <= 0 ? 'BROKEN · REPAIR' : modSub(m), ic: m.type }));
    }
    car.helmWorld(_w); test(_w.x, _w.y + 0.5, _w.z, 1.5, 5, () => ({ kind: 'helm', label: 'Beast helm', sub: C.canTravel(state) ? 'READY TO TRAVEL' : 'NEEDS SUPPLIES', ic: 'helm' }));
  }
  if (!best && !player.onDeck && Math.hypot(player.x, (player.z - car.cz) * 0.75) < 13) best = { kind: 'board', label: 'The Shellback', sub: 'CLIMB ABOARD', ic: 'beast' };
  return best;
}
function modSub(m) {
  if (m.type === 'furnace') return `ORE ${m.ore} · METAL ${m.out}`;
  if (m.type === 'garden') return m.crop > 0 ? `${m.crop} READY TO HARVEST` : 'GROWING…';
  if (m.type === 'bed') return 'SLEEP · SET RESPAWN';
  if (m.type === 'turret') return 'FIRES AT NIGHT';
  return `HP ${Math.round(m.hp)}`;
}
function interactFor(t) {
  if (!t) return null;
  if (t.kind === 'board') return { label: 'CLIMB' };
  if (t.kind === 'helm') return { label: 'TRAVEL' };
  if (t.kind === 'mod') {
    const m = t.ref;
    if (m.hp < C.modHpMax(m.type, m.lv, state)) return { label: m.hp <= 0 ? 'REPAIR' : m.type === 'bed' ? 'SLEEP' : m.type === 'furnace' ? 'FURNACE' : m.type === 'garden' && m.crop > 0 ? 'HARVEST' : 'REPAIR' };
    if (m.type === 'furnace') return { label: 'FURNACE' };
    if (m.type === 'bed') return { label: 'SLEEP' };
    if (m.type === 'garden' && m.crop > 0) return { label: 'HARVEST' };
  }
  return null;
}
function doInteract() {
  if (ui.isOpen()) return;
  const t = R.target;
  if (R.building) { exitBuild(); return; }
  if (!t) { return; }
  if (t.kind === 'board') { boardNow(); return; }
  if (t.kind === 'helm') { startTravel(false); return; }
  if (t.kind === 'mod') {
    const m = t.ref, slot = t.slot;
    if (m.type === 'bed') { state.hp = state.maxHp; state.spawn = 'bed'; ui.notify('RESTED · RESPAWN POINT SET'); Audio.sfx.goal(); fx.sparkle(player.x, player.y + 0.3, player.z, 0x9fd4ff, 6, 2); return; }
    if (m.type === 'furnace') {
      const got = C.furnaceCollect(state, slot);
      if (got) { popRes(player.x, player.y + 1.6, player.z, 'metal', got); Audio.sfx.pickup(); return; }
      const n = C.furnaceLoad(state, slot);
      if (n) { ui.notify(`LOADED ${n} ORE — SMELTING`); Audio.sfx.craft(); return; }
      ui.notify('BRING ORE AND WOOD TO THE FURNACE', 'warn'); return;
    }
    if (m.type === 'garden' && m.crop > 0) { const g = C.gardenHarvest(state, slot); popRes(player.x, player.y + 1.6, player.z, 'veg', g); Audio.sfx.pickup(); return; }
    if (C.repair(state, slot)) { Audio.sfx.craft(); car.hit(slot); ui.notify('REPAIRED'); } else { Audio.sfx.error(); ui.notify('NEEDS WOOD TO REPAIR', 'warn'); }
  }
}
function boardNow() {
  player.teleport(0, car.cz + DECK.z - 0.8, car); player.yaw = 0; player.pitch = -0.12;
  C.onBoard(state); Audio.sfx.goal(); fx.sparkle(player.x, player.y + 0.2, player.z, 0x6fe0d0, 6, 2.5);
}

// ---------- attacking / gathering
function popRes(x, y, z, res, n) { fx.popup(x, y, z, `+${n} ${D.RES[res].name}`, 'res'); }
function attackPower(slot, node) {
  const tier = state.gear[slot];
  if (slot === 'axe' || slot === 'pick') {
    const g = GEAR[slot][tier].power;
    if (node) { const d = NODES[node.kind]; if (d.tool && d.tool !== slot) return GEAR[d.tool][0].power * C.gatherMult(state) * 1.0; return g * C.gatherMult(state); }
    return g * 0.8 * C.dmgMult(state);
  }
  if (node) return Math.max(3, GEAR[slot][tier].power * 0.5) * C.gatherMult(state);
  return GEAR[slot][tier].power * C.dmgMult(state);
}
function startSwing() {
  const slot = SLOTS[R.sel];
  if (R.building) return;
  if (slot === 'ranged' && state.gear.ranged === 0) { }
  vm.swing(); R.swingCd = SWING[slot] || 0.5; R.hitT = (SWING[slot] || 0.5) * (slot === 'ranged' ? 0.1 : 0.42);
  Audio.sfx.swing();
}
function doHit() {
  const slot = SLOTS[R.sel];
  lookDir(_f); eyePos(_e);
  if (slot === 'ranged' && state.gear.ranged > 0) return fireBolt();
  const reach = REACH[slot] + 0.5;
  // foes first
  let foe = null, fb = 99;
  for (const e of enemies.list) {
    if (!e.alive) continue;
    _v.set(e.x - _e.x, e.y + 0.9 - _e.y, e.z - _e.z); const d = _v.length(); if (d > reach + 0.9 * (e.boss ? 1.6 : 1)) continue;
    if (_v.dot(_f) / d < 0.78 && d > 1.2) continue;
    if (d < fb) { fb = d; foe = e; }
  }
  if (foe) {
    const dmg = attackPower(slot, null) * (0.9 + Math.random() * 0.2);
    hitFoe(foe, dmg, enemies.damage(foe, dmg, player.x, player.z), false);
    return;
  }
  if (slot === 'hammer') { const t = R.target; if (t && t.kind === 'mod' && C.repair(state, t.slot)) { Audio.sfx.craft(); car.hit(t.slot); ui.notify('REPAIRED'); } return; }
  const n = R.target && R.target.kind === 'node' ? R.target.ref : null;
  if (n && n.alive) return hitNode(n, slot);
  // swing at the air
}
function hitNode(n, slot) {
  const d = NODES[n.kind];
  if (d.tool && state.gear[d.tool] < d.minTier) {
    fx.sparkle(n.x, n.y + 1, n.z, 0xffd27a, 5, 2); fx.popup(n.x, n.y + n.h * 0.6, n.z, `NEEDS ${GEAR[d.tool][d.minTier].name}`, 'hurt'); Audio.sfx.error(); world.shake(n); return;
  }
  const power = attackPower(slot, n);
  const y = C.hitYield(state, n, n.kind, power, n.hp - power <= 0);
  n.hp -= power; world.shake(n);
  const col = { tree: 0xd9a05b, rock: 0x9aa3ab, ore: 0xffb23a, crystal: 0x6fe0d0, bush: 0x4aa045, scrap: 0xc8d0d8 }[n.kind];
  const leaf = n.mesh === 'oak' ? 0x7acb52 : n.mesh === 'maple' ? 0xf08a3a : n.mesh === 'snowpine' || n.mesh === 'pine' ? 0x2f7a45 : col;
  fx.burst(n.x + (_e.x - n.x) * 0.3, n.y + 1.5, n.z + (_e.z - n.z) * 0.3, n.kind === 'tree' ? (Math.random() < 0.5 ? leaf : 0xe0b070) : col, 8, 4, 0.2);
  (n.kind === 'rock' || n.kind === 'ore' || n.kind === 'crystal') ? Audio.sfx.mine() : Audio.sfx.chop();
  let i = 0;
  for (const r in y) {
    const got = C.addRes(state, r, y[r]);
    if (got < y[r]) fx.popup(n.x, n.y + n.h * 0.8 + i * 0.4, n.z, `${D.RES[r].name} FULL`, 'hurt');
    if (got > 0) popRes(n.x, n.y + 2.0 + i * 0.45, n.z, r, got);
    i++;
  }
  if (n.hp <= 0) {
    world.kill(n, d.respawn * (0.8 + Math.random() * 0.4)); C.nodeDone(state, n.kind);
    fx.burst(n.x, n.y + 1, n.z, col, 12, 5, 0.2); Audio.sfx.pickup();
  }
}
function hitFoe(e, dmg, killed, remote) {
  const hx = e.x, hy = e.y + 1.5, hz = e.z;
  fx.popup(hx, hy, hz, String(Math.round(dmg)), 'dmg');
  if (!remote) { Audio.sfx.hit(); R.shake = Math.max(R.shake, 0.12); }
  fx.sparkle(e.x, e.y + 0.9, e.z, 0xffffff, 4, 2);
  if (killed) {
    Audio.sfx.poof();
    const boss = e.boss; C.onKill(state, e.type, boss); R.killsThisNight++;
    const loot = { shade: { scrap: [1, 2], fiber: [0, 2] }, raider: { scrap: [2, 4], wood: [1, 3], ore: [0, 1] }, boar: { meat: [1, 2], scrap: [1, 2] }, warlord: { scrap: [8, 12] } }[e.type];
    let i = 0;
    for (const r in loot) { const n = loot[r][0] + Math.floor(Math.random() * (loot[r][1] - loot[r][0] + 1)); if (n > 0) { const g = C.addRes(state, r, n); if (g) popRes(e.x, e.y + 1.4 + i * 0.4, e.z, r, g); i++; } }
    if (boss) C.bossChest(state, R.nightNo);
  }
}
const _m = new THREE.Vector3();
function fireBolt() {
  const tier = state.gear.ranged, dmg = GEAR.ranged[tier].power * C.dmgMult(state);
  let foe = null, fb = -1;
  for (const e of enemies.list) {
    if (!e.alive) continue;
    _v.set(e.x - _e.x, e.y + 0.9 - _e.y, e.z - _e.z); const d = _v.length(); if (d > 42) continue;
    const c = _v.dot(_f) / d; if (c > 0.975 && c - d * 0.0008 > fb) { fb = c; foe = e; }
  }
  _m.copy(_f).multiplyScalar(0.7).add(_e); _m.y -= 0.18; _m.addScaledVector(_v.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw)), 0.25);
  const to = foe ? new THREE.Vector3(foe.x, foe.y + 0.9, foe.z) : _e.clone().addScaledVector(_f, 30);
  fx.tracer(_m, to, tier >= 3 ? 0x6fe0d0 : 0xffd27a); Audio.sfx.bow(); vm.kick = 1;
  if (foe) hitFoe(foe, dmg, enemies.damage(foe, dmg, player.x, player.z), false);
}

// ---------- travel
function startTravel(force) {
  if (R.travel) return false;
  if (!force) {
    if (!player.onDeck) { ui.notify('CLIMB ABOARD FIRST', 'warn'); Audio.sfx.error(); return false; }
    if (enemies.aliveCount() > 0) { ui.notify('FOES NEARBY — WAIT FOR THEM TO FALL', 'warn'); Audio.sfx.error(); return false; }
    if (!C.canTravel(state)) { const c = C.travelCost(state); ui.notify(`SUPPLIES NEEDED: ${c.wood} WOOD · ${c.food} FOOD`, 'warn'); Audio.sfx.error(); return false; }
    C.payTravel(state);
  }
  R.travel = { to: -(state.zone + 1) * ZONE_LEN, t: 0 };
  ui.notify('THE SHELLBACK STRIDES ON', 'goal'); Audio.sfx.horn(); enemies.clear(false);
  return true;
}
function updateTravel(dt) {
  const T = R.travel;
  if (!T) { car.speed = 0; return 0; }
  T.t += dt;
  const remain = car.cz - T.to;
  let v = 7.5 * Math.min(1, T.t / 3.5, remain / 24 + 0.12);
  v = Math.max(v, 1.2);
  const step = Math.min(remain, v * dt);
  car.cz -= step;
  if (player.onDeck) player.z -= step; // carried by the beast
  if (car.cz - T.to <= 0.01) {
    R.travel = null; car.cz = T.to; C.arrive(state); enemies.clear(false);
    if (!player.onDeck && Math.hypot(player.x, player.z - car.cz) > 40) boardNow();
    Audio.sfx.horn();
  }
  return v;
}

// ---------- day / night
function stepClock(dt) {
  const s = state, was = s.tod;
  s.tod += dt / CYCLE;
  if (s.tod >= NIGHT_AT && was < NIGHT_AT) startNight();
  if (s.tod >= 1) {
    s.tod -= 1; s.day++;
    if (R.nightActive) endNight();
  }
  if (!R.nightActive && s.tod >= NIGHT_AT && s.tod < 0.9 && !R.travel) startNight(true);
}
function startNight(quiet) {
  R.nightActive = true; R.nightNo = state.stats.nights + 1; R.killsThisNight = 0;
  enemies.startNight(R.nightNo, state.zone);
  if (!quiet) { ui.notify(`NIGHT ${R.nightNo} FALLS — HOLD THE DECK`, 'warn'); Audio.sfx.night(); }
}
function endNight() {
  R.nightActive = false; enemies.clear(true);
  C.nightSurvived(state, R.nightNo); Audio.sfx.dawn();
}

// ---------- events -> UI / audio
function drainEvents() {
  const evs = state.ev.splice(0);
  if (!evs.length) return;
  const goals = [];
  for (const e of evs) {
    switch (e.t) {
      case 'goal': goals.push(e); break;
      case 'levelup': Audio.sfx.level(); ui.notify(`<b>LEVEL UP!</b> LV ${e.level}<small>${Object.keys(e.res).map((k) => `+${e.res[k]} ${D.RES[k].name}`).join(' ')}</small>`, 'goal');
        fx.popup(player.x - Math.sin(player.yaw) * 2, player.y + 2.2, player.z - Math.cos(player.yaw) * 2, 'LEVEL UP!', 'big');
        fx.sparkle(player.x, player.y + 0.3, player.z, 0xffd24a, 14, 4); fx.sparkle(player.x, player.y + 0.3, player.z, 0x6fe0d0, 10, 3); break;
      case 'craft': Audio.sfx.craft(); ui.notify(`CRAFTED ${e.name.toUpperCase()}`); equip(); break;
      case 'upgrade': Audio.sfx.build(); ui.notify(`${MODS[e.type].name.toUpperCase()} UPGRADED · LV ${e.lv}`); break;
      case 'build': ui.notify(`${MODS[e.type].name.toUpperCase()} BUILT`); break;
      case 'beast': Audio.sfx.craft(); ui.notify(`SHELLBACK CARE · LV ${e.lv}`); break;
      case 'smelt': ui.notify(`SMELTED ${e.n} METAL`); break;
      case 'arrive': ui.chest(`ARRIVED: ${e.name}`, e.res, 'The beast rests. A cache from the trail waits on the deck.'); Audio.sfx.level(); break;
      case 'chest': ui.chest(e.name, e.res, 'The Warlord drops a great cache. Boss defeated!'); Audio.sfx.level(); break;
      case 'dawn': ui.notify(`<b>DAWN — NIGHT ${e.nights} SURVIVED</b><small>${Object.keys(e.res).map((k) => `+${e.res[k]} ${D.RES[k].name}`).join(' ')}</small>`, 'goal'); break;
      case 'crop': break;
      default: break;
    }
  }
  if (goals.length) {
    Audio.sfx.goal();
    const txt = goals.map((g) => g.text).join(' + ');
    const rw = {}; let xp = 0;
    for (const g of goals) { xp += g.reward.xp; for (const k in g.reward.res) rw[k] = (rw[k] || 0) + g.reward.res[k]; }
    ui.notify(`<b>GOAL COMPLETE</b> ${txt.toUpperCase()}<small>+${xp} XP ${Object.keys(rw).map((k) => `+${rw[k]} ${D.RES[k].name}`).join(' ')}</small>`, 'goal');
  }
  if (ui.open) ui.renderPanel();
}

// ---------- damage to player / modules / death
function damagePlayer(dmg) {
  if (player.invuln > 0 || R.fade > 0) return;
  state.hp -= dmg; player.hurt = 1; player.invuln = 0.8; player.regenWait = 6; R.shake = Math.max(R.shake, 0.35);
  Audio.sfx.hurt(); fx.popup(player.x - Math.sin(player.yaw) * 1.2, player.y + 1.4, player.z - Math.cos(player.yaw) * 1.2, '-' + Math.round(dmg), 'hurt');
  if (state.hp <= 0) die();
}
function damageModule(slot, dmg, e) {
  const m = state.mods[slot]; if (!m || m.hp <= 0) return;
  m.hp = Math.max(0, m.hp - dmg); car.hit(slot); Audio.sfx.hit();
  car.slotWorld(slot, _v); fx.sparkle(_v.x, _v.y + 1, _v.z, 0xffd27a, 3, 2);
  if (m.hp <= 0) { ui.notify(`${MODS[m.type].name.toUpperCase()} BROKEN — REPAIR IT`, 'warn'); fx.burst(_v.x, _v.y + 0.8, _v.z, 0x9a7048, 14, 5); }
}
function die() {
  state.stats.deaths++; R.fade = 1; $('fade').classList.add('on');
  const keys = D.RES_IDS.filter((k) => state.inv[k] > 4);
  if (keys.length) { const k = keys[Math.floor(Math.random() * keys.length)]; const lost = Math.max(1, Math.floor(state.inv[k] * 0.1)); state.inv[k] -= lost; R.lost = `${lost} ${D.RES[k].name}`; }
  setTimeout(() => {
    let spawned = false;
    if (state.spawn === 'bed') for (const k in state.mods) if (state.mods[k].type === 'bed') { car.slotWorld(+k, _v); player.teleport(_v.x, _v.z + 1.5, car); spawned = true; break; }
    if (!spawned) player.teleport(0, car.cz + DECK.z - 1.2, car);
    state.hp = state.maxHp * 0.6; player.yaw = 0; player.pitch = -0.1;
    R.fade = 0; $('fade').classList.remove('on');
    ui.notify(`YOU FAINTED — THE SHELLBACK CARRIED YOU HOME${R.lost ? `<small>LOST ${R.lost}</small>` : ''}`, 'warn');
  }, 900);
}

// ---------- save
function save() { Save.save(state, { x: player.x, y: player.y, z: player.z - car.cz, yaw: player.yaw, pitch: player.pitch, sel: R.sel }); }
window.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('pagehide', save);

// ---------- main update
const sh = { x: 0, y: 0 };
function paused() { return R.frozen || R.uiPause || document.hidden || window.innerHeight > window.innerWidth; }
function update(dt) {
  R.t += dt;
  stepClock(dt);
  // needs
  state.hunger = Math.max(0, state.hunger - 0.12 * dt);
  if (state.hunger < 35 && C.foodCount(state) > 0) C.eat(state);
  if (state.hunger <= 0) state.hp = Math.max(state.maxHp * 0.15, state.hp - 0.4 * dt);
  else if (player.regenWait <= 0 && state.hp < state.maxHp && R.fade === 0) {
    let lant = 0; if (player.onDeck) for (const k in state.mods) if (state.mods[k].type === 'lantern' && state.mods[k].hp > 0) lant += state.mods[k].lv;
    state.hp = Math.min(state.maxHp, state.hp + (0.9 + lant * 0.5) * dt);
  }
  C.tickMods(state, dt);
  // caravan + player
  const v = updateTravel(dt);
  const gy = Math.max(terrainH(-3.5, car.cz - 4), terrainH(3.5, car.cz - 4), terrainH(-3.5, car.cz + 4), terrainH(3.5, car.cz + 4), terrainH(0, car.cz));
  car.setPos(car.cz, car.y + (gy - car.y) * Math.min(1, dt * 3));
  if (R.fade === 0) player.update(dt, inp, { car, world, state, onJump: () => Audio.sfx.jump() });
  state.cz = car.cz;
  car.update(dt, R.t, v);
  for (const [fx0, fz0] of car.steps) { const wx = fx0 * 1.05, wz = car.cz + fz0; fx.dust(wx, terrainH(wx, wz), wz); }
  // actions
  R.target = ui.isOpen() ? null : findTarget();
  R.interact = interactFor(R.target);
  R.swingCd = Math.max(0, R.swingCd - dt);
  if (R.hitT >= 0) { R.hitT -= dt; if (R.hitT < 0) doHit(); }
  if (inp.attack && R.swingCd <= 0 && !ui.isOpen() && !R.building && R.fade === 0) startSwing();
  // build mode
  if (R.building) {
    if (!player.onDeck) exitBuild();
    else {
      if (performance.now() > R.manualSlot) R.buildSlot = slotFromLook();
      const i = R.buildSlot, m = state.mods[i], type = R.buildType;
      const up = m && m.type === type;
      const ok = up ? C.canUpgrade(state, i).ok : C.canBuild(state, i, type).ok;
      car.showRings(true, i, state);
      car.setGhost(type, up ? Math.min(m.lv + 1, C.modMaxLv(type)) : 1, i, ok);
      const cost = up ? (C.canUpgrade(state, i).cost || {}) : MODS[type].lv[0];
      const why = !m ? C.canBuild(state, i, type) : up ? C.canUpgrade(state, i) : { why: `Slot holds ${MODS[m.type].name}` };
      ui.buildBar(true, { type, info: `<b>${MODS[type].name.toUpperCase()}</b> · SLOT ${i + 1}<br>${up ? (why.ok || why.cost ? `UPGRADE → LV ${m.lv + 1}` : 'MAX LEVEL') : m ? why.why.toUpperCase() : 'NEW MODULE'}<br>${Object.keys(cost).length ? ui.chips(cost, state) : ''}${!ok && why.why && !m ? `<br><span class="chip lack">${why.why.toUpperCase()}</span>` : ''}` });
    }
  }
  // world
  enemies.update(dt, {
    state, car, px: player.x, py: player.y, pz: player.z, playerOnDeck: player.onDeck, groundY: (x, z, y) => player.groundY(x, z, y, car),
    damagePlayer, damageModule, hitFoe, sfx: (n) => Audio.sfx[n](), turretFired: () => { R.shots = (R.shots || 0) + 1; }, hold: R.hold,
  });
  if (R.nightActive && enemies.boss) R.bossBar = enemies.boss; else R.bossBar = null;
  world.stream(player.x, player.z, 1);
  world.update(dt, R.t);
  world.updateGrass(player.x, player.z, car.cz, false);
  fx.update(dt);
  car.sync(state);
  const info = sky.info;
  car.visuals(state, dt, R.t, info.nightW || 0, fx);
  C.checkGoals(state);
  drainEvents();
  R.saveT += dt; if (R.saveT > 10) { R.saveT = 0; save(); }
  // screen shake
  R.shake = Math.max(0, R.shake - dt * 1.6);
  sh.x = (Math.random() - 0.5) * R.shake * 0.06; sh.y = (Math.random() - 0.5) * R.shake * 0.06;
}

// ---------- render
const camBase = new THREE.Vector3();
function render(dt = 0.016) {
  camBase.set(player.x, player.y + EYE + Math.sin(player.bob * 2) * 0.045 * player.moveAmt, player.z);
  camera.position.copy(camBase);
  camera.rotation.set(player.pitch + sh.y, player.yaw + sh.x, (R.travel ? Math.sin(R.t * 0.9) * 0.008 : 0) - (inp.moveX || 0) * 0.012 * player.moveAmt, 'YXZ');
  if (R.camOverride) { camera.position.copy(R.camOverride.pos); camera.lookAt(R.camOverride.at); }
  camera.fov = 72 + (player.sprinting ? 4 : 0); camera.updateProjectionMatrix();
  const info = sky.update(state.tod, car.cz, R.t, camera, camBase, renderer.domElement.height);
  // torch / night light
  const slot = SLOTS[R.sel], tierT = state.gear.torch, holding = slot === 'torch' && tierT > 0 && !R.building;
  const fl = 1 + Math.sin(R.t * 17) * 0.06 + Math.sin(R.t * 31 + 1) * 0.05;
  const nightness = info.nightW || 0;
  if (holding) {
    torch.color.set(0xff9a45); torch.intensity = (2.2 + nightness * 1.2) * fl * 4.5; torch.distance = 34; torch.decay = 1.4;
    camera.updateMatrixWorld(); torch.position.copy(camera.localToWorld(_w.set(0.38, -0.12, -0.9)));
  } else { torch.color.set(0x9fc0ff); torch.intensity = nightness * 1.4; torch.distance = 12; torch.decay = 1.6; torch.position.copy(camBase); }
  vm.update(dt, R.t, player.moveAmt, player.bob, Math.max(0.25, 1 - nightness * 0.75));
  vm.hemi.color.copy(sky.hemi.color); vm.dir.color.copy(sky.sun.color);
  renderer.info.reset();
  renderer.clear();
  renderer.render(scene, camera);
  if (!R.camOverride) { renderer.clearDepth(); renderer.render(vm.scene, vm.cam); }
  fx.updatePopups(dt, camera, window.innerWidth, window.innerHeight);
}
function hudFrame(dt) {
  const slot = SLOTS[R.sel];
  const tgt = R.target;
  const atk = R.building ? 'HAMMER' : tgt && tgt.kind === 'foe' ? 'ATTACK' : slot === 'axe' ? 'CHOP' : slot === 'pick' ? 'MINE' : slot === 'melee' ? 'STRIKE' : slot === 'ranged' ? 'SHOOT' : slot === 'hammer' ? 'REPAIR' : 'SWING';
  ui.hud(dt, {
    sel: R.sel, building: R.building, target: tgt, interact: R.interact, atkLabel: atk, boss: R.bossBar, hurt: player.hurt, yaw: player.yaw,
    cvBearing: Math.atan2(0 - player.x, -(car.cz - player.z)), cvDist: Math.hypot(player.x, player.z - car.cz),
  });
}

// ---------- loop with adaptive quality
let last = performance.now(), frames = 0, acc = 0, fps = 0, fpsT = 0, slow = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const raw = Math.min(0.1, (now - last) / 1000); last = now;
  if (!paused()) update(Math.min(raw, 0.05));
  const rdt = R.frozen ? 0 : raw;
  hudFrame(rdt); render(rdt);
  acc += raw; frames++; fpsT += raw;
  if (fpsT > 1) { fps = frames / fpsT; frames = 0; fpsT = 0; if (DEBUG) $('dbg').textContent = `${fps.toFixed(0)} fps · ${renderer.info.render.calls} calls · ${renderer.info.render.triangles} tris`; if (quality.mode === 'auto' && fps < 28 && !paused()) { if (++slow >= 3 && quality.pr > 1) { quality.pr = 1; quality.shadows = false; renderer.setPixelRatio(1); sky.setQuality(quality); resize(); } } else slow = 0; }
}
if (DEBUG) $('dbg').classList.remove('hidden');

// ---------- welcome / hints
if (loaded.gift) setTimeout(() => ui.welcome({ wood: 30, stone: 20, fiber: 16, scrap: 10 }, () => { equip(); save(); }), 300);
else if (loaded.fresh) setTimeout(() => ui.notify('LEFT THUMB MOVES · RIGHT THUMB LOOKS · HOLD THE BIG BUTTON TO GATHER'), 800);
$('loading').style.display = 'none';
requestAnimationFrame(loop);

// ---------- service worker (reload once when a new one takes over)
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then((reg) => { R.sw = reg; }).catch(() => { });
  let had = !!navigator.serviceWorker.controller, reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!had) { had = true; return; } if (reloaded || sessionStorage.getItem('hc-sw-reload')) return; reloaded = true; sessionStorage.setItem('hc-sw-reload', '1'); location.reload(); });
}

// ---------- test hooks
window.__HC = {
  version: D.VERSION, state, runtime: R, C, D, ui, THREE,
  step(dt = 0.05, n = 1) { for (let i = 0; i < n; i++) { update(dt); } hudFrame(dt); render(dt); },
  render() { hudFrame(0.016); render(0.016); },
  giveAll(n = 60) { for (const r of D.RES_IDS) state.inv[r] = Math.min(C.cap(state), Math.max(state.inv[r], n)); },
  setTime(f) { state.tod = f % 1; if (state.tod < NIGHT_AT && R.nightActive) { R.nightActive = false; enemies.clear(false); } },
  spawnNight() { if (!R.nightActive) { R.nightActive = true; R.nightNo = state.stats.nights + 1; } enemies.startNight(R.nightNo, state.zone); enemies.qt = 0; },
  travel() { return startTravel(false); }, forceTravel() { return startTravel(true); },
  teleport(x, z) { player.teleport(x, z, car); }, tpDeck() { boardNow(); },
  look(yaw, pitch) { player.yaw = yaw; if (pitch !== undefined) player.pitch = pitch; },
  select, startBuild(t) { R.buildType = t; return enterBuild(); }, placeAt(slot, t) { R.buildSlot = slot; R.buildType = t; R.manualSlot = performance.now() + 1e6; if (!R.building) enterBuild(); placeModule(); },
  exitBuild, attack() { startSwing(); }, doHit, findTarget, interact: doInteract, save, equip,
  nearestNode(kind, mesh) { let b = null, bd = 1e9; for (const n of world.nodesNear(player.x, player.z, 60)) if (n.kind === kind && (!mesh || n.mesh === mesh)) { const d = Math.hypot(n.x - player.x, n.z - player.z); if (d < bd) { bd = d; b = n; } } return b; },
  faceNode(n, dist = 2.4, aimY) { const dx = n.x - player.x, dz = n.z - player.z, d = Math.hypot(dx, dz); player.teleport(n.x - dx / d * dist, n.z - dz / d * dist, car); player.yaw = Math.atan2(-dx, -dz); player.pitch = Math.atan2((aimY === undefined ? n.h * 0.45 : aimY) - EYE, dist); },
  setZone(k) { state.zone = k; car.setPos(-k * ZONE_LEN, terrainH(0, -k * ZONE_LEN)); state.cz = car.cz; world.stream(0, car.cz, 100); player.teleport(0, car.cz + 16, car); world.updateGrass(player.x, player.z, car.cz, true); },
  fps: () => fps, freeze(f) { R.frozen = f; }, hold(h) { R.hold = h; }, clearNotes() { ui.clearNotes(); fx.pops.forEach((p) => { p.on = false; p.el.style.display = 'none'; }); }, cam(pos, at) { R.camOverride = pos ? { pos: new THREE.Vector3(...pos), at: new THREE.Vector3(...at) } : null; },
};
