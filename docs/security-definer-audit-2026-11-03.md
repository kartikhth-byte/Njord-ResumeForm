# Public SECURITY DEFINER Function Audit (2026-11-03)

## Verified rollout

`2026110209_revoke_all_unscoped_definer_overloads.sql` was applied to Holmes
staging (`dwslhetniuzpyuspuomy`) and production (`btbqdviuqcpauojmorvx`).
Each dry run listed only `0209`; subsequent dry runs reported up to date.
The 10 PGlite checks passed. Live catalog queries on both projects found three
existing overloads: `get_upcoming_events(integer)`,
`get_upcoming_events(uuid,integer)`, and `get_expiring_certificates(integer)`.
For all three, `anon` and `authenticated` EXECUTE are false and `service_role`
EXECUTE is true. `0208` remains unapplied; `0207` is staging-only.
The exact `0209` migration and test are on pushed `main` at `e79afab`.

On 2026-11-04, `2026110210_restrict_unscoped_definer_helpers.sql` was applied
to staging and production from isolated checkouts. Each dry run listed only
`0210`; both subsequent dry runs reported up to date. All 12 PGlite checks
passed. Live catalog checks on both projects confirmed the five targeted
functions deny `anon` and `authenticated` and retain `service_role` EXECUTE.
The migration and test are on pushed `main` at `8448976`. No expiry data was
changed and `0208` remains unapplied.

## Remaining inventory

The production catalog query below returned 42 `public` SECURITY DEFINER
functions executable by `anon` or `authenticated` after `0209`, before `0210`.
This is a historical inventory, not a claim that every function is exploitable.
Only three were anonymous-executable; all 42 were authenticated-executable.
`0210` removed direct authenticated access from five entries below, leaving
37 in this inventory callable by an ordinary signed-in user.

```sql
select p.oid::regprocedure::text as fn,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authed
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.prosecdef
  and (has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute'))
order by 1;
```

Anonymous and authenticated:

- `get_application_for_review(text,text)` (intentionally token-gated review link)
- `has_permission(uuid,text)` (used by RLS policies)
- `user_has_permission(uuid,text)` (legacy permission probe; review necessity)

Authenticated only:

- `add_prospect_note(uuid,text,text,boolean,boolean,uuid)`
- `add_requirement_remark(uuid,text,text,boolean,boolean,uuid)`
- `allocate_requirement_identifier(text)`
- `attach_existing_prospect_to_requirement(uuid,uuid,uuid)`
- `bulk_withdraw_junctions(uuid[],text,integer[],uuid)`
- `check_permission(uuid,text)`
- `cleanup_old_expiry_records()`
- `compute_should_prompt_close(uuid)`
- `create_prospect_with_requirement(uuid,text,date,integer,text,boolean,text,text,uuid,text,uuid)`
- `current_recruiter_role_name(uuid)`
- `edit_prospect_note(uuid,text,boolean,uuid)`
- `edit_requirement_remark(uuid,text,boolean,uuid)`
- `enforce_coordinator_restrictions()`
- `extract_expiries_for_application_sql(uuid)`
- `extract_expiries_for_application(uuid)`
- `get_cross_entity_audit(integer)`
- `get_documents_needing_warnings()`
- `get_expiring_documents_summary()`
- `get_prospect_activity(uuid,integer)`
- `get_prospect_detail(uuid)`
- `get_recent_exports(integer)`
- `get_requirement_activity(uuid,integer)`
- `get_requirement_detail(uuid)`
- `get_team_stats()`
- `get_user_permissions(uuid)`
- `get_user_role(uuid)`
- `handle_new_user()`
- `is_master_recruiter_profile(uuid)`
- `is_recruiter_profile(uuid)`
- `is_recruiter(uuid)`
- `log_status_change()`
- `prevent_multiple_active_applications()`
- `record_application_status_change()`
- `transfer_requirement_owner(uuid,uuid,integer,uuid)`
- `transition_junction_status(uuid,text,integer,text,text,text,uuid)`
- `transition_requirement_status(uuid,text,integer,text,text,text,uuid)`
- `trigger_extract_expiries()`
- `update_prospect_email_and_clear_bounce(uuid,text,text)`
- `write_audit_event(text,text,text,uuid,text,text,uuid,uuid,uuid,uuid,uuid,jsonb)`

## Findings and remaining work

- **Closed by `0210`, applicant contact data:** `get_documents_needing_warnings()` had
  no caller check and returns names, emails, and document-expiry details for
  submitted applicants with expired or soon-expiring documents. It is callable
  by any authenticated user. Only the `process-expiry-warnings` service-role
  function calls it in repo code. Direct client EXECUTE is now revoked.
- **Closed by `0210`, audit integrity:** `write_audit_event(...)` accepted
  caller-supplied actor/entity/payload fields without a caller check. Direct
  client EXECUTE is now revoked; service-role and trusted definer calls retain
  access.
- **Closed by `0210`, unscoped mutation:** `cleanup_old_expiry_records()` deletes expiry
  rows, and `extract_expiries_for_application_sql(uuid)` deletes/reinserts
  expiry rows for an arbitrary application ID. Neither checks the caller.
  `extract_expiries_for_application(uuid)` also accepts arbitrary application
  IDs and invokes an Edge Function using a configured service key. No app or
  Edge Function source calls these three directly, and no live cron job calls
  them. Direct client EXECUTE is now revoked.
- **Lower-severity data/metadata exposure:** `get_expiring_documents_summary()`
  returns global counts; `get_user_role(uuid)` and `get_user_permissions(uuid)`
  accept any user ID without checking the caller. Review their direct grants
  without breaking internal RPC calls.
- **Sequence integrity:** `allocate_requirement_identifier(text)` increments
  a shared counter with no caller check. It is invoked by the ordinary
  `prepare_requirement_row()` trigger during recruiter requirement creation,
  so revoking authenticated EXECUTE without changing that call path would
  break inserts. Add a recruiter permission check or change the trigger
  execution model, with a regression test.

The remaining functions include trigger-only helpers and recruiter RPCs.
Inspect each live definition and its call path before tightening grants;
being SECURITY DEFINER plus executable is not by itself evidence of a leak.
Do not apply `0208` merely to patch the warning RPC: it has separate data and
notification behavior that needs its own staging review.
