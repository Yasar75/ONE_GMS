import { useQuery } from '@tanstack/react-query'
import { projectService } from '../../api/services/project.service.js'

export const PROJECT_TASKS_QUERY_KEY = ['project-management', 'project-tasks']

export function useProjectTasksQuery(enabled = true) {
  return useQuery({
    queryKey: PROJECT_TASKS_QUERY_KEY,
    queryFn: () => projectService.listAllProjectTasks(),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })
}
