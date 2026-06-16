import { afterEach, describe, expect, it, setSystemTime } from 'bun:test'
import { hashPassword, hashToken, signAccessToken, verifyAccessToken, verifyPassword } from './auth'

afterEach(() => {
  setSystemTime()
})

describe('auth utilities', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('secret123')
    expect(await verifyPassword('secret123', hash)).toBe(true)
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })

  it('signs and verifies an access token', async () => {
    const token = await signAccessToken('user1', 'admin', 'mysecret')
    const payload = await verifyAccessToken(token, 'mysecret')
    expect(payload).toEqual({ userId: 'user1', role: 'admin' })
  })

  it('returns null for an expired access token', async () => {
    setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    const token = await signAccessToken('user1', 'user', 'mysecret')

    setSystemTime(new Date('2026-01-01T00:16:00.000Z'))
    const payload = await verifyAccessToken(token, 'mysecret')
    expect(payload).toBeNull()
  })

  it('returns null for an access token with wrong secret', async () => {
    const token = await signAccessToken('user1', 'user', 'mysecret')
    const payload = await verifyAccessToken(token, 'wrongsecret')
    expect(payload).toBeNull()
  })

  it('hashToken is deterministic and returns 64-char hex', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'))
    expect(hashToken('abc')).not.toBe(hashToken('xyz'))
    expect(hashToken('abc')).toMatch(/^[0-9a-f]{64}$/)
  })
})
