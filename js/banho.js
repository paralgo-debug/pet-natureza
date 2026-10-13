// PET NATUREZA - Banho & Tosa (site) - orquestração: carregar, revisar, enviar
import { dadosSite, obterSupabase, linkWhatsApp, numeroWhatsApp } from './banho-layout.js';
import { CONFIG_PADRAO, normalizarConfig, calcular } from '../admin/js/banho-calculo.js';
import { $, el, novoUUID } from './banho-util.js';
import { criarHorarios } from './banho-horarios.js';
import { ligarFoto } from './banho-foto.js';
import {
  ligarFormulario, lerValores, entradaCalculo, validar, renderServicos,
  renderValor, resetarCacheValor, alternarBlocos
} from './banho-form.js';
import { preencherResumo, textoWhatsApp } from './banho-resumo.js';

const ROTULO_ENVIAR = 'Enviar solicitação de agendamento';

const estado = {
  cfg: normalizarConfig(CONFIG_PADRAO),
  id: novoUUID(),
  foto: null,
  fotoUrl: '',
  fotoEnviada: false,
  fotoFalhou: false,
  valores: null,
  opcoes: [],
  est: null,
  enviando: false,
  zap: numeroWhatsApp('')
};

let cliente = null;
let horarios = null;
let fotoCtl = null;

// ---------------------------------------------------------------------
// Telas e avisos
// ---------------------------------------------------------------------
function mostrarTela(nome, semFoco) {
  $('bt-form').hidden = nome !== 'form';
  $('bt-revisao').hidden = nome !== 'revisao';
  $('bt-sucesso').hidden = nome !== 'sucesso';
  window.scrollTo(0, 0);
  if (semFoco) return;
  const alvo = nome === 'form' ? $('conteudo') : nome === 'revisao' ? $('bt-revisao') : $('bt-sucesso');
  alvo.focus({ preventScroll: true });
}

function avisoGeral(texto) {
  const e = $('bt-erro-geral');
  e.textContent = texto || '';
  e.hidden = !texto;
  if (texto) e.focus();
}

function erroEnvio(texto) {
  const e = $('bt-erro-envio');
  e.textContent = texto || '';
  e.hidden = !texto;
  if (texto) e.focus();
}

function bloquearPagina(texto) {
  $('bt-form').hidden = true;
  const e = $('bt-erro-geral');
  e.replaceChildren(
    document.createTextNode(texto + ' '),
    el('a', { href: linkWhatsApp(estado.zap), target: '_blank', rel: 'noopener', texto: 'Falar no WhatsApp' })
  );
  e.hidden = false;
}

// ---------------------------------------------------------------------
// Configuração publicada (serviços e preços)
// ---------------------------------------------------------------------
async function carregarConfig() {
  const { data, error } = await cliente
    .from('settings_published').select('value').eq('key', 'banho_tosa').maybeSingle();
  if (error) throw error;
  if (!data || !data.value) return null;
  return normalizarConfig(data.value);
}

async function recarregarConfig() {
  const v = lerValores();
  const nova = await carregarConfig();
  if (!nova) return;
  estado.cfg = nova;
  renderServicos(nova, v.servicos);
  resetarCacheValor();
  atualizarValor();
}

function atualizarValor() {
  renderValor(calcular(estado.cfg, entradaCalculo(lerValores())));
}

function nomesServicos(v) {
  return v.servicos.map((id) => {
    const s = estado.cfg.servicos.find((x) => x.id === id);
    return s ? s.nome : id;
  });
}

function dadosResumo() {
  return {
    v: estado.valores,
    servicos: nomesServicos(estado.valores),
    opcoes: estado.opcoes,
    est: estado.est,
    fotoUrl: estado.fotoUrl,
    descrever: horarios.descrever
  };
}

// ---------------------------------------------------------------------
// Revisão
// ---------------------------------------------------------------------
function aoRevisar(ev) {
  ev.preventDefault();
  avisoGeral('');
  const v = lerValores();
  const opcoes = horarios.opcoes();
  const focos = validar(v, opcoes.length, horarios.focoOpcoes());
  if (focos.length > 0) {
    const f = focos[0];
    if (f && typeof f.focus === 'function') {
      f.focus();
      f.scrollIntoView({ block: 'center' });
    }
    return;
  }
  estado.valores = v;
  estado.opcoes = opcoes;
  estado.est = calcular(estado.cfg, entradaCalculo(v));
  erroEnvio('');
  preencherResumo($('bt-revisao-resumo'), dadosResumo(), true);
  mostrarTela('revisao');
}

// ---------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------
async function enviarFoto() {
  const caminho = estado.id + '/foto.jpg';
  if (estado.fotoEnviada) return caminho;
  try {
    const { error } = await cliente.storage.from('banho-fotos')
      .upload(caminho, estado.foto, { contentType: 'image/jpeg', upsert: false });
    const duplicada = error && (String(error.statusCode) === '409' || /already exists|duplicate/i.test(error.message || ''));
    if (error && !duplicada) throw error;
    estado.fotoEnviada = true;
    estado.fotoFalhou = false;
    return caminho;
  } catch (e) {
    estado.fotoFalhou = true;
    return null;
  }
}

function montarPayload(fotoPath) {
  const v = estado.valores;
  const est = estado.est;
  return {
    id: estado.id,
    nome: v.nome,
    whatsapp: '55' + v.whatsapp,
    pet_nome: v.pet_nome,
    pet_especie: v.especie,
    pet_raca: v.raca,
    peso_kg: Number.isFinite(v.peso) && v.peso !== null ? String(v.peso) : '',
    pet_porte: v.porte,
    pet_idade: v.idade,
    pet_pelagem: v.pelagem,
    pet_dificil: v.dificil,
    pet_comportamento: v.comportamento,
    pet_tem_restricao: v.temRestricao,
    pet_restricao: v.restricao,
    observacoes: v.obs,
    servicos: v.servicos,
    opcoes: estado.opcoes.map((o, i) => ({ prioridade: i + 1, data: o.data, hora: o.hora })),
    estimativa_total: est && est.ok ? est.total : null,
    consentimento: true,
    foto_path: fotoPath,
    contato_site: $('f-contato-site').value
  };
}

function voltarAoFormulario(texto) {
  mostrarTela('form', true);
  avisoGeral(texto);
}

function ehFalhaDeRede(e) {
  const m = e && e.message ? String(e.message) : '';
  return e instanceof TypeError || /failed to fetch|networkerror|network request failed|load failed|fetch/i.test(m);
}

async function tratarErro(e) {
  const m = e && e.message ? String(e.message).trim() : '';

  if (/ESTIMATIVA_MUDOU/.test(m)) {
    try { await recarregarConfig(); } catch (x) { /* mantém a tela */ }
    voltarAoFormulario('O valor aproximado foi atualizado. Confira o novo valor no cartão "Valor aproximado" e envie a solicitação novamente.');
    return;
  }
  if (/Um dos serviços escolhidos/.test(m)) {
    try { await recarregarConfig(); } catch (x) { /* mantém a tela */ }
    voltarAoFormulario('Um dos serviços escolhidos não está mais disponível. Confira os serviços e envie novamente.');
    return;
  }
  if (/não está mais disponível/.test(m)) {
    await horarios.carregar();
    voltarAoFormulario(m + ' Revise suas opções de data e horário.');
    return;
  }
  if (ehFalhaDeRede(e)) {
    erroEnvio('Não foi possível enviar agora. Verifique sua conexão e tente de novo. Seus dados continuam aqui.');
    return;
  }
  erroEnvio(m || 'Não foi possível enviar a solicitação. Tente novamente.');
}

function aoSucesso(data) {
  const est = data.estimativa && typeof data.estimativa === 'object' ? data.estimativa : estado.est;
  const dados = { ...dadosResumo(), est };
  $('bt-protocolo').textContent = data.protocolo;
  $('bt-sucesso-foto').hidden = !(estado.foto && estado.fotoFalhou);
  preencherResumo($('bt-sucesso-resumo'), dados, false);
  $('bt-sucesso-zap').setAttribute('href', linkWhatsApp(estado.zap, textoWhatsApp(dados, data.protocolo)));

  // Limpa tudo que é pessoal e prepara um novo identificador
  $('bt-form').reset();
  alternarBlocos();
  fotoCtl.limpar();
  horarios.limpar();
  renderServicos(estado.cfg, []);
  resetarCacheValor();
  atualizarValor();
  estado.valores = null;
  estado.id = novoUUID();
  mostrarTela('sucesso');
}

async function enviar() {
  if (estado.enviando || !estado.valores) return;
  estado.enviando = true;
  const botao = $('bt-enviar');
  const voltar = $('bt-voltar');
  botao.disabled = true;
  voltar.disabled = true;
  botao.textContent = 'Enviando…';
  erroEnvio('');
  try {
    const fotoPath = estado.foto ? await enviarFoto() : null;
    const { data, error } = await cliente.rpc('bt_criar_solicitacao', { p: montarPayload(fotoPath) });
    if (error) throw error;
    if (!data || data.ok !== true || !data.protocolo) throw new Error('Resposta inesperada do servidor. Tente novamente.');
    aoSucesso(data);
  } catch (e) {
    await tratarErro(e);
  } finally {
    estado.enviando = false;
    botao.disabled = false;
    voltar.disabled = false;
    botao.textContent = ROTULO_ENVIAR;
  }
}

// ---------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------
async function iniciar() {
  dadosSite.then((dados) => {
    estado.zap = numeroWhatsApp(dados.empresa.whatsapp);
    const zap1 = $('bt-sem-horarios-zap');
    if (zap1) zap1.setAttribute('href', linkWhatsApp(estado.zap));
    const zap2 = $('bt-sucesso-zap');
    if (zap2 && $('bt-sucesso').hidden) zap2.setAttribute('href', linkWhatsApp(estado.zap));
  });

  cliente = await obterSupabase();
  if (!cliente) {
    $('bt-carregando').hidden = true;
    bloquearPagina('O agendamento online ainda não está disponível.');
    return;
  }

  horarios = criarHorarios(cliente, () => { $('erro-opcoes').hidden = true; });
  fotoCtl = ligarFoto(estado);
  ligarFormulario(atualizarValor);
  atualizarValor();

  $('bt-form').addEventListener('submit', aoRevisar);
  $('bt-voltar').addEventListener('click', () => mostrarTela('form'));
  $('bt-enviar').addEventListener('click', enviar);

  const [cfgRes] = await Promise.allSettled([carregarConfig(), horarios.carregar()]);
  if (cfgRes.status === 'rejected') {
    bloquearPagina('Não foi possível carregar o formulário agora. Verifique sua conexão e tente de novo.');
    return;
  }
  if (!cfgRes.value) {
    bloquearPagina('O agendamento online ainda não está disponível.');
    return;
  }
  estado.cfg = cfgRes.value;
  renderServicos(estado.cfg, []);
  resetarCacheValor();
  atualizarValor();
}

iniciar();
