import { normalizeBaseUrl } from '../shared/permissions'
import type { EngineConfig } from '../shared/types'

export type StoredEngine = Omit<EngineConfig, 'apiKey' | 'appSecret'>

export interface EngineEditPayload extends EngineConfig {
  clearApiKey?: boolean
  clearAppSecret?: boolean
}

export interface PublicEngine extends StoredEngine {
  hasApiKey: boolean
  hasAppSecret: boolean
}

export function resolveSecret(input: string, current: string, clear = false): string {
  if (clear) return ''
  return input.trim() || current
}

export function stripEngineSecrets(engine: EngineConfig): StoredEngine {
  return {
    id: engine.id,
    name: engine.name,
    type: engine.type,
    baseUrl: engine.baseUrl,
    model: engine.model,
    appId: engine.appId ?? '',
  }
}

export function toPublicEngine(
  engine: StoredEngine,
  hasApiKey: boolean,
  hasAppSecret: boolean,
): PublicEngine {
  return { ...engine, hasApiKey, hasAppSecret }
}

export function validateEngine(engine: EngineConfig): EngineConfig {
  const name = engine.name.trim()
  if (!name) throw new Error('请填写引擎名称')

  const normalized: EngineConfig = {
    id: engine.id,
    name,
    type: engine.type,
    baseUrl: normalizeBaseUrl(engine.baseUrl),
    apiKey: engine.apiKey.trim(),
    model: engine.model.trim(),
    appId: engine.appId?.trim() ?? '',
    appSecret: engine.appSecret?.trim() ?? '',
  }

  switch (normalized.type) {
    case 'openai-compatible':
      if (!normalized.model) throw new Error('请填写模型名称')
      break
    case 'youdao':
      if (!normalized.appId || !normalized.appSecret) {
        throw new Error('请填写有道 appKey 和 appSecret')
      }
      break
    case 'baidu':
      if (!normalized.appId || !normalized.appSecret) {
        throw new Error('请填写百度 appid 和 secretKey')
      }
      break
    case 'deepl':
      if (!normalized.apiKey) throw new Error('请填写 DeepL Auth Key')
      break
    case 'google-official':
      if (!normalized.apiKey) throw new Error('请填写 Google API Key')
      break
    default:
      break
  }

  return normalized
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  if (typeof error === 'string' && error.trim()) return error.trim()

  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>
    if (typeof value.message === 'string' && value.message.trim()) {
      return value.message.trim()
    }

    const name = typeof value.name === 'string' ? value.name.trim() : ''
    const code =
      typeof value.code === 'string' || typeof value.code === 'number'
        ? String(value.code)
        : ''
    if (name && code) return `${name}（错误码：${code}）`
    if (code) return `错误码：${code}`
    if (name) return name

    try {
      return `未知错误：${JSON.stringify(error)}`
    } catch {
      return '未知错误：异常对象无法序列化，请查看扩展宿主日志'
    }
  }

  return `未知错误：${String(error)}，请查看扩展宿主日志`
}
