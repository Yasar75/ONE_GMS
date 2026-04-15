import React from 'react'
import { AppRoutes } from './app/routes/AppRoutes.jsx'
import { SpeedInsights } from '@vercel/speed-insights/react'

export default function App() {
  return (
    <>
      <AppRoutes />
      <SpeedInsights />
    </>
  )
}
