// Pure data tables (no DOM, no three) so the balance sim can import them in node.
export const VERSION = '2.0.0';
export const DAY_SEC = 240;
export const NIGHT_SEC = 120;
export const CYCLE = DAY_SEC + NIGHT_SEC;
export const NIGHT_AT = DAY_SEC / CYCLE; // time-of-day fraction where night begins
export const ZONE_LEN = 260;
export const SAVE_KEY = 'hearthcrawler-save-v2';
export const OLD_KEY = 'hearthcrawler-save-v1';
export const MIGRATED_KEY = 'hearthcrawler-v2-migrated';

export const RES = {
  wood: { name: 'Wood', col: '#d9a05b' },
  stone: { name: 'Stone', col: '#aeb9c4' },
  fiber: { name: 'Fiber', col: '#8fdc6b' },
  scrap: { name: 'Scrap', col: '#e08a4a' },
  ore: { name: 'Ore', col: '#f0b24a' },
  metal: { name: 'Metal', col: '#9fd4ff' },
  glow: { name: 'Glowstone', col: '#6fe0d0' },
  berries: { name: 'Berries', col: '#ff5f7e' },
  veg: { name: 'Veg', col: '#7fe38a' },
  meat: { name: 'Meat', col: '#ff9a7a' },
};
export const RES_IDS = Object.keys(RES);
export const FOOD = { berries: 14, veg: 24, meat: 38 };
export const FOOD_IDS = Object.keys(FOOD);

// Resource nodes: hp = hit points, yield = units when fully harvested (before zone richness)
export const NODES = {
  tree: { name: 'Tree', res: 'wood', hp: 30, yield: 5, tool: 'axe', minTier: 0, respawn: 110 },
  rock: { name: 'Boulder', res: 'stone', hp: 40, yield: 4, tool: 'pick', minTier: 0, respawn: 120 },
  ore: { name: 'Ore vein', res: 'ore', hp: 55, yield: 3, tool: 'pick', minTier: 1, respawn: 150 },
  crystal: { name: 'Glow crystal', res: 'glow', hp: 70, yield: 3, tool: 'pick', minTier: 2, respawn: 180 },
  bush: { name: 'Fiber bush', res: 'fiber', hp: 12, yield: 3, tool: null, minTier: 0, extra: { berries: 2 }, respawn: 90 },
  scrap: { name: 'Scrap pile', res: 'scrap', hp: 24, yield: 4, tool: null, minTier: 0, respawn: 130 },
};

// Hotbar categories (fixed 6 slots). tier 0 = bare hands.
export const SLOTS = ['axe', 'pick', 'melee', 'ranged', 'torch', 'hammer'];
export const SLOT_NAMES = { axe: 'Hatchet', pick: 'Pickaxe', melee: 'Weapon', ranged: 'Crossbow', torch: 'Torch', hammer: 'Hammer' };
export const GEAR = {
  axe: [
    { id: 'hands', name: 'Bare hands', power: 3 },
    { id: 'hatchet1', name: 'Stone Hatchet', power: 8, cost: { wood: 5, stone: 3, fiber: 2 } },
    { id: 'hatchet2', name: 'Iron Hatchet', power: 14, cost: { wood: 8, metal: 4, fiber: 3 } },
    { id: 'hatchet3', name: 'Glow Hatchet', power: 22, cost: { wood: 12, metal: 8, glow: 5 } },
  ],
  pick: [
    { id: 'hands', name: 'Bare hands', power: 2 },
    { id: 'pick1', name: 'Stone Pickaxe', power: 8, cost: { wood: 5, stone: 4, fiber: 2 } },
    { id: 'pick2', name: 'Iron Pickaxe', power: 14, cost: { wood: 8, metal: 4, fiber: 3 } },
    { id: 'pick3', name: 'Glow Pickaxe', power: 22, cost: { wood: 12, metal: 8, glow: 5 } },
  ],
  melee: [
    { id: 'hands', name: 'Fists', power: 4 },
    { id: 'club', name: 'Oak Club', power: 10, cost: { wood: 8, fiber: 2 } },
    { id: 'spear1', name: 'Stone Spear', power: 18, cost: { wood: 6, stone: 5, fiber: 3 } },
    { id: 'spear2', name: 'Iron Spear', power: 30, cost: { wood: 6, metal: 5, fiber: 3 } },
    { id: 'spear3', name: 'Glow Spear', power: 46, cost: { wood: 8, metal: 8, glow: 6 } },
  ],
  ranged: [
    { id: 'none', name: 'No crossbow', power: 0 },
    { id: 'bow1', name: 'Scrap Crossbow', power: 26, cost: { wood: 14, scrap: 10, fiber: 6 } },
    { id: 'bow2', name: 'Iron Crossbow', power: 42, cost: { wood: 10, scrap: 12, metal: 6 } },
    { id: 'bow3', name: 'Glow Crossbow', power: 64, cost: { metal: 10, glow: 8, scrap: 12 } },
  ],
  torch: [
    { id: 'none', name: 'No torch', power: 0 },
    { id: 'torch', name: 'Torch', power: 3, cost: { wood: 3, fiber: 2 } },
  ],
  hammer: [
    { id: 'none', name: 'No hammer', power: 0 },
    { id: 'hammer', name: 'Build Hammer', power: 4 },
  ],
};
// Reach (m) and swing time (s) per slot
export const REACH = { axe: 3.4, pick: 3.4, melee: 4.0, ranged: 40, torch: 3.2, hammer: 3.2 };
export const SWING = { axe: 0.55, pick: 0.6, melee: 0.5, ranged: 1.1, torch: 0.5, hammer: 0.55 };

export const RECIPES = [];
for (const slot of SLOTS) GEAR[slot].forEach((g, tier) => { if (g.cost) RECIPES.push({ id: g.id, slot, tier, name: g.name, cost: g.cost, power: g.power }); });

// Caravan modules. lv[i] = cost to reach level i+1. unlock = player level.
export const MODS = {
  palisade: { name: 'Palisade', unlock: 1, desc: 'Tough wall. Raiders attack it first.', hp: [140, 280, 480, 760, 1150],
    lv: [{ wood: 10 }, { wood: 14, stone: 8 }, { wood: 20, stone: 16, metal: 3 }, { wood: 26, stone: 24, metal: 8, glow: 2 }, { wood: 30, stone: 30, metal: 8, glow: 5 }] },
  lantern: { name: 'Lantern', unlock: 1, desc: 'Warm light. Heals you on deck.', hp: [60, 90, 130, 180, 240],
    lv: [{ wood: 4, fiber: 3 }, { wood: 6, scrap: 6 }, { scrap: 10, metal: 2 }, { metal: 4, glow: 3 }, { metal: 5, glow: 5, scrap: 10 }] },
  bed: { name: 'Bed', unlock: 1, desc: 'Sleep to heal. Respawn point.', hp: [80, 120, 180],
    lv: [{ wood: 12, fiber: 10 }, { wood: 14, fiber: 14, scrap: 4 }, { wood: 20, fiber: 16, scrap: 10 }] },
  turret: { name: 'Turret', unlock: 2, desc: 'Auto-shoots foes at night.', hp: [90, 150, 230, 340, 480],
    lv: [{ wood: 14, scrap: 8 }, { wood: 18, scrap: 14, metal: 3 }, { scrap: 20, metal: 8 }, { metal: 12, glow: 6 }, { metal: 12, glow: 8, scrap: 18 }] },
  storage: { name: 'Storage', unlock: 2, desc: 'Raises your carry cap by 60 per level.', hp: [100, 160, 240],
    lv: [{ wood: 16, stone: 6 }, { wood: 22, stone: 12, scrap: 6 }, { wood: 30, stone: 20, metal: 4 }] },
  garden: { name: 'Garden', unlock: 3, desc: 'Grows veg over time.', hp: [70, 110, 160],
    lv: [{ wood: 10, fiber: 12 }, { wood: 14, fiber: 16, stone: 6 }, { wood: 20, fiber: 20, stone: 12 }] },
  furnace: { name: 'Furnace', unlock: 3, desc: 'Smelts ore into metal.', hp: [110, 170, 250],
    lv: [{ stone: 20, wood: 6, scrap: 4 }, { stone: 28, metal: 4 }, { stone: 36, metal: 8, glow: 2 }] },
};
const scaleCost = (c, k) => { const o = {}; for (const r in c) o[r] = Math.round(c[r] * k); return o; };
for (const m of Object.values(MODS)) m.lv = m.lv.map((c, i) => (i >= 1 ? scaleCost(c, 1 + 0.22 * i) : c));
for (const slot of SLOTS) GEAR[slot].forEach((g, i) => { if (g.cost && i >= 2) g.cost = scaleCost(g.cost, 1.4); });
RECIPES.length = 0;
for (const slot of SLOTS) GEAR[slot].forEach((g, tier) => { if (g.cost) RECIPES.push({ id: g.id, slot, tier, name: g.name, cost: g.cost, power: g.power }); });
export const MOD_IDS = Object.keys(MODS);
export const TURRET = { dmg: [10, 15, 22, 34, 50], every: [1.2, 1.0, 0.8, 0.65, 0.55], range: 26 };
export const SLOT_POS = [ // local to the caravan, deck plane
  [-2.8, -3.7], [2.8, -3.7], [-3.0, 0], [3.0, 0], [-2.8, 3.6], [2.8, 3.6], [0, -2.2], [-1.3, 1.6], [1.3, 1.6], [0, -0.2],
];
export const DECK = { x: 3.8, z: 5, y: 5.3 };

export const BIOMES = [
  { id: 'meadow', name: 'Mossy Meadow', ground: [0x4b8a3c, 0x82b658], grass: 0x7cc24c, fogNear: 18, fogFar: 92, amp: 1.4, terrace: 0,
    day: [0xbfe0e8, 0x4a86c8], gold: [0xff9a5a, 0x5a4a9a], night: [0x12324a, 0x040a1e], cloud: 0xffffff,
    trees: ['oak', 'pine'], rock: 'rock', bush: 'bush', flowers: [0xffd84a, 0xff7aa8, 0xffffff, 0x9ad0ff], mote: { col: 0xfff2b0, fall: 0.0, size: 3.2 },
    foe: 0xffffff, desc: 'Gentle hills and berry bushes.' },
  { id: 'autumn', name: 'Amber Autumn Forest', ground: [0x8a5c2e, 0xc48a3a], grass: 0xd69a38, fogNear: 16, fogFar: 85, amp: 1.7, terrace: 0,
    day: [0xf0d6a8, 0x6fa0c0], gold: [0xff7a3a, 0x7a3a6a], night: [0x24203e, 0x06061a], cloud: 0xfff0dd,
    trees: ['maple', 'oak'], rock: 'rock', bush: 'bush', flowers: [0xff7a3a, 0xffc84a, 0xd05a2a], mote: { col: 0xffa84a, fall: 0.7, size: 4.2 },
    foe: 0xffc080, desc: 'Falling leaves and richer wood.' },
  { id: 'tundra', name: 'Frost Tundra', ground: [0xc2d6e6, 0xf4f9ff], grass: 0xd8ecf2, fogNear: 12, fogFar: 76, amp: 1.9, terrace: 0,
    day: [0xdcecf4, 0x7fb0d8], gold: [0xffa0b0, 0x6a74b8], night: [0x153a58, 0x03102a], cloud: 0xf4faff,
    trees: ['snowpine', 'snowpine'], rock: 'icerock', bush: 'frostbush', flowers: [], mote: { col: 0xffffff, fall: 1.4, size: 4.6 },
    foe: 0xa8dcff, desc: 'Snow, ice and glow crystals.' },
  { id: 'canyon', name: 'Red Canyon Badlands', ground: [0xa84a2a, 0xdc8a44], grass: 0xc9a35a, fogNear: 20, fogFar: 98, amp: 2.3, terrace: 0.8,
    day: [0xf2c9a0, 0x5e8fc0], gold: [0xff5a2a, 0x8a3a5a], night: [0x2a2038, 0x080614], cloud: 0xffe4cc,
    trees: ['dead', 'cactus'], rock: 'redrock', bush: 'dryshrub', flowers: [0xff5a8a], mote: { col: 0xffb27a, fall: 0.2, size: 3.6 },
    foe: 0xff8a6a, desc: 'Red mesas packed with ore.' },
  { id: 'marsh', name: 'Glowshroom Marsh', ground: [0x2a6a50, 0x4aa07c], grass: 0x3fd4a0, fogNear: 10, fogFar: 66, amp: 0.9, terrace: 0,
    day: [0xa8d8c0, 0x3f7f8a], gold: [0xff8fa0, 0x3a5a8a], night: [0x0e3a3a, 0x030c18], cloud: 0xd8ffe8,
    trees: ['shroom', 'twisted'], rock: 'mossrock', bush: 'glowbush', flowers: [0x6fe0d0, 0xff7ad0, 0xb8a0ff], mote: { col: 0x8dffd8, fall: -0.5, size: 5.0 },
    foe: 0x8dffd8, desc: 'Glowing mushrooms, rare crystals.' },
];

// Foes
export const FOES = {
  shade: { name: 'Gloomling', hp: 16, speed: 4.2, dmg: 4, mdmg: 3, xp: 6, r: 0.55 },
  raider: { name: 'Mask Raider', hp: 42, speed: 3.0, dmg: 6, mdmg: 8, xp: 12, r: 0.6 },
  boar: { name: 'Tusk Boar', hp: 68, speed: 3.8, dmg: 9, mdmg: 6, xp: 16, r: 0.8 },
  warlord: { name: 'Warlord Raider', hp: 520, speed: 2.4, dmg: 16, mdmg: 22, xp: 160, r: 1.3 },
};
export function waveFor(night, zone) {
  const count = Math.min(16, 3 + Math.floor(night * 0.9) + zone * 2);
  const hpMul = 1 + 0.10 * (night - 1) + 0.22 * zone;
  const boss = night % 3 === 0;
  const list = [];
  for (let i = 0; i < count; i++) {
    let t = 'shade';
    if (night >= 2 && i % 3 === 1) t = 'raider';
    if (night >= 3 && i % 4 === 3) t = 'boar';
    list.push(t);
  }
  return { list, hpMul, boss, count };
}
export function bossHpMul(night, zone) { return 1 + 0.15 * (night / 3 - 1) + 0.25 * zone; }
export function waveHp(night, zone) {
  const w = waveFor(night, zone);
  let hp = 0;
  for (const t of w.list) hp += FOES[t].hp * w.hpMul;
  if (w.boss) hp += FOES.warlord.hp * bossHpMul(night, zone);
  return hp;
}

// Goal chain. kinds: gather(res, n delta) craft(gear id) build(type) upgrade(type, n=level) kills(n abs) killsd(n delta) nights(n abs)
// travels(n abs) beast(n abs) level(n abs) deck smelt(n delta metal) boss(n abs)
const G = (text, kind, arg, n, xp, res) => ({ text, kind, arg, n, reward: { xp, res: res || {} } });
export const GOALS = [
  G('Chop 6 wood from a tree', 'gather', 'wood', 6, 15, { fiber: 2 }),
  G('Break a boulder: 4 stone', 'gather', 'stone', 4, 15),
  G('Pick 4 fiber from bushes', 'gather', 'fiber', 4, 15),
  G('Craft a Stone Hatchet', 'craft', 'hatchet1', 1, 35, { wood: 8 }),
  G('Climb aboard the Shellback', 'deck', '', 1, 20, { wood: 6 }),
  G('Craft a Stone Pickaxe', 'craft', 'pick1', 1, 35, { stone: 6, wood: 6 }),
  G('Build a Palisade on the deck', 'build', 'palisade', 1, 40),
  G('Gather 24 more wood', 'gather', 'wood', 24, 30, { fiber: 8 }),
  G('Craft a Torch', 'craft', 'torch', 1, 30),
  G('Build a Lantern', 'build', 'lantern', 1, 35, { scrap: 4 }),
  G('Collect 8 scrap', 'gather', 'scrap', 8, 40, { wood: 12, fiber: 4 }),
  G('Craft an Oak Club', 'craft', 'club', 1, 35),
  G('Build a Turret', 'build', 'turret', 1, 60, { scrap: 6, wood: 8 }),
  G('Build a Bed', 'build', 'bed', 1, 40, { fiber: 4 }),
  G('Survive your first night', 'nights', '', 1, 150, { wood: 30, stone: 20, scrap: 14, fiber: 10 }),
  G('Build Storage', 'build', 'storage', 1, 50, { wood: 10 }),
  G('Pick 8 berries', 'gather', 'berries', 8, 40, { fiber: 6 }),
  G('Plant a Garden', 'build', 'garden', 1, 55, { fiber: 8 }),
  G('Mine 6 ore', 'gather', 'ore', 6, 60, { stone: 12 }),
  G('Build a Furnace', 'build', 'furnace', 1, 75, { wood: 14, stone: 10 }),
  G('Smelt 4 metal', 'smelt', '', 4, 70, { ore: 4, wood: 6 }),
  G('Craft an Iron Hatchet', 'craft', 'hatchet2', 1, 80, { wood: 10 }),
  G('Upgrade the Turret to Lv 2', 'upgrade', 'turret', 2, 90, { scrap: 10 }),
  G('Reach player level 6', 'level', '', 6, 80, { stone: 14, wood: 14 }),
  G('Craft a Stone Spear', 'craft', 'spear1', 1, 60, { fiber: 4 }),
  G('Upgrade the Palisade to Lv 2', 'upgrade', 'palisade', 2, 80, { stone: 8 }),
  G('Defeat 6 night creatures', 'kills', '', 6, 60, { scrap: 6 }),
  G('Gather supplies and travel on', 'travels', '', 1, 220, { wood: 30, stone: 20, scrap: 16, metal: 4, fiber: 12 }),
  G('Craft an Iron Pickaxe', 'craft', 'pick2', 1, 90, { metal: 2, wood: 10 }),
  G('Smelt 8 more metal', 'smelt', '', 8, 100, { ore: 6, wood: 10 }),
  G('Craft a Scrap Crossbow', 'craft', 'bow1', 1, 100, { scrap: 10 }),
  G('Upgrade the Turret to Lv 3', 'upgrade', 'turret', 3, 120, { metal: 3, scrap: 10 }),
  G('Survive 3 nights', 'nights', '', 3, 120, { wood: 20, scrap: 14, metal: 3 }),
  G('Defeat the Warlord Raider', 'boss', '', 1, 250, { metal: 8, scrap: 24, stone: 20, glow: 3 }),
  G('Craft an Iron Spear', 'craft', 'spear2', 1, 120, { wood: 8, metal: 2 }),
  G('Upgrade Storage to Lv 2', 'upgrade', 'storage', 2, 90, { wood: 12 }),
  G('Upgrade the Palisade to Lv 3', 'upgrade', 'palisade', 3, 130, { stone: 12, metal: 2 }),
  G('Upgrade the Furnace to Lv 2', 'upgrade', 'furnace', 2, 120, { stone: 12 }),
  G('Reach the third biome', 'travels', '', 2, 320, { wood: 40, stone: 30, scrap: 20, metal: 8, glow: 4, fiber: 12 }),
  G('Mine 4 glow crystals', 'gather', 'glow', 4, 140, { metal: 4 }),
  G('Craft a Glow Hatchet', 'craft', 'hatchet3', 1, 150, { glow: 2, metal: 2 }),
  G('Upgrade the Turret to Lv 4', 'upgrade', 'turret', 4, 180, { metal: 4, scrap: 12 }),
  G('Craft a Glow Pickaxe', 'craft', 'pick3', 1, 160, { glow: 2, metal: 2 }),
  G('Shellback Care to Lv 5', 'beast', '', 5, 90, { wood: 10, scrap: 6 }),
  G('Upgrade the Garden to Lv 2', 'upgrade', 'garden', 2, 110, { fiber: 12 }),
  G('Craft an Iron Crossbow', 'craft', 'bow2', 1, 180, { scrap: 10, metal: 2 }),
  G('Upgrade the Palisade to Lv 4', 'upgrade', 'palisade', 4, 200, { metal: 4, stone: 16 }),
  G('Defeat 19 creatures', 'kills', '', 19, 120, { metal: 4, glow: 2 }),
  G('Craft a Glow Spear', 'craft', 'spear3', 1, 220, { metal: 4, glow: 2 }),
  G('Shellback Care to Lv 8', 'beast', '', 8, 140, { wood: 20, metal: 3 }),
  G('Survive 4 nights', 'nights', '', 4, 200, { scrap: 20, metal: 6, glow: 3 }),
  G('Upgrade the Lantern to Lv 5', 'upgrade', 'lantern', 5, 160, { metal: 4, glow: 3 }),
  G('Upgrade the Turret to Lv 5', 'upgrade', 'turret', 5, 260, { metal: 6, glow: 4 }),
  G('Upgrade the Palisade to Lv 5', 'upgrade', 'palisade', 5, 260, { metal: 6, glow: 4 }),
  G('Reach the fourth biome', 'travels', '', 3, 400, { wood: 40, stone: 40, scrap: 24, metal: 12, glow: 8, fiber: 16 }),
  G('Shellback Care to Lv 13', 'beast', '', 13, 180, { metal: 5, glow: 3 }),
  G('Defeat 40 creatures', 'kills', '', 40, 200, { metal: 6, glow: 3 }),
  G('Reach the fifth biome', 'travels', '', 4, 460, { wood: 50, stone: 50, scrap: 30, metal: 14, glow: 10, fiber: 20 }),
];
// After the chain ends, endless goals keep the tracker alive.
export function endlessGoal(i) {
  const t = i % 5;
  const k = 1 + Math.floor(i / 5);
  if (t === 0) return G(`Gather ${30 + 10 * k} wood`, 'gather', 'wood', 30 + 10 * k, 120 + 20 * k, { scrap: 6, metal: 2 });
  if (t === 1) return G(`Defeat ${5 + 2 * k} creatures`, 'killsd', '', 5 + 2 * k, 130 + 20 * k, { metal: 3, glow: 1 });
  if (t === 2) return G(`Mine ${6 + 2 * k} glow crystals`, 'gather', 'glow', 6 + 2 * k, 150 + 20 * k, { metal: 4, glow: 2 });
  if (t === 3) return G('Travel to a new biome', 'travelsd', '', 1, 300 + 30 * k, { wood: 40, stone: 30, scrap: 20, metal: 10, glow: 6 });
  return G(`Collect ${10 + 4 * k} scrap`, 'gather', 'scrap', 10 + 4 * k, 120 + 20 * k, { metal: 3, wood: 20 });
}

export function biomeOf(zone) { return BIOMES[zone % BIOMES.length]; }
export function tierOf(zone) { return Math.floor(zone / BIOMES.length); }
export function xpNeed(L) { return Math.round(40 + 38 * (L - 1) + 7 * Math.pow(L - 1, 1.75)); }
