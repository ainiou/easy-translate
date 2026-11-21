import { describe, expect, it, vi } from 'vitest'
import { translateWithEngine } from './openai'
import type { EngineConfig } from './types'

const engine: EngineConfig = {
  id: 'engine',
  name: 'Test engine',
  type: 'openai-compatible',
  baseUrl: 'https://api.example.com/v1/',
  apiKey: 'test-key',
  model: 'test-model',
  appId: '',
  appSecret: '',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('translateWithEngine', () => {
  it('builds an OpenAI-compatible request and parses the translation', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: ' 你好 ' } }] }),
    )

    await expect(
      translateWithEngine(engine, 'Hello', '简体中文', fetchMock),
    ).resolves.toBe('你好')

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.example.com/v1/chat/completions')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-key',
    })

    const body = JSON.parse(String(init?.body)) as {
      model: string
      stream: boolean
      messages: Array<{ role: string; content: string }>
    }
    expect(body.model).toBe('test-model')
    expect(body.stream).toBe(false)
    expect(body.messages[0]?.content).toContain('简体中文')
    expect(body.messages[1]).toEqual({ role: 'user', content: 'Hello' })
  })

  it('omits Authorization when the API key is empty', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: '你好' } }] }),
    )

    await translateWithEngine({ ...engine, apiKey: '' }, 'Hello', '简体中文', fetchMock)

    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      'Content-Type': 'application/json',
    })
  })

  it('surfaces standard API errors with the HTTP status', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ error: { message: 'Invalid API key' } }, 401),
    )

    await expect(
      translateWithEngine(engine, 'Hello', '简体中文', fetchMock),
    ).rejects.toThrow('翻译服务返回错误（HTTP 401）：Invalid API key')
  })

  it('rejects invalid JSON and unrecognized successful responses', async () => {
    const invalidJsonFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('not json', { status: 200 }),
    )
    await expect(
      translateWithEngine(engine, 'Hello', '简体中文', invalidJsonFetch),
    ).rejects.toThrow('无效 JSON')

    const invalidShapeFetch = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}))
    await expect(
      translateWithEngine(engine, 'Hello', '简体中文', invalidShapeFetch),
    ).rejects.toThrow('无法识别')
  })

  it('returns a readable error when the network is unavailable', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(
      translateWithEngine(engine, 'Hello', '简体中文', fetchMock),
    ).rejects.toThrow('无法连接翻译服务')
  })
})
