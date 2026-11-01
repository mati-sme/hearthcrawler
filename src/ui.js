// DOM HUD + panels. Dark chamfered "survival HUD"; everything drawn with inline SVG glyphs.
import { RES, RES_IDS, SLOTS, GEAR, SLOT_NAMES, RECIPES, MODS, MOD_IDS, FOOD_IDS, NIGHT_AT, VERSION, biomeOf, xpNeed } from './data.js';
import * as C from './core.js';
import { icon } from './icons.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export class UI {
  constructor(G) {
    this.G = G; this.cache = {}; this.notes = []; this.queue = []; this.tab = 'craft'; this.open = false; this.modalOpen = false;
    $('b-menu').innerHTML = icon('menu');
    $('b-jump').innerHTML = icon('jump');
    $('b-cancel').innerHTML = icon('close');
    $('b-interact').insertAdjacentHTML('afterbegin', icon('interact'));
    $('b-build').insertAdjacentHTML('afterbegin', icon('build'));
    $('b-attack').insertAdjacentHTML('afterbegin', icon('attack'));
    $('r-hp').innerHTML = icon('heart') + '<div class="segs"></div>';
    $('r-food').innerHTML = icon('food') + '<div class="segs"></div>';
    $('r-stam').innerHTML = icon('bolt') + '<div class="segs"></div>';
    for (const id of ['r-hp', 'r-food', 'r-stam']) { const s = $(id).querySelector('.segs'); for (let i = 0; i < 10; i++) s.appendChild(document.createElement('i')); }
    $('r-food').addEventListener('pointerdown', (e) => { e.stopPropagation(); G.eat(); });
    this.hot = $('hotbar');
    SLOTS.forEach((s, i) => {
      const d = document.createElement('div'); d.className = 'slot'; d.dataset.i = i;
      d.innerHTML = `<b>${i + 1}</b>${icon(s)}<em></em>`;
      d.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); G.select(i); });
      this.hot.appendChild(d);
    });
    $('clk-ic').innerHTML = icon('sun');
    this.cv = $('compass'); this.cx = this.cv.getContext('2d');
    $('panel').addEventListener('click', (e) => this.panelClick(e));
    $('modal').addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) this.closeModal(b.dataset.m); });
  }
  set(id, key, val, fn) { if (this.cache[key] !== val) { this.cache[key] = val; fn ? fn($(id), val) : ($(id).textContent = val); } }
  chips(cost, s) { return Object.keys(cost).map((k) => `<span class="chip ${s && (s.inv[k] || 0) < cost[k] ? 'lack' : ''}" style="color:${s && (s.inv[k] || 0) < cost[k] ? '' : RES[k] ? RES[k].col : 'inherit'}">${icon(k)}${cost[k]}</span>`).join(''); }
  resChips(res) { return Object.keys(res).filter((k) => res[k]).map((k) => `<span class="chip" style="color:${RES[k].col}">${icon(k)}+${res[k]}</span>`).join(''); }

  // ---- notices (max 2 on screen)
  notify(html, kind = '') {
    if (this.queue.some((q) => q.html === html) || this.notes.some((n) => n.html === html)) return;
    this.queue.push({ html, kind }); this.pump();
  }
  pump() {
    while (this.notes.length < 2 && this.queue.length) {
      const q = this.queue.shift();
      const el = document.createElement('div'); el.className = 'note ' + q.kind; el.innerHTML = `<div>${q.html}</div>`;
      $('notices').appendChild(el);
      this.notes.push({ el, html: q.html, t: 2.8 });
    }
  }
  tickNotes(dt) {
    for (const n of this.notes) { n.t -= dt; if (n.t < 0.4) n.el.classList.add('out'); }
    const done = this.notes.filter((n) => n.t <= 0);
    if (done.length) { done.forEach((n) => n.el.remove()); this.notes = this.notes.filter((n) => n.t > 0); this.pump(); }
  }

  // ---- per-frame HUD
  hud(dt, v) {
    const s = this.G.state;
    const seg = (id, frac, low) => { const k = Math.round(frac * 10); this.set(id, id, k, (el) => { el.querySelectorAll('.segs i').forEach((i, n) => i.classList.toggle('on', n < k)); }); if (low !== undefined) $(id).classList.toggle('low', low); };
    seg('r-hp', s.hp / s.maxHp, s.hp / s.maxHp < 0.3); seg('r-food', s.hunger / 100); seg('r-stam', s.stamina / 100);
    this.set('lv', 'lv', 'LV ' + s.level);
    this.set('xp-bar', 'xpb', Math.round(s.xp / xpNeed(s.level) * 100), (el, x) => { el.style.width = x + '%'; });
    const night = s.tod >= NIGHT_AT;
    this.set('clk-ic', 'ci', night, (el, n) => { el.innerHTML = icon(n ? 'moon' : 'sun'); el.style.color = n ? '#9fc4ff' : '#ff9a4a'; });
    const mins = Math.floor(((s.tod * 24 + 6) % 24) * 60);
    this.set('clk-time', 'ct', String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0'));
    this.set('clk-day', 'cd', 'DAY ' + s.day);
    this.set('zone', 'zn', biomeOf(s.zone).name + (C.tierOf(s.zone) ? ' · TIER ' + (C.tierOf(s.zone) + 1) : ''));
    // goal
    const p = C.goalProgress(s);
    const gk = s.goal + ':' + p.cur;
    if (this.cache.gk !== gk) {
      if (this.cache.goalIdx !== s.goal) { const g = $('goal'); g.classList.remove('flash'); void g.offsetWidth; if (this.cache.goalIdx !== undefined) g.classList.add('flash'); this.cache.goalIdx = s.goal; }
      this.cache.gk = gk;
      $('goal-n').textContent = 'GOAL ' + String(s.goal + 1).padStart(2, '0');
      $('goal-cnt').textContent = p.n > 1 ? `${p.cur}/${p.n}` : '';
      $('goal-t').textContent = p.g.text;
      $('goal-bar').style.width = Math.round(p.cur / p.n * 100) + '%';
      const r = p.g.reward;
      $('goal-r').innerHTML = `REWARD  +${r.xp} XP ` + Object.keys(r.res).map((k) => `${r.res[k]} ${RES[k].name}`).join(' · ');
    }
    // hotbar
    const sel = v.sel;
    [...this.hot.children].forEach((d, i) => {
      const slot = SLOTS[i], tier = s.gear[slot];
      const lock = tier === 0 && slot !== 'axe' && slot !== 'pick' && slot !== 'melee';
      const k = `${i}:${i === sel}:${tier}:${lock}`;
      if (this.cache['s' + i] !== k) {
        this.cache['s' + i] = k;
        d.classList.toggle('sel', i === sel); d.classList.toggle('lock', lock);
        d.querySelector('em').textContent = tier ? (slot === 'torch' || slot === 'hammer' ? '' : 'T' + tier) : '';
      }
    });
    this.hot.style.display = v.building ? 'none' : 'flex';
    // crosshair
    const t = v.target;
    const ck = t ? t.kind + t.label + (t.sub || '') + (t.ic || '') : '';
    if (this.cache.ck !== ck) {
      this.cache.ck = ck;
      const c = $('cross'); c.classList.toggle('hot', !!t); c.classList.toggle('foe', !!t && t.kind === 'foe');
      $('cross-ic').innerHTML = t ? icon(t.ic) : '';
      $('cross-lbl').innerHTML = t ? `${esc(t.label)}${t.sub ? `<small>${esc(t.sub)}</small>` : ''}` : '';
    }
    // buttons
    this.set('int-lbl', 'il', v.interact ? v.interact.label : 'USE');
    $('b-interact').classList.toggle('dis', !v.interact);
    this.set('build-lbl', 'bl', v.building ? 'PLACE' : 'BUILD');
    $('b-build').classList.toggle('on', !!v.building);
    this.set('atk-lbl', 'al', v.atkLabel);
    // boss
    const b = v.boss;
    $('boss').classList.toggle('hidden', !b);
    if (b) { this.set('boss-n', 'bn', 'WARLORD RAIDER'); $('boss-bar').style.width = Math.max(0, b.hp / b.max * 100) + '%'; }
    $('hurt').classList.toggle('on', v.hurt > 0.3);
    this.tickNotes(dt);
    this.compass(v);
  }
  compass(v) {
    const c = this.cx, W = this.cv.width, H = this.cv.height;
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(9,15,19,.6)'; c.fillRect(0, 4, W, H - 8);
    c.strokeStyle = 'rgba(190,235,230,.35)'; c.strokeRect(0.5, 4.5, W - 1, H - 9);
    const heading = -v.yaw, norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    c.font = '700 15px "Bahnschrift","Roboto Condensed","Arial Narrow",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let d = 0; d < 360; d += 15) {
      const rel = norm(d * Math.PI / 180 - heading); if (Math.abs(rel) > Math.PI / 2) continue;
      const x = W / 2 + rel / (Math.PI / 2) * (W / 2);
      const L = ['N', 'E', 'S', 'W'][d / 90];
      if (d % 90 === 0) { c.fillStyle = d === 0 ? '#ff6a3d' : '#e2f4f0'; c.fillText(L, x, H / 2 + 1); } else { c.fillStyle = 'rgba(190,235,230,.55)'; c.fillRect(x - 0.5, H / 2 - (d % 45 === 0 ? 5 : 3), 1, d % 45 === 0 ? 10 : 6); }
    }
    const rel = norm(v.cvBearing - heading), edge = Math.abs(rel) > Math.PI / 2;
    const x = W / 2 + Math.max(-1, Math.min(1, rel / (Math.PI / 2))) * (W / 2 - 10);
    c.fillStyle = '#6fe0d0'; c.beginPath(); c.moveTo(x, 6); c.lineTo(x + 7, H / 2); c.lineTo(x, H - 6); c.lineTo(x - 7, H / 2); c.closePath(); c.fill();
    c.fillStyle = '#06201c'; c.font = '700 11px sans-serif'; c.fillText(edge ? (rel > 0 ? '›' : '‹') : '', x, H / 2 + 1);
    c.fillStyle = '#6fe0d0'; c.font = '700 11px "Bahnschrift","Arial Narrow",sans-serif'; c.textAlign = 'left';
    c.fillText(Math.round(v.cvDist) + 'm', Math.min(W - 40, x + 11), 10);
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(W / 2 - 4, 0); c.lineTo(W / 2 + 4, 0); c.lineTo(W / 2, 6); c.fill();
  }

  // ---- build bar
  buildBar(on, st) {
    $('buildbar').classList.toggle('hidden', !on);
    if (!on) return;
    const s = this.G.state, key = JSON.stringify([st.type, st.info, s.level, Object.keys(s.inv).map((k) => s.inv[k])]);
    if (this.cache.bb === key) return;
    this.cache.bb = key;
    $('bb-types').innerHTML = MOD_IDS.map((t) => `<div class="slot ${st.type === t ? 'sel' : ''} ${s.level < MODS[t].unlock ? 'lock' : ''}" data-t="${t}">${icon(t)}</div>`).join('');
    $('bb-types').querySelectorAll('.slot').forEach((d) => d.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.G.pickType(d.dataset.t); }));
    $('bb-info').innerHTML = `<div>${st.info}</div>`;
  }

  // ---- panel
  isOpen() { return this.open || this.modalOpen; }
  openPanel(tab) { this.open = true; if (tab) this.tab = tab; $('panel').classList.remove('hidden'); this.renderPanel(); this.G.onPause(true); }
  closePanel() { this.open = false; $('panel').classList.add('hidden'); this.G.onPause(false); }
  togglePanel() { this.open ? this.closePanel() : this.openPanel(); }
  renderPanel() {
    if (!this.open) return;
    const s = this.G.state, body = $('panel').querySelector('.body'), sc = body ? body.scrollTop : 0;
    const tabs = [['craft', 'CRAFT'], ['build', 'BUILD'], ['caravan', 'CARAVAN'], ['system', 'SYSTEM']];
    let h = `<div class="sheet"><div class="in"><div class="tabs">${tabs.map((t) => `<button class="tab ${this.tab === t[0] ? 'sel' : ''}" data-tab="${t[0]}">${t[1]}</button>`).join('')}<span class="sp"></span><button class="x" data-act="close">${icon('close')}</button></div>`;
    h += `<div class="bag">${RES_IDS.map((r) => `<span style="color:${RES[r].col}">${icon(r)}${s.inv[r]}</span>`).join('')}<span style="color:var(--dim)">CAP ${C.cap(s)}</span></div><div class="body">`;
    if (this.tab === 'craft') h += this.craftTab(s);
    else if (this.tab === 'build') h += this.buildTab(s);
    else if (this.tab === 'caravan') h += this.caravanTab(s);
    else h += this.systemTab(s);
    h += `</div></div></div>`;
    $('panel').innerHTML = h;
    const nb = $('panel').querySelector('.body'); if (nb) nb.scrollTop = sc;
    this.afterRender();
  }
  craftTab(s) {
    return `<div class="grid">${RECIPES.map((r) => {
      const st = C.recipeState(s, r);
      const cls = st.owned ? 'done' : st.locked ? 'lock' : st.afford ? 'ok' : '';
      const stat = r.slot === 'axe' || r.slot === 'pick' ? `POWER ${r.power}` : r.slot === 'torch' ? 'LIGHTS THE NIGHT' : `DAMAGE ${r.power}`;
      return `<button class="card ${cls}" data-craft="${r.id}"><div class="ci"><b>${icon(r.slot)}${r.name}</b><p>${SLOT_NAMES[r.slot]} · tier ${r.tier} · ${stat}</p>${st.owned ? '<span class="tag">OWNED</span>' : st.locked ? '<span class="tag">CRAFT PREVIOUS</span>' : ''}${this.chips(r.cost, s)}</div></button>`;
    }).join('')}</div>`;
  }
  buildTab(s) {
    return `<div class="grid">${MOD_IDS.map((t) => {
      const m = MODS[t], lock = s.level < m.unlock;
      return `<button class="card ${lock ? 'lock' : C.has(s, m.lv[0]) ? 'ok' : ''}" data-build="${t}"><div class="ci"><b>${icon(t)}${m.name}</b><p>${m.desc}</p>${lock ? `<span class="tag">LEVEL ${m.unlock}</span>` : `<span class="tag">${C.modCount(s, t)} BUILT</span>`}${this.chips(m.lv[0], s)}</div></button>`;
    }).join('')}</div><div class="ver">Climb aboard, then pick a module and place it on a glowing slot.</div>`;
  }
  caravanTab(s) {
    const c = C.travelCost(s), nb = biomeOf(s.zone + 1), ok = C.canTravel(s), food = C.foodCount(s);
    let h = `<div class="grid"><button class="card ${ok ? 'go' : ''}" data-act="travel"><div class="ci"><b>${icon('travel')}TRAVEL ON</b><p>Next: ${nb.name}. ${nb.desc} Tougher nights, richer land.</p>
      <span class="chip ${s.inv.wood < c.wood ? 'lack' : ''}" style="color:${s.inv.wood < c.wood ? '' : RES.wood.col}">${icon('wood')}${s.inv.wood}/${c.wood}</span><span class="chip ${food < c.food ? 'lack' : ''}" style="color:${food < c.food ? '' : RES.berries.col}">${icon('food')}${food}/${c.food}</span></div></button>`;
    const bc = C.beastCost(s);
    h += `<button class="card ${C.has(s, bc) ? 'ok' : ''}" data-act="beast"><div class="ci"><b>${icon('beast')}SHELLBACK CARE ${s.beast}</b><p>Feed and polish the beast: +5% module HP each level.</p>${this.chips(bc, s)}</div></button>`;
    for (const k in s.mods) {
      const m = s.mods[k], d = MODS[m.type], max = m.lv >= C.modMaxLv(m.type), up = C.canUpgrade(s, +k), hpMax = C.modHpMax(m.type, m.lv, s);
      h += `<button class="card ${up.ok ? 'ok' : ''}" data-up="${k}"><div class="ci"><b>${icon(m.type)}${d.name} LV ${m.lv}</b><p>HP ${Math.round(m.hp)}/${hpMax}${m.hp <= 0 ? ' · BROKEN' : ''}</p>${max ? '<span class="tag">MAX</span>' : `<span class="tag">UPGRADE</span>${this.chips(up.cost || d.lv[m.lv], s)}`}${m.hp < hpMax ? `<span class="chip" data-rep="${k}" style="color:var(--ember)">TAP BAR TO REPAIR ${icon('wood')}${C.repairCost(m).wood}</span>` : ''}</div></button>`;
    }
    return h + '</div>';
  }
  systemTab(s) {
    const G = this.G;
    return `<div class="center" style="max-width:520px;text-align:left"><div class="slider"><span>LOOK SENSITIVITY</span><input type="range" id="sens" min="40" max="220" value="${Math.round(G.player.sens * 100)}"></div>
    <div class="slider"><span>GRAPHICS</span>${['auto', 'high', 'low'].map((q) => `<button class="btnbig ${G.qualityMode === q ? '' : 'ghost'}" data-q="${q}" style="padding:8px 14px">${q}</button>`).join('')}</div>
    <div class="slider"><span>SOUND</span><button class="btnbig ${G.muted ? 'ghost' : ''}" data-act="mute" style="padding:8px 14px">${G.muted ? 'OFF' : 'ON'}</button><button class="btnbig ghost" data-act="save" style="padding:8px 14px">SAVE NOW</button></div>
    <div style="text-align:center;margin-top:10px"><button class="btnbig" data-act="close">RESUME</button></div><div class="ver" style="text-align:center">HEARTHCRAWLER v${VERSION} · NIGHTS SURVIVED ${s.stats.nights} · KILLS ${s.stats.kills}</div></div>`;
  }
  panelClick(e) {
    const G = this.G, t = e.target;
    const rep = t.closest('[data-rep]'); if (rep) { e.stopPropagation(); G.repair(+rep.dataset.rep); return this.renderPanel(); }
    const el = t.closest('[data-tab],[data-craft],[data-build],[data-act],[data-up],[data-q]');
    if (!el) return;
    const d = el.dataset;
    if (d.tab) { this.tab = d.tab; G.sfx('click'); }
    else if (d.craft) G.craft(d.craft);
    else if (d.build) { if (G.startBuild(d.build)) return; }
    else if (d.up) G.upgrade(+d.up);
    else if (d.q) G.setQuality(d.q);
    else if (d.act === 'close') return this.closePanel();
    else if (d.act === 'travel') { if (G.travel()) return this.closePanel(); }
    else if (d.act === 'beast') G.upgradeBeast();
    else if (d.act === 'mute') G.toggleMute();
    else if (d.act === 'save') { G.saveNow(); this.notify('SAVED'); }
    this.renderPanel();
    const sens = $('sens'); if (sens) sens.oninput = () => { G.player.sens = sens.value / 100; };
  }
  afterRender() { const sens = $('sens'); if (sens) sens.oninput = () => { this.G.player.sens = sens.value / 100; }; }

  // ---- modals
  showModal(html, onClose) {
    if (this.modalOpen) { (this.mq = this.mq || []).push([html, onClose]); return; }
    this.modalOpen = true; this.modalCb = onClose;
    const m = $('modal'); m.innerHTML = `<div class="sheet center pop-in" style="height:auto;max-height:none;max-width:460px"><div class="in" style="position:relative;inset:auto"><div class="card-big">${html}</div></div></div>`;
    m.classList.remove('hidden'); this.G.onPause(true);
  }
  closeModal(v) { this.modalOpen = false; $('modal').classList.add('hidden'); const cb = this.modalCb; this.modalCb = null; this.G.onPause(this.open); cb && cb(v); if (this.mq && this.mq.length) { const n = this.mq.shift(); this.showModal(n[0], n[1]); } }
  welcome(res, cb) {
    this.showModal(`<h2>WELCOME TO HEARTHCRAWLER 2.0</h2><p>A gift for our returning traveller. The Shellback has been rebuilt as a living caravan, and the world is now in 3D.</p><div class="rew">${this.resChips(res)}<span class="chip" style="color:var(--ice)">${icon('axe')}STONE TOOLSET</span></div><button class="btnbig" data-m="ok">ACCEPT GIFT</button>`, cb);
  }
  levelUp(level, res) { this.showModal(`<h2 class="em">LEVEL UP!</h2><div style="font-size:46px;color:var(--ember);font-weight:700;line-height:1">${level}</div><p>Stronger hits, faster gathering, full health.</p><div class="rew">${this.resChips(res)}</div><button class="btnbig em" data-m="ok">NICE</button>`); }
  chest(title, res, sub) { this.showModal(`<div style="font-size:44px;color:var(--ember)">${icon('chest')}</div><h2>${esc(title)}</h2><p>${esc(sub || '')}</p><div class="rew">${this.resChips(res)}</div><button class="btnbig" data-m="ok">OPEN</button>`); }
}
