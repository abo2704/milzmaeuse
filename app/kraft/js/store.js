// Speichert alles lokal im Browser (localStorage). Backup per Export im Reiter "Mehr".
import { SEED_EXERCISES, SEED_TEMPLATES } from './exercises.js';

const KEY = 'kraftkladde-v1';
export const db = { data: null };

const defaults = () => ({ name: 'André', rest: 90, sound: true, vibrate: true, wakeLock: true });

function fresh() {
  return {
    schema: 1,
    exercises: structuredClone(SEED_EXERCISES),
    templates: structuredClone(SEED_TEMPLATES),
    workouts: [],
    settings: defaults(),
    active: null,
    lastBackup: null,
    removedSeeds: [],
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
  d.settings = { ...defaults(), ...d.settings };
  // Neue Start-Übungen aus späteren Versionen nachziehen (gelöschte bleiben weg)
  const have = new Set(d.exercises.map(e => e.id));
  for (const e of SEED_EXERCISES) if (!have.has(e.id) && !d.removedSeeds.includes(e.id)) d.exercises.push(structuredClone(e));
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
