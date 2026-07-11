-- Structured data capture the funnel was missing:
-- 1. Rejection taxonomy (category, tags, notes, keep-warm flag) — wired to the
--    previously-orphaned RejectionModal so "why we lose candidates" is queryable.
-- 2. Contract end date on hired applications — enables "crew coming available"
--    alerts and proactive re-placement.
-- 3. Event outcome on scheduled events — records interview/test no-shows.

begin;

alter table public.applications
  add column if not exists rejection_category text,
  add column if not exists rejection_tags jsonb not null default '[]'::jsonb,
  add column if not exists rejection_notes text,
  add column if not exists contact_for_future_roles boolean,
  add column if not exists contract_end_date date;

create index if not exists applications_contract_end_date_idx
  on public.applications (contract_end_date)
  where contract_end_date is not null;

alter table public.scheduled_events
  add column if not exists outcome text;

alter table public.scheduled_events
  drop constraint if exists scheduled_events_outcome_check;

alter table public.scheduled_events
  add constraint scheduled_events_outcome_check check (
    outcome is null or outcome in ('completed', 'no_show', 'cancelled')
  );

commit;
