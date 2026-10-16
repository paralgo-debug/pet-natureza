// Pet Natureza - Consulta Veterinária
// Cartão "Valor aproximado", tela de revisão e tela de sucesso.

import {
  esc, moeda, descreverSemValor, TEXTOS, ESPECIES, PORTES, SEXOS, CASTRADO, DURACOES,
  formatarTelefone, dataBR, dataCurta, horaCurta
} from '../admin/js/vet-calculo.js';
import { linkWhatsApp } from './vet-layout.js';
import { tipoPorId } from './vet-horarios.js';

const nomeDe = (lista, id) => {
  const x = lista.find((i) => i.id === id);
  return x ? x.nome : '';
};
const br = (s) => esc(s).replace(/\n/g, '<br>');
const linha = (rotulo, html) => (html ? '<dt>' + esc(rotulo) + '</dt><dd>' + html + '</dd>' : '');
const pesoTexto = (p) => String(p).replace('.', ',') + ' kg';

// ---------- Valor aproximado (aria-live no contêiner) ----------
let ultimoHtml = null;

export function renderValor(res, entrada) {
  const corpo = document.getElementById('vt-valor-corpo');
  const hor = document.getElementById('vt-valor-horario');
  let html;
  if (res.total === null) {
    html = '<p>' + esc(descreverSemValor(res, entrada)) + '</p>';
  } else {
    html = '<p class="vt-valor-total">' + esc(moeda(res.total)) + '</p>' +
      '<details><summary>Como calculamos</summary><ul class="vt-valor-itens">' +
      res.itens.map((it) =>
        '<li><span>' + esc(it.rotulo) + '</span><span>' + esc(moeda(it.valor)) + '</span></li>'
      ).join('') + '</ul></details>';
  }
  if (html !== ultimoHtml) {
    corpo.innerHTML = html;
    ultimoHtml = html;
  }
  hor.hidden = !(res.total !== null && res.horarioEspecial);
}

function blocoValor(res) {
  if (res.total === null) return esc(TEXTOS.SEM_ESTIMATIVA);
  return '<strong>' + esc(moeda(res.total)) + '</strong><br>' + esc(TEXTOS.ESTIMATIVA) +
    (res.horarioEspecial ? '<br>' + esc(TEXTOS.HORARIO_MUDAR) : '');
}

function listaOpcoes(opcoes) {
  return '<ol>' + opcoes.map((o, i) =>
    '<li>' + (i + 1) + 'ª opção: ' + esc(dataCurta(o.data)) + ' às ' + esc(horaCurta(o.hora)) + '</li>'
  ).join('') + '</ol>';
}

// ---------- Revisão ----------
// d = ler() do formulário; ctx = { cfg, opcoes, res, previas }
export function renderRevisao(d, ctx) {
  const tipo = tipoPorId(ctx.cfg, d.tipoId);
  const fotos = ctx.previas.length
    ? '<div class="vt-fotos">' + ctx.previas.map((u, i) =>
        '<div class="vt-foto-previa"><img src="' + esc(u) + '" alt="Foto ' + (i + 1) +
        ' do pet" width="112" height="112"></div>'
      ).join('') + '</div>'
    : '';
  const sim = (flag, texto) => (flag ? 'Sim' + (texto ? ': ' + br(texto) : '') : 'Não');

  return '<p class="vt-aviso vt-aviso-info">' + esc(TEXTOS.NAO_CONFIRMADO) + '</p>' +
    '<dl class="vt-revisao">' +
    linha('Motivo da consulta', esc(tipo ? tipo.nome : '')) +
    linha('Opções de data e horário', listaOpcoes(ctx.opcoes)) +
    linha('Tutor', esc(d.nome)) +
    linha('WhatsApp', esc(formatarTelefone(d.whatsapp))) +
    linha('Pet', esc(d.petNome) + ' (' + esc(nomeDe(ESPECIES, d.especie)) + ')') +
    linha('Raça', d.raca ? esc(d.raca) : '') +
    linha('Peso', typeof d.peso === 'number' ? esc(pesoTexto(d.peso)) : '') +
    linha('Porte', d.porte ? esc(nomeDe(PORTES, d.porte)) : '') +
    linha('Idade aproximada', d.idade ? esc(d.idade) : '') +
    linha('Data de nascimento', d.nascimento ? esc(dataBR(d.nascimento)) : '') +
    linha('Sexo', esc(nomeDe(SEXOS, d.sexo))) +
    linha('Castrado(a)', esc(nomeDe(CASTRADO, d.castrado))) +
    linha('Sintomas ou queixa', d.sintomas ? br(d.sintomas) : '') +
    linha('Há quanto tempo', d.duracao ? esc(nomeDe(DURACOES, d.duracao)) : '') +
    linha('Em tratamento ou medicação', sim(d.emTratamento, d.medicacao)) +
    linha('Doenças, alergias ou restrições', sim(d.temCondicoes, d.condicoes)) +
    linha('Agressivo ou difícil', sim(d.dificil, d.comportamento)) +
    linha('Observações', d.observacoes ? br(d.observacoes) : '') +
    linha('Fotos', fotos) +
    linha('Valor aproximado', blocoValor(ctx.res)) +
    '</dl>';
}

// ---------- Sucesso ----------
// info = { protocolo, opcoes, d, tipoNome, res, fotosFalhou, urgente, aviso }
// A mensagem do WhatsApp NÃO leva sintomas, medicação nem condições de saúde.
export function mensagemWhatsApp(info) {
  const linhas = [
    'Olá! Enviei uma solicitação de consulta veterinária pelo site do Pet Natureza.',
    'Protocolo: ' + info.protocolo,
    'Tutor: ' + info.d.nome,
    'Pet: ' + info.d.petNome + ' (' + nomeDe(ESPECIES, info.d.especie) + ')',
    'Motivo: ' + info.tipoNome,
    'Opções de horário:'
  ];
  info.opcoes.forEach((o, i) => {
    linhas.push((i + 1) + 'ª - ' + dataCurta(o.data) + ' às ' + horaCurta(o.hora));
  });
  if (info.res.total !== null) linhas.push('Valor aproximado: ' + moeda(info.res.total));
  return linhas.join('\n');
}

export function renderSucesso(info) {
  const d = info.d;
  const emerg = info.urgente
    ? '<div class="vt-aviso vt-aviso-emergencia"><p>' + esc(info.aviso || TEXTOS.EMERGENCIA_PADRAO) + '</p></div>'
    : '';
  const fotos = info.fotosFalhou > 0
    ? '<p class="vt-aviso vt-aviso-info">Não conseguimos enviar ' + info.fotosFalhou +
      (info.fotosFalhou === 1 ? ' foto' : ' fotos') + '. Se quiser, você pode mandá-' +
      (info.fotosFalhou === 1 ? 'la' : 'las') + ' pelo WhatsApp.</p>'
    : '';
  return '<p><strong>' + esc(TEXTOS.SUCESSO) + '</strong></p>' +
    '<p>Seu protocolo:</p><p><span class="vt-protocolo">' + esc(info.protocolo) + '</span></p>' +
    '<p><strong>Opções de data e horário</strong></p>' + listaOpcoes(info.opcoes) +
    '<p><strong>Pet:</strong> ' + esc(d.petNome) + ' (' + esc(nomeDe(ESPECIES, d.especie)) + ')' +
    (d.raca ? ', ' + esc(d.raca) : '') + '<br><strong>Motivo:</strong> ' + esc(info.tipoNome) + '</p>' +
    '<p><strong>Valor aproximado:</strong><br>' + blocoValor(info.res) + '</p>' +
    fotos + emerg +
    '<p class="vt-aviso vt-aviso-info">' + esc(TEXTOS.NAO_CONFIRMADO) + '</p>' +
    '<div class="vt-acoes">' +
    '<a class="btn btn-escuro" href="' + esc(linkWhatsApp(mensagemWhatsApp(info))) +
      '" target="_blank" rel="noopener">Conversar pelo WhatsApp</a>' +
    '<a class="btn btn-claro" href="../index.html#topo">Voltar para a página inicial</a>' +
    '<button type="button" class="btn btn-claro" data-acao="nova">Fazer outra solicitação</button>' +
    '</div>';
                                                                    }
