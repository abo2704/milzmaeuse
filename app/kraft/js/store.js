// Speichert alles lokal im Browser (localStorage). Backup per Export im Reiter "Mehr".
import { SEED_EXERCISES, SEED_TEMPLATES } from './exercises.js';

const KEY = 'kraftkladde-v2';
export const db = { data: null };

const defaults = () => ({ name: 'André', rest: 90, weeklyGoal: 2, sound: true, vibrate: true, wakeLock: true, bodyweight: 72, location: 'studio' });

function fresh() {
  return {
    schema: 2,
    exercises: structuredClone(SEED_EXERCISES),
    templates: structuredClone(SEED_TEMPLATES),
    workouts: [],
    settings: defaults(),
    active: null,
    lastBackup: null,
    removedSeeds: [],
    removedSeedTpls: [],
    estimates: [],
  };
}

export function isValid(d) {
  return d && Array.isArray(d.exercises) && Array.isArray(d.workouts) && Array.isArray(d.templates);
}

export function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch { /* kaputt → neu */ }
  if (!isValid(d)) d = fresh();
  d.removedSeeds ||= [];
  d.removedSeedTpls ||= [];
  d.estimates ||= [];
  d.settings = { ...defaults(), ...d.settings };
  // Neue Start-Übungen aus späteren Versionen nachziehen (gelöschte bleiben weg)
  const have = new Set(d.exercises.map(e => e.id));
  for (const e of SEED_EXERCISES) if (!have.has(e.id) && !d.removedSeeds.includes(e.id)) d.exercises.push(structuredClone(e));
  // Neue Start-Routinen ebenfalls nachziehen (gelöschte bleiben weg)
  const haveT = new Set(d.templates.map(t => t.id));
  for (const t of SEED_TEMPLATES) {
    const i = d.templates.findIndex(x => x.id === t.id);
    if (i < 0) { if (!d.removedSeedTpls.includes(t.id)) d.templates.push(structuredClone(t)); }
    else if (!d.templates[i].edited && (d.templates[i].v || 1) < (t.v || 1)) d.templates[i] = structuredClone(t); // unveränderte Start-Routine aktualisieren
  }
  for (const e of d.exercises) {
    const s = SEED_EXERCISES.find(x => x.id === e.id);
    if (s) {
      e.aliases = s.aliases; e.importHalve = s.importHalve; e.importBodyweight = s.importBodyweight;
      if (!e.edited) { e.name = s.name; e.note = s.note; if (e.bar == null && s.bar) e.bar = s.bar; } // nicht selbst bearbeitete Start-Übungen aktuell halten
    }
    e.equip ||= 'sonst';
  }
  d.workouts.sort((a, b) => a.start - b.start);
  db.data = d;
  return d;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db.data)); return true; }
  catch (e) { console.error(e); return false; }
}

export function replaceAll(d) {
  localStorage.setItem(KEY, JSON.stringify(d));
  return load();
}

export function resetAll() {
  localStorage.removeItem(KEY);
  return load();
}
