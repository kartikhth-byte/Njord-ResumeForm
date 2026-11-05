-- Platform operator flag.
-- Design: docs/needle-in-holmes-design.md section 5.
--
-- Operator is a platform flag, not a role row: Holmes takes a user's main role
-- from the first user_roles row, so an Operator role row would make the role
-- (and the Needle role mapping) depend on row order. Operators reach the
-- /operator console (platform settings, and later Needle's admin pages). The
-- flag grants no recruiter permissions.
--
-- Rows are added by hand (SQL editor), for example:
--   insert into public.platform_operators (user_id, note)
--   select id, 'platform operator' from auth.users where email = '<operator email>';

create table if not exists public.platform_operators (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

alter table public.platform_operators enable row level security;
revoke all on table public.platform_operators from anon, authenticated;
grant select on table public.platform_operators to authenticated, service_role;

drop policy if exists platform_operators_self_read on public.platform_operators;
create policy platform_operators_self_read on public.platform_operators
for select to authenticated
using (user_id = auth.uid());

-- The caller's own flag only (no argument, so it cannot probe other users).
create or replace function public.is_platform_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_operators where user_id = auth.uid()
  )
$$;

revoke all on function public.is_platform_operator() from public, anon;
grant execute on function public.is_platform_operator() to authenticated;
