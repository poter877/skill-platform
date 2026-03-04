import { describe, test, expect, mock } from 'bun:test'

// Mock the AI SDK providers before importing
mock.module('@ai-sdk/anthropic', () => ({
  anthropic: (model: string) => ({ provider: 'anthropic', model }),
}))
mock.module('@ai-sdk/openai', () => ({
  openai: (model: string) => ({ provider: 'openai', model }),
}))
mock.module('@ai-sdk/google', () => ({
  google: (model: string) => ({ provider: 'google', model }),
}))

const { getModel, SKILL_GENERATION_SYSTEM, SCHEMA_ANALYSIS_SYSTEM } = await import('../ai')

describe('getModel', () => {
  test('returns anthropic model for claude-sonnet-4-5', () => {
    const model = getModel('claude-sonnet-4-5') as unknown as { provider: string; model: string }
    expect(model.provider).toBe('anthropic')
    expect(model.model).toBe('claude-sonnet-4-5')
  })

  test('returns openai model for gpt-5', () => {
    const model = getModel('gpt-5') as unknown as { provider: string; model: string }
    expect(model.provider).toBe('openai')
    expect(model.model).toBe('gpt-5')
  })

  test('returns google model for gemini-2.0-flash', () => {
    const model = getModel('gemini-2.0-flash') as unknown as { provider: string; model: string }
    expect(model.provider).toBe('google')
    expect(model.model).toBe('gemini-2.0-flash')
  })
})

describe('System prompts', () => {
  test('SKILL_GENERATION_SYSTEM is non-empty', () => {
    expect(SKILL_GENERATION_SYSTEM.length).toBeGreaterThan(0)
  })

  test('SKILL_GENERATION_SYSTEM mentions SKILL.md', () => {
    expect(SKILL_GENERATION_SYSTEM).toContain('SKILL.md')
  })

  test('SCHEMA_ANALYSIS_SYSTEM is non-empty', () => {
    expect(SCHEMA_ANALYSIS_SYSTEM.length).toBeGreaterThan(0)
  })

  test('SCHEMA_ANALYSIS_SYSTEM mentions JSON', () => {
    expect(SCHEMA_ANALYSIS_SYSTEM).toContain('JSON')
  })
})
