-- Candidates without a CV can carry their present rank and vessel type, so
-- recruiters can record them when adding and the CV review can start from them.
begin;
alter table public.resume_lead_drafts
  add column if not exists rank_id uuid references public.ranks(id) on delete restrict,
  add column if not exists vessel_type_id uuid references public.vessel_types(id) on delete restrict;

create or replace function public.save_resume_lead_draft(p_fields jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;
begin
 if auth.uid() is null or not public.has_permission(auth.uid(),'create_prospects') or not public.has_permission(auth.uid(),'view_prospects') then raise exception 'permission_denied' using errcode='42501';end if;
 if length(coalesce(p_fields->>'notes',''))>5000 or length(coalesce(p_fields->>'name',''))>200 then raise exception 'lead_field_limit';end if;
 insert into public.resume_lead_drafts(name,telephone,email,notes,rank_id,vessel_type_id)
 values(nullif(trim(p_fields->>'name'),''),nullif(trim(p_fields->>'telephone'),''),nullif(lower(trim(p_fields->>'email')),''),nullif(trim(p_fields->>'notes'),''),
  nullif(p_fields->>'rank_id','')::uuid,nullif(p_fields->>'vessel_type_id','')::uuid) returning id into result;
 return result;
end $$;

create or replace function public.update_resume_lead_draft(p_id uuid,p_expected_version integer,p_fields jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare lead public.resume_lead_drafts;
begin
 if auth.uid() is null or not public.has_permission(auth.uid(),'view_prospects') or not public.has_permission(auth.uid(),'create_prospects') or not public.has_permission(auth.uid(),'edit_prospects') then
  raise exception 'permission_denied' using errcode='42501';
 end if;
 select * into lead from public.resume_lead_drafts where id=p_id and organization_id=public.needle_pilot_organization_id() for update;
 if not found or lead.status<>'draft' then raise exception 'lead_not_draft';end if;
 if p_expected_version is null or lead.version<>p_expected_version then raise exception 'version_conflict' using errcode='40001';end if;
 if nullif(trim(p_fields->>'name'),'') is null or length(coalesce(p_fields->>'name',''))>200 or length(coalesce(p_fields->>'notes',''))>5000 then raise exception 'lead_field_limit';end if;
 update public.resume_lead_drafts set name=trim(p_fields->>'name'), telephone=nullif(trim(p_fields->>'telephone'),''),
 email=nullif(lower(trim(p_fields->>'email')),''),notes=case when p_fields ? 'notes' then nullif(trim(p_fields->>'notes'),'') else notes end,
 rank_id=case when p_fields ? 'rank_id' then nullif(p_fields->>'rank_id','')::uuid else rank_id end,
 vessel_type_id=case when p_fields ? 'vessel_type_id' then nullif(p_fields->>'vessel_type_id','')::uuid else vessel_type_id end,
 version=version+1 where id=p_id;
 return p_id;
end $$;

drop function public.list_candidate_drafts();
create function public.list_candidate_drafts()
returns table(id uuid, name text, telephone text, email text, version integer, created_by uuid, created_at timestamptz, display_id text, rank_id uuid, vessel_type_id uuid)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'view_prospects') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  return query select d.id, d.name, d.telephone, d.email, d.version, d.created_by, d.created_at, d.display_id, d.rank_id, d.vessel_type_id
  from public.resume_lead_drafts d
  where d.organization_id = public.needle_pilot_organization_id() and d.status = 'draft'
  order by d.created_at desc, d.id;
end $$;
revoke all on function public.save_resume_lead_draft(jsonb), public.update_resume_lead_draft(uuid,integer,jsonb), public.list_candidate_drafts() from public, anon;
grant execute on function public.save_resume_lead_draft(jsonb), public.update_resume_lead_draft(uuid,integer,jsonb), public.list_candidate_drafts() to authenticated;
commit;
