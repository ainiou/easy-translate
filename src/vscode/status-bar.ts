import * as vscode from 'vscode'
import { buildStatusBarPresentation, TOGGLE_STATUS_BAR_COMMAND } from './status-bar-state'
import { errorMessage } from './model'

const CONFIG_SECTION = 'selectionTranslator'

export class TranslationStatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem
  private readonly disposables: vscode.Disposable[] = []
  private lastEnabled: boolean | undefined

  constructor(private readonly onDisable?: () => void) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
    this.item.command = TOGGLE_STATUS_BAR_COMMAND
    this.disposables.push(
      this.item,
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(`${CONFIG_SECTION}.autoTranslate`)) {
          this.refresh()
        }
      }),
    )
    this.refresh()
  }

  isEnabled(): boolean {
    return vscode.workspace
      .getConfiguration(CONFIG_SECTION)
      .get<boolean>('autoTranslate', true)
  }

  async toggle(): Promise<void> {
    const next = !this.isEnabled()
    try {
      await vscode.workspace
        .getConfiguration(CONFIG_SECTION)
        .update('autoTranslate', next, vscode.ConfigurationTarget.Global)
    } catch (error) {
      await vscode.window.showErrorMessage(`无法保存划词翻译开关状态：${errorMessage(error)}`)
      return
    }

    if (!next) this.onDisable?.()
    this.refresh()
    vscode.window.setStatusBarMessage(
      next ? 'ET：划词翻译已开启' : 'ET：划词翻译已关闭',
      2000,
    )
  }

  refresh(): void {
    const enabled = this.isEnabled()
    // 状态未变化时不重写图标，避免切换过程中的闪烁与多余重绘。
    if (this.lastEnabled === enabled) {
      this.item.show()
      return
    }
    this.lastEnabled = enabled

    const presentation = buildStatusBarPresentation(enabled)
    this.item.text = presentation.text
    this.item.tooltip = presentation.tooltip
    this.item.accessibilityInformation = { label: presentation.accessibilityLabel }
    this.item.backgroundColor = presentation.backgroundKey
      ? new vscode.ThemeColor(presentation.backgroundKey)
      : undefined
    this.item.color = presentation.foregroundKey
      ? new vscode.ThemeColor(presentation.foregroundKey)
      : undefined
    this.item.show()
  }

  dispose(): void {
    for (const disposable of this.disposables) disposable.dispose()
  }
}
