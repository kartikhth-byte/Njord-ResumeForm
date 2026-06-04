import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const SECTION_SEQUENCE = [
  { number: 1, shortTitle: 'Availability' },
  { number: 2, shortTitle: 'Personal' },
  { number: 3, shortTitle: 'Passport' },
  { number: 4, shortTitle: 'CDC' },
  { number: 5, shortTitle: 'Visas' },
  { number: 6, shortTitle: 'Education' },
  { number: 7, shortTitle: 'Dependents' },
  { number: 8, shortTitle: 'Certificates' },
  { number: 9, shortTitle: 'GMDSS' },
  { number: 10, shortTitle: 'Medical' },
  { number: 11, shortTitle: 'Med History' },
  { number: 12, shortTitle: 'Languages' },
  { number: 13, shortTitle: 'Physical' },
  { number: 14, shortTitle: 'STCW' },
  { number: 15, shortTitle: 'Flag State' },
  { number: 16, shortTitle: 'Sea Service' },
  { number: 17, shortTitle: 'Experience' },
  { number: 18, shortTitle: 'References' },
  { number: 19, shortTitle: 'Declaration' },
]

export const passportPhotoPath = path.resolve(__dirname, '../fixtures/passport-photo.png')

function formatDate(date) {
  return date.toISOString().split('T')[0]
}

function dateValueForKey(key) {
  const today = new Date()
  const future30 = new Date(today)
  future30.setDate(today.getDate() + 30)
  const future180 = new Date(today)
  future180.setDate(today.getDate() + 180)
  const past365 = new Date(today)
  past365.setDate(today.getDate() - 365)
  const past730 = new Date(today)
  past730.setDate(today.getDate() - 730)

  if (key.includes('birth')) return '1990-01-15'
  if (key.includes('sign on')) return formatDate(past730)
  if (key.includes('sign off')) return formatDate(past365)
  if (key.includes('issue')) return formatDate(past365)
  if (key.includes('expiry') || key.includes('available till')) return formatDate(future180)
  if (key.includes('signature')) return formatDate(today)
  if (key.includes('available from') || key.includes('join')) return formatDate(future30)

  return formatDate(future30)
}

function textValueForKey(key) {
  if (key.includes('surname') || key.includes('last name')) return 'Doe'
  if (key.includes('first name')) return 'John'
  if (key.includes('middle')) return 'Michael'
  if (key.includes('other names')) return 'Sample'
  if (key.includes('known as')) return 'Johnny'
  if (key.includes('email')) return 'smoke.applicant@example.com'
  if (key.includes('phone')) return '9876543210'
  if (key.includes('postal')) return '400001'
  if (key.includes('address')) return '221B Maritime Avenue'
  if (key.includes('city')) return 'Mumbai'
  if (key.includes('state')) return 'Maharashtra'
  if (key.includes('country')) return 'India'
  if (key.includes('airport')) return 'Mumbai International Airport'
  if (key.includes('place of birth')) return 'Mumbai'
  if (key.includes('place of issue')) return 'Mumbai'
  if (key.includes('certificate')) return 'CERT-12345'
  if (key.includes('number')) return 'TEST-12345'
  if (key.includes('company')) return 'Njord Marine Pvt Ltd'
  if (key.includes('vessel name')) return 'MV Test Voyager'
  if (key.includes('flag')) return 'India'
  if (key.includes('rank')) return 'Chief Officer'
  if (key.includes('reason for leaving')) return 'Completed contract successfully'
  if (key.includes('notice period')) return 'Immediate'
  if (key.includes('contract duration')) return '6 months'
  if (key.includes('salary')) return '5000 USD'
  if (key.includes('full name')) return 'John Michael Doe'
  if (key.includes('place of signing')) return 'Mumbai'
  if (key.includes('criminal record details')) return 'No active record. Test disclosure for smoke validation.'
  if (key.includes('medical conditions')) return 'No medical conditions.'
  if (key.includes('special requirements')) return 'No special requirements.'
  if (key.includes('additional information')) return 'Sample applicant data entered by Playwright smoke test.'
  if (key.includes('reference') || key.includes('contact')) return 'Sample reference information for smoke testing.'

  return 'Sample test value'
}

function numberValueForKey(key) {
  if (key.includes('grt')) return '25000'
  if (key.includes('dwt')) return '42000'
  if (key.includes('engine kw')) return '9500'
  if (key.includes('height')) return '178'
  if (key.includes('weight')) return '78'
  if (key.includes('shoe')) return '42'
  if (key.includes('children') || key.includes('dependents')) return '1'
  if (key.includes('dose')) return '2'
  if (key.includes('age')) return '34'
  return '5'
}

async function getFieldMeta(locator) {
  const elementHandle = await locator.elementHandle({ timeout: 1000 }).catch(() => null)
  if (!elementHandle) {
    return null
  }

  return elementHandle.evaluate((el) => {
    const fieldWrapper =
      el.closest('.applicant-field') ||
      el.closest('.applicant-record-card') ||
      el.closest('label') ||
      el.parentElement

    const labelNode = fieldWrapper?.querySelector('label') || el.closest('label')

    return {
      tagName: el.tagName.toLowerCase(),
      type: el.type || '',
      name: el.getAttribute('name') || '',
      placeholder: el.getAttribute('placeholder') || '',
      value: el.value || '',
      checked: Boolean(el.checked),
      disabled: Boolean(el.disabled),
      readOnly: Boolean(el.readOnly),
      label: labelNode?.innerText?.trim() || '',
    }
  })
}

export async function startBlankApplication(page) {
  page.on('dialog', async (dialog) => {
    await dialog.accept()
  })

  await page.goto('/dashboard')

  const startButton = page.getByRole('button', {
    name: /Resume draft|Create new application|Start application|Apply now/i,
  }).first()

  await startButton.click()

  const startBlankButton = page.getByRole('button', { name: 'Start blank' })
  if (await startBlankButton.isVisible().catch(() => false)) {
    await startBlankButton.click()
  }

  await page.waitForURL(/\/application\/form\/section\/1$/)
  await page.getByText('Loading application...').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => null)
  await page.locator('.applicant-panel').first().waitFor({ state: 'visible', timeout: 15000 })
}

export async function navigateToSection(page, section) {
  const sidebarButton = page.locator('aside button').filter({ hasText: section.shortTitle }).first()
  await sidebarButton.click()
  await page.waitForURL(new RegExp(`/application/form/section/${section.number}$`))
  await page.getByText('Loading application...').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => null)
  await page.locator('.applicant-panel').first().waitFor({ state: 'visible', timeout: 15000 })
}

async function addRecordIfNeeded(panel) {
  const fillableLocator = panel.locator('input[name]:not([type=hidden]):not([type=file]):not([type=checkbox]), select[name], textarea[name]')

  const waitForNamedFields = async () => {
    await fillableLocator.first().waitFor({ state: 'visible', timeout: 2500 }).catch(() => null)
    return (await countVisibleNamedFields(panel)) > 0
  }

  const clickAndWaitForFields = async (button) => {
    const clickStrategies = [
      async () => button.click({ force: true }),
      async () => button.evaluate((el) => el.click()),
    ]

    for (const clickStrategy of clickStrategies) {
      await clickStrategy().catch(() => null)
      if (await waitForNamedFields()) {
        return true
      }
    }

    return false
  }

  const fillableCount = await countVisibleNamedFields(panel)

  if (fillableCount > 0) return

  const emptyStateButton = panel.locator('.applicant-empty-state button').filter({ hasText: /Add/i }).first()
  if (await emptyStateButton.isVisible().catch(() => false)) {
    const createdFields = await clickAndWaitForFields(emptyStateButton)
    if (createdFields) return
  }

  const addButtons = panel
    .locator('button')
    .filter({ hasText: /Add Your First|Add Another|Add Sea Service Record|Add .*Record|Add .*Certificate|Add .*Reference|Add .*Contact|Add .*Visa|Add .*Course|Add .*Language|Add .*Dependent|Add/i })

  const addCount = await addButtons.count()
  if (addCount === 0) return

  for (let index = 0; index < addCount; index += 1) {
    const addButton = addButtons.nth(index)
    const visible = await addButton.isVisible().catch(() => false)
    if (!visible) continue
    const createdFields = await clickAndWaitForFields(addButton)
    if (createdFields) {
      return
    }
  }
}

async function ensureSectionSpecificRecord(page, panel) {
  const currentSectionMatch = page.url().match(/\/application\/form\/section\/(\d+)$/)
  const currentSection = currentSectionMatch ? Number.parseInt(currentSectionMatch[1], 10) : null
  const visibleFieldCount = await countVisibleNamedFields(panel)

  if (visibleFieldCount > 0) return

  if (currentSection === 5) {
    const addVisaButton = page.getByRole('button', { name: /Add Your First Visa/i }).first()
    if (await addVisaButton.isVisible().catch(() => false)) {
      await addVisaButton.click({ force: true }).catch(() => null)
      await panel.locator('[name="visa-0-number"]').first().waitFor({ state: 'visible', timeout: 2500 }).catch(() => null)
    }
  }
}

async function countVisibleNamedFields(panel) {
  const fields = panel.locator('input[name]:not([type=hidden]):not([type=file]):not([type=checkbox]), select[name], textarea[name]')
  const total = await fields.count()
  let visibleCount = 0

  for (let index = 0; index < total; index += 1) {
    const field = fields.nth(index)
    const visible = await field.isVisible().catch(() => false)
    if (visible) {
      visibleCount += 1
    }
  }

  return visibleCount
}

async function fillFileInputs(panel) {
  const fileInputs = panel.locator('input[type="file"]')
  const count = await fileInputs.count()

  for (let index = 0; index < count; index += 1) {
    await fileInputs.nth(index).setInputFiles(passportPhotoPath)
  }
}

async function fillSelects(panel) {
  const selects = panel.locator('select:not([disabled])')
  const count = await selects.count()

  for (let index = 0; index < count; index += 1) {
    const select = selects.nth(index)
    const meta = await getFieldMeta(select)

    if (!meta || meta.disabled || meta.value) continue

    const visible = await select.isVisible().catch(() => false)
    if (!visible) continue

    const selectHandle = await select.elementHandle({ timeout: 1000 }).catch(() => null)
    if (!selectHandle) continue

    const optionValue = await selectHandle.evaluate((el) => {
      const options = Array.from(el.options).filter((option) => option.value)
      return options[0]?.value || null
    })

    if (optionValue) {
      await selectHandle.evaluate((el, value) => {
        el.value = value
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }, optionValue)
    }
  }
}

async function fillTextInputs(panel) {
  const inputs = panel.locator('input:not([type=hidden]):not([type=file]):not([type=checkbox])')
  const count = await inputs.count()

  for (let index = 0; index < count; index += 1) {
    const input = inputs.nth(index)
    const meta = await getFieldMeta(input)

    if (!meta || meta.disabled || meta.readOnly || meta.value) continue

    const visible = await input.isVisible().catch(() => false)
    if (!visible) continue

    const key = `${meta.label} ${meta.name} ${meta.placeholder}`.toLowerCase()

    if (meta.type === 'date') {
      await input.fill(dateValueForKey(key))
    } else if (meta.type === 'email' || key.includes('email')) {
      await input.fill('smoke.applicant@example.com')
    } else if (meta.type === 'tel' || key.includes('phone')) {
      await input.fill('9876543210')
    } else if (meta.type === 'number') {
      await input.fill(numberValueForKey(key))
    } else {
      const value = textValueForKey(key)
      try {
        await input.fill(value, { timeout: 5000 })
      } catch {
        await input.evaluate((element, nextValue) => {
          element.value = nextValue
          element.dispatchEvent(new Event('input', { bubbles: true }))
          element.dispatchEvent(new Event('change', { bubbles: true }))
          element.dispatchEvent(new Event('blur', { bubbles: true }))
        }, value)
      }
    }
  }
}

async function fillTextareas(panel) {
  const textareas = panel.locator('textarea:not([disabled])')
  const count = await textareas.count()

  for (let index = 0; index < count; index += 1) {
    const textarea = textareas.nth(index)
    const meta = await getFieldMeta(textarea)

    if (!meta || meta.disabled || meta.readOnly || meta.value) continue

    const visible = await textarea.isVisible().catch(() => false)
    if (!visible) continue

    const key = `${meta.label} ${meta.name} ${meta.placeholder}`.toLowerCase()
    const value = textValueForKey(key)
    try {
      await textarea.fill(value, { timeout: 5000 })
    } catch {
      await textarea.evaluate((element, nextValue) => {
        element.value = nextValue
        element.dispatchEvent(new Event('input', { bubbles: true }))
        element.dispatchEvent(new Event('change', { bubbles: true }))
        element.dispatchEvent(new Event('blur', { bubbles: true }))
      }, value)
    }
  }
}

async function fillCheckboxes(panel) {
  const checkboxes = panel.locator('input[type="checkbox"]:not([disabled])')
  const count = await checkboxes.count()

  for (let index = 0; index < count; index += 1) {
    const checkbox = checkboxes.nth(index)
    const meta = await getFieldMeta(checkbox)
    if (!meta) continue

    const visible = await checkbox.isVisible().catch(() => false)
    if (!visible) continue

    const key = `${meta.label} ${meta.name}`.toLowerCase()

    if (meta.checked) continue

    // Skip conditional toggles that reveal alternate address/phone fields and
    // often start valid in the unchecked state.
    if (key.includes('addressdifferent') || key.includes('phonedifferent')) {
      continue
    }

    try {
      await checkbox.check({ force: true })
    } catch {
      // Some custom or controlled checkboxes do not stay checked via the native
      // input. Ignore those here and let field-level assertions catch real issues.
    }
  }
}

export async function fillCurrentSection(page, options = {}) {
  const { skipFileInputs = false } = options
  await page.getByText('Loading application...').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => null)
  const panel = page.locator('.applicant-panel').first()
  await panel.waitFor({ state: 'visible', timeout: 15000 })

  await addRecordIfNeeded(panel)
  await ensureSectionSpecificRecord(page, panel)
  if (!skipFileInputs) {
    await fillFileInputs(panel)
  }

  for (let pass = 0; pass < 3; pass += 1) {
    await fillSelects(panel)
    await fillTextInputs(panel)
    await fillTextareas(panel)
    await fillCheckboxes(panel)
  }
}

export async function captureCurrentSectionFieldState(page) {
  const panel = page.locator('.applicant-panel').first()
  const fieldStates = []
  const fields = panel.locator('input[name]:not([type="hidden"]):not([type="file"]), select[name], textarea[name]')
  const count = await fields.count()

  for (let index = 0; index < count; index += 1) {
    const field = fields.nth(index)
    const visible = await field.isVisible().catch(() => false)
    if (!visible) continue
    const name = await field.getAttribute('name')
    if (!name) continue

    const disabled = await field.isDisabled().catch(() => false)
    if (disabled) continue

    const tagName = await field.evaluate((el) => el.tagName.toLowerCase()).catch(() => null)
    const type = await field.getAttribute('type')
    const readOnly = await field.evaluate((el) => Boolean(el.readOnly)).catch(() => false)
    if (readOnly) continue

    if (type === 'checkbox') {
      fieldStates.push({
        name,
        kind: 'checkbox',
        checked: await field.isChecked().catch(() => false),
      })
      continue
    }

    fieldStates.push({
      name,
      kind: tagName,
      value: await field.inputValue().catch(() => ''),
    })
  }

  return fieldStates
}

export async function expectCurrentSectionFieldState(page, fieldStates) {
  for (const fieldState of fieldStates) {
    const locator = page.locator(`[name="${fieldState.name}"]`).first()
    await expect(locator).toBeVisible()

    if (fieldState.kind === 'checkbox') {
      await expect(locator).toHaveJSProperty('checked', fieldState.checked)
      continue
    }

    await expect(locator).toHaveValue(fieldState.value)
  }
}

export async function captureVisibleRequiredFieldState(page) {
  const panel = page.locator('.applicant-panel').first()
  const fieldStates = []
  const fields = panel.locator('input[required][name]:not([type="hidden"]):not([type="file"]), select[required][name], textarea[required][name]')
  const count = await fields.count()

  for (let index = 0; index < count; index += 1) {
    const field = fields.nth(index)
    const meta = await getFieldMeta(field)
    if (!meta || meta.disabled || meta.readOnly) continue

    const visible = await field.isVisible().catch(() => false)
    if (!visible) continue

    fieldStates.push({
      name: meta.name,
      type: meta.type,
      tagName: meta.tagName,
    })
  }

  return fieldStates
}

export async function expectVisibleRequiredFieldsFilled(page, fieldStates) {
  for (const fieldState of fieldStates) {
    const locator = page.locator(`[name="${fieldState.name}"]`).first()
    await expect(locator).toBeVisible()

    if (fieldState.type === 'checkbox') {
      await expect(locator).toHaveJSProperty('checked', true)
      continue
    }

    const value = await locator.inputValue()
    expect(value, `Expected required field "${fieldState.name}" to be filled`).not.toBe('')
  }
}
