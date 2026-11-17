import { createDb, DEMO, TABLES } from './db.js';
import { SEED, DISHES } from './seed.js';
import { PRAISE, PRAISE_BIG, PARTNER, OVERDUE, pick, fill, levelOf, AISLES, guessAisle } from './texts.js';

/* ============ Helfer ============ */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toLocaleDateString('sv-SE');
const parseDay = s => new Date(s + 'T00:00:00');
const addDays = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); };
const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 864e5);
const fmtDay = s => parseDay(s).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
const dayOf = iso => new Date(iso).toLocaleDateString('sv-SE');
const weekStart = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; };
const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* egal */ } },
};

let db;
const S = { me: null, household: null, members: [] };
TABLES.forEach(t => (S[t] = []));
const NAME = w => S.members.find(m => m.who === w)?.name || (w === 'p' ? 'Püßmaus' : 'Müßmaus');
const other = () => (S.me === 'p' ? 'm' : 'p');

function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms);
}
async function act(fn) {
  try { return await fn(); }
  catch (e) { console.error(e); toast('Hoppla: ' + (e.message || 'Da ist was schiefgelaufen'), 3500); }
}
function crumbs(el) {
  const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top;
  for (let i = 0; i < 10; i++) {
    const c = document.createElement('span'); c.className = 'crumb'; c.textContent = i % 3 ? '🧀' : '🐾';
    c.style.left = x + 'px'; c.style.top = y + 'px';
    c.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px');
    c.style.setProperty('--dy', (-Math.random() * 140 - 30) + 'px');
    c.style.setProperty('--r', (Math.random() * 360) + 'deg');
    document.body.appendChild(c); setTimeout(() => c.remove(), 1000);
  }
}
const tick = '<svg><use href="#tick"/></svg>';

/* ============ Bottom-Sheet für Formulare ============ */
function sheet({ title, fields, values = {}, saveLabel = 'Speichern', onSave, onDelete }) {
  const dlg = $('#sheet'), form = $('#sheet-form');
  const f = fd => {
    const v = values[fd.k] ?? fd.def ?? '';
    const id = 'sf-' + fd.k;
    if (fd.type === 'checkbox') return `<div class="field check"><input type="checkbox" id="${id}" name="${fd.k}" ${v ? 'checked' : ''}><label for="${id}">${fd.label}</label></div>`;
    if (fd.type === 'select') return `<div class="field"><label for="${id}">${fd.label}</label><select id="${id}" name="${fd.k}">${fd.options.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select></div>`;
    if (fd.type === 'textarea') return `<div class="field"><label for="${id}">${fd.label}</label><textarea id="${id}" name="${fd.k}" placeholder="${esc(fd.ph || '')}">${esc(v)}</textarea></div>`;
    return `<div class="field"><label for="${id}">${fd.label}</label><input id="${id}" name="${fd.k}" type="${fd.type || 'text'}" value="${esc(v)}" ${fd.req ? 'required' : ''} ${fd.type === 'number' ? 'inputmode="decimal" step="any" min="0"' : ''} placeholder="${esc(fd.ph || '')}" ${fd.max ? `maxlength="${fd.max}"` : ''}></div>`;
  };
  const rows = fields.map(fd => Array.isArray(fd) ? `<div class="grid2">${fd.map(f).join('')}</div>` : f(fd)).join('');
  form.innerHTML = `<h3>${title}</h3>${rows}<div class="sheet-actions">
    ${onDelete ? '<button type="button" class="btn danger" data-a="del" style="width:auto">🗑️</button>' : ''}
    <button type="button" class="btn soft" data-a="cancel">Abbrechen</button>
    <button class="btn pink">${saveLabel}</button></div>`;
  form.onsubmit = async e => {
    e.preventDefault();
    const out = {};
    fields.flat().forEach(fd => {
      const el = form.elements[fd.k];
      let v = fd.type === 'checkbox' ? el.checked : el.value.trim();
      if (fd.type === 'number') v = v === '' ? 0 : Number(v.replace(',', '.'));
      if (fd.type === 'select' && v === 'null') v = null;
      if (fd.type === 'select' && fd.num && v !== null) v = Number(v);
      out[fd.k] = v;
    });
    await act(() => onSave(out));
    dlg.close();
  };
  form.onclick = async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'cancel') dlg.close();
    if (a === 'del' && confirm('Wirklich löschen?')) { await act(onDelete); dlg.close(); }
  };
  dlg.showModal();
}
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') $('#sheet').close(); });

/* ============ Laden & Live-Sync ============ */
async function loadAll() {
  const [hh, mem, ...lists] = await Promise.all([db.household(), db.members(), ...TABLES.map(t => db.list(t))]);
  S.household = hh; S.members = mem;
  TABLES.forEach((t, i) => (S[t] = lists[i]));
}
const pending = new Set(); let reloadTimer;
function scheduleReload(t) {
  pending.add(t); clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async () => {
    const ts = [...pending]; pending.clear();
    await act(async () => {
      await Promise.all(ts.map(async x => {
        if (x === 'households') S.household = await db.household();
        else if (x === 'members') S.members = await db.members();
        else S[x] = await db.list(x);
      }));
      renderAll();
    });
  }, 120);
}
const seenThanks = new Set();
function onChange(t, p) {
  scheduleReload(t);
  if (t !== 'task_log' || !p?.new) return;
  const l = p.new;
  if (p.eventType === 'INSERT' && l.kind === 'task' && l.by_who !== S.me) {
    showPush(fill(pick(PARTNER), l.task_name, NAME(l.by_who)), l);
  }
  if (p.eventType === 'UPDATE' && l.thanked && l.by_who === S.me && !seenThanks.has(l.id)) {
    seenThanks.add(l.id);
    toast(`💛 ${NAME(other())} hat dir eine Danke-Pfote geschickt!`, 3000);
  }
}

/* ============ Start / Login ============ */
let obWho = null, obMode = 'new', loginMode = 'in';
function showAuth(step, msg) {
  $('#main').hidden = true; $('#auth').hidden = false;
  ['login', 'onboard'].forEach(s => ($('#f-' + s).hidden = s !== step));
  $('#auth-sub').textContent = msg || 'Willkommen im Mausbau 🐾';
  $('#auth-err').hidden = true;
}
const authErr = m => { $('#auth-err').textContent = m; $('#auth-err').hidden = false; };

async function route() {
  const session = await db.session();
  if (!session) return showAuth('login');
  const member = await db.membership();
  if (!member) return showAuth('onboard', 'Fast geschafft! Noch kurz einrichten.');
  S.me = member.who;
  await startApp();
}

$('#login-mode').onclick = e => {
  const b = e.target.closest('button'); if (!b) return; loginMode = b.dataset.m;
  $$('#login-mode button').forEach(x => x.classList.toggle('on', x === b));
  $('#password').autocomplete = loginMode === 'up' ? 'new-password' : 'current-password';
  $('#login-btn').textContent = loginMode === 'up' ? 'Konto anlegen 🧀' : 'Rein in den Mausbau 🐭';
};
const AUTH_ERR = {
  'Invalid login credentials': 'E-Mail oder Passwort stimmt nicht.',
  'Email not confirmed': 'Bitte erst den Bestätigungslink in deiner E-Mail anklicken, dann hier anmelden.',
  'User already registered': 'Dieses Konto gibt es schon. Bitte „Anmelden“ wählen.',
};
$('#f-login').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('#email').value.trim(), pw = $('#password').value;
  const btn = $('#login-btn'); btn.disabled = true;
  try {
    if (loginMode === 'up') {
      const loggedIn = await db.signUp(email, pw);
      if (!loggedIn) {
        showAuth('login', 'Fast! Bestätige kurz den Link in deiner E-Mail und melde dich dann hier an. ✉️');
        $('#login-mode [data-m=in]').click();
        return;
      }
    } else await db.signIn(email, pw);
    await route();
  } catch (err) { authErr(AUTH_ERR[err.message] || err.message); }
  finally { btn.disabled = false; }
});
$('#pickwho').onclick = e => {
  const b = e.target.closest('button'); if (!b) return; obWho = b.dataset.who;
  $$('#pickwho button').forEach(x => x.classList.toggle('on', x === b));
};
$('#ob-mode').onclick = e => {
  const b = e.target.closest('button'); if (!b) return; obMode = b.dataset.m;
  $$('#ob-mode button').forEach(x => x.classList.toggle('on', x === b));
  $('#ob-code').hidden = obMode !== 'join';
};
$('#f-onboard').addEventListener('submit', async e => {
  e.preventDefault();
  if (!obWho) return authErr('Erst aussuchen, welche Maus du bist 🐭');
  const name = obWho === 'p' ? 'Püßmaus' : 'Müßmaus';
  const btn = e.submitter; btn.disabled = true;
  try {
    if (obMode === 'join') await db.joinHousehold($('#invite').value.trim().toUpperCase(), obWho, name);
    else {
      await db.createHousehold(obWho, name);
      for (const [t, rows] of Object.entries(SEED)) await db.insert(t, rows);
    }
    await route();
  } catch (err) { authErr(err.message); }
  btn.disabled = false;
});

let started = false, awayInfo = null;
async function startApp() {
  await loadAll();
  $('#auth').hidden = true; $('#main').hidden = false;
  S.task_log.filter(l => l.thanked).forEach(l => seenThanks.add(l.id));
  computeAway();
  renderAll();
  if (started) return;
  started = true;
  db.onChange(onChange);
  if (DEMO) {
    $('#demo-banner').hidden = false; $('#demo-who').hidden = false;
  } else {
    $('#sync').hidden = false;
    const net = () => $('#sync').classList.toggle('off', !navigator.onLine);
    addEventListener('online', () => { net(); act(async () => { await loadAll(); renderAll(); }); });
    addEventListener('offline', net); net();
  }
  // Handys pausieren Hintergrund-Tabs: beim Zurückkommen frisch laden
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') act(async () => { await loadAll(); renderAll(); });
  });
}
$('#demo-who').onclick = async e => {
  const b = e.target.closest('button'); if (!b) return;
  db.setWho(b.dataset.who); S.me = b.dataset.who; computeAway(); renderAll();
};

/* ============ Rendering ============ */
function renderAll() {
  if (!S.household) return;
  $('#greet').textContent = `Moin ${NAME(S.me)} 🐾`;
  $$('#demo-who button').forEach(x => x.classList.toggle('on', x.dataset.who === S.me));
  renderHeute(); renderTasks(); renderRewards(); renderShop(); renderStock(); renderNotes(); renderDiary(); renderBaby(); renderSettings();
}

const pointLogs = () => S.task_log.filter(l => l.kind !== 'reward');
const sumPts = (who, from, to = new Date(8.64e15)) =>
  pointLogs().filter(l => l.by_who === who && new Date(l.done_at) >= from && new Date(l.done_at) < to).reduce((a, l) => a + l.points, 0);

function streakOf(who) {
  const days = new Set(S.task_log.filter(l => l.by_who === who && l.kind === 'task').map(l => dayOf(l.done_at)));
  let d = today(); if (!days.has(d)) d = addDays(d, -1);
  let n = 0; while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

function computeAway() {
  const key = 'mm-last-seen-' + S.me;
  const last = store.get(key);
  store.set(key, new Date().toISOString());
  if (!last) { awayInfo = null; return; }
  const logs = S.task_log.filter(l => l.kind === 'task' && l.by_who !== S.me && l.done_at > last);
  awayInfo = logs.length ? logs : null;
}

function renderHeute() {
  const h = S.household, ws = weekStart();
  const p = sumPts('p', ws), m = sumPts('m', ws), goal = h.week_goal || 250, tot = p + m;
  const reached = tot >= goal;
  const redeemed = S.task_log.some(l => l.kind === 'reward' && new Date(l.done_at) >= ws);
  $('#goal').classList.toggle('reached', reached);
  $('#g-sub').textContent = redeemed ? 'Eingelöst ✓ Genießt es!' : reached ? 'Ziel erreicht! 🎉 Tippen zum Einlösen' : `Noch ${goal - tot} 🧀 bis zum Ziel · tippen zum Ändern`;
  $('#g-reward').textContent = h.reward;
  $('#g-p').style.width = Math.min(100, p / goal * 100) + '%';
  $('#g-m').style.width = Math.max(0, Math.min(100 - p / goal * 100, m / goal * 100)) + '%';
  $('#g-pv').textContent = p; $('#g-mv').textContent = m; $('#g-goal').textContent = goal;

  const streak = streakOf(S.me);
  $('#s-streak').textContent = (streak >= 3 ? '🔥 ' : '') + streak;
  const doneWeek = S.task_log.filter(l => l.kind === 'task' && new Date(l.done_at) >= ws).length;
  $('#s-week').textContent = doneWeek;
  const lastWs = new Date(ws); lastWs.setDate(lastWs.getDate() - 7);
  const lastSame = new Date(Date.now() - 7 * 864e5);
  const prev = sumPts('p', lastWs, lastSame) + sumPts('m', lastWs, lastSame);
  $('#s-trend').textContent = prev ? `${tot >= prev ? '+' : ''}${Math.round((tot - prev) / prev * 100)}%` : '–';

  const mine = new Set(S.task_log.filter(l => l.by_who === S.me && l.kind === 'task').map(l => dayOf(l.done_at)));
  const td = today();
  $('#streak').innerHTML = DAYS.map((d, i) => {
    const day = new Date(ws); day.setDate(day.getDate() + i); const ds = day.toLocaleDateString('sv-SE');
    const on = mine.has(ds);
    return `<div class="d ${on ? '' : 'off'} ${ds === td ? 'today' : ''}"><svg style="color:${on ? 'var(--pink-strong)' : 'var(--mouse)'};transform:rotate(${i % 2 ? 12 : -12}deg)"><use href="#paw"/></svg><span>${d}</span></div>`;
  }).join('');

  const due = openTasks().filter(t => t.due <= td && (t.assignee === S.me || t.assignee === 'b'));
  $('#due-cnt').textContent = due.length ? `${due.length} für dich` : '';
  $('#today-tasks').innerHTML = due.slice(0, 6).map(taskRow).join('') || '<p class="empty">Alles erledigt. Mäuschenstill! 😴</p>';

  const low = S.stock_items.filter(isLow).length;
  $('#low-hint').innerHTML = low ? `<h2 class="sec">Vorrat</h2><button class="card row" data-go="vorrat" style="width:100%;text-align:left"><span style="font-size:24px">🧺</span><span class="t"><b>${low} ${low === 1 ? 'Artikel wird' : 'Artikel werden'} knapp</b><small>Tippen, um sie auf die Liste zu setzen</small></span><span class="muted">›</span></button>` : '';

  if (awayInfo) {
    const pts = awayInfo.reduce((a, l) => a + l.points, 0), who = NAME(awayInfo[0].by_who);
    const names = awayInfo.slice(0, 3).map(l => '„' + esc(l.task_name) + '“').join(', ') + (awayInfo.length > 3 ? ' …' : '');
    $('#away').innerHTML = `<h2 class="sec">Während du weg warst</h2><div class="card away"><b>${esc(who)} hat ${awayInfo.length} ${awayInfo.length === 1 ? 'Aufgabe' : 'Aufgaben'} erledigt (+${pts} 🧀)</b><p class="small" style="margin:4px 0 12px;font-weight:700">${names}. Was für eine Spitzenmaus!</p><div class="row"><button class="btn pink" id="away-thx">💛 Danke-Pfote</button><button class="btn soft" id="away-x" style="width:auto">OK</button></div></div>`;
  } else $('#away').innerHTML = '';

  const mem = [[addDays(td, -365), 'Heute vor einem Jahr'], [addDays(td, -30), 'Heute vor einem Monat'], [addDays(td, -7), 'Heute vor einer Woche']]
    .map(([d, l]) => [S.diary.find(x => x.day === d), l]).find(([x]) => x);
  $('#memory').innerHTML = mem ? `<h2 class="sec">${mem[1]} 📖</h2><div class="card memory"><div class="small muted" style="font-weight:800">${fmtDay(mem[0].day)} · ${esc(NAME(mem[0].created_by))}</div><p style="font-weight:800;margin-top:4px">${esc(mem[0].emoji)} ${esc(mem[0].body)}</p></div>` : '';

  const dueDate = h.due_date || '2027-06-15';
  const left = daysBetween(td, dueDate), wLeft = Math.max(0, Math.ceil(left / 7)), ssw = Math.min(40, Math.max(0, 40 - wLeft));
  $('#baby-left').textContent = left > 0 ? `Noch ~${wLeft} Wochen 👶` : 'Mini-Maus ist da (oder gleich)! 🎉';
  $('#baby-date').textContent = parseDay(dueDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  $('#shoes').innerHTML = Array.from({ length: 40 }, (_, i) => `<svg style="color:${i < ssw ? 'var(--pink-strong)' : 'var(--line)'}"><use href="#shoe"/></svg>`).join('');
}
$('#v-heute').addEventListener('click', async e => {
  if (e.target.closest('#away-x')) { awayInfo = null; renderHeute(); }
  if (e.target.closest('#away-thx')) {
    const logs = awayInfo; awayInfo = null; renderHeute();
    await act(async () => {
      for (const l of logs) await db.update('task_log', l.id, { thanked: true });
      await db.insert('task_log', { task_name: 'Danke-Pfote', points: 2, by_who: logs[0].by_who, kind: 'bonus' });
    });
    toast(`💛 Danke-Pfote an ${NAME(logs[0].by_who)} verschickt (+2 🧀)`);
  }
  const go = e.target.closest('[data-go]');
  if (go) { showView('einkauf'); showPane(go.dataset.go); }
});

/* ---------- Aufgaben ---------- */
const openTasks = () => S.tasks.filter(t => !t.done_at).sort((a, b) => a.due.localeCompare(b.due) || b.points - a.points);
const repeatLabel = n => (!n ? 'einmalig' : n === 1 ? 'täglich' : n === 7 ? 'wöchentlich' : n === 14 ? 'alle 2 Wochen' : n === 30 ? 'monatlich' : `alle ${n} Tage`);
function dueLabel(t) {
  const d = daysBetween(today(), t.due);
  if (d < 0) return `<span style="color:var(--red)">überfällig seit ${-d} ${-d === 1 ? 'Tag' : 'Tagen'}</span>`;
  return d === 0 ? 'heute' : d === 1 ? 'morgen' : `in ${d} Tagen`;
}
function taskRow(t) {
  return `<div class="task" data-task="${t.id}">
    <button class="check" aria-label="${esc(t.name)} erledigt">${tick}</button>
    <div class="t"><b>${esc(t.name)}</b><small>${t.minutes} Min. · ${dueLabel(t)} · ${repeatLabel(t.repeat_days)}${t.heavy ? ' · 💪' : ''}</small></div>
    <span class="pts">+${t.points} 🧀</span><span class="av ${t.assignee}">${t.assignee === 'b' ? '' : t.assignee === 'p' ? 'P' : 'M'}</span>
    <button class="more" data-edit-task="${t.id}" aria-label="Bearbeiten">⋯</button></div>`;
}
let tFilter = 'due';
function renderTasks() {
  const lv = levelOf(sumPts(S.me, new Date(0)));
  $('#lv-name').textContent = lv.name; $('#lv-n').textContent = 'Level ' + lv.n;
  $('#xp').style.width = Math.round(lv.pct * 100) + '%';
  $('#lv-next').innerHTML = lv.next ? `${lv.toNext} 🧀 bis zur Stufe <b>${lv.next}</b>` : 'Höchste Stufe erreicht. Respekt, Hoheit! 👑';

  const ws = weekStart(), td = today();
  const per = DAYS.map((_, i) => {
    const a = new Date(ws); a.setDate(a.getDate() + i); const b = new Date(a); b.setDate(b.getDate() + 1);
    return { p: sumPts('p', a, b), m: sumPts('m', a, b), ds: a.toLocaleDateString('sv-SE') };
  });
  const max = Math.max(20, ...per.map(x => x.p + x.m)), sc = 70 / max;
  $('#week').innerHTML = per.map((x, i) => `<div class="c ${x.ds === td ? 'today' : ''}"><div class="stack" style="height:${Math.max(3, (x.p + x.m) * sc)}px"><i style="height:${x.m * sc}px;background:var(--mues)"></i><i style="height:${x.p * sc}px;background:var(--pues)"></i></div><span>${DAYS[i]}</span></div>`).join('');

  const list = openTasks().filter(t =>
    tFilter === 'all' || (tFilter === 'due' && t.due <= td) || (tFilter === 'me' && (t.assignee === S.me || t.assignee === 'b')) || (tFilter === 'quick' && t.minutes <= 5));
  const overdue = list.some(t => t.due < td);
  $('#tasks').innerHTML = (list.map(taskRow).join('') || `<p class="empty">${tFilter === 'due' ? 'Nichts fällig. Mäuschenstill! 😴' : 'Keine Aufgaben hier.'}</p>`)
    + (overdue && tFilter === 'due' ? `<p class="small muted" style="padding:8px 4px">${pick(OVERDUE)}</p>` : '');
}
$('#t-chips').onclick = e => {
  const c = e.target.closest('.chip'); if (!c) return; tFilter = c.dataset.f;
  $$('#t-chips .chip').forEach(x => x.classList.toggle('on', x === c)); renderTasks();
};

let lastDone = null, prH, puH;
async function completeTask(task, el) {
  crumbs(el);
  el.closest('.task')?.classList.add('done');
  const prev = { due: task.due, done_at: task.done_at };
  await act(async () => {
    const [log] = await db.insert('task_log', { task_id: task.id, task_name: task.name, points: task.points, by_who: S.me });
    await db.update('tasks', task.id, task.repeat_days ? { due: addDays(today(), task.repeat_days) } : { done_at: new Date().toISOString() });
    lastDone = { task, prev, log };
    praise(task, log);
  });
  scheduleReload('tasks'); scheduleReload('task_log');
}
function praise(task, log) {
  const [emo, h, txt] = pick(task.points >= 20 ? PRAISE_BIG.concat(PRAISE) : PRAISE);
  $('#pr-emo').textContent = emo; $('#pr-h').textContent = h;
  $('#pr-t').textContent = fill(txt, task.name, NAME(S.me));
  $('#pr-p').textContent = `+${task.points} 🧀 fürs Wochenziel`;
  const p = $('#praise'); p.classList.add('show');
  clearTimeout(prH); prH = setTimeout(() => p.classList.remove('show'), 3800);
  if (DEMO) { // Vorschau, was die andere Maus sieht
    clearTimeout(puH);
    puH = setTimeout(() => showPush(fill(pick(PARTNER), task.name, NAME(S.me)), log, `So sieht's bei ${NAME(other())} aus`), 1500);
  }
}
$('#praise').addEventListener('click', async e => {
  if (e.target.closest('#pr-undo') && lastDone) {
    const { task, prev, log } = lastDone; lastDone = null;
    $('#praise').classList.remove('show'); $('#push').classList.remove('show'); clearTimeout(puH);
    await act(async () => { await db.remove('task_log', log.id); await db.update('tasks', task.id, prev); });
    toast('Rückgängig gemacht. Passiert den besten Mäusen.');
    return;
  }
  $('#praise').classList.remove('show');
});

let pushLog = null;
function showPush(text, log, label) {
  pushLog = log;
  $('#pu-t').textContent = text;
  $('#pu-label').hidden = !label; $('#pu-label').textContent = label || '';
  $('#push').classList.add('show');
  clearTimeout(showPush._h); showPush._h = setTimeout(() => $('#push').classList.remove('show'), 12000);
}
$('#pu-x').onclick = () => $('#push').classList.remove('show');
$('#pu-thx').onclick = async () => {
  $('#push').classList.remove('show');
  const l = pushLog; if (!l) return;
  await act(async () => {
    await db.update('task_log', l.id, { thanked: true });
    await db.insert('task_log', { task_name: 'Danke-Pfote', points: 2, by_who: l.by_who, kind: 'bonus' });
  });
  if (!DEMO) toast(`💛 Danke-Pfote verschickt (+2 🧀 für ${NAME(l.by_who)})`);
};

const TASK_FIELDS = [
  { k: 'name', label: 'Aufgabe', req: true, ph: 'z. B. Fenster putzen' },
  [{ k: 'points', label: 'Käse 🧀', type: 'select', num: true, options: [5, 10, 15, 20, 30, 50].map(n => [n, n + ' 🧀']), def: 10 },
   { k: 'minutes', label: 'Minuten', type: 'number', def: 10 }],
  [{ k: 'assignee', label: 'Wer?', type: 'select', options: [['b', 'Beide'], ['p', 'Püßmaus'], ['m', 'Müßmaus']], def: 'b' },
   { k: 'repeat_days', label: 'Wiederholen', type: 'select', num: true, options: [['null', 'einmalig'], [1, 'täglich'], [2, 'alle 2 Tage'], [3, 'alle 3 Tage'], [4, 'alle 4 Tage'], [7, 'wöchentlich'], [14, 'alle 2 Wochen'], [30, 'monatlich']], def: 'null' }],
  { k: 'due', label: 'Nächstes Mal fällig', type: 'date' },
  { k: 'heavy', label: '💪 Schwer oder mit Putzchemie (geht im Schwangerschaftsmodus an Püßmaus)', type: 'checkbox' },
];
const taskSave = vals => ({ ...vals, assignee: vals.heavy ? 'p' : vals.assignee, minutes: Math.round(vals.minutes) || 5 });
$('#add-task').onclick = () => sheet({
  title: 'Neue Aufgabe', fields: TASK_FIELDS, values: { due: today() }, saveLabel: 'Anlegen',
  onSave: v => db.insert('tasks', taskSave(v)),
});
document.addEventListener('click', e => {
  const chk = e.target.closest('.task .check');
  if (chk) {
    const id = chk.closest('.task').dataset.task;
    const task = S.tasks.find(t => t.id === id);
    if (task && !chk.closest('.task').classList.contains('done')) completeTask(task, chk);
    return;
  }
  const ed = e.target.closest('[data-edit-task]');
  if (ed) {
    const t = S.tasks.find(x => x.id === ed.dataset.editTask);
    sheet({
      title: 'Aufgabe bearbeiten', fields: TASK_FIELDS, values: { ...t, repeat_days: t.repeat_days ?? 'null' },
      onSave: v => db.update('tasks', t.id, taskSave(v)), onDelete: () => db.remove('tasks', t.id),
    });
  }
});

/* ---------- Käseladen ---------- */
function renderRewards() {
  const cur = S.household.reward;
  $('#rewards').innerHTML = S.rewards.slice().sort((a, b) => a.cost - b.cost).map(r => {
    const on = cur === `${r.emoji} ${r.name}`;
    return `<div class="contract" data-reward="${r.id}" style="cursor:pointer"><span style="font-size:24px;width:32px;text-align:center">${esc(r.emoji)}</span><div class="t"><b>${esc(r.name)}</b><small>${r.cost} 🧀${r.redeemed_count ? ` · schon ${r.redeemed_count}× eingelöst` : ''}</small></div>${on ? '<span class="tag cheese">Wochenziel</span>' : ''}<button class="more" data-edit-reward="${r.id}" aria-label="Bearbeiten">⋯</button></div>`;
  }).join('') || '<p class="empty">Noch keine Belohnungen.</p>';
}
const REWARD_FIELDS = [[{ k: 'emoji', label: 'Emoji', max: 4, def: '🎁' }, { k: 'cost', label: 'Kosten 🧀', type: 'number', def: 250 }], { k: 'name', label: 'Belohnung', req: true, ph: 'z. B. Kinoabend' }];
$('#add-reward').onclick = () => sheet({ title: 'Neue Belohnung', fields: REWARD_FIELDS, saveLabel: 'Anlegen', onSave: v => db.insert('rewards', v) });
$('#rewards').onclick = e => {
  const ed = e.target.closest('[data-edit-reward]');
  if (ed) {
    const r = S.rewards.find(x => x.id === ed.dataset.editReward);
    return sheet({ title: 'Belohnung bearbeiten', fields: REWARD_FIELDS, values: r, onSave: v => db.update('rewards', r.id, v), onDelete: () => db.remove('rewards', r.id) });
  }
  const row = e.target.closest('[data-reward]'); if (!row) return;
  const r = S.rewards.find(x => x.id === row.dataset.reward);
  act(() => db.updateHousehold(S.household.id, { week_goal: r.cost, reward: `${r.emoji} ${r.name}` }));
  toast(`Neues Wochenziel: ${r.emoji} ${r.name}`);
};
$('#goal').onclick = async () => {
  const ws = weekStart(), h = S.household;
  const reached = sumPts('p', ws) + sumPts('m', ws) >= h.week_goal;
  const redeemed = S.task_log.some(l => l.kind === 'reward' && new Date(l.done_at) >= ws);
  if (reached && !redeemed) {
    if (!confirm(`${h.reward} einlösen? 🎉`)) return;
    await act(async () => {
      await db.insert('task_log', { task_name: h.reward, points: 0, by_who: S.me, kind: 'reward' });
      const r = S.rewards.find(x => `${x.emoji} ${x.name}` === h.reward);
      if (r) await db.update('rewards', r.id, { redeemed_count: r.redeemed_count + 1 });
    });
    toast('🎉 Eingelöst! Viel Spaß, ihr Mäuse!', 3000);
    return;
  }
  showView('aufgaben');
  setTimeout(() => $('#rewards').scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
};

/* ---------- Einkauf ---------- */
const nameMatch = (itemName, stockName) => {
  const a = itemName.toLowerCase(), b = stockName.toLowerCase();
  return a.startsWith(b) || (a.length >= 3 && b.startsWith(a));
};
const onList = name => S.shopping_items.some(x => !x.done && nameMatch(x.name, name));
function renderShop() {
  const open = S.shopping_items.filter(s => !s.done), got = S.shopping_items.filter(s => s.done);
  const row = s => `<div class="item ${s.done ? 'done' : ''}" data-item="${s.id}"><button class="check" aria-label="${esc(s.name)} abhaken">${tick}</button><div class="t"><b>${esc(s.name)}</b>${s.qty || s.source ? `<small>${esc(s.qty)}${s.qty && s.source ? ' · ' : ''}${s.source ? esc(s.source) : ''}</small>` : ''}</div><button class="more" data-edit-item="${s.id}" aria-label="Bearbeiten">⋯</button></div>`;
  const aisles = AISLES.filter(a => open.some(s => s.aisle === a)).concat([...new Set(open.map(s => s.aisle))].filter(a => !AISLES.includes(a)));
  $('#shop').innerHTML = (open.length ? aisles.map(a => `<div class="aisle">${esc(a)}</div><div class="card flush">${open.filter(s => s.aisle === a).map(row).join('')}</div>`).join('') : '<p class="empty" style="margin-top:16px">Liste ist leer. Der Kühlschrank lacht dich an. 🧀</p>')
    + (got.length ? `<div class="aisle row" style="justify-content:space-between">✅ Im Korb (${got.length})<button class="link" id="clear-done">Korb leeren</button></div><div class="card flush" style="opacity:.7">${got.map(row).join('')}</div>` : '');
  $('#shop-cnt').textContent = open.length ? `${open.length} offen` : '';
  $('#shop-dot').hidden = !open.length; $('#shop-dot').textContent = open.length;
}
$('#f-shop').onsubmit = e => {
  e.preventDefault();
  const v = $('#shop-in').value.trim(); if (!v) return;
  const [name, ...rest] = v.split(','); const qty = rest.join(',').trim();
  const n = parseFloat(qty.replace(',', '.'));
  $('#shop-in').value = '';
  act(() => db.insert('shopping_items', { name: name.trim(), qty, add_qty: n > 0 ? n : 1, aisle: guessAisle(name), created_by: S.me }));
};
$('#shop').onclick = async e => {
  if (e.target.closest('#clear-done')) {
    const done = S.shopping_items.filter(s => s.done);
    return act(async () => { for (const s of done) await db.remove('shopping_items', s.id); });
  }
  const ed = e.target.closest('[data-edit-item]');
  if (ed) {
    const s = S.shopping_items.find(x => x.id === ed.dataset.editItem);
    return sheet({
      title: 'Artikel bearbeiten',
      fields: [{ k: 'name', label: 'Artikel', req: true }, { k: 'qty', label: 'Menge' }, { k: 'aisle', label: 'Gang', type: 'select', options: AISLES.map(a => [a, a]) }],
      values: s, onSave: v => db.update('shopping_items', s.id, v), onDelete: () => db.remove('shopping_items', s.id),
    });
  }
  const it = e.target.closest('.item'); if (!it) return;
  const s = S.shopping_items.find(x => x.id === it.dataset.item); if (!s) return;
  const done = !s.done;
  it.classList.toggle('done', done);
  await act(async () => {
    await db.update('shopping_items', s.id, { done, done_at: done ? new Date().toISOString() : null });
    const st = S.stock_items.find(x => nameMatch(s.name, x.name));
    if (st) {
      const q = Math.max(0, Number(st.qty) + (done ? 1 : -1) * Number(s.add_qty || 1));
      await db.update('stock_items', st.id, { qty: q });
      if (done) toast(`🧺 ${st.name} → Vorrat (${q} ${st.unit})`);
    }
  });
  if (done && !S.shopping_items.some(x => !x.done && x.id !== s.id)) toast('Alles im Korb! Ab nach Hause, Mäuse 🐭');
};

/* ---------- Vorrat ---------- */
const isLow = s => Number(s.qty) < Number(s.min_qty);
const AREAS = ['Kühlschrank', 'Tiefkühler', 'Trockenware', 'Konserven', 'Drogerie', 'Vorrat'];
function renderStock() {
  const low = S.stock_items.filter(isLow);
  $('#low-cnt').textContent = low.length ? `${low.length} Artikel` : '';
  $('#low').innerHTML = low.length
    ? low.map(s => {
        const on = onList(s.name);
        return `<div class="stock"><div class="t"><b>${esc(s.name)}</b><small>noch ${s.qty} ${esc(s.unit)} · Ziel ${s.min_qty}</small></div><span class="tag ${Number(s.qty) ? 'cheese' : 'red'}">${Number(s.qty) ? 'knapp' : 'leer'}</span><button class="mini ${on ? 'in' : ''}" data-buy="${s.id}" aria-label="Auf die Einkaufsliste">${on ? '✓' : '🛒'}</button></div>`;
      }).join('') + (low.some(s => !onList(s.name)) ? '<button class="btn" id="buy-all" style="margin-top:10px">🛒 Alles Knappe auf die Liste</button>' : '')
    : '<p class="empty">Alles gut gefüllt. Die Vorratskammer ist mäuserich! 🐭</p>';
  const has = n => S.stock_items.some(s => s.name.toLowerCase() === n.toLowerCase() && Number(s.qty) > 0);
  $('#cookable').innerHTML = DISHES.map(d => ({ ...d, miss: d.need.filter(x => !has(x)) }))
    .sort((a, b) => a.miss.length - b.miss.length)
    .map(d => `<div class="cook"><span class="e">${d.e}</span><div class="t"><b>${d.n}</b><small>${d.miss.length ? 'fehlt: ' + d.miss.join(', ') : 'alles da, sofort kochbar'} · ${d.p} g Eiweiß</small></div><span class="tag ${d.miss.length ? 'cheese' : 'green'}">${d.miss.length ? (d.need.length - d.miss.length) + '/' + d.need.length : '✅'}</span></div>`).join('');
  const groups = AREAS.filter(a => S.stock_items.some(s => s.area === a)).concat([...new Set(S.stock_items.map(s => s.area))].filter(a => !AREAS.includes(a)));
  $('#stock').innerHTML = groups.map(g => `<div class="aisle">${esc(g)}</div><div class="card flush">${S.stock_items.filter(s => s.area === g).sort((a, b) => a.name.localeCompare(b.name)).map(s => `<div class="stock"><button class="t" data-edit-stock="${s.id}" style="text-align:left"><b>${esc(s.name)}</b><small>${esc(s.unit)} · Ziel ${s.min_qty}</small></button>${isLow(s) ? `<span class="tag ${Number(s.qty) ? 'cheese' : 'red'}">${Number(s.qty) ? 'knapp' : 'leer'}</span>` : ''}<div class="step"><button data-d="-1" data-s="${s.id}" aria-label="weniger">−</button><b>${s.qty}</b><button data-d="1" data-s="${s.id}" aria-label="mehr">+</button></div></div>`).join('')}</div>`).join('')
    || '<p class="empty">Noch nichts im Vorrat.</p>';
}
const STOCK_FIELDS = [{ k: 'name', label: 'Produkt', req: true, ph: 'z. B. Haferflocken' }, [{ k: 'qty', label: 'Bestand', type: 'number', def: 1 }, { k: 'min_qty', label: 'Mindestens', type: 'number', def: 1 }], [{ k: 'unit', label: 'Einheit', def: 'Stk.', ph: 'Pck., Dosen …' }, { k: 'area', label: 'Wo?', type: 'select', options: AREAS.map(a => [a, a]), def: 'Vorrat' }]];
$('#add-stock').onclick = () => sheet({ title: 'Neu in den Vorrat', fields: STOCK_FIELDS, saveLabel: 'Anlegen', onSave: v => db.insert('stock_items', v) });
const addLowToList = s => db.insert('shopping_items', { name: s.name, qty: `${Number(s.min_qty) - Number(s.qty)} ${s.unit}`, add_qty: Number(s.min_qty) - Number(s.qty), aisle: guessAisle(s.name), source: 'aus dem Vorrat', created_by: S.me });
$('#p-vorrat').onclick = async e => {
  const st = e.target.closest('[data-s]');
  if (st) {
    const s = S.stock_items.find(x => x.id === st.dataset.s);
    s.qty = Math.max(0, Number(s.qty) + Number(st.dataset.d)); renderStock();
    return act(() => db.update('stock_items', s.id, { qty: s.qty }));
  }
  const ed = e.target.closest('[data-edit-stock]');
  if (ed) {
    const s = S.stock_items.find(x => x.id === ed.dataset.editStock);
    return sheet({ title: 'Vorrat bearbeiten', fields: STOCK_FIELDS, values: s, onSave: v => db.update('stock_items', s.id, v), onDelete: () => db.remove('stock_items', s.id) });
  }
  const b = e.target.closest('[data-buy]');
  if (b) {
    const s = S.stock_items.find(x => x.id === b.dataset.buy);
    if (onList(s.name)) return toast('Steht schon auf der Liste 👍');
    await act(() => addLowToList(s)); return toast(`„${s.name}“ steht auf der Liste 🛒`);
  }
  if (e.target.closest('#buy-all')) {
    const todo = S.stock_items.filter(isLow).filter(s => !onList(s.name));
    await act(async () => { for (const s of todo) await addLowToList(s); });
    toast(`${todo.length} Artikel auf die Liste gesetzt 🛒`);
  }
};
function showPane(p) {
  $$('#seg button').forEach(x => x.classList.toggle('on', x.dataset.p === p));
  $$('#v-einkauf .pane').forEach(x => x.classList.toggle('on', x.id === 'p-' + p));
}
$('#seg').onclick = e => { const b = e.target.closest('button'); if (b) showPane(b.dataset.p); };

/* ---------- Mauseloch: Infos ---------- */
const NOTE_FIELDS = [[{ k: 'emoji', label: 'Emoji', max: 4, def: '📌' }, { k: 'pinned', label: 'Oben anpinnen', type: 'checkbox' }], { k: 'title', label: 'Titel', req: true, ph: 'z. B. Müllabfuhr' }, { k: 'body', label: 'Inhalt', type: 'textarea', ph: 'Alles, was sonst im Chat verloren geht …' }];
function renderNotes() {
  const list = S.notes.slice().sort((a, b) => (b.pinned - a.pinned) || b.created_at.localeCompare(a.created_at));
  $('#notes').innerHTML = list.map(n => `<button class="card note" data-note="${n.id}"><b>${esc(n.emoji)} ${esc(n.title)}${n.pinned ? ' 📌' : ''}</b><span>${esc(n.body)}</span></button>`).join('')
    + '<button class="card note add-note" id="add-note">+ Info</button>';
}
$('#notes').onclick = e => {
  if (e.target.closest('#add-note')) return sheet({ title: 'Neue Info', fields: NOTE_FIELDS, saveLabel: 'Anlegen', onSave: v => db.insert('notes', { ...v, created_by: S.me }) });
  const b = e.target.closest('[data-note]'); if (!b) return;
  const n = S.notes.find(x => x.id === b.dataset.note);
  sheet({ title: 'Info bearbeiten', fields: NOTE_FIELDS, values: n, onSave: v => db.update('notes', n.id, v), onDelete: () => db.remove('notes', n.id) });
};

/* ---------- Tagebuch ---------- */
const EMOS = ['💛', '😂', '🍝', '🌳', '👶', '🎉', '✈️', '🥰'];
let emo = EMOS[0];
$('#emo').innerHTML = EMOS.map((x, i) => `<button type="button" class="${i ? '' : 'on'}">${x}</button>`).join('');
$('#emo').onclick = e => {
  const b = e.target.closest('button'); if (!b) return; emo = b.textContent;
  $$('#emo button').forEach(x => x.classList.toggle('on', x === b));
};
function renderDiary() {
  const list = S.diary.slice().sort((a, b) => b.day.localeCompare(a.day) || b.created_at.localeCompare(a.created_at));
  $('#diary').innerHTML = list.map(x => `<div class="entry"><div class="card"><div style="flex:1;min-width:0"><div class="d">${x.day === today() ? 'Heute' : fmtDay(x.day)} · ${esc(NAME(x.created_by))}</div><p>${esc(x.emoji)} ${esc(x.body)}</p></div><button class="more" data-diary="${x.id}" aria-label="Bearbeiten">⋯</button></div></div>`).join('')
    || '<p class="empty">Noch keine Momente. Der erste schöne Moment wartet schon! ✨</p>';
}
$('#f-diary').onsubmit = e => {
  e.preventDefault(); const v = $('#diary-in').value.trim(); if (!v) return;
  $('#diary-in').value = '';
  act(async () => { await db.insert('diary', { body: v, emoji: emo, day: today(), created_by: S.me }); toast('📖 Moment festgehalten'); });
};
$('#diary').onclick = e => {
  const b = e.target.closest('[data-diary]'); if (!b) return;
  const x = S.diary.find(d => d.id === b.dataset.diary);
  sheet({
    title: 'Moment bearbeiten',
    fields: [[{ k: 'emoji', label: 'Emoji', max: 4 }, { k: 'day', label: 'Tag', type: 'date' }], { k: 'body', label: 'Was war schön?', type: 'textarea', req: true }],
    values: x, onSave: v => db.update('diary', x.id, v), onDelete: () => db.remove('diary', x.id),
  });
};

/* ---------- Baby-Checkliste ---------- */
const BABY_FIELDS = [{ k: 'name', label: 'Was?', req: true }, { k: 'hint', label: 'Hinweis' }, [{ k: 'due_label', label: 'Bis wann?', ph: 'z. B. bis März' }, { k: 'sort', label: 'Reihenfolge', type: 'number', def: 10 }], { k: 'urgent', label: '🚨 Dringend', type: 'checkbox' }];
function renderBaby() {
  const list = S.baby_todos.slice().sort((a, b) => (a.done - b.done) || a.sort - b.sort);
  $('#baby').innerHTML = list.map(b => `<div class="task ${b.done ? 'done' : ''}" data-baby="${b.id}"><button class="check bcheck" aria-label="${esc(b.name)} erledigt">${tick}</button><div class="t wrap"><b>${esc(b.name)}</b><small>${esc(b.hint)}</small></div>${b.done ? '' : `<span class="tag ${b.urgent ? 'red' : 'cheese'}">${esc(b.due_label || 'offen')}</span>`}<button class="more" data-edit-baby="${b.id}" aria-label="Bearbeiten">⋯</button></div>`).join('')
    || '<p class="empty">Alles erledigt. Mini-Maus kann kommen! 👶</p>';
}
$('#baby').addEventListener('click', e => {
  e.stopPropagation(); // nicht als Haushaltsaufgabe behandeln
  const ed = e.target.closest('[data-edit-baby]');
  if (ed) {
    const b = S.baby_todos.find(x => x.id === ed.dataset.editBaby);
    return sheet({ title: 'Punkt bearbeiten', fields: BABY_FIELDS, values: b, onSave: v => db.update('baby_todos', b.id, v), onDelete: () => db.remove('baby_todos', b.id) });
  }
  const c = e.target.closest('.bcheck'); if (!c) return;
  const b = S.baby_todos.find(x => x.id === c.closest('[data-baby]').dataset.baby);
  if (!b.done) { crumbs(c); toast('👶 Abgehakt! Mini-Maus wäre stolz.'); }
  act(() => db.update('baby_todos', b.id, { done: !b.done }));
});
$('#add-baby').onclick = () => sheet({ title: 'Neuer Punkt', fields: BABY_FIELDS, saveLabel: 'Anlegen', onSave: v => db.insert('baby_todos', v) });

/* ---------- Einstellungen ---------- */
function renderSettings() { $('#invite-code').textContent = S.household.invite_code; }
$('#edit-due').onclick = () => sheet({
  title: 'Geburtstermin', fields: [{ k: 'due_date', label: 'Errechneter Termin', type: 'date', req: true }],
  values: S.household, onSave: v => db.updateHousehold(S.household.id, v),
});
$('#sign-out').onclick = async () => {
  if (!confirm(DEMO ? 'Demo zurücksetzen? Alle Demo-Daten werden gelöscht.' : 'Wirklich abmelden?')) return;
  await db.signOut(); location.reload();
};

/* ============ Navigation ============ */
function showView(v) {
  $$('#tabs button').forEach(x => x.classList.toggle('on', x.dataset.v === v));
  $$('.view').forEach(x => x.classList.toggle('on', x.id === 'v-' + v));
  scrollTo({ top: 0 });
}
$('#tabs').onclick = e => { const b = e.target.closest('button'); if (b) showView(b.dataset.v); };

/* ============ Los geht's ============ */
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
(async () => {
  try {
    db = await createDb();
    // Nach jeder eigenen Änderung sofort neu laden (zusätzlich zum Live-Sync)
    for (const m of ['insert', 'update', 'remove']) {
      const f = db[m];
      db[m] = async (t, ...a) => { const r = await f(t, ...a); scheduleReload(t); return r; };
    }
    const uh = db.updateHousehold;
    db.updateHousehold = async (...a) => { const r = await uh(...a); scheduleReload('households'); return r; };
    await route();
  }
  catch (e) {
    console.error(e);
    showAuth('login'); authErr('Verbindung fehlgeschlagen: ' + e.message);
  }
})();
