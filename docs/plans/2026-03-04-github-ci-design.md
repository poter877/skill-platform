# GitHub CI Workflow Design

## Goal

Add a GitHub Actions CI workflow that runs lint, typecheck, test, and build on every PR and push to main.

## Approach

Single workflow file (`.github/workflows/ci.yml`) with 4 parallel jobs.

## Trigger

- `pull_request`: all branches
- `push`: main branch only

## Jobs

All jobs run on `ubuntu-latest` with identical setup steps:

1. Checkout code
2. Install Node 20
3. Install pnpm 9 (via `pnpm/action-setup`)
4. Install Bun (via `oven-sh/setup-bun`)
5. Cache pnpm store
6. `pnpm install --frozen-lockfile`

### Job Matrix

| Job | Command | Purpose |
|-----|---------|---------|
| lint | `pnpm lint` | ESLint (web only currently) |
| typecheck | `pnpm typecheck` | `tsc --noEmit` across all apps |
| test | `pnpm test` | Vitest (web) + Bun test (api, shared) |
| build | `pnpm build` | Next.js build (web) + Bun build (api) |

Jobs are independent — failure of one does not cancel others.

## Infrastructure

No database or Redis needed. All tests are fully mocked.

## Caching

- pnpm store cached via `actions/setup-node` built-in cache
- Turborepo local cache (within each job run)
