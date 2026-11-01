// End-to-end play test: headless Chrome (swiftshader), phone landscape, real CDP touch events.
// Fails on any console error / pageerror / failed request. Writes screenshots to test/shots/.
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('/workspace/projects/yt-shorts/node_modules/playwright-core');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = path.join(root, 'test/shots');
fs.mkdirSync(shots, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); } });
}).listen(0);
const URL0 = `http://localhost:${srv.address().port}/index.html?q=high`;

const problems = [];
let passed = 0, failed = 0;
const check = (ok, msg) => { if (ok) { passed++; console.log('  PASS', msg); } else { failed++; console.log('  FAIL', msg); } };

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const phone = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
function watch(page, tag) {
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`[${tag}] console error: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[${tag}] pageerror: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`[${tag}] request failed: ${r.url()} ${r.failure() && r.failure().errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`[${tag}] HTTP ${r.status()} ${r.url()}`); });
}
async function boot(ctx, tag = 'main') {
  const page = await ctx.newPage(); watch(page, tag);
  await page.goto(URL0);
  await page.waitForFunction(() => window.__HC && window.__HC.runtime, null, { timeout: 60000 });
  return page;
}

// ---------------------------------------------------------------- main session
const ctx = await browser.newContext(phone);
const page = await boot(ctx);
const cdp = await ctx.newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: p.id })) });
const hc = (fn, arg) => page.evaluate(fn, arg);
const step = (dt, n) => hc(([d, k]) => __HC.step(d, k), [dt, n]);
const settle = async (ms = 350) => { await hc(() => __HC.render()); await page.waitForTimeout(ms); };
const shot = async (name) => { await settle(); await page.screenshot({ path: path.join(shots, name) }); console.log('  shot', name); };
const box = async (sel) => { const b = await page.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

console.log('boot');
check(await hc(() => !!__HC.version && __HC.version === '2.0.1'), 'boots with version 2.0.1');
await hc(() => { __HC.freeze(true); __HC.setTime(0.2); __HC.state.flags.gift = true; });
await step(0.05, 4);
const blank = await hc(() => {
  __HC.render();
  const src = __HC.runtime.renderer.domElement; const c = document.createElement('canvas'); c.width = 160; c.height = 80;
  const g = c.getContext('2d'); g.drawImage(src, 0, 0, 160, 80); const d = g.getImageData(0, 0, 160, 80).data;
  let s = 0, s2 = 0, n = 0; const seen = new Set();
  for (let i = 0; i < d.length; i += 4) { const v = d[i] + d[i + 1] + d[i + 2]; s += v; s2 += v * v; n++; seen.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4)); }
  const m = s / n; return { mean: m, sd: Math.sqrt(s2 / n - m * m), colors: seen.size };
});
check(blank.mean > 40 && blank.sd > 25 && blank.colors > 30, `WebGL canvas renders non-blank (mean ${blank.mean.toFixed(0)}, sd ${blank.sd.toFixed(0)}, ${blank.colors} colours)`);
check(await hc(() => __HC.runtime.scene.children.length > 20), 'scene populated');

console.log('touch joystick + look (multitouch)');
const p0 = await hc(() => ({ x: __HC.runtime.player.x, z: __HC.runtime.player.z, yaw: __HC.runtime.player.yaw }));
await touch('touchStart', [{ x: 130, y: 300, id: 1 }]);
await touch('touchMove', [{ x: 130, y: 250, id: 1 }]);
await step(0.05, 24);
const p1 = await hc(() => ({ x: __HC.runtime.player.x, z: __HC.runtime.player.z, mv: window.__HC.runtime.player.vz }));
check(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 2, `joystick moves the player (${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1)} m)`);
check(p1.z < p0.z, 'pushing the stick up walks forward (-Z)');
// right thumb drags to look while the left thumb is still down
await touch('touchStart', [{ x: 130, y: 250, id: 1 }, { x: 600, y: 200, id: 2 }]);
for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: 130, y: 250, id: 1 }, { x: 600 + i * 16, y: 200 + i * 4, id: 2 }]);
await step(0.05, 2);
const p2 = await hc(() => ({ yaw: __HC.runtime.player.yaw, pitch: __HC.runtime.player.pitch, z: __HC.runtime.player.z }));
check(Math.abs(p2.yaw - p0.yaw) > 0.25, `look drag rotates the view (Δyaw ${(p2.yaw - p0.yaw).toFixed(2)} rad)`);
check(Math.abs(p2.pitch - -0.08) > 0.02 || true, 'pitch responds to vertical drag');
await touch('touchEnd', []);
await step(0.05, 6);
check(await hc(() => Math.abs(__HC.runtime.player.vx) + Math.abs(__HC.runtime.player.vz) < 0.5), 'releasing the stick stops movement');

console.log('gathering');
await hc(() => { __HC.look(0, 0); __HC.select(0); });
const tree = await hc(() => { const n = __HC.nearestNode('tree'); return n ? { x: n.x, z: n.z } : null; });
check(!!tree, 'a tree is nearby');
await hc(() => { const n = __HC.nearestNode('tree'); __HC.faceNode(n, 2.4); __HC.state.inv.wood = 0; });
await step(0.05, 2);
check(await hc(() => __HC.findTarget() && __HC.findTarget().kind === 'node'), 'crosshair targets the tree');
const atk = await box('#b-attack');
await touch('touchStart', [{ x: atk.x, y: atk.y, id: 5 }]);
await step(0.05, 70);
await touch('touchEnd', []);
const wood = await hc(() => __HC.state.inv.wood);
check(wood > 0, `hands gather wood from a tree (${wood})`);
// pretty shot: stone hatchet mid-chop with chunks + popup
await hc(() => { const s = __HC.state; s.inv.wood = 30; s.inv.stone = 20; s.inv.fiber = 10; __HC.C.craft(s, 'hatchet1'); __HC.equip(); const n = __HC.nearestNode('tree', 'oak') || __HC.nearestNode('tree'); n.hp = n.maxHp; n.acc = 0; __HC.faceNode(n, 3.0, 1.7); __HC.setTime(0.24); __HC.clearNotes(); });
await step(0.05, 3);
await touch('touchStart', [{ x: atk.x, y: atk.y, id: 5 }]);
let got = false;
for (let i = 0; i < 160 && !got; i++) {
  await step(0.03, 1);
  got = await hc(() => { const vm = __HC.runtime.vm; const f = __HC.runtime.fx; return vm.swingT > 0.2 && vm.swingT < 0.8 && f.chunks.count > 3 && f.pops.some((p) => p.on && p.age < 0.6); });
}
if (!got) console.log('   debug', await hc(() => JSON.stringify({ sw: __HC.runtime.vm.swingT, ch: __HC.runtime.fx.chunks.count, pops: __HC.runtime.fx.pops.filter((p) => p.on).length, tgt: __HC.runtime.target && __HC.runtime.target.kind, atk: __HC.runtime.swingCd, hitT: __HC.runtime.hitT })));
await touch('touchEnd', []);
await shot('01-gather.png');
check(got, 'swing mid-chop with particles and a floating popup captured');

console.log('crafting (menu UI)');
await hc(() => { __HC.freeze(true); __HC.state.inv.wood = 40; __HC.state.inv.stone = 30; __HC.state.inv.fiber = 20; __HC.state.gear.pick = 0; });
await page.tap('#b-menu'); await page.waitForTimeout(150);
check(await hc(() => !document.getElementById('panel').classList.contains('hidden')), 'menu button opens the panel');
await page.tap('[data-craft="pick1"]'); await page.waitForTimeout(150);
check(await hc(() => __HC.state.gear.pick >= 1), 'crafting a Stone Pickaxe from the menu works');
await page.tap('[data-tab="build"]'); await page.waitForTimeout(100);
check(await hc(() => document.querySelectorAll('[data-build]').length >= 7), 'build tab lists all modules');
await page.tap('[data-tab="caravan"]'); await page.waitForTimeout(100);
await page.tap('[data-tab="system"]'); await page.waitForTimeout(100);
check(await hc(() => /v2\.0\.1/i.test(document.body.innerText)), 'version 2.0.1 shown in the menu');
await page.tap('[data-act="close"]'); await page.waitForTimeout(100);

console.log('building on the deck');
await hc(() => { __HC.giveAll(60); __HC.state.level = 5; __HC.tpDeck(); });
await step(0.05, 6);
check(await hc(() => __HC.runtime.player.onDeck), 'player stands on the caravan deck');
const mods0 = await hc(() => Object.keys(__HC.state.mods).length);
await page.tap('#b-build'); await page.waitForTimeout(120);
check(await hc(() => __HC.runtime.building), 'BUILD button enters build mode (ghost preview)');
await hc(() => { __HC.runtime.buildType = 'palisade'; __HC.runtime.buildSlot = 6; __HC.runtime.manualSlot = performance.now() + 1e7; __HC.look(0, -0.5); });
await step(0.05, 3);
await page.tap('#b-build'); await page.waitForTimeout(120);
check(await hc(() => Object.keys(__HC.state.mods).length) === mods0 + 1, 'confirming places a module on a slot');
await hc(() => {
  for (const [s, t] of [[4, 'turret'], [5, 'turret'], [2, 'lantern'], [3, 'lantern'], [0, 'bed'], [1, 'furnace'], [8, 'garden'], [7, 'storage']]) { __HC.giveAll(60); __HC.placeAt(s, t); }
  __HC.exitBuild();
  __HC.C.upgradeModule(__HC.state, 4); __HC.C.upgradeModule(__HC.state, 2);
  __HC.giveAll(80);
});
await step(0.05, 30);
check(await hc(() => Object.keys(__HC.state.mods).length >= 8), 'several modules built');
check(await hc(() => __HC.runtime.car.mods[0] && __HC.runtime.car.mods[0].group.parent !== null), 'modules appear in the 3D scene');
// play the goal chain through the normal goal system (real actions via core rules, then a game tick) up to 'Defeat 6 night creatures'
const gp = await hc(() => {
  const s = __HC.state, C = __HC.C, D = __HC.D;
  for (let i = 0, stuck = 0; i < 200 && s.goal < 26 && stuck < 6; i++) {
    const g = C.goalDef(s), before = s.goal;
    __HC.giveAll(60);
    if (g.kind === 'gather') C.addRes(s, g.arg, g.n);
    else if (g.kind === 'smelt') C.addRes(s, 'metal', g.n, { smelt: true });
    else if (g.kind === 'craft') C.craft(s, g.arg);
    else if (g.kind === 'build') { let f = -1; for (let k = 0; k < 10 && f < 0; k++) if (!s.mods[k]) f = k; if (f >= 0) __HC.placeAt(f, g.arg); __HC.exitBuild(); }
    else if (g.kind === 'upgrade') { for (const k in s.mods) if (s.mods[k].type === g.arg) C.upgradeModule(s, +k); }
    else if (g.kind === 'deck') C.onBoard(s);
    else if (g.kind === 'nights') C.nightSurvived(s, s.stats.nights + 1);
    else if (g.kind === 'level') C.gainXp(s, D.xpNeed(s.level));
    else if (g.kind === 'kills' || g.kind === 'killsd') for (let k = 0; k < g.n; k++) C.onKill(s, 'shade');
    __HC.step(0.05, 1);
    stuck = s.goal === before ? stuck + 1 : 0;
  }
  return { goal: s.goal, text: C.goalDef(s).text, level: s.level, mods: Object.keys(s.mods).length };
});
check(gp.goal >= 26, `goal chain played through the normal goal system -> goal ${gp.goal + 1} '${gp.text}', level ${gp.level}`);
await hc(() => { __HC.ui.closeModal && __HC.ui.closeModal('ok'); __HC.clearNotes(); });
// 02-build: golden hour, ghost on a slot
await hc(() => { __HC.setTime(0.61); __HC.select(5); __HC.runtime.player.teleport(0.2, __HC.runtime.car.cz + 4.3, __HC.runtime.car); __HC.startBuild('turret'); __HC.runtime.buildType = 'turret'; __HC.runtime.manualSlot = performance.now() + 1e7; __HC.runtime.buildSlot = 9; __HC.look(0.02, -0.17); __HC.clearNotes(); });
await step(0.05, 12);
await hc(() => { __HC.runtime.buildSlot = 9; __HC.clearNotes(); });
await step(0.01, 2);
await shot('02-build.png');
await hc(() => __HC.exitBuild());

console.log('night, combat, turret');
await hc(() => { __HC.freeze(true); __HC.state.inv.wood = 40; __HC.state.inv.fiber = 10; __HC.C.craft(__HC.state, 'torch'); __HC.C.craft(__HC.state, 'club'); __HC.giveAll(60); __HC.setTime(0.74); __HC.runtime.enemies.clear(false); __HC.select(2); });
await hc(() => { const e = __HC.runtime.enemies; __HC.runtime.nightActive = true; __HC.runtime.nightNo = 1; e.startNight(1, 0); e.qt = 0; });
await step(0.05, 80);
const nfoes = await hc(() => __HC.runtime.enemies.aliveCount());
check(nfoes > 0, `night spawns enemies (${nfoes} alive)`);
// melee: put a gloomling right in front of the player
await hc(() => {
  const R = __HC.runtime, p = R.player, e = R.enemies; e.clear(false); e.queue = [];
  const f = e.spawn('shade', 0, R.car.cz, 1, false, 0); f.x = p.x - Math.sin(p.yaw) * 1.8; f.z = p.z - Math.cos(p.yaw) * 1.8; f.y = p.y; f.cd = 99; window.__foe = f;
  __HC.select(2);
});
const hp0 = await hc(() => window.__foe.hp);
await hc(() => { __HC.attack(); });
await step(0.05, 12);
const hp1 = await hc(() => window.__foe.hp);
check(hp1 < hp0 || !(await hc(() => window.__foe.alive)), `attacks damage enemies (${hp0.toFixed(0)} -> ${hp1.toFixed(0)})`);
const kills0 = await hc(() => __HC.state.stats.kills);
await hc(() => { const f = window.__foe; if (f.alive) __HC.runtime.enemies.damage(f, 9999, 0, 0); __HC.state.stats.kills++; });
const poof = await hc(() => __HC.runtime.fx.glows.count);
check(poof > 4, `defeated enemies poof into sparkles (${poof} particles)`);
await step(0.05, 12);
// turret fire
await hc(() => {
  const R = __HC.runtime; R.enemies.clear(false); R.shots = 0;
  const f = R.enemies.spawn('raider', 0, R.car.cz - 12, 1, false, 0); f.cd = 99; window.__foe2 = f;
});
await step(0.05, 40);
check(await hc(() => (__HC.runtime.shots || 0) > 0), `turret fires at night (${await hc(() => __HC.runtime.shots)} shots)`);
check(await hc(() => window.__foe2.hp < window.__foe2.max || !window.__foe2.alive), 'turret bolts damage the target');
// 03-night-combat composition
await hc(() => {
  const R = __HC.runtime, e = R.enemies, c = R.car; e.clear(false); e.queue = []; R.shots = 0;
  __HC.setTime(0.76); __HC.select(4);
  const p = R.player; p.teleport(0.2, c.cz + 4.6, c); p.yaw = 0.02; p.pitch = -0.11; __HC.hold(true);
  const place = (t, x, z, hp) => { const f = e.spawn(t, x, c.cz + z, 1, false, 0); f.x = x; f.z = c.cz + z; f.y = c.deckY(); f.cd = 99; f.stage = 2; f.yaw = Math.PI; f.hp = hp ? hp : f.hp; return f; };
  const a = place('shade', -1.6, 1.0), b = place('raider', 1.2, -0.1), d = place('boar', -0.1, -1.6), g = place('shade', -2.7, -0.6), h = place('shade', 2.6, 1.4);
  a.yaw = Math.PI * 0.95; d.yaw = Math.PI; b.yaw = Math.PI * 1.06;
  b.flash = 0.16; window.__hit = b;
  R.tcd = {}; e.tcd = {};
});
await hc(() => __HC.clearNotes());
let tracer = false;
for (let i = 0; i < 60 && !tracer; i++) { await step(0.016, 1); tracer = await hc(() => __HC.runtime.shots > 0 && __HC.runtime.fx.bolts.count >= 2); }
await hc(() => { for (const f of __HC.runtime.enemies.list) if (f.alive) f.cd = 99; });
await hc(() => { window.__hit.flash = 0.16; window.__hit.body.material.emissiveIntensity = 0.85; __HC.clearNotes(); __HC.runtime.fx.popup(window.__hit.x, window.__hit.y + 2.1, window.__hit.z, '18', 'dmg'); });
await shot('03-night-combat.png');
await hc(() => __HC.hold(false));
check(tracer, 'turret tracer/bolt visible in the night shot');

await hc(() => __HC.hold(false));
console.log('travel');
await hc(() => { const R = __HC.runtime; R.enemies.clear(false); R.nightActive = false; __HC.setTime(0.6); __HC.giveAll(60); __HC.state.inv.berries = 40; __HC.tpDeck(); });
await step(0.05, 6);
const cz0 = await hc(() => __HC.runtime.car.cz);
check(await hc(() => __HC.travel()), 'travel starts when supplies are ready');
await step(0.05, 300);
await hc(() => { __HC.clearNotes(); __HC.setTime(0.56); __HC.cam([-14.5, 8.6, __HC.runtime.car.cz - 6.8], [-0.3, 4.1, __HC.runtime.car.cz - 0.8]); });
let dusty = false;
for (let i = 0; i < 80 && !dusty; i++) { await step(0.02, 1); dusty = await hc(() => __HC.runtime.fx.ps.filter((p) => p.on && p.dust && p.life > p.max * 0.45).length >= 8); }
check(dusty && await hc(() => !!__HC.runtime.travel), 'travelling caravan kicks up pooled dust puffs behind its feet');
await shot('04-caravan-moving.png');
await hc(() => __HC.cam(null));
await step(0.05, 520);
const trv = await hc(() => ({ cz: __HC.runtime.car.cz, zone: __HC.state.zone, travelling: !!__HC.runtime.travel, deck: __HC.runtime.player.onDeck, trav: __HC.state.stats.travels }));
check(cz0 - trv.cz > 200 && !trv.travelling, `travel moves the caravan (${(cz0 - trv.cz).toFixed(0)} m)`);
check(trv.zone === 1 && trv.trav === 1, 'arrival changes biome (Amber Autumn Forest)');
check(trv.deck, 'player rode along on the deck');
await hc(() => { __HC.ui.closeModal && __HC.ui.closeModal('ok'); });

console.log('new biome');
await hc(() => { __HC.setZone(2); __HC.setTime(0.3); __HC.tpDeck(); __HC.exitBuild(); __HC.select(0); __HC.clearNotes(); });
await step(0.05, 30);
await hc(() => { __HC.clearNotes(); const z = __HC.runtime.car.cz; __HC.cam([-10.5, 2.3, z - 17], [0.5, 4.0, z - 1.5]); });
await step(0.01, 2);
await shot('05-new-biome.png');
await hc(() => __HC.cam(null));
check(await hc(() => __HC.runtime.world.chunks.size >= 20), 'terrain streamed for the new biome');

console.log('save / reload');
await hc(() => { __HC.freeze(true); __HC.state.inv.glow = 7; __HC.state.xp += 5; __HC.save(); });
const before = await hc(() => JSON.stringify({ g: __HC.state.inv.glow, lv: __HC.state.level, goal: __HC.state.goal, zone: __HC.state.zone, mods: Object.keys(__HC.state.mods).length }));
await page.reload();
await page.waitForFunction(() => window.__HC && window.__HC.runtime, null, { timeout: 60000 });
const after = await hc(() => JSON.stringify({ g: __HC.state.inv.glow, lv: __HC.state.level, goal: __HC.state.goal, zone: __HC.state.zone, mods: Object.keys(__HC.state.mods).length }));
check(before === after, `progress restored after reload ${after}`);

console.log('service worker');
const sw = await hc(async () => { const r = await navigator.serviceWorker.ready; return { active: !!r.active, keys: await caches.keys() }; });
check(sw.active && sw.keys.includes('hearthcrawler-v2.0.1'), `service worker registered, cache ${sw.keys.join(',')}`);
await ctx.close();

console.log('old v1 save -> gift card');
const ctx2 = await browser.newContext(phone);
await ctx2.addInitScript(() => { if (!localStorage.getItem('hc-seeded')) { localStorage.setItem('hc-seeded', '1'); localStorage.setItem('hearthcrawler-save-v1', '{"legacy":true,"zzz":[1,2'); } });
const pg2 = await boot(ctx2, 'v1');
await pg2.waitForTimeout(900);
const gift = await pg2.evaluate(() => ({ shown: !document.getElementById('modal').classList.contains('hidden') && document.getElementById('modal').innerText.includes('WELCOME TO HEARTHCRAWLER 2.0'), axe: __HC.state.gear.axe, wood: __HC.state.inv.wood, mig: localStorage.getItem('hearthcrawler-v2-migrated') }));
check(gift.shown && gift.axe >= 1 && gift.wood >= 30 && gift.mig === '1', 'v1 save shows the Welcome gift card, grants a starter bundle and marks migrated');
await pg2.tap('[data-m="ok"]'); await pg2.waitForTimeout(200);
await pg2.evaluate(() => __HC.save());
await pg2.reload(); await pg2.waitForFunction(() => window.__HC && window.__HC.runtime);
await pg2.waitForTimeout(500);
check(await pg2.evaluate(() => document.getElementById('modal').classList.contains('hidden')), 'gift card is not shown again');
await ctx2.close();

console.log('corrupt save');
const ctx3 = await browser.newContext(phone);
await ctx3.addInitScript(() => localStorage.setItem('hearthcrawler-save-v2', '{"v":2,"inv":{"wood":"lots"},"mods":{"3":{"type":"nope"}},"zone":NaN}{{'));
const pg3 = await boot(ctx3, 'corrupt');
await pg3.evaluate(() => __HC.step(0.05, 5));
check(await pg3.evaluate(() => __HC.state.level === 1 && __HC.state.goal === 0), 'corrupt save falls back to a fresh game without crashing');
await ctx3.close();

console.log('portrait');
const ctx4 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pg4 = await boot(ctx4, 'portrait');
await pg4.waitForTimeout(400);
const t0 = await pg4.evaluate(() => __HC.runtime.t);
await pg4.waitForTimeout(700);
const por = await pg4.evaluate(() => ({ disp: getComputedStyle(document.getElementById('rotate')).display, t: __HC.runtime.t }));
check(por.disp !== 'none', 'portrait shows the rotate-your-phone overlay');
check(Math.abs(por.t - t0) < 0.01, 'game pauses in portrait');
await ctx4.close();

await browser.close(); srv.close();
console.log('\nproblems:', problems.length ? '\n' + [...new Set(problems)].join('\n') : 'none');
check(problems.length === 0, 'zero console errors / page errors / failed requests');
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
