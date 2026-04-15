import React from 'react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { AppRoutes } from './app/routes/AppRoutes.jsx'

export default function App(){
  return (
    <>
      <AppRoutes />
      <SpeedInsights />
    </>
  )
}
