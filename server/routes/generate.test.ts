import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { Hono } from 'hono'
import { createGenerateRouter } from './generate'

describe('generate route', () => {
  let originalFetch: typeof fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns 400 when topic is missing', async () => {
    const app = new Hono().route('/api/generate', createGenerateRouter('test-key'))

    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
  })

  it('returns 500 when DEEPSEEK_API_KEY is not configured', async () => {
    const app = new Hono().route('/api/generate', createGenerateRouter(undefined))

    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'CSS 弹性布局' }),
    })

    expect(res.status).toBe(500)
  })

  it('returns parsed markdown on success', async () => {
    globalThis.fetch = mock(async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: '# CSS 弹性布局 教学设计' } }] }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch

    const app = new Hono().route('/api/generate', createGenerateRouter('test-key'))
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'CSS 弹性布局' }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { filename: string; markdown: string }
    expect(body.filename).toBe('CSS 弹性布局.md')
    expect(body.markdown).toContain('# CSS 弹性布局 教学设计')
  })

  it('returns 502 when Deepseek responds with an error status', async () => {
    globalThis.fetch = mock(async () => new Response('', { status: 401 })) as unknown as typeof fetch

    const app = new Hono().route('/api/generate', createGenerateRouter('test-key'))
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'CSS 弹性布局' }),
    })

    expect(res.status).toBe(502)
  })

  it('returns 502 when fetch throws', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('network error')
    }) as unknown as typeof fetch

    const app = new Hono().route('/api/generate', createGenerateRouter('test-key'))
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'CSS 弹性布局' }),
    })

    expect(res.status).toBe(502)
  })

  it('returns 502 when Deepseek response has no content', async () => {
    globalThis.fetch = mock(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 })) as unknown as typeof fetch

    const app = new Hono().route('/api/generate', createGenerateRouter('test-key'))
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'CSS 弹性布局' }),
    })

    expect(res.status).toBe(502)
  })
})
