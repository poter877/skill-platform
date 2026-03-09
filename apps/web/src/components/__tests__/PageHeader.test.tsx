import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHeader } from '../PageHeader'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('PageHeader', () => {
  test('renders title', () => {
    render(<PageHeader title="My Skill" />)
    expect(screen.getByRole('heading', { name: 'My Skill' })).toBeInTheDocument()
  })

  test('renders back link when backHref and backLabel are provided', () => {
    render(<PageHeader title="Generate" backHref="/" backLabel="返回市场" />)
    const link = screen.getByRole('link', { name: /返回市场/ })
    expect(link).toHaveAttribute('href', '/')
  })

  test('does not render back link when props are omitted', () => {
    render(<PageHeader title="Generate" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  test('does not render back link when only backHref is provided', () => {
    render(<PageHeader title="Generate" backHref="/" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  test('does not render back link when only backLabel is provided', () => {
    render(<PageHeader title="Generate" backLabel="返回市场" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
