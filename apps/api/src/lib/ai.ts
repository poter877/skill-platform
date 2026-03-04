import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { google } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'

export type ModelId = 'gpt-5' | 'claude-sonnet-4-5' | 'gemini-2.0-flash'

export function getModel(modelId: ModelId): LanguageModel {
  switch (modelId) {
    case 'gpt-5':
      return openai('gpt-5')
    case 'claude-sonnet-4-5':
      return anthropic('claude-sonnet-4-5')
    case 'gemini-2.0-flash':
      return google('gemini-2.0-flash')
  }
}

export const SKILL_GENERATION_SYSTEM = `You are an expert at writing Claude Code skills.
A skill is a SKILL.md file with YAML frontmatter and markdown content.

REQUIRED frontmatter fields:
- name: kebab-case name
- description: "Use when..." triggering conditions (NOT workflow summary)
- inputs: array of form field definitions

inputs field format:
  - name: snake_case_name
    type: file|text|textarea|select|multiselect|number|url
    label: Human readable label
    required: true|false
    placeholder: optional hint
    accept: [".ext"] (file type only)
    options: ["opt1","opt2"] (select/multiselect only)

Output ONLY the raw SKILL.md content, no explanation, no code fences.`

export const SCHEMA_ANALYSIS_SYSTEM = `Analyze this SKILL.md and extract what user inputs it needs to run.
Return a JSON object with this exact shape:
{
  "fields": [
    {
      "name": "snake_case_name",
      "type": "file|text|textarea|select|multiselect|number|url",
      "label": "Human readable label",
      "required": true,
      "placeholder": "optional",
      "accept": [".pdf"] (only for file type),
      "options": ["opt1"] (only for select/multiselect)
    }
  ]
}

If no specific inputs are needed beyond a general instruction, return a single textarea field named "instruction".`
