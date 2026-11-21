import { randomUUID } from 'node:crypto'
import * as vscode from 'vscode'

interface TranslationResult {
  original: string
  translation: string
  engineName: string
  targetLanguage: string
  documentUri: vscode.Uri
  documentVersion: number
  range: vscode.Range
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character]
  })
}

export class TranslationPanel {
  private static current: TranslationPanel | undefined
  private result: TranslationResult | undefined

  private constructor(private readonly panel: vscode.WebviewPanel) {
    this.panel.onDidDispose(() => {
      if (TranslationPanel.current === this) TranslationPanel.current = undefined
    })
    this.panel.webview.onDidReceiveMessage((message: unknown) => {
      void this.handleMessage(message)
    })
  }

  static createOrShow(result: TranslationResult): void {
    if (!this.current) {
      const panel = vscode.window.createWebviewPanel(
        'selectionTranslator.translation',
        '划词翻译',
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        { enableScripts: true, retainContextWhenHidden: true },
      )
      this.current = new TranslationPanel(panel)
    }

    this.current.result = result
    this.current.panel.title = `翻译：${result.engineName}`
    this.current.render()
    this.current.panel.reveal(vscode.ViewColumn.Beside, true)
  }

  static dispose(): void {
    this.current?.panel.dispose()
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!this.result || !message || typeof message !== 'object') return
    const type = (message as Record<string, unknown>).type

    if (type === 'copy') {
      await vscode.env.clipboard.writeText(this.result.translation)
      await vscode.window.showInformationMessage('译文已复制')
      return
    }

    if (type !== 'replace') return
    const result = this.result
    const editor = vscode.window.visibleTextEditors.find(
      (item) => item.document.uri.toString() === result.documentUri.toString(),
    )
    if (!editor) {
      await vscode.window.showErrorMessage('原文编辑器已关闭，无法替换原文')
      return
    }
    if (
      editor.document.version !== result.documentVersion ||
      editor.document.getText(result.range) !== result.original
    ) {
      await vscode.window.showErrorMessage('原文已发生变化，请重新选择并翻译')
      return
    }

    const applied = await editor.edit((builder) => {
      builder.replace(result.range, result.translation)
    })
    if (!applied) {
      await vscode.window.showErrorMessage('替换原文失败')
      return
    }

    editor.selection = new vscode.Selection(result.range.start, result.range.start)
    editor.revealRange(result.range)
    await vscode.window.showInformationMessage('已用译文替换原文')
  }

  private render(): void {
    if (!this.result) return
    const result = this.result
    const nonce = randomUUID()
    this.panel.webview.html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <title>划词翻译</title>
  <style nonce="${nonce}">
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; color: var(--vscode-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); }
    header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
    h1 { margin: 0; font-size: 22px; }
    .meta { color: var(--vscode-descriptionForeground); font-size: 12px; }
    section { margin-top: 16px; }
    h2 { margin: 0 0 8px; color: var(--vscode-descriptionForeground); font-size: 12px; font-weight: 600; letter-spacing: .08em; }
    pre { min-height: 72px; margin: 0; padding: 14px; overflow: auto; border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: var(--vscode-textCodeBlock-background); font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); line-height: 1.65; white-space: pre-wrap; word-break: break-word; }
    .translation { border-color: var(--vscode-focusBorder); }
    .actions { display: flex; gap: 8px; margin-top: 16px; }
    button { padding: 7px 14px; border: 0; border-radius: 4px; cursor: pointer; color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
  </style>
</head>
<body>
  <header>
    <h1>翻译结果</h1>
    <span class="meta">${escapeHtml(result.engineName)} · ${escapeHtml(result.targetLanguage)}</span>
  </header>
  <section>
    <h2>原文</h2>
    <pre>${escapeHtml(result.original)}</pre>
  </section>
  <section>
    <h2>译文</h2>
    <pre class="translation">${escapeHtml(result.translation)}</pre>
  </section>
  <div class="actions">
    <button id="copy" type="button">复制译文</button>
    <button id="replace" class="secondary" type="button">替换原文</button>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi()
    document.getElementById('copy').addEventListener('click', () => vscode.postMessage({ type: 'copy' }))
    document.getElementById('replace').addEventListener('click', () => vscode.postMessage({ type: 'replace' }))
  </script>
</body>
</html>`
  }
}
