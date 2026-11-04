import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Solo una clave publicable: los permisos efectivos se resuelven mediante RLS.
export const supabase = url && key ? createClient(url, key, { auth: { flowType: 'pkce', detectSessionInUrl: true } }) : null

// La tienda pública nunca hereda los permisos de una sesión interna.
export const supabasePublic = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'empregest-publico' } }) : null
