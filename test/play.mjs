// Headless playthrough test for Hearthcrawler.  Run: node test/play.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH || '/workspace/projects/yt-shorts/node_modules/playwright-core');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'test', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/index.html`;

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${extra ? '  (' + extra + ')' : ''}`); if (!ok) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const problems = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => problems.push('requestfailed: ' + r.url()));

try {
  await page.goto(URL_, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__HC && window.__HC.state);
  check('game boots and exposes __HC', await page.evaluate(() => typeof __HC.step === 'function' && typeof __HC.giveAll === 'function' && !!__HC.version));
  await page.evaluate(() => localStorage.removeItem('hearthcrawler-save-v1'));
  // pulsing hint animations are intentional UX but make Playwright think buttons are unstable
  await page.addStyleTag({ content: '.pulse,.hint,.go,.pop{animation:none!important}' });

  // ---- tutorial ----
  check('tutorial shows on first run', await page.isVisible('#tutorial'));
  for (let i = 0; i < 4 && (await page.isVisible('#tutorial')); i++) { await page.click('#tut-next'); await sleep(120); }
  check('tutorial dismissed', !(await page.isVisible('#tutorial')));

  const S = (fn, ...a) => page.evaluate(fn, ...a);
  const blockers = async () => {
    for (let i = 0; i < 6; i++) {
      const perk = await page.$('#sheet:not(.hidden) .perkcard');
      if (perk) { await perk.click(); await sleep(250); continue; }
      const modal = await page.$('#modal:not(.hidden) #mNo');
      if (modal) { await modal.click(); continue; }
      break;
    }
  };

  // ---- real touch joystick via CDP ----
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const drag = async (x0, y0, dx, dy, ms = 900) => {
    await touch('touchStart', [{ x: x0, y: y0, id: 1 }]);
    const steps = 10;
    for (let i = 1; i <= steps; i++) { await touch('touchMove', [{ x: x0 + (dx * i) / steps, y: y0 + (dy * i) / steps, id: 1 }]); await sleep(ms / steps); }
    const knob = await page.evaluate(() => !document.getElementById('joy').classList.contains('hidden'));
    await touch('touchEnd', []);
    return knob;
  };
  const pos = () => S(() => ({ x: __HC.runtime.P.x, y: __HC.runtime.P.y }));
  const p0 = await pos();
  const knobShown = await drag(120, 650, 90, 0);
  const p1 = await pos();
  check('joystick drag moves player', Math.hypot(p1.x - p0.x, p1.y - p0.y) > 8, `moved ${Math.hypot(p1.x - p0.x, p1.y - p0.y).toFixed(1)}px`);
  check('joystick ring visible while dragging', knobShown);
  check('joystick hidden after release', await page.evaluate(() => document.getElementById('joy').classList.contains('hidden')));
  await drag(250, 700, -60, -80, 700);
  const p2 = await pos();
  check('second drag direction moves player again', Math.hypot(p2.x - p1.x, p2.y - p1.y) > 8);

  // ---- autopilot helper living in the page ----
  await S(() => {
    window.__bot = function (maxIter, stop, mode) {
      const H = __HC.api, R = H.R, P = R.P, W = H.W;
      let maxHostile = 0;
      for (let it = 0; it < maxIter; it++) {
        if (stop && stop()) { __HC.move(null); return { it, maxHostile }; }
        const q = H.curQuest();
        let type = 'tree';
        if (q.t === 'gather') type = { wood: 'tree', stone: 'rock', scrap: 'scrap', food: 'bush' }[q.a] || 'tree';
        if (mode === 'wood') type = 'tree'; else if (mode === 'scrap') type = 'scrap';
        let tx = null, ty = null;
        if (H.carryCount() >= H.carryCap() - 6) { tx = W.cx; ty = H.G.y1 + 30; }
        else {
          if (mode === 'fight') {
            let bd = 1e12;
            for (const m of R.mobs) if (m.on && m.kind !== 'critter') { const d = (m.x - P.x) ** 2 + (m.y - P.y) ** 2; if (d < bd) { bd = d; tx = m.x; ty = m.y; } }
          }
          if (tx === null) {
            let bd = 1e12;
            for (const n of W.nodes) { if (n.type !== type || !n.alive) continue; const d = (n.x - P.x) ** 2 + (n.y - P.y) ** 2; if (d < bd) { bd = d; tx = n.x; ty = n.y; } }
          }
        }
        if (tx !== null) { const dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy); if (d > 28) __HC.move(dx / d, dy / d); else __HC.move(0, 0); }
        __HC.step(6);
        let h = 0; for (const m of R.mobs) if (m.on && m.kind !== 'critter') h++;
        if (h > maxHostile) maxHostile = h;
      }
      __HC.move(null);
      return { it: maxIter, maxHostile };
    };
  });

  // ---- gather for real and complete the first quests ----
  const q0 = await S(() => __HC.questIndex());
  await S(() => window.__bot(5000, () => __HC.questIndex() >= 2));
  const st1 = await S(() => ({ q: __HC.questIndex(), gathered: __HC.state.stats.gathered, wood: __HC.api.have('wood'), stone: __HC.api.have('stone') }));
  check('resources gathered by walking near nodes', st1.gathered > 8, JSON.stringify(st1));
  check('quest index advanced from gathering', st1.q > q0, `q ${q0} -> ${st1.q}`);
  await page.waitForTimeout(400);
  await blockers();
  await page.screenshot({ path: path.join(SHOTS, '01-day.png') });

  // ---- craft panel ----
  await S(() => __HC.giveAll(300));
  await blockers();
  await page.click('#btn-craft');
  check('craft panel opens', await page.isVisible('#sheet'));
  await page.click('[data-act="craft"][data-id="axe1"]');
  check('stone axe crafted via UI', await S(() => !!__HC.state.inv.owned.axe1));
  await page.click('[data-act="craft"][data-id="pick1"]');
  await page.click('[data-act="craft"][data-id="spear"]');
  check('pick + spear crafted, weapon equipped', await S(() => __HC.state.equip.weapon === 'spear' && __HC.state.equip.pick === 'pick1'));
  await page.screenshot({ path: path.join(SHOTS, '05-craft.png') });
  await page.click('#sheetClose');

  // ---- caravan panel: build modules ----
  await blockers();
  await page.click('#btn-caravan');
  check('caravan panel opens', await page.isVisible('#sheet'));
  await page.click('[data-act="build"][data-mod="workbench"]');
  check('workbench module built via UI', await S(() => __HC.api.modLevel('workbench') === 1));
  await page.click('.slot:not(.has)');
  await page.click('[data-act="build"][data-mod="lantern"]');
  await page.click('.slot:not(.has)');
  await page.click('[data-act="build"][data-mod="turret"]');
  await page.click('.slot:not(.has)');
  await page.click('[data-act="build"][data-mod="engine"]');
  check('lantern, turret and engine built', await S(() => __HC.api.modLevel('lantern') > 0 && __HC.api.modLevel('turret') > 0 && __HC.api.modLevel('engine') > 0));
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(SHOTS, '02-caravan-panel.png') });
  await page.click('[data-act="chassis"]');
  check('chassis expanded', await S(() => __HC.state.grid.chassis === 2));
  await page.click('.slot:not(.has)');
  await page.click('[data-act="build"][data-mod="bed"]');
  await page.click('.slot:not(.has)');
  await page.click('[data-act="build"][data-mod="furnace"]');
  check('bed and furnace built (6 modules)', await S(() => __HC.state.grid.slots.filter(Boolean).length === 6));
  await page.click('#sheetClose');
  const mods = await S(() => __HC.state.stats.built);
  check('a module was built (stats)', mods >= 6, `built=${mods}`);

  // ---- a few minutes of play: day -> night with combat ----
  await blockers();
  await S(() => { __HC.state.hp = __HC.api.maxHP(); });
  const day = await S(() => window.__bot(1800, null, 'wood'));          // ~3 min of game time chopping
  check('simulated ~3 minutes of day play', true, `maxHostile=${day.maxHostile}`);
  await S(() => { __HC.setTime(__HC.api.DAY_LEN - 4); __HC.state.hp = __HC.api.maxHP(); });
  await S(() => __HC.step(900));
  const nightInfo = await S(() => ({ night: __HC.runtime.night, t: __HC.state.t }));
  check('night arrives', nightInfo.night, JSON.stringify(nightInfo));
  const fight = await S(() => window.__bot(900, null, 'fight'));       // ~90s of night fighting near the caravan
  check('mobs spawn at night', fight.maxHostile > 0, `maxHostile=${fight.maxHostile}`);
  const kills = await S(() => __HC.state.stats.kills);
  check('combat happened (mobs poofed)', kills > 0, `kills=${kills}`);
  // make sure a few mobs are on screen for the screenshot
  await S(() => { __HC.state.hp = __HC.api.maxHP(); __HC.setTime(__HC.api.DAY_LEN + 20); const R = __HC.runtime, P = R.P; for (let i = 0; i < 5; i++) __HC.api.spawnMob(['raider', 'howler', 'slime', 'raider', 'sling'][i], P.x + (i - 2) * 70, P.y - 120 - (i % 2) * 40, { rush: true }); __HC.step(40); });
  await blockers();
  await page.screenshot({ path: path.join(SHOTS, '03-night-combat.png') });
  await S(() => { __HC.setTime(20); __HC.step(5); });

  // ---- more quests: drive the chain to see progress ----
  await S(() => { __HC.giveAll(400); });
  const qBefore = await S(() => __HC.questIndex());
  // like a player would: build goals are met by building (demolishing a spare module if the chassis is full), the rest by walking and fighting
  for (let round = 0; round < 6 && (await S(() => __HC.questIndex())) < qBefore + 2; round++) {
    await S((t) => {
      const H = __HC.api, q = H.curQuest(), sl = __HC.state.grid.slots;
      if (q.t === 'build' && !H.modLevel(q.a)) {
        let i = sl.findIndex((m, k) => !m && H.slotValid(k));
        if (i < 0) { i = sl.findIndex((m) => m && m.m === 'furnace'); H.demolishMod(i); }
        H.buildMod(i, q.a);
      }
      window.__bot(1500, () => __HC.questIndex() >= t);
    }, qBefore + 2);
  }
  const qAfter = await S(() => __HC.questIndex());
  check('quest chain keeps advancing', qAfter > qBefore, `q ${qBefore} -> ${qAfter}`);

  // ---- map + travel ----
  await blockers();
  await S(() => { __HC.giveAll(500); });
  await page.click('#btn-map');
  check('map panel opens', await page.isVisible('#sheet'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, '04-map.png') });
  const canGo = await page.isEnabled('[data-act="travel"][data-zone="pine"]');
  check('travel to Pine Forest is enabled (engine + fuel)', canGo);
  await page.click('[data-act="travel"][data-zone="pine"]');
  check('travel started', await S(() => __HC.api.T.on));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, '06-travel.png') });
  await S(() => __HC.step(1400));
  const z = await S(() => ({ id: __HC.state.zone.id, dist: __HC.state.zone.dist, on: __HC.api.T.on }));
  check('arrived in Pine Forest', z.id === 'pine' && !z.on, JSON.stringify(z));
  await page.waitForTimeout(300);
  await blockers();
  await page.screenshot({ path: path.join(SHOTS, '07-pine.png') });
  await page.click('#btn-settings');
  check('settings panel opens', await page.isVisible('#sheet'));
  await page.click('#sheetClose');

  // ---- save / PWA ----
  await S(() => __HC.api.saveNow());
  const save = await S(() => { try { const d = JSON.parse(localStorage.getItem('hearthcrawler-save-v1')); return { ok: !!d, zone: d.zone.id, q: d.q.i, mods: d.grid.slots.filter(Boolean).length }; } catch (e) { return { ok: false }; } });
  check('localStorage save exists and parses', save.ok, JSON.stringify(save));
  const sw = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'unsupported';
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 8000))]);
    return reg && reg.active ? 'active' : 'none';
  });
  check('service worker registered and active', sw === 'active', sw);
  // reload: save restores
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__HC && window.__HC.state);
  const re = await S(() => ({ zone: __HC.state.zone.id, mods: __HC.state.grid.slots.filter(Boolean).length }));
  check('reload restores saved game', re.zone === 'pine' && re.mods >= 6, JSON.stringify(re));

  // ---- fps ----
  await blockers();
  const fps = await page.evaluate(() => new Promise((res) => {
    let n = 0, t0 = performance.now();
    const f = (t) => { n++; if (t - t0 < 3000) requestAnimationFrame(f); else res({ fps: (n * 1000) / (t - t0), ms: (t - t0) / n }); };
    requestAnimationFrame(f);
  }));
  console.log(`INFO: avg frame ${fps.ms.toFixed(2)} ms  ~ ${fps.fps.toFixed(1)} FPS (headless, DPR3 emulation)`);
  check('frame rate is playable', fps.fps >= 20, `${fps.fps.toFixed(1)} fps`);
} catch (e) {
  console.log('FAIL: test crashed:', e && e.stack ? e.stack : e);
  failed++;
}

await sleep(200);
check('no console errors / warnings / page errors', problems.length === 0, problems.slice(0, 6).join(' | '));
await browser.close();
server.close();
console.log(failed ? `\nRESULT: FAIL (${failed} failed)` : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
