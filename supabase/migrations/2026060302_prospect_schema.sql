-- Prospect schema for the prospect-enrollment v2 kickoff.
-- This introduces the core lookup masters, prospects, and prospect notes.

begin;

create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ranks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vessel_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_catalog_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke all on function public.touch_catalog_updated_at() from public;

grant select on public.countries to authenticated;
grant select on public.ranks to authenticated;
grant select on public.vessel_types to authenticated;

drop trigger if exists countries_touch_updated_at on public.countries;
create trigger countries_touch_updated_at
before update on public.countries
for each row
execute function public.touch_catalog_updated_at();

drop trigger if exists ranks_touch_updated_at on public.ranks;
create trigger ranks_touch_updated_at
before update on public.ranks
for each row
execute function public.touch_catalog_updated_at();

drop trigger if exists vessel_types_touch_updated_at on public.vessel_types;
create trigger vessel_types_touch_updated_at
before update on public.vessel_types
for each row
execute function public.touch_catalog_updated_at();

insert into public.countries (code, name)
select seed.code, seed.name
from (
  values
  ('argentina', 'Argentina'),
  ('australia', 'Australia'),
  ('austria', 'Austria'),
  ('bahrain', 'Bahrain'),
  ('bangladesh', 'Bangladesh'),
  ('belgium', 'Belgium'),
  ('brazil', 'Brazil'),
  ('canada', 'Canada'),
  ('chile', 'Chile'),
  ('china', 'China'),
  ('colombia', 'Colombia'),
  ('denmark', 'Denmark'),
  ('egypt', 'Egypt'),
  ('finland', 'Finland'),
  ('france', 'France'),
  ('germany', 'Germany'),
  ('ghana', 'Ghana'),
  ('greece', 'Greece'),
  ('india', 'India'),
  ('indonesia', 'Indonesia'),
  ('ireland', 'Ireland'),
  ('italy', 'Italy'),
  ('japan', 'Japan'),
  ('kenya', 'Kenya'),
  ('kuwait', 'Kuwait'),
  ('malaysia', 'Malaysia'),
  ('mexico', 'Mexico'),
  ('myanmar', 'Myanmar'),
  ('nepal', 'Nepal'),
  ('netherlands', 'Netherlands'),
  ('new_zealand', 'New Zealand'),
  ('nigeria', 'Nigeria'),
  ('norway', 'Norway'),
  ('oman', 'Oman'),
  ('other', 'Other'),
  ('pakistan', 'Pakistan'),
  ('peru', 'Peru'),
  ('philippines', 'Philippines'),
  ('poland', 'Poland'),
  ('portugal', 'Portugal'),
  ('qatar', 'Qatar'),
  ('russia', 'Russia'),
  ('saudi_arabia', 'Saudi Arabia'),
  ('singapore', 'Singapore'),
  ('south_africa', 'South Africa'),
  ('south_korea', 'South Korea'),
  ('spain', 'Spain'),
  ('sri_lanka', 'Sri Lanka'),
  ('sweden', 'Sweden'),
  ('switzerland', 'Switzerland'),
  ('thailand', 'Thailand'),
  ('turkey', 'Turkey'),
  ('ukraine', 'Ukraine'),
  ('uae', 'United Arab Emirates'),
  ('united_kingdom', 'United Kingdom'),
  ('united_states', 'United States'),
  ('vietnam', 'Vietnam')
) as seed(code, name)
where not exists (
  select 1
  from public.countries existing
  where existing.code = seed.code
     or existing.name = seed.name
);

with seed_rows(code, name) as (
  values
  ('accommodation_barge', 'Accommodation Barge'),
  ('aht', 'AHT'),
  ('ahts', 'AHTS'),
  ('ahts_dp1', 'AHTS DP-I'),
  ('ahts_dp2', 'AHTS DP-II'),
  ('ahts_dp3', 'AHTS DP-III'),
  ('bitumen_tanker', 'Bitumen Tanker'),
  ('bulk_carrier', 'Bulk Carrier'),
  ('bunker_tanker', 'BUNKER TANKER'),
  ('cape_bulk', 'CAPE.Bulk'),
  ('car_carrier', 'Car Carrier'),
  ('cellular_container', 'CELLULAR CONTAINER'),
  ('cement_carrier', 'Cement Carrier'),
  ('chemical_tanker', 'Chemical Tanker'),
  ('coastal_vessel', 'Coastal Vessel'),
  ('container', 'Container'),
  ('container_vessel', 'Container Vessel'),
  ('crude_oil_tanker', 'Crude Oil Tanker'),
  ('cruise_ship', 'Cruise Ship'),
  ('demolition_vessel', 'DEMOLITION VESSEL'),
  ('dp', 'DP'),
  ('dp1', 'DP-I'),
  ('dp2', 'DP-II'),
  ('dp3', 'DP-III'),
  ('dp2_rov', 'DPII ROV'),
  ('dredger', 'Dredger'),
  ('dredger_caps', 'DREDGER'),
  ('drill_ship_dp1', 'DRILL SHIP DP-I'),
  ('drill_ship_dp2', 'DRILL SHIP DP-II'),
  ('drill_ship_dp3', 'DRILL SHIP DP-III'),
  ('drilling_rig', 'Drilling Rig'),
  ('drillship', 'DRILLSHIP'),
  ('dry_cargo', 'Dry Cargo'),
  ('dry_cargo_vessel', 'Dry Cargo Vessel'),
  ('dsv', 'DSV'),
  ('dsv_dp1', 'DSV DP-I'),
  ('dsv_dp2', 'DSV DP-II'),
  ('dsv_dp3', 'DSV DP-III'),
  ('ffsv', 'FFSV'),
  ('fishing_vessel', 'Fishing Vessel'),
  ('fpso', 'FPSO'),
  ('fso', 'FSO'),
  ('gear_bulk', 'Gear Bulk'),
  ('general_cargo', 'General Cargo'),
  ('gtv', 'GTV'),
  ('heavy_lift', 'Heavy-Lift'),
  ('hopper_barge', 'HOPPER BARGE'),
  ('jack_up_barge', 'JACK UP BARGE'),
  ('jack_up_rig', 'JACK UP RIG'),
  ('legc', 'LEGC (ETHYLENE CARRIERS)'),
  ('livestock_carrier', 'Livestock Carrier'),
  ('lng_carrier', 'LNG Carrier'),
  ('lpg_carrier', 'LPG Carrier'),
  ('luxury_yacht', 'LUXURY YACHT'),
  ('mini_bulk_carrier', 'Mini Bulk Carrier'),
  ('mlp', 'MLP'),
  ('mr_tanker', 'MR Tanker'),
  ('msv', 'MSV'),
  ('msv_dp1', 'MSV DP-I'),
  ('msv_dp2', 'MSV DP-II'),
  ('msv_dp3', 'MSV DP-III'),
  ('multi_purpose', 'Multi Purpose'),
  ('obo', 'OBO'),
  ('offshore_research_vessel', 'OFFSHORE RESEARCH VESSEL'),
  ('offshore_supply', 'Offshore Supply'),
  ('offshore_supply_vessel', 'Offshore Supply Vessel'),
  ('oil_tanker', 'Oil Tanker'),
  ('oil_chem_tanker', 'Oil/Chem Tanker'),
  ('osv', 'OSV'),
  ('osv_dp1', 'OSV DP-I'),
  ('osv_dp2', 'OSV DP-II'),
  ('osv_dp3', 'OSV DP-III'),
  ('passenger_ship', 'Passenger Ship'),
  ('passenger_cruise_vessel', 'Passenger/Cruise Vessel'),
  ('pipelaying_vessel', 'Pipelaying Vessel'),
  ('product_tanker', 'Product Tanker'),
  ('psv', 'PSV'),
  ('psv_dp1', 'PSV DP-I'),
  ('psv_dp2', 'PSV DP-II'),
  ('psv_dp3', 'PSV DP-III'),
  ('pure_car_truck_carrier', 'PURE CAR TRUCK CARRIER'),
  ('reefer', 'Reefer'),
  ('reefer_container', 'Reefer Container'),
  ('reefer_container_vessel', 'Reefer Container Vessel'),
  ('reefer_vessel', 'Reefer Vessel'),
  ('rig', 'RIG'),
  ('roro_vessel', 'Ro-Ro Vessel'),
  ('ropax_vessel', 'ROPAX VESSEL'),
  ('roro_passenger', 'RORO/PASSENGER'),
  ('sand_barge', 'Sand Barge'),
  ('self_unloader_bulk_vessel', 'Self Unloader Bulk Vessel'),
  ('sp_survey_vessel', 'Sp. Survey Vessel'),
  ('supply_utility_vessel', 'SUPPLY AND UTILITY VESSEL'),
  ('survey_vessel', 'Survey Vessel'),
  ('tnc', 'TNC'),
  ('transhipper', 'Transhipper'),
  ('tug', 'TUG'),
  ('ulcc', 'ULCC'),
  ('vlcc', 'VLCC'),
  ('vlec', 'VLEC'),
  ('vlgc', 'VLGC'),
  ('vloc', 'VLOC'),
  ('war_ship', 'WAR SHIP'),
  ('wood_log_carrier', 'Wood/Log Carrier')
),
deduped as (
  select distinct on (lower(name)) code, name
  from seed_rows
  order by lower(name), code
)
insert into public.vessel_types (code, name)
select seed.code, seed.name
from deduped seed
where not exists (
  select 1
  from public.vessel_types existing
  where existing.code = seed.code
     or existing.name = seed.name
);

insert into public.ranks (code, name)
select seed.code, seed.name
from (
  values
  ('master', 'Master'),
  ('add_master', 'Add Master'),
  ('inland_master', 'Inland Master'),
  ('dpo_master', 'DPO Master'),
  ('sr_dpo_master', 'SR DPO Master'),
  ('extra_master', 'Extra Master'),
  ('master_ncv', 'Master NCV'),
  ('mooring_master', 'MOORING MASTER'),
  ('chief_officer', 'Chief Officer'),
  ('add_chief_officer', 'Add Chief Officer'),
  ('second_officer', '2nd Officer'),
  ('add_second_officer', 'Add 2nd Officer'),
  ('third_officer', '3rd Officer'),
  ('junior_third_officer', 'Junior 3rd Officer'),
  ('safety_officer', 'Safety Officer'),
  ('radio_officer', 'Radio Officer'),
  ('junior_officer', 'Junior Officer'),
  ('dpo_chief_officer', 'DPO Chief Officer'),
  ('sr_dpo_chief_officer', 'SR DPO Chief Officer'),
  ('jr_dpo_chief_officer', 'JR DPO Chief Officer'),
  ('dpo_second_officer', 'DPO 2nd Officer'),
  ('dpo_third_officer', 'DPO 3rd Officer'),
  ('dpo', 'DPO'),
  ('chief_officer_ncv', 'Chief Officer NCV'),
  ('deck_cadet', 'Deck Cadet'),
  ('dual_cadet', 'Dual Cadet'),
  ('trainee_cadet', 'Trainee Cadet'),
  ('chief_engineer', 'Chief Engineer'),
  ('add_chief_engineer', 'Add Chief Engineer'),
  ('second_engineer', '2nd Engineer'),
  ('add_second_engineer', 'Add 2nd Engineer'),
  ('third_engineer', '3rd Engineer'),
  ('fourth_engineer', '4th Engineer'),
  ('junior_fourth_engineer', 'Junior 4th Engineer'),
  ('fifth_engineer', '5th Engineer'),
  ('junior_engineer', 'Junior Engineer'),
  ('reefer_engineer', 'Reefer Engineer'),
  ('gas_engineer', 'Gas Engineer'),
  ('cargo_engineer', 'Cargo Engineer'),
  ('trainee_engineer', 'Trainee Engineer'),
  ('electrical_engineer', 'Electrical Engineer'),
  ('dredger_engineers', 'Dredger Engineers'),
  ('chief_engineer_ncv', 'Chief Engineer NCV'),
  ('second_engineer_ncv', '2nd Engineer NCV'),
  ('fourth_engineer_ncv', '4th Engineer NCV'),
  ('add_third_engineer', 'Add 3rd Engineer'),
  ('electrical_officer', 'Electrical Officer'),
  ('electro_technical_officer', 'Electro Technical Officer'),
  ('asst_electrical_officer', 'Asst. Electrical Officer'),
  ('trainee_electrical_officer', 'Trainee Electrical Officer'),
  ('dive_electrical_technician', 'Dive Electrical Technician'),
  ('ncv_nwko', 'NCV/NWKO'),
  ('jr_dpo', 'Jr DPO'),
  ('bosun', 'Bosun'),
  ('pumpman', 'Pumpman'),
  ('deck_fitter', 'Deck Fitter'),
  ('ab', 'AB'),
  ('os', 'OS'),
  ('gp', 'GP'),
  ('crane_operator', 'Crane Operator'),
  ('trainee_ce', 'Trainee C/E'),
  ('reefer_mechanic', 'Reefer Mechanic'),
  ('engine_fitter', 'Engine Fitter'),
  ('fitter', 'Fitter'),
  ('motorman', 'Motorman'),
  ('wiper', 'Wiper'),
  ('travel_fitter', 'Travel Fitter'),
  ('travel_wiper', 'Travel Wiper'),
  ('hotel_manager', 'Hotel Manager'),
  ('pipe_operator', 'Pipe Operator'),
  ('dredger_cutter_operators', 'Dredger Cutter Operators'),
  ('purser', 'Purser'),
  ('social_director', 'Social Director'),
  ('sports_director', 'Sports Director'),
  ('chef', 'Chef'),
  ('souse_chef', 'Souse Chef'),
  ('chief_cook', 'Chief Cook'),
  ('second_cook', '2nd Cook'),
  ('chief_steward', 'Chief Steward'),
  ('steward', 'Steward'),
  ('roustabout', 'Roustabout'),
  ('rigger', 'Rigger'),
  ('cabin_attendant', 'Cabin Attendant'),
  ('bar_tender', 'Bar Tender'),
  ('musician', 'Musician'),
  ('laundry_men', 'Laundry Men'),
  ('technical_manager', 'Technical Manager'),
  ('superintendent', 'Superintendent'),
  ('personnel_manager', 'Personnel Manager'),
  ('internal_auditor', 'Internal Auditor'),
  ('travel_coordinator', 'Travel Co-ordinator'),
  ('master_mariner', 'Master Mariner'),
  ('ship_management', 'Ship Management'),
  ('shipyard', 'Shipyard'),
  ('repair_yard_dd', 'Repair Yard/D.D.'),
  ('instructor', 'Instructor'),
  ('marine_consultancy', 'Marine Consultancy'),
  ('infotech', 'Infotech'),
  ('shore_industry', 'Shore Industry'),
  ('surveyor', 'Surveyor'),
  ('ship_consultant', 'Ship Consultant'),
  ('shore_workshop', 'Shore Workshop'),
  ('shore_industries', 'Shore Industries'),
  ('port_operation', 'Port Operation'),
  ('ship_chandler', 'Ship Chandler'),
  ('ship_agencies', 'Ship Agencies'),
  ('ship_services', 'Ship Services'),
  ('voy_rep_staff', 'Voy. Rep. Staff'),
  ('legal_services', 'Legal Services'),
  ('oim', 'Offshore Installation Manager (OIM)'),
  ('tube_operator', 'TUBE OPERATOR'),
  ('oiler', 'Oiler'),
  ('tug_handler', 'TUG HANDLER')
  ) as seed(code, name)
where not exists (
  select 1
  from public.ranks existing
  where existing.code = seed.code
     or existing.name = seed.name
);

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dob date not null,
  nationality_id uuid not null references public.countries(id) on delete restrict,
  rank_applied_for_id uuid not null references public.ranks(id) on delete restrict,
  vessel_type_id uuid not null references public.vessel_types(id) on delete restrict,
  exp_in_rank_months integer not null,
  previous_employer text,
  is_first_time_at_sea boolean not null default false,
  telephone text not null,
  email text not null,
  email_normalized text generated always as (lower(btrim(email))) stored,
  lead_source text,
  status text not null,
  first_contacted_at timestamptz,
  last_terminal_status text,
  last_terminal_status_at timestamptz,
  archived_at timestamptz,
  archive_reason text,
  deleted_at timestamptz,
  deleted_by_recruiter_id uuid references public.profiles(id) on delete set null,
  invited_at timestamptz,
  claimed_at timestamptz,
  applicant_user_id uuid references public.profiles(id) on delete set null,
  bounce_flag boolean not null default false,
  created_by_recruiter_id uuid not null references public.profiles(id) on delete restrict,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint prospects_exp_in_rank_months_check check (exp_in_rank_months >= 0),
  constraint prospects_previous_employer_check check (
    is_first_time_at_sea or nullif(trim(previous_employer), '') is not null
  ),
  constraint prospects_telephone_check check (telephone ~ '^\+[1-9][0-9]{1,14}$'),
  constraint prospects_status_check check (status in ('open', 'contacted', 'approved', 'rejected')),
  constraint prospects_archive_reason_check check (
    archived_at is null or nullif(trim(archive_reason), '') is not null
  ),
  constraint prospects_deleted_by_recruiter_check check (
    deleted_by_recruiter_id is null or public.is_recruiter_profile(deleted_by_recruiter_id)
  ),
  constraint prospects_created_by_recruiter_check check (
    public.is_recruiter_profile(created_by_recruiter_id)
  ),
  constraint prospects_last_terminal_status_check check (
    last_terminal_status is null or last_terminal_status in ('rejected')
  ),
  constraint prospects_last_terminal_status_at_check check (
    (last_terminal_status is null and last_terminal_status_at is null)
    or (last_terminal_status is not null and last_terminal_status_at is not null)
  )
);

create unique index if not exists prospects_email_live_uidx
  on public.prospects (email_normalized)
  where archived_at is null and deleted_at is null;

create unique index if not exists prospects_applicant_user_uidx
  on public.prospects (applicant_user_id)
  where applicant_user_id is not null and deleted_at is null;

create index if not exists prospects_email_normalized_idx
  on public.prospects (email_normalized);

create index if not exists prospects_telephone_idx
  on public.prospects (telephone);

create index if not exists prospects_status_archive_deleted_idx
  on public.prospects (status, archived_at, deleted_at);

create index if not exists prospects_created_by_recruiter_created_at_idx
  on public.prospects (created_by_recruiter_id, created_at);

create index if not exists prospects_last_activity_at_idx
  on public.prospects (last_activity_at desc);

create or replace function public.touch_prospects_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  new.last_activity_at = now();
  return new;
end;
$function$;

revoke all on function public.touch_prospects_updated_at() from public;

create or replace function public.set_prospect_first_contacted_at()
returns trigger
language plpgsql
as $function$
begin
  if old.status = 'open'
     and new.status = 'contacted'
     and old.first_contacted_at is null
     and new.first_contacted_at is null then
    new.first_contacted_at = now();
  end if;

  return new;
end;
$function$;

revoke all on function public.set_prospect_first_contacted_at() from public;

drop trigger if exists prospects_touch_updated_at on public.prospects;
create trigger prospects_touch_updated_at
before update on public.prospects
for each row
execute function public.touch_prospects_updated_at();

drop trigger if exists prospects_set_first_contacted_at on public.prospects;
create trigger prospects_set_first_contacted_at
before update on public.prospects
for each row
execute function public.set_prospect_first_contacted_at();

alter table public.prospects enable row level security;

grant select, insert, update on public.prospects to authenticated;

drop policy if exists "prospects_read_view_prospects" on public.prospects;
create policy "prospects_read_view_prospects"
on public.prospects
for select
to authenticated
using (public.has_permission(auth.uid(), 'view_prospects'));

drop policy if exists "prospects_insert_create_prospects" on public.prospects;
create policy "prospects_insert_create_prospects"
on public.prospects
for insert
to authenticated
with check (public.has_permission(auth.uid(), 'create_prospects'));

drop policy if exists "prospects_update_manage_prospects" on public.prospects;
create policy "prospects_update_manage_prospects"
on public.prospects
for update
to authenticated
using (
  public.has_permission(auth.uid(), 'edit_prospects')
  or public.has_permission(auth.uid(), 'transition_prospects')
  or public.has_permission(auth.uid(), 'archive_prospects')
  or public.has_permission(auth.uid(), 'delete_prospects')
)
with check (
  public.has_permission(auth.uid(), 'edit_prospects')
  or public.has_permission(auth.uid(), 'transition_prospects')
  or public.has_permission(auth.uid(), 'archive_prospects')
  or public.has_permission(auth.uid(), 'delete_prospects')
);

create table if not exists public.prospect_notes (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete restrict,
  body text not null,
  author_recruiter_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  edit_locked_at timestamptz,
  is_transition_note boolean not null default false,
  visibility text not null default 'internal',
  constraint prospect_notes_visibility_check
    check (visibility in ('internal', 'master_only')),
  constraint prospect_notes_author_recruiter_check
    check (public.is_recruiter_profile(author_recruiter_id))
);

create index if not exists prospect_notes_prospect_id_created_at_idx
  on public.prospect_notes (prospect_id, created_at desc);

create index if not exists prospect_notes_author_recruiter_id_created_at_idx
  on public.prospect_notes (author_recruiter_id, created_at desc);

alter table public.prospect_notes enable row level security;

grant select, insert, update on public.prospect_notes to authenticated;

drop policy if exists "prospect_notes_read_view_notes" on public.prospect_notes;
create policy "prospect_notes_read_view_notes"
on public.prospect_notes
for select
to authenticated
using (
  public.has_permission(auth.uid(), 'view_prospect_notes')
  and (
    visibility <> 'master_only'
    or public.is_master_recruiter_profile(auth.uid())
  )
);

drop policy if exists "prospect_notes_insert_edit_notes" on public.prospect_notes;
create policy "prospect_notes_insert_edit_notes"
on public.prospect_notes
for insert
to authenticated
with check (public.has_permission(auth.uid(), 'edit_prospect_notes'));

drop policy if exists "prospect_notes_update_edit_notes" on public.prospect_notes;
create policy "prospect_notes_update_edit_notes"
on public.prospect_notes
for update
to authenticated
using (public.has_permission(auth.uid(), 'edit_prospect_notes'))
with check (public.has_permission(auth.uid(), 'edit_prospect_notes'));

create or replace function public.touch_prospect_row_from_note_change()
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

revoke all on function public.touch_prospect_row_from_note_change() from public;

drop trigger if exists prospect_notes_touch_prospect_row on public.prospect_notes;
create trigger prospect_notes_touch_prospect_row
after insert or update or delete on public.prospect_notes
for each row
execute function public.touch_prospect_row_from_note_change();

commit;
