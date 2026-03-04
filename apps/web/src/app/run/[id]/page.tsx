'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useSkill } from '@/hooks/useSkills'
import { useSkillInputSchema } from '@/hooks/useSkillInputSchema'
import { useJobStream } from '@/hooks/useJobStream'
import { DynamicForm } from '@/components/DynamicForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { apiPost } from '@/lib/api'
import type { Job } from '@skill-plant/shared'

export default function RunSkillPage() {
  const { id } = useParams<{ id: string }>()
  const { data: skill, isLoading: skillLoading } = useSkill(id)
  const { data: schema, isLoading: schemaLoading } = useSkillInputSchema(id)
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

  if (skillLoading || schemaLoading) {
    return <div className="container mx-auto py-8 px-4">Loading...</div>
  }

  if (!skill || !schema) {
    return <div className="container mx-auto py-8 px-4">Skill not found</div>
  }

  return (
    <main className="container mx-auto py-8 px-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">{skill.name}</h1>
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
              {done && events.some(e => e.type === 'error')
                ? <Badge variant="destructive">Failed</Badge>
                : done && <Badge variant="default">Done</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {events.map((event, i) => (
                <div key={i}>
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
