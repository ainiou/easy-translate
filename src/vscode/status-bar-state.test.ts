import { describe, expect, it } from 'vitest'
import {
  TOGGLE_STATUS_BAR_COMMAND,
  buildStatusBarPresentation,
} from './status-bar-state'

describe('状态栏开关展示', () => {
  it('开启状态只保留一个图标并使用高亮背景', () => {
    const presentation = buildStatusBarPresentation(true)
    expect(presentation.text).toBe('$(comment-discussion) ET')
    expect(presentation.text).toContain('ET')
    expect(presentation.backgroundKey).toBe('statusBarItem.prominentBackground')
    expect(presentation.foregroundKey).toBe('statusBarItem.prominentForeground')
    expect(presentation.accessibilityLabel).toBe('ET 划词翻译：已开启')
    expect(presentation.tooltip).toContain('点击关闭')
    expect(presentation.tooltip).not.toContain('**')
  })

  it('关闭状态使用贯穿斜线图标并回退到主题默认配色', () => {
    const presentation = buildStatusBarPresentation(false)
    expect(presentation.text).toBe('$(circle-slash) ET')
    expect(presentation.backgroundKey).toBeUndefined()
    expect(presentation.foregroundKey).toBeUndefined()
    expect(presentation.accessibilityLabel).toBe('ET 划词翻译：已关闭')
    expect(presentation.tooltip).toContain('点击开启')
    expect(presentation.tooltip).not.toContain('**')
  })

  it('两种状态的图标和提示可明确区分', () => {
    const enabled = buildStatusBarPresentation(true)
    const disabled = buildStatusBarPresentation(false)
    expect(enabled.text).not.toBe(disabled.text)
    expect(enabled.tooltip).not.toBe(disabled.tooltip)
    expect(TOGGLE_STATUS_BAR_COMMAND).toBe('selectionTranslator.toggleEnabled')
  })
})
