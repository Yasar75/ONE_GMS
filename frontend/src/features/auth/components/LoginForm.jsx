import React, { useMemo, useState } from 'react'
import { storage } from '../../../utils/storage.js'
import { AUTH_STORAGE_KEYS } from '../../../utils/auth.js'
import { EyeIcon, EyeOffIcon } from '../../../components/common/AppIcons.jsx'

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(String(value || '').trim())
}

export default function LoginForm({ onSubmit, isLoading }) {
  const remembered = useMemo(() => storage.get(AUTH_STORAGE_KEYS.rememberedLogin, null), [])
  const [email, setEmail] = useState(remembered?.email || '')
  const [password, setPassword] = useState(remembered?.password || '')
  const [rememberCredential, setRememberCredential] = useState(Boolean(remembered?.rememberCredential))
  const [showPassword, setShowPassword] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)

  const trimmedEmail = email.trim()
  const emailIsInvalid = emailTouched && trimmedEmail.length > 0 && !isValidEmail(trimmedEmail)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setEmailTouched(true)

    if (!isValidEmail(trimmedEmail)) {
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
        <input
          className={`form-control form-control-lg auth-input${emailIsInvalid ? ' is-invalid' : ''}`}
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
        {emailIsInvalid ? <div className="invalid-feedback d-block">Enter a valid email address.</div> : null}
      </div>

      <div className="auth-field-block">
        <label className="form-label auth-field-label">Password</label>
        <div className="input-group input-group-lg auth-input-group">
          <input
            className="form-control auth-input"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className="btn btn-outline-secondary auth-password-toggle"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </div>

      <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap auth-form-meta">
        <div className="form-check m-0">
          <input
            id="rememberCredential"
            className="form-check-input"
            type="checkbox"
            checked={rememberCredential}
            onChange={(event) => setRememberCredential(event.target.checked)}
          />
          <label className="form-check-label text-muted small" htmlFor="rememberCredential">
            Remember credential
          </label>
        </div>
        <div className="small text-muted auth-session-note">Session auto-locks after 15 minutes of inactivity.</div>
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-lg w-100 auth-submit-btn"
        disabled={isLoading || !trimmedEmail || !password || !isValidEmail(trimmedEmail)}
      >
        {isLoading ? 'Signing in…' : 'Login'}
      </button>
    </form>
  )
}
