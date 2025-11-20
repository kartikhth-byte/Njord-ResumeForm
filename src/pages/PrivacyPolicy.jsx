export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
        
        <div className="prose prose-blue max-w-none">
          <p className="text-gray-600 mb-4">
            <strong>Last Updated:</strong> November 8, 2025
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">1. Information We Collect</h2>
          <p className="text-gray-700 mb-4">
            We collect personal information that you provide to us including:
          </p>
          <ul className="list-disc ml-6 text-gray-700 mb-4">
            <li>Name, contact details, and date of birth</li>
            <li>Employment history and qualifications</li>
            <li>Certificates and documentation</li>
            <li>Medical and vaccination records</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">2. How We Use Your Information</h2>
          <p className="text-gray-700 mb-4">
            We use your information to:
          </p>
          <ul className="list-disc ml-6 text-gray-700 mb-4">
            <li>Process your job application</li>
            <li>Verify your credentials and qualifications</li>
            <li>Communicate with you about opportunities</li>
            <li>Comply with maritime regulations</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">3. Data Security</h2>
          <p className="text-gray-700 mb-4">
            We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">4. Your Rights</h2>
          <p className="text-gray-700 mb-4">
            You have the right to:
          </p>
          <ul className="list-disc ml-6 text-gray-700 mb-4">
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Withdraw consent at any time</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">5. Contact Us</h2>
          <p className="text-gray-700 mb-4">
            For privacy-related questions, contact us at: <strong>privacy@njordships.com</strong>
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