import React, { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import logoLight from '../../../asserts/one_gms_logo_dark.svg'
import logoDark from '../../../asserts/one_gms_logo_light.svg'
import ThemeToggle from '../../../components/header/ThemeToggle.jsx'
import { ChevronRightIcon } from '../../../components/common/AppIcons.jsx'
import { useModal } from '../../../app/providers/ModalProvider.jsx'
import { authService } from '../../../api/services/auth.service.js'
import { getErrorMessage } from '../../../utils/auth.js'
import { buildPasswordValidation, getRequiredFieldMessage, hasValidationErrors, markFieldsTouched } from '../../../utils/validation.js'
import { useTheme } from '../../../app/providers/ThemeProvider.jsx'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { token = '' } = useParams()
  const { showStatus } = useModal()
  const { theme } = useTheme()

  const [form, setForm] = useState({ new_password: '', confirm_new_password: '' })
  const [touched, setTouched] = useState({})
  const [showPassword, setShowPassword] = useState({ new_password: false, confirm_new_password: false })
  const [loading, setLoading] = useState(false)
  const logoUrl = theme === 'dark' ? logoDark : logoLight

  const passwordValidation = useMemo(
    () => buildPasswordValidation(form.new_password, form.confirm_new_password),
    [form.confirm_new_password, form.new_password]
  )

  const errors = useMemo(() => ({
    new_password: !form.new_password
      ? getRequiredFieldMessage(form.new_password, 'New password')
      : (passwordValidation.isValid ? '' : (passwordValidation.checks.find((entry) => !entry.passed)?.label || 'Enter a stronger password.')),
    confirm_new_password: !form.confirm_new_password
      ? getRequiredFieldMessage(form.confirm_new_password, 'Confirm new password')
      : (passwordValidation.confirmMatches ? '' : 'New password and confirm password must match.')
  }), [form.confirm_new_password, form.new_password, passwordValidation])

  const handleSubmit = async (event) => {
    event.preventDefault()

    const requiredFields = ['new_password', 'confirm_new_password']
    setTouched((current) => ({ ...current, ...markFieldsTouched(requiredFields) }))

    if (!token) {
      showStatus({
        type: 'error',
        title: 'Invalid reset link',
        message: 'This password reset link is incomplete. Request a new one from the login screen.'
      })
      return
    }

    if (hasValidationErrors(errors, requiredFields)) {
      return
    }

    setLoading(true)

    try {
      const result = await authService.confirmPasswordReset(token, form)
      showStatus({
        type: 'success',
        title: 'Password updated',
        message: result?.message || 'Your password has been reset successfully.',
        autoCloseMs: 1000,
        hideCloseButton: true,
        dismissible: false,
        onClose: () => navigate('/login', { replace: true })
      })
    } catch (error) {
      showStatus({
        type: 'error',
        title: 'Reset failed',
        message: getErrorMessage(error, 'The password reset could not be completed. Request a new reset link and try again.')
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBlur = (fieldName) => {
    setTouched((current) => ({ ...current, [fieldName]: true }))
  }

  return (
    <div className="auth-panel d-flex flex-column gap-4">
      <div className="auth-panel-toolbar">
        <div className="auth-theme-switcher">
          <ThemeToggle />
        </div>
      </div>

      <div className="d-lg-none auth-mobile-brand glass">
        <img src={logoUrl} alt="Giantmind Solutions Pvt Ltd" className="auth-mobile-logo" />
      </div>

      <div className="auth-form-shell auth-form-shell-elevated glass">
        <div className="auth-login-copy">
          <div className="auth-login-eyebrow">One GMS</div>
          <div className="auth-login-title">Set a new password</div>
          <p className="auth-login-subtext mb-0">
            Choose a strong password for your account, then return to the login screen with the new credential.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-login-form d-flex flex-column gap-3" noValidate>
          <div className="auth-field-block">
            <label className="form-label auth-field-label">New Password</label>
            <div className="input-group input-group-lg auth-input-group">
              <input
                className={`form-control auth-input${touched.new_password && errors.new_password ? ' is-invalid' : ''}`}
                type={showPassword.new_password ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.new_password}
                onChange={(event) => setForm((current) => ({ ...current, new_password: event.target.value }))}
                onBlur={() => handleBlur('new_password')}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className={`auth-password-toggle${showPassword.new_password ? ' is-open' : ''}`}
                onClick={() => setShowPassword((current) => ({ ...current, new_password: !current.new_password }))}
                aria-label={showPassword.new_password ? 'Hide password' : 'Show password'}
              >
                <span className="auth-password-toggle-visual" aria-hidden="true">
                  <span className="auth-password-toggle-outline">
                    <span className="auth-password-toggle-pupil" />
                  </span>
                  <span className="auth-password-toggle-slash" />
                </span>
                <span className="auth-password-toggle-text">{showPassword.new_password ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            {touched.new_password && errors.new_password ? <div className="invalid-feedback d-block">{errors.new_password}</div> : null}
          </div>

          <div className="password-strength-shell">
            <div className="password-strength-header">
              <span>Password Strength</span>
              <strong>{passwordValidation.label}</strong>
            </div>
            <div className={`password-strength-bar score-${passwordValidation.score}`.trim()}>
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="password-checklist">
              {passwordValidation.checks.map((entry) => (
                <div key={entry.key} className={`password-check-item ${entry.passed ? 'is-met' : 'is-unmet'}`.trim()}>
                  {entry.label}
                </div>
              ))}
            </div>
          </div>

          <div className="auth-field-block">
            <label className="form-label auth-field-label">Confirm New Password</label>
            <div className="input-group input-group-lg auth-input-group">
              <input
                className={`form-control auth-input${touched.confirm_new_password && errors.confirm_new_password ? ' is-invalid' : ''}`}
                type={showPassword.confirm_new_password ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.confirm_new_password}
                onChange={(event) => setForm((current) => ({ ...current, confirm_new_password: event.target.value }))}
                onBlur={() => handleBlur('confirm_new_password')}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className={`auth-password-toggle${showPassword.confirm_new_password ? ' is-open' : ''}`}
                onClick={() => setShowPassword((current) => ({ ...current, confirm_new_password: !current.confirm_new_password }))}
                aria-label={showPassword.confirm_new_password ? 'Hide password' : 'Show password'}
              >
                <span className="auth-password-toggle-visual" aria-hidden="true">
                  <span className="auth-password-toggle-outline">
                    <span className="auth-password-toggle-pupil" />
                  </span>
                  <span className="auth-password-toggle-slash" />
                </span>
                <span className="auth-password-toggle-text">{showPassword.confirm_new_password ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            {touched.confirm_new_password && errors.confirm_new_password ? <div className="invalid-feedback d-block">{errors.confirm_new_password}</div> : null}
          </div>

          <div className={`password-match-indicator ${!form.confirm_new_password ? 'is-pending' : (passwordValidation.confirmMatches ? 'is-match' : 'is-mismatch')}`.trim()}>
            {!form.confirm_new_password
              ? 'Confirm the new password to verify the match.'
              : (passwordValidation.confirmMatches ? 'New password and confirm password match.' : 'New password and confirm password do not match.')}
          </div>

          <div className="d-flex gap-2 flex-wrap">
            <button type="submit" className="btn btn-primary btn-lg flex-grow-1 auth-submit-btn" disabled={loading}>
              <span className="auth-submit-btn-copy">
                <span className="auth-submit-btn-label">{loading ? 'Updating…' : 'Update Password'}</span>
                <span className="auth-submit-btn-icon" aria-hidden="true">
                  <ChevronRightIcon />
                </span>
              </span>
            </button>
            <button type="button" className="btn btn-outline-secondary btn-lg" onClick={() => navigate('/login', { replace: true })} disabled={loading}>
              Back To Login
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
