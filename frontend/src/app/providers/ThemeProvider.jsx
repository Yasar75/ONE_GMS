import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { storage } from '../../utils/storage.js'
import iconLightTheme from '../../asserts/one_gms_icon_dark.svg'
import iconDarkTheme from '../../asserts/one_gms_icon_light.svg'

const THEME_KEY = 'one_gms.ui.theme'
const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => storage.get(THEME_KEY, 'light'))

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme)
    storage.set(THEME_KEY, theme)

    const themedIcon = theme === 'dark' ? iconDarkTheme : iconLightTheme
    let favicon = document.querySelector('link[data-one-gms-favicon="theme"]')

    if (!favicon) {
      favicon = document.createElement('link')
      favicon.setAttribute('rel', 'icon')
      favicon.setAttribute('type', 'image/svg+xml')
      favicon.setAttribute('data-one-gms-favicon', 'theme')
      document.head.appendChild(favicon)
    }

    favicon.setAttribute('href', themedIcon)
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
