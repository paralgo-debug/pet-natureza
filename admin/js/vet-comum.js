// Pet Natureza - Painel: utilidades comuns do módulo Consulta Veterinária.
// Usado por vet.js, vet-solicitacoes.js, vet-agenda.js e vet-precos.js.

import { supabase } from './supabase.js';
import { esc, traduzirErro } from './util.js';
import { mesclarConfig } from './vet-calculo.js';

// ---------- Folha de estilo ----------
export function carregarCss(href) {
  if (document.querySelector('link[data-vet-css="' + href + '"]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = href;
  l.setAttribute('data-vet-css', href);
  document.head.appendChild(l);
}

// ---------- Aba atual (#/veterinaria?aba=agenda) ----------
export function abaAtual() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const aba = q.get('aba');
  return ['solicitacoes', 'agenda', 'precos'].includes(aba) ? aba : 'solicitacoes';
}

// ---------- Mensagens de erro em português ----------
export function msgErro(e) {
  const msg = String((e && e.message) || '').trim();
  const cod = String((e && e.code) || '');
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return 'Sem conexão com o servidor. Verifique a internet e tente novamente.';
  }
  if (cod === '42501' || /permission denied|row-level security/i.test(msg)) {
    return 'Você não tem permissão para esta ação.';
  }
  if (cod === 'P0001' && msg) return msg; // mensagens escritas nas funções do banco
  try {
    const t = traduzirErro(e);
    if (t) return String(t);
  } catch (x) { /* usa a mensagem padrão */ }
  return 'Não foi possível concluir a ação. Tente novamente.';
}

// ---------- Status ----------
export const ROTULO_STATUS = {
  novo: 'Novo',
  em_contato: 'Em contato',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
  realizado: 'Realizado'
};

export function seloStatus(status) {
  const nome = ROTULO_STATUS[status];
  if (!nome) return '<span class="vt-selo">' + esc(status) + '</span>';
  return '<span class="vt-selo vt-selo-' + status + '">' + esc(nome) + '</span>';
}

// ---------- WhatsApp ----------
export function urlWhatsApp(whatsapp, texto) {
  const d = String(whatsapp || '').replace(/\D/g, '');
  return 'https://wa.me/' + d + (texto ? '?text=' + encodeURIComponent(texto) : '');
}

// ---------- Armazenamento local (só configurações e filtros, NUNCA dados de clientes) ----------
export function localLer(chave) {
  try {
    const t = localStorage.getItem('vt_' + chave);
    return t ? JSON.parse(t) : null;
  } catch (e) {
    return null;
  }
}

export function localGravar(chave, valor) {
  try {
    localStorage.setItem('vt_' + chave, JSON.stringify(valor));
  } catch (e) { /* sem armazenamento: segue sem salvar */ }
}

export function localRemover(chave) {
  try {
    localStorage.removeItem('vt_' + chave);
  } catch (e) { /* ignora */ }
}

// ---------- Configuração da chave "veterinaria" ----------
// Devolve { rascunho, publicada, cfg, temRascunho }; cfg = rascunho ?? publicada (mesclado com os padrões).
export async function lerConfigs() {
  const [rasc, pub] = await Promise.all([
    supabase.from('settings_draft').select('value, updated_at').eq('key', 'veterinaria').maybeSingle(),
    supabase.from('settings_published').select('value, published_at').eq('key', 'veterinaria').maybeSingle()
  ]);
  if (rasc.error) throw rasc.error;
  if (pub.error) throw pub.error;
  const rascunho = rasc.data ? rasc.data.value : null;
  const publicada = pub.data ? pub.data.value : null;
  return {
    rascunho,
    publicada,
    temRascunho: !!rasc.data,
    cfg: mesclarConfig(rascunho || publicada || {})
  };
}

// ---------- Outras ----------
export function debounce(fn, ms) {
  let t = null;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export { esc };
