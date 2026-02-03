import { createClient } from '@supabase/supabase-js'

// DEBUG: Hardcoded values strictly to rule out Env Var poisoning (e.g. trailing spaces)
const supabaseUrl = 'https://qrkdwampnvjcervyusrp.supabase.co'
const supabaseKey = 'sb_publishable_IjT8CLT51HzpkLZYsM4xBQ_dRaz1V9B'

console.log('Supabase Config:', { 
    url: supabaseUrl, 
    keyLength: supabaseKey?.length 
});

export const supabase = createClient(supabaseUrl, supabaseKey)
