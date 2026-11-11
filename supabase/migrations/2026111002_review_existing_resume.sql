-- Reviewed attachment of already searchable Needle sources. No Drive upload,
-- extraction, platform-storage claim or index event is created by this path.
begin;
-- Minted only by the authenticated server bridge after a fresh authority and
-- original-byte check. Never returned to the browser; consumed by the save.
create table public.existing_resume_save_receipts (
 id uuid primary key default gen_random_uuid(),
 evidence_id uuid not null references public.needle_resume_evidence(id),
 actor_id uuid not null,
 organization_id uuid not null,
 resume_id text not null,
 facts_revision text not null,
 reviewed_request jsonb not null,
 verified_at timestamptz not null,
 created_at timestamptz not null default now(),
 consumed_at timestamptz
);
alter table public.existing_resume_save_receipts enable row level security;
revoke all on public.existing_resume_save_receipts from public,anon,authenticated;
grant select,insert on public.existing_resume_save_receipts to service_role;
create table public.existing_resume_identity_reviews (
 id uuid primary key default gen_random_uuid(),
 evidence_id uuid not null references public.needle_resume_evidence(id),
 actor_id uuid not null,
 decision text not null check (decision in ('new','link')),
 candidate_id uuid not null references public.prospects(id),
 requirement_id uuid references public.requirements(id),
 reviewed_fields jsonb not null,
 receipt_id uuid not null references public.existing_resume_save_receipts(id),
 created_at timestamptz not null default now()
);
alter table public.existing_resume_identity_reviews enable row level security;
revoke all on public.existing_resume_identity_reviews from public,anon,authenticated;
grant select,insert on public.existing_resume_identity_reviews to service_role;

-- Existing-corpus evidence must not bypass final verification through the
-- older platform-review API. Upload evidence keeps the original workflow.
alter function public.review_platform_resume(uuid,uuid,text,jsonb,uuid,boolean,uuid,integer)
 rename to review_platform_resume_after_source_verification;
revoke all on function public.review_platform_resume_after_source_verification(uuid,uuid,text,jsonb,uuid,boolean,uuid,integer)
 from public,anon,authenticated;
create function public.review_platform_resume(p_version uuid,p_evidence uuid,p_decision text,p_fields jsonb,
 p_link uuid default null,p_confirm_new boolean default false,p_requirement uuid default null,p_requirement_version integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.needle_resume_evidence where id=p_evidence
   and actor_id=auth.uid() and organization_id=public.needle_pilot_organization_id()
   and source='holmes_upload') then raise exception 'fresh_source_verification_required';end if;
 return public.review_platform_resume_after_source_verification(p_version,p_evidence,p_decision,p_fields,
   p_link,p_confirm_new,p_requirement,p_requirement_version);
end $$;
revoke all on function public.review_platform_resume(uuid,uuid,text,jsonb,uuid,boolean,uuid,integer) from public,anon;
grant execute on function public.review_platform_resume(uuid,uuid,text,jsonb,uuid,boolean,uuid,integer) to authenticated;

create function public.review_existing_resume(p_evidence uuid,p_decision text,p_fields jsonb,
 p_link uuid default null,p_confirm_new boolean default false,p_requirement uuid default null,p_requirement_version integer default null,
 p_receipt uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.needle_resume_evidence; r public.needle_resume_registry; v uuid; result jsonb;
 receipt public.existing_resume_save_receipts;
begin
 if auth.uid() is null or not coalesce(public.has_permission(auth.uid(),'create_prospects'),false)
 or not coalesce(public.has_permission(auth.uid(),'view_prospects'),false)
 or (p_requirement is not null and not coalesce(public.has_permission(auth.uid(),'edit_junction_status'),false)) then
  raise exception 'permission_denied' using errcode='42501';
 end if;
 if p_decision is null or p_decision not in ('new','link') or
 (p_decision='link' and p_link is null) or (p_decision='new' and p_link is not null)
 or p_fields is null or jsonb_typeof(p_fields)<>'object' then raise exception 'identity_review_required';end if;
 if p_requirement is not null and p_requirement_version is null then raise exception 'requirement_version_required';end if;
 select * into e from public.needle_resume_evidence where id=p_evidence and actor_id=auth.uid()
 and organization_id=public.needle_pilot_organization_id() and source='needle_search';
 if not found then raise exception 'verified_resume_required';end if;
 if e.created_at < now()-interval '24 hours' then raise exception 'resume_review_expired_refresh_matching';end if;
 select * into receipt from public.existing_resume_save_receipts where id=p_receipt for update;
 if not found or receipt.consumed_at is not null
 or receipt.created_at < clock_timestamp()-interval '60 seconds'
 or receipt.verified_at < clock_timestamp()-interval '60 seconds'
 or receipt.verified_at > clock_timestamp()+interval '5 seconds'
 or receipt.actor_id is distinct from auth.uid() or receipt.evidence_id is distinct from e.id
 or receipt.organization_id is distinct from e.organization_id or receipt.resume_id is distinct from e.resume_id
 or receipt.facts_revision is distinct from e.facts_revision
 or receipt.reviewed_request is distinct from jsonb_build_object(
  'p_evidence',p_evidence,'p_decision',p_decision,'p_fields',p_fields,'p_link',p_link,
  'p_confirm_new',p_confirm_new,'p_requirement',p_requirement,'p_requirement_version',p_requirement_version)
 then raise exception 'fresh_source_verification_required';end if;
 select * into r from public.needle_resume_registry where organization_id=e.organization_id and resume_id=e.resume_id;
 if not found or not r.original_available or r.status<>'ready' or e.facts_revision is null
 or r.facts_revision is distinct from e.facts_revision then raise exception 'resume_source_changed_refresh_matching';end if;
 -- A canonical platform version keeps its existing identity/audit rules.
 select rv.id into v from public.resume_versions rv join public.resume_files rf on rf.id=rv.file_id
 where rv.organization_id=e.organization_id and rf.organization_id=e.organization_id and rf.content_hash=e.resume_id;
 if v is not null then
  result:=public.review_platform_resume_after_source_verification(v,p_evidence,p_decision,p_fields,p_link,p_confirm_new,p_requirement,p_requirement_version);
 else
  -- Owner-only helper retains actor/org isolation, duplicate locks, contact
  -- validation, no OCR overwrite, open/versioned requirement and idempotent case.
  result:=public.save_resume_candidate(p_evidence,p_fields,p_requirement,p_link,p_confirm_new,p_requirement_version);
 end if;
 update public.existing_resume_save_receipts set consumed_at=clock_timestamp() where id=receipt.id;
 insert into public.existing_resume_identity_reviews(evidence_id,actor_id,decision,candidate_id,requirement_id,reviewed_fields,receipt_id)
 values(e.id,auth.uid(),p_decision,(result->>'prospect_id')::uuid,p_requirement,p_fields,receipt.id);
 return result;
end $$;
revoke all on function public.review_existing_resume(uuid,text,jsonb,uuid,boolean,uuid,integer,uuid) from public,anon;
grant execute on function public.review_existing_resume(uuid,text,jsonb,uuid,boolean,uuid,integer,uuid) to authenticated;
commit;
