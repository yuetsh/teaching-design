import { sign, verify } from 'hono/jwt'

export interface AccessTokenPayload {
  userId: string
  role: string
}

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash)
}

export async function signAccessToken(
  userId: string,
  role: string,
  secret: string,
): Promise<string> {
  return sign(
    { userId, role, exp: Math.floor(Date.now() / 1000) + 15 * 60 },
    secret,
    'HS256',
  )
}

export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<AccessTokenPayload | null> {
  try {
    const payload = await verify(token, secret, 'HS256') as { userId: string; role: string }
    return { userId: payload.userId, role: payload.role }
  } catch {
    return null
  }
}

export function hashToken(token: string): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(token)
  return hasher.digest('hex')
}
