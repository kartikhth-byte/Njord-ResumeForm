begin;

create table if not exists public.runtime_settings (
  setting_key text primary key,
  setting_value text not null default '',
  is_secret boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.runtime_settings enable row level security;

grant select, insert, update on public.runtime_settings to authenticated;

create policy "runtime_settings_manage_select"
on public.runtime_settings
for select
to authenticated
using (public.has_permission(auth.uid(), 'manage_settings'));

create policy "runtime_settings_manage_insert"
on public.runtime_settings
for insert
to authenticated
with check (public.has_permission(auth.uid(), 'manage_settings'));

create policy "runtime_settings_manage_update"
on public.runtime_settings
for update
to authenticated
using (public.has_permission(auth.uid(), 'manage_settings'))
with check (public.has_permission(auth.uid(), 'manage_settings'));

create or replace function public.touch_runtime_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists runtime_settings_touch_updated_at on public.runtime_settings;

create trigger runtime_settings_touch_updated_at
before update on public.runtime_settings
for each row
execute function public.touch_runtime_settings_updated_at();

commit;
