import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import type { Skill } from '@skill-plant/shared'

export function useSkills() {
  return useQuery({
    queryKey: ['skills'],
    queryFn: () => apiGet<Skill[]>('/skills'),
  })
}

export function useSkill(id: string | undefined) {
  return useQuery({
    queryKey: ['skills', id],
    queryFn: () => apiGet<Skill>(`/skills/${id!}`),
    enabled: !!id,
  })
}
