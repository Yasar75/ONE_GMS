import React from 'react'

export default function PinToggle({ pinned, onToggle }) {
  return (
    <button type="button" className="btn btn-sm btn-outline-secondary w-100" onClick={() => onToggle(!pinned)}>
      {pinned ? '🔒 Pinned' : '🔓 Unpinned'}
    </button>
  )
}
