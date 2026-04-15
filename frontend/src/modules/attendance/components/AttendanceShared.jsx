import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarIcon,
  DownloadIcon,
  HandIcon,
  PencilIcon,
  PlusIcon,
  XCircleIcon
} from '../../../components/common/AppIcons.jsx'
import {
  formatDate,
  formatDateTime,
  formatElapsedSeconds,
  formatHours,
  formatTime,
  getAttendanceBadgeClass,
  getElapsedSeconds,
  getRegularizationBadgeClass
} from '../../../utils/attendance.js'

export function AttendanceMetricCard({ label, value, helper, tone = 'blue' }) {
  return (
    <div className="card border-0 shadow-sm employee-metric-card attendance-metric-card h-100">
      <div className={`employee-metric-accent tone-${tone}`} />
      <div className="card-body">
        <div className="text-muted small mb-2">{label}</div>
        <div className="fs-4 fw-bold mb-1">{value}</div>
        <div className="small text-muted">{helper}</div>
      </div>
    </div>
  )
}

export function AttendanceBadge({ status }) {
  return <span className={getAttendanceBadgeClass(status)}>{status}</span>
}

export function RegularizationBadge({ status }) {
  return <span className={getRegularizationBadgeClass(status)}>{status}</span>
}

export function PunchTypeBadge({ type }) {
  const safe = String(type || '').trim().toLowerCase()
  return <span className={`attendance-badge punch ${safe}`}>{type || '—'}</span>
}

export function AttendanceTabs({ activeTab, onChange, tabs }) {
  return (
    <div className="attendance-tabs-shell">
      <div className="attendance-tabs-scroller">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`attendance-tab-btn${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => {
              if (activeTab === tab.key) return
              onChange(tab.key)
            }}
          >
            <span className="attendance-tab-title">{tab.label}</span>
            <span className="attendance-tab-helper">{tab.helper}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function DownloadActionGroup({ onCsv, onExcel, align = 'start' }) {
  return (
    <div className={`attendance-download-actions justify-content-${align}`}>
      <button type="button" className="btn btn-light employee-toolbar-btn" onClick={onCsv}>
        <DownloadIcon />
        <span>CSV</span>
      </button>
      <button type="button" className="btn btn-outline-primary employee-toolbar-btn" onClick={onExcel}>
        <DownloadIcon />
        <span>Excel</span>
      </button>
    </div>
  )
}

export function PunchSessionCard({
  title,
  attendanceStateLabel,
  session,
  elapsedSeconds,
  dateValue,
  onPunchIn,
  onPunchOut,
  onSoftPunchOut,
  onFinalPunchOut,
  isPunchPending,
  requestAction,
  note,
  secondaryNote,
  rightSlot,
  assignedShift
}) {
  const [tick, setTick] = useState(0)
  const splitActionRef = useRef(null)

  useEffect(() => {
    if (!session?.isClockedIn || !session?.activePunchIn) return undefined

    const timer = window.setInterval(() => {
      setTick((current) => current + 1)
    }, 1000)

    return () => window.clearInterval(timer)
  }, [session?.activePunchIn, session?.isClockedIn])

  const liveElapsedSeconds = useMemo(() => {
    if (session?.isClockedIn && session?.activePunchIn) {
      return Number(session?.workedSeconds || 0) + getElapsedSeconds(session.activePunchIn)
    }
    return elapsedSeconds
  }, [elapsedSeconds, session?.activePunchIn, session?.isClockedIn, session?.workedSeconds, tick])

  const [isPunchMenuOpen, setIsPunchMenuOpen] = useState(false)

  useEffect(() => {
    if (!session?.canPunchOut) setIsPunchMenuOpen(false)
  }, [session?.canPunchOut])

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

  const primaryAction = useMemo(() => {
    if (session?.canPunchOut) {
      const pendingClass = isPunchPending ? ' is-pending' : ''
      return {
        label: isPunchPending ? 'Processing…' : 'Punch Out',
        disabled: !session.canPunchOut || isPunchPending,
        className: `btn attendance-action-btn attendance-action-btn-primary attendance-split-trigger attendance-action-btn-punch attendance-action-btn-punchout${pendingClass}`,
        icon: <XCircleIcon />
      }
    }

    if (session?.canPunchIn) {
      const pendingClass = isPunchPending ? ' is-pending' : ''
      const modeClass = session?.hasSoftPunchOut ? 'attendance-action-btn-resume' : 'attendance-action-btn-punchin'
      return {
        label: isPunchPending ? 'Processing…' : (session?.hasSoftPunchOut ? 'Resume Shift' : 'Punch In'),
        onClick: onPunchIn,
        disabled: !session.canPunchIn || isPunchPending,
        className: `btn attendance-action-btn attendance-action-btn-primary attendance-action-btn-punch ${modeClass}${pendingClass}`,
        icon: <HandIcon />
      }
    }

    return null
  }, [isPunchPending, onPunchIn, session?.canPunchIn, session?.canPunchOut, session?.hasSoftPunchOut])

  return (
    <div className="attendance-punch-card">
      <div className="attendance-punch-card__header">
        <div>
          <div className="attendance-punch-card__eyebrow">Attendance Management</div>
          <h3 className="attendance-punch-card__title mb-1">{title}</h3>
          <div className="small text-muted">{formatDate(dateValue)} • {formatTime(session.firstPunchIn)} to {formatTime(session.lastPunchOut)}</div>
        </div>
        <AttendanceBadge status={attendanceStateLabel} />
      </div>

      <div className="attendance-punch-card__timer">
        <div className="attendance-punch-card__timer-label">Elapsed time</div>
        <div className="attendance-punch-card__timer-value">{formatElapsedSeconds(liveElapsedSeconds)}</div>
      </div>

      <div className="attendance-punch-card__stats">
        <div className="attendance-punch-stat">
          <span>First punch in</span>
          <strong>{formatDateTime(session.firstPunchIn)}</strong>
        </div>
        <div className="attendance-punch-stat">
          <span>Last punch out</span>
          <strong>{formatDateTime(session.lastPunchOut)}</strong>
        </div>
        <div className="attendance-punch-stat">
          <span>Total punches</span>
          <strong>{session.totalPunches}</strong>
        </div>
        <div className="attendance-punch-stat">
          <span>Worked hours</span>
          <strong>{session.totalWorkedHours != null ? formatHours(session.totalWorkedHours) : '—'}</strong>
        </div>
      </div>

      {assignedShift ? (
        <div className="attendance-punch-shift-card">
          <div className="attendance-punch-shift-card__label">Assigned Shift</div>
          <div className="attendance-punch-shift-card__title">{assignedShift.title || 'Not assigned'}</div>
          <div className="attendance-punch-shift-card__meta">
            {[assignedShift.code, assignedShift.window, assignedShift.status].filter(Boolean).join(' • ') || 'Shift details are not available yet.'}
          </div>
          {assignedShift.helper ? <div className="attendance-punch-shift-card__helper">{assignedShift.helper}</div> : null}
        </div>
      ) : null}

      {(primaryAction || requestAction) ? (
        <div className="attendance-punch-card__actions">
          {primaryAction ? (
            session?.canPunchOut ? (
              <div ref={splitActionRef} className={`attendance-split-action${isPunchMenuOpen ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className={primaryAction.className}
                  onClick={() => setIsPunchMenuOpen((current) => !current)}
                  disabled={primaryAction.disabled}
                  aria-expanded={isPunchMenuOpen}
                >
                  {primaryAction.icon}
                  <span>{primaryAction.label}</span>
                </button>
                <div className="attendance-split-menu">
                  <button type="button" className="attendance-split-option soft" onClick={() => { setIsPunchMenuOpen(false); (onSoftPunchOut || onPunchOut)?.() }} disabled={isPunchPending}>
                    <span className="attendance-split-option__title">Soft Punch Out</span>
                    <span className="attendance-split-option__helper">Pause timer and allow resume</span>
                  </button>
                  <button type="button" className="attendance-split-option final" onClick={() => { setIsPunchMenuOpen(false); (onFinalPunchOut || onPunchOut)?.() }} disabled={isPunchPending}>
                    <span className="attendance-split-option__title">Final Punch Out</span>
                    <span className="attendance-split-option__helper">Close the day permanently</span>
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className={primaryAction.className} onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
                {primaryAction.icon}
                <span>{primaryAction.label}</span>
              </button>
            )
          ) : null}
          {requestAction ? (
            <button type="button" className="btn btn-light attendance-action-btn" onClick={requestAction.onClick}>
              {requestAction.icon === 'pencil' ? <PencilIcon /> : <PlusIcon />}
              <span>{requestAction.label}</span>
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="attendance-punch-card__footer">
        <div className="attendance-note-card small text-muted mb-0">{note}</div>
        {secondaryNote ? <div className="attendance-note-card small text-muted mb-0">{secondaryNote}</div> : null}
        {rightSlot || null}
      </div>
    </div>
  )
}

export function OverviewList({ items = [] }) {
  return (
    <div className="attendance-overview-list">
      {items.map((item) => (
        <div className="attendance-overview-list__item" key={item.label}>
          <div className="attendance-overview-list__icon">{item.icon || <CalendarIcon />}</div>
          <div>
            <div className="attendance-detail-label">{item.label}</div>
            <div className="attendance-detail-value">{item.value}</div>
            {item.helper ? <div className="small text-muted mt-1">{item.helper}</div> : null}
          </div>
        </div>
      ))}
    </div>
  )
}
