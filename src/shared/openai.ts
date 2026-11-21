import { normalizeBaseUrl } from './permissions'
import type { EngineConfig } from './types'

const REQUEST_TIMEOUT_MS = 30_000

function getApiErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const error = (data as Record<string, unknown>).error
  if (!error || typeof error !== 'object') return null
  const message = (error as Record<string, unknown>).message
  return typeof message === 'string' && message.trim() ? message.trim() : null
}

function getTranslation(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const choices = (data as Record<string, unknown>).choices
  if (!Array.isArray(choices) || choices.length === 0) return null

  const firstChoice = choices[0]
  if (!firstChoice || typeof firstChoice !== 'object') return null
  const message = (firstChoice as Record<string, unknown>).message
  if (!message || typeof message !== 'object') return null
  const content = (message as Record<string, unknown>).content
  return typeof content === 'string' && content.trim() ? content.trim() : null
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

export async function translateWithEngine(
  engine: EngineConfig,
  text: string,
  targetLanguage: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<string> {
  const endpoint = `${normalizeBaseUrl(engine.baseUrl)}/chat/completions`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (engine.apiKey.trim()) {
    headers.Authorization = `Bearer ${engine.apiKey.trim()}`
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    let response: Response
    try {
      response = await fetchImplementation(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: engine.model,
          stream: false,
          messages: [
            {
              role: 'system',
              content: `You are a professional English-Chinese bidirectional translation engine. Detect the source language automatically. Translate English into Simplified Chinese, and translate Chinese into English. If the source text is neither English nor Chinese, translate it into ${targetLanguage}. Preserve the original meaning and basic line breaks. Return only the translated text without explanations.`,
            },
            { role: 'user', content: text },
          ],
        }),
        signal: controller.signal,
      })
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error('翻译请求超时，请稍后重试')
      }
      throw new Error('无法连接翻译服务，请检查 Base URL 和网络连接')
    }

    const responseText = await response.text()
    let data: unknown = null
    if (responseText) {
      try {
        data = JSON.parse(responseText)
      } catch {
        if (response.ok) throw new Error('翻译服务返回了无效 JSON')
      }
    }

    if (!response.ok) {
      const apiMessage = getApiErrorMessage(data)
      throw new Error(
        `翻译服务返回错误（HTTP ${response.status}）${apiMessage ? `：${apiMessage}` : ''}`,
      )
    }

    const translation = getTranslation(data)
    if (!translation) throw new Error('翻译服务返回了无法识别的响应')
    return translation
  } finally {
    clearTimeout(timeout)
  }
}
