import { useQuery } from '@tanstack/react-query'
import { projectService } from '../../api/services/project.service.js'

export const TASK_PROJECTS_QUERY_KEY = ['task-management', 'projects']

export function useTaskProjectsQuery(enabled = true) {
  return useQuery({
    queryKey: TASK_PROJECTS_QUERY_KEY,
    queryFn: () => projectService.listAllProjects(),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })
}
