-- 0211 made check_permission server-only, but older RLS policies still called
-- it as the authenticated user. Route those policies through the self-scoped
-- has_permission wrapper without restoring direct access to the old helper.
begin;

do $$
declare
  expected text[] := array[
    'scheduled_events:Create events with permission',
    'scheduled_events:Delete events with permission',
    'scheduled_events:Update events with permission',
    'scheduled_events:View events with permission',
    'user_roles:Manage team can assign roles',
    'user_roles:Manage team can delete roles',
    'user_roles:Manage team can update roles',
    'user_roles:Users can view roles'
  ];
  missing text[];
begin
  select array_agg(item)
  into missing
  from unnest(expected) item
  where not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public'
      and p.tablename || ':' || p.policyname = item
  );

  if missing is not null then
    raise exception 'permission policy repair: missing policies: %', array_to_string(missing, ', ');
  end if;
end $$;

alter policy "Create events with permission" on public.scheduled_events
  with check (public.has_permission(auth.uid(), 'schedule_interviews'));
alter policy "Delete events with permission" on public.scheduled_events
  using (public.has_permission(auth.uid(), 'schedule_interviews'));
alter policy "Update events with permission" on public.scheduled_events
  using (public.has_permission(auth.uid(), 'schedule_interviews'));
alter policy "View events with permission" on public.scheduled_events
  using (
    public.has_permission(auth.uid(), 'view_applications')
    or exists (
      select 1 from public.applications
      where applications.id = scheduled_events.application_id
        and applications.user_id = auth.uid()
    )
  );

alter policy "Manage team can assign roles" on public.user_roles
  with check (public.has_permission(auth.uid(), 'manage_team'));
alter policy "Manage team can delete roles" on public.user_roles
  using (public.has_permission(auth.uid(), 'manage_team'));
alter policy "Manage team can update roles" on public.user_roles
  using (public.has_permission(auth.uid(), 'manage_team'));
alter policy "Users can view roles" on public.user_roles
  using (
    user_id = auth.uid()
    or public.has_permission(auth.uid(), 'view_team')
  );

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and (qual ilike '%check_permission(%'
           or with_check ilike '%check_permission(%')
  ) then
    raise exception 'permission policy repair: direct check_permission call remains';
  end if;

  if has_function_privilege('anon', 'public.check_permission(uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.check_permission(uuid,text)', 'execute') then
    raise exception 'permission policy repair: check_permission became client-callable';
  end if;
end $$;

commit;
