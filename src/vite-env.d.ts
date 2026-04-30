/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DISCORD_URL?: string;
  readonly VITE_X_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
