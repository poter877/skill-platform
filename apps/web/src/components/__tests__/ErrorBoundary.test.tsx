import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '../ErrorBoundary'

// Helper component that conditionally throws
function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Boom!')
  return <div>Safe content</div>
}

describe('ErrorBoundary', () => {
  test('renders children when no error occurs', () => {
    render(
      <ErrorBoundary fallback={<div>Error fallback</div>}>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Safe content')).toBeInTheDocument()
    expect(screen.queryByText('Error fallback')).not.toBeInTheDocument()
  })

  test('renders fallback when a child throws', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary fallback={<div>Error fallback</div>}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Error fallback')).toBeInTheDocument()
    expect(screen.queryByText('Safe content')).not.toBeInTheDocument()
    consoleSpy.mockRestore()
  })

  test('fallback can be any ReactNode', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary fallback={<p data-testid="custom-fallback">Something went wrong</p>}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument()
    consoleSpy.mockRestore()
  })
})
