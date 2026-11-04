-- Applicant ownership must not turn a recruiter-profile Coordinator into an
-- editor, even if that account owns an old draft or a photo storage prefix.
begin;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['application_data', 'application_photos'] loop
    execute format(
      'create policy coordinator_insert_gate on public.%I as restrictive for insert to authenticated with check (not public.is_recruiter(auth.uid()) or public.has_permission(auth.uid(), %L))',
      table_name, 'edit_junction_status'
    );
    execute format(
      'create policy coordinator_update_gate on public.%I as restrictive for update to authenticated using (not public.is_recruiter(auth.uid()) or public.has_permission(auth.uid(), %L)) with check (not public.is_recruiter(auth.uid()) or public.has_permission(auth.uid(), %L))',
      table_name, 'edit_junction_status', 'edit_junction_status'
    );
    execute format(
      'create policy coordinator_delete_gate on public.%I as restrictive for delete to authenticated using (not public.is_recruiter(auth.uid()) or public.has_permission(auth.uid(), %L))',
      table_name, 'edit_junction_status'
    );
  end loop;
end $$;

create policy application_photos_coordinator_insert_gate on storage.objects
  as restrictive for insert to authenticated
  with check (bucket_id <> 'application-photos'
              or not public.is_recruiter(auth.uid())
              or public.has_permission(auth.uid(), 'edit_junction_status'));
create policy application_photos_coordinator_update_gate on storage.objects
  as restrictive for update to authenticated
  using (bucket_id <> 'application-photos'
         or not public.is_recruiter(auth.uid())
         or public.has_permission(auth.uid(), 'edit_junction_status'))
  with check (bucket_id <> 'application-photos'
              or not public.is_recruiter(auth.uid())
              or public.has_permission(auth.uid(), 'edit_junction_status'));
create policy application_photos_coordinator_delete_gate on storage.objects
  as restrictive for delete to authenticated
  using (bucket_id <> 'application-photos'
         or not public.is_recruiter(auth.uid())
         or public.has_permission(auth.uid(), 'edit_junction_status'));

commit;
