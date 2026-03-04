import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SkillCard } from '../SkillCard'
import type { Skill } from '@skill-plant/shared'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

const mockSkill: Skill = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'PDF Analyzer',
  description: 'Analyzes PDF documents and extracts key information',
  content: 'skill content',
  source: 'github',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

describe('SkillCard', () => {
  test('renders skill name', () => {
    render(<SkillCard skill={mockSkill} />)
    expect(screen.getByText('PDF Analyzer')).toBeInTheDocument()
  })

  test('renders skill description', () => {
    render(<SkillCard skill={mockSkill} />)
    expect(screen.getByText('Analyzes PDF documents and extracts key information')).toBeInTheDocument()
  })

  test('renders source badge', () => {
    render(<SkillCard skill={mockSkill} />)
    expect(screen.getByText('github')).toBeInTheDocument()
  })

  test('renders Run Skill button with correct link', () => {
    render(<SkillCard skill={mockSkill} />)
    const link = screen.getByRole('link', { name: /run skill/i })
    expect(link).toHaveAttribute('href', `/run/${mockSkill.id}`)
  })

  test('renders different source badges', () => {
    const builtinSkill = { ...mockSkill, source: 'builtin' as const }
    render(<SkillCard skill={builtinSkill} />)
    expect(screen.getByText('builtin')).toBeInTheDocument()
  })

  test('renders upload source badge', () => {
    const uploadSkill = { ...mockSkill, source: 'upload' as const }
    render(<SkillCard skill={uploadSkill} />)
    expect(screen.getByText('upload')).toBeInTheDocument()
  })
})
