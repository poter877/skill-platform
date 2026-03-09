import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Navbar } from '../Navbar'

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))

import { usePathname } from 'next/navigation'
const mockUsePathname = vi.mocked(usePathname)

describe('Navbar', () => {
  test('renders logo and brand name', () => {
    mockUsePathname.mockReturnValue('/')
    render(<Navbar />)
    expect(screen.getByText('Skill Plant')).toBeInTheDocument()
  })

  test('renders 市场 link pointing to /', () => {
    mockUsePathname.mockReturnValue('/')
    render(<Navbar />)
    const link = screen.getByRole('link', { name: '市场' })
    expect(link).toHaveAttribute('href', '/')
  })

  test('renders 生成 link pointing to /generate', () => {
    mockUsePathname.mockReturnValue('/')
    render(<Navbar />)
    const link = screen.getByRole('link', { name: /生成/ })
    expect(link).toHaveAttribute('href', '/generate')
  })

  test('市场 link has active styles on /', () => {
    mockUsePathname.mockReturnValue('/')
    render(<Navbar />)
    const link = screen.getByRole('link', { name: '市场' })
    expect(link).toHaveClass('text-foreground', 'font-medium')
  })

  test('市场 link has inactive styles on /generate', () => {
    mockUsePathname.mockReturnValue('/generate')
    render(<Navbar />)
    const link = screen.getByRole('link', { name: '市场' })
    expect(link).toHaveClass('text-muted-foreground')
    expect(link).not.toHaveClass('font-medium')
  })

  test('生成 button has active styles (bg-primary) on /generate', () => {
    mockUsePathname.mockReturnValue('/generate')
    render(<Navbar />)
    const link = screen.getByRole('link', { name: /生成/ })
    expect(link).toHaveClass('bg-primary')
    expect(link).not.toHaveClass('border')
  })

  test('生成 button has inactive styles (border) on /', () => {
    mockUsePathname.mockReturnValue('/')
    render(<Navbar />)
    const link = screen.getByRole('link', { name: /生成/ })
    expect(link).toHaveClass('border')
    expect(link).not.toHaveClass('bg-primary')
  })
})
