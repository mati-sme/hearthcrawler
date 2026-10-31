(function () {
  'use strict';
  const HC = window.HC, W = HC.W, R = HC.R, P = R.P;
  const view = (HC.view = { z: 1, cw: 390, ch: 844, dpr: 1 });
  const TAU = Math.PI * 2;
  const rr = HC.rr;
  let cv, ctx, dk, dctx, lightSpr, ds = 0.5;

  HC.initRender = function () {
    cv = document.getElementById('game');
    ctx = cv.getContext('2d', { alpha: false });
    dk = document.createElement('canvas'); dctx = dk.getContext('2d');
    lightSpr = document.createElement('canvas'); lightSpr.width = lightSpr.height = 128;
    const lc = lightSpr.getContext('2d'), g = lc.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    lc.fillStyle = g; lc.fillRect(0, 0, 128, 128);
    HC.resize();
    window.addEventListener('resize', HC.resize);
    window.addEventListener('orientationchange', () => setTimeout(HC.resize, 120));
  };
  HC.resize = function () {
    const app = document.getElementById('app'); if (!app || !cv) return;
    const r = app.getBoundingClientRect();
    view.cw = Math.max(200, r.width); view.ch = Math.max(300, r.height);
    view.dpr = Math.min(2, window.devicePixelRatio || 1);
    view.z = view.cw / 390;
    cv.width = Math.round(view.cw * view.dpr); cv.height = Math.round(view.ch * view.dpr);
    dk.width = Math.round(view.cw * ds); dk.height = Math.round(view.ch * ds);
    R.view.w = view.cw / view.z; R.view.h = view.ch / view.z;
  };

  const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  function lerpHex(a, b, t) {
    const A = hex2rgb(a), B = hex2rgb(b);
    return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
  }
  const blob = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
  const shadow = (c, x, y, rx, ry) => { c.fillStyle = 'rgba(25,25,50,0.24)'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); };
  const eyes = (c, x, y, sp, r, dx, col) => { c.fillStyle = '#fff'; c.beginPath(); c.arc(x - sp, y, r, 0, TAU); c.arc(x + sp, y, r, 0, TAU); c.fill(); c.fillStyle = col || '#2a2030'; c.beginPath(); c.arc(x - sp + dx, y + 0.5, r * 0.55, 0, TAU); c.arc(x + sp + dx, y + 0.5, r * 0.55, 0, TAU); c.fill(); };

  // =====================================================================
  // player
  // =====================================================================
  function drawHeld(c, kind, x, y, ang, wid) {
    c.save(); c.translate(x, y); c.rotate(ang); c.lineCap = 'round'; c.lineJoin = 'round';
    if (kind === 'axe') {
      c.strokeStyle = '#8a5a34'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(18, 0); c.stroke();
      c.fillStyle = '#c9d2de'; c.strokeStyle = '#6a7686'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(14, -2); c.lineTo(20, -10); c.lineTo(23, 0); c.lineTo(20, 4); c.closePath(); c.fill(); c.stroke();
    } else if (kind === 'pick') {
      c.strokeStyle = '#8a5a34'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(18, 0); c.stroke();
      c.strokeStyle = '#aab3c0'; c.lineWidth = 4; c.beginPath(); c.arc(17, 0, 8, -1.3, 1.3); c.stroke();
    } else if (kind === 'melee') {
      c.strokeStyle = '#8a5a34'; c.lineWidth = 3; c.beginPath(); c.moveTo(-6, 0); c.lineTo(32, 0); c.stroke();
      c.fillStyle = '#d0d8e4'; c.strokeStyle = '#6a7686'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(30, -4); c.lineTo(42, 0); c.lineTo(30, 4); c.closePath(); c.fill(); c.stroke();
    } else if (kind === 'shot') {
      if (wid === 'bow') { c.strokeStyle = '#9a6a3a'; c.lineWidth = 3; c.beginPath(); c.arc(8, 0, 11, -1.4, 1.4); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 1; c.beginPath(); c.moveTo(8 + Math.cos(-1.4) * 11, Math.sin(-1.4) * 11); c.lineTo(8 + Math.cos(1.4) * 11, Math.sin(1.4) * 11); c.stroke(); }
      else if (wid === 'crossbow') { c.strokeStyle = '#6a4a2a'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(20, 0); c.stroke(); c.strokeStyle = '#3e4858'; c.lineWidth = 3; c.beginPath(); c.moveTo(14, -9); c.lineTo(14, 9); c.stroke(); }
      else { c.fillStyle = '#6a7686'; rr(c, 0, -4, 20, 8, 3); c.fill(); c.fillStyle = '#7be8ff'; c.beginPath(); c.arc(20, 0, 3.5, 0, TAU); c.fill(); c.fillStyle = '#ffd84a'; rr(c, 3, 2, 6, 8, 2); c.fill(); }
    } else { blob(c, 6, 0, 4, '#ffd9b0'); }
    c.restore();
  }
  const SHIRT = { none: '#4f9cf0', armor1: '#b9824a', armor2: '#9aa5b4', armor3: '#7be8c8' };
  function drawPlayer(c, now) {
    const S = HC.S, bob = P.moving ? Math.abs(Math.sin(P.step)) * 2.2 : Math.sin(now * 2.2) * 0.6;
    if (P.inv > 0 && P.roll <= 0 && Math.floor(now * 14) % 2 === 0) c.globalAlpha = 0.5;
    c.save(); c.translate(P.x, P.y);
    shadow(c, 0, 12, 12, 5);
    if (P.roll > 0) { c.rotate(P.step * 1.2); c.scale(1, 0.8); }
    // legs
    const ls = P.moving ? Math.sin(P.step) * 4 : 0;
    blob(c, -5, 10 + ls * 0.4, 4.5, '#3a3a5a'); blob(c, 5, 10 - ls * 0.4, 4.5, '#3a3a5a');
    // held tool behind/at side
    const facingAng = Math.atan2(P.fy, P.fx);
    let hx = 0, hy = -4;
    if (P.swing > 0) {
      const prog = 1 - P.swing / 0.25, a = P.swingAng + (P.swingKind === 'melee' || P.swingKind === 'shot' ? 0 : (prog - 0.5) * 2.0);
      drawHeld(c, P.swingKind, hx + Math.cos(a) * 8, hy - bob + Math.sin(a) * 6, a, S.equip.weapon);
    } else if (!P.moving || true) {
      const w = S.equip.weapon;
      if (w !== 'fist') drawHeld(c, w === 'spear' ? 'melee' : 'shot', 9 * Math.sign(P.fx || 1), 2 - bob, w === 'spear' ? -1.1 : (P.fx < 0 ? Math.PI * 0.8 : Math.PI * 0.2), w);
    }
    // body
    c.fillStyle = SHIRT[S.equip.armor || 'none']; c.strokeStyle = 'rgba(20,20,40,0.5)'; c.lineWidth = 1.8;
    rr(c, -9, -10 - bob, 18, 20, 7); c.fill(); c.stroke();
    if (S.equip.armor) { c.fillStyle = 'rgba(255,255,255,0.28)'; rr(c, -7, -8 - bob, 14, 5, 3); c.fill(); }
    c.fillStyle = '#ffd84a'; rr(c, -9, 1 - bob, 18, 3.5, 1.5); c.fill();
    // head
    blob(c, 0, -18 - bob, 10.5, '#ffd9b0'); c.strokeStyle = 'rgba(20,20,40,0.45)'; c.lineWidth = 1.6; c.beginPath(); c.arc(0, -18 - bob, 10.5, 0, TAU); c.stroke();
    const ex = HC.clamp(P.fx, -1, 1) * 2.4;
    eyes(c, ex, -17 - bob, 3.6, 2.4, ex * 0.3);
    c.fillStyle = 'rgba(255,120,140,0.5)'; c.beginPath(); c.arc(-7 + ex * 0.5, -13 - bob, 2, 0, TAU); c.arc(7 + ex * 0.5, -13 - bob, 2, 0, TAU); c.fill();
    // beanie
    c.fillStyle = '#ff6a5a'; c.beginPath(); c.arc(0, -21 - bob, 10.6, Math.PI, 0); c.closePath(); c.fill();
    c.fillStyle = '#ffd84a'; rr(c, -11, -23 - bob, 22, 4, 2); c.fill();
    blob(c, 0, -32 - bob, 3.4, '#fff');
    c.restore();
    c.globalAlpha = 1;
  }

  // =====================================================================
  // mobs
  // =====================================================================
  function drawMobBody(c, m, now, fake) {
    const t = m.anim, face = m.fx < 0 ? -1 : 1, id = m.type;
    c.save(); c.translate(m.x, m.y);
    let s = 1;
    if (m.pop > 0) s = 1 - m.pop / 0.3 * 0.6;
    if (m.lunge > 0) c.translate(m.fx * 5, m.fy * 3);
    c.scale(s * (m.big || 1), s * (m.big || 1));
    const r = m.r;
    if (id === 'bunny') {
      const hop = Math.abs(Math.sin(t * 7)) * (m.state === 'flee' ? 7 : m.state === 'wander' ? 3 : 0);
      shadow(c, 0, 8, 8, 3.5);
      c.translate(0, -hop);
      c.fillStyle = '#f6efff'; c.strokeStyle = 'rgba(60,40,80,.35)'; c.lineWidth = 1.4;
      c.beginPath(); c.ellipse(0, 0, 9, 7.5, 0, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(face * 5, -5, 5.5, 5.5, 0, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(face * 3, -15, 2.4, 7, -0.15 * face, 0, TAU); c.ellipse(face * 8, -14, 2.4, 6.5, 0.2 * face, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#ffb0c4'; c.beginPath(); c.ellipse(face * 3, -15, 1.2, 4.5, -0.15 * face, 0, TAU); c.fill();
      blob(c, -face * 9, 0, 3, '#fff'); blob(c, face * 7.5, -6, 1.3, '#2a2030'); blob(c, face * 10.5, -4, 1, '#ff8aa8');
    } else if (id === 'snortle') {
      const wob = m.state === 'flee' || m.angry > 0 ? Math.sin(t * 16) * 1.2 : Math.sin(t * 6) * 0.5;
      shadow(c, 0, 11, 14, 5);
      c.fillStyle = '#6a4a4a'; rr(c, -9, 6 + wob, 5, 7, 2); c.fill(); rr(c, 4, 6 - wob, 5, 7, 2); c.fill();
      c.fillStyle = m.angry > 0 ? '#f28a8a' : '#e89aa8'; c.strokeStyle = 'rgba(80,30,50,.4)'; c.lineWidth = 1.6;
      c.beginPath(); c.ellipse(0, 0, 14, 11, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#b86a7a'; c.beginPath(); c.moveTo(-8, -9); c.lineTo(-4, -16); c.lineTo(0, -10); c.lineTo(4, -16); c.lineTo(8, -9); c.closePath(); c.fill();
      c.fillStyle = '#f2b0b8'; c.beginPath(); c.ellipse(face * 11, 1, 6, 5.5, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#7a3a4a'; blob(c, face * 12, 0, 1.1, '#7a3a4a'); blob(c, face * 12, 3, 1.1, '#7a3a4a');
      c.strokeStyle = '#fff'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(face * 9, 6); c.lineTo(face * 11, 9); c.stroke();
      eyes(c, face * 5, -3, 2.6, 2, face * 0.5);
      if (m.angry > 0) { c.strokeStyle = '#a02a3a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(face * 2, -7); c.lineTo(face * 8, -5); c.stroke(); }
    } else if (id === 'slime') {
      const sq = Math.sin(t * 5) * 0.12;
      shadow(c, 0, 9, 12, 4);
      c.scale(1 + sq, 1 - sq);
      c.fillStyle = '#7fe08a'; c.strokeStyle = 'rgba(30,90,50,.5)'; c.lineWidth = 1.8;
      c.beginPath(); c.moveTo(-12, 9); c.bezierCurveTo(-14, -12, 14, -12, 12, 9); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(-4, -3, 4, 2.4, -0.5, 0, TAU); c.fill();
      eyes(c, face * 2, 0, 3.6, 2.6, face * 0.8);
      c.strokeStyle = '#2a6a3a'; c.lineWidth = 1.5; c.beginPath(); c.arc(face * 2, 6, 2.6, 0.2, Math.PI - 0.2); c.stroke();
    } else if (id === 'howler') {
      const lg = Math.sin(t * 14) * 3.5;
      shadow(c, 0, 10, 15, 5);
      c.fillStyle = '#5a6288'; rr(c, -11, 4 + lg, 4, 8, 2); c.fill(); rr(c, 7, 4 - lg, 4, 8, 2); c.fill();
      c.fillStyle = '#8a93b8'; c.strokeStyle = 'rgba(30,30,60,.45)'; c.lineWidth = 1.6;
      c.beginPath(); c.ellipse(0, 0, 14, 9, 0, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-face * 13, -2); c.quadraticCurveTo(-face * 24, -8 + Math.sin(t * 8) * 3, -face * 20, 3); c.lineTo(-face * 12, 3); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.arc(face * 11, -3, 8, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(face * 7, -9); c.lineTo(face * 8, -17); c.lineTo(face * 12, -10); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#c6cbe0'; c.beginPath(); c.ellipse(face * 17, -1, 5, 3.4, 0, 0, TAU); c.fill();
      blob(c, face * 21, -1.5, 1.6, '#2a2030');
      blob(c, face * 11, -5, 2, R.night ? '#ff5a5a' : '#fff'); blob(c, face * 11.5, -5, 1, '#2a2030');
    } else if (id === 'raider' || id === 'sling') {
      const lg = Math.sin(t * 10) * 3;
      shadow(c, 0, 11, 11, 4.5);
      c.fillStyle = '#3a3a4a'; blob(c, -4, 10 + lg * 0.4, 4, '#3a3a4a'); blob(c, 4, 10 - lg * 0.4, 4, '#3a3a4a');
      c.fillStyle = id === 'sling' ? '#e0873a' : '#c8523f'; c.strokeStyle = 'rgba(40,20,20,.5)'; c.lineWidth = 1.6;
      rr(c, -8, -8, 16, 18, 6); c.fill(); c.stroke();
      c.fillStyle = '#4a3a30'; rr(c, -8, 2, 16, 3, 1); c.fill();
      blob(c, 0, -15, 9.5, '#ffd9b0'); c.strokeStyle = 'rgba(40,20,20,.45)'; c.beginPath(); c.arc(0, -15, 9.5, 0, TAU); c.stroke();
      c.fillStyle = '#2a2030'; rr(c, -10, -19, 20, 7, 3); c.fill(); // mask band
      c.fillStyle = '#fff'; c.beginPath(); c.arc(-4, -16, 2.1, 0, TAU); c.arc(4, -16, 2.1, 0, TAU); c.fill();
      c.fillStyle = '#2a2030'; c.beginPath(); c.arc(-4 + face * 0.8, -16, 1, 0, TAU); c.arc(4 + face * 0.8, -16, 1, 0, TAU); c.fill();
      c.fillStyle = id === 'sling' ? '#ffd24a' : '#ef5b5b'; c.beginPath(); c.arc(0, -22, 9.5, Math.PI, 0); c.fill();
      c.beginPath(); c.moveTo(-9, -22); c.lineTo(-17, -18 + Math.sin(t * 8) * 2); c.lineTo(-9, -17); c.closePath(); c.fill();
      c.strokeStyle = '#8a5a34'; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(face * 8, -2); c.lineTo(face * (m.lunge > 0 ? 24 : 16), m.lunge > 0 ? -2 : -9); c.stroke();
      if (id === 'sling') { c.strokeStyle = '#6a4a2a'; c.beginPath(); c.arc(face * 17, -11, 4, 0, TAU); c.stroke(); }
    } else if (id === 'scrapbot') {
      const rock = Math.sin(t * 8) * 0.06;
      shadow(c, 0, 12, 14, 5);
      c.rotate(rock);
      c.fillStyle = '#4e5868'; rr(c, -14, 6, 28, 8, 4); c.fill();
      c.fillStyle = '#8fa0b4'; c.strokeStyle = '#4e5868'; c.lineWidth = 1.8; rr(c, -11, -12, 22, 20, 5); c.fill(); c.stroke();
      c.fillStyle = '#b8744a'; rr(c, -11, 0, 22, 5, 2); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(0, -4, 5.2, 0, TAU); c.fill(); c.fillStyle = '#ff5a5a'; c.beginPath(); c.arc(face * 1.2, -4, 2.6, 0, TAU); c.fill();
      c.strokeStyle = '#4e5868'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -12); c.lineTo(0, -19); c.stroke(); blob(c, 0, -20, 2.6, Math.sin(t * 6) > 0 ? '#ffd24a' : '#ff5a5a');
      c.strokeStyle = '#8fa0b4'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(-11, -2); c.lineTo(-17, 4); c.moveTo(11, -2); c.lineTo(17, m.lunge > 0 ? -6 : 4); c.stroke();
    } else if (id === 'yeti') {
      const bob = Math.sin(t * 5) * 1.2;
      shadow(c, 0, 14, 17, 6);
      c.fillStyle = '#e8f4ff'; c.strokeStyle = 'rgba(60,90,130,.45)'; c.lineWidth = 1.8;
      c.beginPath(); c.ellipse(0, 0 + bob, 16, 15, 0, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.arc(-14, 2 + bob, 6, 0, TAU); c.arc(14, 2 + bob, 6, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#b4d8f2'; c.beginPath(); c.ellipse(0, -2 + bob, 9, 8, 0, 0, TAU); c.fill();
      eyes(c, 0, -5 + bob, 4, 2.6, face * 0.8, '#1a2a5a');
      c.fillStyle = '#7a4a4a'; c.beginPath(); c.arc(0, 2 + bob, 3, 0, Math.PI); c.fill();
      c.fillStyle = '#fff'; c.fillRect(-2, 2 + bob, 1.5, 2); c.fillRect(1, 2 + bob, 1.5, 2);
    } else if (id === 'imp') {
      const fl = Math.sin(t * 12);
      shadow(c, 0, 12, 10, 4);
      c.fillStyle = 'rgba(255,170,60,0.9)'; c.beginPath(); c.moveTo(-6, 6); c.quadraticCurveTo(-18, 2 + fl * 3, -14, -8 + fl * 2); c.quadraticCurveTo(-8, -2, -4, 2); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(6, 6); c.quadraticCurveTo(18, 2 - fl * 3, 14, -8 - fl * 2); c.quadraticCurveTo(8, -2, 4, 2); c.closePath(); c.fill();
      c.fillStyle = '#ff7a3a'; c.strokeStyle = '#a03a1a'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(0, 0, 9, 10, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#ffd24a'; c.beginPath(); c.moveTo(-6, -8); c.lineTo(-9, -17); c.lineTo(-2, -10); c.moveTo(6, -8); c.lineTo(9, -17); c.lineTo(2, -10); c.fill();
      eyes(c, 0, -3, 3.4, 2.4, face * 0.6, '#a02a1a');
      c.fillStyle = '#ffd24a'; c.beginPath(); c.moveTo(0, 10); c.quadraticCurveTo(4 + fl * 2, 16, 0, 20 + fl * 2); c.quadraticCurveTo(-4, 16, 0, 10); c.fill();
    } else if (id === 'boar') {
      const wob = Math.sin(t * 9) * 1.5;
      shadow(c, 0, 26, 38, 11);
      c.fillStyle = '#5a3a30'; rr(c, -22, 14 + wob, 11, 15, 4); c.fill(); rr(c, 11, 14 - wob, 11, 15, 4); c.fill();
      c.fillStyle = '#b8785a'; c.strokeStyle = 'rgba(60,30,20,.55)'; c.lineWidth = 2.6;
      c.beginPath(); c.ellipse(0, 0, 36, 28, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#7a4a3a'; c.beginPath(); for (let i = 0; i < 7; i++) { c.lineTo(-26 + i * 8.7, -22 - (i % 2) * 8); c.lineTo(-22 + i * 8.7, -26); } c.closePath(); c.fill();
      c.fillStyle = '#d99a7a'; c.beginPath(); c.ellipse(face * 26, 4, 14, 12, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#6a3a3a'; blob(c, face * 30, 1, 2.4, '#6a3a3a'); blob(c, face * 30, 8, 2.4, '#6a3a3a');
      c.strokeStyle = '#fff6e0'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(face * 20, 12); c.quadraticCurveTo(face * 26, 22, face * 34, 14); c.stroke();
      eyes(c, face * 12, -8, 5.2, 3.6, face * 1, '#a02020');
      c.strokeStyle = '#4a2020'; c.lineWidth = 3; c.beginPath(); c.moveTo(face * 6, -15); c.lineTo(face * 17, -12); c.stroke();
      // crown
      c.fillStyle = '#ffd24a'; c.strokeStyle = '#a07a10'; c.lineWidth = 2; c.beginPath(); c.moveTo(-12, -24); c.lineTo(-14, -38); c.lineTo(-6, -31); c.lineTo(0, -41); c.lineTo(6, -31); c.lineTo(14, -38); c.lineTo(12, -24); c.closePath(); c.fill(); c.stroke();
      blob(c, 0, -30, 2.6, '#ff5a78');
    } else if (id === 'warlord') {
      const rl = (HC.R.time * 4) % 6.28;
      shadow(c, 0, 30, 56, 14);
      c.fillStyle = '#3a2e28'; rr(c, -58, -24, 18, 54, 8); c.fill(); rr(c, 40, -24, 18, 54, 8); c.fill();
      c.strokeStyle = '#8a7a66'; c.lineWidth = 3; for (let i = 0; i < 4; i++) { const y = -18 + ((i * 14 + rl * 9) % 54); c.beginPath(); c.moveTo(-58, y); c.lineTo(-40, y); c.moveTo(40, y); c.lineTo(58, y); c.stroke(); }
      c.fillStyle = '#c8c8d8'; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-58, -18 + i * 16); c.lineTo(-68, -12 + i * 16); c.lineTo(-58, -8 + i * 16); c.moveTo(58, -18 + i * 16); c.lineTo(68, -12 + i * 16); c.lineTo(58, -8 + i * 16); c.fill(); }
      c.fillStyle = '#8f2b2b'; c.strokeStyle = '#4a1a1a'; c.lineWidth = 3; rr(c, -42, -30, 84, 62, 12); c.fill(); c.stroke();
      c.fillStyle = '#b83a3a'; rr(c, -38, -26, 76, 20, 8); c.fill();
      c.fillStyle = '#3a2a2a'; for (let i = 0; i < 5; i++) { rr(c, -34 + i * 15, -4, 10, 26, 3); c.fill(); }
      c.fillStyle = '#ffd24a'; blob(c, -30, -16, 3, '#ffd24a'); blob(c, 30, -16, 3, '#ffd24a');
      // cannon
      c.fillStyle = '#4e5868'; rr(c, -8, -48, 16, 26, 5); c.fill();
      // warlord driver
      blob(c, 0, -6, 15, '#ffd9b0'); c.strokeStyle = 'rgba(40,20,20,.5)'; c.lineWidth = 2; c.beginPath(); c.arc(0, -6, 15, 0, TAU); c.stroke();
      c.fillStyle = '#2a2030'; rr(c, -16, -12, 32, 10, 4); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(-6, -8, 3.4, 0, TAU); c.arc(6, -8, 3.4, 0, TAU); c.fill();
      c.fillStyle = '#a02020'; c.beginPath(); c.arc(-6 + face, -8, 1.6, 0, TAU); c.arc(6 + face, -8, 1.6, 0, TAU); c.fill();
      c.fillStyle = '#ef5b5b'; c.beginPath(); c.moveTo(-18, -14); c.quadraticCurveTo(0, -42, 18, -14); c.closePath(); c.fill();
      c.fillStyle = '#ffd24a'; rr(c, -18, -17, 36, 5, 2); c.fill();
      c.strokeStyle = '#2a1a1a'; c.lineWidth = 2.4; c.beginPath(); c.arc(0, 3, 5, 0.3, Math.PI - 0.3); c.stroke();
    } else if (id === 'golem') {
      const b = Math.sin(t * 3) * 1.5, glow = 0.6 + 0.4 * Math.sin(t * 4);
      shadow(c, 0, 40, 50, 14);
      c.fillStyle = '#4a3238'; rr(c, -34, 16, 22, 28, 8); c.fill(); rr(c, 12, 16, 22, 28, 8); c.fill();
      c.fillStyle = '#6a4a50'; c.strokeStyle = '#2a1a20'; c.lineWidth = 3;
      rr(c, -42, -30 + b, 84, 58, 18); c.fill(); c.stroke();
      c.beginPath(); c.arc(-48, -6 + b, 15, 0, TAU); c.arc(48, -6 + b, 15, 0, TAU); c.fill(); c.stroke();
      c.strokeStyle = `rgba(255,${120 + glow * 80},40,${0.7 + glow * 0.3})`; c.lineWidth = 4; c.beginPath(); c.moveTo(-26, -20 + b); c.lineTo(-14, -4 + b); c.lineTo(-24, 10 + b); c.moveTo(24, -22 + b); c.lineTo(14, -6 + b); c.lineTo(26, 12 + b); c.moveTo(-4, 6 + b); c.lineTo(2, 20 + b); c.stroke();
      c.fillStyle = '#7a5a60'; c.strokeStyle = '#2a1a20'; c.lineWidth = 3; rr(c, -22, -48 + b, 44, 30, 12); c.fill(); c.stroke();
      c.fillStyle = `rgb(255,${150 + glow * 70},50)`; c.beginPath(); c.ellipse(-8, -34 + b, 5, 6, 0, 0, TAU); c.ellipse(8, -34 + b, 5, 6, 0, 0, TAU); c.fill();
      c.fillStyle = '#ffe08a'; c.beginPath(); c.arc(-8, -35 + b, 2, 0, TAU); c.arc(8, -35 + b, 2, 0, TAU); c.fill();
      c.fillStyle = `rgba(255,140,40,${glow})`; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-10 + i * 10, -48 + b); c.lineTo(-6 + i * 10, -60 + b - i % 2 * 5); c.lineTo(-2 + i * 10, -48 + b); c.fill(); }
    }
    if (m.hurt > 0) { c.globalAlpha = 0.55 * (m.hurt / 0.14); c.fillStyle = '#fff'; c.beginPath(); c.arc(0, -2, r + 3, 0, TAU); c.fill(); c.globalAlpha = 1; }
    c.restore();
    // hp bar
    if (!fake && m.hp < m.maxhp && !m.def.boss) {
      const w = Math.max(22, r * 2), x = m.x - w / 2, y = m.y - r - 16;
      c.fillStyle = 'rgba(0,0,0,.45)'; rr(c, x - 1, y - 1, w + 2, 6, 3); c.fill();
      const f = Math.max(0, m.hp / m.maxhp);
      c.fillStyle = f > 0.5 ? '#6ad06a' : f > 0.25 ? '#ffc23a' : '#ff6a5a'; rr(c, x, y, Math.max(3, w * f), 4, 2); c.fill();
    }
  }
  HC.drawMobBody = drawMobBody;

  // =====================================================================
  // misc world drawables
  // =====================================================================
  function drawNode(c, n) {
    const spr = W.sprites, S = n.alive ? spr[n.type][n.v] : (n.type === 'tree' ? spr.stump : n.type === 'rock' ? spr.rubble : n.type === 'scrap' ? spr.dust : spr.bare);
    if (!S) return;
    if (n.alive && (n.shake > 0 || n.pop > 0)) {
      c.save(); c.translate(n.x, n.y);
      let sc = 1, rot = 0;
      if (n.shake > 0) rot = Math.sin(n.shake * 60) * 0.07 * (n.shake / 0.25);
      if (n.pop > 0) sc = 1 + Math.sin((1 - n.pop / 0.4) * Math.PI) * 0.18 - (n.pop / 0.4) * 0.5;
      c.rotate(rot); c.scale(sc, sc);
      c.drawImage(S.cv, -S.ox, -S.oy, S.w, S.h);
      c.restore();
    } else c.drawImage(S.cv, n.x - S.ox, n.y - S.oy, S.w, S.h);
    if (n.alive && n.hp < n.maxhp) { // little hp pip bar
      const w = 26, x = n.x - w / 2, y = n.y + 8;
      c.fillStyle = 'rgba(0,0,0,.4)'; rr(c, x - 1, y - 1, w + 2, 6, 3); c.fill();
      c.fillStyle = '#ffd84a'; rr(c, x, y, Math.max(3, w * n.hp / n.maxhp), 4, 2); c.fill();
    }
  }
  function drawChest(c, ch, now) {
    const bounce = ch.gold ? Math.abs(Math.sin(now * 3 + ch.x)) * 4 : 0;
    c.save(); c.translate(ch.x, ch.y);
    if (ch.gold) { c.fillStyle = `rgba(255,230,120,${0.25 + 0.15 * Math.sin(now * 4)})`; c.beginPath(); c.arc(0, -8, 30, 0, TAU); c.fill(); }
    shadow(c, 0, 8, 17, 6);
    c.translate(0, -bounce);
    const body = ch.gold ? '#e8b030' : '#a8703a', dk = ch.gold ? '#8a6410' : '#5a3a1c', trim = ch.gold ? '#fff0a0' : '#e8c070';
    c.lineJoin = 'round'; c.fillStyle = body; c.strokeStyle = dk; c.lineWidth = 2;
    rr(c, -15, -10, 30, 18, 4); c.fill(); c.stroke();
    const lift = ch.open > 0 ? (1 - ch.open / 0.4) * 14 : 0;
    c.save(); c.translate(0, -10); c.rotate(-lift * 0.04);
    c.fillStyle = ch.gold ? '#f4c848' : '#b87c42'; c.beginPath(); c.moveTo(-15, 0); c.quadraticCurveTo(0, -14 - lift, 15, 0); c.closePath(); c.fill(); c.stroke(); c.restore();
    c.fillStyle = trim; rr(c, -3, -9, 6, 11, 2); c.fill(); c.strokeStyle = dk; c.lineWidth = 1.2; c.stroke();
    c.restore();
  }
  function drawPickups(c, now) {
    for (let i = 0; i < R.picks.length; i++) {
      const p = R.picks[i]; if (!p.on) continue;
      const bob = Math.sin(now * 6 + i) * 1.5;
      if (p.type === 'xp') {
        c.fillStyle = 'rgba(160,255,160,0.35)'; c.beginPath(); c.arc(p.x, p.y + bob, 8, 0, TAU); c.fill();
        c.fillStyle = '#b8ff6a'; c.strokeStyle = '#4aa030'; c.lineWidth = 1.2; HC.starPath(c, p.x, p.y + bob, 5.5, 2.6); c.fill(); c.stroke();
      } else {
        const ic = HC.icons.canvas(p.type === 'heart' ? 'heart' : p.res);
        shadow(c, p.x, p.y + 8, 7, 2.6);
        c.drawImage(ic, p.x - 10, p.y - 12 + bob, 20, 20);
        if (p.life < 5 && Math.floor(now * 8) % 2) { c.globalAlpha = 0.5; c.drawImage(ic, p.x - 10, p.y - 12 + bob, 20, 20); c.globalAlpha = 1; }
      }
    }
  }
  function drawTeles(c, now) {
    for (let i = 0; i < R.teles.length; i++) {
      const t = R.teles[i]; if (!t.on) continue;
      const f = t.t / t.dur;
      if (t.fx === 'line') {
        const dx = t.x2 - t.x, dy = t.y2 - t.y, L = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        c.save(); c.translate(t.x, t.y); c.rotate(a);
        c.fillStyle = `rgba(255,60,60,${0.14 + 0.1 * Math.sin(now * 20)})`; c.fillRect(0, -t.r / 2, L, t.r);
        c.fillStyle = 'rgba(255,60,60,0.35)'; c.fillRect(0, -t.r / 2, L * f, t.r);
        c.strokeStyle = 'rgba(255,80,80,0.9)'; c.lineWidth = 3; c.strokeRect(0, -t.r / 2, L, t.r);
        c.restore();
      } else if (t.fx === 'ringmark') {
        c.strokeStyle = `rgba(255,160,60,${0.4 + 0.4 * f})`; c.lineWidth = 3; c.beginPath(); c.arc(t.x, t.y, t.r + f * 30, 0, TAU); c.stroke();
      } else {
        c.fillStyle = `rgba(255,50,50,${0.14 + 0.1 * Math.sin(now * 20)})`; c.beginPath(); c.arc(t.x, t.y, t.r, 0, TAU); c.fill();
        c.fillStyle = t.fx === 'fire' ? 'rgba(255,120,40,0.4)' : 'rgba(255,60,60,0.38)'; c.beginPath(); c.arc(t.x, t.y, t.r * f, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,70,70,0.95)'; c.lineWidth = 3; c.setLineDash([10, 7]); c.beginPath(); c.arc(t.x, t.y, t.r, 0, TAU); c.stroke(); c.setLineDash([]);
      }
    }
  }
  function drawLair(c, now) {
    const L = W.lair; if (!L) return;
    const q = HC.curQuest(); if (q.t !== 'boss' || q.a !== L.boss) return; // quiet until its goal is up
    c.save(); c.translate(L.x, L.y);
    c.fillStyle = 'rgba(40,20,30,0.35)'; c.beginPath(); c.ellipse(0, 0, 96, 72, 0, 0, TAU); c.fill();
    c.strokeStyle = `rgba(255,${100 + 60 * Math.sin(now * 3)},70,0.85)`; c.lineWidth = 4; c.beginPath(); c.ellipse(0, 0, 88, 66, 0, 0, TAU); c.stroke();
    c.lineWidth = 3; for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + now * 0.4; c.beginPath(); c.moveTo(Math.cos(a) * 62, Math.sin(a) * 46); c.lineTo(Math.cos(a) * 74, Math.sin(a) * 55); c.stroke(); }
    c.fillStyle = `rgba(255,120,80,${0.5 + 0.3 * Math.sin(now * 3)})`; c.font = '700 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('☠', 0, 0);
    c.restore();
  }
  function drawProjs(c, now) {
    for (let i = 0; i < R.projs.length; i++) {
      const p = R.projs[i]; if (!p.on) continue;
      if (p.kind === 'bomb') {
        const f = p.t0 / p.fl, h = Math.sin(f * Math.PI) * 34;
        shadow(c, p.x, p.y + 4, 6, 2.5);
        c.fillStyle = '#2a2a3a'; c.beginPath(); c.arc(p.x, p.y - h, 7, 0, TAU); c.fill();
        c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(p.x + 3, p.y - h - 8, 2.5 + Math.sin(now * 40), 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.arc(p.x - 2, p.y - h - 2, 2, 0, TAU); c.fill();
        continue;
      }
      const a = Math.atan2(p.vy, p.vx);
      c.save(); c.translate(p.x, p.y); c.rotate(a); c.lineCap = 'round';
      if (p.kind === 'arrow') { c.strokeStyle = '#8a5a34'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-10, 0); c.lineTo(8, 0); c.stroke(); c.fillStyle = '#dfe5ee'; c.beginPath(); c.moveTo(7, -3.5); c.lineTo(13, 0); c.lineTo(7, 3.5); c.fill(); }
      else if (p.kind === 'bolt') { c.strokeStyle = '#6a7686'; c.lineWidth = 3; c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); c.stroke(); c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(9, 0, 3, 0, TAU); c.fill(); }
      else if (p.kind === 'energy') { c.fillStyle = 'rgba(120,230,255,0.35)'; c.beginPath(); c.ellipse(0, 0, 16, 7, 0, 0, TAU); c.fill(); c.fillStyle = '#bff4ff'; c.beginPath(); c.ellipse(0, 0, 9, 3.6, 0, 0, TAU); c.fill(); }
      else if (p.kind === 'fire') { c.fillStyle = 'rgba(255,120,40,0.4)'; c.beginPath(); c.arc(0, 0, 10, 0, TAU); c.fill(); c.fillStyle = '#ff9a3a'; c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fill(); c.fillStyle = '#ffe08a'; c.beginPath(); c.arc(0, 0, 3, 0, TAU); c.fill(); }
      else { c.fillStyle = '#7a6a5a'; c.beginPath(); c.arc(0, 0, 4.5, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.arc(-1, -1, 1.6, 0, TAU); c.fill(); }
      c.restore();
    }
  }
  function drawParts(c, screen) {
    for (let i = 0; i < R.parts.length; i++) {
      const p = R.parts[i]; if (!p.on || p.screen !== screen) continue;
      const f = p.age / p.life;
      if (p.kind === 3) c.globalAlpha = 0.85 * (1 - f); else if (p.kind === 4) c.globalAlpha = 1 - f; else c.globalAlpha = f > 0.7 ? 1 - (f - 0.7) / 0.3 : 1;
      c.fillStyle = p.col;
      if (p.kind === 1) { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); HC.starPath(c, 0, 0, p.size, p.size * 0.42); c.fill(); c.restore(); }
      else if (p.kind === 2) { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); c.restore(); }
      else if (p.kind === 4) { c.strokeStyle = p.col; c.lineWidth = 4 * (1 - f) + 1; c.beginPath(); c.arc(p.x, p.y, p.size, 0, TAU); c.stroke(); }
      else { c.beginPath(); c.arc(p.x, p.y, Math.max(0.5, p.size * (p.kind === 3 ? 1 : 1 - f * 0.4)), 0, TAU); c.fill(); }
    }
    c.globalAlpha = 1;
  }
  function drawTexts(c) {
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    for (let i = 0; i < R.texts.length; i++) {
      const t = R.texts[i]; if (!t.on) continue;
      const f = t.age / t.life, pop = t.age < 0.12 ? 0.6 + t.age / 0.12 * 0.6 : 1.2 - Math.min(0.2, (t.age - 0.12) * 1.5);
      c.globalAlpha = f > 0.7 ? 1 - (f - 0.7) / 0.3 : 1;
      c.font = `900 ${Math.round(t.size * pop)}px system-ui, sans-serif`;
      c.lineWidth = 4; c.strokeStyle = 'rgba(30,20,40,0.7)'; c.strokeText(t.txt, t.x, t.y);
      c.fillStyle = t.col; c.fillText(t.txt, t.x, t.y);
    }
    c.globalAlpha = 1;
  }

  // =====================================================================
  // darkness
  // =====================================================================
  function light(x, y, rad, a) {
    const z = view.z * ds, sx = (x - R.cam.x) * z, sy = (y - R.cam.y) * z, s = rad * z;
    dctx.globalAlpha = a;
    dctx.drawImage(lightSpr, sx - s, sy - s, s * 2, s * 2);
  }
  function drawDark(c, now) {
    const n = HC.nightness(); if (n < 0.02) return;
    const dc = hex2rgb(W.Z.pal.dark);
    dctx.globalCompositeOperation = 'source-over'; dctx.globalAlpha = 1;
    dctx.clearRect(0, 0, dk.width, dk.height);
    dctx.fillStyle = `rgba(${Math.round(dc[0] * 0.6)},${Math.round(dc[1] * 0.6)},${Math.round(dc[2] * 0.7)},${0.8 * n})`;
    dctx.fillRect(0, 0, dk.width, dk.height);
    dctx.globalCompositeOperation = 'destination-out';
    light(P.x, P.y, 150 + 12 * Math.sin(now * 2), 1);
    const lants = R.lights;
    for (let i = 0; i < lants.length; i++) light(lants[i].x, lants[i].y, lants[i].r, 1);
    for (let i = 0; i < R.turrets.length; i++) light(R.turrets[i].x, R.turrets[i].y, 56, 0.7);
    light(W.cx, W.cy + 20, 90, 0.5);
    for (let i = 0; i < R.mobs.length; i++) { const m = R.mobs[i]; if (m.on && (m.type === 'imp' || m.type === 'golem' || m.kind === 'boss')) light(m.x, m.y, 70, 0.8); }
    for (let i = 0; i < R.projs.length; i++) { const p = R.projs[i]; if (p.on && (p.kind === 'energy' || p.kind === 'fire')) light(p.x, p.y, 40, 0.8); }
    for (let i = 0; i < R.chests.length; i++) light(R.chests[i].x, R.chests[i].y, R.chests[i].gold ? 80 : 40, 0.8);
    dctx.globalAlpha = 1; dctx.globalCompositeOperation = 'source-over';
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(dk, 0, 0, cv.width, cv.height);
  }

  // =====================================================================
  // guide arrows
  // =====================================================================
  function arrowTo(c, tx, ty, col, now) {
    const z = view.z, sx = (tx - R.cam.x) * z, sy = (ty - R.cam.y) * z;
    const x0 = 28, x1 = view.cw - 28, y0 = 150, y1 = view.ch - 120;
    let ax, ay, ang;
    if (sx > x0 && sx < x1 && sy > y0 + 40 && sy < y1) { ax = sx; ay = sy - (46 + Math.sin(now * 6) * 5) * z; ang = Math.PI / 2; }
    else {
      const cx = view.cw / 2, cy = (y0 + y1) / 2, dx = sx - cx, dy = sy - cy;
      const k = Math.min((x1 - cx) / Math.abs(dx || 1e-6), (y1 - cy) / Math.abs(dy || 1e-6));
      ax = cx + dx * Math.min(1, k); ay = cy + dy * Math.min(1, k); ang = Math.atan2(dy, dx);
    }
    c.save(); c.translate(ax, ay); c.rotate(ang);
    c.fillStyle = col; c.strokeStyle = 'rgba(40,20,10,0.75)'; c.lineWidth = 3; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(14, 0); c.lineTo(-6, -11); c.lineTo(-2, 0); c.lineTo(-6, 11); c.closePath(); c.stroke(); c.fill();
    c.restore();
  }
  // caravan finder: icon badge + distance at the screen edge while the caravan is off-screen
  function drawCaravanPointer(c, now) {
    const z = view.z, G = HC.G, cx = W.cx, cy = (G.y0 + G.y1) / 2;
    const sx = (cx - R.cam.x) * z, sy = (cy - R.cam.y) * z;
    const m = 34, x0 = m, x1 = view.cw - m, y0 = 175, y1 = view.ch - 130;
    if (sx > 0 && sx < view.cw && sy > 100 && sy < view.ch - 60) return;
    const mx = view.cw / 2, my = (y0 + y1) / 2, dx = sx - mx, dy = sy - my;
    const k = Math.min((x1 - mx) / Math.abs(dx || 1e-6), (y1 - my) / Math.abs(dy || 1e-6), 1);
    const ax = mx + dx * k, ay = my + dy * k, ang = Math.atan2(dy, dx);
    const dist = Math.round(Math.hypot(cx - R.P.x, cy - R.P.y) / 10), bob = Math.sin(now * 5) * 2;
    c.save(); c.translate(ax, ay);
    c.fillStyle = 'rgba(255,249,234,.95)'; c.strokeStyle = '#c9a46a'; c.lineWidth = 3;
    c.beginPath(); c.arc(0, 0, 21, 0, 7); c.fill(); c.stroke();
    c.drawImage(HC.icons.canvas('caravan'), -15, -16 + bob, 30, 30);
    c.save(); c.rotate(ang); c.translate(27, 0);
    c.fillStyle = '#ff9a2a'; c.strokeStyle = '#fff'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(9, 0); c.lineTo(-4, -9); c.lineTo(-4, 9); c.closePath(); c.stroke(); c.fill(); c.restore();
    const txt = dist + 'm'; c.font = '900 12px system-ui, sans-serif'; c.textAlign = 'center';
    const ty = ay > view.ch / 2 ? -28 : 36;
    c.lineWidth = 4; c.strokeStyle = 'rgba(40,20,10,.85)'; c.strokeText(txt, 0, ty); c.fillStyle = '#fff'; c.fillText(txt, 0, ty);
    c.restore();
  }
  function drawArrows(c, now) {
    c.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    drawCaravanPointer(c, now);
    if (!HC.S.set.arrows) return;
    const t = R.arrowTarget;
    if (t) arrowTo(c, t.x, t.y, '#ffd84a', now);
    for (let i = 0; i < R.chests.length; i++) { const ch = R.chests[i]; if (ch.gold && ch.open <= 0 && !t) { arrowTo(c, ch.x, ch.y, '#ff9ae0', now); break; } }
  }

  // =====================================================================
  // travel scene
  // =====================================================================
  const deco = [];
  { const r = HC.rng(42); for (let i = 0; i < 26; i++) deco.push({ x: r(), y: r(), side: i % 2 ? 1 : -1, k: r(), t: Math.floor(r() * 3) }); }
  function drawSceneryItem(c, pal, d, x, y, S) {
    if (d.t === 0) { c.fillStyle = 'rgba(25,25,50,.2)'; c.beginPath(); c.ellipse(x, y + 4, 22, 8, 0, 0, TAU); c.fill(); c.fillStyle = pal.trunk; c.fillRect(x - 4, y - 22, 8, 24); blob(c, x, y - 34, 20, pal.leaf2); blob(c, x, y - 38, 17, pal.leaf); }
    else if (d.t === 1) { c.fillStyle = 'rgba(25,25,50,.2)'; c.beginPath(); c.ellipse(x, y + 3, 20, 7, 0, 0, TAU); c.fill(); blob(c, x, y - 8, 16, pal.rock2); blob(c, x - 3, y - 11, 12, pal.rock); }
    else { blob(c, x, y - 6, 14, pal.bush); blob(c, x + 9, y - 3, 10, pal.bush); blob(c, x - 4, y - 14, 4, pal.berry); }
  }
  function drawTravel(c, now) {
    const T = HC.T, p = Math.min(1, T.t / T.dur), z = view.z, cw = view.cw, ch = view.ch;
    c.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const sm = p * p * (3 - 2 * p), pal = p < 0.5 ? T.from.pal : T.toPal;
    c.fillStyle = lerpHex(T.from.pal.g1, T.toPal.g1, sm); c.fillRect(0, 0, cw, ch);
    c.fillStyle = lerpHex(T.from.pal.g2, T.toPal.g2, sm);
    const scroll = T.t * 260;
    for (let i = -1; i < ch / 70 + 1; i++) { const y = ((i * 70 + scroll) % (ch + 140)) - 70; if (i % 2) c.fillRect(0, y, cw, 70); }
    // road
    const rw = 130 * z, rx = cw / 2 - rw / 2;
    c.fillStyle = lerpHex(T.from.pal.camp, T.toPal.camp, sm); c.fillRect(rx - 10, 0, rw + 20, ch);
    c.fillStyle = 'rgba(80,60,40,0.25)'; c.fillRect(rx, 0, rw, ch);
    c.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = -1; i < ch / 80 + 1; i++) { const y = ((i * 80 + scroll * 1.1) % (ch + 160)) - 80; c.fillRect(cw / 2 - 3, y, 6, 36); }
    // scenery both sides
    for (let i = 0; i < deco.length; i++) {
      const d = deco[i], y = ((d.y * (ch + 160) + scroll * 1.1) % (ch + 160)) - 60, off = (rw / 2 + 40 + d.k * 90) * d.side;
      const pl = (y / ch) < 0.5 - (p - 0.5) * 0.0 ? (p < 0.5 ? T.toPal : T.from.pal) : pal;
      c.save(); c.translate(cw / 2 + off, y); c.scale(z, z); drawSceneryItem(c, y < ch * (1 - p) ? T.toPal : T.from.pal, d, 0, 0); c.restore();
    }
    // caravan
    const bob = Math.sin(now * 16) * 1.6;
    c.save(); c.translate(cw / 2 - W.cx * z, ch * 0.58 - W.cy * z + bob); c.scale(z, z);
    HC.drawCaravan(c, now, true);
    c.restore();
    // dust
    for (let i = 0; i < 8; i++) { const ph = (now * 2 + i / 8) % 1; c.fillStyle = `rgba(255,255,255,${0.35 * (1 - ph)})`; c.beginPath(); c.arc(cw / 2 + (i % 2 ? 40 : -40) * z + Math.sin(i) * 14, ch * 0.58 + 70 * z + ph * 90, (6 + ph * 14) * z, 0, TAU); c.fill(); }
    // event visuals
    const el = T.t - T.dur * 0.45;
    if (T.evDone && el > -0.1) {
      if (T.ev === 'ambush') {
        T.bandits.forEach((b, i) => {
          const f = Math.min(1, Math.max(0, el / 0.9)), x = cw / 2 + b.side * (cw * 0.55 * (1 - f) + 70 * z), y = ch * (0.4 + i * 0.07);
          if (el < 1.2) { const m = { x: 0, y: 0, type: 'raider', r: 12, anim: now * 2 + i, fx: -b.side, fy: 0, state: 'wander', angry: 0, lunge: 0, pop: 0, hurt: 0, hp: 1, maxhp: 1, def: HC.MOBS.raider, kind: 'melee' }; c.save(); c.translate(x, y); c.scale(z * 1.3, z * 1.3); drawMobBody(c, m, now, true); c.restore(); }
          else if (el < 1.8) { const f2 = (el - 1.2) / 0.6; c.globalAlpha = 1 - f2; c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, (14 + f2 * 36) * z, 0, TAU); c.fill(); c.globalAlpha = 1; HC.starPath(c, x, y - f2 * 40, 10 * z, 4 * z); c.fillStyle = '#ffd84a'; c.fill(); }
        });
      } else if (T.ev === 'crate') {
        const y = ch * 0.3 + el * 120 * (el < 1 ? 0.3 : 0.15);
        c.save(); c.translate(cw / 2 + 95 * z, ch * 0.42); c.scale(z * 1.4, z * 1.4); drawChest(c, { x: 0, y: 0, gold: true, open: el > 0.8 ? 0.1 : 0 }, now); c.restore();
      } else if (T.ev === 'trader') {
        c.save(); c.translate(cw / 2 + 100 * z, ch * 0.44); c.scale(z * 1.2, z * 1.2);
        shadow(c, 0, 16, 22, 6); c.fillStyle = '#8a5a34'; rr(c, -20, -4, 40, 18, 5); c.fill(); blob(c, -14, 16, 6, '#3a2e28'); blob(c, 14, 16, 6, '#3a2e28');
        c.fillStyle = '#7ac8ff'; rr(c, -16, -12, 32, 10, 4); c.fill();
        blob(c, 0, -26, 9, '#ffd9b0'); c.fillStyle = '#4a9a5a'; c.beginPath(); c.moveTo(-12, -28); c.lineTo(0, -44); c.lineTo(12, -28); c.closePath(); c.fill();
        eyes(c, 0, -26, 3.2, 2, 0.6); c.restore();
      }
    }
    // header
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.font = '900 22px system-ui, sans-serif'; c.lineWidth = 5; c.strokeStyle = 'rgba(30,20,40,.75)'; c.fillStyle = '#fff';
    const title = 'Rolling to ' + T.toName; c.strokeText(title, cw / 2, 96 + 60); c.fillText(title, cw / 2, 96 + 60);
    const bw = cw * 0.6, bx = cw / 2 - bw / 2, by = 96 + 86;
    c.fillStyle = 'rgba(0,0,0,.4)'; rr(c, bx, by, bw, 12, 6); c.fill(); c.fillStyle = '#ffd84a'; rr(c, bx, by, Math.max(10, bw * p), 12, 6); c.fill();
    if (T.evMsg && T.evDone) { c.font = '800 16px system-ui, sans-serif'; c.lineWidth = 4; c.strokeStyle = 'rgba(30,20,40,.75)'; c.fillStyle = '#fff'; c.strokeText(T.evMsg, cw / 2, ch - 150); c.fillText(T.evMsg, cw / 2, ch - 150); }
    drawParts(c, true);
  }

  // =====================================================================
  // main frame
  // =====================================================================
  const DL = { y: [], t: [], o: [], n: 0, ord: [] };
  function push(y, t, o) { const i = DL.n++; DL.y[i] = y; DL.t[i] = t; DL.o[i] = o; DL.ord[i] = i; }

  HC.render = function (now) {
    if (!cv) return;
    const c = ctx; W.frame++;
    if (HC.T.on) { drawTravel(c, now); return; }
    const z = view.z, dpr = view.dpr, cam = R.cam;
    let sx = 0, sy = 0; if (R.shake > 0) { sx = (Math.random() - 0.5) * R.shake; sy = (Math.random() - 0.5) * R.shake; }
    const cx0 = cam.x + sx, cy0 = cam.y + sy;
    c.setTransform(dpr * z, 0, 0, dpr * z, -cx0 * dpr * z, -cy0 * dpr * z);
    const vw = R.view.w, vh = R.view.h;
    c.fillStyle = W.Z.pal.edge; c.fillRect(cx0 - 10, cy0 - 10, vw + 20, vh + 20);
    // terrain chunks
    const CH = HC.CHUNK, WL = HC.WORLD;
    const ci0 = Math.max(0, Math.floor(cx0 / CH)), ci1 = Math.min(Math.ceil(WL / CH) - 1, Math.floor((cx0 + vw) / CH));
    const cj0 = Math.max(0, Math.floor(cy0 / CH)), cj1 = Math.min(Math.ceil(WL / CH) - 1, Math.floor((cy0 + vh) / CH));
    for (let j = cj0; j <= cj1; j++) for (let i = ci0; i <= ci1; i++) c.drawImage(HC.getChunk(i, j), i * CH, j * CH, CH + 0.6, CH + 0.6);
    drawLair(c, now);
    drawTeles(c, now);
    drawPickups(c, now);
    // collect y-sorted drawables
    DL.n = 0;
    const GN = HC.GN, CELL = HC.CELL;
    const gx0 = Math.max(0, Math.floor((cx0 - 50) / CELL)), gx1 = Math.min(GN - 1, Math.floor((cx0 + vw + 50) / CELL));
    const gy0 = Math.max(0, Math.floor((cy0 - 30) / CELL)), gy1 = Math.min(GN - 1, Math.floor((cy0 + vh + 130) / CELL));
    for (let j = gy0; j <= gy1; j++) for (let i = gx0; i <= gx1; i++) {
      const cell = W.grid[j * GN + i];
      for (let k = 0; k < cell.length; k++) { const n = cell[k]; if (n.y > cy0 - 20 && n.y < cy0 + vh + 125 && n.x > cx0 - 60 && n.x < cx0 + vw + 60) push(n.y, 0, n); }
    }
    for (let i = 0; i < R.mobs.length; i++) { const m = R.mobs[i]; if (m.on && m.x > cx0 - 120 && m.x < cx0 + vw + 120 && m.y > cy0 - 100 && m.y < cy0 + vh + 100) push(m.y + (m.type === 'warlord' ? 20 : 0), 1, m); }
    for (let i = 0; i < R.chests.length; i++) push(R.chests[i].y, 2, R.chests[i]);
    push(P.y, 3, P);
    push(HC.G.y1 - 30, 4, null);
    // insertion sort
    const ord = DL.ord, ys = DL.y;
    for (let i = 1; i < DL.n; i++) { const v = ord[i], y = ys[v]; let j = i - 1; while (j >= 0 && ys[ord[j]] > y) { ord[j + 1] = ord[j]; j--; } ord[j + 1] = v; }
    for (let k = 0; k < DL.n; k++) {
      const i = ord[k], t = DL.t[i], o = DL.o[i];
      if (t === 0) drawNode(c, o); else if (t === 1) drawMobBody(c, o, now); else if (t === 2) drawChest(c, o, now);
      else if (t === 3) drawPlayer(c, now); else HC.drawCaravan(c, now, false);
    }
    drawProjs(c, now);
    drawParts(c, false);
    drawTexts(c);
    drawDark(c, now);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawArrows(c, now);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawParts(c, true);
  };
})();
