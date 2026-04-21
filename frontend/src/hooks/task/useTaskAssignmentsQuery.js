import { useQuery } from '@tanstack/react-query'
import { projectService } from '../../api/services/project.service.js'

export const TASK_ASSIGNMENTS_QUERY_KEY = ['task-management', 'project-assignments']

export function useTaskAssignmentsQuery(enabled = true) {
  return useQuery({
    queryKey: TASK_ASSIGNMENTS_QUERY_KEY,
    queryFn: () => projectService.listAllProjectAssignments(),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })
}
