-- Follow-up to already-applied 0227: automatic closure participates in the
-- requirement RPC optimistic-concurrency contract. Preserve the existing
-- distinct-hire rule and trigger; change no historical rows.
create or replace function public.close_requirement_when_cases_hired()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  needed integer;
  hired_count integer;
begin
  if new.status <> 'hired' or (tg_op = 'UPDATE' and old.status = 'hired') then
    return new;
  end if;

  select positions_required into needed
  from public.requirements
  where id = new.requirement_id and status = 'open'
  for update;
  if needed is null then
    return new;
  end if;

  select count(distinct prospect_id) into hired_count
  from public.recruitment_cases
  where requirement_id = new.requirement_id and status = 'hired';

  if hired_count >= needed then
    update public.requirements
    set status = 'closed', version = version + 1
    where id = new.requirement_id and status = 'open';
  end if;
  return new;
end;
$function$;

revoke all on function public.close_requirement_when_cases_hired() from public, anon, authenticated;
