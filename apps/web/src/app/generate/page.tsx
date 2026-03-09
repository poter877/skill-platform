'use client'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from '@/components/ui/form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiPost, API_BASE_URL } from '@/lib/api'
import { GenerateSkillSchema } from '@skill-plant/shared'
import { useRouter } from 'next/navigation'
import type { Skill, GenerateSkill } from '@skill-plant/shared'
import { PageHeader } from '@/components/PageHeader'

export default function GeneratePage() {
  const [generatedContent, setGeneratedContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  const form = useForm({
    resolver: zodResolver(GenerateSkillSchema),
    defaultValues: { description: '', model: 'gpt-5' as const },
  })

  async function handleGenerate(values: GenerateSkill) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsGenerating(true)
    setGeneratedContent('')
    setError(null)

    try {
      const res = await fetch(`${API_BASE_URL}/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        signal: controller.signal,
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
        const text = decoder.decode(value, { stream: true })
        setGeneratedContent(prev => prev + text)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
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
      <PageHeader title="✨ 生成 Skill" backHref="/" backLabel="返回市场" />

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
                    <FormMessage />
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
                        <SelectItem value="gpt-5">GPT-5</SelectItem>
                        <SelectItem value="claude-sonnet-4-5">Claude Sonnet</SelectItem>
                        <SelectItem value="gemini-2.0-flash">Gemini Flash</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isGenerating || isSaving}>
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
