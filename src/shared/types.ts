export type EngineType =
  | 'openai-compatible'
  | 'youdao'
  | 'baidu'
  | 'deepl'
  | 'google-official'
  | 'google-free'

export interface EngineConfig {
  id: string
  name: string
  type: EngineType
  baseUrl: string
  apiKey: string
  model: string
  appId?: string
  appSecret?: string
}

export interface ExtensionSettings {
  engines: EngineConfig[]
  defaultEngineId: string | null
  targetLanguage: string
}

export interface TranslateMessage {
  type: 'translate'
  text: string
}

export interface TestEngineMessage {
  type: 'testEngine'
  engine: EngineConfig
}

export type BackgroundMessage = TranslateMessage | TestEngineMessage

export type BackgroundResponse =
  | { ok: true; translation: string }
  | { ok: false; error: string }
