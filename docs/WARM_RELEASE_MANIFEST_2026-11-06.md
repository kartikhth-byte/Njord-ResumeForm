# Warm/KPI release manifest — preparation checkpoint 2026-11-06

**Not approved for production.** Application source base: `2e11d4a`, plus the reviewed 0602/0603 follow-ups on
`codex/holmes-warm-integration`; production `main` was read back at
`21ac6a51ae58d8a5867966e3e83b72aaabdc127c`. Recheck both heads and the deployed
versions immediately before the final review. No force push or mass deployment.
This checkpoint is invalidated by a change to a listed handler or dependency.
The private machine manifest records SHA-256 for every listed SQL file and the
recursive local imports of each Function. Credentials are not part of it.

## Database (KT, after remaining gates and fresh backup verification)

Production project `btbqdviuqcpauojmorvx` only. The reviewed missing order is:

1. `2026110220_allow_related_audit_context.sql`
2. `2026110221_recruitment_case_v1.sql`
3. `2026110223_record_case_assessments.sql`
4. `2026110224_bind_applicant_claim_to_invite.sql`
5. `2026110225_gate_long_form_to_case_invite.sql`
6. `2026110226_allow_case_read_for_invite_service.sql`
7. `2026110227_close_filled_requirements_from_cases.sql`
8. `2026110601_version_case_requirement_closure.sql`
9. `2026110602_do_not_adopt_unlinked_applications_on_claim.sql`
10. `2026110603_authorize_case_transition_replay.sql`

Do not apply 0222 or 0228. Operator migrations 0501/0502 are already present;
do not replay them. Check the seeded organization instead of recreating it.
Staging has the listed migrations. Production has no case tables at this
checkpoint. KT subsequently confirmed all Holmes rows are test data and
authorized removing the legacy applications. A separate backed-up cleanup
removed 151 unlinked applications and 199 dependent rows while preserving
accounts, roles, prospects and configuration. No legacy login bridge is needed
for that removed test cohort. Migration 0602 prevents future invite claims from
implicitly adopting an unrelated/unlinked draft; 0224 remains unchanged.
Migration 0603 checks workflow permission before the SECURITY DEFINER retry
shortcut can return case data. It preserves permitted retries and withdraw-only
exit transitions. Applicant/read-only/null-target regression checks pass; the
independent reviewer closed this finding. Both follow-ups are on staging only.

## Edge Functions (proposed exact set, still subject to final review)

Each named deployment must include its local imports from this same candidate,
including `_shared/api-keys.ts`, runtime settings, CORS, branding and the
claim/access helpers where imported. The gateway setting is false only because
the protected user path independently authenticates and authorizes its caller.
Intended exceptions are the public rate-limited magic-link request, public-key
status/bootstrap in `create-recruiter` (bootstrap requires zero recruiter and
Master accounts), and the trusted service-role notification path in
`send-event-notification`. Preserve those code-enforced checks. Do not infer that
old versions of these handlers are safe with gateway verification off.

| Function | Recorded production version / gateway JWT | Staging version / gateway JWT |
| --- | --- | --- |
| `create-recruiter` | 38 / true | 5 / false |
| `send-prospect-invite` | 5 / true | 7 / false |
| `request-applicant-magic-link` | 7 / false | 7 / false |
| `send-application-emails` | 34 / true | 1 / false |
| `log-recruiter-export` | 5 / true | 1 / false |
| `schedule-event` | 25 / true | 6 / false |
| `send-event-notification` | 30 / true | 4 / false |
| `send-test-invitation` | 23 / true | 5 / false |
| `send-interview-invitation` | 23 / true | 5 / false |
| `send-rejection-email` | 24 / true | 6 / false |
| `send-interview-passed` | 24 / true | 6 / false |
| `send-test-retake-approved` | 22 / true | 5 / false |
| `send-offer-letter` | 23 / true | 5 / false |

The staging worksheet/offers and previously staged workflow Functions are not
all newly deployed by this checkpoint. Prior staging evidence, semantic source
comparison and the remaining acceptance gaps are in
`WARM_NEEDLE_INTEGRATION_2026-11-06.md`; version presence alone is not acceptance.

The staged worksheet service now runs commit `2e11d4a` at deploy
`dep-dbmv0orncjis73ajeer0`; its rollback is `dep-dbmag9142hec73e4icgg`
at `8a2a0bc`. The separate staging APP_URL now also allows local port 5197 for
the isolated rehearsal; production origin configuration was not changed.

Retain the deployed `needle-token` and operator-only `manage-runtime-settings`
unless final comparison identifies a required change. Do not mass-deploy the
other production Functions. `generate-customer-worksheet` is a legacy 501 stub;
the current frontend calls the separate Python worksheet service. The dormant
`normalize-worksheet-template` source cannot be downloaded and is excluded.
Calendar/OAuth/background Functions outside this exact set retain their current
versions; test their existing routes without incidentally replacing them.

## Worksheet service and frontend

- Separate staging Render service first, using this reviewed writer/service
  candidate; record its previous deploy and restore it if acceptance fails.
- Validate a real normalized template with synthetic applicant data, overwrite
  clearing and photo/signature checks. Confirm submitted export plus draft and
  Coordinator denial on the hosted route. The actual CMA-layout test now passes
  5,389 cell/style comparisons, photo/signature clearing and draft/applicant/
  unsigned denial. A normal Coordinator worksheet HTTP check now also passes (403).
  KT approved CMA-only pilot scope and confirmed Excel fitting/print passed; second
  customer acceptance is required before enabling another layout. No Excel
  installation is available on this Mac.
- Production service promotion is a separate KT step; preserve its production
  Supabase configuration and allow only the actual frontend origin.
- KT then promotes the same frontend commit to Vercel. Keep both AI flags at
  operator, Preview forwarding denied, Drive intake false and staging data out
  of production. Perform real-domain streaming/cookie/PDF/workflow smoke before
  admitting recruiters.

## Unresolved gates and rollback

KT's Excel/print sign-off and consolidated code review are complete, including
the 0603 follow-up. The normal Coordinator hosted worksheet HTTP check also
passed (403). KT's coordinated promotion and real-domain post-deploy checks remain open for the
CMA-only pilot. Before real-applicant use,
approve retention/deletion for pre-selection sensitive forms and a production
sender; only owner-inbox synthetic staging delivery is accepted so far.

Record exact previous Vercel, Function and Render versions. Roll back compatible
frontend/Functions/service together, preserve additive case/events/application
data, keep intake false and turn AI off if needed. Do not restore a full old
database over new legitimate records or delete test/customer data as rollback.

## Final preparation checkpoint

The post-cleanup read-only production preflight confirms zero applications,
unchanged selected Function versions and the reviewed missing migration set.
A fresh full snapshot has 91 table-data objects / 7,341 rows. All COPY payloads
restore with exact counts; extension-compatible public DDL/data restores 48
tables / 609 rows, with CHECK constraints validated. SHA-256 and receipts are
private. Managed post-data/globals and Storage file bytes are outside this test.
The backup must be refreshed if stale or production changes before migration.

Current rollback deployment records were read from signed-in dashboards:

- Vercel: `dpl_F3XeXkYufUm2eZEmCQpQUQvuugvu`, Ready production, commit
  `21ac6a51ae58d8a5867966e3e83b72aaabdc127c`.
- Render production service `srv-d761128ule4c73cn58v0`: Live
  `dep-dbmmkuuc6qcc73b9k68g`, the same commit. It auto-deploys `main`.
- Function source snapshots and each prior gateway/version are private; the
  table above is the reviewed restore roster. Recheck for drift at release.

Exact KT commands and stop conditions are in
`WARM_KPI_KT_RELEASE_2026-11-06.md`. No production promotion is implied by
completion of the local/staging checks.
