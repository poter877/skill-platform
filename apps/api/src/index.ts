import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { env } from './lib/env'

const app = new Hono()

app.use('*', logger())
app.use('*', cors({ origin: env.CORS_ORIGIN }))

app.get('/health', (c) => c.json({ ok: true }))

export default {
  port: env.PORT,
  fetch: app.fetch,
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
  process.exit(1)
})
