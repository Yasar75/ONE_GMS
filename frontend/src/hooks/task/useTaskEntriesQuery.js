import { useQuery } from '@tanstack/react-query'
import { projectService } from '../../api/services/project.service.js'

export const TASK_ENTRIES_QUERY_KEY = ['task-management', 'project-tasks']

export function useTaskEntriesQuery(enabled = true) {
  return useQuery({
    queryKey: TASK_ENTRIES_QUERY_KEY,
    queryFn: () => projectService.listAllProjectTasks(),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })
}
