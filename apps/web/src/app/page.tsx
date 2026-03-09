'use client'
export const dynamic = 'force-dynamic'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Suspense } from 'react'
import { SkillCard } from '@/components/SkillCard'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { useState, useRef } from 'react'
import { apiGet } from '@/lib/api'
import type { Skill } from '@skill-plant/shared'

function SkillGrid({ search }: { search: string }) {
  const { data: skills } = useSuspenseQuery({
    queryKey: ['skills'],
    queryFn: () => apiGet<Skill[]>('/skills'),
  })

  const q = search.toLowerCase().trim()
  const filtered = skills.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.description.toLowerCase().includes(q)
  )

  if (filtered.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-12">
        No skills found. <Link href="/generate" className="underline">Generate one?</Link>
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {filtered.map(skill => (
        <SkillCard key={skill.id} skill={skill} />
      ))}
    </div>
  )
}

export default function MarketplacePage() {
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  return (
    <main>
      <section className="bg-gradient-to-b from-primary/10 via-background to-background py-16 px-4 text-center">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
          AI Skills 市场
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg mb-8 max-w-xl mx-auto">
          发现、生成并运行 AI Skills，无需编写代码
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button asChild>
            <Link href="/generate">✨ 生成 Skill</Link>
          </Button>
          <Button variant="outline" onClick={() => {
            searchRef.current?.focus()
            searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }}>
            浏览全部
          </Button>
        </div>
      </section>

      <div className="container mx-auto py-8 px-4">
        <Input
          ref={searchRef}
          placeholder="Search skills..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mb-6 max-w-md"
        />
        <ErrorBoundary fallback={
          <p className="text-destructive">Failed to load skills. Is the API running?</p>
        }>
          <Suspense fallback={<p className="text-muted-foreground">Loading skills...</p>}>
            <SkillGrid search={search} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </main>
  )
}
