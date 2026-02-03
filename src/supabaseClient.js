import { createClient } from '@supabase/supabase-js'

// Fallback to hardcoded values if env vars are missing (Common in GH Actions if access is tricky)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qrkdwampnvjcervyusrp.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_IjT8CLT51HzpkLZYsM4xBQ_dRaz1V9B'

export const supabase = createClient(supabaseUrl, supabaseKey)
