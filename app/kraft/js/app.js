// Kraftkladde – UI-Logik. Alles läuft lokal, ohne Server.
import { db, load, save, replaceAll, resetAll, isValid } from './store.js';
import { FIELDS, FIELD_ORDER, GROUPS, EQUIP, KINDS, BANDS, MUSCLES, weightCol, sortFields, musclesOf } from './exercises.js';
import { KNOWLEDGE, recommendation, SCIENCE_NOTE } from './knowledge.js';
import { METRICS, metricByKey, fmtMetric, exerciseSeries, computeRecords, bestOf, isBetter, workoutStats, setMetricFilter, metricAllowed } from './stats.js';
import { lineChart, mountChart } from './chart.js';
import { parseGymRun, buildImport } from './import.js';
import { RANGES, rangeStart, summary, buckets, strengthIndex, topGains, setLoad, stackedBarsSVG, indexLineSVG, patternBarsHTML, balanceHTML, bodyMapHTML, balanceInsights, insightsHTML, mountTips } from './progress.js';
import {
  $, esc, uid, norm, num, fmtNum, fmtKg, fmtTime, parseTime, fmtDist, dayKey, fmtDate, fmtDateLong, fmtShort,
  fmtClock, monthLabel, weekStart, daysAgo, relDay, pick,
} from './util.js';

const APP_VERSION = '2.4.0';
let D = load();
save(); // Startdaten bzw. nachgezogene Übungen sofort sichern
let tab = 'train';
let exFilter = { q: '', group: '' };
let installEvt = null;
let progRange = 'm3';

// ---------- Texte ----------
const CHEERS = [
  'Stark. Das Eisen hat Respekt vor dir.', 'Gespeichert. Die Muskeln wachsen jetzt weiter.',
  'Sauber abgeliefert – genau so geht das.', 'Erledigt. Die Couch hast du dir verdient.',
  'Wieder ein Baustein mehr. Konstanz schlägt alles.', 'Gutes Training. Dein Laufen sagt danke.',
];
const TAGLINES = [
  'Ein Satz nach dem anderen.', 'Kleine Schritte, schwere Gewichte.', 'Dein Ich von morgen sagt danke.',
  'Konstanz schlägt Motivation.', 'Nicht perfekt – aber gemacht.', 'Stark sein hilft auch beim Laufen.',
];

// ---------- Helfer ----------
const exById = id => D.exercises.find(e => e.id === id) || { id, name: 'Gelöschte Übung', group: 'Mobilität', equip: 'sonst', fields: ['w', 'r'], perSide: false, note: '' };
// Kein 1RM/Volumen bei Körpergewicht; kein 1RM bei Core, Fuß/Reha, Mobilität, Ausdauer (fachlich nicht sinnvoll)
const NO_1RM = new Set(['Core', 'Fuß & Reha', 'Mobilität', 'Ausdauer']);
setMetricFilter((exId, m) => {
  const ex = exById(exId);
  if ((m.key === 'e1rm' || m.key === 'vol') && ex.equip === 'kg') return false;
  if (m.key === 'e1rm' && NO_1RM.has(ex.group)) return false;
  return true;
});
const visibleExercises = () => D.exercises.filter(e => !e.archived);
const measureLabel = (fs, ex) => {
  const f = sortFields(fs);
  if (!f.length) return 'Nur abhaken';
  return f.map(k => k === 'w' && ex?.equip === 'kg' ? 'Zusatzgewicht' : FIELDS[k].label).join(' · ');
};
const shortName = n => n.replace(/\s*\(.*\)\s*$/, '');
// Kurze Namen für Schalter – nur kürzen, wenn dadurch keine Verwechslung entsteht
const chipNames = ids => { const sh = ids.map(id => shortName(exById(id).name)); return ids.map((id, i) => sh.filter(x => x === sh[i]).length > 1 ? exById(id).name : sh[i]); };
const sortWorkouts = () => D.workouts.sort((a, b) => a.start - b.start);
const kindOf = w => w.kind || 'kraft';
const LOC = { studio: 'Studio', home: 'Zuhause' };

const barOf = ex => (ex && ex.bar > 0 ? ex.bar : 0);
// plates = true: bei Stangen-Übungen nur die Scheiben anzeigen (wie im Eingabefeld)
function setStr(s, fields, ex, plates = false) {
  const f = sortFields(fields);
  if (!f.length) return '✓ erledigt';
  const has = k => f.includes(k) && s[k] != null;
  let main = '';
  if (has('w') && !(ex?.equip === 'kg' && !s.w)) main = (ex?.equip === 'kg' ? '+' : '') + fmtKg(plates ? Math.max(0, s.w - barOf(ex)) : s.w);
  if (has('r')) main = main ? `${main} × ${s.r}` : `${s.r} Wdh.`;
  const rest = [];
  if (has('b')) rest.unshift(BANDS[s.b] || '');
  if (has('d')) rest.push(fmtDist(s.d));
  if (has('c')) rest.push(fmtNum(s.c, 0) + ' kcal');
  if (has('t')) rest.push(fmtTime(s.t));
  return [main, ...rest].filter(Boolean).join(' · ') || '–';
}
const exampleStr = (fields, equip) => setStr({ w: equip === 'kg' ? 10 : 22, r: 10, d: 40, t: 90, c: 20, b: 1 }, fields, { equip });

function lastSetsFor(exId, excludeId) {
  for (let i = D.workouts.length - 1; i >= 0; i--) {
    const w = D.workouts[i];
    if (w.id === excludeId || !w.entries) continue;
    const en = w.entries.find(e => e.exId === exId);
    if (en) return { sets: en.sets, fields: en.fields, date: w.start };
  }
  return null;
}
function lastDoneMap() {
  const m = {};
  for (const w of D.workouts) for (const e of w.entries || []) m[e.exId] = w.start;
  return m;
}
function parseDuration(str) { // "45" = Minuten, "52:30" = m:s, "1:52:30" = h:m:s
  str = String(str || '').trim();
  if (!str) return null;
  if (!str.includes(':')) { const m = num(str); return m == null ? null : Math.round(m * 60); }
  return parseTime(str);
}

const ICON = {
  check: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dots: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/></svg>',
  link: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  train: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6M6 6.5v11M18 6.5v11M21 9v6M6 12h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  history: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 10h17M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18l5-6 4 3 7-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dumbbell: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 9h8M8 12h8M8 15h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
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
  const tabs = [['train', 'Training', ICON.train], ['history', 'Chronik', ICON.history], ['progress', 'Fortschritt', ICON.list], ['exercises', 'Übungen', ICON.dumbbell], ['more', 'Mehr', ICON.more]];
  $('#tabs').innerHTML = tabs.map(([k, l, i]) => `<button class="tab ${tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}" aria-label="${l}">${i}<span>${l}</span>${k === 'train' && D.active ? '<i class="live-dot"></i>' : ''}</button>`).join('');
}

function renderView() {
  const v = $('#view');
  v.innerHTML = tab === 'train' ? (D.active ? workoutHTML() : homeHTML())
    : tab === 'history' ? historyHTML()
    : tab === 'progress' ? progressHTML()
    : tab === 'exercises' ? exercisesHTML()
    : moreHTML();
  mountChart(v);
  mountTips(v);
}

// ---------- Kennzahlen Start ----------
function weekStats() {
  const now = Date.now();
  const wk = weekStart(now).getTime();
  const thisWeek = D.workouts.filter(w => w.start >= wk);
  const weeks = new Set(D.workouts.map(w => weekStart(w.start).getTime()));
  for (const e of D.estimates) if (e.count >= 4) { // geschätzte Monate: jede Woche zählt
    const [y, m] = e.month.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    while (d.getMonth() === m - 1) { weeks.add(weekStart(d).getTime()); d.setDate(d.getDate() + 7); }
  }
  let cur = weekStart(now); if (!weeks.has(cur.getTime())) cur.setDate(cur.getDate() - 7);
  let streak = 0; while (weeks.has(cur.getTime())) { streak++; cur.setDate(cur.getDate() - 7); }
  const total = D.workouts.filter(w => kindOf(w) !== 'lauf').length + D.estimates.reduce((a, e) => a + e.count, 0);
  return { thisWeek, streak, total };
}

// ---------- Start ----------
function homeHTML() {
  const h = new Date().getHours();
  const hello = h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend';
  const { thisWeek, streak, total } = weekStats();
  const recs = computeRecords(D.workouts).slice(-4).reverse();
  const backupDue = D.workouts.length >= 5 && (!D.lastBackup || daysAgo(D.lastBackup) > 30);
  const lastByTpl = {};
  for (const w of D.workouts) if (w.templateId) lastByTpl[w.templateId] = w.start;
  const kindsWeek = Object.keys(KINDS).map(k => [k, thisWeek.filter(w => kindOf(w) === k).length]).filter(x => x[1]);

  return `
  <header class="top">
    <p class="eyebrow">${hello}${D.settings.name ? ', ' + esc(D.settings.name) : ''}</p>
    <h1>Kraftkladde</h1>
    <p class="muted">${esc(pick(TAGLINES))}</p>
  </header>
  <div class="tiles">
    <div class="tile"><strong>${thisWeek.length}</strong><span>diese Woche${kindsWeek.length ? '<br>' + kindsWeek.map(([k, n]) => `<i class="kdot k-${k}"></i>${n}`).join(' ') : ''}</span></div>
    <div class="tile"><strong>${streak}</strong><span>${streak === 1 ? 'Woche' : 'Wochen'} am Stück</span></div>
    <div class="tile"><strong>${total}</strong><span>Trainings gesamt</span></div>
  </div>
  <button class="btn hero" data-act="start-empty"><span>Training starten</span><small>frei beginnen, Übungen unterwegs hinzufügen</small></button>
  ${backupDue ? `<button class="banner" data-act="tab" data-tab="more">Zeit für ein Backup – deine Daten liegen nur auf diesem Handy.</button>` : ''}
  <section>
    <div class="sec-head"><h2>Routinen</h2><button class="link" data-act="tpl-new">+ Neue Routine</button></div>
    ${D.templates.length ? D.templates.map(t => `
      <div class="card tpl">
        <button class="tpl-main" data-act="tpl-start" data-id="${t.id}">
          <strong><i class="kdot k-${t.kind || 'kraft'}"></i>${esc(t.name)}</strong>
          <span class="muted small">${t.items.length} ${t.kind === 'hybrid' ? 'Stationen' : 'Plätze'}${hasHome(t) ? ' · Studio & Zuhause' : ''}</span>
          <span class="muted small">${lastByTpl[t.id] ? 'Zuletzt ' + relDay(lastByTpl[t.id]) : 'Noch nie gemacht'}</span>
        </button>
        <div class="tpl-actions">
          <button class="btn primary small" data-act="tpl-start" data-id="${t.id}">Start</button>
          <button class="icon-btn" data-act="tpl-edit" data-id="${t.id}" aria-label="Routine bearbeiten">${ICON.dots}</button>
        </div>
      </div>`).join('') : '<p class="muted small">Leg dir Routinen an, dann startest du mit einem Tipp.</p>'}
  </section>
  <section>
    <div class="sec-head"><h2>Letzte 16 Wochen</h2><button class="link" data-act="tab" data-tab="history">Chronik</button></div>
    ${heatmapHTML()}
  </section>
  ${recs.length ? `<section><div class="sec-head"><h2>Neueste Rekorde</h2></div>
    <div class="card list">${recs.map(r => `<button class="row" data-act="ex-open" data-id="${r.exId}"><span><b>${esc(exById(r.exId).name)}</b><br><span class="muted small">${r.m.short}: <span class="up">${fmtMetric(r.m.kind, r.v)}</span> · vorher ${fmtMetric(r.m.kind, r.prev)}</span></span><span class="muted small">${relDay(r.date)}</span></button>`).join('')}</div></section>` : ''}
  <div class="btn-row"><button class="btn ghost" data-act="run-new">🏃 Lauf eintragen</button><button class="btn ghost" data-act="backfill">Nachtragen</button></div>`;
}

function heatmapHTML() {
  const days = {};
  for (const w of D.workouts) (days[dayKey(w.start)] ||= new Set()).add(kindOf(w));
  const start = weekStart(Date.now()); start.setDate(start.getDate() - 15 * 7);
  const today = dayKey(Date.now());
  let cells = '';
  const d = new Date(start);
  for (let i = 0; i < 16 * 7; i++) {
    const k = dayKey(d);
    const ks = [...(days[k] || [])];
    const style = ks.length === 1 ? `background:var(--k-${ks[0]})` : ks.length > 1 ? `background:linear-gradient(135deg,var(--k-${ks[0]}) 50%,var(--k-${ks[1]}) 50%)` : '';
    cells += `<i class="${k > today ? 'fut' : ''}${k === today ? ' today' : ''}" style="${style}" title="${k}"></i>`;
    d.setDate(d.getDate() + 1);
  }
  return `<div class="card heat-wrap"><div class="heat">${cells}</div>${legendHTML()}</div>`;
}
const legendHTML = () => `<div class="legend">${Object.entries(KINDS).map(([k, v]) => `<span><i class="kdot k-${k}"></i>${v.label}</span>`).join('')}</div>`;

// ---------- Laufendes Training ----------
function supersetMembers(g) { return D.active.entries.map((e, i) => e.group === g ? i : -1).filter(i => i >= 0); }

function workoutHTML() {
  const A = D.active;
  const live = A.mode === 'live';
  const head = `<header class="wo-head">
    <div class="wo-title">
      <input class="wo-name" data-bind="wo-name" value="${esc(A.name)}" placeholder="Training" aria-label="Name des Trainings">
      <div class="wo-meta">
        ${live ? `<span class="elapsed"><span id="elapsed">${fmtTime((Date.now() - A.start) / 1000)}</span></span>`
          : `<input type="date" data-bind="wo-date" value="${dayKey(A.start)}" aria-label="Datum">
             <label class="dur"><input type="number" inputmode="numeric" min="1" data-bind="wo-dur" value="${A.durationMin ?? 60}" aria-label="Dauer in Minuten"> Min.</label>`}
        <button class="meta-chip" data-act="wo-kind"><i class="kdot k-${A.kind}"></i>${KINDS[A.kind].label}</button>
        <button class="meta-chip" data-act="wo-loc">${LOC[A.location] || 'Studio'}</button>
      </div>
    </div>
    <button class="btn primary" data-act="finish">${live ? 'Fertig' : 'Speichern'}</button>
  </header>
  ${A.note ? `<p class="entry-note">${esc(A.note)}</p>` : ''}`;

  // Supersätze: aufeinanderfolgende Übungen mit gleicher Gruppe zusammenfassen
  let body = '', letter = 0, i = 0;
  const es = A.entries;
  while (i < es.length) {
    const g = es[i].group;
    if (g && es[i + 1]?.group === g) {
      const L = String.fromCharCode(65 + letter++);
      let j = i, inner = '', n = 1;
      while (j < es.length && es[j].group === g) { inner += entryHTML(es[j], j, `${L}${n++}`); j++; }
      body += `<div class="superset"><div class="ss-label">${ICON.link} ${j - i > 2 ? 'Zirkel' : 'Supersatz'} ${L} · Pause nach der Runde</div>${inner}</div>`;
      i = j;
    } else { body += entryHTML(es[i], i); i++; }
  }
  if (!es.length) body = `<div class="empty"><div class="empty-ico">🏋️</div><p>Noch keine Übung drin.<br>Füg die erste hinzu.</p></div>`;
  return head + body + `<button class="btn add-ex wide" data-act="add-ex">+ Übung hinzufügen</button>
    <button class="btn ghost danger wide" data-act="discard">${A.editOf ? 'Änderungen verwerfen' : 'Training verwerfen'}</button>`;
}

function entryHTML(en, i, ssTag = '') {
  const ex = exById(en.exId);
  const fields = sortFields(en.fields);
  const prev = lastSetsFor(en.exId, D.active.editOf);
  const n = fields.length;
  const check = !n;
  const showPrev = n <= 2;
  const cls = `set-row${check ? ' checkonly' : showPrev ? '' : ' noprev'}`;
  let no = 0;
  const rows = en.sets.map((s, j) => {
    const p = prev?.sets[j];
    const label = s.warm ? 'W' : String(++no);
    const ph = f => p && prev.fields.includes(f) ? p[f] : null;
    return `<div class="${cls}${s.done ? ' done' : ''}${s.warm ? ' warm' : ''}" style="--n:${n}" data-e="${i}" data-s="${j}">
      <button class="set-no" data-act="set-menu" aria-label="Satz ${label} Optionen">${label}</button>
      ${check ? `<span class="prev">${s.done ? 'Erledigt' : 'Abhaken, wenn gemacht'}</span>` : showPrev ? `<span class="prev">${p ? esc(setStr(p, prev.fields, ex, true)) : '–'}</span>` : ''}
      ${fields.map(f => inputHTML(f, s[f], ph(f), ex)).join('')}
      <button class="check" data-act="set-done" aria-label="Satz abhaken">${ICON.check}</button>
    </div>`;
  }).join('');
  const note = [ex.note, en.note].filter(Boolean).map(esc).join(' · ');
  return `<section class="card entry" id="entry-${i}">
    <div class="entry-head">
      ${ssTag ? `<span class="ss-tag">${ssTag}</span>` : ''}
      <button class="ex-link" data-act="ex-open" data-id="${ex.id}">
        <span class="ex-name">${esc(ex.name)}</span>
        <span class="ex-sub">${en.slot ? esc(en.slot) + ' · ' : ''}${measureLabel(fields, ex)}${ex.perSide ? ' · pro Seite' : ''}${barOf(ex) && fields.includes('w') ? ' · + Stange ' + fmtNum(barOf(ex)) + ' kg' : ''}${prev ? ' · zuletzt ' + relDay(prev.date) : ''}</span>
      </button>
      <button class="icon-btn" data-act="entry-menu" data-e="${i}" aria-label="Übungs-Optionen">${ICON.dots}</button>
    </div>
    ${note ? `<p class="entry-note">${note}</p>` : ''}
    ${en.slotAlts && D.active.entries.findIndex(x => x.slotKey === en.slotKey) === i ? `<div class="alt-row"><span>${en.slotMulti ? 'Kombinieren' : 'Alternativen'}</span><div class="chips">${(nm => en.slotAlts.map((id, k) =>
      `<button class="chip ${D.active.entries.some(x => x.slotKey === en.slotKey && x.exId === id) ? 'on' : ''}" data-act="slot-alt" data-e="${i}" data-id="${id}">${esc(nm[k])}</button>`).join(''))(chipNames(en.slotAlts))}</div></div>` : ''}
    ${en.sets.length && !check ? `<div class="${cls} head" style="--n:${n}"><span>Satz</span>${showPrev ? '<span>Vorher</span>' : ''}${fields.map(f => `<span>${f === 'w' ? (barOf(ex) ? 'Scheiben' : weightCol(ex.equip)) : FIELDS[f].col}</span>`).join('')}<span></span></div>` : ''}
    ${rows}
    <div class="entry-foot">
      <button class="btn small" data-act="add-set" data-e="${i}">+ Satz</button>
      <button class="btn small" data-act="entry-mode" data-e="${i}">Messart</button>
      ${fields.includes('t') ? `<button class="btn small" data-act="stopwatch" data-e="${i}">Stoppuhr</button>` : ''}
    </div>
  </section>`;
}

function inputHTML(f, v, ph, ex) {
  if (f === 'b') {
    return `<select class="val band${v == null ? ' empty' : ''}" data-f="b" aria-label="Miniband">
      <option value="">${ph != null ? esc(BANDS[ph]) : '–'}</option>
      ${BANDS.map((b, i) => `<option value="${i}" ${v === i ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
  }
  const bar = f === 'w' ? barOf(ex) : 0;
  const show = x => x == null ? '' : f === 't' ? fmtTime(x) : String(Math.round((x - bar) * 100) / 100).replace('.', ',');
  const mode = f === 'w' || f === 'd' ? 'decimal' : 'numeric';
  const phs = ph == null && f === 'w' && ex?.equip === 'kg' ? 'KG' : show(ph);
  return `<input class="val" data-f="${f}" inputmode="${mode}" enterkeyhint="next" autocomplete="off" value="${show(v)}" placeholder="${phs}" aria-label="${FIELDS[f].label}">`;
}

function newEntry(exId, setCount = 0, extra = {}) {
  const ex = exById(exId);
  const prev = lastSetsFor(exId, D.active?.editOf);
  const count = setCount || (ex.fields.length ? Math.max(1, Math.min(prev?.sets.length || 3, 6)) : 1);
  return { id: uid(), exId, fields: sortFields(ex.fields), note: '', group: null, slot: '', ...extra,
    sets: Array.from({ length: count }, (_, j) => ({ warm: !!prev?.sets[j]?.warm, done: false })) };
}

const hasHome = t => t.items.some(i => i.home !== i.studio);
function entriesFromTemplate(t, loc) {
  const out = [];
  let prevLink = false, g = null;
  for (const it of t.items) {
    const id = loc === 'home' && hasHome(t) ? it.home : (it.studio ?? it.home);
    if (!id || !D.exercises.some(e => e.id === id)) { prevLink = false; continue; }
    const alts = [...new Set([id, ...(it.alts || [])])].filter(x => D.exercises.some(e => e.id === x && !e.archived));
    const en = newEntry(id, it.sets, { slot: it.slot, slotKey: uid(), slotAlts: alts.length > 1 ? alts : null, slotMulti: !!it.multi });
    if (prevLink && out.length) { g ||= uid(); out.at(-1).group = g; en.group = g; } else g = null;
    out.push(en);
    prevLink = !!it.link;
  }
  return out;
}

function startWorkout({ name = 'Training', entries = [], templateId = null, mode = 'live', kind = 'kraft', location, note = '' } = {}) {
  if (D.active) { toast('Es läuft schon ein Training.'); tab = 'train'; render(); return; }
  const start = mode === 'live' ? Date.now() : (() => { const d = new Date(); d.setHours(18, 0, 0, 0); return d.getTime(); })();
  location ||= D.settings.location || 'studio';
  D.active = { id: uid(), name, start, mode, templateId, editOf: null, durationMin: 60, kind, location, note, entries };
  D.settings.location = location;
  save();
  tab = 'train';
  window.scrollTo(0, 0);
  render();
}

function workoutToActive(w) {
  return {
    id: uid(), name: w.name, start: w.start, mode: 'edit', templateId: w.templateId || null, editOf: w.id,
    kind: kindOf(w), location: w.location || 'studio', note: '',
    durationMin: Math.max(1, Math.round((w.end - w.start) / 60000)),
    entries: (w.entries || []).map(e => ({ id: uid(), exId: e.exId, fields: [...e.fields], note: e.note || '', group: e.group || null, slot: e.slot || '', sets: e.sets.map(s => ({ ...s, done: true })) })),
  };
}

function cleanSet(s, fields) {
  const o = { warm: !!s.warm };
  for (const f of fields) if (s[f] != null) o[f] = s[f];
  return o;
}
const hasValue = (s, fields) => !fields.length ? !!s.done : fields.some(f => s[f] != null);

function saveActive(includeUndone) {
  const A = D.active;
  const keep = s => s.done || includeUndone;
  const entries = A.entries.map(en => {
    const f = sortFields(en.fields);
    return { exId: en.exId, fields: f, note: en.note || '', group: en.group || null, slot: en.slot || '', sets: en.sets.filter(s => keep(s) && hasValue(s, f)).map(s => cleanSet(s, f)) };
  }).filter(en => en.sets.length);
  // Supersatz-Gruppen mit nur noch einer Übung auflösen
  for (const en of entries) if (en.group && entries.filter(x => x.group === en.group).length < 2) en.group = null;
  const w = {
    id: A.editOf || uid(),
    name: (A.name || '').trim() || 'Training',
    kind: A.kind, location: A.location,
    start: A.start,
    end: A.mode === 'live' ? Date.now() : A.start + (A.durationMin || 60) * 60000,
    templateId: A.templateId || null,
    entries,
  };
  const idx = D.workouts.findIndex(x => x.id === w.id);
  if (idx >= 0) D.workouts[idx] = w; else D.workouts.push(w);
  sortWorkouts();
  const wasEdit = !!A.editOf;
  D.active = null;
  save();
  return { w, wasEdit };
}

function checkPR(en, si) {
  const s = en.sets[si];
  const out = [];
  for (const m of METRICS) {
    if (m.session || !metricAllowed(en.exId, m)) continue;
    const v = m.val(s);
    if (v == null) continue;
    let best = bestOf(D.workouts, en.exId, m, D.active.editOf);
    if (best == null) continue;
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
      toast('Pause vorbei – nächster Satz.');
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

// ---------- Chronik ----------
function historyHTML() {
  const head = `<header class="top row-between"><h1>Chronik</h1><button class="btn small" data-act="backfill">+ Nachtragen</button></header>${legendHTML()}`;
  if (!D.workouts.length && !D.estimates.length) return head + `<div class="empty"><div class="empty-ico">📅</div><p>Hier landen deine Trainings und Läufe.<br>Unter „Mehr“ kannst du deine Gym-Run-Daten importieren.</p></div>`;
  const prs = {};
  for (const r of computeRecords(D.workouts)) prs[r.wid] = (prs[r.wid] || 0) + 1;
  // Monate sammeln (Trainings + Schätzungen)
  const months = {};
  for (const w of D.workouts) (months[dayKey(w.start).slice(0, 7)] ||= { ws: [], est: null }).ws.push(w);
  for (const e of D.estimates) (months[e.month] ||= { ws: [], est: null }).est = e;
  let out = head;
  for (const mk of Object.keys(months).sort().reverse()) {
    const { ws, est } = months[mk];
    const [y, m] = mk.split('-').map(Number);
    const counts = Object.keys(KINDS).map(k => [k, ws.filter(w => kindOf(w) === k).length]).filter(x => x[1]);
    out += `<div class="month-head"><h3 class="month">${monthLabel(new Date(y, m - 1, 1))}</h3><span class="muted small">${counts.map(([k, n]) => `<i class="kdot k-${k}"></i>${n}`).join(' ')}</span></div>`;
    if (est) out += `<button class="card est-card" data-act="est-edit" data-m="${est.month}"><i class="kdot k-${est.kind || 'kraft'}"></i>ca. ${est.count} Trainings <span class="muted small">(geschätzt, keine Details)</span></button>`;
    for (const w of [...ws].reverse()) out += wCardHTML(w, prs[w.id]);
  }
  return out;
}
function wCardHTML(w, prCount) {
  const k = kindOf(w);
  if (k === 'lauf') {
    const pace = w.run?.km && w.run?.sec ? fmtTime(w.run.sec / w.run.km) + ' /km' : '';
    return `<button class="card wo-card k-border-lauf" data-act="wo-open" data-id="${w.id}">
      <div class="wo-card-top"><strong><i class="kdot k-lauf"></i>${esc(w.name || 'Lauf')}</strong><span class="muted small">${fmtDate(w.start)}</span></div>
      <div class="chips">${w.run?.km ? `<span class="chip">${fmtNum(w.run.km, 2)} km</span>` : ''}${w.run?.sec ? `<span class="chip">${fmtTime(w.run.sec)}</span>` : ''}${pace ? `<span class="chip">${pace}</span>` : ''}</div></button>`;
  }
  if (w.untracked) return `<button class="card wo-card untracked k-border-${k}" data-act="wo-open" data-id="${w.id}">
      <div class="wo-card-top"><strong><i class="kdot k-${k}"></i>${KINDS[k].label}${w.location ? ' · ' + LOC[w.location] : ''}</strong><span class="muted small">${fmtDate(w.start)}</span></div>
      <p class="muted small">Training ohne Details</p></button>`;
  const st = workoutStats(w);
  return `<button class="card wo-card k-border-${k}" data-act="wo-open" data-id="${w.id}">
    <div class="wo-card-top"><strong><i class="kdot k-${k}"></i>${esc(w.name)}</strong><span class="muted small">${fmtDate(w.start)}</span></div>
    <div class="chips">
      <span class="chip">${st.mins} Min.</span><span class="chip">${st.sets} Sätze</span>
      ${w.location ? `<span class="chip">${LOC[w.location]}</span>` : ''}${prCount ? `<span class="chip gold">🏆 ${prCount}</span>` : ''}
    </div>
    <p class="muted small clamp">${esc(w.entries.map(e => exById(e.exId).name).join(' · '))}</p>
  </button>`;
}

function openWorkout(id) {
  openLayer({
    full: true, id,
    html: l => {
      const w = D.workouts.find(x => x.id === l.id);
      if (!w) return '<div class="page"><p>Nicht gefunden.</p></div>';
      const k = kindOf(w);
      const head = `<div class="page-head"><button class="icon-btn" data-act="close-layer" aria-label="Zurück">${ICON.back}</button><h1>${esc(w.name || KINDS[k].label)}</h1></div>
        <p class="muted"><i class="kdot k-${k}"></i>${KINDS[k].label}${w.location ? ' · ' + LOC[w.location] : ''} · ${fmtDateLong(w.start)}${w.untracked || k === 'lauf' ? '' : ` · ${fmtClock(w.start)}–${fmtClock(w.end)} Uhr`}</p>`;
      if (k === 'lauf' || w.untracked) {
        return `<div class="page">${head}
          ${k === 'lauf' ? `<div class="tiles"><div class="tile"><strong>${w.run?.km ? fmtNum(w.run.km, 2) : '–'}</strong><span>km</span></div><div class="tile"><strong>${w.run?.sec ? fmtTime(w.run.sec) : '–'}</strong><span>Dauer</span></div><div class="tile"><strong>${w.run?.km && w.run?.sec ? fmtTime(w.run.sec / w.run.km) : '–'}</strong><span>min/km</span></div></div>` : '<p class="muted">Nur der Termin ist erfasst – Details gibt es dazu nicht.</p>'}
          ${w.note ? `<p class="entry-note">${esc(w.note)}</p>` : ''}
          <button class="btn danger wide" data-act="wo-delete">Löschen</button></div>`;
      }
      const st = workoutStats(w);
      const recs = computeRecords(D.workouts).filter(r => r.wid === w.id);
      return `<div class="page">${head}
        <div class="tiles">
          <div class="tile"><strong>${st.mins}</strong><span>Minuten</span></div>
          <div class="tile"><strong>${st.sets}</strong><span>Sätze</span></div>
          <div class="tile"><strong>${st.exercises}</strong><span>Übungen</span></div>
        </div>
        ${recs.length ? `<div class="card gold-card">${recs.map(r => `<div>🏆 <b>${esc(exById(r.exId).name)}</b> – ${r.m.short} ${fmtMetric(r.m.kind, r.v)}</div>`).join('')}</div>` : ''}
        ${w.entries.map((e, i) => {
          let no = 0;
          const ex = exById(e.exId);
          const ss = e.group && (w.entries[i - 1]?.group === e.group || w.entries[i + 1]?.group === e.group);
          return `<div class="card${ss ? ' ss-card' : ''}">
            <button class="ex-link" data-act="ex-open" data-id="${e.exId}"><span class="ex-name">${esc(ex.name)}</span><span class="ex-sub">${ss ? 'Supersatz · ' : ''}${measureLabel(e.fields, ex)}</span></button>
            ${e.note ? `<p class="entry-note">${esc(e.note)}</p>` : ''}
            <ol class="set-list">${e.sets.map(s => `<li class="${s.warm ? 'warm' : ''}"><span class="set-no-s">${s.warm ? 'W' : ++no}</span>${esc(setStr(s, e.fields, ex))}</li>`).join('')}</ol>
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
      <div class="big-emoji">${recs.length ? '🏆' : '✓'}</div>
      <h1>${esc(pick(CHEERS))}</h1>
      <p class="muted">${esc(w.name)} · ${fmtDate(w.start)}</p>
      <div class="tiles">
        <div class="tile"><strong>${st.mins}</strong><span>Minuten</span></div>
        <div class="tile"><strong>${st.sets}</strong><span>Sätze</span></div>
        <div class="tile"><strong>${st.exercises}</strong><span>Übungen</span></div>
      </div>
      ${recs.length ? `<h2>${recs.length === 1 ? 'Neuer Rekord' : recs.length + ' neue Rekorde'}</h2>
        <div class="card list">${recs.map(r => `<div class="row"><span><b>${esc(exById(r.exId).name)}</b><br><span class="muted small">${r.m.short}: <span class="up">${fmtMetric(r.m.kind, r.v)}</span> · vorher ${fmtMetric(r.m.kind, r.prev)}</span></span></div>`).join('')}</div>` : ''}
      <button class="btn primary wide big" data-act="close-layer">Weiter</button>
    </div>`,
  });
}

// Nachtragen
function openBackfill() {
  openLayer({
    html: () => `<div class="sheet-body"><h2>Nachtragen</h2><div class="btn-col">
      <button class="btn wide" data-act="backlog">Training mit Details</button>
      <button class="btn wide" data-act="untracked-new">Nur Termine (ohne Details)</button>
      <button class="btn wide" data-act="run-new">Lauf</button>
      <button class="btn wide" data-act="est-new">Monat schätzen</button>
      <button class="btn ghost wide" data-act="close-layer">Abbrechen</button></div></div>`,
  });
}
function openUntracked() {
  openLayer({
    kind: 'untracked', k: 'kraft', loc: 'studio', added: [],
    html: l => `<div class="sheet-body"><h2>Termine nachtragen</h2>
      <p class="muted small">Z. B. deine Studio-Check-ins. Du kannst mehrere nacheinander hinzufügen.</p>
      <label class="field"><span>Datum</span><input type="date" id="ut-date" value="${l.date || dayKey(Date.now())}"></label>
      <div class="chips">${Object.entries(KINDS).filter(([k]) => k !== 'lauf').map(([k, v]) => `<button class="chip big ${l.k === k ? 'on' : ''}" data-act="ut-kind" data-k="${k}">${v.label}</button>`).join('')}
        ${Object.entries(LOC).map(([k, v]) => `<button class="chip big ${l.loc === k ? 'on' : ''}" data-act="ut-loc" data-k="${k}">${v}</button>`).join('')}</div>
      <button class="btn primary wide" data-act="ut-add">Hinzufügen</button>
      ${l.added.length ? `<p class="small pad">Hinzugefügt: ${l.added.map(fmtShort).join(', ')}</p>` : ''}
      <button class="btn ghost wide" data-act="close-layer">Fertig</button></div>`,
    onClose: () => render(),
  });
}
function openRun() {
  openLayer({
    html: () => `<div class="sheet-body"><h2>Lauf eintragen</h2>
      <p class="muted small">Die genaue Auswertung bleibt bei Garmin/Strava – hier geht's um dein Gesamtbild.</p>
      <label class="field"><span>Datum</span><input type="date" id="run-date" value="${dayKey(Date.now())}"></label>
      <div class="two-col">
        <label class="field"><span>Kilometer</span><input id="run-km" inputmode="decimal" placeholder="10,0" autocomplete="off"></label>
        <label class="field"><span>Dauer</span><input id="run-dur" inputmode="text" placeholder="52:30 oder 45" autocomplete="off"></label>
      </div>
      <label class="field"><span>Notiz (optional)</span><input id="run-note" placeholder="z. B. locker, Intervalle 6×800" autocomplete="off"></label>
      <div class="btn-col"><button class="btn primary wide" data-act="run-save">Speichern</button><button class="btn ghost wide" data-act="close-layer">Abbrechen</button></div></div>`,
  });
}
function openEstimate(month) {
  const e = D.estimates.find(x => x.month === month);
  const def = (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return dayKey(d).slice(0, 7); })();
  openLayer({
    k: e?.kind || 'kraft', orig: month,
    html: l => `<div class="sheet-body"><h2>Monat schätzen</h2>
      <p class="muted small">Für Monate, in denen du trainiert, aber nichts aufgeschrieben hast. Zählt für Gesamtzahl und Serie, ohne Tage zu erfinden.</p>
      <div class="two-col">
        <label class="field"><span>Monat</span><input type="month" id="est-month" value="${month || def}"></label>
        <label class="field"><span>Anzahl Trainings</span><input id="est-count" inputmode="numeric" value="${e?.count || ''}" placeholder="7"></label>
      </div>
      <div class="btn-col"><button class="btn primary wide" data-act="est-save">Speichern</button>
      ${e ? '<button class="btn danger wide" data-act="est-delete">Schätzung löschen</button>' : ''}
      <button class="btn ghost wide" data-act="close-layer">Abbrechen</button></div></div>`,
  });
}

// ---------- Fortschritt ----------
function progressHTML() {
  const from = rangeStart(progRange, D.workouts);
  const goal = D.settings.weeklyGoal || 2;
  const sm = summary(D.workouts, D.estimates, from, goal);
  const bk = buckets(D.workouts, D.estimates, from, progRange);
  const idx = strengthIndex(D.workouts, from, metricAllowed);
  const gains = topGains(D.workouts, from, metricAllowed, id => exById(id).name);
  const load = setLoad(D.workouts, from, exById);
  const ins = balanceInsights(D.workouts, from, exById, load);
  const viz = (title, sub, body, extra = '') => `<section class="card viz"><h2>${title}</h2>${sub ? `<p class="muted small viz-sub">${sub}</p>` : ''}${extra}${body}<div class="viz-tip" role="status"></div></section>`;
  const pct = v => (v >= 0 ? '+' : '−') + fmtNum(Math.abs(v), 1) + ' %';
  return `<header class="top"><h1>Fortschritt</h1></header>
    <div class="chips seg">${Object.entries(RANGES).map(([k, v]) => `<button class="chip ${progRange === k ? 'on' : ''}" data-act="prog-range" data-k="${k}">${v}</button>`).join('')}</div>
    <div class="tiles">
      <div class="tile"><strong>${sm.trainings}</strong><span>Trainings${sm.est ? ' (inkl. ' + sm.est + ' geschätzt)' : ''}</span></div>
      <div class="tile"><strong>${fmtNum(sm.perWeek, 1)}</strong><span>pro Woche</span></div>
      <div class="tile"><strong>${idx.points.length ? (idx.points.at(-1).y >= 0 ? '+' : '−') + Math.round(Math.abs(idx.points.at(-1).y)) + ' %' : '–'}</strong><span>Kraft-Entwicklung</span></div>
    </div>
    ${viz('Konstanz', `${bk.monthly ? 'Einheiten pro Monat' : 'Einheiten pro Woche'} · Wochenziel ${goal}× Kraft/Hybrid erreicht in ${sm.goalWeeks} von ${sm.weeks} Wochen`,
      stackedBarsSVG(bk, goal), legendHTML() + (bk.monthly && D.estimates.length ? '<p class="muted small"><i class="hatch-sw"></i>schraffiert = geschätzte Monate</p>' : ''))}
    ${viz('Kraftentwicklung', idx.count ? `Durchschnitt aus ${idx.count} Übungen, jeweils verglichen mit ihrem ersten Wert im Zeitraum (1RM, sonst Wiederholungen)` : '',
      idx.points.length > 1 ? indexLineSVG(idx.points) : '<p class="muted small">Sobald du Übungen mehrfach gemacht hast, siehst du hier deine Entwicklung.</p>')}
    <section class="card"><h2>Größte Steigerungen</h2>
      ${gains.length ? `<div class="gains">${gains.map(g => `<button class="gain" data-act="ex-open" data-id="${g.id}">
        <span class="gain-n"><b>${esc(g.name)}</b><span class="muted small">${g.m.short}: ${fmtMetric(g.m.kind, g.first)} → ${fmtMetric(g.m.kind, g.best)}</span></span>
        <span class="gain-p">↑ ${fmtNum(g.gain * 100, 0)} %</span></button>`).join('')}</div>` : '<p class="muted small">Noch keine Steigerungen im Zeitraum – oder alles auf gleichem Niveau.</p>'}
    </section>
    ${viz('Bewegungsmuster', 'Arbeitssätze je Muster', balanceHTML(load.patterns) + patternBarsHTML(load.patterns))}
    <section class="card"><h2>Hinweise zur Balance</h2>${insightsHTML(ins)}</section>
    ${viz('Muskelkarte', 'Wie viel jede Muskelgruppe trainiert wurde (Hauptmuskel = 1 Satz, Hilfsmuskel = ½). Antippen für Details.', bodyMapHTML(load.muscles, load.byMuscleEx))}`;
}

// Wissenskarte einer Übung
function knowledgeHTML(ex, open) {
  const k = KNOWLEDGE[ex.id];
  const mu = musclesOf(ex);
  const muscles = [...mu.p.map(m => `<span class="chip mchip p">${MUSCLES[m]}</span>`), ...mu.s.map(m => `<span class="chip mchip">${MUSCLES[m]}</span>`)].join('');
  const variant = (ids, dir) => ids.filter(id => D.exercises.some(e => e.id === id && !e.archived)).map(id =>
    `<button class="variant" data-act="ex-open" data-id="${id}"><small>${dir}</small>${esc(exById(id).name)}</button>`).join('');
  const vars = k ? variant(k.e, '← leichter') + variant(k.h, 'schwerer →') : '';
  return `<details class="card know" ${open ? 'open' : ''}><summary><span>So geht's</span><small class="muted">Technik, Muskeln, Tipps</small></summary>
    ${muscles ? `<div class="know-sec"><h4>Muskeln</h4><div class="chips">${muscles}</div><p class="muted small">Kräftig = Hauptmuskel, hell = Hilfsmuskel</p></div>` : ''}
    <div class="know-sec"><h4>Empfehlung</h4><p>${esc(recommendation(ex, k))}</p></div>
    ${k ? `<div class="know-sec"><h4>Ausführung</h4><ol class="know-list">${k.c.map(c => `<li>${esc(c)}</li>`).join('')}</ol></div>
      <div class="know-sec"><h4>Typische Fehler</h4><ul class="know-list warn">${k.f.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>
      <div class="know-sec runner"><h4>Für dich als Läufer</h4><p>${esc(k.l)}</p></div>
      ${vars ? `<div class="know-sec"><h4>Varianten</h4><div class="variants">${vars}</div></div>` : ''}`
      : '<p class="muted small">Eigene Übung – Muskeln und Empfehlung kommen aus dem Bewegungsmuster.</p>'}
    <p class="muted small fine">${SCIENCE_NOTE}</p>
  </details>`;
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
      <button class="row" data-act="ex-open" data-id="${e.id}"><span><b>${esc(e.name)}</b><br><span class="muted small">${EQUIP[e.equip] || ''} · ${measureLabel(e.fields, e)}${e.perSide ? ' · pro Seite' : ''}</span></span>
      <span class="muted small">${last[e.id] ? relDay(last[e.id]) : ''}</span></button>`).join('')}</div>`).join('');
}

function openExercise(id) {
  const avail = () => METRICS.filter(m => metricAllowed(id, m) && exerciseSeries(D.workouts, id, m).length);
  openLayer({
    full: true, id, metric: null,
    html: l => {
      const ex = exById(l.id);
      const ms = avail();
      if (!ms.find(m => m.key === l.metric)) l.metric = ms[0]?.key || null;
      const m = metricByKey(l.metric);
      const series = m ? exerciseSeries(D.workouts, l.id, m) : [];
      const sessions = D.workouts.filter(w => (w.entries || []).some(e => e.exId === l.id)).reverse();
      const bests = ms.filter(x => !x.session).map(x => {
        const s = exerciseSeries(D.workouts, l.id, x);
        const b = s.reduce((a, p) => (a == null || isBetter(x, p.y, a.y)) ? p : a, null);
        return `<div class="tile"><strong>${fmtMetric(x.kind, b.y)}</strong><span>${x.short} · ${fmtShort(b.x)}</span></div>`;
      }).join('');
      return `<div class="page">
        <div class="page-head"><button class="icon-btn" data-act="close-layer" aria-label="Zurück">${ICON.back}</button><h1>${esc(ex.name)}</h1>
          ${ex.archived ? '' : `<button class="btn small" data-act="ex-edit" data-id="${ex.id}">Bearbeiten</button>`}</div>
        <p class="muted">${esc(ex.group)} · ${EQUIP[ex.equip] || ''} · ${measureLabel(ex.fields, ex)}${ex.perSide ? ' · pro Seite' : ''}${barOf(ex) ? ' · Stange ' + fmtNum(barOf(ex)) + ' kg' : ''}${ex.rest ? ' · Pause ' + fmtTime(ex.rest) : ''}</p>
        ${ex.note ? `<p class="entry-note">${esc(ex.note)}</p>` : ''}
        ${knowledgeHTML(ex, !sessions.length)}
        ${sessions.length ? `
          ${bests ? `<h2>Bestwerte</h2><div class="tiles wrap">${bests}</div>` : ''}
          ${ms.length ? `<h2>Fortschritt</h2>
          <div class="chips scroll">${ms.map(x => `<button class="chip ${x.key === l.metric ? 'on' : ''}" data-act="metric-pick" data-k="${x.key}">${x.short}</button>`).join('')}</div>
          <div class="card">${m ? `<p class="small muted">${m.label}</p>` + lineChart(series, v => fmtMetric(m.kind, v), fmtShort) : ''}</div>` : ''}
          <h2>Einträge</h2>
          ${sessions.map(w => {
            const sets = w.entries.filter(e => e.exId === l.id);
            return `<div class="card"><div class="wo-card-top"><strong>${fmtDate(w.start)}</strong><span class="muted small">${esc(w.name)}</span></div>
              ${sets.map(e => `<p class="small">${e.sets.map(s => `<span class="set-pill ${s.warm ? 'warm' : ''}">${esc(setStr(s, e.fields, ex))}</span>`).join(' ')}</p>`).join('')}</div>`;
          }).join('')}` : `<div class="empty"><div class="empty-ico">📈</div><p>Noch nicht trainiert.<br>Sobald du Sätze einträgst, siehst du hier deinen Fortschritt.</p></div>`}
      </div>`;
    },
    mount: p => mountChart(p),
  });
}

function openExerciseForm({ id = null, name = '', group = '', onSaved } = {}) {
  const ex = id ? exById(id) : null;
  const draft = ex ? structuredClone(ex) : { id: uid(), name, group: group || exFilter.group || 'Ganzkörper & Hybrid', equip: 'kh', fields: ['w', 'r'], perSide: false, note: '', rest: null };
  openLayer({
    full: true, draft, isNew: !ex, onSaved, origBar: ex?.bar || 0,
    html: l => {
      const d = l.draft;
      const rests = [[null, `Standard (${fmtTime(D.settings.rest)})`], [30, '0:30'], [45, '0:45'], [60, '1:00'], [90, '1:30'], [120, '2:00'], [150, '2:30'], [180, '3:00'], [240, '4:00']];
      return `<div class="page">
        <div class="page-head"><button class="icon-btn" data-act="close-layer" aria-label="Zurück">${ICON.back}</button><h1>${l.isNew ? 'Neue Übung' : 'Übung bearbeiten'}</h1></div>
        <label class="field"><span>Name</span><input id="exf-name" data-bind="exf-name" value="${esc(d.name)}" placeholder="z. B. Farmers Carry" autocomplete="off"></label>
        <div class="two-col">
          <label class="field"><span>Bewegungsmuster</span><select data-bind="exf-group">${GROUPS.map(g => `<option ${g === d.group ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
          <label class="field"><span>Gerät</span><select data-bind="exf-equip">${Object.entries(EQUIP).map(([k, v]) => `<option value="${k}" ${k === d.equip ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        </div>
        <div class="field"><span>Was trägst du pro Satz ein?</span>
          <div class="chips">${FIELD_ORDER.map(f => `<button class="chip big ${d.fields.includes(f) ? 'on' : ''}" data-act="exf-field" data-f="${f}">${f === 'w' && d.equip === 'kg' ? 'Zusatzgewicht' : FIELDS[f].label}</button>`).join('')}</div>
          <p class="hint">Beispiel: <b>${esc(exampleStr(d.fields, d.equip))}</b><br>
          ${d.equip === 'kg' ? 'Körpergewicht: Zusatzgewicht leer lassen = ohne Gewicht, „8“ = +8 kg.<br>' : d.equip === 'kh' ? 'Kurzhantel: Gewicht <b>pro Hand</b> eintragen.<br>' : ''}
          Nichts ausgewählt = <b>nur abhaken</b> (z. B. Fuß-Übungen). Die Messart lässt sich im Training jederzeit umstellen.</p>
        </div>
        ${d.equip === 'lh' && d.fields.includes('w') ? `<label class="field"><span>Stangengewicht in kg (leer = du trägst das Gesamtgewicht ein)</span><input data-bind="exf-bar" inputmode="decimal" value="${d.bar ? String(d.bar).replace('.', ',') : ''}" placeholder="z. B. 20" autocomplete="off"></label>
          <p class="hint">Mit Stangengewicht trägst du im Training nur die <b>Scheiben</b> ein (beide Seiten zusammen). Die App rechnet die Stange dazu – Verlauf, Rekorde und Diagramme zeigen das Gesamtgewicht.</p>
          ${!l.isNew && (l.origBar || 0) !== (d.bar || 0) && D.workouts.some(w => (w.entries || []).some(e => e.exId === d.id)) ? `<label class="field check-line"><input type="checkbox" id="exf-shift"><span>Bisherige Einträge anpassen (${(d.bar || 0) - (l.origBar || 0) > 0 ? '+' : ''}${fmtNum((d.bar || 0) - (l.origBar || 0))} kg) – nur ankreuzen, wenn du dort ${l.origBar ? 'mit der alten Stange gerechnet' : 'nur die Scheiben eingetragen'} hast</span></label>` : ''}` : ''}
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

// Auswahl: Übungen hinzufügen (Mehrfach) oder eine wählen (single)
function openPicker(onDone, { single = false, prefer = '', title, allowNone = false, preselect = [], doneLabel = '', allowEmpty = false } = {}) {
  openLayer({
    full: true, kind: 'picker', sel: new Set(preselect), q: '', onDone, single, prefer, allowNone, doneLabel, allowEmpty,
    html: l => `<div class="page picker">
      <div class="page-head"><button class="icon-btn" data-act="close-layer" aria-label="Zurück">${ICON.back}</button><h1>${esc(title || (single ? 'Übung wählen' : 'Übungen wählen'))}</h1></div>
      <input class="search" id="pick-search" type="search" placeholder="Suchen oder neue Übung eintippen…" value="${esc(l.q)}" autocomplete="off">
      <div id="pick-list">${pickListHTML(l)}</div>
      ${single ? '' : `<div class="sticky-foot"><button class="btn primary wide big" data-act="pick-done" id="pick-done" ${l.sel.size || l.allowEmpty ? '' : 'disabled'}>${pickLabel(l)}</button></div>`}
    </div>`,
  });
}
const pickLabel = l => l.doneLabel ? `${l.doneLabel}${l.sel.size ? ` (${l.sel.size})` : ''}` : l.sel.size ? `${l.sel.size} hinzufügen` : 'Tippe Übungen an';
function pickListHTML(l) {
  const q = norm(l.q);
  const list = visibleExercises().filter(e => !q || norm(e.name).includes(q) || norm(e.group).includes(q));
  const exact = visibleExercises().some(e => norm(e.name) === q);
  const last = lastDoneMap();
  const newBtn = `<button class="row new-row" data-act="pick-new">＋ ${l.q && !exact ? `„${esc(l.q)}“ als neue Übung anlegen` : 'Neue Übung anlegen'}</button>`;
  const none = l.allowNone ? `<button class="row" data-act="pick-none">— Hier auslassen</button>` : '';
  const recent = !q && !l.prefer ? visibleExercises().filter(e => last[e.id]).sort((a, b) => last[b.id] - last[a.id]).slice(0, 6) : [];
  const row = e => `<button class="row pick-row ${l.sel.has(e.id) ? 'on' : ''}" data-act="pick-toggle" data-id="${e.id}">
    <span><b>${esc(e.name)}</b><br><span class="muted small">${measureLabel(e.fields, e)}${last[e.id] ? ' · ' + relDay(last[e.id]) : ''}</span></span>${l.single ? '' : `<span class="tick">${ICON.check}</span>`}</button>`;
  const groups = l.prefer && !q ? [l.prefer, ...GROUPS.filter(g => g !== l.prefer)] : GROUPS;
  return `<div class="card list">${newBtn}${none}</div>`
    + (recent.length ? `<h3 class="month">Zuletzt gemacht</h3><div class="card list">${recent.map(row).join('')}</div>` : '')
    + groups.filter(g => list.some(e => e.group === g)).map(g => `<h3 class="month">${g}</h3><div class="card list">${
      list.filter(e => e.group === g).sort((a, b) => a.name.localeCompare(b.name, 'de')).map(row).join('')}</div>`).join('');
}

// ---------- Routinen mit Plätzen ----------
function openStartSheet({ tpl = null } = {}) {
  openLayer({
    tpl, loc: D.settings.location || 'studio', k: tpl?.kind || 'kraft',
    html: l => `<div class="sheet-body"><h2>${tpl ? esc(tpl.name) : 'Training starten'}</h2>
      <p class="muted small">Wo trainierst du heute?</p>
      <div class="chips">${Object.entries(LOC).map(([k, v]) => `<button class="chip big ${l.loc === k ? 'on' : ''}" data-act="ss-loc" data-k="${k}">${v}</button>`).join('')}</div>
      ${tpl ? (hasHome(tpl) ? `<p class="hint">${tplPreview(tpl, l.loc)}</p>` : '') : `<p class="muted small" style="margin-top:14px">Art</p>
        <div class="chips">${['kraft', 'hybrid'].map(k => `<button class="chip big ${l.k === k ? 'on' : ''}" data-act="ss-kind" data-k="${k}">${KINDS[k].label}</button>`).join('')}</div>`}
      <div class="btn-col"><button class="btn primary wide big" data-act="ss-go">Los geht's</button><button class="btn ghost wide" data-act="close-layer">Abbrechen</button></div></div>`,
  });
}
function tplPreview(t, loc) {
  return entriesFromTemplate(t, loc).map(e => esc(exById(e.exId).name)).join(' · ') || 'Keine Übungen für diesen Ort';
}

function openTemplate(tpl) {
  const isNew = !D.templates.some(t => t.id === tpl.id);
  const d = structuredClone(tpl);
  d.kind ||= 'kraft';
  openLayer({
    full: true, draft: d, isNew,
    html: l => {
      const t = l.draft;
      return `<div class="page">
      <div class="page-head"><button class="icon-btn" data-act="close-layer" aria-label="Zurück">${ICON.back}</button><h1>${isNew ? 'Neue Routine' : 'Routine bearbeiten'}</h1></div>
      <label class="field"><span>Name</span><input data-bind="tpl-name" value="${esc(t.name)}" placeholder="z. B. Ganzkörper A" autocomplete="off"></label>
      <div class="chips">${['kraft', 'hybrid'].map(k => `<button class="chip big ${t.kind === k ? 'on' : ''}" data-act="tpl-kind" data-k="${k}"><i class="kdot k-${k}"></i>${KINDS[k].label}</button>`).join('')}</div>
      <p class="muted small" style="margin:14px 0 8px">Jeder Platz hat eine Übung fürs Studio und eine für Zuhause. Mit ${ICON.link} verbindest du zwei Plätze zum Supersatz.</p>
      ${t.items.map((it, i) => {
        const linked = it.link && i < t.items.length - 1;
        return `<div class="card slot ${linked ? 'linked' : ''} ${t.items[i - 1]?.link ? 'linked-prev' : ''}">
          <div class="slot-head">
            <input class="slot-name" data-bind="slot-name" data-i="${i}" value="${esc(it.slot)}" list="slot-list" placeholder="Platz" aria-label="Platz-Name">
            <span class="stepper"><button data-act="tpl-sets" data-i="${i}" data-d="-1" aria-label="Weniger Sätze">−</button><b>${it.sets}</b><button data-act="tpl-sets" data-i="${i}" data-d="1" aria-label="Mehr Sätze">+</button></span>
          </div>
          <div class="slot-ex">
            <button class="slot-pick" data-act="slot-pick" data-i="${i}" data-w="studio"><small>Studio</small>${it.studio ? esc(exById(it.studio).name) : '<em>auslassen</em>'}</button>
            <button class="slot-pick" data-act="slot-pick" data-i="${i}" data-w="home"><small>Zuhause</small>${it.home === it.studio && it.home ? '<em>wie Studio</em>' : it.home ? esc(exById(it.home).name) : '<em>auslassen</em>'}</button>
          </div>
          ${it.alts?.length ? `<p class="slot-alts muted small">${it.multi ? 'Kombinierbar' : 'Alternativen'}: ${chipNames(it.alts).map(esc).join(' · ')}</p>` : ''}
          <div class="slot-actions">
            <button data-act="tpl-move" data-i="${i}" data-d="-1" aria-label="Nach oben">↑</button><button data-act="tpl-move" data-i="${i}" data-d="1" aria-label="Nach unten">↓</button>
            ${i < t.items.length - 1 ? `<button class="${it.link ? 'on' : ''}" data-act="tpl-link" data-i="${i}">${ICON.link} ${it.link ? 'Supersatz' : 'verbinden'}</button>` : ''}
            <button data-act="tpl-alts" data-i="${i}">⇄ Alternativen</button>
            ${it.alts?.length ? `<button class="${it.multi ? 'on' : ''}" data-act="tpl-multi" data-i="${i}">+ mehrere</button>` : ''}
            <button data-act="tpl-del" data-i="${i}" aria-label="Platz entfernen">✕</button>
          </div>
        </div>`;
      }).join('') || '<p class="muted small pad">Noch keine Plätze.</p>'}
      <datalist id="slot-list">${GROUPS.map(g => `<option value="${g}">`).join('')}</datalist>
      <button class="btn wide" data-act="tpl-add">+ Plätze hinzufügen</button>
      <button class="btn primary wide big" data-act="tpl-save">Speichern</button>
      ${isNew ? '' : '<button class="btn ghost danger wide" data-act="tpl-remove">Routine löschen</button>'}
    </div>`;
    },
  });
}

// ---------- Mehr ----------
function moreHTML() {
  const s = D.settings;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const isIOS = /iphone|ipad/i.test(navigator.userAgent);
  return `<header class="top"><h1>Mehr</h1></header>
    ${standalone ? '' : `<div class="card"><h2>Als App installieren</h2>
      <p class="muted small">${installEvt ? 'Mit einem Tipp auf den Startbildschirm – dann startet die Kraftkladde wie eine richtige App.'
        : isIOS ? 'In Safari unten auf „Teilen“ → „Zum Home-Bildschirm“.' : 'Im Chrome-Menü (⋮) → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.'}</p>
      ${installEvt ? '<button class="btn primary" data-act="install">Installieren</button>' : ''}</div>`}
    <div class="card">
      <h2>Einstellungen</h2>
      <div class="two-col">
        <label class="field"><span>Dein Name</span><input data-bind="set-name" value="${esc(s.name)}" autocomplete="off"></label>
        <label class="field"><span>Körpergewicht (kg)</span><input data-bind="set-bw" inputmode="decimal" value="${s.bodyweight ?? ''}" autocomplete="off"></label>
      </div>
      <label class="field"><span>Wochenziel (Kraft- & Hybrid-Einheiten)</span><select data-bind="set-goal">${[1, 2, 3, 4, 5].map(v => `<option value="${v}" ${v === (s.weeklyGoal || 2) ? 'selected' : ''}>${v}× pro Woche</option>`).join('')}</select></label>
      <label class="field"><span>Standard-Pause zwischen Sätzen</span><select data-bind="set-rest">${[0, 30, 45, 60, 75, 90, 120, 150, 180].map(v => `<option value="${v}" ${v === s.rest ? 'selected' : ''}>${v ? fmtTime(v) : 'Aus'}</option>`).join('')}</select></label>
      <label class="field check-line"><input type="checkbox" data-bind="set-sound" ${s.sound ? 'checked' : ''}><span>Ton am Pausen-Ende</span></label>
      <label class="field check-line"><input type="checkbox" data-bind="set-vibrate" ${s.vibrate ? 'checked' : ''}><span>Vibration am Pausen-Ende</span></label>
      <label class="field check-line"><input type="checkbox" data-bind="set-wake" ${s.wakeLock ? 'checked' : ''}><span>Bildschirm während des Trainings anlassen</span></label>
    </div>
    <div class="card">
      <h2>Import</h2>
      <p class="muted small">Deine bisherigen Trainings aus Gym Run übernehmen (CSV-Export). Vor dem Import siehst du eine Vorschau.</p>
      <button class="btn wide" data-act="gymrun">Aus Gym Run importieren</button>
      <input type="file" id="gymrun-file" accept=".csv,text/csv,text/plain,*/*" hidden>
    </div>
    <div class="card">
      <h2>Deine Daten</h2>
      <p class="muted small">Alles liegt nur auf diesem Gerät – kein Konto, keine Cloud. Sichere ab und zu ein Backup (z. B. in Google Drive).</p>
      <p class="small">Letztes Backup: <b>${D.lastBackup ? fmtDate(D.lastBackup) + ' (' + relDay(D.lastBackup) + ')' : 'noch nie'}</b></p>
      <div class="btn-col">
        <button class="btn primary wide" data-act="backup">Backup sichern</button>
        <button class="btn wide" data-act="restore">Backup einspielen</button>
        <button class="btn wide" data-act="csv">Als Tabelle exportieren (CSV)</button>
      </div>
      <input type="file" id="restore-file" accept="application/json,.json" hidden>
    </div>
    <div class="card">
      <h2>So funktioniert's</h2>
      <ul class="howto small">
        <li><b>Routinen mit Plätzen:</b> Jeder Platz (z. B. „Ziehen vertikal“) hat eine Studio- und eine Zuhause-Übung. Beim Start wählst du den Ort.</li>
        <li><b>Supersatz:</b> Im Training bei einer Übung ⋯ → „Mit nächster verbinden“. Die Pause startet erst nach der Runde.</li>
        <li><b>Messart:</b> Gewicht, Wiederholungen, Strecke, Zeit, Kalorien, Miniband – frei kombinierbar, im Training umstellbar.</li>
        <li><b>Körpergewicht-Übungen:</b> Feld „+kg“ leer lassen = ohne Zusatzgewicht.</li>
        <li><b>Kurzhanteln:</b> Gewicht immer pro Hand.</li>
        <li><b>Vorher-Werte:</b> Graue Zahlen = letztes Mal. ✓ ohne Eintippen übernimmt sie.</li>
        <li><b>Zeit eingeben:</b> „90“ = 1:30, „130“ = 1:30, „45“ = 0:45.</li>
        <li><b>Aufwärmsatz:</b> Tipp auf die Satznummer → „W“. Zählt nicht für Rekorde.</li>
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
  const rows = [['Datum', 'Art', 'Ort', 'Training', 'Übung', 'Satz', 'Aufwärmen', 'Gewicht (kg)', 'Wiederholungen', 'Strecke (m)', 'Zeit (s)', 'Kalorien', 'Band', 'Notiz']];
  for (const w of D.workouts) {
    if (kindOf(w) === 'lauf') { rows.push([dayKey(w.start), 'Lauf', '', w.name, '', '', '', '', '', n(w.run?.km != null ? w.run.km * 1000 : null), n(w.run?.sec), '', '', w.note || '']); continue; }
    if (w.untracked) { rows.push([dayKey(w.start), KINDS[kindOf(w)].label, LOC[w.location] || '', 'ohne Details', '', '', '', '', '', '', '', '', '', '']); continue; }
    for (const e of w.entries) e.sets.forEach((s, i) =>
      rows.push([dayKey(w.start), KINDS[kindOf(w)].label, LOC[w.location] || '', w.name, exById(e.exId).name, i + 1, s.warm ? 'ja' : '', n(s.w), n(s.r), n(s.d), n(s.t), n(s.c), s.b != null ? BANDS[s.b] : '', e.note || '']));
  }
  return '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n');
}

// ---------- Gym-Run-Import ----------
function openImportPreview(parsed) {
  openLayer({
    full: true, parsed, bw: D.settings.bodyweight || 72,
    html: l => {
      const p = l.parsed;
      const plan = buildImport(p, D, l.bw);
      const first = p.sessions[0]?.start, last = p.sessions.at(-1)?.start;
      return `<div class="page">
        <div class="page-head"><button class="icon-btn" data-act="close-layer" aria-label="Zurück">${ICON.back}</button><h1>Gym-Run-Import</h1></div>
        <div class="tiles">
          <div class="tile"><strong>${plan.newWorkouts.length}</strong><span>Trainings neu</span></div>
          <div class="tile"><strong>${plan.dupes}</strong><span>schon da</span></div>
          <div class="tile"><strong>${p.exercises.length}</strong><span>Übungen</span></div>
        </div>
        ${first ? `<p class="muted small">${fmtDate(first)} bis ${fmtDate(last)}</p>` : ''}
        <label class="field"><span>Dein Körpergewicht damals (wird bei Klimmzügen abgezogen)</span><input id="imp-bw" inputmode="decimal" value="${String(l.bw).replace('.', ',')}" autocomplete="off"></label>
        <h2>Übungen zuordnen</h2>
        <p class="muted small">„÷ 2“ = Gym Run hatte das Gewicht beider Kurzhanteln. „− KG“ = Körpergewicht abziehen, Rest wird Zusatzgewicht.</p>
        <div class="card list">${p.exercises.map((x, i) => {
          const tgt = x.target ? exById(x.target) : null;
          return `<div class="row imp-row">
            <span><b>${esc(x.name)}</b><br><span class="muted small">${x.sets} Sätze · ${tgt ? '→ ' + esc(tgt.name) : '→ neu: ' + esc(x.group)}${x.sample != null ? ' · z. B. ' + fmtNum(x.sample) + ' kg' : ''}</span></span>
            <span class="imp-toggles">
              ${x.hasWeight ? `<button class="chip ${x.halve ? 'on' : ''}" data-act="imp-halve" data-i="${i}">÷ 2</button>` : ''}
              ${x.hasWeight ? `<button class="chip ${x.bw ? 'on' : ''}" data-act="imp-bw" data-i="${i}">− KG</button>` : ''}
            </span></div>`;
        }).join('')}</div>
        <div class="sticky-foot"><button class="btn primary wide big" data-act="imp-go" ${plan.newWorkouts.length ? '' : 'disabled'}>${plan.newWorkouts.length} Trainings importieren</button></div>
      </div>`;
    },
  });
}

// ---------- Aktionen ----------
const entryOf = el => { const row = el.closest('[data-e]'); return D.active.entries[+row.dataset.e]; };

const actions = {
  'prog-range'(el) { progRange = el.dataset.k; renderView(); },
  'tab'(el) { tab = el.dataset.tab; window.scrollTo(0, 0); render(); },
  'close-layer'() { closeLayer(); },
  'confirm-ok'() { const l = topLayer(); closeLayer(() => l.onOk()); },

  // Start
  'start-empty'() { openStartSheet(); },
  'tpl-start'(el) { openStartSheet({ tpl: D.templates.find(x => x.id === el.dataset.id) }); },
  'ss-loc'(el) { const l = topLayer(); l.loc = el.dataset.k; paintLayer(l); },
  'ss-kind'(el) { const l = topLayer(); l.k = el.dataset.k; paintLayer(l); },
  'ss-go'() {
    const l = topLayer();
    closeLayer(() => l.tpl
      ? startWorkout({ name: l.tpl.name, templateId: l.tpl.id, kind: l.tpl.kind || 'kraft', location: l.loc, note: l.tpl.note || '', entries: entriesFromTemplate(l.tpl, l.loc) })
      : startWorkout({ kind: l.k, location: l.loc, name: l.k === 'hybrid' ? 'Hybrid-Training' : 'Training' }));
  },
  'backlog'() { const go = () => { startWorkout({ name: 'Training', mode: 'edit' }); toast('Datum und Dauer oben anpassen'); }; layers.length ? closeLayer(go) : go(); },
  'backfill'() { openBackfill(); },
  'tpl-new'() { openTemplate({ id: uid(), name: '', kind: 'kraft', items: [] }); },
  'tpl-edit'(el) { openTemplate(D.templates.find(x => x.id === el.dataset.id)); },

  // Training
  'wo-kind'() { const A = D.active; A.kind = A.kind === 'kraft' ? 'hybrid' : 'kraft'; save(); renderView(); },
  'wo-loc'() { const A = D.active; A.location = A.location === 'home' ? 'studio' : 'home'; save(); renderView(); },
  'add-ex'() {
    openPicker(ids => {
      const start = D.active.entries.length;
      for (const id of ids) D.active.entries.push(newEntry(id));
      save(); renderView();
      setTimeout(() => $(`#entry-${start}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
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
    const ei = +row.dataset.e, en = D.active.entries[ei], si = +row.dataset.s, s = en.sets[si];
    if (s.done) { s.done = false; save(); renderView(); return; }
    const prev = lastSetsFor(en.exId, D.active.editOf);
    const p = prev?.sets[si];
    const fields = sortFields(en.fields);
    for (const f of fields) if (s[f] == null && p && prev.fields.includes(f) && p[f] != null) s[f] = p[f];
    if (fields.length && !hasValue(s, fields)) {
      row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake');
      toast('Trag erst einen Wert ein');
      return;
    }
    s.done = true;
    const pr = !s.warm && checkPR(en, si);
    // Supersatz: erst nach der letzten Übung der Runde Pause, sonst zur nächsten springen
    const members = en.group ? supersetMembers(en.group) : [];
    const nextIdx = members.length > 1 ? members[members.indexOf(ei) + 1] : undefined;
    if (nextIdx === undefined) {
      const rests = (members.length > 1 ? members : [ei]).map(i => exById(D.active.entries[i].exId).rest ?? D.settings.rest);
      startRest(Math.max(...rests));
    }
    save(); renderView(); renderRestbar();
    navigator.vibrate?.(15);
    if (nextIdx !== undefined) {
      const target = D.active.entries[nextIdx];
      const j = Math.min(si, target.sets.length - 1);
      const r = document.querySelector(`.set-row[data-e="${nextIdx}"][data-s="${j}"]`) || $(`#entry-${nextIdx}`);
      r?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      r?.classList.add('pulse');
    }
    if (pr) { toast(`🏆 Neuer Rekord: ${pr}`, 'gold'); navigator.vibrate?.([40, 60, 40]); }
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
        const es = D.active.entries, en = es[l.e];
        const inSS = en.group && es.filter(x => x.group === en.group).length > 1;
        const canLink = l.e < es.length - 1 && !(en.group && es[l.e + 1].group === en.group);
        return `<div class="sheet-body"><h2>${esc(exById(en.exId).name)}</h2>
          <label class="field"><span>Notiz für heute</span><textarea data-bind="entry-note" rows="2" placeholder="z. B. Griff gewechselt, Fuß zwickt">${esc(en.note)}</textarea></label>
          <div class="btn-col">
            ${canLink ? `<button class="btn wide" data-act="entry-link">${ICON.link} Mit nächster Übung zum Supersatz verbinden</button>` : ''}
            ${inSS ? `<button class="btn wide" data-act="entry-unlink">Aus Supersatz lösen</button>` : ''}
            ${(() => { const k = KNOWLEDGE[en.exId]; if (!k) return ''; const ok = id => D.exercises.some(e => e.id === id && !e.archived);
              const e1 = k.e.find(ok), h1 = k.h.find(ok);
              return e1 || h1 ? `<div class="btn-row">${e1 ? `<button class="btn" data-act="entry-variant" data-id="${e1}"><span class="vt"><small>leichter</small>${esc(exById(e1).name)}</span></button>` : ''}${h1 ? `<button class="btn" data-act="entry-variant" data-id="${h1}"><span class="vt"><small>schwerer</small>${esc(exById(h1).name)}</span></button>` : ''}</div>` : ''; })()}
            <button class="btn wide" data-act="entry-swap">Übung tauschen</button>
            <button class="btn wide" data-act="entry-mode-from-menu">Messart ändern</button>
            <div class="btn-row"><button class="btn" data-act="entry-move" data-d="-1" ${l.e === 0 ? 'disabled' : ''}>↑ Nach oben</button><button class="btn" data-act="entry-move" data-d="1" ${l.e === es.length - 1 ? 'disabled' : ''}>↓ Nach unten</button></div>
            <button class="btn danger wide" data-act="entry-remove">Übung entfernen</button>
            <button class="btn ghost wide" data-act="close-layer">Fertig</button>
          </div></div>`;
      },
      onClose: () => renderView(),
    });
  },
  'entry-link'() {
    const l = topLayer(), es = D.active.entries, a = es[l.e], b = es[l.e + 1];
    const g = a.group || uid();
    const old = b.group;
    a.group = g;
    for (const x of es) if (old && x.group === old) x.group = g;
    b.group = g;
    save(); closeLayer(); toast('Supersatz verbunden');
  },
  'entry-unlink'() {
    const l = topLayer(), es = D.active.entries, en = es[l.e], g = en.group;
    en.group = null;
    const rest = es.filter(x => x.group === g);
    if (rest.length < 2) rest.forEach(x => (x.group = null));
    save(); closeLayer();
  },
  'entry-variant'(el) {
    const l = topLayer(), en = D.active.entries[l.e], nx = exById(el.dataset.id);
    en.exId = nx.id; en.fields = sortFields(nx.fields);
    en.sets = en.sets.map(s => ({ warm: s.warm, done: false }));
    save(); closeLayer(() => { renderView(); toast(`Getauscht: ${nx.name}`); });
  },
  'entry-swap'() {
    const l = topLayer(), en = D.active.entries[l.e];
    const ex = exById(en.exId);
    closeLayer(() => openPicker(([id]) => {
      if (!id) return;
      const nx = exById(id);
      en.exId = id; en.fields = sortFields(nx.fields);
      en.sets = en.sets.map(s => ({ warm: s.warm, done: false }));
      save(); renderView(); toast(`Getauscht: ${nx.name}`);
    }, { single: true, prefer: ex.group, title: 'Tauschen gegen …' }));
  },
  'entry-move'(el) {
    const l = topLayer(), d = +el.dataset.d, arr = D.active.entries, j = l.e + d;
    if (j < 0 || j >= arr.length) return;
    [arr[l.e], arr[j]] = [arr[j], arr[l.e]]; l.e = j; save(); paintLayer(l);
  },
  'entry-remove'() {
    const l = topLayer(), es = D.active.entries, g = es[l.e].group;
    es.splice(l.e, 1);
    if (g && es.filter(x => x.group === g).length < 2) es.forEach(x => { if (x.group === g) x.group = null; });
    save(); closeLayer();
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
    const en = D.active.entries[l.e];
    en.fields = sortFields([...l.sel]);
    if (l.el.querySelector('#mode-default')?.checked) {
      const ex = D.exercises.find(x => x.id === en.exId); if (ex) { ex.fields = [...en.fields]; ex.edited = true; }
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
    const undoneVals = all.filter(x => !x.s.done && x.f.length && hasValue(x.s, x.f)).length;
    if (A.mode !== 'live') {
      if (!done && !undoneVals) { toast('Noch keine Werte eingetragen'); return; }
      const { wasEdit } = saveActive(true);
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

  // Chronik
  'wo-open'(el) { openWorkout(el.dataset.id); },
  'wo-repeat'() {
    const w = D.workouts.find(x => x.id === topLayer().id);
    if (D.active) { toast('Beende erst dein laufendes Training.'); return; }
    closeLayer(() => startWorkout({ name: w.name, templateId: w.templateId, kind: kindOf(w), location: w.location,
      entries: w.entries.map(e => ({ ...newEntry(e.exId, e.sets.length, { slot: e.slot || '', group: e.group || null }), fields: [...e.fields] })) }));
  },
  'wo-edit'() {
    const w = D.workouts.find(x => x.id === topLayer().id);
    if (D.active) { toast('Beende erst dein laufendes Training.'); return; }
    D.active = workoutToActive(w); save();
    closeLayer(() => { tab = 'train'; window.scrollTo(0, 0); render(); });
  },
  'wo-to-tpl'() {
    const w = D.workouts.find(x => x.id === topLayer().id);
    const items = w.entries.map((e, i) => ({ slot: e.slot || exById(e.exId).group, studio: e.exId, home: e.exId,
      sets: e.sets.filter(s => !s.warm).length || e.sets.length, link: !!e.group && w.entries[i + 1]?.group === e.group }));
    openTemplate({ id: uid(), name: w.name, kind: kindOf(w), items });
  },
  'wo-delete'() {
    const id = topLayer().id;
    confirmSheet({ title: 'Eintrag löschen?', text: 'Das lässt sich nicht rückgängig machen.', ok: 'Löschen', danger: true,
      onOk: () => { D.workouts = D.workouts.filter(w => w.id !== id); save(); closeLayer(() => { render(); toast('Gelöscht'); }); } });
  },
  'untracked-new'() { closeLayer(openUntracked); },
  'ut-kind'(el) { const l = topLayer(); l.date = l.el.querySelector('#ut-date').value; l.k = el.dataset.k; paintLayer(l); },
  'ut-loc'(el) { const l = topLayer(); l.date = l.el.querySelector('#ut-date').value; l.loc = el.dataset.k; paintLayer(l); },
  'ut-add'() {
    const l = topLayer(), v = l.el.querySelector('#ut-date').value;
    if (!v) return;
    const [y, m, d] = v.split('-').map(Number);
    const start = new Date(y, m - 1, d, 18, 0).getTime();
    if (D.workouts.some(w => w.untracked && dayKey(w.start) === v)) { toast('Dieser Tag ist schon eingetragen'); return; }
    D.workouts.push({ id: uid(), name: KINDS[l.k].label, kind: l.k, location: l.loc, untracked: true, start, end: start + 3600000, entries: [] });
    sortWorkouts(); save();
    l.date = v; l.added.push(start); paintLayer(l); toast(`${fmtShort(start)} eingetragen`);
  },
  'run-new'() { layers.length ? closeLayer(openRun) : openRun(); },
  'run-save'() {
    const l = topLayer(), p = l.el;
    const v = p.querySelector('#run-date').value;
    const km = num(p.querySelector('#run-km').value), sec = parseDuration(p.querySelector('#run-dur').value);
    if (!v || (!km && !sec)) { toast('Kilometer oder Dauer eintragen'); return; }
    const [y, m, d] = v.split('-').map(Number);
    const start = new Date(y, m - 1, d, 7, 0).getTime();
    D.workouts.push({ id: uid(), name: 'Lauf', kind: 'lauf', start, end: start + (sec || 3600) * 1000, run: { km, sec }, note: p.querySelector('#run-note').value.trim(), entries: [] });
    sortWorkouts(); save();
    closeLayer(() => { render(); toast('Lauf eingetragen 🏃'); });
  },
  'est-new'() { closeLayer(() => openEstimate()); },
  'est-edit'(el) { openEstimate(el.dataset.m); },
  'est-save'() {
    const l = topLayer(), p = l.el;
    const month = p.querySelector('#est-month').value, count = parseInt(p.querySelector('#est-count').value, 10);
    if (!month || !count) { toast('Monat und Anzahl eintragen'); return; }
    D.estimates = D.estimates.filter(e => e.month !== month && e.month !== l.orig);
    D.estimates.push({ month, count, kind: l.k });
    save(); closeLayer(() => { render(); toast('Gespeichert ✓'); });
  },
  'est-delete'() { const l = topLayer(); D.estimates = D.estimates.filter(e => e.month !== l.orig); save(); closeLayer(render); },

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
    if (D.exercises.some(e => e.id !== d.id && !e.archived && norm(e.name) === norm(d.name))) { toast('Diese Übung gibt es schon'); return; }
    const i = D.exercises.findIndex(e => e.id === d.id);
    if (d.equip !== 'lh') d.bar = null;
    const delta = (d.bar || 0) - (l.origBar || 0);
    if (delta && l.el.querySelector('#exf-shift')?.checked) {
      for (const w of D.workouts) for (const e of w.entries || []) if (e.exId === d.id) for (const st of e.sets) if (st.w != null) st.w = Math.round((st.w + delta) * 100) / 100;
    }
    d.edited = true;
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
    const used = D.workouts.some(w => (w.entries || []).some(e => e.exId === id)) || D.templates.some(t => t.items.some(i => i.studio === id || i.home === id));
    confirmSheet({ title: 'Übung löschen?', text: used ? 'Deine bisherigen Einträge bleiben in der Chronik erhalten.' : '', ok: 'Löschen', danger: true,
      onOk: () => {
        const ex = D.exercises.find(e => e.id === id);
        if (used) ex.archived = true;
        else { D.exercises = D.exercises.filter(e => e.id !== id); if (ex?.seed) D.removedSeeds.push(id); }
        D.templates.forEach(t => t.items.forEach(i => { if (i.studio === id) i.studio = null; if (i.home === id) i.home = null; }));
        save();
        closeLayer(() => { if (topLayer()?.id === id) closeLayer(render); else render(); });
      } });
  },

  // Auswahl
  'pick-toggle'(el) {
    const l = topLayer(), id = el.dataset.id;
    if (l.single) { closeLayer(() => l.onDone([id])); return; }
    l.sel.has(id) ? l.sel.delete(id) : l.sel.add(id);
    l.el.querySelectorAll(`[data-id="${id}"]`).forEach(b => b.classList.toggle('on', l.sel.has(id)));
    const btn = l.el.querySelector('#pick-done'); btn.textContent = pickLabel(l); btn.disabled = !l.sel.size && !l.allowEmpty;
  },
  'pick-none'() { const l = topLayer(); closeLayer(() => l.onDone([null])); },
  'pick-new'() {
    const l = topLayer();
    openExerciseForm({ name: l.q, group: l.prefer, onSaved: ex => {
      if (l.single) { closeLayer(() => l.onDone([ex.id])); return; }
      l.sel.add(ex.id); l.q = ''; paintLayer(l);
    } });
  },
  'pick-done'() { const l = topLayer(); closeLayer(() => l.onDone([...l.sel])); },

  // Routinen
  'tpl-kind'(el) { const l = topLayer(); l.draft.kind = el.dataset.k; paintLayer(l); },
  'tpl-sets'(el) { const l = topLayer(), it = l.draft.items[+el.dataset.i]; it.sets = Math.min(10, Math.max(1, it.sets + +el.dataset.d)); paintLayer(l); },
  'tpl-move'(el) {
    const l = topLayer(), i = +el.dataset.i, j = i + +el.dataset.d, a = l.draft.items;
    if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; paintLayer(l);
  },
  'tpl-alts'(el) {
    const l = topLayer(), it = l.draft.items[+el.dataset.i];
    const main = it.studio || it.home;
    openPicker(ids => { it.alts = ids.filter(x => x !== main); if (!it.alts.length) it.multi = false; paintLayer(l); },
      { title: `Alternativen: ${it.slot || 'Platz'}`, prefer: main ? exById(main).group : '', preselect: it.alts || [], doneLabel: 'Übernehmen', allowEmpty: true });
  },
  'tpl-multi'(el) { const l = topLayer(), it = l.draft.items[+el.dataset.i]; it.multi = !it.multi; paintLayer(l); toast(it.multi ? 'Mehrere gleichzeitig möglich (als Zirkel)' : 'Alternativen werden getauscht'); },
  'slot-alt'(el) {
    const es = D.active.entries, en = es[+el.dataset.e], id = el.dataset.id, key = en.slotKey;
    const members = () => es.map((x, i) => x.slotKey === key ? i : -1).filter(i => i >= 0);
    const present = members().find(i => es[i].exId === id);
    if (!en.slotMulti) {
      if (present !== undefined) return;
      const nx = exById(id);
      en.exId = id; en.fields = sortFields(nx.fields); en.sets = en.sets.map(s => ({ warm: s.warm, done: false }));
    } else {
      if (present !== undefined) {
        if (members().length === 1) { toast('Mindestens eine Übung bleibt drin'); return; }
        if (es[present].sets.some(s => s.done)) { toast('Hat schon abgehakte Sätze – über ⋯ entfernen'); return; }
        const keep = es[present]; es.splice(present, 1);
        if (keep === en) { /* Schalter-Zeile wandert zur nächsten Übung des Platzes */ }
      } else {
        const ms = members(), last = ms.at(-1);
        es.splice(last + 1, 0, newEntry(id, es[last].sets.length, { slot: en.slot, slotKey: key, slotAlts: en.slotAlts, slotMulti: true }));
      }
      const ms = es.filter(x => x.slotKey === key), g = ms.length > 1 ? 'c-' + key : null;
      ms.forEach(x => (x.group = g));
    }
    save(); renderView();
  },
  'tpl-link'(el) { const l = topLayer(), it = l.draft.items[+el.dataset.i]; it.link = !it.link; paintLayer(l); },
  'tpl-del'(el) { const l = topLayer(); l.draft.items.splice(+el.dataset.i, 1); paintLayer(l); },
  'tpl-add'() {
    const l = topLayer();
    openPicker(ids => { for (const id of ids) l.draft.items.push({ slot: exById(id).group, studio: id, home: id, sets: 3, link: false }); paintLayer(l); }, { title: 'Plätze hinzufügen' });
  },
  'slot-pick'(el) {
    const l = topLayer(), it = l.draft.items[+el.dataset.i], w = el.dataset.w;
    const cur = it[w] || it.studio || it.home;
    openPicker(([id]) => {
      if (w === 'studio' && it.home === it.studio) it.home = id; // "wie Studio" mitziehen
      it[w] = id;
      paintLayer(l);
    }, { single: true, prefer: cur ? exById(cur).group : (GROUPS.includes(it.slot) ? it.slot : ''), title: w === 'home' ? 'Übung für Zuhause' : 'Übung fürs Studio', allowNone: true });
  },
  'tpl-save'() {
    const l = topLayer(), d = l.draft;
    d.name = d.name.trim();
    if (!d.name) { toast('Gib der Routine einen Namen'); return; }
    d.items = d.items.filter(i => i.studio || i.home);
    const i = D.templates.findIndex(t => t.id === d.id);
    if (i >= 0) D.templates[i] = d; else D.templates.push(d);
    d.edited = true;
    save(); closeLayer(() => { render(); toast('Routine gespeichert ✓'); });
  },
  'tpl-remove'() {
    const id = topLayer().draft.id;
    confirmSheet({ title: 'Routine löschen?', text: 'Deine Trainings in der Chronik bleiben erhalten.', ok: 'Löschen', danger: true,
      onOk: () => { D.templates = D.templates.filter(t => t.id !== id); if (id.startsWith('tpl-')) D.removedSeedTpls.push(id); save(); closeLayer(render); } });
  },

  // Import
  'gymrun'() { $('#gymrun-file').click(); },
  'imp-halve'(el) { const l = topLayer(), x = l.parsed.exercises[+el.dataset.i]; x.halve = !x.halve; paintLayer(l); },
  'imp-bw'(el) { const l = topLayer(), x = l.parsed.exercises[+el.dataset.i]; x.bw = !x.bw; paintLayer(l); },
  'imp-go'() {
    const l = topLayer();
    const plan = buildImport(l.parsed, D, l.bw);
    D.exercises.push(...plan.newExercises);
    D.workouts.push(...plan.newWorkouts);
    sortWorkouts();
    D.settings.bodyweight ||= l.bw;
    save();
    closeLayer(() => { tab = 'history'; render(); toast(`${plan.newWorkouts.length} Trainings importiert ✓`); });
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
      onOk: () => { D = resetAll(); save(); tab = 'train'; render(); toast('Alles zurückgesetzt'); } });
  },
};

function openModeSheet(e) {
  const en = D.active.entries[e];
  const ex = exById(en.exId);
  openLayer({
    e, sel: new Set(en.fields),
    html: l => `<div class="sheet-body"><h2>Was misst du heute?</h2>
      <p class="muted small">${esc(ex.name)} mal auf Zeit, mal auf Strecke? Stell es hier für dieses Training um.</p>
      <div class="chips">${FIELD_ORDER.map(f => `<button class="chip big ${l.sel.has(f) ? 'on' : ''}" data-act="mode-field" data-f="${f}">${f === 'w' && ex.equip === 'kg' ? 'Zusatzgewicht' : FIELDS[f].label}</button>`).join('')}</div>
      <p class="hint">Beispiel: <b>${esc(exampleStr([...l.sel], ex.equip))}</b>${l.sel.size ? '' : ' – nichts ausgewählt = nur abhaken'}</p>
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

function setInput(t) {
  const row = t.closest('.set-row');
  const en = D.active.entries[+row.dataset.e], s = en.sets[+row.dataset.s];
  const f = t.dataset.f;
  s[f] = f === 't' ? parseTime(t.value) : f === 'b' ? (t.value === '' ? null : +t.value) : num(t.value);
  if (f === 'w' && s.w != null) s.w += barOf(exById(en.exId)); // Scheiben + Stange = Gesamtgewicht
  if (f === 'b') t.classList.toggle('empty', t.value === '');
  save();
}
document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.matches('.val[data-f]')) { setInput(t); return; }
  if (t.id === 'ex-search') { exFilter.q = t.value; $('#ex-list').innerHTML = exListHTML(); return; }
  if (t.id === 'pick-search') { const l = topLayer(); l.q = t.value; l.el.querySelector('#pick-list').innerHTML = pickListHTML(l); return; }
  if (t.id === 'imp-bw') { const l = topLayer(); const v = num(t.value); if (v) { l.bw = v; } return; }
  bind(t);
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.matches('.val[data-f="t"]')) { const v = parseTime(t.value); t.value = v == null ? '' : fmtTime(v); return; }
  if (t.matches('select.val')) { setInput(t); return; }
  if (t.id === 'imp-bw') { paintLayer(); return; }
  if (t.dataset.bind === 'exf-bar') { paintLayer(); return; } // Hinweis zum Anpassen alter Einträge einblenden
  if (t.id === 'restore-file') { restoreFrom(t.files[0]); t.value = ''; return; }
  if (t.id === 'gymrun-file') { importGymRun(t.files[0]); t.value = ''; return; }
  if (t.matches('select, input[type=checkbox], input[type=date]')) bind(t);
});
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Enter' || !ev.target.matches('input.val')) return;
  ev.preventDefault();
  const all = [...document.querySelectorAll('#view .val')];
  const next = all[all.indexOf(ev.target) + 1];
  next ? next.focus() : ev.target.blur();
});
document.addEventListener('focusin', ev => { if (ev.target.matches('input.val')) setTimeout(() => ev.target.select?.(), 0); });

function bind(t) {
  const k = t.dataset.bind; if (!k) return;
  const l = topLayer(), A = D.active, S = D.settings;
  switch (k) {
    case 'wo-name': A.name = t.value; break;
    case 'wo-date': if (t.value) { const [y, m, d] = t.value.split('-').map(Number); const dt = new Date(A.start); dt.setFullYear(y, m - 1, d); A.start = dt.getTime(); } break;
    case 'wo-dur': A.durationMin = Math.max(1, parseInt(t.value, 10) || 60); break;
    case 'entry-note': A.entries[l.e].note = t.value; break;
    case 'tpl-name': l.draft.name = t.value; return;
    case 'slot-name': l.draft.items[+t.dataset.i].slot = t.value; return;
    case 'exf-name': l.draft.name = t.value; return;
    case 'exf-group': l.draft.group = t.value; return;
    case 'exf-equip': l.draft.equip = t.value; paintLayer(l); return;
    case 'exf-side': l.draft.perSide = t.checked; return;
    case 'exf-rest': l.draft.rest = t.value === '' ? null : +t.value; return;
    case 'exf-note': l.draft.note = t.value; return;
    case 'exf-bar': l.draft.bar = num(t.value) || null; return;
    case 'set-name': S.name = t.value.trim(); break;
    case 'set-bw': S.bodyweight = num(t.value); break;
    case 'set-rest': S.rest = +t.value; break;
    case 'set-goal': S.weeklyGoal = +t.value; break;
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
  confirmSheet({ title: 'Backup einspielen?', text: `${data.workouts.length} Einträge vom Backup ersetzen die aktuellen Daten auf diesem Gerät.`, ok: 'Einspielen',
    onOk: () => { D = replaceAll(data); tab = 'train'; render(); toast('Backup eingespielt ✓'); } });
}

async function importGymRun(file) {
  if (!file) return;
  let parsed;
  try { parsed = parseGymRun(await file.text(), D); } catch (e) { console.error(e); toast('Datei konnte nicht gelesen werden'); return; }
  if (!parsed.sessions.length) { toast('Keine Trainings in der Datei gefunden'); return; }
  openImportPreview(parsed);
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
