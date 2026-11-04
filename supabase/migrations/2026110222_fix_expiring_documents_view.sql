-- v_expiring_documents read paths the long form never writes
-- (section3.passport.expiryDate, section3.seamanBook, section5.cocExpiryDate,
-- section7.medicalCertificate, section7.yellowFever), so the Expiry page and the
-- expiry warnings always saw nothing. It also ran as its owner, so it would have
-- bypassed RLS once it returned rows.
--
-- This version reads the real form paths, covers every document the form
-- collects with an expiry date, tolerates bad dates, and runs as the caller.
-- Column names and order are unchanged; document_key (unique per document within
-- an application) is added at the end. document_type uses the values allowed by
-- document_expiries.valid_document_type (passport, seaman_book, visa, coc, gmdss,
-- medical, yellow_fever, course, endorsement).
--
-- Expiry warnings read document_expiries, which nothing ever filled (0 rows in
-- production). get_documents_needing_warnings now syncs it from
-- v_application_documents first, keyed by (application_id, document_key), so
-- each document keeps a stable id and its sent-notification history. When a
-- document's expiry date changes, its old notifications are cleared so the new
-- date gets warnings. Documents already inside a warning window when this is
-- applied are marked as warned without sending (backlog). NOT APPLIED.

begin;

create or replace function public.try_parse_date(p_value text)
returns date
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if p_value is null or p_value !~ '^\d{4}-\d{2}-\d{2}' then
    return null;
  end if;
  return left(p_value, 10)::date;
exception when others then
  return null;
end;
$$;

create or replace function public.jsonb_array_or_empty(p_value jsonb)
returns jsonb
language sql
immutable
as $$
  select case when jsonb_typeof(p_value) = 'array' then p_value else '[]'::jsonb end
$$;

create or replace view public.v_application_documents
with (security_invoker = true)
as
with base as (
  select
    a.id as application_id,
    a.reference_number,
    a.status,
    a.user_id,
    coalesce(
      nullif(btrim(concat_ws(' ',
        nullif(d.data -> 'section2' ->> 'firstName', ''),
        nullif(d.data -> 'section2' ->> 'middleName', ''),
        nullif(d.data -> 'section2' ->> 'surname', '')
      )), ''),
      'Unknown'
    ) as applicant_name,
    d.data -> 'section1' ->> 'appliedForRank' as position,
    d.data
  from public.applications a
  join public.application_data d on d.application_id = a.id
  where a.submitted_at is not null
),
docs as (
  select b.application_id, b.reference_number, b.status, b.user_id, 3 as section_number, b.applicant_name, b.position,
         'Passport'::text as document_name, 'passport'::text as document_type, 'passport'::text as document_key,
         public.try_parse_date(b.data -> 'section3' ->> 'dateOfExpiry') as expiry_date
  from base b

  union all
  select b.application_id, b.reference_number, b.status, b.user_id, 4 as section_number, b.applicant_name, b.position,
         'Seaman''s Book (CDC)', 'seaman_book', 'seaman_book',
         public.try_parse_date(b.data -> 'section4' ->> 'dateOfExpiry')
  from base b

  union all
  select b.application_id, b.reference_number, b.status, b.user_id, 5 as section_number, b.applicant_name, b.position,
         coalesce('Visa — ' || nullif(e.item ->> 'type', ''), 'Visa'), 'visa', 'visa:' || (e.idx - 1),
         public.try_parse_date(e.item ->> 'dateOfExpiry')
  from base b
  cross join lateral jsonb_array_elements(public.jsonb_array_or_empty(b.data -> 'section5' -> 'visas'))
    with ordinality as e(item, idx)

  union all
  -- A revalidated certificate is valid until its revalidation expiry.
  select b.application_id, b.reference_number, b.status, b.user_id, 8 as section_number, b.applicant_name, b.position,
         coalesce('Certificate of Competency — ' || nullif(e.item ->> 'grade', ''), 'Certificate of Competency'),
         'coc', 'coc:' || (e.idx - 1),
         coalesce(public.try_parse_date(e.item ->> 'dateRevalidationExpiry'),
                  public.try_parse_date(e.item ->> 'dateOfExpiry'))
  from base b
  cross join lateral jsonb_array_elements(public.jsonb_array_or_empty(b.data -> 'section8' -> 'certificates'))
    with ordinality as e(item, idx)

  union all
  select b.application_id, b.reference_number, b.status, b.user_id, 9 as section_number, b.applicant_name, b.position,
         'GMDSS Certificate', 'gmdss', 'gmdss:' || (e.idx - 1),
         public.try_parse_date(e.item ->> 'dateOfExpiry')
  from base b
  cross join lateral jsonb_array_elements(public.jsonb_array_or_empty(b.data -> 'section9' -> 'gmdss'))
    with ordinality as e(item, idx)

  union all
  select b.application_id, b.reference_number, b.status, b.user_id, 10 as section_number, b.applicant_name, b.position,
         coalesce('Medical — ' || nullif(e.item ->> 'type', ''), 'Medical Certificate'),
         'medical', 'medical:' || (e.idx - 1),
         public.try_parse_date(e.item ->> 'dateOfExpiry')
  from base b
  cross join lateral jsonb_array_elements(public.jsonb_array_or_empty(b.data -> 'section10' -> 'medicalFitness'))
    with ordinality as e(item, idx)

  union all
  select b.application_id, b.reference_number, b.status, b.user_id, 10 as section_number, b.applicant_name, b.position,
         'Yellow Fever Certificate', 'yellow_fever', 'yellow_fever',
         public.try_parse_date(b.data -> 'section10' -> 'vaccinations' -> 'yellowFever' ->> 'dateOfExpiry')
  from base b
  where coalesce((b.data -> 'section10' -> 'vaccinations' -> 'yellowFever' ->> 'lifetimeValidity')::boolean, false) = false

  union all
  select b.application_id, b.reference_number, b.status, b.user_id, 14 as section_number, b.applicant_name, b.position,
         coalesce(nullif(e.item ->> 'courseName', ''), 'Training course'), 'course', 'course:' || (e.idx - 1),
         public.try_parse_date(e.item ->> 'dateOfExpiry')
  from base b
  cross join lateral jsonb_array_elements(public.jsonb_array_or_empty(b.data -> 'section14' -> 'courses'))
    with ordinality as e(item, idx)

  union all
  select b.application_id, b.reference_number, b.status, b.user_id, 15 as section_number, b.applicant_name, b.position,
         coalesce('Endorsement — ' || nullif(concat_ws(' · ',
           nullif(e.item ->> 'flagState', ''), nullif(e.item ->> 'rankEndorsed', '')), ''), 'Endorsement'),
         'endorsement', 'endorsement:' || (e.idx - 1),
         public.try_parse_date(e.item ->> 'dateOfExpiry')
  from base b
  cross join lateral jsonb_array_elements(public.jsonb_array_or_empty(b.data -> 'section15' -> 'endorsements'))
    with ordinality as e(item, idx)
)
select
  docs.application_id,
  docs.reference_number,
  docs.status,
  docs.user_id,
  docs.section_number,
  docs.applicant_name,
  docs.position,
  docs.expiry_date,
  docs.document_name,
  docs.document_type,
  docs.document_key
from docs
where docs.expiry_date is not null;

revoke all on public.v_application_documents from public, anon;
grant select on public.v_application_documents to authenticated, service_role;

create or replace view public.v_expiring_documents
with (security_invoker = true)
as
select
  d.application_id,
  d.reference_number,
  d.status,
  d.applicant_name,
  d.position,
  d.expiry_date,
  d.document_name,
  d.document_type,
  d.expiry_date - current_date as days_until_expiry,
  case
    when d.expiry_date < current_date then 'expired'
    when d.expiry_date - current_date <= 30 then 'critical'
    when d.expiry_date - current_date <= 60 then 'urgent'
    else 'moderate'
  end as urgency_level,
  d.document_key
from public.v_application_documents d
where d.expiry_date - current_date <= 90;

revoke all on public.v_expiring_documents from public, anon;
grant select on public.v_expiring_documents to authenticated, service_role;

-- Keep document_expiries in step with the form (expiry warnings read this table).
alter table public.document_expiries add column if not exists document_key text;
create unique index if not exists document_expiries_application_document_key_idx
  on public.document_expiries (application_id, document_key);

create or replace function public.sync_document_expiries()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- A renewed document gets a fresh set of warnings.
  delete from public.expiry_notifications n
  using public.document_expiries de
  join public.v_application_documents d
    on d.application_id = de.application_id and d.document_key = de.document_key
  where n.document_expiry_id = de.id
    and de.expiry_date is distinct from d.expiry_date;

  insert into public.document_expiries
    (application_id, user_id, document_type, document_name, section_number, expiry_date, document_key)
  select d.application_id, d.user_id, d.document_type, d.document_name, d.section_number, d.expiry_date, d.document_key
  from public.v_application_documents d
  where d.user_id is not null
  on conflict (application_id, document_key) do update
    set document_type = excluded.document_type,
        document_name = excluded.document_name,
        section_number = excluded.section_number,
        expiry_date = excluded.expiry_date,
        user_id = excluded.user_id
    where (public.document_expiries.document_name, public.document_expiries.expiry_date)
      is distinct from (excluded.document_name, excluded.expiry_date);

  -- Documents removed from the form (or with no valid date any more).
  delete from public.document_expiries de
  where not exists (
    select 1 from public.v_application_documents d
    where d.application_id = de.application_id and d.document_key = de.document_key
  );
end;
$$;

revoke all on function public.sync_document_expiries() from public, anon, authenticated;
grant execute on function public.sync_document_expiries() to service_role;

-- Drop first: the return type is restated here; grants are re-set below.
drop function if exists public.get_documents_needing_warnings();
create or replace function public.get_documents_needing_warnings()
returns table(id uuid, application_id uuid, user_id uuid, document_type text, document_name text,
              expiry_date date, days_until_expiry integer, is_expired boolean,
              applicant_name text, applicant_email text, reference_number text)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  perform public.sync_document_expiries();

  return query
  select
    de.id,
    de.application_id,
    de.user_id,
    de.document_type,
    de.document_name,
    de.expiry_date,
    (de.expiry_date - current_date)::integer as days_until_expiry,
    de.expiry_date < current_date as is_expired,
    coalesce(
      nullif(trim(concat(ad.data -> 'section2' ->> 'firstName', ' ', ad.data -> 'section2' ->> 'surname')), ''),
      p.full_name
    ) as applicant_name,
    p.email as applicant_email,
    a.reference_number
  from public.document_expiries de
  join public.applications a on de.application_id = a.id
  join public.profiles p on de.user_id = p.id
  left join public.application_data ad on ad.application_id = a.id
  where de.expiry_date - current_date <= 90
    and a.submitted_at is not null
  order by de.expiry_date asc;
end;
$function$;

-- One-time backlog handling (owner decision 2026-11-03): no warning was ever sent,
-- so documents already inside a warning window are marked as warned at their
-- current level without emailing. Only later levels (e.g. 60 -> 30 days, or
-- expiry) and documents entering the 90-day window will send.
select public.sync_document_expiries();

insert into public.expiry_notifications (
  document_expiry_id, application_id, user_id, notification_type, warning_level,
  sent_to_applicant, sent_to_recruiter, applicant_email, subject, template_used,
  status, sent_at, scheduled_for
)
select
  de.id, de.application_id, de.user_id, lvl.notification_type, lvl.warning_level,
  false, false, p.email, 'Backlog marked as sent without email (2026110222)', 'backlog_no_email',
  'sent', now(), now()
from public.document_expiries de
join public.applications a on a.id = de.application_id
join public.profiles p on p.id = de.user_id
cross join lateral (
  select
    case
      when de.expiry_date < current_date then 'expired'
      when de.expiry_date - current_date <= 30 then '30_day'
      when de.expiry_date - current_date <= 60 then '60_day'
      else '90_day'
    end as notification_type,
    case
      when de.expiry_date - current_date <= 30 then 'critical'
      when de.expiry_date - current_date <= 60 then 'urgent'
      else 'moderate'
    end as warning_level
) lvl
where a.submitted_at is not null
  and de.expiry_date - current_date <= 90
on conflict (document_expiry_id, notification_type) do nothing;

-- get_documents_needing_warnings (SECURITY DEFINER) returns every applicant's
-- name, email and document expiries. Only process-expiry-warnings (service role)
-- uses it; signed-in users lose EXECUTE.
do $$
declare
  fn regprocedure := to_regprocedure('public.get_documents_needing_warnings()');
begin
  if fn is not null then
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end if;
end;
$$;

commit;
