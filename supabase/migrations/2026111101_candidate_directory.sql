-- Inline corrections to CV-less candidates; keep their existing draft identity
-- outside prospects/search/cases until a résumé has been reviewed.
begin;
-- Read-only support users can see basic drafts without private recruiter notes.
-- Existing table RLS remains unchanged.
create function public.list_candidate_drafts()
returns table(id uuid,name text,telephone text,email text,version integer,created_by uuid,created_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.has_permission(auth.uid(),'view_prospects') then raise exception 'permission_denied' using errcode='42501';end if;
 return query select d.id,d.name,d.telephone,d.email,d.version,d.created_by,d.created_at from public.resume_lead_drafts d
 where d.organization_id=public.needle_pilot_organization_id() and d.status='draft' order by d.created_at desc,d.id;
end $$;
revoke all on function public.list_candidate_drafts() from public,anon;
grant execute on function public.list_candidate_drafts() to authenticated;

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
 email=nullif(lower(trim(p_fields->>'email')),''),notes=case when p_fields ? 'notes' then nullif(trim(p_fields->>'notes'),'') else notes end,version=version+1 where id=p_id;
 return p_id;
end $$;
revoke all on function public.update_resume_lead_draft(uuid,integer,jsonb) from public,anon;
grant execute on function public.update_resume_lead_draft(uuid,integer,jsonb) to authenticated;

-- Enforce the CV requirement even for direct case-opening calls and legacy
-- profiles. The existing case-opening function retains authorization/lifecycle.
create function public.require_case_resume() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' and (new.prospect_id,new.requirement_id) is not distinct from (old.prospect_id,old.requirement_id) then return new;end if;
 if not exists(select 1 from public.prospects p join public.needle_resume_registry r on r.resume_id=p.needle_resume_id and r.organization_id=p.organization_id
 where p.id=new.prospect_id and p.organization_id=public.needle_pilot_organization_id() and r.original_available) then
  raise exception 'available_resume_required' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function public.require_case_resume() from public,anon,authenticated;
create trigger recruitment_cases_require_resume before insert or update of prospect_id,requirement_id on public.recruitment_cases for each row execute function public.require_case_resume();
create trigger prospect_requirements_require_resume before insert or update of prospect_id,requirement_id on public.prospect_requirements for each row execute function public.require_case_resume();
commit;
