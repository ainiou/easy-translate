<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { createDefaultSettings, getSettings, saveSettings } from '../shared/settings'
import type { ExtensionSettings } from '../shared/types'

const settings = ref<ExtensionSettings>(createDefaultSettings())
const selectedEngineId = ref('')
const targetLanguage = ref('简体中文')
const loading = ref(true)
const saving = ref(false)
const error = ref('')

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : '设置保存失败，请稍后重试'
}

async function persistSettings(successMessage?: string): Promise<void> {
  error.value = ''
  saving.value = true
  try {
    await saveSettings(settings.value)
    if (successMessage) error.value = ''
  } catch (reason) {
    error.value = errorMessage(reason)
  } finally {
    saving.value = false
  }
}

async function updateDefaultEngine(): Promise<void> {
  settings.value.defaultEngineId = selectedEngineId.value || null
  await persistSettings()
}

async function updateTargetLanguage(): Promise<void> {
  const language = targetLanguage.value.trim()
  if (!language) {
    error.value = '目标语言不能为空'
    targetLanguage.value = settings.value.targetLanguage
    return
  }

  settings.value.targetLanguage = language
  targetLanguage.value = language
  await persistSettings()
}

function openOptions(): void {
  void chrome.runtime.openOptionsPage()
}

onMounted(async () => {
  try {
    settings.value = await getSettings()
    selectedEngineId.value = settings.value.defaultEngineId ?? ''
    targetLanguage.value = settings.value.targetLanguage
  } catch (reason) {
    error.value = errorMessage(reason)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="popup-shell">
    <header>
      <div class="brand-mark" aria-hidden="true">译</div>
      <div>
        <h1>划词翻译</h1>
        <p>选中网页文字，点击翻译按钮</p>
      </div>
    </header>

    <p v-if="loading" class="loading">正在读取设置…</p>
    <template v-else>
      <div v-if="settings.engines.length === 0" class="empty-state">
        <strong>先添加一个翻译引擎</strong>
        <p>支持 OpenAI Chat Completions 兼容接口，密钥仅保存在本地。</p>
        <button class="primary-button" type="button" @click="openOptions">添加引擎</button>
      </div>

      <div v-else class="settings-form">
        <label>
          <span>默认引擎</span>
          <select v-model="selectedEngineId" :disabled="saving" @change="updateDefaultEngine">
            <option v-for="engine in settings.engines" :key="engine.id" :value="engine.id">
              {{ engine.name }} · {{ engine.model }}
            </option>
          </select>
        </label>
        <label>
          <span>目标语言</span>
          <input
            v-model="targetLanguage"
            type="text"
            placeholder="例如：简体中文"
            :disabled="saving"
            @change="updateTargetLanguage"
            @keydown.enter.prevent="updateTargetLanguage"
          />
          <small>修改后点击输入框外部或按 Enter 保存</small>
        </label>
      </div>

      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-else-if="saving" class="saving">正在保存…</p>

      <footer>
        <span>{{ settings.engines.length }} 个可用引擎</span>
        <button type="button" :disabled="saving" @click="openOptions">管理引擎</button>
      </footer>
    </template>
  </main>
</template>

<style scoped>
:global(*) {
  box-sizing: border-box;
}

:global(body) {
  margin: 0;
  color: #1d2939;
  background: #fff;
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
}

button,
input,
select {
  font: inherit;
}

.popup-shell {
  width: 340px;
  padding: 20px;
}

header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.brand-mark {
  display: grid;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 11px;
  color: #fff;
  background: #565ed8;
  font-size: 19px;
  font-weight: 700;
}

h1 {
  margin: 0 0 4px;
  font-size: 18px;
}

header p {
  margin: 0;
  color: #7a8494;
  font-size: 12px;
}

.loading {
  margin: 24px 0;
  color: #7a8494;
  text-align: center;
  font-size: 13px;
}

.empty-state {
  padding: 18px;
  border-radius: 12px;
  background: #f4f6fa;
  text-align: center;
}

.empty-state strong {
  font-size: 15px;
}

.empty-state p {
  margin: 8px 0 16px;
  color: #667085;
  font-size: 12px;
  line-height: 1.6;
}

.primary-button {
  padding: 9px 16px;
  border: 0;
  border-radius: 8px;
  color: #fff;
  background: #565ed8;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.settings-form {
  display: grid;
  gap: 16px;
}

.settings-form label {
  display: grid;
  gap: 7px;
  color: #344054;
  font-size: 12px;
  font-weight: 600;
}

.settings-form input,
.settings-form select {
  width: 100%;
  min-height: 38px;
  padding: 8px 10px;
  border: 1px solid #d8dee8;
  border-radius: 8px;
  outline: none;
  color: #1d2939;
  background: #fff;
  font-size: 13px;
  font-weight: 400;
}

.settings-form input:focus,
.settings-form select:focus {
  border-color: #6870df;
  box-shadow: 0 0 0 3px rgb(86 94 216 / 12%);
}

.settings-form small {
  color: #8a93a2;
  font-size: 11px;
  font-weight: 400;
}

.error,
.saving {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.5;
}

.error {
  color: #b42318;
}

.saving {
  color: #667085;
}

footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid #edf0f4;
}

footer span {
  color: #8a93a2;
  font-size: 11px;
}

footer button {
  padding: 5px 0;
  border: 0;
  color: #4f56c5;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

button:disabled,
input:disabled,
select:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
