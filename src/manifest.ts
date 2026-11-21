import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: '划词翻译',
  version: '0.0.1',
  description: '使用自定义 OpenAI 兼容接口翻译网页选中文本。',
  permissions: ['storage'],
  optional_host_permissions: ['<all_urls>'],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: '划词翻译',
  },
  options_page: 'src/options/index.html',
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
})
