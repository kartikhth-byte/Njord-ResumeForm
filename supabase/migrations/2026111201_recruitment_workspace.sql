-- Workspace ownership extends existing cases; case.status remains authoritative.
create table public.recruitment_work_assignments (
 case_id uuid not null references public.recruitment_cases(id),
 task_key text not null check(task_key in ('case','contact','test','interview','offer','application','documents','principal','joining')),
 assignee_id uuid references public.profiles(id), due_at timestamptz, started_at timestamptz,
 version integer not null default 1, updated_at timestamptz not null default now(),
 primary key(case_id,task_key)
);
create table public.recruitment_work_history (
 id uuid primary key default gen_random_uuid(), case_id uuid not null references public.recruitment_cases(id),
 task_key text not null, actor_id uuid not null references public.profiles(id),
 previous_assignee_id uuid, assignee_id uuid, due_at timestamptz, action text not null,
 note text, created_at timestamptz not null default now()
);
create table public.recruitment_task_credits (
 event_id uuid primary key references public.recruitment_case_events(id),
 case_id uuid not null references public.recruitment_cases(id),
 performed_by uuid not null references public.profiles(id), recorded_by uuid not null references public.profiles(id),
 occurred_at timestamptz not null, created_at timestamptz not null default now()
);
create trigger recruitment_work_history_immutable before update or delete on public.recruitment_work_history
 for each row execute function public.recruitment_case_events_append_only();
create trigger recruitment_task_credits_immutable before update or delete on public.recruitment_task_credits
 for each row execute function public.recruitment_case_events_append_only();

-- Current supported single-organization scope, identical to résumé/case gates.
create function public.recruitment_workspace_can_read(p_case uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and public.has_permission(auth.uid(),'view_requirements')
 and exists(select 1 from recruitment_cases where id=p_case and organization_id=public.needle_pilot_organization_id())
$$;
revoke all on function public.recruitment_workspace_can_read(uuid) from public,anon;
grant execute on function public.recruitment_workspace_can_read(uuid) to authenticated;
alter table public.recruitment_work_assignments enable row level security;
alter table public.recruitment_work_history enable row level security;
alter table public.recruitment_task_credits enable row level security;
create policy workspace_assignments_read on public.recruitment_work_assignments for select to authenticated using(public.recruitment_workspace_can_read(case_id));
create policy workspace_history_read on public.recruitment_work_history for select to authenticated using(public.recruitment_workspace_can_read(case_id));
create policy workspace_credits_read on public.recruitment_task_credits for select to authenticated using(public.recruitment_workspace_can_read(case_id));
revoke all on public.recruitment_work_assignments,public.recruitment_work_history,public.recruitment_task_credits from public,anon,authenticated;
grant select on public.recruitment_work_assignments,public.recruitment_work_history,public.recruitment_task_credits to authenticated;

-- has_permission intentionally checks only the current caller. Internal target
-- eligibility uses the private permission primitive and checks account bans.
create function public.recruitment_work_eligible_assignee(p_user uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from profiles p join auth.users u on u.id=p.id
 where p.id=p_user and p.user_type='recruiter' and (u.banned_until is null or u.banned_until<=now()))
 and public.check_permission(p_user,'edit_junction_status')
$$;
revoke all on function public.recruitment_work_eligible_assignee(uuid) from public,anon,authenticated;

create function public.recruitment_assign_work(p_case uuid,p_task text,p_assignee uuid,p_due timestamptz,p_start boolean,p_version integer,p_note text default null)
returns public.recruitment_work_assignments language plpgsql security definer set search_path=public,pg_temp as $$
declare last_status text; c recruitment_cases; old_row recruitment_work_assignments; result recruitment_work_assignments; actor uuid:=auth.uid();
begin
 if public.recruitment_workspace_can_read(p_case) is not true or public.has_permission(actor,'edit_junction_status') is not true then raise exception 'permission_denied'; end if;
 select * into c from recruitment_cases where id=p_case for update;
 if public.recruitment_case_is_terminal(c.status) then raise exception 'case_closed'; end if;
 if p_task not in ('case','contact','test','interview','offer','application','documents','principal','joining') or p_task is null then raise exception 'invalid_task'; end if;
 if p_assignee is not null and public.recruitment_work_eligible_assignee(p_assignee) is not true then raise exception 'invalid_assignee'; end if;
 -- Recruiters can take over for themselves; assigning others is a Master action.
 if p_assignee is distinct from actor and public.is_master_recruiter_profile(actor) is not true then raise exception 'assignment_requires_master'; end if;
 if p_start and not exists(select 1 from requirements where id=c.requirement_id and status='open' and archived_at is null and deleted_at is null) then raise exception 'requirement_not_open'; end if;
 if p_start and (p_assignee is distinct from actor or p_task='case') then raise exception 'invalid_task_start'; end if;
 select to_status into last_status from recruitment_case_events where case_id=p_case
 and event_type in ('transition','principal_send_attested') and from_status is distinct from 'legacy'
 and (case p_task when 'contact' then to_status in ('contacted','confirmed')
 when 'test' then to_status like 'test_%' when 'interview' then to_status like 'interview_%'
 when 'offer' then to_status in ('selected','offered','offer_accepted','offer_declined')
 when 'documents' then to_status like 'documents_%' when 'principal' then to_status='sent_to_principal'
 when 'joining' then to_status='hired' else false end) order by created_at desc,id desc limit 1;
 if p_start and (last_status in ('confirmed','test_passed','test_waived','test_failed','test_no_show','interview_passed','interview_failed','interview_no_show','offer_accepted','offer_declined','documents_verified','sent_to_principal','hired') or (p_task='application' and c.application_id is not null)) then raise exception 'task_already_completed'; end if;
 if length(coalesce(p_note,''))>2000 then raise exception 'note_too_long'; end if;
 select * into old_row from recruitment_work_assignments where case_id=p_case and task_key=p_task;
 if p_version is null or p_version<>coalesce(old_row.version,0) then raise exception 'version_conflict'; end if;
 insert into recruitment_work_assignments(case_id,task_key,assignee_id,due_at,started_at)
 values(p_case,p_task,p_assignee,p_due,case when p_start then now() end)
 on conflict(case_id,task_key) do update set assignee_id=excluded.assignee_id,due_at=excluded.due_at,
 started_at=case when p_start then now() when recruitment_work_assignments.assignee_id is not distinct from p_assignee then recruitment_work_assignments.started_at else null end,
 version=recruitment_work_assignments.version+1,updated_at=now() returning * into result;
 insert into recruitment_work_history(case_id,task_key,actor_id,previous_assignee_id,assignee_id,due_at,action,note)
 values(p_case,p_task,actor,old_row.assignee_id,p_assignee,p_due,case when p_start then 'started' else 'assigned' end,nullif(trim(p_note),''));
 return result;
end $$;
revoke all on function public.recruitment_assign_work(uuid,text,uuid,timestamptz,boolean,integer,text) from public,anon;
grant execute on function public.recruitment_assign_work(uuid,text,uuid,timestamptz,boolean,integer,text) to authenticated;

-- Preserve all existing transition validation; record performer separately from recorder.
create function public.recruitment_workspace_transition(p_case uuid,p_status text,p_reason text,p_key text,p_version integer,p_assessment jsonb,p_performer uuid,p_occurred timestamptz)
returns public.recruitment_cases language plpgsql security definer set search_path=public,pg_temp as $$
declare result recruitment_cases; actor uuid:=auth.uid(); eid uuid; credit recruitment_task_credits;
begin
 if public.recruitment_workspace_can_read(p_case) is not true or public.has_permission(actor,'edit_junction_status') is not true then raise exception 'permission_denied'; end if;
 if p_key is null or length(p_key)<8 then raise exception 'idempotency_key_required'; end if;
 if p_performer is null or public.recruitment_work_eligible_assignee(p_performer) is not true then raise exception 'invalid_performer'; end if;
 if p_occurred is null or p_occurred>now() then raise exception 'valid_completion_time_required'; end if;
 select * into result from recruitment_cases where id=p_case for update;
 select id into eid from recruitment_case_events where case_id=p_case and idempotency_key=p_key;
 if eid is not null then
  select * into credit from recruitment_task_credits where event_id=eid;
  if credit.recorded_by is distinct from actor or credit.performed_by is distinct from p_performer or not exists(select 1 from recruitment_case_events where id=eid and to_status=p_status) then raise exception 'idempotency_conflict'; end if;
  return result;
 end if;
 if p_status not in ('withdrawn','rejected','closed') and not exists(select 1 from requirements where id=result.requirement_id and status='open' and archived_at is null and deleted_at is null) then raise exception 'requirement_not_open'; end if;
 if p_version is null then raise exception 'version_required'; end if;
 select * into result from public.recruitment_case_transition(p_case,p_status,p_reason,p_key,p_version,coalesce(p_assessment,'{}'));
 select id into eid from recruitment_case_events where case_id=p_case and idempotency_key=p_key;
 insert into recruitment_task_credits(event_id,case_id,performed_by,recorded_by,occurred_at) values(eid,p_case,p_performer,actor,p_occurred);
 return result;
end $$;
revoke all on function public.recruitment_workspace_transition(uuid,text,text,text,integer,jsonb,uuid,timestamptz) from public,anon;
grant execute on function public.recruitment_workspace_transition(uuid,text,text,text,integer,jsonb,uuid,timestamptz) to authenticated;

create index recruitment_work_history_case_idx on public.recruitment_work_history(case_id,created_at);
create index recruitment_task_credits_case_idx on public.recruitment_task_credits(case_id);

-- Enforce requirement availability for legacy RPCs and stale workspace dialogs too.
create function public.recruitment_guard_requirement_progress() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status is distinct from old.status and new.status not in ('withdrawn','rejected','closed')
 and not exists(select 1 from requirements where id=new.requirement_id and status='open' and archived_at is null and deleted_at is null)
 then raise exception 'requirement_not_open'; end if;
 return new;
end $$;
revoke all on function public.recruitment_guard_requirement_progress() from public,anon,authenticated;
create trigger recruitment_requirement_progress_guard before update of status on public.recruitment_cases
 for each row execute function public.recruitment_guard_requirement_progress();

-- Principal handoff is a personal send attestation, not delegated recording.
create function public.recruitment_workspace_principal_send(p_case uuid,p_recipient text,p_channel text,p_worksheet text,p_key text,p_version integer,p_sent_at timestamptz,p_performer uuid)
returns public.recruitment_cases language plpgsql security definer set search_path=public,pg_temp as $$
declare result recruitment_cases; actor uuid:=auth.uid(); eid uuid; credit recruitment_task_credits;
begin
 if public.recruitment_workspace_can_read(p_case) is not true or public.has_permission(actor,'edit_junction_status') is not true then raise exception 'permission_denied'; end if;
 if p_performer is distinct from actor then raise exception 'principal_send_requires_self'; end if;
 if p_key is null or length(p_key)<8 then raise exception 'idempotency_key_required'; end if;
 select * into result from recruitment_cases where id=p_case for update;
 select id into eid from recruitment_case_events where case_id=p_case and idempotency_key=p_key;
 if eid is not null then
  select * into credit from recruitment_task_credits where event_id=eid;
  if credit.recorded_by is distinct from actor or credit.performed_by is distinct from actor
  or not exists(select 1 from recruitment_case_events where id=eid and event_type='principal_send_attested') then raise exception 'idempotency_conflict'; end if;
  return result;
 end if;
 select * into result from public.recruitment_case_attest_principal_send_v2(p_case,p_recipient,p_channel,p_worksheet,p_key,p_version,p_sent_at);
 select id into eid from recruitment_case_events where case_id=p_case and idempotency_key=p_key;
 insert into recruitment_task_credits(event_id,case_id,performed_by,recorded_by,occurred_at) values(eid,p_case,actor,actor,p_sent_at);
 return result;
end $$;
revoke all on function public.recruitment_workspace_principal_send(uuid,text,text,text,text,integer,timestamptz,uuid) from public,anon;
grant execute on function public.recruitment_workspace_principal_send(uuid,text,text,text,text,integer,timestamptz,uuid) to authenticated;
