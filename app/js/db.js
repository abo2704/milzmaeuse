// Datenschicht: dieselbe Schnittstelle für Supabase (echt) und Demo-Modus (localStorage).
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

export const TABLES = ['shopping_items', 'stock_items', 'notes', 'diary', 'tasks', 'task_log', 'rewards', 'baby_todos', 'contracts', 'ideas', 'recipes'];
export const DEMO = !SUPABASE_URL || !SUPABASE_KEY || new URLSearchParams(location.search).has('demo');

const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD in lokaler Zeit

// Spiegelt die Spalten-Defaults aus schema.sql (nur für den Demo-Modus nötig)
const DEFAULTS = {
  shopping_items: () => ({ qty: '', aisle: 'Sonstiges', add_qty: 1, source: null, done: false, done_at: null }),
  stock_items: () => ({ qty: 0, unit: 'Stk.', min_qty: 1, area: 'Vorrat' }),
  notes: () => ({ emoji: '📌', body: '', pinned: false }),
  diary: () => ({ day: today(), emoji: '💛' }),
  tasks: () => ({ points: 10, minutes: 10, assignee: 'b', repeat_days: null, due: today(), heavy: false, done_at: null, next_task_id: null, chained: false, after_days: 0, together: false }),
  task_log: () => ({ kind: 'task', thanked: false, together: false, done_at: new Date().toISOString() }),
  rewards: () => ({ emoji: '🎁', cost: 250, redeemed_count: 0 }),
  baby_todos: () => ({ hint: '', due_label: '', urgent: false, done: false, sort: 0 }),
  ideas: () => ({ category: 'wohnung', body: '', link: '', status: 'idee', paws: [], done_at: null }),
  recipes: () => ({ source_url: '', image: '', servings: 2, ingredients: [], note: '', cooked_count: 0, last_cooked: null }),
  contracts: () => ({ category: 'sonstiges', provider: '', owner: 'g', cost: 0, billing: 'monat', end_date: null, notice_months: 1, renewal_months: 0, remind_weeks: 6, price_until: null, customer_no: '', note: '' }),
};

export async function createDb() {
  return DEMO ? demoDb() : supaDb();
}

async function supaDb() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  const ok = ({ data, error }) => { if (error) throw error; return data; };

  const api = {
    demo: false,
    async session() { return (await sb.auth.getSession()).data.session; },
    async signIn(email, password) { ok(await sb.auth.signInWithPassword({ email, password })); },
    // gibt true zurück, wenn direkt eingeloggt (E-Mail-Bestätigung aus), sonst false (Bestätigungsmail unterwegs)
    async signUp(email, password) { return !!ok(await sb.auth.signUp({ email, password })).session; },
    async signOut() { await sb.auth.signOut(); },
    async membership() {
      const s = await api.session(); if (!s) return null;
      return ok(await sb.from('members').select('*').eq('user_id', s.user.id).maybeSingle());
    },
    async members() { return ok(await sb.from('members').select('*')); },
    async household() { return ok(await sb.from('households').select('*').single()); },
    async updateHousehold(id, patch) { ok(await sb.from('households').update(patch).eq('id', id)); },
    async createHousehold(who, name) { return ok(await sb.rpc('create_household', { p_who: who, p_name: name })); },
    async joinHousehold(code, who, name) { return ok(await sb.rpc('join_household', { p_code: code, p_who: who, p_name: name })); },
    async list(t) { return ok(await sb.from(t).select('*').order('created_at', { ascending: false })); },
    // defaultToNull:false → fehlende Felder bekommen die Spalten-Defaults statt NULL
    async insert(t, row) { return ok(await sb.from(t).insert(Array.isArray(row) ? row : [row], { defaultToNull: false }).select()); },
    async update(t, id, patch) { ok(await sb.from(t).update(patch).eq('id', id)); },
    async remove(t, id) { ok(await sb.from(t).delete().eq('id', id)); },
    async importRecipe(url) {
      const { data, error } = await sb.functions.invoke('recipe-import', { body: { url } });
      if (error) {
        let msg = error.message;
        try { msg = (await error.context.json()).error || msg; } catch { /* keine JSON-Antwort */ }
        if (/not found|404/i.test(msg)) msg = 'Die Funktion „recipe-import“ ist in Supabase noch nicht eingerichtet.';
        throw new Error(msg);
      }
      return data;
    },
    onChange(cb, skip = []) {
      const ch = sb.channel('milzmaeuse');
      [...TABLES, 'households', 'members'].filter(t => !skip.includes(t)).forEach(t =>
        ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, p => cb(t, p)));
      ch.subscribe();
    },
  };
  return api;
}

function demoDb() {
  const KEY = 'mm-demo-v1';
  let st = null;
  try { st = JSON.parse(localStorage.getItem(KEY)); } catch { /* privat/blockiert */ }
  st ||= { who: 'p', household: null, members: [], tables: {} };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* egal */ } };
  const listeners = [];
  const emit = (t, p) => setTimeout(() => listeners.forEach(f => f(t, p)), 0);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now());
  const rows = t => (st.tables[t] ||= []);

  const api = {
    demo: true,
    async session() { return { user: { id: 'demo-' + st.who } }; },
    async signIn() {},
    async signUp() { return true; },
    async signOut() { st = { who: 'p', household: null, members: [], tables: {} }; save(); },
    async membership() { return st.members.find(m => m.who === st.who) || null; },
    async members() { return st.members; },
    async household() { return st.household; },
    async updateHousehold(id, patch) { Object.assign(st.household, patch); save(); emit('households', {}); },
    async createHousehold(who) {
      st.household = { id: 'demo', name: 'Die Milzmäuse', invite_code: 'DEMO42', week_goal: 250, reward: '🍕 Pizza / Essen bestellen', due_date: '2027-06-15' };
      st.members = [{ user_id: 'demo-p', who: 'p', name: 'Püßmaus' }, { user_id: 'demo-m', who: 'm', name: 'Müßmaus' }];
      st.who = who; save(); return 'demo';
    },
    async joinHousehold(code, who) { return api.createHousehold(who); },
    async list(t) { return [...rows(t)].sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async insert(t, row) {
      const list = (Array.isArray(row) ? row : [row]).map((r, i) => ({
        id: uid(), household_id: 'demo', created_at: new Date(Date.now() - i).toISOString(), ...DEFAULTS[t](), ...r,
      }));
      rows(t).push(...list); save(); emit(t, { eventType: 'INSERT', new: list[0] }); return list;
    },
    async update(t, id, patch) {
      const r = rows(t).find(x => x.id === id); if (!r) return;
      Object.assign(r, patch); save(); emit(t, { eventType: 'UPDATE', new: r });
    },
    async remove(t, id) { st.tables[t] = rows(t).filter(x => x.id !== id); save(); emit(t, { eventType: 'DELETE', old: { id } }); },
    onChange(cb) { listeners.push(cb); },
    // Demo: kein Server → immer das Beispielrezept
    async importRecipe() { const { DEMO_RECIPE } = await import('./recipes.js'); return { ...DEMO_RECIPE, source: 'kptncook.com (Demo)' }; },
    // nur Demo: zwischen Püßmaus und Müßmaus wechseln
    setWho(w) { st.who = w; save(); },
    getWho() { return st.who; },
  };
  return api;
}
