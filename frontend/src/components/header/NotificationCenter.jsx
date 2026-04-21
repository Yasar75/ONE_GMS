import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellIcon } from '../common/AppIcons.jsx'
import { useNotifications } from '../../app/providers/NotificationsProvider.jsx'

export default function NotificationCenter() {
  const navigate = useNavigate()
  const panelRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const {
    notifications,
    peekNotification,
    unreadCount,
    hasOpenedUnread,
    isLoading,
    markNotificationsOpened,
    markNotificationRead,
    markAllAsRead,
    dismissPeekNotification
  } = useNotifications()

  useEffect(() => {
    if (!isOpen) return undefined

    dismissPeekNotification()

    markNotificationsOpened(notifications.map((item) => item.id))

    function handlePointerDown(event) {
      if (!panelRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [dismissPeekNotification, isOpen, markNotificationsOpened, notifications])

  const showCountBadge = unreadCount > 0
  const showDotBadge = !showCountBadge && hasOpenedUnread
  const hasNotifications = notifications.length > 0
  const showPeek = Boolean(peekNotification?.id) && !isOpen

  function handleNotificationSelect(notification) {
    if (!notification?.id || !notification?.to) return
    markNotificationRead(notification.id)
    setIsOpen(false)
    navigate(notification.to)
  }

  return (
    <div ref={panelRef} className={`header-notification ${isOpen ? 'is-open' : ''}`.trim()}>
      <button
        type="button"
        className={`header-notification-btn ${hasNotifications ? 'has-feed' : ''} ${(showCountBadge || showDotBadge) ? 'has-unread' : ''} ${isOpen ? 'is-open' : ''}`.trim()}
        onClick={() => setIsOpen((current) => !current)}
        aria-label="Open notifications"
        aria-expanded={isOpen}
      >
        <span className="header-notification-btn__pulse" aria-hidden="true" />
        <span className="header-notification-btn__halo" aria-hidden="true" />
        <span className="header-notification-btn__icon" aria-hidden="true">
          <BellIcon />
        </span>
        {showCountBadge ? <span className="header-notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
        {showDotBadge ? <span className="header-notification-dot" /> : null}
      </button>

      {showPeek ? (
        <div
          className={`header-notification-peek tone-${peekNotification.tone || 'info'} is-visible`.trim()}
          role="status"
          aria-live="polite"
        >
          <button
            type="button"
            className="header-notification-peek__surface"
            onClick={() => handleNotificationSelect(peekNotification)}
          >
            <span className="header-notification-peek__label">{peekNotification.category || 'Updates'}</span>
            <span className="header-notification-peek__title">{peekNotification.title}</span>
            <span className="header-notification-peek__message">{peekNotification.message}</span>
          </button>
          <button
            type="button"
            className="header-notification-peek__dismiss"
            onClick={dismissPeekNotification}
            aria-label="Dismiss live notification"
          >
            ×
          </button>
        </div>
      ) : null}

      <div className={`header-notification-panel ${isOpen ? 'is-open' : ''}`.trim()}>
        <div className="header-notification-panel__header">
          <div>
            <div className="header-notification-panel__title">Notifications</div>
            <div className="header-notification-panel__subtitle">
              {showCountBadge ? `${unreadCount} new update${unreadCount === 1 ? '' : 's'}` : hasOpenedUnread ? 'Opened items still unread' : 'All caught up'}
            </div>
          </div>
          <button
            type="button"
            className="header-notification-panel__action"
            onClick={markAllAsRead}
            disabled={!notifications.some((item) => !item.isRead)}
          >
            Mark all read
          </button>
        </div>

        <div className="header-notification-panel__body">
          {isLoading && !notifications.length ? (
            <div className="header-notification-empty">Loading the latest alerts…</div>
          ) : null}

          {!isLoading && !notifications.length ? (
            <div className="header-notification-empty">No notifications are waiting right now.</div>
          ) : null}

          {notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              className={`header-notification-item ${notification.isNewUnread ? 'is-new' : ''} ${notification.isRead ? 'is-read' : ''}`.trim()}
              onClick={() => handleNotificationSelect(notification)}
            >
              <span className={`header-notification-item__accent tone-${notification.tone}`.trim()} aria-hidden="true" />
              <span className="header-notification-item__body">
                <span className="header-notification-item__eyebrow">{notification.category}</span>
                <span className="header-notification-item__title">{notification.title}</span>
                <span className="header-notification-item__message">{notification.message}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
