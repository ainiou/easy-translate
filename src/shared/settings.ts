import type { EngineConfig, EngineType, ExtensionSettings, HoldTriggerKey } from './types'

const ENGINE_TYPES: EngineType[] = [
  'openai-compatible',
  'youdao',
  'baidu',
  'deepl',
  'google-official',
  'google-free',
]

function isEngineType(value: unknown): value is EngineType {
  return typeof value === 'string' && ENGINE_TYPES.includes(value as EngineType)
}

const STORAGE_KEY = 'settings'
const DEFAULT_TARGET_LANGUAGE = '简体中文'
const HOLD_TRIGGER_KEYS: HoldTriggerKey[] = ['Alt', 'Control', 'Shift']

export const SETTINGS_STORAGE_KEY = STORAGE_KEY

function isHoldTriggerKey(value: unknown): value is HoldTriggerKey {
  return typeof value === 'string' && HOLD_TRIGGER_KEYS.includes(value as HoldTriggerKey)
}

export function createDefaultSettings(): ExtensionSettings {
  return {
    engines: [],
    defaultEngineId: null,
    targetLanguage: DEFAULT_TARGET_LANGUAGE,
    holdToTranslate: false,
    holdTriggerKey: 'Alt',
  }
}

function normalizeEngine(value: unknown): EngineConfig | null {
  if (!value || typeof value !== 'object') return null

  const engine = value as Record<string, unknown>
  if (
    typeof engine.id !== 'string' ||
    typeof engine.name !== 'string' ||
    !isEngineType(engine.type) ||
    typeof engine.baseUrl !== 'string' ||
    typeof engine.model !== 'string'
  ) {
    return null
  }

  return {
    id: engine.id,
    name: engine.name,
    type: engine.type,
    baseUrl: engine.baseUrl,
    apiKey: typeof engine.apiKey === 'string' ? engine.apiKey : '',
    model: engine.model,
    appId: typeof engine.appId === 'string' ? engine.appId : '',
    appSecret: typeof engine.appSecret === 'string' ? engine.appSecret : '',
  }
}

export function normalizeSettings(value: unknown): ExtensionSettings {
  if (!value || typeof value !== 'object') return createDefaultSettings()

  const settings = value as Record<string, unknown>
  const engines = Array.isArray(settings.engines)
    ? settings.engines
        .map(normalizeEngine)
        .filter((engine): engine is EngineConfig => engine !== null)
    : []
  const requestedDefaultId =
    typeof settings.defaultEngineId === 'string' ? settings.defaultEngineId : null
  const defaultEngineId = engines.some((engine) => engine.id === requestedDefaultId)
    ? requestedDefaultId
    : (engines[0]?.id ?? null)
  const targetLanguage =
    typeof settings.targetLanguage === 'string' && settings.targetLanguage.trim()
      ? settings.targetLanguage.trim()
      : DEFAULT_TARGET_LANGUAGE
  const holdToTranslate = settings.holdToTranslate === true
  const holdTriggerKey = isHoldTriggerKey(settings.holdTriggerKey)
    ? settings.holdTriggerKey
    : 'Alt'

  return {
    engines,
    defaultEngineId,
    targetLanguage,
    holdToTranslate,
    holdTriggerKey,
  }
}

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY)
  return normalizeSettings(stored[STORAGE_KEY])
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  const normalized = normalizeSettings(settings)
  await chrome.storage.local.set({ [STORAGE_KEY]: normalized })
}
