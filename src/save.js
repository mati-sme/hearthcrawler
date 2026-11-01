// localStorage persistence (v2 key). Corrupt data never crashes: falls back to a fresh game.
import { SAVE_KEY, OLD_KEY, MIGRATED_KEY } from './data.js';
import { newState, sanitize, serialize } from './core.js';

export function load() {
  let raw = null, fresh = true;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { raw = null; }
  let s = newState(), extra = null;
  if (raw) {
    try { const j = JSON.parse(raw); s = sanitize(j); fresh = false; extra = j && j.pl && typeof j.pl === 'object' ? j.pl : null; } catch (e) { s = newState(); fresh = true; }
  }
  // returning v1 traveller: never parse the old save, just greet them once
  let gift = false;
  try { gift = fresh && localStorage.getItem(OLD_KEY) !== null && localStorage.getItem(MIGRATED_KEY) === null; } catch (e) { gift = false; }
  return { state: s, fresh, gift, pl: extra };
}
export function markMigrated() { try { localStorage.setItem(MIGRATED_KEY, '1'); } catch (e) { /* ignore */ } }
export function save(state, pl) {
  try { const o = serialize(state); o.pl = pl; localStorage.setItem(SAVE_KEY, JSON.stringify(o)); return true; } catch (e) { return false; }
}
