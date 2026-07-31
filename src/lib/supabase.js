import { createClient } from '@supabase/supabase-js';

const productionUrl = 'https://zbunlgjdgsstyczkznel.supabase.co';
const productionPublicKey = 'sb_publishable_j06RA4elI43V_Jf4w6sHbg_NLjByCug';
const clean = (value) => String(value || '').trim().replace(/^['"]|['"]$/g, '');
const configuredUrl = clean(import.meta.env.VITE_SUPABASE_URL);
const configuredKey = clean(import.meta.env.VITE_SUPABASE_ANON_KEY);
const supabaseUrl = configuredUrl.includes('zbunlgjdgsstyczkznel.supabase.co') ? configuredUrl : productionUrl;
const supabaseAnonKey = configuredKey.startsWith('sb_publishable_') ? configuredKey : productionPublicKey;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;
