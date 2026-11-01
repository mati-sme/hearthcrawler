// Pooled night foes (no gore: white hit flash, "poof" into sparkles), wave spawning, and turret fire.
import * as THREE from 'three';
import { FOES, DECK, SLOT_POS, TURRET, waveFor, bossHpMul, biomeOf } from './data.js';
import { terrainH } from './terrain.js';
import { foeGeo } from './models.js';

const MAX = 22;
const V = new THREE.Vector3();

export class Enemies {
  constructor(scene, fx, car) {
    this.fx = fx; this.car = car; this.scene = scene;
    this.list = [];
    for (let i = 0; i < MAX; i++) {
      const g = new THREE.Group(); g.visible = false;
      const bm = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0xffffff, emissiveIntensity: 0 });
      const body = new THREE.Mesh(new THREE.BufferGeometry(), bm); body.castShadow = true;
      const eyes = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true }));
      g.add(body, eyes); scene.add(g);
      this.list.push({ g, body, eyes, alive: false, dying: 0, x: 0, y: 0, z: 0, yaw: 0, hp: 1, max: 1, flash: 0, stage: 0, cd: 0, kx: 0, kz: 0, ph: 0, type: 'shade', boss: false, atk: 0 });
    }
    this.queue = []; this.qt = 0; this.pending = []; this.boss = null; this.tcd = {};
  }
  get alive() { return this.list.filter((e) => e.alive); }
  aliveCount() { let n = 0; for (const e of this.list) if (e.alive) n++; return n; }

  spawn(type, x, z, hpMul, boss, zone) {
    const e = this.list.find((q) => !q.alive && q.dying <= 0);
    if (!e) return null;
    const f = FOES[type];
    Object.assign(e, { alive: true, dying: 0, type, boss: !!boss, x, z, y: terrainH(x, z), hp: f.hp * hpMul, max: f.hp * hpMul, flash: 0, stage: 0, cd: 1, kx: 0, kz: 0, ph: Math.random() * 6, yaw: 0, atk: 0 });
    const geo = foeGeo(type);
    e.body.geometry = geo.body; e.eyes.geometry = geo.eyes;
    e.body.material.color.set(biomeOf(zone).foe);
    e.g.scale.setScalar(type === 'warlord' ? 1.7 : 1); e.g.visible = true;
    e.g.position.set(x, e.y, z);
    if (boss) this.boss = e;
    return e;
  }
  startNight(night, zone) {
    const w = waveFor(night, zone);
    this.queue = w.list.map((t) => ({ t, hpMul: w.hpMul }));
    if (w.boss) this.queue.splice(Math.min(2, this.queue.length), 0, { t: 'warlord', hpMul: bossHpMul(night, zone), boss: true });
    this.qt = 0; this.zone = zone;
  }
  spawnRing(q, zone) {
    const a = Math.random() * Math.PI * 2, r = 34 + Math.random() * 10;
    return this.spawn(q.t, Math.cos(a) * r, this.car.cz + Math.sin(a) * r, q.hpMul, q.boss, zone);
  }
  clear(poof) {
    this.queue = [];
    for (const e of this.list) if (e.alive) { if (poof) this.fx.poof(e.x, e.y, e.z, 0x9ad0ff); e.alive = false; e.g.visible = false; }
    this.boss = null;
  }
  damage(e, amt, fromX, fromZ) {
    if (!e.alive) return false;
    e.hp -= amt; e.flash = 0.16;
    const dx = e.x - fromX, dz = e.z - fromZ, d = Math.hypot(dx, dz) || 1;
    const kb = e.boss ? 1.2 : 4;
    e.kx += dx / d * kb; e.kz += dz / d * kb;
    if (e.hp <= 0) {
      e.alive = false; e.dying = 0.28;
      this.fx.poof(e.x, e.y + (e.type === 'boar' ? 0.6 : 0.8), e.z, 0xffe9a0);
      if (this.boss === e) this.boss = null;
      return true;
    }
    return false;
  }
  nearest(x, y, z, range, skip) {
    let best = null, bd = range * range;
    for (const e of this.list) { if (!e.alive) continue; const dx = e.x - x, dz = e.z - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = e; } }
    return best;
  }

  update(dt, ctx) {
    const { state, car } = ctx;
    // wave queue
    if (this.queue.length) {
      this.qt -= dt;
      if (this.qt <= 0 && this.aliveCount() < MAX - 1) { const q = this.queue.shift(); this.spawnRing(q, this.zone); this.qt = q.boss ? 4 : 1.6; }
    }
    // targets: modules
    const mods = [];
    for (const k in state.mods) { const m = state.mods[k]; if (m.hp > 0) { const p = SLOT_POS[k]; mods.push({ slot: +k, x: p[0], z: p[1] + car.cz, wall: m.type === 'palisade' }); } }
    const dy = car.deckY();
    for (const e of this.list) {
      if (e.dying > 0) { e.dying -= dt; e.g.scale.multiplyScalar(Math.max(0, 1 - dt * 8)); if (e.dying <= 0) e.g.visible = false; continue; }
      if (!e.alive) continue;
      if (ctx.hold) { e.flash = Math.max(0, e.flash - dt); e.g.position.set(e.x, e.y, e.z); e.g.rotation.set(0, e.yaw, 0); continue; }
      const f = FOES[e.type];
      e.flash = Math.max(0, e.flash - dt); e.body.material.emissiveIntensity = e.flash > 0 ? 0.85 : 0;
      e.cd -= dt; e.atk = Math.max(0, e.atk - dt * 3);
      e.ph += dt * f.speed * 2.4;
      // pick target
      const pdx = ctx.px - e.x, pdz = ctx.pz - e.z, pd = Math.hypot(pdx, pdz);
      const chase = pd < (e.type === 'shade' ? 20 : e.type === 'boar' ? 26 : 6) || mods.length === 0;
      let tx, tz, tslot = -1, onDeckTarget;
      if (chase) { tx = ctx.px; tz = ctx.pz; onDeckTarget = ctx.playerOnDeck; }
      else {
        let b = null, bs = 1e9;
        for (const m of mods) { const s = Math.hypot(m.x - e.x, m.z - e.z) - (m.wall && e.type !== 'shade' ? 14 : 0); if (s < bs) { bs = s; b = m; } }
        tx = b.x; tz = b.z; tslot = b.slot; onDeckTarget = true;
      }
      const aboard = Math.abs(e.x) < DECK.x + 0.5 && Math.abs(e.z - car.cz) < DECK.z + 0.5 && e.y > dy - 1;
      let gx = tx, gz = tz;
      if (onDeckTarget && !aboard) {
        const rbz = car.cz + 13.2, ttz = car.cz + DECK.z + 0.8;
        if (e.stage === 0) { gx = 0; gz = rbz; if (Math.hypot(e.x, e.z - rbz) < 1.6) e.stage = 1; }
        if (e.stage === 1) { gx = 0; gz = ttz; if (e.z < ttz + 0.5) e.stage = 2; }
        if (e.stage === 2) { gx = tx; gz = tz; }
      } else if (!onDeckTarget && aboard) { gx = 0; gz = car.cz + DECK.z + 1; e.stage = 1; }
      else if (aboard) e.stage = 2;
      else if (!onDeckTarget) e.stage = 0;
      const dx = gx - e.x, dz = gz - e.z, d = Math.hypot(dx, dz) || 1;
      const finalGoal = gx === tx && gz === tz;
      const reach = chase ? 1.5 + f.r * 0.5 : 1.7;
      let sp = f.speed * (e.boss ? 1 : 0.9 + (e.ph % 1) * 0.0);
      if (finalGoal && d < reach) sp = 0;
      e.yaw = Math.atan2(dx, dz);
      e.x += (dx / d * sp + e.kx) * dt; e.z += (dz / d * sp + e.kz) * dt;
      e.kx *= Math.max(0, 1 - dt * 6); e.kz *= Math.max(0, 1 - dt * 6);
      // shell collision (ground-bound foes can't walk through the beast, except via the ramp)
      const rz = e.z - car.cz;
      if (e.y < dy - 0.9 && !(Math.abs(e.x) < 1.6 && rz > 3)) { const ex = e.x / 6.5, ez = rz / 8.5, d2 = ex * ex + ez * ez; if (d2 < 1 && d2 > 1e-6) { const k = 1.002 / Math.sqrt(d2); e.x *= k; e.z = car.cz + rz * k; } }
      const gh = ctx.groundY(e.x, e.z, e.y);
      e.y += (gh - e.y) * Math.min(1, dt * 14);
      // attack
      if (finalGoal && d < reach + 0.4 && e.cd <= 0) {
        e.cd = e.boss ? 1.5 : 1.15; e.atk = 1;
        if (tslot >= 0) ctx.damageModule(tslot, f.mdmg * (state.zone * 0.12 + 1), e);
        else if (pd < reach + 0.8) ctx.damagePlayer(f.dmg * (1 + state.zone * 0.1), e);
      }
      // separation
      for (const o of this.list) if (o !== e && o.alive) { const ox = e.x - o.x, oz = e.z - o.z, od = Math.hypot(ox, oz); if (od < 0.9 && od > 1e-3) { e.x += ox / od * dt * 2; e.z += oz / od * dt * 2; } }
      // pose
      e.g.position.set(e.x, e.y + Math.abs(Math.sin(e.ph)) * 0.12 * (sp > 0 ? 1 : 0), e.z);
      e.g.rotation.set(Math.sin(e.ph) * 0.06, e.yaw, Math.sin(e.ph * 0.5) * 0.07 + 0);
      const lunge = Math.sin(e.atk * Math.PI) * 0.25;
      e.g.position.x += Math.sin(e.yaw) * lunge; e.g.position.z += Math.cos(e.yaw) * lunge;
    }
    // turrets
    for (const k in state.mods) {
      const m = state.mods[k];
      if (m.type !== 'turret' || m.hp <= 0) continue;
      const st = TURRET, lv = m.lv - 1;
      const p = car.slotWorld(+k, V);
      const tgt = this.nearest(p.x, p.y, p.z, st.range);
      this.tcd[k] = (this.tcd[k] || 0) - dt;
      if (!tgt) continue;
      car.aim(+k, Math.atan2(tgt.x - p.x, tgt.z - p.z), dt);
      if (this.tcd[k] <= 0) {
        this.tcd[k] = TURRET.every[lv];
        const mz = car.muzzle(+k, new THREE.Vector3()) || p.clone().setY(p.y + 1.3);
        const to = new THREE.Vector3(tgt.x, tgt.y + 0.8, tgt.z);
        const dist = mz.distanceTo(to), tt = dist / 80;
        this.fx.tracer(mz, to, m.lv >= 4 ? 0x6fe0d0 : 0xffd27a);
        this.fx.sparkle(mz.x, mz.y, mz.z, 0xffd27a, 3, 2, 0.3);
        this.pending.push({ t: tt, e: tgt, dmg: TURRET.dmg[lv] * (1 + 0.05 * state.beast), from: p.clone() });
        ctx.sfx && ctx.sfx('turret');
        ctx.turretFired && ctx.turretFired(+k);
      }
    }
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const q = this.pending[i]; q.t -= dt;
      if (q.t <= 0) { this.pending.splice(i, 1); if (q.e.alive) { const killed = this.damage(q.e, q.dmg, q.from.x, q.from.z); ctx.hitFoe(q.e, q.dmg, killed, true); } }
    }
  }
}
