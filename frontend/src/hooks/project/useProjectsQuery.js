import { useQuery } from '@tanstack/react-query'
import { projectService } from '../../api/services/project.service.js'

export const PROJECTS_QUERY_KEY = ['project-management', 'projects']

export function useProjectsQuery(enabled = true) {
  return useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: () => projectService.listAllProjects(),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })
}
