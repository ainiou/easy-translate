import styles from './content.css?inline'
import { createDefaultSettings, getSettings, normalizeSettings, SETTINGS_STORAGE_KEY } from '../shared/settings'
import type {
  BackgroundResponse,
  ExtensionSettings,
  TranslateMessage,
} from '../shared/types'
import { HoldTriggerController, shouldTriggerHold } from './hold-trigger'
import { SelectionTranslatorUI } from './ui'
import type { FloatingPosition } from './ui'

const ui = new SelectionTranslatorUI(styles)
const trigger = new HoldTriggerController()
let requestVersion = 0
let settings: ExtensionSettings = createDefaultSettings()

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

function resetTrigger(): void {
  trigger.cancel()
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

function loadSettings(): void {
  void getSettings()
    .then((value) => {
      settings = value
    })
    .catch(() => {
      settings = createDefaultSettings()
    })
}

loadSettings()

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[SETTINGS_STORAGE_KEY]) return
  settings = normalizeSettings(changes[SETTINGS_STORAGE_KEY].newValue)
  if (!settings.holdToTranslate) resetTrigger()
})

window.addEventListener(
  'keydown',
  (event) => {
    if (!settings.holdToTranslate || event.key !== settings.holdTriggerKey) return
    if (event.repeat) return
    trigger.press()
    // 避免 Alt 等触发键激活浏览器菜单，影响划词操作。
    event.preventDefault()
  },
  true,
)

window.addEventListener(
  'keyup',
  (event) => {
    if (!settings.holdToTranslate || event.key !== settings.holdTriggerKey) return
    // 松开触发键立即终止进行中的翻译并关闭浮窗。
    if (trigger.release()) dismiss()
  },
  true,
)

window.addEventListener('blur', () => {
  if (!trigger.isHeld) return
  trigger.release()
  if (settings.holdToTranslate) dismiss()
})

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

    if (settings.holdToTranslate) {
      if (!shouldTriggerHold(true, event, settings.holdTriggerKey, trigger.heldMs())) {
        dismiss()
        return
      }
      void translate(text, position)
      return
    }

    ui.showTrigger(position, () => {
      void translate(text, position)
    })
  }, 0)
})

window.addEventListener('scroll', dismiss, true)
window.addEventListener('resize', dismiss)
