-- The June typed audit events coexist with the older audit_log.action NOT NULL
-- column. Both write_audit_event() and service-role Edge Functions omit action,
-- so their inserts fail unless it is derived from the typed event.

begin;

do $$
begin
  if to_regclass('public.audit_log') is null or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'audit_log'
      and column_name = 'event_type'
  ) then
    raise exception 'fill_audit_log_action: audit_log with event_type is required';
  end if;
end;
$$;

create or replace function public.fill_audit_log_action()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if new.action is null and new.event_type is not null then
    new.action := new.event_type;
  end if;

  return new;
end;
$function$;

revoke all on function public.fill_audit_log_action() from public, anon, authenticated;

create or replace trigger audit_log_fill_action_before_insert
before insert on public.audit_log
for each row execute function public.fill_audit_log_action();

commit;
