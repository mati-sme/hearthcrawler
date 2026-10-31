(function () {
  'use strict';
  const HC = window.HC, R = HC.R;
  let last = 0, acc = 0, booted = false;

  function stepOnce() {
    if (HC.T.on) { HC.updateTravel(HC.DT); HC.updateFx(HC.DT); }
    else HC.updateWorld(HC.DT);
  }

  function frame(t) {
    requestAnimationFrame(frame);
    if (!booted) return;
    const now = t / 1000;
    let dt = Math.min(0.1, now - last); last = now;
    if (!HC.ui.paused()) {
      acc += dt;
      let n = 0;
      while (acc >= HC.DT && n < 5) { stepOnce(); acc -= HC.DT; n++; }
      if (n === 5) acc = 0;
    } else { acc = 0; HC.updateFx(dt); }
    HC.ui.update(dt);
    HC.render(now);
  }

  function boot() {
    HC.loadSave();
    HC.equipBest();
    const S = HC.S;
    HC.initRender();
    HC.genZone(S.zone.id, S.zone.dist);
    if (S.zone.id === 'far') S.farSel = Math.max(S.farSel, S.zone.dist + 1);
    HC.initRuntime(true);
    HC.initInput();
    HC.initUI();
    HC.checkAch();
    document.addEventListener('visibilitychange', () => { if (document.hidden) HC.saveNow(); });
    window.addEventListener('pagehide', HC.saveNow);
    booted = true;
    requestAnimationFrame((t) => { last = t / 1000; frame(t); });
  }

  // ---------- test hooks ----------
  window.__HC = {
    get state() { return HC.S; },
    get runtime() { return R; },
    api: HC,
    version: HC.VERSION,
    step(n) { for (let i = 0; i < (n | 0); i++) stepOnce(); },
    giveAll(n) { n = n === undefined ? 100 : n; HC.RES.forEach((r) => HC.addStore(r, n)); },
    setTime(t) { HC.S.t = HC.clamp(+t || 0, 0, HC.CYCLE - 0.01); R.night = HC.S.t >= HC.DAY_LEN; },
    questIndex() { return HC.S.q.i; },
    move(x, y) { HC.input.set(x, y); },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
