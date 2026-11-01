// Pure game rules: state, inventory, crafting, modules, xp, goals, travel. No DOM / three.
import {
  RES_IDS, FOOD, FOOD_IDS, GEAR, SLOTS, RECIPES, MODS, MOD_IDS, TURRET, GOALS, endlessGoal, xpNeed, biomeOf,
  tierOf, SLOT_POS, FOES, waveHp, NODES,
} from './data.js';

export function newState() {
  const inv = {};
  for (const r of RES_IDS) inv[r] = 0;
  return {
    v: 2,
    inv,
    gear: { axe: 0, pick: 0, melee: 0, ranged: 0, torch: 0, hammer: 1 },
    mods: {},
    stats: { gathered: {}, built: {}, kills: 0, bossKills: 0, travels: 0, nights: 0, boarded: false, deaths: 0, smelted: 0 },
    goal: 0, goalBase: 0,
    xp: 0, level: 1, maxHp: 100, hp: 100, hunger: 100, stamina: 100,
    zone: 0, tod: 0.16, day: 1, nightDone: false,
    beast: 0, cz: 0, spawn: 'deck',
    flags: { gift: false },
    ev: [],
  };
}

export const emit = (s, t, d) => s.ev.push(Object.assign({ t }, d));

// ---- inventory
export function cap(s) {
  let c = 60;
  for (const k in s.mods) if (s.mods[k].type === 'storage') c += 60 * s.mods[k].lv;
  return c;
}
export function addRes(s, id, n, opt = {}) {
  if (!n) return 0;
  const room = opt.force ? n : Math.max(0, Math.min(n, cap(s) - s.inv[id]));
  s.inv[id] += room;
  // gather goals count what you harvested even when the bag is full (never a stall)
  if (opt.track !== false) {
    s.stats.gathered[id] = (s.stats.gathered[id] || 0) + n;
    if (id === 'metal' && opt.smelt) s.stats.smelted += room;
  }
  return room;
}
export const has = (s, cost) => { for (const k in cost) if ((s.inv[k] || 0) < cost[k]) return false; return true; };
export function missing(s, cost) {
  const m = {};
  for (const k in cost) if ((s.inv[k] || 0) < cost[k]) m[k] = cost[k] - s.inv[k];
  return m;
}
export const pay = (s, cost) => { for (const k in cost) s.inv[k] -= cost[k]; };
export const foodCount = (s) => FOOD_IDS.reduce((a, f) => a + s.inv[f], 0);
export function eat(s) {
  if (s.hunger > 92) return false;
  for (const f of FOOD_IDS) {
    if (s.inv[f] > 0) {
      s.inv[f]--; s.hunger = Math.min(100, s.hunger + FOOD[f]);
      s.hp = Math.min(s.maxHp, s.hp + 6);
      emit(s, 'eat', { id: f });
      return true;
    }
  }
  return false;
}

// ---- stats
export const dmgMult = (s) => 1 + 0.04 * (s.level - 1);
export const gatherMult = (s) => 1 + 0.03 * (s.level - 1);
export const gearOf = (s, slot) => GEAR[slot][s.gear[slot]];

// ---- crafting
export function recipeState(s, r) {
  const owned = s.gear[r.slot] >= r.tier;
  const ready = s.gear[r.slot] === r.tier - 1;
  const afford = has(s, r.cost);
  return { owned, ready, afford, locked: !owned && !ready };
}
export function craft(s, id) {
  const r = RECIPES.find((x) => x.id === id);
  if (!r) return false;
  const st = recipeState(s, r);
  if (!st.ready || !st.afford) return false;
  pay(s, r.cost);
  s.gear[r.slot] = r.tier;
  gainXp(s, 12 + r.tier * 14);
  emit(s, 'craft', { id: r.id, name: r.name, slot: r.slot });
  return true;
}

// ---- modules
export function modAt(s, slot) { return s.mods[slot]; }
export function modCount(s, type) { let n = 0; for (const k in s.mods) if (s.mods[k].type === type) n++; return n; }
export function modMaxLv(type) { return MODS[type].lv.length; }
export function modHpMax(type, lv, s) { return Math.round(MODS[type].hp[lv - 1] * (1 + 0.05 * (s ? s.beast : 0))); }
// Shellback Care: a repeatable cheap upgrade track (+5% module hp per level)
export const BEAST_MAX = 30;
export function beastCost(s) {
  const L = s.beast + 1;
  const c = { wood: 10 + 4 * L, stone: 4 + 2 * L, scrap: 2 + Math.round(1.5 * L) };
  if (L >= 4) c.metal = Math.floor(L / 3);
  if (L >= 12) c.glow = Math.floor(L / 4) - 1;
  return c;
}
export function upgradeBeast(s) {
  if (s.beast >= BEAST_MAX) return false;
  const c = beastCost(s);
  if (!has(s, c)) return false;
  pay(s, c);
  s.beast++;
  for (const k in s.mods) s.mods[k].hp = Math.round(s.mods[k].hp + MODS[s.mods[k].type].hp[s.mods[k].lv - 1] * 0.05);
  gainXp(s, 20 + 3 * s.beast);
  emit(s, 'beast', { lv: s.beast });
  return true;
}
export function canBuild(s, slot, type) {
  if (s.mods[slot]) return { ok: false, why: 'Slot taken' };
  const m = MODS[type];
  if (s.level < m.unlock) return { ok: false, why: `Unlocks at level ${m.unlock}` };
  if (!has(s, m.lv[0])) return { ok: false, why: 'Need more resources', miss: missing(s, m.lv[0]) };
  return { ok: true };
}
export function buildModule(s, slot, type) {
  const c = canBuild(s, slot, type);
  if (!c.ok) return false;
  pay(s, MODS[type].lv[0]);
  s.mods[slot] = { type, lv: 1, hp: modHpMax(type, 1, s), ore: 0, wood: 0, out: 0, prog: 0, crop: 0, grow: 0, cd: 0 };
  s.stats.built[type] = (s.stats.built[type] || 0) + 1;
  gainXp(s, 22);
  emit(s, 'build', { slot, type });
  return true;
}
export function canUpgrade(s, slot) {
  const m = s.mods[slot];
  if (!m) return { ok: false, why: 'Empty slot' };
  if (m.lv >= modMaxLv(m.type)) return { ok: false, why: 'Max level' };
  const cost = MODS[m.type].lv[m.lv];
  if (!has(s, cost)) return { ok: false, why: 'Need more resources', miss: missing(s, cost), cost };
  return { ok: true, cost };
}
export function upgradeModule(s, slot) {
  const c = canUpgrade(s, slot);
  if (!c.ok) return false;
  pay(s, c.cost);
  const m = s.mods[slot];
  m.lv++; m.hp = modHpMax(m.type, m.lv, s);
  gainXp(s, 18 + m.lv * 10);
  emit(s, 'upgrade', { slot, type: m.type, lv: m.lv });
  return true;
}
export const repairCost = (m) => ({ wood: 2 + m.lv * 2 });
export function repair(s, slot) {
  const m = s.mods[slot];
  if (!m || m.hp >= modHpMax(m.type, m.lv, s)) return false;
  const c = repairCost(m);
  if (!has(s, c)) return false;
  pay(s, c);
  m.hp = modHpMax(m.type, m.lv, s);
  emit(s, 'repair', { slot });
  return true;
}
export function modWorks(m) { return m && m.hp > 0; }

// furnace: load ore (+wood fuel), smelts 1 metal per (7 - 1.5*lv) s
export function furnaceLoad(s, slot) {
  const m = s.mods[slot];
  if (!m || m.type !== 'furnace') return 0;
  const n = Math.min(s.inv.ore, s.inv.wood * 2);
  if (n <= 0) return 0;
  s.inv.ore -= n; s.inv.wood -= Math.ceil(n / 2); m.ore += n; // 1 ore -> 1 metal, 1 wood fuels 2
  return n;
}
export function furnaceCollect(s, slot) {
  const m = s.mods[slot];
  if (!m || m.type !== 'furnace' || m.out <= 0) return 0;
  const n = m.out;
  const got = addRes(s, 'metal', n, { smelt: true });
  m.out -= got;
  if (got) { gainXp(s, got * 6); emit(s, 'smelt', { n: got }); }
  return got;
}
export function gardenHarvest(s, slot) {
  const m = s.mods[slot];
  if (!m || m.type !== 'garden' || m.crop <= 0) return 0;
  const got = addRes(s, 'veg', m.crop);
  m.crop -= got;
  if (got) gainXp(s, got * 3);
  return got;
}
// advance module timers (furnace, garden, regen of broken-module = none)
export function tickMods(s, dt) {
  for (const k in s.mods) {
    const m = s.mods[k];
    if (m.hp <= 0) continue;
    if (m.type === 'furnace' && m.ore > 0) {
      m.prog += dt;
      const per = 7 - m.lv * 1.5;
      while (m.prog >= per && m.ore > 0) { m.prog -= per; m.ore--; m.out++; }
    } else if (m.type === 'garden' && m.crop < 3 * m.lv) {
      m.grow += dt / (80 - m.lv * 15);
      if (m.grow >= 1) { m.grow = 0; m.crop++; emit(s, 'crop', { slot: k }); }
    }
  }
}
export function turretStats(m) { return { dmg: TURRET.dmg[m.lv - 1], every: TURRET.every[m.lv - 1], range: TURRET.range }; }
export function defense(s) {
  let dps = 0;
  for (const k in s.mods) { const m = s.mods[k]; if (m.type === 'turret' && m.hp > 0) dps += turretStats(m).dmg / turretStats(m).every; }
  const melee = gearOf(s, 'melee').power * dmgMult(s) / 0.5 * 0.6;
  const bow = gearOf(s, 'ranged').power * dmgMult(s) / 1.1 * 0.5;
  return dps * 40 + (melee + bow) * 22;
}
export const threat = (night, zone) => waveHp(night, zone);

// ---- xp
export function gainXp(s, n) {
  s.xp += n;
  while (s.xp >= xpNeed(s.level)) {
    s.xp -= xpNeed(s.level);
    s.level++;
    s.maxHp = Math.min(220, 100 + 8 * (s.level - 1));
    s.hp = s.maxHp;
    const r = { wood: 8 + s.level, stone: 4 + Math.floor(s.level / 2) };
    if (s.level % 3 === 0) r.scrap = 6;
    if (s.level % 5 === 0) r.metal = 2;
    for (const k in r) addRes(s, k, r[k], { force: true, track: false });
    emit(s, 'levelup', { level: s.level, res: r });
  }
}

// ---- events from play
// A node was fully harvested (xp for gathering). Per-hit resource gain goes through addRes.
export function nodeDone(s, kind) {
  gainXp(s, Math.round((kind === 'ore' || kind === 'crystal' ? 6 : 3) * (1 + 0.35 * s.zone)));
}
// Resources for one hit of power `power` on a node (accumulator keeps fractions). Returns {res:n}
export function hitYield(s, node, kind, power, last) {
  const d = NODES[kind];
  const rich = 1 + 0.18 * node.zone;
  const total = d.yield * rich * gatherMult(s);
  node.acc += total * Math.min(power, node.hp) / d.hp;
  const out = {};
  const whole = last ? Math.round(node.acc) : Math.floor(node.acc);
  if (whole > 0) { out[d.res] = whole; node.acc -= whole; }
  if (d.extra && last) for (const k in d.extra) out[k] = Math.max(1, Math.round(d.extra[k] * rich));
  return out;
}
export function onKill(s, type, boss) {
  s.stats.kills++;
  if (boss) s.stats.bossKills++;
  gainXp(s, FOES[type].xp);
}
export function onBoard(s) { s.stats.boarded = true; }
export function nightSurvived(s, night) {
  s.stats.nights++;
  const bonus = { wood: 10 + 3 * s.stats.nights, scrap: 4 + s.stats.nights };
  for (const k in bonus) addRes(s, k, bonus[k], { force: true, track: false });
  gainXp(s, 40 + 8 * s.stats.nights);
  emit(s, 'dawn', { nights: s.stats.nights, res: bonus });
}

// ---- travel
export function travelCost(s) {
  return { wood: 25 + 8 * s.zone, food: 6 + 2 * s.zone };
}
export function canTravel(s) {
  const c = travelCost(s);
  return s.inv.wood >= c.wood && foodCount(s) >= c.food;
}
export function payTravel(s) {
  const c = travelCost(s);
  s.inv.wood -= c.wood;
  let need = c.food;
  for (const f of FOOD_IDS) { const t = Math.min(need, s.inv[f]); s.inv[f] -= t; need -= t; }
}
export function arrive(s) {
  s.zone++;
  s.stats.travels++;
  const k = s.zone;
  const res = { wood: 24 + 6 * k, stone: 16 + 5 * k, scrap: 10 + 4 * k, fiber: 8 + 2 * k };
  if (k >= 2) res.metal = 2 + k;
  if (k >= 2) res.glow = Math.floor(k / 2) + 1;
  for (const r in res) addRes(s, r, res[r], { force: true, track: false });
  gainXp(s, 80 + 25 * k);
  emit(s, 'arrive', { zone: k, name: biomeOf(k).name, res });
}
export function bossChest(s, night) {
  const k = night / 3;
  const res = { metal: 4 + 2 * k, scrap: 14 + 5 * k, stone: 12 + 4 * k, glow: 2 + k, wood: 20 + 5 * k };
  for (const r in res) addRes(s, r, res[r], { force: true, track: false });
  gainXp(s, 120 + 30 * k);
  emit(s, 'chest', { name: 'Warlord Chest', res });
}

// ---- goals
export function goalDef(s) { return s.goal < GOALS.length ? GOALS[s.goal] : endlessGoal(s.goal - GOALS.length); }
function counter(s, g) {
  switch (g.kind) {
    case 'gather': return s.stats.gathered[g.arg] || 0;
    case 'killsd': return s.stats.kills;
    case 'smelt': return s.stats.smelted;
    case 'travelsd': return s.stats.travels;
    default: return 0;
  }
}
export function goalProgress(s) {
  const g = goalDef(s);
  let cur = 0;
  switch (g.kind) {
    case 'gather': case 'smelt': case 'travelsd': case 'killsd': cur = counter(s, g) - s.goalBase; break;
    case 'kills': cur = s.stats.kills; break;
    case 'craft': { const r = RECIPES.find((x) => x.id === g.arg); cur = s.gear[r.slot] >= r.tier ? 1 : 0; break; }
    case 'build': cur = (s.stats.built[g.arg] || 0) > 0 ? 1 : 0; break;
    case 'upgrade': { let b = 0; for (const k in s.mods) if (s.mods[k].type === g.arg) b = Math.max(b, s.mods[k].lv); cur = b; break; }
    case 'nights': cur = s.stats.nights; break;
    case 'travels': cur = s.stats.travels; break;
    case 'level': cur = s.level; break;
    case 'beast': cur = s.beast; break;
    case 'deck': cur = s.stats.boarded ? 1 : 0; break;
    case 'boss': cur = s.stats.bossKills; break;
  }
  cur = Math.min(cur, g.n);
  return { cur, n: g.n, done: cur >= g.n, g };
}
export function checkGoals(s) {
  let done = 0;
  for (let guard = 0; guard < 6; guard++) {
    const p = goalProgress(s);
    if (!p.done) break;
    const g = p.g;
    for (const r in g.reward.res) addRes(s, r, g.reward.res[r], { force: true, track: false });
    s.goal++;
    s.goalBase = counter(s, goalDef(s));
    emit(s, 'goal', { text: g.text, reward: g.reward });
    gainXp(s, g.reward.xp);
    done++;
  }
  return done;
}

// ---- save
export function serialize(s) { const c = JSON.parse(JSON.stringify(Object.assign({}, s, { ev: [] }))); return c; }
const num = (v, d, lo = -1e9, hi = 1e9) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
export function sanitize(raw) {
  const s = newState();
  if (!raw || typeof raw !== 'object' || raw.v !== 2) return s;
  try {
    for (const r of RES_IDS) s.inv[r] = Math.floor(num(raw.inv && raw.inv[r], 0, 0, 1e6));
    for (const k of SLOTS) s.gear[k] = Math.floor(num(raw.gear && raw.gear[k], s.gear[k], 0, GEAR[k].length - 1));
    if (raw.mods && typeof raw.mods === 'object') {
      for (const k in raw.mods) {
        const m = raw.mods[k], i = Number(k);
        if (!m || !MODS[m.type] || !(i >= 0 && i < SLOT_POS.length)) continue;
        const lv = Math.floor(num(m.lv, 1, 1, MODS[m.type].lv.length));
        s.mods[i] = { type: m.type, lv, hp: num(m.hp, 1, 0, 1e5),
          ore: num(m.ore, 0, 0, 999), wood: 0, out: num(m.out, 0, 0, 999), prog: num(m.prog, 0, 0, 100), crop: num(m.crop, 0, 0, 99), grow: num(m.grow, 0, 0, 1), cd: 0 };
      }
    }
    const st = raw.stats || {};
    s.stats.gathered = {};
    for (const r of RES_IDS) if (st.gathered && st.gathered[r]) s.stats.gathered[r] = num(st.gathered[r], 0, 0, 1e7);
    s.stats.built = {};
    for (const t of MOD_IDS) if (st.built && st.built[t]) s.stats.built[t] = num(st.built[t], 0, 0, 1e4);
    for (const k of ['kills', 'bossKills', 'travels', 'nights', 'deaths', 'smelted']) s.stats[k] = Math.floor(num(st[k], 0, 0, 1e7));
    s.stats.boarded = !!st.boarded;
    s.goal = Math.floor(num(raw.goal, 0, 0, 1e5));
    s.goalBase = num(raw.goalBase, 0, 0, 1e7);
    s.xp = num(raw.xp, 0, 0, 1e9);
    s.level = Math.floor(num(raw.level, 1, 1, 200));
    s.maxHp = Math.min(220, 100 + 8 * (s.level - 1));
    s.hp = num(raw.hp, s.maxHp, 1, s.maxHp);
    s.hunger = num(raw.hunger, 100, 0, 100);
    s.zone = Math.floor(num(raw.zone, 0, 0, 1e4));
    s.tod = num(raw.tod, 0.16, 0, 0.9999);
    s.day = Math.floor(num(raw.day, 1, 1, 1e6));
    s.nightDone = !!raw.nightDone;
    s.beast = Math.floor(num(raw.beast, 0, 0, BEAST_MAX));
    s.cz = num(raw.cz, 0, -1e7, 1e7);
    s.spawn = raw.spawn === 'bed' ? 'bed' : 'deck';
    s.flags = { gift: !!(raw.flags && raw.flags.gift) };
  } catch (e) { return newState(); }
  return s;
}
export function giftBundle(s) {
  const g = { wood: 30, stone: 20, fiber: 16, scrap: 10 };
  for (const k in g) addRes(s, k, g[k], { force: true, track: false });
  s.gear.axe = Math.max(s.gear.axe, 1);
  s.gear.pick = Math.max(s.gear.pick, 1);
  s.gear.melee = Math.max(s.gear.melee, 1);
  s.flags.gift = true;
  return g;
}
export { biomeOf, tierOf, NODES };
