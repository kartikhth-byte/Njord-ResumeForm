-- Preserve existing IDs, requirement snapshots and audited location corrections.
begin;
alter table public.client_companies add column version integer not null default 1;
alter table public.client_ships add column version integer not null default 1,
 add column vessel_type_id uuid references public.vessel_types(id);
-- Directory edits use one version-checked entry point.
revoke insert,update on public.client_companies,public.client_ships from authenticated;
create function public.save_client_fleet_record(
 p_kind text, p_name text, p_id uuid default null, p_company_id uuid default null,
 p_vessel_type_id uuid default null, p_expected_version integer default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 actor uuid:=auth.uid(); org uuid:=public.needle_pilot_organization_id();
 company public.client_companies; ship public.client_ships; clean_name text:=trim(p_name);
begin
 if actor is null or not coalesce(public.has_permission(actor,'edit_requirements'),false) or
    not coalesce(public.is_master_recruiter_profile(actor) or public.is_platform_operator(),false) then
  raise exception 'permission_denied' using errcode='42501';
 end if;
 if p_kind not in ('company','ship') or p_kind is null then raise exception 'invalid_record_type' using errcode='22023'; end if;
 if clean_name is null or length(clean_name) not between 1 and 200 then raise exception 'name_required' using errcode='22023'; end if;
 -- Serialize this small organization's directory to reject duplicate creations.
 perform pg_advisory_xact_lock(hashtextextended(org::text||':client-fleet',0));
 if p_kind='company' then
  if p_company_id is not null or p_vessel_type_id is not null then raise exception 'invalid_company_fields' using errcode='22023'; end if;
  if p_id is not null then
   select * into company from public.client_companies where id=p_id and organization_id=org and archived_at is null for update;
   if not found then raise exception 'record_unavailable' using errcode='22023'; end if;
   if p_expected_version is null or company.version<>p_expected_version then raise exception 'version_conflict' using errcode='40001'; end if;
  end if;
  if exists(select 1 from public.client_companies where organization_id=org and archived_at is null
    and lower(trim(name))=lower(clean_name) and id is distinct from p_id) then
   raise exception 'company_name_exists' using errcode='23505';
  end if;
  if p_id is null then
   insert into public.client_companies(name,organization_id,created_by) values(clean_name,org,actor) returning * into company;
  else
   update public.client_companies set name=clean_name,version=version+1 where id=p_id returning * into company;
  end if;
  return to_jsonb(company);
 end if;
 select * into company from public.client_companies where id=p_company_id and organization_id=org and archived_at is null for share;
 if not found then raise exception 'reviewed_company_required' using errcode='22023'; end if;
 if p_id is not null then
  select * into ship from public.client_ships where id=p_id and organization_id=org and archived_at is null for update;
  if not found then raise exception 'record_unavailable' using errcode='22023'; end if;
  if ship.company_id is distinct from p_company_id then raise exception 'ship_company_cannot_change' using errcode='22023'; end if;
  if p_expected_version is null or ship.version<>p_expected_version then raise exception 'version_conflict' using errcode='40001'; end if;
 end if;
 if p_vessel_type_id is null then raise exception 'vessel_type_required' using errcode='22023'; end if;
 if exists(select 1 from public.client_ships where organization_id=org and company_id=p_company_id and archived_at is null
   and lower(trim(name))=lower(clean_name) and id is distinct from p_id) then
  raise exception 'ship_name_exists' using errcode='23505';
 end if;
 if p_id is null then
  insert into public.client_ships(name,company_id,organization_id,vessel_type_id,created_by)
   values(clean_name,p_company_id,org,p_vessel_type_id,actor) returning * into ship;
 else
  update public.client_ships set name=clean_name,vessel_type_id=p_vessel_type_id,version=version+1 where id=p_id returning * into ship;
 end if;
 return to_jsonb(ship);
end $$;
revoke all on function public.save_client_fleet_record(text,text,uuid,uuid,uuid,integer) from public,anon;
grant execute on function public.save_client_fleet_record(text,text,uuid,uuid,uuid,integer) to authenticated;
commit;
