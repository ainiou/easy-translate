import * as vscode from 'vscode'
import { translateWithEngine } from '../shared/translate'
import { errorMessage } from './model'
import type { EngineStore } from './store'
import { TranslationPanel } from './translation-panel'

export async function translateSelection(store: EngineStore): Promise<void> {
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

  const engine = await store.getDefaultEngine()
  if (!engine) {
    const action = await vscode.window.showWarningMessage(
      '尚未设置默认翻译引擎',
      '管理引擎',
    )
    if (action) await vscode.commands.executeCommand('selectionTranslator.manageEngines')
    return
  }

  try {
    const targetLanguage = store.getTargetLanguage()
    const translation = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `正在使用 ${engine.name} 翻译`,
        cancellable: false,
      },
      () => translateWithEngine(engine, original, targetLanguage),
    )

    TranslationPanel.createOrShow({
      original,
      translation,
      engineName: engine.name,
      targetLanguage,
      documentUri: editor.document.uri,
      documentVersion: editor.document.version,
      range: new vscode.Range(editor.selection.start, editor.selection.end),
    })
  } catch (error) {
    await vscode.window.showErrorMessage(`翻译失败：${errorMessage(error)}`)
  }
}
