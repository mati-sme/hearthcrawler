(function () {
  'use strict';
  const HC = window.HC, R = HC.R, W = HC.W;
  const $ = (id) => document.getElementById(id);
  let cur = null, tab = 'bag', selSlot = -1, perkList = null, tradeOffers = null, modalOpen = false, tutOpen = false, tutStep = 0;
  let perkDelay = 0, hudAcc = 0;
  const cache = {};
  const S = () => HC.S;

  function setTxt(el, key, v) { if (cache[key] !== v) { cache[key] = v; el.textContent = v; } }
  function setHtml(el, key, v) { if (cache[key] !== v) { cache[key] = v; el.innerHTML = v; } }
  function setW(el, key, v) { v = Math.round(v * 100) / 100; if (cache[key] !== v) { cache[key] = v; el.style.width = v + '%'; } }
  const fmt = (n) => (n >= 10000 ? Math.floor(n / 1000) + 'k' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : '' + Math.floor(n));

  const costChips = (cost) => Object.keys(cost).map((k) => `<span class="cost ${HC.have(k) >= cost[k] ? 'ok' : 'no'}">${HC.ico(k)}<b>${cost[k]}</b></span>`).join('');
  function rewardChips(rew, big) {
    let h = '';
    if (rew.res) for (const r in rew.res) h += `<span class="rchip">${HC.ico(r)}+${rew.res[r]}</span>`;
    if (rew.xp) h += `<span class="rchip">${HC.ico('star')}+${rew.xp} XP</span>`;
    if (rew.bp) rew.bp.forEach((b) => (h += `<span class="rchip">📜 ${HC.BP_NAMES[b]}</span>`));
    if (rew.paint) h += '<span class="rchip">🎨 Paint!</span>';
    return h;
  }

  // =====================================================================
  // notices: toasts, banners and goal-complete cards share one stack, so they can never overlap
  // =====================================================================
  const MAX_NOTICES = 3;
  const shown = [], pending = [];
  function pumpNotices() {
    const box = $('notices');
    while (shown.length < MAX_NOTICES && pending.length) {
      const n = pending.shift(), el = document.createElement('div');
      el.className = 'notice ' + n.kind; el.innerHTML = n.html;
      box.appendChild(el);
      shown.push({ el, ttl: n.ttl, kind: n.kind });
    }
  }
  function dropNotice(n) {
    const i = shown.indexOf(n); if (i < 0) return;
    shown.splice(i, 1); n.el.classList.add('out');
    setTimeout(() => { if (n.el.parentNode) n.el.parentNode.removeChild(n.el); }, 260);
    pumpNotices();
  }
  function notify(kind, html, ttl) {
    const dup = pending.findIndex((p) => p.kind === kind && p.html === html);
    if (dup >= 0) return;
    // a backlog of chatter is stale news: drop the oldest queued toasts first
    if (kind === 'toast') while (pending.filter((p) => p.kind === 'toast').length >= 2) pending.splice(pending.findIndex((p) => p.kind === 'toast'), 1);
    pending.push({ kind, html, ttl });
    pumpNotices();
  }
  HC.toast = (msg) => notify('toast', msg.replace(/&/g, '&amp;').replace(/</g, '&lt;'), 2);
  HC.banner = (t, s) => notify('banner', `<b>${t}</b><small>${s || ''}</small>`, 2.6);
  const goalShowing = () => shown.some((n) => n.kind === 'goal') || pending.some((n) => n.kind === 'goal');
  function goalDone(q) {
    notify('goal', `<div class="gstar">${HC.ico('star')}</div><div class="gpm"><div class="gp1">Goal complete!</div><div class="gp3">${rewardChips(q.rew)}</div></div>`, 2.2);
    HC.audio.play('fanfare');
    HC.fx.confetti(110);
    HC.fx.confettiBurst(HC.view.cw / 2, HC.view.ch * 0.2, 50);
    const g = $('goal'); g.classList.remove('pop'); void g.offsetWidth; g.classList.add('pop');
    cache.goalKey = null;
  }

  // =====================================================================
  // HUD
  // =====================================================================
  function buildHud() {
    document.querySelectorAll('[data-ic]').forEach((el) => (el.innerHTML = HC.ico(el.dataset.ic)));
    let h = '';
    HC.RES.forEach((r) => (h += `<div class="rc" id="rc-${r}">${HC.ico(r)}<span id="rv-${r}">0</span></div>`));
    h += `<div class="rc bag" id="rc-bag">${HC.ico('bag')}<span id="rv-bag">0/80</span></div>`;
    $('res').innerHTML = h;
    $('hunPill').addEventListener('click', () => HC.eat(false));
    $('hpPill').addEventListener('click', () => HC.useHeal(false));
  }

  function openPerks() { perkList = HC.rollPerks(); open('perk'); }

  function actionState() {
    const s = S(), dc = HC.cavDist(R.P.x, R.P.y);
    if (dc < 80 && (s.damaged || s.cavHP < HC.cavMax() * 0.6) && HC.canAfford(HC.repairCost())) return 'repair';
    if (s.inv.bomb > 0 && HC.nearestMobDist(260) >= 0) return 'bomb';
    if (dc < 95) return 'caravan';
    return 'roll';
  }
  HC.ui = {
    paused: () => !!cur || modalOpen || tutOpen,
    open, close, refresh, goalDone, confirm: confirmBox,
    doAction() {
      if (HC.ui.paused() || HC.T.on) return;
      const a = actionState();
      if (a === 'repair') HC.repair(); else if (a === 'bomb') HC.throwBomb(); else if (a === 'caravan') open('caravan'); else HC.doRoll();
    },
    trader(offers) { tradeOffers = offers; open('trader'); },
    closeTrader() { if (cur === 'trader') close(); },
    update,
    tutorial: startTutorial,
  };

  function update(dt) {
    // timers for transient UI
    for (const n of shown.slice()) { n.ttl -= dt; if (n.ttl <= 0) dropNotice(n); }
    $('app').classList.toggle('travel', !!HC.T.on);
    hudAcc += dt; if (hudAcc < 0.1) return; hudAcc = 0;
    const s = S(), P = R.P;
    const gb = Math.round($('goal').getBoundingClientRect().bottom - $('app').getBoundingClientRect().top);
    if (gb > 0 && cache.gbot !== gb) { cache.gbot = gb; $('app').style.setProperty('--gbot', gb + 'px'); }
    // bars
    const hmax = HC.maxHP();
    setW($('hpFill'), 'hpw', 100 * s.hp / hmax); setTxt($('hpTxt'), 'hpt', '' + Math.ceil(s.hp));
    setW($('hunFill'), 'hunw', s.hunger);
    $('hpPill').classList.toggle('low', s.hp < hmax * 0.3);
    $('hunPill').classList.toggle('low', s.hunger < 15);
    // clock
    const night = s.t >= HC.DAY_LEN;
    setHtml($('clockIc'), 'clic', HC.ico(night ? 'moon' : 'sun'));
    setTxt($('clockTxt'), 'clt', 'Day ' + s.day);
    $('clock').classList.toggle('night', night);
    const frac = night ? (s.t - HC.DAY_LEN) / HC.NIGHT_LEN : s.t / HC.DAY_LEN;
    setW($('clockFill'), 'clf', 100 * (1 - frac));
    setTxt($('zoneTxt'), 'zt', W.Z ? W.Z.name : '');
    setTxt($('zoneDist'), 'zd', 'Distance ' + s.zone.dist);
    // goal
    const q = HC.curQuest(), prog = HC.questProgress(q), key = s.q.i + ':' + prog;
    if (cache.goalKey !== key) {
      cache.goalKey = key;
      const ic = q.t === 'gather' && HC.RES_INFO[q.a] ? HC.ico(q.a) : q.ic;
      setHtml($('gIc'), 'gic', ic);
      setTxt($('gTxt'), 'gtx', q.text);
      setW($('gFill'), 'gfl', 100 * prog / q.n);
      setTxt($('gNum'), 'gnu', prog + '/' + q.n);
      setHtml($('gRew'), 'grw', rewardChips(q.rew));
    }
    const hint = HC.questHint(q);
    setTxt($('gHint'), 'ghi', hint.text || '');
    // arrow target for the renderer
    R.arrowT -= 0.1;
    if (R.arrowT <= 0) { R.arrowT = 0.3; R.arrowTarget = HC.T.on ? null : HC.questTarget(); }
    // pulse the button the goal wants you to press
    const want = q.t === 'craft' ? 'btn-craft' : q.t === 'build' || q.t === 'upg' || q.t === 'chassis' ? 'btn-caravan' : q.t === 'travel' || q.t === 'dist' ? 'btn-map' : '';
    ['btn-craft', 'btn-caravan', 'btn-map'].forEach((id) => $(id).classList.toggle('pulse', id === want && !hint.text.startsWith('Need') && !hint.text.startsWith('Engine')));
    // boss bar
    const b = R.boss;
    if (b && b.on) { $('boss').classList.remove('hidden'); setTxt($('bossName'), 'bn', '👑 ' + b.def.name); setW($('bossFill'), 'bf', 100 * Math.max(0, b.hp) / b.maxhp); }
    else $('boss').classList.add('hidden');
    // resources
    HC.RES.forEach((r) => {
      const v = HC.have(r), el = $('rv-' + r);
      if (cache['rv' + r] !== v) { if (cache['rv' + r] !== undefined && v > cache['rv' + r]) { const c = $('rc-' + r); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); } cache['rv' + r] = v; el.textContent = fmt(v); }
    });
    setTxt($('rv-bag'), 'bag', HC.carryCount() + '/' + HC.carryCap());
    $('rc-bag').classList.toggle('full', HC.carryCount() >= HC.carryCap());
    // action button
    const a = actionState();
    const ic = { repair: '🔧', bomb: '💣', caravan: '🏠', roll: '🌀' }[a], lb = { repair: 'Repair', bomb: 'Bomb', caravan: 'Enter', roll: 'Roll' }[a];
    setTxt($('actIc'), 'aic', ic); setTxt($('actTxt'), 'alb', lb);
    const badge = $('actBadge');
    if (a === 'bomb') { badge.classList.remove('hidden'); setTxt(badge, 'abd', '' + s.inv.bomb); } else badge.classList.add('hidden');
    $('action').classList.toggle('cd', a === 'roll' && P.rollCd > 0);
    $('action').classList.toggle('go', a === 'repair');
    // auto-open perk picker
    // perk badge always shows; the picker only auto-opens when no enemies are near
    const pb = $('perkbadge');
    pb.classList.toggle('hidden', !(s.pendingPerks > 0) || !!cur || HC.T.on);
    setTxt(pb, 'pbt', '⭐ Level ' + s.lvl + '! Pick a perk');
    if (s.pendingPerks > 0 && !cur && !modalOpen && !tutOpen && !HC.T.on && !goalShowing() && HC.nearestMobDist(300) < 0) {
      perkDelay += 0.1; if (perkDelay > 2.0) { perkDelay = 0; openPerks(); }
    } else perkDelay = 0;
  }

  // =====================================================================
  // sheet plumbing
  // =====================================================================
  const TITLES = { craft: '🛠 Craft', caravan: '🏠 Caravan', map: '🗺 World Map', gear: '🎒 Gear', settings: '⚙️ Menu', perk: '⭐ Level Up!', trader: '🧳 Wandering Trader' };
  function open(name) {
    if (HC.T.on && name !== 'trader') return;
    if (cur === name) return;
    HC.audio.init(); HC.audio.play('click');
    cur = name;
    if (name === 'caravan') { const sl = S().grid.slots; if (selSlot < 0 || !HC.slotValid(selSlot)) { selSlot = -1; for (let i = 0; i < 12; i++) if (HC.slotValid(i) && !sl[i]) { selSlot = i; break; } if (selSlot < 0) selSlot = 0; } }
    $('sheet').classList.remove('hidden');
    $('sheetClose').style.visibility = name === 'perk' ? 'hidden' : '';
    render();
    $('sheetBody').scrollTop = 0;
  }
  function close() {
    if (!cur) return;
    if (cur === 'trader') { HC.T.pause = 0; }
    cur = null; $('sheet').classList.add('hidden'); HC.audio.play('click');
    HC.saveNow();
  }
  function refresh() { if (!cur) return; const b = $('sheetBody'), st = b.scrollTop; render(); b.scrollTop = st; }
  function render() {
    $('sheetTitle').textContent = TITLES[cur] || '';
    const f = { craft: rCraft, caravan: rCaravan, map: rMap, gear: rGear, settings: rSettings, perk: rPerk, trader: rTrader }[cur];
    $('sheetBody').innerHTML = f ? f() : '';
  }

  // ---------- craft ----------
  function rCraft() {
    const s = S(), q = HC.curQuest(), hintId = q.t === 'craft' ? q.a : null;
    let h = '';
    for (let t = 0; t <= 3; t++) {
      const open = HC.tierOpen(t);
      h += `<div class="tier ${open ? '' : 'lock'}">${open ? '✅' : '🔒'} Tier ${t} · ${HC.TIER_NAMES[t]}${open ? '' : t === 1 ? ' — build a Workbench 🏠' : t === 2 ? ' — Workbench Lv2 + Furnace 🏠' : ' — Workbench Lv3 🏠'}</div>`;
      HC.RECIPES.filter((r) => r.tier === t).forEach((r) => {
        const st = HC.recipeState(r), aff = HC.canAfford(r.cost);
        const hint = hintId && (hintId === r.id || (hintId === 'smelt' && r.id === 'smelt'));
        let btn;
        if (st.why === 'owned') btn = `<span class="tag">${s.equip[r.kind] === r.id || s.equip.weapon === r.w || s.equip.armor === r.id ? 'Equipped' : 'Owned'}</span>`;
        else if (!st.ok) btn = `<button class="btn" disabled>${st.why === 'bp' ? '📜' : st.why === 'need' ? '🔥' : '🔒'}</button>`;
        else btn = `<button class="btn ${aff ? '' : 'orange'}" data-act="craft" data-id="${r.id}" ${aff ? '' : 'disabled'}>Craft</button>`;
        const cnt = r.kind === 'item' ? ' ×' + s.inv[r.item] : '';
        h += `<div class="card ${st.ok || st.why === 'owned' ? '' : 'dim'} ${hint && st.ok ? 'hint' : ''}"><div class="cic">${r.icon}</div><div class="cmid"><b>${r.name}${cnt}</b><small>${st.why === 'bp' ? 'Blueprint needed — keep completing goals!' : r.desc}</small><div class="costs">${costChips(r.cost)}</div></div>${btn}</div>`;
      });
    }
    return h;
  }

  // ---------- caravan ----------
  function rCaravan() {
    const s = S(), G = HC.G, mx = HC.cavMax(), hp = Math.max(0, s.cavHP), f = hp / mx;
    const q = HC.curQuest();
    let h = `<div class="hpbar">🚚 Caravan <div class="track"><div class="fill ${f > 0.5 ? '' : f > 0.25 ? 'mid' : 'low'}" style="width:${100 * f}%"></div></div><span>${Math.round(hp)}/${mx}</span>`;
    if (s.damaged || hp < mx - 0.5) h += `<button class="btn orange" data-act="repair" style="min-height:40px;min-width:60px" ${HC.canAfford(HC.repairCost()) ? '' : 'disabled'}>🔧 ${costChips(HC.repairCost())}</button>`;
    h += '</div>';
    if (s.damaged) h += '<div class="note" style="margin:-2px 0 8px;color:#b02a2a">Damaged! Modules work at half power until repaired.</div>';
    h += `<div class="cgrid" style="grid-template-columns:repeat(${G.cols},78px)">`;
    for (let r = 0; r < G.rows; r++) for (let c = 0; c < G.cols; c++) {
      const i = r * 3 + c, sl = s.grid.slots[i];
      const hint = q.t === 'upg' && sl && sl.m === q.a;
      h += `<button class="slot ${sl ? 'has' : ''} ${selSlot === i ? 'sel' : ''} ${hint ? 'hint' : ''}" data-act="sel" data-slot="${i}" aria-label="slot ${i}">` +
        (sl ? `${HC.MODS[sl.m].icon}<span class="pips">${'●'.repeat(sl.l)}</span>` : '<span class="plus">+</span>') + '</button>';
    }
    h += '</div>';
    const sl = s.grid.slots[selSlot];
    if (!sl) {
      h += '<div class="subtitle">Build a module in this slot</div>';
      HC.MOD_ORDER.forEach((id) => {
        const m = HC.MODS[id], cost = HC.modCost(id, 1), aff = HC.canAfford(cost), hint = q.t === 'build' && q.a === id;
        h += `<div class="card ${hint ? 'hint' : ''}"><div class="cic">${m.icon}</div><div class="cmid"><b>${m.name}</b><small>${m.desc(1)}</small><div class="costs">${costChips(cost)}</div></div><button class="btn ${aff ? '' : 'orange'}" data-act="build" data-mod="${id}" ${aff ? '' : 'disabled'}>Build</button></div>`;
      });
    } else {
      const m = HC.MODS[sl.m], max = sl.l >= HC.MOD_MAX;
      h += `<div class="subtitle">${m.icon} ${m.name} · Level ${sl.l}/${HC.MOD_MAX}</div>`;
      const cost = max ? null : HC.modCost(sl.m, sl.l + 1), aff = cost && HC.canAfford(cost), hint = q.t === 'upg' && q.a === sl.m;
      h += `<div class="card ${hint ? 'hint' : ''}"><div class="cic">${m.icon}</div><div class="cmid"><b>Now: ${m.desc(sl.l)}</b>${max ? '<small>Fully upgraded!</small>' : `<small>Next: ${m.desc(sl.l + 1)}</small><div class="costs">${costChips(cost)}</div>`}</div>` +
        (max ? '<span class="tag">MAX</span>' : `<button class="btn ${aff ? '' : 'orange'}" data-act="upg" ${aff ? '' : 'disabled'}>Upgrade</button>`) + '</div>';
      h += '<div class="card"><div class="cic">🧹</div><div class="cmid"><b>Remove module</b><small>Free the slot · get 60% back</small></div><button class="btn ghost" data-act="demo">Remove</button></div>';
      if (sl.m === 'bed' && sl.l >= 3 && R.night) h += '<div class="card"><div class="cic">😴</div><div class="cmid"><b>Sleep until dawn</b><small>Skip the rest of the night</small></div><button class="btn" data-act="sleep">Sleep</button></div>';
    }
    // chassis
    h += '<div class="subtitle">🚚 Chassis</div>';
    const cl = s.grid.chassis;
    if (cl >= HC.CHASSIS.length) h += `<div class="card"><div class="cic">🚚</div><div class="cmid"><b>Chassis Lv ${cl} (MAX)</b><small>${G.cols}×${G.rows} slots</small></div><span class="tag">MAX</span></div>`;
    else {
      const cost = HC.chassisCost(cl), aff = HC.canAfford(cost), nx = HC.CHASSIS[cl], hint = q.t === 'chassis';
      h += `<div class="card ${hint ? 'hint' : ''}"><div class="cic">🚚</div><div class="cmid"><b>Chassis Lv ${cl} → ${cl + 1}</b><small>${G.cols}×${G.rows} → ${nx[0]}×${nx[1]} slots · more HP</small><div class="costs">${costChips(cost)}</div></div><button class="btn ${aff ? '' : 'orange'}" data-act="chassis" ${aff ? '' : 'disabled'}>Expand</button></div>`;
    }
    return h;
  }

  // ---------- map ----------
  function rMap() {
    const s = S(), q = HC.curQuest();
    let h = '<div class="map">';
    HC.ZONES.forEach((z) => {
      let dist = z.dist;
      if (z.far) dist = Math.min(Math.max(7, s.farSel_ui || s.farSel), s.farSel);
      const info = HC.travelInfo(z.id, dist), locked = z.far && !s.bossDown.ember;
      const hint = q.t === 'travel' && q.a === z.id || (q.t === 'dist' && z.far);
      const ok = info.engOk && info.fuelOk && !locked && !info.here;
      let sub;
      if (locked) sub = '🔒 Defeat the Ember Golem to open the Far Roads';
      else sub = `<span class="cost ${info.engOk ? 'ok' : 'no'}">⚙ Engine Lv ${info.req}</span> <span class="cost ${info.fuelOk ? 'ok' : 'no'}">${HC.ico('fuel')}<b>${info.fuel}</b></span>`;
      const farSel = z.far && !locked ? `<span class="sel2"><button data-act="farsel" data-d="-1">◀</button><b>Distance ${dist}</b><button data-act="farsel" data-d="1">▶</button></span>` : '';
      h += `<div class="node ${info.here ? 'here' : ''} ${locked ? 'locked' : ''} ${hint ? 'hint' : ''}" data-zone="${z.id}"><div class="nic">${z.icon}</div><div class="nmid"><b>${z.name}</b><small>${z.far ? 'Endless · harder every step' : 'Distance ' + z.dist}${s.visited[z.id] ? ' · visited' : ''}</small><div class="costs">${sub}</div>${farSel}</div>` +
        (info.here ? '<span class="tag">Here</span>' : `<button class="btn ${ok ? '' : 'orange'}" data-act="travel" data-zone="${z.id}" data-dist="${dist}" ${ok ? '' : 'disabled'}>Go</button>`) + '</div>';
    });
    h += '</div><div class="note">Fuel is brewed in 🛠 Craft (wood + scrap). Upgrade the Engine in the Caravan to go farther & save fuel.</div>';
    return h;
  }

  // ---------- gear ----------
  function rGear() {
    const s = S();
    let h = `<div class="tabs"><button class="${tab === 'bag' ? 'on' : ''}" data-act="tab" data-tab="bag">🎒 Bag</button><button class="${tab === 'garage' ? 'on' : ''}" data-act="tab" data-tab="garage">🎨 Garage</button><button class="${tab === 'trophy' ? 'on' : ''}" data-act="tab" data-tab="trophy">🏆 Trophies</button></div>`;
    if (tab === 'bag') {
      const nm = (id, fb) => (id ? (HC.REC[id] || { name: HC.WEAPON[id] && HC.WEAPON[id].name }).name : fb);
      h += `<div class="eqrow"><div class="eq"><div class="e1">🪓</div><small>Axe</small><b>${nm(s.equip.axe, 'Hands')}</b></div><div class="eq"><div class="e1">⛏️</div><small>Pick</small><b>${nm(s.equip.pick, 'Hands')}</b></div><div class="eq"><div class="e1">${HC.WEAPON[s.equip.weapon].icon}</div><small>Weapon</small><b>${HC.WEAPON[s.equip.weapon].name}</b></div><div class="eq"><div class="e1">🦺</div><small>Armor</small><b>${nm(s.equip.armor, 'None')}</b></div></div>`;
      const owned = HC.RECIPES.filter((r) => s.inv.owned[r.id]);
      h += '<div class="subtitle">Tap to equip</div><div class="igrid">';
      const eq = (r) => s.equip.axe === r.id || s.equip.pick === r.id || s.equip.weapon === r.w || s.equip.armor === r.id;
      h += `<button class="ibtn ${s.equip.weapon === 'fist' ? 'on' : ''}" data-act="equip" data-slot="weapon" data-id="fist"><span class="e1">👊</span>Fists</button>`;
      owned.forEach((r) => (h += `<button class="ibtn ${eq(r) ? 'on' : ''}" data-act="equip" data-slot="${r.kind === 'weapon' ? 'weapon' : r.kind}" data-id="${r.kind === 'weapon' ? r.w : r.id}"><span class="e1">${r.icon}</span>${r.name}</button>`));
      h += '</div><div class="subtitle">Items</div>';
      h += `<div class="row"><span>🩹 Bandages ×${s.inv.bandage} &nbsp; 🧰 Medkits ×${s.inv.medkit} &nbsp; 💣 Bombs ×${s.inv.bomb}</span><button class="btn" style="min-width:60px" data-act="heal" ${s.inv.bandage + s.inv.medkit > 0 && s.hp < HC.maxHP() ? '' : 'disabled'}>Heal</button></div>`;
      h += `<div class="subtitle">⭐ Level ${s.lvl}</div><div class="xpbar"><i style="width:${100 * s.xp / HC.xpFor(s.lvl)}%"></i></div>`;
      const pk = HC.PERKS.filter((p) => s.perks[p.id]).map((p) => `<span class="pperk">${p.icon} ${p.name} ×${s.perks[p.id]}</span>`).join('');
      h += pk || '<div class="note">Level up to choose perks!</div>';
      const bps = Object.keys(s.inv.bp).map((b) => `<span class="pperk">📜 ${HC.BP_NAMES[b]}</span>`).join('');
      if (bps) h += '<div class="subtitle">Blueprints</div>' + bps;
    } else if (tab === 'garage') {
      h += '<div class="subtitle">Paint</div><div class="swatches">';
      HC.PAINTS.forEach((p) => {
        const un = s.paints[p.id];
        h += `<button class="sw ${s.paint === p.id ? 'on' : ''} ${un ? '' : 'lock'}" ${un ? `data-act="paint" data-id="${p.id}"` : 'disabled'}><div class="chip" style="background:${p.rainbow ? 'linear-gradient(90deg,#ff5a5a,#ffd24a,#5cc8ff,#b58cff)' : p.c1};border-color:${p.trim}"></div>${p.name}<small>${un ? (s.paint === p.id ? 'In use' : 'Tap to use') : '🔒 ' + p.unlock}</small></button>`;
      });
      h += '</div><div class="subtitle">Flag</div><div class="swatches">';
      HC.FLAGS.forEach((f) => {
        const un = s.flags[f.id];
        h += `<button class="sw ${s.flag === f.id ? 'on' : ''} ${un ? '' : 'lock'}" ${un ? `data-act="flag" data-id="${f.id}"` : 'disabled'}><div class="chip" style="background:${f.c || '#eee'};border-color:#fff"></div>${f.name}<small>${un ? '' : '🔒 ' + f.unlock}</small></button>`;
      });
      h += '</div>';
    } else {
      HC.ACH.forEach((a) => {
        const v = a.get(s), st = HC.achStars(a), next = a.steps[Math.min(2, st)];
        h += `<div class="ach"><div class="cic">${a.icon}</div><div class="cmid"><b>${a.name}</b><small>${a.text(next)} (${Math.min(v, next)}/${next})</small><div class="track"><div class="fill" style="width:${100 * Math.min(1, v / next)}%"></div></div></div><div class="stars">${[0, 1, 2].map((i) => HC.ico(i < st ? 'star' : 'starOff')).join('')}</div></div>`;
      });
    }
    return h;
  }

  // ---------- settings ----------
  function rSettings() {
    const s = S();
    return `<div class="row"><span>🔊 Sound<small>Effects & jingles</small></span><button class="btn ${s.set.sound ? '' : 'ghost'}" data-act="sound">${s.set.sound ? 'On' : 'Off'}</button></div>` +
      `<div class="row"><span>🧭 Guide arrows<small>Point toward your goal</small></span><button class="btn ${s.set.arrows ? '' : 'ghost'}" data-act="arrows">${s.set.arrows ? 'On' : 'Off'}</button></div>` +
      `<div class="row"><span>❓ How to play<small>Replay the tutorial</small></span><button class="btn orange" data-act="tutorial">Show</button></div>` +
      `<div class="row"><span>🗑 Reset save<small>Start a brand new game</small></span><button class="btn red" data-act="reset">Reset</button></div>` +
      `<div class="note">Hearthcrawler v${HC.VERSION} · autosaves every 10s</div>`;
  }

  // ---------- perk / trader ----------
  function rPerk() {
    if (!perkList) perkList = HC.rollPerks();
    const s = S();
    return `<div class="note" style="margin:0 0 10px;font-size:13px">You reached level ${s.lvl}! Pick a perk:</div>` +
      perkList.map((p) => `<button class="perkcard" data-act="perk" data-id="${p.id}"><div class="cic">${p.icon}</div><div><b>${p.name}${s.perks[p.id] ? ' (×' + s.perks[p.id] + ')' : ''}</b><span>${p.desc}</span></div></button>`).join('');
  }
  function rTrader() {
    let h = '<div class="note" style="margin:0 0 10px;font-size:13px">A friendly trader gave you a free snack and offers a swap:</div>';
    (tradeOffers || []).forEach((o, i) => {
      h += `<div class="card"><div class="cic">🔄</div><div class="cmid"><b>Trade</b><div class="costs">${costChips(o.give)} → ${Object.keys(o.get).map((k) => `<span class="cost ok">${HC.ico(k)}<b>${o.get[k]}</b></span>`).join('')}</div></div><button class="btn" data-act="trade" data-i="${i}">Swap</button></div>`;
    });
    return h + '<div style="text-align:center"><button class="btn ghost" data-act="close">No thanks</button></div>';
  }

  // ---------- click handling ----------
  function onAct(d) {
    const s = S();
    switch (d.act) {
      case 'craft': HC.craft(d.id); break;
      case 'sel': selSlot = +d.slot; HC.audio.play('click'); break;
      case 'build': HC.buildMod(selSlot, d.mod); break;
      case 'upg': HC.upgradeMod(selSlot); break;
      case 'demo': confirmBox('Remove this module?', 'You get 60% of the cost back.', 'Remove', () => { HC.demolishMod(selSlot); refresh(); }); return;
      case 'chassis': HC.upgradeChassis(); break;
      case 'repair': HC.repair(); break;
      case 'sleep': if (HC.sleepTillDawn()) close(); return;
      case 'travel': if (HC.startTravel(d.zone, +d.dist)) { close(); } return;
      case 'farsel': s.farSel_ui = HC.clamp((s.farSel_ui || s.farSel) + (+d.d), 7, s.farSel); HC.audio.play('click'); break;
      case 'tab': tab = d.tab; HC.audio.play('click'); break;
      case 'equip': { if (d.slot === 'weapon') s.equip.weapon = d.id; else s.equip[d.slot] = d.id; HC.audio.play('click'); break; }
      case 'heal': HC.useHeal(false); break;
      case 'paint': s.paint = d.id; HC.audio.play('click'); break;
      case 'flag': s.flag = d.id; HC.audio.play('click'); break;
      case 'perk': HC.pickPerk(d.id); perkList = null; close(); return;
      case 'sound': s.set.sound = !s.set.sound; HC.audio.init(); HC.audio.play('click'); break;
      case 'arrows': s.set.arrows = !s.set.arrows; break;
      case 'tutorial': close(); startTutorial(); return;
      case 'reset': confirmBox('Reset everything?', 'This deletes your caravan, items and progress.', 'Reset', () => { HC.noSave = true; HC.resetSave(); location.reload(); }); return;
      case 'trade': { const o = tradeOffers[+d.i]; if (o && HC.spend(o.give)) { for (const k in o.get) HC.addStore(k, o.get[k]); HC.audio.play('chest'); HC.toast('🔄 Swapped!'); } HC.T.pause = 0; close(); return; }
      case 'close': close(); return;
    }
    refresh();
  }

  function confirmBox(title, text, okLabel, cb) {
    modalOpen = true;
    $('modalCard').innerHTML = `<h3>${title}</h3><p>${text}</p><div class="btns"><button class="btn ghost" id="mNo">Cancel</button><button class="btn red" id="mYes">${okLabel}</button></div>`;
    $('modal').classList.remove('hidden');
    const done = () => { modalOpen = false; $('modal').classList.add('hidden'); };
    $('mNo').onclick = done; $('mYes').onclick = () => { done(); cb(); };
  }

  // ---------- tutorial ----------
  const TUT = [
    { t: 'Drag to move', x: 'Touch anywhere on the lower part of the screen and drag. An invisible stick appears right under your finger!', hand: true },
    { t: 'Gather & fight automatically', x: 'Walk next to trees 🌲, rocks 🪨 and berry bushes 🍓 to gather. Enemies get auto-attacked — no tapping needed!' },
    { t: 'Follow the goal!', x: 'The goal card at the top always tells you what to do next. Finish goals for rewards, build your caravan 🏠 and roam the world!' },
  ];
  function startTutorial() {
    tutOpen = true; tutStep = 0; $('tutorial').classList.remove('hidden'); renderTut();
  }
  function renderTut() {
    const t = TUT[tutStep];
    $('tTitle').textContent = t.t; $('tTxt').textContent = t.x;
    $('tHand').style.display = t.hand ? '' : 'none';
    $('tDots').innerHTML = TUT.map((_, i) => `<i class="${i === tutStep ? 'on' : ''}"></i>`).join('');
    $('tut-next').textContent = tutStep === TUT.length - 1 ? "Let's go!" : 'Next';
  }
  function endTutorial() {
    tutOpen = false; $('tutorial').classList.add('hidden'); S().set.tutDone = true; HC.saveNow();
  }

  HC.initUI = function () {
    buildHud();
    const body = $('sheetBody');
    body.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) { HC.audio.init(); onAct(b.dataset); } });
    $('sheet').querySelector('.backdrop').addEventListener('click', () => { if (cur !== 'perk') close(); });
    $('sheetClose').addEventListener('click', close);
    [['btn-craft', 'craft'], ['btn-caravan', 'caravan'], ['btn-map', 'map'], ['btn-gear', 'gear'], ['btn-settings', 'settings']].forEach(([id, n]) => $(id).addEventListener('click', () => open(n)));
    $('action').addEventListener('pointerdown', (e) => { e.preventDefault(); HC.audio.init(); HC.ui.doAction(); });
    $('tut-next').addEventListener('click', () => { HC.audio.init(); HC.audio.play('click'); if (tutStep >= TUT.length - 1) endTutorial(); else { tutStep++; renderTut(); } });
    $('tut-skip').addEventListener('click', endTutorial);
    $('notices').addEventListener('click', (e) => { const el = e.target.closest('.notice'); const n = shown.find((x) => x.el === el); if (n) dropNotice(n); });
    $('perkbadge').addEventListener('click', () => { if (!HC.ui.paused() && S().pendingPerks > 0) openPerks(); });
    if (!S().set.tutDone) startTutorial();
  };
})();
