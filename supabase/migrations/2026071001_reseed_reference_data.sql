-- Re-seed reference data that was lost when the remote schema was
-- reconstructed from a schema-only baseline: RBAC permission grants,
-- countries, ranks, and vessel types. Every statement is idempotent
-- (guarded by where-not-exists), so this is safe to re-run.

begin;

insert into public.permissions (name)
select permission_name
from (
  values
    ('view_prospects'),
    ('create_prospects'),
    ('edit_prospects'),
    ('transition_prospects'),
    ('archive_prospects'),
    ('delete_prospects'),
    ('send_prospect_invites'),
    ('view_prospect_notes'),
    ('edit_prospect_notes'),
    ('view_requirements'),
    ('create_requirements'),
    ('edit_requirements'),
    ('transition_requirements'),
    ('edit_requirement_owner'),
    ('edit_junction_status'),
    ('withdraw_junctions'),
    ('view_audit_log'),
    ('export_csv'),
    ('export_pdf'),
    ('manage_runtime_settings')
) as seeded_permissions(permission_name)
where not exists (
  select 1
  from public.permissions existing
  where existing.name = seeded_permissions.permission_name
);

with role_permission_matrix(role_name, permission_name) as (
  values
    ('Master Recruiter', 'view_prospects'),
    ('Master Recruiter', 'create_prospects'),
    ('Master Recruiter', 'edit_prospects'),
    ('Master Recruiter', 'transition_prospects'),
    ('Master Recruiter', 'archive_prospects'),
    ('Master Recruiter', 'delete_prospects'),
    ('Master Recruiter', 'send_prospect_invites'),
    ('Master Recruiter', 'view_prospect_notes'),
    ('Master Recruiter', 'edit_prospect_notes'),
    ('Master Recruiter', 'view_requirements'),
    ('Master Recruiter', 'create_requirements'),
    ('Master Recruiter', 'edit_requirements'),
    ('Master Recruiter', 'transition_requirements'),
    ('Master Recruiter', 'edit_requirement_owner'),
    ('Master Recruiter', 'edit_junction_status'),
    ('Master Recruiter', 'withdraw_junctions'),
    ('Master Recruiter', 'view_audit_log'),
    ('Master Recruiter', 'export_csv'),
    ('Master Recruiter', 'export_pdf'),
    ('Master Recruiter', 'manage_runtime_settings'),
    ('Recruiter', 'view_prospects'),
    ('Recruiter', 'create_prospects'),
    ('Recruiter', 'edit_prospects'),
    ('Recruiter', 'transition_prospects'),
    ('Recruiter', 'archive_prospects'),
    ('Recruiter', 'send_prospect_invites'),
    ('Recruiter', 'view_prospect_notes'),
    ('Recruiter', 'edit_prospect_notes'),
    ('Recruiter', 'view_requirements'),
    ('Recruiter', 'create_requirements'),
    ('Recruiter', 'edit_requirements'),
    ('Recruiter', 'transition_requirements'),
    ('Recruiter', 'edit_requirement_owner'),
    ('Recruiter', 'edit_junction_status'),
    ('Recruiter', 'withdraw_junctions'),
    ('Coordinator', 'view_prospects'),
    ('Coordinator', 'view_requirements')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from role_permission_matrix rpm
join public.roles r
  on r.name = rpm.role_name
join public.permissions p
  on p.name = rpm.permission_name
where not exists (
  select 1
  from public.role_permissions existing
  where existing.role_id = r.id
    and existing.permission_id = p.id
);


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

commit;
