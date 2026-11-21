import { randomUUID } from 'node:crypto'
import * as vscode from 'vscode'
import { normalizeSettings } from '../shared/settings'
import { translateWithEngine } from '../shared/translate'
import type { EngineConfig } from '../shared/types'
import {
  errorMessage,
  resolveSecret,
  stripEngineSecrets,
  toPublicEngine,
  validateEngine,
} from './model'
import type { EngineEditPayload, StoredEngine } from './model'
import type { ExtensionViewState } from './protocol'

const ENGINES_KEY = 'selectionTranslator.engines'
const DEFAULT_ENGINE_KEY = 'selectionTranslator.defaultEngineId'
const API_KEY_PREFIX = 'selectionTranslator.apiKey.'
const APP_SECRET_PREFIX = 'selectionTranslator.appSecret.'
const DEFAULT_TARGET_LANGUAGE = '简体中文'

export class EngineStore {
  constructor(private readonly context: vscode.ExtensionContext) {}

  private readStoredEngines(): StoredEngine[] {
    const engines = this.context.globalState.get<unknown>(ENGINES_KEY, [])
    const defaultEngineId = this.context.globalState.get<string>(DEFAULT_ENGINE_KEY, '')
    return normalizeSettings({
      engines,
      defaultEngineId,
      targetLanguage: DEFAULT_TARGET_LANGUAGE,
    }).engines.map(stripEngineSecrets)
  }

  private getDefaultEngineId(engines: StoredEngine[]): string | null {
    const requested = this.context.globalState.get<string>(DEFAULT_ENGINE_KEY, '')
    return engines.some((engine) => engine.id === requested)
      ? requested
      : (engines[0]?.id ?? null)
  }

  private async withSecrets(engine: StoredEngine): Promise<EngineConfig> {
    try {
      const [apiKey, appSecret] = await Promise.all([
        this.context.secrets.get(`${API_KEY_PREFIX}${engine.id}`),
        this.context.secrets.get(`${APP_SECRET_PREFIX}${engine.id}`),
      ])
      return {
        ...engine,
        apiKey: apiKey ?? '',
        appSecret: appSecret ?? '',
      }
    } catch (error) {
      throw new Error(
        `读取引擎“${engine.name}”的密钥失败（VS Code SecretStorage）：${errorMessage(error)}`,
        { cause: error },
      )
    }
  }

  private async updateSecret(key: string, value: string, label: string): Promise<void> {
    try {
      if (value) {
        await this.context.secrets.store(key, value)
      } else {
        await this.context.secrets.delete(key)
      }
    } catch (error) {
      throw new Error(
        `${value ? '保存' : '清除'}${label}失败（VS Code SecretStorage）：${errorMessage(error)}`,
        { cause: error },
      )
    }
  }

  private async resolveEngine(payload: EngineEditPayload): Promise<EngineConfig> {
    const id = payload.id.trim() || randomUUID()
    const stored = this.readStoredEngines().find((engine) => engine.id === id)
    const existing = stored ? await this.withSecrets(stored) : null
    const sameType = existing?.type === payload.type ? existing : null

    return validateEngine({
      id,
      name: payload.name,
      type: payload.type,
      baseUrl: payload.baseUrl,
      model: payload.model,
      appId: payload.appId,
      apiKey: resolveSecret(payload.apiKey, sameType?.apiKey ?? '', payload.clearApiKey),
      appSecret: resolveSecret(
        payload.appSecret ?? '',
        sameType?.appSecret ?? '',
        payload.clearAppSecret,
      ),
    })
  }

  async getEngine(engineId: string): Promise<EngineConfig | null> {
    const engine = this.readStoredEngines().find((item) => item.id === engineId)
    return engine ? this.withSecrets(engine) : null
  }

  async getDefaultEngine(): Promise<EngineConfig | null> {
    const engines = this.readStoredEngines()
    const defaultEngineId = this.getDefaultEngineId(engines)
    return defaultEngineId ? this.getEngine(defaultEngineId) : null
  }

  getTargetLanguage(): string {
    const configured = vscode.workspace
      .getConfiguration('selectionTranslator')
      .get<string>('targetLanguage', DEFAULT_TARGET_LANGUAGE)
    return configured.trim() || DEFAULT_TARGET_LANGUAGE
  }

  async setTargetLanguage(targetLanguage: string): Promise<ExtensionViewState> {
    const normalized = targetLanguage.trim()
    if (!normalized) throw new Error('目标语言不能为空')
    await vscode.workspace
      .getConfiguration('selectionTranslator')
      .update('targetLanguage', normalized, vscode.ConfigurationTarget.Global)
    return this.getState()
  }

  async getState(): Promise<ExtensionViewState> {
    const storedEngines = this.readStoredEngines()
    const engines = await Promise.all(
      storedEngines.map(async (engine) => {
        const withSecrets = await this.withSecrets(engine)
        return toPublicEngine(
          engine,
          Boolean(withSecrets.apiKey),
          Boolean(withSecrets.appSecret),
        )
      }),
    )
    return {
      engines,
      defaultEngineId: this.getDefaultEngineId(storedEngines),
      targetLanguage: this.getTargetLanguage(),
    }
  }

  async saveEngine(payload: EngineEditPayload): Promise<ExtensionViewState> {
    const engine = await this.resolveEngine(payload)
    const storedEngine = stripEngineSecrets(engine)
    const engines = this.readStoredEngines()
    const index = engines.findIndex((item) => item.id === engine.id)
    if (index >= 0) {
      engines[index] = storedEngine
    } else {
      engines.push(storedEngine)
    }

    await this.updateSecret(`${API_KEY_PREFIX}${engine.id}`, engine.apiKey, 'API Key')
    await this.updateSecret(
      `${APP_SECRET_PREFIX}${engine.id}`,
      engine.appSecret ?? '',
      'appSecret',
    )

    try {
      await this.context.globalState.update(ENGINES_KEY, engines)
      await this.context.globalState.update(
        DEFAULT_ENGINE_KEY,
        this.getDefaultEngineId(engines),
      )
    } catch (error) {
      throw new Error(`写入引擎列表失败（VS Code globalState）：${errorMessage(error)}`, {
        cause: error,
      })
    }
    return this.getState()
  }

  async testEngine(payload: EngineEditPayload): Promise<string> {
    const engine = await this.resolveEngine(payload)
    return translateWithEngine(engine, 'Hello', this.getTargetLanguage())
  }

  async deleteEngine(engineId: string): Promise<ExtensionViewState> {
    const engines = this.readStoredEngines().filter((engine) => engine.id !== engineId)
    await this.context.globalState.update(ENGINES_KEY, engines)
    await this.context.globalState.update(
      DEFAULT_ENGINE_KEY,
      this.getDefaultEngineId(engines),
    )
    await Promise.all([
      this.context.secrets.delete(`${API_KEY_PREFIX}${engineId}`),
      this.context.secrets.delete(`${APP_SECRET_PREFIX}${engineId}`),
    ])
    return this.getState()
  }

  async setDefaultEngine(engineId: string): Promise<ExtensionViewState> {
    if (!this.readStoredEngines().some((engine) => engine.id === engineId)) {
      throw new Error('翻译引擎不存在')
    }
    await this.context.globalState.update(DEFAULT_ENGINE_KEY, engineId)
    return this.getState()
  }
}
