import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { zValidator } from '@hono/zod-validator'
import { streamText, generateObject } from 'ai'
import { z } from 'zod'
import { db } from '../db'
import { skills } from '../db/schema'
import { eq } from 'drizzle-orm'
import { getModel, SKILL_GENERATION_SYSTEM, SCHEMA_ANALYSIS_SYSTEM } from '../lib/ai'
import { GenerateSkillSchema, FormFieldSchema } from '@skill-plant/shared'

export const aiRouter = new Hono()

// Stream skill generation
aiRouter.post(
  '/generate',
  zValidator('json', GenerateSkillSchema),
  async (c) => {
    const { description, model } = c.req.valid('json')

    return streamSSE(c, async (stream) => {
      try {
        const result = streamText({
          model: getModel(model),
          system: SKILL_GENERATION_SYSTEM,
          prompt: description,
        })

        for await (const chunk of result.textStream) {
          await stream.writeSSE({ data: chunk })
        }
      } catch (err) {
        await stream.writeSSE({ data: JSON.stringify({ error: String(err) }), event: 'error' })
      }
    })
  }
)

// Analyze skill → generate input schema (with DB caching)
aiRouter.post('/analyze/:skillId', async (c) => {
  try {
    const skillId = c.req.param('skillId')
    const [skill] = await db.select().from(skills).where(eq(skills.id, skillId))
    if (!skill) return c.json({ error: 'Skill not found' }, 404)

    // Return cached schema if available
    if (skill.inputs) return c.json({ fields: skill.inputs })

    const { object } = await generateObject({
      model: getModel('claude-sonnet-4-5'),
      system: SCHEMA_ANALYSIS_SYSTEM,
      prompt: skill.content,
      schema: z.object({ fields: z.array(FormFieldSchema) }),
    })

    // Cache to DB
    await db.update(skills)
      .set({ inputs: object.fields, updatedAt: new Date() })
      .where(eq(skills.id, skillId))

    return c.json(object)
  } catch (err) {
    console.error('Schema analysis failed:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Save AI-generated skill
aiRouter.post(
  '/generate/save',
  zValidator('json', z.object({ content: z.string().min(1) })),
  async (c) => {
    try {
      const { content } = c.req.valid('json')

      const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/m)
      const frontmatter = frontmatterMatch?.[1] ?? content

      const nameMatch = frontmatter.match(/^name:\s*["']?(.+?)["']?\s*$/m)
      const descMatch = frontmatter.match(/^description:\s*["']?(.+?)["']?\s*$/m)

      const [skill] = await db.insert(skills).values({
        name: nameMatch?.[1]?.trim() ?? 'generated-skill',
        description: descMatch?.[1]?.trim() ?? '',
        content,
        source: 'upload',
      }).returning()

      return c.json(skill, 201)
    } catch (err) {
      console.error('Failed to save skill:', err)
      return c.json({ error: 'Internal server error' }, 500)
    }
  }
)
