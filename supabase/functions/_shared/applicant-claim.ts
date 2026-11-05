export async function claimTokenFingerprint(tokenHash: string): Promise<string> {
  const bytes = new TextEncoder().encode(tokenHash)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
