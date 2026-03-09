# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Skill Plant is an open platform that lets non-technical users browse, generate, and execute AI Skills (Claude Code SKILL.md files) through a web UI with dynamic forms, Docker-isolated execution, and real-time streaming output.

## Monorepo Structure

pnpm 9 + Turborepo monorepo with three workspace packages:

- **`apps/web`** — Next.js 16 frontend (React 19, shadcn/ui, TanStack Query, Vitest)
- **`apps/api`** — Hono API on Bun runtime (Drizzle ORM, BullMQ, Vercel AI SDK v6)
- **`packages/shared`** — Zod schemas and TypeScript types consumed by both apps (no build step — exports raw `.ts` via `"main": "./src/index.ts"`)

## Commands

All monorepo commands run from root via Turborepo:

```bash
pnpm install            # Install all dependencies
pnpm dev                # Start all dev servers (web :3000, api :3001)
pnpm build              # Build all apps
pnpm lint               # ESLint across all apps
pnpm typecheck          # tsc --noEmit across all apps
pnpm test               # Run all tests
```

### Per-app commands (run from respective app directory):

```bash
# apps/web — Vitest + Testing Library + happy-dom
cd apps/web && pnpm test           # Run tests once
cd apps/web && pnpm test:watch     # Watch mode

# apps/api — Bun native test runner
cd apps/api && bun test            # Run tests
cd apps/api && bun test src/routes/skills.test.ts  # Single test file

# packages/shared
cd packages/shared && bun test
```

### Infrastructure:

```bash
docker compose up postgres redis -d    # Start DB + Redis for local dev
DATABASE_URL=postgres://skillplant:skillplant@localhost:5432/skillplant bunx drizzle-kit migrate  # Run migrations
```

## Architecture

### Request Flow

```
Browser → Next.js (:3000) → Hono API (:3001) → PostgreSQL (Drizzle ORM)
                                              → BullMQ (Redis) → Docker container (Claude Code CLI)
                                              → SSE stream back to frontend
```

### API Routes (`apps/api/src/routes/`)

| Route | Purpose |
|-------|---------|
| `/skills` | CRUD for skills; GitHub import |
| `/uploads` | File uploads (saved to `/tmp/skill-plant-uploads`) |
| `/ai/generate` | Stream SKILL.md generation via AI (multi-model) |
| `/ai/analyze/:skillId` | AI analyzes skill content → returns input schema (cached in DB) |
| `/jobs` | Create/list jobs |
| `/jobs/:id/stream` | SSE stream for job status and output |

### Frontend Pages (`apps/web/src/app/`)

| Route | Purpose |
|-------|---------|
| `/` | Skill Marketplace — grid with search |
| `/generate` | AI Skill Generator — form + streaming preview |
| `/run/[id]` | Run a skill — dynamic form built from AI-analyzed input schema + SSE output |

### Job Execution

1. Frontend POSTs to `/jobs` with skillId + inputs
2. BullMQ enqueues the job (Redis-backed)
3. Worker spawns `docker run skill-plant-claude-code` with skill mounted at `/root/.claude/skills/`
4. Claude Code runs `claude --print "<prompt>"` inside the container
5. Output persisted to `~/.skill-plant/jobs/<jobId>/` (or `JOBS_DIR` env var)
6. Frontend polls via SSE (`/jobs/:id/stream`)

### Key Frontend Patterns

- **TanStack Query** for all server state (`useSkills`, `useSkill`, `useSkillInputSchema` hooks)
- **React Hook Form + Zod** for form validation; `DynamicForm` builds Zod schemas at runtime from a skill's `fields` array
- **`useJobStream`** hook wraps native `EventSource` for SSE
- File uploads go through `POST /uploads` first, then the returned server path is passed as job input
- Path alias: `@/*` → `./src/*`
- **Server/Client page split**: pages that need `export const dynamic` or other route segment config must be Server Components. Pattern: `page.tsx` (Server Component, holds config + re-exports) + `*Client.tsx` (`'use client'`, holds hooks and interactive logic). Example: `app/page.tsx` → `app/MarketplaceClient.tsx`
- **Suspense + ErrorBoundary**: data-fetching components use `useSuspenseQuery` / `useSuspenseQueries`; outer page wraps them in `<ErrorBoundary>` + `<Suspense>`. Use `useSuspenseQueries` (parallel) instead of two sequential `useSuspenseQuery` calls to avoid waterfall.

### AI Multi-Model Support

Vercel AI SDK v6 with three providers configured in the API:
- `gpt-5` → `@ai-sdk/openai`
- `claude-sonnet-4-5` → `@ai-sdk/anthropic`
- `gemini-2.0-flash` → `@ai-sdk/google`

### Database

PostgreSQL 16 via Drizzle ORM. Schema in `apps/api/src/db/schema.ts`. Two tables: `skills` and `jobs`. Config in `apps/api/drizzle.config.ts`, migrations output to `apps/api/src/db/migrations/`.

### Environment

API validates env vars at startup via Zod (`apps/api/src/lib/env.ts`). Required: `DATABASE_URL`. Optional with defaults: `REDIS_URL`, `PORT`, `CORS_ORIGIN`. AI keys are all optional (at least one needed for AI features).

## Testing

- **`apps/web`**: Vitest + `@testing-library/react` + happy-dom. Tests co-located in `__tests__/` dirs. Setup in `src/test/setup.ts`.
- **`apps/api`**: Bun test runner. Route tests use `app.request()` with mocked `db` and `jobQueue` modules.
- **`packages/shared`**: Bun test. Schema validation tests.

## Turborepo Task Dependencies

All tasks except `dev` depend on `^build` (dependencies build first). Since `shared` has no build step, this resolves immediately. `dev` and `test` are not cached.
