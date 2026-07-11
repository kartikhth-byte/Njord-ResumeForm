-- The old-clone experiment that left the orphaned application_status_history
-- table ALSO left its trigger on public.applications. That trigger inserts
-- legacy columns (old_status / new_status), so after 2026071101 renamed the
-- legacy table aside, every status update fails with:
--   column "old_status" of relation "application_status_history" does not exist
-- and rolls back. Drop every trigger on applications whose function touches
-- application_status_history, except the current one
-- (applications_record_status_change). Unrelated triggers are untouched.

begin;

do $$
declare
  legacy record;
begin
  for legacy in
    select tg.tgname, p.oid as func_oid, p.proname
    from pg_trigger tg
    join pg_proc p on p.oid = tg.tgfoid
    where tg.tgrelid = 'public.applications'::regclass
      and not tg.tgisinternal
      and tg.tgname <> 'applications_record_status_change'
      and p.prosrc ilike '%application_status_history%'
  loop
    raise notice 'Dropping legacy status-history trigger % (function %)', legacy.tgname, legacy.proname;
    execute format('drop trigger if exists %I on public.applications', legacy.tgname);
  end loop;
end $$;

commit;
