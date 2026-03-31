import { useQuery } from '@tanstack/react-query'
import { metadataService } from '../../api/services/metadata.service.js'
import { readCachedQuery, readCachedQueryUpdatedAt, withPersistentCache, writeCachedQuery } from '../../utils/queryCache.js'

const metadataQueryKey = ['employees', 'metadata']
const roleQueryKey = ['employees', 'roles']
const roleModulesQueryKey = ['employees', 'role-modules', 'v2']

function readNonEmptyCachedRoleModules() {
  const cachedValue = readCachedQuery(roleModulesQueryKey)
  return Array.isArray(cachedValue) && cachedValue.length ? cachedValue : undefined
}

function readNonEmptyCachedRoleModulesUpdatedAt() {
  return readNonEmptyCachedRoleModules() ? readCachedQueryUpdatedAt(roleModulesQueryKey) : undefined
}

export function useEmployeeMetadataQuery(enabled = true) {
  return useQuery({
    queryKey: metadataQueryKey,
    queryFn: () => withPersistentCache(metadataQueryKey, metadataService.getEntries),
    enabled,
    initialData: () => readCachedQuery(metadataQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(metadataQueryKey),
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    refetchOnWindowFocus: 'always'
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
    refetchOnWindowFocus: 'always'
  })
}


export function useRoleModulesQuery(enabled = true) {
  return useQuery({
    queryKey: roleModulesQueryKey,
    queryFn: async () => {
      const data = await metadataService.getRoleModules()
      if (Array.isArray(data) && data.length) writeCachedQuery(roleModulesQueryKey, data)
      return data
    },
    enabled,
    initialData: () => readNonEmptyCachedRoleModules(),
    initialDataUpdatedAt: () => readNonEmptyCachedRoleModulesUpdatedAt(),
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })
}
