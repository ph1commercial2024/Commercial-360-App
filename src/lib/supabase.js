import { createClient } from '@supabase/supabase-js'
import { timedFetch } from './fetchTimeout.js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// timedFetch: a stalled connection fails after 30 s instead of hanging (uploads and functions excluded)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { fetch: timedFetch() } })
