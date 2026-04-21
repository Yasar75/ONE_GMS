import { useQuery } from '@tanstack/react-query'
import { projectService } from '../../api/services/project.service.js'

export const PROJECT_ASSIGNMENTS_QUERY_KEY = ['project-management', 'project-assignments']

export function useProjectAssignmentsQuery(enabled = true) {
  return useQuery({
    queryKey: PROJECT_ASSIGNMENTS_QUERY_KEY,
    queryFn: () => projectService.listAllProjectAssignments(),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })
}
