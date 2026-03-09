'use client'
import { useState, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { useSuspenseQueries } from '@tanstack/react-query'
import { useJobStream } from '@/hooks/useJobStream'
import { DynamicForm } from '@/components/DynamicForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { apiGet, apiPost } from '@/lib/api'
import type { Skill, InputSchemaResponseType, Job } from '@skill-plant/shared'
import { PageHeader } from '@/components/PageHeader'
import { ErrorBoundary } from '@/components/ErrorBoundary'

function RunSkillContent({ id }: { id: string }) {
  const [{ data: skill }, { data: schema }] = useSuspenseQueries({
    queries: [
      {
        queryKey: ['skills', id],
        queryFn: () => apiGet<Skill>(`/skills/${id}`),
      },
      {
        queryKey: ['skills', id, 'schema'],
        queryFn: () => apiPost<InputSchemaResponseType>(`/ai/analyze/${id}`, {}),
        staleTime: Infinity,
      },
    ],
  })

  const [jobId, setJobId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { events, done } = useJobStream(jobId)

  async function handleSubmit(inputs: Record<string, string>) {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const job = await apiPost<Job>('/jobs', { skillId: id, inputs })
      setJobId(job.id)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to start job')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="container mx-auto py-8 px-4 max-w-2xl">
      <PageHeader title={skill.name} backHref="/" backLabel="返回市场" />
      <p className="text-muted-foreground mb-6">{skill.description}</p>

      {!jobId && (
        <Card>
          <CardContent className="pt-6">
            <DynamicForm
              fields={schema.fields}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
            {submitError && (
              <p className="mt-2 text-sm text-destructive">{submitError}</p>
            )}
          </CardContent>
        </Card>
      )}

      {jobId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Output
              {!done && <Badge variant="secondary">Running...</Badge>}
              {done && (
                events.some(e => e.type === 'error')
                  ? <Badge variant="destructive">Failed</Badge>
                  : <Badge variant="default">Done</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {events.map((event) => (
                <div key={event.seq}>
                  {event.type === 'status' && (
                    <p className="text-sm text-muted-foreground">→ {event.status}</p>
                  )}
                  {event.type === 'complete' && (
                    <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md">
                      {event.output}
                    </pre>
                  )}
                  {event.type === 'error' && (
                    <p className="text-sm text-destructive">Error: {event.error}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  )
}

export default function RunSkillPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <ErrorBoundary fallback={
      <div className="container mx-auto py-8 px-4">Skill not found</div>
    }>
      <Suspense fallback={
        <div className="container mx-auto py-8 px-4">Loading...</div>
      }>
        <RunSkillContent id={id} />
      </Suspense>
    </ErrorBoundary>
  )
}
