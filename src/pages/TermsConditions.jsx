export default function TermsConditions() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms and Conditions</h1>
        
        <div className="prose prose-blue max-w-none">
          <p className="text-gray-600 mb-4">
            <strong>Last Updated:</strong> November 8, 2025
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">1. Acceptance of Terms</h2>
          <p className="text-gray-700 mb-4">
            By submitting an application through Njordships Maritime Recruitment Portal, you agree to be bound by these Terms and Conditions.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">2. Application Requirements</h2>
          <p className="text-gray-700 mb-4">
            You agree that:
          </p>
          <ul className="list-disc ml-6 text-gray-700 mb-4">
            <li>All information provided is accurate and truthful</li>
            <li>You possess all stated qualifications and certificates</li>
            <li>You meet the requirements for maritime employment</li>
            <li>You will notify us of any changes to your information</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">3. Background Verification</h2>
          <p className="text-gray-700 mb-4">
            You authorize Njordships to conduct comprehensive background checks including:
          </p>
          <ul className="list-disc ml-6 text-gray-700 mb-4">
            <li>Employment history verification</li>
            <li>Educational credential verification</li>
            <li>Criminal record checks</li>
            <li>Medical fitness assessments</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">4. Employment Terms</h2>
          <p className="text-gray-700 mb-4">
            Submission of an application does not guarantee employment. All positions are subject to:
          </p>
          <ul className="list-disc ml-6 text-gray-700 mb-4">
            <li>Successful verification of credentials</li>
            <li>Vessel availability and requirements</li>
            <li>Medical clearance</li>
            <li>Compliance with maritime regulations</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">5. Liability</h2>
          <p className="text-gray-700 mb-4">
            Njordships is not liable for:
          </p>
          <ul className="list-disc ml-6 text-gray-700 mb-4">
            <li>Application processing delays</li>
            <li>Third-party verification processes</li>
            <li>Changes in vessel requirements</li>
            <li>Unforeseen circumstances affecting employment</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">6. Termination</h2>
          <p className="text-gray-700 mb-4">
            We reserve the right to reject or terminate any application if:
          </p>
          <ul className="list-disc ml-6 text-gray-700 mb-4">
            <li>False information is discovered</li>
            <li>Required documentation is not provided</li>
            <li>You fail to meet maritime standards</li>
            <li>You violate these terms</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">7. Contact Information</h2>
          <p className="text-gray-700 mb-4">
            For questions about these terms, contact: <strong>legal@njordships.com</strong>
          </p>
        </div>

        <div className="mt-8 pt-6 border-t">
          <button
            onClick={() => window.close()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  )
}