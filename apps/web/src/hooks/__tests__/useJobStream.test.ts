import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useJobStream } from '../useJobStream'

// Custom EventSource mock
class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {}
  onerror: ((e: Event) => void) | null = null
  closed = false

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: (e: MessageEvent) => void) {
    if (!this.listeners[type]) this.listeners[type] = []
    this.listeners[type].push(listener)
  }

  close() {
    this.closed = true
  }

  // Test helper: simulate server sending named event
  _emit(type: string, data: string) {
    const event = new MessageEvent(type, { data })
    for (const listener of this.listeners[type] ?? []) {
      listener(event)
    }
  }

  // Test helper: simulate connection error
  _emitError() {
    if (this.onerror) this.onerror(new Event('error'))
  }
}

vi.mock('@/lib/api', () => ({
  API_BASE_URL: 'http://localhost:3001',
}))

describe('useJobStream', () => {
  beforeEach(() => {
    MockEventSource.instances = []
    vi.stubGlobal('EventSource', MockEventSource)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('returns empty events and not done when jobId is null', () => {
    const { result } = renderHook(() => useJobStream(null))
    expect(result.current.events).toEqual([])
    expect(result.current.done).toBe(false)
    expect(MockEventSource.instances).toHaveLength(0)
  })

  test('creates EventSource with correct URL', () => {
    renderHook(() => useJobStream('job-123'))
    expect(MockEventSource.instances).toHaveLength(1)
    expect(MockEventSource.instances[0].url).toBe('http://localhost:3001/jobs/job-123/stream')
  })

  test('handles status event', () => {
    const { result } = renderHook(() => useJobStream('job-123'))
    const es = MockEventSource.instances[0]

    act(() => {
      es._emit('status', JSON.stringify({ status: 'running' }))
    })

    expect(result.current.events).toHaveLength(1)
    expect(result.current.events[0]).toEqual({ type: 'status', status: 'running' })
    expect(result.current.done).toBe(false)
  })

  test('handles complete event', () => {
    const { result } = renderHook(() => useJobStream('job-123'))
    const es = MockEventSource.instances[0]

    act(() => {
      es._emit('complete', JSON.stringify({ output: 'Result here' }))
    })

    expect(result.current.events).toHaveLength(1)
    expect(result.current.events[0]).toEqual({ type: 'complete', output: 'Result here' })
    expect(result.current.done).toBe(true)
    expect(es.closed).toBe(true)
  })

  test('handles error event', () => {
    const { result } = renderHook(() => useJobStream('job-123'))
    const es = MockEventSource.instances[0]

    act(() => {
      es._emit('error', JSON.stringify({ error: 'Job failed' }))
    })

    expect(result.current.events).toHaveLength(1)
    expect(result.current.events[0]).toEqual({ type: 'error', error: 'Job failed' })
    expect(result.current.done).toBe(true)
    expect(es.closed).toBe(true)
  })

  test('handles connection error', () => {
    const { result } = renderHook(() => useJobStream('job-123'))
    const es = MockEventSource.instances[0]

    act(() => {
      es._emitError()
    })

    expect(result.current.events).toHaveLength(1)
    expect(result.current.events[0]).toEqual({ type: 'error', error: 'Connection lost' })
    expect(result.current.done).toBe(true)
  })

  test('closes EventSource on unmount', () => {
    const { unmount } = renderHook(() => useJobStream('job-123'))
    const es = MockEventSource.instances[0]

    unmount()
    expect(es.closed).toBe(true)
  })

  test('resets events when jobId changes', () => {
    const { result, rerender } = renderHook(
      ({ jobId }) => useJobStream(jobId),
      { initialProps: { jobId: 'job-1' as string | null } }
    )

    const es1 = MockEventSource.instances[0]
    act(() => {
      es1._emit('status', JSON.stringify({ status: 'running' }))
    })
    expect(result.current.events).toHaveLength(1)

    // Change jobId
    rerender({ jobId: 'job-2' })

    // Old EventSource should be closed, new one created
    expect(es1.closed).toBe(true)
    expect(MockEventSource.instances).toHaveLength(2)
    // Events should be reset
    expect(result.current.events).toEqual([])
    expect(result.current.done).toBe(false)
  })

  test('accumulates multiple status events', () => {
    const { result } = renderHook(() => useJobStream('job-123'))
    const es = MockEventSource.instances[0]

    act(() => {
      es._emit('status', JSON.stringify({ status: 'pending' }))
    })
    act(() => {
      es._emit('status', JSON.stringify({ status: 'running' }))
    })

    expect(result.current.events).toHaveLength(2)
    expect(result.current.events[0]).toEqual({ type: 'status', status: 'pending' })
    expect(result.current.events[1]).toEqual({ type: 'status', status: 'running' })
  })
})
