import React from 'react'
import { BrowserRouter } from 'react-router-dom'

import App from './App.jsx'
import { AuthProvider } from './app/providers/AuthProvider.jsx'
import { ThemeProvider } from './app/providers/ThemeProvider.jsx'
import { QueryProvider } from './app/providers/QueryProvider.jsx'
import { ModalProvider } from './app/providers/ModalProvider.jsx'
import { ToastProvider } from './app/providers/ToastProvider.jsx'
import { UiProvider } from './app/providers/UiProvider.jsx'
import { NotificationsProvider } from './app/providers/NotificationsProvider.jsx'

export default function RootApp() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <QueryProvider>
          <ToastProvider>
            <ModalProvider>
              <UiProvider>
                <AuthProvider>
                  <NotificationsProvider>
                    <App />
                  </NotificationsProvider>
                </AuthProvider>
              </UiProvider>
            </ModalProvider>
          </ToastProvider>
        </QueryProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
