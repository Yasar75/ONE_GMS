import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import AppToastStack from '../../components/common/AppToastStack.jsx'

const ToastContext = createContext(null)

function createToastId() {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function ToastProvider({ children }) {
  const timeoutMapRef = useRef(new Map())
  const [toasts, setToasts] = useState([])

  const dismissToast = useCallback((toastId) => {
    const timeoutId = timeoutMapRef.current.get(toastId)
    if (timeoutId) {
      window.clearTimeout(timeoutId)
      timeoutMapRef.current.delete(toastId)
    }
    setToasts((current) => current.filter((item) => item.id !== toastId))
  }, [])

  const showToast = useCallback((options = {}) => {
    const nextToast = {
      id: createToastId(),
      tone: options.tone || 'info',
      title: options.title || '',
      message: options.message || '',
      duration: Math.max(1200, Number(options.duration || options.autoCloseMs || 2800))
    }

    setToasts((current) => [...current, nextToast].slice(-4))

    const timeoutId = window.setTimeout(() => {
      timeoutMapRef.current.delete(nextToast.id)
      setToasts((current) => current.filter((item) => item.id !== nextToast.id))
    }, nextToast.duration)

    timeoutMapRef.current.set(nextToast.id, timeoutId)
    return nextToast.id
  }, [])

  useEffect(() => () => {
    timeoutMapRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
    timeoutMapRef.current.clear()
  }, [])

  const value = useMemo(() => ({
    showToast,
    dismissToast
  }), [dismissToast, showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <AppToastStack items={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}
