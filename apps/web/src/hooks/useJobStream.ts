import { useEffect, useState } from 'react'
import { API_BASE_URL } from '@/lib/api'

type StreamEvent =
  | { type: 'status'; status: string }
  | { type: 'complete'; output: string }
  | { type: 'error'; error: string }

export function useJobStream(jobId: string | null) {
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!jobId) return

    const es = new EventSource(`${API_BASE_URL}/jobs/${jobId}/stream`)

    es.addEventListener('status', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      setEvents(prev => [...prev, { type: 'status', status: data.status }])
    })

    es.addEventListener('complete', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      setEvents(prev => [...prev, { type: 'complete', output: data.output }])
      setDone(true)
      es.close()
    })

    es.addEventListener('error', (e) => {
      const data = JSON.parse((e as MessageEvent).data ?? '{}')
      setEvents(prev => [...prev, { type: 'error', error: data.error ?? 'Unknown error' }])
      setDone(true)
      es.close()
    })

    return () => es.close()
  }, [jobId])

  return { events, done }
}
