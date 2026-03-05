# Fix Build & Deploy Configuration (Issue #9) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all build, deployment, and configuration issues identified in GitHub issue #9, enabling reproducible builds and correct containerized deployment.

**Architecture:** Systematically fix 10 sub-issues in priority order (High → Medium → Low). Each fix is self-contained with its own test and commit. BullMQ Redis connection is fixed via ioredis, paths are unified via env vars, Dockerfile switches to pnpm, and missing scripts/configs are added.

**Tech Stack:** Bun, pnpm, Docker, BullMQ/ioredis, Drizzle ORM, Next.js 16, Turborepo

---

### Task 1: Fix BullMQ Redis connection format

**Files:**
- Modify: `apps/api/src/lib/queue.ts`
- Modify: `apps/api/package.json` (add `ioredis` dep)
- Test: `apps/api/src/lib/__tests__/queue.test.ts`

**Context:** BullMQ `ConnectionOptions` expects `{ host, port }` or an ioredis instance. The current `{ url: env.REDIS_URL }` is silently ignored, falling back to `localhost:6379`. This works locally but breaks in Docker where Redis is at `redis://redis:6379`.

**Step 1: Add ioredis dependency**

Run: `cd apps/api && bun add ioredis && bun add -D @types/ioredis`

**Step 2: Write the failing test**

Create `apps/api/src/lib/__tests__/queue.test.ts`:

```ts
import { describe, it, expect, mock, beforeEach } from 'bun:test'

// Mock ioredis before importing queue
const mockRedisInstance = { status: 'ready' }
mock.module('ioredis', () => ({
  default: class Redis {
    constructor(public url: string) {
      Object.assign(this, mockRedisInstance)
    }
  },
}))

// Mock other deps
mock.module('../../db', () => ({ db: {} }))
mock.module('../../db/schema', () => ({ jobs: {}, skills: {} }))
mock.module('../executor', () => ({ runJob: async () => '' }))
mock.module('../env', () => ({
  env: { REDIS_URL: 'redis://custom-host:6380' },
}))

describe('queue', () => {
  it('creates Redis connection from REDIS_URL', async () => {
    const { createRedisConnection } = await import('../queue')
    const conn = createRedisConnection()
    expect(conn).toBeDefined()
    expect(conn.url).toBe('redis://custom-host:6380')
  })
})
```

**Step 3: Run test to verify it fails**

Run: `cd apps/api && bun test src/lib/__tests__/queue.test.ts`
Expected: FAIL — `createRedisConnection` not exported

**Step 4: Fix the Redis connection in queue.ts**

Replace `apps/api/src/lib/queue.ts` with:

```ts
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
```

**Step 5: Run test to verify it passes**

Run: `cd apps/api && bun test src/lib/__tests__/queue.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/api/src/lib/queue.ts apps/api/src/lib/__tests__/queue.test.ts apps/api/package.json
git commit -m "fix: use ioredis instance for BullMQ Redis connection

BullMQ ConnectionOptions does not support { url } format.
Creates proper ioredis instance from REDIS_URL.

Closes #9 (item 2)"
```

---

### Task 2: Fix JOBS_DIR path mismatch

**Files:**
- Modify: `apps/api/src/lib/env.ts` (add JOBS_DIR, UPLOAD_DIR, DOCKER_IMAGE)
- Modify: `apps/api/src/lib/executor.ts` (use env.JOBS_DIR, env.DOCKER_IMAGE)
- Modify: `docker-compose.yml` (set JOBS_DIR env var)

**Context:** executor defaults `JOBS_DIR = ~/.skill-plant/jobs` but docker-compose mounts volume at `/tmp/skill-plant-jobs`. Docker image name `skill-plant-claude-code` is hardcoded. Both need env var configuration.

**Step 1: Add env vars to env.ts**

Add these fields to the `EnvSchema` in `apps/api/src/lib/env.ts`:

```ts
JOBS_DIR: z.string().default(join(homedir(), '.skill-plant', 'jobs')),
UPLOAD_DIR: z.string().default('/tmp/skill-plant-uploads'),
DOCKER_IMAGE: z.string().default('skill-plant-claude-code'),
```

Add imports at top:

```ts
import { join } from 'node:path'
import { homedir } from 'node:os'
```

**Step 2: Update executor.ts to use env vars**

In `apps/api/src/lib/executor.ts`:

Remove line 8 (`const JOBS_DIR = ...`) and replace with:

```ts
const JOBS_DIR = env.JOBS_DIR
```

Replace hardcoded `'skill-plant-claude-code'` on line 57 with:

```ts
env.DOCKER_IMAGE,
```

Remove the unused `join` import for JOBS_DIR (keep it for path building below).

**Step 3: Update docker-compose.yml**

Add `JOBS_DIR` and `UPLOAD_DIR` to the api service environment:

```yaml
JOBS_DIR: /tmp/skill-plant-jobs
UPLOAD_DIR: /tmp/skill-plant-uploads
```

**Step 4: Run existing tests**

Run: `cd apps/api && bun test`
Expected: PASS (existing tests should still pass)

**Step 5: Commit**

```bash
git add apps/api/src/lib/env.ts apps/api/src/lib/executor.ts docker-compose.yml
git commit -m "fix: unify JOBS_DIR via env var, make Docker image configurable

Adds JOBS_DIR, UPLOAD_DIR, DOCKER_IMAGE to env schema with defaults.
Executor reads from env instead of hardcoded paths/image name.
docker-compose sets JOBS_DIR=/tmp/skill-plant-jobs to match volume mount.

Closes #9 (items 1, 6)"
```

---

### Task 3: Add database migration scripts

**Files:**
- Modify: `apps/api/package.json` (add db scripts)
- Create: `apps/api/src/db/migrations/.gitkeep`

**Context:** drizzle.config.ts points to `./src/db/migrations` but the directory doesn't exist. No npm scripts for generating or running migrations.

**Step 1: Create migrations directory**

Run: `mkdir -p apps/api/src/db/migrations && touch apps/api/src/db/migrations/.gitkeep`

**Step 2: Add migration scripts to package.json**

Add these scripts to `apps/api/package.json`:

```json
"db:generate": "bunx drizzle-kit generate",
"db:migrate": "bunx drizzle-kit migrate",
"db:push": "bunx drizzle-kit push",
"db:studio": "bunx drizzle-kit studio"
```

**Step 3: Generate initial migration**

Run: `cd apps/api && DATABASE_URL=postgres://skillplant:skillplant@localhost:5432/skillplant bun run db:generate`
Expected: Migration SQL files created in `src/db/migrations/`

Note: This step requires postgres running. If unavailable, skip — the scripts are still correct.

**Step 4: Commit**

```bash
git add apps/api/package.json apps/api/src/db/migrations/
git commit -m "feat: add Drizzle migration scripts and migrations directory

Adds db:generate, db:migrate, db:push, db:studio scripts.
Creates migrations directory referenced by drizzle.config.ts.

Closes #9 (item 3)"
```

---

### Task 4: Configure next.config.ts

**Files:**
- Modify: `apps/web/next.config.ts`

**Context:** Empty Next.js config missing transpilePackages for shared package (raw .ts exports), standalone output for Docker, and security headers.

**Step 1: Update next.config.ts**

Replace `apps/web/next.config.ts` with:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@skill-plant/shared"],
  output: "standalone",
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ],
};

export default nextConfig;
```

**Step 2: Verify build still works**

Run: `cd apps/web && pnpm build`
Expected: Build succeeds with standalone output

Note: If build environment is not fully set up, at least verify `pnpm typecheck` passes from root.

**Step 3: Commit**

```bash
git add apps/web/next.config.ts
git commit -m "fix: configure Next.js with transpilePackages, standalone, security headers

shared package exports raw .ts - transpilePackages ensures build works.
standalone output enables containerized deployment.
Adds basic security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy).

Closes #9 (item 4)"
```

---

### Task 5: Fix API Dockerfile for pnpm workspace

**Files:**
- Modify: `apps/api/Dockerfile`

**Context:** Dockerfile uses `bun install` without lockfile. Project uses pnpm workspaces, so we should use pnpm for reproducible installs, then run with bun.

**Step 1: Rewrite Dockerfile**

Replace `apps/api/Dockerfile` with:

```dockerfile
FROM oven/bun:1 AS base

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace manifests + lockfile for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

# Install deps with frozen lockfile for reproducibility
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/api/ apps/api/
COPY packages/shared/ packages/shared/

# Add .dockerignore protection — don't rely on it alone
# Verify no .env was copied
RUN test ! -f .env || (echo "ERROR: .env copied into image" && exit 1)

EXPOSE 3001
CMD ["bun", "run", "apps/api/src/index.ts"]
```

**Step 2: Create .dockerignore if missing**

Check and create `/Users/ll/skill-plant/.dockerignore`:

```
.env
.env.*
**/node_modules
**/.next
**/dist
.git
```

**Step 3: Test Docker build**

Run: `docker build -f apps/api/Dockerfile -t skill-plant-api .`
Expected: Build succeeds without errors

Note: If Docker is not available, verify the Dockerfile syntax is correct.

**Step 4: Commit**

```bash
git add apps/api/Dockerfile .dockerignore
git commit -m "fix: use pnpm install with frozen lockfile in API Dockerfile

Switches from bun install to pnpm install --frozen-lockfile for reproducible builds.
Adds .dockerignore to prevent .env leakage.
Adds build-time check for accidentally copied .env files.

Closes #9 (item 5)"
```

---

### Task 6: Update .env.example with all variables

**Files:**
- Modify: `.env.example`

**Context:** Missing JOBS_DIR, UPLOAD_DIR, DOCKER_IMAGE, NEXT_PUBLIC_API_URL, and R2 storage variables.

**Step 1: Update .env.example**

Replace `.env.example` with:

```env
# === Required ===
DATABASE_URL=postgres://skillplant:skillplant@localhost:5432/skillplant

# === AI Provider Keys (at least one needed for AI features) ===
ANTHROPIC_API_KEY=your-key-here
ANTHROPIC_AUTH_TOKEN=your-token-here
ANTHROPIC_BASE_URL=
OPENAI_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=

# === Infrastructure ===
REDIS_URL=redis://localhost:6379
PORT=3001
CORS_ORIGIN=http://localhost:3000

# === Paths ===
# JOBS_DIR=~/.skill-plant/jobs       # Default: ~/.skill-plant/jobs (set to /tmp/skill-plant-jobs in Docker)
# UPLOAD_DIR=/tmp/skill-plant-uploads # Default: /tmp/skill-plant-uploads
# DOCKER_IMAGE=skill-plant-claude-code # Default: skill-plant-claude-code

# === Frontend ===
# NEXT_PUBLIC_API_URL=http://localhost:3001  # Override for non-local deployments

# === Cloudflare R2 Storage (optional) ===
# R2_ACCOUNT_ID=
# R2_ACCESS_KEY_ID=
# R2_SECRET_ACCESS_KEY=
# R2_BUCKET=
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add all environment variables to .env.example

Adds JOBS_DIR, UPLOAD_DIR, DOCKER_IMAGE, NEXT_PUBLIC_API_URL, and R2 vars.
Groups variables by category with comments.

Closes #9 (item 7)"
```

---

### Task 7: Add missing typecheck scripts

**Files:**
- Modify: `apps/web/package.json`
- Modify: `packages/shared/package.json`

**Context:** turbo.json defines a `typecheck` task, but web and shared packages lack the script, so `pnpm typecheck` silently skips them.

**Step 1: Add typecheck script to web**

Add to `apps/web/package.json` scripts:

```json
"typecheck": "tsc --noEmit"
```

**Step 2: Add typecheck script to shared**

Add to `packages/shared/package.json` scripts:

```json
"typecheck": "tsc --noEmit"
```

**Step 3: Verify typecheck runs across all packages**

Run from root: `pnpm typecheck`
Expected: All three packages (api, web, shared) run tsc --noEmit

**Step 4: Commit**

```bash
git add apps/web/package.json packages/shared/package.json
git commit -m "fix: add typecheck scripts to web and shared packages

turbo typecheck task now runs across all packages instead of silently skipping.

Closes #9 (item 8)"
```

---

### Task 8: Align TypeScript targets

**Files:**
- Modify: `apps/web/tsconfig.json`

**Context:** web targets ES2017, api and shared target ES2022. Since Next.js handles transpilation and all modern browsers support ES2022, align web to ES2022.

**Step 1: Update web tsconfig.json target**

In `apps/web/tsconfig.json`, change:

```json
"target": "ES2017"
```

to:

```json
"target": "ES2022"
```

**Step 2: Verify typecheck still passes**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/tsconfig.json
git commit -m "fix: align web TypeScript target to ES2022

Matches api and shared packages. Next.js handles downlevel transpilation.
Prevents potential issues with shared package consuming ES2022 features.

Closes #9 (item 9)"
```

---

### Task 9: Add build script to shared package

**Files:**
- Modify: `packages/shared/package.json`

**Context:** shared exports raw `.ts` with no build step. turbo `^build` dependency chain breaks here. Adding a no-op build script satisfies turbo without changing the raw TS export strategy (Next.js transpilePackages handles it).

**Step 1: Add no-op build script**

Add to `packages/shared/package.json` scripts:

```json
"build": "echo 'shared: no build step (raw .ts exports)'"
```

**Step 2: Verify turbo build**

Run from root: `pnpm build`
Expected: All packages build successfully, shared shows the echo message

**Step 3: Commit**

```bash
git add packages/shared/package.json
git commit -m "fix: add no-op build script to shared package

Satisfies turbo ^build dependency chain. Shared package intentionally
exports raw .ts — transpilation handled by consumers (Next.js transpilePackages).

Closes #9 (item 10)"
```

---

### Task 10: Final verification and cleanup

**Files:** None (verification only)

**Step 1: Run full typecheck**

Run: `pnpm typecheck`
Expected: All packages pass

**Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 3: Run lint**

Run: `pnpm lint`
Expected: No new lint errors

**Step 4: Test Docker build (if Docker available)**

Run: `docker build -f apps/api/Dockerfile -t skill-plant-api .`
Expected: Build succeeds

**Step 5: Final commit if any fixes needed**

If any verification steps reveal issues, fix and commit them.

**Step 6: Summary commit / PR**

All 10 sub-issues from #9 should now be resolved:

| # | Issue | Status |
|---|-------|--------|
| 1 | JOBS_DIR path mismatch | Fixed (Task 2) |
| 2 | BullMQ Redis connection | Fixed (Task 1) |
| 3 | Missing migration dir/scripts | Fixed (Task 3) |
| 4 | Empty next.config.ts | Fixed (Task 4) |
| 5 | API Dockerfile | Fixed (Task 5) |
| 6 | Hardcoded Docker image | Fixed (Task 2) |
| 7 | Missing env vars | Fixed (Task 6) |
| 8 | Missing typecheck scripts | Fixed (Task 7) |
| 9 | TypeScript target mismatch | Fixed (Task 8) |
| 10 | Shared no build script | Fixed (Task 9) |
