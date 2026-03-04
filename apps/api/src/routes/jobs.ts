import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { zValidator } from '@hono/zod-validator'
import { db } from '../db'
import { jobs } from '../db/schema'
import { eq } from 'drizzle-orm'
import { jobQueue } from '../lib/queue'
import { CreateJobSchema } from '@skill-plant/shared'

export const jobsRouter = new Hono()

jobsRouter.post(
  '/',
  zValidator('json', CreateJobSchema),
  async (c) => {
    try {
      const body = c.req.valid('json')
      const [job] = await db.insert(jobs).values({
        skillId: body.skillId,
        inputs: body.inputs,
      }).returning()
      await jobQueue.add('run', { jobId: job.id })
      return c.json(job, 201)
    } catch (err) {
      console.error('Failed to create job:', err)
      return c.json({ error: 'Internal server error' }, 500)
    }
  }
)

jobsRouter.get('/:id', async (c) => {
  try {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, c.req.param('id')))
    if (!job) return c.json({ error: 'Not found' }, 404)
    return c.json(job)
  } catch (err) {
    console.error('Failed to get job:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

jobsRouter.get('/', async (c) => {
  try {
    const rows = await db.select().from(jobs).orderBy(jobs.createdAt)
    return c.json(rows)
  } catch (err) {
    console.error('Failed to list jobs:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// SSE stream — polls DB until job completes
jobsRouter.get('/:id/stream', async (c) => {
  const jobId = c.req.param('id')

  return streamSSE(c, async (stream) => {
    let lastStatus = ''

    while (true) {
      const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId))
      if (!job) {
        await stream.writeSSE({ data: JSON.stringify({ error: 'Job not found' }), event: 'error' })
        break
      }

      if (job.status !== lastStatus) {
        lastStatus = job.status
        await stream.writeSSE({ data: JSON.stringify({ status: job.status }), event: 'status' })
      }

      if (job.status === 'completed') {
        await stream.writeSSE({ data: JSON.stringify({ output: job.output }), event: 'complete' })
        break
      }

      if (job.status === 'failed') {
        await stream.writeSSE({ data: JSON.stringify({ error: job.errorMessage }), event: 'error' })
        break
      }

      await new Promise(r => setTimeout(r, 1000))
    }
  })
})
