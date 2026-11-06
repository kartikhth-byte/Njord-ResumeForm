import { CheckCircle2, Printer, X } from 'lucide-react'
import StatusBadge from '../StatusBadge'
import { formatDisplayValue } from '../../utils/formatUtils'
import { TECHNICAL_SKILL_ROWS, formatPhone, formatSkillValue } from '../../utils/technicalSkills'

// Read-only view of a submitted application for the applicant: summary,
// "at a glance" cards, then grouped section cards (fields as label-over-value
// grids, lists as tables). Light theme; rendered inside the applicant shell.

const isBlank = (value) =>
  value === null || value === undefined || value === false || (typeof value === 'string' && value.trim() === '')

function formatDate(value) {
  if (!value || typeof value !== 'string') return value || null
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return value
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const yesNo = (value) => (value === true || value === 'yes' ? 'Yes' : value === false || value === 'no' ? 'No' : null)
const list = (value) => (Array.isArray(value) ? value : [])

function GroupHeading({ children }) {
  return (
    <h2 className="mt-4 text-xs font-semibold uppercase tracking-[0.06em] text-fg-muted first:mt-0">{children}</h2>
  )
}

function Card({ title, children }) {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface print:break-inside-avoid">
      <h3 className="border-b border-line px-5 py-3.5 text-[15px] font-semibold text-fg">{title}</h3>
      {children}
    </section>
  )
}

// fields: [label, value, wide?]
function Fields({ fields, columns = 3 }) {
  const shown = fields.filter(([, value]) => !isBlank(value))
  if (!shown.length) return <p className="px-5 py-4 text-sm text-fg-muted">Nothing provided.</p>
  const grid = columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'
  return (
    <dl className={`grid grid-cols-1 gap-x-6 gap-y-4 px-5 py-4 ${grid}`}>
      {shown.map(([label, value, wide]) => (
        <div key={label} className={wide ? 'sm:col-span-2' : ''}>
          <dt className="text-xs text-fg-muted">{label}</dt>
          <dd className="mt-0.5 break-words text-sm text-fg">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

// columns: [header, (row) => value]
function Table({ columns, rows, empty = 'None listed.', compact = false }) {
  if (!rows.length) return <p className="px-5 py-4 text-sm text-fg-muted">{empty}</p>
  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse text-sm ${compact ? '' : 'min-w-[560px]'}`}>
        <thead>
          <tr className="bg-bg text-left text-fg-muted">
            {columns.map(([header]) => (
              <th key={header} scope="col" className="px-5 py-2.5 font-medium">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-line">
              {columns.map(([header, get]) => (
                <td key={header} className="px-5 py-3 align-top text-fg">{get(row) || '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ApplicantApplicationView({ application, applicationData, photoUrl, showSubmitted, onDismissSubmitted }) {
  const d = applicationData || {}
  const s1 = d.section1 || {}
  const s2 = d.section2 || {}
  const s3 = d.section3 || {}
  const s4 = d.section4 || {}
  const s10 = d.section10 || {}
  const s11 = d.section11?.medicalHistory || {}
  const s13 = d.section13 || {}
  const s17 = d.section17 || {}
  const s18 = d.section18 || {}
  const s19 = d.section19 || {}
  const vac = s10.vaccinations || {}

  const fullName = [s2.firstName, s2.middleName, s2.surname].filter(Boolean).join(' ') || 'Your application'
  const initials = [s2.firstName, s2.surname].filter(Boolean).map((part) => part[0]).join('').toUpperCase() || '—'
  const rank = formatDisplayValue(s1.appliedForRank)
  const vesselType = formatDisplayValue(s1.vesselType)
  const certificates = list(d.section8?.certificates)
  const courses = list(d.section14?.courses)
  const seaService = list(d.section16?.seaService)
  const skills = TECHNICAL_SKILL_ROWS
    .map(([key, label, detailKey]) => [label, formatSkillValue(s17, key, detailKey)])
    .filter(([, value]) => value)
  const yellowFever = vac.yellowFever || {}

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-5 py-8 sm:px-8">
      {showSubmitted ? (
        <div role="status" className="flex items-start gap-3 rounded-card border border-success-line bg-success-soft px-4 py-3.5 text-success print:hidden">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Application submitted</p>
            <p className="mt-0.5 text-sm">
              Keep your reference: <span className="font-mono font-semibold">{application.reference_number}</span>. We’ll contact you about next steps.
            </p>
          </div>
          <button
            type="button"
            onClick={onDismissSubmitted}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-control transition hover:bg-success-line/40"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* Summary */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="h-16 w-16 flex-none rounded-card border border-line object-cover" />
          ) : (
            <div aria-hidden="true" className="flex h-16 w-16 flex-none items-center justify-center rounded-card bg-raised text-xl font-semibold text-fg-muted">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{fullName}</h1>
            {rank || vesselType ? (
              <p className="mt-0.5 text-fg-secondary">{[rank, vesselType].filter(Boolean).join(' · ')}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
              <StatusBadge status={application.status} />
              {application.reference_number ? (
                <span className="font-mono text-fg-secondary">{application.reference_number}</span>
              ) : null}
              {application.submitted_at ? (
                <span>· Submitted {new Date(application.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              ) : null}
            </div>
          </div>
        </div>
        <button type="button" onClick={() => window.print()} className="applicant-action applicant-action--secondary print:hidden">
          <Printer className="h-4 w-4" aria-hidden="true" />
          Print
        </button>
      </div>

      {/* At a glance */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Available from', formatDate(s1.availableFrom) || '—'],
          ['Nationality', formatDisplayValue(s2.nationality) || '—'],
          ['Certificates', `${certificates.length} CoC · ${courses.length} course${courses.length === 1 ? '' : 's'}`],
          ['Sea service', `${seaService.length} contract${seaService.length === 1 ? '' : 's'}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-card border border-line bg-surface px-4 py-3">
            <p className="text-xs text-fg-muted">{label}</p>
            <p className="mt-0.5 text-sm font-semibold text-fg">{value}</p>
          </div>
        ))}
      </div>

      <GroupHeading>Personal</GroupHeading>
      <Card title="Personal & contact details">
        <Fields
          fields={[
            ['Date of birth', [formatDate(s2.dateOfBirth), s2.age ? `(${s2.age})` : null].filter(Boolean).join(' ')],
            ['Place of birth', s2.placeOfBirth],
            ['Gender', formatDisplayValue(s2.gender)],
            ['Marital status', formatDisplayValue(s2.maritalStatus)],
            ['Email', s2.email],
            ['Mobile', formatPhone(s2.phoneCountryCode, s2.phoneNumber)],
            ['Home telephone', s2.homeTelephoneNumber],
            ['Address', [s2.address, s2.city, s2.state, s2.postalCode, formatDisplayValue(s2.country)].filter(Boolean).join(', '), true],
            ['Nearest airport', [s2.domesticAirport, s2.internationalAirport].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' / ')],
          ]}
        />
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Next of kin">
          <Fields columns={2} fields={[
            ['Name', s2.nextOfKin?.name],
            ['Relationship', s2.nextOfKin?.relationship],
            ['Phone', s2.nextOfKin?.phone],
          ]} />
        </Card>
        <Card title="Emergency contact">
          <Fields columns={2} fields={[
            ['Name', s2.emergencyContact?.name],
            ['Relationship', s2.emergencyContact?.relationship],
            ['Phone', s2.emergencyContact?.phone],
            ['Address', s2.emergencyContact?.address, true],
          ]} />
        </Card>
      </div>
      {list(d.section7?.dependents).length ? (
        <Card title="Dependents">
          <Table
            rows={list(d.section7?.dependents)}
            columns={[
              ['Name', (r) => r.name],
              ['Relationship', (r) => r.relationship],
              ['Date of birth', (r) => formatDate(r.dateOfBirth)],
              ['Gender', (r) => formatDisplayValue(r.gender)],
            ]}
          />
        </Card>
      ) : null}
      <Card title="Availability">
        <Fields fields={[
          ['Position applied for', rank],
          ['Vessel type', vesselType],
          ['Available from', formatDate(s1.availableFrom)],
          ['Available until', formatDate(s1.availableTill)],
          ['Recommended by', s1.professionalRecommendation ? s1.recommendedBy : null],
        ]} />
      </Card>

      <GroupHeading>Travel documents</GroupHeading>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Passport">
          <Fields columns={2} fields={[
            ['Number', s3.passportNumber],
            ['Issued at', s3.placeOfIssue],
            ['Issued', formatDate(s3.dateOfIssue)],
            ['Expires', formatDate(s3.dateOfExpiry)],
            ['Authority', s3.issuingAuthority],
          ]} />
        </Card>
        <Card title="CDC / Seaman’s book">
          <Fields columns={2} fields={[
            ['Number', s4.cdcNumber],
            ['Issued at', s4.placeOfIssue],
            ['Issued', formatDate(s4.dateOfIssue)],
            ['Expires', formatDate(s4.dateOfExpiry)],
            ['Authority', s4.issuingAuthority],
          ]} />
        </Card>
      </div>
      <Card title="Visas">
        <Table
          rows={list(d.section5?.visas)}
          columns={[
            ['Type', (r) => r.type],
            ['Number', (r) => r.number],
            ['Issued at', (r) => r.placeOfIssue],
            ['Issued', (r) => formatDate(r.dateOfIssue)],
            ['Expires', (r) => formatDate(r.dateOfExpiry)],
          ]}
        />
      </Card>

      <GroupHeading>Certificates &amp; training</GroupHeading>
      <Card title="Certificates of competency">
        <Table
          rows={certificates}
          columns={[
            ['Grade', (r) => r.grade],
            ['Number', (r) => r.certificateNumber],
            ['Authority', (r) => r.issuingAuthority],
            ['Issued', (r) => formatDate(r.dateOfIssue)],
            ['Expires', (r) => formatDate(r.dateRevalidationExpiry || r.dateOfExpiry)],
          ]}
        />
      </Card>
      <Card title="GMDSS">
        <Table
          rows={list(d.section9?.gmdss)}
          columns={[
            ['Number', (r) => r.number],
            ['Authority', (r) => r.issuingAuthority],
            ['Issued', (r) => formatDate(r.dateOfIssue)],
            ['Expires', (r) => formatDate(r.dateOfExpiry)],
          ]}
        />
      </Card>
      <Card title="STCW & marine courses">
        <Table
          rows={courses}
          columns={[
            ['Course', (r) => r.courseName],
            ['Certificate', (r) => r.certificateNumber],
            ['Issued', (r) => formatDate(r.dateOfIssue)],
            ['Expires', (r) => formatDate(r.dateOfExpiry)],
          ]}
        />
      </Card>
      <Card title="Flag state endorsements">
        <Table
          rows={list(d.section15?.endorsements)}
          columns={[
            ['Type', (r) => r.endorsementType],
            ['Flag', (r) => r.flagState],
            ['Rank', (r) => r.rankEndorsed],
            ['Number', (r) => r.endorsementNumber],
            ['Expires', (r) => formatDate(r.dateOfExpiry)],
          ]}
        />
      </Card>

      <GroupHeading>Health</GroupHeading>
      <Card title="Medical certificates">
        <Table
          rows={list(s10.medicalFitness)}
          columns={[
            ['Type', (r) => r.type],
            ['Issued', (r) => formatDate(r.dateOfIssue)],
            ['Expires', (r) => formatDate(r.dateOfExpiry)],
          ]}
        />
      </Card>
      <Card title="Vaccinations">
        <Fields fields={[
          ['Yellow fever', yellowFever.received ? (yellowFever.lifetimeValidity ? 'Yes — lifetime' : `Yes${yellowFever.dateOfExpiry ? ` — until ${formatDate(yellowFever.dateOfExpiry)}` : ''}`) : null],
          ['COVID-19', vac.covidVaccinated ? [vac.covidDoses ? `${vac.covidDoses} doses` : 'Yes', vac.covidLastDoseDate ? `last ${formatDate(vac.covidLastDoseDate)}` : null].filter(Boolean).join(', ') : null],
          ['Hepatitis A', vac.hepatitisA ? formatDate(vac.hepatitisADate) || 'Yes' : null],
          ['Hepatitis B', vac.hepatitisB ? formatDate(vac.hepatitisBDate) || 'Yes' : null],
          ['Typhoid', vac.typhoid ? formatDate(vac.typhoidDate) || 'Yes' : null],
          ['Tetanus', vac.tetanus ? formatDate(vac.tetanusDate) || 'Yes' : null],
          ['Measles', vac.measles ? formatDate(vac.measlesDate) || 'Yes' : null],
          ['Polio', vac.polio ? formatDate(vac.polioDate) || 'Yes' : null],
          ['Other', vac.otherVaccinations, true],
        ]} />
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Medical history">
          <Fields columns={2} fields={[
            ['Signed off on medical grounds', yesNo(s11.signedOffMedical)],
            ['Vessel', s11.signedOffMedical ? s11.vesselName : null],
            ['Date', s11.signedOffMedical ? formatDate(s11.dateOfOccurrence) : null],
            ['Details', s11.signedOffMedical ? s11.description : null, true],
          ]} />
        </Card>
        <Card title="Physical & uniform">
          <Fields columns={2} fields={[
            ['Height', s13.height ? `${s13.height} ${s13.heightUnit || ''}`.trim() : null],
            ['Weight', s13.weight ? `${s13.weight} ${s13.weightUnit || ''}`.trim() : null],
            ['Shoe size', s13.shoeSize ? `${s13.shoeSize} ${s13.shoeSizeUnit || ''}`.trim() : null],
            ['Boiler suit', s13.boilerSuitSize],
            ['Shirt', s13.uniformShirtSize],
            ['Trousers', s13.uniformTrouserSize],
          ]} />
        </Card>
      </div>

      <GroupHeading>Experience</GroupHeading>
      <Card title="Sea service">
        <Table
          rows={seaService}
          columns={[
            ['Vessel', (r) => r.vesselName],
            ['Type', (r) => [r.vesselType, r.dwt ? `${r.dwt} DWT` : null].filter(Boolean).join(' · ')],
            ['Rank', (r) => r.rankHeld || r.position],
            ['Company', (r) => r.company || r.companyName],
            ['Sign on – off', (r) => [formatDate(r.signOnDate), formatDate(r.signOffDate)].filter(Boolean).join(' – ')],
            ['Time (mm/dd)', (r) => r.totalMmDd],
          ]}
        />
      </Card>
      <Card title="Technical skills">
        {skills.length ? (
          <ul className="flex flex-wrap gap-2 px-5 py-4">
            {skills.map(([label, value]) => (
              <li key={label} className="rounded-full border border-line bg-bg px-3 py-1 text-sm text-fg">
                {label}{value !== 'Yes' ? <span className="text-fg-secondary"> · {value.replace(/^Yes — /, '')}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-fg-muted">Nothing provided.</p>
        )}
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Languages">
          <Table
            compact
            rows={list(d.section12?.languages)}
            columns={[
              ['Language', (r) => r.language],
              ['Level', (r) => formatDisplayValue(r.level)],
            ]}
          />
        </Card>
        <Card title="Education">
          <Table
            compact
            rows={list(d.section6?.education)}
            columns={[
              ['Institution', (r) => r.institution],
              ['Qualification', (r) => r.qualification],
              ['From – to', (r) => [formatDate(r.from), formatDate(r.to)].filter(Boolean).join(' – ')],
            ]}
          />
        </Card>
      </div>

      <GroupHeading>References</GroupHeading>
      <Card title="Current or last employer">
        <Fields fields={[
          ['Company', s18.currentEmployer?.company],
          ['Contact person', s18.currentEmployer?.contactPerson],
          ['Phone', s18.currentEmployer?.phoneNumber],
          ['Address', s18.currentEmployer?.address, true],
          ['May we contact them?', yesNo(s18.objectionToContactLastEmployer === 'no' ? true : s18.objectionToContactLastEmployer === 'yes' ? false : null)],
        ]} />
      </Card>
      <Card title="Professional references">
        <Table
          rows={list(s18.references)}
          columns={[
            ['Name', (r) => r.name],
            ['Position', (r) => [r.position, r.company].filter(Boolean).join(', ')],
            ['Phone', (r) => r.phoneNumber],
            ['Email', (r) => r.email],
            ['Known', (r) => (r.yearsKnown ? `${r.yearsKnown} yrs` : null)],
          ]}
        />
      </Card>

      <GroupHeading>Declaration</GroupHeading>
      <Card title="Declaration & consent">
        <Fields fields={[
          ['Information is accurate', yesNo(s19.accuracyDeclaration)],
          ['Background check consent', yesNo(s19.backgroundCheckConsent)],
          ['Data processing consent', yesNo(s19.dataProcessingConsent)],
          ['Signed by', s19.fullName],
          ['Date', formatDate(s19.signatureDate)],
          ['Place', s19.placeOfSigning],
          ['Notice period', s19.noticePeriod],
          ['Preferred joining date', formatDate(s19.preferredJoinDate)],
          ['Additional information', s19.additionalInformation, true],
        ]} />
      </Card>
    </div>
  )
}
