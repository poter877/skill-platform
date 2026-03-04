import { mock } from 'bun:test'

// Common test data
export const TEST_SKILL = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'test-skill',
  description: 'A test skill for testing',
  content: '---\nname: test-skill\ndescription: A test skill\n---\n\nDo the thing.',
  inputs: null,
  source: 'github',
  githubUrl: 'https://github.com/test/skill',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

export const TEST_JOB = {
  id: '660e8400-e29b-41d4-a716-446655440000',
  skillId: TEST_SKILL.id,
  status: 'pending',
  inputs: { instruction: 'do something' },
  output: null,
  errorMessage: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

// Mock db builder
export function createMockDb() {
  const mockReturning = mock()
  const mockValues = mock(() => ({ returning: mockReturning }))
  const mockSet = mock()
  const mockWhere = mock()
  const mockFrom = mock()
  const mockOrderBy = mock()

  const selectFrom = mock(() => ({
    where: mockWhere,
    orderBy: mockOrderBy,
  }))

  return {
    db: {
      select: mock(() => ({ from: selectFrom })),
      insert: mock(() => ({ values: mockValues })),
      update: mock(() => ({ set: mockSet })),
      delete: mock(() => ({ where: mockWhere })),
    },
    mocks: { mockReturning, mockValues, mockSet, mockWhere, selectFrom, mockOrderBy },
  }
}

// Mock queue
export function createMockQueue() {
  return {
    jobQueue: {
      add: mock(() => Promise.resolve()),
    },
  }
}
