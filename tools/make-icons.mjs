// Renders the PWA icons (low-poly Shellback silhouette on a dusk gradient) in headless Chrome.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('/workspace/projects/yt-shorts/node_modules/playwright-core');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
const draw = `(size, mask) => {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); const s = size / 512;
  const sky = g.createLinearGradient(0, 0, 0, size); sky.addColorStop(0, '#1b1840'); sky.addColorStop(0.45, '#7a3a6a'); sky.addColorStop(0.72, '#ff7a3a'); sky.addColorStop(1, '#ffc06a');
  g.fillStyle = sky; g.fillRect(0, 0, size, size);
  g.fillStyle = '#fff'; for (let i = 0; i < 24; i++) { g.globalAlpha = 0.5 + 0.5 * ((i * 37) % 10) / 10; g.fillRect(((i * 97) % 480 + 16) * s, ((i * 53) % 190 + 14) * s, 2.5 * s, 2.5 * s); } g.globalAlpha = 1;
  g.fillStyle = '#fff3c8'; g.beginPath(); g.arc(380 * s, 300 * s, 46 * s, 0, 7); g.fill();
  const f = (pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0] * s, p[1] * s) : g.moveTo(p[0] * s, p[1] * s)); g.closePath(); g.fill(); };
  f([[0, 400], [90, 360], [200, 390], [330, 350], [440, 385], [512, 365], [512, 512], [0, 512]], '#3a2a4a');
  const m = mask ? 0.82 : 1; g.save(); g.translate(256 * s, 280 * s); g.scale(m, m); g.translate(-256 * s, -280 * s);
  f([[130, 330], [170, 250], [270, 215], [370, 250], [405, 330]], '#5a6a3c'); f([[170, 250], [270, 215], [300, 290], [200, 320]], '#7a8a4c'); f([[270, 215], [370, 250], [405, 330], [300, 290]], '#46542e');
  f([[405, 330], [452, 310], [478, 335], [452, 362], [405, 358]], '#8a9a5a'); g.fillStyle = '#111'; g.fillRect(458 * s, 322 * s, 8 * s, 8 * s);
  [[160, 340], [250, 345], [340, 340]].forEach(([x]) => f([[x, 330], [x + 42, 330], [x + 38, 400], [x - 4, 400]], '#4a5632'));
  f([[190, 215], [330, 215], [330, 160], [260, 125], [190, 160]], '#9a6a3a'); f([[190, 160], [260, 125], [330, 160], [260, 175]], '#c8924f'); f([[215, 215], [255, 215], [255, 175], [215, 175]], '#ffd27a');
  g.restore();
  return c.toDataURL('image/png').split(',')[1];
}`;
await page.setContent('<html></html>');
for (const [name, size, mask] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true]]) {
  const b64 = await page.evaluate(`(${draw})(${size}, ${mask})`);
  fs.writeFileSync(new URL('../icons/' + name, import.meta.url), Buffer.from(b64, 'base64'));
  console.log('wrote', name);
}
await browser.close();
