// Pet Natureza - Loja: acesso ao Supabase (somente chave pública) e utilitários
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const FUSO = 'America/Fortaleza';

export const EMPRESA_PADRAO = {
  nome: 'Pet Natureza', slogan: '', descricao: '', whatsapp: '5598984402286',
  email: '', endereco: '', horarios: ''
};

const TEXTOS_PADRAO = {
  TOTAL_MUDOU: 'Os valores do seu pedido mudaram. Confira o resumo e confirme de novo.',
  ESTOQUE_INSUFICIENTE: 'Alguns itens não têm mais a quantidade pedida em estoque.',
  PRODUTO_INDISPONIVEL: 'Algum produto do seu carrinho não está mais disponível.'
};

export class LojaErro extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.name = 'LojaErro';
    this.codigo = codigo;
  }
}

function converterErro(err) {
  const msg = String((err && err.message) || '');
  for (const p of Object.keys(TEXTOS_PADRAO)) {
    if (msg.startsWith(p)) {
      const resto = msg.slice(p.length).replace(/^[\s:.\-–]+/, '').trim();
      return new LojaErro(p, resto || TEXTOS_PADRAO[p]);
    }
  }
  if (err && err.code === 'P0001' && msg) return new LojaErro('VALIDACAO', msg);
  if (/failed to fetch|network|load failed|fetch/i.test(msg)) {
    return new LojaErro('REDE', 'Sem conexão com a internet. Confira o sinal e tente de novo.');
  }
  return new LojaErro('SERVIDOR', 'Não foi possível concluir agora. Tente de novo ou fale com a gente pelo WhatsApp.');
}

// ---------- Cliente Supabase (carregado só quando necessário) ----------
let cliente = null;
let baseUrl = '';
let promessa = null;

function configValida(url, chave) {
  const u = String(url || '');
  const k = String(chave || '');
  return /^https:\/\//.test(u) && k.length > 20 && !/SEU-PROJETO|COLE-AQUI/i.test(u + k);
}

export function iniciarApi() {
  if (!promessa) {
    promessa = (async () => {
      try {
        const cfg = await import('../admin/js/config.js');
        if (!configValida(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)) return false;
        const lib = await import(CDN);
        cliente = lib.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        });
        baseUrl = String(cfg.SUPABASE_URL).replace(/\/+$/, '');
        return true;
      } catch (e) {
        return false;
      }
    })().then((ok) => {
      if (!ok) promessa = null;
      return ok;
    });
  }
  return promessa;
}

export function urlImagem(path) {
  if (!path || !baseUrl) return '';
  const partes = String(path).split('/').map(encodeURIComponent).join('/');
  return `${baseUrl}/storage/v1/object/public/produtos/${partes}`;
}

async function rpc(nome, args) {
  const ok = await iniciarApi();
  if (!ok) {
    throw new LojaErro('CONFIG', 'A loja ainda não está disponível. Fale com a gente pelo WhatsApp.');
  }
  let resp;
  try {
    resp = await cliente.rpc(nome, args || {});
  } catch (e) {
    throw converterErro(e);
  }
  if (resp.error) throw converterErro(resp.error);
  return resp.data;
}

// ---------- Chamadas da loja ----------
export function listarCategorias() {
  return rpc('lj_listar_categorias');
}

export function listarProdutos(f = {}) {
  return rpc('lj_listar_produtos', {
    p_busca: f.busca || null,
    p_categoria: f.categoria || null,
    p_ordem: f.ordem || 'relevancia',
    p_pagina: f.pagina || 1,
    p_por_pagina: f.porPagina || 40,
    p_somente_promocao: !!f.somentePromocao
  });
}

export function obterProduto(slug) {
  return rpc('lj_obter_produto', { p_slug: String(slug || '') });
}

export function configLoja() {
  return rpc('lj_config_loja');
}

export function validarCarrinho(itens) {
  return rpc('lj_validar_carrinho', { p_itens: itens || [] });
}

export async function criarPedido(payload) {
  const r = await rpc('lj_criar_pedido', { p: payload });
  if (!r || r.ok !== true) {
    throw new LojaErro('SERVIDOR', 'Não foi possível registrar o pedido. Tente de novo ou fale com a gente pelo WhatsApp.');
  }
  return r;
}

function mesclarSimples(base, extra) {
  const r = { ...base };
  for (const k of Object.keys(extra)) {
    const v = extra[k];
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    r[k] = v;
  }
  return r;
}

export async function carregarEmpresa() {
  const resultado = { empresa: { ...EMPRESA_PADRAO }, redes: {} };
  try {
    if (await iniciarApi()) {
      const { data, error } = await cliente
        .from('settings_published').select('key,value').in('key', ['empresa', 'redes']);
      if (!error && Array.isArray(data)) {
        for (const linha of data) {
          if (!linha || !linha.value || typeof linha.value !== 'object') continue;
          if (linha.key === 'empresa') resultado.empresa = mesclarSimples(EMPRESA_PADRAO, linha.value);
          if (linha.key === 'redes') resultado.redes = mesclarSimples({}, linha.value);
        }
      }
    }
  } catch (e) { /* usa os valores padrão */ }
  resultado.empresa.whatsapp = normalizarWhatsApp(resultado.empresa.whatsapp) || EMPRESA_PADRAO.whatsapp;
  return resultado;
}

// ---------- Utilitários ----------
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export function brl(v) {
  const n = Number(v);
  return fmtMoeda.format(Number.isFinite(n) ? n : 0);
}

export function formatarDataHora(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: FUSO
  }).format(d).replace(',', '');
}

export function novoUuid() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  const b = new Uint8Array(16);
  window.crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function soDigitos(v) {
  return String(v ?? '').replace(/\D+/g, '');
}

export function normalizarWhatsApp(v) {
  const d = soDigitos(v);
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  return '';
}

export function mascaraWhatsApp(valor) {
  let d = soDigitos(valor);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function formatarWhatsApp(digitos) {
  const d = soDigitos(digitos);
  return mascaraWhatsApp(d.startsWith('55') && d.length > 11 ? d.slice(2) : d);
}

export function linkWhatsApp(numero, texto) {
  const base = `https://wa.me/${soDigitos(numero)}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}

export function debounce(fn, ms = 300) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function rotuloEstoque(p) {
  if (!p || !p.controla_estoque) return '';
  if (p.estoque_status === 'esgotado') return 'Esgotado';
  if (p.estoque_status === 'ultimas') {
    const n = Number(p.estoque_restante) || 0;
    return n === 1 ? 'Última unidade' : `Últimas ${n} unidades`;
  }
  if (p.estoque_status === 'em_estoque') return 'Em estoque';
  return '';
}

export function htmlPreco(p) {
  if (p.promocao_valida && p.preco_original != null) {
    return '<span class="lj-preco lj-preco-promo">'
      + `<s class="lj-preco-orig"><span class="sr-only">Preço original: </span>${esc(brl(p.preco_original))}</s>`
      + `<strong class="lj-preco-atual"><span class="sr-only">Preço promocional: </span>${esc(brl(p.preco))}</strong>`
      + '</span>';
  }
  return `<span class="lj-preco"><strong class="lj-preco-atual">${esc(brl(p.preco))}</strong></span>`;
    }
