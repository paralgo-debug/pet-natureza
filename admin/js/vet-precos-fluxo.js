// Pet Natureza - Painel: chamadas ao banco do fluxo rascunho -> publicação.

import { supabase } from './supabase.js';

export const CHAVE = 'veterinaria';

export async function gravarRascunho(cfg, userId) {
  const { error } = await supabase.from('settings_draft').upsert(
    { key: CHAVE, value: cfg, updated_at: new Date().toISOString(), updated_by: userId || null },
    { onConflict: 'key' }
  );
  if (error) throw error;
}

export async function publicarConfig() {
  const { error } = await supabase.rpc('vt_publicar_config');
  if (error) throw error;
}

export async function descartarRascunho() {
  const { error } = await supabase.rpc('descartar_rascunho', { p_key: CHAVE });
  if (error) throw error;
}

// As 5 últimas publicações (somente o Administrador consegue ler).
export async function listarRevisoes() {
  const { data, error } = await supabase.from('settings_revisions')
    .select('id, published_at').eq('key', CHAVE)
    .order('published_at', { ascending: false }).limit(5);
  if (error) throw error;
  return data || [];
}

export async function restaurarRevisao(id) {
  const { error } = await supabase.rpc('restaurar_revisao', { p_revisao: id });
  if (error) throw error;
}
