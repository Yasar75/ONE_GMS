import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

import './styles/main.scss'

import App from './App.jsx'
import { AuthProvider } from './app/providers/AuthProvider.jsx'
import { ThemeProvider } from './app/providers/ThemeProvider.jsx'
import { QueryProvider } from './app/providers/QueryProvider.jsx'
import { ModalProvider } from './app/providers/ModalProvider.jsx'
import { UiProvider } from './app/providers/UiProvider.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <QueryProvider>
          <ModalProvider>
            <UiProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </UiProvider>
          </ModalProvider>
        </QueryProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)
