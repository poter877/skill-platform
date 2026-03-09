# Skill Platform

[![CI](https://github.com/poter877/skill-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/poter877/skill-platform/actions/workflows/ci.yml)

让每个人都能使用 AI Skill 的开放平台。

## 背景

目前市面上的 AI Skill（如 Claude Code Skills）大多面向程序员设计——需要编写 SKILL.md、理解 frontmatter 格式、通过 CLI 调用。这意味着大量非技术用户被拒之门外，无法享受 AI Skill 带来的效率提升。

**Skill Platform** 解决了这个问题：

- **非程序员也能用** — 通过可视化表单直接填写参数、一键执行，无需接触代码或命令行
- **AI 生成 Skill** — 用自然语言描述需求，AI 自动生成 SKILL.md，降低 Skill 创建门槛
- **开放共享** — 用户可以上传自己的 Skill 到 Marketplace，供其他人搜索和使用
- **安全隔离** — 所有 Skill 在独立的 Docker 容器中执行，互不干扰

## 架构

```
skill-platform/
├── apps/
│   ├── web/          # Next.js 16 前端 (React 19 + shadcn/ui)
│   └── api/          # Hono + Bun 后端 API
├── packages/
│   └── shared/       # 共享 Zod schemas 和类型
├── docker/
│   └── claude-code/  # Claude Code CLI Docker 镜像
└── docker-compose.yml
```

## 技术栈

| 层       | 技术                                                       |
| -------- | ---------------------------------------------------------- |
| 前端     | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Radix UI |
| 数据获取 | TanStack Query, Vercel AI SDK v6, React Hook Form + Zod    |
| 后端     | Hono, Bun                                                  |
| 数据库   | PostgreSQL 16, Drizzle ORM                                 |
| 队列     | BullMQ + Redis                                             |
| AI       | Anthropic Claude, OpenAI GPT, Google Gemini (多模型支持)   |
| 执行     | Docker 容器中运行 Claude Code CLI                          |
| 构建     | Turborepo, pnpm                                            |

## 核心功能

- **Skill Marketplace** — 浏览、搜索已发布的 Skills
- **AI 生成 Skill** — 用自然语言描述需求，AI 流式生成 SKILL.md 文件，支持多模型选择
- **动态表单** — AI 分析 Skill 内容，自动生成输入表单（支持 text / file / select 等字段类型）
- **任务执行** — 通过 BullMQ 队列调度，在 Docker 容器中隔离运行 Claude Code CLI
- **实时输出** — SSE 流式推送任务状态和执行结果

## 使用指南

### Step 1: 浏览 Skill Marketplace

首页展示所有已发布的 Skills，支持按名称和描述搜索。

![Skill Marketplace](docs/screenshots/01-marketplace.png)

### Step 2: 生成新 Skill

点击右上角 "Generate Skill"，用自然语言描述你需要的 Skill，选择 AI 模型（GPT-5 / Claude Sonnet / Gemini Flash），AI 会流式生成 SKILL.md 文件。

![Generate Skill](docs/screenshots/02-generate.png)

### Step 3: 运行 Skill

选择一个 Skill 后，系统会通过 AI 自动分析 Skill 内容并生成动态输入表单。填写参数后点击 "Run Skill"，任务将在隔离的 Docker 容器中执行。

![Run Skill](docs/screenshots/03-run-skill.png)

### Step 4: 搜索 Skill

在搜索框中输入关键词，实时过滤 Marketplace 中的 Skills。

![Search Skills](docs/screenshots/04-search.png)

## 快速开始

### 前置要求

- Node.js >= 20
- pnpm >= 9
- Docker
- PostgreSQL 16
- Redis 7

### 使用 Docker Compose（推荐）

```bash
# 1. 克隆项目
git clone <repo-url> && cd skill-platform

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 ANTHROPIC_AUTH_TOKEN 和 ANTHROPIC_BASE_URL

# 3. 启动服务
docker compose up -d

# 4. 前端默认在 http://localhost:3000，API 在 http://localhost:3001
```

### 本地开发

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env

# 3. 启动 PostgreSQL 和 Redis
docker compose up postgres redis -d

# 4. 启动开发服务器
pnpm dev
```

## 环境变量

| 变量                           | 必填 | 说明                                  |
| ------------------------------ | ---- | ------------------------------------- |
| `ANTHROPIC_AUTH_TOKEN`         | 是   | Anthropic Auth Token                  |
| `ANTHROPIC_BASE_URL`           | 是   | API 地址                              |
| `ANTHROPIC_API_KEY`            | 否   | Anthropic API Key（直连官方 API 时）  |
| `OPENAI_API_KEY`               | 否   | OpenAI API Key                        |
| `GOOGLE_GENERATIVE_AI_API_KEY` | 否   | Google AI API Key                     |
| `DATABASE_URL`                 | 是   | PostgreSQL 连接字符串                 |
| `REDIS_URL`                    | 否   | Redis 连接地址（默认 localhost:6379） |
| `CORS_ORIGIN`                  | 否   | 前端地址（默认 http://localhost:3000）|
| `PORT`                         | 否   | API 端口（默认 3001）                 |

## 项目脚本

```bash
pnpm dev        # 启动所有应用的开发服务器
pnpm build      # 构建所有应用
pnpm lint       # 代码检查
pnpm typecheck  # 类型检查
pnpm test       # 运行测试
```

## License

MIT
