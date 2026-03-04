import { describe, test, expect, mock, beforeEach } from 'bun:test'

const mockSaveUpload = mock(() =>
  Promise.resolve({ path: '/tmp/skill-plant-uploads/key/test.pdf', key: 'test-key' })
)

mock.module('../../lib/storage', () => ({
  saveUpload: mockSaveUpload,
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

const { uploadsRouter } = await import('../uploads')

describe('POST /uploads', () => {
  beforeEach(() => {
    mockSaveUpload.mockClear()
  })

  test('returns 200 with path and key on valid upload', async () => {
    const formData = new FormData()
    formData.append('file', new File(['content'], 'test.pdf', { type: 'application/pdf' }))

    const res = await uploadsRouter.request('/', {
      method: 'POST',
      body: formData,
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { key: string; filename: string; path: string }
    expect(body.key).toBe('test-key')
    expect(body.filename).toBe('test.pdf')
    expect(body.path).toContain('test.pdf')
  })

  test('returns 400 when no file provided', async () => {
    const formData = new FormData()

    const res = await uploadsRouter.request('/', {
      method: 'POST',
      body: formData,
    })

    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('No file provided')
  })
})
