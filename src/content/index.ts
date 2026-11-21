import styles from './content.css?inline'
import type { BackgroundResponse, TranslateMessage } from '../shared/types'
import { SelectionTranslatorUI } from './ui'
import type { FloatingPosition } from './ui'

const ui = new SelectionTranslatorUI(styles)
let requestVersion = 0

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.includes('Extension context invalidated')) {
    return '扩展已更新，请刷新当前网页后重试'
  }
  return error instanceof Error ? error.message : '翻译失败，请稍后重试'
}

function dismiss(): void {
  requestVersion += 1
  ui.hide()
}

async function translate(text: string, position: FloatingPosition): Promise<void> {
  const currentRequest = ++requestVersion
  ui.showLoading(position)

  try {
    const message: TranslateMessage = { type: 'translate', text }
    const response = (await chrome.runtime.sendMessage(message)) as
      | BackgroundResponse
      | undefined
    if (currentRequest !== requestVersion) return

    if (!response) {
      ui.showError('扩展后台未返回结果，请刷新页面后重试')
    } else if (response.ok) {
      ui.showTranslation(response.translation)
    } else {
      ui.showError(response.error)
    }
  } catch (error) {
    if (currentRequest === requestVersion) ui.showError(errorMessage(error))
  }
}

function isUnsupportedSelectionTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest('input, textarea, [contenteditable="true"]'))
  )
}

document.addEventListener('mouseup', (event) => {
  if (event.button !== 0) return

  window.setTimeout(() => {
    if (isUnsupportedSelectionTarget(event.target)) {
      dismiss()
      return
    }

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      dismiss()
      return
    }

    const text = selection.toString().trim()
    if (!text) {
      dismiss()
      return
    }

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const position: FloatingPosition = {
      x: rect.width > 0 ? rect.left + rect.width / 2 : event.clientX,
      y: rect.height > 0 ? rect.bottom + 8 : event.clientY + 8,
    }

    ui.showTrigger(position, () => {
      void translate(text, position)
    })
  }, 0)
})

window.addEventListener('scroll', dismiss, true)
window.addEventListener('resize', dismiss)
