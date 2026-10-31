// Anti-stall balance sim: an auto-play bot plays from a fresh save (no giveAll) for 60+ in-game minutes.
// Run: node test/balance.mjs   (env: PW_PATH, BAL_MINUTES, BAL_VERBOSE=1)
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
const MINUTES = +(process.env.BAL_MINUTES || 60);
const VERBOSE = !!process.env.BAL_VERBOSE;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
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
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const browser = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const problems = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));

try {
  await page.goto(URL_, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.removeItem('hearthcrawler-save-v1'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__HC && window.__HC.state);
  await page.addStyleTag({ content: '.pulse,.hint,.go,.pop{animation:none!important}' });
  await page.evaluate(() => { document.getElementById('tutorial') && document.getElementById('tutorial').classList.add('hidden'); window.__HC.api.noSave = true; });
  await page.addScriptTag({ path: path.join(ROOT, 'test', 'bot.js') });

  const shot = async (name) => { await page.waitForTimeout(600); await page.screenshot({ path: path.join(SHOTS, name) }); };
  await page.evaluate(() => { window.__bot.wantShot = true; });
  const CHUNK = 3600; // 1 in-game minute
  let shotBoss = false, shotFar = false, lastQ = -1, lastQT = 0, info;
  for (let m = 0; m < MINUTES + 30; m++) {
    info = await page.evaluate(([n, mx]) => window.__bot.run(n, mx), [CHUNK, MINUTES + 30]);
    if (VERBOSE || m % 5 === 4) console.log(`t=${fmt(info.t)} goal#${info.q} "${info.quest}" ${info.prog}/${info.need} lvl=${info.lvl} ${info.zone}:${info.dist} hp=${info.hp} hun=${info.hunger} deaths=${info.deaths} ${info.status}${VERBOSE ? " [" + info.slots + "] " + info.res : ""}`);
    if (info.q !== lastQ) { lastQ = info.q; lastQT = info.t; }
    // screenshots: mid boss fight, and on arriving in far roads
    if (await page.evaluate(() => { const r = window.__bot.shotReady; window.__bot.shotReady = false; return r; })) { await shot('08-boss.png'); shotBoss = true; }
    if (!shotFar && info.zone === 'far') { await page.evaluate(() => window.__HC.step(30)); await shot('09-far-roads.png'); shotFar = true; }
    if (info.t >= MINUTES * 60 && (info.zone === 'far' || m >= MINUTES + 25)) break;
    if (info.t - lastQT > 15 * 60) { console.log('STALLED: no goal progress for 15 in-game minutes'); break; }
  }
  const res = await page.evaluate(() => { const b = window.__bot; const S = window.__HC.state; return { goals: b.goals, levels: b.levels, bosses: b.bosses, log: b.log, zones: Object.keys(S.visited), bossDown: Object.keys(S.bossDown), maxDist: S.maxDist, lvl: S.lvl, deaths: S.stats.deaths }; });

  // ---- summary table
  console.log('\n#   time   gap    lvl zone         goal');
  let prev = 0, maxGap = 0, maxGapGoal = '';
  res.goals.forEach((g) => {
    const gap = g.t - prev; if (gap > maxGap) { maxGap = gap; maxGapGoal = `#${g.i} ${g.text}`; }
    console.log(`${String(g.i + 1).padStart(2)}  ${fmt(g.t).padStart(6)} ${fmt(gap).padStart(6)}  ${String(g.lvl).padStart(2)}  ${(g.zone + ':' + g.dist).padEnd(11)}  ${g.text}`);
    prev = g.t;
  });
  console.log('\nlevel-ups: ' + res.levels.map((l) => `L${l.lvl}@${fmt(l.t)}`).join(' '));
  console.log('bosses: ' + (res.bosses.map((b) => `${b.z}@${fmt(b.t)}`).join(' ') || 'none') + `   zones: ${res.zones.join(',')}   maxDist: ${res.maxDist}   deaths: ${res.deaths}`);
  console.log(`goals completed: ${res.goals.length}   longest gap: ${fmt(maxGap)} (${maxGapGoal})   final t=${fmt(info.t)}   current goal: "${info.quest}" ${info.status}`);
  if (VERBOSE) console.log(res.log.join('\n'));

  check('simulated at least 60 in-game minutes', info.t >= 60 * 60, fmt(info.t));
  check('reached the Scrap Wastes', res.zones.includes('scrap'));
  check('defeated the first boss', res.bossDown.includes('badlands'));
  check('longest gap between goals < 4 min', maxGap < 240, `${fmt(maxGap)} at ${maxGapGoal}`);
  check('reached Far Roads endless mode', res.zones.includes('far'), `maxDist ${res.maxDist}`);
  check('all 3 bosses defeated', res.bossDown.length >= 3, res.bossDown.join(','));
  check('zero console/page errors', problems.length === 0, problems.slice(0, 3).join(' | '));
} catch (e) {
  console.log('FAIL: exception ' + (e && e.stack || e)); failed++;
}
await browser.close();
server.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nAll balance checks passed');
process.exit(failed ? 1 : 0);
