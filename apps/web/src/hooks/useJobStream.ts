import { useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '@/lib/api'

type StreamEvent =
  | { type: 'status'; status: string }
  | { type: 'complete'; output: string }
  | { type: 'error'; error: string }

function safeParse(data: string): Record<string, unknown> {
  try {
    return JSON.parse(data)
  } catch {
    return {}
  }
}

export function useJobStream(jobId: string | null) {
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [done, setDone] = useState(false)
  const closedRef = useRef(false)

  useEffect(() => {
    if (!jobId) return

    // Reset state when jobId changes
    setEvents([])
    setDone(false)
    closedRef.current = false

    const es = new EventSource(`${API_BASE_URL}/jobs/${jobId}/stream`)

    // Native transport/connection error (no .data payload)
    es.onerror = () => {
      if (closedRef.current) return
      closedRef.current = true
      setEvents(prev => [...prev, { type: 'error', error: 'Connection lost' }])
      setDone(true)
      es.close()
    }

    // Application-level status event
    es.addEventListener('status', (e) => {
      if (closedRef.current) return
      const data = safeParse((e as MessageEvent).data)
      setEvents(prev => [...prev, { type: 'status', status: String(data.status ?? '') }])
    })

    // Application-level complete event
    es.addEventListener('complete', (e) => {
      if (closedRef.current) return
      closedRef.current = true
      const data = safeParse((e as MessageEvent).data)
      setEvents(prev => [...prev, { type: 'complete', output: String(data.output ?? '') }])
      setDone(true)
      es.close()
    })

    // Application-level error event (server-sent named event)
    es.addEventListener('error', (e) => {
      if (closedRef.current) return
      closedRef.current = true
      const data = safeParse((e as MessageEvent).data)
      setEvents(prev => [...prev, { type: 'error', error: String(data.error ?? 'Unknown error') }])
      setDone(true)
      es.close()
    })

    return () => {
      closedRef.current = true
      es.close()
    }
  }, [jobId])

  return { events, done }
}
