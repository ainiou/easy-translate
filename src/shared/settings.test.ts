import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EngineConfig, ExtensionSettings } from './types'
import { getSettings, normalizeSettings, saveSettings } from './settings'

const firstEngine: EngineConfig = {
  id: 'first',
  name: 'First',
  type: 'openai-compatible',
  baseUrl: 'https://first.example.com/v1',
  apiKey: 'secret',
  model: 'model-a',
  appId: '',
  appSecret: '',
}

const secondEngine: EngineConfig = {
  id: 'second',
  name: 'Second',
  type: 'baidu',
  baseUrl: 'https://second.example.com',
  apiKey: '',
  model: '',
  appId: 'baidu-app',
  appSecret: 'baidu-secret',
}

let store: Record<string, unknown>

beforeEach(() => {
  store = {}
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: store[key] })),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(store, items)
        }),
      },
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('settings', () => {
  it('returns defaults when storage is empty', async () => {
    await expect(getSettings()).resolves.toEqual({
      engines: [],
      defaultEngineId: null,
      targetLanguage: '简体中文',
    })
  })

  it('falls back to the remaining engine when the default is deleted', async () => {
    const settings: ExtensionSettings = {
      engines: [firstEngine, secondEngine],
      defaultEngineId: firstEngine.id,
      targetLanguage: 'English',
    }
    await saveSettings(settings)

    await saveSettings({ ...settings, engines: [secondEngine] })

    const saved = store.settings as ExtensionSettings
    expect(saved.defaultEngineId).toBe(secondEngine.id)
    expect(saved.engines).toEqual([secondEngine])
  })

  it('normalizes missing fields and an invalid default engine', () => {
    const normalized = normalizeSettings({
      engines: [{ ...firstEngine, apiKey: undefined }],
      defaultEngineId: 'missing',
      targetLanguage: ' ',
    })

    expect(normalized).toEqual({
      engines: [{ ...firstEngine, apiKey: '' }],
      defaultEngineId: firstEngine.id,
      targetLanguage: '简体中文',
    })
    expect(normalized.engines[0]?.appId).toBe('')
    expect(normalized.engines[0]?.appSecret).toBe('')
  })
})
