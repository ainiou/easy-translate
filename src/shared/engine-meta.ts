import type { EngineConfig, EngineType } from './types'

export interface EngineTypeOption {
  value: EngineType
  label: string
  description: string
  baseUrl: string
  apiKeyPlaceholder: string
  appIdLabel: string
  appSecretLabel: string
}

export const ENGINE_TYPES: readonly EngineTypeOption[] = [
  {
    value: 'openai-compatible',
    label: 'OpenAI 兼容接口',
    description: '适用于 OpenAI、DeepSeek、OpenRouter 或本地兼容服务。',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyPlaceholder: '服务需要鉴权时填写',
    appIdLabel: '应用 ID',
    appSecretLabel: '应用密钥',
  },
  {
    value: 'youdao',
    label: '有道官方 API',
    description: '有道智云翻译 API，需要 appKey 与 appSecret 并使用签名。',
    baseUrl: 'https://openapi.youdao.com',
    apiKeyPlaceholder: '不使用',
    appIdLabel: '应用 ID（appKey）',
    appSecretLabel: '应用密钥（appSecret）',
  },
  {
    value: 'baidu',
    label: '百度翻译 API',
    description: '百度翻译开放平台，需要 appid 与 secretKey 并使用签名。',
    baseUrl: 'https://fanyi-api.baidu.com',
    apiKeyPlaceholder: '不使用',
    appIdLabel: '应用 ID（appid）',
    appSecretLabel: '密钥（secretKey）',
  },
  {
    value: 'deepl',
    label: 'DeepL API',
    description: 'DeepL 官方翻译接口，需要 Auth Key；免费版可修改 Base URL。',
    baseUrl: 'https://api.deepl.com/v2',
    apiKeyPlaceholder: 'DeepL Auth Key',
    appIdLabel: '应用 ID',
    appSecretLabel: '应用密钥',
  },
  {
    value: 'google-official',
    label: 'Google 官方 API',
    description: 'Google Cloud Translation API v2，需要 API Key，需在 Google Cloud 启用接口。',
    baseUrl: 'https://translation.googleapis.com',
    apiKeyPlaceholder: 'Google Cloud API Key',
    appIdLabel: '应用 ID',
    appSecretLabel: '应用密钥',
  },
  {
    value: 'google-free',
    label: 'Google 免费端点（非官方）',
    description: '使用 Google 公共翻译端点，无需密钥，但稳定性和可用性不保证。',
    baseUrl: 'https://translate.googleapis.com',
    apiKeyPlaceholder: '无需密钥',
    appIdLabel: '应用 ID',
    appSecretLabel: '应用密钥',
  },
]

export function getEngineTypeOption(type: EngineType): EngineTypeOption {
  return ENGINE_TYPES.find((option) => option.value === type) ?? ENGINE_TYPES[0]
}

export function getEngineTypeLabel(type: EngineType): string {
  return getEngineTypeOption(type).label
}

export function createEmptyEngine(type: EngineType = 'openai-compatible'): EngineConfig {
  const option = getEngineTypeOption(type)
  return {
    id: '',
    name: '',
    type,
    baseUrl: option.baseUrl,
    apiKey: '',
    model: '',
    appId: '',
    appSecret: '',
  }
}
