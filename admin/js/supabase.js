import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const configurado =
  !SUPABASE_URL.includes('SEU-PROJETO') && !SUPABASE_ANON_KEY.startsWith('COLE-AQUI');

// flowType "pkce": o link de recuperação de senha volta com ?code=... (não usa o # da URL,
// que o painel utiliza para navegar entre as seções).
export const supabase = configurado
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, flowType: 'pkce' },
    })
  : null;
