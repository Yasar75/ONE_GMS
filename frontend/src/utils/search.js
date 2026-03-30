function getValueByPath(record, path) {
  const segments = String(path || '').split('.').map((segment) => segment.trim()).filter(Boolean)
  if (!segments.length) return undefined

  return segments.reduce((current, segment) => {
    if (current == null) return undefined
    return current[segment]
  }, record)
}

function collectSearchParts(value, parts) {
  if (value == null) return

  if (Array.isArray(value)) {
    value.forEach((entry) => collectSearchParts(entry, parts))
    return
  }

  if (typeof value === 'object') {
    Object.values(value).forEach((entry) => collectSearchParts(entry, parts))
    return
  }

  const normalized = String(value).trim()
  if (normalized) parts.push(normalized)
}

export function buildSearchableText(record, selector = null) {
  const parts = []

  if (typeof selector === 'function') {
    collectSearchParts(selector(record), parts)
  } else if (Array.isArray(selector) && selector.length) {
    selector.forEach((path) => collectSearchParts(getValueByPath(record, path), parts))
  } else {
    collectSearchParts(record, parts)
  }

  return parts.join(' ').toLowerCase()
}

export function matchesSearchQuery(record, query, selector = null) {
  const normalizedQuery = String(query || '').trim().toLowerCase()
  if (!normalizedQuery) return true
  return buildSearchableText(record, selector).includes(normalizedQuery)
}

export function filterCollectionByQuery(collection = [], query, selector = null) {
  return (Array.isArray(collection) ? collection : []).filter((record) => matchesSearchQuery(record, query, selector))
}
