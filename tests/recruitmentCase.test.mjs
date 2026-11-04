// Recruitment case client rules vs the migration. Run: node --test tests/recruitmentCase.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { CASE_ALLOWED_NEXT, CASE_STATUS_META, CASE_LEGACY_TARGETS, caseNextActions, caseErrorMessage, isCaseTableMissing } from '../src/utils/recruitmentCase.js'

const sql = fs.readFileSync(new URL('../supabase/migrations/2026110221_recruitment_case_v1.sql', import.meta.url), 'utf8')

test('allowed-next map matches recruitment_case_allowed_next()', () => {
  const body = sql.slice(sql.indexOf('function public.recruitment_case_allowed_next'), sql.indexOf('function public.recruitment_case_post_interview'))
  const fromSql = {}
  for (const m of body.matchAll(/when '([a-z_]+)'\s+then array\[([^\]]*)\]/g)) {
    fromSql[m[1]] = [...m[2].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])
  }
  assert.deepEqual(CASE_ALLOWED_NEXT, fromSql)
})

test('every status in the check constraint has a label', () => {
  const block = sql.slice(sql.indexOf('recruitment_cases_status_check'), sql.indexOf('recruitment_cases_source_check'))
  const statuses = [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
  assert.deepEqual(Object.keys(CASE_STATUS_META).sort(), [...new Set(statuses)].sort())
})

test('sent_to_principal is never a plain button; legacy targets exclude terminal and attested stages', () => {
  assert.ok(!caseNextActions('documents_verified').includes('sent_to_principal'))
  assert.deepEqual(caseNextActions('sent_to_principal'), ['hired'])
  for (const s of ['legacy', 'hired', 'sent_to_principal', 'withdrawn', 'rejected', 'closed']) assert.ok(!CASE_LEGACY_TARGETS.includes(s), s)
  assert.ok(CASE_LEGACY_TARGETS.includes('interview_passed'))
})

test('error messages and missing-table detection', () => {
  assert.match(caseErrorMessage({ message: 'version_conflict' }), /Refresh/)
  assert.match(caseErrorMessage({ message: 'invalid_transition sourced -> hired' }), /not allowed/)
  assert.ok(isCaseTableMissing({ code: '42P01' }))
  assert.ok(isCaseTableMissing({ code: 'PGRST205', message: "Could not find the table 'public.recruitment_cases' in the schema cache" }))
  assert.ok(!isCaseTableMissing({ code: '42501', message: 'permission denied' }))
})
