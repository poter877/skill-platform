import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'
import { env } from './env'
import { runJob } from './executor'
import { db } from '../db'
import { jobs } from '../db/schema'
import { eq } from 'drizzle-orm'

export function createRedisConnection() {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
}

const connection = createRedisConnection()

export const jobQueue = new Queue('jobs', { connection })

new Worker('jobs', async (bullJob) => {
  const { jobId } = bullJob.data

  await db.update(jobs)
    .set({ status: 'running', updatedAt: new Date() })
    .where(eq(jobs.id, jobId))

  try {
    const output = await runJob(jobId)
    await db.update(jobs)
      .set({ status: 'completed', output, updatedAt: new Date() })
      .where(eq(jobs.id, jobId))
  } catch (err) {
    await db.update(jobs)
      .set({ status: 'failed', errorMessage: String(err), updatedAt: new Date() })
      .where(eq(jobs.id, jobId))
  }
}, { connection: createRedisConnection() })
