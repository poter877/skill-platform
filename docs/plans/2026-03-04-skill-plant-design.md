# Skill Plant Platform Design

**Date:** 2026-03-04

## Overview

A web platform that makes Claude Code skills accessible to non-programmers. Users can browse, run, and generate skills through a chat-based UI — no CLI or coding knowledge required.

**Core problem:** Skills (like PDF parsing, data analysis) exist in the Claude Code ecosystem but are only usable by developers via CLI. This platform bridges that gap.

---

## Architecture

```
Frontend (Next.js + shadcn)
├── Skill Marketplace      — browse, search, filter skills
├── Skill Runner           — dynamic form + chat interface
├── Skill Generator        — AI-assisted skill creation
└── Job History            — past runs and results

HonoJS API (Bun runtime)
├── /skills/generate       — Vercel AI SDK streamText → SKILL.md
├── /skills/analyze        — Vercel AI SDK generateObject → input schema
├── /jobs/run              — enqueue Docker job
└── /jobs/:id/stream       — SSE → Claude Code output

Execution Layer
└── Docker + Claude Code CLI (server-side, isolated per job)

Shared
└── packages/shared/schemas — Zod schemas shared between front and back
```

---

## User Flow

1. **Browse** skill marketplace → select "PDF Parser"
2. **Dynamic form** rendered from skill's input schema (see Input Schema section)
3. **Upload file** + type instruction → submit
4. **BullMQ** enqueues job → HTTP returns `jobId` immediately
5. **SSE stream** (`/jobs/:id/stream`) pushes Claude Code output in real time
6. **Results** displayed in chat format

---

## Skill Storage

| Source | Storage Location |
|--------|-----------------|
| Built-in | Platform Git repo `/skills/` directory |
| GitHub import | Fetched + cached to DB + local disk |
| User upload | S3 / Cloudflare R2, bound to user account |

**Runtime injection into Docker:**

```bash
# Skill files written to temp dir on host, mounted into container
docker run \
  -v /tmp/jobs/job-abc123/skills:/root/.claude/skills \
  -v /tmp/jobs/job-abc123/workspace:/workspace \
  -e ANTHROPIC_API_KEY=xxx \
  claude-code-image \
  claude --print "process /workspace/upload.pdf"
```

---

## Input Schema (Dynamic Form Generation)

SKILL.md frontmatter is extended with an optional `inputs` field:

```yaml
---
name: pdf
description: Use when working with PDF files...
inputs:
  - name: pdf_file
    type: file
    accept: [".pdf", ".PDF"]
    label: "Upload PDF"
    required: true
  - name: instruction
    type: textarea
    label: "What do you want?"
    placeholder: "Extract tables / summarize / translate..."
    required: true
  - name: language
    type: select
    label: "Output language"
    options: ["中文", "English", "日本語"]
    default: "中文"
---
```

**Field types:** `file`, `text`, `textarea`, `select`, `multiselect`, `number`, `url`

**For skills without `inputs` metadata (e.g. external GitHub skills):**
1. Call `generateObject` with the SKILL.md content to auto-generate schema
2. Cache result to DB — only runs once per skill
3. Platform admins can manually edit/override cached schema
4. Fallback: generic file upload + free text if AI analysis fails

---

## AI Skill Generation

Users describe a skill in natural language → AI generates SKILL.md:

```
User: "I want a skill that analyzes CSV files and outputs stats per column"
Model selector: [Claude Sonnet ▼]
→ streamText → real-time SKILL.md preview
→ User reviews and edits
→ Save to platform
```

**Multi-model support via Vercel AI SDK:**

```ts
const PROVIDERS = {
  'claude-sonnet-4-5': anthropic('claude-sonnet-4-5-20251001'),
  'gpt-4o': openai('gpt-4o'),
  'gemini-2.0-flash': google('gemini-2.0-flash'),
}
```

All AI features (skill generation, schema analysis) route through this provider map.

---

## Streaming Strategy

All streaming uses SSE via HonoJS `streamSSE()`:

| Endpoint | Content |
|----------|---------|
| `/skills/generate` | Vercel AI SDK — generated SKILL.md chunks |
| `/skills/analyze` | Vercel AI SDK — input schema JSON |
| `/jobs/:id/stream` | Raw Claude Code stdout from Docker container |

---

## Job Queue (BullMQ + Redis)

```
POST /jobs/run → returns { jobId } immediately
                     ↓
              BullMQ worker picks up job
                     ↓
              Docker container spins up
                     ↓
              Claude Code runs with skill + user files
                     ↓
              Stdout piped to Redis pub/sub
                     ↓
              SSE endpoint subscribes and pushes to client
```

---

## Tech Stack

### Frontend
| Tech | Role |
|------|------|
| Next.js (App Router) | Framework |
| shadcn/ui + Tailwind | UI components |
| Zod | Validation |
| React Hook Form | Dynamic form handling |
| TanStack Query | Server state / caching |
| nuqs | URL search param state (marketplace filters) |
| Vercel AI SDK (client) | useChat / SSE consumption |

### Backend
| Tech | Role |
|------|------|
| HonoJS + Bun | API server |
| Vercel AI SDK (server) | streamText, generateObject |
| Drizzle ORM | Database access |
| PostgreSQL | Skills metadata, job history, users |
| BullMQ + Redis | Async job queue |
| Cloudflare R2 | Skill files + user uploads |
| Better Auth | Authentication (internal → OAuth later) |
| dockerode | Docker SDK for Bun/Node |

### Monorepo
| Tech | Role |
|------|------|
| Turborepo | Build orchestration |
| pnpm workspaces | Package management |
| `packages/shared` | Shared Zod schemas + types |

### Project Structure
```
skill-plant/
├── apps/
│   ├── web/          ← Next.js + shadcn
│   └── api/          ← HonoJS + Bun
└── packages/
    └── shared/
        └── schemas/  ← Zod schemas shared front+back
            ├── skill.ts
            ├── job.ts
            └── form.ts
```

---

## Deployment Phases

**Phase 1 (Internal):** Docker Compose, single server, no multi-tenancy needed
**Phase 2 (Public SaaS):** Auth + billing + horizontal scaling for Docker workers
