function ComplianceSummaryCard({ label, value, tone }) {
  const toneClasses = {
    red: 'border-rose-200 bg-rose-50 text-rose-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  )
}

function ComplianceStatusPill({ status }) {
  const styles = {
    red: 'bg-rose-100 text-rose-700',
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-emerald-100 text-emerald-700',
  }

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${styles[status]}`}>
      {status}
    </span>
  )
}

function reviewFlagStyles(status) {
  if (status === 'amber') {
    return 'border-amber-100 bg-white/80'
  }

  return 'border-rose-100 bg-white/80'
}

export default function ApplicationCompliancePanel({ compliance }) {
  if (!compliance) return null

  return (
    <div className="recruiter-panel p-6 print:shadow-none print:border">
      <div className="flex flex-col gap-3 border-b border-gray-200 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Recruiter Compliance Review</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-gray-900">Documents, training, and review flags</h3>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">
            This is a recruiter-side readiness pass based on the submitted application data. It highlights missing items,
            near-expiry records, and sea-service gaps so the review starts with the highest-risk issues.
          </p>
        </div>
        <ComplianceStatusPill status={compliance.overallStatus} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ComplianceSummaryCard label="Red items" value={compliance.summary.red} tone="red" />
        <ComplianceSummaryCard label="Amber items" value={compliance.summary.amber} tone="amber" />
        <ComplianceSummaryCard label="Green items" value={compliance.summary.green} tone="green" />
      </div>

      {compliance.redFlags.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">Recruiter Review Flags</p>
          <div className="mt-3 space-y-3">
            {compliance.redFlags.map((flag, index) => {
              const cardStyles = reviewFlagStyles(flag.status)

              return (
              <div key={`${flag.title}-${index}`} className={`rounded-2xl border p-4 ${cardStyles}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{flag.title}</p>
                  <ComplianceStatusPill status={flag.status} />
                </div>
                <p className="mt-2 text-sm text-slate-700">{flag.detail}</p>
              </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-700">No sea-service gap or CoC near-expiry review flags were detected in the current application data.</p>
        </div>
      )}

      {compliance.metadata?.vesselApplicabilityReasons?.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Applicability Triggers</p>
          <div className="mt-3 space-y-2">
            {compliance.metadata.vesselApplicabilityReasons.map((reason) => (
              <p key={reason} className="text-sm text-sky-800">
                {reason}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {compliance.groups.map((group) => (
          <div key={group.title} className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">{group.title}</h4>
                <p className="mt-1 text-xs text-gray-500">
                  {group.counts.red} red • {group.counts.amber} amber • {group.counts.green} green
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {group.items.map((item) => (
                <div key={item.label} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <ComplianceStatusPill status={item.status} />
                  </div>
                  <p className="mt-2 text-sm text-gray-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
