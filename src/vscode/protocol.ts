import type { EngineEditPayload, PublicEngine } from './model'

export interface ExtensionViewState {
  engines: PublicEngine[]
  defaultEngineId: string | null
  targetLanguage: string
}

export type SettingsRequestPayload =
  | { type: 'getState' }
  | { type: 'saveEngine'; engine: EngineEditPayload }
  | { type: 'testEngine'; engine: EngineEditPayload }
  | { type: 'deleteEngine'; engineId: string }
  | { type: 'setDefaultEngine'; engineId: string }
  | { type: 'setTargetLanguage'; targetLanguage: string }

export type SettingsRequest = { id: number } & SettingsRequestPayload

export type SettingsResponse =
  | { id: number; ok: true; state?: ExtensionViewState; translation?: string }
  | { id: number; ok: false; error: string }
