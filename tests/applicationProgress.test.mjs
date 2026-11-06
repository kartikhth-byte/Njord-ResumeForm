import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateDraftProgress, getBlockingSections, getSectionStatus, isDraftSectionComplete } from '../src/utils/applicationProgress.js'
import { MANDATORY_SECTION_NUMBERS } from '../src/constants/formSections.js'

test('an explicit negative medical-history answer is complete and no longer blocks review', () => {
  const section11 = { medicalHistory: {
    signedOffMedical: false, vesselName: '', dateOfOccurrence: '', description: '',
  } }
  assert.equal(getSectionStatus(11, section11), 'complete')
  assert.equal(isDraftSectionComplete(11, section11), true)
  assert.equal(calculateDraftProgress({ section11 }, [11]), 100)
  assert.equal(getBlockingSections({ section11 }).includes(11), false)
})

test('unanswered mandatory sections remain incomplete', () => {
  for (const section of MANDATORY_SECTION_NUMBERS) {
    assert.equal(getSectionStatus(section, undefined), 'incomplete', `Section ${section}`)
    assert.equal(getSectionStatus(section, {}), 'incomplete', `Empty section ${section}`)
  }
  for (const signedOffMedical of [undefined, null, '', 'false', 0]) {
    assert.equal(getSectionStatus(11, { medicalHistory: { signedOffMedical } }), 'incomplete')
  }
})

test('a positive medical history still requires its conditional details', () => {
  assert.equal(getSectionStatus(11, { medicalHistory: { signedOffMedical: true } }), 'incomplete')
  assert.equal(getSectionStatus(11, { medicalHistory: {
    signedOffMedical: true, vesselName: 'Synthetic vessel', dateOfOccurrence: '2025-01-01',
    description: 'Synthetic staging test only.',
  } }), 'complete')
})

test('negative declaration checkboxes do not bypass required consent', () => {
  assert.equal(getSectionStatus(19, {
    accuracyDeclaration: false, backgroundCheckConsent: false, dataProcessingConsent: false,
  }), 'incomplete')
})
