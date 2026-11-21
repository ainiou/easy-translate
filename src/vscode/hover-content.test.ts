import { describe, expect, it } from 'vitest'
import {
  alternateTargetLanguage,
  buildHoverContent,
  HOVER_COMMANDS,
} from './hover-content'

describe('VS Code 悬浮翻译内容', () => {
  it('加载时使用原生旋转图标', () => {
    const content = buildHoverContent({
      status: 'loading',
      engineName: '本地 Ollama',
      targetLanguage: '简体中文',
      pinned: false,
    })
    expect(content).toContain('$(loading~spin)')
    expect(content).toContain('本地 Ollama')
  })

  it('结果包含复制、切换语言、固定和替换操作', () => {
    const content = buildHoverContent({
      status: 'success',
      engineName: 'Ollama',
      targetLanguage: '简体中文',
      translation: '你好\nHello',
      pinned: false,
    })
    expect(content).toContain('你好  \nHello')
    expect(content).toContain('$(copy) 复制')
    expect(content).toContain('译为English')
    expect(content).toContain('固定浮窗')
    expect(content).toContain('替换原文')
    expect(HOVER_COMMANDS).toContain('selectionTranslator.copyHoverTranslation')
  })

  it('固定后允许取消固定并切换回中文', () => {
    const content = buildHoverContent({
      status: 'success',
      engineName: 'Ollama',
      targetLanguage: 'English',
      translation: 'Hello',
      pinned: true,
    })
    expect(content).toContain('取消固定')
    expect(content).toContain('译为简体中文')
    expect(alternateTargetLanguage('zh-CN')).toBe('English')
    expect(alternateTargetLanguage('English')).toBe('简体中文')
  })

  it('在浮窗内显示友好错误及设置入口', () => {
    const content = buildHoverContent({
      status: 'error',
      engineName: '默认引擎',
      targetLanguage: '简体中文',
      error: '无法连接翻译服务',
      pinned: false,
    })
    expect(content).toContain('$(error) 无法连接翻译服务')
    expect(content).toContain('command:selectionTranslator.manageEngines')
  })

  it('将译文作为纯文本渲染，避免注入 Markdown 命令链接', () => {
    const content = buildHoverContent({
      status: 'success',
      engineName: '<Ollama>',
      targetLanguage: 'English',
      translation: '<b>[点击](command:malicious)</b>',
      pinned: false,
    })
    expect(content).toContain('&lt;Ollama&gt;')
    expect(content).toContain('&lt;b&gt;\\[点击\\]\\(command:malicious\\)&lt;/b&gt;')
    expect(content).not.toContain('[点击](command:malicious)')
  })
})
