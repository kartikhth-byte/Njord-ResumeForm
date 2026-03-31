/* global process */
import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { loadPlaywrightEnv } from '../loadPlaywrightEnv.js'
import { navigateToSection, startBlankApplication } from '../helpers/applicantFormFill.js'
import {
  SECTION14_COURSE_METADATA,
  SECTION14_REQUESTED_COURSE_NAMES,
} from '../../src/constants/section14Courses.js'

loadPlaywrightEnv()

const applicantStorageState =
  process.env.PLAYWRIGHT_APPLICANT_STORAGE_STATE || 'playwright/.auth/applicant.json'
const hasApplicantStorageState = fs.existsSync(applicantStorageState)

test.describe('applicant section spec regressions', () => {
  test.use({ storageState: applicantStorageState })
  test.skip(!hasApplicantStorageState, 'Applicant storage state not captured yet. Run npm run test:auth:applicant first.')

  test('section 1 conditional referral and advertisement fields show and clear correctly', async ({ page }) => {
    await startBlankApplication(page)

    await page.locator('#mediaAdvertisement').check()
    await expect(page.locator('[name="mediaAdvertisementDetails"]')).toBeVisible()
    await page.locator('[name="mediaAdvertisementDetails"]').fill('LinkedIn campaign')
    await page.locator('#mediaAdvertisement').uncheck()
    await expect(page.locator('[name="mediaAdvertisementDetails"]')).toHaveCount(0)

    await page.locator('#professionalRecommendation').check()
    await expect(page.locator('[name="recommendedBy"]')).toBeVisible()
    await page.locator('[name="recommendedBy"]').fill('Captain Smith')
    await page.locator('#professionalRecommendation').uncheck()
    await expect(page.locator('[name="recommendedBy"]')).toHaveCount(0)
  })

  test('section 2 next-of-kin and emergency contact fields accept input and survive navigation', async ({ page }) => {
    await startBlankApplication(page)
    await navigateToSection(page, { number: 2, shortTitle: 'Personal' })

    await page.locator('[name="nextOfKin.name"]').fill('Jane Doe')
    await page.locator('[name="nextOfKin.relationship"]').selectOption('parent')
    await page.locator('[name="emergencyContact.name"]').fill('Jack Doe')
    await page.locator('[name="emergencyContact.relationship"]').selectOption('sibling')
    await page.locator('[name="emergencyContact.address"]').fill('221B Maritime Avenue')
    await page.locator('[name="emergencyContact.phone"]').fill('9876543210')

    await navigateToSection(page, { number: 3, shortTitle: 'Passport' })
    await navigateToSection(page, { number: 2, shortTitle: 'Personal' })

    await expect(page.locator('[name="nextOfKin.name"]')).toHaveValue('Jane Doe')
    await expect(page.locator('[name="nextOfKin.relationship"]')).toHaveValue('parent')
    await expect(page.locator('[name="emergencyContact.name"]')).toHaveValue('Jack Doe')
    await expect(page.locator('[name="emergencyContact.relationship"]')).toHaveValue('sibling')
    await expect(page.locator('[name="emergencyContact.address"]')).toHaveValue('221B Maritime Avenue')
    await expect(page.locator('[name="emergencyContact.phone"]')).toHaveValue('9876543210')
  })

  test('section 3 expiry date tracks issue date and issuing authority is selectable', async ({ page }) => {
    await startBlankApplication(page)
    await navigateToSection(page, { number: 3, shortTitle: 'Passport' })

    await page.locator('[name="dateOfIssue"]').fill('2025-01-01')
    await expect(page.locator('[name="dateOfExpiry"]')).toHaveAttribute('min', '2025-01-01')

    await page.locator('[name="issuingAuthority"]').selectOption({ index: 1 })
    await expect(page.locator('[name="issuingAuthority"]')).not.toHaveValue('')
  })

  test('section 4 shows validation when expiry date is before issue date', async ({ page }) => {
    await startBlankApplication(page)
    await navigateToSection(page, { number: 4, shortTitle: 'CDC' })

    await page.locator('[name="dateOfIssue"]').fill('2025-01-10')
    await page.locator('[name="dateOfExpiry"]').fill('2025-01-01')
    await page.locator('[name="dateOfExpiry"]').blur()

    await expect(page.getByText('Expiry date must be after issue date')).toBeVisible()
  })

  test('section 8 revalidation expiry tracks revalidation date', async ({ page }) => {
    await startBlankApplication(page)
    await navigateToSection(page, { number: 8, shortTitle: 'Certificates' })

    await page.getByRole('button', { name: /Add Certificate/i }).click()
    await page.locator('[name="cert-0-dateRevalidated"]').fill('2025-03-01')
    await expect(page.locator('[name="cert-0-dateRevalidationExpiry"]')).toHaveAttribute('min', '2025-03-01')
  })

  test('section 14 auto-fills mapped course metadata and locks the reference fields', async ({ page }) => {
    await startBlankApplication(page)
    await navigateToSection(page, { number: 14, shortTitle: 'STCW' })

    await page.getByRole('button', { name: /Add STCW Course/i }).click()

    const courseSelect = page.locator('[name="course-0-courseName"]')
    const optionValues = await courseSelect.locator('option').evaluateAll((options) =>
      options.map((option) => option.getAttribute('value')).filter(Boolean)
    )

    for (const option of SECTION14_REQUESTED_COURSE_NAMES) {
      expect(optionValues).toContain(option)
    }

    await expect(page.locator('[name="course-0-imoModelCourse"]')).toBeVisible()
    await expect(page.locator('[name="course-0-referenceRegulation"]')).toBeVisible()
    await expect(page.locator('[name="course-0-issuingAuthority"]')).toHaveCount(0)
    await expect(page.locator('[name="course-0-placeOfIssue"]')).toHaveCount(0)

    await page.locator('[name="course-0-courseName"]').selectOption('Basic Training')

    await expect(page.locator('[name="course-0-courseName"]')).toHaveValue('Basic Training')
    await expect(page.locator('[name="course-0-imoModelCourse"]')).toHaveValue(SECTION14_COURSE_METADATA['Basic Training'].imoModelCourse)
    await expect(page.locator('[name="course-0-referenceRegulation"]')).toHaveValue(SECTION14_COURSE_METADATA['Basic Training'].referenceRegulation)
    await expect(page.locator('[name="course-0-imoModelCourse"]')).toHaveAttribute('readonly', '')
    await expect(page.locator('[name="course-0-referenceRegulation"]')).toHaveAttribute('readonly', '')

    await page.locator('[name="course-0-courseName"]').selectOption('HAZ MAT')
    await expect(page.locator('[name="course-0-imoModelCourse"]')).toHaveValue('')
    await expect(page.locator('[name="course-0-referenceRegulation"]')).toHaveValue('US 49 CFR 172.700-172.204')

    await page.locator('[name="course-0-courseName"]').selectOption('Radar Simulator')
    await expect(page.locator('[name="course-0-imoModelCourse"]')).toHaveValue('')
    await expect(page.locator('[name="course-0-referenceRegulation"]')).toHaveValue('')
  })

  test('section 16 vessel type and reason-for-leaving store abbreviations only', async ({ page }) => {
    await startBlankApplication(page)
    await navigateToSection(page, { number: 16, shortTitle: 'Sea Service' })

    await page.getByRole('button', { name: /Add Sea Service Record/i }).click()

    const vesselTypeValues = await page.locator('[name="service-0-vesselType"] option').evaluateAll((options) =>
      options.map((option) => option.getAttribute('value')).filter(Boolean)
    )
    expect(vesselTypeValues).toEqual(['PC', 'GC', 'BC', 'LNG', 'LPG', 'Chem', 'RoRo'])

    const reasonValues = await page.locator('[name="service-0-reasonForLeaving"] option').evaluateAll((options) =>
      options.map((option) => option.getAttribute('value')).filter(Boolean)
    )
    expect(reasonValues).toEqual(['MR', 'VS', 'EOC'])

    await page.locator('[name="service-0-vesselType"]').selectOption('GC')
    await page.locator('[name="service-0-reasonForLeaving"]').selectOption('EOC')

    await expect(page.locator('[name="service-0-vesselType"]')).toHaveValue('GC')
    await expect(page.locator('[name="service-0-reasonForLeaving"]')).toHaveValue('EOC')
  })

  test('section 10 yellow fever lifetime validity clears and disables expiry date', async ({ page }) => {
    await startBlankApplication(page)
    await navigateToSection(page, { number: 10, shortTitle: 'Medical' })

    await page.getByRole('button', { name: /Add Medical Certificate/i }).click()
    await page.locator('#yellowFever').check()
    await page.locator('[name="yellowFever-dateOfIssue"]').fill('2024-01-01')
    await page.locator('[name="yellowFever-dateOfExpiry"]').fill('2034-01-01')

    await page.locator('#yellowFeverLifetime').check()
    await expect(page.locator('[name="yellowFever-dateOfExpiry"]')).toBeDisabled()
    await expect(page.locator('[name="yellowFever-dateOfExpiry"]')).toHaveValue('')
  })

  test('section 11 medical sign-off details appear only when declared', async ({ page }) => {
    await startBlankApplication(page)
    await navigateToSection(page, { number: 11, shortTitle: 'Med History' })

    await expect(page.locator('[name="vesselName"]')).toHaveCount(0)
    await page.locator('[name="signedOffMedical"]').check()
    await expect(page.locator('[name="vesselName"]')).toBeVisible()
    await expect(page.locator('[name="dateOfOccurrence"]')).toBeVisible()
    await expect(page.locator('[name="description"]')).toBeVisible()

    await page.locator('[name="signedOffMedical"]').uncheck()
    await expect(page.locator('[name="vesselName"]')).toHaveCount(0)
    await expect(page.locator('[name="description"]')).toHaveCount(0)
  })

  test('section 18 supports adding the required second professional reference', async ({ page }) => {
    await startBlankApplication(page)
    await navigateToSection(page, { number: 18, shortTitle: 'References' })

    await page.getByRole('button', { name: /Add Professional Reference/i }).click()
    await page.getByRole('button', { name: /Add Another Reference/i }).click()

    await expect(page.locator('[name="reference-0-name"]')).toBeVisible()
    await expect(page.locator('[name="reference-1-name"]')).toBeVisible()
    await page.locator('[name="reference-1-relationship"]').selectOption('Former Captain')
    await expect(page.locator('[name="reference-1-relationship"]')).toHaveValue('Former Captain')
  })

  test('section 19 criminal record details are conditional and declarations can be checked', async ({ page }) => {
    await startBlankApplication(page)
    await navigateToSection(page, { number: 19, shortTitle: 'Declaration' })

    await page.locator('[name="criminalRecord"]').check()
    await expect(page.locator('[name="criminalRecordDetails"]')).toBeVisible()
    await page.locator('[name="criminalRecordDetails"]').fill('Minor historical offense resolved in 2015.')
    await page.locator('[name="criminalRecord"]').uncheck()
    await expect(page.locator('[name="criminalRecordDetails"]')).toHaveCount(0)

    await page.locator('[name="accuracyDeclaration"]').check()
    await page.locator('[name="backgroundCheckConsent"]').check()
    await page.locator('[name="dataProcessingConsent"]').check()
    await page.locator('[name="fullName"]').fill('John Michael Doe')
    await page.locator('[name="placeOfSigning"]').fill('Mumbai')

    await expect(page.locator('[name="accuracyDeclaration"]')).toBeChecked()
    await expect(page.locator('[name="backgroundCheckConsent"]')).toBeChecked()
    await expect(page.locator('[name="dataProcessingConsent"]')).toBeChecked()
    await expect(page.locator('[name="fullName"]')).toHaveValue('John Michael Doe')
    await expect(page.locator('[name="placeOfSigning"]')).toHaveValue('Mumbai')
  })
})
