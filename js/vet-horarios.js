// Pet Natureza - Consulta Veterinária
// Horários publicados, filtro por motivo e lista de opções (1ª a 3ª).
// Estado compartilhado (criado em js/vet.js):
//   estado = { cfg, horarios:[{data,hora,uso,situacao}], tipoId, opcoes:[{data,hora}] }

import {
  DIAS_SEMANA, DIAS_SEMANA_CURTO, agoraFortaleza, dataBR, dataCurta,
  diaDaSemana, horaCurta, esc
} from '../admin/js/vet-calculo.js';

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORA_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const USOS = ['geral', 'retorno', 'urgencia'];
const $ = (id) => document.getElementById(id);

// ---------- Motivo e grupo de agenda ----------
export function tipoPorId(cfg, id) {
  const tipos = Array.isArray(cfg && cfg.tipos) ? cfg.tipos : [];
  return tipos.find((t) => t && t.id === id) || null;
}

export function usoDoTipo(cfg, id) {
  const t = tipoPorId(cfg, id);
  if (!t) return null;
  return USOS.includes(t.agenda) ? t.agenda : 'geral';
}

export function urgenciaBloqueada(cfg, id) {
  return usoDoTipo(cfg, id) === 'urgencia' && !!cfg && cfg.permitir_urgencia_online === false;
}

// ---------- Carregamento ----------
export function normalizarHorarios(linhas) {
  const lista = [];
  (Array.isArray(linhas) ? linhas : []).forEach((r) => {
    if (!r || !DATA_RE.test(String(r.data_slot || ''))) return;
    const hora = horaCurta(r.hora_slot);
    if (!HORA_RE.test(hora)) return;
    lista.push({
      data: r.data_slot,
      hora,
      uso: USOS.includes(r.uso) ? r.uso : 'geral',
      situacao: r.situacao === 'lotado' ? 'lotado' : 'disponivel'
    });
  });
  lista.sort((a, b) => {
    const x = a.data + a.hora;
    const y = b.data + b.hora;
    return x < y ? -1 : x > y ? 1 : 0;
  });
  return lista;
}

// Lança erro se a chamada falhar (quem chama decide a mensagem).
export async function carregarHorarios(client) {
  const { data, error } = await client.rpc('vt_horarios_publicos');
  if (error) throw error;
  return normalizarHorarios(data);
}

export function descreverOpcao(o) {
  return dataCurta(o.data) + ' às ' + horaCurta(o.hora);
}

function minutos(data, hora) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  const h = /^(\d{2}):(\d{2})/.exec(hora);
  if (!m || !h) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +h[1], +h[2]) / 60000;
}

// Horários que o motivo atual pode ver (grupo de agenda + antecedência).
function visiveis(estado) {
  if (!estado.tipoId || urgenciaBloqueada(estado.cfg, estado.tipoId)) return [];
  const uso = usoDoTipo(estado.cfg, estado.tipoId);
  const agora = agoraFortaleza();
  const ant = Number(estado.cfg && estado.cfg.antecedencia_horas);
  const limite = minutos(agora.data, agora.hora) + (Number.isFinite(ant) ? ant : 12) * 60;
  return estado.horarios.filter((h) => h.uso === uso && minutos(h.data, h.hora) >= limite);
}

// ---------- Controlador da tela ----------
export function criarHorarios({ estado, aoMudar }) {
  let dataAtiva = null;
  let aviso = '';

  const elDatas = $('vt-datas');
  const elHoras = $('vt-horarios');
  const elVazio = $('vt-sem-horarios');
  const elStatus = $('vt-horarios-status');
  const elOpcoes = $('vt-opcoes');
  const elOpcVazio = $('vt-opcoes-vazio');
  const elErro = $('erro-opcoes');
  elErro.tabIndex = -1;
  elOpcVazio.tabIndex = -1;

  const indiceOpcao = (d, h) => estado.opcoes.findIndex((o) => o.data === d && o.hora === h);

  function mostrarErro(msg) {
    elErro.textContent = msg;
    elErro.hidden = false;
  }

  function limparErro() {
    elErro.textContent = '';
    elErro.hidden = true;
  }

  function focar(seletor) {
    const el = document.querySelector(seletor);
    if (el && !el.disabled) el.focus();
  }

  function renderizar(foco) {
    const lista = visiveis(estado);
    const datas = Array.from(new Set(lista.map((h) => h.data)));
    const bloqueada = urgenciaBloqueada(estado.cfg, estado.tipoId);

    if (!datas.includes(dataAtiva)) {
      dataAtiva = datas.find((d) => lista.some((h) => h.data === d && h.situacao === 'disponivel'))
        || datas[0] || null;
    }

    // mensagens
    let msg = aviso;
    if (!msg) {
      if (!estado.tipoId) msg = 'Escolha o motivo da consulta (passo 1) para ver os horários.';
      else if (bloqueada) msg = 'Este motivo não pode ser enviado pelo formulário. Fale com a equipe pelo WhatsApp.';
    }
    elStatus.textContent = msg;
    elVazio.hidden = !(estado.tipoId && !bloqueada && datas.length === 0);

    // chips de datas
    elDatas.innerHTML = datas.map((d) => {
      const slots = lista.filter((h) => h.data === d);
      const prios = estado.opcoes.map((o, i) => (o.data === d ? (i + 1) + 'ª' : null)).filter(Boolean);
      const lotada = slots.every((h) => h.situacao !== 'disponivel');
      const marca = prios.length ? '✓ ' + prios.join(', ') : (lotada ? 'Lotado' : '');
      const dow = diaDaSemana(d);
      let rotulo = DIAS_SEMANA[dow] + ', ' + dataBR(d);
      if (prios.length) rotulo += ', escolhida como ' + prios.join(' e ') + ' opção';
      else if (lotada) rotulo += ', lotado';
      return '<li><button type="button" class="vt-data-chip" data-data="' + d + '" aria-pressed="' +
        (d === dataAtiva) + '" aria-label="' + esc(rotulo) + '">' +
        '<span class="vt-data-dia">' + esc(DIAS_SEMANA_CURTO[dow]) + '</span>' +
        '<span class="vt-data-num">' + esc(dataBR(d).slice(0, 5)) + '</span>' +
        '<span class="vt-data-marca">' + esc(marca) + '</span></button></li>';
    }).join('');

    // horários da data ativa
    elHoras.innerHTML = lista.filter((h) => h.data === dataAtiva).map((h) => {
      const i = indiceOpcao(h.data, h.hora);
      const sel = i >= 0;
      const lotado = h.situacao !== 'disponivel';
      const rotulo = sel ? (i + 1) + 'ª opção' : (lotado ? 'Lotado' : '');
      const aria = h.hora + (sel ? ', escolhido como ' + (i + 1) + 'ª opção' : (lotado ? ', lotado' : ', disponível'));
      return '<li><button type="button" class="vt-slot" data-data="' + h.data + '" data-hora="' + h.hora +
        '" aria-pressed="' + sel + '"' + (lotado && !sel ? ' disabled' : '') +
        ' aria-label="' + esc(aria) + '">' + esc(h.hora) +
        (rotulo ? '<span class="vt-slot-rotulo">' + esc(rotulo) + '</span>' : '') + '</button></li>';
    }).join('');

    // lista "Suas opções"
    elOpcVazio.hidden = estado.opcoes.length > 0;
    const ultimo = estado.opcoes.length - 1;
    elOpcoes.innerHTML = estado.opcoes.map((o, i) => {
      const desc = descreverOpcao(o);
      const n = (i + 1) + 'ª';
      return '<li class="vt-opcao"><span class="vt-opcao-texto">' + n + ' opção: ' + esc(desc) + '</span>' +
        '<span class="vt-opcao-acoes">' +
        '<button type="button" class="vt-icone-btn" data-acao="subir" data-i="' + i + '"' +
          (i === 0 ? ' disabled' : '') + ' aria-label="Subir a ' + n + ' opção (' + esc(desc) + ')">↑</button>' +
        '<button type="button" class="vt-icone-btn" data-acao="descer" data-i="' + i + '"' +
          (i === ultimo ? ' disabled' : '') + ' aria-label="Descer a ' + n + ' opção (' + esc(desc) + ')">↓</button>' +
        '<button type="button" class="vt-icone-btn" data-acao="remover" data-i="' + i +
          '" aria-label="Remover a ' + n + ' opção (' + esc(desc) + ')">✕</button>' +
        '</span></li>';
    }).join('');

    if (foco) focar(foco);
  }

  function alternar(d, h) {
    limparErro();
    aviso = '';
    const i = indiceOpcao(d, h);
    if (i >= 0) {
      estado.opcoes.splice(i, 1);
    } else {
      if (estado.opcoes.length >= 3) {
        mostrarErro('Você já escolheu 3 opções. Remova uma para escolher outra.');
        renderizar('.vt-slot[data-data="' + d + '"][data-hora="' + h + '"]');
        return;
      }
      estado.opcoes.push({ data: d, hora: h });
    }
    renderizar('.vt-slot[data-data="' + d + '"][data-hora="' + h + '"]');
    aoMudar();
  }

  elDatas.addEventListener('click', (ev) => {
    const b = ev.target.closest('button.vt-data-chip');
    if (!b) return;
    dataAtiva = b.getAttribute('data-data');
    aviso = '';
    renderizar('.vt-data-chip[data-data="' + dataAtiva + '"]');
  });

  elHoras.addEventListener('click', (ev) => {
    const b = ev.target.closest('button.vt-slot');
    if (!b || b.disabled) return;
    alternar(b.getAttribute('data-data'), b.getAttribute('data-hora'));
  });

  elOpcoes.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-acao]');
    if (!b || b.disabled) return;
    const i = Number(b.getAttribute('data-i'));
    const acao = b.getAttribute('data-acao');
    limparErro();
    aviso = '';
    if (acao === 'subir' && i > 0) {
      estado.opcoes.splice(i - 1, 2, estado.opcoes[i], estado.opcoes[i - 1]);
      renderizar(i - 1 > 0
        ? 'button[data-acao="subir"][data-i="' + (i - 1) + '"]'
        : 'button[data-acao="descer"][data-i="' + (i - 1) + '"]');
    } else if (acao === 'descer' && i < estado.opcoes.length - 1) {
      estado.opcoes.splice(i, 2, estado.opcoes[i + 1], estado.opcoes[i]);
      renderizar(i + 1 < estado.opcoes.length - 1
        ? 'button[data-acao="descer"][data-i="' + (i + 1) + '"]'
        : 'button[data-acao="subir"][data-i="' + (i + 1) + '"]');
    } else if (acao === 'remover') {
      estado.opcoes.splice(i, 1);
      if (estado.opcoes.length) {
        renderizar('button[data-acao="remover"][data-i="' + Math.min(i, estado.opcoes.length - 1) + '"]');
      } else {
        renderizar();
        elOpcVazio.focus();
      }
    } else {
      return;
    }
    aoMudar();
  });

  // Remove opções que deixaram de valer (outro motivo ou horário lotado/fora do ar).
  // contexto: 'tipo' (trocou o motivo) | 'recarga' (horários recarregados após erro).
  // Só chame com a lista de horários já carregada.
  function removerIndisponiveis(contexto) {
    const lista = visiveis(estado);
    const ok = (o) => lista.some((h) => h.data === o.data && h.hora === o.hora && h.situacao === 'disponivel');
    const removidas = estado.opcoes.filter((o) => !ok(o));
    if (removidas.length) {
      const mantidas = estado.opcoes.filter(ok);
      estado.opcoes.splice(0, estado.opcoes.length, ...mantidas);
      const nomes = removidas.map(descreverOpcao).join('; ');
      aviso = contexto === 'tipo'
        ? 'Removemos opções de horário que não combinam com o motivo escolhido: ' + nomes + '.'
        : 'Estes horários não estão mais disponíveis e foram removidos das suas opções: ' + nomes + '.';
    }
    return removidas;
  }

  function reiniciar() {
    estado.opcoes.splice(0, estado.opcoes.length);
    aviso = '';
    dataAtiva = null;
    limparErro();
    renderizar();
  }

  return { renderizar, removerIndisponiveis, reiniciar, mostrarErro, limparErro };
    }
