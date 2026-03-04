import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
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

    // Convert GitHub tree URL to raw content URL
    // e.g. https://github.com/anthropics/skills/tree/main/skills/pdf
    //   -> https://raw.githubusercontent.com/anthropics/skills/main/skills/pdf/SKILL.md
    const rawUrl = url
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/tree/', '/')
      + '/SKILL.md'

    const res = await fetch(rawUrl)
    if (!res.ok) return c.json({ error: 'Failed to fetch SKILL.md from GitHub' }, 400)

    const content = await res.text()

    // Parse frontmatter
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
