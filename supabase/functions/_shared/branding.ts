// Company branding for candidate-facing emails.
// Holmes is the product; the hiring company is configured per deployment:
//   supabase secrets set COMPANY_NAME="Acme Crewing" CONTACT_EMAIL="crew@acme.com"
// With nothing set, emails stay neutral (no company name, no contact line).
const company = (Deno.env.get('COMPANY_NAME') || '').trim()
const contactEmail = (Deno.env.get('CONTACT_EMAIL') || '').trim()

const contactLink = contactEmail
  ? `<a href="mailto:${contactEmail}" style="color: #b75a39; text-decoration: none;">${contactEmail}</a>`
  : ''

export const BRAND = {
  company,
  /** Email header title. */
  name: company || 'Holmes',
  /** "Best regards," signature line. */
  team: company ? `${company} Recruitment Team` : 'Recruitment Team',
  /** Sender display name for the From header. */
  sender: company ? `${company} Recruitment` : 'Holmes',
  /** " at Company" / " with Company" / " from Company", or '' when unset. */
  at: company ? ` at ${company}` : '',
  with: company ? ` with ${company}` : '',
  from: company ? ` from ${company}` : '',
  contactEmail,
  /** Inline contact link HTML, or '' when unset. */
  contactLink,
}
