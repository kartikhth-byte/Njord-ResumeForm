function namedKey(envName: string, name = 'default'): string {
  const raw = Deno.env.get(envName)
  if (!raw) return ''

  try {
    const keys = JSON.parse(raw)
    return typeof keys?.[name] === 'string' ? keys[name] : ''
  } catch {
    return ''
  }
}

export function getAdminApiKey(): string {
  return namedKey('SUPABASE_SECRET_KEYS') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
}

export function getPublicApiKey(): string {
  return namedKey('SUPABASE_PUBLISHABLE_KEYS') || Deno.env.get('SUPABASE_ANON_KEY') || ''
}

export function isValidPublicApiKey(value: string | null): boolean {
  if (!value) return false
  const publishable = namedKey('SUPABASE_PUBLISHABLE_KEYS')
  const legacy = Deno.env.get('SUPABASE_ANON_KEY')
  return value === publishable || Boolean(legacy && value === legacy)
}

export function isModernSecretKey(key: string): boolean {
  return key.startsWith('sb_secret_')
}

export function createAdminFetch(key: string) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined))
    if (headers.get('authorization') === `Bearer ${key}`) {
      headers.delete('authorization')
    }
    headers.set('apikey', key)
    return fetch(input, { ...init, headers })
  }
}
