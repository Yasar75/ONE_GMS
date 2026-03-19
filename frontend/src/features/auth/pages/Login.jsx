import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoginForm from '../components/LoginForm.jsx'
import logoUrl from '../../../assets/headerLogo.svg'
import { useAuth } from '../../../app/providers/AuthProvider.jsx'
import { useModal } from '../../../app/providers/ModalProvider.jsx'
import { getErrorMessage } from '../../../utils/auth.js'
import ThemeToggle from '../../../components/header/ThemeToggle.jsx'

export default function Login() {
  const navigate = useNavigate()
  const { login, isAuthenticated, isAuthReady } = useAuth()
  const { showStatus, runWithLoader } = useModal()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAuthReady && isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, isAuthReady, navigate])

  const handleSubmit = async (payload) => {
    setLoading(true)

    try {
      const result = await runWithLoader(
        () => login(payload),
        {
          title: 'Logging in',
          message: 'Verifying your credentials and preparing your workspace.',
          minVisibleMs: 800
        }
      )

      showStatus({
        type: 'success',
        title: 'Login successful',
        message: `${result.user.firstName || 'User'}, your workspace is ready.`,
        autoCloseMs: 950,
        hideCloseButton: true,
        dismissible: false,
        onClose: () => navigate('/dashboard', { replace: true })
      })
    } catch (err) {
      showStatus({
        type: 'error',
        title: 'Login failed',
        message: getErrorMessage(err, 'Please check your credentials and try again.'),
        ctaLabel: 'Try again'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-panel d-flex flex-column gap-4">
      <div className="auth-panel-toolbar">
        <div className="auth-theme-switcher glass">
          <ThemeToggle />
        </div>
      </div>

      <div className="d-lg-none auth-mobile-brand glass">
        <img src={logoUrl} alt="Giantmind Solutions Pvt Ltd" className="auth-mobile-logo" />
      </div>

      <div className="auth-form-shell auth-form-shell-elevated glass">
        <div className="auth-login-copy">
          <div className="auth-login-eyebrow">One GMS</div>
          <div className="auth-login-title">Access your workspace</div>
          <p className="auth-login-subtext mb-0">
            Sign in once and we will route you to the right console based on your account permissions.
          </p>
        </div>

        <LoginForm onSubmit={handleSubmit} isLoading={loading} />
      </div>
    </div>
  )
}
