import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoginForm from '../components/LoginForm.jsx'
import PasswordResetRequestModal from '../components/PasswordResetRequestModal.jsx'
import logoLight from '../../../asserts/one_gms_logo_dark.svg'
import logoDark from '../../../asserts/one_gms_logo_light.svg'
import { useAuth } from '../../../app/providers/AuthProvider.jsx'
import { useModal } from '../../../app/providers/ModalProvider.jsx'
import { useToast } from '../../../app/providers/ToastProvider.jsx'
import { getErrorMessage, isProfileSetupRequired } from '../../../utils/auth.js'
import ThemeToggle from '../../../components/header/ThemeToggle.jsx'
import { authService } from '../../../api/services/auth.service.js'
import { useTheme } from '../../../app/providers/ThemeProvider.jsx'

export default function Login() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const { login, isAuthenticated, isAuthReady } = useAuth()
  const { showStatus, runWithLoader } = useModal()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const logoUrl = theme === 'dark' ? logoDark : logoLight

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

      showToast({
        tone: 'success',
        title: 'Login successful',
        message: 'Fetching your latest workspace data and routing you to the right module.'
      })
      navigate(isProfileSetupRequired(result.user) ? '/profile' : '/dashboard', { replace: true })
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

  const handleOpenForgotPassword = (email = '') => {
    setForgotPasswordEmail(String(email || '').trim())
    setForgotPasswordOpen(true)
  }

  const handleForgotPasswordSubmit = async (email) => {
    setForgotPasswordLoading(true)

    try {
      const result = await authService.requestPasswordReset(email)
      setForgotPasswordOpen(false)
      showStatus({
        type: 'success',
        title: 'Reset link sent',
        message: result?.message || 'Please check your email for instructions to reset your password.'
      })
    } catch (error) {
      showStatus({
        type: 'error',
        title: 'Reset request failed',
        message: getErrorMessage(error, 'We could not send the reset instructions right now.')
      })
    } finally {
      setForgotPasswordLoading(false)
    }
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
          <div className="auth-login-title">Access your workspace</div>
          <p className="auth-login-subtext mb-0">
            Sign in once and we will route you to the right console based on your account permissions.
          </p>
        </div>

        <LoginForm onSubmit={handleSubmit} onForgotPassword={handleOpenForgotPassword} isLoading={loading} />
      </div>

      <PasswordResetRequestModal
        open={forgotPasswordOpen}
        initialEmail={forgotPasswordEmail}
        isLoading={forgotPasswordLoading}
        onClose={() => setForgotPasswordOpen(false)}
        onSubmit={handleForgotPasswordSubmit}
      />
    </div>
  )
}
