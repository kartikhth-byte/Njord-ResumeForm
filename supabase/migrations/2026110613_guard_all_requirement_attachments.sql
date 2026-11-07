-- Also cover historical attachment RPCs. Existing case progress is preserved;
-- inserting or moving a relationship always requires a reviewed open ship.
begin;
create function public.guard_new_requirement_attachment() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' and new.requirement_id is not distinct from old.requirement_id then return new;end if;
 perform 1 from public.requirements r join public.client_ships s on s.id=r.ship_id and s.company_id=r.company_id
 join public.client_companies c on c.id=r.company_id
 where r.id=new.requirement_id and r.status='open' and r.deleted_at is null and r.archived_at is null
 and r.location_reviewed_at is not null and s.archived_at is null and c.archived_at is null
 and s.organization_id=public.needle_pilot_organization_id() and c.organization_id=s.organization_id for share of r,s,c;
 if not found then raise exception 'requirement_not_open' using errcode='22023';end if;
 perform 1 from public.prospects where id=new.prospect_id and organization_id=public.needle_pilot_organization_id() and archived_at is null and deleted_at is null;
 if not found then raise exception 'candidate_not_found' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.guard_new_requirement_attachment() from public,anon,authenticated;
create trigger platform_case_attachment before insert or update of requirement_id on public.recruitment_cases for each row execute function public.guard_new_requirement_attachment();
create trigger platform_legacy_attachment before insert or update of requirement_id on public.prospect_requirements for each row execute function public.guard_new_requirement_attachment();
commit;
