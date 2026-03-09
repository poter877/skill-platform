import { useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '@/lib/api'

type StreamEvent =
  | { type: 'status'; status: string; seq: number }
  | { type: 'complete'; output: string; seq: number }
  | { type: 'error'; error: string; seq: number }

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
  const seqRef = useRef(0)
  const [prevJobId, setPrevJobId] = useState(jobId)

  // Reset state when jobId changes (React-recommended pattern for derived state)
  if (prevJobId !== jobId) {
    setPrevJobId(jobId)
    setEvents([])
    setDone(false)
  }

  useEffect(() => {
    if (!jobId) return

    closedRef.current = false

    const es = new EventSource(`${API_BASE_URL}/jobs/${jobId}/stream`)

    // Native transport/connection error (no .data payload)
    es.onerror = () => {
      if (closedRef.current) return
      closedRef.current = true
      setEvents(prev => [...prev, { type: 'error', error: 'Connection lost', seq: seqRef.current++ }])
      setDone(true)
      es.close()
    }

    // Application-level status event
    es.addEventListener('status', (e) => {
      if (closedRef.current) return
      const data = safeParse((e as MessageEvent).data)
      setEvents(prev => [...prev, { type: 'status', status: String(data.status ?? ''), seq: seqRef.current++ }])
    })

    // Application-level complete event
    es.addEventListener('complete', (e) => {
      if (closedRef.current) return
      closedRef.current = true
      const data = safeParse((e as MessageEvent).data)
      setEvents(prev => [...prev, { type: 'complete', output: String(data.output ?? ''), seq: seqRef.current++ }])
      setDone(true)
      es.close()
    })

    // Application-level error event (server-sent named event)
    es.addEventListener('error', (e) => {
      if (closedRef.current) return
      closedRef.current = true
      const data = safeParse((e as MessageEvent).data)
      setEvents(prev => [...prev, { type: 'error', error: String(data.error ?? 'Unknown error'), seq: seqRef.current++ }])
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
