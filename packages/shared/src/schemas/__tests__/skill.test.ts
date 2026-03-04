import { describe, test, expect } from 'bun:test'
import { FormFieldSchema, SkillSchema } from '../skill'

describe('FormFieldSchema', () => {
  test('parses valid text field', () => {
    const result = FormFieldSchema.parse({
      name: 'title',
      type: 'text',
      label: 'Title',
    })
    expect(result.name).toBe('title')
    expect(result.type).toBe('text')
    expect(result.required).toBe(false)
  })

  test('parses valid field with all optional fields', () => {
    const result = FormFieldSchema.parse({
      name: 'upload',
      type: 'file',
      label: 'Upload File',
      required: true,
      placeholder: 'Choose a file',
      accept: ['.pdf', '.txt'],
      default: 'default.txt',
    })
    expect(result.required).toBe(true)
    expect(result.accept).toEqual(['.pdf', '.txt'])
    expect(result.placeholder).toBe('Choose a file')
  })

  test('accepts all valid field types', () => {
    const types = ['file', 'text', 'textarea', 'select', 'multiselect', 'number', 'url'] as const
    for (const type of types) {
      const result = FormFieldSchema.parse({ name: 'f', type, label: 'F' })
      expect(result.type).toBe(type)
    }
  })

  test('rejects invalid field type', () => {
    expect(() =>
      FormFieldSchema.parse({ name: 'f', type: 'checkbox', label: 'F' })
    ).toThrow()
  })

  test('rejects missing required fields', () => {
    expect(() => FormFieldSchema.parse({ name: 'f' })).toThrow()
    expect(() => FormFieldSchema.parse({ type: 'text', label: 'L' })).toThrow()
  })

  test('defaults required to false', () => {
    const result = FormFieldSchema.parse({ name: 'f', type: 'text', label: 'F' })
    expect(result.required).toBe(false)
  })

  test('parses select field with options', () => {
    const result = FormFieldSchema.parse({
      name: 'lang',
      type: 'select',
      label: 'Language',
      options: ['en', 'fr', 'de'],
    })
    expect(result.options).toEqual(['en', 'fr', 'de'])
  })
})

describe('SkillSchema', () => {
  const validSkill = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'test-skill',
    description: 'A test skill',
    content: '---\nname: test\n---\nContent here',
    source: 'github' as const,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  }

  test('parses valid skill', () => {
    const result = SkillSchema.parse(validSkill)
    expect(result.name).toBe('test-skill')
    expect(result.source).toBe('github')
  })

  test('coerces date strings to Date objects', () => {
    const result = SkillSchema.parse(validSkill)
    expect(result.createdAt).toBeInstanceOf(Date)
    expect(result.updatedAt).toBeInstanceOf(Date)
  })

  test('accepts optional inputs array', () => {
    const result = SkillSchema.parse({
      ...validSkill,
      inputs: [{ name: 'f', type: 'text', label: 'F' }],
    })
    expect(result.inputs).toHaveLength(1)
  })

  test('accepts optional githubUrl', () => {
    const result = SkillSchema.parse({
      ...validSkill,
      githubUrl: 'https://github.com/anthropics/skills',
    })
    expect(result.githubUrl).toBe('https://github.com/anthropics/skills')
  })

  test('rejects invalid source', () => {
    expect(() => SkillSchema.parse({ ...validSkill, source: 'npm' })).toThrow()
  })

  test('rejects invalid UUID', () => {
    expect(() => SkillSchema.parse({ ...validSkill, id: 'not-a-uuid' })).toThrow()
  })
})
