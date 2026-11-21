import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const webviewRoot = fileURLToPath(new URL('./src/vscode/webview', import.meta.url))
const outputDirectory = fileURLToPath(new URL('./dist-vscode/webview', import.meta.url))

export default defineConfig({
  root: webviewRoot,
  base: './',
  plugins: [vue()],
  build: {
    outDir: outputDirectory,
    emptyOutDir: false,
    target: 'es2022',
  },
})
