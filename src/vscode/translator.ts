import * as vscode from 'vscode'
import { translateText } from './fetch'
import {
  alternateTargetLanguage,
  buildHoverContent,
  HOVER_COMMANDS,
} from './hover-content'
import type { HoverContentState } from './hover-content'
import { errorMessage } from './model'
import type { EngineStore } from './store'

const AUTO_TRIGGER_DELAY_MS = 250
const TRANSLATION_TIMEOUT_MS = 35_000

interface TranslationSession extends HoverContentState {
  editor: vscode.TextEditor
  original: string
  range: vscode.Range
  documentVersion: number
}

export class TranslationHover implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = []
  private session: TranslationSession | undefined
  private selectionTimer: ReturnType<typeof setTimeout> | undefined
  private hideTimer: ReturnType<typeof setTimeout> | undefined
  private requestId = 0
  private lastSelectionKey = ''
  private disposed = false

  constructor(private readonly store: EngineStore) {
    this.disposables.push(
      vscode.languages.registerHoverProvider('*', {
        provideHover: (document, position) => this.provideHover(document, position),
      }),
      vscode.window.onDidChangeTextEditorSelection((event) => {
        this.handleSelectionChange(event)
      }),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (
          this.session &&
          event.document.uri.toString() === this.session.editor.document.uri.toString() &&
          event.contentChanges.length > 0
        ) {
          this.dismiss()
        }
      }),
    )
  }

  async translateSelection(): Promise<void> {
    const editor = vscode.window.activeTextEditor
    if (!editor || editor.selection.isEmpty) {
      await vscode.window.showInformationMessage('请先在编辑器中选择要翻译的文本')
      return
    }

    const original = editor.document.getText(editor.selection)
    if (!original.trim()) {
      await vscode.window.showInformationMessage('选中文本为空')
      return
    }

    this.clearSelectionTimer()
    const range = new vscode.Range(editor.selection.start, editor.selection.end)
    await this.startTranslation(editor, range)
  }

  async copyTranslation(): Promise<void> {
    if (this.session?.status !== 'success' || !this.session.translation) return
    await vscode.env.clipboard.writeText(this.session.translation)
    vscode.window.setStatusBarMessage('ET：译文已复制', 1500)
    await this.showHover()
  }

  async toggleLanguage(): Promise<void> {
    const session = this.session
    if (!session || session.status !== 'success') return
    if (!this.isOriginalUnchanged(session)) {
      session.status = 'error'
      session.error = '原文已发生变化，请重新选择并翻译'
      await this.showHover()
      return
    }

    const nextLanguage = alternateTargetLanguage(session.targetLanguage)
    const requestId = this.requestId
    try {
      await this.store.setTargetLanguage(nextLanguage)
    } catch (error) {
      session.status = 'error'
      session.error = `切换目标语言失败：${errorMessage(error)}`
      await this.showHover()
      return
    }

    if (this.session !== session || this.requestId !== requestId) return
    const range = new vscode.Range(session.range.start, session.range.end)
    await this.startTranslation(session.editor, range, session.pinned)
  }

  async togglePin(): Promise<void> {
    if (!this.session || this.session.status !== 'success') return
    this.session.pinned = !this.session.pinned
    this.clearHideTimer()
    await this.showHover()
  }

  async replaceOriginal(): Promise<void> {
    const session = this.session
    if (!session || session.status !== 'success' || !session.translation) return
    const editor = vscode.window.visibleTextEditors.find(
      (item) => item.document.uri.toString() === session.editor.document.uri.toString(),
    )
    if (!editor) {
      await vscode.window.showErrorMessage('原文编辑器已关闭，无法替换原文')
      return
    }
    if (
      editor.document.version !== session.documentVersion ||
      editor.document.getText(session.range) !== session.original
    ) {
      session.status = 'error'
      session.error = '原文已发生变化，请重新选择并翻译'
      await this.showHover()
      return
    }

    const applied = await editor.edit((builder) => {
      builder.replace(session.range, session.translation || '')
    })
    if (!applied) {
      session.status = 'error'
      session.error = '替换原文失败，请重试'
      await this.showHover()
      return
    }

    this.dismiss()
    editor.selection = new vscode.Selection(session.range.start, session.range.start)
    editor.revealRange(session.range)
    vscode.window.setStatusBarMessage('ET：已用译文替换原文', 2000)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.requestId += 1
    this.clearSelectionTimer()
    this.clearHideTimer()
    this.session = undefined
    for (const disposable of this.disposables) disposable.dispose()
    void this.hideHover()
  }

  private provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Hover | undefined {
    const session = this.session
    if (
      !session ||
      session.editor.document.uri.toString() !== document.uri.toString() ||
      !session.range.contains(position)
    ) {
      return undefined
    }

    const markdown = new vscode.MarkdownString(buildHoverContent(session))
    markdown.supportThemeIcons = true
    markdown.isTrusted = { enabledCommands: [...HOVER_COMMANDS] }
    return new vscode.Hover(markdown, session.range)
  }

  private async startTranslation(
    editor: vscode.TextEditor,
    range: vscode.Range,
    pinned = false,
  ): Promise<void> {
    const original = editor.document.getText(range)
    if (!original.trim()) return

    this.clearSelectionTimer()
    this.clearHideTimer()
    const requestId = ++this.requestId
    const session: TranslationSession = {
      editor,
      original,
      range,
      documentVersion: editor.document.version,
      status: 'loading',
      engineName: '默认引擎',
      targetLanguage: this.store.getTargetLanguage(),
      pinned,
    }
    this.session = session
    this.lastSelectionKey = this.selectionKey(editor, range)
    await this.showHover(false)
    if (!this.isCurrent(requestId, session)) {
      return
    }

    let operationTimeoutId: ReturnType<typeof setTimeout> | undefined
    const operationTimeout = new Promise<never>((_, reject) => {
      operationTimeoutId = setTimeout(() => {
        reject(new Error('翻译处理超时，请检查网络和引擎配置后重试'))
      }, TRANSLATION_TIMEOUT_MS)
    })

    try {
      const engine = await Promise.race([this.store.getDefaultEngine(), operationTimeout])
      if (!this.isCurrent(requestId, session)) {
        return
      }
      if (!engine) throw new Error('尚未设置默认翻译引擎，请先点击“管理引擎”完成配置')

      session.engineName = engine.name
      const translation = await Promise.race([
        translateText(engine, original, session.targetLanguage),
        operationTimeout,
      ])
      if (!this.isCurrent(requestId, session)) {
        return
      }
      session.translation = translation
      session.status = 'success'
    } catch (error) {
      if (!this.isCurrent(requestId, session)) {
        return
      }
      session.status = 'error'
      session.error = errorMessage(error)
    } finally {
      if (operationTimeoutId) clearTimeout(operationTimeoutId)
    }

    await this.showHover()
  }

  private handleSelectionChange(event: vscode.TextEditorSelectionChangeEvent): void {
    if (this.disposed || event.textEditor !== vscode.window.activeTextEditor) return
    this.clearSelectionTimer()
    const editor = event.textEditor

    if (editor.selection.isEmpty || !editor.document.getText(editor.selection).trim()) {
      this.lastSelectionKey = ''
      if (this.session && !this.session.pinned) {
        this.requestId += 1
        this.scheduleDismiss()
      }
      return
    }

    if (this.session?.pinned) return
    const autoTranslate = vscode.workspace
      .getConfiguration('selectionTranslator')
      .get<boolean>('autoTranslate', true)
    if (!autoTranslate) {
      this.dismiss()
      return
    }

    const range = new vscode.Range(editor.selection.start, editor.selection.end)
    const key = this.selectionKey(editor, range)
    if (key === this.lastSelectionKey) return

    this.requestId += 1
    this.selectionTimer = setTimeout(() => {
      this.selectionTimer = undefined
      void this.startTranslation(editor, range)
    }, AUTO_TRIGGER_DELAY_MS)
  }

  private scheduleDismiss(): void {
    this.clearHideTimer()
    if (!this.session) return
    const configured = vscode.workspace
      .getConfiguration('selectionTranslator')
      .get<number>('hoverAutoHideDelay', 800)
    const delay = Math.max(0, Number.isFinite(configured) ? configured : 800)
    if (delay === 0) {
      this.dismiss()
      return
    }
    this.hideTimer = setTimeout(() => this.dismiss(), delay)
  }

  private dismiss(): void {
    this.requestId += 1
    this.lastSelectionKey = ''
    this.clearSelectionTimer()
    this.clearHideTimer()
    this.session = undefined
    void this.hideHover()
  }

  private isCurrent(requestId: number, session: TranslationSession): boolean {
    return !this.disposed && this.requestId === requestId && this.session === session
  }

  private isOriginalUnchanged(session: TranslationSession): boolean {
    return (
      session.editor.document.version === session.documentVersion &&
      session.editor.document.getText(session.range) === session.original
    )
  }

  private selectionKey(editor: vscode.TextEditor, range: vscode.Range): string {
    return [
      editor.document.uri.toString(),
      editor.document.version,
      range.start.line,
      range.start.character,
      range.end.line,
      range.end.character,
    ].join(':')
  }

  private async showHover(refresh = true): Promise<void> {
    try {
      if (refresh) await this.hideHover()
      await vscode.commands.executeCommand('editor.action.showHover')
    } catch (error) {
      console.error('[Easy Translate] 显示悬浮翻译失败', error)
    }
  }

  private async hideHover(): Promise<void> {
    try {
      await vscode.commands.executeCommand('editor.action.hideHover')
    } catch {
      // 原生 Hover 已随编辑器关闭时无需额外处理。
    }
  }

  private clearSelectionTimer(): void {
    if (this.selectionTimer) clearTimeout(this.selectionTimer)
    this.selectionTimer = undefined
  }

  private clearHideTimer(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer)
    this.hideTimer = undefined
  }
}
