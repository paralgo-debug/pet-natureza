// Pet Natureza - Loja: carrinho (só guarda id e quantidade; preços sempre vêm do servidor)
import { validarCarrinho, brl } from './loja-api.js';

const CHAVE = 'pn-carrinho';
const MAX_ITENS = 50;
const MAX_QTD = 99;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const nomes = new Map();   // só em memória (nome conhecido por id)
const precos = new Map();  // só em memória (último preço visto por id)
const ouvintes = new Set();
let ultima = null;
let itens = lerArmazenado();

function lerArmazenado() {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE) || '[]');
    if (!Array.isArray(bruto)) return [];
    const vistos = new Set();
    const ok = [];
    for (const x of bruto) {
      if (!x || typeof x.id !== 'string' || !UUID_RE.test(x.id) || vistos.has(x.id)) continue;
      const q = Math.floor(Number(x.q));
      if (!Number.isFinite(q) || q < 1) continue;
      vistos.add(x.id);
      ok.push({ id: x.id, q: Math.min(q, MAX_QTD) });
      if (ok.length >= MAX_ITENS) break;
    }
    return ok;
  } catch (e) {
    return [];
  }
}

function copia() {
  return itens.map((x) => ({ id: x.id, q: x.q }));
}

function notificar() {
  const c = copia();
  ouvintes.forEach((fn) => {
    try { fn(c); } catch (e) { /* ignora erro de ouvinte */ }
  });
}

function gravar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(itens)); } catch (e) { /* modo privado */ }
  ultima = null;
  notificar();
}

window.addEventListener('storage', (ev) => {
  if (ev.key === CHAVE || ev.key === null) {
    itens = lerArmazenado();
    ultima = null;
    notificar();
  }
});

function guardarInfo(id, info) {
  if (!info) return;
  if (typeof info.nome === 'string' && info.nome) nomes.set(id, info.nome);
  if (typeof info.preco === 'number' && Number.isFinite(info.preco)) precos.set(id, info.preco);
}

export function obterItens() { return copia(); }

export function totalUnidades() {
  return itens.reduce((s, x) => s + x.q, 0);
}

export function quantidadeDe(id) {
  const x = itens.find((i) => i.id === id);
  return x ? x.q : 0;
}

export function assinar(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

export function ultimaValidacao() { return ultima; }

// info: { nome, preco, max } (max = quantidade máxima conhecida; 0 = esgotado)
export function adicionar(id, q = 1, info = {}) {
  if (!UUID_RE.test(String(id))) return { ok: false, motivo: 'invalido' };
  if (typeof info.max === 'number' && info.max < 1) return { ok: false, motivo: 'esgotado' };
  guardarInfo(id, info);
  const maximo = Math.min(MAX_QTD, typeof info.max === 'number' ? Math.floor(info.max) : MAX_QTD);
  const atual = itens.find((x) => x.id === id);
  if (!atual && itens.length >= MAX_ITENS) return { ok: false, motivo: 'limite_itens' };
  if (atual && atual.q >= maximo) return { ok: false, motivo: 'limite_quantidade', quantidade: atual.q };
  const desejado = (atual ? atual.q : 0) + Math.max(1, Math.floor(Number(q) || 1));
  const final = Math.min(desejado, maximo);
  if (atual) atual.q = final; else itens.push({ id, q: final });
  gravar();
  return { ok: true, quantidade: final, limitado: final < desejado };
}

export function remover(id) {
  itens = itens.filter((x) => x.id !== id);
  gravar();
  return { ok: true, removido: true };
}

export function definir(id, q, max) {
  const atual = itens.find((x) => x.id === id);
  if (!atual) return { ok: false, motivo: 'inexistente' };
  const n = Math.floor(Number(q));
  if (!Number.isFinite(n) || n < 1) return remover(id);
  const teto = Math.min(MAX_QTD, typeof max === 'number' && max >= 1 ? Math.floor(max) : MAX_QTD);
  const final = Math.min(n, teto);
  atual.q = final;
  gravar();
  return { ok: true, quantidade: final, limitado: final < n };
}

export function limpar() {
  itens = [];
  gravar();
}

// Busca preços e estoque atuais no servidor e ajusta o carrinho.
// Retorna { linhas, subtotal, avisos }. Lança LojaErro se a consulta falhar.
export async function validar() {
  const enviados = copia();
  if (!enviados.length) {
    ultima = { linhas: [], subtotal: 0, avisos: [] };
    return ultima;
  }
  const r = await validarCarrinho(enviados);
  const porId = new Map(((r && r.itens) || []).map((l) => [l.id, l]));
  const avisos = [];
  const linhas = [];
  const removidos = new Set();
  const ajustes = new Map();

  for (const it of enviados) {
    const l = porId.get(it.id);
    const nome = (l && l.nome) || nomes.get(it.id) || 'Um produto';
    if (!l || l.disponibilidade === 'indisponivel') {
      avisos.push(`${nome} não está mais disponível e saiu do carrinho.`);
      removidos.add(it.id);
      continue;
    }
    if (l.disponibilidade === 'esgotado' || Number(l.quantidade) < 1) {
      avisos.push(`${nome} esgotou e saiu do carrinho.`);
      removidos.add(it.id);
      continue;
    }
    if (l.disponibilidade === 'ajustado') {
      const n = Number(l.quantidade);
      avisos.push(`${nome}: restam só ${n} unidade${n === 1 ? '' : 's'}. Ajustamos a quantidade.`);
      ajustes.set(it.id, n);
    }
    const antes = precos.get(it.id);
    if (typeof antes === 'number' && Math.abs(antes - Number(l.preco)) > 0.001) {
      avisos.push(`${nome}: o preço mudou de ${brl(antes)} para ${brl(l.preco)}.`);
    }
    precos.set(it.id, Number(l.preco));
    nomes.set(it.id, l.nome);
    linhas.push(l);
  }

  if (removidos.size || ajustes.size) {
    itens = itens
      .filter((x) => !removidos.has(x.id))
      .map((x) => (ajustes.has(x.id) ? { id: x.id, q: ajustes.get(x.id) } : x));
    gravar();
  }
  const subtotal = Math.round(
    linhas.reduce((s, l) => s + Number(l.preco) * Number(l.quantidade), 0) * 100
  ) / 100;
  ultima = { linhas, subtotal, avisos };
  return ultima;
  }
