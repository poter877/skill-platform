'use client'
import { useSkills } from '@/hooks/useSkills'
import { SkillCard } from '@/components/SkillCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { useState } from 'react'

export default function MarketplacePage() {
  const { data: skills, isLoading, isError } = useSkills()
  const [search, setSearch] = useState('')

  const filtered = skills?.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase().trim()) ||
    s.description.toLowerCase().includes(search.toLowerCase().trim())
  )

  return (
    <main className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Skill Marketplace</h1>
        <Button asChild variant="outline">
          <Link href="/generate">✨ Generate Skill</Link>
        </Button>
      </div>

      <Input
        placeholder="Search skills..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="mb-6 max-w-md"
      />

      {isLoading && <p className="text-muted-foreground">Loading skills...</p>}

      {isError && (
        <p className="text-destructive">Failed to load skills. Is the API running?</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered?.map(skill => (
          <SkillCard key={skill.id} skill={skill} />
        ))}
      </div>

      {filtered?.length === 0 && !isLoading && (
        <p className="text-muted-foreground text-center py-12">
          No skills found. <Link href="/generate" className="underline">Generate one?</Link>
        </p>
      )}
    </main>
  )
}
