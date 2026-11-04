-- Recruiter-profile identity is not sufficient to edit the application workflow:
-- Coordinators have that profile type but only read permissions.
begin;

do $$
begin
  if to_regprocedure('public.has_permission(uuid,text)') is null
     or to_regprocedure('public.is_recruiter(uuid)') is null then
    raise exception 'application workflow permission helpers are missing';
  end if;
end $$;

-- Restrictive policies are ANDed with every existing permissive policy. This
-- closes older profile-based write policies without changing applicant drafts.
create policy applications_coordinator_write_gate on public.applications
  as restrictive for insert to authenticated
  with check (not public.is_recruiter(auth.uid())
              or public.has_permission(auth.uid(), 'edit_junction_status'));
create policy applications_coordinator_update_gate on public.applications
  as restrictive for update to authenticated
  using (not public.is_recruiter(auth.uid())
         or public.has_permission(auth.uid(), 'edit_junction_status'))
  with check (not public.is_recruiter(auth.uid())
              or public.has_permission(auth.uid(), 'edit_junction_status'));
create policy applications_coordinator_delete_gate on public.applications
  as restrictive for delete to authenticated
  using (not public.is_recruiter(auth.uid())
         or public.has_permission(auth.uid(), 'edit_junction_status'));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'scheduled_events', 'event_participants', 'event_history',
    'scheduled_reminders', 'application_embeddings',
    'application_status_history_legacy'
  ] loop
    execute format(
      'create policy coordinator_insert_gate on public.%I as restrictive for insert to authenticated with check (public.has_permission(auth.uid(), %L))',
      table_name, 'edit_junction_status'
    );
    execute format(
      'create policy coordinator_update_gate on public.%I as restrictive for update to authenticated using (public.has_permission(auth.uid(), %L)) with check (public.has_permission(auth.uid(), %L))',
      table_name, 'edit_junction_status', 'edit_junction_status'
    );
    execute format(
      'create policy coordinator_delete_gate on public.%I as restrictive for delete to authenticated using (public.has_permission(auth.uid(), %L))',
      table_name, 'edit_junction_status'
    );
  end loop;
end $$;

create policy offer_letters_coordinator_insert_gate on storage.objects
  as restrictive for insert to authenticated
  with check (bucket_id <> 'offer-letters'
              or public.has_permission(auth.uid(), 'edit_junction_status'));
create policy offer_letters_coordinator_update_gate on storage.objects
  as restrictive for update to authenticated
  using (bucket_id <> 'offer-letters'
         or public.has_permission(auth.uid(), 'edit_junction_status'))
  with check (bucket_id <> 'offer-letters'
              or public.has_permission(auth.uid(), 'edit_junction_status'));
create policy offer_letters_coordinator_delete_gate on storage.objects
  as restrictive for delete to authenticated
  using (bucket_id <> 'offer-letters'
         or public.has_permission(auth.uid(), 'edit_junction_status'));

commit;
