begin;

-- An event must identify its typed entity, but may also carry related IDs so
-- prospect and requirement activity can show the same junction event.
alter table public.audit_log
  drop constraint if exists audit_log_typed_fk_check;

alter table public.audit_log
  add constraint audit_log_typed_fk_check
  check (
    case entity_type
      when 'prospect' then prospect_id is not null
      when 'requirement' then requirement_id is not null
      when 'prospect_requirement' then prospect_requirement_id is not null
      when 'application' then application_id is not null
      when 'export' then num_nonnulls(prospect_id, requirement_id, prospect_requirement_id, application_id) = 0
      else false
    end
  ) not valid;

commit;
