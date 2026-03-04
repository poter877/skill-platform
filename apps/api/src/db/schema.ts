import { pgTable, uuid, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core'

export const jobStatusEnum = pgEnum('job_status', ['pending', 'running', 'completed', 'failed'])
export const skillSourceEnum = pgEnum('skill_source', ['builtin', 'github', 'upload'])

export const skills = pgTable('skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  content: text('content').notNull(),
  inputs: jsonb('inputs'),
  source: skillSourceEnum('source').notNull().default('builtin'),
  githubUrl: text('github_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  skillId: uuid('skill_id').references(() => skills.id).notNull(),
  status: jobStatusEnum('status').notNull().default('pending'),
  inputs: jsonb('inputs').notNull(),
  output: text('output'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
