'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Form, FormControl, FormField, FormItem, FormLabel
} from '@/components/ui/form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiPost, API_BASE_URL } from '@/lib/api'
import { GenerateSkillSchema } from '@skill-plant/shared'
import { useRouter } from 'next/navigation'
import type { Skill } from '@skill-plant/shared'

export default function GeneratePage() {
  const [generatedContent, setGeneratedContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const form = useForm({
    resolver: zodResolver(GenerateSkillSchema),
    defaultValues: { description: '', model: 'claude-sonnet-4-5' as const },
  })

  async function handleGenerate(values: { description: string; model: string }) {
    setIsGenerating(true)
    setGeneratedContent('')
    setError(null)

    try {
      const res = await fetch(`${API_BASE_URL}/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error((errBody as { error?: string }).error ?? `API error: ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        const lines = text.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            setGeneratedContent(prev => prev + line.slice(6))
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    try {
      const skill = await apiPost<Skill>('/ai/generate/save', { content: generatedContent })
      router.push(`/run/${skill.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">✨ Generate Skill with AI</h1>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleGenerate)} className="space-y-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Describe your skill</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="I want a skill that analyzes CSV files and outputs statistics per column..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="claude-sonnet-4-5">Claude Sonnet</SelectItem>
                        <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        <SelectItem value="gemini-2.0-flash">Gemini Flash</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isGenerating}>
                {isGenerating ? 'Generating...' : '✨ Generate'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {error && (
        <p className="mb-4 text-sm text-destructive">{error}</p>
      )}

      {generatedContent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Generated SKILL.md
              <Button onClick={handleSave} disabled={isSaving || isGenerating}>
                {isSaving ? 'Saving...' : '💾 Save & Run'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={generatedContent}
              onChange={e => setGeneratedContent(e.target.value)}
              rows={20}
              className="font-mono text-sm"
            />
          </CardContent>
        </Card>
      )}
    </main>
  )
}
