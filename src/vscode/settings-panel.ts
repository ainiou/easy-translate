import { readFile } from 'node:fs/promises'
import * as vscode from 'vscode'
import { errorMessage } from './model'
import type { ExtensionViewState, SettingsRequest } from './protocol'
import type { EngineStore } from './store'

interface RequestResult {
  state?: ExtensionViewState
  translation?: string
}

export class SettingsPanel {
  private static current: SettingsPanel | undefined

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly store: EngineStore,
  ) {
    this.panel.onDidDispose(() => {
      if (SettingsPanel.current === this) SettingsPanel.current = undefined
    })
    this.panel.webview.onDidReceiveMessage((request: SettingsRequest) => {
      void this.handleRequest(request)
    })
  }

  static async createOrShow(
    extensionUri: vscode.Uri,
    store: EngineStore,
  ): Promise<void> {
    if (this.current) {
      this.current.panel.reveal(vscode.ViewColumn.Active)
      return
    }

    const panel = vscode.window.createWebviewPanel(
      'selectionTranslator.settings',
      '翻译引擎设置',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist-vscode', 'webview')],
      },
    )
    this.current = new SettingsPanel(panel, store)
    panel.webview.html = await loadWebviewHtml(extensionUri, panel.webview)
  }

  static dispose(): void {
    this.current?.panel.dispose()
  }

  private async handleRequest(request: SettingsRequest): Promise<void> {
    try {
      let result: RequestResult = {}
      switch (request.type) {
        case 'getState':
          result.state = await this.store.getState()
          break
        case 'saveEngine':
          result.state = await this.store.saveEngine(request.engine)
          break
        case 'testEngine':
          result.translation = await this.store.testEngine(request.engine)
          break
        case 'deleteEngine': {
          const currentState = await this.store.getState()
          const engine = currentState.engines.find((item) => item.id === request.engineId)
          const confirmation = await vscode.window.showWarningMessage(
            `确定删除引擎“${engine?.name ?? request.engineId}”吗？`,
            { modal: true },
            '删除',
          )
          result.state = confirmation
            ? await this.store.deleteEngine(request.engineId)
            : currentState
          break
        }
        case 'setDefaultEngine':
          result.state = await this.store.setDefaultEngine(request.engineId)
          break
        case 'setTargetLanguage':
          result.state = await this.store.setTargetLanguage(request.targetLanguage)
          break
      }
      await this.panel.webview.postMessage({ id: request.id, ok: true, ...result })
    } catch (error) {
      const actionLabels: Record<SettingsRequest['type'], string> = {
        getState: '读取设置',
        saveEngine: '保存引擎',
        testEngine: '测试连接',
        deleteEngine: '删除引擎',
        setDefaultEngine: '设置默认引擎',
        setTargetLanguage: '设置目标语言',
      }
      console.error(`[Easy Translate] ${actionLabels[request.type]}失败`, error)
      await this.panel.webview.postMessage({
        id: request.id,
        ok: false,
        error: `${actionLabels[request.type]}失败：${errorMessage(error)}`,
      })
    }
  }
}

async function loadWebviewHtml(
  extensionUri: vscode.Uri,
  webview: vscode.Webview,
): Promise<string> {
  const webviewRoot = vscode.Uri.joinPath(extensionUri, 'dist-vscode', 'webview')
  const indexUri = vscode.Uri.joinPath(webviewRoot, 'index.html')
  let html = await readFile(indexUri.fsPath, 'utf8')

  html = html.replace(/(src|href)="(\.\/[^"]+)"/g, (_match, attribute: string, value: string) => {
    const resourceUri = webview.asWebviewUri(
      vscode.Uri.joinPath(webviewRoot, value.slice(2)),
    )
    return `${attribute}="${resourceUri.toString()}"`
  })

  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src ${webview.cspSource}`,
  ].join('; ')
  return html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${csp}">`)
}
