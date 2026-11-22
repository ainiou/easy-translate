import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => {
  const counters = { textWrites: 0 }
  const item = {
    innerText: '',
    get text() {
      return this.innerText
    },
    set text(value: string) {
      this.innerText = value
      counters.textWrites += 1
    },
    tooltip: '',
    command: '',
    accessibilityInformation: undefined as { label: string } | undefined,
    backgroundColor: undefined as { id: string } | undefined,
    color: undefined as { id: string } | undefined,
    show: vi.fn(),
    dispose: vi.fn(),
  }
  return {
    config: { autoTranslate: true } as Record<string, unknown>,
    updates: [] as Array<{ key: string; value: unknown }>,
    messages: [] as string[],
    counters,
    item,
  }
})

vi.mock('vscode', () => ({
  StatusBarAlignment: { Left: 1, Right: 2 },
  ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
  ThemeColor: class {
    constructor(readonly id: string) {}
  },
  window: {
    createStatusBarItem: () => state.item,
    setStatusBarMessage: (message: string) => {
      state.messages.push(message)
    },
    showErrorMessage: vi.fn(),
  },
  workspace: {
    getConfiguration: () => ({
      get: (key: string, fallback: unknown) => state.config[key] ?? fallback,
      update: async (key: string, value: unknown) => {
        state.updates.push({ key, value })
        state.config[key] = value
      },
    }),
    onDidChangeConfiguration: () => ({ dispose: () => {} }),
  },
}))

const { TranslationStatusBar } = await import('./status-bar')
const { TOGGLE_STATUS_BAR_COMMAND } = await import('./status-bar-state')

beforeEach(() => {
  state.config.autoTranslate = true
  state.updates.length = 0
  state.messages.length = 0
  state.item.innerText = ''
  state.item.command = ''
  state.item.tooltip = ''
  state.item.accessibilityInformation = undefined
  state.item.backgroundColor = undefined
  state.item.color = undefined
  state.item.show.mockClear()
  state.counters.textWrites = 0
})

describe('状态栏开关交互', () => {
  it('初始化按当前配置渲染单个开启图标', () => {
    const statusBar = new TranslationStatusBar()
    expect(state.item.text).toBe('$(comment-discussion) ET')
    expect(state.item.text).toContain('ET')
    expect(state.item.command).toBe(TOGGLE_STATUS_BAR_COMMAND)
    expect(state.item.backgroundColor?.id).toBe('statusBarItem.prominentBackground')
    expect(state.item.accessibilityInformation?.label).toBe('ET 划词翻译：已开启')
    expect(state.item.show).toHaveBeenCalled()
    statusBar.dispose()
  })

  it('点击关闭后持久化配置、切换斜线图标并关闭当前浮窗', async () => {
    const onDisable = vi.fn()
    const statusBar = new TranslationStatusBar(onDisable)

    await statusBar.toggle()

    expect(state.updates).toEqual([{ key: 'autoTranslate', value: false }])
    expect(state.config.autoTranslate).toBe(false)
    expect(state.item.text).toBe('$(circle-slash) ET')
    expect(state.item.backgroundColor).toBeUndefined()
    expect(state.item.accessibilityInformation?.label).toBe('ET 划词翻译：已关闭')
    expect(state.item.tooltip).toContain('点击开启')
    expect(onDisable).toHaveBeenCalledTimes(1)
    expect(state.messages.at(-1)).toBe('ET：划词翻译已关闭')
    statusBar.dispose()
  })

  it('再次点击恢复开启并同步展示', async () => {
    const statusBar = new TranslationStatusBar()
    await statusBar.toggle()
    await statusBar.toggle()

    expect(state.config.autoTranslate).toBe(true)
    expect(state.item.text).toBe('$(comment-discussion) ET')
    expect(state.messages.at(-1)).toBe('ET：划词翻译已开启')
    statusBar.dispose()
  })

  it('初始为关闭时展示斜线图标且不执行关闭回调', async () => {
    state.config.autoTranslate = false
    const onDisable = vi.fn()
    const statusBar = new TranslationStatusBar(onDisable)
    expect(state.item.text).toBe('$(circle-slash) ET')
    expect(state.item.backgroundColor).toBeUndefined()

    await statusBar.toggle()
    expect(state.config.autoTranslate).toBe(true)
    expect(state.item.text).toBe('$(comment-discussion) ET')
    expect(onDisable).not.toHaveBeenCalled()
    statusBar.dispose()
  })

  it('状态未变化时不重复重写图标，避免闪烁', async () => {
    const statusBar = new TranslationStatusBar()
    expect(state.counters.textWrites).toBe(1)

    statusBar.refresh()
    statusBar.refresh()
    expect(state.counters.textWrites).toBe(1)

    await statusBar.toggle()
    expect(state.counters.textWrites).toBe(2)
    statusBar.dispose()
  })
})
