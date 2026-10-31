(function () {
  'use strict';
  const HC = window.HC, S0 = () => HC.S, W = HC.W;
  const TAU = Math.PI * 2;
  const rnd = Math.random;
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

  const R = (HC.R = {
    P: { x: 0, y: 0, vx: 0, vy: 0, fx: 0, fy: 1, swing: 0, swingAng: 0, swingKind: 'melee', gcd: 0, acd: 0, inv: 0, roll: 0, rollCd: 0, rdx: 0, rdy: 1, step: 0, hurt: 0, eatCd: 0, gnode: null, tool: 'hand', moving: false, r: 12, sleepT: 0 },
    mobs: [], projs: [], picks: [], chests: [], parts: [], texts: [], teles: [], turrets: [], lights: [],
    cam: { x: 0, y: 0 }, shake: 0, combo: { n: 0, t: 0 }, boss: null,
    night: false, spawnT: 3, chestT: 40, hudT: 0, qT: 0, saveT: 0, cavHurtT: 99, cavTextT: 0, fullT: 0,
    time: 0, view: { w: 390, h: 844 }, arrowT: 0, tradeSeed: 0,
  });
  for (let i = 0; i < 70; i++) R.mobs.push({ on: false });
  for (let i = 0; i < 120; i++) R.projs.push({ on: false });
  for (let i = 0; i < 160; i++) R.picks.push({ on: false });
  for (let i = 0; i < 700; i++) R.parts.push({ on: false });
  for (let i = 0; i < 70; i++) R.texts.push({ on: false });
  for (let i = 0; i < 24; i++) R.teles.push({ on: false });
  const P = R.P;
  const tmpN = [];

  HC.hpMul = (d) => (d <= 6 ? 1 + 0.2 * (d - 1) : 2 + 0.12 * (d - 6));
  HC.dmgMul = (d) => 1 + 0.08 * (Math.min(d, 20) - 1);

  // =====================================================================
  // FX: particles & floating text
  // =====================================================================
  function part() { for (let i = 0; i < R.parts.length; i++) if (!R.parts[i].on) return R.parts[i]; return null; }
  function emit(x, y, vx, vy, life, size, col, kind, o) {
    const p = part(); if (!p) return null;
    p.on = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.age = 0; p.size = size; p.col = col; p.kind = kind;
    p.g = (o && o.g) || 0; p.grow = (o && o.grow) || 0; p.rot = rnd() * TAU; p.vr = (rnd() - 0.5) * 8; p.screen = !!(o && o.screen); p.drag = (o && o.drag) || 0;
    return p;
  }
  const SPARK = ['#ffd84a', '#ff8ac0', '#8ae0ff', '#fff'];
  const fx = (HC.fx = {
    puff(x, y, big) {
      const n = big ? 22 : 10;
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU, s = 30 + rnd() * (big ? 120 : 60);
        emit(x, y, Math.cos(a) * s, Math.sin(a) * s - 10, 0.5 + rnd() * 0.4, 6 + rnd() * 8, 'rgba(255,255,255,0.9)', 3, { grow: 26, drag: 2.5 });
      }
      for (let i = 0; i < (big ? 16 : 7); i++) {
        const a = rnd() * TAU, s = 60 + rnd() * 120;
        emit(x, y, Math.cos(a) * s, Math.sin(a) * s - 40, 0.6 + rnd() * 0.4, 5 + rnd() * 4, SPARK[ri(0, 3)], 1, { g: 120, drag: 1 });
      }
    },
    hit(x, y, col) {
      for (let i = 0; i < 5; i++) { const a = rnd() * TAU; emit(x, y, Math.cos(a) * 90, Math.sin(a) * 90 - 30, 0.28 + rnd() * 0.2, 2.4 + rnd() * 2, col || '#fff', 0, { g: 260 }); }
    },
    chips(x, y, col, n) {
      for (let i = 0; i < n; i++) { const a = -Math.PI * (0.15 + rnd() * 0.7); emit(x, y - 8, Math.cos(a) * (50 + rnd() * 80), Math.sin(a) * (80 + rnd() * 80), 0.45 + rnd() * 0.25, 2.6 + rnd() * 2.4, col, 2, { g: 380 }); }
    },
    sparkle(x, y, n, spread) {
      for (let i = 0; i < n; i++) { const a = rnd() * TAU, s = rnd() * (spread || 70); emit(x, y, Math.cos(a) * s, Math.sin(a) * s - 30, 0.6 + rnd() * 0.5, 4 + rnd() * 4, SPARK[ri(0, 3)], 1, { g: 60, drag: 1.5 }); }
    },
    ring(x, y, col, r) { emit(x, y, 0, 0, 0.45, 6, col, 4, { grow: r * 2.2 }); },
    boom(x, y) {
      fx.ring(x, y, 'rgba(255,200,80,0.9)', 90); fx.puff(x, y, true);
      for (let i = 0; i < 18; i++) { const a = rnd() * TAU, s = 100 + rnd() * 180; emit(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.4 + rnd() * 0.3, 4 + rnd() * 4, rnd() < 0.5 ? '#ffb02a' : '#ff6a3a', 0, { drag: 2.2 }); }
    },
    confetti(n) {
      const cols = ['#ff5a78', '#ffd84a', '#5cc8ff', '#7be07a', '#b58cff', '#ff9a3c'];
      const w = R.view.w * HC.view.z;
      for (let i = 0; i < (n || 90); i++) emit(rnd() * w, -10 - rnd() * 80, (rnd() - 0.5) * 140, 80 + rnd() * 160, 1.6 + rnd() * 1.2, 5 + rnd() * 5, cols[ri(0, 5)], 2, { g: 90, screen: true, drag: 0.4 });
    },
    confettiBurst(x, y, n) { // screen-space burst from a point
      const cols = ['#ff5a78', '#ffd84a', '#5cc8ff', '#7be07a', '#b58cff'];
      for (let i = 0; i < n; i++) { const a = rnd() * TAU, s = 120 + rnd() * 260; emit(x, y, Math.cos(a) * s, Math.sin(a) * s - 120, 1.1 + rnd() * 0.7, 5 + rnd() * 4, cols[ri(0, 4)], 2, { g: 380, screen: true, drag: 1 }); }
    },
    text(x, y, txt, col, size, key, amt) {
      let t = null;
      if (key) for (let i = 0; i < R.texts.length; i++) { const q = R.texts[i]; if (q.on && q.key === key && q.age < 0.7) { q.amt += amt; q.txt = q.pre + '+' + q.amt + ' ' + q.suf; q.age = Math.min(q.age, 0.25); q.x = x; return q; } }
      for (let i = 0; i < R.texts.length; i++) if (!R.texts[i].on) { t = R.texts[i]; break; }
      if (!t) return null;
      t.on = true; t.x = x; t.y = y; t.txt = txt; t.col = col || '#fff'; t.size = size || 15; t.age = 0; t.life = 1.1; t.key = key || null; t.amt = amt || 0; t.pre = ''; t.suf = key ? txt.replace(/^\+\d+ /, '') : '';
      return t;
    },
  });
  HC.floatRes = function (res, n) { // aggregated "+3 wood"
    const name = HC.RES_INFO[res].name.toLowerCase();
    fx.text(P.x, P.y - 28, '+' + n + ' ' + name, '#fff', 15, 'r_' + res, n);
  };

  // =====================================================================
  // Runtime reset for a freshly generated zone
  // =====================================================================
  HC.initRuntime = function (spawnNearCaravan) {
    const S = S0();
    HC.updateCavGeom();
    R.mobs.forEach((m) => (m.on = false)); R.projs.forEach((p) => (p.on = false)); R.picks.forEach((p) => (p.on = false));
    R.parts.forEach((p) => (p.on = false)); R.texts.forEach((p) => (p.on = false)); R.teles.forEach((p) => (p.on = false));
    R.chests.length = 0; R.boss = null; R.combo.n = 0; R.combo.t = 0;
    const G = HC.G;
    if (spawnNearCaravan) { P.x = W.cx + 60; P.y = G.y1 + 36; }
    P.vx = P.vy = 0; P.roll = 0; P.inv = 1; P.gnode = null;
    R.cam.x = P.x - R.view.w / 2; R.cam.y = P.y - R.view.h / 2 + 60;
    if (S.cavHP < 0 || S.cavHP > HC.cavMax()) S.cavHP = HC.cavMax();
    HC.rebuildTurrets();
    // initial critters / day mobs
    const Z = W.Z;
    for (let i = 0; i < 8; i++) { const p = randSpot(300); if (p) spawnMob(Z.crit[ri(0, Z.crit.length - 1)], p.x, p.y); }
    const dayN = Math.min(2 + Z.dist, 7);
    for (let i = 0; i < dayN; i++) { const p = randSpot(520); if (p) spawnMob(Z.day[ri(0, Z.day.length - 1)], p.x, p.y); }
    R.chestT = 25;
    R.night = S.t >= HC.DAY_LEN;
  };
  function randSpot(minCav) {
    for (let k = 0; k < 12; k++) {
      const x = 120 + rnd() * (HC.WORLD - 240), y = 120 + rnd() * (HC.WORLD - 240);
      if (Math.hypot(x - W.cx, y - W.cy) > minCav) return { x, y };
    }
    return null;
  }

  // =====================================================================
  // Mobs
  // =====================================================================
  let mobId = 1;
  function spawnMob(type, x, y, o) {
    const def = HC.MOBS[type]; if (!def) return null;
    let m = null;
    for (let i = 0; i < R.mobs.length; i++) if (!R.mobs[i].on) { m = R.mobs[i]; break; }
    if (!m) return null;
    const d = S0().zone.dist, boss = def.boss;
    const hp = def.hp * (boss ? 0.8 + 0.2 * HC.hpMul(d) : HC.hpMul(d)) * (R.night && !boss ? 1.1 : 1) * ((o && o.hpMul) || 1);
    m.on = true; m.id = mobId++; m.type = type; m.def = def; m.kind = def.kind; m.x = x; m.y = y; m.vx = m.vy = 0;
    m.hp = m.maxhp = hp; m.r = def.r; m.dmg = def.dmg * HC.dmgMul(d); m.spd = def.spd * (0.92 + rnd() * 0.16);
    m.cd = 0.5 + rnd(); m.hurt = 0; m.anim = rnd() * 10; m.fx = 0; m.fy = 1; m.state = 'idle'; m.st = rnd() * 2; m.rush = !!(o && o.rush);
    m.angry = 0; m.scared = 0; m.phase = 'chase'; m.ai = 0; m.dirA = rnd() * TAU; m.lunge = 0; m.flag = 0; m.pop = 0.3; m.ex = 0; m.ey = 0;
    return m;
  }
  HC.spawnMob = spawnMob;

  function hostileCount() { let n = 0; for (let i = 0; i < R.mobs.length; i++) { const m = R.mobs[i]; if (m.on && m.kind !== 'critter' && m.kind !== 'boss') n++; } return n; }
  function critterCount() { let n = 0; for (let i = 0; i < R.mobs.length; i++) { const m = R.mobs[i]; if (m.on && m.kind === 'critter') n++; } return n; }

  function edgeSpot(cx, cy, r0, r1) {
    for (let k = 0; k < 10; k++) {
      const a = rnd() * TAU, r = r0 + rnd() * (r1 - r0);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (x > 80 && y > 80 && x < HC.WORLD - 80 && y < HC.WORLD - 80) return { x, y };
    }
    return null;
  }

  function updateSpawner(dt) {
    R.spawnT -= dt;
    if (R.spawnT > 0) return;
    const S = S0(), Z = W.Z, d = S.zone.dist;
    if (R.night) {
      R.spawnT = HC.clamp(4.2 - 0.18 * d, 1.6, 4.2);
      const cap = Math.min(22, Math.round(5 + 1.6 * Math.min(d, 10)));
      if (hostileCount() >= cap) return;
      const p = edgeSpot(W.cx, W.cy, 520, 640); if (!p) return;
      const type = Z.night[ri(0, Z.night.length - 1)];
      const grp = d > 2 ? ri(1, 2) : 1;
      for (let i = 0; i < grp; i++) spawnMob(type, p.x + rnd() * 40, p.y + rnd() * 40, { rush: true });
    } else {
      R.spawnT = 3.5;
      if (critterCount() < 8) {
        const p = edgeSpot(P.x, P.y, 480, 680);
        if (p) spawnMob(Z.crit[ri(0, Z.crit.length - 1)], p.x, p.y);
      }
      if (hostileCount() < Math.min(2 + d, 7)) {
        const p = edgeSpot(P.x, P.y, 480, 700);
        if (p && Math.hypot(p.x - W.cx, p.y - W.cy) > 380) spawnMob(Z.day[ri(0, Z.day.length - 1)], p.x, p.y);
      }
    }
  }

  function dropRes(res, amt, x, y, mag) {
    amt = Math.max(1, Math.round(amt));
    const parts = Math.min(amt, amt > 4 ? 3 : 2);
    let left = amt;
    for (let i = 0; i < parts; i++) {
      const n = i === parts - 1 ? left : Math.max(1, Math.round(amt / parts)); left -= n;
      if (n <= 0) continue;
      const p = pick(); if (!p) { HC.addCarry(res, n); continue; }
      const a = rnd() * TAU, s = 50 + rnd() * 80;
      p.on = true; p.type = 'res'; p.res = res; p.amt = n; p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - 30; p.age = 0; p.mag = !!mag; p.life = 70;
    }
  }
  function pick() { for (let i = 0; i < R.picks.length; i++) if (!R.picks[i].on) return R.picks[i]; return null; }
  function dropXP(xp, x, y) {
    const n = HC.clamp(Math.round(xp / 6), 1, 5);
    for (let i = 0; i < n; i++) {
      const p = pick(); if (!p) { HC.addXP(xp / n); continue; }
      const a = rnd() * TAU, s = 40 + rnd() * 90;
      p.on = true; p.type = 'xp'; p.res = null; p.amt = xp / n; p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - 40; p.age = 0; p.mag = false; p.life = 30;
    }
  }
  HC.dropRes = dropRes; HC.dropXP = dropXP;

  function killMob(m, byTurret) {
    const S = S0(), def = m.def, d = S.zone.dist;
    m.on = false;
    fx.puff(m.x, m.y, def.boss);
    HC.audio.play('poof');
    fx.text(m.x, m.y - 24, def.boss ? 'Poof!' : def.kind === 'ranged' || def.raid ? 'Ouch!' : ['Poof!', 'Pop!', 'Bye!'][ri(0, 2)], '#fff', def.boss ? 24 : 16);
    if (def.loot) {
      const luck = 1 + 0.12 * HC.perk('loot');
      for (let i = 0; i < def.loot.length; i++) {
        const l = def.loot[i];
        if (rnd() < Math.min(1, l[3] * luck)) dropRes(l[0], ri(l[1], l[2]) * (1 + 0.1 * (d - 1)), m.x, m.y);
      }
      if (rnd() < 0.07) { const p = pick(); if (p) { p.on = true; p.type = 'heart'; p.res = null; p.amt = 25; p.x = m.x; p.y = m.y; p.vx = 0; p.vy = -60; p.age = 0; p.mag = false; p.life = 25; } }
    }
    dropXP(def.xp * (1 + 0.1 * (d - 1)), m.x, m.y);
    S.stats.kills++;
    // combo
    R.combo.n++; R.combo.t = 3.4;
    if (R.combo.n > S.stats.bestCombo) S.stats.bestCombo = R.combo.n;
    if (R.combo.n >= 3 && (R.combo.n % 3 === 0 || R.combo.n >= 8)) {
      fx.text(P.x, P.y - 44, 'x' + R.combo.n + ' COMBO!', '#ffd84a', 20);
      HC.addXP(R.combo.n * 2);
    }
    HC.emit('kill', { type: m.type });
    if (def.boss) bossDown(m);
  }

  function bossDown(m) {
    const S = S0(), id = m.type;
    R.boss = null;
    S.bossDown[S.zone.id] = true;
    S.stats.bosses++;
    W.lair = null;
    HC.audio.play('boom'); HC.audio.play('fanfare');
    fx.boom(m.x, m.y); fx.confettiBurst(R.view.w * HC.view.z / 2, 260, 80);
    for (let i = 0; i < 14; i++) {
      const res = ['scrap', 'food', 'wood', 'stone', 'metal'][i % 5];
      dropRes(res, 4 + ri(0, 4), m.x + (rnd() - 0.5) * 60, m.y + (rnd() - 0.5) * 60, true);
    }
    dropXP(m.def.xp * 0.5, m.x, m.y);
    R.shake = 14;
    HC.emit('boss', { id });
    HC.banner('🏆 ' + m.def.name + ' defeated!', 'Huge rewards!');
  }

  function damageMob(m, dmg, crit, srcX, srcY, byTurret) {
    if (!m.on) return;
    m.hp -= dmg; m.hurt = 0.14;
    HC.audio.play('hit');
    fx.hit(m.x, m.y - 4, crit ? '#ffd84a' : '#fff');
    fx.text(m.x + (rnd() - 0.5) * 14, m.y - m.r - 10, crit ? Math.round(dmg) + '!' : '' + Math.round(dmg), crit ? '#ffd84a' : '#fff', crit ? 20 : 14);
    if (crit) fx.text(m.x, m.y - m.r - 28, 'CRIT!', '#ff7a3a', 13);
    if (m.kind !== 'boss') {
      const dx = m.x - srcX, dy = m.y - srcY, dd = Math.hypot(dx, dy) || 1;
      m.vx += (dx / dd) * 120; m.vy += (dy / dd) * 120;
    }
    if (m.kind === 'critter') { m.angry = 5; m.scared = 3; }
    if (m.hp <= 0) killMob(m, byTurret);
  }

  // distance to the caravan (set nearest point in HC.cnx/cny)
  function updateMob(m, dt) {
    const S = S0(), G = HC.G;
    m.anim += dt; m.cd -= dt; if (m.hurt > 0) m.hurt -= dt; if (m.pop > 0) m.pop -= dt; if (m.lunge > 0) m.lunge -= dt;
    if (m.angry > 0) m.angry -= dt; if (m.scared > 0) m.scared -= dt;
    // friction on knockback
    m.vx *= Math.pow(0.02, dt); m.vy *= Math.pow(0.02, dt);
    let mx = 0, my = 0;
    const px = P.x - m.x, py = P.y - m.y, pd = Math.hypot(px, py) || 1;
    if (m.kind === 'boss') { updateBoss(m, dt, px, py, pd); return; }
    if (m.kind === 'critter') {
      m.st -= dt;
      if (m.angry > 0 && m.def.charge) { // snortle charges
        mx = px / pd * 1.25; my = py / pd * 1.25;
        if (pd < m.r + P.r + 4 && m.cd <= 0) { m.cd = 1.2; m.lunge = 0.2; hurtPlayer(m.dmg); }
      } else if (pd < 130) { mx = -px / pd * 1.2; my = -py / pd * 1.2; m.state = 'flee'; }
      else {
        if (m.st <= 0) { m.st = 1.2 + rnd() * 2.4; m.dirA = rnd() * TAU; m.state = rnd() < 0.4 ? 'idle' : 'wander'; }
        if (m.state === 'wander') { mx = Math.cos(m.dirA) * 0.4; my = Math.sin(m.dirA) * 0.4; }
      }
      m.x += (mx * m.spd + m.vx) * dt; m.y += (my * m.spd + m.vy) * dt;
    } else {
      const lant = HC.modLevel('lantern');
      const dc = HC.cavDist(m.x, m.y), cnx = HC.cnx, cny = HC.cny;
      let tx = 0, ty = 0, mode = 'idle';
      // lantern scares weak mobs
      if (m.def.weak && lant > 0 && Math.hypot(m.x - W.cx, m.y - W.cy) < 110 + 40 * lant) {
        if (m.scared <= 0) { m.scared = 1.2; if (rnd() < 0.3) fx.text(m.x, m.y - 20, '!', '#ffd84a', 16); }
      }
      if (m.scared > 0 && m.def.weak && lant > 0) {
        const ax = m.x - W.cx, ay = m.y - W.cy, ad = Math.hypot(ax, ay) || 1; tx = ax / ad; ty = ay / ad; mode = 'scared';
      } else if (pd < m.def.aggro) { tx = px / pd; ty = py / pd; mode = 'player'; }
      else if (m.def.raid || m.rush) {
        const cx = cnx - m.x, cy = cny - m.y, cd = Math.hypot(cx, cy) || 1; tx = cx / cd; ty = cy / cd; mode = 'cav';
      } else {
        m.st -= dt; if (m.st <= 0) { m.st = 1.5 + rnd() * 2.5; m.dirA = rnd() * TAU; m.state = rnd() < 0.5 ? 'idle' : 'wander'; }
        if (m.state === 'wander') { tx = Math.cos(m.dirA) * 0.35; ty = Math.sin(m.dirA) * 0.35; }
      }
      m.fx = tx || m.fx; m.fy = ty || m.fy;
      if (m.kind === 'melee') {
        let reach = false;
        if (mode === 'player') reach = pd < m.r + P.r + 4; else if (mode === 'cav') reach = dc < m.r + 6;
        if (reach) {
          tx = ty = 0;
          if (m.cd <= 0) {
            m.cd = 1.1; m.lunge = 0.22;
            if (mode === 'player') hurtPlayer(m.dmg); else damageCaravan(m.dmg);
          }
        }
      } else { // ranged
        const td = mode === 'player' ? pd : mode === 'cav' ? dc : 999;
        if (mode !== 'idle' && mode !== 'scared') {
          if (td < m.def.range * 0.8) { tx = -tx * 0.5; ty = -ty * 0.5; } else if (td < m.def.range) { tx = ty * 0.4; ty = -tx * 0.4; }
          if (td < m.def.range * 1.15 && m.cd <= 0) {
            m.cd = m.def.cd * (0.9 + rnd() * 0.2); m.lunge = 0.2;
            const sx = mode === 'player' ? P.x : cnx, sy = mode === 'player' ? P.y : cny;
            shoot('e', m.x, m.y, sx, sy, 190, m.dmg, m.def.fire ? 'fire' : 'rock', 0);
          }
        }
      }
      const sp = m.spd * (mode === 'scared' ? 1.15 : 1);
      m.x += (tx * sp + m.vx) * dt; m.y += (ty * sp + m.vy) * dt;
    }
    m.x = HC.clamp(m.x, 50, HC.WORLD - 50); m.y = HC.clamp(m.y, 50, HC.WORLD - 50);
    // keep out of the caravan
    pushOutRect(m, G, m.r);
    // cleanup far-away stragglers
    if (!m.rush && m.kind !== 'boss' && (m.x - P.x) * (m.x - P.x) + (m.y - P.y) * (m.y - P.y) > 1500 * 1500) m.on = false;
  }

  // ---------- bosses ----------
  function startTele(x, y, r, dur, dmg, fxk, line) {
    for (let i = 0; i < R.teles.length; i++) {
      const t = R.teles[i];
      if (!t.on) { t.on = true; t.x = x; t.y = y; t.r = r; t.t = 0; t.dur = dur; t.dmg = dmg; t.fx = fxk || 'slam'; t.line = !!line; return t; }
    }
    return null;
  }
  function updateBoss(m, dt, px, py, pd) {
    const S = S0(), id = m.type;
    m.st -= dt;
    if (m.phase === 'chase') {
      let want = 0;
      if (id === 'warlord') { want = pd > 260 ? 1 : pd < 170 ? -0.6 : 0; if (!want) { m.x += (-py / pd) * m.spd * 0.5 * dt; m.y += (px / pd) * m.spd * 0.5 * dt; } }
      else want = pd > m.r + 40 ? 1 : 0;
      m.x += (px / pd) * want * m.spd * dt; m.y += (py / pd) * want * m.spd * dt;
      m.fx = px / pd; m.fy = py / pd;
      if (pd < m.r + P.r && m.cd <= 0 && id !== 'warlord') { m.cd = 1.2; m.lunge = 0.25; hurtPlayer(m.dmg * 0.6); }
      if (m.st <= 0) beginAttack(m, px, py, pd);
    } else if (m.phase === 'tele') {
      if (m.st <= 0) { endAttack(m); }
    } else if (m.phase === 'charge') {
      m.x += m.cdx * 440 * dt; m.y += m.cdy * 440 * dt; m.lunge = 0.1;
      if (!m.hitDone && pd < m.r + P.r + 4) { m.hitDone = true; hurtPlayer(m.dmg * 1.1); }
      if (Math.random() < 0.5) fx.puff(m.x, m.y + 10, false);
      if (m.st <= 0) { m.phase = 'chase'; m.st = 1.4; }
    } else if (m.phase === 'wind') {
      if (m.st <= 0) { // fire
        if (id === 'warlord') { const a0 = Math.atan2(py, px); for (let k = -2; k <= 2; k++) { const a = a0 + k * 0.26; shoot('e', m.x, m.y, m.x + Math.cos(a) * 100, m.y + Math.sin(a) * 100, 230, m.dmg * 0.7, 'rock', 0); } HC.audio.play('shoot'); }
        else if (id === 'golem') { for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU + m.ai; shoot('e', m.x, m.y, m.x + Math.cos(a) * 100, m.y + Math.sin(a) * 100, 190, m.dmg * 0.5, 'fire', 0); } HC.audio.play('boom'); fx.ring(m.x, m.y, 'rgba(255,120,40,0.8)', 80); }
        m.phase = 'chase'; m.st = 1.3;
      }
    }
    m.x = HC.clamp(m.x, 60, HC.WORLD - 60); m.y = HC.clamp(m.y, 60, HC.WORLD - 60);
    // summon thresholds
    const frac = m.hp / m.maxhp;
    if (id === 'boar' && frac < 0.5 && !(m.flag & 1)) { m.flag |= 1; summon(m, 'snortle', 2); }
    if (id === 'warlord' && frac < 0.66 && !(m.flag & 1)) { m.flag |= 1; summon(m, 'raider', 2); }
    if (id === 'warlord' && frac < 0.33 && !(m.flag & 2)) { m.flag |= 2; summon(m, 'sling', 2); }
    if (id === 'golem' && frac < 0.5 && !(m.flag & 1)) { m.flag |= 1; summon(m, 'imp', 2); }
  }
  function summon(m, type, n) {
    fx.text(m.x, m.y - m.r - 30, 'Reinforcements!', '#ff7a3a', 17);
    for (let i = 0; i < n; i++) { const a = rnd() * TAU; const c = spawnMob(type, m.x + Math.cos(a) * 80, m.y + Math.sin(a) * 80, { hpMul: 0.7 }); if (c) fx.puff(c.x, c.y); }
    HC.audio.play('horn');
  }
  function beginAttack(m, px, py, pd) {
    const id = m.type, dm = m.dmg;
    m.ai++;
    const seq = id === 'boar' ? ['slam', 'charge', 'slam', 'charge'] : id === 'warlord' ? ['barrage', 'volley', 'barrage', 'volley'] : ['slam', 'ring', 'lava', 'ring'];
    const a = seq[m.ai % seq.length];
    m.hitDone = false;
    if (a === 'slam') { const r = id === 'golem' ? 112 : 92; startTele(m.x, m.y, r, 1.0, dm * 1.1, 'slam'); m.phase = 'tele'; m.st = 1.05; m.atk = 'slam'; m.atkR = r; }
    else if (a === 'charge') {
      const dx = px / pd, dy = py / pd; m.cdx = dx; m.cdy = dy; m.fx = dx; m.fy = dy;
      const t = startTele(m.x, m.y, 50, 0.9, 0, 'line', true); if (t) { t.x2 = m.x + dx * 330; t.y2 = m.y + dy * 330; }
      m.phase = 'tele'; m.st = 0.9; m.atk = 'charge';
    } else if (a === 'barrage') {
      const dx = px / pd, dy = py / pd;
      for (let k = 0; k < 3; k++) startTele(P.x + dx * k * 60 + (rnd() - 0.5) * 40, P.y + dy * k * 60 + (rnd() - 0.5) * 40, 62, 0.9 + k * 0.35, dm * 1.1, 'fire');
      m.phase = 'tele'; m.st = 1.9; m.atk = 'barrage';
    } else if (a === 'volley') { m.phase = 'wind'; m.st = 0.55; HC.audio.play('horn'); }
    else if (a === 'ring') { m.phase = 'wind'; m.st = 0.9; startTele(m.x, m.y, 44, 0.9, 0, 'ringmark'); }
    else if (a === 'lava') {
      for (let k = 0; k < 3; k++) startTele(P.x + (rnd() - 0.5) * 220, P.y + (rnd() - 0.5) * 220, 64, 1.1 + k * 0.25, dm, 'fire');
      m.phase = 'tele'; m.st = 1.9; m.atk = 'lava';
    }
  }
  function endAttack(m) {
    if (m.atk === 'charge') { m.phase = 'charge'; m.st = 0.55; HC.audio.play('roar'); }
    else { m.phase = 'chase'; m.st = 1.2; }
    m.atk = null;
  }
  function updateTeles(dt) {
    for (let i = 0; i < R.teles.length; i++) {
      const t = R.teles[i]; if (!t.on) continue;
      t.t += dt;
      if (t.t >= t.dur) {
        t.on = false;
        if (t.fx === 'line' || t.fx === 'ringmark') continue;
        fx.ring(t.x, t.y, t.fx === 'fire' ? 'rgba(255,120,40,0.85)' : 'rgba(255,255,255,0.8)', t.r);
        fx.puff(t.x, t.y, t.r > 80); HC.audio.play('boom'); R.shake = Math.max(R.shake, 6);
        if (Math.hypot(P.x - t.x, P.y - t.y) < t.r + P.r) hurtPlayer(t.dmg);
      }
    }
  }

  // ---------- projectiles ----------
  function shoot(team, x, y, tx, ty, spd, dmg, kind, pierce, owner) {
    for (let i = 0; i < R.projs.length; i++) {
      const p = R.projs[i];
      if (!p.on) {
        const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy) || 1;
        p.on = true; p.team = team; p.x = x; p.y = y; p.vx = dx / d * spd; p.vy = dy / d * spd; p.dmg = dmg; p.kind = kind; p.life = 1.6;
        p.pierce = pierce || 0; p.h1 = 0; p.h2 = 0; p.owner = owner || 0; p.r = kind === 'bomb' ? 6 : 4; p.crit = false;
        p.tx = tx; p.ty = ty; p.t0 = 0; p.fl = d / spd;
        return p;
      }
    }
    return null;
  }
  HC.shoot = shoot;
  function bombBoom(x, y) {
    const S = S0(), dmg = 60 * (1 + 0.15 * HC.perk('dmg'));
    fx.boom(x, y); HC.audio.play('boom'); R.shake = Math.max(R.shake, 7);
    for (let i = 0; i < R.mobs.length; i++) {
      const m = R.mobs[i]; if (!m.on) continue;
      if (Math.hypot(m.x - x, m.y - y) < 100 + m.r) damageMob(m, dmg, false, x, y);
    }
  }
  function updateProjs(dt) {
    const G = HC.G;
    for (let i = 0; i < R.projs.length; i++) {
      const p = R.projs[i]; if (!p.on) continue;
      p.life -= dt; p.t0 += dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'bomb') { if (p.t0 >= p.fl) { p.on = false; bombBoom(p.tx, p.ty); } continue; }
      if (p.kind === 'energy' || p.kind === 'fire') { if (Math.random() < 0.6) emit(p.x, p.y, (rnd() - 0.5) * 20, (rnd() - 0.5) * 20, 0.3, 3, p.kind === 'fire' ? '#ff9a3a' : '#7be8ff', 0, { drag: 2 }); }
      if (p.life <= 0 || p.x < 0 || p.y < 0 || p.x > HC.WORLD || p.y > HC.WORLD) { p.on = false; continue; }
      if (p.team === 'p') {
        for (let j = 0; j < R.mobs.length; j++) {
          const m = R.mobs[j]; if (!m.on || m.id === p.h1 || m.id === p.h2) continue;
          const dx = m.x - p.x, dy = m.y - p.y, rr = m.r + p.r;
          if (dx * dx + dy * dy < rr * rr) {
            damageMob(m, p.dmg, p.crit, p.x - p.vx * 0.05, p.y - p.vy * 0.05, p.owner === 1);
            if (p.pierce > 0) { p.pierce--; if (!p.h1) p.h1 = m.id; else p.h2 = m.id; } else { p.on = false; }
            break;
          }
        }
      } else {
        const dx = P.x - p.x, dy = P.y - p.y, rr = P.r + p.r + 2;
        if (dx * dx + dy * dy < rr * rr) { hurtPlayer(p.dmg); fx.hit(p.x, p.y, '#ff9a3a'); p.on = false; continue; }
        if (p.x > G.x0 && p.x < G.x1 && p.y > G.y0 + 60 && p.y < G.y1) { damageCaravan(p.dmg * 0.8); fx.hit(p.x, p.y, '#ffb02a'); p.on = false; }
      }
    }
  }

  // ---------- pickups ----------
  function updatePicks(dt) {
    const S = S0();
    for (let i = 0; i < R.picks.length; i++) {
      const p = R.picks[i]; if (!p.on) continue;
      p.age += dt; p.life -= dt;
      const dx = P.x - p.x, dy = P.y - p.y, d = Math.hypot(dx, dy) || 1;
      let blocked = false;
      if (p.type === 'res' && HC.carryCount() >= HC.carryCap()) blocked = true;
      const magnet = p.mag ? 9999 : 70 + (HC.perk('loot') ? 10 : 0);
      if (!blocked && p.age > 0.22 && d < magnet) {
        const sp = 260 + (p.age > 0.5 ? 220 : 0);
        p.vx += (dx / d) * sp * dt * 6; p.vy += (dy / d) * sp * dt * 6;
        const v = Math.hypot(p.vx, p.vy), mx = 420; if (v > mx) { p.vx *= mx / v; p.vy *= mx / v; }
      } else { p.vx *= Math.pow(0.05, dt); p.vy *= Math.pow(0.05, dt); }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (d < 18 && p.age > 0.18) {
        if (p.type === 'res') {
          if (blocked) { if (R.fullT <= 0) { R.fullT = 3; fx.text(P.x, P.y - 30, 'Bag full! Visit caravan', '#ffb0b0', 14); } continue; }
          const got = HC.addCarry(p.res, p.amt);
          if (got > 0) { HC.floatRes(p.res, got); HC.audio.play('pickup'); S.stats.gathered += got; HC.emit('gather', { res: p.res, n: got }); }
          p.on = false;
        } else if (p.type === 'xp') { HC.addXP(p.amt); p.on = false; HC.audio.play('pickup'); }
        else if (p.type === 'heart') { S.hp = Math.min(HC.maxHP(), S.hp + p.amt); fx.text(P.x, P.y - 30, '+' + p.amt + ' HP', '#ff7a8a', 15); fx.sparkle(P.x, P.y, 6); HC.audio.play('pickup'); p.on = false; }
      } else if (p.life <= 0) {
        if (p.type === 'xp') HC.addXP(p.amt);
        p.on = false;
      }
    }
  }

  // ---------- chests ----------
  HC.spawnChest = function (gold) {
    let p = null;
    for (let k = 0; k < 14 && !p; k++) {
      const q = edgeSpot(W.cx, W.cy, gold ? 250 : 320, gold ? 420 : 760);
      if (!q) continue;
      HC.queryNodes(q.x, q.y, 60, tmpN);
      let ok = true; for (let i = 0; i < tmpN.length; i++) if (Math.hypot(tmpN[i].x - q.x, tmpN[i].y - q.y) < 50) ok = false;
      if (ok && !(Math.abs(q.x - W.cx) < 130 && Math.abs(q.y - W.cy) < 170)) p = q;
    }
    if (!p) return;
    R.chests.push({ x: p.x, y: p.y, gold: !!gold, t: 0, open: 0 });
    fx.sparkle(p.x, p.y, 10);
  };
  function openChest(c) {
    const S = S0(), d = S.zone.dist, sc = 1 + 0.15 * (d - 1), g = c.gold ? 3 : 1;
    const pool = ['wood', 'stone', 'scrap', 'food'];
    const picks = [pool[ri(0, 3)], pool[ri(0, 3)]];
    const out = {};
    picks.forEach((r) => (out[r] = (out[r] || 0) + Math.round(ri(6, 12) * sc * g)));
    if (c.gold || rnd() < 0.2) out.metal = Math.round(ri(2, 4) * sc * g);
    if (c.gold) out.fuel = Math.round(4 * sc);
    let n = 0;
    for (const r in out) { HC.addStore(r, out[r]); fx.text(c.x, c.y - 20 - n * 17, '+' + out[r] + ' ' + HC.RES_INFO[r].name.toLowerCase(), '#fff', 15); n++; }
    HC.addXP((c.gold ? 80 : 25) * sc);
    HC.audio.play('chest'); fx.sparkle(c.x, c.y, 22, 110);
    fx.confettiBurst(R.view.w * HC.view.z / 2, 400, c.gold ? 50 : 24);
    S.stats.chests++;
    HC.emit('chest', {});
    HC.toast((c.gold ? '🎁 Lucky Crate! ' : '🎁 Treasure! ') + Object.keys(out).map((r) => '+' + out[r] + ' ' + r).join(' '));
  }
  function updateChests(dt) {
    R.chestT -= dt;
    if (R.chestT <= 0) { R.chestT = 70 + rnd() * 50; if (R.chests.filter((c) => !c.gold).length < 2) HC.spawnChest(false); }
    for (let i = R.chests.length - 1; i >= 0; i--) {
      const c = R.chests[i]; c.t += dt;
      if (c.open > 0) { c.open -= dt; if (c.open <= 0) R.chests.splice(i, 1); continue; }
      if (Math.hypot(P.x - c.x, P.y - c.y) < 36) { c.open = 0.4; openChest(c); }
    }
  }

  // ---------- caravan damage ----------
  function damageCaravan(d) {
    const S = S0();
    d *= 1 - Math.min(0.5, 0.06 * HC.modSum('walls'));
    R.cavHurtT = 0;
    if (S.cavHP > 0) S.cavHP = Math.max(0, S.cavHP - d);
    if (R.cavTextT <= 0) { R.cavTextT = 0.5; fx.text(W.cx + (rnd() - 0.5) * 60, HC.G.y0 + 90, '-' + Math.round(d), '#ff8a7a', 14); HC.audio.play('hit'); }
    if (S.cavHP <= 0 && !S.damaged) {
      S.damaged = true;
      HC.banner('🔧 Caravan damaged!', 'Modules at half power — repair with scrap');
      HC.audio.play('hurt');
    }
  }
  HC.damageCaravan = damageCaravan;

  // ---------- player ----------
  function hurtPlayer(dmg) {
    const S = S0();
    if (P.inv > 0 || P.roll > 0 || P.sleepT > 0) return;
    const ar = HC.ARMOR[S.equip.armor] || 0;
    dmg = Math.max(1, Math.round(dmg * (1 - ar)));
    S.hp -= dmg; P.inv = 0.65; P.hurt = 0.3; R.shake = Math.max(R.shake, 4);
    fx.text(P.x, P.y - 30, '-' + dmg, '#ff6a6a', 17); HC.audio.play('hurt');
    if (S.hp <= 0) die();
  }
  HC.hurtPlayer = hurtPlayer;
  function die() {
    const S = S0(), G = HC.G;
    S.stats.deaths++;
    fx.puff(P.x, P.y, true);
    let lost = 0;
    for (let i = 0; i < 6; i++) { const r = HC.RES[i], l = Math.floor(S.carry[r] * 0.2); S.carry[r] -= l; lost += l; }
    P.x = W.cx; P.y = G.y1 + 50; P.vx = P.vy = 0; P.inv = 2.5; P.roll = 0;
    S.hp = Math.round(HC.maxHP() * 0.6); S.hunger = Math.max(S.hunger, 45);
    fx.puff(P.x, P.y); fx.text(P.x, P.y - 30, 'Zzz...', '#fff', 18);
    for (let i = 0; i < R.mobs.length; i++) { const m = R.mobs[i]; if (m.on && m.kind !== 'boss') { const dx = m.x - P.x, dy = m.y - P.y, d = Math.hypot(dx, dy) || 1; if (d < 220) { m.x += dx / d * (240 - d); m.y += dy / d * (240 - d); } } }
    if (R.boss) { R.boss.hp = R.boss.maxhp; R.boss.phase = 'chase'; R.boss.st = 2; }
    R.teles.forEach((t) => (t.on = false));
    HC.banner('😴 You woke up at the caravan', lost ? `Dropped ${lost} carried items` : 'Nothing lost!');
  }

  function toolFor(type) {
    const S = S0();
    if (type === 'tree') return HC.TOOL[S.equip.axe] || HC.HAND;
    if (type === 'rock' || type === 'scrap') return HC.TOOL[S.equip.pick] || HC.HAND;
    return { pow: 2, yld: 1 };
  }
  function harvest(n) {
    const S = S0(), d = NODE_D(n.type), tool = toolFor(n.type);
    let amt = ri(d.amt[0], d.amt[1]) * tool.yld * (1 + 0.12 * HC.perk('loot')) * W.nodeYield;
    amt = Math.max(1, Math.round(amt));
    dropRes(d.res, amt, n.x, n.y - 6, true);
    // bonus metal from rocks/scrap farther out
    const dist = S.zone.dist;
    if ((n.type === 'rock' && dist >= 3 && rnd() < 0.14) || (n.type === 'scrap' && dist >= 2 && rnd() < 0.18)) dropRes('metal', ri(1, 2), n.x, n.y - 6, true);
    HC.killNode(n);
    fx.chips(n.x, n.y - 10, n.type === 'rock' ? '#aab3c0' : n.type === 'tree' ? '#7bc25a' : n.type === 'scrap' ? '#9aa5b4' : '#ff6a8a', 8);
    HC.addXP(2, true);
  }
  const NODE_D = (t) => HC.NODE[t];

  function pushOutRect(e, G, r) {
    const x0 = G.x0 - r, x1 = G.x1 + r, y0 = G.y0 - r, y1 = G.y1 + r;
    if (e.x > x0 && e.x < x1 && e.y > y0 && e.y < y1) {
      const l = e.x - x0, rr = x1 - e.x, t = e.y - y0, b = y1 - e.y, m = Math.min(l, rr, t, b);
      if (m === l) e.x = x0; else if (m === rr) e.x = x1; else if (m === t) e.y = y0; else e.y = y1;
    }
  }

  function updatePlayer(dt) {
    const S = S0(), G = HC.G;
    if (P.inv > 0) P.inv -= dt; if (P.hurt > 0) P.hurt -= dt; if (P.swing > 0) P.swing -= dt;
    if (P.rollCd > 0) P.rollCd -= dt;
    // --- movement
    const iv = HC.input.vec();
    let mx = iv.x, my = iv.y;
    const mag = Math.min(1, Math.hypot(mx, my));
    if (P.roll > 0) {
      P.roll -= dt; mx = P.rdx; my = P.rdy;
      P.vx = mx * 330; P.vy = my * 330;
      if (Math.random() < 0.5) emit(P.x, P.y + 8, 0, -10, 0.3, 5, 'rgba(255,255,255,0.7)', 3, { grow: 10 });
    } else {
      const sp = 135 * (1 + 0.08 * HC.perk('move')) * (S.hunger <= 0 ? 0.85 : 1);
      const m = Math.hypot(mx, my) || 1;
      P.vx = mx / m * sp * mag; P.vy = my / m * sp * mag;
      if (mag > 0.05) { P.fx = mx / m; P.fy = my / m; }
    }
    P.moving = mag > 0.05 || P.roll > 0;
    P.x += P.vx * dt; P.y += P.vy * dt;
    if (P.moving) P.step += dt * (P.roll > 0 ? 18 : 9 + 5 * mag);
    P.x = HC.clamp(P.x, 40, HC.WORLD - 40); P.y = HC.clamp(P.y, 40, HC.WORLD - 40);
    pushOutRect(P, G, P.r);
    HC.queryNodes(P.x, P.y, 60, tmpN);
    for (let i = 0; i < tmpN.length; i++) {
      const n = tmpN[i]; if (!n.alive || n.cr <= 0) continue;
      const dx = P.x - n.x, dy = P.y - n.y, rr = n.cr + P.r - 2, d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.01) { const d = Math.sqrt(d2); P.x = n.x + dx / d * rr; P.y = n.y + dy / d * rr; }
    }
    // --- auto gather
    P.gcd -= dt;
    let best = null, bd = 1e9;
    if (P.roll <= 0) {
      for (let i = 0; i < tmpN.length; i++) {
        const n = tmpN[i]; if (!n.alive) continue;
        const d = Math.hypot(P.x - n.x, P.y - n.y) - n.r;
        if (d < 30 && d < bd) { bd = d; best = n; }
      }
    }
    P.gnode = best;
    if (best && P.gcd <= 0) {
      const tool = toolFor(best.type);
      P.gcd = 0.55 / (1 + 0.15 * HC.perk('gather'));
      P.swing = 0.25; P.swingKind = best.type === 'tree' ? 'axe' : best.type === 'bush' ? 'hand' : 'pick';
      P.swingAng = Math.atan2(best.y - P.y, best.x - P.x);
      P.tool = P.swingKind;
      best.hp -= tool.pow * (0.9 + rnd() * 0.2); best.shake = 0.25;
      HC.audio.play(best.type === 'tree' ? 'chop' : best.type === 'bush' ? 'pickup' : 'mine');
      fx.hit(best.x, best.y - 14, best.type === 'tree' ? '#e8c08a' : best.type === 'rock' ? '#dfe5ee' : '#ffd24a');
      if (best.hp <= 0) harvest(best);
    }
    // --- auto attack
    P.acd -= dt;
    const w = HC.WEAPON[S.equip.weapon] || HC.WEAPON.fist;
    if (P.roll <= 0) {
      let tm = null, td = 1e9;
      for (let i = 0; i < R.mobs.length; i++) {
        const m = R.mobs[i]; if (!m.on) continue;
        const d = Math.hypot(m.x - P.x, m.y - P.y) - m.r;
        if (d < w.range && d < td) { td = d; tm = m; }
      }
      if (tm && P.acd <= 0) {
        P.acd = w.rate / (1 + 0.04 * HC.perk('gather'));
        const ang = Math.atan2(tm.y - P.y, tm.x - P.x);
        P.swing = 0.22; P.swingAng = ang; P.swingKind = w.melee ? 'melee' : 'shot'; P.tool = 'weapon'; P.fx = Math.cos(ang); P.fy = Math.sin(ang);
        const crit = rnd() < 0.08 + 0.06 * HC.perk('crit');
        const dmg = w.dmg * (1 + 0.15 * HC.perk('dmg')) * (crit ? 2 : 1);
        if (w.melee) {
          HC.audio.play('swing');
          for (let i = 0; i < R.mobs.length; i++) {
            const m = R.mobs[i]; if (!m.on) continue;
            const dx = m.x - P.x, dy = m.y - P.y, d = Math.hypot(dx, dy);
            if (d - m.r < w.range && (dx * P.fx + dy * P.fy) / (d || 1) > 0.15) damageMob(m, dmg, crit, P.x, P.y);
          }
        } else {
          HC.audio.play(w.proj === 'energy' ? 'zap' : 'shoot');
          const p = shoot('p', P.x, P.y - 6, tm.x, tm.y, w.spd, dmg, w.proj, w.pierce || 0);
          if (p) { p.crit = crit; p.life = (w.range + 60) / w.spd; }
        }
      }
    }
    if (R.combo.t > 0) { R.combo.t -= dt; if (R.combo.t <= 0) R.combo.n = 0; }
    // --- near caravan: deposit / heal / sleep
    const dc = HC.cavDist(P.x, P.y);
    if (dc < 70) {
      if (HC.carryCount() > 0) {
        const moved = HC.deposit();
        if (moved > 0) { HC.audio.play('pickup'); fx.text(P.x, P.y - 34, 'Stored ' + moved, '#bfffc0', 14); HC.emit('deposit', { n: moved }); }
      }
    }
    // --- hunger & health
    const hmax = HC.maxHP();
    S.hunger = Math.max(0, S.hunger - 0.3 * (1 - 0.15 * HC.perk('hunger')) * dt);
    P.eatCd -= dt;
    if (S.hunger < 50 && P.eatCd <= 0) HC.eat(true);
    if (S.hunger <= 0) { if (S.hp > 1) S.hp = Math.max(1, S.hp - 0.6 * dt); }
    else if (S.hunger > 30 && S.hp < hmax) {
      const near = dc < 220, bed = HC.modLevel('bed');
      const rate = near ? 1.1 + (bed ? bed * 1.1 * HC.power() : 0) : 0.12;
      S.hp = Math.min(hmax, S.hp + rate * dt);
    }
    if (S.hp > hmax) S.hp = hmax;
    // auto bandage / medkit in a pinch (kid friendly)
    if (S.hp < hmax * 0.28 && P.eatCd <= 0) { if (HC.useHeal(true)) P.eatCd = 3; }
    if (R.fullT > 0) R.fullT -= dt;
  }
  HC.eat = function (auto) {
    const S = S0();
    let src = S.carry.food > 0 ? 'carry' : S.res.food > 0 ? 'res' : null;
    if (!src) { P.eatCd = 4; if (!auto) { fx.text(P.x, P.y - 30, 'No food!', '#ffb0b0', 15); HC.audio.play('nope'); } return false; }
    if (S.hunger > 92 && !auto) { fx.text(P.x, P.y - 30, 'Not hungry', '#fff', 14); return false; }
    (src === 'carry' ? S.carry : S.res).food--;
    const cook = 1 + 0.15 * HC.modLevel('furnace');
    S.hunger = Math.min(100, S.hunger + 22 * cook);
    P.eatCd = 0.6; fx.text(P.x, P.y - 30, 'Yum!', '#ffe0a0', 16); fx.sparkle(P.x, P.y - 10, 5, 30); HC.audio.play('eat');
    HC.emit('eat', {});
    return true;
  };
  HC.useHeal = function (auto) {
    const S = S0(), inv = S.inv, hmax = HC.maxHP();
    if (S.hp >= hmax) return false;
    let it = inv.medkit > 0 && (S.hp < hmax * 0.4 || !auto) ? 'medkit' : inv.bandage > 0 ? 'bandage' : inv.medkit > 0 ? 'medkit' : null;
    if (!it) { if (!auto) { fx.text(P.x, P.y - 30, 'No healing items', '#ffb0b0', 14); HC.audio.play('nope'); } return false; }
    inv[it]--;
    const h = it === 'medkit' ? 90 : 35;
    S.hp = Math.min(hmax, S.hp + h);
    fx.text(P.x, P.y - 30, '+' + h + ' HP', '#ff9aa8', 17); fx.sparkle(P.x, P.y - 8, 8, 40); HC.audio.play('craft');
    return true;
  };
  HC.doRoll = function () {
    if (P.rollCd > 0 || P.roll > 0) return false;
    const ix = HC.input.vec();
    let dx = ix.x, dy = ix.y; const m = Math.hypot(dx, dy);
    if (m < 0.1) { dx = P.fx; dy = P.fy; } else { dx /= m; dy /= m; }
    P.rdx = dx; P.rdy = dy; P.roll = 0.28; P.rollCd = 1.1; P.inv = Math.max(P.inv, 0.3);
    HC.audio.play('swing');
    return true;
  };
  HC.throwBomb = function () {
    const S = S0(); if (S.inv.bomb <= 0) return false;
    let tm = null, td = 1e9;
    for (let i = 0; i < R.mobs.length; i++) { const m = R.mobs[i]; if (!m.on) continue; const d = Math.hypot(m.x - P.x, m.y - P.y); if (d < 260 && d < td) { td = d; tm = m; } }
    if (!tm) return false;
    S.inv.bomb--;
    const p = shoot('p', P.x, P.y - 8, tm.x, tm.y, Math.max(160, td / 0.6), 0, 'bomb', 0);
    if (p) { p.fl = td / Math.max(160, td / 0.6); P.swing = 0.25; P.swingKind = 'shot'; P.swingAng = Math.atan2(tm.y - P.y, tm.x - P.x); }
    HC.audio.play('swing');
    return true;
  };
  HC.nearestMobDist = function (range) {
    let td = 1e9;
    for (let i = 0; i < R.mobs.length; i++) { const m = R.mobs[i]; if (!m.on || m.kind === 'critter') continue; const d = Math.hypot(m.x - P.x, m.y - P.y); if (d < td) td = d; }
    return td < range ? td : -1;
  };

  // ---------- caravan systems: turrets, furnace, garden ----------
  HC.rebuildTurrets = function () {
    const S = S0(); R.turrets.length = 0; R.lights.length = 0;
    for (let i = 0; i < 12; i++) {
      const s = S.grid.slots[i]; if (!s || !HC.slotValid(i)) continue;
      const pos = HC.slotPos(i);
      if (s.m === 'turret') R.turrets.push({ x: pos.x, y: pos.y, l: s.l, cd: 0.5 + Math.random(), ang: -Math.PI / 2, kick: 0 });
      if (s.m === 'lantern') R.lights.push({ x: pos.x, y: pos.y, r: 120 + 45 * s.l });
    }
  };
  let furnT = 0, gardT = 0;
  function updateCaravanSys(dt) {
    const S = S0(), pw = HC.power();
    for (let i = 0; i < R.turrets.length; i++) {
      const t = R.turrets[i]; t.cd -= dt; if (t.kick > 0) t.kick -= dt;
      const range = 150 + 18 * t.l;
      let tm = null, td = 1e9;
      for (let j = 0; j < R.mobs.length; j++) {
        const m = R.mobs[j]; if (!m.on || (m.kind === 'critter' && m.angry <= 0)) continue;
        const d = Math.hypot(m.x - t.x, m.y - t.y);
        if (d < range && d < td) { td = d; tm = m; }
      }
      if (tm) {
        t.ang = Math.atan2(tm.y - t.y, tm.x - t.x);
        if (t.cd <= 0) {
          t.cd = Math.max(0.35, 1.3 - 0.14 * t.l) / pw; t.kick = 0.12;
          const dmg = (8 + 4 * t.l) * (1 + 0.2 * HC.perk('turret')) * pw;
          shoot('p', t.x, t.y, tm.x, tm.y, 420, dmg, 'bolt', 0, 1);
          HC.audio.play('shoot');
        }
      }
    }
    // furnace smelts surplus scrap
    const fl = HC.modSum('furnace');
    if (fl > 0) {
      furnT += dt * fl * pw;
      if (furnT >= 9) { furnT = 0; if (S.res.scrap >= 32) { S.res.scrap -= 2; HC.addStore('metal', 1); fx.text(W.cx, HC.G.y0 + 100, '+1 metal', '#bfe2ff', 14); fx.sparkle(W.cx, HC.G.y0 + 110, 4, 30); } }
    }
    const gl = HC.modSum('garden');
    if (gl > 0) {
      gardT += dt * pw;
      const per = Math.max(4, 14 - 2 * (gl / Math.max(1, HC.modCount('garden')))) / HC.modCount('garden');
      if (gardT >= per) { gardT = 0; if (HC.addStore('food', 1)) fx.text(W.cx + 30, HC.G.y0 + 110, '+1 food', '#ffe0a0', 14); }
    }
    // caravan self-repair when quiet in daytime
    R.cavHurtT += dt; if (R.cavTextT > 0) R.cavTextT -= dt;
    const mx = HC.cavMax();
    if (S.cavHP < mx && R.cavHurtT > 8 && !R.night) { S.cavHP = Math.min(mx, S.cavHP + 2 * dt); if (S.damaged && S.cavHP > mx * 0.25) S.damaged = false; }
    if (S.cavHP > mx) S.cavHP = mx;
  }

  // ---------- time ----------
  HC.nightness = function () {
    const t = S0().t;
    if (t < 165) return 0; if (t < 185) return (t - 165) / 20; if (t < 255) return 1; return 1 - (t - 255) / 15;
  };
  function updateTime(dt) {
    const S = S0();
    S.t += dt;
    const was = R.night;
    if (S.t >= HC.CYCLE) { S.t -= HC.CYCLE; newDay(); }
    R.night = S.t >= HC.DAY_LEN;
    if (!was && R.night) {
      HC.banner('🌙 Night falls!', 'Raiders and howlers are coming — protect the caravan');
      HC.audio.play('horn');
    }
  }
  function newDay() {
    const S = S0();
    S.day++; S.stats.nights++;
    HC.emit('night', {});
    const mx = HC.cavMax();
    S.cavHP = Math.min(mx, Math.max(S.cavHP, 0) + mx * 0.4); if (S.cavHP > mx * 0.25) S.damaged = false;
    S.hp = Math.min(HC.maxHP(), S.hp + HC.maxHP() * 0.5);
    HC.spawnChest(true);
    HC.banner('☀️ Day ' + S.day + '!', 'A Lucky Crate appeared near the caravan');
    HC.audio.play('chest');
    // clear leftover raiders with a friendly poof
    for (let i = 0; i < R.mobs.length; i++) { const m = R.mobs[i]; if (m.on && m.rush && m.kind !== 'boss') { m.on = false; fx.puff(m.x, m.y); } }
  }
  HC.sleepTillDawn = function () {
    const S = S0();
    if (!R.night || HC.modLevel('bed') < 3) return false;
    S.t = HC.CYCLE - 0.1;
    return true;
  };

  // ---------- boss lair trigger ----------
  function updateLair() {
    const L = W.lair;
    if (!L || R.boss) return;
    if (Math.hypot(P.x - L.x, P.y - L.y) < 400) {
      const m = spawnMob(L.boss, L.x, L.y);
      if (m) {
        R.boss = m; m.phase = 'chase'; m.st = 2.2;
        HC.banner('👑 ' + m.def.name + '!', 'Watch for the red warning circles!');
        HC.audio.play('roar'); R.shake = 8; fx.puff(m.x, m.y, true);
      }
    }
  }
  function updateBossLeash() {
    const b = R.boss; if (!b) return;
    if (!b.on) { R.boss = null; return; }
    if (Math.hypot(P.x - b.x, P.y - b.y) > 1300) { b.on = false; R.boss = null; }
  }

  // =====================================================================
  // master world update (fixed step)
  // =====================================================================
  HC.updateFx = function (dt) {
    for (let i = 0; i < R.parts.length; i++) {
      const p = R.parts[i]; if (!p.on) continue;
      p.age += dt; if (p.age >= p.life) { p.on = false; continue; }
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.size += p.grow * dt;
    }
    for (let i = 0; i < R.texts.length; i++) {
      const t = R.texts[i]; if (!t.on) continue;
      t.age += dt; t.y -= 26 * dt; if (t.age >= t.life) t.on = false;
    }
    HC.updateSlotPops(dt);
  };

  HC.updateWorld = function (dt) {
    const S = S0();
    R.time += dt;
    updateTime(dt);
    updatePlayer(dt);
    HC.updateNodes(dt);
    for (let i = 0; i < R.mobs.length; i++) if (R.mobs[i].on) updateMob(R.mobs[i], dt);
    // soft separation
    for (let i = 0; i < R.mobs.length; i++) {
      const a = R.mobs[i]; if (!a.on) continue;
      for (let j = i + 1; j < R.mobs.length; j++) {
        const b = R.mobs[j]; if (!b.on) continue;
        const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
        if (dx * dx + dy * dy < rr * rr * 0.6 && (dx || dy)) {
          const d = Math.sqrt(dx * dx + dy * dy), push = (rr * 0.8 - d) * 0.25;
          if (a.kind !== 'boss') { a.x -= dx / d * push; a.y -= dy / d * push; }
          if (b.kind !== 'boss') { b.x += dx / d * push; b.y += dy / d * push; }
        }
      }
    }
    updateTeles(dt);
    updateCaravanSys(dt);
    updateProjs(dt);
    updatePicks(dt);
    updateChests(dt);
    updateSpawner(dt);
    updateLair(); updateBossLeash();
    HC.updateFx(dt);
    // camera (follow with smoothing, look slightly ahead)
    const v = R.view, c = R.cam;
    const tx = HC.clamp(P.x - v.w / 2, -40, HC.WORLD - v.w + 40), ty = HC.clamp(P.y - v.h / 2 + 50, -40, HC.WORLD - v.h + 40);
    const k = Math.min(1, 7 * dt);
    c.x += (tx - c.x) * k; c.y += (ty - c.y) * k;
    if (R.shake > 0) R.shake = Math.max(0, R.shake - 30 * dt);
    // autosave
    R.saveT += dt; if (R.saveT > 10) { R.saveT = 0; HC.saveNow(); }
    R.qT += dt; if (R.qT > 0.25) { R.qT = 0; HC.checkQuest(); HC.checkAch(); }
  };
})();
