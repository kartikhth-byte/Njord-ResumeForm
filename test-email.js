/* global process */
import { Resend } from 'resend';

// SECURITY: never hardcode the API key here — a previous key was committed to
// git history and must be treated as compromised (rotate it in Resend).
// Run with: RESEND_API_KEY=re_xxx node test-email.js
const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error('Set RESEND_API_KEY in the environment before running this script.');
  process.exit(1);
}
const resend = new Resend(apiKey);

async function testEmail() {
  try {
    console.log('🚀 Attempting to send email...');
    
    const { data, error } = await resend.emails.send({
      from: 'Njordships <onboarding@resend.dev>',
      to: ['kartik.hth@gmail.com'],
      subject: 'Test Email from Njordships',
      html: `
        <h1>Test Email</h1>
        <p>If you receive this, your Resend setup is working!</p>
        <p>✅ API Key is correct</p>
        <p>✅ Email sending works</p>
      `
    });

    if (error) {
      console.error('❌ Resend API Error:');
      console.error('Error Code:', error.name);
      console.error('Error Message:', error.message);
      console.error('Full Error:', error);
      return;
    }

    if (data) {
      console.log('✅ Email sent successfully!');
      console.log('📧 Email ID:', data.id);
      console.log('📊 Full Response:', data);
    } else {
      console.error('❌ No data returned from API');
    }
    
  } catch (error) {
    console.error('❌ Unexpected Error:');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    console.error('Full Error:', error);
  }
}

console.log('📧 Starting email test...');
testEmail();