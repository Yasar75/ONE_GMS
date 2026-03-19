function collectMessages(input) {
  if (!input) return []
  if (typeof input === 'string') return [input]

  if (Array.isArray(input)) {
    return input.flatMap((item) => collectMessages(item))
  }

  if (typeof input === 'object') {
    if (typeof input.msg === 'string') return [input.msg]
    if (typeof input.message === 'string') return [input.message]
    if (typeof input.detail === 'string') return [input.detail]
    if (Array.isArray(input.detail)) return input.detail.flatMap((item) => collectMessages(item))
    if (Array.isArray(input.errors)) return input.errors.flatMap((item) => collectMessages(item))
    return Object.values(input).flatMap((item) => collectMessages(item))
  }

  return []
}

export function normalizeApiError(error, fallback = 'Something went wrong. Please try again.') {
  const responseData = error?.response?.data
  const messages = [
    ...collectMessages(responseData?.message),
    ...collectMessages(responseData?.detail),
    ...collectMessages(responseData?.errors),
    ...collectMessages(responseData)
  ].filter(Boolean)

  if (messages.length) {
    return [...new Set(messages)].join(' ')
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim()
  }

  return fallback
}
