// PET NATUREZA - Banho & Tosa (site) - utilitários comuns

export const $ = (id) => document.getElementById(id);

export function el(tag, attrs, filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'texto') n.textContent = v;
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const f of filhos || []) n.append(f);
  return n;
}

export function soDigitos(v) {
  return String(v === null || v === undefined ? '' : v).replace(/\D/g, '');
}

// Dígitos do telefone sem o 55 (no máximo 11)
export function digitosTelefone(v) {
  let d = soDigitos(v);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return d.slice(0, 11);
}

export function mascararTelefone(valor) {
  const d = digitosTelefone(valor);
  if (d.length === 0) return '';
  if (d.length <= 2) return '(' + d;
  if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
  if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
}

// UUID em minúsculas (exigido pela política de envio de fotos)
export function novoUUID() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID().toLowerCase();
  }
  const b = window.crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
}

// ---------------------------------------------------------------------
// Datas (sem fuso: trabalhamos com o texto AAAA-MM-DD vindo do banco)
// ---------------------------------------------------------------------
const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const SEMANA_CURTA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const dois = (n) => String(n).padStart(2, '0');

function partes(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? { a: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
}

function diaDaSemana(p) {
  return new Date(Date.UTC(p.a, p.m - 1, p.d)).getUTCDay();
}

export function dataBR(iso) {
  const p = partes(iso);
  return p ? dois(p.d) + '/' + dois(p.m) + '/' + p.a : '';
}

export function dataComSemana(iso) {
  const p = partes(iso);
  return p ? SEMANA[diaDaSemana(p)] + ', ' + dataBR(iso) : '';
}

export function dataLonga(iso) {
  const p = partes(iso);
  return p ? SEMANA[diaDaSemana(p)] + ', ' + p.d + ' de ' + MESES[p.m - 1] : '';
}

export function chipData(iso) {
  const p = partes(iso);
  if (!p) return { sem: '', dia: '', mes: '' };
  return { sem: SEMANA_CURTA[diaDaSemana(p)], dia: String(p.d), mes: MESES_CURTOS[p.m - 1] };
}

export function horaCurta(h) {
  return String(h || '').slice(0, 5);
}

// ---------------------------------------------------------------------
// Mensagens de erro ao lado dos campos
// ---------------------------------------------------------------------
export function mostrarErro(idErro, texto, campo) {
  const p = $(idErro);
  if (p) {
    p.textContent = texto;
    p.hidden = false;
  }
  if (campo) campo.setAttribute('aria-invalid', 'true');
}

export function limparTodosErros() {
  document.querySelectorAll('#bt-form .bt-erro').forEach((p) => {
    p.hidden = true;
  });
  document.querySelectorAll('#bt-form [aria-invalid]').forEach((n) => n.removeAttribute('aria-invalid'));
}
