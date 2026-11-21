import { builtinModules } from 'node:module'
import { defineConfig } from 'vite'

const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
])

export default defineConfig({
  build: {
    outDir: 'dist-vscode',
    emptyOutDir: true,
    target: 'node16',
    sourcemap: true,
    minify: false,
    lib: {
      entry: 'src/vscode/extension.ts',
      formats: ['cjs'],
      fileName: () => 'extension.cjs',
    },
    rollupOptions: {
      external: ['vscode', ...nodeBuiltins],
    },
  },
})
