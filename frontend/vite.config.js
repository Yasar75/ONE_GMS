import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

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
  const apiBaseUrl = (env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: buildProxyConfig(apiBaseUrl)
    }
  }
})
