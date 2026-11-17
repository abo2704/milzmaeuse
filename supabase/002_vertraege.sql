-- ============================================================
--  Die Milzmäuse – Erweiterung 002: Verträge
--  Ausführen in Supabase: SQL Editor → New query → alles einfügen → Run (einmalig)
-- ============================================================

create table public.contracts (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null default public.my_household() references public.households on delete cascade,
  category       text not null default 'sonstiges',
  name           text not null,
  provider       text not null default '',
  owner          text not null default 'g' check (owner in ('g','p','m')),  -- g = gemeinsam
  cost           numeric not null default 0,
  billing        text not null default 'monat' check (billing in ('monat','quartal','jahr')),
  end_date       date,                       -- Ende der aktuellen (Mindest-)Laufzeit
  notice_months  int  not null default 1,    -- Kündigungsfrist in Monaten
  renewal_months int  not null default 0,    -- danach: 0 = monatlich kündbar, sonst Verlängerung um X Monate
  remind_weeks   int  not null default 6,    -- so viele Wochen vor Fristende erinnern
  price_until    date,                       -- Preisgarantie bis
  customer_no    text not null default '',
  note           text not null default '',
  created_at     timestamptz not null default now()
);

alter table public.contracts enable row level security;
create policy "Haushalt" on public.contracts for all
  using (household_id = public.my_household()) with check (household_id = public.my_household());

alter publication supabase_realtime add table public.contracts;
