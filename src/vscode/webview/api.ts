import type { EngineEditPayload } from '../model'
import type {
  ExtensionViewState,
  SettingsRequestPayload,
  SettingsResponse,
} from '../protocol'

interface VsCodeApi {
  postMessage(message: unknown): void
}

declare function acquireVsCodeApi(): VsCodeApi

type SuccessResponse = Extract<SettingsResponse, { ok: true }>

const vscode = acquireVsCodeApi()
let nextId = 0
const pending = new Map<
  number,
  { resolve: (response: SuccessResponse) => void; reject: (error: Error) => void }
>()

window.addEventListener('message', (event: MessageEvent<SettingsResponse>) => {
  const response = event.data
  const request = pending.get(response.id)
  if (!request) return
  pending.delete(response.id)
  if (response.ok) {
    request.resolve(response)
  } else {
    request.reject(new Error(response.error))
  }
})

function send(payload: SettingsRequestPayload): Promise<SuccessResponse> {
  const id = ++nextId
  return new Promise<SuccessResponse>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    try {
      // Vue 的响应式 Proxy 不能通过 MessagePort 结构化克隆，先转换为普通 JSON 数据。
      const message = JSON.parse(JSON.stringify({ id, ...payload })) as unknown
      vscode.postMessage(message)
    } catch (error) {
      pending.delete(id)
      reject(error instanceof Error ? error : new Error(String(error)))
    }
  })
}

function requireState(response: SuccessResponse): ExtensionViewState {
  if (!response.state) throw new Error('扩展返回了无效的设置数据')
  return response.state
}

export async function getState(): Promise<ExtensionViewState> {
  return requireState(await send({ type: 'getState' }))
}

export async function saveEngine(engine: EngineEditPayload): Promise<ExtensionViewState> {
  return requireState(await send({ type: 'saveEngine', engine }))
}

export async function testEngine(engine: EngineEditPayload): Promise<string> {
  const response = await send({ type: 'testEngine', engine })
  if (typeof response.translation !== 'string') throw new Error('扩展返回了无效的测试结果')
  return response.translation
}

export async function deleteEngine(engineId: string): Promise<ExtensionViewState> {
  return requireState(await send({ type: 'deleteEngine', engineId }))
}

export async function setDefaultEngine(engineId: string): Promise<ExtensionViewState> {
  return requireState(await send({ type: 'setDefaultEngine', engineId }))
}

export async function setTargetLanguage(targetLanguage: string): Promise<ExtensionViewState> {
  return requireState(await send({ type: 'setTargetLanguage', targetLanguage }))
}
