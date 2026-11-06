import test from 'node:test'
import assert from 'node:assert/strict'
import { buildNeedsAction } from '../src/utils/kpiTracker.js'

const now = new Date('2026-11-04T12:00:00Z')
const daysAgo = (n) => new Date(now.getTime() - n * 864e5).toISOString()
const daysAhead = (n) => new Date(now.getTime() + n * 864e5).toISOString().slice(0, 10)

const applications = [
  { id: 'a1', status: 'submitted', submitted_at: daysAgo(10), handling_recruiter_id: null },
  { id: 'a2', status: 'submitted', submitted_at: daysAgo(10), handling_recruiter_id: 'r1' },
  { id: 'a3', status: 'submitted', submitted_at: daysAgo(10), handling_recruiter_id: 'r2' },
  { id: 'a4', status: 'submitted', submitted_at: daysAgo(2), handling_recruiter_id: null },
  { id: 'a5', status: 'rejected', submitted_at: daysAgo(20), handling_recruiter_id: null },
  { id: 'a6', status: 'hired', submitted_at: daysAgo(90), handling_recruiter_id: 'r1', contract_end_date: daysAhead(30) },
  { id: 'a7', status: 'hired', submitted_at: daysAgo(90), handling_recruiter_id: 'r2', contract_end_date: daysAhead(90) },
]
const prospects = [
  { id: 'p1', invited_at: daysAgo(5), created_by_recruiter_id: 'r1' },
  { id: 'p2', invited_at: daysAgo(5), claimed_at: daysAgo(4), created_by_recruiter_id: 'r1' },
  { id: 'p3', invited_at: daysAgo(1), created_by_recruiter_id: 'r1' },
  { id: 'p4', invited_at: daysAgo(5), created_by_recruiter_id: 'r2' },
]
const ids = (rows) => rows.map((row) => row.id).sort()

test('whole team', () => {
  const result = buildNeedsAction({ applications, prospects, now })
  assert.deepEqual(ids(result.staleReview), ['a1', 'a2', 'a3'])
  assert.deepEqual(ids(result.unassigned), ['a1', 'a4'])
  assert.deepEqual(ids(result.unclaimedInvites), ['p1', 'p4'])
  assert.deepEqual(ids(result.contractsEnding), ['a6'])
  assert.equal(result.total, 8)
})

test('one recruiter: own or unowned stale reviews, own invites and contracts, shared unassigned queue', () => {
  const result = buildNeedsAction({ applications, prospects, scopeId: 'r1', now })
  assert.deepEqual(ids(result.staleReview), ['a1', 'a2'])
  assert.deepEqual(ids(result.unassigned), ['a1', 'a4'])
  assert.deepEqual(ids(result.unclaimedInvites), ['p1'])
  assert.deepEqual(ids(result.contractsEnding), ['a6'])
})

test('requirements fully joined but still open, scoped by owner', () => {
  const requirementRows = [
    { id: 'q1', status: 'open', positions_required: 2, joinedCount: 2, ownerId: 'r1' },
    { id: 'q2', status: 'open', positions_required: 2, joinedCount: 1, ownerId: 'r1' },
    { id: 'q3', status: 'closed', positions_required: 1, joinedCount: 1, ownerId: 'r1' },
    { id: 'q4', status: 'open', positions_required: 1, joinedCount: 1, ownerId: 'r2' },
    { id: 'q5', status: 'open', positions_required: 1, joinedCount: 1, ownerId: 'r1', isArchived: true },
  ]
  assert.deepEqual(ids(buildNeedsAction({ requirementRows, now }).readyToClose), ['q1', 'q4'])
  assert.deepEqual(ids(buildNeedsAction({ requirementRows, scopeId: 'r1', now }).readyToClose), ['q1'])
})
