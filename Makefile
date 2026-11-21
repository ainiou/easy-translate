.DEFAULT_GOAL := all

NPM ?= npm

.PHONY: all chrome vscode package-vscode check

# 默认构建 Chrome 和 VS Code 两种插件。
all: chrome vscode

# 构建 Chrome 插件，输出到 dist/。
chrome:
	$(NPM) run build

# 构建 VS Code 插件及设置 Webview，输出到 dist-vscode/。
vscode:
	$(NPM) run build:vscode

# 构建并打包 VS Code 插件，生成 selection-translator.vsix。
package-vscode:
	$(NPM) run package:vscode

# 运行 TypeScript 类型检查和全部单元测试。
check:
	$(NPM) run typecheck
	$(NPM) run test
