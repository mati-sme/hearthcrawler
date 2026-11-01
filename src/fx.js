// Pooled chunky particles (lit chunks + unlit glows), additive glow sprites and floating DOM popups.
import * as THREE from 'three';

export function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function glowSprite(tex, hex, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: hex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  s.scale.setScalar(size); return s;
}

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color(), E = new THREE.Euler();

export class FX {
  constructor(scene, layer) {
    const CAP = 480;
    this.cap = CAP;
    this.chunks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ flatShading: true }), CAP);
    this.glows = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), CAP);
    for (const m of [this.chunks, this.glows]) { m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, C.set(0xffffff)); scene.add(m); }
    this.chunks.castShadow = false;
    this.ps = Array.from({ length: CAP * 2 }, () => ({ on: false }));
    this.next = 0;
    this.layer = layer;
    this.pops = [];
    for (let i = 0; i < 16; i++) { const d = document.createElement('div'); d.className = 'pop'; d.style.display = 'none'; layer.appendChild(d); this.pops.push({ el: d, on: false, age: 0, x: 0, y: 0, z: 0 }); }
    this.pi = 0;
  }
  spawn(kind, x, y, z, vx, vy, vz, size, life, grav, hex, grow = 0) {
    for (let k = 0; k < this.ps.length; k++) {
      const p = this.ps[(this.next + k) % this.ps.length];
      if (!p.on) {
        this.next = (this.next + k + 1) % this.ps.length;
        Object.assign(p, { on: true, kind, x, y, z, vx, vy, vz, size, life, max: life, grav, grow, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 12 });
        C.set(hex); p.r = C.r; p.g = C.g; p.b = C.b; return p;
      }
    }
  }
  // chunky debris
  burst(x, y, z, hex, n = 8, speed = 4, size = 0.14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, up = 1.5 + Math.random() * speed;
      this.spawn(0, x, y, z, Math.cos(a) * speed * 0.6 * Math.random(), up, Math.sin(a) * speed * 0.6 * Math.random(), size * (0.6 + Math.random() * 0.8), 0.7 + Math.random() * 0.4, 14, hex);
    }
  }
  sparkle(x, y, z, hex, n = 8, speed = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, e = (Math.random() - 0.3) * 2;
      this.spawn(1, x, y, z, Math.cos(a) * speed * Math.random(), e * speed * 0.6 + 1, Math.sin(a) * speed * Math.random(), 0.1 + Math.random() * 0.1, 0.5 + Math.random() * 0.5, -1.5, hex);
    }
  }
  poof(x, y, z, hex) {
    for (let i = 0; i < 7; i++) { const a = Math.random() * 6.28; this.spawn(1, x, y + 0.3, z, Math.cos(a) * 1.5, 0.8 + Math.random(), Math.sin(a) * 1.5, 0.3, 0.6 + Math.random() * 0.3, -1, 0xcfd6e6, 1.6); }
    this.sparkle(x, y + 0.6, z, hex, 12, 4); this.sparkle(x, y + 0.6, z, 0xffffff, 6, 3);
  }
  smoke(x, y, z) { this.spawn(1, x, y, z, (Math.random() - 0.5) * 0.4, 1.0, (Math.random() - 0.5) * 0.4, 0.22, 1.2, -0.3, 0x55606e, 1.8); }
  tracer(a, b, hex) {
    const n = 7;
    for (let i = 0; i < n; i++) { const f = i / (n - 1); this.spawn(1, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f, 0, 0, 0, 0.12, 0.18 + 0.12 * (1 - f), 0, hex); }
  }
  update(dt) {
    let ci = 0, gi = 0;
    for (const p of this.ps) {
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) { p.on = false; continue; }
      p.vy -= p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.kind === 0 && p.y < 0.05 && p.vy < 0) { p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      p.rot += p.spin * dt;
      const f = p.life / p.max;
      const sz = p.size * (p.grow ? (1 + p.grow * (1 - f)) * Math.min(1, f * 2.2 + 0.2) : Math.min(1, f * 2.5));
      const m = p.kind === 0 ? this.chunks : this.glows;
      const i = p.kind === 0 ? ci++ : gi++;
      Q.setFromEuler(E.set(p.rot, p.rot * 0.7, 0));
      M.compose(V.set(p.x, p.y, p.z), Q, S.setScalar(sz));
      m.setMatrixAt(i, M);
      C.setRGB(p.r, p.g, p.b); if (p.kind === 1) C.multiplyScalar(0.6 + 0.4 * f);
      m.setColorAt(i, C);
    }
    this.chunks.count = ci; this.glows.count = gi;
    for (const m of [this.chunks, this.glows]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }
  popup(x, y, z, text, cls = '') {
    const p = this.pops[this.pi++ % this.pops.length];
    p.on = true; p.age = 0; p.x = x + (Math.random() - 0.5) * 0.5; p.y = y; p.z = z + (Math.random() - 0.5) * 0.5;
    p.el.className = 'pop ' + cls; p.el.textContent = text; p.el.style.display = 'block';
  }
  updatePopups(dt, camera, w, h) {
    for (const p of this.pops) {
      if (!p.on) continue;
      p.age += dt;
      if (p.age > 1.1) { p.on = false; p.el.style.display = 'none'; continue; }
      V.set(p.x, p.y + p.age * 1.2, p.z).project(camera);
      if (V.z > 1) { p.el.style.display = 'none'; continue; }
      p.el.style.display = 'block';
      p.el.style.opacity = String(Math.min(1, (1.1 - p.age) * 2.2));
      p.el.style.transform = `translate(${((V.x * 0.5 + 0.5) * w).toFixed(1)}px,${((-V.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-50%,-50%) scale(${(1 + Math.max(0, 0.25 - p.age) * 2).toFixed(2)})`;
    }
  }
}
