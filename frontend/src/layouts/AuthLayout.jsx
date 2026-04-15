import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import logoLight from '../asserts/one_gms_logo_dark.svg'
import logoDark from '../asserts/one_gms_logo_light.svg'
import { useTheme } from '../app/providers/ThemeProvider.jsx'

export function AuthLayout() {
  const { theme } = useTheme()
  const location = useLocation()
  const logoSrc = theme === 'dark' ? logoDark : logoLight

  return (
    <div className="auth-page">
      <div className="auth-card glass shadow-lg">
        <div className="row g-0 min-vh-0">
          <aside className="col-lg-6 d-none d-lg-flex auth-aside p-5">
            <div className="auth-aside-inner w-100 d-flex flex-column justify-content-between">
              <div className="auth-brand-lockup">
                <div className="auth-brand-logo-wrap">
                  <img src={logoSrc} alt="Giantmind Solutions" className="auth-logo" />
                </div>

                <div className="auth-brand-copy">
                  <div className="auth-brand-caption">One GMS</div>
                  <h1 className="auth-brand-title">Operations access, without noise.</h1>
                  <p className="auth-subtext mb-0">
                    Unified sign-in for administration and employee workflows with a cleaner, more focused entry experience.
                  </p>
                </div>
              </div>

              <div className="auth-aside-note">
                <div className="auth-note-title">Protected workspace</div>
                <div className="auth-note-copy">Use your assigned credentials to enter the organization portal.</div>
              </div>
            </div>
          </aside>

          <section className="col-12 col-lg-6 auth-form p-4 p-lg-5">
            <div key={location.pathname} className="route-transition auth-route-shell">
              <Outlet />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
