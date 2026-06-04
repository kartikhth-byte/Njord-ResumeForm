-- Prospect-requirement junction workflow for prospect-enrollment v2.
-- Adds the junction table, application linkage, and the status transition
-- guard rails for requirement placement.

begin;

alter table public.applications
  add column if not exists prospect_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_prospect_id_fkey'
  ) then
    alter table public.applications
      add constraint applications_prospect_id_fkey
      foreign key (prospect_id)
      references public.prospects(id)
      on delete restrict;
  end if;
end $$;

create index if not exists applications_prospect_id_idx
  on public.applications (prospect_id);

create table if not exists public.prospect_requirements (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete restrict,
  requirement_id uuid not null references public.requirements(id) on delete restrict,
  status text not null,
  submitted_at timestamptz,
  customer_decided_at timestamptz,
  joined_at timestamptz,
  withdrawn_at timestamptz,
  withdrawal_reason text,
  assigned_by_recruiter_id uuid not null references public.profiles(id) on delete restrict,
  last_transition_by_recruiter_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint prospect_requirements_status_check check (
    status in (
      'shortlisted',
      'submitted_to_customer',
      'customer_reviewing',
      'customer_accepted',
      'customer_rejected',
      'joined',
      'withdrawn'
    )
  ),
  constraint prospect_requirements_withdrawal_reason_check check (
    status <> 'withdrawn' or nullif(trim(withdrawal_reason), '') is not null
  ),
  constraint prospect_requirements_assigned_by_recruiter_check
    check (public.is_recruiter_profile(assigned_by_recruiter_id)),
  constraint prospect_requirements_last_transition_by_recruiter_check
    check (
      last_transition_by_recruiter_id is null
      or public.is_recruiter_profile(last_transition_by_recruiter_id)
    )
);

create unique index if not exists prospect_requirements_prospect_id_requirement_id_uidx
  on public.prospect_requirements (prospect_id, requirement_id);

create index if not exists prospect_requirements_requirement_id_status_idx
  on public.prospect_requirements (requirement_id, status, created_at desc);

create index if not exists prospect_requirements_prospect_id_status_idx
  on public.prospect_requirements (prospect_id, status, created_at desc);

create index if not exists prospect_requirements_assigned_by_recruiter_id_idx
  on public.prospect_requirements (assigned_by_recruiter_id, created_at desc);

create or replace function public.prepare_prospect_requirement_row()
returns trigger
language plpgsql
as $function$
declare
  current_tenant_date date := timezone('Asia/Kolkata', now())::date;
  actor_uuid uuid;
begin
  if tg_op = 'INSERT' then
    new.status := coalesce(nullif(btrim(new.status), ''), 'shortlisted');
    if new.status <> 'shortlisted' then
      raise exception 'Prospect requirements must be created with status shortlisted';
    end if;

    if new.assigned_by_recruiter_id is null then
      new.assigned_by_recruiter_id := auth.uid();
    end if;

    if not public.is_recruiter_profile(new.assigned_by_recruiter_id) then
      raise exception 'assigned_by_recruiter_id must reference a recruiter profile';
    end if;

    new.updated_at := now();
    return new;
  end if;

  if new.prospect_id is distinct from old.prospect_id then
    raise exception 'prospect_id cannot be changed after insert';
  end if;

  if new.requirement_id is distinct from old.requirement_id then
    raise exception 'requirement_id cannot be changed after insert';
  end if;

  if new.assigned_by_recruiter_id is distinct from old.assigned_by_recruiter_id then
    raise exception 'assigned_by_recruiter_id cannot be changed after insert';
  end if;

  if new.status is distinct from old.status then
    actor_uuid := coalesce(new.last_transition_by_recruiter_id, auth.uid());
    if actor_uuid is null then
      raise exception 'last_transition_by_recruiter_id is required for status transitions';
    end if;

    if not public.is_recruiter_profile(actor_uuid) then
      raise exception 'last_transition_by_recruiter_id must reference a recruiter profile';
    end if;

    new.last_transition_by_recruiter_id := actor_uuid;

    if old.status = 'shortlisted' and new.status = 'submitted_to_customer' then
      new.submitted_at := coalesce(new.submitted_at, now());
      new.customer_decided_at := null;
      new.joined_at := null;
      new.withdrawn_at := null;
      new.withdrawal_reason := null;
    elsif old.status = 'submitted_to_customer' and new.status = 'shortlisted' then
      new.submitted_at := null;
      new.customer_decided_at := null;
      new.joined_at := null;
      new.withdrawn_at := null;
      new.withdrawal_reason := null;
    elsif old.status = 'submitted_to_customer' and new.status = 'customer_reviewing' then
      null;
    elsif old.status = 'customer_reviewing' and new.status in ('customer_accepted', 'customer_rejected') then
      new.customer_decided_at := coalesce(new.customer_decided_at, now());
    elsif old.status = 'customer_accepted' and new.status = 'customer_rejected' then
      new.customer_decided_at := coalesce(new.customer_decided_at, now());
    elsif old.status = 'customer_accepted' and new.status = 'joined' then
      new.joined_at := coalesce(new.joined_at, now());
    elsif old.status in (
      'shortlisted',
      'submitted_to_customer',
      'customer_reviewing',
      'customer_accepted',
      'customer_rejected'
    ) and new.status = 'withdrawn' then
      if nullif(trim(new.withdrawal_reason), '') is null then
        raise exception 'withdrawal_reason is required when withdrawing a prospect requirement';
      end if;
      new.withdrawn_at := coalesce(new.withdrawn_at, now());
    else
      raise exception 'Invalid prospect requirement status transition from % to %', old.status, new.status;
    end if;
  end if;

  if new.status = 'withdrawn' and nullif(trim(new.withdrawal_reason), '') is null then
    raise exception 'withdrawal_reason is required when withdrawing a prospect requirement';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

create or replace function public.touch_prospect_row_from_junction_change()
returns trigger
language plpgsql
as $function$
declare
  target_prospect_id uuid := coalesce(new.prospect_id, old.prospect_id);
begin
  if tg_op = 'DELETE' then
    return null;
  end if;

  update public.prospects
  set
    last_activity_at = now(),
    updated_at = now()
  where id = target_prospect_id;

  return null;
end;
$function$;

revoke all on function public.touch_prospect_row_from_junction_change() from public;

revoke all on function public.prepare_prospect_requirement_row() from public;

drop trigger if exists prospect_requirements_prepare_row on public.prospect_requirements;
create trigger prospect_requirements_prepare_row
before insert or update on public.prospect_requirements
for each row
execute function public.prepare_prospect_requirement_row();

drop trigger if exists prospect_requirements_touch_prospect_row on public.prospect_requirements;
create trigger prospect_requirements_touch_prospect_row
after insert or update or delete on public.prospect_requirements
for each row
execute function public.touch_prospect_row_from_junction_change();

alter table public.prospect_requirements enable row level security;

grant select, insert, update on public.prospect_requirements to authenticated;

create policy "prospect_requirements_read_view_requirements"
on public.prospect_requirements
for select
to authenticated
using (public.has_permission(auth.uid(), 'view_requirements'));

create policy "prospect_requirements_insert_requirements_or_prospects"
on public.prospect_requirements
for insert
to authenticated
with check (
  public.has_permission(auth.uid(), 'create_prospects')
  or public.has_permission(auth.uid(), 'create_requirements')
  or public.has_permission(auth.uid(), 'edit_requirements')
);

create policy "prospect_requirements_update_workflow"
on public.prospect_requirements
for update
to authenticated
using (
  public.has_permission(auth.uid(), 'edit_junction_status')
  or public.has_permission(auth.uid(), 'withdraw_junctions')
)
with check (
  public.has_permission(auth.uid(), 'edit_junction_status')
  or public.has_permission(auth.uid(), 'withdraw_junctions')
);

commit;
