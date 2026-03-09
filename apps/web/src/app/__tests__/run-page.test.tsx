import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import RunSkillPage from '../run/[id]/page'
import type { Skill, InputSchemaResponseType } from '@skill-plant/shared'

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'skill-123' }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  API_BASE_URL: 'http://localhost:3001',
}))

vi.mock('@/components/DynamicForm', () => ({
  DynamicForm: ({ onSubmit }: { onSubmit: (inputs: Record<string, string>) => void }) => (
    <button onClick={() => onSubmit({})}>Run Skill</button>
  ),
}))

vi.mock('@/hooks/useJobStream', () => ({
  useJobStream: vi.fn(),
}))

import { apiGet, apiPost } from '@/lib/api'
import { useJobStream } from '@/hooks/useJobStream'
const mockApiGet = vi.mocked(apiGet)
const mockApiPost = vi.mocked(apiPost)
const mockUseJobStream = vi.mocked(useJobStream)

const SKILL: Skill = {
  id: 'skill-123',
  name: 'CSV Analyzer',
  description: 'Analyzes CSV files and outputs statistics',
  content: '# CSV Analyzer',
  source: 'github',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const SCHEMA: InputSchemaResponseType = { fields: [] }

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  mockApiGet.mockReset()
  mockApiPost.mockReset()
  mockUseJobStream.mockReturnValue({ events: [], done: false })
})

describe('RunSkillPage', () => {
  test('shows loading state while queries are pending', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}))
    mockApiPost.mockReturnValue(new Promise(() => {}))
    render(<RunSkillPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  test('shows error fallback when skill fetch fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockApiGet.mockRejectedValue(new Error('Not found'))
    mockApiPost.mockResolvedValue(SCHEMA)
    render(<RunSkillPage />, { wrapper: createWrapper() })
    await waitFor(() =>
      expect(screen.getByText('Skill not found')).toBeInTheDocument()
    )
    consoleSpy.mockRestore()
  })

  test('renders skill name and description when data loads', async () => {
    mockApiGet.mockResolvedValue(SKILL)
    mockApiPost.mockResolvedValue(SCHEMA)
    render(<RunSkillPage />, { wrapper: createWrapper() })
    await waitFor(() => expect(screen.getByText('CSV Analyzer')).toBeInTheDocument())
    expect(screen.getByText('Analyzes CSV files and outputs statistics')).toBeInTheDocument()
  })

  test('shows run form before job is submitted', async () => {
    mockApiGet.mockResolvedValue(SKILL)
    mockApiPost.mockResolvedValue(SCHEMA)
    render(<RunSkillPage />, { wrapper: createWrapper() })
    await waitFor(() => expect(screen.getByText('Run Skill')).toBeInTheDocument())
  })

  test('shows output panel with Running badge after submitting', async () => {
    mockApiGet.mockResolvedValue(SKILL)
    mockApiPost.mockImplementation((url: string) => {
      if (url.includes('analyze')) return Promise.resolve(SCHEMA)
      return Promise.resolve({ id: 'job-1', skillId: 'skill-123', status: 'pending', inputs: {}, output: null, errorMessage: null, createdAt: new Date(), updatedAt: new Date() })
    })
    render(<RunSkillPage />, { wrapper: createWrapper() })
    await waitFor(() => expect(screen.getByText('Run Skill')).toBeInTheDocument())

    await userEvent.click(screen.getByText('Run Skill'))

    await waitFor(() => expect(screen.getByText('Output')).toBeInTheDocument())
    expect(screen.getByText('Running...')).toBeInTheDocument()
  })

  test('shows Done badge when stream completes without error', async () => {
    mockUseJobStream.mockReturnValue({
      events: [{ type: 'complete', output: 'All done!', seq: 0 }],
      done: true,
    })
    mockApiGet.mockResolvedValue(SKILL)
    mockApiPost.mockImplementation((url: string) => {
      if (url.includes('analyze')) return Promise.resolve(SCHEMA)
      return Promise.resolve({ id: 'job-1', skillId: 'skill-123', status: 'done', inputs: {}, output: null, errorMessage: null, createdAt: new Date(), updatedAt: new Date() })
    })
    render(<RunSkillPage />, { wrapper: createWrapper() })
    await waitFor(() => expect(screen.getByText('Run Skill')).toBeInTheDocument())

    await userEvent.click(screen.getByText('Run Skill'))

    await waitFor(() => expect(screen.getByText('Done')).toBeInTheDocument())
    expect(screen.getByText('All done!')).toBeInTheDocument()
  })

  test('shows Failed badge when stream receives an error event', async () => {
    mockUseJobStream.mockReturnValue({
      events: [{ type: 'error', error: 'Job crashed', seq: 0 }],
      done: true,
    })
    mockApiGet.mockResolvedValue(SKILL)
    mockApiPost.mockImplementation((url: string) => {
      if (url.includes('analyze')) return Promise.resolve(SCHEMA)
      return Promise.resolve({ id: 'job-1', skillId: 'skill-123', status: 'failed', inputs: {}, output: null, errorMessage: null, createdAt: new Date(), updatedAt: new Date() })
    })
    render(<RunSkillPage />, { wrapper: createWrapper() })
    await waitFor(() => expect(screen.getByText('Run Skill')).toBeInTheDocument())

    await userEvent.click(screen.getByText('Run Skill'))

    await waitFor(() => expect(screen.getByText('Failed')).toBeInTheDocument())
    expect(screen.getByText('Error: Job crashed')).toBeInTheDocument()
  })

  test('renders status events as arrow-prefixed lines in output panel', async () => {
    mockUseJobStream.mockReturnValue({
      events: [{ type: 'status', status: 'running', seq: 0 }],
      done: false,
    })
    mockApiGet.mockResolvedValue(SKILL)
    mockApiPost.mockImplementation((url: string) => {
      if (url.includes('analyze')) return Promise.resolve(SCHEMA)
      return Promise.resolve({ id: 'job-1', skillId: 'skill-123', status: 'pending', inputs: {}, output: null, errorMessage: null, createdAt: new Date(), updatedAt: new Date() })
    })
    render(<RunSkillPage />, { wrapper: createWrapper() })
    await waitFor(() => expect(screen.getByText('Run Skill')).toBeInTheDocument())

    await userEvent.click(screen.getByText('Run Skill'))

    await waitFor(() => expect(screen.getByText('→ running')).toBeInTheDocument())
  })

  test('shows submit error message when job creation fails', async () => {
    mockApiGet.mockResolvedValue(SKILL)
    mockApiPost.mockImplementation((url: string) => {
      if (url.includes('analyze')) return Promise.resolve(SCHEMA)
      return Promise.reject(new Error('Queue unavailable'))
    })
    render(<RunSkillPage />, { wrapper: createWrapper() })
    await waitFor(() => expect(screen.getByText('Run Skill')).toBeInTheDocument())

    await userEvent.click(screen.getByText('Run Skill'))

    await waitFor(() =>
      expect(screen.getByText('Queue unavailable')).toBeInTheDocument()
    )
    // Form stays visible — job was not started
    expect(screen.getByText('Run Skill')).toBeInTheDocument()
  })
})
