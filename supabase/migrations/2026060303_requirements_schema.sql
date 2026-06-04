-- Requirements schema for prospect-enrollment v2.
-- Includes requirement masters, generated requirement IDs, nationality links,
-- and requirement remarks.

begin;

create table if not exists public.requirement_id_sequences (
  req_year_month text primary key,
  next_sequence integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_requirement_id_sequences_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke all on function public.touch_requirement_id_sequences_updated_at() from public;

drop trigger if exists requirement_id_sequences_touch_updated_at on public.requirement_id_sequences;
create trigger requirement_id_sequences_touch_updated_at
before update on public.requirement_id_sequences
for each row
execute function public.touch_requirement_id_sequences_updated_at();

create or replace function public.build_requirement_display_id(p_req_year_month text, p_req_sequence integer)
returns text
language sql
stable
as $function$
  select to_char(to_date(p_req_year_month || '-01', 'YYYY-MM-DD'), 'YYYY-Mon')
    || '-'
    || lpad(p_req_sequence::text, 3, '0');
$function$;

revoke all on function public.build_requirement_display_id(text, integer) from public;

create or replace function public.allocate_requirement_identifier(p_req_year_month text)
returns table(req_sequence integer, req_id_display text)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  normalized_year_month text := coalesce(nullif(btrim(p_req_year_month), ''), to_char(timezone('Asia/Kolkata', now()), 'YYYY-MM'));
begin
  if normalized_year_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'req_year_month must use YYYY-MM format';
  end if;

  insert into public.requirement_id_sequences (req_year_month, next_sequence)
  values (normalized_year_month, 1)
  on conflict (req_year_month) do nothing;

  update public.requirement_id_sequences
  set next_sequence = next_sequence + 1,
      updated_at = now()
  where req_year_month = normalized_year_month
  returning next_sequence - 1 into req_sequence;

  if req_sequence is null then
    raise exception 'Unable to allocate requirement identifier for %', normalized_year_month;
  end if;

  req_id_display := public.build_requirement_display_id(normalized_year_month, req_sequence);
  return next;
end;
$function$;

revoke all on function public.allocate_requirement_identifier(text) from public;

create table if not exists public.requirements (
  id uuid primary key default gen_random_uuid(),
  req_id_display text not null unique,
  req_year_month text not null,
  req_sequence integer,
  date_opened date not null,
  date_closed date,
  vessel_name text,
  vessel_type_id uuid not null references public.vessel_types(id) on delete restrict,
  rank_id uuid not null references public.ranks(id) on delete restrict,
  positions_required integer not null,
  target_days integer not null,
  owner_recruiter_id uuid not null references public.profiles(id) on delete restrict,
  customer_name text,
  status text not null,
  closure_reason text,
  created_by_recruiter_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint requirements_req_year_month_check check (req_year_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  constraint requirements_req_sequence_check check (req_sequence is null or req_sequence > 0),
  constraint requirements_req_id_display_check check (
    char_length(req_id_display) <= 32
    and req_id_display ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'
  ),
  constraint requirements_positions_required_check check (positions_required >= 1),
  constraint requirements_target_days_check check (target_days >= 1),
  constraint requirements_status_check check (status in ('open', 'closed', 'cancelled')),
  constraint requirements_closure_reason_check check (
    status <> 'cancelled' or nullif(trim(closure_reason), '') is not null
  ),
  constraint requirements_owner_recruiter_check check (public.is_recruiter_profile(owner_recruiter_id)),
  constraint requirements_created_by_recruiter_check check (public.is_recruiter_profile(created_by_recruiter_id))
);

create unique index if not exists requirements_req_year_month_sequence_uidx
  on public.requirements (req_year_month, req_sequence)
  where req_sequence is not null;

create index if not exists requirements_owner_recruiter_created_at_idx
  on public.requirements (owner_recruiter_id, created_at desc);

create index if not exists requirements_status_date_opened_idx
  on public.requirements (status, date_opened desc);

create index if not exists requirements_rank_id_idx
  on public.requirements (rank_id);

create index if not exists requirements_vessel_type_id_idx
  on public.requirements (vessel_type_id);

create index if not exists requirements_customer_name_idx
  on public.requirements (customer_name);

create or replace function public.prepare_requirement_row()
returns trigger
language plpgsql
as $function$
declare
  generated_sequence integer;
  generated_display text;
  expected_display text;
  normalized_year_month text;
begin
  if tg_op = 'INSERT' then
    new.req_year_month := coalesce(nullif(btrim(new.req_year_month), ''), to_char(timezone('Asia/Kolkata', now()), 'YYYY-MM'));
    new.date_opened := coalesce(new.date_opened, timezone('Asia/Kolkata', now())::date);
    new.status := coalesce(nullif(btrim(new.status), ''), 'open');

    if new.status <> 'open' then
      raise exception 'Requirements must be created with status open';
    end if;

    if new.req_sequence is null and (new.req_id_display is null or btrim(new.req_id_display) = '') then
      select req_sequence, req_id_display
      into generated_sequence, generated_display
      from public.allocate_requirement_identifier(new.req_year_month);

      new.req_sequence := generated_sequence;
      new.req_id_display := generated_display;
    elsif new.req_sequence is not null then
      expected_display := public.build_requirement_display_id(new.req_year_month, new.req_sequence);
      if new.req_id_display is null or btrim(new.req_id_display) = '' then
        new.req_id_display := expected_display;
      elsif new.req_id_display <> expected_display then
        raise exception 'req_id_display must match req_year_month and req_sequence when seq is provided';
      end if;
    end if;

    new.updated_at := now();
    return new;
  end if;

  if new.req_year_month is distinct from old.req_year_month then
    raise exception 'req_year_month cannot be changed after insert';
  end if;

  normalized_year_month := old.req_year_month;

  if new.req_sequence is distinct from old.req_sequence then
    raise exception 'req_sequence cannot be changed after insert';
  end if;

  if new.req_id_display is distinct from old.req_id_display then
    if new.req_sequence is not null then
      expected_display := public.build_requirement_display_id(normalized_year_month, new.req_sequence);
      if new.req_id_display <> expected_display then
        raise exception 'req_id_display must remain aligned with req_year_month and req_sequence';
      end if;
    end if;
  end if;

  if new.status is distinct from old.status then
    if old.status = 'open' and new.status = 'closed' then
      new.date_closed := timezone('Asia/Kolkata', now())::date;
    elsif old.status = 'open' and new.status = 'cancelled' then
      if nullif(trim(new.closure_reason), '') is null then
        raise exception 'closure_reason is required when cancelling a requirement';
      end if;
      new.date_closed := timezone('Asia/Kolkata', now())::date;
    elsif old.status in ('closed', 'cancelled') and new.status = 'open' then
      new.date_closed := null;
      new.closure_reason := null;
    else
      raise exception 'Invalid requirement status transition from % to %', old.status, new.status;
    end if;
  end if;

  if new.status = 'cancelled' and nullif(trim(new.closure_reason), '') is null then
    raise exception 'closure_reason is required when cancelling a requirement';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function public.prepare_requirement_row() from public;

drop trigger if exists requirements_prepare_row on public.requirements;
create trigger requirements_prepare_row
before insert or update on public.requirements
for each row
execute function public.prepare_requirement_row();

create or replace function public.touch_requirements_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke all on function public.touch_requirements_updated_at() from public;

drop trigger if exists requirements_touch_updated_at on public.requirements;
create trigger requirements_touch_updated_at
before update on public.requirements
for each row
execute function public.touch_requirements_updated_at();

alter table public.requirements enable row level security;

grant select, insert, update on public.requirements to authenticated;

create policy "requirements_read_view_requirements"
on public.requirements
for select
to authenticated
using (public.has_permission(auth.uid(), 'view_requirements'));

create policy "requirements_insert_create_requirements"
on public.requirements
for insert
to authenticated
with check (public.has_permission(auth.uid(), 'create_requirements'));

create policy "requirements_update_manage_requirements"
on public.requirements
for update
to authenticated
using (
  public.has_permission(auth.uid(), 'edit_requirements')
  or public.has_permission(auth.uid(), 'transition_requirements')
  or public.has_permission(auth.uid(), 'edit_requirement_owner')
)
with check (
  public.has_permission(auth.uid(), 'edit_requirements')
  or public.has_permission(auth.uid(), 'transition_requirements')
  or public.has_permission(auth.uid(), 'edit_requirement_owner')
);

create table if not exists public.requirement_nationalities (
  requirement_id uuid not null references public.requirements(id) on delete cascade,
  country_id uuid not null references public.countries(id) on delete restrict,
  primary key (requirement_id, country_id)
);

create index if not exists requirement_nationalities_country_id_idx
  on public.requirement_nationalities (country_id);

alter table public.requirement_nationalities enable row level security;

grant select, insert, update, delete on public.requirement_nationalities to authenticated;

create policy "requirement_nationalities_read_view_requirements"
on public.requirement_nationalities
for select
to authenticated
using (public.has_permission(auth.uid(), 'view_requirements'));

create policy "requirement_nationalities_write_requirements"
on public.requirement_nationalities
for all
to authenticated
using (
  public.has_permission(auth.uid(), 'create_requirements')
  or public.has_permission(auth.uid(), 'edit_requirements')
)
with check (
  public.has_permission(auth.uid(), 'create_requirements')
  or public.has_permission(auth.uid(), 'edit_requirements')
);

create table if not exists public.requirement_remarks (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.requirements(id) on delete restrict,
  body text not null,
  author_recruiter_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  edit_locked_at timestamptz,
  is_transition_note boolean not null default false,
  visibility text not null default 'internal',
  constraint requirement_remarks_visibility_check
    check (visibility in ('internal', 'master_only')),
  constraint requirement_remarks_author_recruiter_check
    check (public.is_recruiter_profile(author_recruiter_id))
);

create index if not exists requirement_remarks_requirement_id_created_at_idx
  on public.requirement_remarks (requirement_id, created_at desc);

create index if not exists requirement_remarks_author_recruiter_id_created_at_idx
  on public.requirement_remarks (author_recruiter_id, created_at desc);

alter table public.requirement_remarks enable row level security;

grant select, insert, update on public.requirement_remarks to authenticated;

create policy "requirement_remarks_read_edit_requirements"
on public.requirement_remarks
for select
to authenticated
using (
  public.has_permission(auth.uid(), 'view_requirements')
  and (
    visibility <> 'master_only'
    or public.is_master_recruiter_profile(auth.uid())
  )
);

create policy "requirement_remarks_insert_edit_requirements"
on public.requirement_remarks
for insert
to authenticated
with check (public.has_permission(auth.uid(), 'edit_requirements'));

create policy "requirement_remarks_update_edit_requirements"
on public.requirement_remarks
for update
to authenticated
using (public.has_permission(auth.uid(), 'edit_requirements'))
with check (public.has_permission(auth.uid(), 'edit_requirements'));

commit;
