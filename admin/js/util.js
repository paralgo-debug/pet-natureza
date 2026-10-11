export const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
export const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

const MAPA = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escapa texto antes de colocar em HTML (proteção contra XSS). */
export const esc = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => MAPA[c]);

export function toast(mensagem, tipo = 'ok') {
  const caixa = $('#avisos');
  if (!caixa) return;
  const el = document.createElement('div');
  el.className = `aviso aviso-${tipo}`;
  el.textContent = mensagem;
  caixa.appendChild(el);
  setTimeout(() => el.remove(), tipo === 'erro' ? 8000 : 4000);
}

/** Barra fixa de estado de publicação: ok | rascunho | publicando | sucesso | falha */
export function setStatusPub(estado, texto) {
  const el = $('#statusPub');
  if (!el) return;
  el.dataset.estado = estado;
  el.textContent = texto;
}

export function confirmar(mensagem, rotuloOk = 'Confirmar') {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'dialogo';
    d.innerHTML = `<form method="dialog"><p>${esc(mensagem)}</p>
      <div class="acoes"><button value="cancelar" class="btn">Cancelar</button>
      <button value="ok" class="btn btn-primario">${esc(rotuloOk)}</button></div></form>`;
    d.addEventListener('close', () => {
      const ok = d.returnValue === 'ok';
      d.remove();
      resolve(ok);
    });
    document.body.appendChild(d);
    d.showModal();
  });
}

/** Mantém só dígitos e acrescenta o 55 (Brasil) quando o número vier só com DDD. */
export function normalizarWhatsApp(valor) {
  let d = String(valor || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return d;
}

export function formatarWhatsApp(digitos) {
  const m = String(digitos || '').match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+55 ${m[1]} ${m[2]}-${m[3]}` : String(digitos || '');
}

export function formatarDataHora(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Fortaleza',
  }).format(new Date(iso));
}

export function traduzirErro(e) {
  const msg = String(e?.message || '');
  if (e?.code === '42501' || /row-level security/i.test(msg)) return 'Você não tem permissão para esta ação.';
  if (/failed to fetch|networkerror/i.test(msg)) return 'Sem conexão. Verifique a internet e tente novamente.';
  return msg || 'Algo deu errado. Tente novamente.';
}
