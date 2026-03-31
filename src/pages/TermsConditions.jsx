export default function TermsConditions() {
  return (
    <div className="public-doc-shell">
      <div className="public-doc-card">
        <div className="public-doc-header">
          <p className="public-eyebrow text-blue-700">Njordships Legal</p>
          <h1 className="public-doc-title">Terms and Conditions</h1>
          <p className="public-doc-copy">
            These terms govern how applicants and recruiter users access and use the maritime recruitment portal.
          </p>
        </div>

        <div className="public-doc-content">
          <section className="public-doc-section">
          <p className="text-gray-600 mb-4">
            <strong>Last Updated:</strong> November 8, 2025
          </p>
          </section>

          <section className="public-doc-section">
          <h2>1. Acceptance of Terms</h2>
          <p className="text-gray-700 mb-4">
            By submitting an application through Njordships Maritime Recruitment Portal, you agree to be bound by these Terms and Conditions.
          </p>
          </section>

          <section className="public-doc-section">
          <h2>2. Application Requirements</h2>
          <p className="text-gray-700 mb-4">
            You agree that:
          </p>
          <ul className="list-disc ml-6 text-gray-700 mb-4">
            <li>All information provided is accurate and truthful</li>
            <li>You possess all stated qualifications and certificates</li>
            <li>You meet the requirements for maritime employment</li>
            <li>You will notify us of any changes to your information</li>
          </ul>
          </section>

          <section className="public-doc-section">
          <h2>3. Background Verification</h2>
          <p className="text-gray-700 mb-4">
            You authorize Njordships to conduct comprehensive background checks including:
          </p>
          <ul className="list-disc ml-6 text-gray-700 mb-4">
            <li>Employment history verification</li>
            <li>Educational credential verification</li>
            <li>Criminal record checks</li>
            <li>Medical fitness assessments</li>
          </ul>
          </section>

          <section className="public-doc-section">
          <h2>4. Employment Terms</h2>
          <p className="text-gray-700 mb-4">
            Submission of an application does not guarantee employment. All positions are subject to:
          </p>
          <ul className="list-disc ml-6 text-gray-700 mb-4">
            <li>Successful verification of credentials</li>
            <li>Vessel availability and requirements</li>
            <li>Medical clearance</li>
            <li>Compliance with maritime regulations</li>
          </ul>
          </section>

          <section className="public-doc-section">
          <h2>5. Liability</h2>
          <p className="text-gray-700 mb-4">
            Njordships is not liable for:
          </p>
          <ul className="list-disc ml-6 text-gray-700 mb-4">
            <li>Application processing delays</li>
            <li>Third-party verification processes</li>
            <li>Changes in vessel requirements</li>
            <li>Unforeseen circumstances affecting employment</li>
          </ul>
          </section>

          <section className="public-doc-section">
          <h2>6. Termination</h2>
          <p className="text-gray-700 mb-4">
            We reserve the right to reject or terminate any application if:
          </p>
          <ul className="list-disc ml-6 text-gray-700 mb-4">
            <li>False information is discovered</li>
            <li>Required documentation is not provided</li>
            <li>You fail to meet maritime standards</li>
            <li>You violate these terms</li>
          </ul>
          </section>

          <section className="public-doc-section">
          <h2>7. Contact Information</h2>
          <p className="text-gray-700 mb-4">
            For questions about these terms, contact: <strong>legal@njordships.com</strong>
          </p>
          </section>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-6">
          <button
            onClick={() => window.close()}
            className="applicant-action applicant-action--secondary"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  )
}
