-- ============================================================
--  Die Milzmäuse – Erweiterung 005: Zweite Wäsche-Ladung + Teamwork-Aufgaben
--  Ausführen in Supabase: SQL Editor → New query → alles einfügen → Run (einmalig)
-- ============================================================

-- Teamwork: Aufgabe wird meist zu zweit erledigt → Käse wird automatisch geteilt
alter table public.tasks    add column if not exists together boolean not null default false;
alter table public.task_log add column if not exists together boolean not null default false;

-- Einkaufen ist standardmäßig Teamwork
update public.tasks set together = true where name ilike '%einkauf%';

-- Zweite Wäsche-Kette für Tage mit doppelter Wäsche.
-- "Wäsche waschen (2. Ladung)" ist eine Bei-Bedarf-Aufgabe (repeat_days = 0): immer abhakbar, nie überfällig.
do $$
declare
  h uuid; w uuid; a uuid; b uuid;
begin
  for h in select id from public.households loop
    if exists (select 1 from public.tasks where household_id = h and name = 'Wäsche waschen (2. Ladung)') then continue; end if;
    insert into public.tasks (household_id, name, points, minutes, assignee, chained, after_days, done_at)
      values (h, 'Wäsche abhängen (2. Ladung)', 10, 10, 'p', true, 1, now()) returning id into b;
    insert into public.tasks (household_id, name, points, minutes, assignee, chained, after_days, done_at, next_task_id)
      values (h, 'Wäsche aufhängen (2. Ladung)', 10, 10, 'm', true, 0, now(), b) returning id into a;
    insert into public.tasks (household_id, name, points, minutes, assignee, repeat_days, due, next_task_id)
      values (h, 'Wäsche waschen (2. Ladung)', 10, 5, 'b', 0, current_date, a) returning id into w;
  end loop;
end $$;
