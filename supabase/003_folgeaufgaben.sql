-- ============================================================
--  Die Milzmäuse – Erweiterung 003: Folgeaufgaben (Aufgaben-Ketten)
--  z. B. Wäsche waschen → Wäsche aufhängen (Müßmaus) → Wäsche abhängen (Püßmaus)
--  Ausführen in Supabase: SQL Editor → New query → alles einfügen → Run (einmalig)
-- ============================================================

alter table public.tasks
  add column next_task_id uuid references public.tasks(id) on delete set null,  -- was danach kommt
  add column chained      boolean not null default false,  -- true = erscheint nur, wenn der Vorgänger erledigt wurde
  add column after_days   int     not null default 0;      -- so viele Tage nach dem Vorgänger fällig

-- Bestehende Wäsche-Aufgaben verketten
update public.tasks set chained = true, after_days = 0, assignee = 'm', repeat_days = null, done_at = now()
  where name = 'Wäsche aufhängen';
update public.tasks set chained = true, after_days = 1, assignee = 'p', repeat_days = null, done_at = now()
  where name like 'Wäsche abhängen%';

update public.tasks w set next_task_id = (
  select a.id from public.tasks a where a.household_id = w.household_id and a.name = 'Wäsche aufhängen' limit 1)
  where w.name = 'Wäsche waschen';
update public.tasks a set next_task_id = (
  select b.id from public.tasks b where b.household_id = a.household_id and b.name like 'Wäsche abhängen%' limit 1)
  where a.name = 'Wäsche aufhängen';
