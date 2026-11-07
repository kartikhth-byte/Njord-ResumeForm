-- Storage/OCR failure recovery is independent of candidate identity. Do not
-- dispatch a newly stored original to Needle until its identity is reviewed.
begin;
create or replace function public.finish_platform_resume(p_file uuid,p_lease uuid,p_drive_id text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.resume_files;v uuid;
begin
 if nullif(trim(p_drive_id),'') is null then raise exception 'drive_original_required';end if;
 select * into f from public.resume_files where id=p_file for update;
 if not found then raise exception 'resume_not_found';end if;
 if f.storage_status='stored' then
  if f.drive_file_id<>p_drive_id then raise exception 'immutable_original_conflict';end if;
 elsif f.lease_token is distinct from p_lease or f.lease_until is null or f.lease_until<now() then raise exception 'resume_lease_expired';
 else update public.resume_files set drive_file_id=p_drive_id,storage_status='stored',lease_until=null,lease_token=null where id=p_file;
 end if;
 select id into v from public.resume_versions where file_id=p_file;
 return v;
end $$;
alter function public.review_platform_resume(uuid,uuid,text,jsonb,uuid,boolean,uuid,integer) rename to review_platform_resume_before_registration_gate;
revoke all on function public.review_platform_resume_before_registration_gate(uuid,uuid,text,jsonb,uuid,boolean,uuid,integer) from public,anon,authenticated;
create function public.review_platform_resume(p_version uuid,p_evidence uuid,p_decision text,p_fields jsonb,
 p_link uuid default null,p_confirm_new boolean default false,p_requirement uuid default null,p_requirement_version integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 result:=public.review_platform_resume_before_registration_gate(p_version,p_evidence,p_decision,p_fields,p_link,p_confirm_new,p_requirement,p_requirement_version);
 if p_decision<>'hold' then
  insert into public.resume_index_events(version_id,organization_id)
  select id,organization_id from public.resume_versions where id=p_version and identity_status='linked' on conflict do nothing;
 end if;
 return result;
end $$;
revoke all on function public.review_platform_resume(uuid,uuid,text,jsonb,uuid,boolean,uuid,integer) from public,anon;
grant execute on function public.review_platform_resume(uuid,uuid,text,jsonb,uuid,boolean,uuid,integer) to authenticated;
-- Remove only undelivered transient queue rows from the earlier local candidate.
-- Delivered history is retained. This changes no originals or identity reviews.
delete from public.resume_index_events e using public.resume_versions v where e.version_id=v.id and e.status='pending' and v.identity_status<>'linked';
commit;
