import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createElement, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MarketplacePage from '../page'
import type { Skill } from '@skill-plant/shared'

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

vi.mock('@/components/SkillCard', () => ({
  SkillCard: ({ skill }: { skill: Skill }) => <div data-testid="skill-card">{skill.name}</div>,
}))

import { apiGet } from '@/lib/api'
const mockApiGet = vi.mocked(apiGet)

const makeSkill = (overrides: Partial<Skill>): Skill => ({
  id: '00000000-0000-0000-0000-000000000001',
  name: 'default-skill',
  description: 'default description',
  content: '',
  source: 'github',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const SKILLS: Skill[] = [
  makeSkill({ id: '1', name: 'csv-analyzer', description: 'Analyzes CSV files' }),
  makeSkill({ id: '2', name: 'image-resizer', description: 'Resizes images in bulk' }),
  makeSkill({ id: '3', name: 'pdf-extractor', description: 'Extracts text from PDF' }),
]

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  mockApiGet.mockReset()
})

describe('MarketplacePage search filter', () => {
  test('shows all skills when search is empty', async () => {
    mockApiGet.mockResolvedValue(SKILLS)
    render(<MarketplacePage />, { wrapper: createWrapper() })
    await waitFor(() => expect(screen.getAllByTestId('skill-card')).toHaveLength(3))
  })

  test('filters skills by name (case-insensitive)', async () => {
    mockApiGet.mockResolvedValue(SKILLS)
    render(<MarketplacePage />, { wrapper: createWrapper() })
    await waitFor(() => screen.getAllByTestId('skill-card'))

    await userEvent.type(screen.getByPlaceholderText('Search skills...'), 'CSV')
    expect(screen.getAllByTestId('skill-card')).toHaveLength(1)
    expect(screen.getByText('csv-analyzer')).toBeInTheDocument()
  })

  test('filters skills by description (case-insensitive)', async () => {
    mockApiGet.mockResolvedValue(SKILLS)
    render(<MarketplacePage />, { wrapper: createWrapper() })
    await waitFor(() => screen.getAllByTestId('skill-card'))

    await userEvent.type(screen.getByPlaceholderText('Search skills...'), 'bulk')
    expect(screen.getAllByTestId('skill-card')).toHaveLength(1)
    expect(screen.getByText('image-resizer')).toBeInTheDocument()
  })

  test('shows multiple matches when query matches several skills', async () => {
    mockApiGet.mockResolvedValue(SKILLS)
    render(<MarketplacePage />, { wrapper: createWrapper() })
    await waitFor(() => screen.getAllByTestId('skill-card'))

    // 'es' matches 'image-resizer' (name) and 'pdf-extractor' (description: 'Extracts')
    await userEvent.type(screen.getByPlaceholderText('Search skills...'), 'es')
    expect(screen.getAllByTestId('skill-card')).toHaveLength(2)
  })

  test('shows empty state when no skills match', async () => {
    mockApiGet.mockResolvedValue(SKILLS)
    render(<MarketplacePage />, { wrapper: createWrapper() })
    await waitFor(() => screen.getAllByTestId('skill-card'))

    await userEvent.type(screen.getByPlaceholderText('Search skills...'), 'zzznomatch')
    expect(screen.queryAllByTestId('skill-card')).toHaveLength(0)
    expect(screen.getByText(/No skills found/)).toBeInTheDocument()
  })

  test('shows loading state while fetching', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}))
    render(<MarketplacePage />, { wrapper: createWrapper() })
    expect(screen.getByText('Loading skills...')).toBeInTheDocument()
  })

  test('shows error state when request fails', async () => {
    // Suppress React's error boundary console output in this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockApiGet.mockRejectedValue(new Error('Network error'))
    render(<MarketplacePage />, { wrapper: createWrapper() })
    await waitFor(() =>
      expect(screen.getByText(/Failed to load skills/)).toBeInTheDocument()
    )
    consoleSpy.mockRestore()
  })
})
