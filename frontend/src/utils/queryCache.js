import { AUTH_STORAGE_KEYS } from './auth.js'

const CACHE_PREFIX = 'one_gms.query-cache.v4.'
const STALE_CACHE_UPDATED_AT = 0

function serializeQueryKey(queryKey) {
  return Array.isArray(queryKey) ? queryKey.join('::') : String(queryKey)
}

function getActiveCacheScope() {
  if (typeof window === 'undefined') return 'server'

  try {
    const rawUser = window.localStorage.getItem(AUTH_STORAGE_KEYS.user)
    const user = rawUser ? JSON.parse(rawUser) : null
    const userIdentifier = String(user?.uid || user?.email || '').trim().toLowerCase()
    if (userIdentifier) return `user:${userIdentifier}`

    const rawToken = window.localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)
    const token = rawToken ? JSON.parse(rawToken) : ''
    const tokenSuffix = String(token || '').trim().slice(-12)
    return tokenSuffix ? `session:${tokenSuffix}` : 'guest'
  } catch {
    return 'guest'
  }
}

function buildStorageKey(queryKey) {
  return `${CACHE_PREFIX}${getActiveCacheScope()}.${serializeQueryKey(queryKey)}`
}

function forEachPersistentCacheKey(callback) {
  if (typeof window === 'undefined') return

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const storageKey = window.localStorage.key(index)
    if (!storageKey || !storageKey.startsWith(CACHE_PREFIX)) continue
    callback(storageKey)
  }
}

export function clearPersistentQueryCache(queryKey = null) {
  if (typeof window === 'undefined') return

  try {
    if (queryKey == null) {
      forEachPersistentCacheKey((storageKey) => {
        window.localStorage.removeItem(storageKey)
      })
      return
    }

    const queryKeySuffix = `.${serializeQueryKey(queryKey)}`
    forEachPersistentCacheKey((storageKey) => {
      if (storageKey.endsWith(queryKeySuffix)) {
        window.localStorage.removeItem(storageKey)
      }
    })
  } catch {
    // Best-effort cache cleanup only.
  }
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
    return parsed && Object.prototype.hasOwnProperty.call(parsed, 'data')
      ? STALE_CACHE_UPDATED_AT
      : undefined
  } catch {
    return undefined
  }
}

export function writeCachedQuery(queryKey, data) {
  if (typeof window === 'undefined') return data

  try {
    window.localStorage.setItem(buildStorageKey(queryKey), JSON.stringify({
      data,
      updatedAt: Date.now(),
      scope: getActiveCacheScope()
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
