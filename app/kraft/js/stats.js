// Kennzahlen, Rekorde und Verlauf je Übung.
import { fmtKg, fmtTime, fmtDist, fmtNum } from './util.js';

// val(set) liefert den Wert eines Satzes oder null, wenn die Kennzahl für diesen Satz nicht passt.
export const METRICS = [
  { key: 'e1rm', label: 'Geschätztes Maximalgewicht (1RM)', short: '1RM (geschätzt)', better: 'max', kind: 'kg1',
    val: s => s.w > 0 && s.r > 0 ? (s.r === 1 ? s.w : s.w * (1 + s.r / 30)) : null },
  { key: 'w', label: 'Höchstes Gewicht', short: 'Gewicht', better: 'max', kind: 'kg', val: s => s.w > 0 ? s.w : null },
  { key: 'r', label: 'Meiste Wiederholungen', short: 'Wdh.', better: 'max', kind: 'reps', val: s => s.r > 0 && !(s.w > 0) ? s.r : null },
  { key: 'd', label: 'Weiteste Strecke', short: 'Strecke', better: 'max', kind: 'dist', val: s => s.d > 0 ? s.d : null },
  { key: 't', label: 'Längste Zeit', short: 'Zeit', better: 'max', kind: 'time', val: s => s.t > 0 && !(s.d > 0) ? s.t : null },
  { key: 'pace', label: 'Bestes Tempo', short: 'Tempo', better: 'min', kind: 'pace', val: s => s.t > 0 && s.d > 0 ? s.t / s.d * 1000 : null },
  { key: 'vol', label: 'Volumen pro Training (kg × Wdh.)', short: 'Volumen', better: 'max', kind: 'vol', session: true,
    val: s => s.w > 0 && s.r > 0 ? s.w * s.r : null },
];
export const metricByKey = k => METRICS.find(m => m.key === k);

export function fmtMetric(kind, v) {
  switch (kind) {
    case 'kg': return fmtKg(v);
    case 'kg1': return fmtNum(v, 1) + ' kg';
    case 'reps': return fmtNum(v, 0) + ' Wdh.';
    case 'dist': return fmtDist(v);
    case 'time': return fmtTime(v);
    case 'pace': return fmtTime(v) + ' /km';
    case 'vol': return fmtNum(v, 0) + ' kg';
  }
  return fmtNum(v);
}

export const isBetter = (m, a, b) => m.better === 'max' ? a > b : a < b;

export function sessionValue(m, sets) {
  let best = null, sum = 0, any = false;
  for (const s of sets) {
    if (s.warm) continue;
    const v = m.val(s);
    if (v == null) continue;
    any = true;
    if (m.session) sum += v;
    else if (best == null || isBetter(m, v, best)) best = v;
  }
  return !any ? null : m.session ? sum : best;
}

const setsOf = (w, exId) => w.entries.filter(e => e.exId === exId).flatMap(e => e.sets);

export function exerciseSeries(workouts, exId, m) {
  const out = [];
  for (const w of workouts) {
    const sets = setsOf(w, exId);
    if (!sets.length) continue;
    const v = sessionValue(m, sets);
    if (v != null) out.push({ x: w.start, y: v, wid: w.id });
  }
  return out;
}

export function bestOf(workouts, exId, m, excludeId) {
  let b = null;
  for (const w of workouts) {
    if (w.id === excludeId) continue;
    const v = sessionValue(m, setsOf(w, exId));
    if (v != null && (b == null || isBetter(m, v, b))) b = v;
  }
  return b;
}

// Alle Rekorde chronologisch: Wann wurde eine Bestmarke übertroffen? (Das allererste Mal zählt nicht.)
export function computeRecords(workouts) {
  const best = {}, recs = [];
  for (const w of workouts) {
    for (const exId of new Set(w.entries.map(e => e.exId))) {
      const sets = setsOf(w, exId);
      for (const m of METRICS) {
        if (m.session) continue;
        const v = sessionValue(m, sets);
        if (v == null) continue;
        const k = exId + '|' + m.key;
        if (k in best) {
          if (isBetter(m, v, best[k])) { recs.push({ wid: w.id, date: w.start, exId, m, v, prev: best[k] }); best[k] = v; }
        } else best[k] = v;
      }
    }
  }
  return recs;
}

export function workoutStats(w) {
  let sets = 0, vol = 0;
  for (const e of w.entries) for (const s of e.sets) {
    if (!s.warm) sets++;
    if (s.w > 0 && s.r > 0) vol += s.w * s.r;
  }
  return { sets, vol, mins: Math.max(1, Math.round((w.end - w.start) / 60000)), exercises: w.entries.length };
}
