// Pet Natureza - Painel: aba Tipos e preços (motivos, preços, aviso e simulador).
// Administrador edita; Funcionário só vê (a regra real é no banco).

import { toast, confirmar, setStatusPub, formatarDataHora } from './util.js';
import {
  esc, msgErro, carregarCss, lerConfigs, localLer, localGravar, localRemover, debounce
} from './vet-comum.js';
import { mesclarConfig, parseNumero, clone } from './vet-calculo.js';
import {
  corpoSecao, validarCfg, normalizarCfg, garantirEstrutura, setPath, novoIdTipo, novoIdHorario
} from './vet-precos-form.js';
import { htmlSimulador, ligarSimulador } from './vet-precos-sim.js';
import {
  gravarRascunho, publicarConfig, descartarRascunho, listarRevisoes, restaurarRevisao
} from './vet-precos-fluxo.js';

const SECOES = [
  ['tipos', 'Motivos de consulta'],
  ['extras', 'Adicional por espécie e por porte'],
  ['peso', 'Faixas de peso'],
  ['manejo', 'Manejo difícil'],
  ['horarios', 'Horários especiais'],
  ['agenda', 'Agendamento (antecedência e janela)'],
  ['aviso', 'Aviso de emergência']
];

const estavel = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.keys(x).sort().reduce((o, c) => { o[c] = x[c]; return o; }, {}) : x));
const calmo = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function viewPrecos(alvo, ctx) {
  carregarCss('css/vet-precos.css');
  const admin = !!ctx.ehAdmin;
  const uid = ctx.user && ctx.user.id;
  let cfg = null;
  let publicada = null;
  let temRascunho = false;
  let dirty = false;
  let ocupado = false;
  let parseErros = {};
  let sim = null;

  const LISTAS = {
    tipos: { obter: () => cfg.tipos, sec: 'tipos', prefixo: 'tipos.' },
    peso_faixas: { obter: () => cfg.precos.peso_faixas, sec: 'peso', prefixo: 'precos.peso_faixas.' },
    horario_especial: { obter: () => cfg.precos.horario_especial, sec: 'horarios', prefixo: 'precos.horario_especial.' }
  };

  const q = (sel) => alvo.querySelector(sel);

  async function carregarEstado() {
    const r = await lerConfigs();
    cfg = garantirEstrutura(clone(r.cfg));
    publicada = r.publicada;
    temRascunho = r.temRascunho;
    dirty = false;
    parseErros = {};
  }

  alvo.innerHTML = '<p class="carregando" role="status">Carregando configuração…</p>';
  try {
    await carregarEstado();
  } catch (e) {
    alvo.innerHTML = '<p class="vt-faixa vt-faixa-erro" role="alert">' + esc(msgErro(e)) + '</p>';
    return;
  }

  // ---------- Estrutura da tela ----------
  const secoesHtml = SECOES.map(([id, titulo], i) =>
    '<details class="cartao" data-sec="' + id + '"' + (i === 0 ? ' open' : '') + '><summary>' + esc(titulo) +
    '</summary><div data-corpo></div></details>').join('');

  alvo.innerHTML =
    '<div class="cartao"><p class="vt-pr-status" id="vt-pr-status" aria-live="polite"></p>' +
      '<div id="vt-pr-recuperar" hidden></div>' +
      (admin
        ? '<div class="acoes"><button type="button" class="btn" id="vt-pr-salvar">Salvar rascunho</button>' +
          '<button type="button" class="btn btn-primario" id="vt-pr-publicar">Publicar</button>' +
          '<button type="button" class="btn" id="vt-pr-descartar" hidden>Descartar rascunho</button></div>'
        : '<p class="nota">Somente o Administrador edita e publica motivos e preços. Você pode consultar as regras e usar o simulador.</p>') +
      '<div class="vt-faixa vt-faixa-erro" id="vt-pr-erro" role="alert" hidden></div></div>' +
    '<fieldset class="vt-fs" id="vt-pr-fs"' + (admin ? '' : ' disabled') + '>' + secoesHtml + '</fieldset>' +
    '<details class="cartao" id="vt-pr-sim"><summary>Simulador de valor</summary><div>' + htmlSimulador() + '</div></details>' +
    (admin ? '<details class="cartao" id="vt-pr-hist"><summary>Histórico de publicações</summary><div id="vt-pr-hist-corpo"></div></details>' : '');

  const corpo = (id) => q('details[data-sec="' + id + '"] [data-corpo]');
  const renderSecao = (id) => { corpo(id).innerHTML = corpoSecao(id, cfg); };
  const gravarLocal = debounce(() => { if (dirty) localGravar('cfg_pendente', cfg); }, 400);

  function renderTudo() {
    SECOES.forEach(([id]) => renderSecao(id));
    if (sim) { sim.motivos(); sim.atualizar(); }
  }

  function pintarStatus() {
    let t;
    if (dirty) t = 'Você tem alterações não salvas.';
    else if (temRascunho) t = 'Rascunho salvo. Ainda não foi publicado: o site continua com a versão publicada.';
    else if (publicada) t = 'Sem rascunho: o que você vê é igual ao que está publicado no site.';
    else t = 'Nada foi publicado ainda. O agendamento online só aparece no site depois da primeira publicação.';
    q('#vt-pr-status').textContent = t;
    if (!admin) return;
    q('#vt-pr-salvar').disabled = ocupado || !dirty;
    q('#vt-pr-publicar').disabled = ocupado || (!dirty && !temRascunho);
    const d = q('#vt-pr-descartar');
    d.hidden = !(temRascunho || dirty);
    d.disabled = ocupado;
    d.textContent = temRascunho ? 'Descartar rascunho' : 'Descartar alterações';
  }

  function marcarSujo() {
    dirty = true;
    pintarStatus();
    gravarLocal();
  }

  // ---------- Erros ----------
  function limparErros() {
    alvo.querySelectorAll('[data-erro-de]').forEach((p) => { p.textContent = ''; p.hidden = true; });
    alvo.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    const g = q('#vt-pr-erro');
    g.textContent = '';
    g.hidden = true;
  }

  function limparErroCampo(caminho) {
    const p = q('[data-erro-de="' + caminho + '"]');
    if (p) { p.textContent = ''; p.hidden = true; }
    alvo.querySelectorAll('[data-path="' + caminho + '"]').forEach((el) => el.removeAttribute('aria-invalid'));
  }

  function mostrarErro(caminho, msg) {
    const p = q('[data-erro-de="' + caminho + '"]');
    if (p) { p.textContent = msg; p.hidden = false; }
    const inp = q('[data-path="' + caminho + '"]');
    if (inp) inp.setAttribute('aria-invalid', 'true');
  }

  function mostrarErros(erros, focar) {
    Object.keys(erros).forEach((c) => mostrarErro(c, erros[c]));
    if (!focar) return;
    const primeiro = Array.from(alvo.querySelectorAll('[data-erro-de]')).find((p) => !p.hidden);
    if (!primeiro) return;
    const det = primeiro.closest('details');
    if (det) det.open = true;
    const inp = document.getElementById(primeiro.id.slice(2));
    if (!inp) primeiro.tabIndex = -1;
    const el = inp || primeiro;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'center', behavior: calmo() ? 'auto' : 'smooth' });
  }

  function validarTudo() {
    normalizarCfg(cfg);
    const erros = Object.assign({}, validarCfg(cfg), parseErros);
    limparErros();
    mostrarErros(erros, true);
    if (Object.keys(erros).length) {
      toast('Corrija os campos destacados.', 'erro');
      return false;
    }
    return true;
  }

  // ---------- Execução protegida ----------
  async function executar(fn) {
    if (ocupado) return;
    ocupado = true;
    pintarStatus();
    q('#vt-pr-erro').hidden = true;
    try {
      await fn();
    } catch (e) {
      const m = msgErro(e);
      const g = q('#vt-pr-erro');
      g.textContent = m;
      g.hidden = false;
      toast(m, 'erro');
    }
    ocupado = false;
    pintarStatus();
  }

  async function salvar() {
    if (!validarTudo()) return false;
    await gravarRascunho(clone(cfg), uid);
    dirty = false;
    temRascunho = true;
    localRemover('cfg_pendente');
    return true;
  }

  async function recarregarTudo() {
    await carregarEstado();
    localRemover('cfg_pendente');
    limparErros();
    renderTudo();
    pintarStatus();
  }

  // ---------- Edição de campos ----------
  function aoCampo(ev) {
    const t = ev.target;
    const caminho = t && t.getAttribute ? t.getAttribute('data-path') : null;
    if (!caminho || !admin) return;
    const tipo = t.getAttribute('data-tipo');
    limparErroCampo(caminho);
    if (caminho.startsWith('tipos.')) limparErroCampo('tipos');

    if (tipo === 'num') {
      const n = parseNumero(t.value);
      if (Number.isNaN(n)) {
        parseErros[caminho] = 'Use apenas números (exemplo: 12,50).';
        mostrarErro(caminho, parseErros[caminho]);
      } else {
        delete parseErros[caminho];
        setPath(cfg, caminho, n);
      }
    } else if (tipo === 'bool') {
      setPath(cfg, caminho, t.checked);
    } else if (tipo === 'dia') {
      const marcados = Array.from(alvo.querySelectorAll('input[data-path="' + caminho + '"]:checked'),
        (c) => Number(c.value)).sort((a, b) => a - b);
      setPath(cfg, caminho, marcados);
    } else {
      setPath(cfg, caminho, t.value);
    }
    marcarSujo();
    if (sim) {
      if (caminho.startsWith('tipos.')) sim.motivos();
      sim.atualizar();
    }
  }
  alvo.addEventListener('input', aoCampo);
  alvo.addEventListener('change', aoCampo);

  // ---------- Listas: subir, descer, remover, adicionar ----------
  function focar(sel) {
    const el = q(sel);
    if (el && !el.disabled) el.focus();
  }

  async function mexerLista(b) {
    const L = LISTAS[b.dataset.lista];
    const arr = L.obter();
    const i = Number(b.dataset.i);
    const acao = b.dataset.acao;
    const par = (n, a) => '[data-lista="' + b.dataset.lista + '"][data-i="' + n + '"][data-acao="' + a + '"]';
    let foco = '';

    if (acao === 'subir' && i > 0) {
      [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
      foco = i - 1 > 0 ? par(i - 1, 'subir') : par(i - 1, 'descer');
    } else if (acao === 'descer' && i < arr.length - 1) {
      [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
      foco = i + 1 < arr.length - 1 ? par(i + 1, 'descer') : par(i + 1, 'subir');
    } else if (acao === 'remover') {
      if (b.dataset.lista === 'tipos' && !(await confirmar(
        'Remover o motivo "' + (arr[i].nome || 'sem nome') + '"? Solicitações antigas continuam guardando o nome dele.', 'Remover motivo'))) return;
      arr.splice(i, 1);
      foco = arr.length ? par(Math.min(i, arr.length - 1), 'remover') : '[data-acao^="add-"]';
    } else {
      return;
    }
    Object.keys(parseErros).forEach((k) => { if (k.startsWith(L.prefixo)) delete parseErros[k]; });
    renderSecao(L.sec);
    marcarSujo();
    if (sim) { sim.motivos(); sim.atualizar(); }
    focar('details[data-sec="' + L.sec + '"] ' + foco);
  }

  function adicionar(acao) {
    if (acao === 'add-tipo') {
      const inp = q('#vt-novo-tipo-nome');
      const er = q('#vt-novo-tipo-erro');
      const nome = inp.value.trim();
      if (!nome || nome.length > 60) {
        er.textContent = 'Informe o nome do motivo (até 60 caracteres).';
        er.hidden = false;
        inp.focus();
        return;
      }
      if (cfg.tipos.length >= 20) return;
      cfg.tipos.push({ id: novoIdTipo(cfg, nome), nome, ativo: true, preco_base: null,
        exige_sintomas: false, estimar: true, agenda: 'geral' });
      renderSecao('tipos');
      marcarSujo();
      if (sim) { sim.motivos(); sim.atualizar(); }
      document.getElementById('vt-p-tipos-' + (cfg.tipos.length - 1) + '-nome').focus();
    } else if (acao === 'add-faixa' && cfg.precos.peso_faixas.length < 10) {
      cfg.precos.peso_faixas.push({ acima_de_kg: null, adicional: null });
      renderSecao('peso');
      marcarSujo();
      document.getElementById('vt-p-precos-peso_faixas-' + (cfg.precos.peso_faixas.length - 1) + '-acima_de_kg').focus();
    } else if (acao === 'add-horario' && cfg.precos.horario_especial.length < 10) {
      cfg.precos.horario_especial.push({ id: novoIdHorario(cfg), rotulo: '', dias: [], de: '', ate: '', adicional: null });
      renderSecao('horarios');
      marcarSujo();
      document.getElementById('vt-p-precos-horario_especial-' + (cfg.precos.horario_especial.length - 1) + '-rotulo').focus();
    }
    if (sim) sim.atualizar();
  }

  // ---------- Fluxo: salvar, publicar, descartar, restaurar ----------
  async function publicar() {
    if (!validarTudo()) return;
    if (!(await confirmar('Publicar as configurações? Elas passam a valer imediatamente no site, para todos os clientes.', 'Publicar'))) return;
    setStatusPub('publicando', 'Publicando a configuração da consulta veterinária…');
    try {
      if (dirty) {
        await gravarRascunho(clone(cfg), uid);
        dirty = false;
        temRascunho = true;
        localRemover('cfg_pendente');
      }
      await publicarConfig();
    } catch (e) {
      setStatusPub('falha', 'A configuração não foi publicada.');
      throw e;
    }
    setStatusPub('sucesso', 'Configuração publicada.');
    toast('Configuração publicada.');
    if (typeof ctx.atualizarStatus === 'function') await ctx.atualizarStatus();
    await recarregarTudo();
    carregarHistorico();
  }

  async function descartar() {
    const msg = temRascunho
      ? 'Descartar o rascunho? As alterações salvas serão apagadas e voltam a valer as regras publicadas.'
      : 'Descartar as alterações não salvas?';
    if (!(await confirmar(msg, 'Descartar'))) return;
    if (temRascunho) await descartarRascunho();
    await recarregarTudo();
    if (typeof ctx.atualizarStatus === 'function') await ctx.atualizarStatus();
    toast('Alterações descartadas.');
  }

  async function restaurar(id) {
    if (!(await confirmar('Restaurar esta versão como rascunho? O rascunho atual será substituído. Nada muda no site até você publicar.', 'Restaurar'))) return;
    await restaurarRevisao(id);
    await recarregarTudo();
    toast('Versão restaurada como rascunho. Revise e publique.');
  }

  async function carregarHistorico() {
    if (!admin) return;
    const el = q('#vt-pr-hist-corpo');
    try {
      const lista = await listarRevisoes();
      el.innerHTML = lista.length
        ? '<ul class="vt-rev-lista">' + lista.map((r) => '<li class="vt-rev-item"><span>Publicada em ' +
          esc(formatarDataHora(r.published_at)) + '</span><button type="button" class="btn btn-pequeno" data-acao="restaurar" data-rev="' +
          esc(r.id) + '">Restaurar como rascunho</button></li>').join('') + '</ul>'
        : '<p class="vt-suave">Nenhuma publicação anterior.</p>';
    } catch (e) {
      el.innerHTML = '<p class="vt-faixa vt-faixa-erro" role="alert">' + esc(msgErro(e)) + '</p>';
    }
  }

  function oferecerRecuperacao() {
    const salvo = localLer('cfg_pendente');
    if (!admin || !salvo || typeof salvo !== 'object') return;
    if (estavel(mesclarConfig(salvo)) === estavel(cfg)) { localRemover('cfg_pendente'); return; }
    const el = q('#vt-pr-recuperar');
    el.hidden = false;
    el.innerHTML = '<div class="vt-faixa vt-faixa-pendente"><p>Encontramos alterações que não foram salvas neste aparelho. Deseja recuperá-las?</p>' +
      '<div class="acoes"><button type="button" class="btn btn-primario btn-pequeno" data-acao="recuperar">Recuperar alterações</button>' +
      '<button type="button" class="btn btn-pequeno" data-acao="ignorar-rec">Descartar recuperação</button></div></div>';
  }

  alvo.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button[data-acao], #vt-pr-salvar, #vt-pr-publicar, #vt-pr-descartar');
    if (!b || b.disabled || !admin) return;
    const acao = b.dataset.acao;
    if (b.id === 'vt-pr-salvar') {
      executar(async () => { if (await salvar()) { toast('Rascunho salvo.'); pintarStatus(); } });
    } else if (b.id === 'vt-pr-publicar') {
      executar(publicar);
    } else if (b.id === 'vt-pr-descartar') {
      executar(descartar);
    } else if (acao === 'recuperar') {
      cfg = garantirEstrutura(mesclarConfig(localLer('cfg_pendente') || {}));
      q('#vt-pr-recuperar').hidden = true;
      limparErros();
      renderTudo();
      marcarSujo();
      toast('Alterações recuperadas. Revise e salve.');
    } else if (acao === 'ignorar-rec') {
      localRemover('cfg_pendente');
      q('#vt-pr-recuperar').hidden = true;
    } else if (acao === 'restaurar') {
      executar(() => restaurar(Number(b.dataset.rev)));
    } else if (LISTAS[b.dataset.lista]) {
      mexerLista(b);
    } else if (acao && acao.startsWith('add-')) {
      adicionar(acao);
    }
  });

  // ---------- Primeira exibição ----------
  sim = ligarSimulador(q('#vt-pr-sim'), () => cfg);
  renderTudo();
  pintarStatus();
  oferecerRecuperacao();
  carregarHistorico();
    }
