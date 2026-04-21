import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { XCircleIcon } from '../common/AppIcons.jsx'
import { useMyPunchLogsQuery } from '../../hooks/attendance/useMyPunchLogsQuery.js'
import { attendanceService } from '../../api/services/attendance.service.js'
import {
  PUNCH_CONTROL_CHANGED_EVENT,
  applyLocalPunchControl,
  formatElapsedSeconds,
  getElapsedSeconds,
  getPunchSessionState,
  getTodayDateInput,
  rememberPunchOutMode,
  rememberSoftPunchResume
} from '../../utils/attendance.js'
import { getErrorMessage } from '../../utils/auth.js'
import { useModal } from '../../app/providers/ModalProvider.jsx'

export default function HeaderPunchCard() {
  const todayDate = getTodayDateInput()
  const queryClient = useQueryClient()
  const { showConfirm, showStatus } = useModal()
  const [tick, setTick] = useState(0)
  const [punchControlVersion, setPunchControlVersion] = useState(0)
  const [isPunchMenuOpen, setIsPunchMenuOpen] = useState(false)
  const [isPausedHovered, setIsPausedHovered] = useState(false)
  const splitActionRef = useRef(null)

  const todayLogsQuery = useMyPunchLogsQuery(todayDate)
  const todayLogs = useMemo(
    () => applyLocalPunchControl(todayLogsQuery.data || [], todayDate),
    [todayDate, todayLogsQuery.data, punchControlVersion]
  )
  const session = useMemo(() => getPunchSessionState(todayLogs), [todayLogs])

  useEffect(() => {
    if (!session?.isClockedIn || !session?.activePunchIn) return undefined

    const timer = window.setInterval(() => {
      setTick((current) => current + 1)
    }, 1000)

    return () => window.clearInterval(timer)
  }, [session?.activePunchIn, session?.isClockedIn])

  const elapsedSeconds = useMemo(() => {
    if (session?.isClockedIn && session?.activePunchIn) {
      return Number(session?.workedSeconds || 0) + getElapsedSeconds(session.activePunchIn)
    }
    return Number(session?.workedSeconds || 0)
  }, [session?.activePunchIn, session?.isClockedIn, session?.workedSeconds, tick])

  useEffect(() => {
    if (!session?.canPunchOut) setIsPunchMenuOpen(false)
  }, [session?.canPunchOut])

  useEffect(() => {
    if (session?.hasSoftPunchOut) return
    setIsPausedHovered(false)
  }, [session?.hasSoftPunchOut])

  useEffect(() => {
    const handlePunchControlChanged = (event) => {
      const changedDate = String(event?.detail?.attendanceDate || '')
      if (changedDate && changedDate !== todayDate) return
      setPunchControlVersion((current) => current + 1)
    }

    window.addEventListener(PUNCH_CONTROL_CHANGED_EVENT, handlePunchControlChanged)
    return () => {
      window.removeEventListener(PUNCH_CONTROL_CHANGED_EVENT, handlePunchControlChanged)
    }
  }, [todayDate])

  useEffect(() => {
    if (!isPunchMenuOpen) return undefined

    const handlePointerDown = (event) => {
      if (!splitActionRef.current?.contains(event.target)) {
        setIsPunchMenuOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsPunchMenuOpen(false)
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isPunchMenuOpen])

  const punchOutMutation = useMutation({
    mutationFn: (mode = 'final') => attendanceService.punchOut(mode),
    onSuccess: async (result, mode) => {
      rememberPunchOutMode(todayDate, result?.lastPunchOut || new Date(), mode)
      setPunchControlVersion((current) => current + 1)
      setIsPunchMenuOpen(false)

      await queryClient.invalidateQueries({ queryKey: ['attendance', 'employee', 'my-logs', todayDate] })
      showStatus({
        type: 'success',
        title: String(mode).toLowerCase() === 'soft' ? 'Soft punch-out recorded' : 'Final punch-out recorded',
        message: `${result.message} Total worked hours: ${Number(result.totalWorkedHours || 0).toFixed(2)}h.`
      })
    },
    onError: (error) => showStatus({
      type: 'error',
      title: 'Punch-out failed',
      message: getErrorMessage(error, 'The system could not record your punch-out.')
    })
  })

  const handleSoftPunchOut = async () => {
    try {
      await punchOutMutation.mutateAsync('soft')
    } catch {
      // handled in mutation callbacks
    }
  }

  const handleFinalPunchOut = async () => {
    const accepted = await showConfirm({
      modalTitle: 'Final punch-out',
      title: 'Finalize today’s attendance session?',
      message: 'Final punch-out closes the day permanently and removes the live timer from the header.',
      confirmLabel: 'Final Punch Out',
      cancelLabel: 'Keep Session Open'
    })
    if (!accepted) return

    try {
      await punchOutMutation.mutateAsync('final')
    } catch {
      // handled in mutation callbacks
    }
  }

  const handleResumeFromPause = () => {
    if (!session?.hasSoftPunchOut || !session?.canPunchIn || todayLogsQuery.isFetching || punchOutMutation.isPending) return

    rememberSoftPunchResume(todayDate)
    setPunchControlVersion((current) => current + 1)
    showStatus({
      type: 'success',
      title: 'Timer resumed',
      message: 'Your shift timer has resumed. Use Punch Out to pause again or finalize the day.'
    })
  }

  const shouldShowCard = Boolean(session?.firstPunchIn) && !session?.isFinalPunchOut
  if (!shouldShowCard) return null

  const isPending = Boolean(todayLogsQuery.isFetching || punchOutMutation.isPending)

  return (
    <div className={`header-punch-card glass${session?.isClockedIn ? ' is-live' : ' is-paused'}${isPending ? ' is-pending' : ''}`}>
      <div className="header-punch-card__meta">
        <span className="header-punch-card__label">{session?.isClockedIn ? 'Live elapsed' : 'Elapsed time'}</span>
        <strong className="header-punch-card__value">{formatElapsedSeconds(elapsedSeconds)}</strong>
      </div>
      {session?.canPunchOut ? (
        <div ref={splitActionRef} className={`header-punch-split${isPunchMenuOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="btn header-punch-card__action header-punch-card__action--trigger"
            onClick={() => setIsPunchMenuOpen((current) => !current)}
            disabled={punchOutMutation.isPending}
            aria-expanded={isPunchMenuOpen}
          >
            <XCircleIcon />
            <span>{punchOutMutation.isPending ? 'Processing…' : 'Punch-Out'}</span>
          </button>
          <div className="header-punch-menu">
            <button type="button" className="header-punch-option soft" onClick={handleSoftPunchOut} disabled={punchOutMutation.isPending}>
              <span className="header-punch-option__title">Soft Punch Out</span>
              <span className="header-punch-option__helper">Pause timer and allow resume</span>
            </button>
            <button type="button" className="header-punch-option final" onClick={handleFinalPunchOut} disabled={punchOutMutation.isPending}>
              <span className="header-punch-option__title">Final Punch Out</span>
              <span className="header-punch-option__helper">Close the day permanently</span>
            </button>
          </div>
        </div>
      ) : (
        session?.hasSoftPunchOut ? (
          <button
            type="button"
            className="btn header-punch-card__state header-punch-card__state-action"
            onClick={handleResumeFromPause}
            onMouseEnter={() => setIsPausedHovered(true)}
            onMouseLeave={() => setIsPausedHovered(false)}
            onFocus={() => setIsPausedHovered(true)}
            onBlur={() => setIsPausedHovered(false)}
            disabled={todayLogsQuery.isFetching || punchOutMutation.isPending}
          >
            {isPausedHovered ? 'Resume' : 'Paused'}
          </button>
        ) : (
          <span className="header-punch-card__state">Completed</span>
        )
      )}
    </div>
  )
}
