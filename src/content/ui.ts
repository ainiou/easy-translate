export interface FloatingPosition {
  x: number
  y: number
}

type PanelState = 'hidden' | 'trigger' | 'loading' | 'result' | 'error'

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum))
}

export class SelectionTranslatorUI {
  private readonly host: HTMLDivElement
  private readonly triggerButton: HTMLButtonElement
  private readonly panel: HTMLElement
  private readonly panelBody: HTMLDivElement
  private translateCallback: (() => void) | null = null
  private panelState: PanelState = 'hidden'

  constructor(styles: string) {
    this.host = document.createElement('div')
    this.host.setAttribute('data-selection-translator', '')
    this.host.style.position = 'fixed'
    this.host.style.left = '0'
    this.host.style.top = '0'
    this.host.style.width = '0'
    this.host.style.height = '0'
    this.host.style.zIndex = '2147483647'

    const shadow = this.host.attachShadow({ mode: 'closed' })
    const styleElement = document.createElement('style')
    styleElement.textContent = styles
    shadow.append(styleElement)

    this.triggerButton = document.createElement('button')
    this.triggerButton.type = 'button'
    this.triggerButton.className = 'translate-trigger'
    this.triggerButton.textContent = '译'
    this.triggerButton.title = '翻译选中文本'
    this.triggerButton.setAttribute('aria-label', '翻译选中文本')
    this.triggerButton.hidden = true

    this.panel = document.createElement('section')
    this.panel.className = 'translation-panel'
    this.panel.setAttribute('role', 'dialog')
    this.panel.setAttribute('aria-label', '划词翻译结果')
    this.panel.hidden = true

    const header = document.createElement('header')
    header.className = 'panel-header'
    const title = document.createElement('strong')
    title.textContent = '划词翻译'
    const closeButton = document.createElement('button')
    closeButton.type = 'button'
    closeButton.className = 'close-button'
    closeButton.textContent = '×'
    closeButton.setAttribute('aria-label', '关闭翻译浮窗')
    header.append(title, closeButton)

    this.panelBody = document.createElement('div')
    this.panelBody.className = 'panel-body'
    this.panel.append(header, this.panelBody)
    shadow.append(this.triggerButton, this.panel)
    document.documentElement.append(this.host)

    this.triggerButton.addEventListener('mousedown', (event) => {
      event.preventDefault()
      event.stopPropagation()
    })
    this.triggerButton.addEventListener('mouseup', (event) => event.stopPropagation())
    this.triggerButton.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      this.translateCallback?.()
    })

    this.panel.addEventListener('mousedown', (event) => event.stopPropagation())
    this.panel.addEventListener('mouseup', (event) => event.stopPropagation())
    closeButton.addEventListener('click', () => this.hide())

    document.addEventListener(
      'pointerdown',
      (event) => {
        if (!event.composedPath().includes(this.host)) this.hide()
      },
      true,
    )
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.panelState !== 'hidden') this.hide()
    })
  }

  showTrigger(position: FloatingPosition, onTranslate: () => void): void {
    this.hide()
    this.translateCallback = onTranslate
    this.panelState = 'trigger'
    this.triggerButton.style.left = `${clamp(position.x - 20, 8, window.innerWidth - 48)}px`
    this.triggerButton.style.top = `${clamp(position.y, 8, window.innerHeight - 44)}px`
    this.triggerButton.hidden = false
  }

  showLoading(position: FloatingPosition): void {
    this.translateCallback = null
    this.triggerButton.hidden = true
    this.panelState = 'loading'
    this.positionPanel(position)

    const loading = document.createElement('div')
    loading.className = 'loading-state'
    const spinner = document.createElement('span')
    spinner.className = 'spinner'
    spinner.setAttribute('aria-hidden', 'true')
    const text = document.createElement('span')
    text.textContent = '正在翻译…'
    loading.append(spinner, text)
    this.panelBody.replaceChildren(loading)
    this.panel.hidden = false
  }

  showTranslation(translation: string): void {
    if (this.panelState !== 'loading') return

    this.panelState = 'result'
    const result = document.createElement('div')
    result.className = 'translation-text'
    result.textContent = translation
    this.panelBody.replaceChildren(result)
  }

  showError(message: string): void {
    if (this.panelState !== 'loading') return

    this.panelState = 'error'
    const error = document.createElement('div')
    error.className = 'error-state'
    error.setAttribute('role', 'alert')
    error.textContent = message
    this.panelBody.replaceChildren(error)
  }

  hide(): void {
    this.panelState = 'hidden'
    this.translateCallback = null
    this.triggerButton.hidden = true
    this.panel.hidden = true
  }

  private positionPanel(position: FloatingPosition): void {
    const width = Math.min(380, window.innerWidth - 16)
    const left = clamp(position.x - width / 2, 8, window.innerWidth - width - 8)
    const top = clamp(position.y, 8, window.innerHeight - 220)
    this.panel.style.width = `${width}px`
    this.panel.style.left = `${left}px`
    this.panel.style.top = `${top}px`
  }
}
