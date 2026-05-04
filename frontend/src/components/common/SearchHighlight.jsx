import React from 'react'

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getQueryTokens(query = '') {
  return String(query || '').toLowerCase().match(/[a-z0-9]+/g) || []
}

export default function SearchHighlight({ text, query = '' }) {
  const value = String(text ?? '')
  const tokens = getQueryTokens(query)
  if (!value || !tokens.length) return value || '—'

  const pattern = new RegExp(`(^|[^a-z0-9])(${tokens.sort((left, right) => right.length - left.length).map(escapeRegExp).join('|')})`, 'gi')
  const parts = []
  let cursor = 0
  let match

  while ((match = pattern.exec(value)) !== null) {
    const separator = match[1] || ''
    const matchedText = match[2] || ''
    const highlightStart = match.index + separator.length
    const highlightEnd = highlightStart + matchedText.length

    if (highlightStart > cursor) parts.push(value.slice(cursor, highlightStart))
    parts.push(<mark className="search-result-highlight" key={`${highlightStart}-${highlightEnd}`}>{value.slice(highlightStart, highlightEnd)}</mark>)
    cursor = highlightEnd

    if (pattern.lastIndex === match.index) pattern.lastIndex += 1
  }

  if (cursor < value.length) parts.push(value.slice(cursor))

  return parts.length ? parts : value
}
