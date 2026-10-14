// Pet Natureza - Painel: utilidades compartilhadas da Loja
import { SUPABASE_URL } from './config.js';
import { traduzirErro } from './util.js';

const FUSO = 'America/Fortaleza';
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const STATUS_PEDIDO = [
  ['novo', 'Novo'], ['confirmado', 'Confirmado'], ['em_preparo', 'Em preparo'],
  ['concluido', 'Concluído'], ['cancelado', 'Cancelado']
];
export const STATUS_PRODUTO = [['rascunho', 'Rascunho'], ['publicado', 'Publicado'], ['arquivado', 'Arquivado']];
const CLASSE_STATUS = {
  novo: 'novo', confirmado: 'confirmado', em_preparo: 'preparo', concluido: 'concluido', cancelado: 'cancelado',
  rascunho: 'rascunho', publicado: 'publicado', arquivado: 'arquivado'
};

export function rotuloStatus(s) {
  const t = STATUS_PEDIDO.concat(STATUS_PRODUTO).find(([k]) => k === s);
  return t ? t[1] : String(s || '');
}
export function classeStatus(s) { return `lj-tag lj-tag-${CLASSE_STATUS[s] || 'neutro'}`; }

export function carregarCss() {
  if (document.querySelector('link[data-lj-css]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'css/loja.css';
  l.dataset.ljCss = '1';
  document.head.appendChild(l);
}

export function paramsAba() {
  return new URLSearchParams(location.hash.split('?')[1] || '');
}

const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export function brl(v) {
  const n = Number(v);
  return fmtMoeda.format(Number.isFinite(n) ? n : 0);
}

export function dataBR(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: FUSO }).format(d);
}

export function dataHoraBR(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: FUSO
  }).format(d).replace(',', '');
}

// Valor de <input type="datetime-local"> (horário de Fortaleza) <-> ISO
export function isoParaInput(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = {};
  new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(d).forEach((x) => { if (x.type !== 'literal') p[x.type] = x.value; });
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function inputParaIso(v) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(v || ''))) return null;
  const d = new Date(`${v}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function semAcento(t) {
  return String(t ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function slugify(t, max = 120) {
  return semAcento(t).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/g, '');
}

export function parsePreco(txt) {
  let s = String(txt ?? '').replace(/[^\d,.-]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function precoParaInput(n) {
  return n === null || n === undefined || n === '' ? '' : Number(n).toFixed(2).replace('.', ',');
}

export function urlImagem(path) {
  if (!path) return '';
  const base = String(SUPABASE_URL || '').replace(/\/+$/, '');
  return `${base}/storage/v1/object/public/produtos/${String(path).split('/').map(encodeURIComponent).join('/')}`;
}

export function debounce(fn, ms = 300) {
  let t = null;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// Mensagem de erro em português para o toast
export function msgErro(e) {
  const m = String((e && e.message) || '');
  const c = String((e && e.code) || '');
  if (c === 'P0001' && m) return m;
  if (c === '23505' || /duplicate key/i.test(m)) {
    if (/sku/i.test(m)) return 'Já existe um produto com este SKU.';
    if (/lj_categorias/i.test(m)) return 'Já existe uma categoria com este endereço (slug).';
    if (/slug/i.test(m)) return 'Já existe um produto com este endereço (slug). Mude o campo "Endereço (slug)".';
    return 'Já existe um registro igual a este.';
  }
  if (c === '23503' || /foreign key/i.test(m)) return 'Este item está em uso e não pode ser excluído. Desative ou arquive.';
  if (c === '42501' || /row-level security|permission denied/i.test(m)) return 'Você não tem permissão para fazer isso.';
  if (c === '23514' || /check constraint/i.test(m)) {
    if (/promo/i.test(m)) return 'O preço promocional precisa ser menor que o preço normal.';
    return 'Algum valor está fora do permitido. Confira os campos.';
  }
  return traduzirErro(e);
    }
