/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TRIAL_BALANCE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
