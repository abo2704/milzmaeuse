-- ============================================================
--  Die Milzmäuse – Datenbankschema
--  Ausführen in Supabase: SQL Editor → New query → alles einfügen → Run
--  Das Skript kann gefahrlos nur EINMAL auf einer leeren Datenbank laufen.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Haushalt & Mitglieder ----------
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Die Milzmäuse',
  invite_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  week_goal   int  not null default 250,
  reward      text not null default '🍕 Pizza / Essen bestellen',
  due_date    date not null default '2027-06-15',
  created_at  timestamptz not null default now()
);

create table public.members (
  user_id      uuid primary key references auth.users on delete cascade,
  household_id uuid not null references public.households on delete cascade,
  who          text not null check (who in ('p','m')),
  name         text not null,
  created_at   timestamptz not null default now(),
  unique (household_id, who)
);

-- Haushalt des eingeloggten Nutzers (security definer, damit RLS nicht rekursiv wird)
create or replace function public.my_household() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from public.members where user_id = auth.uid()
$$;

-- ---------- Inhalte ----------
create table public.shopping_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households on delete cascade,
  name         text not null,
  qty          text not null default '',
  aisle        text not null default 'Sonstiges',
  add_qty      numeric not null default 1,
  source       text,
  done         boolean not null default false,
  done_at      timestamptz,
  created_by   text,
  created_at   timestamptz not null default now()
);

create table public.stock_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households on delete cascade,
  name         text not null,
  qty          numeric not null default 0,
  unit         text not null default 'Stk.',
  min_qty      numeric not null default 1,
  area         text not null default 'Vorrat',
  created_at   timestamptz not null default now()
);

create table public.notes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households on delete cascade,
  emoji        text not null default '📌',
  title        text not null,
  body         text not null default '',
  pinned       boolean not null default false,
  created_by   text,
  created_at   timestamptz not null default now()
);

create table public.diary (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households on delete cascade,
  day          date not null default current_date,
  emoji        text not null default '💛',
  body         text not null,
  created_by   text,
  created_at   timestamptz not null default now()
);

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households on delete cascade,
  name         text not null,
  points       int  not null default 10,
  minutes      int  not null default 10,
  assignee     text not null default 'b' check (assignee in ('p','m','b')),
  repeat_days  int,
  due          date not null default current_date,
  heavy        boolean not null default false,
  done_at      timestamptz,
  created_at   timestamptz not null default now()
);

create table public.task_log (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households on delete cascade,
  task_id      uuid references public.tasks on delete set null,
  task_name    text not null,
  points       int  not null,
  by_who       text not null check (by_who in ('p','m')),
  kind         text not null default 'task',
  thanked      boolean not null default false,
  done_at      timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create table public.rewards (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null default public.my_household() references public.households on delete cascade,
  emoji          text not null default '🎁',
  name           text not null,
  cost           int  not null default 250,
  redeemed_count int  not null default 0,
  created_at     timestamptz not null default now()
);

create table public.baby_todos (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households on delete cascade,
  name         text not null,
  hint         text not null default '',
  due_label    text not null default '',
  urgent       boolean not null default false,
  done         boolean not null default false,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);

-- ---------- Zugriffsschutz (Row Level Security) ----------
-- Jede*r sieht und ändert nur die Daten des eigenen Haushalts.
alter table public.households enable row level security;
alter table public.members    enable row level security;

create policy "eigener Haushalt lesen"   on public.households for select using (id = public.my_household());
create policy "eigener Haushalt ändern"  on public.households for update using (id = public.my_household());
create policy "Mitglieder lesen"         on public.members    for select using (household_id = public.my_household());

do $$
declare t text;
begin
  foreach t in array array['shopping_items','stock_items','notes','diary','tasks','task_log','rewards','baby_todos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Haushalt" on public.%I for all using (household_id = public.my_household()) with check (household_id = public.my_household())', t);
  end loop;
end $$;

-- ---------- Haushalt gründen / beitreten ----------
create or replace function public.create_household(p_who text, p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'Nicht eingeloggt'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'Schon in einem Haushalt'; end if;
  insert into households default values returning id into hid;
  insert into members (user_id, household_id, who, name) values (auth.uid(), hid, p_who, p_name);
  return hid;
end $$;

create or replace function public.join_household(p_code text, p_who text, p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'Nicht eingeloggt'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'Schon in einem Haushalt'; end if;
  select id into hid from households where invite_code = upper(trim(p_code));
  if hid is null then raise exception 'Einladungscode unbekannt'; end if;
  if exists (select 1 from members where household_id = hid and who = p_who) then
    raise exception 'Diese Maus gibt es in dem Haushalt schon';
  end if;
  insert into members (user_id, household_id, who, name) values (auth.uid(), hid, p_who, p_name);
  return hid;
end $$;

revoke all on function public.create_household(text, text) from public, anon;
revoke all on function public.join_household(text, text, text) from public, anon;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text, text) to authenticated;

-- ---------- Live-Sync ----------
alter publication supabase_realtime add table
  public.households, public.members, public.shopping_items, public.stock_items, public.notes,
  public.diary, public.tasks, public.task_log, public.rewards, public.baby_todos;
