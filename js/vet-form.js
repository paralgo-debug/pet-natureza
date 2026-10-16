// Pet Natureza - Consulta Veterinária
// Campos do formulário: motivos, blocos condicionais, máscara, leitura e erros.
// Estado compartilhado (criado em js/vet.js): { cfg, tipoId, ... }

import {
  esc, formatarTelefone, normalizarWhatsApp, parseNumero, TEXTOS
} from '../admin/js/vet-calculo.js';
import { tipoPorId, usoDoTipo, urgenciaBloqueada } from './vet-horarios.js';

const $ = (id) => document.getElementById(id);
const CONDICIONAIS = ['em_tratamento', 'tem_condicoes', 'pet_dificil'];

export function criarFormulario({ estado, aoMudar, aoTrocarTipo }) {
  const form = $('vt-form');
  $('erro-tipo').tabIndex = -1;
  $('erro-opcoes').tabIndex = -1;

  const radio = (nome) => {
    const el = form.querySelector('input[name="' + nome + '"]:checked');
    return el ? el.value : '';
  };
  const valor = (id) => {
    const el = $(id);
    return el ? el.value.trim() : '';
  };
  const campos = (chave) => Array.from(form.querySelectorAll('[name="' + chave + '"]'));

  // ---------- Motivo ----------
  function atualizarTipoUI() {
    const tipo = tipoPorId(estado.cfg, estado.tipoId);
    const urgente = usoDoTipo(estado.cfg, estado.tipoId) === 'urgencia';
    const bloqueada = urgenciaBloqueada(estado.cfg, estado.tipoId);
    const exige = !!(tipo && tipo.exige_sintomas === true);
    $('vt-aviso-urgencia').hidden = !urgente;
    $('vt-urgencia-bloqueada').hidden = !bloqueada;
    $('vt-btn-revisar').disabled = bloqueada;
    $('f-sintomas-req').hidden = !exige;
    $('f-sintomas').setAttribute('aria-required', exige ? 'true' : 'false');
  }

  function renderizarTipos() {
    const tipos = (Array.isArray(estado.cfg.tipos) ? estado.cfg.tipos : [])
      .filter((t) => t && t.ativo === true);
    if (estado.tipoId && !tipos.some((t) => t.id === estado.tipoId)) estado.tipoId = null;
    $('vt-tipos-lista').innerHTML = tipos.map((t) =>
      '<label class="vt-tipo"><input class="vt-tipo-input" type="radio" name="tipo" value="' + esc(t.id) + '"' +
      (t.id === estado.tipoId ? ' checked' : '') + '><span class="vt-tipo-corpo">' + esc(t.nome) +
      (t.agenda === 'urgencia' ? '<span class="vt-tipo-badge">Urgência</span>' : '') +
      '</span></label>'
    ).join('');
    atualizarTipoUI();
  }

  // Aplica a configuração publicada (textos de aviso e lista de motivos).
  function aplicarConfig() {
    const aviso = typeof estado.cfg.aviso_emergencia === 'string' && estado.cfg.aviso_emergencia.trim()
      ? estado.cfg.aviso_emergencia.trim()
      : TEXTOS.EMERGENCIA_PADRAO;
    $('vt-aviso-texto').textContent = aviso;
    $('vt-aviso-urgencia-texto').textContent = aviso;
    renderizarTipos();
  }

  // ---------- Blocos condicionais ----------
  function atualizarCondicionais() {
    $('bloco-medicacao').hidden = radio('em_tratamento') !== 'sim';
    $('bloco-condicoes').hidden = radio('tem_condicoes') !== 'sim';
    $('bloco-comportamento').hidden = radio('pet_dificil') !== 'sim';
  }

  // ---------- Erros ----------
  function limparErro(chave) {
    const p = $('erro-' + chave);
    if (p) {
      p.textContent = '';
      p.hidden = true;
    }
    campos(chave).forEach((el) => el.removeAttribute('aria-invalid'));
  }

  function limparErros() {
    form.querySelectorAll('.vt-erro').forEach((p) => {
      p.textContent = '';
      p.hidden = true;
    });
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    mostrarErroGeral('');
  }

  function mostrarErroGeral(msg) {
    const el = $('vt-erro-geral');
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  // erros: { chave: mensagem } na ordem da página. Foca o primeiro.
  function mostrarErros(erros) {
    const chaves = Object.keys(erros || {});
    chaves.forEach((chave) => {
      const p = $('erro-' + chave);
      if (p) {
        p.textContent = erros[chave];
        p.hidden = false;
      }
      campos(chave).forEach((el) => el.setAttribute('aria-invalid', 'true'));
    });
    if (chaves.length) {
      const alvo = campos(chaves[0])[0] || $('erro-' + chaves[0]);
      if (alvo) {
        const calmo = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        alvo.focus({ preventScroll: true });
        alvo.scrollIntoView({ block: 'center', behavior: calmo ? 'auto' : 'smooth' });
      }
    }
  }

  // ---------- Eventos ----------
  function aoCampo(ev) {
    const t = ev.target;
    if (!t || !t.name || t.name === 'contato_site') return;
    limparErro(t.name);
    if (t.name === 'whatsapp') t.value = formatarTelefone(t.value);
    if (t.name === 'tipo' && ev.type === 'change') {
      estado.tipoId = t.value;
      atualizarTipoUI();
      aoTrocarTipo(estado.tipoId);
    }
    if (CONDICIONAIS.includes(t.name)) atualizarCondicionais();
    aoMudar();
  }
  form.addEventListener('input', aoCampo);
  form.addEventListener('change', aoCampo);

  // ---------- Leitura ----------
  function ler() {
    const pesoTexto = valor('f-peso');
    let peso = parseNumero(pesoTexto);
    if (typeof peso === 'number' && Number.isFinite(peso)) peso = Math.round(peso * 100) / 100;
    return {
      tipoId: estado.tipoId || '',
      nome: valor('f-nome'),
      whatsappTexto: valor('f-whatsapp'),
      whatsapp: normalizarWhatsApp(valor('f-whatsapp')),
      petNome: valor('f-pet-nome'),
      especie: radio('pet_especie'),
      raca: valor('f-pet-raca'),
      pesoTexto,
      peso,
      porte: valor('f-porte'),
      idade: valor('f-idade'),
      nascimento: valor('f-nascimento'),
      sexo: radio('pet_sexo'),
      castrado: radio('pet_castrado'),
      sintomas: valor('f-sintomas'),
      duracao: valor('f-duracao'),
      emTratamento: radio('em_tratamento') === 'sim',
      medicacao: valor('f-medicacao'),
      temCondicoes: radio('tem_condicoes') === 'sim',
      condicoes: valor('f-condicoes'),
      dificil: radio('pet_dificil') === 'sim',
      comportamento: valor('f-comportamento'),
      observacoes: valor('f-observacoes'),
      consentimento: $('f-consentimento').checked,
      honeypot: $('f-contato-site').value
    };
  }

  // Limpa tudo após o envio (fotos e opções são tratadas por outros módulos).
  function resetar() {
    estado.tipoId = null;
    renderizarTipos();
    form.reset();
    limparErros();
    atualizarCondicionais();
    atualizarTipoUI();
  }

  atualizarCondicionais();
  aplicarConfig();

  return {
    aplicarConfig, ler, resetar, mostrarErros, mostrarErroGeral, limparErros, limparErro
  };
  }
