-- v_expiring_documents read paths the long form never writes
-- (section3.passport.expiryDate, section3.seamanBook, section5.cocExpiryDate,
-- section7.medicalCertificate, section7.yellowFever), so the Expiry page and the
-- expiry warnings always saw nothing. It also ran as its owner, so it would have
-- bypassed RLS once it returned rows.
--
-- This version reads the real form paths, covers every document the form
-- collects with an expiry date, tolerates bad dates, and runs as the caller.
-- Column names and order are unchanged; document_key (unique per document within
-- an application) is added at the end. document_type keeps the old values
-- (passport, seamanbook, coc, medical, yellowfever) and adds gmdss, visa,
-- course, endorsement. NOT APPLIED.

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

create or replace view public.v_expiring_documents
with (security_invoker = true)
as
with base as (
  select
    a.id as application_id,
    a.reference_number,
    a.status,
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
  select b.application_id, b.reference_number, b.status, b.applicant_name, b.position,
         'Passport'::text as document_name, 'passport'::text as document_type, 'passport'::text as document_key,
         public.try_parse_date(b.data -> 'section3' ->> 'dateOfExpiry') as expiry_date
  from base b

  union all
  select b.application_id, b.reference_number, b.status, b.applicant_name, b.position,
         'Seaman''s Book (CDC)', 'seamanbook', 'seamanbook',
         public.try_parse_date(b.data -> 'section4' ->> 'dateOfExpiry')
  from base b

  union all
  select b.application_id, b.reference_number, b.status, b.applicant_name, b.position,
         coalesce('Visa — ' || nullif(e.item ->> 'type', ''), 'Visa'), 'visa', 'visa:' || (e.idx - 1),
         public.try_parse_date(e.item ->> 'dateOfExpiry')
  from base b
  cross join lateral jsonb_array_elements(public.jsonb_array_or_empty(b.data -> 'section5' -> 'visas'))
    with ordinality as e(item, idx)

  union all
  -- A revalidated certificate is valid until its revalidation expiry.
  select b.application_id, b.reference_number, b.status, b.applicant_name, b.position,
         coalesce('Certificate of Competency — ' || nullif(e.item ->> 'grade', ''), 'Certificate of Competency'),
         'coc', 'coc:' || (e.idx - 1),
         coalesce(public.try_parse_date(e.item ->> 'dateRevalidationExpiry'),
                  public.try_parse_date(e.item ->> 'dateOfExpiry'))
  from base b
  cross join lateral jsonb_array_elements(public.jsonb_array_or_empty(b.data -> 'section8' -> 'certificates'))
    with ordinality as e(item, idx)

  union all
  select b.application_id, b.reference_number, b.status, b.applicant_name, b.position,
         'GMDSS Certificate', 'gmdss', 'gmdss:' || (e.idx - 1),
         public.try_parse_date(e.item ->> 'dateOfExpiry')
  from base b
  cross join lateral jsonb_array_elements(public.jsonb_array_or_empty(b.data -> 'section9' -> 'gmdss'))
    with ordinality as e(item, idx)

  union all
  select b.application_id, b.reference_number, b.status, b.applicant_name, b.position,
         coalesce('Medical — ' || nullif(e.item ->> 'type', ''), 'Medical Certificate'),
         'medical', 'medical:' || (e.idx - 1),
         public.try_parse_date(e.item ->> 'dateOfExpiry')
  from base b
  cross join lateral jsonb_array_elements(public.jsonb_array_or_empty(b.data -> 'section10' -> 'medicalFitness'))
    with ordinality as e(item, idx)

  union all
  select b.application_id, b.reference_number, b.status, b.applicant_name, b.position,
         'Yellow Fever Certificate', 'yellowfever', 'yellowfever',
         public.try_parse_date(b.data -> 'section10' -> 'vaccinations' -> 'yellowFever' ->> 'dateOfExpiry')
  from base b
  where coalesce((b.data -> 'section10' -> 'vaccinations' -> 'yellowFever' ->> 'lifetimeValidity')::boolean, false) = false

  union all
  select b.application_id, b.reference_number, b.status, b.applicant_name, b.position,
         coalesce(nullif(e.item ->> 'courseName', ''), 'Training course'), 'course', 'course:' || (e.idx - 1),
         public.try_parse_date(e.item ->> 'dateOfExpiry')
  from base b
  cross join lateral jsonb_array_elements(public.jsonb_array_or_empty(b.data -> 'section14' -> 'courses'))
    with ordinality as e(item, idx)

  union all
  select b.application_id, b.reference_number, b.status, b.applicant_name, b.position,
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
  docs.applicant_name,
  docs.position,
  docs.expiry_date,
  docs.document_name,
  docs.document_type,
  docs.expiry_date - current_date as days_until_expiry,
  case
    when docs.expiry_date < current_date then 'expired'
    when docs.expiry_date - current_date <= 30 then 'critical'
    when docs.expiry_date - current_date <= 60 then 'urgent'
    else 'moderate'
  end as urgency_level,
  docs.document_key
from docs
where docs.expiry_date is not null
  and docs.expiry_date - current_date <= 90;

revoke all on public.v_expiring_documents from public, anon;
grant select on public.v_expiring_documents to authenticated, service_role;

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
