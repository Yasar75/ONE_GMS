import React, { useMemo, useState } from 'react'
import { storage } from '../../../utils/storage.js'
import { AUTH_STORAGE_KEYS } from '../../../utils/auth.js'
import { CheckIcon, ChevronRightIcon } from '../../../components/common/AppIcons.jsx'
import { getEmailValidationMessage, getRequiredFieldMessage } from '../../../utils/validation.js'

export default function LoginForm({ onSubmit, onForgotPassword, isLoading }) {
  const remembered = useMemo(() => storage.get(AUTH_STORAGE_KEYS.rememberedLogin, null), [])
  const [email, setEmail] = useState(remembered?.email || '')
  const [password, setPassword] = useState(remembered?.password || '')
  const [rememberCredential, setRememberCredential] = useState(Boolean(remembered?.rememberCredential))
  const [showPassword, setShowPassword] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)

  const trimmedEmail = email.trim()
  const emailError = getEmailValidationMessage(trimmedEmail, { required: true })
  const passwordError = getRequiredFieldMessage(password, 'Password')
  const emailIsInvalid = emailTouched && Boolean(emailError)
  const passwordIsInvalid = passwordTouched && Boolean(passwordError)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setEmailTouched(true)
    setPasswordTouched(true)

    if (emailError || passwordError) {
      return
    }

    if (rememberCredential) {
      storage.set(AUTH_STORAGE_KEYS.rememberedLogin, {
        email: trimmedEmail,
        password,
        rememberCredential: true
      })
    } else {
      storage.remove(AUTH_STORAGE_KEYS.rememberedLogin)
    }

    await onSubmit({ email: trimmedEmail, password, rememberCredential })
  }

  return (
    <form onSubmit={handleSubmit} className="auth-login-form d-flex flex-column gap-3" noValidate>
      <div className="auth-field-block">
        <label className="form-label auth-field-label">Email</label>
        <div className="input-group input-group-lg auth-input-group auth-input-group--single">
          <input
            className={`form-control auth-input${emailIsInvalid ? ' is-invalid' : ''}`}
            type="text"
            inputMode="email"
            placeholder="name@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => setEmailTouched(true)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            required
          />
        </div>
        {emailIsInvalid ? <div className="invalid-feedback d-block">{emailError}</div> : null}
      </div>

      <div className="auth-field-block">
        <label className="form-label auth-field-label">Password</label>
        <div className="input-group input-group-lg auth-input-group">
          <input
            className={`form-control auth-input${passwordIsInvalid ? ' is-invalid' : ''}`}
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onBlur={() => setPasswordTouched(true)}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className={`auth-password-toggle${showPassword ? ' is-open' : ''}`}
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <span className="auth-password-toggle-visual" aria-hidden="true">
              <span className="auth-password-toggle-outline">
                <span className="auth-password-toggle-pupil" />
              </span>
              <span className="auth-password-toggle-slash" />
            </span>
            <span className="auth-password-toggle-text">{showPassword ? 'Hide' : 'Show'}</span>
          </button>
        </div>
        {passwordIsInvalid ? <div className="invalid-feedback d-block">{passwordError}</div> : null}
      </div>

      <div className="auth-form-meta">
        <label className={`auth-remember-control${rememberCredential ? ' is-checked' : ''}`} htmlFor="rememberCredential">
          <input
            id="rememberCredential"
            className="auth-remember-input visually-hidden"
            type="checkbox"
            checked={rememberCredential}
            onChange={(event) => setRememberCredential(event.target.checked)}
          />
          <span className="auth-remember-indicator" aria-hidden="true">
            <CheckIcon />
          </span>
          <span className="auth-remember-copy">
            <span className="auth-remember-title">Remember credential</span>
            <span className="auth-remember-subtext">Use this device for quicker sign-in.</span>
          </span>
        </label>

        <button type="button" className="auth-forgot-link" onClick={() => onForgotPassword?.(trimmedEmail)} disabled={isLoading}>
          <span className="auth-forgot-link-copy">
            <span className="auth-forgot-link-title">Forgot password?</span>
            <span className="auth-forgot-link-subtext">Send a secure reset link</span>
          </span>
          <span className="auth-forgot-link-icon" aria-hidden="true">
            <ChevronRightIcon />
          </span>
        </button>
      </div>

      <div className="small text-muted auth-session-note">Session auto-locks after 15 minutes of inactivity.</div>

      <button
        type="submit"
        className="btn btn-primary btn-lg w-100 auth-submit-btn"
        disabled={isLoading || Boolean(emailError) || Boolean(passwordError)}
      >
        <span className="auth-submit-btn-copy">
          <span className="auth-submit-btn-label">{isLoading ? 'Signing in…' : 'Login'}</span>
          <span className="auth-submit-btn-icon" aria-hidden="true">
            <ChevronRightIcon />
          </span>
        </span>
      </button>
    </form>
  )
}
