import * as vscode from 'vscode'
import { SettingsPanel } from './settings-panel'
import { EngineStore } from './store'
import { TranslationHover } from './translator'

interface EngineQuickPickItem extends vscode.QuickPickItem {
  engineId: string
}

export function activate(context: vscode.ExtensionContext): void {
  const store = new EngineStore(context)
  const translationHover = new TranslationHover(store)

  context.subscriptions.push(
    translationHover,
    vscode.commands.registerCommand('selectionTranslator.translate', () =>
      translationHover.translateSelection(),
    ),
    vscode.commands.registerCommand('selectionTranslator.copyHoverTranslation', () =>
      translationHover.copyTranslation(),
    ),
    vscode.commands.registerCommand('selectionTranslator.toggleHoverLanguage', () =>
      translationHover.toggleLanguage(),
    ),
    vscode.commands.registerCommand('selectionTranslator.toggleHoverPin', () =>
      translationHover.togglePin(),
    ),
    vscode.commands.registerCommand('selectionTranslator.replaceHoverSelection', () =>
      translationHover.replaceOriginal(),
    ),
    vscode.commands.registerCommand('selectionTranslator.manageEngines', () =>
      SettingsPanel.createOrShow(context.extensionUri, store),
    ),
    vscode.commands.registerCommand('selectionTranslator.selectDefaultEngine', async () => {
      const state = await store.getState()
      if (state.engines.length === 0) {
        const action = await vscode.window.showInformationMessage(
          '尚未配置翻译引擎',
          '添加引擎',
        )
        if (action) await SettingsPanel.createOrShow(context.extensionUri, store)
        return
      }

      const items: EngineQuickPickItem[] = state.engines.map((engine) => ({
        engineId: engine.id,
        label: engine.name,
        description: engine.id === state.defaultEngineId ? '当前默认' : '',
        detail: engine.baseUrl,
      }))
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: '选择默认翻译引擎',
      })
      if (selected) {
        await store.setDefaultEngine(selected.engineId)
        await vscode.window.showInformationMessage(`默认引擎已切换为 ${selected.label}`)
      }
    }),
    vscode.commands.registerCommand('selectionTranslator.setTargetLanguage', async () => {
      const targetLanguage = await vscode.window.showInputBox({
        title: '设置目标语言',
        value: store.getTargetLanguage(),
        prompt: '例如：简体中文、English、日语、en',
        validateInput: (value) => (value.trim() ? null : '目标语言不能为空'),
      })
      if (targetLanguage !== undefined) {
        await store.setTargetLanguage(targetLanguage)
        await vscode.window.showInformationMessage(`目标语言已设置为 ${targetLanguage.trim()}`)
      }
    }),
    { dispose: () => SettingsPanel.dispose() },
  )
}

export function deactivate(): void {}
