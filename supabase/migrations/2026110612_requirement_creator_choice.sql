-- Preserve the Master Recruiter's existing "logged by" choice without trusting
-- client ownership on edits. The complete save remains one transaction.
begin;
create function public.save_platform_requirement_for_recruiter(p_fields jsonb,p_id uuid default null,p_expected_version integer default null,p_correction_reason text default null,p_logged_by uuid default null)
returns public.requirements language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.requirements;actor uuid:=auth.uid();chosen uuid:=coalesce(p_logged_by,auth.uid());
begin
 if actor is null then raise exception 'permission_denied' using errcode='42501';end if;
 if p_id is null and chosen<>actor then
  if not public.is_master_recruiter_profile(actor) or not public.is_recruiter_profile(chosen) then raise exception 'permission_denied' using errcode='42501';end if;
 end if;
 r:=public.save_platform_requirement(p_fields,p_id,p_expected_version,p_correction_reason);
 if p_id is null and chosen<>actor then
  update public.requirements set owner_recruiter_id=chosen,created_by_recruiter_id=chosen where id=r.id returning * into r;
 end if;
 return r;
end $$;
revoke all on function public.save_platform_requirement_for_recruiter(jsonb,uuid,integer,text,uuid) from public,anon;
grant execute on function public.save_platform_requirement_for_recruiter(jsonb,uuid,integer,text,uuid) to authenticated;
commit;
