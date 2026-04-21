import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import ModalFrame from '../../components/common/ModalFrame.jsx'
import StatusDialogContent from '../../components/common/StatusDialogContent.jsx'
import ConfirmDialogContent from '../../components/common/ConfirmDialogContent.jsx'
import GlobalLoaderContent from '../../components/common/GlobalLoaderContent.jsx'

const ModalContext = createContext(null)
const DEFAULT_AUTO_LOADER = {
  title: 'Loading workspace',
  message: 'We are still fetching live data for this page.'
}
const AUTO_QUERY_LOADER_DELAY_MS = 5000
const AUTO_MUTATION_LOADER_DELAY_MS = 220
const LOADER_COMPLETION_MS = 420

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
  const autoLoaderDelayRef = useRef(null)
  const loaderCompletionTimerRef = useRef(null)
  const blockingFetchCount = useIsFetching({
    predicate: shouldShowBlockingQueryLoader
  })
  const blockingMutationCount = useIsMutating({
    predicate: (mutation) => Boolean(mutation?.options?.meta?.showGlobalLoader)
  })

  const [statusModal, setStatusModal] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)
  const [loaderModal, setLoaderModal] = useState(null)

  const clearLoaderCompletionTimer = useCallback(() => {
    if (loaderCompletionTimerRef.current) {
      window.clearTimeout(loaderCompletionTimerRef.current)
      loaderCompletionTimerRef.current = null
    }
  }, [])

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
    clearLoaderCompletionTimer()
    setLoaderModal({
      source: 'manual',
      title: config.title || 'Please wait',
      message: config.message || 'We are processing your request.',
      size: config.size || 'sm'
    })
  }, [clearLoaderCompletionTimer])

  const hideLoader = useCallback(() => {
    clearLoaderCompletionTimer()
    setLoaderModal((current) => (current?.source === 'manual' ? { ...current, completed: true } : current))
    loaderCompletionTimerRef.current = window.setTimeout(() => {
      loaderCompletionTimerRef.current = null
      setLoaderModal((current) => (current?.source === 'manual' ? null : current))
    }, LOADER_COMPLETION_MS)
  }, [clearLoaderCompletionTimer])

  const runWithLoader = useCallback(async (task, config = {}) => {
    const minVisibleMs = config.minVisibleMs ?? 420
    const delayMs = config.delayMs ?? 220
    let didShowLoader = false
    let shownAt = 0

    const showTimer = window.setTimeout(() => {
      shownAt = Date.now()
      didShowLoader = true
      clearLoaderCompletionTimer()
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
        setLoaderModal((current) => (current?.source === 'manual' ? { ...current, completed: true } : current))
        await wait(LOADER_COMPLETION_MS)
        setLoaderModal((current) => (current?.source === 'manual' ? null : current))
      }
    }
  }, [clearLoaderCompletionTimer])

  useEffect(() => {
    if (loaderModal?.source === 'manual') {
      if (autoLoaderTimerRef.current) {
        window.clearTimeout(autoLoaderTimerRef.current)
        autoLoaderTimerRef.current = null
        autoLoaderDelayRef.current = null
      }

      return undefined
    }

    const hasAutoActivity = (blockingFetchCount + blockingMutationCount) > 0
    const nextAutoDelayMs = blockingMutationCount > 0
      ? AUTO_MUTATION_LOADER_DELAY_MS
      : AUTO_QUERY_LOADER_DELAY_MS

    if (hasAutoActivity) {
      if (
        autoLoaderTimerRef.current
        && autoLoaderDelayRef.current !== nextAutoDelayMs
        && loaderModal?.source !== 'auto'
      ) {
        window.clearTimeout(autoLoaderTimerRef.current)
        autoLoaderTimerRef.current = null
        autoLoaderDelayRef.current = null
      }

      if (!autoLoaderTimerRef.current && loaderModal?.source !== 'auto') {
        autoLoaderDelayRef.current = nextAutoDelayMs
        autoLoaderTimerRef.current = window.setTimeout(() => {
          autoLoaderTimerRef.current = null
          autoLoaderDelayRef.current = null
          clearLoaderCompletionTimer()
          setLoaderModal({
            source: 'auto',
            title: DEFAULT_AUTO_LOADER.title,
            message: DEFAULT_AUTO_LOADER.message,
            size: 'sm'
          })
        }, nextAutoDelayMs)
      }
    } else {
      if (autoLoaderTimerRef.current) {
        window.clearTimeout(autoLoaderTimerRef.current)
        autoLoaderTimerRef.current = null
        autoLoaderDelayRef.current = null
      }

      if (loaderModal?.source === 'auto') {
        if (!loaderModal.completed && !loaderCompletionTimerRef.current) {
          setLoaderModal((current) => (current?.source === 'auto' ? { ...current, completed: true } : current))
          loaderCompletionTimerRef.current = window.setTimeout(() => {
            loaderCompletionTimerRef.current = null
            setLoaderModal((current) => (current?.source === 'auto' ? null : current))
          }, LOADER_COMPLETION_MS)
        }
      } else {
        setLoaderModal((current) => (current?.source === 'auto' ? null : current))
      }
    }

    return undefined
  }, [blockingFetchCount, blockingMutationCount, clearLoaderCompletionTimer, loaderModal?.completed, loaderModal?.source])

  useEffect(() => () => {
    clearStatusTimer()
    clearLoaderCompletionTimer()

    if (autoLoaderTimerRef.current) {
      window.clearTimeout(autoLoaderTimerRef.current)
      autoLoaderTimerRef.current = null
      autoLoaderDelayRef.current = null
    }
  }, [clearLoaderCompletionTimer, clearStatusTimer])

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
            completed={Boolean(loaderModal.completed)}
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
