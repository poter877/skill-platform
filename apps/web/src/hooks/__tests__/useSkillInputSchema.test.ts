import { describe, test, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderHookWithClient } from './helpers'
import { useSkillInputSchema } from '../useSkillInputSchema'
import type { InputSchemaResponseType } from '@skill-plant/shared'

const mockSchema: InputSchemaResponseType = {
  fields: [
    { name: 'input_file', type: 'file', label: 'Input File', required: true },
    { name: 'format', type: 'select', label: 'Format', required: false, options: ['json', 'csv'] },
  ],
}

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  API_BASE_URL: 'http://localhost:3001',
}))

let apiPost: ReturnType<typeof vi.fn>

beforeEach(async () => {
  const api = await import('@/lib/api')
  apiPost = api.apiPost as unknown as ReturnType<typeof vi.fn>
  apiPost.mockReset()
})

describe('useSkillInputSchema', () => {
  test('returns loading state initially', () => {
    apiPost.mockReturnValue(new Promise(() => {}))
    const { result } = renderHookWithClient(() =>
      useSkillInputSchema('550e8400-e29b-41d4-a716-446655440000')
    )
    expect(result.current.isLoading).toBe(true)
  })

  test('returns schema data on success', async () => {
    apiPost.mockResolvedValue(mockSchema)
    const { result } = renderHookWithClient(() =>
      useSkillInputSchema('550e8400-e29b-41d4-a716-446655440000')
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data?.fields).toHaveLength(2)
  })

  test('is disabled when skillId is undefined', () => {
    const { result } = renderHookWithClient(() => useSkillInputSchema(undefined))
    expect(result.current.fetchStatus).toBe('idle')
    expect(apiPost).not.toHaveBeenCalled()
  })

  test('calls apiPost with correct path', async () => {
    apiPost.mockResolvedValue(mockSchema)
    const skillId = '550e8400-e29b-41d4-a716-446655440000'
    renderHookWithClient(() => useSkillInputSchema(skillId))

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(`/ai/analyze/${skillId}`, {})
    })
  })
})
