(function () {
  'use strict';
  const HC = window.HC;
  const KEY = 'hearthcrawler-save-v1';
  const SAVE_VERSION = 1;

  // ---------- tiny event bus ----------
  const handlers = {};
  HC.on = (n, f) => { (handlers[n] = handlers[n] || []).push(f); };
  HC.emit = (n, d) => { const h = handlers[n]; if (h) for (let i = 0; i < h.length; i++) h[i](d); };

  function zeroRes() { const o = {}; HC.RES.forEach((r) => (o[r] = 0)); return o; }

  HC.defaultState = function () {
    const slots = [];
    for (let i = 0; i < 12; i++) slots.push(null);
    return {
      v: SAVE_VERSION,
      res: Object.assign(zeroRes(), { wood: 0 }),
      carry: zeroRes(),
      inv: { owned: {}, bandage: 0, medkit: 0, bomb: 0, bp: {} },
      equip: { axe: null, pick: null, weapon: 'fist', armor: null },
      grid: { chassis: 1, slots },
      zone: { id: 'meadow', dist: 1 },
      maxDist: 1, farSel: 7,
      bossDown: {}, visited: { meadow: true },
      q: { i: 0, p: 0, dyn: null },
      xp: 0, lvl: 1, perks: {}, pendingPerks: 0,
      hp: 100, hunger: 100, cavHP: -1, damaged: false,
      t: 20, day: 1,
      paint: 'classic', flag: 'none', paints: { classic: true }, flags: { none: true },
      stats: { gathered: 0, kills: 0, nights: 0, built: 0, crafted: 0, travels: 0, bosses: 0, chests: 0, bestCombo: 0, deaths: 0 },
      ach: {},
      set: { sound: true, arrows: true, tutDone: false },
    };
  };

  HC.S = HC.defaultState();

  function merge(dst, src) { // shallow-deep merge of known keys only
    for (const k in dst) {
      if (!(k in src)) continue;
      const a = dst[k], b = src[k];
      if (a && typeof a === 'object' && !Array.isArray(a)) { if (b && typeof b === 'object') merge(a, b); }
      else if (Array.isArray(a)) { if (Array.isArray(b)) dst[k] = b; }
      else if (typeof a === typeof b || a === null) dst[k] = b;
    }
  }

  HC.loadSave = function () {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!d || typeof d !== 'object' || d.v > SAVE_VERSION) return false;
      const s = HC.defaultState();
      merge(s, d);
      if (d.q && d.q.dyn) s.q.dyn = d.q.dyn;
      if (d.equip) { s.equip.axe = d.equip.axe || null; s.equip.pick = d.equip.pick || null; s.equip.armor = d.equip.armor || null; s.equip.weapon = d.equip.weapon || 'fist'; }
      if (!Array.isArray(s.grid.slots) || s.grid.slots.length !== 12) throw new Error('bad grid');
      s.grid.slots = s.grid.slots.map((x) => (x && HC.MODS[x.m] ? { m: x.m, l: HC.clamp(x.l | 0, 1, HC.MOD_MAX) } : null));
      if (!HC.ZONE[s.zone.id]) s.zone = { id: 'meadow', dist: 1 };
      s.hp = HC.clamp(+s.hp || 100, 1, 9999);
      HC.S = s;
      return true;
    } catch (e) {
      HC.S = HC.defaultState();
      return false;
    }
  };

  HC.saveNow = function () {
    if (HC.noSave) return;
    try { localStorage.setItem(KEY, JSON.stringify(HC.S)); } catch (e) { /* storage full or blocked */ }
  };
  HC.resetSave = function () {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  };

  // ---------- perks & aggregates ----------
  HC.perk = (id) => HC.S.perks[id] || 0;

  HC.modLevel = function (id) { // highest level of module type (0 if none)
    let m = 0; const sl = HC.S.grid.slots;
    for (let i = 0; i < 12; i++) if (sl[i] && sl[i].m === id && sl[i].l > m) m = sl[i].l;
    return m;
  };
  HC.modSum = function (id) {
    let m = 0; const sl = HC.S.grid.slots;
    for (let i = 0; i < 12; i++) if (sl[i] && sl[i].m === id) m += sl[i].l;
    return m;
  };
  HC.modCount = function (id) {
    let m = 0; const sl = HC.S.grid.slots;
    for (let i = 0; i < 12; i++) if (sl[i] && sl[i].m === id) m++;
    return m;
  };
  // damaged caravan => modules work at half power
  HC.power = () => (HC.S.damaged ? 0.5 : 1);

  HC.maxHP = () => 100 + 20 * HC.perk('hp') + 4 * (HC.S.lvl - 1);
  HC.carryCap = () => 80 + 25 * HC.perk('carry');
  HC.carryCount = () => { let n = 0; const c = HC.S.carry; for (let i = 0; i < 6; i++) n += c[HC.RES[i]]; return n; };
  HC.storeCap = () => 100 + 100 * HC.modSum('storage');
  HC.cavMax = () => Math.round(150 + 20 * HC.S.grid.chassis + 60 * HC.modSum('walls'));
  HC.have = (r) => HC.S.res[r] + HC.S.carry[r];
  HC.canAfford = function (cost) { for (const k in cost) if (HC.have(k) < cost[k]) return false; return true; };
  HC.missing = function (cost) {
    const m = {}; let any = false;
    for (const k in cost) { const d = cost[k] - HC.have(k); if (d > 0) { m[k] = d; any = true; } }
    return any ? m : null;
  };
  HC.spend = function (cost) {
    if (!HC.canAfford(cost)) return false;
    for (const k in cost) {
      let n = cost[k];
      const c = Math.min(n, HC.S.carry[k]); HC.S.carry[k] -= c; n -= c;
      HC.S.res[k] -= n;
    }
    return true;
  };
  // add straight to the caravan store (rewards, crafting output) - never walls: allows overflow to 3x cap
  HC.addStore = function (r, n) {
    n = Math.round(n);
    if (n <= 0) return 0;
    const cap = HC.storeCap() * 3;
    const add = Math.max(0, Math.min(n, cap - HC.S.res[r]));
    HC.S.res[r] += add;
    return add;
  };
  // add to player's pockets; returns how many fit
  HC.addCarry = function (r, n) {
    const free = HC.carryCap() - HC.carryCount();
    const add = Math.max(0, Math.min(n, free));
    HC.S.carry[r] += add;
    return add;
  };
  HC.deposit = function () {
    let moved = 0, extra = 0; const S = HC.S, cap = HC.storeCap() * 3; // same overflow allowance as rewards
    for (let i = 0; i < 6; i++) {
      const r = HC.RES[i], c = S.carry[r];
      if (c <= 0) continue;
      const n = Math.min(c, Math.max(0, cap - S.res[r]));
      S.res[r] += n; moved += n;
      extra += c - n; S.carry[r] = 0; // a totally full store never blocks the bag: surplus becomes XP
    }
    if (extra > 0 && HC.addXP) HC.addXP(extra * 0.2, true);
    return moved + extra;
  };

  HC.equipBest = function () {
    const S = HC.S, o = S.inv.owned;
    const best = (pre) => { for (let i = 4; i >= 1; i--) if (o[pre + i]) return pre + i; return null; };
    S.equip.axe = best('axe');
    S.equip.pick = best('pick');
    let w = 'fist';
    const order = ['spear', 'bow', 'crossbow', 'blaster'];
    for (let i = 0; i < order.length; i++) if (o[order[i]]) w = order[i];
    S.equip.weapon = w;
    S.equip.armor = o.armor3 ? 'armor3' : o.armor2 ? 'armor2' : o.armor1 ? 'armor1' : null;
  };
})();
