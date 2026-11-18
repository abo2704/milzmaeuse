// Kraftkladde – UI-Logik. Alles läuft lokal, ohne Server.
import { db, load, save, replaceAll, resetAll, isValid } from './store.js';
import { FIELDS, FIELD_ORDER, GROUPS, sortFields } from './exercises.js';
import { METRICS, metricByKey, fmtMetric, exerciseSeries, computeRecords, bestOf, sessionValue, isBetter, workoutStats } from './stats.js';
import { lineChart, mountChart } from './chart.js';
import {
  $, esc, uid, norm, num, fmtNum, fmtKg, fmtTime, parseTime, fmtDist, dayKey, fmtDate, fmtDateLong, fmtShort,
  fmtClock, monthLabel, weekStart, daysAgo, relDay, pick,
} from './util.js';

const APP_VERSION = '1.0.0';
let D = load();
save(); // Startdaten bzw. nachgezogene Übungen sofort sichern
let tab = 'train';
let exFilter = { q: '', group: '' };
let installEvt = null;

// ---------- Texte ----------
const CHEERS = [
  'Stark! Das Eisen hat Respekt vor dir.', 'Gespeichert. Die Muskeln wachsen jetzt im Schlaf weiter.',
  'Sauber abgeliefert – genau so geht das.', 'Training erledigt. Couch hast du dir verdient.',
  'Wieder ein Baustein mehr. Konstanz schlägt alles.', 'Boom. Das war ein richtig gutes Training.',
];
const TAGLINES = [
  'Heute ist ein guter Tag für schwere Sachen.', 'Ein Satz nach dem anderen.', 'Kleine Schritte, große Gewichte.',
  'Dein Ich von morgen sagt danke.', 'Konstanz schlägt Motivation.', 'Nicht perfekt – aber gemacht.',
];

// ---------- Helfer ----------
const exById = id => D.exercises.find(e => e.id === id) || { id, name: 'Gelöschte Übung', group: 'Sonstiges', fields: ['w', 'r'], perSide: false, note: '' };
const visibleExercises = () => D.exercises.filter(e => !e.archived);
const measureLabel = fs => sortFields(fs).map(f => FIELDS[f].label).join(' · ') || '–';
const sortWorkouts = () => D.workouts.sort((a, b) => a.start - b.start);

function setStr(s, fields) {
  const f = sortFields(fields);
  const has = k => f.includes(k) && s[k] != null;
  let out = '';
  if (has('w')) out = fmtKg(s.w);
  if (has('r')) out += out ? ` × ${s.r}` : `${s.r} Wdh.`;
  const rest = [];
  if (has('d')) rest.push(fmtDist(s.d));
  if (has('t')) rest.push(fmtTime(s.t));
  return [out, ...rest].filter(Boolean).join(' · ') || '–';
}
function exampleStr(fields) {
  return sortFields(fields).map((f, i, a) => (f === 'r' && a[0] === 'w') ? '× 10' : FIELDS[f].example).join(' ').replace(/ (?=\d+ m|\d:\d)/g, ' · ');
}

// Letztes Mal, als diese Übung gemacht wurde (für "Vorher"-Spalte und Vorschläge)
function lastSetsFor(exId, excludeId) {
  for (let i = D.workouts.length - 1; i >= 0; i--) {
    const w = D.workouts[i];
    if (w.id === excludeId) continue;
    const en = w.entries.find(e => e.exId === exId);
    if (en) return { sets: en.sets, fields: en.fields, date: w.start };
  }
  return null;
}
function lastDoneMap() {
  const m = {};
  for (const w of D.workouts) for (const e of w.entries) m[e.exId] = w.start;
  return m;
}

const ICON = {
  check: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dots: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>',
  train: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6M6 6.5v11M18 6.5v11M21 9v6M6 12h12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  history: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 10h17M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18l5-6 4 3 7-9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

// ---------- Toast ----------
let toastTimer;
function toast(msg, kind = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), kind === 'gold' ? 3800 : 2400);
}

// ---------- Ebenen (Overlays) mit Zurück-Taste ----------
const layers = [];
let afterPop = null;
function openLayer(l) {
  layers.push(l);
  history.pushState({ layer: layers.length }, '');
  const el = document.createElement('div');
  el.className = `layer ${l.full ? 'full' : 'sheet'}`;
  el.innerHTML = '<div class="backdrop" data-act="close-layer"></div><div class="panel" role="dialog" aria-modal="true"></div>';
  l.el = el;
  $('#layers').append(el);
  paintLayer(l);
  document.body.classList.add('noscroll');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('open')));
}
function paintLayer(l = topLayer()) {
  if (!l) return;
  const p = l.el.querySelector('.panel');
  const st = p.scrollTop;
  p.innerHTML = l.html(l);
  p.scrollTop = st;
  l.mount?.(p, l);
}
const topLayer = () => layers[layers.length - 1];
function closeLayer(then) { afterPop = then || null; history.back(); }
window.addEventListener('popstate', () => {
  const l = layers.pop();
  if (l) {
    l.onClose?.();
    l.el.classList.remove('open');
    setTimeout(() => l.el.remove(), 220);
  }
  if (!layers.length) document.body.classList.remove('noscroll');
  const f = afterPop; afterPop = null;
  f?.();
});

function confirmSheet({ title, text = '', ok, danger = false, onOk }) {
  openLayer({
    html: () => `<div class="sheet-body"><h2>${esc(title)}</h2>${text ? `<p class="muted">${esc(text)}</p>` : ''}
      <div class="btn-col"><button class="btn ${danger ? 'danger' : 'primary'} wide" data-act="confirm-ok">${esc(ok)}</button>
      <button class="btn ghost wide" data-act="close-layer">Abbrechen</button></div></div>`,
    onOk,
  });
}

// ---------- Rendering ----------
function render() { renderTabs(); renderView(); renderRestbar(); syncWakeLock(); }

function renderTabs() {
  const tabs = [['train', 'Training', ICON.train], ['history', 'Verlauf', ICON.history], ['exercises', 'Übungen', ICON.list], ['more', 'Mehr', ICON.more]];
  $('#tabs').innerHTML = tabs.map(([k, l, i]) => `<button class="tab ${tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}" aria-label="${l}">${i}<span>${l}</span>${k === 'train' && D.active ? '<i class="live-dot"></i>' : ''}</button>`).join('');
}

function renderView() {
  const v = $('#view');
  v.innerHTML = tab === 'train' ? (D.active ? workoutHTML() : homeHTML())
    : tab === 'history' ? historyHTML()
    : tab === 'exercises' ? exercisesHTML()
    : moreHTML();
  mountChart(v);
}

// ---------- Start ----------
function homeHTML() {
  const h = new Date().getHours();
  const hello = h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend';
  const now = Date.now();
  const wk = weekStart(now).getTime();
  const thisWeek = D.workouts.filter(w => w.start >= wk).length;
  const weeks = new Set(D.workouts.map(w => weekStart(w.start).getTime()));
  let cur = weekStart(now); if (!weeks.has(cur.getTime())) cur.setDate(cur.getDate() - 7);
  let streak = 0; while (weeks.has(cur.getTime())) { streak++; cur.setDate(cur.getDate() - 7); }
  const recs = computeRecords(D.workouts).slice(-4).reverse();
  const backupDue = D.workouts.length >= 5 && (!D.lastBackup || daysAgo(D.lastBackup) > 30);
  const lastByTpl = {};
  for (const w of D.workouts) if (w.templateId) lastByTpl[w.templateId] = w.start;

  return `
  <header class="top">
    <p class="eyebrow">${hello}${D.settings.name ? ', ' + esc(D.settings.name) : ''}</p>
    <h1>Kraftkladde</h1>
    <p class="muted">${esc(pick(TAGLINES))}</p>
  </header>
  <div class="tiles">
    <div class="tile"><strong>${thisWeek}</strong><span>diese Woche</span></div>
    <div class="tile"><strong>${streak}</strong><span>${streak === 1 ? 'Woche' : 'Wochen'} am Stück</span></div>
    <div class="tile"><strong>${D.workouts.length}</strong><span>Trainings gesamt</span></div>
  </div>
  <button class="btn hero" data-act="start-empty"><span>Training starten</span><small>leer beginnen, Übungen unterwegs hinzufügen</small></button>
  ${backupDue ? `<button class="banner" data-act="tab" data-tab="more">💾 Zeit für ein Backup – deine Daten liegen nur auf diesem Handy.</button>` : ''}
  <section>
    <div class="sec-head"><h2>Routinen</h2><button class="link" data-act="tpl-new">+ Neue Routine</button></div>
    ${D.templates.length ? D.templates.map(t => `
      <div class="card tpl">
        <button class="tpl-main" data-act="tpl-start" data-id="${t.id}">
          <strong>${esc(t.name)}</strong>
          <span class="muted small">${esc(t.items.map(i => exById(i.exId).name).join(', ') || 'Noch leer')}</span>
          <span class="muted small">${lastByTpl[t.id] ? 'Zuletzt ' + relDay(lastByTpl[t.id]) : 'Noch nie gemacht'}</span>
        </button>
        <div class="tpl-actions">
          <button class="btn primary small" data-act="tpl-start" data-id="${t.id}">Start</button>
          <button class="icon-btn" data-act="tpl-edit" data-id="${t.id}" aria-label="Routine bearbeiten">${ICON.dots}</button>
        </div>
      </div>`).join('') : '<p class="muted small">Leg dir Routinen an (z. B. „Oberkörper“, „Beine“), dann startest du mit einem Tipp.</p>'}
  </section>
  <section>
    <div class="sec-head"><h2>Letzte 16 Wochen</h2></div>
    ${heatmapHTML()}
  </section>
  ${recs.length ? `<section><div class="sec-head"><h2>Neueste Rekorde</h2></div>
    <div class="card list">${recs.map(r => `<button class="row" data-act="ex-open" data-id="${r.exId}"><span>🏆 <b>${esc(exById(r.exId).name)}</b><br><span class="muted small">${r.m.short}: ${fmtMetric(r.m.kind, r.v)} (vorher ${fmtMetric(r.m.kind, r.prev)})</span></span><span class="muted small">${relDay(r.date)}</span></button>`).join('')}</div></section>` : ''}
  <button class="btn ghost wide" data-act="backlog">Vergangenes Training nachtragen</button>`;
}

function heatmapHTML() {
  const counts = {};
  for (const w of D.workouts) counts[dayKey(w.start)] = (counts[dayKey(w.start)] || 0) + 1;
  const start = weekStart(Date.now()); start.setDate(start.getDate() - 15 * 7);
  const today = dayKey(Date.now());
  let cells = '';
  const d = new Date(start);
  for (let i = 0; i < 16 * 7; i++) {
    const k = dayKey(d);
    const c = counts[k] || 0;
    const future = k > today;
    cells += `<i class="${future ? 'fut' : c ? 'on' : ''}${k === today ? ' today' : ''}" title="${k}"></i>`;
    d.setDate(d.getDate() + 1);
  }
  return `<div class="card heat-wrap"><div class="heat">${cells}</div><div class="heat-legend muted small"><span>Mo</span><span>So</span></div></div>`;
}

// ---------- Laufendes Training ----------
function workoutHTML() {
  const A = D.active;
  const live = A.mode === 'live';
  const head = `<header class="wo-head">
    <div class="wo-title">
      <input class="wo-name" data-bind="wo-name" value="${esc(A.name)}" placeholder="Training" aria-label="Name des Trainings">
      ${live ? `<span class="elapsed">⏱ <span id="elapsed">${fmtTime((Date.now() - A.start) / 1000)}</span></span>`
        : `<div class="wo-meta"><input type="date" data-bind="wo-date" value="${dayKey(A.start)}" aria-label="Datum">
           <label class="dur"><input type="number" inputmode="numeric" min="1" data-bind="wo-dur" value="${A.durationMin ?? 60}" aria-label="Dauer in Minuten"> Min.</label></div>`}
    </div>
    <button class="btn primary" data-act="finish">${live ? 'Fertig' : 'Speichern'}</button>
  </header>`;
  const body = A.entries.length ? A.entries.map((en, i) => entryHTML(en, i)).join('')
    : `<div class="empty"><div class="empty-ico">🏋️</div><p>Noch keine Übung drin.<br>Füg die erste hinzu – los geht's!</p></div>`;
  return head + body + `<button class="btn add-ex wide" data-act="add-ex">+ Übung hinzufügen</button>
    <button class="btn ghost danger wide" data-act="discard">${A.editOf ? 'Änderungen verwerfen' : 'Training verwerfen'}</button>`;
}

function entryHTML(en, i) {
  const ex = exById(en.exId);
  const fields = sortFields(en.fields);
  const prev = lastSetsFor(en.exId, D.active.editOf);
  const n = fields.length;
  const showPrev = n <= 2;
  const cls = `set-row${showPrev ? '' : ' noprev'}`;
  let no = 0;
  const rows = en.sets.map((s, j) => {
    const p = prev?.sets[j];
    const label = s.warm ? 'W' : String(++no);
    return `<div class="${cls}${s.done ? ' done' : ''}${s.warm ? ' warm' : ''}" style="--n:${n}" data-e="${i}" data-s="${j}">
      <button class="set-no" data-act="set-menu" aria-label="Satz ${label} Optionen">${label}</button>
      ${showPrev ? `<span class="prev">${p ? esc(setStr(p, prev.fields)) : '–'}</span>` : ''}
      ${fields.map(f => inputHTML(f, s[f], p && prev.fields.includes(f) ? p[f] : null)).join('')}
      <button class="check" data-act="set-done" aria-label="Satz abhaken">${ICON.check}</button>
    </div>`;
  }).join('');
  const note = [ex.note, en.note].filter(Boolean).map(esc).join(' · ');
  return `<section class="card entry">
    <div class="entry-head">
      <button class="ex-link" data-act="ex-open" data-id="${ex.id}">
        <span class="ex-name">${esc(ex.name)}</span>
        <span class="ex-sub">${measureLabel(fields)}${ex.perSide ? ' · pro Seite' : ''}${prev ? ' · zuletzt ' + relDay(prev.date) : ''}</span>
      </button>
      <button class="icon-btn" data-act="entry-menu" data-e="${i}" aria-label="Übungs-Optionen">${ICON.dots}</button>
    </div>
    ${note ? `<p class="entry-note">📝 ${note}</p>` : ''}
    ${en.sets.length ? `<div class="${cls} head" style="--n:${n}"><span>Satz</span>${showPrev ? '<span>Vorher</span>' : ''}${fields.map(f => `<span>${FIELDS[f].col}</span>`).join('')}<span></span></div>` : ''}
    ${rows}
    <div class="entry-foot">
      <button class="btn small" data-act="add-set" data-e="${i}">+ Satz</button>
      <button class="btn small" data-act="entry-mode" data-e="${i}">⇄ Messart</button>
      ${fields.includes('t') ? `<button class="btn small" data-act="stopwatch" data-e="${i}">⏱ Stoppuhr</button>` : ''}
    </div>
  </section>`;
}

function inputHTML(f, v, ph) {
  const show = x => x == null ? '' : f === 't' ? fmtTime(x) : String(x).replace('.', ',');
  const mode = f === 'w' || f === 'd' ? 'decimal' : 'numeric';
  return `<input class="val" data-f="${f}" inputmode="${mode}" enterkeyhint="next" autocomplete="off" value="${show(v)}" placeholder="${show(ph)}" aria-label="${FIELDS[f].label}">`;
}

function newEntry(exId, setCount = 0, fields) {
  const ex = exById(exId);
  const prev = lastSetsFor(exId, D.active?.editOf);
  const count = setCount || Math.max(1, Math.min(prev?.sets.length || 3, 6));
  return { id: uid(), exId, fields: sortFields(fields || ex.fields), note: '', sets: Array.from({ length: count }, (_, j) => ({ warm: !!prev?.sets[j]?.warm, done: false })) };
}

function startWorkout({ name = 'Training', entries = [], templateId = null, mode = 'live' } = {}) {
  if (D.active) { toast('Es läuft schon ein Training.'); tab = 'train'; render(); return; }
  const start = mode === 'live' ? Date.now() : (() => { const d = new Date(); d.setHours(18, 0, 0, 0); return d.getTime(); })();
  D.active = { id: uid(), name, start, mode, templateId, editOf: null, durationMin: 60, entries: [] };
  D.active.entries = entries.map(e => newEntry(e.exId, e.sets, e.fields));
  save();
  tab = 'train';
  window.scrollTo(0, 0);
  render();
}

function workoutToActive(w) {
  return {
    id: uid(), name: w.name, start: w.start, mode: 'edit', templateId: w.templateId || null, editOf: w.id,
    durationMin: Math.max(1, Math.round((w.end - w.start) / 60000)),
    entries: w.entries.map(e => ({ id: uid(), exId: e.exId, fields: [...e.fields], note: e.note || '', sets: e.sets.map(s => ({ ...s, done: true })) })),
  };
}

function cleanSet(s, fields) {
  const o = { warm: !!s.warm };
  for (const f of fields) if (s[f] != null) o[f] = s[f];
  return o;
}
const hasValue = (s, fields) => fields.some(f => s[f] != null);

function saveActive(includeUndone) {
  const A = D.active;
  const keep = s => s.done || includeUndone;
  const w = {
    id: A.editOf || uid(),
    name: (A.name || '').trim() || 'Training',
    start: A.start,
    end: A.mode === 'live' ? Date.now() : A.start + (A.durationMin || 60) * 60000,
    templateId: A.templateId || null,
    entries: A.entries.map(en => {
      const f = sortFields(en.fields);
      return { exId: en.exId, fields: f, note: en.note || '', sets: en.sets.filter(s => keep(s) && hasValue(s, f)).map(s => cleanSet(s, f)) };
    }).filter(en => en.sets.length),
  };
  const idx = D.workouts.findIndex(x => x.id === w.id);
  if (idx >= 0) D.workouts[idx] = w; else D.workouts.push(w);
  sortWorkouts();
  const wasEdit = !!A.editOf;
  D.active = null;
  save();
  return { w, wasEdit };
}

// Rekord-Check für einen gerade abgehakten Satz
function checkPR(en, si) {
  const s = en.sets[si];
  const out = [];
  for (const m of METRICS) {
    if (m.session) continue;
    const v = m.val(s);
    if (v == null) continue;
    let best = bestOf(D.workouts, en.exId, m, D.active.editOf);
    if (best == null) continue; // erstes Mal: noch kein Rekord
    for (const e2 of D.active.entries) if (e2.exId === en.exId) for (const s2 of e2.sets) {
      if (s2 === s || !s2.done || s2.warm) continue;
      const v2 = m.val(s2); if (v2 != null && isBetter(m, v2, best)) best = v2;
    }
    if (isBetter(m, v, best)) out.push(`${m.short} ${fmtMetric(m.kind, v)}`);
  }
  return out.slice(0, 2).join(', ');
}

// ---------- Pausen-Timer ----------
let audioCtx = null, restAlarmed = false;
function unlockAudio() {
  try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume?.(); } catch { /* egal */ }
}
function beep() {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  [0, 0.22, 0.44].forEach((dt, i) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = i === 2 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, t0 + dt);
    g.gain.exponentialRampToValueAtTime(0.3, t0 + dt + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.18);
    o.connect(g).connect(audioCtx.destination);
    o.start(t0 + dt); o.stop(t0 + dt + 0.2);
  });
}
function startRest(sec) {
  if (!sec || !D.active || D.active.mode !== 'live') return;
  D.active.restEnd = Date.now() + sec * 1000;
  D.active.restTotal = sec;
  restAlarmed = false;
}
function renderRestbar() {
  const bar = $('#restbar');
  const A = D.active;
  if (!A?.restEnd || tab !== 'train') { bar.hidden = true; return; }
  bar.hidden = false;
  bar.innerHTML = `<div class="rest-fill" id="rest-fill"></div>
    <span class="rest-label">Pause</span><strong id="rest-left">${fmtTime((A.restEnd - Date.now()) / 1000)}</strong>
    <button data-act="rest-adj" data-d="-15">−15</button><button data-act="rest-adj" data-d="15">+15</button>
    <button class="rest-skip" data-act="rest-skip">Weiter</button>`;
  tickRest();
}
function tickRest() {
  const A = D.active;
  if (!A?.restEnd) return;
  const left = (A.restEnd - Date.now()) / 1000;
  if (left <= 0) {
    A.restEnd = null; save(); renderRestbar();
    if (!restAlarmed) {
      restAlarmed = true;
      if (D.settings.vibrate) navigator.vibrate?.([250, 120, 250]);
      if (D.settings.sound) beep();
      toast('Pause vorbei – nächster Satz! 💪');
    }
    return;
  }
  const el = $('#rest-left'); if (el) el.textContent = fmtTime(Math.ceil(left));
  const fill = $('#rest-fill'); if (fill) fill.style.width = (100 - left / (A.restTotal || 1) * 100) + '%';
}
setInterval(() => {
  if (D.active?.mode === 'live') {
    const el = $('#elapsed'); if (el) el.textContent = fmtTime((Date.now() - D.active.start) / 1000);
    tickRest();
  }
  const l = topLayer();
  if (l?.kind === 'sw') { const el = $('#sw-time'); if (el) el.textContent = fmtTime(swElapsed(l)); }
}, 250);

// Bildschirm während des Trainings anlassen
let wakeLock = null;
async function syncWakeLock() {
  const want = D.active?.mode === 'live' && D.settings.wakeLock && document.visibilityState === 'visible';
  try {
    if (want && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } else if (!want && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => { syncWakeLock(); if (document.visibilityState === 'visible') tickRest(); });

// Stoppuhr
const swElapsed = l => (l.acc + (l.running ? Date.now() - l.since : 0)) / 1000;
function openStopwatch(e) {
  openLayer({
    kind: 'sw', e, acc: 0, running: false, since: 0,
    html: l => `<div class="sheet-body center">
      <h2>Stoppuhr</h2><p class="muted small">${esc(exById(D.active.entries[l.e].exId).name)}</p>
      <div class="sw-time" id="sw-time">${fmtTime(swElapsed(l))}</div>
      <div class="btn-row">
        <button class="btn ${l.running ? '' : 'primary'} big" data-act="sw-toggle">${l.running ? 'Stopp' : swElapsed(l) ? 'Weiter' : 'Start'}</button>
        <button class="btn big" data-act="sw-reset">Zurücksetzen</button>
      </div>
      <button class="btn primary wide" data-act="sw-apply" ${swElapsed(l) ? '' : 'disabled'}>In nächsten Satz übernehmen</button>
    </div>`,
  });
}

// ---------- Verlauf ----------
function historyHTML() {
  if (!D.workouts.length) return `<header class="top"><h1>Verlauf</h1></header>
    <div class="empty"><div class="empty-ico">📅</div><p>Hier landen deine Trainings.<br>Das erste ist das wichtigste!</p></div>`;
  const prs = {};
  for (const r of computeRecords(D.workouts)) prs[r.wid] = (prs[r.wid] || 0) + 1;
  let out = '<header class="top"><h1>Verlauf</h1></header>', month = '';
  for (const w of [...D.workouts].reverse()) {
    const m = monthLabel(w.start);
    if (m !== month) { month = m; out += `<h3 class="month">${m}</h3>`; }
    const st = workoutStats(w);
    out += `<button class="card wo-card" data-act="wo-open" data-id="${w.id}">
      <div class="wo-card-top"><strong>${esc(w.name)}</strong><span class="muted small">${fmtDate(w.start)}</span></div>
      <div class="chips">
        <span class="chip">⏱ ${st.mins} Min.</span><span class="chip">${st.sets} Sätze</span>
        ${st.vol ? `<span class="chip">${fmtNum(st.vol, 0)} kg</span>` : ''}${prs[w.id] ? `<span class="chip gold">🏆 ${prs[w.id]}</span>` : ''}
      </div>
      <p class="muted small clamp">${esc(w.entries.map(e => exById(e.exId).name).join(' · '))}</p>
    </button>`;
  }
  return out;
}

function openWorkout(id) {
  openLayer({
    full: true, id,
    html: l => {
      const w = D.workouts.find(x => x.id === l.id);
      if (!w) return '<div class="page"><p>Nicht gefunden.</p></div>';
      const st = workoutStats(w);
      const recs = computeRecords(D.workouts).filter(r => r.wid === w.id);
      return `<div class="page">
        <div class="page-head"><button class="icon-btn" data-act="close-layer" aria-label="Zurück">${ICON.back}</button><h1>${esc(w.name)}</h1></div>
        <p class="muted">${fmtDateLong(w.start)} · ${fmtClock(w.start)}–${fmtClock(w.end)} Uhr</p>
        <div class="tiles">
          <div class="tile"><strong>${st.mins}</strong><span>Minuten</span></div>
          <div class="tile"><strong>${st.sets}</strong><span>Sätze</span></div>
          <div class="tile"><strong>${st.vol ? fmtNum(st.vol, 0) : '–'}</strong><span>kg Volumen</span></div>
        </div>
        ${recs.length ? `<div class="card gold-card">${recs.map(r => `<div>🏆 <b>${esc(exById(r.exId).name)}</b> – ${r.m.short} ${fmtMetric(r.m.kind, r.v)}</div>`).join('')}</div>` : ''}
        ${w.entries.map(e => {
          let no = 0;
          return `<div class="card">
            <button class="ex-link" data-act="ex-open" data-id="${e.exId}"><span class="ex-name">${esc(exById(e.exId).name)}</span><span class="ex-sub">${measureLabel(e.fields)}</span></button>
            ${e.note ? `<p class="entry-note">📝 ${esc(e.note)}</p>` : ''}
            <ol class="set-list">${e.sets.map(s => `<li class="${s.warm ? 'warm' : ''}"><span class="set-no-s">${s.warm ? 'W' : ++no}</span>${esc(setStr(s, e.fields))}</li>`).join('')}</ol>
          </div>`;
        }).join('')}
        <div class="btn-grid">
          <button class="btn primary" data-act="wo-repeat">Nochmal machen</button>
          <button class="btn" data-act="wo-edit">Bearbeiten</button>
          <button class="btn" data-act="wo-to-tpl">Als Routine speichern</button>
          <button class="btn danger" data-act="wo-delete">Löschen</button>
        </div>
      </div>`;
    },
  });
}

function openSummary(w) {
  const st = workoutStats(w);
  const recs = computeRecords(D.workouts).filter(r => r.wid === w.id);
  openLayer({
    full: true,
    html: () => `<div class="page summary">
      <div class="big-emoji">${recs.length ? '🏆' : '💪'}</div>
      <h1>${esc(pick(CHEERS))}</h1>
      <p class="muted">${esc(w.name)} · ${fmtDate(w.start)}</p>
      <div class="tiles">
        <div class="tile"><strong>${st.mins}</strong><span>Minuten</span></div>
        <div class="tile"><strong>${st.sets}</strong><span>Sätze</span></div>
        <div class="tile"><strong>${st.vol ? fmtNum(st.vol, 0) : st.exercises}</strong><span>${st.vol ? 'kg Volumen' : 'Übungen'}</span></div>
      </div>
      ${recs.length ? `<h2>${recs.length === 1 ? 'Neuer Rekord' : recs.length + ' neue Rekorde'}</h2>
        <div class="card list">${recs.map(r => `<div class="row"><span>🏆 <b>${esc(exById(r.exId).name)}</b><br><span class="muted small">${r.m.short}: ${fmtMetric(r.m.kind, r.v)} · vorher ${fmtMetric(r.m.kind, r.prev)}</span></span></div>`).join('')}</div>` : ''}
      <button class="btn primary wide big" data-act="close-layer">Weiter</button>
    </div>`,
  });
}

// ---------- Übungen ----------
function exercisesHTML() {
  return `<header class="top row-between"><h1>Übungen</h1><button class="btn primary small" data-act="ex-new">+ Neue Übung</button></header>
    <input class="search" id="ex-search" type="search" placeholder="Übung suchen…" value="${esc(exFilter.q)}" autocomplete="off">
    <div class="chips scroll">${['', ...GROUPS].map(g => `<button class="chip ${exFilter.group === g ? 'on' : ''}" data-act="ex-group" data-g="${g}">${g || 'Alle'}</button>`).join('')}</div>
    <div id="ex-list">${exListHTML()}</div>`;
}
function exListHTML() {
  const last = lastDoneMap();
  const q = norm(exFilter.q);
  const list = visibleExercises().filter(e => (!exFilter.group || e.group === exFilter.group) && (!q || norm(e.name).includes(q)));
  if (!list.length) return `<p class="muted center pad">Nichts gefunden. ${exFilter.q ? `<button class="link" data-act="ex-new">„${esc(exFilter.q)}“ anlegen</button>` : ''}</p>`;
  return GROUPS.filter(g => list.some(e => e.group === g)).map(g => `<h3 class="month">${g}</h3><div class="card list">${
    list.filter(e => e.group === g).sort((a, b) => a.name.localeCompare(b.name, 'de')).map(e => `
      <button class="row" data-act="ex-open" data-id="${e.id}"><span><b>${esc(e.name)}</b><br><span class="muted small">${measureLabel(e.fields)}${e.perSide ? ' · pro Seite' : ''}</span></span>
      <span class="muted small">${last[e.id] ? relDay(last[e.id]) : ''}</span></button>`).join('')}</div>`).join('');
}

function openExercise(id) {
  const avail = () => METRICS.filter(m => exerciseSeries(D.workouts, id, m).length);
  openLayer({
    full: true, id, metric: null,
    html: l => {
      const ex = exById(l.id);
      const ms = avail();
      if (!ms.find(m => m.key === l.metric)) l.metric = ms[0]?.key || null;
      const m = metricByKey(l.metric);
      const series = m ? exerciseSeries(D.workouts, l.id, m) : [];
      const sessions = D.workouts.filter(w => w.entries.some(e => e.exId === l.id)).reverse();
      const bests = ms.filter(x => !x.session).map(x => {
        const s = exerciseSeries(D.workouts, l.id, x);
        const b = s.reduce((a, p) => (a == null || isBetter(x, p.y, a.y)) ? p : a, null);
        return `<div class="tile"><strong>${fmtMetric(x.kind, b.y)}</strong><span>${x.short} · ${fmtShort(b.x)}</span></div>`;
      }).join('');
      return `<div class="page">
        <div class="page-head"><button class="icon-btn" data-act="close-layer" aria-label="Zurück">${ICON.back}</button><h1>${esc(ex.name)}</h1>
          ${ex.archived === undefined || !ex.archived ? `<button class="btn small" data-act="ex-edit" data-id="${ex.id}">Bearbeiten</button>` : ''}</div>
        <p class="muted">${esc(ex.group)} · ${measureLabel(ex.fields)}${ex.perSide ? ' · pro Seite' : ''}${ex.rest ? ' · Pause ' + fmtTime(ex.rest) : ''}</p>
        ${ex.note ? `<p class="entry-note">📝 ${esc(ex.note)}</p>` : ''}
        ${sessions.length ? `
          <h2>Bestwerte</h2><div class="tiles wrap">${bests}</div>
          <h2>Fortschritt</h2>
          <div class="chips scroll">${ms.map(x => `<button class="chip ${x.key === l.metric ? 'on' : ''}" data-act="metric-pick" data-k="${x.key}">${x.short}</button>`).join('')}</div>
          <div class="card">${m ? `<p class="small muted">${m.label}</p>` + lineChart(series, v => fmtMetric(m.kind, v), fmtShort) : ''}</div>
          <h2>Einträge</h2>
          ${sessions.map(w => {
            const sets = w.entries.filter(e => e.exId === l.id);
            return `<div class="card"><div class="wo-card-top"><strong>${fmtDate(w.start)}</strong><span class="muted small">${esc(w.name)}</span></div>
              ${sets.map(e => `<p class="small">${e.sets.map(s => `<span class="set-pill ${s.warm ? 'warm' : ''}">${esc(setStr(s, e.fields))}</span>`).join(' ')}</p>`).join('')}</div>`;
          }).join('')}` : `<div class="empty"><div class="empty-ico">📈</div><p>Noch nicht trainiert.<br>Sobald du Sätze einträgst, siehst du hier deinen Fortschritt.</p></div>`}
      </div>`;
    },
    mount: p => mountChart(p),
  });
}

// Formular: Übung anlegen / bearbeiten
function openExerciseForm({ id = null, name = '', onSaved } = {}) {
  const ex = id ? exById(id) : null;
  const draft = ex ? structuredClone(ex) : { id: uid(), name, group: exFilter.group || 'Sonstiges', fields: ['w', 'r'], perSide: false, note: '', rest: null };
  openLayer({
    full: true, draft, isNew: !ex, onSaved,
    html: l => {
      const d = l.draft;
      const rests = [[null, `Standard (${fmtTime(D.settings.rest)})`], [30, '0:30'], [60, '1:00'], [90, '1:30'], [120, '2:00'], [150, '2:30'], [180, '3:00'], [240, '4:00'], [300, '5:00']];
      return `<div class="page">
        <div class="page-head"><button class="icon-btn" data-act="close-layer" aria-label="Zurück">${ICON.back}</button><h1>${l.isNew ? 'Neue Übung' : 'Übung bearbeiten'}</h1></div>
        <label class="field"><span>Name</span><input id="exf-name" data-bind="exf-name" value="${esc(d.name)}" placeholder="z. B. Farmers Carry" autocomplete="off"></label>
        <div class="field"><span>Was trägst du pro Satz ein?</span>
          <div class="chips">${FIELD_ORDER.map(f => `<button class="chip big ${d.fields.includes(f) ? 'on' : ''}" data-act="exf-field" data-f="${f}">${FIELDS[f].label}</button>`).join('')}</div>
          <p class="hint">Beispiel-Satz: <b>${d.fields.length ? esc(exampleStr(d.fields)) : '–'}</b><br>
          Tipp: Du kannst die Messart auch später im Training pro Übung umstellen (⇄ Messart) – z. B. Farmers Carry mal auf Strecke, mal auf Zeit.</p>
        </div>
        <label class="field"><span>Muskelgruppe</span><select data-bind="exf-group">${GROUPS.map(g => `<option ${g === d.group ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
        <label class="field check-line"><input type="checkbox" data-bind="exf-side" ${d.perSide ? 'checked' : ''}><span>Einseitig (Werte gelten pro Seite)</span></label>
        <label class="field"><span>Pause nach jedem Satz</span><select data-bind="exf-rest">${rests.map(([v, t]) => `<option value="${v ?? ''}" ${v === d.rest ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="field"><span>Notiz (Technik, Geräte-Einstellung …)</span><textarea data-bind="exf-note" rows="2" placeholder="z. B. Sitz Stufe 4, Griff eng">${esc(d.note)}</textarea></label>
        <button class="btn primary wide big" data-act="exf-save">Speichern</button>
        ${l.isNew ? '' : '<button class="btn ghost danger wide" data-act="exf-delete">Übung löschen</button>'}
      </div>`;
    },
    mount: (p, l) => { if (l.isNew && !l.draft.name) setTimeout(() => p.querySelector('#exf-name')?.focus(), 250); },
  });
}

// Auswahl: Übungen hinzufügen (Mehrfachauswahl)
function openPicker(onDone) {
  openLayer({
    full: true, kind: 'picker', sel: new Set(), q: '', onDone,
    html: l => `<div class="page picker">
      <div class="page-head"><button class="icon-btn" data-act="close-layer" aria-label="Zurück">${ICON.back}</button><h1>Übungen wählen</h1></div>
      <input class="search" id="pick-search" type="search" placeholder="Suchen oder neue Übung eintippen…" value="${esc(l.q)}" autocomplete="off">
      <div id="pick-list">${pickListHTML(l)}</div>
      <div class="sticky-foot"><button class="btn primary wide big" data-act="pick-done" id="pick-done" ${l.sel.size ? '' : 'disabled'}>${pickLabel(l)}</button></div>
    </div>`,
  });
}
const pickLabel = l => l.sel.size ? `${l.sel.size} hinzufügen` : 'Tippe Übungen an';
function pickListHTML(l) {
  const q = norm(l.q);
  const list = visibleExercises().filter(e => !q || norm(e.name).includes(q) || norm(e.group).includes(q));
  const exact = visibleExercises().some(e => norm(e.name) === q);
  const last = lastDoneMap();
  const newBtn = `<button class="row new-row" data-act="pick-new">＋ ${l.q && !exact ? `„${esc(l.q)}“ als neue Übung anlegen` : 'Neue Übung anlegen'}</button>`;
  const recent = !q ? visibleExercises().filter(e => last[e.id]).sort((a, b) => last[b.id] - last[a.id]).slice(0, 6) : [];
  const row = e => `<button class="row pick-row ${l.sel.has(e.id) ? 'on' : ''}" data-act="pick-toggle" data-id="${e.id}">
    <span><b>${esc(e.name)}</b><br><span class="muted small">${measureLabel(e.fields)}${last[e.id] ? ' · ' + relDay(last[e.id]) : ''}</span></span><span class="tick">${ICON.check}</span></button>`;
  return `<div class="card list">${newBtn}</div>`
    + (recent.length ? `<h3 class="month">Zuletzt gemacht</h3><div class="card list">${recent.map(row).join('')}</div>` : '')
    + GROUPS.filter(g => list.some(e => e.group === g)).map(g => `<h3 class="month">${g}</h3><div class="card list">${
      list.filter(e => e.group === g).sort((a, b) => a.name.localeCompare(b.name, 'de')).map(row).join('')}</div>`).join('');
}

// Routine bearbeiten
function openTemplate(tpl) {
  const isNew = !D.templates.some(t => t.id === tpl.id);
  openLayer({
    full: true, draft: structuredClone(tpl), isNew,
    html: l => `<div class="page">
      <div class="page-head"><button class="icon-btn" data-act="close-layer" aria-label="Zurück">${ICON.back}</button><h1>${isNew ? 'Neue Routine' : 'Routine bearbeiten'}</h1></div>
      <label class="field"><span>Name</span><input data-bind="tpl-name" value="${esc(l.draft.name)}" placeholder="z. B. Oberkörper A" autocomplete="off"></label>
      <div class="card list">${l.draft.items.map((it, i) => `
        <div class="row tpl-item">
          <span><b>${esc(exById(it.exId).name)}</b><br><span class="muted small">${measureLabel(exById(it.exId).fields)}</span></span>
          <span class="stepper"><button data-act="tpl-sets" data-i="${i}" data-d="-1" aria-label="Weniger Sätze">−</button><b>${it.sets}</b><button data-act="tpl-sets" data-i="${i}" data-d="1" aria-label="Mehr Sätze">+</button></span>
          <span class="mini-actions"><button data-act="tpl-move" data-i="${i}" data-d="-1" aria-label="Nach oben">↑</button><button data-act="tpl-move" data-i="${i}" data-d="1" aria-label="Nach unten">↓</button><button data-act="tpl-del" data-i="${i}" aria-label="Entfernen">✕</button></span>
        </div>`).join('') || '<p class="muted small pad">Noch keine Übungen.</p>'}</div>
      <p class="muted small">Zahl = Anzahl Sätze</p>
      <button class="btn wide" data-act="tpl-add">+ Übungen hinzufügen</button>
      <button class="btn primary wide big" data-act="tpl-save">Speichern</button>
      ${isNew ? '' : '<button class="btn ghost danger wide" data-act="tpl-remove">Routine löschen</button>'}
    </div>`,
  });
}

// ---------- Mehr ----------
function moreHTML() {
  const s = D.settings;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const isIOS = /iphone|ipad/i.test(navigator.userAgent);
  return `<header class="top"><h1>Mehr</h1></header>
    ${standalone ? '' : `<div class="card"><h2>📲 Als App installieren</h2>
      <p class="muted small">${installEvt ? 'Mit einem Tipp auf den Startbildschirm – dann startet die Kraftkladde wie eine richtige App.'
        : isIOS ? 'In Safari unten auf „Teilen“ → „Zum Home-Bildschirm“.' : 'Im Chrome-Menü (⋮) → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.'}</p>
      ${installEvt ? '<button class="btn primary" data-act="install">Installieren</button>' : ''}</div>`}
    <div class="card">
      <h2>Einstellungen</h2>
      <label class="field"><span>Dein Name</span><input data-bind="set-name" value="${esc(s.name)}" autocomplete="off"></label>
      <label class="field"><span>Standard-Pause zwischen Sätzen</span><select data-bind="set-rest">${[0, 30, 45, 60, 90, 120, 150, 180, 240].map(v => `<option value="${v}" ${v === s.rest ? 'selected' : ''}>${v ? fmtTime(v) : 'Aus'}</option>`).join('')}</select></label>
      <label class="field check-line"><input type="checkbox" data-bind="set-sound" ${s.sound ? 'checked' : ''}><span>Ton am Pausen-Ende</span></label>
      <label class="field check-line"><input type="checkbox" data-bind="set-vibrate" ${s.vibrate ? 'checked' : ''}><span>Vibration am Pausen-Ende (Android)</span></label>
      <label class="field check-line"><input type="checkbox" data-bind="set-wake" ${s.wakeLock ? 'checked' : ''}><span>Bildschirm während des Trainings anlassen</span></label>
    </div>
    <div class="card">
      <h2>Deine Daten</h2>
      <p class="muted small">Alles liegt nur auf diesem Gerät – kein Konto, keine Cloud. Sichere ab und zu ein Backup (z. B. in Google Drive), dann ist nichts verloren, wenn du das Handy wechselst.</p>
      <p class="small">Letztes Backup: <b>${D.lastBackup ? fmtDate(D.lastBackup) + ' (' + relDay(D.lastBackup) + ')' : 'noch nie'}</b></p>
      <div class="btn-col">
        <button class="btn primary wide" data-act="backup">💾 Backup sichern</button>
        <button class="btn wide" data-act="restore">Backup einspielen</button>
        <button class="btn wide" data-act="csv">Als Tabelle exportieren (CSV für Excel)</button>
      </div>
      <input type="file" id="restore-file" accept="application/json,.json" hidden>
    </div>
    <div class="card">
      <h2>So funktioniert's</h2>
      <ul class="howto small">
        <li><b>Messart:</b> Jede Übung hat eigene Felder – Gewicht, Wiederholungen, Strecke, Zeit, frei kombinierbar. Im Training per „⇄ Messart“ umstellbar.</li>
        <li><b>Vorher-Werte:</b> Graue Zahlen sind deine Werte vom letzten Mal. Abhaken (✓) ohne Eintippen übernimmt sie.</li>
        <li><b>Zeit eingeben:</b> „90“ = 1:30, „130“ = 1:30, „45“ = 0:45 – oder die Stoppuhr nutzen.</li>
        <li><b>Aufwärmsatz:</b> Tipp auf die Satznummer → „W“. Aufwärmsätze zählen nicht für Rekorde.</li>
        <li><b>Rekorde:</b> 🏆 erscheint sofort, wenn du eine Bestmarke knackst.</li>
      </ul>
    </div>
    <button class="btn ghost danger wide" data-act="reset">Alle Daten löschen</button>
    <p class="muted small center pad">Kraftkladde ${APP_VERSION}</p>`;
}

async function shareOrDownload(filename, text, type) {
  const blob = new Blob([text], { type });
  const file = new File([blob], filename, { type });
  if (navigator.canShare?.({ files: [file] }) && /android|iphone|ipad/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: filename }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return true;
}

function csvExport() {
  const q = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const n = v => v == null ? '' : String(v).replace('.', ',');
  const rows = [['Datum', 'Training', 'Übung', 'Satz', 'Aufwärmen', 'Gewicht (kg)', 'Wiederholungen', 'Strecke (m)', 'Zeit (s)', 'Notiz']];
  for (const w of D.workouts) for (const e of w.entries) e.sets.forEach((s, i) =>
    rows.push([dayKey(w.start), w.name, exById(e.exId).name, i + 1, s.warm ? 'ja' : '', n(s.w), n(s.r), n(s.d), n(s.t), e.note || '']));
  return '\uFEFF' + rows.map(r => r.map(q).join(';')).join('\r\n');
}

// ---------- Aktionen ----------
const entryOf = el => { const row = el.closest('[data-e]'); return D.active.entries[+row.dataset.e]; };

const actions = {
  'tab'(el) { tab = el.dataset.tab; window.scrollTo(0, 0); render(); },
  'close-layer'() { closeLayer(); },
  'confirm-ok'() { const l = topLayer(); closeLayer(() => l.onOk()); },

  // Start
  'start-empty'() { startWorkout(); },
  'backlog'() { startWorkout({ name: 'Training', mode: 'edit' }); toast('Datum und Dauer oben anpassen'); },
  'tpl-start'(el) {
    const t = D.templates.find(x => x.id === el.dataset.id);
    startWorkout({ name: t.name, templateId: t.id, entries: t.items.filter(i => D.exercises.some(e => e.id === i.exId)) });
  },
  'tpl-new'() { openTemplate({ id: uid(), name: '', items: [] }); },
  'tpl-edit'(el) { openTemplate(D.templates.find(x => x.id === el.dataset.id)); },

  // Training
  'add-ex'() {
    openPicker(ids => {
      for (const id of ids) D.active.entries.push(newEntry(id));
      save(); renderView();
      setTimeout(() => document.querySelectorAll('.entry')[D.active.entries.length - ids.length]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    });
  },
  'add-set'(el) {
    const en = entryOf(el);
    const last = en.sets.at(-1);
    const s = { warm: false, done: false };
    if (last) for (const f of en.fields) if (last[f] != null) s[f] = last[f];
    en.sets.push(s); save(); renderView();
  },
  'set-done'(el) {
    unlockAudio();
    const row = el.closest('.set-row');
    const en = D.active.entries[+row.dataset.e], si = +row.dataset.s, s = en.sets[si];
    if (s.done) { s.done = false; save(); renderView(); return; }
    const prev = lastSetsFor(en.exId, D.active.editOf);
    const p = prev?.sets[si];
    const fields = sortFields(en.fields);
    for (const f of fields) if (s[f] == null && p && prev.fields.includes(f) && p[f] != null) s[f] = p[f];
    if (!hasValue(s, fields)) {
      row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake');
      toast('Trag erst einen Wert ein 🙂');
      return;
    }
    s.done = true;
    const pr = !s.warm && checkPR(en, si);
    const ex = exById(en.exId);
    startRest(ex.rest ?? D.settings.rest);
    save(); renderView(); renderRestbar();
    navigator.vibrate?.(15);
    if (pr) { toast(`🏆 Neuer Rekord! ${pr}`, 'gold'); navigator.vibrate?.([40, 60, 40]); }
  },
  'set-menu'(el) {
    const row = el.closest('.set-row');
    const e = +row.dataset.e, s = +row.dataset.s;
    openLayer({
      e, s,
      html: l => {
        const set = D.active.entries[l.e].sets[l.s];
        return `<div class="sheet-body"><h2>Satz ${set.warm ? '(Aufwärmen)' : l.s + 1}</h2><div class="btn-col">
          <button class="btn wide" data-act="set-warm">${set.warm ? 'Als normalen Satz markieren' : 'Als Aufwärmsatz markieren (W)'}</button>
          <button class="btn danger wide" data-act="set-delete">Satz löschen</button>
          <button class="btn ghost wide" data-act="close-layer">Abbrechen</button></div></div>`;
      },
    });
  },
  'set-warm'() { const l = topLayer(); const s = D.active.entries[l.e].sets[l.s]; s.warm = !s.warm; save(); closeLayer(renderView); },
  'set-delete'() { const l = topLayer(); D.active.entries[l.e].sets.splice(l.s, 1); save(); closeLayer(renderView); },
  'entry-menu'(el) {
    const e = +el.dataset.e;
    openLayer({
      e,
      html: l => {
        const en = D.active.entries[l.e];
        return `<div class="sheet-body"><h2>${esc(exById(en.exId).name)}</h2>
          <label class="field"><span>Notiz für heute</span><textarea data-bind="entry-note" rows="2" placeholder="z. B. Griff gewechselt, Schulter zwickt">${esc(en.note)}</textarea></label>
          <div class="btn-col">
            <button class="btn wide" data-act="entry-mode-from-menu">⇄ Messart ändern</button>
            <div class="btn-row"><button class="btn" data-act="entry-move" data-d="-1" ${l.e === 0 ? 'disabled' : ''}>↑ Nach oben</button><button class="btn" data-act="entry-move" data-d="1" ${l.e === D.active.entries.length - 1 ? 'disabled' : ''}>↓ Nach unten</button></div>
            <button class="btn danger wide" data-act="entry-remove">Übung entfernen</button>
            <button class="btn ghost wide" data-act="close-layer">Fertig</button>
          </div></div>`;
      },
      onClose: () => renderView(),
    });
  },
  'entry-move'(el) {
    const l = topLayer(), d = +el.dataset.d, arr = D.active.entries, j = l.e + d;
    if (j < 0 || j >= arr.length) return;
    [arr[l.e], arr[j]] = [arr[j], arr[l.e]]; l.e = j; save(); paintLayer(l);
  },
  'entry-remove'() {
    const l = topLayer();
    D.active.entries.splice(l.e, 1); save(); closeLayer();
  },
  'entry-mode-from-menu'() { const e = topLayer().e; closeLayer(() => openModeSheet(e)); },
  'entry-mode'(el) { openModeSheet(+el.dataset.e); },
  'mode-field'(el) {
    const l = topLayer(), f = el.dataset.f;
    l.sel.has(f) ? l.sel.delete(f) : l.sel.add(f);
    paintLayer(l);
  },
  'mode-apply'() {
    const l = topLayer();
    if (!l.sel.size) { toast('Mindestens ein Feld auswählen'); return; }
    const en = D.active.entries[l.e];
    en.fields = sortFields([...l.sel]);
    if (l.el.querySelector('#mode-default')?.checked) {
      const ex = D.exercises.find(x => x.id === en.exId); if (ex) ex.fields = [...en.fields];
    }
    save(); closeLayer(renderView);
  },
  'stopwatch'(el) { openStopwatch(+el.dataset.e); },
  'sw-toggle'() {
    const l = topLayer();
    if (l.running) { l.acc += Date.now() - l.since; l.running = false; }
    else { l.since = Date.now(); l.running = true; unlockAudio(); }
    paintLayer(l);
  },
  'sw-reset'() { const l = topLayer(); l.acc = 0; l.running = false; paintLayer(l); },
  'sw-apply'() {
    const l = topLayer();
    const sec = Math.round(swElapsed(l));
    const en = D.active.entries[l.e];
    let s = en.sets.find(x => !x.done && x.t == null) || en.sets.find(x => !x.done);
    if (!s) { const last = en.sets.at(-1); s = { warm: false, done: false }; if (last?.w != null) s.w = last.w; en.sets.push(s); }
    s.t = sec; save();
    closeLayer(() => { renderView(); toast(`${fmtTime(sec)} eingetragen`); });
  },
  'rest-adj'(el) { const A = D.active; A.restEnd += +el.dataset.d * 1000; A.restTotal = Math.max(A.restTotal + +el.dataset.d, 1); save(); tickRest(); },
  'rest-skip'() { D.active.restEnd = null; save(); renderRestbar(); },
  'finish'() {
    const A = D.active;
    const all = A.entries.flatMap(e => e.sets.map(s => ({ s, f: sortFields(e.fields) })));
    const done = all.filter(x => x.s.done && hasValue(x.s, x.f)).length;
    const undoneVals = all.filter(x => !x.s.done && hasValue(x.s, x.f)).length;
    if (A.mode !== 'live') { // Nachtragen/Bearbeiten: alles mit Werten zählt
      if (!done && !undoneVals) { toast('Noch keine Werte eingetragen'); return; }
      const { w, wasEdit } = saveActive(true);
      tab = wasEdit ? 'history' : 'train'; render();
      toast(wasEdit ? 'Änderungen gespeichert ✓' : 'Training nachgetragen ✓');
      return;
    }
    if (!done && !undoneVals) {
      confirmSheet({ title: 'Noch nichts eingetragen', text: 'Willst du das Training verwerfen?', ok: 'Verwerfen', danger: true, onOk: discardActive });
      return;
    }
    openLayer({
      html: () => `<div class="sheet-body"><h2>Training beenden?</h2>
        <p class="muted">${done} ${done === 1 ? 'Satz' : 'Sätze'} abgehakt.${undoneVals ? ` ${undoneVals} ${undoneVals === 1 ? 'Satz hat' : 'Sätze haben'} Werte, ${undoneVals === 1 ? 'ist' : 'sind'} aber nicht abgehakt.` : ''}</p>
        <div class="btn-col">
          ${undoneVals ? `<button class="btn primary wide" data-act="finish-save" data-all="1">Alles speichern</button>
            ${done ? `<button class="btn wide" data-act="finish-save">Nur abgehakte speichern</button>` : ''}`
            : '<button class="btn primary wide" data-act="finish-save">Speichern</button>'}
          <button class="btn ghost wide" data-act="close-layer">Weiter trainieren</button>
        </div></div>`,
    });
  },
  'finish-save'(el) {
    const { w } = saveActive(!!el.dataset.all);
    closeLayer(() => { tab = 'train'; render(); openSummary(w); });
  },
  'discard'() {
    confirmSheet({ title: D.active.editOf ? 'Änderungen verwerfen?' : 'Training verwerfen?', text: D.active.editOf ? 'Das gespeicherte Training bleibt wie es war.' : 'Alle Einträge dieses Trainings gehen verloren.', ok: 'Verwerfen', danger: true, onOk: discardActive });
  },

  // Verlauf
  'wo-open'(el) { openWorkout(el.dataset.id); },
  'wo-repeat'() {
    const w = D.workouts.find(x => x.id === topLayer().id);
    if (D.active) { toast('Beende erst dein laufendes Training.'); return; }
    closeLayer(() => startWorkout({ name: w.name, templateId: w.templateId, entries: w.entries.map(e => ({ exId: e.exId, sets: e.sets.length, fields: e.fields })) }));
  },
  'wo-edit'() {
    const w = D.workouts.find(x => x.id === topLayer().id);
    if (D.active) { toast('Beende erst dein laufendes Training.'); return; }
    D.active = workoutToActive(w); save();
    closeLayer(() => { tab = 'train'; window.scrollTo(0, 0); render(); });
  },
  'wo-to-tpl'() {
    const w = D.workouts.find(x => x.id === topLayer().id);
    openTemplate({ id: uid(), name: w.name, items: w.entries.map(e => ({ exId: e.exId, sets: e.sets.filter(s => !s.warm).length || e.sets.length })) });
  },
  'wo-delete'() {
    const id = topLayer().id;
    confirmSheet({ title: 'Training löschen?', text: 'Das lässt sich nicht rückgängig machen.', ok: 'Löschen', danger: true,
      onOk: () => { D.workouts = D.workouts.filter(w => w.id !== id); save(); closeLayer(() => { render(); toast('Gelöscht'); }); } });
  },

  // Übungen
  'ex-open'(el) { openExercise(el.dataset.id); },
  'ex-group'(el) { exFilter.group = el.dataset.g; renderView(); },
  'ex-new'() { openExerciseForm({ name: exFilter.q, onSaved: ex => openExercise(ex.id) }); },
  'ex-edit'(el) { openExerciseForm({ id: el.dataset.id }); },
  'metric-pick'(el) { const l = topLayer(); l.metric = el.dataset.k; paintLayer(l); },
  'exf-field'(el) {
    const l = topLayer(), f = el.dataset.f, fs = l.draft.fields;
    l.draft.fields = fs.includes(f) ? fs.filter(x => x !== f) : sortFields([...fs, f]);
    paintLayer(l);
  },
  'exf-save'() {
    const l = topLayer(), d = l.draft;
    d.name = d.name.trim();
    if (!d.name) { toast('Gib der Übung einen Namen'); l.el.querySelector('#exf-name')?.focus(); return; }
    if (!d.fields.length) { toast('Wähl mindestens einen Messwert'); return; }
    if (D.exercises.some(e => e.id !== d.id && !e.archived && norm(e.name) === norm(d.name))) { toast('Diese Übung gibt es schon'); return; }
    const i = D.exercises.findIndex(e => e.id === d.id);
    if (i >= 0) D.exercises[i] = d; else D.exercises.push(d);
    save();
    const cb = l.onSaved;
    closeLayer(() => {
      layers.forEach(x => (x.kind === 'picker' ? (x.el.querySelector('#pick-list').innerHTML = pickListHTML(x)) : paintLayer(x)));
      renderView(); toast('Gespeichert ✓'); cb?.(d);
    });
  },
  'exf-delete'() {
    const id = topLayer().draft.id;
    const used = D.workouts.some(w => w.entries.some(e => e.exId === id)) || D.templates.some(t => t.items.some(i => i.exId === id));
    confirmSheet({ title: 'Übung löschen?', text: used ? 'Deine bisherigen Einträge bleiben im Verlauf erhalten.' : '', ok: 'Löschen', danger: true,
      onOk: () => {
        const ex = D.exercises.find(e => e.id === id);
        if (used) ex.archived = true;
        else { D.exercises = D.exercises.filter(e => e.id !== id); if (ex?.seed) D.removedSeeds.push(id); }
        D.templates.forEach(t => (t.items = t.items.filter(i => i.exId !== id)));
        save();
        // Formular und ggf. Detailansicht schließen
        closeLayer(() => { if (topLayer()?.id === id) closeLayer(render); else render(); });
      } });
  },

  // Auswahl
  'pick-toggle'(el) {
    const l = topLayer(), id = el.dataset.id;
    l.sel.has(id) ? l.sel.delete(id) : l.sel.add(id);
    l.el.querySelectorAll(`[data-id="${id}"]`).forEach(b => b.classList.toggle('on', l.sel.has(id)));
    const btn = l.el.querySelector('#pick-done'); btn.textContent = pickLabel(l); btn.disabled = !l.sel.size;
  },
  'pick-new'() {
    const l = topLayer();
    openExerciseForm({ name: l.q, onSaved: ex => { l.sel.add(ex.id); l.q = ''; paintLayer(l); } });
  },
  'pick-done'() { const l = topLayer(); closeLayer(() => l.onDone([...l.sel])); },

  // Routinen
  'tpl-sets'(el) { const l = topLayer(), it = l.draft.items[+el.dataset.i]; it.sets = Math.min(10, Math.max(1, it.sets + +el.dataset.d)); paintLayer(l); },
  'tpl-move'(el) {
    const l = topLayer(), i = +el.dataset.i, j = i + +el.dataset.d, a = l.draft.items;
    if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; paintLayer(l);
  },
  'tpl-del'(el) { const l = topLayer(); l.draft.items.splice(+el.dataset.i, 1); paintLayer(l); },
  'tpl-add'() {
    const l = topLayer();
    openPicker(ids => { for (const id of ids) l.draft.items.push({ exId: id, sets: 3 }); paintLayer(l); });
  },
  'tpl-save'() {
    const l = topLayer(), d = l.draft;
    d.name = d.name.trim();
    if (!d.name) { toast('Gib der Routine einen Namen'); return; }
    const i = D.templates.findIndex(t => t.id === d.id);
    if (i >= 0) D.templates[i] = d; else D.templates.push(d);
    save(); closeLayer(() => { render(); toast('Routine gespeichert ✓'); });
  },
  'tpl-remove'() {
    const id = topLayer().draft.id;
    confirmSheet({ title: 'Routine löschen?', text: 'Deine Trainings im Verlauf bleiben erhalten.', ok: 'Löschen', danger: true,
      onOk: () => { D.templates = D.templates.filter(t => t.id !== id); save(); closeLayer(render); } });
  },

  // Mehr
  async 'install'() { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; renderView(); },
  async 'backup'() {
    const ok = await shareOrDownload(`kraftkladde-backup-${dayKey(Date.now())}.json`, JSON.stringify({ ...D, active: null }, null, 1), 'application/json');
    if (ok) { D.lastBackup = Date.now(); save(); renderView(); toast('Backup erstellt ✓'); }
  },
  'restore'() { $('#restore-file').click(); },
  async 'csv'() { await shareOrDownload(`kraftkladde-${dayKey(Date.now())}.csv`, csvExport(), 'text/csv'); },
  'reset'() {
    confirmSheet({ title: 'Wirklich alles löschen?', text: 'Alle Trainings, Übungen und Routinen auf diesem Gerät werden gelöscht. Mach vorher lieber ein Backup.', ok: 'Alles löschen', danger: true,
      onOk: () => { D = resetAll(); tab = 'train'; render(); toast('Alles zurückgesetzt'); } });
  },
};

function openModeSheet(e) {
  const en = D.active.entries[e];
  openLayer({
    e, sel: new Set(en.fields),
    html: l => `<div class="sheet-body"><h2>Was misst du heute?</h2>
      <p class="muted small">${esc(exById(en.exId).name)} mal auf Zeit, mal auf Strecke? Stell es hier für dieses Training um.</p>
      <div class="chips">${FIELD_ORDER.map(f => `<button class="chip big ${l.sel.has(f) ? 'on' : ''}" data-act="mode-field" data-f="${f}">${FIELDS[f].label}</button>`).join('')}</div>
      <p class="hint">Beispiel-Satz: <b>${l.sel.size ? esc(exampleStr([...l.sel])) : '–'}</b></p>
      <label class="field check-line"><input type="checkbox" id="mode-default"><span>Als Standard für diese Übung merken</span></label>
      <div class="btn-col"><button class="btn primary wide" data-act="mode-apply">Übernehmen</button><button class="btn ghost wide" data-act="close-layer">Abbrechen</button></div></div>`,
  });
}

function discardActive() { D.active = null; save(); render(); }

// ---------- Ereignisse ----------
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) { ev.preventDefault(); fn(el, ev); }
});

document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.matches('.val[data-f]')) {
    const row = t.closest('.set-row');
    const s = D.active.entries[+row.dataset.e].sets[+row.dataset.s];
    s[t.dataset.f] = t.dataset.f === 't' ? parseTime(t.value) : num(t.value);
    save();
    return;
  }
  if (t.id === 'ex-search') { exFilter.q = t.value; $('#ex-list').innerHTML = exListHTML(); return; }
  if (t.id === 'pick-search') { const l = topLayer(); l.q = t.value; l.el.querySelector('#pick-list').innerHTML = pickListHTML(l); return; }
  bind(t);
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.matches('.val[data-f="t"]')) { const v = parseTime(t.value); t.value = v == null ? '' : fmtTime(v); return; }
  if (t.id === 'restore-file') { restoreFrom(t.files[0]); t.value = ''; return; }
  if (t.matches('select, input[type=checkbox], input[type=date]')) bind(t);
});
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Enter' || !ev.target.matches('.val')) return;
  ev.preventDefault();
  const all = [...document.querySelectorAll('#view .val')];
  const next = all[all.indexOf(ev.target) + 1];
  next ? next.focus() : ev.target.blur();
});
document.addEventListener('focusin', ev => { if (ev.target.matches('.val')) setTimeout(() => ev.target.select?.(), 0); });

function bind(t) {
  const k = t.dataset.bind; if (!k) return;
  const l = topLayer(), A = D.active, S = D.settings;
  switch (k) {
    case 'wo-name': A.name = t.value; break;
    case 'wo-date': if (t.value) { const [y, m, d] = t.value.split('-').map(Number); const dt = new Date(A.start); dt.setFullYear(y, m - 1, d); A.start = dt.getTime(); } break;
    case 'wo-dur': A.durationMin = Math.max(1, parseInt(t.value, 10) || 60); break;
    case 'entry-note': A.entries[l.e].note = t.value; break;
    case 'tpl-name': l.draft.name = t.value; return;
    case 'exf-name': l.draft.name = t.value; return;
    case 'exf-group': l.draft.group = t.value; return;
    case 'exf-side': l.draft.perSide = t.checked; return;
    case 'exf-rest': l.draft.rest = t.value === '' ? null : +t.value; return;
    case 'exf-note': l.draft.note = t.value; return;
    case 'set-name': S.name = t.value.trim(); break;
    case 'set-rest': S.rest = +t.value; break;
    case 'set-sound': S.sound = t.checked; if (t.checked) { unlockAudio(); beep(); } break;
    case 'set-vibrate': S.vibrate = t.checked; if (t.checked) navigator.vibrate?.(100); break;
    case 'set-wake': S.wakeLock = t.checked; syncWakeLock(); break;
  }
  save();
}

async function restoreFrom(file) {
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { toast('Datei konnte nicht gelesen werden'); return; }
  if (!isValid(data)) { toast('Das ist kein Kraftkladde-Backup'); return; }
  confirmSheet({ title: 'Backup einspielen?', text: `${data.workouts.length} Trainings vom Backup ersetzen die aktuellen Daten auf diesem Gerät.`, ok: 'Einspielen',
    onOk: () => { D = replaceAll(data); tab = 'train'; render(); toast('Backup eingespielt ✓'); } });
}

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (tab === 'more') renderView(); });

// ---------- Los ----------
history.replaceState({ root: 1 }, '');
navigator.storage?.persist?.();
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded && !D.active) { reloaded = true; location.reload(); } });
}
render();
