import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { TEST_SKILL } from '../../test/helpers'

// Mock dependencies
const mockSelectWhere = mock()
const mockUpdateSet = mock(() => ({ where: mock(() => Promise.resolve()) }))
const mockReturning = mock()
const mockInsertValues = mock(() => ({ returning: mockReturning }))

mock.module('../../db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: mockSelectWhere,
      }),
    }),
    update: () => ({ set: mockUpdateSet }),
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

const mockStreamText = mock()
const mockGenerateText = mock()

mock.module('ai', () => ({
  streamText: mockStreamText,
  generateText: mockGenerateText,
  Output: {
    object: (opts: unknown) => opts,
  },
}))

mock.module('../../lib/ai', () => ({
  getModel: () => ({ provider: 'mock', model: 'mock' }),
  SKILL_GENERATION_SYSTEM: 'system prompt',
  SCHEMA_ANALYSIS_SYSTEM: 'analysis prompt',
}))

const { aiRouter } = await import('../ai')

describe('POST /ai/analyze/:skillId', () => {
  beforeEach(() => {
    mockSelectWhere.mockClear()
    mockGenerateText.mockClear()
    mockUpdateSet.mockClear()
  })

  test('returns cached schema if inputs exist', async () => {
    const skillWithInputs = {
      ...TEST_SKILL,
      inputs: [{ name: 'f', type: 'text', label: 'F', required: false }],
    }
    mockSelectWhere.mockResolvedValueOnce([skillWithInputs])

    const res = await aiRouter.request(`/analyze/${TEST_SKILL.id}`, {
      method: 'POST',
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { fields: unknown[] }
    expect(body.fields).toHaveLength(1)
    expect(mockGenerateText).not.toHaveBeenCalled()
  })

  test('returns 404 when skill not found', async () => {
    mockSelectWhere.mockResolvedValueOnce([])

    const res = await aiRouter.request('/analyze/nonexistent', {
      method: 'POST',
    })

    expect(res.status).toBe(404)
  })

  test('generates schema and caches it when not cached', async () => {
    const skillWithoutInputs = { ...TEST_SKILL, inputs: null }
    mockSelectWhere.mockResolvedValueOnce([skillWithoutInputs])
    const generatedFields = [{ name: 'instruction', type: 'textarea', label: 'Instruction', required: true, placeholder: null, accept: null, options: null, default: null }]
    mockGenerateText.mockResolvedValueOnce({ output: { fields: generatedFields } })

    const res = await aiRouter.request(`/analyze/${TEST_SKILL.id}`, {
      method: 'POST',
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { fields: unknown[] }
    expect(body.fields).toHaveLength(1)
    expect(mockUpdateSet).toHaveBeenCalled()
  })
})

describe('POST /ai/generate/save', () => {
  beforeEach(() => {
    mockReturning.mockClear()
    mockInsertValues.mockClear()
  })

  test('saves skill and returns 201', async () => {
    const savedSkill = { ...TEST_SKILL, source: 'upload' }
    mockReturning.mockResolvedValueOnce([savedSkill])

    const content = `---\nname: my-skill\ndescription: Does things\n---\nContent here`
    const res = await aiRouter.request('/generate/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })

    expect(res.status).toBe(201)
  })

  test('returns 400 for empty content', async () => {
    const res = await aiRouter.request('/generate/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    })

    expect(res.status).toBe(400)
  })
})
