import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { streamText, generateText, Output } from 'ai'
import { z } from 'zod'
import { db } from '../db'
import { skills } from '../db/schema'
import { eq } from 'drizzle-orm'
import { getModel, SKILL_GENERATION_SYSTEM, SCHEMA_ANALYSIS_SYSTEM } from '../lib/ai'
import { GenerateSkillSchema } from '@skill-plant/shared'

export const aiRouter = new Hono()

// Schema for structured output (OpenAI requires all fields in 'required', use nullable instead of optional)
const AnalysisFieldSchema = z.object({
  name: z.string(),
  type: z.enum(['file', 'text', 'textarea', 'select', 'multiselect', 'number', 'url']),
  label: z.string(),
  required: z.boolean(),
  placeholder: z.string().nullable(),
  accept: z.array(z.string()).nullable(),
  options: z.array(z.string()).nullable(),
  default: z.string().nullable(),
})

// Stream skill generation
aiRouter.post(
  '/generate',
  zValidator('json', GenerateSkillSchema),
  async (c) => {
    const { description, model } = c.req.valid('json')

    const result = streamText({
      model: getModel(model),
      system: SKILL_GENERATION_SYSTEM,
      prompt: description,
    })

    return result.toTextStreamResponse()
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

    const { output } = await generateText({
      model: getModel('gpt-5'),
      system: SCHEMA_ANALYSIS_SYSTEM,
      prompt: skill.content,
      output: Output.object({
        schema: z.object({ fields: z.array(AnalysisFieldSchema) }),
      }),
    })

    if (!output) return c.json({ error: 'Failed to generate schema' }, 500)

    // Strip null values to match FormFieldSchema (optional instead of nullable)
    const fields = output.fields.map(f => {
      const clean: Record<string, unknown> = { name: f.name, type: f.type, label: f.label, required: f.required }
      if (f.placeholder) clean.placeholder = f.placeholder
      if (f.accept) clean.accept = f.accept
      if (f.options) clean.options = f.options
      if (f.default) clean.default = f.default
      return clean
    })

    // Cache to DB
    await db.update(skills)
      .set({ inputs: fields, updatedAt: new Date() })
      .where(eq(skills.id, skillId))

    return c.json({ fields })
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
