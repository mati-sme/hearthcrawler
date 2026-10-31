(function () {
  'use strict';
  const HC = window.HC, S0 = () => HC.S;
  const Q = HC.QUESTS;
  const BOSS_ZONE = { boar: 'badlands', warlord: 'scrap', golem: 'ember' };
  let cool = 0;

  HC.curQuest = function () {
    const S = S0();
    if (S.q.i < Q.length) return Q[S.q.i];
    if (!S.q.dyn) S.q.dyn = HC.makeEndlessQuest(S.q.i - Q.length, S);
    return S.q.dyn;
  };
  HC.questIndex = () => S0().q.i;

  HC.questProgress = function (q) {
    const S = S0();
    switch (q.t) {
      case 'build': return HC.modLevel(q.a) > 0 ? 1 : 0;
      case 'upg': return Math.min(q.n, HC.modLevel(q.a));
      case 'chassis': return Math.min(q.n, S.grid.chassis);
      case 'level': return Math.min(q.n, S.lvl);
      case 'dist': return Math.min(q.n, S.maxDist);
      case 'travel': return S.q.p > 0 || S.zone.id === q.a ? 1 : 0;
      case 'craft': { // gear you already own counts, so crafting ahead of a goal never gets you stuck
        const r = HC.REC[q.a];
        return r && r.kind !== 'item' && r.kind !== 'mat' && S.inv.owned[q.a] ? q.n : Math.min(q.n, S.q.p);
      }
      default: return Math.min(q.n, S.q.p);
    }
  };

  function ev(type, match, n) {
    const S = S0(), q = HC.curQuest();
    if (q.t !== type) return;
    if (match !== undefined && q.a !== match) return;
    S.q.p += n;
  }
  HC.on('gather', (d) => ev('gather', d.res, d.n));
  HC.on('kill', () => ev('kill', undefined, 1));
  HC.on('craft', (d) => ev('craft', d.id, d.n));
  HC.on('night', () => ev('night', undefined, 1));
  HC.on('chest', () => ev('chest', undefined, 1));
  HC.on('travel', (d) => ev('travel', d.zone, 1));
  HC.on('boss', (d) => ev('boss', d.id, 1));

  HC.giveReward = function (rew) {
    const S = S0();
    if (rew.res) for (const r in rew.res) HC.addStore(r, rew.res[r]);
    if (rew.xp) HC.addXP(rew.xp, true);
    if (rew.bp) rew.bp.forEach((b) => { S.inv.bp[b] = true; });
    if (rew.paint) { S.paints[rew.paint] = true; S.paint = rew.paint; }
  };

  HC.checkQuest = function () {
    if (cool > 0) { cool -= 0.25; return; }
    const S = S0(), q = HC.curQuest();
    if (HC.questProgress(q) < q.n) return;
    HC.giveReward(q.rew);
    HC.ui && HC.ui.goalDone(q);
    S.q.i++; S.q.p = 0; S.q.dyn = null;
    cool = 1.0;
    HC.saveNow();
    HC.emit('questdone', { i: S.q.i });
  };

  // ---------- XP / levels / perks ----------
  HC.addXP = function (n, quiet) {
    const S = S0();
    n *= 1 + 0.1 * HC.perk('xp');
    S.xp += n;
    let up = false;
    while (S.xp >= HC.xpFor(S.lvl)) {
      S.xp -= HC.xpFor(S.lvl); S.lvl++; S.pendingPerks++; up = true;
    }
    if (up) {
      S.hp = HC.maxHP();
      HC.audio.play('levelup');
      HC.fx.confetti(70);
      HC.fx.sparkle(HC.R.P.x, HC.R.P.y, 24, 100);
      HC.fx.text(HC.R.P.x, HC.R.P.y - 40, 'LEVEL UP! ' + S.lvl, '#ffd84a', 22);
      HC.banner('⭐ Level ' + S.lvl + '!', 'Pick a perk');
    }
  };
  HC.rollPerks = function () {
    const ids = HC.PERKS.map((p) => p.id), out = [];
    while (out.length < 3 && ids.length) out.push(ids.splice(Math.floor(Math.random() * ids.length), 1)[0]);
    return out.map((id) => HC.PERKS.find((p) => p.id === id));
  };
  HC.pickPerk = function (id) {
    const S = S0();
    if (S.pendingPerks <= 0) return;
    S.perks[id] = (S.perks[id] || 0) + 1; S.pendingPerks--;
    if (id === 'hp') S.hp = HC.maxHP();
    HC.audio.play('star');
    HC.saveNow();
  };

  // ---------- achievements & unlocks ----------
  HC.achStars = function (a) {
    const v = a.get(S0()); let s = 0;
    for (let i = 0; i < 3; i++) if (v >= a.steps[i]) s = i + 1;
    return s;
  };
  HC.checkAch = function () {
    const S = S0();
    HC.ACH.forEach((a) => {
      const s = HC.achStars(a);
      if ((S.ach[a.id] || 0) < s) {
        S.ach[a.id] = s;
        HC.toast('🏆 ' + a.name + ' ' + '★'.repeat(s) + '☆'.repeat(3 - s));
        HC.audio.play('star');
        HC.addXP(30 * s, true);
      }
    });
    HC.PAINTS.forEach((p) => {
      if (S.paints[p.id]) return;
      let ok = false;
      if (p.lvl && S.lvl >= p.lvl) ok = true;
      if (p.boss && S.bossDown[BOSS_ZONE[p.boss]]) ok = true;
      if (p.zone && S.visited[p.zone]) ok = true;
      if (p.dist && S.maxDist >= p.dist) ok = true;
      if (ok) { S.paints[p.id] = true; HC.toast('🎨 New paint: ' + p.name); HC.audio.play('star'); }
    });
    HC.FLAGS.forEach((f) => {
      if (S.flags[f.id]) return;
      if (f.lvl && S.lvl >= f.lvl) { S.flags[f.id] = true; HC.toast('🚩 New flag: ' + f.name); HC.audio.play('star'); }
    });
  };

  // ---------- hints & guide arrow ----------
  const costText = (m) => Object.keys(m).map((k) => m[k] + ' ' + HC.RES_INFO[k].name.toLowerCase()).join(', ');
  function needHint(cost, extra) {
    const m = HC.missing(cost);
    if (!m) return extra;
    const k = Object.keys(m)[0];
    return `Need ${costText(m)} → ${HC.RES_INFO[k].src.toLowerCase()}`;
  }
  HC.questHint = function (q) {
    const S = S0();
    switch (q.t) {
      case 'gather': return { gather: 1, text: q.a === 'food' ? 'Walk next to berry bushes 🍓' : q.a === 'wood' ? 'Walk next to trees to chop' : q.a === 'stone' ? 'Walk next to rocks to mine' : 'Walk next to scrap piles' };
      case 'craft': {
        const r = HC.REC[q.a === 'smelt' ? 'smelt' : q.a], st = HC.recipeState(r);
        if (st.why === 'tier') return { text: 'Needs ' + HC.TIER_NAMES[r.tier] + ' — build it in the Caravan 🏠' };
        if (st.why === 'need') return { text: 'Build a Furnace in the Caravan 🏠' };
        if (st.why === 'bp') return { text: 'Blueprint missing — keep completing goals!' };
        return { text: needHint(r.cost, 'Open Craft 🛠 and tap ' + r.name) };
      }
      case 'build': return { text: needHint(HC.modCost(q.a, 1), 'Open Caravan 🏠 → tap an empty slot') };
      case 'upg': { const l = HC.modLevel(q.a); return { text: l ? needHint(HC.modCost(q.a, l + 1), 'Open Caravan 🏠 → tap the module → Upgrade') : 'Build it first in the Caravan 🏠' }; }
      case 'chassis': return { text: needHint(HC.chassisCost(S.grid.chassis), 'Open Caravan 🏠 → Chassis upgrade') };
      case 'travel': {
        const z = HC.ZONE[q.a], info = HC.travelInfo(q.a, z.dist);
        if (info.here) return { text: 'You are here!' };
        if (!info.engOk) return { text: `Engine Lv ${info.req} needed — upgrade it in the Caravan 🏠` };
        if (!info.fuelOk) return { text: `Need ${info.fuel} fuel — brew it in Craft 🛠 (wood + scrap)` };
        return { text: 'Open the Map 🗺 and tap Travel' };
      }
      case 'kill': return { kill: 1, text: 'Walk near critters & slimes — you auto-attack!' };
      case 'boss': return { boss: 1, text: 'Find the glowing lair — dodge the red circles!' };
      case 'night': return { text: HC.R.night ? 'Defend the caravan until sunrise ☀️' : 'Build turrets & lanterns before dusk 🌙' };
      case 'level': return { text: 'Gather, craft & fight for XP' };
      case 'chest': return { text: 'Look for 🎁 chests near the caravan' };
      case 'dist': return { text: 'Open the Map 🗺 → Far Roads → Travel' };
    }
    return { text: '' };
  };

  const tmpN = [];
  HC.questTarget = function () {
    const q = HC.curQuest(), h = HC.questHint(q), R = HC.R, P = R.P, W = HC.W;
    if (h.gather) {
      const type = { wood: 'tree', stone: 'rock', scrap: 'scrap', food: 'bush', metal: 'scrap', fuel: 'tree' }[q.a] || 'tree';
      let best = null, bd = 1e12; const ns = W.nodes;
      for (let i = 0; i < ns.length; i++) { const n = ns[i]; if (n.type !== type || !n.alive) continue; const d = (n.x - P.x) ** 2 + (n.y - P.y) ** 2; if (d < bd) { bd = d; best = n; } }
      if (best && bd > 90 * 90) return best;
      return null;
    }
    if (h.kill) {
      let best = null, bd = 1e12;
      for (let i = 0; i < R.mobs.length; i++) { const m = R.mobs[i]; if (!m.on || m.kind === 'boss') continue; const d = (m.x - P.x) ** 2 + (m.y - P.y) ** 2; if (d < bd) { bd = d; best = m; } }
      return best && bd > 160 * 160 ? best : null;
    }
    if (h.boss) return R.boss && R.boss.on ? null : W.lair;
    if (q.t === 'craft' || q.t === 'build' || q.t === 'upg' || q.t === 'chassis' || q.t === 'travel') {
      const G = HC.G, d = Math.hypot(P.x - W.cx, P.y - W.cy);
      if (d > 260) return { x: W.cx, y: W.cy };
    }
    return null;
  };
})();
