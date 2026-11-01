// First-person held tool: its own scene rendered after clearing depth. Bobs, swings, swaps with the hotbar.
import * as THREE from 'three';
import { toolGeo } from './models.js';
import { lit } from './geo.js';
import { glowSprite } from './fx.js';
import { SWING } from './data.js';

export class ViewModel {
  constructor(glowTex, aspect) {
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(58, aspect, 0.02, 6);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x556655, 1.0);
    this.dir = new THREE.DirectionalLight(0xfff0d8, 1.1); this.dir.position.set(-0.6, 1, 0.8);
    this.scene.add(this.hemi, this.dir);
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), lit()); this.group.add(this.mesh);
    this.flame = glowSprite(glowTex, 0xffa84a, 0.45); this.flame.position.set(0, 0.62, 0); this.flame.visible = false; this.mesh.add(this.flame);
    this.core = glowSprite(glowTex, 0xfff0b0, 0.2); this.core.position.set(0, 0.6, 0); this.core.visible = false; this.mesh.add(this.core);
    this.slot = 'axe'; this.tier = 0; this.swingT = 0; this.swingDur = 0.5; this.swapT = 1;
    this.kick = 0;
  }
  set(slot, tier) {
    if (slot === this.slot && tier === this.tier && this.mesh.geometry.attributes.position) return;
    this.slot = slot; this.tier = tier; this.swapT = 0;
    this.mesh.geometry = toolGeo(slot, tier);
    this.flame.visible = this.core.visible = slot === 'torch' && tier > 0;
    if (slot === 'ranged') this.flame.visible = false;
  }
  swing() { this.swingDur = SWING[this.slot] || 0.5; this.swingT = 1; this.kick = 1; }
  get swingP() { return this.swingT > 0 ? 1 - this.swingT : 1; }
  update(dt, t, move, bob, light) {
    this.swingT = Math.max(0, this.swingT - dt / this.swingDur);
    this.swapT = Math.min(1, this.swapT + dt * 4.5);
    const s = this.swingT > 0 ? 1 - this.swingT : 0;
    const g = this.group;
    let rx = -0.5, ry = 0.0, rz = 0.18, px = 0.36, py = -0.36, pz = -0.62;
    const sw = this.swingT > 0;
    if (this.slot === 'melee' && this.tier > 1) { rx = -1.25; rz = 0.1; py = -0.3; pz = -0.45; if (sw) pz -= Math.sin(s * Math.PI) * 0.55; }
    else if (this.slot === 'ranged') { rx = -1.45; rz = 0; ry = 0.1; px = 0.22; py = -0.26; pz = -0.45; if (sw) { pz += Math.sin(s * Math.PI) * 0.1; rx += Math.sin(s * Math.PI) * 0.15; } }
    else if (this.slot === 'torch') { rx = -0.25; rz = 0.1; px = 0.33; py = -0.3; if (sw) rx -= Math.sin(s * Math.PI) * 0.8; }
    else if (sw) {
      let a;
      if (s < 0.25) a = -(s / 0.25) * 0.9; else if (s < 0.5) a = -0.9 + ((s - 0.25) / 0.25) * 1.9; else a = 1.0 * (1 - (s - 0.5) / 0.5);
      rx += a; rz -= a * 0.1; px -= a * 0.06; pz -= Math.max(0, a) * 0.12; py += a * 0.02;
    }
    const sway = Math.sin(bob * 2) * 0.011 * move, sx = Math.cos(bob) * 0.012 * move;
    g.position.set(px + sx, py + sway - (1 - this.swapT) * 0.55 + Math.sin(t * 1.5) * 0.003, pz);
    g.rotation.set(rx, ry, rz);
    if (this.flame.visible) {
      const f = 0.9 + Math.sin(t * 17) * 0.08 + Math.sin(t * 29) * 0.05;
      this.flame.scale.setScalar(0.5 * f); this.flame.position.y = 0.64 + Math.sin(t * 13) * 0.01; this.core.scale.setScalar(0.2 * f);
    }
    this.hemi.intensity = 0.55 + 0.5 * light;
    this.dir.intensity = 0.2 + 1.0 * light;
  }
}
