function formatObjectMessage(value) {
  if (!value || typeof value !== 'object') return ''

  if (typeof value.message === 'string' && value.message.trim()) return value.message.trim()
  if (typeof value.detail === 'string' && value.detail.trim()) return value.detail.trim()
  if (typeof value.msg === 'string' && value.msg.trim()) return value.msg.trim()
  if (typeof value.error === 'string' && value.error.trim()) return value.error.trim()
  if (typeof value.resolution === 'string' && value.resolution.trim()) return value.resolution.trim()

  const nestedKeys = ['detail', 'errors', 'message', 'data']
  for (const key of nestedKeys) {
    const nested = normalizeErrorMessage(value[key], '')
    if (nested) return nested
  }

  return ''
}

export function normalizeErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback

  if (typeof error === 'string') {
    const trimmed = error.trim()
    return trimmed || fallback
  }

  if (Array.isArray(error)) {
    const items = error
      .map((item) => normalizeErrorMessage(item, ''))
      .filter(Boolean)
    return items.length ? items.join('\n') : fallback
  }

  if (error?.response?.data) {
    const apiMessage = normalizeErrorMessage(error.response.data, '')
    if (apiMessage) return apiMessage
  }

  if (error?.response?.status === 422) {
    return 'Please enter a valid email address and password.'
  }

  if (error?.message && typeof error.message === 'string') {
    const trimmed = error.message.trim()
    if (trimmed) return trimmed
  }

  const objectMessage = formatObjectMessage(error)
  return objectMessage || fallback
}

export function getInlineErrorMap({ email, password }) {
  const errors = {}
  const normalizedEmail = email.trim()
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!normalizedEmail) {
    errors.email = 'Email is required.'
  } else if (!emailPattern.test(normalizedEmail)) {
    errors.email = 'Enter a valid work email address.'
  }

  if (!password.trim()) {
    errors.password = 'Password is required.'
  } else if (password.trim().length < 6) {
    errors.password = 'Password must be at least 6 characters.'
  }

  return errors
}
