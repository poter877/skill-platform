import { describe, test, expect } from 'bun:test'
import { GenerateSkillSchema, ImportGithubSkillSchema, InputSchemaResponse } from '../form'

describe('GenerateSkillSchema', () => {
  test('parses valid request with default model', () => {
    const result = GenerateSkillSchema.parse({ description: 'Create a PDF analyzer skill' })
    expect(result.description).toBe('Create a PDF analyzer skill')
    expect(result.model).toBe('gpt-5')
  })

  test('accepts explicit model', () => {
    const result = GenerateSkillSchema.parse({
      description: 'Create a skill',
      model: 'gpt-5',
    })
    expect(result.model).toBe('gpt-5')
  })

  test('accepts all valid models', () => {
    const models = ['gpt-5', 'claude-sonnet-4-5', 'gemini-2.0-flash'] as const
    for (const model of models) {
      const result = GenerateSkillSchema.parse({ description: 'A valid desc.', model })
      expect(result.model).toBe(model)
    }
  })

  test('rejects description shorter than 10 characters', () => {
    expect(() => GenerateSkillSchema.parse({ description: 'short' })).toThrow()
  })

  test('rejects invalid model', () => {
    expect(() =>
      GenerateSkillSchema.parse({ description: 'A valid description', model: 'llama-3' })
    ).toThrow()
  })
})

describe('ImportGithubSkillSchema', () => {
  test('parses valid GitHub URL', () => {
    const result = ImportGithubSkillSchema.parse({
      url: 'https://github.com/anthropics/skills/tree/main/skills/pdf',
    })
    expect(result.url).toContain('github.com')
  })

  test('rejects non-GitHub URL', () => {
    expect(() =>
      ImportGithubSkillSchema.parse({ url: 'https://gitlab.com/some/repo' })
    ).toThrow()
  })

  test('rejects invalid URL', () => {
    expect(() =>
      ImportGithubSkillSchema.parse({ url: 'not-a-url' })
    ).toThrow()
  })
})

describe('InputSchemaResponse', () => {
  test('parses valid response with fields', () => {
    const result = InputSchemaResponse.parse({
      fields: [
        { name: 'input_file', type: 'file', label: 'Input File', required: true },
        { name: 'format', type: 'select', label: 'Format', options: ['json', 'csv'] },
      ],
    })
    expect(result.fields).toHaveLength(2)
  })

  test('parses empty fields array', () => {
    const result = InputSchemaResponse.parse({ fields: [] })
    expect(result.fields).toEqual([])
  })

  test('rejects invalid field in array', () => {
    expect(() =>
      InputSchemaResponse.parse({
        fields: [{ name: 'bad', type: 'invalid_type', label: 'Bad' }],
      })
    ).toThrow()
  })
})
