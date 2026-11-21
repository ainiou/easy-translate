<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  createEmptyEngine,
  ENGINE_TYPES,
  getEngineTypeLabel,
  getEngineTypeOption,
} from '../../shared/engine-meta'
import type { EngineType } from '../../shared/types'
import { errorMessage } from '../model'
import type { EngineEditPayload, PublicEngine } from '../model'
import type { ExtensionViewState } from '../protocol'
import * as api from './api'

type BusyAction = 'test' | 'save' | 'delete' | 'default' | 'target' | null

const emptyState = (): ExtensionViewState => ({
  engines: [],
  defaultEngineId: null,
  targetLanguage: '简体中文',
})
const emptyForm = (): EngineEditPayload => ({
  ...createEmptyEngine(),
  clearApiKey: false,
  clearAppSecret: false,
})

const state = ref<ExtensionViewState>(emptyState())
const targetLanguage = ref('简体中文')
const form = ref<EngineEditPayload>(emptyForm())
const formVisible = ref(false)
const loading = ref(true)
const busyAction = ref<BusyAction>(null)
const status = ref<{ type: 'success' | 'error'; message: string } | null>(null)
const testTranslation = ref('')

const isBusy = computed(() => busyAction.value !== null)
const isEditing = computed(() => Boolean(form.value.id))
const currentOption = computed(() => getEngineTypeOption(form.value.type))
const editingEngine = computed(() =>
  state.value.engines.find(
    (engine) => engine.id === form.value.id && engine.type === form.value.type,
  ),
)
const showModel = computed(() => form.value.type === 'openai-compatible')
const showApiKey = computed(() =>
  ['openai-compatible', 'deepl', 'google-official'].includes(form.value.type),
)
const showCredentials = computed(() => ['youdao', 'baidu'].includes(form.value.type))
const apiKeyLabel = computed(() => (form.value.type === 'deepl' ? 'Auth Key' : 'API Key'))
const hasStoredApiKey = computed(() => Boolean(editingEngine.value?.hasApiKey))
const hasStoredAppSecret = computed(() => Boolean(editingEngine.value?.hasAppSecret))
const apiKeyPlaceholder = computed(() =>
  hasStoredApiKey.value ? '已保存，留空保持不变' : currentOption.value.apiKeyPlaceholder,
)
const appSecretPlaceholder = computed(() =>
  hasStoredAppSecret.value ? '已保存，留空保持不变' : '请输入应用密钥',
)

function applyState(nextState: ExtensionViewState): void {
  state.value = nextState
  targetLanguage.value = nextState.targetLanguage
}

function showStatus(type: 'success' | 'error', message: string): void {
  status.value = { type, message }
}

function openCreateForm(): void {
  form.value = emptyForm()
  formVisible.value = true
  status.value = null
  testTranslation.value = ''
}

function openEditForm(engine: PublicEngine): void {
  form.value = {
    ...emptyForm(),
    id: engine.id,
    name: engine.name,
    type: engine.type,
    baseUrl: engine.baseUrl,
    model: engine.model,
    appId: engine.appId ?? '',
  }
  formVisible.value = true
  status.value = null
  testTranslation.value = ''
}

function closeForm(): void {
  formVisible.value = false
  form.value = emptyForm()
  testTranslation.value = ''
}

function handleTypeChange(type: EngineType): void {
  const defaults = createEmptyEngine(type)
  form.value = {
    ...form.value,
    type,
    baseUrl: defaults.baseUrl,
    model: '',
    apiKey: '',
    appId: '',
    appSecret: '',
    clearApiKey: false,
    clearAppSecret: false,
  }
  testTranslation.value = ''
}

async function saveTargetLanguage(): Promise<void> {
  if (!targetLanguage.value.trim()) {
    showStatus('error', '目标语言不能为空')
    return
  }
  busyAction.value = 'target'
  status.value = null
  try {
    applyState(await api.setTargetLanguage(targetLanguage.value))
    showStatus('success', '目标语言已保存')
  } catch (error) {
    showStatus('error', errorMessage(error))
  } finally {
    busyAction.value = null
  }
}

async function saveEngine(): Promise<void> {
  busyAction.value = 'save'
  status.value = null
  testTranslation.value = ''
  try {
    applyState(await api.saveEngine(form.value))
    closeForm()
    showStatus('success', '引擎已保存，密钥已存入 VS Code SecretStorage')
  } catch (error) {
    showStatus('error', errorMessage(error))
  } finally {
    busyAction.value = null
  }
}

async function testConnection(): Promise<void> {
  busyAction.value = 'test'
  status.value = null
  testTranslation.value = ''
  try {
    testTranslation.value = await api.testEngine(form.value)
    showStatus('success', '连接成功，测试原文为“Hello”')
  } catch (error) {
    showStatus('error', errorMessage(error))
  } finally {
    busyAction.value = null
  }
}

async function deleteEngine(engine: PublicEngine): Promise<void> {
  busyAction.value = 'delete'
  status.value = null
  try {
    const nextState = await api.deleteEngine(engine.id)
    const deleted = !nextState.engines.some((item) => item.id === engine.id)
    applyState(nextState)
    if (deleted) {
      if (form.value.id === engine.id) closeForm()
      showStatus('success', '引擎及其密钥已删除')
    }
  } catch (error) {
    showStatus('error', errorMessage(error))
  } finally {
    busyAction.value = null
  }
}

async function setDefaultEngine(engineId: string): Promise<void> {
  busyAction.value = 'default'
  status.value = null
  try {
    applyState(await api.setDefaultEngine(engineId))
    showStatus('success', '默认引擎已更新')
  } catch (error) {
    showStatus('error', errorMessage(error))
  } finally {
    busyAction.value = null
  }
}

onMounted(async () => {
  try {
    applyState(await api.getState())
  } catch (error) {
    showStatus('error', errorMessage(error))
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="page-shell">
    <header class="page-header">
      <div>
        <p class="eyebrow">EASY TRANSLATE · ET</p>
        <h1>翻译引擎设置</h1>
        <p class="subtitle">配置 OpenAI 兼容接口、有道、百度、DeepL 和 Google 翻译服务。</p>
      </div>
      <button class="button primary" type="button" :disabled="isBusy" @click="openCreateForm">
        添加引擎
      </button>
    </header>

    <p v-if="status" class="status" :class="status.type" role="status">{{ status.message }}</p>

    <section class="panel target-panel">
      <div>
        <h2>目标语言</h2>
        <p>支持语言名称或语言代码，例如简体中文、English、日语、en。</p>
      </div>
      <div class="target-control">
        <input
          v-model="targetLanguage"
          type="text"
          :disabled="isBusy"
          @keydown.enter="saveTargetLanguage"
        />
        <button class="button secondary" type="button" :disabled="isBusy" @click="saveTargetLanguage">
          {{ busyAction === 'target' ? '保存中…' : '保存' }}
        </button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>已配置的引擎</h2>
          <p>编辑器选区翻译使用标记为“默认”的引擎。</p>
        </div>
        <span class="count">{{ state.engines.length }} 个</span>
      </div>

      <p v-if="loading" class="empty-state">正在读取设置…</p>
      <div v-else-if="state.engines.length === 0" class="empty-state">
        <strong>还没有翻译引擎</strong>
        <span>点击“添加引擎”，填写服务配置后即可翻译编辑器选区。</span>
      </div>
      <ul v-else class="engine-list">
        <li v-for="engine in state.engines" :key="engine.id" class="engine-item">
          <div class="engine-info">
            <div class="engine-title-row">
              <h3>{{ engine.name }}</h3>
              <span class="type-badge">{{ getEngineTypeLabel(engine.type) }}</span>
              <span v-if="engine.id === state.defaultEngineId" class="default-badge">默认</span>
            </div>
            <p>{{ engine.baseUrl }}</p>
            <span v-if="engine.type === 'openai-compatible'">模型：{{ engine.model }}</span>
            <span v-else>源语言自动识别</span>
          </div>
          <div class="engine-actions">
            <button
              v-if="engine.id !== state.defaultEngineId"
              class="button text-button"
              type="button"
              :disabled="isBusy"
              @click="setDefaultEngine(engine.id)"
            >
              设为默认
            </button>
            <button class="button secondary" type="button" :disabled="isBusy" @click="openEditForm(engine)">
              编辑
            </button>
            <button class="button danger-text" type="button" :disabled="isBusy" @click="deleteEngine(engine)">
              删除
            </button>
          </div>
        </li>
      </ul>
    </section>

    <section v-if="formVisible" class="panel form-panel">
      <div class="panel-heading">
        <div>
          <h2>{{ isEditing ? '编辑引擎' : '添加引擎' }}</h2>
          <p>编辑时不会读取或回显已保存的密钥。</p>
        </div>
        <button class="icon-button" type="button" :disabled="isBusy" @click="closeForm">×</button>
      </div>

      <form autocomplete="off" @submit.prevent="saveEngine">
        <label class="field">
          <span>引擎类型 <b>*</b></span>
          <select
            v-model="form.type"
            :disabled="isBusy"
            @change="handleTypeChange(($event.target as HTMLSelectElement).value as EngineType)"
          >
            <option v-for="option in ENGINE_TYPES" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <small>{{ currentOption.description }}</small>
        </label>

        <div class="form-grid">
          <label class="field">
            <span>引擎名称 <b>*</b></span>
            <input v-model="form.name" type="text" placeholder="例如：OpenAI / 有道" :disabled="isBusy" required />
          </label>
          <label v-if="showModel" class="field">
            <span>模型 <b>*</b></span>
            <input v-model="form.model" type="text" :disabled="isBusy" required />
          </label>
        </div>

        <label class="field">
          <span>Base URL <b>*</b></span>
          <input v-model="form.baseUrl" type="text" inputmode="url" :disabled="isBusy" required />
          <small>填写 API 根路径；VS Code 扩展直接发起请求，无需 Chrome 主机权限。</small>
        </label>

        <div v-if="showCredentials" class="form-grid">
          <label class="field">
            <span>{{ currentOption.appIdLabel }} <b>*</b></span>
            <input v-model="form.appId" type="text" autocomplete="off" :disabled="isBusy" />
          </label>
          <label class="field">
            <span>{{ currentOption.appSecretLabel }} <b>*</b></span>
            <input
              v-model="form.appSecret"
              type="password"
              autocomplete="new-password"
              :placeholder="appSecretPlaceholder"
              :disabled="isBusy || form.clearAppSecret"
            />
          </label>
        </div>
        <label v-if="showCredentials && hasStoredAppSecret" class="clear-secret">
          <input v-model="form.clearAppSecret" type="checkbox" :disabled="isBusy" />
          清除已保存的应用密钥
        </label>

        <label v-if="showApiKey" class="field">
          <span>{{ apiKeyLabel }}</span>
          <input
            v-model="form.apiKey"
            type="password"
            autocomplete="new-password"
            :placeholder="apiKeyPlaceholder"
            :disabled="isBusy || form.clearApiKey"
          />
          <small>DeepL 与 Google 官方接口必填；OpenAI 兼容服务可按需填写。</small>
        </label>
        <label v-if="showApiKey && hasStoredApiKey" class="clear-secret">
          <input v-model="form.clearApiKey" type="checkbox" :disabled="isBusy" />
          清除已保存的 {{ apiKeyLabel }}
        </label>

        <div v-if="testTranslation" class="test-result">
          <span>测试译文</span>
          <strong>{{ testTranslation }}</strong>
        </div>

        <div class="form-actions">
          <button class="button secondary" type="button" :disabled="isBusy" @click="testConnection">
            {{ busyAction === 'test' ? '正在测试…' : '测试连接' }}
          </button>
          <div>
            <button class="button text-button" type="button" :disabled="isBusy" @click="closeForm">取消</button>
            <button class="button primary" type="submit" :disabled="isBusy">
              {{ busyAction === 'save' ? '正在保存…' : '保存引擎' }}
            </button>
          </div>
        </div>
      </form>
    </section>

    <aside class="security-note">
      <strong>密钥存储说明</strong>
      <p>API Key 与 appSecret 仅保存在 VS Code SecretStorage，设置 Webview 不会读取已保存的密钥。</p>
    </aside>
  </main>
</template>

<style scoped>
:global(*) { box-sizing: border-box; }
:global(body) { margin: 0; color: var(--vscode-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); }
button, input, select { font: inherit; }
.page-shell { width: min(960px, calc(100% - 40px)); margin: 0 auto; padding: 36px 0; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 20px; }
.eyebrow { margin: 0 0 8px; color: var(--vscode-textLink-foreground); font-size: 11px; font-weight: 700; letter-spacing: .12em; }
h1, h2, h3, p { margin-top: 0; }
h1 { margin-bottom: 8px; font-size: 26px; }
h2 { margin-bottom: 6px; font-size: 16px; }
.subtitle, .panel-heading p, .target-panel p { margin-bottom: 0; color: var(--vscode-descriptionForeground); font-size: 13px; line-height: 1.6; }
.panel { margin-top: 16px; padding: 20px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: var(--vscode-editorWidget-background); }
.panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.target-panel { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.target-control { display: flex; flex-shrink: 0; gap: 8px; }
.target-control input, .field input, .field select { min-width: 0; padding: 7px 9px; border: 1px solid var(--vscode-input-border, transparent); border-radius: 4px; outline: none; color: var(--vscode-input-foreground); background: var(--vscode-input-background); }
.target-control input { width: 180px; }
.target-control input:focus, .field input:focus, .field select:focus { border-color: var(--vscode-focusBorder); }
.count, .default-badge, .type-badge { flex-shrink: 0; padding: 3px 8px; border-radius: 999px; font-size: 11px; }
.count, .default-badge { color: var(--vscode-badge-foreground); background: var(--vscode-badge-background); }
.type-badge { color: var(--vscode-textLink-foreground); background: var(--vscode-textBlockQuote-background); }
.engine-list { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.engine-item { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 14px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; }
.engine-info { min-width: 0; }
.engine-title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; }
.engine-title-row h3 { margin: 0; font-size: 14px; }
.engine-info p { overflow: hidden; margin-bottom: 4px; color: var(--vscode-descriptionForeground); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.engine-info > span { color: var(--vscode-descriptionForeground); font-size: 12px; }
.engine-actions, .form-actions, .form-actions > div { display: flex; align-items: center; gap: 8px; }
.engine-actions { flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
.button, .icon-button { border: 0; border-radius: 4px; cursor: pointer; }
.button { padding: 7px 12px; font-size: 12px; }
.button:disabled, .icon-button:disabled, input:disabled, select:disabled { cursor: not-allowed; opacity: .55; }
.primary { color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
.primary:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
.secondary:hover:not(:disabled) { background: var(--vscode-button-secondaryHoverBackground); }
.text-button { color: var(--vscode-textLink-foreground); background: transparent; }
.danger-text { color: var(--vscode-errorForeground); background: transparent; }
.icon-button { width: 30px; height: 30px; color: var(--vscode-foreground); background: var(--vscode-button-secondaryBackground); font-size: 20px; }
.status { margin-bottom: 14px; padding: 10px 12px; border-radius: 4px; font-size: 13px; }
.status.success { color: var(--vscode-testing-iconPassed); background: var(--vscode-textBlockQuote-background); }
.status.error { color: var(--vscode-errorForeground); background: var(--vscode-inputValidation-errorBackground); }
.empty-state { display: grid; gap: 7px; margin: 0; padding: 24px 10px; color: var(--vscode-descriptionForeground); text-align: center; font-size: 13px; }
.form-panel form, .field { display: grid; gap: 14px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.field { gap: 6px; font-size: 12px; font-weight: 600; }
.field b { color: var(--vscode-errorForeground); }
.field input, .field select { width: 100%; font-size: 13px; font-weight: 400; }
.field small { color: var(--vscode-descriptionForeground); font-weight: 400; line-height: 1.5; }
.clear-secret { display: flex; align-items: center; gap: 7px; margin-top: -6px; color: var(--vscode-descriptionForeground); font-size: 12px; }
.form-actions { justify-content: space-between; margin-top: 4px; }
.test-result { display: grid; gap: 5px; padding: 10px 12px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; font-size: 12px; }
.test-result strong { white-space: pre-wrap; }
.security-note { margin-top: 18px; color: var(--vscode-descriptionForeground); font-size: 12px; line-height: 1.6; }
.security-note p { margin: 4px 0 0; }
@media (max-width: 680px) {
  .page-shell { width: calc(100% - 24px); padding: 24px 0; }
  .page-header, .engine-item, .target-panel { align-items: stretch; flex-direction: column; }
  .page-header .button { align-self: flex-start; }
  .target-control input { width: 100%; }
  .engine-actions { justify-content: flex-start; }
  .form-grid { grid-template-columns: 1fr; }
}
</style>
