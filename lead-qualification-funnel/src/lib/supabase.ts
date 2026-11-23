import { createClient } from '@supabase/supabase-js'

const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseUrl = configuredSupabaseUrl?.replace(/\/rest\/v1\/?$/i, '')
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase public URL and anonymous key are required.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})
