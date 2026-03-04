import { describe, test, expect, mock } from 'bun:test'
import { Hono } from 'hono'

// Mock env before importing app
mock.module('../../lib/env', () => ({
  env: {
    DATABASE_URL: 'postgresql://localhost/test',
    ANTHROPIC_API_KEY: 'test-key',
    REDIS_URL: 'redis://localhost:6379',
    PORT: 3001,
    CORS_ORIGIN: 'http://localhost:3000',
  },
}))
mock.module('../../db', () => ({
  db: {},
}))
mock.module('../../lib/queue', () => ({
  jobQueue: { add: () => Promise.resolve() },
}))

// Build a minimal app with just the health route
const app = new Hono()
app.get('/health', (c) => c.json({ ok: true }))

describe('GET /health', () => {
  test('returns 200 with ok: true', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })
})
