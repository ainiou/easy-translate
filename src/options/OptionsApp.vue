<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { createEmptyEngine, ENGINE_TYPES, getEngineTypeLabel } from '../shared/engine-meta'
import { normalizeBaseUrl, requestEnginePermission } from '../shared/permissions'
import { createDefaultSettings, getSettings, saveSettings } from '../shared/settings'
import type {
  BackgroundResponse,
  EngineConfig,
  EngineType,
  ExtensionSettings,
  HoldTriggerKey,
  TestEngineMessage,
} from '../shared/types'

interface StatusMessage {
  type: 'success' | 'error'
  message: string
}

const settings = ref<ExtensionSettings>(createDefaultSettings())
const form = ref<EngineConfig>(createEmptyForm())
const formVisible = ref(false)
const loading = ref(true)
const busyAction = ref<'test' | 'save' | 'delete' | 'default' | 'trigger' | null>(null)
const status = ref<StatusMessage | null>(null)
const testTranslation = ref('')

const isEditing = computed(() => Boolean(form.value.id))
const isBusy = computed(() => busyAction.value !== null)
const engineTypeOptions = ENGINE_TYPES
const currentType = computed(() => form.value.type)
const showModel = computed(() => currentType.value === 'openai-compatible')
const showApiKey = computed(() =>
  ['openai-compatible', 'deepl', 'google-official'].includes(currentType.value),
)
const showCredentials = computed(() => ['youdao', 'baidu'].includes(currentType.value))
const apiKeyLabel = computed(() => (currentType.value === 'deepl' ? 'Auth Key' : 'API Key'))
const triggerKeyOptions: Array<{ value: HoldTriggerKey; label: string }> = [
  { value: 'Alt', label: 'Alt' },
  { value: 'Control', label: 'Ctrl' },
  { value: 'Shift', label: 'Shift' },
]

function createEmptyForm(): EngineConfig {
  return createEmptyEngine('openai-compatible')
}

function handleTypeChange(type: EngineType): void {
  const defaults = createEmptyEngine(type)
  form.value = {
    ...form.value,
    type,
    baseUrl: defaults.baseUrl,
    model: defaults.model,
    apiKey: defaults.apiKey,
    appId: defaults.appId,
    appSecret: defaults.appSecret,
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}

async function loadSettings(): Promise<void> {
  settings.value = await getSettings()
}

function showStatus(type: StatusMessage['type'], message: string): void {
  status.value = { type, message }
}

function openCreateForm(): void {
  form.value = createEmptyForm()
  formVisible.value = true
  status.value = null
  testTranslation.value = ''
}

function openEditForm(engine: EngineConfig): void {
  form.value = { ...engine }
  formVisible.value = true
  status.value = null
  testTranslation.value = ''
}

function closeForm(): void {
  formVisible.value = false
  form.value = createEmptyForm()
  testTranslation.value = ''
}

function validatedEngine(): EngineConfig {
  const name = form.value.name.trim()
  if (!name) throw new Error('请填写引擎名称')

  const baseUrl = normalizeBaseUrl(form.value.baseUrl)
  const apiKey = form.value.apiKey.trim()
  const appId = form.value.appId?.trim() ?? ''
  const appSecret = form.value.appSecret?.trim() ?? ''
  const model = form.value.model.trim()

  switch (form.value.type) {
    case 'openai-compatible':
      if (!model) throw new Error('请填写模型名称')
      break
    case 'youdao':
      if (!appId || !appSecret) throw new Error('请填写有道 appKey 和 appSecret')
      break
    case 'baidu':
      if (!appId || !appSecret) throw new Error('请填写百度 appid 和 secretKey')
      break
    case 'deepl':
    case 'google-official':
      if (!apiKey) throw new Error(`请填写${apiKeyLabel.value}`)
      break
    default:
      break
  }

  return {
    id: form.value.id || crypto.randomUUID(),
    name,
    type: form.value.type,
    baseUrl,
    apiKey,
    model,
    appId,
    appSecret,
  }
}

async function requestPermission(baseUrl: string): Promise<boolean> {
  const granted = await requestEnginePermission(baseUrl)
  if (!granted) {
    showStatus('error', '未获得该服务的主机权限，无法测试或保存引擎')
  }
  return granted
}

async function testConnection(): Promise<void> {
  status.value = null
  testTranslation.value = ''

  let engine: EngineConfig
  try {
    engine = validatedEngine()
  } catch (error) {
    showStatus('error', errorMessage(error))
    return
  }

  busyAction.value = 'test'
  try {
    if (!(await requestPermission(engine.baseUrl))) return

    const message: TestEngineMessage = { type: 'testEngine', engine }
    const response = (await chrome.runtime.sendMessage(
      message,
    )) as BackgroundResponse
    if (!response.ok) {
      showStatus('error', response.error)
      return
    }

    testTranslation.value = response.translation
    showStatus('success', '连接成功，测试原文为“Hello”')
  } catch (error) {
    showStatus('error', errorMessage(error))
  } finally {
    busyAction.value = null
  }
}

async function saveEngine(): Promise<void> {
  status.value = null
  testTranslation.value = ''

  let engine: EngineConfig
  try {
    engine = validatedEngine()
  } catch (error) {
    showStatus('error', errorMessage(error))
    return
  }

  busyAction.value = 'save'
  try {
    if (!(await requestPermission(engine.baseUrl))) return

    const engines = isEditing.value
      ? settings.value.engines.map((item) => (item.id === engine.id ? engine : item))
      : [...settings.value.engines, engine]
    await saveSettings({
      ...settings.value,
      engines,
      defaultEngineId: settings.value.defaultEngineId ?? engine.id,
    })
    await loadSettings()
    closeForm()
    showStatus('success', '引擎已保存')
  } catch (error) {
    showStatus('error', errorMessage(error))
  } finally {
    busyAction.value = null
  }
}

async function deleteEngine(engine: EngineConfig): Promise<void> {
  if (!window.confirm(`确定删除引擎“${engine.name}”吗？`)) return

  busyAction.value = 'delete'
  status.value = null
  try {
    await saveSettings({
      ...settings.value,
      engines: settings.value.engines.filter((item) => item.id !== engine.id),
    })
    await loadSettings()
    if (form.value.id === engine.id) closeForm()
    showStatus('success', '引擎已删除')
  } catch (error) {
    showStatus('error', errorMessage(error))
  } finally {
    busyAction.value = null
  }
}

async function setDefaultEngine(engineId: string): Promise<void> {
  if (settings.value.defaultEngineId === engineId) return

  busyAction.value = 'default'
  status.value = null
  try {
    await saveSettings({ ...settings.value, defaultEngineId: engineId })
    await loadSettings()
    showStatus('success', '默认引擎已更新')
  } catch (error) {
    showStatus('error', errorMessage(error))
  } finally {
    busyAction.value = null
  }
}

async function saveTriggerSettings(): Promise<void> {
  busyAction.value = 'trigger'
  status.value = null
  try {
    await saveSettings(settings.value)
    showStatus('success', '触发方式已保存')
  } catch (error) {
    showStatus('error', errorMessage(error))
  } finally {
    busyAction.value = null
  }
}

function handleHoldToggle(enabled: boolean): void {
  settings.value.holdToTranslate = enabled
  void saveTriggerSettings()
}

function handleTriggerKeyChange(key: HoldTriggerKey): void {
  settings.value.holdTriggerKey = key
  void saveTriggerSettings()
}

onMounted(async () => {
  try {
    await loadSettings()
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
        <p class="subtitle">支持 OpenAI 兼容接口、有道、百度、DeepL 和 Google 翻译服务。</p>
      </div>
      <button class="button primary" type="button" :disabled="isBusy" @click="openCreateForm">
        添加引擎
      </button>
    </header>

    <p v-if="status" class="status" :class="status.type" role="status">
      {{ status.message }}
    </p>

    <section class="panel" aria-labelledby="engine-list-title">
      <div class="panel-heading">
        <div>
          <h2 id="engine-list-title">已配置的引擎</h2>
          <p>划词翻译使用标记为“默认”的引擎。</p>
        </div>
        <span class="count">{{ settings.engines.length }} 个</span>
      </div>

      <p v-if="loading" class="empty-state">正在读取设置…</p>
      <div v-else-if="settings.engines.length === 0" class="empty-state">
        <strong>还没有翻译引擎</strong>
        <span>点击“添加引擎”，选择引擎类型并填写对应凭证即可开始。</span>
      </div>
      <ul v-else class="engine-list">
        <li v-for="engine in settings.engines" :key="engine.id" class="engine-item">
          <div class="engine-info">
            <div class="engine-title-row">
              <h3>{{ engine.name }}</h3>
              <span class="type-badge">{{ getEngineTypeLabel(engine.type) }}</span>
              <span v-if="engine.id === settings.defaultEngineId" class="default-badge">默认</span>
            </div>
            <p>{{ engine.baseUrl }}</p>
            <span v-if="engine.type === 'openai-compatible'">模型：{{ engine.model }}</span>
            <span v-else>目标语言由工具栏弹窗配置，源语言自动识别</span>
          </div>
          <div class="engine-actions">
            <button
              v-if="engine.id !== settings.defaultEngineId"
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

    <section v-if="formVisible" class="panel form-panel" aria-labelledby="engine-form-title">
      <div class="panel-heading">
        <div>
          <h2 id="engine-form-title">{{ isEditing ? '编辑引擎' : '添加引擎' }}</h2>
          <p>选择引擎类型后，页面会显示对应的凭证和 Base URL 配置。</p>
        </div>
        <button class="icon-button" type="button" aria-label="关闭表单" :disabled="isBusy" @click="closeForm">×</button>
      </div>

      <form autocomplete="off" @submit.prevent="saveEngine">
        <label class="field">
          <span>引擎类型 <b>*</b></span>
          <select
            v-model="form.type"
            :disabled="isBusy"
            @change="handleTypeChange(($event.target as HTMLSelectElement).value as EngineType)"
          >
            <option v-for="option in engineTypeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <small>{{ engineTypeOptions.find((option) => option.value === form.type)?.description }}</small>
        </label>
        <div class="form-grid">
          <label class="field">
            <span>引擎名称 <b>*</b></span>
            <input v-model="form.name" type="text" placeholder="例如：OpenAI / 有道 / 百度" :disabled="isBusy" required />
          </label>
          <label v-if="showModel" class="field">
            <span>模型 <b>*</b></span>
            <input v-model="form.model" type="text" placeholder="填写服务支持的模型名称" :disabled="isBusy" required />
          </label>
        </div>
        <label class="field">
          <span>Base URL <b>*</b></span>
          <input
            v-model="form.baseUrl"
            type="text"
            inputmode="url"
            placeholder="https://api.openai.com/v1"
            :disabled="isBusy"
            required
          />
          <small>支持 HTTP/HTTPS，也兼容本地服务；保存时会申请该域名权限。</small>
        </label>
        <div v-if="showCredentials" class="form-grid">
          <label class="field">
            <span>{{ engineTypeOptions.find((option) => option.value === form.type)?.appIdLabel }} <b>*</b></span>
            <input v-model="form.appId" type="text" autocomplete="off" :disabled="isBusy" />
          </label>
          <label class="field">
            <span>{{ engineTypeOptions.find((option) => option.value === form.type)?.appSecretLabel }} <b>*</b></span>
            <input v-model="form.appSecret" type="password" autocomplete="new-password" :disabled="isBusy" />
          </label>
        </div>
        <label v-if="showApiKey" class="field">
          <span>{{ apiKeyLabel }}</span>
          <input
            v-model="form.apiKey"
            type="password"
            autocomplete="new-password"
            :placeholder="engineTypeOptions.find((option) => option.value === form.type)?.apiKeyPlaceholder"
            :disabled="isBusy"
          />
          <small>编辑时密钥以密码形式隐藏；DeepL 与 Google 官方接口必填。</small>
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

    <section class="panel" aria-labelledby="trigger-mode-title">
      <div class="panel-heading">
        <div>
          <h2 id="trigger-mode-title">翻译触发方式</h2>
          <p>控制划词翻译在什么时候开始。</p>
        </div>
      </div>

      <label class="toggle-field">
        <input
          type="checkbox"
          :checked="settings.holdToTranslate"
          :disabled="isBusy"
          @change="handleHoldToggle(($event.target as HTMLInputElement).checked)"
        />
        <span>
          <strong>仅按住触发键时触发翻译</strong>
          <small>
            关闭时保持原有行为：划词后点击“译”按钮翻译。开启后需按住触发键并划词才会翻译，松开触发键立即取消并关闭浮窗。
          </small>
        </span>
      </label>

      <label class="field trigger-key-field">
        <span>触发键</span>
        <select
          :value="settings.holdTriggerKey"
          :disabled="isBusy || !settings.holdToTranslate"
          @change="handleTriggerKeyChange(($event.target as HTMLSelectElement).value as HoldTriggerKey)"
        >
          <option v-for="option in triggerKeyOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <small>按住该键并划词后自动翻译，松开即关闭；快速点按不会触发。</small>
      </label>
    </section>

    <aside class="security-note">
      <strong>密钥存储说明</strong>
      <p>
        API Key 仅保存在当前浏览器的 chrome.storage.local，不会同步，也只会发送到对应引擎的 Base URL。
        该存储并非加密保险库，请避免在共享浏览器配置中保存高权限密钥。
      </p>
    </aside>
  </main>
</template>

<style scoped>
:global(*) {
  box-sizing: border-box;
}

:global(body) {
  margin: 0;
  min-width: 320px;
  color: #182230;
  background: #f4f6fa;
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
}

button,
input,
select {
  font: inherit;
}

.page-shell {
  width: min(960px, calc(100% - 40px));
  margin: 0 auto;
  padding: 48px 0;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 8px;
  color: #5b62d6;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 10px;
  font-size: 30px;
  letter-spacing: -0.03em;
}

.subtitle,
.panel-heading p {
  margin-bottom: 0;
  color: #667085;
  line-height: 1.6;
}

.panel {
  margin-top: 18px;
  padding: 24px;
  border: 1px solid #e5e9f0;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 28px rgb(31 42 68 / 5%);
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.panel-heading h2 {
  margin-bottom: 6px;
  font-size: 18px;
}

.panel-heading p {
  font-size: 13px;
}

.count,
.default-badge,
.type-badge {
  flex-shrink: 0;
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.count,
.default-badge {
  color: #4f56c5;
  background: #eef0ff;
}

.type-badge {
  color: #0f766e;
  background: #d9f7f1;
}

.engine-list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.engine-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px;
  border: 1px solid #e8ebf1;
  border-radius: 12px;
}

.engine-info {
  min-width: 0;
}

.engine-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 7px;
}

.engine-title-row h3 {
  margin: 0;
  font-size: 16px;
}

.engine-info p {
  overflow: hidden;
  margin-bottom: 5px;
  color: #475467;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.engine-info > span {
  color: #7a8494;
  font-size: 12px;
}

.engine-actions,
.form-actions,
.form-actions > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.engine-actions {
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.button,
.icon-button {
  border: 0;
  cursor: pointer;
  transition: background 0.16s ease, transform 0.16s ease;
}

.button {
  padding: 9px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
}

.button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.button:disabled,
.icon-button:disabled,
input:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.primary {
  color: #fff;
  background: #565ed8;
}

.primary:hover:not(:disabled) {
  background: #464dc2;
}

.secondary {
  color: #3f4654;
  background: #eef1f5;
}

.secondary:hover:not(:disabled) {
  background: #e2e7ed;
}

.text-button {
  color: #4f56c5;
  background: transparent;
}

.danger-text {
  color: #c33d4b;
  background: transparent;
}

.icon-button {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: #667085;
  background: #f1f3f7;
  font-size: 22px;
  line-height: 1;
}

.status {
  margin-bottom: 16px;
  padding: 12px 15px;
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.5;
}

.status.success {
  color: #176b47;
  background: #e8f6ef;
}

.status.error {
  color: #a72f3e;
  background: #fff0f1;
}

.empty-state {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 28px 12px;
  color: #7a8494;
  text-align: center;
  font-size: 14px;
}

.empty-state strong {
  color: #344054;
  font-size: 16px;
}

.form-panel form,
.field {
  display: grid;
  gap: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.field {
  gap: 7px;
  color: #344054;
  font-size: 13px;
  font-weight: 600;
}

.field b {
  color: #d14856;
}

.field input,
.field select {
  width: 100%;
  padding: 11px 12px;
  border: 1px solid #d8dee8;
  border-radius: 8px;
  outline: none;
  color: #182230;
  background: #fff;
  font-size: 14px;
  font-weight: 400;
}

.field input:focus,
.field select:focus {
  border-color: #6870df;
  box-shadow: 0 0 0 3px rgb(86 94 216 / 12%);
}

.field small {
  color: #7a8494;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.5;
}

.form-actions {
  justify-content: space-between;
  margin-top: 4px;
}

.test-result {
  display: grid;
  gap: 5px;
  padding: 12px 14px;
  border-radius: 8px;
  color: #176b47;
  background: #eef8f3;
  font-size: 13px;
}

.test-result strong {
  white-space: pre-wrap;
}

.security-note {
  margin-top: 20px;
  padding: 0 4px;
  color: #667085;
  font-size: 12px;
  line-height: 1.7;
}

.toggle-field {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 16px;
  cursor: pointer;
}

.toggle-field input {
  width: 16px;
  height: 16px;
  margin-top: 2px;
  accent-color: #565ed8;
}

.toggle-field span {
  display: grid;
  gap: 4px;
}

.toggle-field strong {
  color: #344054;
  font-size: 13px;
}

.toggle-field small {
  color: #8a93a2;
  font-size: 11px;
  line-height: 1.6;
}

.trigger-key-field {
  max-width: 240px;
}

.security-note strong {
  color: #475467;
}

.security-note p {
  margin: 4px 0 0;
}

@media (max-width: 680px) {
  .page-shell {
    width: min(100% - 24px, 960px);
    padding: 28px 0;
  }

  .page-header,
  .engine-item {
    align-items: stretch;
    flex-direction: column;
  }

  .page-header .button {
    align-self: flex-start;
  }

  .engine-actions {
    justify-content: flex-start;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .panel {
    padding: 18px;
  }
}
</style>
