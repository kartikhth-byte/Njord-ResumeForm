-- Redacted operator ledger; secret values and resume contents are never recorded.
begin;
create table public.platform_operation_events (
 id bigint generated always as identity primary key,
 category text not null check(category in ('settings','account','support','edge_error','job')),
 action text not null, actor_id uuid, target_id uuid,
 status text not null check(status in ('started','succeeded','failed')),
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
alter table public.platform_operation_events enable row level security;
revoke all on public.platform_operation_events from anon,authenticated;
grant all on public.platform_operation_events to service_role;
grant usage on sequence public.platform_operation_events_id_seq to service_role;
create policy operator_event_read on public.platform_operation_events for select to authenticated
 using(public.is_platform_operator());
grant select on public.platform_operation_events to authenticated;
create index platform_operation_events_recent on public.platform_operation_events(created_at desc);

-- Audit settings changes in the same transaction; no old/new secret values.
create or replace function public.audit_platform_setting_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' or (new.setting_value,new.is_secret) is distinct from (old.setting_value,old.is_secret) then
   insert into public.platform_operation_events(category,action,actor_id,status,details)
   values('settings','setting_changed',new.updated_by,'succeeded',jsonb_build_object('key',new.setting_key,'configured',new.setting_value<>''));
 end if;
 return new;
end $$;
revoke all on function public.audit_platform_setting_change() from public,anon,authenticated;
create trigger runtime_settings_audit after insert or update on public.runtime_settings
 for each row execute function public.audit_platform_setting_change();

create or replace function public.platform_operator_snapshot()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.is_platform_operator() then
   raise exception 'permission_denied' using errcode='42501';
 end if;
 select jsonb_build_object(
  'organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'slug',slug)),'[]'::jsonb) from public.organizations where id=public.needle_pilot_organization_id()),
  'users',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'email',u.email,'banned_until',u.banned_until,
    'operator',exists(select 1 from public.platform_operators op where op.user_id=p.id),
    'roles',(select coalesce(jsonb_agg(r.name),'[]'::jsonb) from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=p.id))),'[]'::jsonb)
    from public.profiles p join auth.users u on u.id=p.id where p.user_type='recruiter'),
  'email_events',(select coalesce(jsonb_agg(row),'[]'::jsonb) from (select event_type,count(*)::int as count,max(processed_at) latest from public.prospect_email_webhook_events where processed_at>now()-interval '30 days' group by event_type) row),
  'events',(select coalesce(jsonb_agg(row),'[]'::jsonb) from (select category,action,actor_id,target_id,status,details,created_at from public.platform_operation_events order by created_at desc limit 100) row),
  'legacy_audit',(select coalesce(jsonb_agg(row),'[]'::jsonb) from (select entity_type,event_type,actor_user_id,created_at from public.audit_log order by created_at desc limit 50) row)
 ) into result;
 return result;
end $$;
revoke all on function public.platform_operator_snapshot() from public,anon;
grant execute on function public.platform_operator_snapshot() to authenticated;
-- Bans take effect at the permission boundary even before an older access
-- JWT expires. Service-role maintenance preserves its existing behavior.
create or replace function public.has_permission(user_uuid uuid,permission_name text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.role() is distinct from 'service_role' and user_uuid is distinct from auth.uid() then return false; end if;
 if exists(select 1 from auth.users where id=user_uuid and banned_until>now()) then return false; end if;
 return public.check_permission(user_uuid,permission_name);
end $$;
commit;
