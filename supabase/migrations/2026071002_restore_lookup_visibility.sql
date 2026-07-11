-- The remote schema baseline left row level security enabled on the lookup
-- catalogs with no read policies, so authenticated clients received zero rows
-- (empty rank / vessel type / nationality dropdowns) even though the seed
-- data exists. The catalogs were always meant to be readable via plain
-- grants (see 2026060302: `grant select ... to authenticated`), so restore
-- that state. These tables hold no sensitive data.

begin;

alter table public.countries disable row level security;
alter table public.ranks disable row level security;
alter table public.vessel_types disable row level security;

commit;
