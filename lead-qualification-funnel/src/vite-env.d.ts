interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_N8N_LEAD_WEBHOOK_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
