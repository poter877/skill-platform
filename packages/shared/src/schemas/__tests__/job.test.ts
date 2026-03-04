import { describe, test, expect } from 'bun:test'
import { JobStatusSchema, JobSchema, CreateJobSchema } from '../job'

describe('JobStatusSchema', () => {
  test('accepts all valid statuses', () => {
    const statuses = ['pending', 'running', 'completed', 'failed'] as const
    for (const status of statuses) {
      expect(JobStatusSchema.parse(status)).toBe(status)
    }
  })

  test('rejects invalid status', () => {
    expect(() => JobStatusSchema.parse('cancelled')).toThrow()
  })
})

describe('JobSchema', () => {
  const validJob = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    skillId: '660e8400-e29b-41d4-a716-446655440000',
    status: 'pending' as const,
    inputs: { instruction: 'do something' },
    output: null,
    errorMessage: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  }

  test('parses valid job', () => {
    const result = JobSchema.parse(validJob)
    expect(result.id).toBe(validJob.id)
    expect(result.status).toBe('pending')
  })

  test('accepts null output and errorMessage', () => {
    const result = JobSchema.parse(validJob)
    expect(result.output).toBeNull()
    expect(result.errorMessage).toBeNull()
  })

  test('accepts string output', () => {
    const result = JobSchema.parse({ ...validJob, output: 'result here', status: 'completed' })
    expect(result.output).toBe('result here')
  })

  test('coerces dates', () => {
    const result = JobSchema.parse(validJob)
    expect(result.createdAt).toBeInstanceOf(Date)
  })

  test('rejects missing required fields', () => {
    expect(() => JobSchema.parse({ id: validJob.id })).toThrow()
  })
})

describe('CreateJobSchema', () => {
  test('parses valid create job request', () => {
    const result = CreateJobSchema.parse({
      skillId: '550e8400-e29b-41d4-a716-446655440000',
      inputs: { instruction: 'analyze this' },
    })
    expect(result.skillId).toBeTruthy()
    expect(result.inputs.instruction).toBe('analyze this')
  })

  test('rejects non-UUID skillId', () => {
    expect(() =>
      CreateJobSchema.parse({ skillId: 'abc', inputs: {} })
    ).toThrow()
  })

  test('accepts empty inputs', () => {
    const result = CreateJobSchema.parse({
      skillId: '550e8400-e29b-41d4-a716-446655440000',
      inputs: {},
    })
    expect(result.inputs).toEqual({})
  })
})
