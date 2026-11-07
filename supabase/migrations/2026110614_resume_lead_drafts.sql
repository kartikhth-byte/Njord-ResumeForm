-- Phone/email-only leads live outside prospects and therefore outside the
-- searchable candidate pool and recruitment cases until a résumé is reviewed.
begin;
create table public.resume_lead_drafts (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null default public.needle_pilot_organization_id(),
 name text,telephone text,email text,notes text,created_by uuid not null default auth.uid(),
 created_at timestamptz not null default now(),version integer not null default 1,
 status text not null default 'draft' check(status in ('draft','converted')),
 candidate_id uuid references public.prospects(id),
 check(nullif(trim(telephone),'') is not null or nullif(trim(email),'') is not null),
 check(telephone is null or telephone ~ '^\+[1-9][0-9]{7,14}$'),
 check(email is null or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);
alter table public.resume_lead_drafts enable row level security;
revoke all on public.resume_lead_drafts from public,anon,authenticated;
grant select on public.resume_lead_drafts to authenticated;
grant all on public.resume_lead_drafts to service_role;
create policy resume_lead_read on public.resume_lead_drafts for select to authenticated
 using(organization_id=public.needle_pilot_organization_id() and public.has_permission(auth.uid(),'view_prospects') and public.has_permission(auth.uid(),'create_prospects'));
create function public.save_resume_lead_draft(p_fields jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;
begin
 if auth.uid() is null or not public.has_permission(auth.uid(),'create_prospects') or not public.has_permission(auth.uid(),'view_prospects') then raise exception 'permission_denied' using errcode='42501';end if;
 if length(coalesce(p_fields->>'notes',''))>5000 or length(coalesce(p_fields->>'name',''))>200 then raise exception 'lead_field_limit';end if;
 insert into public.resume_lead_drafts(name,telephone,email,notes)
 values(nullif(trim(p_fields->>'name'),''),nullif(trim(p_fields->>'telephone'),''),nullif(lower(trim(p_fields->>'email')),''),nullif(trim(p_fields->>'notes'),'')) returning id into result;
 return result;
end $$;
create function public.review_resume_lead(p_lead uuid,p_lead_version integer,p_version uuid,p_evidence uuid,p_decision text,p_fields jsonb,
 p_link uuid default null,p_confirm_new boolean default false,p_requirement uuid default null,p_requirement_version integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare lead public.resume_lead_drafts;result jsonb;
begin
 if auth.uid() is null or not public.has_permission(auth.uid(),'create_prospects') or not public.has_permission(auth.uid(),'view_prospects') then raise exception 'permission_denied' using errcode='42501';end if;
 select * into lead from public.resume_lead_drafts where id=p_lead and organization_id=public.needle_pilot_organization_id() for update;
 if not found or lead.status<>'draft' then raise exception 'lead_not_draft';end if;
 if p_lead_version is null or lead.version<>p_lead_version then raise exception 'version_conflict' using errcode='40001';end if;
 result:=public.review_platform_resume(p_version,p_evidence,p_decision,p_fields,p_link,p_confirm_new,p_requirement,p_requirement_version);
 if p_decision<>'hold' then update public.resume_lead_drafts set status='converted',candidate_id=(result->>'prospect_id')::uuid,version=version+1 where id=lead.id;end if;
 return result;
end $$;
revoke all on function public.save_resume_lead_draft(jsonb),public.review_resume_lead(uuid,integer,uuid,uuid,text,jsonb,uuid,boolean,uuid,integer) from public,anon;
grant execute on function public.save_resume_lead_draft(jsonb),public.review_resume_lead(uuid,integer,uuid,uuid,text,jsonb,uuid,boolean,uuid,integer) to authenticated;
commit;
