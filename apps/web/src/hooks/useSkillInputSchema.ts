import { useQuery } from '@tanstack/react-query'
import { apiPost } from '@/lib/api'
import type { InputSchemaResponseType } from '@skill-plant/shared'

export function useSkillInputSchema(skillId: string | undefined) {
  return useQuery({
    queryKey: ['skills', skillId, 'schema'],
    queryFn: () => apiPost<InputSchemaResponseType>(`/ai/analyze/${skillId}`, {}),
    staleTime: Infinity,  // schema doesn't change
    enabled: !!skillId,
  })
}
