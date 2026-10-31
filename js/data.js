(function () {
  'use strict';
  const HC = (window.HC = window.HC || {});
  HC.VERSION = '1.2.1';
  HC.DT = 1 / 60;

  // ---------- pacing knobs (see PROMPT3 pacing pass) ----------
  HC.PACE = { tierCost: [1, 2, 4, 4.5], mod: 2.3, modGrow: 1.8, chassis: 2.5, yield: 0.45, resp: 1.6, xp: 1.7 };

  HC.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  HC.lerp = (a, b, t) => a + (b - a) * t;
  HC.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  HC.hashStr = function (s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  // ---------- resources ----------
  HC.RES = ['wood', 'stone', 'scrap', 'food', 'metal', 'fuel'];
  HC.RES_INFO = {
    wood: { name: 'Wood', color: '#b9824a', src: 'Chop trees' },
    stone: { name: 'Stone', color: '#9aa3b0', src: 'Mine rocks' },
    scrap: { name: 'Scrap', color: '#7e8a9c', src: 'Salvage scrap piles' },
    food: { name: 'Food', color: '#e0864a', src: 'Pick berry bushes or hunt critters' },
    metal: { name: 'Metal', color: '#9fc3e0', src: 'Smelt scrap in Craft (needs Furnace)' },
    fuel: { name: 'Fuel', color: '#e5533d', src: 'Brew fuel in Craft' },
  };

  // ---------- zones ----------
  HC.ZONES = [
    { id: 'meadow', name: 'Meadow', icon: '🌼', dist: 1, eng: 0, tree: 'round', decor: 'flowers',
      pal: { g1: '#9ad86c', g2: '#8fd062', patch: '#a9e07a', tuft: '#6fb34a', leaf: '#5cc255', leaf2: '#3fa045', trunk: '#8a5a34', rock: '#c3c9d2', rock2: '#9aa2ae', bush: '#4fb350', berry: '#ff5a6e', edge: '#5f9a45', camp: '#c9b27a', dark: '#2a4a8f' },
      mix: { tree: 70, rock: 30, scrap: 14, bush: 38 }, crit: ['bunny', 'snortle'], day: ['slime'], night: ['howler', 'slime'], boss: null },
    { id: 'pine', name: 'Pine Forest', icon: '🌲', dist: 2, eng: 1, tree: 'pine', decor: 'mush',
      pal: { g1: '#6fb67a', g2: '#64ab72', patch: '#7cc388', tuft: '#4a9560', leaf: '#2f8f5b', leaf2: '#1f7048', trunk: '#7a4e30', rock: '#b4bcc4', rock2: '#8c96a2', bush: '#3c9a58', berry: '#9a6bff', edge: '#2f6b48', camp: '#bfae7e', dark: '#1c3a66' },
      mix: { tree: 110, rock: 30, scrap: 24, bush: 34 }, crit: ['bunny', 'snortle'], day: ['slime', 'howler'], night: ['howler', 'raider', 'slime'], boss: null },
    { id: 'badlands', name: 'Rocky Badlands', icon: '🏜️', dist: 3, eng: 2, tree: 'dead', decor: 'cracks',
      pal: { g1: '#e3b779', g2: '#dbac6c', patch: '#eec58a', tuft: '#b98a4a', leaf: '#7da24a', leaf2: '#5e8238', trunk: '#8c5a3a', rock: '#d1a77c', rock2: '#a97f58', bush: '#8aa64c', berry: '#ff8a3c', edge: '#a8793f', camp: '#c9ab6f', dark: '#3a2a5a' },
      mix: { tree: 28, rock: 70, scrap: 28, bush: 24 }, crit: ['snortle', 'bunny'], day: ['slime', 'raider'], night: ['howler', 'raider', 'sling'], boss: 'boar' },
    { id: 'scrap', name: 'Scrap Wastes', icon: '⚙️', dist: 4, eng: 3, tree: 'dead', decor: 'junk',
      pal: { g1: '#a69c8c', g2: '#9c9282', patch: '#b4aa9a', tuft: '#7b7164', leaf: '#8a9a5a', leaf2: '#6a7a42', trunk: '#6a5846', rock: '#a9b0ba', rock2: '#7e8794', bush: '#8aa05a', berry: '#ffd24a', edge: '#6e6456', camp: '#b9a98a', dark: '#2a2f4a' },
      mix: { tree: 14, rock: 36, scrap: 80, bush: 22 }, crit: ['snortle'], day: ['scrapbot', 'raider'], night: ['scrapbot', 'raider', 'sling'], boss: 'warlord' },
    { id: 'frost', name: 'Frost Peaks', icon: '❄️', dist: 5, eng: 4, tree: 'snowpine', decor: 'snow',
      pal: { g1: '#e6f2fb', g2: '#d9ebf8', patch: '#f4fbff', tuft: '#b4d2e8', leaf: '#3d8f7e', leaf2: '#2b6f66', trunk: '#6d5242', rock: '#bfd8ec', rock2: '#8fb4d0', bush: '#4fa0a0', berry: '#4aa8ff', edge: '#8fb4d0', camp: '#cfd8e0', dark: '#16295a' },
      mix: { tree: 60, rock: 50, scrap: 32, bush: 26 }, crit: ['bunny', 'snortle'], day: ['yeti', 'slime'], night: ['yeti', 'howler', 'sling'], boss: null },
    { id: 'ember', name: 'Ember Volcano', icon: '🌋', dist: 6, eng: 5, tree: 'char', decor: 'lava',
      pal: { g1: '#5a4048', g2: '#51393f', patch: '#684a52', tuft: '#3a2a30', leaf: '#3a3036', leaf2: '#2a2228', trunk: '#2f2428', rock: '#6d5a64', rock2: '#473a42', bush: '#7a3a3a', berry: '#ff9a3a', edge: '#2a1c22', camp: '#7b6068', dark: '#2a0f2a' },
      mix: { tree: 26, rock: 62, scrap: 36, bush: 22 }, crit: ['snortle'], day: ['imp', 'scrapbot'], night: ['imp', 'imp', 'sling'], boss: 'golem' },
    { id: 'far', name: 'Far Roads', icon: '🛣️', dist: 7, eng: 5, tree: 'round', decor: 'flowers', far: true,
      pal: null, mix: { tree: 60, rock: 50, scrap: 40, bush: 30 }, crit: ['bunny', 'snortle'], day: ['slime', 'scrapbot', 'yeti', 'imp', 'raider'], night: ['howler', 'raider', 'sling', 'imp', 'yeti', 'scrapbot'], boss: null },
  ];
  HC.ZONE = {};
  HC.ZONES.forEach((z) => (HC.ZONE[z.id] = z));
  // far roads reuse the biome palettes in rotation
  HC.farBase = function (dist) { return HC.ZONES[(dist - 7) % 6]; };
  HC.fuelCost = function (dist, engLvl) {
    return Math.max(4, Math.round((6 + 5 * Math.min(dist, 14)) * (1 - 0.1 * Math.max(0, engLvl - 1))));
  };
  HC.engReq = function (z) { return z.far ? 5 : z.eng; };

  // ---------- tools / weapons / recipes ----------
  HC.TOOL = {
    axe1: { pow: 2, yld: 1.0 }, axe2: { pow: 3.5, yld: 1.25 }, axe3: { pow: 5.5, yld: 1.5 }, axe4: { pow: 8, yld: 2.0 },
    pick1: { pow: 2, yld: 1.0 }, pick2: { pow: 3.5, yld: 1.25 }, pick3: { pow: 5.5, yld: 1.5 }, pick4: { pow: 8, yld: 2.0 },
  };
  HC.HAND = { pow: 1, yld: 1.0 };
  HC.WEAPON = {
    fist: { name: 'Fists', icon: '👊', dmg: 4, range: 46, rate: 0.6, melee: true },
    spear: { name: 'Spear', icon: '🔱', dmg: 11, range: 64, rate: 0.5, melee: true },
    bow: { name: 'Bow', icon: '🏹', dmg: 13, range: 230, rate: 0.65, spd: 430, proj: 'arrow' },
    crossbow: { name: 'Crossbow', icon: '🎯', dmg: 24, range: 270, rate: 0.85, spd: 520, proj: 'bolt' },
    blaster: { name: 'Blaster', icon: '🔫', dmg: 34, range: 300, rate: 0.32, spd: 560, proj: 'energy', pierce: 1 },
  };
  HC.ARMOR = { armor1: 0.2, armor2: 0.32, armor3: 0.45 };

  // kind: axe/pick/weapon/armor/item(consumable)/mat(gives n of a resource)
  HC.RECIPES = [
    { id: 'axe1', name: 'Stone Axe', icon: '🪓', tier: 0, kind: 'axe', cost: { wood: 5, stone: 3 }, desc: 'Chop 2× faster' },
    { id: 'pick1', name: 'Stone Pick', icon: '⛏️', tier: 0, kind: 'pick', cost: { wood: 5, stone: 5 }, desc: 'Mine 2× faster' },
    { id: 'spear', name: 'Spear', icon: '🔱', tier: 0, kind: 'weapon', w: 'spear', cost: { wood: 6, stone: 4 }, desc: 'Dmg 11 · melee' },
    { id: 'bandage', name: 'Bandage', icon: '🩹', tier: 0, kind: 'item', item: 'bandage', cost: { wood: 3, food: 1 }, desc: 'Heals 35 HP' },
    { id: 'fuel', name: 'Fuel ×5', icon: '⛽', tier: 0, kind: 'mat', res: 'fuel', n: 5, cost: { wood: 4, scrap: 2 }, desc: 'For travelling' },
    { id: 'smelt', name: 'Metal Plate', icon: '🔩', tier: 0, kind: 'mat', res: 'metal', n: 1, cost: { scrap: 2 }, need: 'furnace', desc: 'Needs a Furnace' },
    { id: 'smelt5', name: 'Metal ×5', icon: '🔩', tier: 0, kind: 'mat', res: 'metal', n: 5, cost: { scrap: 9 }, need: 'furnace', desc: 'Needs a Furnace' },
    { id: 'meal', name: 'Hot Meal', icon: '🍲', tier: 0, kind: 'mat', res: 'food', n: 3, xp: 12, cost: { food: 6, wood: 2 }, need: 'furnace', desc: 'Hearty stew: +12 XP, keeps 3 food' },
    { id: 'axe2', name: 'Metal Axe', icon: '🪓', tier: 1, kind: 'axe', cost: { wood: 8, metal: 4 }, desc: 'Chop 3.5× faster' },
    { id: 'pick2', name: 'Metal Pick', icon: '⛏️', tier: 1, kind: 'pick', cost: { wood: 8, metal: 5 }, desc: 'Mine 3.5× faster' },
    { id: 'bow', name: 'Bow', icon: '🏹', tier: 1, kind: 'weapon', w: 'bow', cost: { wood: 10, scrap: 6 }, desc: 'Dmg 13 · ranged' },
    { id: 'armor1', name: 'Scrap Armor', icon: '🦺', tier: 1, kind: 'armor', cost: { scrap: 15, wood: 6 }, desc: '−20% damage' },
    { id: 'axe3', name: 'Steel Axe', icon: '🪓', tier: 2, kind: 'axe', cost: { metal: 10, wood: 10 }, desc: 'Chop 5.5× faster' },
    { id: 'pick3', name: 'Steel Pick', icon: '⛏️', tier: 2, kind: 'pick', cost: { metal: 12, wood: 10 }, desc: 'Mine 5.5× faster' },
    { id: 'crossbow', name: 'Crossbow', icon: '🎯', tier: 2, kind: 'weapon', w: 'crossbow', bp: 'bp_crossbow', cost: { metal: 12, wood: 12, scrap: 8 }, desc: 'Dmg 24 · ranged' },
    { id: 'bomb', name: 'Bomb', icon: '💣', tier: 2, kind: 'item', item: 'bomb', bp: 'bp_bomb', cost: { scrap: 6, stone: 4 }, desc: 'Big boom! Action button' },
    { id: 'medkit', name: 'Medkit', icon: '🧰', tier: 2, kind: 'item', item: 'medkit', bp: 'bp_medkit', cost: { metal: 4, food: 6, scrap: 5 }, desc: 'Heals 90 HP' },
    { id: 'armor2', name: 'Steel Plate', icon: '🛡️', tier: 2, kind: 'armor', cost: { metal: 14, scrap: 12 }, desc: '−32% damage' },
    { id: 'blaster', name: 'Blaster', icon: '🔫', tier: 3, kind: 'weapon', w: 'blaster', bp: 'bp_blaster', cost: { metal: 30, scrap: 30, fuel: 5 }, desc: 'Dmg 34 · sparkly bolts' },
    { id: 'axe4', name: 'Power Axe', icon: '🪓', tier: 3, kind: 'axe', bp: 'bp_power', cost: { metal: 30, scrap: 25 }, desc: 'Chop 8× faster' },
    { id: 'pick4', name: 'Power Pick', icon: '⛏️', tier: 3, kind: 'pick', bp: 'bp_power', cost: { metal: 34, scrap: 28 }, desc: 'Mine 8× faster' },
    { id: 'armor3', name: 'Power Armor', icon: '🤖', tier: 3, kind: 'armor', cost: { metal: 40, scrap: 35 }, desc: '−45% damage' },
  ];
  HC.RECIPES.forEach((r) => { if (r.kind === 'mat' || r.id === 'bandage') return; const f = HC.PACE.tierCost[r.tier]; for (const k in r.cost) r.cost[k] = Math.round(r.cost[k] * f); });
  HC.REC = {};
  HC.RECIPES.forEach((r) => (HC.REC[r.id] = r));
  HC.BP_NAMES = { bp_crossbow: 'Crossbow', bp_bomb: 'Bomb', bp_medkit: 'Medkit', bp_blaster: 'Blaster', bp_power: 'Power Tools' };
  HC.TIER_NAMES = ['By hand', 'Workbench', 'Workbench Lv2 + Furnace', 'Workbench Lv3'];

  // ---------- caravan ----------
  HC.CHASSIS = [[2, 2], [3, 2], [3, 3], [3, 4]];
  HC.chassisCost = function (l) { // cost to go from level l -> l+1
    const f = Math.pow(HC.PACE.modGrow, l - 1) * HC.PACE.chassis;
    const c = { wood: Math.round(25 * f), scrap: Math.round(12 * f) };
    if (l >= 2) c.metal = Math.round(5 * f);
    return c;
  };
  HC.MODS = {
    storage: { name: 'Storage', icon: '📦', base: { wood: 10, stone: 5 }, desc: (l) => `Stores +${l * 100} of each resource` },
    workbench: { name: 'Workbench', icon: '🔨', base: { wood: 12, stone: 6 }, desc: (l) => (l === 1 ? 'Unlocks Tier 1 crafting' : l === 2 ? 'Tier 2 crafting (with Furnace)' : l === 3 ? 'Unlocks Tier 3 crafting' : 'Master workshop') },
    bed: { name: 'Bed', icon: '🛏️', base: { wood: 10, food: 5 }, desc: (l) => `Heals ${l * 2}× near caravan` + (l >= 3 ? ' · Sleep till dawn' : '') },
    furnace: { name: 'Furnace', icon: '🔥', base: { stone: 15, wood: 8 }, desc: (l) => `Auto-smelts scrap · cooked food +${l * 15}%` },
    turret: { name: 'Turret', icon: '🎯', base: { wood: 10, scrap: 8 }, desc: (l) => `Auto-shoots · dmg ${8 + l * 4}` },
    walls: { name: 'Armor Plating', icon: '🛡️', base: { wood: 15, stone: 8 }, desc: (l) => `Caravan HP +${l * 60} · less damage` },
    engine: { name: 'Engine', icon: '⚙️', base: { scrap: 10, wood: 10 }, desc: (l) => `Faster travel · −${(l - 1) * 10}% fuel` },
    garden: { name: 'Garden', icon: '🌱', base: { wood: 8, food: 6 }, desc: (l) => `Grows food · +1 per ${Math.max(4, 14 - l * 2)}s` },
    lantern: { name: 'Lantern', icon: '🏮', base: { wood: 5, scrap: 3 }, desc: () => 'Night light · scares weak mobs' },
  };
  HC.MOD_ORDER = ['storage', 'workbench', 'bed', 'furnace', 'turret', 'walls', 'engine', 'garden', 'lantern'];
  HC.MOD_MAX = 5;
  HC.modCost = function (id, level) { // cost to reach `level`
    const m = HC.MODS[id], f = Math.pow(HC.PACE.modGrow, level - 1) * HC.PACE.mod * (level >= 5 ? 0.75 : 1), c = {};
    for (const k in m.base) c[k] = Math.max(1, Math.round(m.base[k] * f));
    if (level >= 3) c.metal = Math.round(5 * (level - 2) * (level >= 4 ? 1.3 : 1));
    return c;
  };

  // ---------- perks / xp ----------
  HC.xpFor = (l) => Math.round((40 + 22 * (l - 1) + 5 * (l - 1) * (l - 1)) * HC.PACE.xp);
  HC.PERKS = [
    { id: 'gather', name: 'Quick Hands', icon: '⚡', desc: '+15% gather speed' },
    { id: 'hp', name: 'Tough Cookie', icon: '❤️', desc: '+20 max HP' },
    { id: 'move', name: 'Zoomies', icon: '👟', desc: '+8% move speed' },
    { id: 'dmg', name: 'Power Punch', icon: '💪', desc: '+15% damage' },
    { id: 'carry', name: 'Big Pockets', icon: '🎒', desc: '+25 carry space' },
    { id: 'turret', name: 'Turret Tuning', icon: '🎯', desc: '+20% turret damage' },
    { id: 'crit', name: 'Lucky Strike', icon: '🍀', desc: '+6% crit chance' },
    { id: 'loot', name: 'Treasure Nose', icon: '💎', desc: '+12% loot & yield' },
    { id: 'hunger', name: 'Iron Tummy', icon: '🍖', desc: 'Hunger drains 15% slower' },
    { id: 'xp', name: 'Quick Learner', icon: '📚', desc: '+10% XP' },
  ];

  // ---------- cosmetics ----------
  HC.PAINTS = [
    { id: 'classic', name: 'Classic Tan', c1: '#c98f4e', c2: '#a9703a', trim: '#f3d9a0', unlock: 'Starter' },
    { id: 'mint', name: 'Minty Fresh', c1: '#5cc9a7', c2: '#3ba38a', trim: '#d6fff0', unlock: 'Reach level 5', lvl: 5 },
    { id: 'boar', name: 'Boar King Pink', c1: '#e8789c', c2: '#c4527a', trim: '#ffd6e4', unlock: 'Defeat the Boar King', boss: 'boar' },
    { id: 'frost', name: 'Frosty Blue', c1: '#7cc4f0', c2: '#4f9cd0', trim: '#eaf8ff', unlock: 'Visit Frost Peaks', zone: 'frost' },
    { id: 'warlord', name: 'Warlord Red', c1: '#c8453f', c2: '#8f2b2b', trim: '#ffcf8a', unlock: 'Defeat the Warlord', boss: 'warlord' },
    { id: 'golem', name: 'Lava Orange', c1: '#ff8a2a', c2: '#c9501a', trim: '#ffe08a', unlock: 'Defeat the Ember Golem', boss: 'golem' },
    { id: 'grape', name: 'Grape Soda', c1: '#9a6bff', c2: '#6f45d0', trim: '#e6d8ff', unlock: 'Reach Distance 8', dist: 8 },
    { id: 'sunset', name: 'Sunset', c1: '#ff7a5a', c2: '#d04a6a', trim: '#ffe0a0', unlock: 'Reach Distance 10', dist: 10 },
    { id: 'gold', name: 'Golden Road', c1: '#ffd24a', c2: '#d9a21f', trim: '#fff3b0', unlock: 'Reach Distance 13', dist: 13 },
    { id: 'night', name: 'Midnight', c1: '#4a4f9a', c2: '#2c2f6a', trim: '#b8c0ff', unlock: 'Reach Distance 16', dist: 16 },
    { id: 'rainbow', name: 'Rainbow!', c1: '#ff6aa8', c2: '#6a8aff', trim: '#ffffff', rainbow: true, unlock: 'Reach Distance 20', dist: 20 },
  ];
  HC.FLAGS = [
    { id: 'none', name: 'No flag', c: null, unlock: 'Starter' },
    { id: 'red', name: 'Red Pennant', c: '#ef5b5b', unlock: 'Reach level 2', lvl: 2 },
    { id: 'blue', name: 'Blue Pennant', c: '#4f9cf0', unlock: 'Reach level 4', lvl: 4 },
    { id: 'star', name: 'Star Flag', c: '#ffd24a', shape: 'star', unlock: 'Reach level 6', lvl: 6 },
    { id: 'heart', name: 'Heart Flag', c: '#ff6aa8', shape: 'heart', unlock: 'Reach level 8', lvl: 8 },
    { id: 'green', name: 'Leafy Flag', c: '#5cc255', unlock: 'Reach level 10', lvl: 10 },
    { id: 'rainbow', name: 'Rainbow Flag', c: '#ff9a3c', shape: 'rainbow', unlock: 'Reach level 15', lvl: 15 },
  ];

  // ---------- mobs ----------
  // kind: critter | melee | ranged | boss
  HC.MOBS = {
    bunny: { name: 'Bunny', kind: 'critter', hp: 8, spd: 80, r: 9, dmg: 0, xp: 3, loot: [['food', 1, 2, 1]] },
    snortle: { name: 'Snortle', kind: 'critter', hp: 26, spd: 70, r: 13, dmg: 6, xp: 6, charge: true, loot: [['food', 2, 3, 1]] },
    slime: { name: 'Slime', kind: 'melee', hp: 18, spd: 48, r: 12, dmg: 5, xp: 6, aggro: 170, weak: true, loot: [['wood', 1, 2, 0.5], ['stone', 1, 2, 0.4]] },
    howler: { name: 'Howler', kind: 'melee', hp: 24, spd: 88, r: 13, dmg: 8, xp: 9, aggro: 220, weak: true, loot: [['food', 1, 2, 0.8]] },
    raider: { name: 'Raider', kind: 'melee', hp: 30, spd: 66, r: 12, dmg: 7, xp: 12, aggro: 200, raid: true, loot: [['scrap', 2, 4, 0.9], ['wood', 1, 3, 0.5]] },
    sling: { name: 'Slinger', kind: 'ranged', hp: 22, spd: 60, r: 12, dmg: 6, xp: 14, aggro: 260, raid: true, range: 190, cd: 2.2, loot: [['scrap', 2, 4, 0.9], ['stone', 1, 2, 0.5]] },
    scrapbot: { name: 'Scrap Bot', kind: 'melee', hp: 42, spd: 55, r: 14, dmg: 9, xp: 16, aggro: 200, loot: [['scrap', 2, 5, 1], ['metal', 1, 2, 0.25]] },
    yeti: { name: 'Frost Yeti', kind: 'melee', hp: 72, spd: 52, r: 17, dmg: 13, xp: 22, aggro: 200, loot: [['food', 2, 4, 0.8], ['stone', 2, 3, 0.5]] },
    imp: { name: 'Ember Imp', kind: 'ranged', hp: 30, spd: 70, r: 11, dmg: 9, xp: 20, aggro: 260, range: 210, cd: 1.9, loot: [['scrap', 1, 3, 0.7], ['fuel', 1, 2, 0.6]], fire: true },
    boar: { name: 'Big Boar King', kind: 'boss', hp: 1100, spd: 78, r: 34, dmg: 20, xp: 300, boss: true },
    warlord: { name: 'Raider Warlord', kind: 'boss', hp: 2600, spd: 52, r: 40, dmg: 18, xp: 600, boss: true },
    golem: { name: 'Ember Golem', kind: 'boss', hp: 5600, spd: 44, r: 46, dmg: 26, xp: 1200, boss: true },
  };

  // ---------- quests ----------
  const Q = [];
  function q(t, a, n, text, ic, rew) { Q.push({ t, a, n, text, ic, rew: rew || {} }); }
  // --- Meadow: the hook (first goals come fast)
  q('gather', 'wood', 8, 'Chop 8 wood', '🌲', { res: { wood: 6 }, xp: 20 });
  q('gather', 'stone', 5, 'Mine 5 stone', '🪨', { res: { stone: 4, wood: 4 }, xp: 20 });
  q('craft', 'axe1', 1, 'Craft a Stone Axe', '🪓', { res: { wood: 8 }, xp: 30 });
  q('gather', 'food', 5, 'Pick 5 berries', '🍓', { res: { food: 3 }, xp: 25 });
  q('craft', 'pick1', 1, 'Craft a Stone Pick', '⛏️', { res: { stone: 6 }, xp: 30 });
  q('gather', 'wood', 20, 'Gather 20 more wood', '🌲', { res: { wood: 10, stone: 6 }, xp: 40 });
  q('build', 'workbench', 1, 'Build a Workbench module', '🔨', { res: { wood: 10, scrap: 4 }, xp: 70 });
  q('gather', 'scrap', 10, 'Salvage 10 scrap', '⚙️', { res: { scrap: 6 }, xp: 40 });
  q('craft', 'spear', 1, 'Craft a Spear', '🔱', { res: { food: 4 }, xp: 40 });
  q('kill', null, 5, 'Defeat 5 critters or slimes', '👊', { res: { food: 5, wood: 6 }, xp: 50 });
  q('build', 'storage', 1, 'Build a Storage module', '📦', { res: { wood: 12, stone: 8 }, xp: 70 });
  q('build', 'bed', 1, 'Build a Bed', '🛏️', { res: { food: 6, wood: 8 }, xp: 70 });
  q('gather', 'food', 20, 'Pick 20 berries for the pantry', '🍓', { res: { food: 8, wood: 10 }, xp: 60 });
  q('kill', null, 12, 'Defeat 12 meadow critters or slimes', '👊', { res: { food: 6, scrap: 6 }, xp: 70 });
  q('level', null, 4, 'Reach level 4', '⭐', { res: { stone: 12, scrap: 6 }, xp: 0 });
  q('night', null, 1, 'Survive your first night', '🌙', { res: { wood: 20, scrap: 10, food: 6 }, xp: 150 });
  q('build', 'lantern', 1, 'Build a Lantern', '🏮', { res: { scrap: 6 }, xp: 60 });
  q('chassis', null, 2, 'Expand the Chassis (Lv 2)', '🚚', { res: { wood: 20, scrap: 10 }, xp: 90 });
  q('build', 'furnace', 1, 'Build a Furnace', '🔥', { res: { stone: 10, scrap: 10 }, xp: 80 });
  q('gather', 'stone', 40, 'Mine 40 stone for the forge', '🪨', { res: { stone: 15, wood: 10 }, xp: 80 });
  q('craft', 'meal', 6, 'Cook 6 hot meals', '🍗', { res: { food: 6, wood: 10 }, xp: 70 });
  q('gather', 'scrap', 30, 'Salvage 30 scrap', '⚙️', { res: { scrap: 12, wood: 10 }, xp: 80 });
  q('craft', 'smelt', 6, 'Smelt 6 metal plates', '🔩', { res: { scrap: 8 }, xp: 80 });
  q('craft', 'axe2', 1, 'Craft a Metal Axe', '🪓', { res: { wood: 15, metal: 2 }, xp: 100 });
  q('craft', 'pick2', 1, 'Craft a Metal Pick', '⛏️', { res: { stone: 15, metal: 2 }, xp: 100 });
  q('craft', 'bow', 1, 'Craft a Bow', '🏹', { res: { wood: 12, scrap: 6 }, xp: 90 });
  q('build', 'turret', 1, 'Build a Turret', '🎯', { res: { scrap: 12, wood: 10 }, xp: 110 });
  q('craft', 'armor1', 1, 'Craft Scrap Armor', '🦺', { res: { food: 8, scrap: 8 }, xp: 100 });
  q('chest', null, 2, 'Open 2 treasure chests', '🎁', { res: { scrap: 15, wood: 15, fuel: 4 }, xp: 120 });
  q('chassis', null, 3, 'Expand the Chassis (Lv 3)', '🚚', { res: { wood: 25, scrap: 15, metal: 3 }, xp: 140 });
  q('build', 'engine', 1, 'Build an Engine', '⚙️', { res: { scrap: 10, wood: 15 }, xp: 120 });
  q('craft', 'fuel', 3, 'Brew 3 batches of fuel', '⛽', { res: { wood: 15, scrap: 6 }, xp: 80 });
  q('night', null, 1, 'Survive a second night', '🌙', { res: { wood: 25, scrap: 15, food: 10 }, xp: 200 });
  // --- Pine Forest
  q('travel', 'pine', 1, 'Travel to the Pine Forest', '🌲', { res: { wood: 25, food: 8 }, xp: 200 });
  q('kill', null, 20, 'Defeat 20 forest critters', '👊', { res: { food: 10, scrap: 8 }, xp: 120 });
  q('gather', 'wood', 70, 'Chop 70 pine logs', '🪵', { res: { wood: 25, stone: 10 }, xp: 130 });
  q('upg', 'workbench', 2, 'Upgrade Workbench to Lv 2', '🔨', { res: { metal: 6, scrap: 10 }, xp: 160, bp: ['bp_crossbow', 'bp_bomb'] });
  q('craft', 'crossbow', 1, 'Craft a Crossbow', '🎯', { res: { metal: 6, wood: 12 }, xp: 180 });
  q('raid', null, 8, 'Defend the caravan: defeat 8 night raiders', '🛡️', { res: { scrap: 20, metal: 6, food: 10 }, xp: 220 });
  q('upg', 'turret', 2, 'Upgrade the Turret to Lv 2', '🎯', { res: { scrap: 15, metal: 4 }, xp: 140 });
  q('build', 'garden', 1, 'Build a Garden', '🌱', { res: { wood: 15, food: 8 }, xp: 120 });
  q('upg', 'storage', 2, 'Upgrade Storage to Lv 2', '📦', { res: { wood: 25, stone: 20 }, xp: 130 });
  q('upg', 'bed', 2, 'Upgrade the Bed to Lv 2', '🛏️', { res: { food: 10, wood: 20 }, xp: 120 });
  q('upg', 'engine', 2, 'Upgrade the Engine to Lv 2', '⚙️', { res: { scrap: 20, fuel: 6 }, xp: 160 });
  q('craft', 'meal', 12, 'Cook 12 hot meals', '🍗', { res: { food: 10, metal: 3 }, xp: 120 });
  // --- Rocky Badlands + Boar King
  q('travel', 'badlands', 1, 'Travel to the Rocky Badlands', '🏜️', { res: { stone: 30, scrap: 15 }, xp: 260 });
  q('gather', 'stone', 100, 'Mine 100 badlands stone', '🪨', { res: { stone: 25, metal: 4 }, xp: 170 });
  q('upg', 'furnace', 2, 'Upgrade the Furnace to Lv 2', '🔥', { res: { stone: 25, metal: 4 }, xp: 150 });
  q('craft', 'bomb', 3, 'Craft 3 Bombs', '💣', { res: { scrap: 15, stone: 10 }, xp: 150 });
  q('kill', null, 40, 'Clear out 40 badlands raiders', '👊', { res: { food: 12, scrap: 15, metal: 4 }, xp: 180 });
  q('boss', 'boar', 1, 'Defeat the Big Boar King!', '🐗', { res: { food: 25, scrap: 30, metal: 8 }, xp: 600, bp: ['bp_medkit'], paint: 'boar' });
  q('craft', 'medkit', 1, 'Craft a Medkit', '🧰', { res: { food: 10, metal: 4 }, xp: 150 });
  q('night', null, 1, 'Survive a night in the Badlands', '🌙', { res: { metal: 8, scrap: 25, food: 15 }, xp: 260 });
  q('craft', 'axe3', 1, 'Craft a Steel Axe', '🪓', { res: { wood: 25, metal: 6 }, xp: 180 });
  q('build', 'walls', 1, 'Build Armor Plating', '🛡️', { res: { wood: 20, stone: 15 }, xp: 140 });
  q('kill', null, 60, 'Defeat 60 badlands mobs', '👊', { res: { food: 15, scrap: 20, metal: 6 }, xp: 200 });
  q('upg', 'engine', 3, 'Upgrade the Engine to Lv 3', '⚙️', { res: { scrap: 25, fuel: 10 }, xp: 200 });
  q('upg', 'garden', 2, 'Upgrade the Garden to Lv 2', '🌱', { res: { wood: 30, food: 15 }, xp: 180 });
  q('gather', 'food', 40, 'Forage 40 food for the road', '🍓', { res: { food: 20, wood: 20 }, xp: 200 });
  q('upg', 'furnace', 3, 'Upgrade the Furnace to Lv 3', '🔥', { res: { stone: 30, metal: 8 }, xp: 260 });
  q('chest', null, 3, 'Open 3 treasure chests', '🎁', { res: { scrap: 25, metal: 8, fuel: 8 }, xp: 200 });
  q('travel', 'pine', 1, 'Drive back to the Pine Forest for timber', '🌲', { res: { wood: 40, fuel: 6 }, xp: 200 });
  q('gather', 'wood', 300, 'Stock up: chop 300 pine logs', '🪵', { res: { wood: 30, metal: 6 }, xp: 220 });
  q('kill', null, 50, 'Defeat 50 forest raiders and howlers', '👊', { res: { food: 15, scrap: 20, metal: 6 }, xp: 220 });
  q('night', null, 1, 'Survive a night in the Pine Forest', '🌙', { res: { metal: 8, scrap: 25, food: 15 }, xp: 240 });
  q('craft', 'meal', 12, 'Cook 12 hot meals for the road', '🍲', { res: { food: 12, metal: 4 }, xp: 200 });
  q('upg', 'walls', 2, 'Upgrade Armor Plating to Lv 2', '🛡️', { res: { wood: 30, stone: 25, metal: 4 }, xp: 200 });
  // --- Scrap Wastes + Warlord
  q('travel', 'scrap', 1, 'Travel to the Scrap Wastes', '⚙️', { res: { scrap: 40, wood: 20 }, xp: 300 });
  q('gather', 'scrap', 250, 'Salvage 250 wasteland scrap', '⚙️', { res: { scrap: 40, metal: 8 }, xp: 240 });
  q('upg', 'workbench', 3, 'Upgrade Workbench to Lv 3', '🔨', { res: { metal: 10, scrap: 20 }, xp: 240, bp: ['bp_blaster'] });
  q('craft', 'blaster', 1, 'Craft a Blaster', '🔫', { res: { metal: 8, fuel: 4 }, xp: 260 });
  q('gather', 'stone', 90, 'Mine 90 wasteland stone', '🪨', { res: { stone: 40, metal: 8 }, xp: 240 });
  q('night', null, 1, 'Survive a night in the Wastes', '🌙', { res: { metal: 10, scrap: 30, food: 15 }, xp: 300 });
  q('chest', null, 3, 'Open 3 more treasure chests', '🎁', { res: { metal: 10, fuel: 8, scrap: 25 }, xp: 240 });
  q('kill', null, 60, 'Defeat 60 wasteland mobs', '👊', { res: { food: 20, scrap: 30, metal: 8 }, xp: 260 });
  q('raid', null, 16, 'Hold the line: defeat 16 night raiders', '🛡️', { res: { scrap: 30, metal: 10, food: 15 }, xp: 300 });
  q('upg', 'turret', 3, 'Upgrade the Turret to Lv 3', '🎯', { res: { scrap: 25, metal: 8 }, xp: 220 });
  q('craft', 'armor2', 1, 'Craft Steel Plate Armor', '🛡️', { res: { metal: 8, food: 15 }, xp: 240 });
  q('upg', 'walls', 3, 'Upgrade Armor Plating to Lv 3', '🛡️', { res: { metal: 12, stone: 25 }, xp: 260 });
  q('gather', 'food', 40, 'Forage 40 food in the wastes', '🍓', { res: { food: 20, scrap: 20 }, xp: 260 });
  q('upg', 'storage', 3, 'Upgrade Storage to Lv 3', '📦', { res: { wood: 40, stone: 40, metal: 6 }, xp: 300 });
  q('kill', null, 50, 'Scrap-bot sweep: defeat 50 mobs', '👊', { res: { food: 15, scrap: 30, metal: 8 }, xp: 280 });
  q('night', null, 1, 'Survive another night in the Wastes', '🌙', { res: { metal: 12, scrap: 30, food: 15 }, xp: 320 });
  q('upg', 'bed', 3, 'Upgrade the Bed to Lv 3', '🛏️', { res: { food: 20, wood: 30 }, xp: 240 });
  q('kill', null, 40, 'Scavenger sweep: defeat 40 raiders', '👊', { res: { food: 15, scrap: 30, metal: 8 }, xp: 280 });
  q('boss', 'warlord', 1, 'Defeat the Raider Warlord!', '🚛', { res: { scrap: 60, metal: 20, wood: 30 }, xp: 1100, bp: ['bp_power'], paint: 'warlord' });
  // --- After the Warlord: frost and the long road to the volcano
  q('craft', 'axe4', 1, 'Craft a Power Axe', '🪓', { res: { metal: 10, scrap: 20 }, xp: 300 });
  q('craft', 'meal', 20, 'Cook 20 hot meals', '🍲', { res: { food: 15, metal: 6 }, xp: 220 });
  q('upg', 'engine', 4, 'Upgrade the Engine to Lv 4', '⚙️', { res: { scrap: 40, fuel: 14 }, xp: 300 });
  q('upg', 'lantern', 2, 'Upgrade the Lantern to Lv 2', '🏮', { res: { scrap: 30, wood: 30 }, xp: 240 });
  q('upg', 'bed', 4, 'Upgrade the Bed to Lv 4', '🛏️', { res: { food: 30, wood: 50, metal: 8 }, xp: 300 });
  q('travel', 'frost', 1, 'Travel to the Frost Peaks', '❄️', { res: { food: 25, metal: 12 }, xp: 450 });
  q('kill', null, 70, 'Defeat 70 frost mobs', '👊', { res: { food: 20, scrap: 30, metal: 10 }, xp: 320 });
  q('gather', 'wood', 200, 'Chop 200 frostpine logs', '🪵', { res: { wood: 50, metal: 8 }, xp: 300 });
  q('night', null, 1, 'Survive a night in the Frost Peaks', '🌙', { res: { metal: 15, scrap: 30, food: 20 }, xp: 400 });
  q('chassis', null, 4, 'Expand the Chassis (Lv 4)', '🚚', { res: { wood: 50, scrap: 40, metal: 10 }, xp: 380 });
  q('gather', 'stone', 100, 'Mine 100 frostrock', '🪨', { res: { stone: 40, metal: 10 }, xp: 300 });
  q('craft', 'medkit', 5, 'Stock 5 Medkits', '🧰', { res: { food: 20, metal: 8 }, xp: 300 });
  q('craft', 'pick4', 1, 'Craft a Power Pick', '⛏️', { res: { metal: 12, scrap: 25 }, xp: 320 });
  q('night', null, 1, 'Survive another night in the Frost Peaks', '🌙', { res: { metal: 16, scrap: 35, food: 25 }, xp: 360 });
  q('upg', 'garden', 3, 'Upgrade the Garden to Lv 3', '🌱', { res: { wood: 40, food: 25 }, xp: 300 });
  q('kill', null, 60, 'Yeti hunt: defeat 60 frost mobs', '👊', { res: { food: 25, scrap: 35, metal: 12 }, xp: 340 });
  q('chest', null, 4, 'Open 4 treasure chests', '🎁', { res: { metal: 15, fuel: 12, scrap: 35 }, xp: 380 });
  q('raid', null, 14, 'Survive the siege: defeat 14 night raiders', '🛡️', { res: { scrap: 40, metal: 14, food: 20 }, xp: 450 });
  q('upg', 'workbench', 4, 'Upgrade Workbench to Lv 4', '🔨', { res: { metal: 15, scrap: 30 }, xp: 380 });
  q('raid', null, 12, 'Hold the frost line: defeat 12 night raiders', '🛡️', { res: { scrap: 40, metal: 14, food: 20 }, xp: 400 });
  q('gather', 'food', 50, 'Forage 50 food for the long haul', '🍓', { res: { food: 30, wood: 30 }, xp: 300 });
  q('upg', 'engine', 5, 'Upgrade the Engine to Lv 5', '⚙️', { res: { scrap: 60, fuel: 20 }, xp: 450 });
  q('travel', 'badlands', 1, 'Drive back to the Badlands for rare stone', '🏜️', { res: { stone: 60, metal: 12 }, xp: 300 });
  q('gather', 'stone', 120, 'Mine 120 badlands stone', '🪨', { res: { stone: 40, metal: 12 }, xp: 320 });
  q('upg', 'storage', 4, 'Upgrade Storage to Lv 4', '📦', { res: { wood: 60, stone: 60, metal: 10 }, xp: 380 });
  q('upg', 'bed', 5, 'Upgrade the Bed to Lv 5', '🛏️', { res: { food: 40, wood: 80, metal: 12 }, xp: 400 });
  q('travel', 'ember', 1, 'Travel to the Ember Volcano', '🌋', { res: { metal: 20, fuel: 15 }, xp: 600 });
  q('chest', null, 3, 'Open 3 volcano chests', '🎁', { res: { metal: 18, fuel: 14, scrap: 40 }, xp: 420 });
  q('craft', 'bomb', 8, 'Craft 8 Bombs for the golem', '💣', { res: { scrap: 40, stone: 30 }, xp: 380 });
  q('craft', 'armor3', 1, 'Craft Power Armor', '🤖', { res: { metal: 12, food: 25 }, xp: 450 });
  q('gather', 'stone', 100, 'Mine 100 volcanic rock', '🪨', { res: { stone: 50, metal: 14 }, xp: 400 });
  q('upg', 'lantern', 3, 'Upgrade the Lantern to Lv 3', '🏮', { res: { scrap: 50, wood: 50, metal: 8 }, xp: 380 });
  q('gather', 'scrap', 250, 'Salvage 250 volcano scrap', '⚙️', { res: { scrap: 60, metal: 20 }, xp: 450 });
  q('upg', 'walls', 4, 'Upgrade Armor Plating to Lv 4', '🛡️', { res: { metal: 20, stone: 40 }, xp: 420 });
  q('upg', 'lantern', 4, 'Upgrade the Lantern to Lv 4', '🏮', { res: { scrap: 60, wood: 60, metal: 10 }, xp: 420 });
  q('travel', 'scrap', 1, 'Drive back to the Scrap Wastes for salvage', '⚙️', { res: { scrap: 60, fuel: 10 }, xp: 340 });
  q('gather', 'scrap', 300, 'Salvage 300 more wasteland scrap', '⚙️', { res: { scrap: 60, metal: 20 }, xp: 440 });
  q('travel', 'ember', 1, 'Return to the Ember Volcano', '🌋', { res: { metal: 20, fuel: 15 }, xp: 380 });
  q('night', null, 1, 'Survive a night at the volcano', '🌙', { res: { metal: 20, scrap: 40, food: 25 }, xp: 450 });
  q('upg', 'garden', 4, 'Upgrade the Garden to Lv 4', '🌱', { res: { wood: 60, food: 40, metal: 10 }, xp: 420 });
  q('upg', 'garden', 5, 'Upgrade the Garden to Lv 5', '🌱', { res: { wood: 80, food: 60, metal: 12 }, xp: 440 });
  q('kill', null, 60, 'Imp patrol: defeat 60 volcano mobs', '👊', { res: { food: 25, scrap: 40, metal: 14 }, xp: 440 });
  q('raid', null, 16, 'Defend the caravan: defeat 16 night raiders', '🛡️', { res: { scrap: 50, metal: 20, food: 25 }, xp: 500 });
  q('upg', 'turret', 4, 'Upgrade the Turret to Lv 4', '🎯', { res: { scrap: 50, metal: 12 }, xp: 420 });
  q('raid', null, 14, 'Last stand: defeat 14 night raiders', '🛡️', { res: { scrap: 50, metal: 20, food: 25 }, xp: 520 });
  q('chest', null, 3, 'Open 3 more volcano chests', '🎁', { res: { metal: 20, fuel: 15, scrap: 45 }, xp: 460 });
  q('night', null, 1, 'Survive a second night at the volcano', '🌙', { res: { metal: 20, scrap: 40, food: 25 }, xp: 460 });
  q('upg', 'furnace', 4, 'Upgrade the Furnace to Lv 4', '🔥', { res: { stone: 50, metal: 12 }, xp: 420 });
  q('upg', 'furnace', 5, 'Upgrade the Furnace to Lv 5', '🔥', { res: { stone: 70, metal: 16 }, xp: 480 });
  q('upg', 'walls', 5, 'Upgrade Armor Plating to Lv 5', '🛡️', { res: { metal: 25, stone: 60 }, xp: 480 });
  q('gather', 'food', 50, 'Forage 50 food for the final push', '🍓', { res: { food: 30, wood: 30 }, xp: 380 });
  q('upg', 'workbench', 5, 'Upgrade Workbench to Lv 5', '🔨', { res: { metal: 25, scrap: 50 }, xp: 480 });
  q('upg', 'storage', 5, 'Upgrade Storage to Lv 5', '📦', { res: { wood: 100, stone: 80, metal: 15 }, xp: 480 });
  q('upg', 'turret', 5, 'Upgrade the Turret to Lv 5', '🎯', { res: { scrap: 70, metal: 20 }, xp: 500 });
  q('kill', null, 70, 'Defeat 70 volcano mobs', '👊', { res: { food: 25, scrap: 40, metal: 14 }, xp: 450 });
  q('boss', 'golem', 1, 'Defeat the Ember Golem!', '🗿', { res: { metal: 60, scrap: 80, food: 40 }, xp: 3000, paint: 'golem' });
  HC.QUESTS = Q;

  // endless quests: generated lazily from templates once the chain is done
  HC.makeEndlessQuest = function (k, S) {
    const sc = 1 + 0.15 * k, r = k % 5;
    const rr = (o) => { const x = {}; for (const key in o) x[key] = Math.round(o[key] * sc); return x; };
    if (r === 0) {
      const d = S.maxDist + 1;
      return { t: 'dist', a: null, n: d, text: `Reach Distance ${d}`, ic: '🛣️', rew: { res: rr({ metal: 12, scrap: 30, fuel: 8 }), xp: Math.round(400 * sc) } };
    }
    if (r === 1) {
      const res = ['wood', 'stone', 'scrap'][k % 3], n = 40 + 6 * Math.min(k, 12);
      return { t: 'gather', a: res, n, text: `Gather ${n} ${res}`, ic: '🧺', rew: { res: rr({ metal: 8, food: 15 }), xp: Math.round(250 * sc) } };
    }
    if (r === 2) {
      const n = 15 + 2 * Math.min(k, 12);
      return { t: 'kill', a: null, n, text: `Defeat ${n} mobs`, ic: '👊', rew: { res: rr({ scrap: 25, metal: 8 }), xp: Math.round(300 * sc) } };
    }
    if (r === 3) {
      return { t: 'night', a: null, n: 1, text: 'Survive another night', ic: '🌙', rew: { res: rr({ metal: 10, food: 20, wood: 30 }), xp: Math.round(350 * sc) } };
    }
    return { t: 'chest', a: null, n: 2, text: 'Open 2 treasure chests', ic: '🎁', rew: { res: rr({ metal: 10, fuel: 10, scrap: 20 }), xp: Math.round(300 * sc) } };
  };

  // ---------- achievements (3 stars each) ----------
  HC.ACH = [
    { id: 'gather', name: 'Gatherer', icon: '🧺', steps: [50, 300, 1500], get: (S) => S.stats.gathered, text: (n) => `Gather ${n} resources` },
    { id: 'kills', name: 'Poofmaster', icon: '💨', steps: [10, 60, 250], get: (S) => S.stats.kills, text: (n) => `Poof ${n} mobs` },
    { id: 'nights', name: 'Night Owl', icon: '🌙', steps: [1, 5, 15], get: (S) => S.stats.nights, text: (n) => `Survive ${n} nights` },
    { id: 'built', name: 'Builder', icon: '🔨', steps: [3, 10, 25], get: (S) => S.stats.built, text: (n) => `Build or upgrade ${n} modules` },
    { id: 'crafted', name: 'Crafty', icon: '🛠️', steps: [3, 12, 30], get: (S) => S.stats.crafted, text: (n) => `Craft ${n} items` },
    { id: 'level', name: 'Level Up!', icon: '⭐', steps: [5, 12, 25], get: (S) => S.lvl, text: (n) => `Reach level ${n}` },
    { id: 'travel', name: 'Road Tripper', icon: '🗺️', steps: [1, 5, 15], get: (S) => S.stats.travels, text: (n) => `Travel ${n} times` },
    { id: 'dist', name: 'Far Out', icon: '🛣️', steps: [3, 6, 12], get: (S) => S.maxDist, text: (n) => `Reach Distance ${n}` },
    { id: 'bosses', name: 'Boss Buster', icon: '👑', steps: [1, 2, 3], get: (S) => S.stats.bosses, text: (n) => `Defeat ${n} bosses` },
    { id: 'chests', name: 'Treasure Hunter', icon: '🎁', steps: [1, 6, 20], get: (S) => S.stats.chests, text: (n) => `Open ${n} chests` },
    { id: 'combo', name: 'Combo King', icon: '🔥', steps: [3, 6, 12], get: (S) => S.stats.bestCombo, text: (n) => `Reach a x${n} combo` },
  ];

  HC.DAY_LEN = 120;
  HC.NIGHT_LEN = 60;
  HC.CYCLE = 180;
  HC.WORLD = 3072;
})();
