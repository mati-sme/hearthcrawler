(function () {
  'use strict';
  const HC = window.HC;
  const JOY_R = 52, JOY_DEAD = 6;
  const keys = {};
  let stick = null, override = null;
  const out = { x: 0, y: 0 };

  HC.input = {
    // normalised movement vector (analog, magnitude <= 1); reused object, no per-frame allocation
    vec() {
      let x = 0, y = 0;
      if (stick && stick.active) {
        const dx = stick.x - stick.x0, dy = stick.y - stick.y0, d = Math.hypot(dx, dy);
        if (d > JOY_DEAD) { const m = Math.min(1, d / JOY_R); x += dx / d * m; y += dy / d * m; }
      }
      if (keys.left) x -= 1; if (keys.right) x += 1; if (keys.up) y -= 1; if (keys.down) y += 1;
      if (override) { x += override.x; y += override.y; }
      const m = Math.hypot(x, y);
      if (m > 1) { x /= m; y /= m; }
      out.x = x; out.y = y;
      return out;
    },
    set(x, y) { override = x === null || x === undefined ? null : { x, y }; },
    active() { return !!(stick && stick.active); },
  };

  const KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' };

  HC.initInput = function () {
    const pad = document.getElementById('joyPad'), joy = document.getElementById('joy'), app = document.getElementById('app');
    const knob = joy.querySelector('.knob');
    function show() {
      const r = app.getBoundingClientRect();
      joy.classList.remove('hidden');
      joy.style.left = (stick.x0 - r.left) + 'px'; joy.style.top = (stick.y0 - r.top) + 'px';
      let dx = stick.x - stick.x0, dy = stick.y - stick.y0; const d = Math.hypot(dx, dy);
      if (d > JOY_R) { dx *= JOY_R / d; dy *= JOY_R / d; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
    }
    function end(e) {
      if (!stick || (e && e.pointerId !== stick.id)) return;
      stick = null; joy.classList.add('hidden');
    }
    pad.addEventListener('pointerdown', (e) => {
      if (stick) return;
      e.preventDefault();
      HC.audio.init();
      stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, active: false };
      try { pad.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    });
    pad.addEventListener('pointermove', (e) => {
      if (!stick || e.pointerId !== stick.id) return;
      e.preventDefault();
      stick.x = e.clientX; stick.y = e.clientY;
      if (!stick.active && Math.hypot(stick.x - stick.x0, stick.y - stick.y0) > JOY_DEAD) stick.active = true;
      if (stick.active) show();
    });
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
    pad.addEventListener('lostpointercapture', end);
    window.addEventListener('blur', () => { stick = null; joy.classList.add('hidden'); for (const k in keys) keys[k] = false; });

    window.addEventListener('keydown', (e) => {
      HC.audio.init();
      const k = KEYMAP[e.key];
      if (k) { keys[k] = true; e.preventDefault(); return; }
      if (HC.ui && HC.ui.paused()) return;
      if (e.key === ' ' || e.key === 'e' || e.key === 'E') { e.preventDefault(); HC.ui.doAction(); }
      else if (e.key === 'c' || e.key === 'C') HC.ui.open('craft');
      else if (e.key === 'b' || e.key === 'B') HC.ui.open('caravan');
      else if (e.key === 'm' || e.key === 'M') HC.ui.open('map');
      else if (e.key === 'i' || e.key === 'I') HC.ui.open('gear');
    });
    window.addEventListener('keyup', (e) => { const k = KEYMAP[e.key]; if (k) keys[k] = false; });
    // block browser gestures / zoom / context menu
    ['gesturestart', 'gesturechange', 'gestureend', 'contextmenu', 'dblclick'].forEach((n) => document.addEventListener(n, (e) => e.preventDefault()));
    document.addEventListener('touchmove', (e) => { if (!e.target.closest || !e.target.closest('.pb')) e.preventDefault(); }, { passive: false });
    document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  };
})();
