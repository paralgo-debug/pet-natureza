// PET NATUREZA - Banho & Tosa (painel) - HTML do cartão de solicitação
import { esc, formatarDataHora, formatarWhatsApp } from './util.js';
import {
  STATUS, ESPECIES, PORTES, PELAGENS, AVISO_ESTIMATIVA, brl, rotuloDe, explicarSemEstimativa
} from './banho-calculo.js';

export const hora5 = (h) => String(h || '').slice(0, 5);

export function dataBR(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
}

const dh = (d, h) => dataBR(d) + ' às ' + hora5(h);
const opcoesDe = (s) => (s.bt_opcoes || []).slice().sort((a, b) => a.prioridade - b.prioridade);

export function seloStatus(v) {
  const s = STATUS.find((x) => x.valor === v) || { rotulo: String(v), classe: '' };
  return '<span class="bt-st ' + esc(s.classe) + '">' + esc(s.rotulo) + '</span>';
}

function resumoHorarios(s) {
  if (s.data_final) return 'Horário: ' + dh(s.data_final, s.hora_final);
  return opcoesDe(s).map((o) => o.prioridade + 'ª ' + dataBR(o.data).slice(0, 5) + ' ' + hora5(o.hora)).join(' · ');
}

function linkZap(s) {
  const texto = 'Olá, ' + s.cliente_nome + '! Aqui é do Pet Natureza. Recebemos sua solicitação de Banho & Tosa (' +
    s.protocolo + ') para ' + s.pet_nome + '. Vamos combinar o melhor horário com você.';
  return 'https://wa.me/' + s.cliente_whatsapp + '?text=' + encodeURIComponent(texto);
}

function blocoPet(s) {
  const linhas = [
    ['Nome', s.pet_nome],
    ['Espécie', rotuloDe(ESPECIES, s.pet_especie)],
    ['Raça', s.pet_raca],
    ['Idade', s.pet_idade],
    ['Peso', s.pet_peso_kg !== null && s.pet_peso_kg !== undefined ? String(Number(s.pet_peso_kg)).replace('.', ',') + ' kg' : ''],
    ['Porte', rotuloDe(PORTES, s.pet_porte)],
    ['Pelagem', rotuloDe(PELAGENS, s.pet_pelagem)]
  ].filter((l) => l[1]);
  let h = '<dl class="bt-dl">' + linhas.map((l) => '<div><dt>' + esc(l[0]) + ':</dt><dd>' + esc(l[1]) + '</dd></div>').join('') + '</dl>';
  if (s.pet_dificil) {
    h += '<div class="bt-alerta bt-alerta-perigo">⚠ Agressivo ou difícil de manejar' +
      (s.pet_comportamento ? ': ' + esc(s.pet_comportamento) : '.') + '</div>';
  }
  if (s.pet_tem_restricao) {
    h += '<div class="bt-alerta bt-alerta-atencao">⚠ Doença, alergia ou restrição: ' + esc(s.pet_restricao || 'não detalhado') + '</div>';
  }
  if (s.observacoes) h += '<p><strong>Observações do cliente:</strong> ' + esc(s.observacoes) + '</p>';
  return h;
}

function blocoValor(s) {
  const e = s.estimativa;
  let h;
  if (e && e.ok) {
    h = '<p class="bt-total">' + esc(brl(e.total)) + '</p><ul class="bt-itens">' +
      (e.itens || []).map((i) => '<li><span>' + esc(i.rotulo) + '</span><span>' + esc(brl(i.valor)) + '</span></li>').join('') + '</ul>';
  } else {
    h = '<p>' + esc(e ? explicarSemEstimativa(e) : 'Sem valor aproximado registrado.') + '</p>';
  }
  return h + '<p class="ajuda">Valor que o cliente viu ao enviar. ' + esc(AVISO_ESTIMATIVA) + '</p>';
}

function blocoStatus(s, slots) {
  const opcoes = opcoesDe(s);
  const selecao = STATUS.map((x) =>
    '<option value="' + esc(x.valor) + '"' + (x.valor === s.status ? ' selected' : '') + '>' + esc(x.rotulo) + '</option>').join('');
  const radios = opcoes.map((o, i) =>
    '<label><input type="radio" data-conf name="conf-' + esc(s.id) + '" value="' + esc(o.data + '|' + hora5(o.hora)) + '"' +
    (i === 0 ? ' checked' : '') + '> <span>' + o.prioridade + 'ª opção: ' + esc(dh(o.data, o.hora)) + '</span></label>').join('');
  const slotsHtml = slots.map((x) =>
    '<option value="' + esc(x.data + '|' + hora5(x.hora)) + '">' + esc(dh(x.data, x.hora)) + '</option>').join('');
  return '<div class="bt-bloco"><h3>Status</h3>' +
    '<div class="campo"><label>Alterar status <select data-campo="status">' + selecao + '</select></label></div>' +
    '<fieldset class="bt-confirmar" data-confirmar hidden><legend>Horário do agendamento</legend>' + radios +
    '<label><input type="radio" data-conf name="conf-' + esc(s.id) + '" value="outro"' + (opcoes.length === 0 ? ' checked' : '') +
    '> <span>Outro horário publicado:</span></label>' +
    '<select data-campo="outro" aria-label="Outro horário publicado"' + (slots.length === 0 ? ' disabled' : '') + '>' +
    (slots.length === 0 ? '<option value="">Nenhum horário publicado</option>' : slotsHtml) + '</select></fieldset>' +
    '<div class="campo"><label>Observação (opcional) <input type="text" data-campo="detalhe" maxlength="500"></label></div>' +
    '<div class="acoes"><button type="button" class="btn btn-primario btn-pequeno" data-acao="status">Salvar status</button></div></div>';
}

function blocoNotas(s, nomes) {
  const lista = (s.bt_notas || []).slice().sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)));
  const itens = lista.map((n) =>
    '<li><strong>' + esc(nomes.get(n.autor) || 'Equipe') + '</strong> · <span class="suave">' + esc(formatarDataHora(n.criado_em)) +
    '</span><p class="bt-texto-nota">' + esc(n.texto) + '</p></li>').join('');
  return '<div class="bt-bloco"><h3>Notas internas</h3>' +
    (itens ? '<ul class="bt-notas">' + itens + '</ul>' : '<p class="suave">Nenhuma nota ainda.</p>') +
    '<div class="campo"><label>Nova nota <textarea data-campo="nota" maxlength="1000" rows="2"></textarea></label></div>' +
    '<div class="acoes"><button type="button" class="btn btn-pequeno" data-acao="nota">Adicionar nota</button></div></div>';
}

function blocoHistorico(s, nomes) {
  const lista = (s.bt_historico || []).slice().sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)));
  const itens = lista.map((h) => {
    const quem = h.por ? (nomes.get(h.por) || 'Equipe') : 'Site';
    return '<li><strong>' + esc((rotuloDe(STATUS, h.de) || '—') + ' → ' + (rotuloDe(STATUS, h.para) || '—')) + '</strong> · ' +
      esc(quem) + ' · <span class="suave">' + esc(formatarDataHora(h.criado_em)) + '</span>' +
      (h.detalhe ? '<br>' + esc(h.detalhe) : '') + '</li>';
  }).join('');
  return '<div class="bt-bloco"><h3>Histórico de status</h3><ul class="bt-hist">' + itens + '</ul></div>';
}

export function htmlCartao(s, nomes, slots, aberto) {
  const flags =
    (s.pet_dificil ? '<span class="bt-tag bt-tag-perigo">Difícil</span>' : '') +
    (s.pet_tem_restricao ? '<span class="bt-tag bt-tag-atencao">Saúde</span>' : '');
  const servicos = (s.servicos || []).map((x) => '<li>' + esc(x.nome || x.id) + '</li>').join('');
  const horarios = opcoesDe(s).map((o) => {
    const final = s.data_final === o.data && hora5(s.hora_final) === hora5(o.hora);
    return '<li>' + o.prioridade + 'ª opção: ' + esc(dh(o.data, o.hora)) + (final ? ' <strong>(horário final)</strong>' : '') + '</li>';
  }).join('');
  const final = s.data_final
    ? '<p><strong>Horário final:</strong> ' + esc(dh(s.data_final, s.hora_final)) + '</p>' : '';

  return '<details class="cartao bt-card" data-id="' + esc(s.id) + '" data-final="' + (s.data_final ? '1' : '') + '"' +
    (aberto ? ' open' : '') + '>' +
    '<summary><span class="bt-sum-topo"><span class="bt-prot">' + esc(s.protocolo) + '</span>' + seloStatus(s.status) + flags + '</span>' +
    '<span class="bt-linha"><strong>' + esc(s.cliente_nome) + '</strong> · pet: ' + esc(s.pet_nome) + '</span>' +
    '<span class="bt-linha suave">' + esc(resumoHorarios(s)) + '</span>' +
    '<span class="suave">Recebida em ' + esc(formatarDataHora(s.criado_em)) + '</span></summary>' +
    '<div class="bt-corpo">' +
    '<div class="bt-bloco"><h3>Contato</h3><p>' + esc(s.cliente_nome) + ' · ' + esc(formatarWhatsApp(s.cliente_whatsapp)) + '</p>' +
    '<p><a class="btn btn-primario btn-pequeno" href="' + esc(linkZap(s)) + '" target="_blank" rel="noopener">Chamar no WhatsApp</a></p></div>' +
    '<div class="bt-bloco"><h3>Pet</h3>' + blocoPet(s) + '</div>' +
    '<div class="bt-bloco"><h3>Serviços</h3><ul class="bt-ul">' + servicos + '</ul></div>' +
    '<div class="bt-bloco"><h3>Horários pedidos</h3><ol class="bt-ul">' + horarios + '</ol>' + final + '</div>' +
    '<div class="bt-bloco"><h3>Valor aproximado</h3>' + blocoValor(s) + '</div>' +
    (s.foto_path
      ? '<div class="bt-bloco"><h3>Foto</h3><button type="button" class="btn btn-pequeno" data-acao="foto" data-foto="' + esc(s.foto_path) + '">Ver foto do pet</button><div data-foto-area aria-live="polite"></div></div>'
      : '') +
    blocoStatus(s, slots) + blocoNotas(s, nomes) + blocoHistorico(s, nomes) +
    '</div></details>';
}
