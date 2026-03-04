import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { TEST_JOB, TEST_SKILL } from '../../test/helpers'

// Mock dependencies
const mockSelectWhere = mock()
const mockSelectOrderBy = mock()
const mockSelectFrom = mock(() => ({
  where: mockSelectWhere,
  orderBy: mockSelectOrderBy,
}))
const mockReturning = mock()
const mockInsertValues = mock(() => ({ returning: mockReturning }))
const mockQueueAdd = mock(() => Promise.resolve())

mock.module('../../db', () => ({
  db: {
    select: () => ({ from: mockSelectFrom }),
    insert: () => ({ values: mockInsertValues }),
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

mock.module('../../lib/queue', () => ({
  jobQueue: { add: mockQueueAdd },
}))

const { jobsRouter } = await import('../jobs')

describe('POST /jobs', () => {
  beforeEach(() => {
    mockReturning.mockClear()
    mockInsertValues.mockClear()
    mockQueueAdd.mockClear()
  })

  test('creates job and enqueues it, returns 201', async () => {
    mockReturning.mockResolvedValueOnce([TEST_JOB])

    const res = await jobsRouter.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skillId: TEST_SKILL.id,
        inputs: { instruction: 'do something' },
      }),
    })

    expect(res.status).toBe(201)
    expect(mockQueueAdd).toHaveBeenCalledTimes(1)
    const body = await res.json() as { id: string }
    expect(body.id).toBe(TEST_JOB.id)
  })

  test('returns 400 for invalid skillId', async () => {
    const res = await jobsRouter.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skillId: 'not-a-uuid',
        inputs: {},
      }),
    })

    expect(res.status).toBe(400)
  })

  test('returns 400 for missing inputs', async () => {
    const res = await jobsRouter.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skillId: TEST_SKILL.id,
      }),
    })

    expect(res.status).toBe(400)
  })
})

describe('GET /jobs/:id', () => {
  beforeEach(() => {
    mockSelectWhere.mockClear()
  })

  test('returns 200 with job', async () => {
    mockSelectWhere.mockResolvedValueOnce([TEST_JOB])
    const res = await jobsRouter.request(`/${TEST_JOB.id}`)
    expect(res.status).toBe(200)
    const body = await res.json() as { id: string }
    expect(body.id).toBe(TEST_JOB.id)
  })

  test('returns 404 when not found', async () => {
    mockSelectWhere.mockResolvedValueOnce([])
    const res = await jobsRouter.request('/nonexistent')
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Not found')
  })
})

describe('GET /jobs', () => {
  beforeEach(() => {
    mockSelectOrderBy.mockClear()
  })

  test('returns 200 with list of jobs', async () => {
    mockSelectOrderBy.mockResolvedValueOnce([TEST_JOB])
    const res = await jobsRouter.request('/')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('returns 500 on db error', async () => {
    mockSelectOrderBy.mockRejectedValueOnce(new Error('DB error'))
    const res = await jobsRouter.request('/')
    expect(res.status).toBe(500)
  })
})
