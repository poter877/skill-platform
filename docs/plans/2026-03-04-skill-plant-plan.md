# Skill Plant Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web platform that lets non-programmers run Claude Code skills via a browser, with dynamic forms, real-time streaming output, and AI-assisted skill generation.

**Architecture:** Turborepo monorepo with a Next.js frontend and HonoJS/Bun API. Skills are injected into isolated Docker containers running Claude Code CLI. BullMQ manages async job execution; SSE streams output back to the browser.

**Tech Stack:** Next.js 15, HonoJS + Bun, Drizzle ORM + PostgreSQL, BullMQ + Redis, Docker + Claude Code, Vercel AI SDK, shadcn/ui, React Hook Form, Zod, TanStack Query, Better Auth, Cloudflare R2

---

## Task 1: Monorepo Scaffold

**Files:**
- Create: `package.json`
- Create: `turbo.json`
- Create: `pnpm-workspace.yaml`
- Create: `apps/web/.gitkeep`
- Create: `apps/api/.gitkeep`
- Create: `packages/shared/.gitkeep`

**Step 1: Init pnpm workspace**

```bash
cd /Users/ll/skill-plant
pnpm init
```

**Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**Step 3: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {}
  }
}
```

**Step 4: Update root `package.json`**

```json
{
  "name": "skill-plant",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck"
  },
  "devDependencies": {
    "turbo": "latest",
    "typescript": "^5"
  }
}
```

**Step 5: Install root deps**

```bash
pnpm install
```

**Step 6: Commit**

```bash
git init
git add .
git commit -m "chore: init turborepo monorepo"
```

---

## Task 2: Shared Zod Schemas Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/schemas/skill.ts`
- Create: `packages/shared/src/schemas/job.ts`
- Create: `packages/shared/src/schemas/form.ts`
- Create: `packages/shared/src/index.ts`

**Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@skill-plant/shared",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "zod": "^3"
  }
}
```

**Step 2: Create `packages/shared/src/schemas/skill.ts`**

```ts
import { z } from 'zod'

export const FormFieldSchema = z.object({
  name: z.string(),
  type: z.enum(['file', 'text', 'textarea', 'select', 'multiselect', 'number', 'url']),
  label: z.string(),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  accept: z.array(z.string()).optional(),   // file type only
  options: z.array(z.string()).optional(),  // select/multiselect only
  default: z.string().optional(),
})

export const SkillSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  content: z.string(),           // raw SKILL.md text
  inputs: z.array(FormFieldSchema).optional(),
  source: z.enum(['builtin', 'github', 'upload']),
  githubUrl: z.string().url().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Skill = z.infer<typeof SkillSchema>
export type FormField = z.infer<typeof FormFieldSchema>
```

**Step 3: Create `packages/shared/src/schemas/job.ts`**

```ts
import { z } from 'zod'

export const JobStatusSchema = z.enum(['pending', 'running', 'completed', 'failed'])

export const JobSchema = z.object({
  id: z.string().uuid(),
  skillId: z.string().uuid(),
  status: JobStatusSchema,
  inputs: z.record(z.string()),  // field name → value (file paths stored as strings)
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
```

**Step 4: Create `packages/shared/src/schemas/form.ts`**

```ts
import { z } from 'zod'
import { FormFieldSchema } from './skill'

export const GenerateSkillSchema = z.object({
  description: z.string().min(10),
  model: z.enum(['claude-sonnet-4-5', 'gpt-4o', 'gemini-2.0-flash']).default('claude-sonnet-4-5'),
})

export const ImportGithubSkillSchema = z.object({
  url: z.string().url().refine(url => url.includes('github.com'), {
    message: 'Must be a GitHub URL',
  }),
})

export const InputSchemaResponse = z.object({
  fields: z.array(FormFieldSchema),
})

export type GenerateSkill = z.infer<typeof GenerateSkillSchema>
export type InputSchemaResponse = z.infer<typeof InputSchemaResponse>
```

**Step 5: Create `packages/shared/src/index.ts`**

```ts
export * from './schemas/skill'
export * from './schemas/job'
export * from './schemas/form'
```

**Step 6: Install and verify types compile**

```bash
cd packages/shared && pnpm install && pnpm tsc --noEmit
```

Expected: no errors

**Step 7: Commit**

```bash
git add packages/shared
git commit -m "feat: add shared zod schemas package"
```

---

## Task 3: HonoJS API Setup

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/lib/db.ts`
- Create: `apps/api/src/lib/env.ts`

**Step 1: Create `apps/api/package.json`**

```json
{
  "name": "@skill-plant/api",
  "version": "0.0.1",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "build": "bun build src/index.ts --outdir dist",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@ai-sdk/anthropic": "^1",
    "@ai-sdk/google": "^1",
    "@ai-sdk/openai": "^1",
    "@skill-plant/shared": "workspace:*",
    "ai": "^4",
    "bullmq": "^5",
    "drizzle-orm": "^0.39",
    "hono": "^4",
    "postgres": "^3",
    "zod": "^3"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "drizzle-kit": "^0.30",
    "typescript": "^5"
  }
}
```

**Step 2: Create `apps/api/src/lib/env.ts`**

```ts
import { z } from 'zod'

const EnvSchema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ANTHROPIC_API_KEY: z.string(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  PORT: z.coerce.number().default(3001),
})

export const env = EnvSchema.parse(process.env)
```

**Step 3: Create `apps/api/src/index.ts`**

```ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { env } from './lib/env'

const app = new Hono()

app.use('*', logger())
app.use('*', cors({ origin: 'http://localhost:3000' }))

app.get('/health', (c) => c.json({ ok: true }))

export default {
  port: env.PORT,
  fetch: app.fetch,
}
```

**Step 4: Run and verify**

```bash
cd apps/api && pnpm install && bun run src/index.ts
```

In another terminal:
```bash
curl http://localhost:3001/health
```

Expected: `{"ok":true}`

**Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: add hono api skeleton"
```

---

## Task 4: Database Schema (Drizzle + PostgreSQL)

**Files:**
- Create: `apps/api/src/db/schema.ts`
- Create: `apps/api/src/db/index.ts`
- Create: `apps/api/drizzle.config.ts`
- Create: `apps/api/src/db/migrations/` (auto-generated)

**Step 1: Create `apps/api/src/db/schema.ts`**

```ts
import { pgTable, uuid, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core'

export const jobStatusEnum = pgEnum('job_status', ['pending', 'running', 'completed', 'failed'])
export const skillSourceEnum = pgEnum('skill_source', ['builtin', 'github', 'upload'])

export const skills = pgTable('skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  content: text('content').notNull(),        // raw SKILL.md
  inputs: jsonb('inputs'),                   // FormField[] | null
  source: skillSourceEnum('source').notNull().default('builtin'),
  githubUrl: text('github_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  skillId: uuid('skill_id').references(() => skills.id).notNull(),
  status: jobStatusEnum('status').notNull().default('pending'),
  inputs: jsonb('inputs').notNull(),         // { fieldName: value }
  output: text('output'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

**Step 2: Create `apps/api/src/db/index.ts`**

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../lib/env'
import * as schema from './schema'

const client = postgres(env.DATABASE_URL)
export const db = drizzle(client, { schema })
```

**Step 3: Create `apps/api/drizzle.config.ts`**

```ts
import type { Config } from 'drizzle-kit'
import { env } from './src/lib/env'

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: env.DATABASE_URL },
} satisfies Config
```

**Step 4: Start PostgreSQL + generate + push migrations**

```bash
# Start local postgres (assumes Docker)
docker run -d --name skill-plant-pg \
  -e POSTGRES_DB=skillplant \
  -e POSTGRES_USER=skillplant \
  -e POSTGRES_PASSWORD=skillplant \
  -p 5432:5432 postgres:16

# Set env
export DATABASE_URL=postgres://skillplant:skillplant@localhost:5432/skillplant
export ANTHROPIC_API_KEY=your-key-here

# Generate and push
cd apps/api
bunx drizzle-kit generate
bunx drizzle-kit push
```

Expected: tables created without errors

**Step 5: Commit**

```bash
git add apps/api/src/db apps/api/drizzle.config.ts
git commit -m "feat: add drizzle schema and migrations"
```

---

## Task 5: Skills API (CRUD)

**Files:**
- Create: `apps/api/src/routes/skills.ts`
- Modify: `apps/api/src/index.ts`

**Step 1: Create `apps/api/src/routes/skills.ts`**

```ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { skills } from '../db/schema'
import { eq } from 'drizzle-orm'
import { ImportGithubSkillSchema } from '@skill-plant/shared'

export const skillsRouter = new Hono()

// List all skills
skillsRouter.get('/', async (c) => {
  const rows = await db.select().from(skills)
  return c.json(rows)
})

// Get single skill
skillsRouter.get('/:id', async (c) => {
  const [skill] = await db.select().from(skills).where(eq(skills.id, c.req.param('id')))
  if (!skill) return c.json({ error: 'Not found' }, 404)
  return c.json(skill)
})

// Import from GitHub
skillsRouter.post(
  '/import/github',
  zValidator('json', ImportGithubSkillSchema),
  async (c) => {
    const { url } = c.req.valid('json')

    // Convert GitHub URL to raw content URL
    // e.g. https://github.com/anthropics/skills/tree/main/skills/pdf
    //   -> https://raw.githubusercontent.com/anthropics/skills/main/skills/pdf/SKILL.md
    const rawUrl = url
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/tree/', '/')
      + '/SKILL.md'

    const res = await fetch(rawUrl)
    if (!res.ok) return c.json({ error: 'Failed to fetch SKILL.md from GitHub' }, 400)

    const content = await res.text()

    // Parse frontmatter (name + description)
    const nameMatch = content.match(/^name:\s*(.+)$/m)
    const descMatch = content.match(/^description:\s*(.+)$/m)

    const [skill] = await db.insert(skills).values({
      name: nameMatch?.[1]?.trim() ?? 'Unnamed',
      description: descMatch?.[1]?.trim() ?? '',
      content,
      source: 'github',
      githubUrl: url,
    }).returning()

    return c.json(skill, 201)
  }
)

// Delete skill
skillsRouter.delete('/:id', async (c) => {
  await db.delete(skills).where(eq(skills.id, c.req.param('id')))
  return c.json({ ok: true })
})
```

**Step 2: Register router in `apps/api/src/index.ts`**

```ts
import { skillsRouter } from './routes/skills'
// ...existing code...
app.route('/skills', skillsRouter)
```

**Step 3: Test skill list endpoint**

```bash
curl http://localhost:3001/skills
```

Expected: `[]`

**Step 4: Test GitHub import**

```bash
curl -X POST http://localhost:3001/skills/import/github \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/anthropics/skills/tree/main/skills/pdf"}'
```

Expected: JSON with `id`, `name`, `content` fields

**Step 5: Commit**

```bash
git add apps/api/src/routes/skills.ts apps/api/src/index.ts
git commit -m "feat: add skills CRUD and github import"
```

---

## Task 6: Docker Image for Claude Code

**Files:**
- Create: `docker/claude-code/Dockerfile`
- Create: `docker/claude-code/.dockerignore`

**Step 1: Create `docker/claude-code/Dockerfile`**

```dockerfile
FROM node:22-slim

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Create workspace directory
RUN mkdir -p /workspace /root/.claude/skills

WORKDIR /workspace

# Default: non-interactive mode
ENTRYPOINT ["claude", "--print"]
```

**Step 2: Build the image**

```bash
docker build -t skill-plant-claude-code docker/claude-code/
```

Expected: build succeeds

**Step 3: Test the image runs**

```bash
docker run --rm \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  skill-plant-claude-code \
  "Say hello in one word"
```

Expected: "Hello" or similar one-word response

**Step 4: Commit**

```bash
git add docker/
git commit -m "feat: add claude code docker image"
```

---

## Task 7: File Upload API + Storage

**Files:**
- Create: `apps/api/src/lib/storage.ts`
- Create: `apps/api/src/routes/uploads.ts`
- Modify: `apps/api/src/index.ts`

**Step 1: Create `apps/api/src/lib/storage.ts`**

```ts
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

// Phase 1: local disk storage
// Phase 2: swap to R2 by implementing same interface
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/tmp/skill-plant-uploads'

export async function saveUpload(
  filename: string,
  buffer: ArrayBuffer,
): Promise<{ path: string; key: string }> {
  const key = randomUUID()
  const dir = join(UPLOAD_DIR, key)
  await mkdir(dir, { recursive: true })
  const path = join(dir, filename)
  await writeFile(path, Buffer.from(buffer))
  return { path, key }
}

export async function getUploadPath(key: string, filename: string): Promise<string> {
  return join(UPLOAD_DIR, key, filename)
}
```

**Step 2: Create `apps/api/src/routes/uploads.ts`**

```ts
import { Hono } from 'hono'
import { saveUpload } from '../lib/storage'

export const uploadsRouter = new Hono()

uploadsRouter.post('/', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null

  if (!file) return c.json({ error: 'No file provided' }, 400)

  const buffer = await file.arrayBuffer()
  const { path, key } = await saveUpload(file.name, buffer)

  return c.json({ key, filename: file.name, path })
})
```

**Step 3: Register in `apps/api/src/index.ts`**

```ts
import { uploadsRouter } from './routes/uploads'
app.route('/uploads', uploadsRouter)
```

**Step 4: Test upload**

```bash
curl -X POST http://localhost:3001/uploads \
  -F "file=@/path/to/test.pdf"
```

Expected: `{"key":"uuid","filename":"test.pdf","path":"/tmp/..."}`

**Step 5: Commit**

```bash
git add apps/api/src/lib/storage.ts apps/api/src/routes/uploads.ts
git commit -m "feat: add file upload endpoint with local storage"
```

---

## Task 8: BullMQ Job Queue + Docker Executor

**Files:**
- Create: `apps/api/src/lib/queue.ts`
- Create: `apps/api/src/lib/executor.ts`
- Create: `apps/api/src/routes/jobs.ts`
- Modify: `apps/api/src/index.ts`

**Step 1: Start Redis**

```bash
docker run -d --name skill-plant-redis -p 6379:6379 redis:7
```

**Step 2: Create `apps/api/src/lib/queue.ts`**

```ts
import { Queue, Worker } from 'bullmq'
import { env } from './env'
import { runJob } from './executor'
import { db } from '../db'
import { jobs } from '../db/schema'
import { eq } from 'drizzle-orm'

const connection = { url: env.REDIS_URL }

export const jobQueue = new Queue('jobs', { connection })

// Worker runs in same process for Phase 1
// Phase 2: extract to separate worker process
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
}, { connection })
```

**Step 3: Create `apps/api/src/lib/executor.ts`**

```ts
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { db } from '../db'
import { jobs, skills } from '../db/schema'
import { eq } from 'drizzle-orm'
import { env } from './env'

const JOBS_DIR = process.env.JOBS_DIR ?? '/tmp/skill-plant-jobs'

export async function runJob(jobId: string): Promise<string> {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId))
  if (!job) throw new Error(`Job ${jobId} not found`)

  const [skill] = await db.select().from(skills).where(eq(skills.id, job.skillId))
  if (!skill) throw new Error(`Skill ${job.skillId} not found`)

  // Prepare job directory on host
  const jobDir = join(JOBS_DIR, jobId)
  const skillsDir = join(jobDir, 'skills', skill.name)
  const workspaceDir = join(jobDir, 'workspace')

  await mkdir(skillsDir, { recursive: true })
  await mkdir(workspaceDir, { recursive: true })

  // Write SKILL.md to job dir
  await writeFile(join(skillsDir, 'SKILL.md'), skill.content)

  // Build the user prompt from job inputs
  const inputs = job.inputs as Record<string, string>
  const prompt = buildPrompt(skill.name, inputs)

  // Run Docker container
  const output = await runDocker({
    skillsDir,
    workspaceDir,
    prompt,
    apiKey: env.ANTHROPIC_API_KEY,
  })

  return output
}

function buildPrompt(skillName: string, inputs: Record<string, string>): string {
  const parts = [`Use the ${skillName} skill.`]
  for (const [key, value] of Object.entries(inputs)) {
    if (key !== 'instruction') {
      parts.push(`${key}: ${value}`)
    }
  }
  if (inputs.instruction) {
    parts.push(inputs.instruction)
  }
  return parts.join('\n')
}

async function runDocker(opts: {
  skillsDir: string
  workspaceDir: string
  prompt: string
  apiKey: string
}): Promise<string> {
  const proc = Bun.spawn([
    'docker', 'run', '--rm',
    '-v', `${opts.skillsDir}:/root/.claude/skills`,
    '-v', `${opts.workspaceDir}:/workspace`,
    '-e', `ANTHROPIC_API_KEY=${opts.apiKey}`,
    'skill-plant-claude-code',
    opts.prompt,
  ], {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const stdout = await new Response(proc.stdout).text()
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`Claude Code exited with code ${exitCode}: ${stderr}`)
  }

  return stdout
}
```

**Step 4: Create `apps/api/src/routes/jobs.ts`**

```ts
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { zValidator } from '@hono/zod-validator'
import { db } from '../db'
import { jobs } from '../db/schema'
import { eq } from 'drizzle-orm'
import { jobQueue } from '../lib/queue'
import { CreateJobSchema } from '@skill-plant/shared'

export const jobsRouter = new Hono()

// Create job
jobsRouter.post(
  '/',
  zValidator('json', CreateJobSchema),
  async (c) => {
    const body = c.req.valid('json')

    const [job] = await db.insert(jobs).values({
      skillId: body.skillId,
      inputs: body.inputs,
    }).returning()

    await jobQueue.add('run', { jobId: job.id })

    return c.json(job, 201)
  }
)

// Get job status
jobsRouter.get('/:id', async (c) => {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, c.req.param('id')))
  if (!job) return c.json({ error: 'Not found' }, 404)
  return c.json(job)
})

// List jobs
jobsRouter.get('/', async (c) => {
  const rows = await db.select().from(jobs).orderBy(jobs.createdAt)
  return c.json(rows)
})

// SSE stream for job output (poll-based for Phase 1)
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
        await stream.writeSSE({
          data: JSON.stringify({ status: job.status }),
          event: 'status',
        })
      }

      if (job.status === 'completed') {
        await stream.writeSSE({
          data: JSON.stringify({ output: job.output }),
          event: 'complete',
        })
        break
      }

      if (job.status === 'failed') {
        await stream.writeSSE({
          data: JSON.stringify({ error: job.errorMessage }),
          event: 'error',
        })
        break
      }

      await new Promise(r => setTimeout(r, 1000))
    }
  })
})
```

**Step 5: Register in `apps/api/src/index.ts`**

```ts
import { jobsRouter } from './routes/jobs'
app.route('/jobs', jobsRouter)
```

**Step 6: End-to-end test**

```bash
# 1. Import a skill first (from Task 5)
SKILL_ID=$(curl -s -X POST http://localhost:3001/skills/import/github \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com/anthropics/skills/tree/main/skills/pdf"}' \
  | bun -e "const d=await Bun.stdin.json();console.log(d.id)")

# 2. Create a job
JOB_ID=$(curl -s -X POST http://localhost:3001/jobs \
  -H "Content-Type: application/json" \
  -d "{\"skillId\":\"$SKILL_ID\",\"inputs\":{\"instruction\":\"Summarize this skill's purpose\"}}" \
  | bun -e "const d=await Bun.stdin.json();console.log(d.id)")

# 3. Stream job output
curl -N http://localhost:3001/jobs/$JOB_ID/stream
```

Expected: SSE events showing `pending → running → completed` then output text

**Step 7: Commit**

```bash
git add apps/api/src/lib/queue.ts apps/api/src/lib/executor.ts apps/api/src/routes/jobs.ts
git commit -m "feat: add job queue, docker executor, and SSE stream"
```

---

## Task 9: AI Skill Generation + Schema Analysis

**Files:**
- Create: `apps/api/src/lib/ai.ts`
- Create: `apps/api/src/routes/ai.ts`
- Modify: `apps/api/src/index.ts`

**Step 1: Create `apps/api/src/lib/ai.ts`**

```ts
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { google } from '@ai-sdk/google'
import type { LanguageModelV1 } from 'ai'

export type ModelId = 'claude-sonnet-4-5' | 'gpt-4o' | 'gemini-2.0-flash'

export function getModel(modelId: ModelId): LanguageModelV1 {
  switch (modelId) {
    case 'claude-sonnet-4-5':
      return anthropic('claude-sonnet-4-5-20251001')
    case 'gpt-4o':
      return openai('gpt-4o')
    case 'gemini-2.0-flash':
      return google('gemini-2.0-flash')
  }
}

export const SKILL_GENERATION_SYSTEM = `You are an expert at writing Claude Code skills.
A skill is a SKILL.md file with YAML frontmatter and markdown content.

REQUIRED frontmatter fields:
- name: kebab-case name
- description: "Use when..." triggering conditions (NOT workflow summary)
- inputs: array of form field definitions

Output ONLY the raw SKILL.md content, no explanation.`

export const SCHEMA_ANALYSIS_SYSTEM = `Analyze this SKILL.md and extract what user inputs it needs.
Return a JSON object matching this schema:
{
  "fields": [
    {
      "name": "snake_case_name",
      "type": "file|text|textarea|select|multiselect|number|url",
      "label": "Human readable label",
      "required": true|false,
      "placeholder": "optional hint",
      "accept": ["ext"] (file type only),
      "options": ["opt1","opt2"] (select only)
    }
  ]
}`
```

**Step 2: Create `apps/api/src/routes/ai.ts`**

```ts
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { zValidator } from '@hono/zod-validator'
import { streamText, generateObject } from 'ai'
import { z } from 'zod'
import { db } from '../db'
import { skills } from '../db/schema'
import { eq } from 'drizzle-orm'
import { getModel, SKILL_GENERATION_SYSTEM, SCHEMA_ANALYSIS_SYSTEM } from '../lib/ai'
import { GenerateSkillSchema, InputSchemaResponse, FormFieldSchema } from '@skill-plant/shared'

export const aiRouter = new Hono()

// Stream skill generation
aiRouter.post(
  '/generate',
  zValidator('json', GenerateSkillSchema),
  async (c) => {
    const { description, model } = c.req.valid('json')

    return streamSSE(c, async (stream) => {
      const result = streamText({
        model: getModel(model),
        system: SKILL_GENERATION_SYSTEM,
        prompt: description,
      })

      for await (const chunk of result.textStream) {
        await stream.writeSSE({ data: chunk })
      }
    })
  }
)

// Analyze skill to extract input schema (with caching)
aiRouter.post('/analyze/:skillId', async (c) => {
  const skillId = c.req.param('skillId')
  const [skill] = await db.select().from(skills).where(eq(skills.id, skillId))
  if (!skill) return c.json({ error: 'Skill not found' }, 404)

  // Return cached schema if available
  if (skill.inputs) return c.json({ fields: skill.inputs })

  const { object } = await generateObject({
    model: getModel('claude-sonnet-4-5'),
    system: SCHEMA_ANALYSIS_SYSTEM,
    prompt: skill.content,
    schema: z.object({ fields: z.array(FormFieldSchema) }),
  })

  // Cache to DB
  await db.update(skills)
    .set({ inputs: object.fields, updatedAt: new Date() })
    .where(eq(skills.id, skillId))

  return c.json(object)
})

// Save AI-generated skill
aiRouter.post(
  '/generate/save',
  zValidator('json', z.object({ content: z.string() })),
  async (c) => {
    const { content } = c.req.valid('json')

    const nameMatch = content.match(/^name:\s*(.+)$/m)
    const descMatch = content.match(/^description:\s*(.+)$/m)

    const [skill] = await db.insert(skills).values({
      name: nameMatch?.[1]?.trim() ?? 'generated-skill',
      description: descMatch?.[1]?.trim() ?? '',
      content,
      source: 'upload',
    }).returning()

    return c.json(skill, 201)
  }
)
```

**Step 3: Register in `apps/api/src/index.ts`**

```ts
import { aiRouter } from './routes/ai'
app.route('/ai', aiRouter)
```

**Step 4: Test skill generation**

```bash
curl -N -X POST http://localhost:3001/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"description":"A skill that summarizes CSV files and outputs column statistics","model":"claude-sonnet-4-5"}'
```

Expected: SSE stream of SKILL.md content chunks

**Step 5: Commit**

```bash
git add apps/api/src/lib/ai.ts apps/api/src/routes/ai.ts
git commit -m "feat: add ai skill generation and schema analysis endpoints"
```

---

## Task 10: Next.js Frontend Setup

**Files:**
- Create: `apps/web/` (Next.js app)

**Step 1: Scaffold Next.js app**

```bash
cd apps
pnpm create next-app web \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
```

**Step 2: Add shadcn/ui**

```bash
cd apps/web
pnpx shadcn@latest init
# Choose: Default style, Zinc color, CSS variables yes
```

**Step 3: Add shadcn components we need**

```bash
pnpx shadcn@latest add button card input textarea select badge dialog toast
```

**Step 4: Install frontend deps**

```bash
pnpm add ai @ai-sdk/react @tanstack/react-query nuqs react-hook-form zod @hookform/resolvers
pnpm add -D @types/node
```

**Step 5: Add shared package to web**

In `apps/web/package.json` dependencies:
```json
"@skill-plant/shared": "workspace:*"
```

Then:
```bash
pnpm install
```

**Step 6: Create `apps/web/src/lib/api.ts`**

```ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export const API_BASE_URL = API_BASE
```

**Step 7: Create TanStack Query provider `apps/web/src/app/providers.tsx`**

```tsx
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

**Step 8: Update `apps/web/src/app/layout.tsx` to use providers**

```tsx
import { Providers } from './providers'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

**Step 9: Run and verify**

```bash
cd apps/web && pnpm dev
```

Visit `http://localhost:3000` — should see default Next.js page.

**Step 10: Commit**

```bash
git add apps/web
git commit -m "feat: scaffold next.js frontend with shadcn and tanstack query"
```

---

## Task 11: Skill Marketplace Page

**Files:**
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/components/SkillCard.tsx`
- Create: `apps/web/src/hooks/useSkills.ts`

**Step 1: Create `apps/web/src/hooks/useSkills.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import type { Skill } from '@skill-plant/shared'

export function useSkills() {
  return useQuery({
    queryKey: ['skills'],
    queryFn: () => apiGet<Skill[]>('/skills'),
  })
}

export function useSkill(id: string) {
  return useQuery({
    queryKey: ['skills', id],
    queryFn: () => apiGet<Skill>(`/skills/${id}`),
  })
}
```

**Step 2: Create `apps/web/src/components/SkillCard.tsx`**

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { Skill } from '@skill-plant/shared'

export function SkillCard({ skill }: { skill: Skill }) {
  return (
    <Card className="flex flex-col justify-between">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{skill.name}</CardTitle>
          <Badge variant="outline">{skill.source}</Badge>
        </div>
        <CardDescription className="line-clamp-3">{skill.description}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button asChild className="w-full">
          <Link href={`/run/${skill.id}`}>Run Skill</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
```

**Step 3: Create marketplace page `apps/web/src/app/page.tsx`**

```tsx
'use client'
import { useSkills } from '@/hooks/useSkills'
import { SkillCard } from '@/components/SkillCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { useState } from 'react'

export default function MarketplacePage() {
  const { data: skills, isLoading } = useSkills()
  const [search, setSearch] = useState('')

  const filtered = skills?.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <main className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Skill Marketplace</h1>
        <Button asChild variant="outline">
          <Link href="/generate">✨ Generate Skill</Link>
        </Button>
      </div>

      <Input
        placeholder="Search skills..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="mb-6 max-w-md"
      />

      {isLoading && <p className="text-muted-foreground">Loading skills...</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered?.map(skill => (
          <SkillCard key={skill.id} skill={skill} />
        ))}
      </div>

      {filtered?.length === 0 && !isLoading && (
        <p className="text-muted-foreground text-center py-12">
          No skills found. <Link href="/generate" className="underline">Generate one?</Link>
        </p>
      )}
    </main>
  )
}
```

**Step 4: Verify**

Visit `http://localhost:3000` — should show marketplace with search and any imported skills.

**Step 5: Commit**

```bash
git add apps/web/src/app/page.tsx apps/web/src/components/SkillCard.tsx apps/web/src/hooks/useSkills.ts
git commit -m "feat: add skill marketplace page"
```

---

## Task 12: Dynamic Form Renderer

**Files:**
- Create: `apps/web/src/components/DynamicForm.tsx`
- Create: `apps/web/src/hooks/useSkillInputSchema.ts`

**Step 1: Create `apps/web/src/hooks/useSkillInputSchema.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { apiPost } from '@/lib/api'
import type { InputSchemaResponse } from '@skill-plant/shared'

export function useSkillInputSchema(skillId: string) {
  return useQuery({
    queryKey: ['skills', skillId, 'schema'],
    queryFn: () => apiPost<InputSchemaResponse>(`/ai/analyze/${skillId}`, {}),
    staleTime: Infinity,  // schema doesn't change
  })
}
```

**Step 2: Create `apps/web/src/components/DynamicForm.tsx`**

```tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from '@/components/ui/form'
import type { FormField as SkillFormField } from '@skill-plant/shared'

interface DynamicFormProps {
  fields: SkillFormField[]
  onSubmit: (data: Record<string, string>) => void
  isSubmitting?: boolean
}

// Build a Zod schema dynamically from field definitions
function buildZodSchema(fields: SkillFormField[]) {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const field of fields) {
    let validator: z.ZodTypeAny = z.string()
    if (field.required) {
      validator = z.string().min(1, `${field.label} is required`)
    } else {
      validator = z.string().optional()
    }
    shape[field.name] = validator
  }
  return z.object(shape)
}

export function DynamicForm({ fields, onSubmit, isSubmitting }: DynamicFormProps) {
  const schema = useMemo(() => buildZodSchema(fields), [fields])
  const form = useForm({ resolver: zodResolver(schema) })
  const fileRefs = useRef<Record<string, File>>({})

  async function handleSubmit(values: Record<string, unknown>) {
    // For file fields, upload first then replace value with returned key
    const resolved: Record<string, string> = {}
    for (const [key, value] of Object.entries(values)) {
      const field = fields.find(f => f.name === key)
      if (field?.type === 'file' && fileRefs.current[key]) {
        const formData = new FormData()
        formData.append('file', fileRefs.current[key])
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/uploads`, {
          method: 'POST',
          body: formData,
        })
        const { path } = await res.json()
        resolved[key] = path
      } else {
        resolved[key] = value as string
      }
    }
    onSubmit(resolved)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {fields.map(field => (
          <FormField
            key={field.name}
            control={form.control}
            name={field.name}
            render={({ field: rhfField }) => (
              <FormItem>
                <FormLabel>{field.label}</FormLabel>
                <FormControl>
                  {field.type === 'file' ? (
                    <Input
                      type="file"
                      accept={field.accept?.join(',')}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) {
                          fileRefs.current[field.name] = file
                          rhfField.onChange(file.name)
                        }
                      }}
                    />
                  ) : field.type === 'textarea' ? (
                    <Textarea placeholder={field.placeholder} {...rhfField} />
                  ) : field.type === 'select' ? (
                    <Select onValueChange={rhfField.onChange} defaultValue={field.default}>
                      <SelectTrigger><SelectValue placeholder={field.placeholder} /></SelectTrigger>
                      <SelectContent>
                        {field.options?.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'}
                      placeholder={field.placeholder}
                      {...rhfField}
                    />
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Running...' : '▶ Run Skill'}
        </Button>
      </form>
    </Form>
  )
}
```

**Step 3: Commit**

```bash
git add apps/web/src/components/DynamicForm.tsx apps/web/src/hooks/useSkillInputSchema.ts
git commit -m "feat: add dynamic form renderer driven by skill input schema"
```

---

## Task 13: Skill Runner Page (SSE Output)

**Files:**
- Create: `apps/web/src/app/run/[id]/page.tsx`
- Create: `apps/web/src/hooks/useJobStream.ts`

**Step 1: Create `apps/web/src/hooks/useJobStream.ts`**

```ts
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
      const data = JSON.parse(e.data)
      setEvents(prev => [...prev, { type: 'status', status: data.status }])
    })

    es.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data)
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
```

**Step 2: Create `apps/web/src/app/run/[id]/page.tsx`**

```tsx
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
  const { events, done } = useJobStream(jobId)

  async function handleSubmit(inputs: Record<string, string>) {
    setIsSubmitting(true)
    try {
      const job = await apiPost<Job>('/jobs', { skillId: id, inputs })
      setJobId(job.id)
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
          </CardContent>
        </Card>
      )}

      {jobId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Output
              {!done && <Badge variant="secondary">Running...</Badge>}
              {done && <Badge variant="default">Done</Badge>}
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
```

**Step 3: Verify end-to-end**

1. Visit `http://localhost:3000`
2. Click "Run Skill" on any skill card
3. Fill in form fields (auto-generated from schema)
4. Click Run → should see SSE events stream in

**Step 4: Commit**

```bash
git add apps/web/src/app/run apps/web/src/hooks/useJobStream.ts
git commit -m "feat: add skill runner page with dynamic form and SSE output"
```

---

## Task 14: AI Skill Generator Page

**Files:**
- Create: `apps/web/src/app/generate/page.tsx`

**Step 1: Create `apps/web/src/app/generate/page.tsx`**

```tsx
'use client'
import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Form, FormControl, FormField, FormItem, FormLabel
} from '@/components/ui/form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiPost, API_BASE_URL } from '@/lib/api'
import { GenerateSkillSchema } from '@skill-plant/shared'
import { useRouter } from 'next/navigation'
import type { Skill } from '@skill-plant/shared'

export default function GeneratePage() {
  const [generatedContent, setGeneratedContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()

  const form = useForm({
    resolver: zodResolver(GenerateSkillSchema),
    defaultValues: { description: '', model: 'claude-sonnet-4-5' as const },
  })

  async function handleGenerate(values: { description: string; model: string }) {
    setIsGenerating(true)
    setGeneratedContent('')

    const res = await fetch(`${API_BASE_URL}/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      // Parse SSE chunks
      const text = decoder.decode(value)
      const lines = text.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          setGeneratedContent(prev => prev + line.slice(6))
        }
      }
    }

    setIsGenerating(false)
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const skill = await apiPost<Skill>('/ai/generate/save', { content: generatedContent })
      router.push(`/run/${skill.id}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">✨ Generate Skill with AI</h1>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleGenerate)} className="space-y-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Describe your skill</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="I want a skill that analyzes CSV files and outputs statistics per column..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="claude-sonnet-4-5">Claude Sonnet</SelectItem>
                        <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        <SelectItem value="gemini-2.0-flash">Gemini Flash</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isGenerating}>
                {isGenerating ? 'Generating...' : '✨ Generate'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {generatedContent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Generated SKILL.md
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : '💾 Save & Run'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={generatedContent}
              onChange={e => setGeneratedContent(e.target.value)}
              rows={20}
              className="font-mono text-sm"
            />
          </CardContent>
        </Card>
      )}
    </main>
  )
}
```

**Step 2: Verify**

Visit `http://localhost:3000/generate`, describe a skill, watch it stream in, edit, save.

**Step 3: Commit**

```bash
git add apps/web/src/app/generate
git commit -m "feat: add ai skill generator page with multi-model support"
```

---

## Task 15: Docker Compose for Local Development

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`

**Step 1: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: skillplant
      POSTGRES_USER: skillplant
      POSTGRES_PASSWORD: skillplant
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgres://skillplant:skillplant@postgres:5432/skillplant
      REDIS_URL: redis://redis:6379
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      GOOGLE_GENERATIVE_AI_API_KEY: ${GOOGLE_GENERATIVE_AI_API_KEY:-}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock  # Docker-in-Docker for executor
      - uploads_data:/tmp/skill-plant-uploads
      - jobs_data:/tmp/skill-plant-jobs
    depends_on:
      - postgres
      - redis

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001
    depends_on:
      - api

volumes:
  postgres_data:
  uploads_data:
  jobs_data:
```

**Step 2: Create `.env.example`**

```
ANTHROPIC_API_KEY=your-key-here
OPENAI_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
DATABASE_URL=postgres://skillplant:skillplant@localhost:5432/skillplant
REDIS_URL=redis://localhost:6379
```

**Step 3: Create `apps/api/Dockerfile`**

```dockerfile
FROM oven/bun:1

WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN bun install

COPY apps/api/ apps/api/
COPY packages/shared/ packages/shared/

EXPOSE 3001
CMD ["bun", "run", "apps/api/src/index.ts"]
```

**Step 4: Test Docker Compose**

```bash
cp .env.example .env
# Fill in ANTHROPIC_API_KEY in .env
docker compose up
```

Expected: all services start, visit `http://localhost:3000`

**Step 5: Commit**

```bash
git add docker-compose.yml .env.example apps/api/Dockerfile apps/web/Dockerfile
git commit -m "chore: add docker compose for local development"
```

---

## Done

All 15 tasks complete. The platform is running locally with:
- Skill marketplace with search
- Dynamic forms generated from SKILL.md input schema
- Jobs executed in isolated Docker containers via Claude Code
- Real-time SSE streaming of job output
- AI skill generation with multi-model support
- GitHub skill import
