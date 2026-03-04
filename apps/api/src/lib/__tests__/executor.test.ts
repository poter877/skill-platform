import { describe, test, expect, mock, beforeEach } from 'bun:test'

// Mock db and env before importing
const mockSelect = mock()
const mockFrom = mock()
const mockWhere = mock()
const mockMkdir = mock(() => Promise.resolve(undefined))
const mockWriteFile = mock(() => Promise.resolve(undefined))

mock.module('node:fs/promises', () => ({
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
}))

mock.module('../../db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: mockWhere,
      }),
    }),
  },
}))

mock.module('../env', () => ({
  env: { ANTHROPIC_API_KEY: 'test-key' },
}))

const { buildPrompt } = await import('../executor')

describe('buildPrompt', () => {
  test('formats basic prompt with skill name', () => {
    const result = buildPrompt('pdf-analyzer', {})
    expect(result).toBe('Use the pdf-analyzer skill.')
  })

  test('includes non-instruction inputs as key-value pairs', () => {
    const result = buildPrompt('translator', {
      source_lang: 'English',
      target_lang: 'French',
    })
    expect(result).toContain('Use the translator skill.')
    expect(result).toContain('source_lang: English')
    expect(result).toContain('target_lang: French')
  })

  test('appends instruction at the end', () => {
    const result = buildPrompt('general', {
      instruction: 'Summarize this document',
    })
    const lines = result.split('\n')
    expect(lines[0]).toBe('Use the general skill.')
    expect(lines[lines.length - 1]).toBe('Summarize this document')
  })

  test('handles mixed inputs with instruction', () => {
    const result = buildPrompt('writer', {
      format: 'markdown',
      instruction: 'Write a blog post',
    })
    expect(result).toContain('format: markdown')
    expect(result).toContain('Write a blog post')
    // instruction should not appear as "instruction: Write a blog post"
    expect(result).not.toContain('instruction: Write a blog post')
  })

  test('handles empty inputs', () => {
    const result = buildPrompt('skill', {})
    expect(result).toBe('Use the skill skill.')
  })
})
