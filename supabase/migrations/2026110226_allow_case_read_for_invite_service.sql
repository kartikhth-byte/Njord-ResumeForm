-- The applicant email functions use the service role to verify that the
-- prospect has a post-interview case. Case rows remain unavailable to anon.
begin;

grant select on public.recruitment_cases to service_role;

commit;
