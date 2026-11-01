// Pure terrain + resource-node generation (no three). The caravan travels along -Z at x = 0.
import { ZONE_LEN, biomeOf, NODES } from './data.js';

export const CHUNK = 48;
export const CORRIDOR = 14; // keep the beast's road clear of nodes

export function hash2(a, b, s = 0) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// {a,b,t}: zone a blends into zone b with weight t (zone centres sit at integer u = -z/ZONE_LEN)
export function zoneAt(z) {
  const u = Math.max(0, -z / ZONE_LEN);
  const j = Math.floor(u);
  return { a: j, b: j + 1, t: sstep(j + 0.42, j + 0.58, u) };
}
export const zoneNear = (z) => { const q = zoneAt(z); return q.t >= 0.5 ? q.b : q.a; };

export function terrainH(x, z) {
  const q = zoneAt(z);
  const A = biomeOf(q.a), B = biomeOf(q.b);
  const amp = A.amp + (B.amp - A.amp) * q.t;
  const ter = A.terrace + (B.terrace - A.terrace) * q.t;
  let h = (vnoise(x * 0.011 + 7, z * 0.011 + 3) - 0.5) * 3.2 * amp + (vnoise(x * 0.04, z * 0.04) - 0.5) * 0.8 * amp + (vnoise(x * 0.12, z * 0.12) - 0.5) * 0.35;
  if (ter > 0) { const st = 1.1; h += (Math.round(h / st) * st - h) * ter; }
  const road = 0.15 + 0.85 * sstep(CORRIDOR - 2, CORRIDOR + 16, Math.abs(x)); // flatter valley for the beast
  return h * road;
}

const COUNTS = { // per 48 m chunk by biome index: trees, rocks, ore, crystal, bush, scrap
  0: [20, 6, 1.2, 0, 8, 3], 1: [26, 6, 1.4, 0, 8, 3.5], 2: [14, 7, 1.6, 2.2, 5, 4], 3: [9, 9, 2.4, 1.2, 4, 4], 4: [16, 6, 1.6, 2.4, 7, 4],
};
const SPACING = { tree: 3.0, rock: 3.4, ore: 3.4, crystal: 3.6, bush: 2.0, scrap: 2.6 };
const RADIUS = { tree: 0.6, rock: 1.1, ore: 1.1, crystal: 0.9, bush: 0.6, scrap: 0.8 };

export function genNodes(cx, cz) {
  const r = rng(hash2(cx, cz, 91) * 4294967296);
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  const nodes = [];
  const place = (kind, n) => {
    const cnt = Math.floor(n) + (r() < n - Math.floor(n) ? 1 : 0);
    for (let i = 0; i < cnt; i++) {
      for (let tries = 0; tries < 6; tries++) {
        const x = x0 + r() * CHUNK, z = z0 + r() * CHUNK;
        if (Math.abs(x) < CORRIDOR + (kind === 'bush' ? 1 : 0) && z < 40) continue; // road (and the start camp, which is z>0 side too)
        if (Math.abs(x) < CORRIDOR && z >= 40) continue;
        const zi = zoneNear(z);
        const B = biomeOf(zi);
        if (kind === 'crystal' && zi < 2) continue;
        let bad = false;
        for (const o of nodes) { const dx = o.x - x, dz = o.z - z; const m = (SPACING[kind] + SPACING[o.kind]) * 0.5; if (dx * dx + dz * dz < m * m) { bad = true; break; } }
        if (bad) continue;
        let mesh;
        if (kind === 'tree') mesh = B.trees[r() < 0.7 ? 0 : 1];
        else if (kind === 'rock') mesh = B.rock;
        else if (kind === 'bush') mesh = B.bush;
        else mesh = kind;
        const big = kind === 'scrap' && zi >= 1 && r() < 0.3;
        const sc = (kind === 'tree' ? 0.85 + r() * 0.5 : kind === 'bush' ? 0.8 + r() * 0.4 : 0.8 + r() * 0.55) * (big ? 1.5 : 1);
        const d = NODES[kind];
        nodes.push({
          kind, mesh, x, z, y: terrainH(x, z), sc, rot: r() * Math.PI * 2, fallDir: r() * Math.PI * 2, tint: r(),
          r: RADIUS[kind] * sc, hp: d.hp * (big ? 1.6 : 1), maxHp: d.hp * (big ? 1.6 : 1), acc: 0, zone: zi, big,
          alive: true, timer: 0, shake: 0, anim: 1, fall: 0, inst: null, idx: -1, h: (kind === 'tree' ? 5 : kind === 'bush' ? 0.9 : 1.4) * sc,
        });
        break;
      }
    }
  };
  const bi = zoneNear(z0 + CHUNK / 2) % 5;
  const c = COUNTS[bi];
  place('tree', c[0]); place('rock', c[1]); place('ore', c[2]); place('crystal', c[3]); place('bush', c[4]); place('scrap', c[5]);
  return nodes;
}
