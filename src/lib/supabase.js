import { createClient } from '@supabase/supabase-js'

const cfg = window.__APP_CONFIG__ || {}

export const LOGIN_DOMAIN = cfg.LOGIN_DOMAIN || 'molafat.local'

export const configured =
  !!cfg.SUPABASE_URL &&
  !!cfg.SUPABASE_ANON_KEY &&
  !cfg.SUPABASE_URL.includes('YOUR-PROJECT') &&
  !cfg.SUPABASE_ANON_KEY.includes('YOUR-ANON')

export const supabase = configured
  ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null

// يقبل المستخدم اسم مستخدم أو بريد إلكتروني كامل
export function toEmail(identifier) {
  const value = identifier.trim()
  return value.includes('@') ? value : `${value}@${LOGIN_DOMAIN}`
}
