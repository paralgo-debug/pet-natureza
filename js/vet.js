// Pet Natureza - Consulta Veterinária (página pública)
// Entrada: carrega configuração e horários, liga os módulos e controla o envio.
// Nada de dados pessoais ou de saúde em URL, localStorage ou analytics.

import { mesclarConfig, calcular, uuid } from '../admin/js/vet-calculo.js';
import { pronto, atualizarLinksWhatsApp } from './vet-layout.js';
import { carregarHorarios, criarHorarios, tipoPorId, usoDoTipo } from './vet-horarios.js';
import { criarFormulario } from './vet-form.js';
import { validar, entradaCalculo, montarPayload } from './vet-validar.js';
import { criarFotos } from './vet-foto.js';
import { renderValor, renderRevisao, renderSucesso } from './vet-resumo.js';

const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const $ = (id) => document.getElementById(id);
const calmo = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function comTempo(promessa, ms) {
  return new Promise((ok, falha) => {
    const t = setTimeout(() => falha(new Error('tempo')), ms);
    promessa.then((v) => { clearTimeout(t); ok(v); }, (e) => { clearTimeout(t); falha(e); });
  });
}

function mostrarIndisponivel(msg) {
  $('vt-carregando').hidden = true;
  const bloco = $('vt-erro-carga');
  if (msg) bloco.querySelector('p').textContent = msg;
  bloco.hidden = false;
}

async function lerConfig(client) {
  const { data, error } = await client
    .from('settings_published').select('value').eq('key', 'veterinaria').maybeSingle();
  if (error) throw error;
  return data && data.value && typeof data.value === 'object' ? mesclarConfig(data.value) : null;
}

function irParaTopo(el) {
  window.scrollTo({ top: 0, behavior: calmo() ? 'auto' : 'smooth' });
  if (el) el.focus({ preventScroll: true });
}

async function iniciar() {
  await pronto;
  atualizarLinksWhatsApp();

  let modulo;
  try {
    modulo = await import('../admin/js/config.js');
  } catch (e) {
    mostrarIndisponivel();
    return;
  }
  const url = String(modulo.SUPABASE_URL || '');
  const chave = String(modulo.SUPABASE_ANON_KEY || '');
  if (!url || !chave || /SEU-PROJETO|COLE-AQUI/.test(url + chave)) {
    mostrarIndisponivel();
    return;
  }

  let client;
  try {
    const { createClient } = await comTempo(import(CDN), 12000);
    client = createClient(url, chave, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
  } catch (e) {
    mostrarIndisponivel();
    return;
  }

  let cfg;
  let horarios;
  try {
    cfg = await comTempo(lerConfig(client), 12000);
    if (!cfg) {
      mostrarIndisponivel('O agendamento online ainda não está disponível. Fale conosco pelo WhatsApp.');
      return;
    }
    horarios = await comTempo(carregarHorarios(client), 12000);
  } catch (e) {
    mostrarIndisponivel();
    return;
  }
  montar(client, cfg, horarios);
}

function montar(client, cfg, horariosIniciais) {
  const estado = { cfg, horarios: horariosIniciais, tipoId: null, opcoes: [], id: uuid() };
  let enviando = false;

  const ctlHor = criarHorarios({ estado, aoMudar: atualizarValor });
  const ctlForm = criarFormulario({ estado, aoMudar: atualizarValor, aoTrocarTipo });
  const ctlFoto = criarFotos({ aoMudar: () => {} });

  function calcularAgora() {
    const d = ctlForm.ler();
    const entrada = entradaCalculo(d, estado.opcoes);
    return { d, entrada, res: calcular(estado.cfg, entrada) };
  }

  function atualizarValor() {
    const { entrada, res } = calcularAgora();
    renderValor(res, entrada);
  }

  function aoTrocarTipo() {
    ctlHor.removerIndisponiveis('tipo');
    ctlHor.renderizar();
    atualizarValor();
  }

  async function recarregarConfig() {
    try {
      const nova = await comTempo(lerConfig(client), 12000);
      if (nova) estado.cfg = nova;
    } catch (e) { /* mantém a configuração atual */ }
  }

  async function recarregarHorarios() {
    try {
      estado.horarios = await comTempo(carregarHorarios(client), 12000);
    } catch (e) { /* mantém a lista atual */ }
  }

  function mostrarForm() {
    $('vt-revisao').hidden = true;
    $('vt-sucesso').hidden = true;
    $('vt-form').hidden = false;
  }

  // ---------- Revisar ----------
  $('vt-btn-revisar').addEventListener('click', () => {
    ctlForm.limparErros();
    const { d, res } = calcularAgora();
    const erros = validar(d, { cfg: estado.cfg, opcoes: estado.opcoes });
    if (Object.keys(erros).length) {
      ctlForm.mostrarErroGeral('Confira os campos destacados e tente novamente.');
      ctlForm.mostrarErros(erros);
      return;
    }
    $('vt-revisao-corpo').innerHTML = renderRevisao(d, {
      cfg: estado.cfg, opcoes: estado.opcoes, res, previas: ctlFoto.previas()
    });
    $('vt-erro-envio').hidden = true;
    $('vt-form').hidden = true;
    $('vt-revisao').hidden = false;
    irParaTopo($('t-revisao'));
  });

  $('vt-btn-voltar').addEventListener('click', () => {
    mostrarForm();
    $('vt-btn-revisar').focus();
  });

  // ---------- Enviar ----------
  function erroDeEnvio(msg) {
    const el = $('vt-erro-envio');
    el.textContent = msg;
    el.hidden = false;
  }

  async function tratarErro(error) {
    const msg = String((error && error.message) || '');
    const codigo = String((error && error.code) || '');

    if (msg.startsWith('ESTIMATIVA_MUDOU') || codigo === 'VT002') {
      await recarregarConfig();
      ctlForm.aplicarConfig();
      ctlHor.removerIndisponiveis('tipo');
      ctlHor.renderizar();
      atualizarValor();
      mostrarForm();
      ctlForm.mostrarErroGeral('O valor aproximado foi atualizado. Confira o novo valor no cartão "Valor aproximado" e envie a solicitação novamente.');
      $('vt-valor-cartao').scrollIntoView({ block: 'center', behavior: calmo() ? 'auto' : 'smooth' });
      return;
    }

    if (codigo === 'VT001') {
      await recarregarHorarios();
      ctlHor.removerIndisponiveis('recarga');
      ctlHor.renderizar();
      atualizarValor();
      mostrarForm();
      ctlForm.mostrarErroGeral(msg + ' Atualizamos os horários; revise suas opções.');
      $('passo-horarios').scrollIntoView({ block: 'center', behavior: calmo() ? 'auto' : 'smooth' });
      return;
    }

    if (/failed to fetch|networkerror|load failed|network request failed|tempo/i.test(msg)) {
      erroDeEnvio('Não foi possível conectar à internet. Seus dados foram mantidos: confira a conexão e tente enviar novamente.');
      return;
    }

    if (!msg || /^PGRST/.test(codigo) || /^(42|28|22|23|XX)/.test(codigo)) {
      erroDeEnvio('Não foi possível enviar agora. Tente novamente em instantes ou fale conosco pelo WhatsApp.');
      return;
    }
    erroDeEnvio(msg);
  }

  async function enviar() {
    if (enviando) return;
    enviando = true;
    const btn = $('vt-btn-enviar');
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    $('vt-btn-voltar').disabled = true;
    $('vt-erro-envio').hidden = true;

    try {
      const { d, res } = calcularAgora();
      const erros = validar(d, { cfg: estado.cfg, opcoes: estado.opcoes });
      if (Object.keys(erros).length) {
        mostrarForm();
        ctlForm.mostrarErroGeral('Confira os campos destacados e tente novamente.');
        ctlForm.mostrarErros(erros);
        return;
      }

      const fotos = await ctlFoto.enviar(client, estado.id);
      const payload = montarPayload(d, {
        id: estado.id,
        opcoes: estado.opcoes,
        estimativaTotal: res.total,
        fotos: fotos.caminhos
      });

      let resp;
      try {
        resp = await client.rpc('vt_criar_solicitacao', { p: payload });
      } catch (e) {
        resp = { error: { message: String((e && e.message) || e), code: '' } };
      }
      if (resp.error) {
        await tratarErro(resp.error);
        return;
      }
      const dados = resp.data;
      if (!dados || dados.ok !== true || !dados.protocolo) {
        erroDeEnvio('Não foi possível confirmar o envio. Tente novamente ou fale conosco pelo WhatsApp.');
        return;
      }

      const tipo = tipoPorId(estado.cfg, d.tipoId);
      $('vt-sucesso-corpo').innerHTML = renderSucesso({
        protocolo: dados.protocolo,
        opcoes: estado.opcoes.map((o) => ({ data: o.data, hora: o.hora })),
        d,
        tipoNome: tipo ? tipo.nome : '',
        res,
        fotosFalhou: fotos.falhou,
        urgente: usoDoTipo(estado.cfg, d.tipoId) === 'urgencia',
        aviso: estado.cfg.aviso_emergencia
      });

      // novo envio começa do zero, com novo identificador
      ctlForm.resetar();
      ctlHor.reiniciar();
      ctlFoto.limpar();
      estado.id = uuid();
      atualizarValor();

      $('vt-form').hidden = true;
      $('vt-revisao').hidden = true;
      $('vt-sucesso').hidden = false;
      irParaTopo($('vt-sucesso'));
    } finally {
      enviando = false;
      btn.disabled = false;
      btn.textContent = 'Enviar solicitação de consulta';
      $('vt-btn-voltar').disabled = false;
    }
  }

  $('vt-btn-enviar').addEventListener('click', enviar);

  $('vt-sucesso').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-acao="nova"]');
    if (!b) return;
    mostrarForm();
    irParaTopo($('conteudo'));
  });

  // ---------- Primeira exibição ----------
  ctlHor.renderizar();
  atualizarValor();
  $('vt-carregando').hidden = true;
  $('vt-form').hidden = false;
}

iniciar().catch(() => mostrarIndisponivel());
