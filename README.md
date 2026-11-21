# 划词翻译 Chrome 插件使用文档

## 1. 文档说明

本文档说明如何安装、配置和使用本插件，以及本地开发、构建、测试和常见问题处理。

本插件基于 Chrome Manifest V3 开发，主要用于在普通网页中选中文字后，通过自定义的 OpenAI Chat Completions 兼容翻译接口完成翻译。

---

## 2. 功能介绍

当前版本支持以下功能：

- 网页选中文本后显示翻译按钮。
- 点击翻译按钮后，在选区附近显示翻译浮窗。
- 浮窗支持加载中、翻译结果、错误提示三种状态。
- 支持添加、编辑、删除多个翻译引擎，包括 OpenAI 兼容接口、有道官方 API、百度翻译 API、DeepL API、Google 官方 API 和 Google 免费端点。
- 支持对新增或修改后的引擎进行连接测试。
- 支持设置默认翻译引擎。
- 支持自定义目标语言，默认翻译为简体中文。
- 支持按引擎域名申请访问权限，默认不强制获取全部网站权限。
- API Key 仅保存在当前浏览器的本地存储中，不会同步。
- 翻译请求由扩展后台 Service Worker 统一发起，内容脚本不直接接触 API Key。

当前版本暂不支持：

- 输入框、文本域、`contenteditable` 区域内部选区翻译。
- Chrome 内部页面、Chrome Web Store、PDF 查看器页面翻译。
- 跨域 iframe 内部选区翻译。
- 翻译历史、收藏、缓存、自动翻译、快捷键触发。
- 任意请求头、请求体模板和自定义响应解析路径。
- 多浏览器适配，例如 Edge、Firefox 的兼容性验证。

---

## 3. 环境要求

### 3.1 浏览器要求

- 推荐使用较新版本的 Google Chrome。
- 已按 Chrome Manifest V3 规范构建，需通过“加载已解压的扩展程序”安装。

### 3.2 翻译服务要求

至少准备以下任一类翻译服务：

**AI / LLM 类（OpenAI 兼容接口）**

- OpenAI 官方 API。
- DeepSeek、OpenRouter 等 OpenAI 兼容服务。
- 本地部署的兼容服务，例如 `http://localhost:11434/v1`。

要求：

- Base URL 为 API 根路径，例如 `https://api.openai.com/v1`。
- 后台会自动请求 `<Base URL>/chat/completions`。
- 接口返回标准 `choices[0].message.content` 结构。
- API Key 可选；若填写，后台会发送 `Authorization: Bearer <API Key>` 请求头。

**传统翻译接口**

- 有道智云官方翻译 API：需要 `appKey` 和 `appSecret`。
- 百度翻译开放平台：需要 `appid` 和 `secretKey`。
- DeepL 官方 API：需要 `Auth Key`；免费版可将 Base URL 改为 `https://api-free.deepl.com/v2`。
- Google Cloud Translation API v2：需要 Google Cloud API Key，并在 Google Cloud 启用 Cloud Translation API。
- Google 免费端点：无需密钥，但属于非官方公共端点，稳定性、可用性和限流策略不保证。

传统接口均自动识别源语言，目标语言由工具栏弹窗中的“目标语言”配置决定。

### 3.3 本地开发环境

若需要本地开发或重新构建，需要：

- Node.js：项目验证时使用版本为 `v24.21.0`。
- npm：项目验证时使用版本为 `11.19.0`。
- 操作系统：Windows 环境下已验证安装、类型检查、测试和构建。

---

## 4. 安装插件

## 4.1 加载已构建版本

项目已生成可直接加载的构建目录：

```text
e:\workspace\translater\dist
```

安装步骤：

1. 打开 Google Chrome。
2. 在地址栏输入 `chrome://extensions` 并回车。
3. 开启右上角的“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择目录 `e:\workspace\translater\dist`。
6. 加载成功后，工具栏中会出现“划词翻译”扩展。

如果修改了源码，需要重新执行构建命令，然后在扩展管理页点击“刷新”按钮重新加载扩展。

## 4.2 本地构建安装

如果需要从源码重新构建：

```powershell
npm install
npm run build
```

构建完成后，仍按 4.1 节加载 `dist` 目录。

---

## 5. 首次配置

## 5.1 打开设置页

有两种方式打开设置页：

1. 点击浏览器工具栏中的“划词翻译”图标。
2. 在弹窗中点击“管理引擎”。

也可以在 `chrome://extensions` 中找到该扩展，点击“详情”，再进入扩展选项页。

## 5.2 添加翻译引擎

在设置页点击“添加引擎”，先选择“引擎类型”，再按类型填写对应字段。

通用字段：

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| 引擎类型 | 是 | 选择 OpenAI 兼容、有道、百度、DeepL、Google 官方或 Google 免费端点。 |
| 引擎名称 | 是 | 用于区分不同服务，例如 OpenAI、有道、百度、本地服务。 |
| Base URL | 是 | 对应服务的 API 根路径；添加和测试时会申请该域名权限。 |

不同引擎类型的配置要求：

| 引擎类型 | 必填凭证 | 默认 Base URL | 说明 |
| --- | --- | --- | --- |
| OpenAI 兼容接口 | 模型必填；API Key 可选 | `https://api.openai.com/v1` | 调用 `/chat/completions`，适合 OpenAI、DeepSeek、OpenRouter、本地兼容服务。 |
| 有道官方 API | `appKey`、`appSecret` | `https://openapi.youdao.com` | 插件自动生成 v3 签名；目标语言会映射为 `zh-CHS`、`zh-CHT`、`en` 等代码。 |
| 百度翻译 API | `appid`、`secretKey` | `https://fanyi-api.baidu.com` | 插件自动生成 MD5 签名；目标语言会映射为 `zh`、`cht`、`en` 等代码。 |
| DeepL API | `Auth Key` | `https://api.deepl.com/v2` | 免费版可修改 Base URL 为 `https://api-free.deepl.com/v2`；请求头使用 `DeepL-Auth-Key`。 |
| Google 官方 API | `API Key` | `https://translation.googleapis.com` | 使用 Cloud Translation API v2；需先在 Google Cloud 启用接口并创建 API Key。 |
| Google 免费端点（非官方） | 无 | `https://translate.googleapis.com` | 免密钥，但可能受网络、限流或接口变更影响，不保证稳定可用。 |

填写完成后：

1. 点击“测试连接”。
2. 浏览器会弹出该引擎域名的权限申请。
3. 授权后，后台会使用原文 `Hello` 进行翻译测试。
4. 测试成功会显示测试译文。
5. 点击“保存引擎”保存配置。

保存时同样需要申请该引擎域名权限；若拒绝授权，表单内容会保留，但不会保存。

## 5.3 编辑引擎

在引擎列表中点击“编辑”：

- 可修改名称、Base URL、模型和 API Key。
- 编辑时 API Key 以密码形式显示，不会直接暴露在页面上。
- 若将 API Key 清空并保存，表示该引擎不发送 Authorization 请求头。

## 5.4 删除引擎

在引擎列表中点击“删除”，确认后即可移除该引擎。

如果删除的是当前默认引擎，设置会自动选择剩余第一个引擎作为默认；如果没有剩余引擎，则默认引擎为空。

## 5.5 设置默认引擎

在引擎列表中点击“设为默认”。网页划词翻译会使用默认引擎发起请求。

## 5.6 设置目标语言

点击工具栏扩展图标，在弹窗中可以修改“目标语言”。

- 默认值为 `简体中文`。
- 可修改为 `English`、`日语`、`繁體中文` 等任意目标语言描述。
- 输入框失焦或按下 Enter 后保存。
- 目标语言不能为空。

---

## 6. 使用划词翻译

## 6.1 翻译网页文本

1. 在普通 HTTP 或 HTTPS 网页中，用鼠标选中一段文本。
2. 鼠标松开后，选区附近会出现“译”按钮。
3. 点击“译”按钮。
4. 浮窗显示“正在翻译…”。
5. 翻译完成后，浮窗显示译文。
6. 可点击右上角关闭按钮、点击浮窗外部、按 Esc、滚动页面或调整窗口大小关闭浮窗。

## 6.2 异常情况

如果翻译失败，浮窗会显示中文错误提示，常见原因包括：

- 尚未设置默认引擎。
- 缺少引擎域名权限。
- Base URL 错误。
- API Key 无效。
- 模型名称错误或当前服务不支持。
- 网络不可达或请求超时。
- 服务返回非标准响应。

可先在设置页执行“测试连接”，确认引擎配置正确。

---

## 7. 权限说明

插件申请的权限如下：

| 权限 | 类型 | 用途 |
| --- | --- | --- |
| `storage` | 必需权限 | 保存引擎列表、默认引擎和目标语言。 |
| `<all_urls>` | 可选主机权限 | 在添加或测试引擎时，只请求该引擎 origin 的权限，用于后台访问翻译接口。 |

插件不会申请以下非必要权限：

- `tabs`
- `activeTab`
- `cookies`
- 剪贴板权限

---

## 8. 数据存储与安全

- 配置数据保存在 `chrome.storage.local` 中。
- 不会使用 `chrome.storage.sync` 同步到云端。
- API Key、appKey、appSecret 等凭证只会发送到对应引擎的 Base URL。
- 内容脚本只发送选中文本，不获取或发送 API Key、appKey、appSecret。
- 翻译请求在后台 Service Worker 中完成。
- 本地存储并非加密保险库，不建议在共享浏览器中保存高权限密钥。

---

## 9. 本地开发

## 9.1 安装依赖

```powershell
npm install
```

## 9.2 开发模式

```powershell
npm run dev
```

开发模式下可使用 Vite 的构建能力和 CRXJS 插件进行扩展开发。修改源码后可重新构建或刷新扩展。

## 9.3 类型检查

```powershell
npm run typecheck
```

用于检查 TypeScript 和 Vue SFC 的类型错误。

## 9.4 单元测试

```powershell
npm run test
```

当前测试覆盖：

- OpenAI 兼容请求构造与响应解析。
- 有道、百度、DeepL、Google 官方和 Google 免费端点的请求构造与响应解析。
- 有道签名、百度 MD5 签名、语言名称到语言代码的转换。
- 网络错误、HTTP 错误、无效 JSON 处理。
- Base URL 校验与 origin 权限匹配模式生成。
- 设置读取、保存与默认引擎回退逻辑。

## 9.5 生产构建

```powershell
npm run build
```

构建输出目录为：

```text
dist/
```

---

## 10. 项目目录结构

```text
translater/
├─ dist/                         # Chrome 扩展构建产物，可直接加载
├─ src/
│  ├─ background/
│  │  └─ index.ts                # 后台 Service Worker，处理翻译和测试消息
│  ├─ content/
│  │  ├─ content.css             # 划词浮窗样式，注入 Shadow DOM
│  │  ├─ index.ts                # 内容脚本，监听选区并请求翻译
│  │  └─ ui.ts                   # 翻译按钮和浮窗 UI
│  ├─ options/
│  │  ├─ index.html              # 设置页 HTML
│  │  ├─ main.ts                 # 设置页入口
│  │  └─ OptionsApp.vue          # 引擎管理设置页
│  ├─ popup/
│  │  ├─ index.html              # 工具栏弹窗 HTML
│  │  ├─ main.ts                 # 工具栏弹窗入口
│  │  └─ PopupApp.vue            # 默认引擎和目标语言配置弹窗
│  ├─ shared/
│  │  ├─ engine-meta.ts          # 引擎类型元数据和默认配置
│  │  ├─ language.ts             # 目标语言名称与语言代码映射
│  │  ├─ language.test.ts        # language 模块测试
│  │  ├─ openai.ts               # OpenAI 兼容接口请求与响应解析
│  │  ├─ openai.test.ts          # openai 模块测试
│  │  ├─ permissions.ts          # Base URL 校验和主机权限工具
│  │  ├─ permissions.test.ts     # permissions 模块测试
│  │  ├─ settings.ts             # 本地设置读写与归一化
│  │  ├─ settings.test.ts        # settings 模块测试
│  │  ├─ translate.ts            # 多引擎统一路由与传统接口适配器
│  │  ├─ translate.test.ts       # 传统接口适配器测试
│  │  └─ types.ts                # 共享类型定义
│  ├─ manifest.ts                # Chrome Manifest V3 配置
│  └─ vite-env.d.ts              # Vite 和 Vue 类型声明
├─ package.json                  # 依赖和脚本配置
├─ tsconfig.json                 # TypeScript 配置
├─ vite.config.ts                # Vite + CRXJS 构建配置
└─ 使用文档.md                    # 本文档
```

---

## 11. 验证记录

当前项目已通过以下自动检查：

- `npm run typecheck`：通过。
- `npm run test`：5 个测试文件、24 项测试全部通过。
- `npm run build`：构建成功，生成 `dist` 目录。

真实翻译服务的端到端验证需要用户在 Chrome 中加载扩展并填写自己的服务配置后完成。

---

## 12. 常见问题

### 12.1 为什么划词后没有出现翻译按钮？

可能原因：

- 当前页面是 Chrome 内部页面、Chrome Web Store 或 PDF 页面。
- 当前选中区域在输入框、文本域或 `contenteditable` 元素内。
- 选中文本为空。
- 插件已更新但网页未刷新，导致内容脚本失效。

解决方式：

- 刷新当前网页。
- 在普通 HTTP/HTTPS 页面中选中文本。
- 避免在输入框等受限区域使用。

### 12.2 为什么提示缺少主机权限？

插件不会在安装时默认获取所有网站权限。保存或测试引擎时，需要授权该服务所在域名。

解决方式：

- 打开设置页。
- 重新编辑并保存对应引擎。
- 在权限弹窗中允许访问该域名。

### 12.3 为什么测试连接失败？

请依次检查：

- Base URL 是否为 API 根路径，且未包含 `/chat/completions`。
- Base URL 是否使用 `http:` 或 `https:`。
- API Key 是否正确，或该服务是否无需 Key。
- 模型名称是否与服务支持的模型一致。
- 服务是否支持 OpenAI Chat Completions 兼容接口。
- 服务返回是否包含 `choices[0].message.content`。

### 12.4 为什么提示“尚未设置默认翻译引擎”？

说明当前没有保存任何引擎，或默认引擎为空。

解决方式：

- 打开设置页。
- 添加一个引擎并测试保存。
- 在列表中将该引擎设为默认。

### 12.5 修改源码后为什么网页行为没有变化？

解决方式：

1. 重新执行 `npm run build`。
2. 在 `chrome://extensions` 中点击扩展的刷新按钮。
3. 刷新目标网页。

### 12.6 API Key 会上传到哪里？

只会发送到你配置的翻译服务 Base URL 对应的 `/chat/completions` 接口，不会同步到云端，也不会发送到其他第三方服务。

---

## 13. 后续可扩展方向

以下功能不属于当前版本，可在后续迭代中考虑：

- 划词即译，无需点击按钮。
- 快捷键触发翻译。
- 翻译历史和收藏。
- 流式输出翻译结果。
- 支持更多预设服务模板。
- 支持输入框、PDF 或富文本区域翻译。
- 支持响应缓存和失败重试。
- 多语言界面国际化。
