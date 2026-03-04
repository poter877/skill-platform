import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { Skill } from '@skill-plant/shared'

export function SkillCard({ skill }: { skill: Skill }) {
  return (
    <Card className="flex flex-col justify-between">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{skill.name}</CardTitle>
          <Badge variant="outline">{skill.source}</Badge>
        </div>
        <CardDescription className="line-clamp-3">{skill.description}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button asChild className="w-full">
          <Link href={`/run/${skill.id}`}>Run Skill</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
