// Fortschritt-Seite: Konstanz, Kraftindex, größte Steigerungen, Bewegungsmuster-Balance, Muskelkarte.
// Alle Grafiken sind schlichte SVGs; Marken mit data-tip bekommen beim Antippen einen Tooltip.
import { GROUPS, KINDS, MUSCLES, musclesOf } from './exercises.js';
import { METRICS, metricByKey, exerciseSeries, fmtMetric, isBetter } from './stats.js';
import { esc, fmtNum, fmtShort, weekStart, dayKey } from './util.js';

export const RANGES = { w4: '4 Wochen', m3: '3 Monate', m12: '12 Monate', all: 'Alles' };
const DAY = 86400000;
const KIND_KEYS = ['kraft', 'hybrid', 'lauf'];

export function rangeStart(range, workouts) {
  const now = new Date();
  if (range === 'w4') { const d = weekStart(now); d.setDate(d.getDate() - 3 * 7); return d.getTime(); }
  if (range === 'm3') { const d = weekStart(now); d.setDate(d.getDate() - 12 * 7); return d.getTime(); }
  if (range === 'm12') return new Date(now.getFullYear(), now.getMonth() - 11, 1).getTime();
  const first = workouts[0]?.start ?? now.getTime();
  const d = new Date(first); return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

const strengthWorkouts = (ws, from) => ws.filter(w => w.start >= from && w.entries?.length && (w.kind || 'kraft') !== 'lauf');

// ---------- Kennzahlen ----------
export function summary(ws, estimates, from, goal) {
  const inRange = ws.filter(w => w.start >= from);
  const sk = inRange.filter(w => (w.kind || 'kraft') !== 'lauf');
  const weeks = Math.max(1, Math.round((weekStart(Date.now()).getTime() - weekStart(from).getTime()) / (7 * DAY)) + 1);
  const perWeek = {};
  for (const w of sk) { const k = weekStart(w.start).getTime(); perWeek[k] = (perWeek[k] || 0) + 1; }
  const goalWeeks = Object.values(perWeek).filter(n => n >= goal).length;
  const est = estimates.filter(e => new Date(e.month + '-01').getTime() >= from).reduce((a, e) => a + e.count, 0);
  return { trainings: sk.length + est, runs: inRange.length - sk.length, perWeek: (sk.length + est) / weeks, goalWeeks, weeks, est };
}

// Trainings pro Woche (bis 3 Monate) bzw. pro Monat, gestapelt nach Art
export function buckets(ws, estimates, from, range) {
  const monthly = range === 'm12' || range === 'all';
  const out = [];
  const now = Date.now();
  if (monthly) {
    const d = new Date(from);
    while (d.getTime() <= now) {
      const key = dayKey(d).slice(0, 7);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const items = ws.filter(w => w.start >= d.getTime() && w.start < next.getTime());
      const est = estimates.find(e => e.month === key)?.count || 0;
      out.push({ label: d.toLocaleDateString('de-DE', { month: 'short' }).replace('.', ''), long: d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
        counts: Object.fromEntries(KIND_KEYS.map(k => [k, items.filter(w => (w.kind || 'kraft') === k).length])), est });
      d.setMonth(d.getMonth() + 1);
    }
  } else {
    const d = new Date(from);
    while (d.getTime() <= now) {
      const next = new Date(d); next.setDate(d.getDate() + 7);
      const items = ws.filter(w => w.start >= d.getTime() && w.start < next.getTime());
      out.push({ label: fmtShort(d), long: 'Woche ab ' + fmtShort(d),
        counts: Object.fromEntries(KIND_KEYS.map(k => [k, items.filter(w => (w.kind || 'kraft') === k).length])), est: 0 });
      d.setDate(d.getDate() + 7);
    }
  }
  return { list: out, monthly };
}

// Hauptkennzahl je Übung: 1RM, sonst Wdh., Gewicht, Strecke, Zeit
function primaryMetric(ws, exId, allowed) {
  for (const k of ['e1rm', 'r', 'w', 'd', 't', 'b']) {
    const m = metricByKey(k);
    if (allowed(exId, m) && exerciseSeries(ws, exId, m).length) return m;
  }
  return null;
}

// Kraftindex: Durchschnitt aller Übungen relativ zu ihrem ersten Wert im Zeitraum
export function strengthIndex(ws, from, allowed) {
  const sw = strengthWorkouts(ws, from);
  const ids = [...new Set(sw.flatMap(w => w.entries.map(e => e.exId)))];
  const series = [];
  for (const id of ids) {
    const m = primaryMetric(sw, id, allowed);
    if (!m || m.better !== 'max') continue;
    const s = exerciseSeries(sw, id, m);
    if (s.length >= 2) series.push({ id, m, s });
  }
  if (!series.length) return { points: [], count: 0 };
  const latest = {};
  const dates = [...new Set(series.flatMap(x => x.s.map(p => p.x)))].sort((a, b) => a - b);
  const points = [];
  for (const x of dates) {
    for (const sr of series) {
      const p = sr.s.find(q => q.x === x);
      if (p) latest[sr.id] = Math.max(latest[sr.id] ?? 0, p.y / sr.s[0].y); // Bestwert bis hierhin
    }
    const vals = Object.values(latest);
    points.push({ x, y: (vals.reduce((a, b) => a + b, 0) / vals.length - 1) * 100, n: vals.length });
  }
  return { points, count: series.length };
}

export function topGains(ws, from, allowed, nameOf) {
  const sw = strengthWorkouts(ws, from);
  const ids = [...new Set(sw.flatMap(w => w.entries.map(e => e.exId)))];
  const out = [];
  for (const id of ids) {
    const m = primaryMetric(sw, id, allowed);
    if (!m) continue;
    const s = exerciseSeries(sw, id, m);
    if (s.length < 2) continue;
    const first = s[0].y;
    const best = s.slice(1).reduce((a, p) => isBetter(m, p.y, a) ? p.y : a, s[1].y);
    const gain = m.better === 'max' ? best / first - 1 : first / best - 1;
    if (gain > 0.001) out.push({ id, name: nameOf(id), m, first, best, gain, sessions: s.length });
  }
  return out.sort((a, b) => b.gain - a.gain).slice(0, 6);
}

// Sätze je Bewegungsmuster und je Muskel (Hauptmuskel 1, Hilfsmuskel 0,5)
export function setLoad(ws, from, exById) {
  const patterns = {}, muscles = {}, byMuscleEx = {};
  for (const w of strengthWorkouts(ws, from)) for (const e of w.entries) {
    const ex = exById(e.exId);
    const n = e.sets.filter(s => !s.warm).length;
    if (!n) continue;
    patterns[ex.group] = (patterns[ex.group] || 0) + n;
    const mu = musclesOf(ex);
    for (const k of mu.p) { muscles[k] = (muscles[k] || 0) + n; ((byMuscleEx[k] ||= {})[ex.name] = (byMuscleEx[k][ex.name] || 0) + n); }
    for (const k of mu.s) { muscles[k] = (muscles[k] || 0) + n / 2; ((byMuscleEx[k] ||= {})[ex.name] = (byMuscleEx[k][ex.name] || 0) + n / 2); }
  }
  return { patterns, muscles, byMuscleEx };
}

// ---------- Grafiken ----------
const W = 340;
const kc = k => `var(--k-${k})`;
function roundedTop(x, y, w, h, r) {
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function stackedBarsSVG({ list, monthly }, goal) {
  const H = 170, pl = 24, pr = 6, pt = 10, pb = 22;
  const totals = list.map(b => KIND_KEYS.reduce((a, k) => a + b.counts[k], 0) + b.est);
  const max = Math.max(monthly ? 4 : goal + 1, ...totals);
  const n = list.length, slot = (W - pl - pr) / n, bw = Math.max(4, Math.min(26, slot * 0.62));
  const Y = v => pt + (1 - v / max) * (H - pt - pb);
  let marks = '';
  list.forEach((b, i) => {
    const x = pl + i * slot + (slot - bw) / 2;
    const segs = KIND_KEYS.filter(k => b.counts[k]).map(k => ({ k, v: b.counts[k] }));
    if (b.est) segs.push({ k: 'est', v: b.est });
    let acc = 0;
    segs.forEach((sg, j) => {
      const y0 = Y(acc), y1 = Y(acc + sg.v);
      const h = Math.max(1, y0 - y1 - (j ? 2 : 0)); // 2px Lücke zwischen Segmenten
      const top = j === segs.length - 1;
      const fill = sg.k === 'est' ? 'url(#hatch)' : kc(sg.k);
      marks += top ? `<path d="${roundedTop(x, y1, bw, h, 3)}" style="fill:${fill}"/>` : `<rect x="${x}" y="${y1}" width="${bw}" height="${h}" style="fill:${fill}"/>`;
      acc += sg.v;
    });
    const parts = KIND_KEYS.filter(k => b.counts[k]).map(k => `${b.counts[k]} ${KINDS[k].label}`);
    if (b.est) parts.push(`ca. ${b.est} geschätzt`);
    marks += `<rect class="hit" x="${pl + i * slot}" y="${pt}" width="${slot}" height="${H - pt - pb}" data-tip="${esc(b.long)}: ${esc(parts.join(', ') || 'kein Training')}"/>`;
  });
  const labIdx = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);
  const labels = labIdx.map(i => `<text x="${pl + i * slot + slot / 2}" y="${H - 6}" class="lbl" text-anchor="middle">${esc(list[i].label)}</text>`).join('');
  const goalLine = !monthly && goal ? `<line x1="${pl}" x2="${W - pr}" y1="${Y(goal)}" y2="${Y(goal)}" class="goal"/><text x="${W - pr}" y="${Y(goal) - 4}" class="lbl" text-anchor="end">Ziel ${goal}</text>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Trainings pro ${monthly ? 'Monat' : 'Woche'}">
    <defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="5" style="fill:var(--k-kraft)"/></pattern></defs>
    <line x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}" class="axis"/>
    <text x="${pl - 6}" y="${Y(max) + 4}" class="lbl" text-anchor="end">${max}</text><text x="${pl - 6}" y="${H - pb}" class="lbl" text-anchor="end">0</text>
    ${goalLine}${marks}${labels}</svg>`;
}

export function indexLineSVG(points) {
  const H = 170, pl = 42, pr = 10, pt = 18, pb = 22;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(0, ...ys), y1 = Math.max(5, ...ys);
  const pad = (y1 - y0) * 0.1; y1 += pad; if (y0 < 0) y0 -= pad;
  const X = x => x1 === x0 ? (pl + W - pr) / 2 : pl + (x - x0) / (x1 - x0) * (W - pl - pr);
  const Y = y => pt + (1 - (y - y0) / (y1 - y0)) * (H - pt - pb);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
  const last = points.at(-1);
  const sign = v => (v >= 0 ? '+' : '−') + fmtNum(Math.abs(v), 1) + ' %';
  const hits = points.map((p, i) => {
    const a = i ? (X(points[i - 1].x) + X(p.x)) / 2 : pl, b = i < points.length - 1 ? (X(p.x) + X(points[i + 1].x)) / 2 : W - pr;
    return `<rect class="hit" x="${a}" y="${pt}" width="${Math.max(1, b - a)}" height="${H - pt - pb}" data-tip="${fmtShort(p.x)}: ${sign(p.y)} (${p.n} Übungen)" data-cx="${X(p.x).toFixed(1)}" data-cy="${Y(p.y).toFixed(1)}"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kraftentwicklung in Prozent">
    <line x1="${pl}" x2="${W - pr}" y1="${Y(0)}" y2="${Y(0)}" class="axis"/>
    <text x="${pl - 6}" y="${Y(0) + 4}" class="lbl" text-anchor="end">0 %</text>
    <line x1="${pl}" x2="${W - pr}" y1="${Y(Math.max(...ys))}" y2="${Y(Math.max(...ys))}" class="grid"/><text x="${pl - 6}" y="${Y(Math.max(...ys)) + 4}" class="lbl" text-anchor="end">${(Math.max(...ys) >= 0 ? '+' : '−') + Math.round(Math.abs(Math.max(...ys)))} %</text>
    <path d="${d}" class="iline"/>
    <circle cx="${X(last.x)}" cy="${Y(last.y)}" r="4.5" class="idot"/>
    <text x="${Math.min(X(last.x), W - pr - 2)}" y="${Y(last.y) - 10}" class="vlbl" text-anchor="end">${sign(last.y)}</text>
    <text x="${pl}" y="${H - 6}" class="lbl">${fmtShort(x0)}</text><text x="${W - pr}" y="${H - 6}" class="lbl" text-anchor="end">${fmtShort(x1)}</text>
    <line class="xhair" x1="-10" x2="-10" y1="${pt}" y2="${H - pb}"/><circle class="xdot" r="4" cx="-10" cy="-10"/>
    ${hits}</svg>`;
}

export function patternBarsHTML(patterns) {
  const rows = GROUPS.filter(g => patterns[g]).map(g => [g, patterns[g]]);
  if (!rows.length) return '<p class="muted small">Noch keine Sätze in diesem Zeitraum.</p>';
  const max = Math.max(...rows.map(r => r[1]));
  return `<div class="hbars">${rows.map(([g, v]) => `<div class="hbar" data-tip="${esc(g)}: ${fmtNum(v, 0)} Sätze"><span class="hbar-l">${esc(g)}</span><span class="hbar-t"><i style="width:${(v / max * 100).toFixed(1)}%"></i></span><span class="hbar-v">${fmtNum(v, 0)}</span></div>`).join('')}</div>`;
}

export function balanceHTML(p) {
  const pair = (a, b, la, lb) => {
    const A = a.reduce((s, g) => s + (p[g] || 0), 0), B = b.reduce((s, g) => s + (p[g] || 0), 0);
    if (!A && !B) return '';
    const r = B ? A / B : Infinity;
    const ok = r >= 0.8 && r <= 1.25;
    const txt = ok ? 'ausgewogen' : r > 1 ? `mehr ${la}` : `mehr ${lb}`;
    const pa = Math.round(A / (A + B) * 100);
    return `<div class="bal"><div class="bal-head"><span>${la} <b>${fmtNum(A, 0)}</b></span><span class="bal-tag ${ok ? 'ok' : ''}">${txt}</span><span><b>${fmtNum(B, 0)}</b> ${lb}</span></div>
      <div class="bal-bar"><i style="width:${pa}%"></i><i style="width:${100 - pa}%"></i></div></div>`;
  };
  return pair(['Drücken horizontal', 'Drücken vertikal'], ['Ziehen horizontal', 'Ziehen vertikal'], 'Drücken', 'Ziehen')
    + pair(['Kniedominant'], ['Hüftdominant'], 'Knie', 'Hüfte');
}

// Stilisierte Körperkarte (vorne/hinten). Farbe = eine Farbe, heller → dunkler nach Satzanzahl.
const BODY = {
  front: [
    ['schultern', 'e', 36, 50, 10, 8], ['schultern', 'e', 84, 50, 10, 8],
    ['brust', 'e', 49, 62, 11, 9], ['brust', 'e', 71, 62, 11, 9],
    ['bizeps', 'e', 30, 74, 6, 13], ['bizeps', 'e', 90, 74, 6, 13],
    ['unterarme', 'e', 26, 102, 5, 13], ['unterarme', 'e', 94, 102, 5, 13],
    ['bauch', 'r', 51, 74, 18, 38, 6], ['seitbauch', 'r', 41, 76, 8, 32, 4], ['seitbauch', 'r', 71, 76, 8, 32, 4],
    ['quadrizeps', 'e', 50, 150, 9.5, 24], ['quadrizeps', 'e', 70, 150, 9.5, 24],
    [null, 'e', 50, 198, 6, 18], [null, 'e', 70, 198, 6, 18],
    ['fuss', 'e', 50, 228, 7, 5], ['fuss', 'e', 70, 228, 7, 5],
  ],
  back: [
    ['ruecken_oben', 'e', 60, 56, 17, 11], ['schultern', 'e', 36, 50, 10, 8], ['schultern', 'e', 84, 50, 10, 8],
    ['trizeps', 'e', 30, 74, 6, 13], ['trizeps', 'e', 90, 74, 6, 13],
    ['unterarme', 'e', 26, 102, 5, 13], ['unterarme', 'e', 94, 102, 5, 13],
    ['lat', 'e', 47, 84, 8, 17], ['lat', 'e', 73, 84, 8, 17], ['unterer_ruecken', 'r', 52, 96, 16, 16, 5],
    ['gesaess', 'e', 51, 124, 10, 10], ['gesaess', 'e', 69, 124, 10, 10],
    ['beinbeuger', 'e', 50, 158, 8.5, 20], ['beinbeuger', 'e', 70, 158, 8.5, 20],
    ['waden', 'e', 50, 198, 7, 17], ['waden', 'e', 70, 198, 7, 17],
    ['fuss', 'e', 50, 228, 7, 5], ['fuss', 'e', 70, 228, 7, 5],
  ],
};
const STEPS = [18, 38, 58, 78, 100];
export function bodyMapHTML(muscles, byMuscleEx) {
  const max = Math.max(1, ...Object.values(muscles));
  const step = v => v ? STEPS[Math.min(4, Math.floor(v / max * 4.999))] : 0;
  const fill = k => { const s = step(muscles[k] || 0); return s ? `color-mix(in oklab, var(--k-kraft) ${s}%, var(--surface-2))` : 'var(--surface-2)'; };
  const tip = k => {
    const v = muscles[k] || 0;
    const top = Object.entries(byMuscleEx[k] || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n).join(', ');
    return `${MUSCLES[k]}: ${fmtNum(v, 1)} Sätze${top ? ' · ' + top : ''}`;
  };
  const fig = (side) => {
    const shapes = BODY[side].map(([k, t, x, y, a, b, r]) => {
      const st = `style="fill:${k ? fill(k) : 'var(--surface-2)'}"`;
      const tp = k ? ` data-tip="${esc(tip(k))}" class="mz"` : ' class="mz off"';
      return t === 'e' ? `<ellipse cx="${x}" cy="${y}" rx="${a}" ry="${b}" ${st}${tp}/>` : `<rect x="${x}" y="${y}" width="${a}" height="${b}" rx="${r}" ${st}${tp}/>`;
    }).join('');
    return `<figure class="body"><svg viewBox="0 0 120 240" role="img" aria-label="Muskelkarte ${side === 'front' ? 'vorne' : 'hinten'}">
      <circle cx="60" cy="20" r="12" class="mz off" style="fill:var(--surface-2)"/>
      <rect x="54" y="31" width="12" height="8" rx="3" class="mz off" style="fill:var(--surface-2)"/>
      <path d="M44 112 H76 L78 128 H42 Z" class="mz off" style="fill:var(--surface-2)"/>
      ${shapes}</svg><figcaption>${side === 'front' ? 'Vorne' : 'Hinten'}</figcaption></figure>`;
  };
  const list = Object.keys(MUSCLES).map(k => [k, muscles[k] || 0]).sort((a, b) => b[1] - a[1]);
  const lmax = Math.max(1, list[0]?.[1] || 1);
  return `<div class="bodies">${fig('front')}${fig('back')}</div>
    <div class="seq-legend"><span>wenig</span>${STEPS.map(s => `<i style="background:color-mix(in oklab, var(--k-kraft) ${s}%, var(--surface-2))"></i>`).join('')}<span>viel</span></div>
    <details class="mlist"><summary>Alle Muskelgruppen als Liste</summary>
      <div class="hbars">${list.map(([k, v]) => `<div class="hbar" data-tip="${esc(tip(k))}"><span class="hbar-l">${MUSCLES[k]}</span><span class="hbar-t"><i style="width:${(v / lmax * 100).toFixed(1)}%"></i></span><span class="hbar-v">${fmtNum(v, 0)}</span></div>`).join('')}</div>
    </details>`;
}

// Tooltips: antippen (Handy) oder darüberfahren (PC)
export function mountTips(root) {
  root.querySelectorAll('.viz').forEach(v => {
    const tipEl = v.querySelector('.viz-tip');
    const show = ev => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-tip]');
      if (!el || !v.contains(el)) return;
      tipEl.textContent = el.dataset.tip;
      tipEl.classList.add('on');
      v.querySelectorAll('.sel').forEach(x => x.classList.remove('sel'));
      el.classList.add('sel');
      const xh = v.querySelector('.xhair'), xd = v.querySelector('.xdot');
      if (xh && el.dataset.cx) { xh.setAttribute('x1', el.dataset.cx); xh.setAttribute('x2', el.dataset.cx); xd.setAttribute('cx', el.dataset.cx); xd.setAttribute('cy', el.dataset.cy); }
    };
    v.addEventListener('pointerdown', show);
    v.addEventListener('pointermove', show);
  });
}

// ---------- Hinweise zu möglichen Ungleichgewichten ----------
// Bewusst vorsichtig formuliert: ein Ungleichgewicht im Training ist noch keine Dysbalance im Körper.
export function balanceInsights(ws, from, exById, load) {
  const P = load.patterns, Mu = load.muscles;
  const total = Object.values(P).reduce((a, b) => a + b, 0);
  if (total < 30) return { enough: false, items: [] };
  const sum = gs => gs.reduce((a, g) => a + (P[g] || 0), 0);
  const items = [];
  const add = (level, title, text) => items.push({ level, title, text });

  const push = sum(['Drücken horizontal', 'Drücken vertikal']), pull = sum(['Ziehen horizontal', 'Ziehen vertikal']);
  if (push && pull / push < 0.9) add('tip', 'Mehr Ziehen als Drücken einplanen',
    `Du drückst ${fmtNum(push, 0)} Sätze, ziehst aber nur ${fmtNum(pull, 0)}. Für gesunde Schultern und eine aufrechte Haltung gilt: mindestens so viel ziehen wie drücken, gern etwas mehr (z. B. Rudern ergänzen).`);
  else if (push && pull) add('ok', 'Drücken & Ziehen im Gleichgewicht', `Verhältnis ${fmtNum(push, 0)} : ${fmtNum(pull, 0)} – genau so soll es sein.`);

  for (const [a, b, la, lb] of [['Drücken horizontal', 'Drücken vertikal', 'horizontal', 'über Kopf'], ['Ziehen horizontal', 'Ziehen vertikal', 'horizontal (Rudern)', 'vertikal (Klimmzug)']]) {
    if ((P[a] || 0) + (P[b] || 0) >= 12 && (!P[a] || !P[b])) add('tip', `${a.split(' ')[0]}: beide Richtungen abdecken`,
      `Im Zeitraum fehlt ${!P[a] ? la : lb}. Beide Ebenen trainieren die Schulter vollständiger.`);
  }

  const knee = P['Kniedominant'] || 0, hip = P['Hüftdominant'] || 0;
  if (knee + hip >= 12) {
    if (hip / Math.max(knee, 1) < 0.7) add('tip', 'Hintere Kette stärken',
      `Mehr kniedominante (${fmtNum(knee, 0)}) als hüftdominante Sätze (${fmtNum(hip, 0)}). Gesäß und Oberschenkelrückseite schützen beim Laufen Knie und Rücken – z. B. RDL, Hip Thrust, Swings.`);
    else if (knee / Math.max(hip, 1) < 0.7) add('tip', 'Kniedominante Übungen ergänzen',
      `Viel Hüfte, wenig Knie (${fmtNum(knee, 0)} Sätze). Kniebeuge- und Ausfallschritt-Varianten stärken die Oberschenkel-Vorderseite fürs Bergablaufen.`);
    else add('ok', 'Knie & Hüfte ausgewogen', `Verhältnis ${fmtNum(knee, 0)} : ${fmtNum(hip, 0)}.`);
  }

  // Einbeinig: für Läufer besonders wertvoll (Laufen ist eine Abfolge von Einbeinsprüngen)
  let legAll = 0, legUni = 0;
  for (const w of ws) if (w.start >= from && w.entries) for (const e of w.entries) {
    const ex = exById(e.exId);
    if (ex.group !== 'Kniedominant' && ex.group !== 'Hüftdominant') continue;
    const n = e.sets.filter(s => !s.warm).length;
    legAll += n; if (ex.perSide || /ausfall|split|step|einbein|lunge|pistol/i.test(ex.name)) legUni += n;
  }
  if (legAll >= 12 && legUni / legAll < 0.25) add('tip', 'Mehr einbeinig trainieren',
    `Nur ${Math.round(legUni / legAll * 100)} % deiner Beinsätze sind einbeinig. Als Läufer profitierst du von Bulgarian Split Squats, Step-ups oder einbeinigem Kreuzheben – sie decken Seitenunterschiede auf und stabilisieren Hüfte und Knie.`);

  const core = (Mu.bauch || 0), side = (Mu.seitbauch || 0);
  if (core + side >= 8 && side / Math.max(core, 1) < 0.5) add('tip', 'Seitliche Rumpfstabilität ergänzen',
    'Dein Core-Training ist eher frontal. Anti-Rotation und seitliche Stabilität (Pallof Press, Seitstütz, Suitcase/Offset Carry) halten beim Laufen das Becken ruhig.');

  const post = (Mu.gesaess || 0) + (Mu.beinbeuger || 0), quad = Mu.quadrizeps || 0;
  if (quad >= 10 && post / quad < 0.6) add('tip', 'Gesäß kommt zu kurz',
    'Das Gesäß ist dein wichtigster Laufmuskel. Ergänze Hüftstreckung (Hip Thrust, Glute Bridge, Monster Walk mit Miniband).');

  if (total >= 40 && (Mu.waden || 0) + (Mu.fuss || 0) < total * 0.04) add('tip', 'Waden & Fuß nicht vergessen',
    'Wadenkraft und Fußstabilität sind für Läufer zentral. Wegen deines Sprunggelenks: Umfang und Übungen am besten mit dem Physio abstimmen.');

  return { enough: true, items: items.sort((a, b) => (a.level === 'tip' ? 0 : 1) - (b.level === 'tip' ? 0 : 1)) };
}

export function insightsHTML(res) {
  if (!res.enough) return '<p class="muted small">Ab etwa 30 Sätzen im Zeitraum gibt es hier Hinweise zur Balance deines Trainings.</p>';
  if (!res.items.length) return '<p class="muted small">Keine Auffälligkeiten – dein Training ist ausgewogen.</p>';
  return `<div class="insights">${res.items.map(i => `<div class="insight ${i.level}">
    <span class="ins-ico" aria-hidden="true">${i.level === 'ok' ? '✓' : '!'}</span>
    <div><b>${i.level === 'ok' ? 'Passt' : 'Hinweis'}: ${esc(i.title)}</b><p>${esc(i.text)}</p></div></div>`).join('')}</div>
    <p class="muted small fine">Hinweise beziehen sich auf die Verteilung deiner Sätze, nicht auf deinen Körper. Bei Beschwerden zählt die Einschätzung von Arzt oder Physio.</p>`;
}
