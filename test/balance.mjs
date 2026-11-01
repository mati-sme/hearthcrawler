// Headless progression sim (node only): ~60 min of reasonable play on the real rules in src/core.js.
// Asserts: no gap > 4 min without a new unlock/upgrade, never stuck, nights are survivable, boss pacing.
import * as C from '../src/core.js';
import * as D from '../src/data.js';

const TOTAL = 60 * 60;
const MAX_GAP = 240;
const s = C.newState();
let t = 0;
const log = [];
const events = [0];
let stuck = 0;
const problems = [];

const sig = () => {
  let m = 0, lv = 0;
  for (const k in s.mods) { m++; lv += s.mods[k].lv; }
  return [s.goal, s.level, s.gear.axe + s.gear.pick + s.gear.melee + s.gear.ranged + s.gear.torch, m, lv, s.zone, s.beast].join(',');
};
let lastSig = sig();
function mark(why) {
  const n = sig();
  if (n !== lastSig) { events.push(t); lastSig = n; if (why) log.push(`${(t / 60).toFixed(1).padStart(5)}m  ${why}`); }
}

// ---- sim clock
let nightIdx = 0;
let inNight = false;
function advance(dt) {
  t += dt;
  s.tod += dt / D.CYCLE;
  s.hunger = Math.max(0, s.hunger - 0.12 * dt);
  C.tickMods(s, dt);
  if (s.hunger < 45 && C.foodCount(s) > 0) C.eat(s);
  if (!inNight && s.tod >= D.NIGHT_AT && s.tod < 1) { inNight = true; nightIdx++; runNight(); }
  if (s.tod >= 1) { s.tod -= 1; s.day++; if (inNight) { inNight = false; endNight(); } }
  s.ev.length = 0;
  C.checkGoals(s);
  mark();
}
function runNight() {
  const w = D.waveFor(nightIdx, s.zone);
  const def = C.defense(s), thr = C.threat(nightIdx, s.zone);
  if (def < thr * 1.1) problems.push(`night ${nightIdx} (zone ${s.zone}): defense ${def.toFixed(0)} < threat ${thr.toFixed(0)}`);
  for (const ty of w.list) C.onKill(s, ty, false);
  if (w.boss) { C.onKill(s, 'warlord', true); C.bossChest(s, nightIdx); log.push(`${(t / 60).toFixed(1).padStart(5)}m  BOSS night ${nightIdx}`); }
  // the player spends ~50 s defending
  t += 50; C.tickMods(s, 50); s.hunger = Math.max(0, s.hunger - 6);
}
function endNight() { C.nightSurvived(s, nightIdx); s.ev.length = 0; C.checkGoals(s); mark(`night ${nightIdx} survived`); }

// ---- gathering model
const HUMAN = 1.5; // real players are slower than the bot
const NODE_FOR = { wood: 'tree', stone: 'rock', ore: 'ore', glow: 'crystal', fiber: 'bush', scrap: 'scrap', berries: 'bush' };
function gatherOnce(res) {
  if (res === 'metal') res = 'ore';
  if (res === 'veg' || res === 'meat') res = 'berries';
  const kind = NODE_FOR[res];
  const d = D.NODES[kind];
  const tier = d.tool ? s.gear[d.tool] : 0;
  if (tier < d.minTier) return false;
  if (kind === 'crystal' && s.zone < 2) return false; // crystals only grow from the third biome on
  const base = d.tool ? D.GEAR[d.tool][tier].power : 3;
  const power = base * C.gatherMult(s);
  const node = { hp: d.hp, acc: 0, zone: s.zone };
  const sw = d.tool ? D.SWING[d.tool] : 0.55;
  let secs = 7; // walk to and line up with the node (humans are slower than bots)
  while (node.hp > 0) {
    const last = node.hp - power <= 0;
    const y = C.hitYield(s, node, kind, power, last);
    for (const r in y) C.addRes(s, r, y[r]);
    node.hp -= power;
    secs += sw + 0.15;
  }
  C.nodeDone(s, kind);
  advance(secs * HUMAN);
  return true;
}
function furnaceSlot() { for (const k in s.mods) if (s.mods[k].type === 'furnace') return +k; return -1; }
function metalStep() {
  const f = furnaceSlot();
  if (f < 0) return false;
  const m = s.mods[f];
  C.furnaceCollect(s, f);
  if (s.inv.ore >= 1 && s.inv.wood >= 1) { advance(2); C.furnaceLoad(s, f); }
  if (m.out > 0) { advance(2); C.furnaceCollect(s, f); return true; }
  if (m.ore > 0) { advance(Math.max(2, (7 - m.lv * 1.5) * m.ore)); C.furnaceCollect(s, f); return true; }
  if (s.gear.pick < 1) return false;
  if (s.inv.wood < 6) { gatherOnce('wood'); return true; }
  for (let i = 0; i < 4; i++) gatherOnce('ore');
  advance(1); C.furnaceLoad(s, f);
  return true;
}
function gardenStep() {
  for (const k in s.mods) if (s.mods[k].type === 'garden' && s.mods[k].crop > 0) { advance(2); C.gardenHarvest(s, +k); return true; }
  return false;
}

// ---- actions
function freeSlot() { for (let i = 0; i < D.SLOT_POS.length; i++) if (!s.mods[i]) return i; return -1; }
function bestSlotOf(type) { let b = -1; for (const k in s.mods) if (s.mods[k].type === type && (b < 0 || s.mods[k].lv < s.mods[b].lv)) b = +k; return b; }
function doAction(a) {
  for (const r in a.cost) if (a.cost[r] > C.cap(s)) {
    const st = bestSlotOf('storage');
    if (st < 0) return obtain({ cost: D.MODS.storage.lv[0], run: () => C.buildModule(s, freeSlot(), 'storage') });
    return obtain({ cost: C.canUpgrade(s, st).cost || {}, run: () => C.upgradeModule(s, st) });
  }
  return obtain(a);
}
function obtain(a) {
  for (let guard = 0; guard < 60; guard++) {
    const miss = C.missing(s, a.cost);
    const keys = Object.keys(miss);
    if (!keys.length) { advance(3); const ok = a.run(); s.ev.length = 0; C.checkGoals(s); mark(); return ok !== false; }
    keys.sort((x, y) => miss[y] - miss[x]);
    let got = false;
    for (const k of keys) {
      const ok = k === 'metal' ? metalStep() : k === 'veg' ? (gardenStep() || gatherOnce('berries')) : k === 'meat' ? gatherOnce('berries') : gatherOnce(k);
      if (ok) { got = true; break; }
    }
    if (!got) return false;
  }
  return false;
}
function craftAction(id) {
  const r = D.RECIPES.find((x) => x.id === id);
  if (s.gear[r.slot] >= r.tier) return true;
  const target = D.RECIPES.find((x) => x.slot === r.slot && x.tier === s.gear[r.slot] + 1) || r;
  return doAction({ cost: target.cost, run: () => C.craft(s, target.id) });
}
function buildAction(type) {
  if (s.level < D.MODS[type].unlock) return fillerAction();
  const slot = freeSlot();
  if (slot < 0) return fillerAction();
  return doAction({ cost: D.MODS[type].lv[0], run: () => C.buildModule(s, slot, type) });
}
function upgradeAction(type, lv) {
  const slot = bestSlotOf(type);
  if (slot < 0) return buildAction(type);
  if (s.mods[slot].lv >= lv) return true;
  const c = C.canUpgrade(s, slot);
  if (!c.cost) return false;
  return doAction({ cost: c.cost, run: () => C.upgradeModule(s, slot) });
}
function travelAction() {
  const c = C.travelCost(s);
  for (let g = 0; g < 80 && !C.canTravel(s); g++) {
    if (s.inv.wood < c.wood) gatherOnce('wood');
    else if (!gardenStep()) gatherOnce('berries');
  }
  if (!C.canTravel(s)) return false;
  C.payTravel(s);
  advance(45);
  C.arrive(s);
  s.ev.length = 0; C.checkGoals(s); mark(`arrive zone ${s.zone}`);
  return true;
}
// when the current goal is time-gated, make useful progress elsewhere
function fillerAction() {
  const cands = [];
  for (const r of D.RECIPES) if (s.gear[r.slot] === r.tier - 1) cands.push({ cost: r.cost, run: () => C.craft(s, r.id) });
  if (s.beast < C.BEAST_MAX) cands.push({ cost: C.beastCost(s), run: () => C.upgradeBeast(s) });
  for (const k in s.mods) { const c = C.canUpgrade(s, +k); if (c.cost) cands.push({ cost: c.cost, run: () => C.upgradeModule(s, +k) }); }
  for (const ty of D.MOD_IDS) if (s.level >= D.MODS[ty].unlock && C.modCount(s, ty) === 0 && freeSlot() >= 0) cands.push({ cost: D.MODS[ty].lv[0], run: () => C.buildModule(s, freeSlot(), ty) });
  const feasible = (a) => Object.keys(a.cost).every((r) => (r !== 'metal' || furnaceSlot() >= 0) && (r !== 'glow' || (s.gear.pick >= 2 && s.zone >= 2)) && (r !== 'ore' || s.gear.pick >= 1));
  cands.splice(0, cands.length, ...cands.filter(feasible));
  if (!cands.length) return gatherOnce('wood');
  const W = { ore: 2, metal: 3, glow: 5 };
  const effort = (a) => { const m = C.missing(s, a.cost); let e = 0; for (const r in m) e += m[r] * (W[r] || 1); return e + Object.values(a.cost).reduce((x, y) => x + y, 0) * 0.05; };
  cands.sort((a, b) => effort(a) - effort(b));
  return doAction(cands[0]);
}

function step() {
  const g = C.goalDef(s);
  switch (g.kind) {
    case 'gather': {
      const need = Math.min(g.arg === 'metal' ? 99 : C.cap(s), g.n);
      const before = s.stats.gathered[g.arg] || 0;
      const gi = s.goal;
      for (let i = 0; i < 12 && (s.stats.gathered[g.arg] || 0) - before < need && s.goal === gi; i++) if (!gatherOnce(g.arg)) return false;
      return true;
    }
    case 'craft': return craftAction(g.arg);
    case 'build': return buildAction(g.arg);
    case 'upgrade': return upgradeAction(g.arg, g.n);
    case 'beast': return doAction({ cost: C.beastCost(s), run: () => C.upgradeBeast(s) });
    case 'deck': advance(8); C.onBoard(s); return true;
    case 'smelt': return metalStep() || fillerAction();
    case 'travels': case 'travelsd': return travelAction();
    default: return fillerAction(); // level / nights / kills / boss / killsd are time-gated: spend on upgrades meanwhile
  }
}

const goalAt = [];
let lastGoal = 0;
while (t < TOTAL) {
  const t0 = t;
  const ok = step();
  if (!ok || t === t0) { stuck++; advance(5); } else stuck = Math.max(0, stuck - 1);
  if (stuck > 80) { problems.push(`stuck at t=${(t / 60).toFixed(1)}m goal=${s.goal} (${C.goalDef(s).text})`); break; }
  while (lastGoal < s.goal) { goalAt.push(t); log.push(`${(t / 60).toFixed(1).padStart(5)}m  goal ${lastGoal + 1} ${(lastGoal < D.GOALS.length ? D.GOALS[lastGoal].text : "endless")} (lvl ${s.level})`); lastGoal++; }
}
events.push(Math.min(t, TOTAL));

// ---- report
let maxGap = 0, gapAt = 0;
for (let i = 1; i < events.length; i++) if (events[i] - events[i - 1] > maxGap) { maxGap = events[i] - events[i - 1]; gapAt = events[i - 1]; }
if (process.env.VERBOSE) console.log(log.join('\n'));
console.log('--- goals done:', s.goal, ' level:', s.level, ' zone:', s.zone, ' nights:', s.stats.nights, ' bosses:', s.stats.bossKills, ' kills:', s.stats.kills, ' t=', (t / 60).toFixed(1) + 'm');
console.log('--- gear', JSON.stringify(s.gear), ' mods', Object.values(s.mods).map((m) => `${m.type}${m.lv}`).join(' '));
console.log(`--- max gap without unlock/upgrade: ${maxGap.toFixed(0)}s at ${(gapAt / 60).toFixed(1)}m`);
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++; };
check(maxGap <= MAX_GAP, `no gap > ${MAX_GAP}s between unlocks/upgrades (max ${maxGap.toFixed(0)}s)`);
check(stuck <= 80 && t >= TOTAL, 'player never stuck for 60 min');
check(problems.length === 0, 'every night survivable (defense >= 1.1x threat)' + (problems.length ? ': ' + problems.slice(0, 3).join('; ') : ''));
check(s.goal >= 40, `goal chain advanced steadily (${s.goal} done)`);
check(s.stats.bossKills >= 3, `boss raiders every third night (${s.stats.bossKills} defeated)`);
check(s.zone >= 3, `travelled to new biomes (zone ${s.zone})`);
check(goalAt.length > 1 && goalAt.every((x, i) => i === 0 || x - goalAt[i - 1] < 420), 'no goal takes more than 7 min');
check(s.stats.nights >= 8, `nights survived: ${s.stats.nights}`);
check(s.level >= 12, `player level ${s.level} >= 12`);
if (fails) { console.error(`${fails} balance check(s) failed`); process.exit(1); }
console.log('balance OK');
