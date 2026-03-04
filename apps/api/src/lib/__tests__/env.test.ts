import { describe, test, expect } from 'bun:test'
import { z } from 'zod'

// Replicate the EnvSchema here to avoid the module-level side effect
// (env.ts calls process.exit(1) if validation fails at import time)
const EnvSchema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
})

describe('EnvSchema', () => {
  const validEnv = {
    DATABASE_URL: 'postgresql://localhost:5432/test',
    ANTHROPIC_API_KEY: 'sk-ant-test-key',
  }

  test('parses valid env with required fields only', () => {
    const result = EnvSchema.parse(validEnv)
    expect(result.DATABASE_URL).toBe(validEnv.DATABASE_URL)
    expect(result.ANTHROPIC_API_KEY).toBe(validEnv.ANTHROPIC_API_KEY)
  })

  test('applies default PORT', () => {
    const result = EnvSchema.parse(validEnv)
    expect(result.PORT).toBe(3001)
  })

  test('applies default REDIS_URL', () => {
    const result = EnvSchema.parse(validEnv)
    expect(result.REDIS_URL).toBe('redis://localhost:6379')
  })

  test('applies default CORS_ORIGIN', () => {
    const result = EnvSchema.parse(validEnv)
    expect(result.CORS_ORIGIN).toBe('http://localhost:3000')
  })

  test('coerces PORT string to number', () => {
    const result = EnvSchema.parse({ ...validEnv, PORT: '4000' })
    expect(result.PORT).toBe(4000)
  })

  test('rejects missing DATABASE_URL', () => {
    expect(() => EnvSchema.parse({ ANTHROPIC_API_KEY: 'key' })).toThrow()
  })

  test('accepts missing ANTHROPIC_API_KEY', () => {
    const result = EnvSchema.parse({ DATABASE_URL: 'postgres://x' })
    expect(result.ANTHROPIC_API_KEY).toBeUndefined()
  })

  test('accepts optional API keys', () => {
    const result = EnvSchema.parse({
      ...validEnv,
      OPENAI_API_KEY: 'sk-openai',
      GOOGLE_GENERATIVE_AI_API_KEY: 'goog-key',
    })
    expect(result.OPENAI_API_KEY).toBe('sk-openai')
    expect(result.GOOGLE_GENERATIVE_AI_API_KEY).toBe('goog-key')
  })

  test('optional R2 fields are undefined when absent', () => {
    const result = EnvSchema.parse(validEnv)
    expect(result.R2_ACCOUNT_ID).toBeUndefined()
    expect(result.R2_ACCESS_KEY_ID).toBeUndefined()
    expect(result.R2_SECRET_ACCESS_KEY).toBeUndefined()
    expect(result.R2_BUCKET).toBeUndefined()
  })
})
