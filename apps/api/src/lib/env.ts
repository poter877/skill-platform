import { join } from 'node:path'
import { homedir } from 'node:os'
import { z } from 'zod'

export const EnvSchema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_AUTH_TOKEN: z.string().optional(),
  ANTHROPIC_BASE_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  JOBS_DIR: z.string().default(join(homedir(), '.skill-plant', 'jobs')),
  UPLOAD_DIR: z.string().default('/tmp/skill-plant-uploads'),
  DOCKER_IMAGE: z.string().default('skill-plant-claude-code'),
})

const result = EnvSchema.safeParse(process.env)
if (!result.success) {
  console.error('❌ Invalid environment variables:')
  console.error(result.error.flatten().fieldErrors)
  process.exit(1)
}
export const env = result.data
