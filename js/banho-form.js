// PET NATUREZA - Banho & Tosa (site) - leitura, validação e exibição do formulário
import { $, el, digitosTelefone, mascararTelefone, mostrarErro, limparTodosErros } from './banho-util.js';
import { brl, explicarSemEstimativa } from '../admin/js/banho-calculo.js';

function radio(nome) {
  const r = document.querySelector('input[name="' + nome + '"]:checked');
  return r ? r.value : '';
}

const compacto = (id) => $(id).value.replace(/\s+/g, ' ').trim();
const livre = (id) => $(id).value.trim();

// ---------------------------------------------------------------------
// Leitura dos valores digitados
// ---------------------------------------------------------------------
export function lerValores() {
  const pesoTxt = $('f-peso').value.trim().replace(',', '.');
  let peso = null;
  if (pesoTxt !== '') {
    peso = /^\d{1,3}(\.\d{1,2})?$/.test(pesoTxt) ? Number(pesoTxt) : NaN;
    if (!(peso > 0 && peso <= 150)) peso = NaN;
  }
  const dificil = radio('dificil') === 'sim';
  const temRestricao = radio('restricao') === 'sim';
  return {
    nome: compacto('f-nome'),
    whatsapp: digitosTelefone($('f-whatsapp').value),
    pet_nome: compacto('f-pet-nome'),
    especie: radio('especie'),
    raca: compacto('f-raca'),
    idade: compacto('f-idade'),
    pesoTxt,
    peso,
    porte: radio('porte'),
    pelagem: radio('pelagem'),
    dificil,
    comportamento: dificil ? livre('f-comportamento') : '',
    temRestricao,
    restricao: temRestricao ? livre('f-restricao') : '',
    servicos: Array.from(document.querySelectorAll('input[name="servico"]:checked')).map((i) => i.value),
    obs: livre('f-obs'),
    consentimento: $('f-consent').checked
  };
}

export function entradaCalculo(v) {
  return {
    porte: v.porte,
    pelagem: v.pelagem,
    peso: Number.isFinite(v.peso) ? v.peso : null,
    dificil: v.dificil,
    servicos: v.servicos
  };
}

// ---------------------------------------------------------------------
// Validação (mensagens ao lado do campo; devolve os elementos com erro, na ordem da página)
// ---------------------------------------------------------------------
export function validar(v, qtdOpcoes, focoOpcoes) {
  limparTodosErros();
  const focos = [];
  const add = (idErro, texto, foco, marcar) => {
    mostrarErro(idErro, texto, marcar ? foco : null);
    focos.push(foco);
  };
  const primeiro = (nome) => document.querySelector('input[name="' + nome + '"]');

  if (qtdOpcoes < 1) {
    add('erro-opcoes', 'Escolha pelo menos uma opção de data e horário. Se não houver horários disponíveis, fale conosco pelo WhatsApp.', focoOpcoes, false);
  }
  if (v.nome.length < 2) add('erro-nome', 'Informe seu nome completo.', $('f-nome'), true);

  const d = v.whatsapp;
  const telOk = (d.length === 10 || d.length === 11) && d[0] !== '0' && (d.length === 10 || d[2] === '9');
  if (!telOk) add('erro-whatsapp', 'Informe um WhatsApp válido com DDD, por exemplo (98) 91234-5678.', $('f-whatsapp'), true);

  if (v.pet_nome.length < 1) add('erro-pet-nome', 'Informe o nome do pet.', $('f-pet-nome'), true);
  if (!v.especie) add('erro-especie', 'Escolha a espécie do pet.', primeiro('especie'), false);
  if (v.pesoTxt !== '' && !Number.isFinite(v.peso)) {
    add('erro-peso', 'Peso inválido. Informe um valor entre 0,1 e 150 kg, por exemplo 8,5.', $('f-peso'), true);
  }
  if (v.temRestricao && v.restricao === '') {
    add('erro-restricao', 'Descreva a doença, alergia ou restrição do pet.', $('f-restricao'), true);
  }
  if (v.servicos.length < 1) {
    add('erro-servicos', 'Escolha pelo menos um serviço.', document.querySelector('input[name="servico"]') || $('g-servicos'), false);
  }
  if (!v.consentimento) {
    add('erro-consent', 'Para continuar, é preciso concordar com o uso dos dados conforme a Política de Privacidade.', $('f-consent'), true);
  }
  return focos;
}

// ---------------------------------------------------------------------
// Serviços (só os ativos da configuração publicada)
// ---------------------------------------------------------------------
export function renderServicos(cfg, marcados) {
  const alvo = $('bt-servicos');
  const marcadosSet = new Set(marcados || []);
  const ativos = cfg.servicos.filter((s) => s.ativo);
  const itens = ativos.map((s) =>
    el('label', { class: 'bt-check' }, [
      el('input', { type: 'checkbox', name: 'servico', value: s.id, checked: marcadosSet.has(s.id) }),
      el('span', { texto: s.nome })
    ])
  );
  alvo.replaceChildren(...itens);
  if (ativos.length === 0) {
    alvo.append(el('p', { class: 'bt-sub', texto: 'Nenhum serviço está disponível no momento. Fale conosco pelo WhatsApp.' }));
  }
}

// ---------------------------------------------------------------------
// Cartão "Valor aproximado"
// ---------------------------------------------------------------------
let chaveValor = '';

export function resetarCacheValor() {
  chaveValor = '';
}

export function renderValor(est) {
  const chave = JSON.stringify(est);
  if (chave === chaveValor) return;
  chaveValor = chave;
  const alvo = $('bt-valor-conteudo');
  const det0 = alvo.querySelector('details');
  const estavaAberto = !!(det0 && det0.open);

  if (est && est.ok) {
    const lista = el('ul', { class: 'bt-valor-itens' }, est.itens.map((i) =>
      el('li', {}, [el('span', { texto: i.rotulo }), el('span', { texto: brl(i.valor) })])
    ));
    const det = el('details', {}, [el('summary', { texto: 'Como calculamos' }), lista]);
    if (estavaAberto) det.open = true;
    alvo.replaceChildren(el('p', { class: 'bt-valor-total', texto: brl(est.total) }), det);
  } else {
    alvo.replaceChildren(el('p', { texto: explicarSemEstimativa(est) }));
  }
}

// ---------------------------------------------------------------------
// Ligações do formulário
// ---------------------------------------------------------------------
export function alternarBlocos() {
  $('bloco-comportamento').hidden = radio('dificil') !== 'sim';
  $('bloco-restricao').hidden = radio('restricao') !== 'sim';
}

function limparEdicao(ev) {
  const alvo = ev.target;
  if (!alvo || !alvo.getAttribute) return;
  const grupo = alvo.closest ? alvo.closest('fieldset') : null;
  const ref = (grupo && grupo.getAttribute('aria-describedby')) || alvo.getAttribute('aria-describedby') || '';
  ref.split(/\s+/).filter(Boolean).forEach((id) => {
    const p = $(id);
    if (p && p.classList.contains('bt-erro')) p.hidden = true;
  });
  alvo.removeAttribute('aria-invalid');
}

export function ligarFormulario(aoAlterar) {
  const form = $('bt-form');
  $('f-whatsapp').addEventListener('input', (ev) => {
    ev.target.value = mascararTelefone(ev.target.value);
  });
  form.addEventListener('input', (ev) => {
    limparEdicao(ev);
    aoAlterar();
  });
  form.addEventListener('change', (ev) => {
    alternarBlocos();
    limparEdicao(ev);
    aoAlterar();
  });
  alternarBlocos();
    }
