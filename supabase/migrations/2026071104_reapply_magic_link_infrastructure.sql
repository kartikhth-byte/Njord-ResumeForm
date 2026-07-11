-- The magic-link infrastructure migration (2026060306) was marked applied
-- during the old history repair but never actually executed — the
-- applicant_magic_link_requests table was missing, breaking the deployed
-- request-applicant-magic-link function with a 500. Replay it verbatim
-- (every statement is idempotent).

begin;

create table if not exists public.applicant_magic_link_requests (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references public.prospects(id) on delete set null,
  email text not null,
  email_normalized text not null,
  request_status text not null default 'attempted',
  sent_to_email text,
  sent_at timestamptz,
  invalidated_at timestamptz,
  invalidation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applicant_magic_link_requests_status_check check (
    request_status in ('attempted', 'sent', 'suppressed', 'rate_limited', 'invalidated')
  ),
  constraint applicant_magic_link_requests_invalidation_reason_check check (
    invalidated_at is null or nullif(trim(invalidation_reason), '') is not null
  )
);

create index if not exists applicant_magic_link_requests_email_created_at_idx
  on public.applicant_magic_link_requests (email_normalized, created_at desc);

create index if not exists applicant_magic_link_requests_prospect_id_idx
  on public.applicant_magic_link_requests (prospect_id);

create index if not exists applicant_magic_link_requests_request_status_idx
  on public.applicant_magic_link_requests (request_status);

create or replace function public.touch_applicant_magic_link_requests_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists touch_applicant_magic_link_requests_updated_at on public.applicant_magic_link_requests;

create trigger touch_applicant_magic_link_requests_updated_at
before update on public.applicant_magic_link_requests
for each row
execute function public.touch_applicant_magic_link_requests_updated_at();

commit;
