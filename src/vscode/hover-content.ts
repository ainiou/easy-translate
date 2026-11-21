export type HoverStatus = 'loading' | 'success' | 'error'

export interface HoverContentState {
  status: HoverStatus
  engineName: string
  targetLanguage: string
  translation?: string
  error?: string
  pinned: boolean
}

export const HOVER_COMMANDS = [
  'selectionTranslator.copyHoverTranslation',
  'selectionTranslator.toggleHoverLanguage',
  'selectionTranslator.toggleHoverPin',
  'selectionTranslator.replaceHoverSelection',
  'selectionTranslator.manageEngines',
] as const

export function alternateTargetLanguage(current: string): string {
  return /^(?:zh|chinese|中文|简体|繁体)/i.test(current.trim()) ||
    /中文|简体中文|繁體中文/.test(current)
    ? 'English'
    : '简体中文'
}

function escapeMarkdown(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([\\`*_[\]{}()#+\-.!|])/g, '\\$1')
    .replace(/\r\n|\r|\n/g, '  \n')
}

export function buildHoverContent(state: HoverContentState): string {
  const title = `**ET · ${escapeMarkdown(state.engineName || '默认引擎')}**`
  const language = state.targetLanguage ? ` · ${escapeMarkdown(state.targetLanguage)}` : ''

  if (state.status === 'loading') {
    return `${title}${language}\n\n$(loading~spin) 正在翻译，请稍候…`
  }

  if (state.status === 'error') {
    const message = escapeMarkdown(state.error || '翻译失败，请稍后重试')
    return `${title}\n\n$(error) ${message}\n\n[$(settings-gear) 管理引擎](command:selectionTranslator.manageEngines)`
  }

  const translation = escapeMarkdown(state.translation || '未返回翻译结果')
  const nextLanguage = alternateTargetLanguage(state.targetLanguage)
  const pinLabel = state.pinned ? '取消固定' : '固定浮窗'
  const actions = [
    `[$(copy) 复制](command:selectionTranslator.copyHoverTranslation)`,
    `[$(arrow-swap) 译为${nextLanguage}](command:selectionTranslator.toggleHoverLanguage)`,
    `[$(pin) ${pinLabel}](command:selectionTranslator.toggleHoverPin)`,
    `[$(replace) 替换原文](command:selectionTranslator.replaceHoverSelection)`,
  ]
  return `${title}${language}\n\n${translation}\n\n---\n\n${actions.join('　')}`
}
