import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const environment = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const supabaseUrl = environment.VITE_SUPABASE_URL ?? ''
  const supabaseAnonKey = environment.VITE_SUPABASE_ANON_KEY ?? ''

  return {
    plugins: [react()],
    server: {
      allowedHosts: ['sb-4van2yl0u6.vercel.run', 'sb-4cazmx4g1lg.vercel.run', 'multi-step-qualification-funnel-qualification-funnel.v0.build', 'multi-step-qualification-funnel.v0.build'],
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
  }
})
