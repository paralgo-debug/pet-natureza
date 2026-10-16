// Pet Natureza - Painel: detalhe de uma solicitação (contato, pet, consulta, fotos,
// horários, valor, status, notas, histórico e exclusão definitiva).

import { supabase } from './supabase.js';
import { toast, confirmar, formatarDataHora } from './util.js';
import { esc, msgErro, ROTULO_STATUS, urlWhatsApp } from './vet-comum.js';
import {
  ESPECIES, PORTES, SEXOS, CASTRADO, DURACOES, STATUS, USOS_AGENDA,
  formatarTelefone, dataBR, dataCurta, horaCurta, moeda, agoraFortaleza
} from './vet-calculo.js';

const porPrio = (a, b) => a.prioridade - b.prioridade;
const porData = (a, b) => (new Date(a.criado_em) - new Date(b.criado_em)) || ((a.id || 0) - (b.id || 0));
const nomeDe = (lista, id) => {
  const x = lista.find((i) => i.id === id);
  return x ? x.nome : '';
};
const tx = (t) => (t ? '<span class="vt-pre-linha">' + esc(t) + '</span>' : '');
const lin = (rotulo, html) => (html ? '<dt>' + esc(rotulo) + '</dt><dd>' + html + '</dd>' : '');

// ---------- HTML ----------
export function htmlDetalhe(s, { ehAdmin, nomes }) {
  const quem = (id) => (id ? nomes[id] || 'Equipe' : 'Site');
  const opcoes = (s.vt_opcoes || []).slice().sort(porPrio);
  const hist = (s.vt_historico || []).slice().sort(porData);
  const notas = (s.vt_notas || []).slice().sort(porData);
  const peso = s.pet_peso_kg !== null && s.pet_peso_kg !== undefined
    ? String(Number(s.pet_peso_kg)).replace('.', ',') + ' kg' : '';
  const saudacao = 'Olá, ' + s.cliente_nome + '! Aqui é a equipe do Pet Natureza. ' +
    'Sobre a sua solicitação de consulta veterinária (protocolo ' + s.protocolo + '):';

  const est = s.estimativa && typeof s.estimativa === 'object' ? s.estimativa : null;
  const valor = est && est.total !== null && est.total !== undefined
    ? '<p><strong>' + esc(moeda(Number(est.total))) + '</strong> (valor aproximado mostrado ao cliente)</p>' +
      '<ul class="vt-opc-lista">' + (est.itens || []).map((i) =>
        '<li class="vt-opc-item">' + esc(i.rotulo) + ': ' + esc(moeda(Number(i.valor))) + '</li>').join('') + '</ul>'
    : '<p class="vt-suave">Nenhum valor aproximado foi mostrado ao cliente.</p>';

  const fotos = (s.fotos || []).length
    ? '<section><h3 class="vt-sec-titulo">Fotos</h3><p><button type="button" class="btn btn-pequeno" data-acao="ver-fotos">Ver fotos (' +
      s.fotos.length + ')</button></p><div class="vt-fotos-adm" data-fotos></div></section>'
    : '';

  const excluir = ehAdmin
    ? '<div class="vt-zona-perigo"><h3 class="vt-sec-titulo">Excluir definitivamente</h3>' +
      '<p>Apaga a solicitação, as fotos, o histórico e as notas. Não dá para desfazer.</p>' +
      '<button type="button" class="btn btn-perigo btn-pequeno" data-acao="abrir-excluir">Excluir definitivamente…</button>' +
      '<div data-confirma-excluir hidden><div class="campo"><label>Para confirmar, digite o protocolo <strong>' + esc(s.protocolo) +
      '</strong><input type="text" autocomplete="off" data-campo="protocolo-conf"></label></div>' +
      '<p class="vt-campo-erro" role="alert" data-erro-excluir hidden></p>' +
      '<div class="acoes"><button type="button" class="btn btn-perigo" data-acao="excluir" disabled>Excluir agora</button></div></div></div>'
    : '';

  return '<section><h3 class="vt-sec-titulo">Contato</h3><p>' + esc(s.cliente_nome) + ' · ' +
      esc(formatarTelefone(s.cliente_whatsapp)) + '</p>' +
      '<p><a class="btn btn-primario btn-pequeno" href="' + esc(urlWhatsApp(s.cliente_whatsapp, saudacao)) +
      '" target="_blank" rel="noopener">Chamar no WhatsApp</a></p></section>' +
    '<section><h3 class="vt-sec-titulo">Pet</h3><dl class="vt-dl">' +
      lin('Nome', esc(s.pet_nome) + ' (' + esc(nomeDe(ESPECIES, s.pet_especie)) + ')') +
      lin('Raça', esc(s.pet_raca)) + lin('Peso', esc(peso)) + lin('Porte', esc(nomeDe(PORTES, s.pet_porte))) +
      lin('Idade aproximada', esc(s.pet_idade)) + lin('Nascimento', s.pet_nascimento ? esc(dataBR(s.pet_nascimento)) : '') +
      lin('Sexo', esc(nomeDe(SEXOS, s.pet_sexo))) + lin('Castrado(a)', esc(nomeDe(CASTRADO, s.pet_castrado))) +
    '</dl></section>' +
    '<section><h3 class="vt-sec-titulo">Consulta</h3><dl class="vt-dl">' +
      lin('Motivo', esc(s.tipo_nome)) + lin('Sintomas ou queixa', tx(s.sintomas)) +
      lin('Há quanto tempo', esc(nomeDe(DURACOES, s.sintomas_duracao))) +
      lin('Tratamento ou medicação', s.em_tratamento ? tx(s.medicacao) || 'Sim' : 'Não') +
      lin('Doenças, alergias ou restrições', s.tem_condicoes
        ? '<div class="vt-destaque">' + (tx(s.condicoes) || 'Sim') + '</div>' : 'Não') +
      lin('Agressivo ou difícil', s.pet_dificil
        ? '<div class="vt-destaque">Sim' + (s.pet_comportamento ? ': ' + tx(s.pet_comportamento) : '') + '</div>' : 'Não') +
      lin('Observações', tx(s.observacoes)) +
    '</dl></section>' + fotos +
    '<section><h3 class="vt-sec-titulo">Horários pedidos</h3><ul class="vt-opc-lista">' +
      opcoes.map((o) => '<li class="vt-opc-item">' + o.prioridade + 'ª opção: ' + esc(dataCurta(o.data)) +
        ' às ' + esc(horaCurta(o.hora)) + '</li>').join('') +
      (s.data_final ? '<li class="vt-opc-item vt-opc-final">Horário final: ' + esc(dataCurta(s.data_final)) +
        ' às ' + esc(horaCurta(s.hora_final)) + '</li>' : '') +
    '</ul></section>' +
    '<section><h3 class="vt-sec-titulo">Valor aproximado</h3>' + valor + '</section>' +
    '<div class="vt-status-bloco"><h3 class="vt-sec-titulo">Atendimento</h3>' +
      '<div class="campo"><label>Status<select data-campo="status">' + STATUS.map((x) =>
        '<option value="' + x.id + '"' + (x.id === s.status ? ' selected' : '') + '>' + esc(x.nome) + '</option>').join('') +
      '</select></label></div>' +
      '<div class="campo" data-bloco-horario hidden><label>Horário da consulta<select data-campo="horario"></select></label>' +
        '<p class="ajuda">O horário precisa estar publicado, livre e ser do tipo certo para o motivo.</p></div>' +
      '<div class="campo"><label>Observação (opcional)<textarea rows="2" maxlength="500" data-campo="detalhe"></textarea></label></div>' +
      '<p class="vt-campo-erro" role="alert" data-erro hidden></p>' +
      '<div class="acoes"><button type="button" class="btn btn-primario" data-acao="salvar-status">Salvar status</button></div></div>' +
    '<section><h3 class="vt-sec-titulo">Notas internas</h3><ul class="vt-notas-lista">' +
      (notas.length ? notas.map((n) => '<li class="vt-nota-item"><strong>' + esc(quem(n.autor)) + '</strong> · ' +
        esc(formatarDataHora(n.criado_em)) + '<br>' + tx(n.texto) + '</li>').join('')
        : '<li class="vt-suave">Nenhuma nota ainda.</li>') +
    '</ul><div class="campo"><label>Nova nota<textarea rows="2" maxlength="1000" data-campo="nota"></textarea></label></div>' +
      '<div class="acoes"><button type="button" class="btn btn-pequeno" data-acao="add-nota">Adicionar nota</button></div></section>' +
    '<section><h3 class="vt-sec-titulo">Histórico</h3><ul class="vt-hist-lista">' + hist.map((h) =>
      '<li class="vt-hist-item">' + esc(formatarDataHora(h.criado_em)) + ' · ' +
      esc(h.de ? ROTULO_STATUS[h.de] || h.de : 'Início') + ' → ' + esc(ROTULO_STATUS[h.para] || h.para) +
      ' · ' + esc(quem(h.por)) + (h.detalhe ? '<br>' + tx(h.detalhe) : '') + '</li>').join('') + '</ul></section>' +
    excluir;
}

// ---------- Horários publicados (para confirmar) ----------
let cacheSlots = null;

async function carregarSlots() {
  if (cacheSlots && Date.now() - cacheSlots.em < 60000) return cacheSlots.lista;
  const { data, error } = await supabase.from('vt_slots_pub').select('data, hora, uso')
    .eq('bloqueado', false).gte('data', agoraFortaleza().data)
    .order('data').order('hora').limit(500);
  if (error) throw error;
  cacheSlots = { em: Date.now(), lista: data || [] };
  return cacheSlots.lista;
}

async function preencherHorarios(raiz, s) {
  const sel = raiz.querySelector('[data-campo="horario"]');
  sel.innerHTML = '<option value="">Carregando horários…</option>';
  let slots;
  try {
    slots = await carregarSlots();
  } catch (e) {
    sel.innerHTML = '<option value="">Não foi possível carregar os horários</option>';
    return;
  }
  const chave = (d, h) => d + '|' + horaCurta(h);
  const opcoes = (s.vt_opcoes || []).slice().sort(porPrio);
  const usadas = new Set(opcoes.map((o) => chave(o.data, o.hora)));
  const atual = s.data_final ? chave(s.data_final, s.hora_final) : '';
  const opt = (v, rotulo) => '<option value="' + esc(v) + '"' + (v === atual ? ' selected' : '') + '>' + esc(rotulo) + '</option>';
  const outros = slots.filter((x) => !usadas.has(chave(x.data, x.hora)));
  let html = '<option value="">Escolha o horário</option>';
  if (opcoes.length) {
    html += '<optgroup label="Opções pedidas pelo cliente">' + opcoes.map((o) =>
      opt(chave(o.data, o.hora), o.prioridade + 'ª opção — ' + dataCurta(o.data) + ' às ' + horaCurta(o.hora))).join('') + '</optgroup>';
  }
  if (outros.length) {
    html += '<optgroup label="Outros horários publicados">' + outros.map((x) =>
      opt(chave(x.data, x.hora), dataCurta(x.data) + ' às ' + horaCurta(x.hora) + ' (' + nomeDe(USOS_AGENDA, x.uso) + ')')).join('') + '</optgroup>';
  }
  sel.innerHTML = html;
}

// ---------- Ações ----------
export function ligarDetalhe(raiz, s, { ehAdmin, userId, aoAlterar }) {
  const q = (sel) => raiz.querySelector(sel);
  const selStatus = q('[data-campo="status"]');
  const blocoHor = q('[data-bloco-horario]');
  const erroEl = q('[data-erro]');
  let horariosCarregados = false;
  const erro = (m) => { erroEl.textContent = m || ''; erroEl.hidden = !m; };

  function ajustarHorario() {
    const conf = selStatus.value === 'confirmado';
    blocoHor.hidden = !conf;
    if (conf && !horariosCarregados) {
      horariosCarregados = true;
      preencherHorarios(raiz, s);
    }
  }
  selStatus.addEventListener('change', () => { erro(''); ajustarHorario(); });
  ajustarHorario();

  async function salvarStatus(b) {
    erro('');
    const status = selStatus.value;
    const detalhe = q('[data-campo="detalhe"]').value.trim();
    let data = null;
    let hora = null;
    if (status === 'confirmado') {
      const v = q('[data-campo="horario"]').value;
      if (!/^\d{4}-\d{2}-\d{2}\|\d{2}:\d{2}$/.test(v)) {
        erro('Escolha o horário da consulta para confirmar.');
        return;
      }
      [data, hora] = v.split('|');
    }
    if (status === s.status && status !== 'confirmado' && !detalhe) {
      erro('Escolha um novo status ou escreva uma observação.');
      return;
    }
    if (status === 'cancelado' && s.status !== 'cancelado'
        && !(await confirmar('Cancelar esta solicitação? Se ela estava confirmada, o horário será liberado.', 'Cancelar solicitação'))) {
      return;
    }
    const antes = b.textContent;
    b.disabled = true;
    b.textContent = 'Salvando…';
    try {
      const { error } = await supabase.rpc('vt_alterar_status', {
        p_id: s.id, p_status: status, p_data: data, p_hora: hora, p_detalhe: detalhe || null
      });
      if (error) throw error;
      toast('Status atualizado.');
      await aoAlterar();
    } catch (e) {
      const m = msgErro(e);
      erro(m);
      toast(m, 'erro');
      b.disabled = false;
      b.textContent = antes;
    }
  }

  async function adicionarNota(b) {
    const campo = q('[data-campo="nota"]');
    const texto = campo.value.trim();
    if (!texto) { toast('Escreva a nota antes de adicionar.', 'erro'); return; }
    if (!userId) { toast('Sessão inválida. Entre novamente.', 'erro'); return; }
    b.disabled = true;
    try {
      const { error } = await supabase.from('vt_notas').insert({ solicitacao_id: s.id, autor: userId, texto });
      if (error) throw error;
      toast('Nota adicionada.');
      await aoAlterar();
    } catch (e) {
      toast(msgErro(e), 'erro');
      b.disabled = false;
    }
  }

  async function verFotos(b) {
    const caixa = q('[data-fotos]');
    b.disabled = true;
    try {
      const { data, error } = await supabase.storage.from('vet-fotos').createSignedUrls(s.fotos, 300);
      if (error) throw error;
      const boas = (data || []).filter((x) => x && x.signedUrl && !x.error);
      caixa.innerHTML = boas.length
        ? boas.map((x, i) => '<a href="' + esc(x.signedUrl) + '" target="_blank" rel="noopener"><img src="' + esc(x.signedUrl) +
            '" alt="Foto ' + (i + 1) + ' enviada pelo tutor" loading="lazy"></a>').join('') +
          '<p class="ajuda">Links temporários (5 minutos). Clique novamente em "Ver fotos" para gerar outros.</p>'
        : '<p class="vt-suave">As fotos não foram encontradas.</p>';
    } catch (e) {
      toast(msgErro(e), 'erro');
    }
    b.disabled = false;
  }

  async function excluir(b) {
    const erroEx = q('[data-erro-excluir]');
    erroEx.hidden = true;
    if (!(await confirmar('Excluir DEFINITIVAMENTE a solicitação ' + s.protocolo +
        '? As fotos, o histórico e as notas também serão apagados. Isso não pode ser desfeito.', 'Excluir definitivamente'))) return;
    b.disabled = true;
    b.textContent = 'Excluindo…';
    try {
      // inclui possíveis sobras de tentativas de envio que falharam
      const caminhos = new Set(s.fotos || []);
      [1, 2].forEach((i) => ['jpg', 'png', 'webp'].forEach((ext) => caminhos.add(s.id + '/foto' + i + '.' + ext)));
      const r = await supabase.storage.from('vet-fotos').remove(Array.from(caminhos));
      if (r.error) throw r.error;
      const { error } = await supabase.rpc('vt_excluir_solicitacao', { p_id: s.id });
      if (error) throw error;
      toast('Solicitação excluída.');
      await aoAlterar();
    } catch (e) {
      erroEx.textContent = msgErro(e);
      erroEx.hidden = false;
      toast(msgErro(e), 'erro');
      b.disabled = false;
      b.textContent = 'Excluir agora';
    }
  }

  raiz.addEventListener('input', (ev) => {
    if (!ev.target.matches('[data-campo="protocolo-conf"]')) return;
    const b = q('[data-acao="excluir"]');
    if (b) b.disabled = ev.target.value.trim().toUpperCase() !== String(s.protocolo).toUpperCase();
  });

  raiz.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button[data-acao]');
    if (!b || b.disabled) return;
    const acao = b.getAttribute('data-acao');
    if (acao === 'salvar-status') await salvarStatus(b);
    else if (acao === 'add-nota') await adicionarNota(b);
    else if (acao === 'ver-fotos') await verFotos(b);
    else if (acao === 'abrir-excluir' && ehAdmin) {
      q('[data-confirma-excluir]').hidden = false;
      b.hidden = true;
      q('[data-campo="protocolo-conf"]').focus();
    } else if (acao === 'excluir' && ehAdmin) await excluir(b);
  });
    }
