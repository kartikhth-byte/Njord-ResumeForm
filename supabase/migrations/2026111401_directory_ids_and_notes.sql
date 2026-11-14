-- Stable, type-specific public references. UUID primary keys remain internal.
begin;

create sequence if not exists public.requirement_directory_id_seq;
create sequence if not exists public.candidate_directory_id_seq;
create sequence if not exists public.candidate_draft_directory_id_seq;
create sequence if not exists public.recruitment_directory_id_seq;
create sequence if not exists public.application_directory_id_seq;
grant usage on sequence public.requirement_directory_id_seq, public.candidate_directory_id_seq,
  public.candidate_draft_directory_id_seq, public.recruitment_directory_id_seq,
  public.application_directory_id_seq to authenticated, service_role;

alter table public.requirements add column if not exists display_id text;
alter table public.prospects add column if not exists display_id text;
alter table public.resume_lead_drafts add column if not exists display_id text;
alter table public.recruitment_cases add column if not exists display_id text;
alter table public.applications add column if not exists display_id text;

update public.requirements set display_id = 'REQ-' || lpad(nextval('public.requirement_directory_id_seq')::text, 6, '0') where display_id is null;
update public.prospects set display_id = 'CAN-' || lpad(nextval('public.candidate_directory_id_seq')::text, 6, '0') where display_id is null;
update public.resume_lead_drafts set display_id = 'CAN-D-' || lpad(nextval('public.candidate_draft_directory_id_seq')::text, 6, '0') where display_id is null;
update public.recruitment_cases set display_id = 'REC-' || lpad(nextval('public.recruitment_directory_id_seq')::text, 6, '0') where display_id is null;
update public.applications set display_id = 'APP-' || lpad(nextval('public.application_directory_id_seq')::text, 6, '0') where display_id is null;

alter table public.requirements alter column display_id set not null;
alter table public.prospects alter column display_id set not null;
alter table public.resume_lead_drafts alter column display_id set not null;
alter table public.recruitment_cases alter column display_id set not null;
alter table public.applications alter column display_id set not null;

create unique index requirements_display_id_key on public.requirements(display_id);
create unique index prospects_display_id_key on public.prospects(display_id);
create unique index resume_lead_drafts_display_id_key on public.resume_lead_drafts(display_id);
create unique index recruitment_cases_display_id_key on public.recruitment_cases(display_id);
create unique index applications_display_id_key on public.applications(display_id);

create or replace function public.assign_directory_display_id()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare prefix text; sequence_name text;
begin
  if tg_op = 'UPDATE' then
    if new.display_id is distinct from old.display_id then
      raise exception 'display_id_is_immutable';
    end if;
    return new;
  end if;
  if new.display_id is not null then raise exception 'display_id_is_server_assigned'; end if;
  case tg_table_name
    when 'requirements' then prefix := 'REQ-'; sequence_name := 'public.requirement_directory_id_seq';
    when 'prospects' then prefix := 'CAN-'; sequence_name := 'public.candidate_directory_id_seq';
    when 'resume_lead_drafts' then prefix := 'CAN-D-'; sequence_name := 'public.candidate_draft_directory_id_seq';
    when 'recruitment_cases' then prefix := 'REC-'; sequence_name := 'public.recruitment_directory_id_seq';
    when 'applications' then prefix := 'APP-'; sequence_name := 'public.application_directory_id_seq';
    else raise exception 'unsupported_directory_table';
  end case;
  new.display_id := prefix || lpad(nextval(sequence_name::regclass)::text, 6, '0');
  return new;
end $$;

create trigger requirements_directory_id before insert or update of display_id on public.requirements for each row execute function public.assign_directory_display_id();
create trigger prospects_directory_id before insert or update of display_id on public.prospects for each row execute function public.assign_directory_display_id();
create trigger resume_lead_drafts_directory_id before insert or update of display_id on public.resume_lead_drafts for each row execute function public.assign_directory_display_id();
create trigger recruitment_cases_directory_id before insert or update of display_id on public.recruitment_cases for each row execute function public.assign_directory_display_id();
create trigger applications_directory_id before insert or update of display_id on public.applications for each row execute function public.assign_directory_display_id();

drop function public.list_candidate_drafts();
create function public.list_candidate_drafts()
returns table(id uuid, name text, telephone text, email text, version integer, created_by uuid, created_at timestamptz, display_id text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'view_prospects') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  return query select d.id, d.name, d.telephone, d.email, d.version, d.created_by, d.created_at, d.display_id
  from public.resume_lead_drafts d
  where d.organization_id = public.needle_pilot_organization_id() and d.status = 'draft'
  order by d.created_at desc, d.id;
end $$;
revoke all on function public.list_candidate_drafts() from public, anon;
grant execute on function public.list_candidate_drafts() to authenticated;

-- Application, recruitment and pre-CV candidate notes have their own history.
-- Requirement and candidate records continue to use their existing note tables.
create table public.directory_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications(id) on delete restrict,
  case_id uuid references public.recruitment_cases(id) on delete restrict,
  draft_id uuid references public.resume_lead_drafts(id) on delete restrict,
  body text not null check (length(trim(body)) between 1 and 2000),
  author_recruiter_id uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  constraint directory_notes_one_subject check (num_nonnulls(application_id, case_id, draft_id) = 1)
);
create index directory_notes_app_idx on public.directory_notes(application_id, created_at desc) where application_id is not null;
create index directory_notes_case_idx on public.directory_notes(case_id, created_at desc) where case_id is not null;
create index directory_notes_draft_idx on public.directory_notes(draft_id, created_at desc) where draft_id is not null;
alter table public.directory_notes enable row level security;
grant select, insert on public.directory_notes to authenticated;

-- Draft table RLS is intentionally narrower than the read-only Coordinator RPC.
-- Resolve subject ownership with a fixed, security-definer lookup, then apply
-- the caller's permissions in the policies below.
create function public.directory_note_subject_in_scope(p_application uuid, p_draft uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select (p_application is not null and exists (
    select 1 from public.applications a join public.prospects p on p.id = a.prospect_id
    where a.id = p_application and p.organization_id = public.needle_pilot_organization_id()))
  or (p_draft is not null and exists (
    select 1 from public.resume_lead_drafts d
    where d.id = p_draft and d.organization_id = public.needle_pilot_organization_id()))
$$;
revoke all on function public.directory_note_subject_in_scope(uuid, uuid) from public, anon;
grant execute on function public.directory_note_subject_in_scope(uuid, uuid) to authenticated;

create policy directory_notes_read on public.directory_notes for select to authenticated using (
  (application_id is not null and public.has_permission(auth.uid(), 'view_requirements') and public.directory_note_subject_in_scope(application_id, null))
  or (case_id is not null and public.recruitment_workspace_can_read(case_id))
  or (draft_id is not null and public.has_permission(auth.uid(), 'view_prospects') and public.directory_note_subject_in_scope(null, draft_id))
);
create policy directory_notes_insert on public.directory_notes for insert to authenticated with check (
  author_recruiter_id = auth.uid() and (
    (application_id is not null and public.has_permission(auth.uid(), 'edit_junction_status') and public.directory_note_subject_in_scope(application_id, null))
    or (case_id is not null and public.recruitment_workspace_can_read(case_id) and public.has_permission(auth.uid(), 'edit_junction_status'))
    or (draft_id is not null and public.has_permission(auth.uid(), 'edit_prospects') and public.directory_note_subject_in_scope(null, draft_id))
  )
);

commit;
