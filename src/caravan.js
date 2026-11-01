// The Shellback: a huge gentle beast carrying a deck-house. Animated legs, swaying deck, modules, build ghost.
import * as THREE from 'three';
import { DECK, SLOT_POS, MODS } from './data.js';
import { beastParts, moduleParts, SLOT_ROT } from './models.js';
import { lit, unlit } from './geo.js';
import { glowSprite } from './fx.js';

const LEGS = [[-4.3, -4.8, 0], [4.3, -4.8, Math.PI], [-4.3, 4.8, Math.PI], [4.3, 4.8, 0]];

export class Caravan {
  constructor(scene, glowTex) {
    this.scene = scene; this.glowTex = glowTex;
    this.root = new THREE.Group(); this.body = new THREE.Group(); this.root.add(this.body);
    scene.add(this.root);
    const P = beastParts(), mat = lit({ emissive: 0x4a3c24, emissiveIntensity: 0.75 }), glowMat = unlit({ fog: true });
    this.mat = mat; this.glowMat = glowMat;
    const mk = (g, parent = this.body) => { const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
    mk(P.shell); mk(P.deck);
    this.head = new THREE.Group(); this.head.position.set(0, 3.3, -7.2); this.body.add(this.head);
    mk(P.head, this.head); mk(P.eyes, this.head);
    this.legs = LEGS.map(([x, z, ph]) => { const g = new THREE.Group(); g.position.set(x, 2.55, z); this.body.add(g); mk(P.leg, g); return { g, ph }; });
    this.deckRoot = new THREE.Group(); this.body.add(this.deckRoot);
    this.helmGem = glowSprite(glowTex, 0x6fe0d0, 1.6); this.helmGem.position.set(0, DECK.y + 1.6, -DECK.z + 0.5); this.body.add(this.helmGem);
    this.mods = {}; this.geoCache = new Map();
    this.pulse = {};
    this.phase = 0; this.y = 0; this.cz = 0; this.speed = 0;
    // slot rings + ghost
    this.rings = new THREE.Group(); this.rings.visible = false; this.deckRoot.add(this.rings);
    this.ringMeshes = SLOT_POS.map((p) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.92, 28), new THREE.MeshBasicMaterial({ color: 0x6fe0d0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, fog: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(p[0], DECK.y + 0.06, p[1]); this.rings.add(m); return m;
    });
    this.ghost = new THREE.Group(); this.ghost.visible = false; this.deckRoot.add(this.ghost);
    this.ghostMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, fog: false });
    this.ghostKey = '';
  }
  setPos(cz, y) { this.cz = cz; this.y = y; this.root.position.set(0, y, cz); }
  deckY() { return this.y + DECK.y; }
  slotWorld(i, out) { const p = SLOT_POS[i]; return out.set(p[0], this.deckY(), p[1] + this.cz); }
  helmWorld(out) { return out.set(0, this.deckY() + 0.8, this.cz - DECK.z + 0.5); }

  update(dt, t, speed) {
    this.speed = speed;
    const k = Math.min(1, speed / 3);
    this.phase += dt * (speed / 6.5) * Math.PI * 2;
    for (const L of this.legs) L.g.rotation.x = Math.sin(this.phase + L.ph) * 0.55 * k + Math.sin(t * 0.8 + L.ph) * 0.02 * (1 - k);
    const bob = Math.abs(Math.sin(this.phase)) * 0.12 * k;
    this.body.position.y = bob + Math.sin(t * 0.7) * 0.03;
    this.body.rotation.z = Math.sin(t * 1.0) * 0.006 + Math.sin(this.phase * 0.5) * 0.012 * k;
    this.body.rotation.x = Math.sin(t * 0.6) * 0.004 + Math.sin(this.phase + 1) * 0.008 * k;
    this.head.rotation.x = Math.sin(this.phase + 0.6) * 0.05 * k + Math.sin(t * 0.5) * 0.03;
    this.head.rotation.y = Math.sin(t * 0.3) * 0.12 * (1 - k);
    this.helmGem.material.opacity = 0.75 + Math.sin(t * 3) * 0.2;
  }

  modGeo(type, lv) {
    const key = type + lv;
    if (!this.geoCache.has(key)) this.geoCache.set(key, moduleParts(type, lv));
    return this.geoCache.get(key);
  }
  makeModule(type, lv, ghost) {
    const P = this.modGeo(type, lv);
    const g = new THREE.Group();
    const rec = { group: g, type, lv, head: null, flame: null };
    const add = (geo, parent, glow) => {
      const m = new THREE.Mesh(geo, ghost ? this.ghostMat : glow ? this.glowMat : this.mat);
      if (!ghost) { m.castShadow = !glow; m.receiveShadow = !glow; }
      parent.add(m); return m;
    };
    add(P.body, g, false);
    if (P.glow) rec.glowMesh = add(P.glow, g, true);
    if (P.head) {
      const h = new THREE.Group(); h.position.y = P.head.y; g.add(h);
      add(P.head.body, h, false); if (P.head.glow) add(P.head.glow, h, true);
      rec.head = h;
    }
    if (!ghost && P.flame) { rec.flame = glowSprite(this.glowTex, type === 'lantern' && lv >= 4 ? 0x7ff0e0 : 0xffb050, 3.2 + lv * 0.3); rec.flame.position.set(...P.flame); g.add(rec.flame); }
    if (!ghost && P.furnace) { rec.fglow = glowSprite(this.glowTex, 0xff7a2a, 2.6); rec.fglow.position.set(0, 0.5, 0.9); g.add(rec.fglow); }
    if (!ghost && P.crops) rec.crops = rec.glowMesh;
    return rec;
  }
  // build/refresh module meshes from state
  sync(state) {
    for (let i = 0; i < SLOT_POS.length; i++) {
      const m = state.mods[i], cur = this.mods[i];
      if (!m) { if (cur) { this.deckRoot.remove(cur.group); delete this.mods[i]; } continue; }
      if (cur && cur.type === m.type && cur.lv === m.lv) continue;
      if (cur) this.deckRoot.remove(cur.group);
      const rec = this.makeModule(m.type, m.lv, false);
      rec.group.position.set(SLOT_POS[i][0], DECK.y, SLOT_POS[i][1]); rec.group.rotation.y = SLOT_ROT[i];
      rec.born = 0.0001;
      this.deckRoot.add(rec.group); this.mods[i] = rec;
    }
  }
  hit(slot) { this.pulse[slot] = 1; }
  visuals(state, dt, t, night, fx) {
    for (const k in this.mods) {
      const r = this.mods[k], m = state.mods[k];
      if (!m) continue;
      let sc = 1;
      if (r.born !== undefined) { r.born = Math.min(1, r.born + dt * 3.5); sc = 0.4 + 0.6 * r.born + Math.sin(r.born * 3.14) * 0.25; if (r.born >= 1) delete r.born; }
      const p = this.pulse[k] || 0; if (p > 0) { this.pulse[k] = Math.max(0, p - dt * 4); sc += Math.sin(p * 9) * 0.06 * p; }
      r.group.scale.setScalar(sc);
      const broken = m.hp <= 0;
      r.group.rotation.z = broken ? 0.12 : 0;
      if (broken && Math.random() < dt * 4) fx.smoke(r.group.position.x, DECK.y + this.y + 0.8, r.group.position.z + this.cz);
      if (r.flame) { r.flame.material.opacity = broken ? 0 : 0.35 + 0.65 * night + Math.sin(t * 9 + +k) * 0.06; r.flame.scale.setScalar((3.2 + r.lv * 0.3) * (0.95 + Math.sin(t * 7 + +k) * 0.05)); }
      if (r.fglow) r.fglow.material.opacity = m.ore > 0 && !broken ? 0.7 + Math.sin(t * 11) * 0.15 : 0;
      if (r.type === 'garden' && r.glowMesh) r.glowMesh.visible = m.crop > 0;
      if (r.type === 'furnace' && r.glowMesh) r.glowMesh.visible = m.ore > 0 || m.out > 0 || true;
    }
  }
  aim(slot, yaw, dt) { const r = this.mods[slot]; if (r && r.head) { let d = yaw - SLOT_ROT[slot] - r.head.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); r.head.rotation.y += d * Math.min(1, dt * 10); } }
  muzzle(slot, out) { const r = this.mods[slot]; if (!r || !r.head) return null; r.head.updateWorldMatrix(true, false); return out.set(0, 0.15, 1.3).applyMatrix4(r.head.matrixWorld); }

  showRings(on, hi, state) {
    this.rings.visible = on;
    if (!on) return;
    this.ringMeshes.forEach((m, i) => {
      const used = !!state.mods[i];
      m.visible = true;
      m.material.color.set(i === hi ? 0xff6a3a : used ? 0x6a7a88 : 0x6fe0d0);
      m.material.opacity = i === hi ? 0.95 : used ? 0.3 : 0.55;
      m.scale.setScalar(i === hi ? 1.12 + Math.sin(performance.now() * 0.008) * 0.06 : 1);
    });
  }
  setGhost(type, lv, slot, ok) {
    if (type == null) { this.ghost.visible = false; return; }
    const key = type + lv;
    if (key !== this.ghostKey) {
      while (this.ghost.children.length) this.ghost.remove(this.ghost.children[0]);
      const rec = this.makeModule(type, lv, true); this.ghost.add(rec.group); this.ghostKey = key;
    }
    this.ghost.visible = true;
    this.ghost.position.set(SLOT_POS[slot][0], DECK.y, SLOT_POS[slot][1]); this.ghost.rotation.y = SLOT_ROT[slot];
    this.ghostMat.color.set(ok ? 0x9ffff0 : 0xff7a5a);
    this.ghostMat.opacity = 0.62 + Math.sin(performance.now() * 0.006) * 0.12;
  }
}
