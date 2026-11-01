// Touch (floating joystick left, drag-look right, action buttons) + keyboard/mouse for desktop debugging.
export const inp = { moveX: 0, moveY: 0, lookDX: 0, lookDY: 0, attack: false, jump: false, sprint: false };

export function initInput(h) {
  const $ = (id) => document.getElementById(id);
  const pad = $('pad'), joy = $('joy'), knob = $('joyknob');
  const R = 54;
  const joyS = { id: null, x0: 0, y0: 0 }, lookS = { id: null, x: 0, y: 0 };
  const keys = {};
  const stat = { joyActive: false, lookActive: false };

  pad.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') { if (h.canLock() && !document.pointerLockElement) pad.requestPointerLock && pad.requestPointerLock(); if (e.button === 0) inp.attack = true; return; }
    e.preventDefault();
    try { pad.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    if (e.clientX < window.innerWidth / 2 && joyS.id === null) {
      joyS.id = e.pointerId; joyS.x0 = e.clientX; joyS.y0 = e.clientY;
      joy.style.display = 'block'; joy.style.left = e.clientX + 'px'; joy.style.top = e.clientY + 'px'; knob.style.transform = 'translate(-50%,-50%)';
      stat.joyActive = true;
    } else if (lookS.id === null) { lookS.id = e.pointerId; lookS.x = e.clientX; lookS.y = e.clientY; stat.lookActive = true; }
  });
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    if (e.pointerId === joyS.id) {
      let dx = (e.clientX - joyS.x0) / R, dy = (e.clientY - joyS.y0) / R;
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      knob.style.transform = `translate(calc(-50% + ${dx * R}px), calc(-50% + ${dy * R}px))`;
      const m = Math.hypot(dx, dy), dz = 0.12;
      const s = m < dz ? 0 : (m - dz) / (1 - dz) / m;
      inp.moveX = dx * s; inp.moveY = -dy * s;
    } else if (e.pointerId === lookS.id) {
      inp.lookDX += e.clientX - lookS.x; inp.lookDY += e.clientY - lookS.y; lookS.x = e.clientX; lookS.y = e.clientY;
    }
  });
  const up = (e) => {
    if (e.pointerType === 'mouse') { if (e.button === 0) inp.attack = false; return; }
    if (e.pointerId === joyS.id) { joyS.id = null; inp.moveX = inp.moveY = 0; joy.style.display = 'none'; stat.joyActive = false; }
    if (e.pointerId === lookS.id) { lookS.id = null; stat.lookActive = false; }
  };
  pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
  pad.addEventListener('contextmenu', (e) => e.preventDefault());

  const bind = (id, down, upf) => {
    const el = $(id);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } el.classList.add('down'); down(); });
    const end = (e) => { el.classList.remove('down'); upf && upf(); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  };
  bind('b-attack', () => { inp.attack = true; }, () => { inp.attack = false; });
  bind('b-jump', () => { inp.jump = true; });
  bind('b-interact', () => h.interact());
  bind('b-build', () => h.build());
  bind('b-menu', () => h.menu());
  bind('b-cancel', () => h.cancelBuild());
  bind('b-slotprev', () => h.slot(-1)); bind('b-slotnext', () => h.slot(1));

  // desktop
  document.addEventListener('mousemove', (e) => { if (document.pointerLockElement) { inp.lookDX += e.movementX; inp.lookDY += e.movementY; } });
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (k === ' ') { inp.jump = true; e.preventDefault(); }
    if (k === 'e') h.interact();
    if (k === 'b') h.build();
    if (k === 'tab' || k === 'm') { e.preventDefault(); h.menu(); }
    if (k === 'escape') h.escape();
    if (k >= '1' && k <= '6') h.select(+k - 1);
    if (k === 'q') h.slot(-1);
    if (k === 'r') h.slot(1);
    sync();
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; sync(); });
  function sync() {
    if (stat.joyActive) return;
    inp.moveX = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    inp.moveY = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
    inp.sprint = !!keys.shift;
  }
  return stat;
}
