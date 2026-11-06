import { importPKCS8, SignJWT } from 'npm:jose@5.9.6'
let cachedKey: CryptoKey | null = null
export async function signNeedleToken(userId: string, claims: Record<string, unknown>, purpose = 'session') {
  if (!cachedKey) {
    const pem = (Deno.env.get('NEEDLE_TOKEN_PRIVATE_KEY') || '').replace(/\\n/g, '\n').trim()
    if (!pem) throw new Error('Needle signing is not configured')
    cachedKey = await importPKCS8(pem, 'EdDSA')
  }
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ ...claims, purpose }).setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
    .setIssuer('holmes').setAudience(purpose === 'session' ? 'needle' : 'needle-api')
    .setSubject(userId).setIssuedAt(now).setExpirationTime(now + 120)
    .setJti(crypto.randomUUID()).sign(cachedKey)
}
