import { describe, test, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderHookWithClient } from './helpers'
import { useSkills, useSkill } from '../useSkills'
import type { Skill } from '@skill-plant/shared'

const mockSkills: Skill[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'test-skill',
    description: 'Test',
    content: 'content',
    source: 'github',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  API_BASE_URL: 'http://localhost:3001',
}))

let apiGet: ReturnType<typeof vi.fn>

beforeEach(async () => {
  const api = await import('@/lib/api')
  apiGet = api.apiGet as unknown as ReturnType<typeof vi.fn>
  apiGet.mockReset()
})

describe('useSkills', () => {
  test('returns loading state initially', () => {
    apiGet.mockReturnValue(new Promise(() => {}))
    const { result } = renderHookWithClient(() => useSkills())
    expect(result.current.isLoading).toBe(true)
  })

  test('returns data on success', async () => {
    apiGet.mockResolvedValue(mockSkills)
    const { result } = renderHookWithClient(() => useSkills())

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toEqual(mockSkills)
  })

  test('returns error on failure', async () => {
    apiGet.mockRejectedValue(new Error('Network error'))
    const { result } = renderHookWithClient(() => useSkills())

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error?.message).toBe('Network error')
  })
})

describe('useSkill', () => {
  test('fetches single skill by id', async () => {
    apiGet.mockResolvedValue(mockSkills[0])
    const { result } = renderHookWithClient(() =>
      useSkill('550e8400-e29b-41d4-a716-446655440000')
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data?.name).toBe('test-skill')
  })

  test('does not fetch when id is undefined', () => {
    const { result } = renderHookWithClient(() => useSkill(undefined))
    expect(result.current.fetchStatus).toBe('idle')
    expect(apiGet).not.toHaveBeenCalled()
  })
})
