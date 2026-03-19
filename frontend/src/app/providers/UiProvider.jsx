import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import AppDialog from '../../components/common/AppDialog.jsx'
import GlobalLoader from '../../components/common/GlobalLoader.jsx'
import { uiBus } from '../ui/uiBus.js'

const UiContext = createContext(null)

export function UiProvider({ children }) {
  const [manualLoader, setManualLoader] = useState(null)
  const [networkLoader, setNetworkLoader] = useState(null)
  const [dialog, setDialog] = useState(null)
  const pendingRequestsRef = useRef(new Map())
  const loaderTimerRef = useRef(null)

  const clearNetworkTimer = useCallback(() => {
    if (loaderTimerRef.current) {
      window.clearTimeout(loaderTimerRef.current)
      loaderTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    const offStart = uiBus.on('ui:request:start', (event) => {
      const detail = event.detail || {}
      if (!detail.key) return

      pendingRequestsRef.current.set(detail.key, detail)
      clearNetworkTimer()

      loaderTimerRef.current = window.setTimeout(() => {
        if (pendingRequestsRef.current.size === 0) return
        const active = [...pendingRequestsRef.current.values()].at(-1)
        setNetworkLoader({
          title: active?.title || 'Loading',
          message: active?.message || 'Please wait while the latest data is being prepared.'
        })
      }, 420)
    })

    const offFinish = uiBus.on('ui:request:finish', (event) => {
      const key = event.detail?.key
      if (key) pendingRequestsRef.current.delete(key)
      if (pendingRequestsRef.current.size === 0) {
        clearNetworkTimer()
        setNetworkLoader(null)
      }
    })

    return () => {
      offStart()
      offFinish()
      clearNetworkTimer()
    }
  }, [clearNetworkTimer])

  const showLoader = useCallback((loader) => {
    setManualLoader({
      title: loader?.title || 'Please wait',
      message: loader?.message || 'Working on your request.'
    })
  }, [])

  const hideLoader = useCallback(() => {
    setManualLoader(null)
  }, [])

  const withLoader = useCallback(async (loader, task) => {
    showLoader(loader)
    try {
      return await task()
    } finally {
      hideLoader()
    }
  }, [showLoader, hideLoader])

  const closeDialog = useCallback(() => {
    setDialog((current) => {
      current?.resolve?.(false)
      return null
    })
  }, [])

  const openStatus = useCallback((options) => {
    setDialog({
      kind: 'status',
      tone: options?.tone || 'info',
      title: options?.title || 'Status',
      message: options?.message || '',
      detail: options?.detail || '',
      confirmText: options?.confirmText || 'Close',
      confirmVariant: options?.confirmVariant || 'btn-primary',
      hideFooter: Boolean(options?.hideFooter),
      content: options?.content || null
    })
  }, [])

  const openConfirm = useCallback((options) => {
    return new Promise((resolve) => {
      setDialog({
        kind: 'confirm',
        tone: options?.tone || 'info',
        title: options?.title || 'Please confirm',
        message: options?.message || '',
        detail: options?.detail || '',
        confirmText: options?.confirmText || 'Confirm',
        cancelText: options?.cancelText || 'Cancel',
        confirmVariant: options?.confirmVariant || 'btn-primary',
        content: options?.content || null,
        resolve
      })
    })
  }, [])

  const confirmDialog = useCallback(() => {
    setDialog((current) => {
      current?.resolve?.(true)
      return null
    })
  }, [])

  const value = useMemo(() => ({
    showLoader,
    hideLoader,
    withLoader,
    openStatus,
    openConfirm,
    closeDialog
  }), [showLoader, hideLoader, withLoader, openStatus, openConfirm, closeDialog])

  return (
    <UiContext.Provider value={value}>
      {children}
      <AppDialog dialog={dialog} onClose={closeDialog} onConfirm={confirmDialog} />
      <GlobalLoader
        visible={Boolean(manualLoader || networkLoader)}
        title={manualLoader?.title || networkLoader?.title}
        message={manualLoader?.message || networkLoader?.message}
      />
    </UiContext.Provider>
  )
}

export function useUi() {
  const context = useContext(UiContext)
  if (!context) throw new Error('useUi must be used within UiProvider')
  return context
}
