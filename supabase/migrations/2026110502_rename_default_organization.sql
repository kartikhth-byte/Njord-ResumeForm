-- Single-organization embed pilot. Independent of recruitment case v1.
-- Same organization shape/id as that future migration; no case tables or workflow changes.
create table if not exists public.organizations (
    id uuid primary key default gen_random_uuid(), name text not null,
    slug text not null unique, created_at timestamptz not null default now()
);
insert into public.organizations (id, name, slug)
values ('00000000-0000-4000-8000-0000000000a1', 'Njordships', 'default')
on conflict (id) do nothing;
update public.organizations set name = 'Njordships'
where id = '00000000-0000-4000-8000-0000000000a1' and name = 'Default organization';
alter table public.organizations enable row level security;
drop policy if exists organizations_read on public.organizations;
create policy organizations_read on public.organizations for select to authenticated
using (public.has_permission(auth.uid(), 'view_requirements'));
revoke all on table public.organizations from anon, authenticated;
grant select on table public.organizations to authenticated, service_role;
