# Hearthcrawler 2.0

A first-person 3D survival base-builder for phones. Your base is a **Shellback**: a huge, gentle, mossy tortoise that carries a
wooden deck-house on its back. Gather, craft, build modules on the deck, hold the deck at night, then tell the beast to walk on to
a new biome.

Plain ES modules, [three.js](https://threejs.org) r187 vendored in `vendor/`, no build step, no CDN, no network at runtime.
Dusk-lit low-poly look: flat-shaded vertex-coloured geometry, a gradient sky dome with sun, moon, stars and clouds, fog that matches
the horizon, and golden-hour sunsets.

## How to play

- **Loop:** chop trees (wood), break boulders (stone), mine ore veins and glow crystals, smash scrap piles, pick fiber bushes
  (fiber and berries). Nodes shake, spit chunks, show `+3 wood` popups, fall, and respawn later.
- **Craft** tiered tools and weapons from the menu: hatchet, pickaxe, club/spear, crossbow, torch. Metal needs a furnace.
- **Build** on the ten snap slots of the deck: palisade, lantern, bed, turret, storage, garden, furnace. Each has levels that change
  its look. Press BUILD, look at a glowing slot (or use the arrows), pick a module, press PLACE. Placing the same type on a built
  slot upgrades it.
- **Nights** (4 min day, 2 min night) bring Gloomlings, Mask Raiders and Tusk Boars (no gore: a white flash, then a poof of sparkles).
  Raiders climb the ramp and attack modules; turrets and palisades defend. Every third night a **Warlord Raider** brings a big chest.
  Broken modules are repaired with wood and never lose levels. Dying costs ~10% of one stack and you respawn on the bed or deck.
- **Travel:** at the helm (or the CARAVAN tab) spend wood and food to walk on:
  Mossy Meadow, Amber Autumn Forest, Frost Tundra, Red Canyon Badlands, Glowshroom Marsh, then it loops with +tier difficulty.
  Each arrival gives a chest. Crystals only grow from the third biome on.
- **Progress:** the goal tracker (top left) always shows the next goal and its reward. XP and levels, a "level up" moment, first-night
  reward, and the repeatable *Shellback Care* upgrade track keep a new upgrade a couple of minutes away.

## Controls

| | Touch (landscape) | Desktop |
|---|---|---|
| Move | floating joystick, left half | WASD / arrows, Shift = sprint |
| Look | drag right half | mouse (click to lock pointer) |
| Gather / attack | big ATTACK button (hold) | click |
| Jump | JUMP | Space |
| Interact | context button (CLIMB, TRAVEL, SLEEP, FURNACE...) | E |
| Build | BUILD (then PLACE) | B, Q/R change slot |
| Hotbar | tap a slot | 1-6 |
| Menu | top-right button | Tab / M |

Portrait shows a "Rotate your phone" overlay and pauses the game. Tapping the food bar eats.

## Tech

```
index.html, css/hud.css      dark chamfered survival HUD (inline SVG glyphs, condensed uppercase type)
src/data.js, core.js         pure rules: items, modules, biomes, goals, waves, xp, crafting, save sanitising (no DOM / three)
src/terrain.js               pure terrain height + deterministic resource-node generation per 48 m chunk
src/geo.js, models.js        low-poly geometry builder + every procedural model (nodes, foes, beast, modules, tools)
src/sky.js                   sky dome shader, fog, hemisphere + one sun/moon light with a small following shadow map, motes
src/world.js                 5x5 streamed chunks, InstancedMesh nodes / grass / flowers (vertex-shader wind sway)
src/caravan.js               the beast (animated legs, swaying deck), modules, build ghost and slot rings
src/player.js, input.js      first-person physics, multitouch joystick + look, keyboard / mouse
src/viewmodel.js             held tool in its own scene (depth cleared), bob / swing / swap
src/enemies.js, fx.js        pooled foes + turrets, pooled chunky particles, floating popups
src/ui.js, icons.js, audio.js, save.js, main.js
sw.js, manifest.webmanifest, icons/
```

- Performance: pixel ratio capped at 1.5 (drops to 1.0 and disables shadows automatically if frames are slow; `?q=high|low` locks it),
  fog-limited view (~70-90 m, far plane 125), instanced trees/rocks/grass, pooled particles and foes, one `PointLight` (the torch),
  about 70 draw calls with a full deck. `?debug=1` shows FPS and draw calls.
- Save: `localStorage['hearthcrawler-save-v2']`, autosave every ~10 s and on `visibilitychange`. A corrupt save falls back to a fresh
  game. If `hearthcrawler-save-v1` exists the old save is never parsed: a Welcome card grants a starter bundle (resources + stone
  toolset) once.
- Service worker: cache `hearthcrawler-v2.0.1` (`VERSION` at the top of `sw.js`; bump it every release). Network-first for HTML,
  stale-while-revalidate for js/css/vendor/icons, old `hearthcrawler-` caches deleted on activate, the page reloads once when a
  new worker takes control.
- Test hooks: `window.__HC = { version, state, runtime, step(dt, n), giveAll(), setTime(0..1), spawnNight(), travel(), teleport(x, z), look(yaw, pitch), ... }`.

## Testing

```
node test/balance.mjs     # headless ~60 min progression sim on the real rules
node test/play.mjs        # headless Chrome, phone landscape, real CDP touch events, writes test/shots/*.png
node tools/make-icons.mjs # regenerates the PWA icons
```

`balance.mjs` asserts no gap over 4 minutes between unlocks/upgrades, the player is never stuck, every night is survivable,
bosses arrive on schedule and biomes get reached. `play.mjs` needs `playwright-core` from `/workspace/projects/yt-shorts/node_modules`
and `/usr/bin/google-chrome`; it fails on any console error, page error or failed request.
