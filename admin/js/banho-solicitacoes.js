// PET NATUREZA - Banho & Tosa (painel) - aba Solicitações: carregar, filtrar, listar
import { supabase } from './supabase.js';
import { esc, toast } from './util.js';
import { STATUS } from './banho-calculo.js';
import { htmlCartao, hora5 } from './banho-cartao.js';
import { alterarStatus, adicionarNota, verFoto, msgErro } from './banho-acoes.js';

const CHAVE = 'bt_adm_filtros';
const ORDENS = [['recentes', 'Mais recentes'], ['horario', 'Data do horário']];

const norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function lerFiltros() {
  let f = {};
  try { f = JSON.parse(sessionStorage.getItem(CHAVE) || '{}') || {}; } catch (e) { f = {}; }
  const txt = (v) => (typeof v === 'string' ? v : '');
  return {
    busca: txt(f.busca),
    status: STATUS.some((s) => s.valor === f.status) ? f.status : '',
    data: /^\d{4}-\d{2}-\d{2}$/.test(txt(f.data)) ? f.data : '',
    ordem: f.ordem === 'horario' ? 'horario' : 'recentes'
  };
}

function hojeFortaleza() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
}

export async function viewSolicitacoes(alvo, ctx) {
  const filtros = lerFiltros();
  const abertos = new Set();
  let dados = [];
  let total = 0;
  let slots = [];
  let nomes = new Map();

  alvo.innerHTML =
    '<div class="bt-filtros">' +
    '<div class="campo"><label for="bt-f-busca">Buscar</label><input type="search" id="bt-f-busca" placeholder="Cliente, pet, protocolo ou WhatsApp" value="' + esc(filtros.busca) + '"></div>' +
    '<div class="campo"><label for="bt-f-status">Status</label><select id="bt-f-status"><option value="">Todos</option>' +
    STATUS.map((s) => '<option value="' + esc(s.valor) + '"' + (s.valor === filtros.status ? ' selected' : '') + '>' + esc(s.rotulo) + '</option>').join('') + '</select></div>' +
    '<div class="campo"><label for="bt-f-data">Data do horário</label><input type="date" id="bt-f-data" value="' + esc(filtros.data) + '"></div>' +
    '<div class="campo"><label for="bt-f-ordem">Ordenar por</label><select id="bt-f-ordem">' +
    ORDENS.map((o) => '<option value="' + o[0] + '"' + (o[0] === filtros.ordem ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
    '</div>' +
    '<div class="acoes"><button type="button" class="btn btn-pequeno" id="bt-f-limpar">Limpar filtros</button>' +
    '<button type="button" class="btn btn-pequeno" id="bt-f-atualizar">Atualizar lista</button></div>' +
    '<p class="bt-contagem" id="bt-contagem" role="status" aria-live="polite"></p>' +
    '<div class="bt-lista" id="bt-lista"><p class="carregando">Carregando solicitações…</p></div>';

  const $ = (id) => alvo.querySelector('#' + id);
  const lista = $('bt-lista');

  function filtrar() {
    const b = norm(filtros.busca.trim());
    const digitos = filtros.busca.replace(/\D/g, '');
    return dados.filter((s) => {
      if (filtros.status && s.status !== filtros.status) return false;
      if (filtros.data && !(s.data_final === filtros.data || (s.bt_opcoes || []).some((o) => o.data === filtros.data))) return false;
      if (b) {
        const texto = norm([s.cliente_nome, s.pet_nome, s.protocolo].join(' '));
        if (!texto.includes(b) && !(digitos.length >= 3 && String(s.cliente_whatsapp).includes(digitos))) return false;
      }
      return true;
    });
  }

  function chaveHorario(s) {
    if (s.data_final) return s.data_final + ' ' + hora5(s.hora_final);
    const ops = (s.bt_opcoes || []).map((o) => o.data + ' ' + hora5(o.hora)).sort();
    return ops[0] || '9999';
  }

  function renderLista() {
    let itens = filtrar();
    if (filtros.ordem === 'horario') itens = itens.slice().sort((a, b) => chaveHorario(a).localeCompare(chaveHorario(b)));
    $('bt-contagem').textContent = 'Mostrando ' + itens.length + ' de ' + dados.length +
      (total > dados.length ? ' (as ' + dados.length + ' mais recentes, de ' + total + ' no total)' : '');
    lista.innerHTML = itens.length
      ? itens.map((s) => htmlCartao(s, nomes, slots, abertos.has(s.id))).join('')
      : '<p class="suave">Nenhuma solicitação encontrada com estes filtros.</p>';
  }

  async function carregar() {
    const [r, p, sl] = await Promise.all([
      supabase.from('bt_solicitacoes').select('*, bt_opcoes(*), bt_historico(*), bt_notas(*)', { count: 'exact' })
        .order('criado_em', { ascending: false }).limit(300),
      supabase.from('profiles').select('id,nome'),
      supabase.from('bt_slots_pub').select('data,hora').eq('bloqueado', false)
        .gte('data', hojeFortaleza()).order('data').order('hora').limit(600)
    ]);
    if (r.error) throw r.error;
    dados = r.data || [];
    total = typeof r.count === 'number' ? r.count : dados.length;
    nomes = new Map(((p && p.data) || []).map((x) => [x.id, x.nome || 'Equipe']));
    slots = (sl && sl.data) || [];
    renderLista();
  }

  async function recarregar() {
    try { await carregar(); } catch (e) { toast(msgErro(e), 'erro'); }
  }

  function salvarFiltros() {
    try { sessionStorage.setItem(CHAVE, JSON.stringify(filtros)); } catch (e) { /* ignora */ }
  }

  let espera = null;
  $('bt-f-busca').addEventListener('input', (ev) => {
    filtros.busca = ev.target.value;
    salvarFiltros();
    clearTimeout(espera);
    espera = setTimeout(renderLista, 200);
  });
  $('bt-f-status').addEventListener('change', (ev) => { filtros.status = ev.target.value; salvarFiltros(); renderLista(); });
  $('bt-f-data').addEventListener('change', (ev) => { filtros.data = ev.target.value; salvarFiltros(); renderLista(); });
  $('bt-f-ordem').addEventListener('change', (ev) => { filtros.ordem = ev.target.value; salvarFiltros(); renderLista(); });
  $('bt-f-limpar').addEventListener('click', () => {
    filtros.busca = ''; filtros.status = ''; filtros.data = ''; filtros.ordem = 'recentes';
    $('bt-f-busca').value = ''; $('bt-f-status').value = ''; $('bt-f-data').value = ''; $('bt-f-ordem').value = 'recentes';
    salvarFiltros();
    renderLista();
  });
  $('bt-f-atualizar').addEventListener('click', recarregar);

  // Lembra quais cartões estão abertos (o evento toggle não borbulha: usa captura)
  lista.addEventListener('toggle', (ev) => {
    const d = ev.target;
    if (d && d.dataset && d.dataset.id) {
      if (d.open) abertos.add(d.dataset.id); else abertos.delete(d.dataset.id);
    }
  }, true);

  lista.addEventListener('change', (ev) => {
    const campo = ev.target.dataset ? ev.target.dataset.campo : '';
    const card = ev.target.closest('details[data-id]');
    if (!card) return;
    if (campo === 'status') {
      card.querySelector('[data-confirmar]').hidden = ev.target.value !== 'confirmado';
    } else if (campo === 'outro') {
      const radio = card.querySelector('input[data-conf][value="outro"]');
      if (radio) radio.checked = true;
    }
  });

  lista.addEventListener('click', async (ev) => {
    const botao = ev.target.closest('button[data-acao]');
    if (!botao) return;
    const card = botao.closest('details[data-id]');
    if (!card) return;
    const acao = botao.dataset.acao;
    botao.disabled = true;
    try {
      if (acao === 'foto') {
        await verFoto(botao);
      } else if (acao === 'status') {
        if (await alterarStatus(card)) await recarregar();
      } else if (acao === 'nota') {
        if (await adicionarNota(card, ctx.user.id)) await recarregar();
      }
    } catch (e) {
      toast(msgErro(e), 'erro');
    } finally {
      botao.disabled = false;
    }
  });

  try {
    await carregar();
  } catch (e) {
    lista.innerHTML = '<p class="erro" role="alert">' + esc(msgErro(e)) + '</p>';
  }
                            }
