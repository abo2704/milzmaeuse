-- ============================================================
--  Die Milzmäuse – Erweiterung 004: Ideen-Pinnwand + Rezeptbox
--  Ausführen in Supabase: SQL Editor → New query → alles einfügen → Run (einmalig)
-- ============================================================

create table public.ideas (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households on delete cascade,
  category     text not null default 'wohnung',
  title        text not null,
  body         text not null default '',
  link         text not null default '',
  status       text not null default 'idee' check (status in ('idee','geplant','erledigt')),
  paws         text[] not null default '{}',   -- wer eine Pfote draufgesetzt hat: 'p' / 'm'
  created_by   text,
  done_at      timestamptz,
  created_at   timestamptz not null default now()
);

create table public.recipes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households on delete cascade,
  title        text not null,
  source_url   text not null default '',
  image        text not null default '',
  servings     numeric not null default 2,      -- Portionen laut Originalrezept
  ingredients  jsonb not null default '[]',     -- Zutatenzeilen wie im Original, z. B. "200 g Tomate"
  note         text not null default '',
  cooked_count int  not null default 0,
  last_cooked  date,
  created_by   text,
  created_at   timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['ideas','recipes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Haushalt" on public.%I for all using (household_id = public.my_household()) with check (household_id = public.my_household())', t);
  end loop;
end $$;

alter publication supabase_realtime add table public.ideas, public.recipes;
