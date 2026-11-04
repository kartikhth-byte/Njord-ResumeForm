-- These two legacy tables used unconditional authenticated policies. Keep
-- existing recruiter-side workflows, but prevent applicant API writes and
-- cross-user reminder reads.
begin;

do $$
begin
  if to_regclass('public.application_embeddings') is null
     or to_regclass('public.scheduled_reminders') is null
     or to_regclass('public.scheduled_events') is null
     or to_regprocedure('public.is_recruiter(uuid)') is null then
    raise exception 'guard_embeddings_and_reminders: missing required object';
  end if;
end;
$$;

drop policy if exists "System can insert embeddings" on public.application_embeddings;
drop policy if exists "System can update embeddings" on public.application_embeddings;
drop policy if exists application_embeddings_recruiter_insert on public.application_embeddings;
drop policy if exists application_embeddings_recruiter_update on public.application_embeddings;

create policy application_embeddings_recruiter_insert
on public.application_embeddings for insert to authenticated
with check (public.is_recruiter(auth.uid()));

create policy application_embeddings_recruiter_update
on public.application_embeddings for update to authenticated
using (public.is_recruiter(auth.uid()))
with check (public.is_recruiter(auth.uid()));

drop policy if exists "Authenticated users can insert reminders" on public.scheduled_reminders;
drop policy if exists "Users can view all reminders" on public.scheduled_reminders;
drop policy if exists scheduled_reminders_recruiter_insert on public.scheduled_reminders;
drop policy if exists scheduled_reminders_recruiter_read on public.scheduled_reminders;

create policy scheduled_reminders_recruiter_insert
on public.scheduled_reminders for insert to authenticated
with check (
  public.is_recruiter(auth.uid())
  and exists (
    select 1 from public.scheduled_events event
    where event.id = event_id
      and event.scheduled_by = auth.uid()
  )
);

create policy scheduled_reminders_recruiter_read
on public.scheduled_reminders for select to authenticated
using (public.is_recruiter(auth.uid()));

commit;
