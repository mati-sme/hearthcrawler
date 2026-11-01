// Streamed ring of terrain chunks, instanced resource nodes, wind-swayed grass + flowers.
import * as THREE from 'three';
import { CHUNK, terrainH, zoneAt, zoneNear, genNodes, hash2 } from './terrain.js';
import { biomeOf } from './data.js';
import { nodeGeo, grassGeo, flowerGeo } from './models.js';
import { lit } from './geo.js';

const CELLS = CHUNK / 2;
const CAPS = { oak: 600, maple: 600, pine: 500, snowpine: 600, dead: 300, cactus: 300, shroom: 400, twisted: 400, rock: 300, icerock: 300, redrock: 300, mossrock: 300, ore: 120, crystal: 120, bush: 300, frostbush: 200, dryshrub: 200, glowbush: 200, scrap: 200 };
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0), AX = new THREE.Vector3();
const cA = new THREE.Color(), cB = new THREE.Color(), cC = new THREE.Color();

function swayMat(timeU, amp) {
  const m = lit({ side: THREE.DoubleSide, flatShading: false });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      float sw = position.y * ${amp.toFixed(2)};
      transformed.x += sin(uTime*1.8 + ip.x*0.7 + ip.z*0.45) * 0.22 * sw;
      transformed.z += cos(uTime*1.4 + ip.z*0.6 + ip.x*0.35) * 0.15 * sw;`);
  };
  return m;
}

export class World {
  constructor(scene, quality) {
    this.scene = scene; this.chunks = new Map(); this.dead = new Set(); this.active = new Set();
    this.timeU = { value: 0 }; this.t = 0;
    this.terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.litMat = lit();
    this.crystalMat = lit({ emissive: 0x2a9a90, emissiveIntensity: 0.7 });
    this.inst = {};
    for (const k in CAPS) {
      const mesh = new THREE.InstancedMesh(nodeGeo(k), k === 'crystal' ? this.crystalMat : this.litMat, CAPS[k]);
      mesh.frustumCulled = false; mesh.castShadow = !/bush|scrap|ore|crystal|shrub/.test(k); mesh.receiveShadow = true; mesh.count = 0; mesh.visible = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, C.set(0xffffff));
      scene.add(mesh);
      this.inst[k] = { mesh, count: 0 };
    }
    this.grass = new THREE.InstancedMesh(grassGeo(), swayMat(this.timeU, 1.0), 4600);
    this.flowers = new THREE.InstancedMesh(flowerGeo(), swayMat(this.timeU, 0.5), 500);
    for (const m of [this.grass, this.flowers]) { m.frustumCulled = false; m.count = 0; m.setColorAt(0, C.set(0xffffff)); scene.add(m); }
    this.gpos = { x: 1e9, z: 1e9, zone: -1 };
    this.dirty = true;
  }

  terrainChunk(cx, cz) {
    const x0 = cx * CHUNK, z0 = cz * CHUNK, N = CELLS;
    const H = new Float32Array((N + 1) * (N + 1));
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) H[j * (N + 1) + i] = terrainH(x0 + i * 2, z0 + j * 2);
    const pos = new Float32Array(N * N * 18), col = new Float32Array(N * N * 18);
    let o = 0;
    const colorAt = (x, z, h, out) => {
      const zn = zoneAt(z), A = biomeOf(zn.a), B = biomeOf(zn.b);
      const n = hash2(Math.floor(x * 0.5), Math.floor(z * 0.5), 7);
      const k = sstep(-1.6, 2.6, h) * 0.65 + n * 0.35;
      cA.set(A.ground[0]).lerp(cC.set(A.ground[1]), k);
      cB.set(B.ground[0]).lerp(cC.set(B.ground[1]), k);
      out.copy(cA).lerp(cB, zn.t);
      if (A.terrace > 0 || B.terrace > 0) { const f = ((h / 1.1) % 1 + 1) % 1; if (f < 0.2) out.multiplyScalar(0.86); }
      const ax = Math.abs(x);
      if (ax < 6) out.lerp(cC.set(0x9a8560), 0.28 * (1 - ax / 6) * (1 - zn.t * 0)); // faint beast trail
    };
    const tmp = new THREE.Color();
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const h00 = H[j * (N + 1) + i], h10 = H[j * (N + 1) + i + 1], h01 = H[(j + 1) * (N + 1) + i], h11 = H[(j + 1) * (N + 1) + i + 1];
      const x = x0 + i * 2, z = z0 + j * 2;
      const flip = (i + j) & 1;
      const tris = flip ? [[0, 0, h00, 2, 0, h10, 0, 2, h01], [2, 0, h10, 2, 2, h11, 0, 2, h01]] : [[0, 0, h00, 2, 0, h10, 2, 2, h11], [0, 0, h00, 2, 2, h11, 0, 2, h01]];
      for (const t of tris) {
        const hc = (t[2] + t[5] + t[8]) / 3;
        colorAt(x + (t[0] + t[3] + t[6]) / 3, z + (t[1] + t[4] + t[7]) / 3, hc, tmp);
        const f = 0.93 + hash2(i * 3 + cx * 50, j * 5 + cz * 70, o) * 0.14;
        for (const v of [0, 2, 1]) { // counter-clockwise seen from above
          pos[o] = x + t[v * 3]; pos[o + 1] = t[v * 3 + 2]; pos[o + 2] = z + t[v * 3 + 1];
          col[o] = tmp.r * f; col[o + 1] = tmp.g * f; col[o + 2] = tmp.b * f; o += 3;
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals(); g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, this.terrainMat); mesh.receiveShadow = true;
    return mesh;
  }

  load(cx, cz) {
    const key = cx + ',' + cz;
    if (this.chunks.has(key)) return;
    const mesh = this.terrainChunk(cx, cz);
    this.scene.add(mesh);
    const nodes = genNodes(cx, cz);
    this.chunks.set(key, { key, cx, cz, mesh, nodes });
    this.dirty = true;
  }
  unload(c) {
    this.scene.remove(c.mesh); c.mesh.geometry.dispose();
    for (const n of c.nodes) { this.dead.delete(n); this.active.delete(n); }
    this.chunks.delete(c.key); this.dirty = true;
  }

  // keep a 5x5 ring loaded around (x,z); budget limits chunk builds per call
  stream(x, z, budget = 1) {
    const ccx = Math.floor(x / CHUNK), ccz = Math.floor(z / CHUNK);
    for (const c of [...this.chunks.values()]) if (Math.abs(c.cx - ccx) > 3 || Math.abs(c.cz - ccz) > 3) this.unload(c);
    let made = 0;
    const need = [];
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (!this.chunks.has((ccx + dx) + ',' + (ccz + dz))) need.push([dx, dz]);
    need.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
    for (const [dx, dz] of need) { if (made >= budget) break; this.load(ccx + dx, ccz + dz); made++; }
    return need.length - made;
  }

  tint(n, out) {
    if (n.mesh === 'shroom') return out.set([0xffffff, 0xa8ffe8, 0xffb8d8, 0xd0b8ff][Math.floor(n.tint * 4) % 4]);
    if (n.mesh === 'crystal') return out.set(0xffffff);
    const k = 0.86 + n.tint * 0.28;
    return out.setRGB(k, k, k);
  }
  writeNode(n) {
    if (!n.inst || n.idx < 0) return;
    const s = n.sc * n.anim;
    let tilt = n.fall * 1.35 + (n.shake > 0 ? Math.sin(this.t * 45) * n.shake * 0.1 : 0);
    Q.setFromAxisAngle(UP, n.rot);
    if (tilt) { AX.set(Math.cos(n.fallDir), 0, Math.sin(n.fallDir)); Q2.setFromAxisAngle(AX, tilt); Q.premultiply(Q2); }
    M.compose(V.set(n.x, n.y - 0.05, n.z), Q, S.setScalar(Math.max(0.0001, s)));
    n.inst.mesh.setMatrixAt(n.idx, M);
    n.inst.mesh.instanceMatrix.needsUpdate = true;
  }
  rebuild() {
    for (const k in this.inst) this.inst[k].count = 0;
    for (const c of this.chunks.values()) for (const n of c.nodes) {
      const I = this.inst[n.mesh];
      if (I.count >= CAPS[n.mesh]) { n.inst = null; n.idx = -1; continue; }
      n.inst = I; n.idx = I.count++;
      this.writeNode(n);
      I.mesh.setColorAt(n.idx, this.tint(n, C));
    }
    for (const k in this.inst) { const I = this.inst[k]; I.mesh.count = I.count; I.mesh.visible = I.count > 0; I.mesh.instanceMatrix.needsUpdate = true; if (I.mesh.instanceColor) I.mesh.instanceColor.needsUpdate = true; }
    this.dirty = false;
  }

  nodesNear(x, z, r) {
    const out = [];
    const cx0 = Math.floor((x - r) / CHUNK), cx1 = Math.floor((x + r) / CHUNK), cz0 = Math.floor((z - r) / CHUNK), cz1 = Math.floor((z + r) / CHUNK);
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
      const c = this.chunks.get(cx + ',' + cz);
      if (c) for (const n of c.nodes) if (n.alive) { const dx = n.x - x, dz = n.z - z; if (dx * dx + dz * dz < r * r) out.push(n); }
    }
    return out;
  }
  shake(n) { n.shake = 1; this.active.add(n); }
  kill(n, respawn) { n.alive = false; n.timer = respawn; n.fall = 0.001; n.shake = 0; this.dead.add(n); this.active.add(n); }

  update(dt, t) {
    this.t = t; this.timeU.value = t;
    if (this.dirty) this.rebuild();
    for (const n of this.dead) {
      n.timer -= dt;
      if (n.timer <= 0) { n.alive = true; n.hp = n.maxHp; n.acc = 0; n.fall = 0; n.anim = 0.01; this.dead.delete(n); this.active.add(n); }
    }
    for (const n of this.active) {
      if (n.shake > 0) n.shake = Math.max(0, n.shake - dt * 3.2);
      if (!n.alive) {
        if (n.fall > 0 && n.fall < 1) n.fall = Math.min(1, n.fall + dt * 2.6);
        else if (n.fall >= 1) n.anim = Math.max(0, n.anim - dt * 3);
        if (n.anim <= 0 && n.fall >= 1) { n.anim = 0; this.writeNode(n); this.active.delete(n); continue; }
      } else if (n.anim < 1) { n.anim = Math.min(1, n.anim + dt * 0.8); if (n.anim >= 1 && n.shake <= 0) { this.writeNode(n); this.active.delete(n); continue; } }
      else if (n.shake <= 0) { this.writeNode(n); this.active.delete(n); continue; }
      this.writeNode(n);
    }
  }

  // grass + flowers around the camera focus (rebuilt every few metres)
  updateGrass(px, pz, cz, force) {
    const zi = zoneNear(pz);
    if (!force && Math.hypot(px - this.gpos.x, pz - this.gpos.z) < 4 && zi === this.gpos.zone) return;
    this.gpos = { x: px, z: pz, zone: zi };
    const R = 30, cs = 0.95;
    let gi = 0, fi = 0;
    const gx0 = Math.floor((px - R) / cs), gx1 = Math.floor((px + R) / cs), gz0 = Math.floor((pz - R) / cs), gz1 = Math.floor((pz + R) / cs);
    for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
      const h1 = hash2(gx, gz, 3);
      const x = (gx + hash2(gx, gz, 4)) * cs, z = (gz + hash2(gx, gz, 5)) * cs;
      const d = Math.hypot(x - px, z - pz);
      if (d > R) continue;
      const B = biomeOf(zoneNear(z));
      const dens = [0.9, 0.8, 0.35, 0.22, 0.85][zoneNear(z) % 5];
      if (h1 > dens) continue;
      if (Math.abs(x) < 7 && Math.abs(z - cz) < 9.2) continue;
      if (gi >= 4600) break;
      const fade = 1 - sstep(R - 9, R, d);
      const s = (0.65 + hash2(gx, gz, 6) * 0.7) * fade;
      Q.setFromAxisAngle(UP, hash2(gx, gz, 8) * 6.28);
      M.compose(V.set(x, terrainH(x, z) - 0.03, z), Q, S.set(s, s * (0.8 + h1 * 0.6), s));
      this.grass.setMatrixAt(gi, M);
      C.set(B.grass); const v = 0.8 + hash2(gx, gz, 9) * 0.4; C.multiplyScalar(v);
      this.grass.setColorAt(gi, C); gi++;
    }
    const fs = 2.2;
    const fx0 = Math.floor((px - R) / fs), fx1 = Math.floor((px + R) / fs), fz0 = Math.floor((pz - R) / fs), fz1 = Math.floor((pz + R) / fs);
    for (let gz = fz0; gz <= fz1; gz++) for (let gx = fx0; gx <= fx1; gx++) {
      const x = (gx + hash2(gx, gz, 14)) * fs, z = (gz + hash2(gx, gz, 15)) * fs;
      const B = biomeOf(zoneNear(z));
      if (!B.flowers.length || hash2(gx, gz, 16) > 0.34 || Math.abs(x) < 7 || fi >= 500) continue;
      const d = Math.hypot(x - px, z - pz); if (d > R - 4) continue;
      const s = 0.9 + hash2(gx, gz, 17) * 0.7;
      M.compose(V.set(x, terrainH(x, z) - 0.02, z), Q.identity(), S.setScalar(s));
      this.flowers.setMatrixAt(fi, M);
      this.flowers.setColorAt(fi, C.set(B.flowers[Math.floor(hash2(gx, gz, 18) * B.flowers.length)])); fi++;
    }
    this.grass.count = gi; this.flowers.count = fi;
    for (const m of [this.grass, this.flowers]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }
}
