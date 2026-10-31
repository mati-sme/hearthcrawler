(function () {
  'use strict';
  const HC = window.HC;

  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  HC.rr = rr;

  function starPath(c, cx, cy, R, r) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R;
      c.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    c.closePath();
  }
  HC.starPath = starPath;

  const D = {
    wood(c) {
      c.lineWidth = 3; c.strokeStyle = '#6e4624';
      rr(c, 6, 30, 46, 20, 10); c.fillStyle = '#b9824a'; c.fill(); c.stroke();
      rr(c, 14, 12, 44, 20, 10); c.fillStyle = '#c9925a'; c.fill(); c.stroke();
      c.fillStyle = '#ecc590'; c.beginPath(); c.arc(52, 22, 8, 0, 7); c.fill(); c.stroke();
      c.beginPath(); c.arc(52, 22, 3.5, 0, 7); c.stroke();
      c.fillStyle = '#ecc590'; c.beginPath(); c.arc(14, 40, 8, 0, 7); c.fill(); c.stroke();
      c.beginPath(); c.arc(14, 40, 3.5, 0, 7); c.stroke();
    },
    stone(c) {
      c.lineWidth = 3; c.strokeStyle = '#5d6674';
      c.beginPath(); c.moveTo(8, 46); c.lineTo(14, 24); c.lineTo(28, 12); c.lineTo(46, 16); c.lineTo(56, 34); c.lineTo(52, 50); c.closePath();
      c.fillStyle = '#aab3c0'; c.fill(); c.stroke();
      c.fillStyle = '#d3dae4'; c.beginPath(); c.moveTo(16, 26); c.lineTo(28, 15); c.lineTo(42, 18); c.lineTo(30, 28); c.closePath(); c.fill();
    },
    scrap(c) {
      c.save(); c.translate(32, 32);
      c.fillStyle = '#8d98a8'; c.strokeStyle = '#4e5868'; c.lineWidth = 3;
      for (let i = 0; i < 8; i++) { c.rotate(Math.PI / 4); rr(c, -6, -26, 12, 12, 3); c.fill(); c.stroke(); }
      c.beginPath(); c.arc(0, 0, 19, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#4e5868'; c.beginPath(); c.arc(0, 0, 8, 0, 7); c.fill();
      c.restore();
    },
    food(c) {
      c.lineWidth = 3; c.strokeStyle = '#8a4a22';
      c.fillStyle = '#fff3dc'; c.strokeStyle = '#b79a72';
      c.beginPath(); c.arc(50, 50, 5, 0, 7); c.arc(55, 44, 5, 0, 7); c.fill(); c.stroke();
      c.lineWidth = 7; c.lineCap = 'round'; c.strokeStyle = '#fff3dc'; c.beginPath(); c.moveTo(34, 36); c.lineTo(52, 52); c.stroke();
      c.lineWidth = 3; c.strokeStyle = '#8a4a22';
      c.fillStyle = '#e0864a';
      c.beginPath(); c.ellipse(26, 26, 20, 17, -0.7, 0, 7); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.ellipse(19, 19, 7, 4, -0.7, 0, 7); c.fill();
    },
    metal(c) {
      c.lineWidth = 3; c.strokeStyle = '#506a86';
      c.beginPath(); c.moveTo(14, 20); c.lineTo(50, 20); c.lineTo(58, 44); c.lineTo(6, 44); c.closePath();
      c.fillStyle = '#b6d0e8'; c.fill(); c.stroke();
      c.fillStyle = '#e8f3fc'; c.beginPath(); c.moveTo(16, 23); c.lineTo(48, 23); c.lineTo(51, 31); c.lineTo(12, 31); c.closePath(); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(50, 12, 3, 0, 7); c.fill();
    },
    fuel(c) {
      c.lineWidth = 3; c.strokeStyle = '#8a2a1e';
      rr(c, 12, 18, 38, 38, 8); c.fillStyle = '#e5533d'; c.fill(); c.stroke();
      rr(c, 38, 8, 16, 12, 4); c.fillStyle = '#f2a23a'; c.fill(); c.stroke();
      c.fillStyle = '#ffe9a0'; c.beginPath(); c.moveTo(31, 26); c.quadraticCurveTo(44, 38, 31, 50); c.quadraticCurveTo(18, 38, 31, 26); c.fill();
      c.fillStyle = '#ff9a3a'; c.beginPath(); c.moveTo(31, 35); c.quadraticCurveTo(37, 42, 31, 48); c.quadraticCurveTo(25, 42, 31, 35); c.fill();
    },
    heart(c) {
      c.lineWidth = 3; c.strokeStyle = '#a82840'; c.fillStyle = '#ff5a78';
      c.beginPath(); c.moveTo(32, 54); c.bezierCurveTo(4, 36, 8, 8, 28, 16); c.quadraticCurveTo(32, 18, 32, 22);
      c.quadraticCurveTo(32, 18, 36, 16); c.bezierCurveTo(56, 8, 60, 36, 32, 54); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(20, 22, 6, 4, -0.6, 0, 7); c.fill();
    },
    sun(c) {
      c.translate(32, 32); c.strokeStyle = '#ffb53a'; c.lineWidth = 4; c.lineCap = 'round';
      for (let i = 0; i < 8; i++) { c.rotate(Math.PI / 4); c.beginPath(); c.moveTo(0, -22); c.lineTo(0, -29); c.stroke(); }
      c.fillStyle = '#ffd84a'; c.beginPath(); c.arc(0, 0, 16, 0, 7); c.fill(); c.strokeStyle = '#e8a020'; c.lineWidth = 3; c.stroke();
    },
    moon(c) {
      c.fillStyle = '#ffe9a0'; c.strokeStyle = '#d6b25a'; c.lineWidth = 3;
      c.beginPath(); c.arc(30, 32, 20, 0.5, Math.PI * 2 - 0.5); c.arc(40, 28, 16, Math.PI * 2 - 0.9, 0.9, true); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(50, 12, 2.5, 0, 7); c.arc(56, 24, 1.8, 0, 7); c.fill();
    },
    bag(c) {
      c.lineWidth = 3; c.strokeStyle = '#6a4224';
      rr(c, 12, 18, 40, 38, 14); c.fillStyle = '#d98a4a'; c.fill(); c.stroke();
      rr(c, 22, 6, 20, 16, 8); c.fillStyle = '#b86a32'; c.fill(); c.stroke();
      rr(c, 20, 36, 24, 14, 5); c.fillStyle = '#ecb070'; c.fill(); c.stroke();
    },
    star(c) {
      starPath(c, 32, 33, 28, 12); c.fillStyle = '#ffd84a'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#d99a20'; c.lineJoin = 'round'; c.stroke();
    },
    starOff(c) {
      starPath(c, 32, 33, 28, 12); c.fillStyle = 'rgba(0,0,0,.18)'; c.fill(); c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineJoin = 'round'; c.stroke();
    },
    lock(c) {
      c.lineWidth = 6; c.strokeStyle = '#7a7a8a'; c.beginPath(); c.arc(32, 26, 11, Math.PI, 0); c.stroke();
      rr(c, 14, 26, 36, 28, 7); c.fillStyle = '#9a9aaa'; c.fill();
    },
    caravan(c) { // little wagon with a round-top cover
      c.fillStyle = '#7a4a28'; rr(c, 6, 30, 52, 20, 5); c.fill();
      c.fillStyle = '#f4e3c0'; c.beginPath(); c.moveTo(11, 32); c.quadraticCurveTo(32, 2, 53, 32); c.closePath(); c.fill();
      c.strokeStyle = '#a8793f'; c.lineWidth = 3; c.stroke();
      c.fillStyle = '#4a3020'; [18, 46].forEach((x) => { c.beginPath(); c.arc(x, 52, 8, 0, 7); c.fill(); });
      c.fillStyle = '#c9a46a'; [18, 46].forEach((x) => { c.beginPath(); c.arc(x, 52, 3, 0, 7); c.fill(); });
    },
    check(c) {
      c.lineWidth = 9; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#3fb84f';
      c.beginPath(); c.moveTo(12, 34); c.lineTo(27, 48); c.lineTo(52, 16); c.stroke();
    },
  };

  const cache = {}, urls = {};
  HC.icons = {
    canvas(name) {
      if (cache[name]) return cache[name];
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const c = cv.getContext('2d');
      c.lineJoin = 'round';
      if (D[name]) D[name](c);
      cache[name] = cv;
      return cv;
    },
    url(name) { return urls[name] || (urls[name] = HC.icons.canvas(name).toDataURL()); },
  };
  // <img> markup for DOM
  HC.ico = (name, cls) => `<img class="ic ${cls || ''}" alt="" draggable="false" src="${HC.icons.url(name)}">`;
})();
