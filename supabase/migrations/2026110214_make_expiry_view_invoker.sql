-- The legacy expiry view was owner-run and granted to anon, so it could
-- bypass application RLS even though the underlying tables are private.
-- Leave its legacy extraction logic untouched; 0208 changes that separately.
begin;

do $$
begin
  if to_regclass('public.v_expiring_documents') is null
     or to_regclass('public.applications') is null
     or to_regclass('public.application_data') is null then
    raise exception 'make_expiry_view_invoker: missing required view or table';
  end if;
end;
$$;

alter view public.v_expiring_documents set (security_invoker = true);
revoke all on public.v_expiring_documents from public, anon;
grant select on public.v_expiring_documents to authenticated, service_role;

do $$
begin
  if has_table_privilege('anon', 'public.v_expiring_documents', 'select') then
    raise exception 'make_expiry_view_invoker: anon still has SELECT';
  end if;

  if not exists (
    select 1 from pg_class c
    where c.oid = 'public.v_expiring_documents'::regclass
      and c.reloptions @> array['security_invoker=true']::text[]
  ) then
    raise exception 'make_expiry_view_invoker: view is not security invoker';
  end if;
end;
$$;

commit;
