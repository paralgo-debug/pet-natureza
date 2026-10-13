// PET NATUREZA - Banho & Tosa (painel) - aba Agenda
import { supabase } from './supabase.js';
import { esc, toast, confirmar, setStatusPub } from './util.js';
import { dataBR, hora5 } from './banho-cartao.js';
import { msgErro } from './banho-acoes.js';
import {
  SEMANA, hojeISO, somarDias, diasEntre, diaSemana, dataValida, lerHoras, htmlLote, ligarLote
} from './banho-agenda-lote.js';

const MAX_PERIODO = 92;

function garantirCss() {
  if (document.getElementById('bt-agenda-css')) return;
  const l = document.createElement('link');
  l.id = 'bt-agenda-css';
  l.rel = 'stylesheet';
  l.href = 'css/banho-agenda.css';
  document.head.append(l);
}

function erroPeriodo(ini, fim) {
  if (!dataValida(ini) || !dataValida(fim)) return 'Informe a data inicial e a final.';
  if (fim < ini) return 'A data final não pode ser antes da inicial.';
  if (diasEntre(ini, fim) + 1 > MAX_PERIODO) return 'O período pode ter no máximo ' + MAX_PERIODO + ' dias.';
  return '';
}

// Executa uma gravação e confirma que alguma linha foi realmente alterada
async function gravar(consulta) {
  const { data, error } = await consulta.select('data');
  if (error) {
    if (error.code === '23505') throw new Error('Este horário já existe neste dia.');
    throw error;
  }
  if (!data || data.length === 0) throw new Error('Nada foi alterado. Confirme se você é administrador.');
}

export async function viewAgenda(alvo, ctx) {
  garantirCss();
  const admin = !!ctx.ehAdmin;
  const hoje = hojeISO();
  const est = { ini: hoje, fim: somarDias(hoje, 13), linhas: [], pendente: false, erroPub: '' };
  let mapa = new Map();

  alvo.innerHTML =
    '<p class="ajuda">Toda alteração fica em <strong>rascunho</strong> até a agenda ser publicada. Os clientes só enxergam o que foi publicado.' +
    (admin ? '' : ' Você pode visualizar a agenda; somente o administrador altera e publica.') + '</p>' +
    '<div id="bt-ag-banner"></div>' +
    '<div class="cartao bt-periodo"><h2>Período</h2><div class="bt-periodo-campos">' +
    '<div class="campo"><label for="bt-ag-ini">De</label><input type="date" id="bt-ag-ini" value="' + esc(est.ini) + '"></div>' +
    '<div class="campo"><label for="bt-ag-fim">Até (máximo de ' + MAX_PERIODO + ' dias)</label><input type="date" id="bt-ag-fim" value="' + esc(est.fim) + '"></div>' +
    '<div class="acoes"><button type="button" class="btn btn-pequeno" id="bt-ag-aplicar">Mostrar período</button></div></div>' +
    '<p class="erro" id="bt-ag-per-erro" role="alert" hidden></p></div>' +
    (admin ? htmlLote() : '') +
    '<div class="bt-dias" id="bt-ag-dias"><p class="carregando">Carregando agenda…</p></div>';

  const $ = (id) => alvo.querySelector('#' + id);

  // ---------- HTML ----------
  function htmlBanner() {
    let h = '';
    if (est.erroPub) {
      h += '<div class="bt-alerta bt-alerta-perigo" role="alert">' + esc(est.erroPub) + '</div>';
    }
    if (est.pendente) {
      h += '<div class="nota bt-faixa" role="status">Há alterações na agenda que ainda <strong>não foram publicadas</strong>. Os clientes só veem os horários depois da publicação.' +
        (admin ? '<div class="acoes"><button type="button" class="btn btn-primario" data-acao="publicar">Publicar agenda</button></div>' : '') + '</div>';
    } else {
      h += '<p class="suave bt-faixa" role="status">A agenda publicada está igual ao rascunho.</p>';
    }
    return h;
  }

  function htmlSlot(r) {
    const d = r.data_slot;
    const h = r.hora_slot;
    const h5 = hora5(h);
    const k = d + '|' + h;
    const nome = h5 + ' de ' + dataBR(d);
    const dados = ' data-d="' + esc(d) + '" data-h="' + esc(h) + '"';
    const selos =
      (r.bloqueado ? '<span class="bt-tag bt-tag-atencao">Bloqueado</span>' : '') +
      (r.publicado ? '<span class="bt-st st-confirmado">Publicado</span>' : '<span class="bt-st st-contato">Não publicado</span>');
    const controles = admin
      ? '<div class="bt-slot-acoes">' +
        '<label class="bt-slot-vagas" for="bt-cap-' + esc(d + '-' + h5.replace(':', '')) + '">Vagas ' +
        '<input type="number" id="bt-cap-' + esc(d + '-' + h5.replace(':', '')) + '" min="1" max="20" step="1" inputmode="numeric" value="' + Number(r.capacidade) + '" data-cap data-k="cap|' + esc(k) + '"' + dados + '></label>' +
        '<button type="button" class="btn btn-pequeno" data-acao="bloq" data-k="bloq|' + esc(k) + '"' + dados +
        ' aria-label="' + (r.bloqueado ? 'Desbloquear' : 'Bloquear') + ' horário ' + esc(nome) + '">' + (r.bloqueado ? 'Desbloquear' : 'Bloquear') + '</button>' +
        '<button type="button" class="btn btn-perigo btn-pequeno" data-acao="rem"' + dados + ' aria-label="Remover horário ' + esc(nome) + '">Remover</button></div>'
      : '';
    return '<li class="bt-slot"><div class="bt-slot-topo"><span class="bt-slot-hora">' + esc(h5) + '</span>' + selos + '</div>' +
      '<p class="bt-slot-info">Confirmados ' + Number(r.confirmados) + ' de ' + Number(r.capacidade) + ' vaga(s) · Solicitações aguardando: ' + Number(r.solicitados) + '</p>' +
      controles + '</li>';
  }

  function htmlDia(iso, linhas) {
    const titulo = SEMANA[diaSemana(iso)] + ', ' + dataBR(iso) + (iso === hoje ? ' (hoje)' : '');
    const dd = ' data-d="' + esc(iso) + '"';
    const acoesDia = admin && linhas.length > 0
      ? '<div class="bt-dia-acoes">' +
        '<button type="button" class="btn btn-pequeno" data-acao="dia-bloq" data-k="dia-bloq|' + esc(iso) + '"' + dd + '>Bloquear dia</button>' +
        '<button type="button" class="btn btn-pequeno" data-acao="dia-desbloq"' + dd + '>Desbloquear dia</button>' +
        '<button type="button" class="btn btn-perigo btn-pequeno" data-acao="dia-rem"' + dd + '>Remover dia</button></div>'
      : '';
    const novo = admin
      ? '<div class="bt-novo"><div class="campo"><label for="bt-novo-' + esc(iso) + '">Novo horário</label>' +
        '<input type="time" id="bt-novo-' + esc(iso) + '" data-novo' + dd + ' data-k="novo|' + esc(iso) + '"></div>' +
        '<button type="button" class="btn btn-pequeno" data-acao="novo"' + dd + '>Adicionar horário</button></div>'
      : '';
    return '<section class="cartao bt-dia" aria-label="' + esc(titulo) + '"><h3>' + esc(titulo) + '</h3>' + acoesDia +
      (linhas.length > 0 ? '<ul class="bt-slots">' + linhas.map(htmlSlot).join('') + '</ul>' : '<p class="suave bt-sem-slots">Sem horários neste dia.</p>') +
      novo + '</section>';
  }

  function render() {
    $('bt-ag-banner').innerHTML = htmlBanner();
    const porDia = new Map();
    for (const r of est.linhas) {
      if (!porDia.has(r.data_slot)) porDia.set(r.data_slot, []);
      porDia.get(r.data_slot).push(r);
    }
    const n = diasEntre(est.ini, est.fim) + 1;
    let h = '';
    for (let i = 0; i < n; i += 1) {
      const iso = somarDias(est.ini, i);
      const linhas = porDia.get(iso) || [];
      if (linhas.length > 0 || admin) h += htmlDia(iso, linhas);
    }
    $('bt-ag-dias').innerHTML = h || '<p class="suave">Nenhum horário neste período.</p>';
  }

  // ---------- Dados ----------
  async function carregar() {
    const [a, p] = await Promise.all([
      supabase.rpc('bt_agenda_admin', { p_ini: est.ini, p_fim: est.fim }),
      supabase.rpc('bt_agenda_pendente')
    ]);
    if (a.error) throw a.error;
    if (p.error) throw p.error;
    est.linhas = Array.isArray(a.data) ? a.data : [];
    est.pendente = p.data === true;
    mapa = new Map(est.linhas.map((r) => [r.data_slot + '|' + r.hora_slot, r]));
  }

  async function recarregar(foco) {
    est.erroPub = '';
    await carregar();
    render();
    if (foco) {
      const alvoFoco = alvo.querySelector('[data-k="' + CSS.escape(foco) + '"]');
      if (alvoFoco) alvoFoco.focus();
    }
  }

  async function executar(botao, foco, fn) {
    if (botao) botao.disabled = true;
    try {
      await fn();
      await recarregar(foco);
    } catch (e) {
      toast(msgErro(e), 'erro');
      if (botao) botao.disabled = false;
    }
  }

  const doDia = (d) => est.linhas.filter((r) => r.data_slot === d);
  const conf = (linhas) => linhas.reduce((s, r) => s + Number(r.confirmados || 0), 0);

  // ---------- Publicar ----------
  async function publicar(botao) {
    const ok = await confirmar('Publicar a agenda? Os horários do rascunho passam a valer para os clientes. Horários removidos ou bloqueados deixam de aparecer no site.', 'Publicar agenda');
    if (!ok) return;
    botao.disabled = true;
    est.erroPub = '';
    setStatusPub('publicando', 'Publicando agenda…');
    const { error } = await supabase.rpc('bt_publicar_agenda');
    if (error) {
      est.erroPub = msgErro(error);
      setStatusPub('falha', 'A agenda não foi publicada.');
      render();
      const faixa = alvo.querySelector('#bt-ag-banner [role="alert"]');
      if (faixa) { faixa.setAttribute('tabindex', '-1'); faixa.focus(); }
      return;
    }
    setStatusPub('sucesso', 'Agenda publicada.');
    toast('Agenda publicada.');
    try { await ctx.atualizarStatus(); } catch (e) { /* ignora */ }
    try { await recarregar(); } catch (e) { toast(msgErro(e), 'erro'); }
  }

  // ---------- Eventos ----------
  $('bt-ag-aplicar').addEventListener('click', async () => {
    const ini = $('bt-ag-ini').value;
    const fim = $('bt-ag-fim').value;
    const msg = erroPeriodo(ini, fim);
    $('bt-ag-per-erro').textContent = msg;
    $('bt-ag-per-erro').hidden = !msg;
    if (msg) return;
    est.ini = ini;
    est.fim = fim;
    try { await recarregar(); } catch (e) { toast(msgErro(e), 'erro'); }
  });

  alvo.addEventListener('click', async (ev) => {
    const botao = ev.target.closest('button[data-acao]');
    if (!botao || !alvo.contains(botao)) return;
    const acao = botao.dataset.acao;
    const d = botao.dataset.d;
    const h = botao.dataset.h;
    const foco = botao.dataset.k || '';
    if (acao === 'publicar') {
      if (admin) await publicar(botao);
      return;
    }
    if (!admin) return;
    const slots = (tabela) => supabase.from(tabela);

    if (acao === 'bloq') {
      const r = mapa.get(d + '|' + h);
      if (!r) return;
      await executar(botao, foco, () => gravar(slots('bt_slots').update({ bloqueado: !r.bloqueado }).eq('data', d).eq('hora', h)));
    } else if (acao === 'rem') {
      const r = mapa.get(d + '|' + h);
      const n = r ? Number(r.confirmados) : 0;
      const msg = n > 0
        ? 'Este horário tem ' + n + ' agendamento(s) confirmado(s). A publicação da agenda será recusada até você remarcar ou cancelar esses agendamentos. Remover mesmo assim do rascunho?'
        : 'Remover este horário do rascunho? Para os clientes, a mudança só vale depois de publicar a agenda.';
      if (!(await confirmar(msg, 'Remover horário'))) return;
      await executar(botao, foco, () => gravar(slots('bt_slots').delete().eq('data', d).eq('hora', h)));
    } else if (acao === 'dia-bloq' || acao === 'dia-desbloq') {
      if (doDia(d).length === 0) return toast('Este dia não tem horários.', 'erro');
      await executar(botao, foco, () => gravar(slots('bt_slots').update({ bloqueado: acao === 'dia-bloq' }).eq('data', d)));
    } else if (acao === 'dia-rem') {
      const linhas = doDia(d);
      if (linhas.length === 0) return;
      const n = conf(linhas);
      const msg = (n > 0 ? 'Atenção: este dia tem ' + n + ' agendamento(s) confirmado(s); a publicação será recusada até você remarcar ou cancelar. ' : '') +
        'Remover todos os ' + linhas.length + ' horário(s) de ' + dataBR(d) + ' do rascunho?';
      if (!(await confirmar(msg, 'Remover dia'))) return;
      await executar(botao, '', () => gravar(slots('bt_slots').delete().eq('data', d)));
    } else if (acao === 'novo') {
      const campo = alvo.querySelector('input[data-novo][data-d="' + CSS.escape(d) + '"]');
      const { horas, invalidas } = lerHoras(campo ? campo.value : '');
      if (invalidas.length > 0 || horas.length !== 1) {
        toast('Informe um horário válido, por exemplo 09:00.', 'erro');
        if (campo) campo.focus();
        return;
      }
      await executar(botao, 'novo|' + d, () => gravar(slots('bt_slots').insert({ data: d, hora: horas[0], capacidade: 1 })));
    }
  });

  alvo.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' || !ev.target.matches || !ev.target.matches('input[data-novo]')) return;
    ev.preventDefault();
    const b = alvo.querySelector('button[data-acao="novo"][data-d="' + CSS.escape(ev.target.dataset.d) + '"]');
    if (b) b.click();
  });

  alvo.addEventListener('change', async (ev) => {
    const campo = ev.target;
    if (!admin || !campo.matches || !campo.matches('input[data-cap]')) return;
    const d = campo.dataset.d;
    const h = campo.dataset.h;
    const r = mapa.get(d + '|' + h);
    const v = Number(campo.value);
    if (!r) return;
    if (campo.value.trim() === '' || !Number.isInteger(v) || v < 1 || v > 20) {
      toast('Informe de 1 a 20 vagas.', 'erro');
      render();
      return;
    }
    if (v === Number(r.capacidade)) return;
    try {
      await gravar(supabase.from('bt_slots').update({ capacidade: v }).eq('data', d).eq('hora', h));
      if (v < Number(r.confirmados)) {
        toast('Vagas salvas no rascunho, mas há ' + r.confirmados + ' confirmado(s) neste horário. A publicação será recusada até você remarcar ou cancelar.', 'erro');
      }
      await recarregar(campo.dataset.k);
    } catch (e) {
      toast(msgErro(e), 'erro');
      render();
    }
  });

  if (admin) ligarLote(alvo, () => recarregar());

  try {
    await carregar();
    render();
  } catch (e) {
    $('bt-ag-dias').innerHTML = '<p class="erro" role="alert">' + esc(msgErro(e)) + '</p>';
  }
}
