// Import aus Gym Run (CSV-Export, ";"-getrennt).
// Spalten u. a.: Date (TT.MM.JJJJ), Time, Routine, Exercise, Set, Weight, Reps, Duration (Min.), Distance (km), Type
// Spalte "Book" (nicht "Type"!): 1 = Gewicht × Wdh., 6 = Körpergewicht × Wdh., 3 = Zeit/Strecke
import { norm } from './util.js';

const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const dec = v => { if (v == null || String(v).trim() === '') return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

function guessGroup(name) {
  const n = norm(name);
  const rules = [
    [/klimmz|latzug|latzieh/, 'Ziehen vertikal'],
    [/rudern|row/, 'Ziehen horizontal'],
    [/schulterdr|military|uberkopf|overhead/, 'Drücken vertikal'],
    [/bankdr|liegest|push/, 'Drücken horizontal'],
    [/kniebeug|squat|beinpresse|ausfall|lunge|split/, 'Kniedominant'],
    [/kreuzheb|deadlift|swing|hip|glute|bridge/, 'Hüftdominant'],
    [/curl|trizeps|seitheb|bizeps/, 'Arme & Schultern'],
    [/carry|burpee|snatch|ski|wall ball|schlitten/, 'Ganzkörper & Hybrid'],
    [/fuss|fuß|sprung|wade/, 'Fuß & Reha'],
    [/plank|stutz|kafer|bug|crunch|core|around/, 'Core'],
  ];
  return rules.find(([re]) => re.test(n))?.[1] || 'Ganzkörper & Hybrid';
}
function guessEquip(name, type) {
  const n = norm(name);
  if (type === 6) return 'kg';
  if (/klimmz/.test(n)) return 'kg';
  if (/kurzhantel|\bkh\b/.test(n)) return 'kh';
  if (/kettlebell|\bkb\b/.test(n)) return 'kb';
  if (/langhantel|military/.test(n)) return 'lh';
  if (/gerat|seilzug|kabel|maschine|presse/.test(n)) return 'ma';
  return 'sonst';
}
const fieldsFor = type => type === 6 ? ['r'] : type === 3 ? ['t', 'd'] : ['w', 'r'];

export function findExercise(name, exercises) {
  const n = norm(name);
  return exercises.find(e => !e.archived && (norm(e.name) === n || (e.aliases || []).some(a => norm(a) === n)));
}

export function parseGymRun(text, D) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  const head = lines.shift().split(';').map(h => h.trim());
  const col = name => head.indexOf(name);
  const C = { date: col('Date'), time: col('Time'), routine: col('Routine'), ex: col('Exercise'), set: col('Set'), w: col('Weight'), r: col('Reps'), dur: col('Duration'), dist: col('Distance'), type: col('Book') >= 0 ? col('Book') : col('Type'), note: col('Note') };
  if (C.date < 0 || C.ex < 0) throw new Error('Kein Gym-Run-Format');

  const sessions = new Map();
  const exStats = new Map();
  for (const line of lines) {
    const c = line.split(';');
    const [dd, mm, yy] = (c[C.date] || '').split('.').map(Number);
    if (!dd || !mm || !yy) continue;
    const [h = 0, mi = 0, s = 0] = (c[C.time] || '').split(':').map(Number);
    const ts = new Date(yy, mm - 1, dd, h, mi, s).getTime();
    const routine = (c[C.routine] || 'Training').trim();
    const name = (c[C.ex] || '').trim();
    if (!name) continue;
    const type = Number(c[C.type]) || 1;
    const row = { ts, w: dec(c[C.w]), r: dec(c[C.r]), dur: dec(c[C.dur]), dist: dec(c[C.dist]), type, note: C.note >= 0 ? (c[C.note] || '').trim() : '' };
    const key = `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}|${routine}`;
    if (!sessions.has(key)) sessions.set(key, { key, routine, day: key.split('|')[0], rows: [] });
    sessions.get(key).rows.push({ ...row, name });
    if (!exStats.has(name)) exStats.set(name, { name, sets: 0, type, hasWeight: false, sample: null });
    const st = exStats.get(name);
    st.sets++;
    if (row.w != null) { st.hasWeight = true; st.sample ??= row.w; }
  }

  const out = [...sessions.values()].map(s => {
    s.rows.sort((a, b) => a.ts - b.ts);
    s.start = s.rows[0].ts;
    s.last = s.rows.at(-1).ts;
    // Übungen in Reihenfolge des ersten Auftretens
    const order = [];
    for (const r of s.rows) if (!order.includes(r.name)) order.push(r.name);
    s.entries = order.map(n => ({ name: n, rows: s.rows.filter(r => r.name === n) }));
    // Supersätze erkennen: zwei benachbarte Übungen, deren Sätze sich zeitlich abwechseln
    s.groups = new Array(s.entries.length).fill(null);
    for (let i = 0; i < s.entries.length - 1; i++) {
      const a = s.entries[i], b = s.entries[i + 1];
      const merged = [...a.rows.map(r => ({ ts: r.ts, x: 0 })), ...b.rows.map(r => ({ ts: r.ts, x: 1 }))].sort((p, q) => p.ts - q.ts);
      let changes = 0;
      for (let k = 1; k < merged.length; k++) if (merged[k].x !== merged[k - 1].x) changes++;
      const need = 2 * Math.min(a.rows.length, b.rows.length) - 2;
      if (Math.min(a.rows.length, b.rows.length) >= 2 && changes >= need) {
        const g = s.groups[i] || `ss-${i}`;
        s.groups[i] = g; s.groups[i + 1] = g;
      }
    }
    return s;
  }).sort((a, b) => a.start - b.start);

  const exercises = [...exStats.values()].map(x => {
    const tgt = findExercise(x.name, D.exercises);
    return {
      ...x,
      target: tgt?.id || null,
      group: tgt?.group || guessGroup(x.name),
      halve: !!tgt?.importHalve,
      bw: !!tgt?.importBodyweight || /klimmz/.test(norm(x.name)),
    };
  });
  return { sessions: out, exercises };
}

export function buildImport(parsed, D, bodyweight) {
  const byName = new Map(parsed.exercises.map(x => [x.name, x]));
  const newExercises = [];
  const exId = x => {
    if (x.target) return x.target;
    const id = 'gr-' + slug(x.name);
    if (!D.exercises.some(e => e.id === id) && !newExercises.some(e => e.id === id)) {
      const equip = x.bw ? 'kg' : guessEquip(x.name, x.type);
      newExercises.push({ id, name: x.name, group: x.group, equip, fields: x.bw ? ['w', 'r'] : fieldsFor(x.type), perSide: false, note: '', rest: null, aliases: [x.name] });
    }
    return id;
  };
  const conv = (x, row) => {
    const s = { warm: false };
    if (row.type === 3) {
      if (row.dur != null) s.t = Math.round(row.dur * 60);
      if (row.dist != null) s.d = Math.round(row.dist * 1000);
      return s;
    }
    let w = row.w;
    if (w != null && x.bw) { w = w - bodyweight; w = w <= 1 ? null : Math.round(w * 2) / 2; }
    if (w != null && x.halve) w = Math.round(w / 2 * 4) / 4;
    if (w != null) s.w = w;
    if (row.r != null) s.r = row.r;
    return s;
  };

  let dupes = 0;
  const newWorkouts = [];
  for (const s of parsed.sessions) {
    const id = 'gr-' + s.day + '-' + slug(s.routine);
    if (D.workouts.some(w => w.id === id)) { dupes++; continue; }
    const span = s.last - s.start + 3 * 60000;
    const end = s.start + (span > 150 * 60000 ? 60 * 60000 : Math.max(span, 20 * 60000));
    newWorkouts.push({
      id, name: s.routine, kind: 'kraft', location: 'studio', start: s.start, end, templateId: null, imported: 'gymrun',
      entries: s.entries.map((e, i) => {
        const x = byName.get(e.name);
        const type = e.rows[0].type;
        const fields = type === 3 ? ['t', 'd'] : x.bw ? ['w', 'r'] : fieldsFor(type);
        const note = [...new Set(e.rows.map(r => r.note).filter(Boolean))].join(' · ');
        return { exId: exId(x), fields, note, group: s.groups[i] ? `${id}-${s.groups[i]}` : null, slot: '', sets: e.rows.map(r => conv(x, r)) };
      }),
    });
  }
  return { newWorkouts, newExercises, dupes };
}
