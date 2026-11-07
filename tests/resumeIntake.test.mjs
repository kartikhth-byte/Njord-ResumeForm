import test from 'node:test'
import assert from 'node:assert/strict'
import { resumeIntakeEnabled, requireResumeIntake } from '../src/lib/resumeIntake.js'

test('New entry is opt-in and defaults to a held release', () => {
  for (const value of [undefined, '', 'off', 'false', 'true', 'operator']) assert.equal(resumeIntakeEnabled(value), false)
  assert.equal(resumeIntakeEnabled('on'), true)
  assert.equal(resumeIntakeEnabled(' ON '), true)
  assert.throws(requireResumeIntake, /until Resume Intake is connected/)
})
