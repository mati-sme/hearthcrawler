// Low-poly geometry helpers: parts -> one merged, flat-shaded, vertex-coloured BufferGeometry.
import * as THREE from 'three';
import { hash2 } from './terrain.js';

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
const C = new THREE.Color();

// o: p position, r euler, s scale, j facet jitter, g bottom darkening
export const P = (geo, hex, o = {}) => Object.assign({ geo, hex }, o);
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg, 1);
export const cone = (r, h, seg = 6) => new THREE.ConeGeometry(r, h, seg, 1);
export const oct = (r) => new THREE.OctahedronGeometry(r, 0);
export const ring = (r, t, seg = 8) => new THREE.TorusGeometry(r, t, 4, seg);

export function blob(r, seed = 1, amt = 0.2, detail = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const h = hash2(Math.round(x * 40) + seed * 7, Math.round(y * 40) - Math.round(z * 40), seed);
    const k = 1 + (h - 0.5) * 2 * amt;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  return g;
}

export function build(parts, seed = 1) {
  const pos = [], col = [];
  let pi = 0;
  for (const part of parts) {
    const g = part.geo.index ? part.geo.toNonIndexed() : part.geo.clone();
    M4.compose(V.fromArray(part.p || [0, 0, 0]), Q.setFromEuler(E.set(...(part.r || [0, 0, 0]))), S.fromArray(part.s || [1, 1, 1]));
    g.applyMatrix4(M4);
    g.computeBoundingBox();
    const y0 = g.boundingBox.min.y, dy = Math.max(1e-4, g.boundingBox.max.y - y0);
    const p = g.attributes.position.array;
    C.set(part.hex);
    const j = part.j ?? 0.09, gr = part.g ?? 0;
    for (let i = 0; i < p.length; i += 9) {
      const f = 1 + (hash2(pi * 131 + i / 9, seed, 5) - 0.5) * 2 * j;
      for (let k = 0; k < 3; k++) {
        const y = p[i + k * 3 + 1];
        const gv = f * (1 - gr * (1 - (y - y0) / dy));
        pos.push(p[i + k * 3], y, p[i + k * 3 + 2]);
        col.push(C.r * gv, C.g * gv, C.b * gv);
      }
    }
    g.dispose();
    pi++;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeVertexNormals();
  return out;
}
export const lit = (extra) => new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true, flatShading: true }, extra));
export const unlit = (extra) => new THREE.MeshBasicMaterial(Object.assign({ vertexColors: true, fog: true }, extra));
