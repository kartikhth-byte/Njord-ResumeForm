-- Keep historical ship identities when closing an existing case/requirement.
-- Archived catalogs still block opening, matching and new attachments.
begin;
create or replace function public.guard_requirement_location()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare ship public.client_ships; company public.client_companies; changed boolean;
begin
 changed:=tg_op='INSERT';
 if tg_op='UPDATE' then changed:=new.company_id is distinct from old.company_id or new.ship_id is distinct from old.ship_id; end if;
 if new.company_id is not null then
  select * into company from public.client_companies where id=new.company_id and organization_id=public.needle_pilot_organization_id() and (archived_at is null or (not changed and new.status in ('closed','cancelled'))) for share;
  if not found then raise exception 'reviewed_company_required' using errcode='22023'; end if;
  new.customer_name:=company.name;
 end if;
 if new.ship_id is not null then
  select * into ship from public.client_ships where id=new.ship_id and organization_id=public.needle_pilot_organization_id() and (archived_at is null or (not changed and new.status in ('closed','cancelled'))) for share;
  if not found or ship.company_id is distinct from new.company_id then raise exception 'ship_company_mismatch' using errcode='22023'; end if;
  new.vessel_name:=ship.name;
 end if;
 if tg_op='UPDATE' and old.status<>'draft' and changed then
  if coalesce(current_setting('holmes.location_correction',true),'')<>new.id::text then
   raise exception 'audited_ship_correction_required' using errcode='42501';
  end if;
 end if;
 if changed then
  new.location_reviewed_at:=case when new.ship_id is not null and new.company_id is not null then now() else null end;
 elsif tg_op='UPDATE' then new.location_reviewed_at:=old.location_reviewed_at;
 end if;
 if new.status='open' and (tg_op='INSERT' or changed or (tg_op='UPDATE' and old.status<>'open')) then
  if new.ship_id is null or new.company_id is null or new.location_reviewed_at is null then
   raise exception 'reviewed_ship_required_to_open' using errcode='22023';
  end if;
 end if;
 return new;
end $$;
commit;
