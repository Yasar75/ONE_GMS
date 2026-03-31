import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import ModalFrame from '../../components/common/ModalFrame.jsx'
import StatusDialogContent from '../../components/common/StatusDialogContent.jsx'
import ConfirmDialogContent from '../../components/common/ConfirmDialogContent.jsx'
import GlobalLoaderContent from '../../components/common/GlobalLoaderContent.jsx'
import { useToast } from './ToastProvider.jsx'

const ModalContext = createContext(null)
const DEFAULT_AUTO_LOADER = {
  title: 'Fetching latest data',
  message: 'This page is still loading in the background.'
}

function shouldShowBlockingQueryLoader(query) {
  if (!query || query.state?.fetchStatus !== 'fetching') return false
  if (query.options?.meta?.suppressGlobalLoader) return false
  return Number(query.state?.dataUpdatedAt || 0) === 0
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export function ModalProvider({ children }) {
  const timerRef = useRef(null)
  const confirmResolverRef = useRef(null)
  const autoLoaderTimerRef = useRef(null)
  const autoLoaderToastRef = useRef(null)
  const blockingFetchCount = useIsFetching({
    predicate: shouldShowBlockingQueryLoader
  })
  const blockingMutationCount = useIsMutating({
    predicate: (mutation) => Boolean(mutation?.options?.meta?.showGlobalLoader)
  })

  const [statusModal, setStatusModal] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)
  const [loaderModal, setLoaderModal] = useState(null)
  const { showToast, dismissToast } = useToast()

  const clearStatusTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const closeStatus = useCallback(() => {
    clearStatusTimer()
    setStatusModal((current) => {
      current?.onClose?.()
      return null
    })
  }, [clearStatusTimer])

  const showStatus = useCallback((config) => {
    clearStatusTimer()
    setStatusModal(config)

    if (config?.autoCloseMs) {
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        setStatusModal((current) => {
          current?.onClose?.()
          return null
        })
      }, config.autoCloseMs)
    }
  }, [clearStatusTimer])

  const showConfirm = useCallback((config) => new Promise((resolve) => {
    confirmResolverRef.current = resolve
    setConfirmModal({
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      ...config
    })
  }), [])

  const resolveConfirm = useCallback((accepted) => {
    const current = confirmModal
    setConfirmModal(null)

    current?.[accepted ? 'onConfirm' : 'onCancel']?.()

    if (confirmResolverRef.current) {
      confirmResolverRef.current(accepted)
      confirmResolverRef.current = null
    }
  }, [confirmModal])

  const showLoader = useCallback((config = {}) => {
    setLoaderModal({
      source: 'manual',
      title: config.title || 'Please wait',
      message: config.message || 'We are processing your request.',
      size: config.size || 'sm'
    })
  }, [])

  const hideLoader = useCallback(() => {
    setLoaderModal((current) => (current?.source === 'manual' ? null : current))
  }, [])

  const runWithLoader = useCallback(async (task, config = {}) => {
    const minVisibleMs = config.minVisibleMs ?? 420
    const delayMs = config.delayMs ?? 220
    let didShowLoader = false
    let shownAt = 0

    const showTimer = window.setTimeout(() => {
      shownAt = Date.now()
      didShowLoader = true
      setLoaderModal({
        source: 'manual',
        title: config.title || 'Please wait',
        message: config.message || 'We are processing your request.',
      })
    }, delayMs)

    try {
      return await task()
    } finally {
      window.clearTimeout(showTimer)

      if (didShowLoader) {
        const elapsedVisible = Date.now() - shownAt
        const remaining = Math.max(0, minVisibleMs - elapsedVisible)
        if (remaining > 0) {
          await wait(remaining)
        }
        setLoaderModal((current) => (current?.source === 'manual' ? null : current))
      }
    }
  }, [])

  useEffect(() => {
    if (loaderModal?.source === 'manual') {
      if (autoLoaderTimerRef.current) {
        window.clearTimeout(autoLoaderTimerRef.current)
        autoLoaderTimerRef.current = null
      }

      if (autoLoaderToastRef.current) {
        dismissToast(autoLoaderToastRef.current)
        autoLoaderToastRef.current = null
      }

      return undefined
    }

    const hasAutoActivity = (blockingFetchCount + blockingMutationCount) > 0

    if (hasAutoActivity) {
      if (!autoLoaderTimerRef.current && !autoLoaderToastRef.current) {
        autoLoaderTimerRef.current = window.setTimeout(() => {
          autoLoaderTimerRef.current = null
          autoLoaderToastRef.current = showToast({
            tone: 'info',
            title: DEFAULT_AUTO_LOADER.title,
            message: DEFAULT_AUTO_LOADER.message,
            persist: true
          })
        }, 700)
      }
    } else {
      if (autoLoaderTimerRef.current) {
        window.clearTimeout(autoLoaderTimerRef.current)
        autoLoaderTimerRef.current = null
      }

      if (autoLoaderToastRef.current) {
        dismissToast(autoLoaderToastRef.current)
        autoLoaderToastRef.current = null
      }
    }

    return undefined
  }, [blockingFetchCount, blockingMutationCount, dismissToast, loaderModal, showToast])

  useEffect(() => () => {
    clearStatusTimer()

    if (autoLoaderTimerRef.current) {
      window.clearTimeout(autoLoaderTimerRef.current)
      autoLoaderTimerRef.current = null
    }

    if (autoLoaderToastRef.current) {
      dismissToast(autoLoaderToastRef.current)
      autoLoaderToastRef.current = null
    }
  }, [clearStatusTimer, dismissToast])

  const statusActionLabel = statusModal?.ctaLabel === false
    ? null
    : statusModal?.ctaLabel || (!statusModal?.autoCloseMs ? 'OK' : null)

  const value = useMemo(() => ({
    showStatus,
    closeStatus,
    showConfirm,
    showLoader,
    hideLoader,
    runWithLoader
  }), [showStatus, closeStatus, showConfirm, showLoader, hideLoader, runWithLoader])

  return (
    <ModalContext.Provider value={value}>
      {children}

      <ModalFrame
        open={Boolean(statusModal)}
        title={statusModal?.modalTitle || (statusModal?.type === 'success' ? 'Completed' : 'Attention')}
        onClose={closeStatus}
        footer={statusActionLabel ? (
          <button type="button" className="btn btn-primary px-4" onClick={closeStatus}>
            {statusActionLabel}
          </button>
        ) : null}
        size={statusModal?.size || 'sm'}
        variant="status"
        hideCloseButton={Boolean(statusModal?.hideCloseButton)}
        dismissible={statusModal?.dismissible ?? true}
      >
        {statusModal ? (
          <StatusDialogContent
            type={statusModal.type}
            title={statusModal.title}
            message={statusModal.message}
          />
        ) : null}
      </ModalFrame>

      <ModalFrame
        open={Boolean(confirmModal)}
        title={confirmModal?.modalTitle || 'Please confirm'}
        onClose={() => resolveConfirm(false)}
        footer={(
          <>
            <button type="button" className="btn btn-light px-4" onClick={() => resolveConfirm(false)}>
              {confirmModal?.cancelLabel || 'Cancel'}
            </button>
            <button type="button" className="btn btn-primary px-4" onClick={() => resolveConfirm(true)}>
              {confirmModal?.confirmLabel || 'Confirm'}
            </button>
          </>
        )}
        size={confirmModal?.size || 'sm'}
        variant="confirm"
      >
        {confirmModal ? (
          <ConfirmDialogContent
            title={confirmModal.title}
            message={confirmModal.message}
            note={confirmModal.note}
          />
        ) : null}
      </ModalFrame>

      <ModalFrame
        open={Boolean(loaderModal)}
        title={loaderModal?.title || 'Please wait'}
        onClose={undefined}
        footer={null}
        size={loaderModal?.size || 'sm'}
        variant="loader"
        hideHeader
        hideCloseButton
        dismissible={false}
        closeOnBackdrop={false}
      >
        {loaderModal ? (
          <GlobalLoaderContent
            title={loaderModal.title}
            message={loaderModal.message}
          />
        ) : null}
      </ModalFrame>
    </ModalContext.Provider>
  )
}

export function useModal() {
  const context = useContext(ModalContext)
  if (!context) throw new Error('useModal must be used within ModalProvider')
  return context
}
