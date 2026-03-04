import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { env } from './lib/env'
import { skillsRouter } from './routes/skills'
import { uploadsRouter } from './routes/uploads'
import { aiRouter } from './routes/ai'
import { jobsRouter } from './routes/jobs'
import './lib/queue'

const app = new Hono()

app.use('*', logger())
app.use('*', cors({ origin: env.CORS_ORIGIN }))

app.get('/health', (c) => c.json({ ok: true }))

app.route('/skills', skillsRouter)
app.route('/uploads', uploadsRouter)
app.route('/ai', aiRouter)
app.route('/jobs', jobsRouter)

export default {
  port: env.PORT,
  fetch: app.fetch,
  idleTimeout: 120,
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
  process.exit(1)
})
