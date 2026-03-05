import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { TEST_SKILL } from '../../test/helpers'

// Set up mocks
const mockSelectWhere = mock()
const mockSelectFrom = mock(() => ({
  where: mockSelectWhere,
}))
const mockReturning = mock()
const mockValues = mock(() => ({ returning: mockReturning }))
const mockDeleteReturning = mock()
const mockDeleteWhere = mock(() => ({ returning: mockDeleteReturning }))

mock.module('../../db', () => ({
  db: {
    select: () => ({ from: mockSelectFrom }),
    insert: () => ({ values: mockValues }),
    delete: () => ({ where: mockDeleteWhere }),
  },
}))

mock.module('../../lib/env', () => ({
  env: {
    DATABASE_URL: 'postgresql://localhost/test',
    ANTHROPIC_API_KEY: 'test-key',
    REDIS_URL: 'redis://localhost:6379',
    PORT: 3001,
    CORS_ORIGIN: 'http://localhost:3000',
  },
}))

const { skillsRouter } = await import('../skills')

describe('GET /skills', () => {
  beforeEach(() => {
    mockSelectFrom.mockClear()
    mockSelectWhere.mockClear()
  })

  test('returns 200 with list of skills', async () => {
    mockSelectFrom.mockReturnValueOnce([TEST_SKILL])
    const res = await skillsRouter.request('/')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('returns 500 on db error', async () => {
    mockSelectFrom.mockImplementationOnce(() => { throw new Error('DB error') })
    const res = await skillsRouter.request('/')
    expect(res.status).toBe(500)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Internal server error')
  })
})

describe('GET /skills/:id', () => {
  beforeEach(() => {
    mockSelectWhere.mockClear()
  })

  test('returns 200 with skill', async () => {
    mockSelectWhere.mockResolvedValueOnce([TEST_SKILL])
    const res = await skillsRouter.request(`/${TEST_SKILL.id}`)
    expect(res.status).toBe(200)
  })

  test('returns 404 when not found', async () => {
    mockSelectWhere.mockResolvedValueOnce([])
    const res = await skillsRouter.request('/nonexistent-id')
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Not found')
  })
})

describe('POST /skills/import/github', () => {
  beforeEach(() => {
    mockReturning.mockClear()
    mockValues.mockClear()
  })

  test('returns 201 on successful import', async () => {
    const skillContent = `---\nname: test-skill\ndescription: A test\n---\nContent`
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(skillContent, { status: 200 }))
    ) as typeof fetch
    mockReturning.mockResolvedValueOnce([TEST_SKILL])

    const res = await skillsRouter.request('/import/github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/anthropics/skills/tree/main/skills/pdf' }),
    })

    expect(res.status).toBe(201)
    globalThis.fetch = originalFetch
  })

  test('returns 400 on failed GitHub fetch', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('Not Found', { status: 404 }))
    ) as typeof fetch

    const res = await skillsRouter.request('/import/github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/bad/repo' }),
    })

    expect(res.status).toBe(400)
    globalThis.fetch = originalFetch
  })

  test('returns 400 for non-GitHub URL', async () => {
    const res = await skillsRouter.request('/import/github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://gitlab.com/some/repo' }),
    })

    expect(res.status).toBe(400)
  })
})

describe('DELETE /skills/:id', () => {
  beforeEach(() => {
    mockDeleteWhere.mockClear()
    mockDeleteReturning.mockClear()
  })

  test('returns 200 on successful delete', async () => {
    mockDeleteReturning.mockResolvedValueOnce([TEST_SKILL])
    const res = await skillsRouter.request(`/${TEST_SKILL.id}`, { method: 'DELETE' })
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  test('returns 404 when skill does not exist', async () => {
    mockDeleteReturning.mockResolvedValueOnce([])
    const res = await skillsRouter.request('/nonexistent-id', { method: 'DELETE' })
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Not found')
  })

  test('returns 500 on db error', async () => {
    mockDeleteReturning.mockRejectedValueOnce(new Error('DB error'))
    const res = await skillsRouter.request('/some-id', { method: 'DELETE' })
    expect(res.status).toBe(500)
  })
})
