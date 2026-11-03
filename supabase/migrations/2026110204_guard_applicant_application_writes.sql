-- Applicants may edit only their own draft and may only move it to submitted.
--
-- 2026110202 limits applicants to their own unsubmitted rows, but within a draft
-- they could still set any column: status (e.g. 'offered'), offer_details,
-- handling_recruiter_id, review-link token fields. This trigger checks direct
-- client writes made as an applicant:
--   insert: status must be 'new', not submitted; recruiter-only fields are cleared
--   update: only updated_at, status, submitted_at, reference_number, public_token,
--           applied_rank may change; status/submitted_at may change only to submit
-- Recruiters and security-definer functions (which run as their owner, not as
-- 'authenticated') are not checked here. NOT APPLIED.

begin;

create or replace function public.guard_applicant_application_write()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  allowed_update constant text[] := array[
    'updated_at', 'status', 'submitted_at', 'reference_number', 'public_token', 'applied_rank'
  ];
  recruiter_only constant text[] := array[
    'offer_details', 'handling_recruiter_id', 'review_access_token_hash',
    'review_access_token_expires_at', 'contract_end_date', 'prospect_id'
  ];
  changed text[];
  cleared jsonb;
begin
  if current_user <> 'authenticated' or public.is_recruiter(auth.uid()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'new' or new.submitted_at is not null then
      raise exception 'applicant drafts must start as new' using errcode = '42501';
    end if;

    select coalesce(jsonb_object_agg(k.key, null), '{}'::jsonb)
    into cleared
    from jsonb_object_keys(to_jsonb(new)) as k(key)
    where k.key = any (recruiter_only);

    new := jsonb_populate_record(new, cleared);
    return new;
  end if;

  select coalesce(array_agg(n.key order by n.key), '{}')
  into changed
  from jsonb_each(to_jsonb(new)) as n(key, value)
  where n.value is distinct from (to_jsonb(old) -> n.key)
    and not (n.key = any (allowed_update));

  if cardinality(changed) > 0 then
    raise exception 'applicants cannot change: %', array_to_string(changed, ', ')
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status or new.submitted_at is distinct from old.submitted_at then
    if old.submitted_at is not null or new.status <> 'submitted' or new.submitted_at is null then
      raise exception 'applicants can only submit their own draft' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_applicant_application_write on public.applications;
create trigger guard_applicant_application_write
before insert or update on public.applications
for each row execute function public.guard_applicant_application_write();

commit;
