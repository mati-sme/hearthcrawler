// First-person controller: analog movement, jump, stamina sprint, collision with deck / ramp / shell / modules / nodes.
import { terrainH } from './terrain.js';
import { DECK, SLOT_POS } from './data.js';

export const EYE = 1.65;

export class Player {
  constructor() {
    this.x = 0; this.y = 0; this.z = 16; this.vx = 0; this.vy = 0; this.vz = 0;
    this.yaw = 0; this.pitch = 0; this.grounded = false; this.onDeck = false;
    this.bob = 0; this.moveAmt = 0; this.sprinting = false; this.hurt = 0; this.invuln = 0; this.regenWait = 0;
    this.sens = 1;
  }
  groundY(x, z, y, car) {
    let gh = terrainH(x, z);
    const rx = x, rz = z - car.cz, dy = car.deckY();
    if (Math.abs(rx) <= DECK.x + 0.05 && Math.abs(rz) <= DECK.z + 0.05 && y >= dy - 0.7) gh = Math.max(gh, dy);
    if (Math.abs(rx) <= 1.2 && rz >= DECK.z - 0.01 && rz <= 12) { const rh = car.y + DECK.y * (12 - rz) / 7; if (rh <= y + 0.7) gh = Math.max(gh, rh); }
    return gh;
  }
  inDeck(x, z, y, car, pad = 0) { return Math.abs(x) <= DECK.x + pad && Math.abs(z - car.cz) <= DECK.z + pad && y > car.deckY() - 0.8; }
  teleport(x, z, car) { this.x = x; this.z = z; this.y = this.groundY(x, z, 99, car); this.vx = this.vy = this.vz = 0; this.grounded = true; }

  update(dt, inp, ctx) {
    const { car, world, state } = ctx;
    // look
    const sens = 0.0052 * this.sens;
    this.yaw -= inp.lookDX * sens; this.pitch -= inp.lookDY * sens;
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
    inp.lookDX = inp.lookDY = 0;
    // wish velocity
    let mx = inp.moveX, my = inp.moveY;
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    const mag = Math.min(1, len);
    this.sprinting = (mag > 0.93 || inp.sprint) && state.stamina > 4 && mag > 0.1;
    const speed = 4.4 * (this.sprinting ? 1.55 : 1);
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const wx = (fx * my + rx * mx) * speed, wz = (fz * my + rz * mx) * speed;
    const k = Math.min(1, dt * (this.grounded ? 12 : 3));
    this.vx += (wx - this.vx) * k; this.vz += (wz - this.vz) * k;
    if (this.sprinting) state.stamina = Math.max(0, state.stamina - 13 * dt); else state.stamina = Math.min(100, state.stamina + 20 * dt);
    if (inp.jump && this.grounded && state.stamina > 3) { this.vy = 8.2; this.grounded = false; state.stamina -= 3; ctx.onJump && ctx.onJump(); }
    inp.jump = false;
    this.vy -= 24 * dt;
    const ox = this.x, oz = this.z, oy = this.y;
    const wasDeck = this.inDeck(ox, oz, oy, car);
    this.x += this.vx * dt; this.z += this.vz * dt; this.y += this.vy * dt;
    // deck rails (open at the ramp mouth)
    if (wasDeck) {
      const lim = DECK.x - 0.3, zl = DECK.z - 0.3, rzl = this.z - car.cz;
      if (this.x > lim) this.x = lim; if (this.x < -lim) this.x = -lim;
      if (rzl < -zl) this.z = car.cz - zl;
      if (rzl > zl && Math.abs(this.x) > 1.0) this.z = car.cz + zl;
    }
    const rzr = this.z - car.cz;
    if (rzr > DECK.z - 0.1 && rzr < 12.2 && this.y > terrainH(this.x, this.z) + 1.0 && Math.abs(this.x) > 1.15) this.x = Math.sign(this.x) * 1.15;
    // modules on deck
    if (this.y > car.deckY() - 0.5 && Math.abs(this.x) < DECK.x + 1 && Math.abs(rzr) < DECK.z + 1) {
      for (const k2 in state.mods) {
        const p = SLOT_POS[k2], m = state.mods[k2];
        const r = m.type === 'palisade' ? 1.05 : m.type === 'lantern' ? 0.35 : 0.85;
        const dx = this.x - p[0], dz = rzr - p[1], d = Math.hypot(dx, dz);
        if (d < r + 0.3 && d > 1e-4) { const f = (r + 0.3) / d; this.x = p[0] + dx * f; this.z = car.cz + p[1] + dz * f; }
      }
    }
    // the beast's shell
    if (this.y < car.deckY() - 0.9 && !(Math.abs(this.x) < 1.5 && rzr > 3)) {
      const ex = this.x / 6.35, ez = rzr / 8.35, d2 = ex * ex + ez * ez;
      if (d2 < 1 && d2 > 1e-6) { const f = 1.002 / Math.sqrt(d2); this.x *= f; this.z = car.cz + rzr * f; }
    }
    // resource nodes
    for (const n of world.nodesNear(this.x, this.z, 3)) {
      if (this.y > n.y + n.h * 0.5) continue;
      const dx = this.x - n.x, dz = this.z - n.z, d = Math.hypot(dx, dz), r = n.r + 0.35;
      if (d < r && d > 1e-4) { this.x = n.x + dx / d * r; this.z = n.z + dz / d * r; }
    }
    // ground
    const gh = this.groundY(this.x, this.z, this.y, car);
    if (this.y <= gh) { this.y = gh; if (this.vy < 0) this.vy = 0; this.grounded = true; }
    else if (this.grounded && this.y - gh < 0.4 && this.vy <= 0) { this.y = gh; this.grounded = true; }
    else this.grounded = false;
    this.onDeck = this.grounded && this.inDeck(this.x, this.z, this.y, car, 0.2) && this.y > car.deckY() - 0.3;
    if (this.y < -60) this.teleport(0, car.cz + 14, car);
    const sp = Math.hypot(this.vx, this.vz);
    this.moveAmt = this.grounded ? Math.min(1, sp / 4.4) : 0;
    this.bob += sp * dt * 1.6 * (this.grounded ? 1 : 0);
    this.hurt = Math.max(0, this.hurt - dt * 2.5); this.invuln = Math.max(0, this.invuln - dt); this.regenWait = Math.max(0, this.regenWait - dt);
  }
}
