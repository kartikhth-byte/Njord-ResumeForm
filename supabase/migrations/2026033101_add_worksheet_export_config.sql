begin;

create table if not exists public.worksheet_customers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.worksheet_templates (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.worksheet_customers(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  normalized_storage_path text,
  source_extension text not null default 'xls',
  is_active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  uploaded_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.worksheet_mappings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.worksheet_customers(id) on delete cascade,
  section_key text not null,
  section_label text not null,
  field_key text not null,
  field_label text not null,
  source_path text not null default '',
  sheet_name text not null default 'Main',
  cell_ref text not null default '',
  transform text not null default 'text',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint worksheet_mappings_customer_field_unique unique (customer_id, field_key)
);

alter table public.worksheet_customers enable row level security;
alter table public.worksheet_templates enable row level security;
alter table public.worksheet_mappings enable row level security;

grant select, insert, update on public.worksheet_customers to authenticated;
grant select, insert, update on public.worksheet_templates to authenticated;
grant select, insert, update on public.worksheet_mappings to authenticated;

create policy "worksheet_customers_read_for_recruiters"
on public.worksheet_customers
for select
to authenticated
using (
  public.has_permission(auth.uid(), 'view_applications')
  or public.has_permission(auth.uid(), 'export_data')
  or public.has_permission(auth.uid(), 'manage_settings')
);

create policy "worksheet_customers_manage"
on public.worksheet_customers
for all
to authenticated
using (public.has_permission(auth.uid(), 'manage_settings'))
with check (public.has_permission(auth.uid(), 'manage_settings'));

create policy "worksheet_templates_read_for_recruiters"
on public.worksheet_templates
for select
to authenticated
using (
  public.has_permission(auth.uid(), 'view_applications')
  or public.has_permission(auth.uid(), 'export_data')
  or public.has_permission(auth.uid(), 'manage_settings')
);

create policy "worksheet_templates_manage"
on public.worksheet_templates
for all
to authenticated
using (public.has_permission(auth.uid(), 'manage_settings'))
with check (public.has_permission(auth.uid(), 'manage_settings'));

create policy "worksheet_mappings_read_manage_settings"
on public.worksheet_mappings
for select
to authenticated
using (public.has_permission(auth.uid(), 'manage_settings'));

create policy "worksheet_mappings_manage"
on public.worksheet_mappings
for all
to authenticated
using (public.has_permission(auth.uid(), 'manage_settings'))
with check (public.has_permission(auth.uid(), 'manage_settings'));

create or replace function public.touch_worksheet_config_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists worksheet_customers_touch_updated_at on public.worksheet_customers;
create trigger worksheet_customers_touch_updated_at
before update on public.worksheet_customers
for each row
execute function public.touch_worksheet_config_updated_at();

drop trigger if exists worksheet_templates_touch_updated_at on public.worksheet_templates;
create trigger worksheet_templates_touch_updated_at
before update on public.worksheet_templates
for each row
execute function public.touch_worksheet_config_updated_at();

drop trigger if exists worksheet_mappings_touch_updated_at on public.worksheet_mappings;
create trigger worksheet_mappings_touch_updated_at
before update on public.worksheet_mappings
for each row
execute function public.touch_worksheet_config_updated_at();

insert into public.worksheet_customers (slug, name)
values
  ('cma-cgm', 'CMA CGM'),
  ('sonangol', 'Sonangol')
on conflict (slug) do update
set name = excluded.name,
    is_active = true,
    updated_at = now();

insert into storage.buckets (id, name, public)
values ('worksheet-templates', 'worksheet-templates', false)
on conflict (id) do nothing;

create policy "worksheet_templates_bucket_read_manage_settings"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'worksheet-templates'
  and public.has_permission(auth.uid(), 'manage_settings')
);

create policy "worksheet_templates_bucket_insert_manage_settings"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'worksheet-templates'
  and public.has_permission(auth.uid(), 'manage_settings')
);

create policy "worksheet_templates_bucket_update_manage_settings"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'worksheet-templates'
  and public.has_permission(auth.uid(), 'manage_settings')
)
with check (
  bucket_id = 'worksheet-templates'
  and public.has_permission(auth.uid(), 'manage_settings')
);

create policy "worksheet_templates_bucket_delete_manage_settings"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'worksheet-templates'
  and public.has_permission(auth.uid(), 'manage_settings')
);

commit;
