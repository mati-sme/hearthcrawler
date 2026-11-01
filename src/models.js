// Procedural low-poly models. Each returns merged vertex-coloured geometry (or {body, glow}).
import * as THREE from 'three';
import { P, box, cyl, cone, oct, ring, blob, build } from './geo.js';
import { DECK } from './data.js';

const PI = Math.PI;
const cache = {};
const memo = (k, f) => cache[k] || (cache[k] = f());

// ---------- resource nodes (origin at ground, up = +y)
const foliage = (cols, spots, seed) => spots.map((s, i) => P(blob(s[3], seed + i, 0.2), cols[i % cols.length], { p: [s[0], s[1], s[2]], g: 0.25 }));
const trunk = (h, c = 0x6b4a2e, r = 0.3) => P(cyl(r * 0.7, r, h, 6), c, { p: [0, h / 2, 0], g: 0.3 });
const pine = (cols, snow) => {
  const parts = [trunk(1.8, 0x5a3e28, 0.28)];
  [[1.9, 2.3, 2.3], [1.5, 2.1, 3.7], [1.1, 1.9, 4.9], [0.65, 1.4, 6.0]].forEach(([r, h, y], i) => {
    parts.push(P(cone(r, h, 7), cols[i % cols.length], { p: [0, y, 0], g: 0.3 }));
    if (snow) parts.push(P(cone(r * 0.78, h * 0.55, 7), 0xf4f9ff, { p: [0, y + h * 0.28, 0], j: 0.04 }));
  });
  return build(parts, 3);
};
const NODE_GEO = {
  oak: () => build([trunk(2.6), ...foliage([0x4f9a3c, 0x5fae45, 0x44883a], [[0, 3.7, 0, 1.9], [0.9, 3.2, 0.4, 1.35], [-0.8, 4.4, -0.3, 1.3], [0.1, 5.1, 0.5, 1.0]], 11)], 1),
  maple: () => build([trunk(2.6, 0x6a452c), ...foliage([0xe0702a, 0xd9482a, 0xf0a030], [[0, 3.7, 0, 1.9], [1.0, 3.2, 0.4, 1.4], [-0.9, 4.3, -0.3, 1.4], [0.1, 5.2, 0.4, 1.05]], 21)], 2),
  pine: () => pine([0x2f7a45, 0x2a6e3e, 0x378a4e], false),
  snowpine: () => pine([0x2a6a58, 0x245c4c, 0x2f7a62], true),
  dead: () => build([trunk(3.4, 0x7a5a48, 0.3),
    P(cyl(0.07, 0.13, 1.5, 4), 0x7a5a48, { p: [0.6, 2.6, 0], r: [0, 0, -0.9] }), P(cyl(0.06, 0.1, 1.2, 4), 0x7a5a48, { p: [-0.5, 2.9, 0.2], r: [0.3, 0, 0.8] }),
    P(cyl(0.05, 0.08, 1.0, 4), 0x6a4a3a, { p: [0.2, 3.5, -0.4], r: [-0.8, 0, 0.2] })], 5),
  cactus: () => build([P(cyl(0.42, 0.5, 3.3, 6), 0x5fae62, { p: [0, 1.65, 0], g: 0.3 }), P(cyl(0.28, 0.28, 0.9, 6), 0x5fae62, { p: [0.75, 1.7, 0], r: [0, 0, PI / 2] }),
    P(cyl(0.26, 0.28, 1.2, 6), 0x66b86a, { p: [1.15, 2.2, 0] }), P(cyl(0.26, 0.26, 0.8, 6), 0x5fae62, { p: [-0.65, 1.2, 0], r: [0, 0, PI / 2] }), P(cyl(0.24, 0.26, 1.0, 6), 0x66b86a, { p: [-1.0, 1.7, 0] })], 6),
  shroom: () => build([P(cyl(0.45, 0.7, 2.8, 7), 0xe8dcc0, { p: [0, 1.4, 0], g: 0.3 }),
    P(new THREE.SphereGeometry(2.1, 8, 5, 0, PI * 2, 0, PI / 2), 0xd69ae8, { p: [0, 2.6, 0], s: [1, 0.75, 1], g: 0.2 }),
    ...[[0.8, 4.0, 0.5], [-0.9, 3.8, -0.3], [0.1, 4.2, -0.9], [-0.2, 4.3, 0.9]].map((s) => P(blob(0.28, 2, 0.1, 0), 0xffffff, { p: s }))], 7),
  twisted: () => build([P(cyl(0.2, 0.4, 2.2, 5), 0x4a3a40, { p: [0, 1.1, 0] }), P(cyl(0.15, 0.2, 2.0, 5), 0x4a3a40, { p: [0.5, 2.8, 0], r: [0, 0, -0.45] }),
    P(cyl(0.1, 0.15, 1.6, 5), 0x4a3a40, { p: [0.2, 4.2, 0.1], r: [0.2, 0, 0.35] }), ...foliage([0x2f8f70, 0x3aa080], [[0.3, 5.0, 0, 1.4], [1.3, 3.4, 0.3, 1.0], [-0.6, 4.4, 0.4, 0.9]], 31)], 8),
  rock: () => build([P(blob(1.3, 4, 0.28), 0x8d949b, { p: [0, 0.8, 0], s: [1, 0.75, 1], g: 0.35 }), P(blob(0.7, 5, 0.25), 0x7c838a, { p: [1.1, 0.4, 0.5], g: 0.3 })], 4),
  icerock: () => build([P(blob(1.3, 14, 0.28), 0xa8d0e8, { p: [0, 0.8, 0], s: [1, 0.8, 1], g: 0.3 }), P(blob(0.8, 15, 0.25), 0xcfe8f8, { p: [-1.0, 0.45, 0.4], g: 0.2 }), P(blob(0.8, 16, 0.2), 0xf4f9ff, { p: [0, 1.5, 0], s: [1, 0.4, 1] })], 14),
  redrock: () => build([P(cyl(1.2, 1.5, 1.0, 7), 0xb5532f, { p: [0, 0.5, 0], g: 0.3 }), P(cyl(1.05, 1.2, 0.8, 7), 0xcf7038, { p: [0.05, 1.4, 0], j: 0.12 }), P(cyl(0.8, 1.0, 0.7, 7), 0x9a4a2c, { p: [0.1, 2.15, 0] }), P(cyl(0.5, 0.75, 0.5, 7), 0xd9884a, { p: [0.1, 2.75, 0] })], 9),
  mossrock: () => build([P(blob(1.3, 24, 0.28), 0x5d6b66, { p: [0, 0.8, 0], s: [1, 0.75, 1], g: 0.3 }), P(blob(1.0, 25, 0.25), 0x4a9a5a, { p: [0, 1.3, 0], s: [1, 0.4, 1] })], 24),
  ore: () => build([P(blob(1.3, 34, 0.28), 0x5d5c66, { p: [0, 0.8, 0], s: [1, 0.78, 1], g: 0.35 }),
    ...[[0.7, 1.1, 0.7], [-0.8, 0.9, 0.6], [0.2, 1.6, -0.3], [-0.5, 0.6, -1.0], [1.1, 0.7, -0.4], [0, 0.5, 1.2]].map((s, i) => P(oct(0.22 + (i % 3) * 0.05), 0xffb23a, { p: s, j: 0.0, r: [i, i * 2, 0] }))], 34),
  crystal: () => build([[0, 0, 0, 0, 0, 1.0], [0.7, 0.2, 0.3, 0.25, 0.1, 0.7], [-0.6, 0.1, 0.4, -0.3, 0.2, 0.75], [0.1, 0.1, -0.7, 0.2, -0.3, 0.6]]
    .map((c, i) => P(oct(0.5), i % 2 ? 0xff9ae0 : 0x6fe0d0, { p: [c[0], 0.9 * c[5] + 0.1, c[2]], r: [c[3], c[4], c[3]], s: [0.55 * c[5] + 0.2, 1.9 * c[5], 0.55 * c[5] + 0.2], j: 0.15 }))
    .concat([P(blob(0.8, 3, 0.2), 0x4a5a66, { p: [0, 0.15, 0], s: [1.4, 0.4, 1.4] })]), 44),
  bush: () => build([P(blob(0.8, 51, 0.2), 0x3f8f3a, { p: [0, 0.55, 0], g: 0.3 }), P(blob(0.55, 52, 0.2), 0x4aa045, { p: [0.6, 0.4, 0.3] }),
    ...[[0.3, 0.9, 0.5], [-0.4, 0.8, 0.5], [0.6, 0.6, -0.4], [-0.5, 0.5, -0.5], [0, 1.1, 0]].map((s) => P(oct(0.1), 0xff4a5a, { p: s, j: 0 }))], 51),
  frostbush: () => build([P(blob(0.8, 61, 0.2), 0xcfe8f4, { p: [0, 0.55, 0], g: 0.3 }), P(blob(0.5, 62, 0.2), 0xe6f4fa, { p: [0.55, 0.4, 0.3] }),
    ...[[0.3, 0.9, 0.4], [-0.4, 0.8, 0.4]].map((s) => P(oct(0.09), 0x5ab0ff, { p: s, j: 0 }))], 61),
  dryshrub: () => build([...[0, 1, 2, 3, 4].map((i) => P(cone(0.22, 0.9 + (i % 3) * 0.2, 4), 0xb89a52, { p: [Math.cos(i * 1.3) * 0.35, 0.5, Math.sin(i * 1.3) * 0.35], r: [Math.sin(i) * 0.4, 0, Math.cos(i) * 0.4], g: 0.2 }))], 71),
  glowbush: () => build([P(blob(0.8, 81, 0.2), 0x2f9a80, { p: [0, 0.55, 0], g: 0.3 }), P(blob(0.5, 82, 0.2), 0x3ab096, { p: [0.55, 0.4, 0.3] }),
    ...[[0.3, 0.9, 0.5], [-0.4, 0.8, 0.5], [0.5, 0.7, -0.4], [-0.1, 1.1, 0]].map((s) => P(oct(0.12), 0xff9ad0, { p: s, j: 0 }))], 81),
  scrap: () => build([P(box(1.0, 0.8, 0.8), 0x8a6a4a, { p: [-0.3, 0.4, 0], r: [0, 0.4, 0] }), P(cyl(0.4, 0.4, 0.9, 8), 0xb04a3a, { p: [0.6, 0.45, 0.3] }),
    P(box(1.5, 0.1, 0.9), 0x9aa4ae, { p: [0.1, 0.9, -0.2], r: [0.2, 0.5, 0.3], j: 0.15 }), P(ring(0.42, 0.12, 8), 0x3a3f46, { p: [-0.5, 0.45, 0.9], r: [0.2, 0.3, 0] }),
    P(cyl(0.04, 0.04, 1.6, 4), 0xc8d0d8, { p: [0.9, 0.9, -0.5], r: [0, 0, 0.3] }), P(box(0.5, 0.35, 0.5), 0x4a9aa0, { p: [0.2, 1.1, 0.4], r: [0.3, 0.7, 0] })], 91),
};
export const nodeGeo = (k) => memo('n' + k, NODE_GEO[k]);

// ---------- grass & flowers (positions in local units; y = height factor drives wind sway)
export function grassGeo() {
  const pos = [], col = [], nor = [];
  for (let b = 0; b < 3; b++) {
    const a = (b / 3) * PI, c = Math.cos(a), s = Math.sin(a);
    const w = 0.09, h = 0.55;
    const tri = [[-w, 0, 0, 0.45], [w, 0, 0, 0.45], [0.02, h, 0.03, 1.0]];
    for (const v of tri) { pos.push(v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c); col.push(v[3], v[3], v[3]); nor.push(0, 1, 0); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
export const flowerGeo = () => build([P(cyl(0.015, 0.02, 0.42, 3), 0x9ad07a, { p: [0, 0.21, 0], j: 0 }), P(oct(0.11), 0xffffff, { p: [0, 0.46, 0], s: [1.2, 0.6, 1.2], j: 0.05 })], 2);

// ---------- foes (+Z is forward). returns {body, eyes}
export function foeGeo(type) {
  return memo('f' + type, () => {
    if (type === 'shade') return {
      body: build([P(blob(0.62, 1, 0.12), 0x4a3a78, { p: [0, 0.62, 0], s: [1, 0.92, 1], g: 0.35 }), P(blob(0.2, 2, 0.1, 0), 0x32265a, { p: [-0.28, 0.14, 0.15] }), P(blob(0.2, 3, 0.1, 0), 0x32265a, { p: [0.28, 0.14, 0.15] }),
        P(cone(0.16, 0.34, 4), 0x32265a, { p: [-0.34, 1.18, 0], r: [0, 0, 0.3] }), P(cone(0.16, 0.34, 4), 0x32265a, { p: [0.34, 1.18, 0], r: [0, 0, -0.3] })], 1),
      eyes: build([P(oct(0.13), 0xffe14a, { p: [-0.2, 0.78, 0.5], s: [1, 1.3, 0.6], j: 0 }), P(oct(0.13), 0xffe14a, { p: [0.2, 0.78, 0.5], s: [1, 1.3, 0.6], j: 0 })]),
    };
    if (type === 'boar') return {
      body: build([P(blob(0.8, 4, 0.1), 0x8a5a4a, { p: [0, 0.85, 0], s: [1, 0.85, 1.45], g: 0.3 }), P(blob(0.5, 5, 0.1), 0x9a6650, { p: [0, 0.85, 1.1] }), P(cyl(0.2, 0.26, 0.4, 6), 0xc08a7a, { p: [0, 0.75, 1.5], r: [PI / 2, 0, 0] }),
        P(cone(0.07, 0.4, 4), 0xf4f0e0, { p: [-0.25, 0.7, 1.4], r: [-0.5, 0, 0.5] }), P(cone(0.07, 0.4, 4), 0xf4f0e0, { p: [0.25, 0.7, 1.4], r: [-0.5, 0, -0.5] }),
        P(cone(0.14, 0.3, 4), 0x6a4034, { p: [-0.3, 1.35, 0.95] }), P(cone(0.14, 0.3, 4), 0x6a4034, { p: [0.3, 1.35, 0.95] }),
        ...[[-0.45, 0.8], [0.45, 0.8], [-0.45, -0.7], [0.45, -0.7]].map((l) => P(cyl(0.14, 0.16, 0.5, 5), 0x4a3228, { p: [l[0], 0.25, l[1]] })),
        ...[0, 1, 2, 3].map((i) => P(cone(0.12, 0.3, 4), 0x3a2820, { p: [0, 1.7 - i * 0.04, 0.6 - i * 0.4] }))], 2),
      eyes: build([P(oct(0.08), 0xff6a3a, { p: [-0.26, 1.1, 1.35], j: 0 }), P(oct(0.08), 0xff6a3a, { p: [0.26, 1.1, 1.35], j: 0 })]),
    };
    // raider / warlord
    const w = type === 'warlord';
    const parts = [P(box(0.75, 0.95, 0.5), w ? 0x7a2a3a : 0x6a4a3a, { p: [0, 1.0, 0], g: 0.3 }), P(box(0.28, 0.6, 0.3), 0x3a2a22, { p: [-0.2, 0.3, 0] }), P(box(0.28, 0.6, 0.3), 0x3a2a22, { p: [0.2, 0.3, 0] }),
      P(blob(0.34, 6, 0.1), 0x3a2e28, { p: [0, 1.7, 0] }), P(box(0.62, 0.7, 0.16), w ? 0xd9b04a : 0xb07a4a, { p: [0, 1.68, 0.3], j: 0.05 }), P(box(0.12, 0.16, 0.06), 0x2a1810, { p: [0, 1.5, 0.4] }),
      P(cone(0.1, 0.5, 4), 0xd04a3a, { p: [-0.28, 2.15, 0.1], r: [0, 0, 0.35] }), P(cone(0.1, 0.5, 4), 0xd04a3a, { p: [0.28, 2.15, 0.1], r: [0, 0, -0.35] }),
      P(box(0.2, 0.7, 0.2), 0x5a3e30, { p: [-0.52, 1.0, 0.1], r: [0.4, 0, 0] }), P(box(0.2, 0.7, 0.2), 0x5a3e30, { p: [0.52, 1.0, 0.25], r: [1.2, 0, 0] }),
      P(cyl(0.08, 0.13, 1.1, 5), 0x7a5a3a, { p: [0.52, 1.0, 0.7], r: [1.4, 0, 0] }), P(blob(0.17, 7, 0.1, 0), 0x6a4a30, { p: [0.52, 1.0, 1.2] })];
    if (w) parts.push(P(box(0.9, 0.9, 0.08), 0x9a2a3a, { p: [0, 1.0, -0.3] }), ...[-2, -1, 0, 1, 2].map((i) => P(cone(0.08, 0.35 - Math.abs(i) * 0.04, 4), 0xffd24a, { p: [i * 0.14, 2.05, 0.3] })));
    return {
      body: build(parts, 3),
      eyes: build([P(oct(0.07), 0xffa02a, { p: [-0.16, 1.78, 0.4], j: 0 }), P(oct(0.07), 0xffa02a, { p: [0.16, 1.78, 0.4], j: 0 })]),
    };
  });
}

// ---------- the Shellback beast. origin at ground between feet; head toward -Z
export function beastParts() {
  const shellH = 3.4, legH = 1.9;
  const shell = build([
    P(new THREE.CylinderGeometry(0.86, 1, shellH, 14, 1), 0x6a5a3a, { p: [0, legH + shellH / 2, 0], s: [6.2, 1, 8.2], g: 0.35, j: 0.1 }),
    ...Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * PI * 2; return P(blob(0.9, 100 + i, 0.3, 0), i % 2 ? 0x5a8a4a : 0x4a7a40, { p: [Math.cos(a) * 5.3, legH + 0.6 + (i % 3) * 0.5, Math.sin(a) * 7.0], s: [1.2, 0.7, 1.2] }); }),
    ...Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * PI * 2 + 0.3; return P(cone(0.12, 0.45, 4), 0x78b05a, { p: [Math.cos(a) * 5.1, legH + shellH - 0.3, Math.sin(a) * 6.8] }); }),
  ], 1);
  const head = build([
    P(cyl(0.9, 1.1, 2.4, 8), 0x7a8a5a, { p: [0, 0, 1.0], r: [1.15, 0, 0], g: 0.2 }), P(blob(1.35, 8, 0.1), 0x8a9a62, { p: [0, 0.1, -0.4], s: [1, 0.9, 1.3] }),
    P(blob(0.7, 9, 0.1), 0x9aaa6e, { p: [0, -0.2, -1.5], s: [1, 0.7, 1] }),
    P(cone(0.22, 0.6, 5), 0xe6d8a8, { p: [-0.7, 0.9, -0.3], r: [0, 0, 0.35] }), P(cone(0.22, 0.6, 5), 0xe6d8a8, { p: [0.7, 0.9, -0.3], r: [0, 0, -0.35] }),
    P(blob(0.22, 10, 0.1, 0), 0x6a7a50, { p: [-0.55, 0.5, -1.2], s: [1.5, 0.5, 1] }), P(blob(0.22, 11, 0.1, 0), 0x6a7a50, { p: [0.55, 0.5, -1.2], s: [1.5, 0.5, 1] }),
  ], 2);
  const eyes = build([P(blob(0.26, 12, 0.05, 0), 0x1a1a24, { p: [-0.72, 0.28, -1.15], j: 0 }), P(blob(0.26, 13, 0.05, 0), 0x1a1a24, { p: [0.72, 0.28, -1.15], j: 0 }),
    P(oct(0.08), 0xffffff, { p: [-0.78, 0.38, -1.36], j: 0 }), P(oct(0.08), 0xffffff, { p: [0.66, 0.38, -1.36], j: 0 })]);
  const leg = build([P(cyl(1.0, 1.15, 2.3, 7), 0x6a7a4e, { p: [0, -1.1, 0], g: 0.3 }), P(blob(1.3, 14, 0.1), 0x5a6a42, { p: [0, -2.0, -0.2], s: [1, 0.45, 1.2] }),
    ...[-0.6, 0, 0.6].map((x) => P(cone(0.22, 0.4, 4), 0xe6d8a8, { p: [x, -2.0, -1.1], r: [-1.3, 0, 0] }))], 3);
  const planks = [];
  for (let i = 0; i < 8; i++) planks.push(P(box(DECK.x * 2 / 8 - 0.04, 0.4, DECK.z * 2 + 0.2), i % 2 ? 0xa07a4a : 0x946e42, { p: [-DECK.x + (i + 0.5) * (DECK.x * 2 / 8), DECK.y - 0.2, 0], j: 0.08 }));
  const rail = (x, z, sx, sz) => P(box(sx, 0.1, sz), 0x7a5632, { p: [x, DECK.y + 0.75, z] });
  const post = (x, z) => P(cyl(0.1, 0.12, 0.95, 5), 0x6a4a2a, { p: [x, DECK.y + 0.45, z] });
  const deck = build([...planks,
    ...[[-DECK.x, -DECK.z], [DECK.x, -DECK.z], [-DECK.x, DECK.z], [DECK.x, DECK.z], [-DECK.x, 0], [DECK.x, 0], [0, -DECK.z]].map((p) => post(p[0], p[1])),
    rail(-DECK.x, 0, 0.1, DECK.z * 2), rail(DECK.x, 0, 0.1, DECK.z * 2), rail(0, -DECK.z, DECK.x * 2, 0.1),
    rail(-DECK.x + 0.6, DECK.z, 1.2, 0.1), rail(DECK.x - 0.6, DECK.z, 1.2, 0.1),
    // ramp
    P(box(2.5, 0.25, Math.hypot(7, DECK.y)), 0x8a6840, { p: [0, DECK.y / 2 - 0.1, DECK.z + 3.5], r: [-Math.atan2(DECK.y, 7), 0, 0], j: 0.06 }),
    ...Array.from({ length: 9 }, (_, i) => P(box(2.5, 0.08, 0.14), 0x5a4028, { p: [0, DECK.y - (i + 0.6) * (DECK.y / 9.8) + 0.05, DECK.z + 0.6 + i * 0.72], j: 0 })),
    // helm post
    P(cyl(0.14, 0.18, 1.4, 6), 0x5a3e28, { p: [0, DECK.y + 0.7, -DECK.z + 0.5] }), P(oct(0.3), 0x6fe0d0, { p: [0, DECK.y + 1.6, -DECK.z + 0.5], j: 0 }),
    P(cone(0.35, 0.8, 6), 0xe6d8a8, { p: [-0.5, DECK.y + 1.2, -DECK.z + 0.5], r: [0, 0, 1.2] }),
  ], 4);
  return { shell, head, eyes, leg, deck };
}

// ---------- modules (origin at deck surface, wall runs along x)
const WOOD = [0x9a7048, 0xa07a4a, 0x8a6038];
export function moduleParts(type, lv) {
  const L = Math.min(lv, 5);
  const body = [], glow = [];
  const out = { head: null, flame: null };
  if (type === 'palisade') {
    const n = 7, h = 1.7 + L * 0.12;
    for (let i = 0; i < n; i++) {
      const x = -0.95 + i * (1.9 / (n - 1));
      if (L >= 4) { body.push(P(cyl(0.14, 0.16, h, 5), 0x6a707a, { p: [x, h / 2, 0], g: 0.2 })); body.push(P(cone(0.16, 0.5, 5), 0xc8d0d8, { p: [x, h + 0.2, 0] })); }
      else { body.push(P(cyl(0.13, 0.16, h, 5), WOOD[i % 3], { p: [x, h / 2, 0], g: 0.25 })); body.push(P(cone(0.13, 0.4, 5), WOOD[i % 3], { p: [x, h + 0.15, 0] })); }
    }
    body.push(P(box(2.1, 0.12, 0.14), 0x6a4a2a, { p: [0, 0.55, 0.14] }), P(box(2.1, 0.12, 0.14), 0x6a4a2a, { p: [0, 1.15, 0.14] }));
    if (L >= 2) body.push(P(box(2.1, 0.1, 0.18), 0x4a4f58, { p: [0, 0.8, 0.0] }));
    if (L >= 3) body.push(P(box(2.2, 0.4, 0.5), 0x8d949b, { p: [0, 0.2, 0], g: 0.3 }), P(box(0.5, 0.3, 0.55), 0x7c838a, { p: [-0.7, 0.5, 0] }));
    if (L >= 4) for (let i = 0; i < 4; i++) body.push(P(cone(0.1, 0.45, 4), 0x9aa4ae, { p: [-0.75 + i * 0.5, 1.0, 0.3], r: [PI / 2, 0, 0] }));
    if (L >= 5) for (let i = 0; i < 5; i++) glow.push(P(box(0.05, 0.9, 0.05), 0x6fe0d0, { p: [-0.8 + i * 0.4, 1.0, 0.18], j: 0 }));
  } else if (type === 'lantern') {
    body.push(P(cyl(0.07, 0.1, 1.5 + L * 0.1, 5), 0x4a3a2a, { p: [0, 0.8, 0] }), P(box(0.5, 0.06, 0.06), 0x4a3a2a, { p: [0.2, 1.5, 0] }));
    const lampY = 1.35 + L * 0.1;
    body.push(P(cone(0.28, 0.25, 4), 0x3a3a44, { p: [0.45, lampY + 0.4, 0], r: [0, PI / 4, 0] }), P(box(0.36, 0.05, 0.36), 0x3a3a44, { p: [0.45, lampY - 0.3, 0] }));
    glow.push(P(oct(0.2 + L * 0.02), L >= 4 ? 0x7ff0e0 : 0xffc060, { p: [0.45, lampY, 0], s: [1, 1.3, 1], j: 0 }));
    if (L >= 3) { body.push(P(cyl(0.02, 0.02, 0.8, 4), 0x3a3a44, { p: [-0.45, 1.1, 0] })); glow.push(P(oct(0.14), 0xffc060, { p: [-0.45, 0.7, 0], j: 0 })); }
    if (L >= 5) glow.push(P(oct(0.18), 0xff9ae0, { p: [0.45, lampY + 0.9, 0], s: [0.7, 1.6, 0.7], j: 0 }));
    out.flame = [0.45, lampY, 0];
  } else if (type === 'bed') {
    body.push(P(box(1.3, 0.3, 2.1), 0x8a6038, { p: [0, 0.3, 0] }), P(box(1.2, 0.22, 1.95), [0x4a6a9a, 0x5a7ab0, 0x9a4a6a][Math.min(L, 3) - 1], { p: [0, 0.52, 0.05], j: 0.12 }),
      P(box(0.9, 0.18, 0.5), 0xf4f0e0, { p: [0, 0.7, -0.7], j: 0.05 }), P(box(0.14, 0.7, 0.14), 0x6a4a2a, { p: [-0.6, 0.35, -1.0] }), P(box(0.14, 0.7, 0.14), 0x6a4a2a, { p: [0.6, 0.35, -1.0] }));
    if (L >= 2) body.push(P(box(1.2, 0.08, 0.7), 0xe8c85a, { p: [0, 0.66, 0.6] }));
    if (L >= 3) body.push(P(cyl(0.05, 0.05, 1.8, 4), 0x6a4a2a, { p: [-0.6, 0.9, 1.0] }), P(cyl(0.05, 0.05, 1.8, 4), 0x6a4a2a, { p: [0.6, 0.9, 1.0] }), P(box(1.4, 0.05, 2.2), 0xc8586a, { p: [0, 1.8, 0], j: 0.08 }));
  } else if (type === 'turret') {
    body.push(P(box(1.0, 0.55, 1.0), 0x7a5632, { p: [0, 0.28, 0], g: 0.3 }), P(cyl(0.3, 0.38, 0.5, 8), L >= 3 ? 0x6a707a : 0x6a4a2a, { p: [0, 0.8, 0] }));
    const head = [];
    const arm = L >= 3 ? 0x8d949b : 0x7a5632;
    head.push(P(box(0.34, 0.3, 1.5 + L * 0.05), L >= 3 ? 0x6a707a : 0x8a6038, { p: [0, 0, 0.2] }), P(box(1.5 + L * 0.1, 0.1, 0.1), arm, { p: [0, 0.08, 0.85], r: [0, 0, 0.0] }),
      P(box(0.08, 0.08, 0.7), 0xc8d0d8, { p: [0, 0.2, 0.7], j: 0 }), P(cone(0.08, 0.3, 4), 0xc8d0d8, { p: [0, 0.2, 1.2], r: [PI / 2, 0, 0], j: 0 }));
    if (L >= 2) head.push(P(box(0.4, 0.36, 0.5), 0x4a4f58, { p: [0, 0.02, -0.3] }));
    if (L >= 3) head.push(P(box(0.14, 0.14, 1.4), 0x9aa4ae, { p: [0.28, 0.0, 0.5] }), P(box(0.14, 0.14, 1.4), 0x9aa4ae, { p: [-0.28, 0.0, 0.5] }));
    const hg = [];
    if (L >= 4) hg.push(P(oct(0.14), 0x6fe0d0, { p: [0, 0.28, 0.2], j: 0 }), P(box(0.06, 0.06, 0.5), 0x6fe0d0, { p: [0, 0.2, 0.95], j: 0 }));
    if (L >= 5) hg.push(P(oct(0.22), 0xff9ae0, { p: [0, 0.72, -0.2], s: [0.8, 1.6, 0.8], j: 0 }));
    out.head = { body: build(head, 5), glow: hg.length ? build(hg) : null, y: 1.15 };
  } else if (type === 'storage') {
    body.push(P(box(1.4, 0.8, 1.0), 0x8a6038, { p: [0, 0.4, 0], g: 0.25 }), P(box(1.5, 0.28, 1.1), 0xa07a4a, { p: [0, 0.94, 0] }), P(box(1.45, 0.1, 0.12), 0x4a4f58, { p: [0, 0.55, 0.5] }), P(box(0.2, 0.2, 0.1), 0xe8c85a, { p: [0, 0.75, 0.55], j: 0 }));
    if (L >= 2) body.push(P(box(1.0, 0.7, 0.9), 0x7a5632, { p: [0.1, 1.45, 0], r: [0, 0.3, 0] }), P(cyl(0.38, 0.38, 0.9, 8), 0xb04a3a, { p: [1.0, 0.45, 0.2] }));
    if (L >= 3) body.push(P(box(1.7, 0.08, 1.4), 0x4a6a9a, { p: [-0.1, 1.9, 0], r: [0.05, 0, 0.08], j: 0.1 }), P(box(0.9, 0.7, 0.8), 0x8a6038, { p: [-1.1, 0.35, 0.1] }));
  } else if (type === 'garden') {
    body.push(P(box(1.8, 0.35, 1.8), 0x7a5632, { p: [0, 0.18, 0] }), P(box(1.6, 0.1, 1.6), 0x4a3426, { p: [0, 0.36, 0], j: 0.12 }));
    const n = 3 + L * 2;
    for (let i = 0; i < n; i++) { const a = i * 2.4, rr = 0.2 + (i % 3) * 0.28; body.push(P(blob(0.22 + (L - 1) * 0.03, 40 + i, 0.2, 0), i % 2 ? 0x4aa045 : 0x5fb84a, { p: [Math.cos(a) * rr, 0.55, Math.sin(a) * rr], s: [1, 1.3, 1] })); }
    for (let i = 0; i < 4; i++) glow.push(P(blob(0.15, 70 + i, 0.1, 0), [0xff6a3a, 0xffb02a, 0xe8404a, 0xff8a3a][i], { p: [Math.cos(i * 1.6) * 0.5, 0.78, Math.sin(i * 1.6) * 0.5], j: 0 }));
    out.crops = true;
  } else if (type === 'furnace') {
    body.push(P(box(1.5, 1.2, 1.3), L >= 2 ? 0x7a6a62 : 0x6c7078, { p: [0, 0.6, 0], g: 0.35, j: 0.12 }), P(cyl(0.3, 0.38, 1.0, 6), 0x4a4f58, { p: [0.4, 1.7, -0.2] }), P(box(1.6, 0.14, 1.4), 0x555a62, { p: [0, 1.25, 0] }));
    if (L >= 2) body.push(P(box(1.6, 0.1, 0.12), 0x4a4f58, { p: [0, 0.4, 0.66] }), P(box(1.6, 0.1, 0.12), 0x4a4f58, { p: [0, 0.9, 0.66] }));
    if (L >= 3) for (let i = 0; i < 3; i++) glow.push(P(box(0.05, 0.5, 0.05), 0x6fe0d0, { p: [-0.5 + i * 0.5, 0.65, 0.68], j: 0 }));
    glow.push(P(box(0.6, 0.4, 0.1), 0xff7a2a, { p: [0, 0.45, 0.67], j: 0 }));
    out.furnace = true;
  }
  out.body = build(body, 7);
  out.glow = glow.length ? build(glow) : null;
  return out;
}
export const SLOT_ROT = [0, 0, Math.PI / 2, Math.PI / 2, 0, 0, 0, 0, 0, 0];

// ---------- viewmodel tools (first person; origin = grip, tool points +y)
const SK = 0xe8b890;
export function toolGeo(slot, tier) {
  return memo(`v${slot}${tier}`, () => {
    const head = [0x8d949b, 0xb8c4d0, 0x6fe0d0][Math.max(0, Math.min(2, tier - 1))];
    const dark = [0x6c7278, 0x7c8894, 0x3aa89a][Math.max(0, Math.min(2, tier - 1))];
    const wood = 0x8a6038;
    const arm = [P(cyl(0.055, 0.07, 0.55, 6), 0x2a4a58, { p: [0.03, -0.38, 0.12], r: [-0.35, 0, 0], g: 0.2 }), P(blob(0.065, 77, 0.1, 0), SK, { p: [0, -0.02, 0], j: 0.04 })];
    let parts = [];
    if (slot === 'axe') parts = [P(cyl(0.025, 0.03, 0.62, 5), wood, { p: [0, 0.2, 0] }), P(box(0.07, 0.17, 0.05), dark, { p: [0, 0.46, 0] }), P(box(0.2, 0.17, 0.035), head, { p: [0.1, 0.48, 0], j: 0.05 }), P(cone(0.09, 0.04, 4), head, { p: [0.22, 0.48, 0], r: [0, 0, -PI / 2] })];
    else if (slot === 'pick') parts = [P(cyl(0.025, 0.03, 0.64, 5), wood, { p: [0, 0.2, 0] }), P(box(0.5, 0.06, 0.06), dark, { p: [0, 0.5, 0] }), P(cone(0.04, 0.2, 4), head, { p: [0.31, 0.46, 0], r: [0, 0, -PI / 2 - 0.4] }), P(cone(0.04, 0.2, 4), head, { p: [-0.31, 0.46, 0], r: [0, 0, PI / 2 + 0.4] })];
    else if (slot === 'melee') {
      if (tier <= 1) parts = [P(cyl(0.05, 0.03, 0.6, 6), 0xa0764a, { p: [0, 0.3, 0] }), P(blob(0.09, 78, 0.2, 0), 0x8a6038, { p: [0, 0.62, 0] }), P(oct(0.03), 0x6a4a2a, { p: [0.05, 0.5, 0.03] })];
      else parts = [P(cyl(0.022, 0.026, 1.0, 5), wood, { p: [0, 0.35, 0] }), P(cone(0.05, 0.28, 4), head, { p: [0, 0.99, 0], j: 0.05 }), P(box(0.13, 0.03, 0.03), dark, { p: [0, 0.86, 0] })];
    } else if (slot === 'ranged') parts = [P(box(0.07, 0.07, 0.6), wood, { p: [0, 0.05, -0.2] }), P(box(0.5, 0.04, 0.04), [0x6a4a2a, 0x8d949b, 0x6fe0d0][Math.max(0, Math.min(2, tier - 1))], { p: [0, 0.07, -0.42], r: [0, 0.25, 0] }),
      P(box(0.5, 0.04, 0.04), 0x5a5a5a, { p: [0, 0.07, -0.36], r: [0, -0.25, 0], j: 0 }), P(box(0.03, 0.03, 0.4), 0xc8d0d8, { p: [0, 0.1, -0.35], j: 0 }), P(cone(0.03, 0.1, 4), 0xc8d0d8, { p: [0, 0.1, -0.62], r: [-PI / 2, 0, 0], j: 0 })];
    else if (slot === 'torch') parts = [P(cyl(0.03, 0.04, 0.6, 5), 0x6a4a2a, { p: [0, 0.2, 0] }), P(blob(0.08, 79, 0.2, 0), 0x2a2018, { p: [0, 0.52, 0] }), P(cyl(0.03, 0.06, 0.1, 5), 0x4a4f58, { p: [0, 0.45, 0] })];
    else if (slot === 'hammer') parts = [P(cyl(0.025, 0.03, 0.55, 5), wood, { p: [0, 0.18, 0] }), P(box(0.2, 0.12, 0.12), 0x8d949b, { p: [0, 0.5, 0] }), P(box(0.22, 0.04, 0.14), 0x4a4f58, { p: [0, 0.5, 0], j: 0 })];
    else parts = [P(blob(0.075, 80, 0.1, 0), SK, { p: [0.0, 0.0, 0.0] })]; // fists
    return build([...arm, ...parts], 9);
  });
}
