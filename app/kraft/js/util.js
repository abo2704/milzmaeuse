// Kleine Helfer: Formatierung, Zahlen-/Zeit-Eingabe, Datum.
export const $ = (s, r = document) => r.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
export const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');

// "62,5" oder "62.5" → 62.5; leer/ungültig → null
export function num(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export const fmtNum = (n, d = 1) => n == null ? '' : (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('de-DE');
export const fmtKg = w => fmtNum(w, 2) + ' kg';
export const fmtDist = m => m == null ? '' : m >= 1000 ? fmtNum(m / 1000, 2) + ' km' : fmtNum(m, 1) + ' m';
export function fmtTime(sec) {
  if (sec == null || !Number.isFinite(sec)) return '';
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
// Zeit-Eingabe wie bei der Mikrowelle: "45" → 0:45, "130" → 1:30, "1:30" → 1:30
export function parseTime(str) {
  if (str == null) return null;
  str = String(str).trim();
  if (!str) return null;
  if (str.includes(':')) {
    const p = str.split(':').map(x => parseInt(x || '0', 10));
    if (p.some(isNaN)) return null;
    return p.reduce((a, b) => a * 60 + b, 0);
  }
  const dg = str.replace(/\D/g, '');
  if (!dg) return null;
  if (dg.length <= 2) return +dg;
  const s = +dg.slice(-2), rest = dg.slice(0, -2);
  if (rest.length <= 2) return +rest * 60 + s;
  return +rest.slice(0, -2) * 3600 + +rest.slice(-2) * 60 + s;
}

export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const fmtDate = ts => new Date(ts).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtDateLong = ts => new Date(ts).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const fmtShort = ts => new Date(ts).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
export const fmtClock = ts => new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
export const monthLabel = ts => new Date(ts).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
export function weekStart(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return d;
}
export function daysAgo(ts) {
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(ts); b.setHours(0, 0, 0, 0);
  return Math.round((a - b) / 86400000);
}
export function relDay(ts) {
  const n = daysAgo(ts);
  if (n === 0) return 'heute';
  if (n === 1) return 'gestern';
  if (n < 7) return `vor ${n} Tagen`;
  if (n < 14) return 'vor einer Woche';
  if (n < 60) return `vor ${Math.floor(n / 7)} Wochen`;
  return fmtShort(ts);
}
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
