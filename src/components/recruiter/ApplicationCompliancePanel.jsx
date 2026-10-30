function ComplianceSummaryCard({ label, value, tone }) {
  const toneClasses = {
    red: 'border-danger-line bg-danger-soft text-danger',
    amber: 'border-warning-line bg-warning-soft text-warning',
    green: 'border-success-line bg-success-soft text-success',
  }

  return (
    <div className={`rounded-card border p-4 ${toneClasses[tone]}`}>
      <p className="text-xs font-semibold">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  )
}

function ComplianceStatusPill({ status }) {
  const styles = {
    red: 'bg-danger-soft text-danger',
    amber: 'bg-warning-soft text-warning',
    green: 'bg-success-soft text-success',
  }

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>
      {status}
    </span>
  )
}

function reviewFlagStyles(status) {
  if (status === 'amber') {
    return 'border-warning-line bg-surface/80'
  }

  return 'border-danger-line bg-surface/80'
}

export default function ApplicationCompliancePanel({
  compliance,
  eyebrow = 'Recruiter Compliance Review',
  title = 'Documents, training, and review flags',
  description = 'This is a recruiter-side readiness pass based on the submitted application data. It highlights missing items, near-expiry records, and sea-service gaps so the review starts with the highest-risk issues.',
}) {
  if (!compliance) return null

  return (
    <div className="recruiter-panel p-6 print:shadow-none print:border">
      <div className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold text-accent-text">{eyebrow}</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-fg">{title}</h3>
          <p className="mt-2 max-w-3xl text-sm text-fg-secondary">{description}</p>
        </div>
        <ComplianceStatusPill status={compliance.overallStatus} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ComplianceSummaryCard label="Red items" value={compliance.summary.red} tone="red" />
        <ComplianceSummaryCard label="Amber items" value={compliance.summary.amber} tone="amber" />
        <ComplianceSummaryCard label="Green items" value={compliance.summary.green} tone="green" />
      </div>

      {compliance.redFlags.length > 0 ? (
        <div className="mt-6 rounded-card border border-line bg-raised p-4">
          <p className="text-xs font-semibold text-fg-secondary">Recruiter Review Flags</p>
          <div className="mt-3 space-y-3">
            {compliance.redFlags.map((flag, index) => {
              const cardStyles = reviewFlagStyles(flag.status)

              return (
                <div key={`${flag.title}-${index}`} className={`rounded-card border p-4 ${cardStyles}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-fg">{flag.title}</p>
                    <ComplianceStatusPill status={flag.status} />
                  </div>
                  <p className="mt-2 text-sm text-fg-secondary">{flag.detail}</p>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-card border border-success-line bg-success-soft p-4">
          <p className="text-sm font-medium text-success">No review flags.</p>
        </div>
      )}

      {compliance.metadata?.vesselApplicabilityReasons?.length > 0 ? (
        <div className="mt-6 rounded-card border border-accent/40 bg-accent-soft p-4">
          <p className="text-xs font-semibold text-accent-text">Applicability Triggers</p>
          <div className="mt-3 space-y-2">
            {compliance.metadata.vesselApplicabilityReasons.map((reason) => (
              <p key={reason} className="text-sm text-accent-text">
                {reason}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {compliance.groups.map((group) => (
          <div key={group.title} className="rounded-card border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <h4 className="text-sm font-semibold text-fg">{group.title}</h4>
                <p className="mt-1 text-xs text-fg-muted">
                  {group.counts.red} red • {group.counts.amber} amber • {group.counts.green} green
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {group.items.map((item) => (
                <div key={item.label} className="rounded-card border border-line bg-raised p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-fg">{item.label}</p>
                    <ComplianceStatusPill status={item.status} />
                  </div>
                  <p className="mt-2 text-sm text-fg-secondary">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
