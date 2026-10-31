# Hearthcrawler

A cozy, non-gory mobile survival base-builder where your base is a **moving caravan** pulled by a mechanical ox.
Gather → craft → build → defend → travel. Vanilla HTML/CSS/JS, canvas art drawn in code, no build step, works offline (PWA).

Play: https://mati-sme.github.io/hearthcrawler/

## How to play
- **Move:** touch the lower part of the screen and drag — an invisible floating joystick appears under your finger (desktop: WASD / arrows).
- **Gather:** walk next to trees, rocks, scrap piles and berry bushes — you auto-gather with your equipped tool.
- **Fight:** enemies near you are auto-attacked with your weapon. Defeated mobs "poof" into sparkles and drop loot.
- **Action button (bottom-right):** contextual — Dodge roll, Enter caravan, Bomb, or Repair.
- **Goal card (top):** always shows your next goal, progress, reward and a hint. A yellow arrow points the way. ~110 goals (gather, craft, build, raid nights, chests, hot meals, revisit trips, bosses), then endless goals.
- **Side buttons:** 🛠 Craft, 🏠 Caravan (build modules), 🗺 Map (travel), 🎒 Gear (equip, garage, trophies), ⚙️ Menu.
- Tap the heart / drumstick to heal / eat manually. Hunger auto-eats below 50%.

## Features
- Resources: wood, stone, scrap, food, metal, fuel; carry bag auto-deposits at the caravan.
- Crafting tiers 0–3 (axes, picks, spear, bow, crossbow, blaster, bombs, armor, medkits…) gated by Workbench / Furnace levels and blueprints.
- Caravan modules on a grid (2×2 → 3×4): Storage, Workbench, Bed, Furnace, Turret, Armor Plating, Engine, Garden, Lantern — levels 1–5.
- Day/night cycle (2 min day, 1 min night) with raiders, howlers and more; a damaged caravan just works at half power until repaired.
- World map: Meadow → Pine Forest → Rocky Badlands → Scrap Wastes → Frost Peaks → Ember Volcano → endless Far Roads. Animated travel with roadside events.
- 3 bosses with telegraphed attacks: Big Boar King, Raider Warlord (war-wagon), Ember Golem.
- XP, levels with 1-of-3 perks, achievements with stars, caravan paints and flags, lucky crates, treasure chests, combos.
- Goal-complete and level-up notices are small, queued, non-blocking toasts; an edge icon with distance always points back to the caravan; modules can be removed (60% refund) so a full chassis never blocks a goal.
- Never stuck: nodes respawn, death only costs 20% of carried items, gentle cost curves, hints for missing resources.
- Autosave to localStorage (`hearthcrawler-save-v1`), service worker for offline play.

## Development
- Run any static server in this folder (e.g. `python3 -m http.server`) and open `index.html`.
- Test: `node test/play.mjs` (Playwright + system Chrome; set `PW_PATH` to a playwright-core install). Screenshots land in `test/shots/`.
- Balance / anti-stall sim: `node test/balance.mjs` — an auto-play bot (`test/bot.js`) plays from a fresh save with no cheats for 150 in-game minutes, logs every goal and level-up, and asserts: bosses fall at ~30 / ~60 / ~105 min (windows 25–35 / 55–75 / 100–130, ±10), first 5 goals within ~3 min, longest gap between goals < 4 min, mid-game level-up cadence 2.5–6.5 min, Far Roads reached, zero console errors. Pacing knobs live in `HC.PACE` (js/data.js). Boss lairs stay quiet until their goal is active. Writes `08-boss.png` and `09-far-roads.png`. Env: `BAL_MINUTES`, `BAL_VERBOSE=1`.
- Icons: `python3 tools/make_icons.py`.
- Test hooks: `window.__HC` = `{ state, step(n), giveAll(n), setTime(t), questIndex(), version }`.
