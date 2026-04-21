import React, { useEffect, useMemo, useState } from 'react'
import ModalFrame from '../../../components/common/ModalFrame.jsx'
import { getEmailValidationMessage, hasValidationErrors, markFieldsTouched, normalizeTrimmed } from '../../../utils/validation.js'

export default function PasswordResetRequestModal({
  open,
  initialEmail = '',
  isLoading = false,
  onClose,
  onSubmit
}) {
  const [email, setEmail] = useState(initialEmail)
  const [touched, setTouched] = useState({})

  useEffect(() => {
    if (!open) return
    setEmail(initialEmail || '')
    setTouched({})
  }, [initialEmail, open])

  const errors = useMemo(() => ({
    email: getEmailValidationMessage(email, { required: true })
  }), [email])

  const handleSubmit = async () => {
    const requiredFields = ['email']
    setTouched((current) => ({ ...current, ...markFieldsTouched(requiredFields) }))

    if (hasValidationErrors(errors, requiredFields)) {
      return
    }

    await onSubmit?.(normalizeTrimmed(email))
  }

  return (
    <ModalFrame
      open={open}
      title="Forgot Password"
      onClose={onClose}
      size="md"
      footer={(
        <>
          <button type="button" className="btn btn-light" onClick={onClose} disabled={isLoading}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Sending…' : 'Send reset link'}
          </button>
        </>
      )}
    >
      <div className="d-flex flex-column gap-3">
        <div className="text-muted small">
          Enter the email address linked to your account. We will send a reset link if the account exists.
        </div>

        <div>
          <label className="form-label">Email</label>
          <input
            className={`form-control${touched.email && errors.email ? ' is-invalid' : ''}`}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => setTouched((current) => ({ ...current, email: true }))}
            placeholder="name@company.com"
            autoComplete="email"
          />
          {touched.email && errors.email ? <div className="invalid-feedback d-block">{errors.email}</div> : null}
        </div>
      </div>
    </ModalFrame>
  )
}
