import { z } from 'zod'

export const FormFieldSchema = z.object({
  name: z.string(),
  type: z.enum(['file', 'text', 'textarea', 'select', 'multiselect', 'number', 'url']),
  label: z.string(),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  accept: z.array(z.string()).optional(),
  options: z.array(z.string()).optional(),
  default: z.string().optional(),
})

export const SkillSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  content: z.string(),
  inputs: z.array(FormFieldSchema).optional(),
  source: z.enum(['builtin', 'github', 'upload']),
  githubUrl: z.string().url().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Skill = z.infer<typeof SkillSchema>
export type FormField = z.infer<typeof FormFieldSchema>
