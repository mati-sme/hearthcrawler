(function () {
  'use strict';
  const HC = window.HC, W = HC.W, S0 = () => HC.S;
  const T = 46, PAD = 10;
  const G = (HC.G = { cols: 2, rows: 2, bw: 0, bh: 0, bx: 0, by: 0, x0: 0, y0: 0, x1: 0, y1: 0 });
  HC.CAV_T = T;

  HC.updateCavGeom = function () {
    const ch = HC.CHASSIS[S0().grid.chassis - 1];
    G.cols = ch[0]; G.rows = ch[1];
    G.bw = G.cols * T + 2 * PAD; G.bh = G.rows * T + 2 * PAD;
    G.bx = W.cx - G.bw / 2; G.by = W.cy - G.bh / 2 + 28;
    G.x0 = G.bx - 8; G.x1 = G.bx + G.bw + 8; G.y0 = G.by - 70; G.y1 = G.by + G.bh + 8;
  };
  HC.cavDist = function (x, y) {
    const nx = x < G.x0 ? G.x0 : x > G.x1 ? G.x1 : x, ny = y < G.y0 ? G.y0 : y > G.y1 ? G.y1 : y;
    HC.cnx = nx; HC.cny = ny;
    return Math.hypot(x - nx, y - ny);
  };
  HC.slotValid = (i) => { const r = Math.floor(i / 3), c = i % 3; return r < G.rows && c < G.cols; };
  HC.slotPos = (i) => ({ x: G.bx + PAD + (i % 3) * T + T / 2, y: G.by + PAD + Math.floor(i / 3) * T + T / 2 });
  HC.slotPop = new Array(12).fill(0);

  // ---------- building ----------
  function done(slot) {
    const S = S0();
    S.stats.built++;
    if (slot >= 0) HC.slotPop[slot] = 0.6;
    HC.rebuildTurrets();
    HC.audio.play('build');
    HC.saveNow();
    HC.emit('build', {});
  }
  HC.buildMod = function (slot, id) {
    const S = S0();
    if (!HC.slotValid(slot) || S.grid.slots[slot] || !HC.MODS[id]) return false;
    const cost = HC.modCost(id, 1);
    if (!HC.spend(cost)) { HC.audio.play('nope'); return false; }
    S.grid.slots[slot] = { m: id, l: 1 };
    const p = HC.slotPos(slot); HC.fx.sparkle(p.x, p.y, 14, 60); HC.fx.ring(p.x, p.y, 'rgba(255,255,255,0.8)', 40);
    done(slot);
    return true;
  };
  HC.upgradeMod = function (slot) {
    const S = S0(), s = S.grid.slots[slot];
    if (!s || s.l >= HC.MOD_MAX) return false;
    const cost = HC.modCost(s.m, s.l + 1);
    if (!HC.spend(cost)) { HC.audio.play('nope'); return false; }
    s.l++;
    const p = HC.slotPos(slot); HC.fx.sparkle(p.x, p.y, 16, 70); HC.fx.ring(p.x, p.y, 'rgba(255,230,120,0.9)', 46);
    done(slot);
    return true;
  };
  HC.upgradeChassis = function () {
    const S = S0(), l = S.grid.chassis;
    if (l >= HC.CHASSIS.length) return false;
    if (!HC.spend(HC.chassisCost(l))) { HC.audio.play('nope'); return false; }
    S.grid.chassis++;
    HC.updateCavGeom();
    S.cavHP = Math.min(HC.cavMax(), S.cavHP + 20);
    HC.fx.sparkle(W.cx, W.cy, 30, 120);
    HC.confetti && HC.confetti();
    done(-1);
    HC.emit('chassis', {});
    return true;
  };
  HC.repairCost = function () {
    const S = S0(), mx = HC.cavMax(), miss = 1 - Math.max(0, S.cavHP) / mx;
    return { scrap: Math.max(2, Math.ceil(4 + 8 * miss + S.grid.chassis)) };
  };
  HC.repair = function () {
    const S = S0(), mx = HC.cavMax();
    if (S.cavHP >= mx && !S.damaged) return false;
    if (!HC.spend(HC.repairCost())) { HC.audio.play('nope'); return false; }
    S.cavHP = mx; S.damaged = false;
    HC.fx.sparkle(W.cx, W.cy, 24, 110); HC.audio.play('build');
    HC.banner('🔧 Caravan repaired!', 'All modules at full power');
    return true;
  };

  // ---------- crafting ----------
  HC.tierOpen = function (t) {
    const wb = HC.modLevel('workbench');
    if (t === 0) return true;
    if (t === 1) return wb >= 1;
    if (t === 2) return wb >= 2 && HC.modLevel('furnace') >= 1;
    return wb >= 3;
  };
  HC.recipeState = function (r) { // returns {ok, why}
    const S = S0();
    if (r.kind !== 'item' && r.kind !== 'mat' && S.inv.owned[r.id]) return { ok: false, why: 'owned' };
    if (!HC.tierOpen(r.tier)) return { ok: false, why: 'tier' };
    if (r.bp && !S.inv.bp[r.bp]) return { ok: false, why: 'bp' };
    if (r.need && !HC.modLevel(r.need)) return { ok: false, why: 'need' };
    return { ok: true };
  };
  HC.craft = function (id) {
    const S = S0(), r = HC.REC[id];
    if (!r || !HC.recipeState(r).ok) return false;
    if (!HC.spend(r.cost)) { HC.audio.play('nope'); return false; }
    if (r.kind === 'item') S.inv[r.item]++;
    else if (r.kind === 'mat') HC.addStore(r.res, r.n);
    else { S.inv.owned[r.id] = true; HC.equipBest(); }
    S.stats.crafted++;
    HC.audio.play('craft');
    HC.fx.sparkle(HC.R.P.x, HC.R.P.y - 10, 12, 50);
    HC.fx.text(HC.R.P.x, HC.R.P.y - 34, r.name + '!', '#ffe9a0', 16);
    HC.emit('craft', { id: r.id === 'smelt5' ? 'smelt' : r.id, n: r.id === 'smelt5' ? 5 : 1 });
    HC.saveNow();
    return true;
  };

  // ---------- travel ----------
  HC.T = { on: false, t: 0, dur: 7, pause: 0 };
  HC.travelInfo = function (zid, dist) {
    const z = HC.ZONE[zid], S = S0(), eng = HC.modLevel('engine');
    const req = HC.engReq(z), fuel = HC.fuelCost(dist, eng);
    const here = S.zone.id === zid && S.zone.dist === dist;
    return { z, req, fuel, engOk: eng >= req, fuelOk: HC.have('fuel') >= fuel, here, eng };
  };
  HC.startTravel = function (zid, dist) {
    const S = S0(), info = HC.travelInfo(zid, dist);
    if (HC.T.on || info.here || !info.engOk || !info.fuelOk) { if (!info.here) HC.audio.play('nope'); return false; }
    HC.spend({ fuel: info.fuel });
    const T = HC.T, eng = info.eng;
    T.on = true; T.t = 0; T.dur = Math.max(5, 9.5 - 0.9 * eng); T.pause = 0; T.evDone = false;
    T.from = { id: S.zone.id, dist: S.zone.dist, pal: W.Z.pal, name: W.Z.name };
    T.toId = zid; T.toDist = dist;
    const toZ = HC.ZONE[zid];
    T.toPal = toZ.far ? HC.farBase(dist).pal : toZ.pal;
    T.toName = toZ.far ? 'Far Roads · ' + dist : toZ.name;
    const k = S.stats.travels;
    T.ev = k === 0 ? 'crate' : ['ambush', 'trader', 'crate', 'ambush', 'crate'][Math.floor(Math.random() * 5)];
    T.evMsg = ''; T.bandits = [];
    HC.saveNow();
    HC.audio.play('travel');
    HC.emit('travelstart', {});
    return true;
  };
  function travelEvent() {
    const T = HC.T, S = S0(), sc = 1 + 0.15 * (T.toDist - 1);
    T.evDone = true;
    if (T.ev === 'ambush') {
      for (let i = 0; i < 4; i++) T.bandits.push({ side: i % 2 ? 1 : -1, y: 0.25 + i * 0.12, t: 0, poof: false });
      T.evMsg = 'Goofy bandits ambush! They poofed!';
      const sc2 = Math.round(8 * sc);
      HC.addStore('scrap', sc2); HC.addStore('wood', Math.round(6 * sc));
      HC.addXP(30 * sc);
      HC.toast('🥷 Bandits poofed! +' + sc2 + ' scrap, +' + Math.round(6 * sc) + ' wood');
    } else if (T.ev === 'crate') {
      const o = { food: Math.round(6 * sc), wood: Math.round(8 * sc), stone: Math.round(5 * sc), fuel: 2 };
      for (const r in o) HC.addStore(r, o[r]);
      T.evMsg = 'A loot crate by the road!';
      HC.audio.play('chest');
      HC.toast('🎁 Roadside crate! +' + o.wood + ' wood +' + o.food + ' food +' + o.stone + ' stone +2 fuel');
    } else {
      T.pause = 6;
      const offers = [
        { give: { wood: 12 }, get: { metal: 4 } }, { give: { food: 10 }, get: { fuel: 8 } },
        { give: { scrap: 14 }, get: { metal: 6 } }, { give: { stone: 14 }, get: { scrap: 10 } }, { give: { wood: 14 }, get: { fuel: 8 } },
      ].filter((o) => HC.canAfford(o.give));
      T.evMsg = 'A wandering trader waves you down!';
      HC.addStore('food', 3);
      if (offers.length && HC.ui) HC.ui.trader(offers.slice(0, 2));
      else T.pause = 0;
    }
  }
  HC.arrive = function () {
    const T = HC.T, S = S0();
    T.on = false;
    const zid = T.toId, dist = T.toDist;
    S.zone = { id: zid, dist };
    if (dist > S.maxDist) S.maxDist = dist;
    S.visited[zid] = true;
    if (zid === 'far') S.farSel = Math.max(S.farSel, dist + 1);
    S.stats.travels++;
    HC.genZone(zid, dist);
    HC.initRuntime(true);
    HC.fx.puff(HC.R.P.x, HC.R.P.y);
    HC.banner(HC.ZONE[zid].icon + ' ' + (zid === 'far' ? 'Far Roads — Distance ' + dist : W.Z.name), 'Distance ' + dist);
    HC.audio.play('fanfare');
    HC.emit('travel', { zone: zid, dist });
    HC.saveNow();
  };
  HC.updateTravel = function (dt) {
    const T = HC.T;
    if (!T.on) return;
    if (T.pause > 0) { T.pause -= dt; if (T.pause <= 0 && HC.ui && HC.ui.closeTrader) HC.ui.closeTrader(); return; }
    T.t += dt;
    if (!T.evDone && T.t > T.dur * 0.45) travelEvent();
    if (T.t >= T.dur) HC.arrive();
  };

  // =====================================================================
  // drawing
  // =====================================================================
  const rr = HC.rr;
  function paintOf() {
    const p = HC.PAINTS.find((x) => x.id === HC.S.paint) || HC.PAINTS[0];
    if (p.rainbow) { const h = (performance.now() / 12) % 360; return { c1: `hsl(${h},80%,62%)`, c2: `hsl(${(h + 40) % 360},70%,45%)`, trim: '#fff' }; }
    return p;
  }

  function drawModule(c, id, l, x, y, now, slot) {
    c.save(); c.translate(x, y);
    const pop = HC.slotPop[slot] || 0;
    if (pop > 0) { const s = 1 + 0.35 * Math.sin(pop / 0.6 * Math.PI); c.scale(s, s); }
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (id === 'storage') {
      const n = Math.min(4, 1 + l);
      const pos = [[-9, 8], [9, 8], [-9, -9], [9, -9]];
      for (let i = 0; i < n; i++) {
        const p = pos[i]; c.fillStyle = i % 2 ? '#b97a3e' : '#d99a58'; c.strokeStyle = '#6e4624'; c.lineWidth = 1.6;
        rr(c, p[0] - 8.5, p[1] - 8.5, 17, 17, 3); c.fill(); c.stroke();
        c.strokeStyle = '#8a5a2e'; c.beginPath(); c.moveTo(p[0] - 8, p[1]); c.lineTo(p[0] + 8, p[1]); c.moveTo(p[0], p[1] - 8); c.lineTo(p[0], p[1] + 8); c.stroke();
      }
    } else if (id === 'workbench') {
      c.fillStyle = '#9a6a3a'; c.strokeStyle = '#5a3a1c'; c.lineWidth = 1.8; rr(c, -17, -9, 34, 22, 4); c.fill(); c.stroke();
      c.fillStyle = '#c28a52'; rr(c, -15, -8, 30, 10, 3); c.fill();
      c.strokeStyle = '#5a3a1c'; c.lineWidth = 3; c.beginPath(); c.moveTo(-9, -4); c.lineTo(-2, -13); c.stroke();
      c.fillStyle = '#9aa5b4'; rr(c, -14, -17, 10, 6, 2); c.fill();
      c.fillStyle = '#c9d2de'; c.beginPath(); c.moveTo(4, -2); c.lineTo(15, -2); c.lineTo(15, -10); c.closePath(); c.fill();
      if (l >= 2) { c.fillStyle = '#6a7686'; rr(c, -4, 4, 14, 6, 2); c.fill(); }
      if (l >= 3) { c.fillStyle = '#ffd84a'; c.beginPath(); c.arc(-12, 8, 3, 0, 7); c.fill(); }
    } else if (id === 'bed') {
      c.fillStyle = '#9a6a3a'; c.strokeStyle = '#5a3a1c'; c.lineWidth = 1.8; rr(c, -14, -18, 28, 36, 5); c.fill(); c.stroke();
      c.fillStyle = '#fff3dc'; rr(c, -11, -15, 22, 30, 4); c.fill();
      c.fillStyle = '#fff'; rr(c, -9, -14, 18, 8, 4); c.fill(); c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = 1; c.stroke();
      c.fillStyle = ['#ff8aa8', '#7ac8ff', '#ffd24a', '#9a8aff', '#7be07a'][l - 1]; rr(c, -11, -3, 22, 18, 4); c.fill();
      c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(-8, 2, 16, 2);
    } else if (id === 'furnace') {
      c.fillStyle = '#8d98a8'; c.strokeStyle = '#4e5868'; c.lineWidth = 1.8; rr(c, -16, -14, 32, 30, 6); c.fill(); c.stroke();
      c.fillStyle = '#6f7b8c'; rr(c, 6, -20, 8, 10, 2); c.fill();
      c.fillStyle = '#2a2024'; c.beginPath(); c.moveTo(-9, 12); c.lineTo(-9, 0); c.arc(0, 0, 9, Math.PI, 0); c.lineTo(9, 12); c.closePath(); c.fill();
      const f = 1 + 0.15 * Math.sin(now * 12);
      c.fillStyle = '#ff7a2a'; c.beginPath(); c.moveTo(-6, 12); c.quadraticCurveTo(-8, 0, 0, -6 * f); c.quadraticCurveTo(8, 0, 6, 12); c.closePath(); c.fill();
      c.fillStyle = '#ffd24a'; c.beginPath(); c.moveTo(-3, 12); c.quadraticCurveTo(-4, 4, 0, 0); c.quadraticCurveTo(4, 4, 3, 12); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)'; const so = (now * 20) % 20; c.beginPath(); c.arc(10, -24 - so * 0.6, 4 + so * 0.15, 0, 7); c.fill();
    } else if (id === 'turret') {
      c.fillStyle = '#6f7b8c'; c.strokeStyle = '#3e4858'; c.lineWidth = 1.8; c.beginPath(); c.arc(0, 0, 16, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#8d98a8'; c.beginPath(); c.arc(0, 0, 11, 0, 7); c.fill();
      let ang = -Math.PI / 2, kick = 0;
      const tr = HC.R.turrets; for (let i = 0; i < tr.length; i++) if (Math.abs(tr[i].x - x) < 2 && Math.abs(tr[i].y - y) < 2) { ang = tr[i].ang; kick = tr[i].kick > 0 ? 3 : 0; }
      c.rotate(ang);
      c.fillStyle = '#3e4858'; rr(c, -2 - kick, -4 - (l > 2 ? 1 : 0), 22, 8 + (l > 2 ? 2 : 0), 3); c.fill();
      if (l >= 4) { c.fillStyle = '#3e4858'; rr(c, -2 - kick, -9, 18, 4, 2); c.fill(); rr(c, -2 - kick, 5, 18, 4, 2); c.fill(); }
      c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(0, 0, 4, 0, 7); c.fill();
      if (kick) { c.fillStyle = 'rgba(255,230,120,0.9)'; c.beginPath(); c.arc(24, 0, 5, 0, 7); c.fill(); }
    } else if (id === 'walls') {
      const cols = ['#a58a62', '#9aa5b4', '#b6c2d0', '#d9b44a', '#8fd0e8'];
      c.fillStyle = cols[l - 1]; c.strokeStyle = '#4e5868'; c.lineWidth = 2; rr(c, -18, -18, 36, 36, 6); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.moveTo(-18, -2); c.lineTo(0, -18); c.moveTo(-18, 14); c.lineTo(14, -18); c.moveTo(-4, 18); c.lineTo(18, -4); c.stroke();
      c.fillStyle = '#4e5868'; [[-13, -13], [13, -13], [-13, 13], [13, 13]].forEach((p) => { c.beginPath(); c.arc(p[0], p[1], 2.2, 0, 7); c.fill(); });
    } else if (id === 'engine') {
      c.fillStyle = '#c9a14a'; c.strokeStyle = '#6e5420'; c.lineWidth = 1.8; rr(c, -17, -12, 34, 26, 8); c.fill(); c.stroke();
      c.fillStyle = '#e6c46a'; rr(c, -14, -10, 28, 8, 4); c.fill();
      for (let i = 0; i < 2; i++) {
        c.save(); c.translate(-8 + i * 16, 3); c.rotate(now * (i ? -2 : 2) * (0.6 + l * 0.2)); c.fillStyle = '#5a6678';
        for (let k = 0; k < 6; k++) { c.rotate(Math.PI / 3); rr(c, -1.8, -8.5, 3.6, 4.5, 1); c.fill(); }
        c.beginPath(); c.arc(0, 0, 5.5, 0, 7); c.fill(); c.fillStyle = '#c9d2de'; c.beginPath(); c.arc(0, 0, 2, 0, 7); c.fill(); c.restore();
      }
      c.fillStyle = '#7e8a9c'; rr(c, -3, -19, 6, 8, 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.5)'; const so = (now * 24) % 22; c.beginPath(); c.arc(0, -22 - so * 0.5, 3 + so * 0.18, 0, 7); c.fill();
    } else if (id === 'garden') {
      c.fillStyle = '#7a4e2a'; c.strokeStyle = '#4a2e18'; c.lineWidth = 1.8; rr(c, -17, -14, 34, 30, 5); c.fill(); c.stroke();
      c.fillStyle = '#5a3a20'; rr(c, -14, -11, 28, 24, 3); c.fill();
      const n = 3 + Math.min(2, l - 1);
      for (let i = 0; i < n; i++) {
        const px = -10 + (i % 3) * 10, py = -5 + Math.floor(i / 3) * 12 + (i === 4 ? 0 : 0);
        c.fillStyle = '#5cc255'; c.beginPath(); c.arc(px - 3, py, 4.5, 0, 7); c.arc(px + 3, py, 4.5, 0, 7); c.fill();
        c.fillStyle = l >= 2 ? '#ff6a8a' : '#8ae07a'; c.beginPath(); c.arc(px, py - 4, 2.6, 0, 7); c.fill();
      }
    } else if (id === 'lantern') {
      c.fillStyle = '#6a4a2a'; rr(c, -2, -4, 4, 20, 2); c.fill();
      c.fillStyle = '#ffe9a0'; c.strokeStyle = '#8a6a2a'; c.lineWidth = 2; rr(c, -8, -18, 16, 18, 5); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(0, -10, 3.4 + 0.6 * Math.sin(now * 6), 0, 7); c.fill();
      c.fillStyle = '#6a4a2a'; rr(c, -9, -21, 18, 4, 2); c.fill();
    }
    c.restore();
    // level pips
    c.fillStyle = '#ffd84a'; c.strokeStyle = 'rgba(80,50,10,.7)'; c.lineWidth = 1;
    for (let i = 0; i < l; i++) { c.beginPath(); c.arc(x - (l - 1) * 3.2 + i * 6.4, y + 19, 2.3, 0, 7); c.fill(); c.stroke(); }
  }

  function drawOx(c, cx, y, now, moving) {
    const S = S0(), eng = HC.modLevel('engine');
    c.save(); c.translate(cx, y);
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.fillStyle = 'rgba(20,20,40,0.22)'; c.beginPath(); c.ellipse(3, 8, 30, 36, 0, 0, 7); c.fill();
    // hitch bars
    c.strokeStyle = '#5a4a3a'; c.lineWidth = 5; c.beginPath(); c.moveTo(-16, 30); c.lineTo(-24, 52); c.moveTo(16, 30); c.lineTo(24, 52); c.stroke();
    // legs
    c.fillStyle = '#6a4a2a';
    const sw = moving ? Math.sin(now * 14) * 4 : 0;
    [[-16, -14, 1], [16, -14, -1], [-16, 14, -1], [16, 14, 1]].forEach((p) => { rr(c, p[0] - 5, p[1] - 8 + sw * p[2], 10, 18, 4); c.fill(); });
    // body
    c.fillStyle = '#b87a3a'; c.strokeStyle = '#6e4624'; c.lineWidth = 2.2; c.beginPath(); c.ellipse(0, 6, 22, 32, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#d9a05a'; c.beginPath(); c.ellipse(-4, 0, 11, 20, 0, 0, 7); c.fill();
    // brass plates + rivets
    c.fillStyle = '#d6b45a'; c.strokeStyle = '#7a5a20'; c.lineWidth = 1.6; rr(c, -14, 8, 28, 18, 6); c.fill(); c.stroke();
    c.fillStyle = '#7a5a20'; [[-9, 13], [9, 13], [-9, 22], [9, 22]].forEach((p) => { c.beginPath(); c.arc(p[0], p[1], 1.6, 0, 7); c.fill(); });
    // engine core
    const glow = eng > 0 ? 0.6 + 0.4 * Math.sin(now * 5) : 0.2;
    c.fillStyle = `rgba(255,${160 + eng * 15},60,${glow})`; c.beginPath(); c.arc(0, 17, 5 + eng * 0.7, 0, 7); c.fill();
    // smokestack
    c.fillStyle = '#6f7b8c'; c.strokeStyle = '#3e4858'; c.lineWidth = 1.6; rr(c, -5, -4, 10, 14, 3); c.fill(); c.stroke();
    for (let i = 0; i < 3; i++) {
      const ph = (now * (moving ? 1.6 : 0.8) + i / 3) % 1;
      c.fillStyle = `rgba(255,255,255,${0.55 * (1 - ph)})`; c.beginPath(); c.arc(-3 + ph * 8, -8 - ph * 28, 4 + ph * 7, 0, 7); c.fill();
    }
    // head
    const bob = moving ? Math.sin(now * 14) * 1.5 : Math.sin(now * 2) * 0.8;
    c.fillStyle = '#c98a48'; c.strokeStyle = '#6e4624'; c.lineWidth = 2.2; c.beginPath(); c.ellipse(0, -34 + bob, 15, 13, 0, 0, 7); c.fill(); c.stroke();
    // horns
    c.strokeStyle = '#f3e6c4'; c.lineWidth = 5; c.beginPath(); c.moveTo(-12, -40 + bob); c.quadraticCurveTo(-26, -42 + bob, -24, -54 + bob); c.moveTo(12, -40 + bob); c.quadraticCurveTo(26, -42 + bob, 24, -54 + bob); c.stroke();
    // ears
    c.fillStyle = '#b87a3a'; c.beginPath(); c.ellipse(-16, -32 + bob, 5, 3, -0.3, 0, 7); c.ellipse(16, -32 + bob, 5, 3, 0.3, 0, 7); c.fill();
    // snout + eyes
    c.fillStyle = '#e8b878'; c.beginPath(); c.ellipse(0, -41 + bob, 9, 6, 0, 0, 7); c.fill();
    c.fillStyle = '#4a2a14'; c.beginPath(); c.arc(-3, -41 + bob, 1.6, 0, 7); c.arc(3, -41 + bob, 1.6, 0, 7); c.fill();
    c.fillStyle = '#6ae0ff'; c.beginPath(); c.arc(-7, -34 + bob, 2.4, 0, 7); c.arc(7, -34 + bob, 2.4, 0, 7); c.fill();
    c.strokeStyle = '#d6b45a'; c.lineWidth = 2; c.beginPath(); c.arc(0, -37 + bob, 4, 0.3, Math.PI - 0.3); c.stroke();
    c.restore();
  }

  HC.drawCaravan = function (c, now, moving) {
    const S = S0(), p = paintOf(), cx = W.cx, spin = moving ? now * 10 : 0;
    // shadow
    c.fillStyle = 'rgba(20,20,40,0.24)'; rr(c, G.bx + 5, G.by + 9, G.bw, G.bh, 16); c.fill();
    drawOx(c, cx, G.by - 34, now, moving);
    // wheels
    const wy = [G.by + 22, G.by + G.bh - 22];
    for (let k = 0; k < 2; k++) for (const sd of [-1, 1]) {
      const x = sd < 0 ? G.bx - 5 : G.bx + G.bw + 5;
      c.fillStyle = '#3a2e28'; rr(c, x - 7, wy[k] - 20, 14, 40, 7); c.fill();
      c.strokeStyle = '#8a7a66'; c.lineWidth = 2; for (let i = 0; i < 5; i++) { const yy = wy[k] - 14 + ((i * 7 + spin * 4) % 28); c.beginPath(); c.moveTo(x - 7, yy); c.lineTo(x + 7, yy); c.stroke(); }
    }
    // body
    c.lineJoin = 'round';
    c.fillStyle = p.c2; rr(c, G.bx, G.by, G.bw, G.bh, 15); c.fill();
    c.fillStyle = p.c1; rr(c, G.bx + 4, G.by + 3, G.bw - 8, G.bh - 8, 12); c.fill();
    c.strokeStyle = p.trim; c.lineWidth = 3; rr(c, G.bx + 3, G.by + 2, G.bw - 6, G.bh - 6, 12); c.stroke();
    // slots
    for (let i = 0; i < 12; i++) {
      if (!HC.slotValid(i)) continue;
      const pos = HC.slotPos(i);
      c.fillStyle = 'rgba(255,255,255,0.16)'; c.strokeStyle = 'rgba(0,0,0,0.14)'; c.lineWidth = 1.5; rr(c, pos.x - 21, pos.y - 21, 42, 42, 7); c.fill(); c.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const s = S.grid.slots[i]; if (!s || !HC.slotValid(i)) continue;
      const pos = HC.slotPos(i); drawModule(c, s.m, s.l, pos.x, pos.y, now, i);
    }
    // tail lights
    c.fillStyle = '#ff5a5a'; c.beginPath(); c.arc(G.bx + 12, G.by + G.bh - 3, 3, 0, 7); c.arc(G.bx + G.bw - 12, G.by + G.bh - 3, 3, 0, 7); c.fill();
    // flag
    const fl = HC.FLAGS.find((f) => f.id === S.flag);
    if (fl && fl.c) {
      const px = G.bx + G.bw - 10, py = G.by + G.bh - 8, w = Math.sin(now * 4) * 3;
      c.strokeStyle = '#5a4a3a'; c.lineWidth = 3; c.beginPath(); c.moveTo(px, py); c.lineTo(px, py - 46); c.stroke();
      c.fillStyle = fl.c;
      if (fl.shape === 'star') { HC.starPath(c, px + 13, py - 38, 12, 5.5); c.fill(); }
      else if (fl.shape === 'heart') { c.beginPath(); c.moveTo(px + 2, py - 28); c.bezierCurveTo(px - 8, py - 38, px + 6, py - 50, px + 13 + w * 0.3, py - 40); c.bezierCurveTo(px + 20, py - 50, px + 32, py - 38, px + 2, py - 28); c.fill(); }
      else if (fl.shape === 'rainbow') { ['#ff5a5a', '#ffd24a', '#5cc8ff'].forEach((col, i) => { c.fillStyle = col; c.fillRect(px + 1, py - 46 + i * 6, 24 + w, 6); }); }
      else { c.beginPath(); c.moveTo(px, py - 46); c.lineTo(px + 26 + w, py - 40); c.lineTo(px, py - 32); c.closePath(); c.fill(); }
    }
    // damage: smoke
    if (S.damaged) {
      for (let i = 0; i < 3; i++) {
        const ph = (now * 0.8 + i / 3) % 1;
        c.fillStyle = `rgba(60,60,70,${0.5 * (1 - ph)})`; c.beginPath(); c.arc(G.bx + G.bw * (0.3 + 0.2 * i), G.by + 20 - ph * 40, 6 + ph * 10, 0, 7); c.fill();
      }
    }
    // hp bar
    const mx = HC.cavMax();
    if (S.cavHP < mx - 0.5) {
      const w = 70, x = cx - w / 2, y = G.by - 84, f = Math.max(0, S.cavHP) / mx;
      c.fillStyle = 'rgba(0,0,0,0.45)'; rr(c, x - 2, y - 2, w + 4, 9, 4); c.fill();
      c.fillStyle = f > 0.5 ? '#6ad06a' : f > 0.25 ? '#ffc23a' : '#ff6a5a'; rr(c, x, y, Math.max(4, w * f), 5, 2.5); c.fill();
    }
  };
  HC.updateSlotPops = function (dt) { for (let i = 0; i < 12; i++) if (HC.slotPop[i] > 0) HC.slotPop[i] -= dt; };
})();
