// Pet Natureza - Painel: aba Solicitações (cartões, filtros, 300 mais recentes).
// O detalhe de cada cartão fica em vet-sol-detalhe.js.

import { supabase } from './supabase.js';
import { formatarDataHora } from './util.js';
import { esc, msgErro, seloStatus, localLer, localGravar, debounce } from './vet-comum.js';
import { STATUS, dataBR, horaCurta } from './vet-calculo.js';
import { htmlDetalhe, ligarDetalhe } from './vet-sol-detalhe.js';

const LIMITE = 300;
const norm = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const emAberto = (s) => s.urgente && (s.status === 'novo' || s.status === 'em_contato');
const porPrio = (a, b) => a.prioridade - b.prioridade;

// Primeiro horário que importa: o confirmado ou o da 1ª opção (para ordenar por data).
function chaveHorario(s) {
  if (s.data_final) return s.data_final + ' ' + horaCurta(s.hora_final);
  const o = (s.vt_opcoes || []).slice().sort(porPrio)[0];
  return o ? o.data + ' ' + horaCurta(o.hora) : '';
}

function resumoHorarios(s) {
  if (s.data_final) {
    return 'Confirmado: ' + dataBR(s.data_final) + ' às ' + horaCurta(s.hora_final);
  }
  const ops = (s.vt_opcoes || []).slice().sort(porPrio);
  if (!ops.length) return 'Sem horários';
  return ops.map((o) => o.prioridade + 'ª ' + dataBR(o.data).slice(0, 5) + ' ' + horaCurta(o.hora)).join(' · ');
}

function htmlCartao(s, aberto) {
  return '<li><details class="vt-sol' + (s.urgente ? ' vt-sol-urgente' : '') + '" data-id="' + esc(s.id) + '"' +
    (aberto ? ' open' : '') + '><summary>' +
    '<span class="vt-sol-linha"><span class="vt-sol-titulo">' + esc(s.protocolo) + '</span>' +
    seloStatus(s.status) + (s.urgente ? '<span class="vt-selo vt-selo-urgente">Urgente</span>' : '') + '</span>' +
    '<span class="vt-sol-titulo">' + esc(s.cliente_nome) + ' · ' + esc(s.pet_nome) + '</span>' +
    '<span class="vt-sol-meta">' + esc(s.tipo_nome) + ' · ' + esc(resumoHorarios(s)) + '</span>' +
    '<span class="vt-sol-meta">Recebida em ' + esc(formatarDataHora(s.criado_em)) + '</span>' +
    '</summary><div class="vt-sol-corpo" data-corpo></div></details></li>';
}

export async function viewSolicitacoes(alvo, ctx) {
  const salvo = localLer('filtros_sol') || {};
  const filtros = {
    status: STATUS.some((x) => x.id === salvo.status) ? salvo.status : '',
    tipo: typeof salvo.tipo === 'string' ? salvo.tipo : '',
    data: /^\d{4}-\d{2}-\d{2}$/.test(salvo.data || '') ? salvo.data : '',
    ordem: salvo.ordem === 'horario' ? 'horario' : 'recentes',
    antigas: salvo.antigas === true
  };
  let busca = '';
  let dados = [];
  let total = 0;
  let nomes = {};
  let nomesCarregados = false;
  const abertos = new Set();

  alvo.innerHTML =
    '<div class="cartao">' +
      '<div class="vt-filtros">' +
        '<div class="campo"><label for="vt-f-busca">Buscar</label>' +
          '<input type="search" id="vt-f-busca" autocomplete="off" placeholder="Cliente, pet, protocolo ou WhatsApp"></div>' +
        '<div class="campo"><label for="vt-f-status">Status</label><select id="vt-f-status">' +
          '<option value="">Todos</option>' +
          STATUS.map((x) => '<option value="' + x.id + '">' + esc(x.nome) + '</option>').join('') +
        '</select></div>' +
        '<div class="campo"><label for="vt-f-tipo">Motivo</label><select id="vt-f-tipo"><option value="">Todos</option></select></div>' +
        '<div class="campo"><label for="vt-f-data">Data do horário</label><input type="date" id="vt-f-data"></div>' +
        '<div class="campo"><label for="vt-f-ordem">Ordenar por</label><select id="vt-f-ordem">' +
          '<option value="recentes">Mais recentes</option><option value="horario">Data do horário</option></select></div>' +
        '<div class="campo"><label for="vt-f-antigas"><input type="checkbox" id="vt-f-antigas"> Antigas (mais de 12 meses)</label>' +
          '<p class="ajuda">Para a revisão periódica e a limpeza de dados.</p></div>' +
      '</div>' +
      '<div class="acoes"><button type="button" class="btn btn-pequeno" id="vt-f-limpar">Limpar filtros</button></div>' +
    '</div>' +
    '<p class="vt-contagem" id="vt-contagem" aria-live="polite"></p>' +
    '<ul class="vt-lista" id="vt-sol-lista"></ul>';

  const el = (id) => alvo.querySelector('#' + id);
  const elBusca = el('vt-f-busca');
  const elStatus = el('vt-f-status');
  const elTipo = el('vt-f-tipo');
  const elData = el('vt-f-data');
  const elOrdem = el('vt-f-ordem');
  const elAntigas = el('vt-f-antigas');
  const elLista = el('vt-sol-lista');
  const elContagem = el('vt-contagem');

  function pintarFiltros() {
    elStatus.value = filtros.status;
    elData.value = filtros.data;
    elOrdem.value = filtros.ordem;
    elAntigas.checked = filtros.antigas;
  }

  function gravarFiltros() {
    // A busca NÃO é guardada: pode conter nome ou WhatsApp de cliente.
    localGravar('filtros_sol', filtros);
  }

  async function carregarNomes() {
    if (nomesCarregados) return;
    nomesCarregados = true;
    try {
      const { data } = await supabase.from('profiles').select('id, nome');
      (data || []).forEach((p) => { nomes[p.id] = p.nome; });
    } catch (e) { /* sem nomes: mostra "Equipe" */ }
  }

  async function carregar() {
    let q = supabase.from('vt_solicitacoes')
      .select('*, vt_opcoes(prioridade, data, hora), vt_historico(id, de, para, por, detalhe, criado_em), vt_notas(id, autor, texto, criado_em)',
        { count: 'exact' })
      .order('criado_em', { ascending: false })
      .limit(LIMITE);
    if (filtros.antigas) {
      const corte = new Date();
      corte.setMonth(corte.getMonth() - 12);
      q = q.lt('criado_em', corte.toISOString());
    }
    const { data, error, count } = await q;
    if (error) throw error;
    dados = data || [];
    total = typeof count === 'number' ? count : dados.length;
    await carregarNomes();
  }

  function passa(s) {
    if (filtros.status && s.status !== filtros.status) return false;
    if (filtros.tipo && s.tipo_id !== filtros.tipo) return false;
    if (filtros.data && s.data_final !== filtros.data
        && !(s.vt_opcoes || []).some((o) => o.data === filtros.data)) return false;
    if (busca) {
      const digitos = busca.replace(/\D/g, '');
      const texto = norm([s.cliente_nome, s.pet_nome, s.protocolo].join(' '));
      const achou = texto.includes(norm(busca))
        || (digitos.length >= 3 && String(s.cliente_whatsapp).includes(digitos));
      if (!achou) return false;
    }
    return true;
  }

  function comparar(a, b) {
    if (filtros.ordem === 'horario') {
      const x = chaveHorario(a);
      const y = chaveHorario(b);
      if (x !== y) return !x ? 1 : !y ? -1 : x < y ? -1 : 1;
    } else if (emAberto(a) !== emAberto(b)) {
      return emAberto(a) ? -1 : 1;
    }
    return a.criado_em < b.criado_em ? 1 : a.criado_em > b.criado_em ? -1 : 0;
  }

  function atualizarMotivos() {
    const mapa = new Map();
    dados.forEach((s) => { if (!mapa.has(s.tipo_id)) mapa.set(s.tipo_id, s.tipo_nome); });
    if (filtros.tipo && !mapa.has(filtros.tipo)) filtros.tipo = '';
    elTipo.innerHTML = '<option value="">Todos</option>' +
      Array.from(mapa, ([id, nome]) => '<option value="' + esc(id) + '">' + esc(nome) + '</option>').join('');
    elTipo.value = filtros.tipo;
  }

  function renderizar() {
    const visiveis = dados.filter(passa).sort(comparar);
    let txt = 'Mostrando ' + visiveis.length + ' de ' + dados.length;
    if (total > dados.length) txt += ' (as ' + dados.length + ' mais recentes de ' + total + ')';
    elContagem.textContent = txt + (filtros.antigas ? ' · somente antigas' : '');
    if (!visiveis.length) {
      elLista.innerHTML = '<li class="vt-vazio">' + (dados.length
        ? 'Nenhuma solicitação encontrada com esses filtros.'
        : filtros.antigas ? 'Nenhuma solicitação antiga.' : 'Nenhuma solicitação por aqui ainda.') + '</li>';
      return;
    }
    elLista.innerHTML = visiveis.map((s) => htmlCartao(s, abertos.has(s.id))).join('');
  }

  function preencher(det) {
    const s = dados.find((x) => x.id === det.dataset.id);
    const corpo = det.querySelector('[data-corpo]');
    if (!s || !corpo || corpo.dataset.pronto) return;
    corpo.dataset.pronto = '1';
    corpo.innerHTML = htmlDetalhe(s, { ehAdmin: ctx.ehAdmin, nomes });
    ligarDetalhe(corpo, s, { ehAdmin: ctx.ehAdmin, userId: ctx.user && ctx.user.id, aoAlterar: recarregar });
  }

  async function recarregar() {
    await carregar();
    atualizarMotivos();
    renderizar();
    if (typeof ctx.atualizarMetricas === 'function') ctx.atualizarMetricas();
  }

  elLista.addEventListener('toggle', (ev) => {
    const det = ev.target;
    if (!det || !det.matches || !det.matches('details.vt-sol')) return;
    if (det.open) {
      abertos.add(det.dataset.id);
      preencher(det);
    } else {
      abertos.delete(det.dataset.id);
    }
  }, true);

  elBusca.addEventListener('input', debounce(() => { busca = elBusca.value.trim(); renderizar(); }, 250));
  const aoFiltro = () => {
    filtros.status = elStatus.value;
    filtros.tipo = elTipo.value;
    filtros.data = elData.value;
    filtros.ordem = elOrdem.value;
    gravarFiltros();
    renderizar();
  };
  [elStatus, elTipo, elData, elOrdem].forEach((c) => c.addEventListener('change', aoFiltro));

  elAntigas.addEventListener('change', async () => {
    filtros.antigas = elAntigas.checked;
    gravarFiltros();
    elContagem.textContent = 'Carregando…';
    try {
      await carregar();
      atualizarMotivos();
      renderizar();
    } catch (e) {
      elContagem.textContent = msgErro(e);
    }
  });

  el('vt-f-limpar').addEventListener('click', async () => {
    const eraAntigas = filtros.antigas;
    Object.assign(filtros, { status: '', tipo: '', data: '', ordem: 'recentes', antigas: false });
    busca = '';
    elBusca.value = '';
    pintarFiltros();
    gravarFiltros();
    if (eraAntigas) {
      try { await carregar(); atualizarMotivos(); } catch (e) { /* mantém */ }
    }
    elTipo.value = '';
    renderizar();
  });

  pintarFiltros();
  elLista.innerHTML = '<li class="carregando" role="status">Carregando solicitações…</li>';
  try {
    await carregar();
  } catch (e) {
    elLista.innerHTML = '<li class="vt-faixa vt-faixa-erro" role="alert">' + esc(msgErro(e)) + '</li>';
    return;
  }
  atualizarMotivos();
  renderizar();
      }
