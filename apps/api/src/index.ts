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
