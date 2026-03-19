const CACHE_PREFIX = 'one_gms.query-cache.v2.'

function buildStorageKey(queryKey) {
  return `${CACHE_PREFIX}${Array.isArray(queryKey) ? queryKey.join('::') : String(queryKey)}`
}

export function readCachedQuery(queryKey, fallback = undefined) {
  if (typeof window === 'undefined') return fallback

  try {
    const raw = window.localStorage.getItem(buildStorageKey(queryKey))
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed?.data ?? fallback
  } catch {
    return fallback
  }
}

export function readCachedQueryUpdatedAt(queryKey) {
  if (typeof window === 'undefined') return undefined

  try {
    const raw = window.localStorage.getItem(buildStorageKey(queryKey))
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    return Number(parsed?.updatedAt) || undefined
  } catch {
    return undefined
  }
}

export function writeCachedQuery(queryKey, data) {
  if (typeof window === 'undefined') return data

  try {
    window.localStorage.setItem(buildStorageKey(queryKey), JSON.stringify({
      data,
      updatedAt: Date.now()
    }))
  } catch {
    // Best-effort cache only.
  }

  return data
}

export async function withPersistentCache(queryKey, queryFn) {
  const data = await queryFn()
  writeCachedQuery(queryKey, data)
  return data
}
