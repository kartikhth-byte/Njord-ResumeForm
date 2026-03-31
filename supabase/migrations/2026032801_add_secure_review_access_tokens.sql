begin;

alter table public.applications
  add column if not exists review_access_token_hash text,
  add column if not exists review_access_token_expires_at timestamptz;

create index if not exists applications_review_access_token_hash_idx
  on public.applications (review_access_token_hash);

commit;
