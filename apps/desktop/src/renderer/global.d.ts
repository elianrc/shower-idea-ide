import type { AppApi } from '../shared/types'

declare global {
  interface MonacoEnvironment {
    getWorker(): Worker
  }

  var MonacoEnvironment: MonacoEnvironment

  interface Window {
    vivlio: AppApi
  }
}

export {}
