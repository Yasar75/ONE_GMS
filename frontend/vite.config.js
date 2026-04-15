import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { DEFAULT_API_BASE_URL, normalizeApiBaseUrl } from './apiBaseUrl.js'

function buildProxyConfig(apiBaseUrl) {
  if (!/^https?:\/\//i.test(apiBaseUrl || '')) return undefined

  const targetUrl = new URL(apiBaseUrl)
  const targetOrigin = targetUrl.origin
  const targetBasePath = targetUrl.pathname.replace(/\/$/, '')

  return {
    '/__api_proxy__': {
      target: targetOrigin,
      changeOrigin: true,
      secure: false,
      rewrite: (path) => {
        const proxiedPath = path.replace(/^\/__api_proxy__/, '')
        return `${targetBasePath}${proxiedPath}` || '/'
      }
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBaseUrl = normalizeApiBaseUrl(env.VITE_API_BASE_URL, DEFAULT_API_BASE_URL)

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: buildProxyConfig(apiBaseUrl)
    }
  }
})
