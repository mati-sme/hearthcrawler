(function () {
  'use strict';
  const HC = window.HC;
  const CELL = 128, GN = Math.ceil(HC.WORLD / CELL), CH = 384;

  // ---------- colour helpers ----------
  function hexToHsl(h) {
    const r = parseInt(h.slice(1, 3), 16) / 255, g = parseInt(h.slice(3, 5), 16) / 255, b = parseInt(h.slice(5, 7), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    let hh = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      hh *= 60;
    }
    return [hh, s, l];
  }
  function hslStr(h, s, l) { return `hsl(${Math.round(h)},${Math.round(s * 100)}%,${Math.round(l * 100)}%)`; }
  function shift(hex, deg) {
    if (hex[0] !== '#') return hex;
    const [h, s, l] = hexToHsl(hex);
    return hslStr((h + deg) % 360, s, l);
  }
  HC.shiftColor = shift;

  const W = (HC.W = {
    nodes: [], grid: [], Z: null, cx: HC.WORLD / 2, cy: HC.WORLD / 2, lair: null,
    sprites: null, chunks: new Map(), frame: 0, scale: 1, dead: [],
  });

  const NODE = {
    tree: { r: 18, cr: 9, hp: 4, res: 'wood', amt: [3, 4], resp: 50, stump: 1 },
    rock: { r: 20, cr: 16, hp: 5, res: 'stone', amt: [2, 3], resp: 60 },
    scrap: { r: 18, cr: 14, hp: 3, res: 'scrap', amt: [3, 5], resp: 55 },
    bush: { r: 15, cr: 0, hp: 1.5, res: 'food', amt: [2, 3], resp: 28 },
  };
  HC.NODE = NODE;

  // ---------- zone generation ----------
  HC.genZone = function (zid, dist) {
    const z = HC.ZONE[zid] || HC.ZONE.meadow;
    const base = z.far ? HC.farBase(dist) : z;
    let pal = base.pal;
    if (z.far) {
      const sh = Math.floor((dist - 7) / 6) * 28;
      if (sh) { const p = {}; for (const k in pal) p[k] = shift(pal[k], sh); pal = p; }
    }
    const Z = {
      id: z.id, dist, name: z.far ? `Far Roads` : z.name, icon: z.icon, pal, tree: base.tree, decor: base.decor,
      mix: z.mix, crit: z.crit, day: z.day, night: z.night, bossId: z.boss, far: !!z.far, baseId: base.id,
    };
    W.Z = Z;
    const seed = HC.hashStr(zid) + dist * 7919;
    const rnd = HC.rng(seed);
    W.seed = seed;
    W.nodes = [];
    W.dead = [];
    W.grid = new Array(GN * GN);
    for (let i = 0; i < W.grid.length; i++) W.grid[i] = [];
    const cx = (W.cx = HC.WORLD / 2), cy = (W.cy = HC.WORLD / 2);

    const place = (type, x, y) => {
      const d = NODE[type];
      const n = { type, x, y, r: d.r, cr: d.cr, v: Math.floor(rnd() * 3), hp: d.hp, maxhp: d.hp, alive: true, t: 0, pop: 0, shake: 0 };
      W.nodes.push(n);
      W.grid[Math.floor(y / CELL) * GN + Math.floor(x / CELL)].push(n);
      return n;
    };
    const free = (x, y, minD) => {
      const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
      for (let j = gy - 1; j <= gy + 1; j++) for (let i = gx - 1; i <= gx + 1; i++) {
        if (i < 0 || j < 0 || i >= GN || j >= GN) continue;
        const c = W.grid[j * GN + i];
        for (let k = 0; k < c.length; k++) { const o = c[k]; if ((o.x - x) * (o.x - x) + (o.y - y) * (o.y - y) < minD * minD) return false; }
      }
      return true;
    };
    const M = 150, scale = 1 + 0.04 * Math.min(dist - 1, 8);
    for (const type of ['tree', 'rock', 'scrap', 'bush']) {
      const want = Math.round(z.mix[type] * (z.far ? 1 : 1));
      const clumps = [];
      for (let i = 0; i < 7; i++) clumps.push([M + rnd() * (HC.WORLD - 2 * M), M + rnd() * (HC.WORLD - 2 * M)]);
      let placed = 0, tries = 0;
      // starter ring close to the caravan so early goals are quick
      const starter = { tree: 4, rock: 3, bush: 3, scrap: 2 }[type];
      for (let i = 0; i < starter; i++) {
        const a = rnd() * Math.PI * 2, rad = 270 + rnd() * 150;
        const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad * 0.9;
        if (free(x, y, 46)) { place(type, x, y); placed++; }
      }
      while (placed < want && tries++ < want * 30) {
        let x, y;
        if (rnd() < 0.65) {
          const c = clumps[Math.floor(rnd() * clumps.length)], a = rnd() * 6.283, rad = Math.pow(rnd(), 0.7) * 190;
          x = c[0] + Math.cos(a) * rad; y = c[1] + Math.sin(a) * rad;
        } else { x = M + rnd() * (HC.WORLD - 2 * M); y = M + rnd() * (HC.WORLD - 2 * M); }
        if (x < 70 || y < 70 || x > HC.WORLD - 70 || y > HC.WORLD - 70) continue;
        if (Math.abs(x - cx) < 230 && Math.abs(y - cy) < 260) continue;
        if (!free(x, y, 44)) continue;
        place(type, x, y); placed++;
      }
    }
    W.nodeYield = scale;
    // boss lair
    W.lair = null;
    if (z.boss && !HC.S.bossDown[zid]) {
      const a = rnd() * Math.PI * 2;
      W.lair = { x: HC.clamp(cx + Math.cos(a) * 820, 260, HC.WORLD - 260), y: HC.clamp(cy + Math.sin(a) * 820, 260, HC.WORLD - 260), boss: z.boss };
    }
    makeSprites();
    W.chunks.clear();
    W.dead = [];
  };

  // nodes within radius r of (x,y) -> out[]
  HC.queryNodes = function (x, y, r, out) {
    out.length = 0;
    const x0 = Math.max(0, Math.floor((x - r) / CELL)), x1 = Math.min(GN - 1, Math.floor((x + r) / CELL));
    const y0 = Math.max(0, Math.floor((y - r) / CELL)), y1 = Math.min(GN - 1, Math.floor((y + r) / CELL));
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
      const c = W.grid[j * GN + i];
      for (let k = 0; k < c.length; k++) out.push(c[k]);
    }
    return out;
  };

  HC.updateNodes = function (dt) {
    const d = W.dead;
    for (let i = d.length - 1; i >= 0; i--) {
      const n = d[i];
      n.t -= dt;
      if (n.t <= 0) { n.alive = true; n.hp = n.maxhp; n.pop = 0.4; d[i] = d[d.length - 1]; d.pop(); }
    }
    const ns = W.nodes;
    for (let i = 0; i < ns.length; i++) {
      const n = ns[i];
      if (n.shake > 0) n.shake -= dt;
      if (n.pop > 0) n.pop -= dt;
    }
  };
  HC.killNode = function (n) {
    n.alive = false; n.t = NODE[n.type].resp * HC.PACE.resp * (0.85 + Math.random() * 0.3);
    W.dead.push(n);
  };

  // ---------- node sprites (pre-rendered per zone) ----------
  function makeSprites() {
    const pal = W.Z.pal, SC = W.scale = Math.min(2, window.devicePixelRatio || 1) * 1.0;
    const spr = { tree: [], rock: [], scrap: [], bush: [], stump: null, rubble: null, dust: null, bare: null };
    const mk = (w, h, ox, oy, fn) => {
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(w * SC); cv.height = Math.ceil(h * SC);
      const c = cv.getContext('2d');
      c.scale(SC, SC); c.translate(ox, oy); c.lineJoin = 'round'; c.lineCap = 'round';
      fn(c);
      return { cv, w, h, ox, oy };
    };
    const shadow = (c, rx, ry) => { c.fillStyle = 'rgba(30,30,50,0.22)'; c.beginPath(); c.ellipse(0, 2, rx, ry, 0, 0, 7); c.fill(); };
    const blob = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };
    const outline = 'rgba(40,30,30,0.35)';
    const tz = W.Z.tree, zid = W.Z.baseId;

    for (let v = 0; v < 3; v++) {
      const s = [1, 0.85, 1.12][v];
      spr.tree.push(mk(110, 130, 55, 118, (c) => {
        c.scale(s, s);
        shadow(c, 26, 9);
        if (tz === 'round') {
          c.fillStyle = pal.trunk; HC.rr(c, -6, -28, 12, 30, 4); c.fill();
          blob(c, 0, -46, 25, pal.leaf2); blob(c, -14, -36, 17, pal.leaf2); blob(c, 15, -37, 17, pal.leaf2);
          blob(c, 0, -52, 24, pal.leaf); blob(c, -14, -42, 16, pal.leaf); blob(c, 15, -43, 16, pal.leaf);
          blob(c, -7, -60, 9, 'rgba(255,255,255,0.22)');
          if (v === 1) { blob(c, 8, -50, 3.5, '#ff6a6a'); blob(c, -10, -44, 3.5, '#ff6a6a'); }
        } else if (tz === 'pine' || tz === 'snowpine') {
          c.fillStyle = pal.trunk; HC.rr(c, -5, -18, 10, 20, 3); c.fill();
          const tiers = [[26, -16, -42], [21, -34, -58], [15, -50, -72]];
          tiers.forEach((t, i) => {
            c.fillStyle = i % 2 ? pal.leaf : pal.leaf2;
            c.beginPath(); c.moveTo(-t[0], t[1]); c.lineTo(0, t[2]); c.lineTo(t[0], t[1]); c.closePath(); c.fill();
            c.strokeStyle = outline; c.lineWidth = 1.5; c.stroke();
            if (tz === 'snowpine') {
              c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-t[0] * 0.55, t[1] + (t[2] - t[1]) * 0.45); c.lineTo(0, t[2]);
              c.lineTo(t[0] * 0.55, t[1] + (t[2] - t[1]) * 0.45); c.quadraticCurveTo(0, t[1] + (t[2] - t[1]) * 0.25, -t[0] * 0.55, t[1] + (t[2] - t[1]) * 0.45); c.fill();
            }
          });
        } else if (tz === 'dead') {
          if (zid === 'badlands' && v !== 2) { // cactus
            c.fillStyle = '#6aa84a'; c.strokeStyle = '#3f7a30'; c.lineWidth = 2;
            HC.rr(c, -8, -52, 16, 54, 8); c.fill(); c.stroke();
            HC.rr(c, -22, -38, 10, 22, 5); c.fill(); c.stroke(); HC.rr(c, -22, -20, 18, 8, 4); c.fill(); c.stroke();
            HC.rr(c, 12, -44, 10, 24, 5); c.fill(); c.stroke(); HC.rr(c, 4, -26, 18, 8, 4); c.fill(); c.stroke();
            c.fillStyle = '#ff7aa8'; c.beginPath(); c.arc(0, -54, 4, 0, 7); c.fill();
          } else {
            c.strokeStyle = pal.trunk; c.lineWidth = 8; c.beginPath(); c.moveTo(0, 2); c.quadraticCurveTo(-4, -30, 2, -56); c.stroke();
            c.lineWidth = 5; c.beginPath(); c.moveTo(0, -26); c.quadraticCurveTo(-14, -34, -24, -52); c.stroke();
            c.beginPath(); c.moveTo(1, -38); c.quadraticCurveTo(14, -44, 22, -62); c.stroke();
            c.lineWidth = 3; c.beginPath(); c.moveTo(-14, -39); c.lineTo(-24, -34); c.stroke();
            blob(c, -24, -54, 5, pal.leaf); blob(c, 22, -64, 5, pal.leaf);
          }
        } else { // char
          c.strokeStyle = '#2a2024'; c.lineWidth = 9; c.beginPath(); c.moveTo(0, 2); c.quadraticCurveTo(4, -30, -2, -56); c.stroke();
          c.lineWidth = 5; c.beginPath(); c.moveTo(1, -24); c.quadraticCurveTo(16, -34, 24, -50); c.stroke();
          c.beginPath(); c.moveTo(-1, -40); c.quadraticCurveTo(-14, -46, -22, -60); c.stroke();
          c.fillStyle = '#ff8a2a'; c.beginPath(); c.arc(24, -51, 3.5, 0, 7); c.arc(-22, -61, 3.5, 0, 7); c.arc(-2, -58, 3, 0, 7); c.fill();
          c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(24, -51, 1.6, 0, 7); c.arc(-22, -61, 1.6, 0, 7); c.fill();
        }
      }));
    }
    for (let v = 0; v < 3; v++) {
      const s = [1, 0.8, 1.15][v];
      spr.rock.push(mk(90, 80, 45, 66, (c) => {
        c.scale(s, s);
        shadow(c, 28, 9);
        const base = pal.rock, dk = pal.rock2;
        c.beginPath(); c.moveTo(-26, 0); c.bezierCurveTo(-34, -16, -22, -38, -4, -40); c.bezierCurveTo(16, -42, 34, -26, 28, -4); c.bezierCurveTo(26, 4, -20, 6, -26, 0); c.closePath();
        c.fillStyle = dk; c.fill();
        c.beginPath(); c.moveTo(-24, -4); c.bezierCurveTo(-30, -18, -20, -36, -4, -38); c.bezierCurveTo(14, -40, 28, -26, 24, -10); c.bezierCurveTo(10, -6, -14, -2, -24, -4); c.closePath();
        c.fillStyle = base; c.fill();
        c.strokeStyle = outline; c.lineWidth = 1.6; c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(-10, -28, 9, 5, -0.5, 0, 7); c.fill();
        if (zid === 'frost') { c.fillStyle = '#e8f6ff'; c.strokeStyle = '#8fb4d0'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(8, -34); c.lineTo(14, -52); c.lineTo(20, -32); c.closePath(); c.fill(); c.stroke(); }
        if (zid === 'ember') { c.strokeStyle = '#ff8a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-6, -34); c.lineTo(-2, -22); c.lineTo(-10, -12); c.stroke(); }
        if (zid === 'badlands') { c.strokeStyle = 'rgba(120,70,40,.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-22, -18); c.lineTo(22, -22); c.moveTo(-20, -9); c.lineTo(18, -12); c.stroke(); }
        if (v === 1) { c.fillStyle = base; c.beginPath(); c.arc(34, -4, 8, 0, 7); c.fill(); c.strokeStyle = outline; c.stroke(); }
      }));
    }
    for (let v = 0; v < 3; v++) {
      spr.scrap.push(mk(90, 70, 45, 58, (c) => {
        shadow(c, 28, 9);
        const cols = ['#9aa5b4', '#b8744a', '#7e8a9c', '#c9954a'];
        c.lineWidth = 1.6; c.strokeStyle = outline;
        for (let i = 0; i < 5; i++) {
          c.save(); c.translate(-18 + i * 9 + v * 2, -4 - (i % 2) * 8); c.rotate(-0.5 + i * 0.28);
          c.fillStyle = cols[(i + v) % 4]; HC.rr(c, -14, -7, 28, 14, 4); c.fill(); c.stroke(); c.restore();
        }
        c.save(); c.translate(6 + v * 3, -26); c.fillStyle = '#6f7b8c';
        for (let i = 0; i < 8; i++) { c.rotate(Math.PI / 4); HC.rr(c, -3, -13, 6, 6, 1); c.fill(); }
        c.beginPath(); c.arc(0, 0, 9, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#4e5868'; c.beginPath(); c.arc(0, 0, 3.5, 0, 7); c.fill(); c.restore();
        c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(-22, -14, 3, 0, 7); c.fill();
      }));
    }
    for (let v = 0; v < 3; v++) {
      const s = [1, 0.9, 1.1][v];
      spr.bush.push(mk(70, 56, 35, 46, (c) => {
        c.scale(s, s);
        shadow(c, 22, 7);
        blob(c, -11, -12, 13, pal.bush); blob(c, 11, -12, 13, pal.bush); blob(c, 0, -20, 15, pal.bush);
        blob(c, 0, -24, 9, 'rgba(255,255,255,0.2)');
        c.strokeStyle = outline; c.lineWidth = 1.3;
        [[-12, -14], [8, -22], [14, -10], [-2, -12], [-8, -26], [4, -30]].forEach((p) => {
          blob(c, p[0], p[1], 3.6, pal.berry); blob(c, p[0] - 1, p[1] - 1, 1.2, 'rgba(255,255,255,0.8)');
        });
      }));
    }
    spr.stump = mk(60, 40, 30, 28, (c) => {
      shadow(c, 16, 6);
      if (tz === 'round' || tz === 'pine' || tz === 'snowpine') {
        c.fillStyle = pal.trunk; HC.rr(c, -9, -12, 18, 14, 5); c.fill();
        c.fillStyle = '#e8c08a'; c.beginPath(); c.ellipse(0, -12, 9, 4.5, 0, 0, 7); c.fill();
        c.strokeStyle = '#b98a5a'; c.lineWidth = 1; c.beginPath(); c.ellipse(0, -12, 4, 2, 0, 0, 7); c.stroke();
      } else { c.fillStyle = pal.trunk; HC.rr(c, -6, -8, 12, 10, 4); c.fill(); }
    });
    spr.rubble = mk(60, 30, 30, 20, (c) => {
      shadow(c, 18, 5);
      [[-8, -4, 6], [6, -3, 5], [0, -8, 4.5], [13, -2, 3]].forEach((p) => { blob(c, p[0], p[1], p[2], pal.rock2); blob(c, p[0] - 1, p[1] - 1.5, p[2] * 0.6, pal.rock); });
    });
    spr.dust = mk(60, 30, 30, 20, (c) => {
      shadow(c, 16, 5);
      c.fillStyle = '#7e8a9c'; HC.rr(c, -12, -6, 14, 6, 2); c.fill(); c.fillStyle = '#b8744a'; HC.rr(c, 2, -8, 10, 5, 2); c.fill();
    });
    spr.bare = mk(60, 40, 30, 30, (c) => {
      shadow(c, 18, 6);
      c.strokeStyle = '#8a6a44'; c.lineWidth = 2.5;
      [[-14, -14], [-5, -20], [6, -18], [14, -12], [0, -12]].forEach((p) => { c.beginPath(); c.moveTo(0, -2); c.lineTo(p[0], p[1]); c.stroke(); });
      blob(c, 0, -6, 9, pal.bush);
    });
    W.sprites = spr;
  }

  // ---------- terrain chunks ----------
  function buildChunk(ci, cj) {
    const SC = W.scale, cv = document.createElement('canvas');
    cv.width = cv.height = Math.ceil(CH * SC);
    const c = cv.getContext('2d');
    c.scale(SC, SC);
    c.lineJoin = 'round'; c.lineCap = 'round';
    const Z = W.Z, pal = Z.pal, ox = ci * CH, oy = cj * CH;
    const rnd = HC.rng(W.seed * 131 + ci * 977 + cj * 7919 + 13);
    c.translate(-ox, -oy);
    c.fillStyle = pal.g1; c.fillRect(ox, oy, CH, CH);
    // checker tiles
    const T = 64;
    c.fillStyle = pal.g2;
    for (let j = Math.floor(oy / T); j * T < oy + CH; j++) for (let i = Math.floor(ox / T); i * T < ox + CH; i++) if ((i + j) & 1) c.fillRect(i * T, j * T, T, T);
    // soft patches
    c.globalAlpha = 0.35; c.fillStyle = pal.patch;
    for (let i = 0; i < 7; i++) { c.beginPath(); c.ellipse(ox + rnd() * CH, oy + rnd() * CH, 50 + rnd() * 90, 30 + rnd() * 60, rnd() * 3, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    // camp pad under caravan
    const cx = W.cx, cy = W.cy;
    if (cx + 300 > ox && cx - 300 < ox + CH && cy + 320 > oy && cy - 320 < oy + CH) {
      c.fillStyle = pal.camp;
      c.globalAlpha = 0.35; c.beginPath(); c.ellipse(cx, cy + 10, 235, 255, 0, 0, 7); c.fill();
      c.globalAlpha = 0.5; c.beginPath(); c.ellipse(cx, cy + 10, 190, 210, 0, 0, 7); c.fill();
      c.globalAlpha = 1;
      c.strokeStyle = 'rgba(80,60,40,0.18)'; c.lineWidth = 5; c.setLineDash([14, 12]);
      for (const dx of [-28, 28]) { c.beginPath(); c.moveTo(cx + dx, cy - 330); c.lineTo(cx + dx, cy + 330); c.stroke(); }
      c.setLineDash([]);
    }
    const D = Z.decor, P = (n, f) => { for (let i = 0; i < n; i++) f(ox + rnd() * CH, oy + rnd() * CH, rnd); };
    const tuft = (x, y, col) => { c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x - 5, y - 6); c.moveTo(x, y); c.lineTo(x, y - 8); c.moveTo(x + 4, y); c.lineTo(x + 5, y - 6); c.stroke(); };
    if (D === 'flowers' || D === 'mush') P(46, (x, y) => tuft(x, y, pal.tuft));
    if (D === 'flowers') {
      const cols = ['#ffd24a', '#ff7aa8', '#ffffff', '#b58cff'];
      P(26, (x, y, r) => {
        const col = cols[Math.floor(r() * 4)];
        c.fillStyle = col;
        for (let k = 0; k < 5; k++) { const a = k * 1.2566; c.beginPath(); c.arc(x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2, 2.4, 0, 7); c.fill(); }
        c.fillStyle = '#ffb53a'; c.beginPath(); c.arc(x, y, 2, 0, 7); c.fill();
      });
    }
    if (D === 'mush') {
      P(14, (x, y, r) => {
        c.fillStyle = '#f4ead8'; HC.rr(c, x - 2, y - 5, 4, 7, 1.5); c.fill();
        c.fillStyle = r() < 0.5 ? '#ef5b5b' : '#e0a050'; c.beginPath(); c.ellipse(x, y - 6, 6, 4.5, 0, Math.PI, 0); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(x - 2, y - 8, 1.1, 0, 7); c.arc(x + 2, y - 7, 1, 0, 7); c.fill();
      });
      c.fillStyle = 'rgba(0,0,0,0.07)'; P(8, (x, y) => { c.beginPath(); c.ellipse(x, y, 14, 7, 0, 0, 7); c.fill(); });
    }
    if (D === 'cracks') {
      c.strokeStyle = 'rgba(120,70,30,0.3)'; c.lineWidth = 2;
      P(16, (x, y, r) => { c.beginPath(); c.moveTo(x, y); let px = x, py = y; for (let k = 0; k < 4; k++) { px += (r() - 0.5) * 30; py += (r() - 0.2) * 22; c.lineTo(px, py); } c.stroke(); });
      P(22, (x, y) => tuft(x, y, pal.tuft));
      P(16, (x, y, r) => { c.fillStyle = pal.rock2; c.beginPath(); c.ellipse(x, y, 4 + r() * 3, 3, 0, 0, 7); c.fill(); });
    }
    if (D === 'junk') {
      c.fillStyle = 'rgba(30,30,40,0.14)'; P(7, (x, y) => { c.beginPath(); c.ellipse(x, y, 20, 9, 0, 0, 7); c.fill(); });
      P(30, (x, y, r) => { c.fillStyle = r() < 0.5 ? '#7e8a9c' : '#b8744a'; c.save(); c.translate(x, y); c.rotate(r() * 3); HC.rr(c, -5, -2.5, 10, 5, 1.5); c.fill(); c.restore(); });
      P(14, (x, y) => { c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(x, y, 2, 0, 7); c.fill(); });
    }
    if (D === 'snow') {
      c.fillStyle = 'rgba(160,200,230,0.35)'; P(8, (x, y, r) => { c.beginPath(); c.ellipse(x, y, 24 + r() * 20, 10 + r() * 8, 0, 0, 7); c.fill(); });
      c.strokeStyle = pal.tuft; c.lineWidth = 2; P(28, (x, y) => { c.beginPath(); c.arc(x, y, 6, Math.PI, 0); c.stroke(); });
      c.fillStyle = '#fff'; P(30, (x, y) => { c.beginPath(); c.arc(x, y, 1.6, 0, 7); c.fill(); });
    }
    if (D === 'lava') {
      P(14, (x, y, r) => {
        c.strokeStyle = '#ff7a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); let px = x, py = y;
        for (let k = 0; k < 4; k++) { px += (r() - 0.5) * 34; py += (r() - 0.3) * 24; c.lineTo(px, py); } c.stroke();
        c.strokeStyle = '#ffd24a'; c.lineWidth = 1; c.stroke();
      });
      c.fillStyle = 'rgba(0,0,0,0.18)'; P(10, (x, y, r) => { c.beginPath(); c.ellipse(x, y, 16 + r() * 14, 8, 0, 0, 7); c.fill(); });
      c.fillStyle = '#ff9a3a'; P(24, (x, y) => { c.beginPath(); c.arc(x, y, 1.6, 0, 7); c.fill(); });
    }
    // hedge border
    const WL = HC.WORLD, B = 34;
    if (ox < B || oy < B || ox + CH > WL - B || oy + CH > WL - B) {
      c.fillStyle = pal.edge;
      for (let t = 0; t < WL; t += 26) {
        const pts = [[t, 6], [t, WL - 6], [6, t], [WL - 6, t]];
        for (const p of pts) if (p[0] > ox - 30 && p[0] < ox + CH + 30 && p[1] > oy - 30 && p[1] < oy + CH + 30) {
          c.beginPath(); c.arc(p[0], p[1], 22 + ((t * 7) % 9), 0, 7); c.fill();
        }
      }
      c.fillStyle = pal.leaf2; c.globalAlpha = 0.5;
      for (let t = 13; t < WL; t += 26) {
        const pts = [[t, 22], [t, WL - 22], [22, t], [WL - 22, t]];
        for (const p of pts) if (p[0] > ox - 30 && p[0] < ox + CH + 30 && p[1] > oy - 30 && p[1] < oy + CH + 30) { c.beginPath(); c.arc(p[0], p[1], 14, 0, 7); c.fill(); }
      }
      c.globalAlpha = 1;
    }
    return cv;
  }

  HC.getChunk = function (ci, cj) {
    const key = cj * 64 + ci;
    let e = W.chunks.get(key);
    if (!e) {
      e = { cv: buildChunk(ci, cj), used: 0 };
      W.chunks.set(key, e);
      if (W.chunks.size > 20) {
        let ok = null, ou = 1e18;
        W.chunks.forEach((v, k) => { if (v.used < ou && v.used !== W.frame) { ou = v.used; ok = k; } });
        if (ok !== null) W.chunks.delete(ok);
      }
    }
    e.used = W.frame;
    return e.cv;
  };
  HC.CHUNK = CH;
  HC.CELL = CELL;
  HC.GN = GN;
})();
