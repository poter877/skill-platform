import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../db'
import { skills } from '../db/schema'
import { eq } from 'drizzle-orm'
import { ImportGithubSkillSchema } from '@skill-plant/shared'

export const skillsRouter = new Hono()

// List all skills
skillsRouter.get('/', async (c) => {
  try {
    const rows = await db.select().from(skills)
    return c.json(rows)
  } catch (err) {
    console.error('Failed to list skills:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get single skill
skillsRouter.get('/:id', async (c) => {
  try {
    const [skill] = await db.select().from(skills).where(eq(skills.id, c.req.param('id')))
    if (!skill) return c.json({ error: 'Not found' }, 404)
    return c.json(skill)
  } catch (err) {
    console.error('Failed to get skill:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Import from GitHub
skillsRouter.post(
  '/import/github',
  zValidator('json', ImportGithubSkillSchema),
  async (c) => {
    const { url } = c.req.valid('json')

    // Convert GitHub tree/blob URL to raw content URL
    // e.g. https://github.com/anthropics/skills/tree/main/skills/pdf
    //   -> https://raw.githubusercontent.com/anthropics/skills/main/skills/pdf/SKILL.md
    const rawUrl = url
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/tree/', '/')
      .replace('/blob/', '/')
      .replace(/\/SKILL\.md$/, '')  // avoid double SKILL.md if user pasted file link
      + '/SKILL.md'

    try {
      const res = await fetch(rawUrl)
      if (!res.ok) return c.json({ error: 'Failed to fetch SKILL.md from GitHub' }, 400)

      const content = await res.text()

      // Parse frontmatter
      // Extract frontmatter block between first --- delimiters
      const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/m)
      const frontmatter = frontmatterMatch?.[1] ?? content

      const nameMatch = frontmatter.match(/^name:\s*["']?(.+?)["']?\s*$/m)
      const descMatch = frontmatter.match(/^description:\s*["']?(.+?)["']?\s*$/m)

      const [skill] = await db.insert(skills).values({
        name: nameMatch?.[1]?.trim() ?? 'Unnamed',
        description: descMatch?.[1]?.trim() ?? '',
        content,
        source: 'github',
        githubUrl: url,
      }).returning()

      return c.json(skill, 201)
    } catch (err) {
      console.error('Failed to import skill:', err)
      return c.json({ error: 'Internal server error' }, 500)
    }
  }
)

// Delete skill
skillsRouter.delete('/:id', async (c) => {
  try {
    await db.delete(skills).where(eq(skills.id, c.req.param('id')))
    return c.json({ ok: true })
  } catch (err) {
    console.error('Failed to delete skill:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
