import { md5 } from 'js-md5'
import {
  baiduTargetCode,
  deeplTargetCode,
  googleTargetCode,
  resolveTargetLanguageCode,
  youdaoTargetCode,
} from './language'
import { translateWithEngine as translateWithOpenAI } from './openai'
import { normalizeBaseUrl } from './permissions'
import type { EngineConfig } from './types'

const REQUEST_TIMEOUT_MS = 30_000

interface FetchResult {
  status: number
  text: string
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function fetchText(
  url: string,
  init: RequestInit,
  fetchImplementation: typeof fetch,
): Promise<FetchResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetchImplementation(url, {
      ...init,
      signal: controller.signal,
    })
    return { status: response.status, text: await response.text() }
  } catch (error) {
    if (isAbortError(error)) throw new Error('翻译请求超时，请稍后重试')
    throw new Error('无法连接翻译服务，请检查 Base URL 和网络连接')
  } finally {
    clearTimeout(timeout)
  }
}

function parseJson(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('翻译服务返回了无效 JSON')
  }
}

function getTargetCode(targetLanguage: string): string {
  const code = resolveTargetLanguageCode(targetLanguage)
  if (!code) {
    throw new Error('无法识别目标语言，请输入常用语言名称或语言代码，例如简体中文、English、en')
  }
  return code
}

function requireCredential(value: string | undefined, label: string): string {
  const trimmed = value?.trim()
  if (!trimmed) throw new Error(`请填写${label}`)
  return trimmed
}

async function translateWithYoudao(
  engine: EngineConfig,
  text: string,
  targetLanguage: string,
  fetchImplementation: typeof fetch,
): Promise<string> {
  const targetCode = youdaoTargetCode(getTargetCode(targetLanguage))
  const appKey = requireCredential(engine.appId, '有道 appKey')
  const appSecret = requireCredential(engine.appSecret, '有道 appSecret')
  const endpoint = `${normalizeBaseUrl(engine.baseUrl)}/api`
  const salt = crypto.randomUUID()
  const curtime = Math.floor(Date.now() / 1000).toString()
  const input = text.length > 20 ? `${text.slice(0, 10)}${text.length}${text.slice(-10)}` : text
  const sign = await sha256Hex(`${appKey}${input}${salt}${curtime}${appSecret}`)
  const body = new URLSearchParams({
    q: text,
    from: 'auto',
    to: targetCode,
    appKey,
    salt,
    sign,
    signType: 'v3',
    curtime,
  })

  const { status, text: responseText } = await fetchText(
    endpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
    fetchImplementation,
  )
  const data = parseJson(responseText) as Record<string, unknown>

  if (status !== 200 || (typeof data.errorCode === 'string' && data.errorCode !== '0')) {
    const message = typeof data.errorMsg === 'string' ? data.errorMsg : `HTTP ${status}`
    throw new Error(`有道翻译失败：${message}`)
  }

  const translation = Array.isArray(data.translation)
    ? data.translation
        .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
        .join('\n')
    : ''
  if (!translation) throw new Error('有道翻译返回了无法识别的响应')
  return translation
}

async function translateWithBaidu(
  engine: EngineConfig,
  text: string,
  targetLanguage: string,
  fetchImplementation: typeof fetch,
): Promise<string> {
  const targetCode = baiduTargetCode(getTargetCode(targetLanguage))
  const appId = requireCredential(engine.appId, '百度 appid')
  const secretKey = requireCredential(engine.appSecret, '百度 secretKey')
  const endpoint = `${normalizeBaseUrl(engine.baseUrl)}/api/trans/vip/translate`
  const salt = crypto.randomUUID()
  const sign = md5(`${appId}${text}${salt}${secretKey}`)
  const body = new URLSearchParams({
    q: text,
    from: 'auto',
    to: targetCode,
    appid: appId,
    salt,
    sign,
  })

  const { status, text: responseText } = await fetchText(
    endpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
    fetchImplementation,
  )
  const data = parseJson(responseText) as Record<string, unknown>

  if (status !== 200 || data.error_code) {
    const code = typeof data.error_code === 'string' || typeof data.error_code === 'number'
      ? String(data.error_code)
      : String(status)
    const message = typeof data.error_msg === 'string' ? data.error_msg : '未知错误'
    throw new Error(`百度翻译失败（${code}）：${message}`)
  }

  const translation = Array.isArray(data.trans_result)
    ? data.trans_result
        .map((item) =>
          item && typeof item === 'object' ? (item as Record<string, unknown>).dst : null,
        )
        .filter((item): item is string => typeof item === 'string')
        .join('\n')
    : ''
  if (!translation) throw new Error('百度翻译返回了无法识别的响应')
  return translation
}

async function translateWithDeepL(
  engine: EngineConfig,
  text: string,
  targetLanguage: string,
  fetchImplementation: typeof fetch,
): Promise<string> {
  const authKey = requireCredential(engine.apiKey, 'DeepL Auth Key')
  const endpoint = `${normalizeBaseUrl(engine.baseUrl)}/translate`
  const { status, text: responseText } = await fetchText(
    endpoint,
    {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${authKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        target_lang: deeplTargetCode(getTargetCode(targetLanguage)),
      }),
    },
    fetchImplementation,
  )
  const data = parseJson(responseText) as Record<string, unknown>

  if (status !== 200) {
    const message =
      data && typeof data.message === 'string' ? data.message : `HTTP ${status}`
    throw new Error(`DeepL 翻译失败：${message}`)
  }

  const translations = Array.isArray(data.translations) ? data.translations : []
  const translation = translations
    .map((item) =>
      item && typeof item === 'object' ? (item as Record<string, unknown>).text : null,
    )
    .filter((item): item is string => typeof item === 'string')
    .join('\n')
  if (!translation) throw new Error('DeepL 返回了无法识别的响应')
  return translation
}

async function translateWithGoogleOfficial(
  engine: EngineConfig,
  text: string,
  targetLanguage: string,
  fetchImplementation: typeof fetch,
): Promise<string> {
  const apiKey = requireCredential(engine.apiKey, 'Google API Key')
  const endpoint = `${normalizeBaseUrl(engine.baseUrl)}/language/translate/v2?key=${encodeURIComponent(apiKey)}`
  const { status, text: responseText } = await fetchText(
    endpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        target: googleTargetCode(getTargetCode(targetLanguage)),
        format: 'text',
      }),
    },
    fetchImplementation,
  )
  const data = parseJson(responseText) as Record<string, unknown>

  if (status !== 200) {
    const error = data && typeof data.error === 'object' ? (data.error as Record<string, unknown>) : null
    const message = error && typeof error.message === 'string' ? error.message : `HTTP ${status}`
    throw new Error(`Google 翻译失败：${message}`)
  }

  const root = data && typeof data.data === 'object' ? (data.data as Record<string, unknown>) : null
  const translations = root && Array.isArray(root.translations) ? root.translations : []
  const translation = translations
    .map((item) =>
      item && typeof item === 'object'
        ? (item as Record<string, unknown>).translatedText
        : null,
    )
    .filter((item): item is string => typeof item === 'string')
    .join('\n')
  if (!translation) throw new Error('Google 翻译返回了无法识别的响应')
  return translation
}

async function translateWithGoogleFree(
  engine: EngineConfig,
  text: string,
  targetLanguage: string,
  fetchImplementation: typeof fetch,
): Promise<string> {
  const target = encodeURIComponent(googleTargetCode(getTargetCode(targetLanguage)))
  const query = encodeURIComponent(text)
  const endpoint = `${normalizeBaseUrl(engine.baseUrl)}/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${query}`
  const { status, text: responseText } = await fetchText(
    endpoint,
    { method: 'GET' },
    fetchImplementation,
  )

  if (status !== 200) {
    throw new Error(`Google 免费端点请求失败（HTTP ${status}）`)
  }

  let data: unknown
  try {
    data = JSON.parse(responseText)
  } catch {
    throw new Error('Google 免费端点返回了无法识别的响应')
  }

  const segments = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : []
  const translation = segments
    .map((item) =>
      Array.isArray(item) && typeof item[0] === 'string' ? item[0] : null,
    )
    .filter((item): item is string => Boolean(item))
    .join('')
  if (!translation) throw new Error('Google 免费端点返回了无法识别的响应')
  return translation
}

export async function translateWithEngine(
  engine: EngineConfig,
  text: string,
  targetLanguage: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<string> {
  switch (engine.type) {
    case 'openai-compatible':
      return translateWithOpenAI(engine, text, targetLanguage, fetchImplementation)
    case 'youdao':
      return translateWithYoudao(engine, text, targetLanguage, fetchImplementation)
    case 'baidu':
      return translateWithBaidu(engine, text, targetLanguage, fetchImplementation)
    case 'deepl':
      return translateWithDeepL(engine, text, targetLanguage, fetchImplementation)
    case 'google-official':
      return translateWithGoogleOfficial(engine, text, targetLanguage, fetchImplementation)
    case 'google-free':
      return translateWithGoogleFree(engine, text, targetLanguage, fetchImplementation)
    default:
      throw new Error('不支持的翻译引擎类型')
  }
}
