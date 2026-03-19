import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { storage } from '../../utils/storage.js'

const THEME_KEY = 'lms.ui.theme'
const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => storage.get(THEME_KEY, 'light'))

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme)
    storage.set(THEME_KEY, theme)
  }, [theme])

  const value = useMemo(() => ({
    theme,
    setTheme,
    toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
