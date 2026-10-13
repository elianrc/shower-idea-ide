import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

const githubClientId = process.env.VIVLIO_GITHUB_CLIENT_ID ?? ''
const githubAuthBrokerUrl = process.env.VIVLIO_GITHUB_AUTH_BROKER_URL ?? ''

export default defineConfig({
  main: {
    define: {
      __VIVLIO_GITHUB_CLIENT_ID__: JSON.stringify(githubClientId),
      __VIVLIO_GITHUB_AUTH_BROKER_URL__: JSON.stringify(githubAuthBrokerUrl),
    },
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        input: resolve('apps/desktop/src/main/index.ts'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload',
      rollupOptions: {
        input: resolve('apps/desktop/src/preload/index.ts'),
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  renderer: {
    root: resolve('apps/desktop'),
    plugins: [react()],
    build: {
      outDir: resolve('dist/renderer'),
      rollupOptions: {
        input: resolve('apps/desktop/index.html'),
      },
    },
  },
})
