import React from 'react'
import { useTheme } from '../../app/providers/ThemeProvider.jsx'

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" strokeWidth="2" />
      <path d="M12 2v2M12 20v2M4 12H2m20 0h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M5 19l1.5-1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 13.2A8 8 0 0 1 10.8 3a6.5 6.5 0 1 0 10.2 10.2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className={`theme-toggle ${isDark ? 'is-dark' : 'is-light'}`}
      onClick={toggleTheme}
      aria-label="Toggle light/dark"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="theme-toggle-option theme-toggle-option-light" aria-hidden="true">
        <SunIcon />
      </span>
      <span className="theme-toggle-option theme-toggle-option-dark" aria-hidden="true">
        <MoonIcon />
      </span>
      <span className="theme-toggle-thumb" aria-hidden="true">
        <span className="theme-toggle-thumb-glow" />
        <span className="theme-toggle-thumb-icon">
          {isDark ? <MoonIcon /> : <SunIcon />}
        </span>
      </span>
    </button>
  )
}
