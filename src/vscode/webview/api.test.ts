import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createEmptyEngine } from '../../shared/engine-meta'
import type { SettingsResponse } from '../protocol'

type MessageListener = (event: MessageEvent<SettingsResponse>) => void

let messageListener: MessageListener | undefined
let postMessage: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.resetModules()
  messageListener = undefined
  postMessage = vi.fn()
  vi.stubGlobal('window', {
    addEventListener: vi.fn((_type: string, listener: MessageListener) => {
      messageListener = listener
    }),
  })
  vi.stubGlobal('acquireVsCodeApi', () => ({ postMessage }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('VS Code Webview 消息发送', () => {
  it('将 Vue 响应式引擎配置转换为可克隆数据', async () => {
    const api = await import('./api')
    const engine = reactive({
      ...createEmptyEngine('google-free'),
      id: '',
      name: 'Google',
    })
    const state = {
      engines: [],
      defaultEngineId: null,
      targetLanguage: '简体中文',
    }

    const pendingRequest = api.saveEngine(engine)
    expect(postMessage).toHaveBeenCalledOnce()
    const message = postMessage.mock.calls[0][0]
    expect(() => structuredClone(message)).not.toThrow()
    expect(message.engine).toMatchObject({ name: 'Google', type: 'google-free' })

    messageListener?.(
      new MessageEvent<SettingsResponse>('message', {
        data: { id: message.id, ok: true, state },
      }),
    )
    await expect(pendingRequest).resolves.toEqual(state)
  })
})
