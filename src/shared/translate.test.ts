import { describe, expect, it, vi } from 'vitest'
import { md5 } from 'js-md5'
import { translateWithEngine } from './translate'
import type { EngineConfig } from './types'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function formParams(init: RequestInit | undefined): URLSearchParams {
  return new URLSearchParams(String(init?.body ?? ''))
}

describe('translateWithEngine providers', () => {
  it('translates with Youdao using signature and form parameters', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ errorCode: '0', translation: ['你好'] }),
    )
    const engine: EngineConfig = {
      id: 'youdao',
      name: 'Youdao',
      type: 'youdao',
      baseUrl: 'https://openapi.youdao.com',
      apiKey: '',
      model: '',
      appId: 'app-key',
      appSecret: 'app-secret',
    }

    await expect(
      translateWithEngine(engine, 'Hello', '简体中文', fetchMock),
    ).resolves.toBe('你好')

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://openapi.youdao.com/api')
    const params = formParams(init)
    expect(params.get('q')).toBe('Hello')
    expect(params.get('to')).toBe('zh-CHS')
    expect(params.get('appKey')).toBe('app-key')
    expect(params.get('signType')).toBe('v3')
    expect(params.get('sign')).toHaveLength(64)
  })

  it('translates with Baidu and validates its md5 signature', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ trans_result: [{ src: 'Hello', dst: '你好' }] }),
    )
    const engine: EngineConfig = {
      id: 'baidu',
      name: 'Baidu',
      type: 'baidu',
      baseUrl: 'https://fanyi-api.baidu.com',
      apiKey: '',
      model: '',
      appId: 'baidu-app',
      appSecret: 'baidu-secret',
    }

    await expect(
      translateWithEngine(engine, 'Hello', 'English', fetchMock),
    ).resolves.toBe('你好')

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://fanyi-api.baidu.com/api/trans/vip/translate')
    const params = formParams(init)
    expect(params.get('to')).toBe('en')
    expect(params.get('sign')).toBe(md5(`baidu-appHello${params.get('salt')}baidu-secret`))
  })

  it('translates with DeepL using the auth key header', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ translations: [{ text: '你好' }] }),
    )
    const engine: EngineConfig = {
      id: 'deepl',
      name: 'DeepL',
      type: 'deepl',
      baseUrl: 'https://api.deepl.com/v2',
      apiKey: 'auth-key',
      model: '',
    }

    await expect(
      translateWithEngine(engine, 'Hello', '简体中文', fetchMock),
    ).resolves.toBe('你好')

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.deepl.com/v2/translate')
    expect(init?.headers).toMatchObject({ Authorization: 'DeepL-Auth-Key auth-key' })
    expect(JSON.parse(String(init?.body))).toMatchObject({ target_lang: 'ZH' })
  })

  it('translates with Google official API v2', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ data: { translations: [{ translatedText: '你好' }] } }),
    )
    const engine: EngineConfig = {
      id: 'google',
      name: 'Google',
      type: 'google-official',
      baseUrl: 'https://translation.googleapis.com',
      apiKey: 'google-key',
      model: '',
    }

    await expect(
      translateWithEngine(engine, 'Hello', '简体中文', fetchMock),
    ).resolves.toBe('你好')

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('https://translation.googleapis.com/language/translate/v2')
    expect(url).toContain('key=google-key')
    expect(JSON.parse(String(init?.body))).toMatchObject({ target: 'zh-CN', format: 'text' })
  })

  it('translates with the unofficial Google free endpoint', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([[['你好', 'Hello', null, null, 1]]]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const engine: EngineConfig = {
      id: 'google-free',
      name: 'Google Free',
      type: 'google-free',
      baseUrl: 'https://translate.googleapis.com',
      apiKey: '',
      model: '',
    }

    await expect(
      translateWithEngine(engine, 'Hello', 'English', fetchMock),
    ).resolves.toBe('你好')

    const [url] = fetchMock.mock.calls[0]!
    expect(url).toContain('client=gtx')
    expect(url).toContain('tl=en')
    expect(url).toContain('q=Hello')
  })

  it('rejects unsupported target language text', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    const engine: EngineConfig = {
      id: 'google-free',
      name: 'Google Free',
      type: 'google-free',
      baseUrl: 'https://translate.googleapis.com',
      apiKey: '',
      model: '',
    }

    await expect(
      translateWithEngine(engine, 'Hello', '火星文', fetchMock),
    ).rejects.toThrow('无法识别目标语言')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
