/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOMOKU_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
