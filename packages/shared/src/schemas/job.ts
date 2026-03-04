import { z } from 'zod'

export const JobStatusSchema = z.enum(['pending', 'running', 'completed', 'failed'])

export const JobSchema = z.object({
  id: z.string().uuid(),
  skillId: z.string().uuid(),
  status: JobStatusSchema,
  inputs: z.record(z.string()),
  output: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const CreateJobSchema = z.object({
  skillId: z.string().uuid(),
  inputs: z.record(z.string()),
})

export type Job = z.infer<typeof JobSchema>
export type JobStatus = z.infer<typeof JobStatusSchema>
export type CreateJob = z.infer<typeof CreateJobSchema>
