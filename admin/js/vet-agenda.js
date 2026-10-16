// Pet Natureza - Painel: aba Agenda (rascunho x publicada).
// Administrador edita e publica; Funcionário só visualiza (a regra real é no banco).

import { supabase } from './supabase.js';
import { toast, confirmar, setStatusPub } from './util.js';
import { esc, msgErro } from './vet-comum.js';
import {
  USOS_AGENDA, DIAS_SEMANA, agoraFortaleza, somarDias, dataBR, diaDaSemana, horaCurta
} from './vet-calculo.js';
import { htmlLote, ligarLote, diasEntre, dataValida } from './vet-agenda-lote.js';

const MAX_DIAS = 92;
const usoNome = (id) => (USOS_AGENDA.find((u) => u.id === id) || { nome: id }).nome;
const selSlot = (d, h, a) => '[data-d="' + d + '"][data-h="' + h + '"][data-acao="' + a + '"]';

function htmlSlot(s, admin) {
  const conf = Number(s.confirmados) || 0;
  const aguard = Number(s.solicitados) || 0;
  const cap = Number(s.cap_slot) || 1;
  const d = esc(s.data_slot);
  const h = esc(s.hora_slot);
  const selos =
    (s.bloq_slot ? '<span class="vt-selo vt-selo-cinza">Bloqueado</span>' : '') +
    (s.publicado ? '<span class="vt-selo vt-selo-ok">Publicado</span>'
      : '<span class="vt-selo vt-selo-alerta">Não publicado</span>') +
    '<span class="vt-selo">' + esc(usoNome(s.uso_slot)) + '</span>' +
    (conf > cap ? '<span class="vt-selo vt-selo-urgente">Vagas abaixo dos confirmados</span>' : '');
  const acoes = admin
    ? '<span class="vt-slot-acoes">' +
        '<div class="campo"><label>Vagas<input type="number" min="1" max="20" step="1" value="' + cap +
          '" data-campo="cap" data-d="' + d + '" data-h="' + h + '"></label></div>' +
        '<div class="campo"><label>Uso<select data-campo="uso" data-d="' + d + '" data-h="' + h + '">' +
          USOS_AGENDA.map((u) => '<option value="' + u.id + '"' + (u.id === s.uso_slot ? ' selected' : '') + '>' +
            esc(u.nome) + '</option>').join('') + '</select></label></div>' +
        '<button type="button" class="btn btn-pequeno" data-acao="bloq-slot" data-d="' + d + '" data-h="' + h + '">' +
          (s.bloq_slot ? 'Desbloquear' : 'Bloquear') + '</button>' +
        '<button type="button" class="btn btn-perigo btn-pequeno" data-acao="rem-slot" data-d="' + d + '" data-h="' + h +
          '">Remover</button></span>'
    : '';
  return '<li class="vt-slot-linha' + (s.bloq_slot ? ' vt-slot-linha-bloq' : '') + '">' +
    '<span class="vt-slot-hora">' + esc(horaCurta(s.hora_slot)) + '</span>' +
    '<span class="vt-slot-info"><span>' + selos + '</span><span>Confirmados ' + conf + ' de ' + cap +
    ' · Solicitações aguardando: ' + aguard + '</span></span>' + acoes + '</li>';
}

function htmlDia(d, slots, admin, hoje) {
  const alguemBloq = slots.some((s) => s.bloq_slot);
  const alguemLivre = slots.some((s) => !s.bloq_slot);
  const dia = esc(d);
  const acoesDia = admin && slots.length
    ? '<div class="vt-dia-acoes">' +
        (alguemLivre ? '<button type="button" class="btn btn-pequeno" data-acao="bloq-dia" data-d="' + dia + '">Bloquear dia</button>' : '') +
        (alguemBloq ? '<button type="button" class="btn btn-pequeno" data-acao="desbloq-dia" data-d="' + dia + '">Desbloquear dia</button>' : '') +
        '<button type="button" class="btn btn-perigo btn-pequeno" data-acao="rem-dia" data-d="' + dia + '">Remover dia</button></div>'
    : '';
  const novo = admin
    ? '<details class="vt-novo-h"><summary>Novo horário</summary><div class="vt-grade-campos">' +
        '<div class="campo"><label>Horário<input type="time" step="60" data-campo="novo-hora"></label></div>' +
        '<div class="campo"><label>Vagas<input type="number" min="1" max="20" step="1" value="1" data-campo="novo-cap"></label></div>' +
        '<div class="campo"><label>Uso<select data-campo="novo-uso">' +
          USOS_AGENDA.map((u) => '<option value="' + u.id + '">' + esc(u.nome) + '</option>').join('') +
        '</select></label></div></div>' +
        '<div class="acoes"><button type="button" class="btn btn-primario btn-pequeno" data-acao="add-horario" data-d="' + dia +
        '">Adicionar horário</button></div></details>'
    : '';
  return '<section class="vt-dia" data-d="' + dia + '"><div class="vt-dia-cab"><h3 class="vt-dia-titulo">' +
    esc(DIAS_SEMANA[diaDaSemana(d)]) + ', ' + esc(dataBR(d)) + '</h3>' +
    (d < hoje ? '<span class="vt-selo vt-selo-cinza">Passado</span>' : '') + acoesDia + '</div>' +
    (slots.length ? '<ul class="vt-slot-lista">' + slots.map((s) => htmlSlot(s, admin)).join('') + '</ul>'
      : '<p class="vt-suave">Sem horários neste dia.</p>') + novo + '</section>';
}

export async function viewAgenda(alvo, ctx) {
  const admin = !!ctx.ehAdmin;
  const hoje = agoraFortaleza().data;
  let ini = hoje;
  let fim = somarDias(hoje, 13);
  let linhas = [];
  let pendente = null;
  let ocupado = false;

  alvo.innerHTML =
    '<div class="cartao"><form id="vt-ag-periodo" novalidate><div class="vt-agenda-barra">' +
      '<div class="campo"><label for="vt-ag-ini">De</label><input type="date" id="vt-ag-ini"></div>' +
      '<div class="campo"><label for="vt-ag-fim">Até</label><input type="date" id="vt-ag-fim"></div>' +
      '<button type="submit" class="btn">Mostrar período</button></div>' +
      '<p class="ajuda">Até ' + MAX_DIAS + ' dias por vez. O padrão é hoje e os próximos 13 dias.</p>' +
      '<p class="vt-campo-erro" id="vt-ag-erro-periodo" role="alert" hidden></p></form></div>' +
    '<div id="vt-ag-pend" aria-live="polite"></div>' +
    '<div class="cartao"><p class="nota">' + (admin
      ? 'As alterações abaixo ficam em rascunho. Os clientes só veem os horários depois de "Publicar agenda".'
      : 'Somente o Administrador edita e publica a agenda. Você pode consultar os horários e as solicitações aguardando.') + '</p>' +
      (admin ? '<div class="acoes"><button type="button" class="btn btn-primario" id="vt-ag-publicar">Publicar agenda</button></div>' : '') +
      '<div class="vt-faixa vt-faixa-erro" id="vt-ag-erro-pub" role="alert" hidden></div></div>' +
    (admin ? htmlLote() : '') +
    '<div id="vt-ag-lista"><p class="carregando" role="status">Carregando agenda…</p></div>';

  const q = (id) => alvo.querySelector('#' + id);
  const elIni = q('vt-ag-ini');
  const elFim = q('vt-ag-fim');
  const elErroPer = q('vt-ag-erro-periodo');
  const elPend = q('vt-ag-pend');
  const elErroPub = q('vt-ag-erro-pub');
  const elLista = q('vt-ag-lista');
  elIni.value = ini;
  elFim.value = fim;

  async function carregar() {
    const [r, p] = await Promise.all([
      supabase.rpc('vt_agenda_admin', { p_ini: ini, p_fim: fim }),
      supabase.rpc('vt_agenda_pendente')
    ]);
    if (r.error) throw r.error;
    linhas = Array.isArray(r.data) ? r.data : [];
    pendente = p.error ? null : p.data === true;
  }

  function renderizar() {
    if (pendente === true) {
      elPend.innerHTML = '<p class="vt-faixa vt-faixa-pendente">Há alterações na agenda que ainda não foram publicadas. Os clientes continuam vendo a versão publicada anteriormente.</p>';
    } else if (pendente === false) {
      elPend.innerHTML = '<p class="vt-faixa">A agenda publicada está igual à agenda em edição.</p>';
    } else {
      elPend.innerHTML = '';
    }
    const porDia = new Map();
    linhas.forEach((l) => {
      if (!porDia.has(l.data_slot)) porDia.set(l.data_slot, []);
      porDia.get(l.data_slot).push(l);
    });
    const partes = [];
    for (let d = ini; d <= fim; d = somarDias(d, 1)) partes.push(htmlDia(d, porDia.get(d) || [], admin, hoje));
    elLista.innerHTML = partes.join('');
  }

  async function recarregar() {
    await carregar();
    renderizar();
  }

  // Executa uma alteração, recarrega a lista e devolve o foco ao controle indicado.
  async function executar(fn, foco) {
    if (ocupado) return;
    ocupado = true;
    try { await fn(); } catch (e) { toast(msgErro(e), 'erro'); }
    try { await recarregar(); } catch (e) { toast(msgErro(e), 'erro'); }
    ocupado = false;
    if (foco) {
      const el = alvo.querySelector(foco);
      if (el) el.focus();
    }
  }

  const acharSlot = (d, h) => linhas.find((l) => l.data_slot === d && l.hora_slot === h);
  const slotsDoDia = (d) => linhas.filter((l) => l.data_slot === d);
  const confirmadosDoDia = (d) => slotsDoDia(d).reduce((n, s) => n + (Number(s.confirmados) || 0), 0);

  async function alterar(filtro, valores) {
    let consulta = supabase.from('vt_slots').update(valores).eq('data', filtro.data);
    if (filtro.hora) consulta = consulta.eq('hora', filtro.hora);
    const { error } = await consulta;
    if (error) throw error;
  }

  async function remover(filtro) {
    let consulta = supabase.from('vt_slots').delete().eq('data', filtro.data);
    if (filtro.hora) consulta = consulta.eq('hora', filtro.hora);
    const { error } = await consulta;
    if (error) throw error;
  }

  // ---------- Cliques ----------
  elLista.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button[data-acao]');
    if (!b || b.disabled || !admin) return;
    const acao = b.dataset.acao;
    const d = b.dataset.d;
    const h = b.dataset.h;

    if (acao === 'bloq-slot') {
      const s = acharSlot(d, h);
      if (!s) return;
      await executar(() => alterar({ data: d, hora: h }, { bloqueado: !s.bloq_slot }), selSlot(d, h, 'bloq-slot'));
    } else if (acao === 'rem-slot') {
      const s = acharSlot(d, h);
      const n = s ? Number(s.confirmados) || 0 : 0;
      const msg = n > 0
        ? 'ATENÇÃO: este horário tem ' + n + ' consulta(s) CONFIRMADA(S). Removê-lo do rascunho vai impedir a publicação da agenda enquanto existirem confirmadas nele. Remover mesmo assim?'
        : 'Remover o horário das ' + horaCurta(h) + ' de ' + dataBR(d) + '?';
      if (!(await confirmar(msg, 'Remover horário'))) return;
      await executar(async () => { await remover({ data: d, hora: h }); toast('Horário removido do rascunho.'); },
        '.vt-dia[data-d="' + d + '"] summary');
    } else if (acao === 'bloq-dia' || acao === 'desbloq-dia') {
      const bloquear = acao === 'bloq-dia';
      await executar(() => alterar({ data: d }, { bloqueado: bloquear }),
        '[data-acao="' + (bloquear ? 'desbloq-dia' : 'bloq-dia') + '"][data-d="' + d + '"]');
    } else if (acao === 'rem-dia') {
      const n = confirmadosDoDia(d);
      const msg = n > 0
        ? 'ATENÇÃO: este dia tem ' + n + ' consulta(s) CONFIRMADA(S). Remover o dia do rascunho vai impedir a publicação da agenda enquanto existirem confirmadas. Remover todos os horários de ' + dataBR(d) + ' mesmo assim?'
        : 'Remover todos os horários de ' + dataBR(d) + '?';
      if (!(await confirmar(msg, 'Remover dia'))) return;
      await executar(async () => { await remover({ data: d }); toast('Dia removido do rascunho.'); },
        '.vt-dia[data-d="' + d + '"] summary');
    } else if (acao === 'add-horario') {
      const caixa = b.closest('.vt-novo-h');
      const hora = caixa.querySelector('[data-campo="novo-hora"]').value;
      const cap = Number(caixa.querySelector('[data-campo="novo-cap"]').value);
      const uso = caixa.querySelector('[data-campo="novo-uso"]').value;
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) { toast('Informe o horário (HH:MM).', 'erro'); return; }
      if (!Number.isInteger(cap) || cap < 1 || cap > 20) { toast('As vagas devem ser de 1 a 20.', 'erro'); return; }
      if (!USOS_AGENDA.some((u) => u.id === uso)) { toast('Escolha o uso do horário.', 'erro'); return; }
      await executar(async () => {
        const { error } = await supabase.from('vt_slots').insert({ data: d, hora, capacidade: cap, uso });
        if (error) {
          if (error.code === '23505') { toast('Já existe um horário às ' + hora + ' em ' + dataBR(d) + '.', 'erro'); return; }
          throw error;
        }
        toast('Horário adicionado ao rascunho.');
      }, '.vt-dia[data-d="' + d + '"] summary');
    }
  });

  // ---------- Vagas e uso ----------
  elLista.addEventListener('change', async (ev) => {
    const c = ev.target.closest('[data-campo="cap"], [data-campo="uso"]');
    if (!c || !admin) return;
    const d = c.dataset.d;
    const h = c.dataset.h;
    if (c.dataset.campo === 'cap') {
      const cap = Number(c.value);
      if (!Number.isInteger(cap) || cap < 1 || cap > 20) {
        toast('As vagas devem ser um número de 1 a 20.', 'erro');
        await executar(async () => {}, '[data-campo="cap"][data-d="' + d + '"][data-h="' + h + '"]');
        return;
      }
      await executar(() => alterar({ data: d, hora: h }, { capacidade: cap }),
        '[data-campo="cap"][data-d="' + d + '"][data-h="' + h + '"]');
    } else if (USOS_AGENDA.some((u) => u.id === c.value)) {
      await executar(() => alterar({ data: d, hora: h }, { uso: c.value }),
        '[data-campo="uso"][data-d="' + d + '"][data-h="' + h + '"]');
    }
  });

  // ---------- Período ----------
  q('vt-ag-periodo').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    elErroPer.hidden = true;
    const novoIni = elIni.value;
    const novoFim = elFim.value;
    let erro = '';
    if (!dataValida(novoIni) || !dataValida(novoFim)) erro = 'Informe as duas datas do período.';
    else if (novoFim < novoIni) erro = 'A data final deve ser igual ou depois da inicial.';
    else if (diasEntre(novoIni, novoFim) + 1 > MAX_DIAS) erro = 'O período pode ter no máximo ' + MAX_DIAS + ' dias.';
    if (erro) {
      elErroPer.textContent = erro;
      elErroPer.hidden = false;
      return;
    }
    ini = novoIni;
    fim = novoFim;
    elLista.innerHTML = '<p class="carregando" role="status">Carregando agenda…</p>';
    try {
      await recarregar();
    } catch (e) {
      elLista.innerHTML = '<p class="vt-faixa vt-faixa-erro" role="alert">' + esc(msgErro(e)) + '</p>';
    }
  });

  // ---------- Publicar ----------
  const botaoPub = q('vt-ag-publicar');
  if (botaoPub) {
    botaoPub.addEventListener('click', async () => {
      if (!(await confirmar('Publicar a agenda? Os horários em edição passam a valer para os clientes no site.', 'Publicar agenda'))) return;
      elErroPub.hidden = true;
      botaoPub.disabled = true;
      setStatusPub('publicando', 'Publicando a agenda…');
      try {
        const { data, error } = await supabase.rpc('vt_publicar_agenda');
        if (error) throw error;
        setStatusPub('sucesso', 'Agenda publicada (' + (Number(data) || 0) + ' horários).');
        toast('Agenda publicada.');
        if (typeof ctx.atualizarStatus === 'function') await ctx.atualizarStatus();
        await recarregar();
      } catch (e) {
        setStatusPub('falha', 'A agenda não foi publicada.');
        elErroPub.textContent = msgErro(e);
        elErroPub.hidden = false;
        elErroPub.scrollIntoView({ block: 'center' });
        toast('A agenda não foi publicada.', 'erro');
      }
      botaoPub.disabled = false;
    });
  }

  // ---------- Geração em lote ----------
  if (admin) {
    ligarLote(alvo, {
      hoje,
      aoGerar: async () => {
        try { await recarregar(); } catch (e) { toast(msgErro(e), 'erro'); }
      }
    });
  }

  try {
    await recarregar();
  } catch (e) {
    elLista.innerHTML = '<p class="vt-faixa vt-faixa-erro" role="alert">' + esc(msgErro(e)) + '</p>';
  }
    }
