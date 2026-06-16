import { computed, ref } from 'vue'

export interface AuthUser {
  id: string
  username: string
  role: 'admin' | 'user'
}

export interface UserSummary extends AuthUser {
  createdAt: string
}

const accessToken = ref<string | null>(localStorage.getItem('access_token'))
const refreshToken = ref<string | null>(localStorage.getItem('refresh_token'))
const user = ref<AuthUser | null>(null)

export const isLoggedIn = computed(() => !!accessToken.value)

function clearTokens(): void {
  accessToken.value = null
  refreshToken.value = null
  user.value = null
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

async function doRefresh(): Promise<boolean> {
  if (!refreshToken.value) return false
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refreshToken.value }),
  })
  if (!res.ok) {
    clearTokens()
    return false
  }
  const body = (await res.json()) as { accessToken: string }
  accessToken.value = body.accessToken
  localStorage.setItem('access_token', body.accessToken)
  return true
}

export async function authedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) ?? {}),
  }
  if (accessToken.value) headers['Authorization'] = `Bearer ${accessToken.value}`

  let res = await fetch(path, { ...init, headers })

  if (res.status === 401) {
    const refreshed = await doRefresh()
    if (!refreshed) throw new Error('未登录')
    if (accessToken.value) headers['Authorization'] = `Bearer ${accessToken.value}`
    res = await fetch(path, { ...init, headers })
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `请求失败（${res.status}）`)
  }

  return res.json() as Promise<T>
}

export function useAuth() {
  async function login(username: string, password: string): Promise<void> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(body?.error ?? '登录失败')
    }
    const body = (await res.json()) as {
      accessToken: string
      refreshToken: string
      user: AuthUser
    }
    accessToken.value = body.accessToken
    refreshToken.value = body.refreshToken
    user.value = body.user
    localStorage.setItem('access_token', body.accessToken)
    localStorage.setItem('refresh_token', body.refreshToken)
  }

  async function logout(): Promise<void> {
    if (refreshToken.value) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshToken.value }),
      }).catch(() => {})
    }
    clearTokens()
  }

  async function fetchMe(): Promise<void> {
    if (!accessToken.value) return
    try {
      user.value = await authedFetch<AuthUser>('/api/auth/me')
    } catch {
      clearTokens()
    }
  }

  return { isLoggedIn, user, login, logout, fetchMe }
}
