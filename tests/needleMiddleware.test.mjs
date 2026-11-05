import test from 'node:test'
import assert from 'node:assert/strict'
import middleware, { config, needleOrigin, needleTarget } from '../middleware.js'

test('matcher covers /ai and everything under it', () => {
  assert.deepEqual(config.matcher, ['/ai', '/ai/:path*'])
})

test('NEEDLE_ORIGIN must be a bare https origin', () => {
  assert.equal(needleOrigin('https://njordhr.up.railway.app'), 'https://njordhr.up.railway.app')
  assert.equal(needleOrigin(' https://needle.example.com/ '), 'https://needle.example.com')
  for (const bad of ['', undefined, 'http://needle.example.com', 'https://needle.example.com/x', 'https://u:p@needle.example.com', 'https://needle.example.com/?a=1', 'not a url']) {
    assert.equal(needleOrigin(bad), null, String(bad))
  }
})

test('paths keep the /ai prefix and the query string', () => {
  const origin = 'https://needle.example.com'
  assert.equal(String(needleTarget('https://holmes.app/ai', origin)), 'https://needle.example.com/ai/')
  assert.equal(String(needleTarget('https://holmes.app/ai/?embed=holmes', origin)), 'https://needle.example.com/ai/?embed=holmes')
  assert.equal(String(needleTarget('https://holmes.app/ai/auth/me', origin)), 'https://needle.example.com/ai/auth/me')
  assert.equal(needleTarget('https://holmes.app/aix', origin), null)
})

test('no NEEDLE_ORIGIN: 404, never forwarded', async () => {
  const before = process.env.NEEDLE_ORIGIN
  delete process.env.NEEDLE_ORIGIN
  const response = middleware(new Request('https://preview.vercel.app/ai/auth/me'))
  assert.equal(response.status, 404)
  assert.equal(response.headers.get('x-middleware-rewrite'), null)
  if (before !== undefined) process.env.NEEDLE_ORIGIN = before
})

test('with NEEDLE_ORIGIN: production rewrites to Needle', () => {
  const before = process.env.NEEDLE_ORIGIN
  const beforeEnvironment = process.env.VERCEL_ENV
  try {
    process.env.VERCEL_ENV = 'production'
    process.env.NEEDLE_ORIGIN = 'https://needle.example.com'
    const response = middleware(new Request('https://holmes.app/ai/api/workspace/projects?x=1'))
    assert.equal(response.headers.get('x-middleware-rewrite'), 'https://needle.example.com/ai/api/workspace/projects?x=1')
  } finally {
    if (before === undefined) delete process.env.NEEDLE_ORIGIN
    else process.env.NEEDLE_ORIGIN = before
    if (beforeEnvironment === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = beforeEnvironment
  }
})

// Environment mistakes must not make an unreviewed preview search production.
test('preview never forwards, even if NEEDLE_ORIGIN was inherited', () => {
  const beforeOrigin = process.env.NEEDLE_ORIGIN
  const beforeEnvironment = process.env.VERCEL_ENV
  try {
    process.env.VERCEL_ENV = 'preview'
    process.env.NEEDLE_ORIGIN = 'https://njordhr.up.railway.app'
    const response = middleware(new Request('https://preview.vercel.app/ai/auth/me'))
    assert.equal(response.status, 404)
    assert.equal(response.headers.get('x-middleware-rewrite'), null)
  } finally {
    if (beforeOrigin === undefined) delete process.env.NEEDLE_ORIGIN
    else process.env.NEEDLE_ORIGIN = beforeOrigin
    if (beforeEnvironment === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = beforeEnvironment
  }
})
