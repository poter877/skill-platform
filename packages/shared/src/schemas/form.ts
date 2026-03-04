import { z } from 'zod'
import { FormFieldSchema } from './skill'

export const GenerateSkillSchema = z.object({
  description: z.string().min(10),
  model: z.enum(['claude-sonnet-4-5', 'gpt-4o', 'gemini-2.0-flash']).default('claude-sonnet-4-5'),
})

export const ImportGithubSkillSchema = z.object({
  url: z.string().url().refine(url => url.includes('github.com'), {
    message: 'Must be a GitHub URL',
  }),
})

export const InputSchemaResponse = z.object({
  fields: z.array(FormFieldSchema),
})

export type GenerateSkill = z.infer<typeof GenerateSkillSchema>
export type ImportGithubSkill = z.infer<typeof ImportGithubSkillSchema>
export type InputSchemaResponseType = z.infer<typeof InputSchemaResponse>
