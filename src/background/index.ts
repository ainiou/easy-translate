import { translateWithEngine } from '../shared/translate'
import { hasEnginePermission } from '../shared/permissions'
import { getSettings } from '../shared/settings'
import type {
  BackgroundMessage,
  BackgroundResponse,
  EngineConfig,
} from '../shared/types'

function failure(error: unknown): BackgroundResponse {
  return {
    ok: false,
    error: error instanceof Error ? error.message : '翻译失败，请稍后重试',
  }
}

function isEngineConfig(value: unknown): value is EngineConfig {
  if (!value || typeof value !== 'object') return false
  const engine = value as Record<string, unknown>
  return (
    typeof engine.id === 'string' &&
    typeof engine.name === 'string' &&
    typeof engine.baseUrl === 'string' &&
    typeof engine.apiKey === 'string' &&
    typeof engine.model === 'string' &&
    Boolean(engine.name.trim()) &&
    Boolean(engine.baseUrl.trim()) &&
    Boolean(engine.model.trim())
  )
}

async function requestTranslation(
  engine: EngineConfig,
  text: string,
  targetLanguage: string,
): Promise<BackgroundResponse> {
  try {
    if (!(await hasEnginePermission(engine.baseUrl))) {
      return {
        ok: false,
        error: '缺少该翻译服务的主机权限，请在设置页重新保存引擎并授权',
      }
    }

    const translation = await translateWithEngine(engine, text, targetLanguage)
    return { ok: true, translation }
  } catch (error) {
    return failure(error)
  }
}

async function translate(text: string): Promise<BackgroundResponse> {
  if (!text.trim()) return { ok: false, error: '未检测到需要翻译的文本' }

  try {
    const settings = await getSettings()
    const engine = settings.engines.find(
      (candidate) => candidate.id === settings.defaultEngineId,
    )
    if (!engine) {
      return { ok: false, error: '尚未设置默认翻译引擎，请先打开扩展设置页添加引擎' }
    }

    return await requestTranslation(engine, text.trim(), settings.targetLanguage)
  } catch (error) {
    return failure(error)
  }
}

function handleMessage(message: BackgroundMessage): Promise<BackgroundResponse> {
  if (message.type === 'translate') {
    if (typeof message.text !== 'string') {
      return Promise.resolve({ ok: false, error: '翻译文本格式无效' })
    }
    return translate(message.text)
  }

  if (message.type === 'testEngine') {
    if (!isEngineConfig(message.engine)) {
      return Promise.resolve({ ok: false, error: '引擎配置不完整' })
    }
    return requestTranslation(message.engine, 'Hello', '简体中文')
  }

  return Promise.resolve({ ok: false, error: '不支持的消息类型' })
}

chrome.runtime.onMessage.addListener(
  (
    message: BackgroundMessage,
    _sender,
    sendResponse: (response: BackgroundResponse) => void,
  ) => {
    if (!message || typeof message !== 'object' || !('type' in message)) return false

    void handleMessage(message).then(sendResponse)
    return true
  },
)
