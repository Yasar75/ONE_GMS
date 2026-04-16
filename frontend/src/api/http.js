import axios from 'axios'
import { storage } from '../utils/storage.js'
import { endpoints } from './endpoints.js'
import { AUTH_STORAGE_KEYS } from '../utils/auth.js'
import { DEFAULT_API_BASE_URL, normalizeApiBaseUrl } from '../../apiBaseUrl.js'

const configuredBaseURL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL, DEFAULT_API_BASE_URL)
const useDevProxy = import.meta.env.DEV && /^https?:\/\//i.test(configuredBaseURL)
const baseURL = useDevProxy ? '/__api_proxy__' : configuredBaseURL

export const http = axios.create({
  baseURL,
  timeout: 15000
})

const refreshClient = axios.create({
  baseURL,
  timeout: 15000
})

let refreshRequest = null

function applyNoCacheHeaders(config) {
  config.headers = config.headers ?? {}

  if (!config.headers['Cache-Control']) {
    config.headers['Cache-Control'] = 'no-cache, no-store, max-age=0'
  }
  if (!config.headers.Pragma) {
    config.headers.Pragma = 'no-cache'
  }
  if (!config.headers.Expires) {
    config.headers.Expires = '0'
  }

  return config
}

function getAccessToken() {
  return storage.get(AUTH_STORAGE_KEYS.accessToken, null)
}

function getRefreshToken() {
  return storage.get(AUTH_STORAGE_KEYS.refreshToken, null)
}

function setAccessToken(token) {
  storage.set(AUTH_STORAGE_KEYS.accessToken, token)
}

function clearTokens() {
  storage.remove(AUTH_STORAGE_KEYS.accessToken)
  storage.remove(AUTH_STORAGE_KEYS.refreshToken)
}

async function refreshAccessToken() {
  if (!refreshRequest) {
    refreshRequest = refreshClient
      .get(endpoints.auth.refresh, {
        headers: {
          Authorization: `Bearer ${getRefreshToken()}`
        }
      })
      .then((response) => {
        const newToken = response.data?.access_token
        if (!newToken) throw new Error('Refresh token flow did not return a new access token.')
        setAccessToken(newToken)
        return newToken
      })
      .catch((error) => {
        clearTokens()
        throw error
      })
      .finally(() => {
        refreshRequest = null
      })
  }

  return refreshRequest
}

http.interceptors.request.use((config) => {
  applyNoCacheHeaders(config)
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

refreshClient.interceptors.request.use((config) => applyNoCacheHeaders(config))

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config ?? {}
    const status = error.response?.status
    const refreshToken = getRefreshToken()

    const isRefreshCall = originalRequest.url?.includes(endpoints.auth.refresh)
    const isLoginCall = originalRequest.url?.includes(endpoints.auth.login)

    if (status === 401 && refreshToken && !originalRequest._retry && !isRefreshCall && !isLoginCall) {
      originalRequest._retry = true
      const newAccessToken = await refreshAccessToken()
      originalRequest.headers = originalRequest.headers ?? {}
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return http(originalRequest)
    }

    return Promise.reject(error)
  }
)
