-- Browser table privileges predate platform identity review. Keep ordinary
-- authorized edits, but creation and source mutation must enter through the
-- owner-only save helper called by the authenticated review transaction.
begin;
create function public.guard_reviewed_candidate_write()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public,pg_temp as $$
begin
 if tg_op='INSERT' or (new.needle_resume_id,new.resume_evidence_id,new.resume_source)
    is distinct from (old.needle_resume_id,old.resume_evidence_id,old.resume_source) then
  -- current_user is the effective SQL role, not JWT claims or a caller-set GUC.
  -- A SECURITY DEFINER trigger here would erase that distinction.
  if current_user <> pg_get_userbyid((select relowner from pg_class where oid=tg_relid)) then
   raise exception 'platform_identity_review_required' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_reviewed_candidate_write() from public,anon,authenticated;
create trigger prospects_00_review_boundary before insert or update on public.prospects
 for each row execute function public.guard_reviewed_candidate_write();

-- Ship IDs describe historical identities. A referenced ship cannot be moved
-- behind existing requirements; correct each requirement to a reviewed ship
-- through the audited correction RPC instead. Renames/archive remain allowed.
create function public.guard_client_ship_identity()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if (new.id,new.organization_id) is distinct from (old.id,old.organization_id) then
  raise exception 'immutable_ship_identity' using errcode='23514';
 end if;
 if new.company_id is distinct from old.company_id and
    exists(select 1 from public.requirements where ship_id=old.id) then
  raise exception 'referenced_ship_requires_audited_requirement_correction' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function public.guard_client_ship_identity() from public,anon,authenticated;
create trigger client_ship_identity_guard before update on public.client_ships
 for each row execute function public.guard_client_ship_identity();
commit;
