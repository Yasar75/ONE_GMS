const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/

export function normalizeTrimmed(value) {
  return String(value ?? '').trim()
}

export function isBlank(value) {
  return !normalizeTrimmed(value)
}

export function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '')
}

export function isValidEmail(value) {
  return EMAIL_REGEX.test(normalizeTrimmed(value))
}

export function markFieldsTouched(fieldNames = []) {
  return fieldNames.reduce((accumulator, fieldName) => {
    accumulator[fieldName] = true
    return accumulator
  }, {})
}

export function hasValidationErrors(errors = {}, fieldNames = Object.keys(errors || {})) {
  return fieldNames.some((fieldName) => Boolean(errors?.[fieldName]))
}

export function getRequiredFieldMessage(value, label = 'This field') {
  return isBlank(value) ? `${label} is required.` : ''
}

export function getTextValidationMessage(value, {
  required = false,
  label = 'This field',
  minLength = 0,
  maxLength = null,
  pattern = null,
  patternMessage = 'Enter a valid value.'
} = {}) {
  const normalized = normalizeTrimmed(value)

  if (!normalized) {
    return required ? `${label} is required.` : ''
  }

  if (minLength && normalized.length < minLength) {
    return `${label} must be at least ${minLength} characters.`
  }

  if (maxLength && normalized.length > maxLength) {
    return `${label} must be ${maxLength} characters or less.`
  }

  if (pattern && !pattern.test(normalized)) {
    return patternMessage
  }

  return ''
}

export function getEmailValidationMessage(value, { required = false, label = 'Email' } = {}) {
  const normalized = normalizeTrimmed(value)

  if (!normalized) {
    return required ? `${label} is required.` : ''
  }

  return isValidEmail(normalized) ? '' : 'Enter a valid email address.'
}

export function getPhoneValidationMessage(value, {
  required = false,
  label = 'Phone number',
  min = 6,
  max = 15,
  countryDialCode = '',
  countryLabel = ''
} = {}) {
  const normalized = normalizeTrimmed(value)
  const resolvedMin = min
  const resolvedMax = max
  const countryDescriptor = countryLabel && countryDialCode
    ? `${countryLabel} (${countryDialCode})`
    : (countryLabel || countryDialCode)

  if (!normalized) {
    return required ? `${label} is required.` : ''
  }

  if (!/^\d+$/.test(normalized)) {
    return `${label} must contain digits only.`
  }

  if (normalized.length < resolvedMin || normalized.length > resolvedMax) {
    if (countryDescriptor) {
      return resolvedMin === resolvedMax
        ? `${label} must be exactly ${resolvedMin} digits for ${countryDescriptor}.`
        : `${label} must be ${resolvedMin} to ${resolvedMax} digits for ${countryDescriptor}.`
    }

    return `${label} must be ${resolvedMin} to ${resolvedMax} digits.`
  }

  return ''
}

export function getInternationalPhoneValidationMessage(value, {
  required = false,
  label = 'Phone number',
  min = 6,
  max = 15
} = {}) {
  const normalized = normalizeTrimmed(value).replace(/\s+/g, '')

  if (!normalized) {
    return required ? `${label} is required.` : ''
  }

  if (!/^\+?\d+$/.test(normalized)) {
    return `${label} must contain digits and may start with +.`
  }

  const digitCount = digitsOnly(normalized).length
  if (digitCount < min || digitCount > max) {
    return `${label} must be ${min} to ${max} digits.`
  }

  return ''
}

export function getNumberValidationMessage(value, {
  required = false,
  label = 'Value',
  min = null,
  max = null,
  allowZero = true
} = {}) {
  const normalized = normalizeTrimmed(value)

  if (!normalized) {
    return required ? `${label} is required.` : ''
  }

  const numericValue = Number(normalized)
  if (!Number.isFinite(numericValue)) {
    return `${label} must be a valid number.`
  }

  if (!allowZero && numericValue <= 0) {
    return `${label} must be greater than 0.`
  }

  if (min != null && numericValue < min) {
    return `${label} must be ${min} or more.`
  }

  if (max != null && numericValue > max) {
    return `${label} must be ${max} or less.`
  }

  return ''
}

export function getDateValidationMessage(value, {
  required = false,
  label = 'Date',
  min = '',
  max = ''
} = {}) {
  const normalized = normalizeTrimmed(value)

  if (!normalized) {
    return required ? `${label} is required.` : ''
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return `Enter a valid ${label.toLowerCase()}.`
  }

  if (min && normalized < min) {
    return `${label} must be on or after ${min}.`
  }

  if (max && normalized > max) {
    return `${label} must be on or before ${max}.`
  }

  return ''
}

export function getDateRangeValidationMessage(startValue, endValue, {
  startLabel = 'Start date',
  endLabel = 'End date'
} = {}) {
  const start = normalizeTrimmed(startValue)
  const end = normalizeTrimmed(endValue)

  if (!start || !end) return ''
  return end >= start ? '' : `${endLabel} must be on or after ${startLabel.toLowerCase()}.`
}

export function getDateTimeRangeValidationMessage(startValue, endValue, {
  startLabel = 'Start time',
  endLabel = 'End time'
} = {}) {
  const start = normalizeTrimmed(startValue)
  const end = normalizeTrimmed(endValue)

  if (!start || !end) return ''

  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return ''

  return endDate >= startDate ? '' : `${endLabel} must be after ${startLabel.toLowerCase()}.`
}

function hasRepeatedDigitPattern(value) {
  return /(\d)\1{2,}/.test(String(value || ''))
}

function hasSequentialDigitPattern(value) {
  const digitGroups = String(value || '').match(/\d+/g) || []

  return digitGroups.some((group) => {
    let ascendingRun = 1
    let descendingRun = 1

    for (let index = 1; index < group.length; index += 1) {
      const previous = Number(group[index - 1])
      const current = Number(group[index])

      ascendingRun = current === previous + 1 ? ascendingRun + 1 : 1
      descendingRun = current === previous - 1 ? descendingRun + 1 : 1

      if (ascendingRun >= 3 || descendingRun >= 3) {
        return true
      }
    }

    return false
  })
}

export function buildPasswordValidation(password, confirmPassword) {
  const normalizedPassword = String(password || '')
  const normalizedConfirmPassword = String(confirmPassword || '')
  const checks = [
    { key: 'length', label: 'Minimum 8 characters', passed: normalizedPassword.length >= 8 },
    { key: 'uppercase', label: 'At least one uppercase letter (A-Z)', passed: /[A-Z]/.test(normalizedPassword) },
    { key: 'lowercase', label: 'At least one lowercase letter (a-z)', passed: /[a-z]/.test(normalizedPassword) },
    { key: 'number', label: 'At least one number', passed: /\d/.test(normalizedPassword) },
    { key: 'special', label: 'At least one special character', passed: /[^A-Za-z0-9]/.test(normalizedPassword) },
    { key: 'repeatDigits', label: 'No repeated digits like 111', passed: normalizedPassword ? !hasRepeatedDigitPattern(normalizedPassword) : false },
    { key: 'serialDigits', label: 'No serial digits like 123 or 321', passed: normalizedPassword ? !hasSequentialDigitPattern(normalizedPassword) : false }
  ]

  const passedCount = checks.filter((entry) => entry.passed).length
  const score = !normalizedPassword ? 0 : (passedCount <= 2 ? 1 : (passedCount <= 4 ? 2 : (passedCount <= 6 ? 3 : 4)))
  const labels = ['Not set', 'Weak', 'Fair', 'Good', 'Strong']

  return {
    checks,
    score,
    label: labels[score],
    isValid: checks.every((entry) => entry.passed),
    confirmMatches: Boolean(normalizedConfirmPassword) && normalizedPassword === normalizedConfirmPassword
  }
}
