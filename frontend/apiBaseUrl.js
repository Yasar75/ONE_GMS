const DEFAULT_API_BASE_URL = 'http://localhost:8000'
const API_BASE_URL_PREFIX = /^VITE_API_BASE_URL\s*=\s*/i

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

export function normalizeApiBaseUrl(value, fallback = DEFAULT_API_BASE_URL) {
  const normalizedFallback = String(fallback || DEFAULT_API_BASE_URL).trim().replace(/\/$/, '')
  const rawValue = String(value ?? '').trim()

  if (!rawValue) {
    return normalizedFallback
  }

  const withoutQuotes = stripWrappingQuotes(rawValue)
  const withoutPrefix = withoutQuotes.replace(API_BASE_URL_PREFIX, '').trim()

  return withoutPrefix.replace(/\/$/, '') || normalizedFallback
}

export { DEFAULT_API_BASE_URL }