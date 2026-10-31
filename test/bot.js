// Auto-play bot injected into the page by test/balance.mjs. Plays honestly through the public game API (no giveAll).
(function () {
  const HC = window.__HC.api, R = window.__HC.runtime, P = R.P;
  const S = () => HC.S, W = HC.W;
  const BOSS_ZONE = { boar: 'badlands', warlord: 'scrap', golem: 'ember' };
  const NODE_OF = { wood: 'tree', stone: 'rock', scrap: 'scrap', food: 'bush' };
  const PERK_ORDER = ['gather', 'dmg', 'hp', 'carry', 'move', 'loot', 'crit', 'xp', 'hunger', 'turret'];
  const TICK = 6;
  const bot = { steps: 0, goals: [], levels: [], bosses: [], zones: [], lastBossHp: 0, log: [], deaths: 0, status: '' };
  let lastQ = S().q.i, lastLvl = S().lvl, tick = 0, detour = 0, detourSign = 1, lastPos = { x: P.x, y: P.y }, stuckT = 0, dest = null;
  const t = () => bot.steps / 60;

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function go(x, y, stop) {
    const dx = x - P.x, dy = y - P.y, d = Math.hypot(dx, dy);
    if (d <= (stop || 8)) { HC.input.set(0, 0); return true; }
    let ang = Math.atan2(dy, dx);
    if (detour > 0) { ang += detourSign * 1.2; detour--; }
    HC.input.set(Math.cos(ang), Math.sin(ang));
    return false;
  }
  function stuckCheck() {
    if (tick % 15) return;
    const moved = dist(P, lastPos); lastPos = { x: P.x, y: P.y };
    if (HC.input.vec().x !== 0 || HC.input.vec().y !== 0) {
      if (moved < 12) { if (++stuckT >= 2) { detour = 25; detourSign = -detourSign; stuckT = 0; } } else stuckT = 0;
    }
  }
  function nearest(list, pred) {
    let best = null, bd = 1e12;
    for (let i = 0; i < list.length; i++) { const o = list[i]; if (!pred(o)) continue; const d = (o.x - P.x) ** 2 + (o.y - P.y) ** 2; if (d < bd) { bd = d; best = o; } }
    return best;
  }
  const cavC = () => ({ x: W.cx, y: (HC.G.y0 + HC.G.y1) / 2 });
  const cavDist = () => HC.cavDist(P.x, P.y);

  // ---- needs: expand a cost into raw gatherable demands (metal via smelting, fuel via brewing)
  function rawNeeds(cost) {
    const need = {};
    const add = (r, n) => { need[r] = (need[r] || 0) + n; };
    for (const k in cost) {
      let d = cost[k] - HC.have(k);
      if (d <= 0) continue;
      if (k === 'metal') add('scrap', 2 * d);
      else if (k === 'fuel') { const b = Math.ceil(d / 5); add('wood', 4 * b); add('scrap', 2 * b); }
      else add(k, d);
    }
    const out = {};
    for (const k in need) { const d = need[k] - (k === 'scrap' || k === 'wood' ? 0 : 0); if (d > 0) out[k] = d; }
    return out;
  }
  function targetCost(q) {
    const s = S();
    switch (q.t) {
      case 'craft': { const r = HC.REC[q.a]; return r ? r.cost : null; }
      case 'build': return HC.modCost(q.a, 1);
      case 'upg': { const l = HC.modLevel(q.a); return l ? HC.modCost(q.a, l + 1) : HC.modCost(q.a, 1); }
      case 'chassis': return HC.chassisCost(s.grid.chassis);
      case 'travel': { const z = HC.ZONE[q.a], i = HC.travelInfo(q.a, z.dist); return { fuel: i.fuel }; }
      case 'dist': { const i = HC.travelInfo('far', Math.max(7, S().maxDist + 1)); return { fuel: i.fuel }; }
    }
    return null;
  }

  function freeSlot() { const sl = S().grid.slots; for (let i = 0; i < 12; i++) if (HC.slotValid(i) && !sl[i]) return i; return -1; }
  function bestSlotOf(id) { let b = -1, bl = 0; S().grid.slots.forEach((x, i) => { if (x && x.m === id && x.l > bl) { bl = x.l; b = i; } }); return b; }
  function say(m) { bot.log.push(`[${(t() / 60).toFixed(1)}m] ${m}`); }

  function craftIfOk(id) { const r = HC.REC[id]; if (r && HC.recipeState(r).ok && HC.canAfford(r.cost)) { HC.craft(id); return true; } return false; }
  function afterSpendKeeps(cost, tcost) { // would buying `cost` still leave the current goal's target affordable (or already unaffordable anyway)?
    if (!tcost) return HC.canAfford(cost);
    const tot = Object.assign({}, tcost); for (const k in cost) tot[k] = (tot[k] || 0) + cost[k];
    return HC.canAfford(tot);
  }

  function manage() {
    const s = S(), q = HC.curQuest(), tc = targetCost(q);
    // perks
    while (s.pendingPerks > 0) {
      const id = PERK_ORDER.find((p) => (s.perks[p] || 0) < 3) || 'hp';
      HC.pickPerk(id);
    }
    if (HC.ui && HC.ui.paused && HC.ui.paused()) { try { HC.ui.close(); } catch (e) { /* ignore */ } }
    // goal-driven actions
    if (q.t === 'craft') {
      const r = HC.REC[q.a === 'smelt' ? 'smelt' : q.a];
      if (q.a === 'smelt') { if (!craftIfOk('smelt5') ) craftIfOk('smelt'); }
      else if (r) {
        const m = HC.missing(r.cost);
        if (!m) craftIfOk(r.id);
        else if (m.metal && HC.modLevel('furnace')) { if (!(m.metal >= 5 && craftIfOk('smelt5'))) craftIfOk('smelt'); }
        else if (m.fuel) craftIfOk('fuel');
      }
    } else if (q.t === 'build') {
      const sl = freeSlot();
      if (HC.modLevel(q.a)) return; // built, waiting for the goal check to register it
      if (sl >= 0 && HC.canAfford(HC.modCost(q.a, 1))) HC.buildMod(sl, q.a);
      else if (sl < 0) bot.status = 'no free slot for ' + q.a;
    } else if (q.t === 'upg') {
      const sl = bestSlotOf(q.a), l = HC.modLevel(q.a);
      if (sl >= 0 && l < q.n) { const c = HC.modCost(q.a, l + 1); if (HC.canAfford(c)) HC.upgradeMod(sl); else { const m = HC.missing(c); if (m && m.metal && HC.modLevel('furnace')) { if (!(m.metal >= 5 && craftIfOk('smelt5'))) craftIfOk('smelt'); } } }
    } else if (q.t === 'chassis') {
      if (s.grid.chassis >= q.n) return;
      if (HC.canAfford(HC.chassisCost(s.grid.chassis))) HC.upgradeChassis(); else { const m = HC.missing(HC.chassisCost(s.grid.chassis)); if (m && m.metal && HC.modLevel('furnace')) { if (!(m.metal >= 5 && craftIfOk('smelt5'))) craftIfOk('smelt'); } }
    } else if ((q.t === 'travel' || q.t === 'dist') && !HC.T.on) {
      const zid = q.t === 'travel' ? q.a : 'far', d = q.t === 'travel' ? HC.ZONE[q.a].dist : Math.max(7, s.maxDist + 1);
      const info = HC.travelInfo(zid, d);
      if (info.here) return;
      if (!info.engOk) bot.status = `need engine ${info.req}`;
      else if (info.fuelOk) {
        if (s.hp > HC.maxHP() * 0.5 || true) { HC.startTravel(zid, d); say('travel ' + zid + ' ' + d); return; }
      } else craftIfOk('fuel');
    }
    // opportunistic gear (never starving the current goal)
    const gear = ['axe1', 'pick1', 'spear', 'axe2', 'pick2', 'bow', 'armor1', 'axe3', 'pick3', 'crossbow', 'armor2', 'blaster', 'axe4', 'pick4', 'armor3'];
    for (let i = 0; i < gear.length; i++) {
      const r = HC.REC[gear[i]];
      if (!r || !HC.recipeState(r).ok || !HC.canAfford(r.cost)) continue;
      if (q.t === 'craft' && q.a === r.id) continue;
      if (afterSpendKeeps(r.cost, tc)) { HC.craft(r.id); break; }
    }
    if (s.inv.bandage < 3 && afterSpendKeeps(HC.REC.bandage.cost, tc)) craftIfOk('bandage');
    if (HC.modLevel('workbench') >= 3 && s.inv.medkit < 2 && HC.REC.medkit && afterSpendKeeps(HC.REC.medkit.cost, tc)) craftIfOk('medkit');
    // opportunistic modules: cheapest affordable build/upgrade that keeps the goal affordable
    if (q.t !== 'build' && q.t !== 'upg' && q.t !== 'chassis' && q.t !== 'boss') {
      const opts = [];
      const sl = freeSlot();
      const futureMods = new Set(); for (let i = S().q.i; i < HC.QUESTS.length; i++) { const f = HC.QUESTS[i]; if (f.t === 'build' && !HC.modLevel(f.a)) futureMods.add(f.a); }
      const spare = sl >= 0 && ['storage', 'turret', 'walls', 'bed', 'lantern', 'garden'].filter((id) => !HC.modLevel(id) && !futureMods.has(id)).length && (S().grid.slots.filter((x, i) => HC.slotValid(i) && !x).length > futureMods.size);
      if (spare) for (const id of ['storage', 'turret', 'walls', 'bed', 'lantern', 'garden']) if (!HC.modLevel(id) && !futureMods.has(id)) opts.push({ c: HC.modCost(id, 1), f: () => HC.buildMod(sl, id) });
      s.grid.slots.forEach((x, i) => { if (x && x.l < 3 && ['turret', 'storage', 'walls', 'workbench', 'furnace', 'engine'].includes(x.m)) opts.push({ c: HC.modCost(x.m, x.l + 1), f: () => HC.upgradeMod(i) }); });
      const tot = (o) => Object.values(o.c).reduce((a, b) => a + b, 0);
      opts.sort((a, b) => tot(a) - tot(b));
      for (const o of opts) if (HC.canAfford(o.c) && afterSpendKeeps(o.c, tc)) { o.f(); break; }
    }
    // eat manually if starving and food is available; game auto-eats below 50%
    if (s.hunger < 40) HC.eat(false);
  }

  // ---- activities
  function fightBoss(q) {
    const b = R.boss && R.boss.on ? R.boss : null;
    const s = S();
    if (!b) { // walk to the lair, but heal up first
      if (s.hp < HC.maxHP() * 0.85 && !W.lair) return;
      if (s.hp < HC.maxHP() * 0.85 && dist(P, W.lair) > 600) { const c = cavC(); go(c.x, c.y, 60); return; }
      if (W.lair) go(W.lair.x, W.lair.y, 30); return;
    }
    bot.lastBossHp = b.hp;
    const w = HC.WEAPON[s.equip.weapon] || HC.WEAPON.fist;
    // dodge telegraphs
    for (let i = 0; i < R.teles.length; i++) {
      const tl = R.teles[i]; if (!tl.on) continue;
      const d = dist(P, tl);
      if (d < tl.r + 55) { const ax = P.x - tl.x, ay = P.y - tl.y, m = Math.hypot(ax, ay) || 1; HC.input.set(ax / m, ay / m); return; }
    }
    const d = dist(P, b) - b.r, want = w.melee ? Math.max(10, w.range - 14) : Math.min(w.range - 35, 200);
    const ax = b.x - P.x, ay = b.y - P.y, m = Math.hypot(ax, ay) || 1;
    if (s.hp < HC.maxHP() * 0.4 && P.rollCd <= 0 && d < 80) HC.doRoll();
    if (d > want + 10) HC.input.set(ax / m, ay / m);
    else if (!w.melee && d < want - 30) HC.input.set(-ax / m, -ay / m);
    else HC.input.set(-ay / m * 0.6, ax / m * 0.6); // strafe
  }
  function gatherRes(r) {
    const type = NODE_OF[r];
    if (!type) return false;
    const n = nearest(W.nodes, (o) => o.type === type && o.alive);
    if (!n) return false;
    return go(n.x, n.y, n.r + 8) || true;
  }
  function hunt(anyKind) {
    const m = nearest(R.mobs, (o) => o.on && o.kind !== 'boss' && (anyKind || o.kind !== 'critter'));
    if (!m) return false;
    if (HC.cavDist(m.x, m.y) > 900) return false;
    const w = HC.WEAPON[S().equip.weapon] || HC.WEAPON.fist;
    go(m.x, m.y, Math.max(20, w.range * 0.7));
    return true;
  }
  function generic(wish) { // gather whatever is scarcest among wish list
    let pick = null, low = 1e9;
    for (const r of wish) { const h = HC.have(r); if (h < low) { low = h; pick = r; } }
    return pick && gatherRes(pick);
  }

  function decide() {
    const s = S(), q = HC.curQuest(), cap = HC.carryCap();
    bot.status = '';
    if (HC.T.on) { HC.input.set(0, 0); return; }
    const night = R.night, hostile = nearest(R.mobs, (o) => o.on && o.kind !== 'critter' && o.kind !== 'boss');
    // keep alive
    if (s.hp < HC.maxHP() * 0.3 && q.t !== 'boss') { const c = cavC(); go(c.x, c.y, 50); bot.status = 'heal'; return; }
    if (q.t === 'boss') {
      const wantZone = BOSS_ZONE[q.a];
      if (s.zone.id !== wantZone) { bot.status = 'wrong zone for boss'; return; }
      fightBoss(q); return;
    }
    // night duty: stay near caravan, fight what comes
    if (night) {
      if (hostile && HC.cavDist(hostile.x, hostile.y) < 380) { const w = HC.WEAPON[s.equip.weapon] || HC.WEAPON.fist; go(hostile.x, hostile.y, Math.max(20, w.range * 0.7)); return; }
      const c = cavC(); go(c.x + 40, c.y + 90, 25); return;
    }
    // bag full -> deposit
    if (HC.carryCount() >= cap - 4) { const c = cavC(); go(c.x, c.y, 40); bot.status = 'deposit'; return; }
    // goal kind
    if (q.t === 'gather') { const r = q.a === 'metal' ? 'scrap' : q.a; if (r === 'food' && !gatherRes('food')) hunt(true); else gatherRes(r) || hunt(true); return; }
    if (q.t === 'kill') { if (!hunt(true)) generic(['wood', 'stone', 'scrap']); return; }
    if (q.t === 'chest') {
      const ch = nearest(R.chests, (o) => o.open <= 0);
      if (ch) { go(ch.x, ch.y, 10); return; }
      if (!hunt(false)) generic(['wood', 'stone', 'scrap', 'food']);
      return;
    }
    if (q.t === 'night' || q.t === 'level' || q.t === 'raid') {
      if (hostile && HC.cavDist(hostile.x, hostile.y) < 500) { hunt(false); return; }
      if (s.hunger < 55 && HC.have('food') < 3) { gatherRes('food') || hunt(true); return; }
      if ((q.t === 'night' || q.t === 'raid') && !night) { // stock up near the caravan until dusk
        generic(['wood', 'scrap', 'stone']); return;
      }
      if (!hunt(true)) generic(['wood', 'stone', 'scrap']);
      return;
    }
    // craft/build/upg/chassis/travel/dist: gather what the goal is short of
    const tc = targetCost(q) || {};
    const need = rawNeeds(tc);
    const keys = Object.keys(need).sort((a, b) => need[b] - need[a]);
    if (q.t === 'craft' && q.a === 'smelt') { gatherRes('scrap'); return; }
    if (keys.length) {
      let did = false;
      for (const k of keys) { if (k === 'food' && HC.have('food') < 1) { did = gatherRes('food') || hunt(true); } else did = gatherRes(k); if (did) break; }
      if (!did) hunt(true);
      return;
    }
    // everything affordable but goal not done (e.g. waiting on tier/engine/blueprint): go idle near caravan and bank stock
    bot.status = 'blocked: ' + q.text;
    if (!generic(['wood', 'stone', 'scrap', 'food'])) { const c = cavC(); go(c.x, c.y, 60); }
  }

  bot.run = function (steps, maxMinutes) {
    for (let k = 0; k < steps; k += TICK) {
      tick++;
      if (HC.T.on) { HC.input.set(0, 0); }
      if (tick % 5 === 0) manage();
      decide();
      stuckCheck();
      window.__HC.step(TICK);
      bot.steps += TICK;
      const s = S();
      if (s.q.i !== lastQ) { for (let i = lastQ; i < s.q.i; i++) bot.goals.push({ i, text: (HC.QUESTS[i] || {}).text || 'endless goal', t: t(), lvl: s.lvl, zone: s.zone.id, dist: s.zone.dist }); lastQ = s.q.i; }
      if (s.lvl !== lastLvl) { for (let l = lastLvl + 1; l <= s.lvl; l++) bot.levels.push({ lvl: l, t: t() }); lastLvl = s.lvl; }
      for (const z in s.bossDown) if (!bot.bosses.some((b) => b.z === z)) bot.bosses.push({ z, t: t() });
      if (bot.wantShot && R.boss && R.boss.on && R.boss.hp < R.boss.maxhp * 0.6) { bot.shotReady = true; bot.wantShot = false; break; }
      if (t() >= maxMinutes * 60) break;
    }
    const s = S();
    return { t: t(), q: s.q.i, lvl: s.lvl, zone: s.zone.id, dist: s.zone.dist, status: bot.status, quest: HC.curQuest().text, prog: HC.questProgress(HC.curQuest()), need: HC.curQuest().n, hp: Math.round(s.hp), hunger: Math.round(s.hunger), slots: s.grid.slots.map((x) => x ? x.m + x.l : '-').join(','), res: HC.RES.map((r) => r + ':' + HC.have(r)).join(' '), deaths: s.stats.deaths, bosses: Object.keys(s.bossDown || {}) };
  };
  window.__bot = bot;
})();
