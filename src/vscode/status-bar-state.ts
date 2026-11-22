export interface StatusBarPresentation {
  text: string
  tooltip: string
  accessibilityLabel: string
  backgroundKey?: string
  foregroundKey?: string
}

export const TOGGLE_STATUS_BAR_COMMAND = 'selectionTranslator.toggleEnabled'

export function buildStatusBarPresentation(enabled: boolean): StatusBarPresentation {
  if (enabled) {
    return {
      text: '$(comment-discussion) ET',
      tooltip:
        'Easy Translate\n\n划词翻译已开启：选中文本后自动显示悬浮翻译。\n\n点击关闭。',
      accessibilityLabel: 'ET 划词翻译：已开启',
      backgroundKey: 'statusBarItem.prominentBackground',
      foregroundKey: 'statusBarItem.prominentForeground',
    }
  }

  return {
    text: '$(circle-slash) ET',
    tooltip:
      'Easy Translate\n\n划词翻译已关闭：选中文本不再自动翻译，可通过右键菜单手动翻译。\n\n点击开启。',
    accessibilityLabel: 'ET 划词翻译：已关闭',
  }
}
