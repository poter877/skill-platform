import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { db } from '../db'
import { jobs, skills } from '../db/schema'
import { eq } from 'drizzle-orm'
import { env } from './env'

const JOBS_DIR = process.env.JOBS_DIR ?? '/tmp/skill-plant-jobs'

export async function runJob(jobId: string): Promise<string> {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId))
  if (!job) throw new Error(`Job ${jobId} not found`)

  const [skill] = await db.select().from(skills).where(eq(skills.id, job.skillId))
  if (!skill) throw new Error(`Skill ${job.skillId} not found`)

  const jobDir = join(JOBS_DIR, jobId)
  const skillsDir = join(jobDir, 'skills', skill.name)
  const workspaceDir = join(jobDir, 'workspace')

  await mkdir(skillsDir, { recursive: true })
  await mkdir(workspaceDir, { recursive: true })
  await writeFile(join(skillsDir, 'SKILL.md'), skill.content)

  const inputs = job.inputs as Record<string, string>
  const prompt = buildPrompt(skill.name, inputs)

  return runDocker({ skillsDir, workspaceDir, prompt, apiKey: env.ANTHROPIC_API_KEY })
}

export function buildPrompt(skillName: string, inputs: Record<string, string>): string {
  const parts = [`Use the ${skillName} skill.`]
  for (const [key, value] of Object.entries(inputs)) {
    if (key !== 'instruction') parts.push(`${key}: ${value}`)
  }
  if (inputs.instruction) parts.push(inputs.instruction)
  return parts.join('\n')
}

async function runDocker(opts: {
  skillsDir: string
  workspaceDir: string
  prompt: string
  apiKey: string
}): Promise<string> {
  const proc = Bun.spawn([
    'docker', 'run', '--rm',
    '-v', `${opts.skillsDir}:/root/.claude/skills`,
    '-v', `${opts.workspaceDir}:/workspace`,
    '-e', `ANTHROPIC_API_KEY=${opts.apiKey}`,
    'skill-plant-claude-code',
    opts.prompt,
  ], {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const stdout = await new Response(proc.stdout).text()
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`Claude Code exited with code ${exitCode}: ${stderr}`)
  }

  return stdout
}
