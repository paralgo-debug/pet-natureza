// PET NATUREZA - Banho & Tosa (site) - datas, horários e opções (1ª, 2ª, 3ª)
import { $, el, dataComSemana, dataLonga, chipData, horaCurta } from './banho-util.js';

export function criarHorarios(cliente, aoMudar) {
  const est = { porData: new Map(), data: null, opcoes: [] };
  const elDatas = $('bt-datas');
  const elHoras = $('bt-horas');
  const elTitulo = $('bt-horas-titulo');
  const elLista = $('bt-opcoes');
  const elBloco = $('bt-opcoes-bloco');
  const elMsg = $('bt-msg-opcoes');
  const pVazio = $('bt-sem-horarios').querySelector('p');
  const textoVazioPadrao = pVazio ? pVazio.textContent : '';

  const indice = (d, h) => est.opcoes.findIndex((o) => o.data === d && o.hora === h);
  const descrever = (o) => dataComSemana(o.data) + ' às ' + o.hora;

  function msg(texto) {
    elMsg.textContent = texto || '';
    elMsg.hidden = !texto;
  }

  // ---------- Datas ----------
  function criarChips() {
    const chips = Array.from(est.porData.keys()).map((d) => {
      const c = chipData(d);
      return el('button', { type: 'button', class: 'bt-data', 'data-data': d }, [
        el('span', { class: 'bt-dia-sem', texto: c.sem }),
        el('span', { class: 'bt-dia-num', texto: c.dia }),
        el('span', { class: 'bt-dia-mes', texto: c.mes })
      ]);
    });
    elDatas.replaceChildren(...chips);
  }

  function atualizarChips() {
    elDatas.querySelectorAll('button[data-data]').forEach((b) => {
      const d = b.getAttribute('data-data');
      const tem = est.opcoes.some((o) => o.data === d);
      b.setAttribute('aria-pressed', d === est.data ? 'true' : 'false');
      b.classList.toggle('tem-opcao', tem);
      b.setAttribute('aria-label', dataLonga(d) + (tem ? ', com horário escolhido' : ''));
    });
  }

  // ---------- Horários da data escolhida ----------
  function renderHoras() {
    elTitulo.replaceChildren(el('strong', { texto: 'Horários de ' + dataLonga(est.data) }));
    const lista = est.porData.get(est.data) || [];
    const botoes = lista.map((s) => {
      const idx = indice(est.data, s.hora);
      const lotado = s.situacao === 'lotado' && idx < 0;
      const sub = idx >= 0 ? (idx + 1) + 'ª opção' : lotado ? 'Lotado' : 'Disponível';
      return el('button', {
        type: 'button',
        class: 'bt-hora',
        'data-hora': s.hora,
        'aria-pressed': idx >= 0 ? 'true' : 'false',
        'aria-label': s.hora + ', ' + sub,
        disabled: lotado
      }, [document.createTextNode(s.hora), el('small', { texto: sub })]);
    });
    elHoras.replaceChildren(...botoes);
  }

  // ---------- Suas opções ----------
  function renderOpcoes() {
    elBloco.hidden = est.opcoes.length === 0;
    const ultimo = est.opcoes.length - 1;
    const itens = est.opcoes.map((o, i) => {
      const rot = (i + 1) + 'ª opção';
      const botao = (acao, simbolo, verbo, desab) => el('button', {
        type: 'button', class: 'bt-icone', 'data-acao': acao, 'data-idx': i,
        'aria-label': verbo + ' ' + rot, disabled: desab, texto: simbolo
      });
      return el('li', { class: 'bt-opcao' }, [
        el('span', { class: 'bt-opcao-rotulo', texto: rot }),
        el('span', { class: 'bt-opcao-texto', texto: descrever(o) }),
        el('span', { class: 'bt-opcao-acoes' }, [
          botao('subir', '↑', 'Subir', i === 0),
          botao('descer', '↓', 'Descer', i === ultimo),
          botao('remover', '✕', 'Remover', false)
        ])
      ]);
    });
    elLista.replaceChildren(...itens);
  }

  function renderTudo() {
    atualizarChips();
    renderHoras();
    renderOpcoes();
  }

  function focarOpcao(idx, acao) {
    let b = elLista.querySelector('button[data-idx="' + idx + '"][data-acao="' + acao + '"]');
    if (!b || b.disabled) b = elLista.querySelector('button[data-idx="' + idx + '"][data-acao="remover"]');
    if (b) b.focus();
  }

  // ---------- Eventos ----------
  elDatas.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-data]');
    if (!b) return;
    est.data = b.getAttribute('data-data');
    msg('');
    atualizarChips();
    renderHoras();
    b.focus();
  });

  elHoras.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-hora]');
    if (!b || b.disabled) return;
    const hora = b.getAttribute('data-hora');
    const i = indice(est.data, hora);
    if (i >= 0) {
      est.opcoes.splice(i, 1);
      msg('');
    } else if (est.opcoes.length >= 3) {
      msg('Você já escolheu 3 opções. Remova uma para escolher outro horário.');
      return;
    } else {
      est.opcoes.push({ data: est.data, hora });
      msg('');
    }
    renderTudo();
    const novo = elHoras.querySelector('button[data-hora="' + hora + '"]');
    if (novo) novo.focus();
    aoMudar();
  });

  elLista.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-acao]');
    if (!b || b.disabled) return;
    const idx = Number(b.getAttribute('data-idx'));
    const acao = b.getAttribute('data-acao');
    msg('');
    if (acao === 'subir' && idx > 0) {
      [est.opcoes[idx - 1], est.opcoes[idx]] = [est.opcoes[idx], est.opcoes[idx - 1]];
      renderTudo();
      focarOpcao(idx - 1, 'subir');
    } else if (acao === 'descer' && idx < est.opcoes.length - 1) {
      [est.opcoes[idx + 1], est.opcoes[idx]] = [est.opcoes[idx], est.opcoes[idx + 1]];
      renderTudo();
      focarOpcao(idx + 1, 'descer');
    } else if (acao === 'remover') {
      est.opcoes.splice(idx, 1);
      renderTudo();
      if (est.opcoes.length > 0) focarOpcao(Math.min(idx, est.opcoes.length - 1), 'remover');
      else {
        const primeiro = elDatas.querySelector('button');
        if (primeiro) primeiro.focus();
      }
    }
    aoMudar();
  });

  // ---------- Carregamento ----------
  function mostrarVazio(texto) {
    if (pVazio) pVazio.textContent = texto || textoVazioPadrao;
    $('bt-sem-horarios').hidden = false;
    $('bt-horarios-area').hidden = true;
  }

  // Retorna { estado: 'ok' | 'vazio' | 'erro', removidas: número de opções que deixaram de valer }
  async function carregar() {
    let slots = [];
    try {
      const { data, error } = await cliente.rpc('bt_horarios_publicos');
      if (error) throw error;
      slots = Array.isArray(data) ? data : [];
    } catch (e) {
      $('bt-carregando').hidden = true;
      mostrarVazio('Não foi possível carregar os horários agora. Tente novamente em instantes ou fale com a gente pelo WhatsApp.');
      return { estado: 'erro', removidas: 0 };
    }

    est.porData = new Map();
    for (const s of slots) {
      const d = s.data_slot;
      if (!est.porData.has(d)) est.porData.set(d, []);
      est.porData.get(d).push({ hora: horaCurta(s.hora_slot), situacao: s.situacao });
    }

    const antes = est.opcoes.length;
    est.opcoes = est.opcoes.filter((o) =>
      (est.porData.get(o.data) || []).some((s) => s.hora === o.hora && s.situacao === 'disponivel')
    );
    const removidas = antes - est.opcoes.length;

    $('bt-carregando').hidden = true;
    if (est.porData.size === 0) {
      est.data = null;
      renderOpcoes();
      mostrarVazio();
      return { estado: 'vazio', removidas };
    }

    $('bt-sem-horarios').hidden = true;
    $('bt-horarios-area').hidden = false;
    if (!est.data || !est.porData.has(est.data)) est.data = est.porData.keys().next().value;
    criarChips();
    renderTudo();
    return { estado: 'ok', removidas };
  }

  function limpar() {
    est.opcoes = [];
    msg('');
    if (est.porData.size > 0) renderTudo();
    else renderOpcoes();
  }

  return {
    carregar,
    limpar,
    descrever,
    opcoes: () => est.opcoes.map((o) => ({ data: o.data, hora: o.hora })),
    focoOpcoes: () => elDatas.querySelector('button') || $('bt-sem-horarios-zap')
  };
        }
