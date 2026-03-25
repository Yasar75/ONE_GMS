import { useQuery } from '@tanstack/react-query'
import { metadataService } from '../../api/services/metadata.service.js'
import { readCachedQuery, readCachedQueryUpdatedAt, withPersistentCache } from '../../utils/queryCache.js'

const metadataQueryKey = ['employees', 'metadata']
const roleQueryKey = ['employees', 'roles']
const roleModulesQueryKey = ['employees', 'role-modules', 'v2']

export function useEmployeeMetadataQuery(enabled = true) {
  return useQuery({
    queryKey: metadataQueryKey,
    queryFn: () => withPersistentCache(metadataQueryKey, metadataService.getEntries),
    enabled,
    initialData: () => readCachedQuery(metadataQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(metadataQueryKey),
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false
  })
}

export function useRoleDirectoryQuery(enabled = true) {
  return useQuery({
    queryKey: roleQueryKey,
    queryFn: () => withPersistentCache(roleQueryKey, metadataService.getRoles),
    enabled,
    initialData: () => readCachedQuery(roleQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(roleQueryKey),
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false
  })
}


export function useRoleModulesQuery(enabled = true) {
  return useQuery({
    queryKey: roleModulesQueryKey,
    queryFn: () => withPersistentCache(roleModulesQueryKey, metadataService.getRoleModules),
    enabled,
    initialData: () => readCachedQuery(roleModulesQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(roleModulesQueryKey),
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false
  })
}
