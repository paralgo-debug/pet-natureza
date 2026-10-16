// Pet Natureza - Painel: aba Tipos e preços — HTML das seções e validação local.
// A validação espelha as regras de vt_publicar_config (a regra real é no banco).

import { esc } from './vet-comum.js';
import { PORTES, ESPECIES, USOS_AGENDA, DIAS_SEMANA, gerarSlug } from './vet-calculo.js';

export const LIM_VALOR = 100000;
const HORA_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const ehObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// ---------- Caminhos ("tipos.0.nome") ----------
export function getPath(obj, caminho) {
  return String(caminho).split('.').reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);
}

export function setPath(obj, caminho, valor) {
  const ks = String(caminho).split('.');
  let o = obj;
  for (let i = 0; i < ks.length - 1; i += 1) {
    if (o[ks[i]] === null || typeof o[ks[i]] !== 'object') o[ks[i]] = {};
    o = o[ks[i]];
  }
  o[ks[ks.length - 1]] = valor;
}

// ---------- Estrutura e normalização ----------
export function garantirEstrutura(cfg) {
  cfg.tipos = Array.isArray(cfg.tipos) ? cfg.tipos.filter(ehObj) : [];
  if (!ehObj(cfg.precos)) cfg.precos = {};
  const p = cfg.precos;
  ['especie_adicional', 'porte_adicional'].forEach((k) => { if (!ehObj(p[k])) p[k] = {}; });
  ['peso_faixas', 'horario_especial'].forEach((k) => {
    p[k] = Array.isArray(p[k]) ? p[k].filter(ehObj) : [];
  });
  p.horario_especial.forEach((h) => { if (!Array.isArray(h.dias)) h.dias = []; });
  if (p.manejo_dificil === undefined) p.manejo_dificil = null;
  return cfg;
}

export function normalizarCfg(cfg) {
  garantirEstrutura(cfg);
  cfg.tipos.forEach((t) => { t.nome = String(t.nome ?? '').trim(); });
  cfg.precos.horario_especial.forEach((h) => { h.rotulo = String(h.rotulo ?? '').trim(); });
  cfg.aviso_emergencia = String(cfg.aviso_emergencia ?? '').trim();
  return cfg;
}

export function novoIdTipo(cfg, nome) {
  const usados = new Set(cfg.tipos.map((t) => t.id));
  const base = gerarSlug(nome).slice(0, 36);
  if (!usados.has(base)) return base;
  let n = 2;
  while (usados.has(base + '_' + n)) n += 1;
  return base + '_' + n;
}

export function novoIdHorario(cfg) {
  const usados = new Set(cfg.precos.horario_especial.map((h) => h.id));
  let n = 1;
  while (usados.has('esp_' + n)) n += 1;
  return 'esp_' + n;
}

// ---------- Campos ----------
const idDe = (c) => 'vt-p-' + String(c).replace(/\./g, '-');
const txtNum = (v) => (typeof v === 'number' && Number.isFinite(v) ? String(v).replace('.', ',') : '');
const erroP = (c) =>
  '<p class="vt-campo-erro" id="e-' + idDe(c) + '" data-erro-de="' + c + '" role="alert" hidden></p>';
const ajudaP = (t) => (t ? '<p class="ajuda">' + esc(t) + '</p>' : '');

function cNum(c, rotulo, v, ajuda) {
  const id = idDe(c);
  return '<div class="campo"><label for="' + id + '">' + esc(rotulo) + '</label>' +
    '<input type="text" inputmode="decimal" autocomplete="off" id="' + id + '" data-path="' + c +
    '" data-tipo="num" value="' + esc(txtNum(v)) + '" aria-describedby="e-' + id + '">' +
    ajudaP(ajuda) + erroP(c) + '</div>';
}

function cTxt(c, rotulo, v, max) {
  const id = idDe(c);
  return '<div class="campo"><label for="' + id + '">' + esc(rotulo) + '</label>' +
    '<input type="text" autocomplete="off" maxlength="' + max + '" id="' + id + '" data-path="' + c +
    '" data-tipo="txt" value="' + esc(v ?? '') + '" aria-describedby="e-' + id + '">' + erroP(c) + '</div>';
}

function cHora(c, rotulo, v) {
  const id = idDe(c);
  return '<div class="campo"><label for="' + id + '">' + esc(rotulo) + '</label>' +
    '<input type="time" step="60" id="' + id + '" data-path="' + c + '" data-tipo="txt" value="' +
    esc(v ?? '') + '" aria-describedby="e-' + id + '">' + erroP(c) + '</div>';
}

function cSel(c, rotulo, v, opcoes) {
  const id = idDe(c);
  return '<div class="campo"><label for="' + id + '">' + esc(rotulo) + '</label>' +
    '<select id="' + id + '" data-path="' + c + '" data-tipo="sel" aria-describedby="e-' + id + '">' +
    opcoes.map((o) => '<option value="' + o.id + '"' + (o.id === v ? ' selected' : '') + '>' + esc(o.nome) +
      '</option>').join('') + '</select>' + erroP(c) + '</div>';
}

function cSim(c, rotulo, v) {
  const id = idDe(c);
  return '<div class="campo"><label for="' + id + '"><input type="checkbox" id="' + id + '" data-path="' + c +
    '" data-tipo="bool"' + (v ? ' checked' : '') + '>' + esc(rotulo) + '</label></div>';
}

function cArea(c, rotulo, v, max, ajuda) {
  const id = idDe(c);
  return '<div class="campo"><label for="' + id + '">' + esc(rotulo) + '</label>' +
    '<textarea rows="5" maxlength="' + max + '" id="' + id + '" data-path="' + c + '" data-tipo="txt"' +
    ' aria-describedby="e-' + id + '">' + esc(v ?? '') + '</textarea>' + ajudaP(ajuda) + erroP(c) + '</div>';
}

function botoes(lista, i, n, nome) {
  const b = (acao, txt, rot, off, classe) =>
    '<button type="button" class="btn btn-pequeno' + (classe ? ' ' + classe : '') + '" data-acao="' + acao +
    '" data-lista="' + lista + '" data-i="' + i + '"' + (off ? ' disabled' : '') + ' aria-label="' +
    esc(rot + ' ' + nome) + '">' + txt + '</button>';
  return '<span class="vt-linha-acoes">' + b('subir', '↑', 'Subir', i === 0) +
    b('descer', '↓', 'Descer', i === n - 1) + b('remover', 'Remover', 'Remover', false, 'btn-perigo') + '</span>';
}

// ---------- Seções ----------
function corpoTipos(cfg) {
  const t = cfg.tipos;
  const linhas = t.map((x, i) => {
    const p = 'tipos.' + i + '.';
    return '<div class="vt-linha-edit"><div class="vt-linha-topo"><strong>Motivo ' + (i + 1) + '</strong>' +
      '<span class="vt-suave">Identificador: ' + esc(x.id) + '</span>' +
      botoes('tipos', i, t.length, 'o motivo ' + (i + 1)) + '</div>' +
      '<div class="vt-grade-campos">' + cTxt(p + 'nome', 'Nome', x.nome, 60) +
      cNum(p + 'preco_base', 'Valor base (R$)', x.preco_base, 'Vazio = valor não definido') +
      cSel(p + 'agenda', 'Grupo de horários', x.agenda, USOS_AGENDA) + '</div>' +
      '<div class="vt-grade-campos">' + cSim(p + 'ativo', 'Disponível no site', x.ativo === true) +
      cSim(p + 'exige_sintomas', 'Exige sintomas ou queixa', x.exige_sintomas === true) +
      cSim(p + 'estimar', 'Mostrar estimativa de valor', x.estimar !== false) + '</div></div>';
  }).join('');
  return erroP('tipos') + linhas +
    '<div class="vt-linha-edit"><div class="campo"><label for="vt-novo-tipo-nome">Novo motivo</label>' +
    '<input type="text" id="vt-novo-tipo-nome" maxlength="60" autocomplete="off">' +
    '<p class="ajuda">O identificador é gerado a partir do nome e nunca muda depois.</p>' +
    '<p class="vt-campo-erro" id="vt-novo-tipo-erro" role="alert" hidden></p></div>' +
    '<div class="acoes"><button type="button" class="btn btn-pequeno" data-acao="add-tipo"' +
    (t.length >= 20 ? ' disabled' : '') + '>Adicionar motivo</button></div></div>';
}

function corpoExtras(cfg) {
  const p = cfg.precos;
  return '<h3 class="vt-sec-titulo">Por espécie</h3><div class="vt-grade-campos">' +
    ESPECIES.map((e) => cNum('precos.especie_adicional.' + e.id, e.nome + ' (R$)', p.especie_adicional[e.id])).join('') +
    '</div><h3 class="vt-sec-titulo">Por porte</h3><div class="vt-grade-campos">' +
    PORTES.map((e) => cNum('precos.porte_adicional.' + e.id, e.nome + ' (R$)', p.porte_adicional[e.id])).join('') +
    '</div>' + ajudaP('Campo vazio vale R$ 0,00.');
}

function corpoPeso(cfg) {
  const f = cfg.precos.peso_faixas;
  const linhas = f.map((x, i) => {
    const p = 'precos.peso_faixas.' + i + '.';
    return '<div class="vt-linha-edit"><div class="vt-linha-topo"><strong>Faixa ' + (i + 1) + '</strong>' +
      '<button type="button" class="btn btn-pequeno btn-perigo" data-acao="remover" data-lista="peso_faixas" data-i="' +
      i + '" aria-label="Remover a faixa de peso ' + (i + 1) + '">Remover</button></div>' +
      '<div class="vt-grade-campos">' + cNum(p + 'acima_de_kg', 'Acima de (kg)', x.acima_de_kg) +
      cNum(p + 'adicional', 'Adicional (R$)', x.adicional) + '</div></div>';
  }).join('');
  return ajudaP('Vale só a MAIOR faixa ultrapassada: as faixas não se somam. Com faixas acima de 10 kg e acima de 25 kg, um pet de 30 kg paga só o adicional da faixa de 25 kg.') +
    (linhas || '<p class="vt-suave">Nenhuma faixa de peso.</p>') +
    '<div class="acoes"><button type="button" class="btn btn-pequeno" data-acao="add-faixa"' +
    (f.length >= 10 ? ' disabled' : '') + '>Adicionar faixa</button></div>';
}

function corpoManejo(cfg) {
  return cNum('precos.manejo_dificil', 'Adicional para pet agressivo ou difícil (R$)', cfg.precos.manejo_dificil,
    'Vale quando o tutor marca que o pet é agressivo ou difícil de manusear.');
}

function corpoHorarios(cfg) {
  const h = cfg.precos.horario_especial;
  const linhas = h.map((x, i) => {
    const p = 'precos.horario_especial.' + i + '.';
    return '<div class="vt-linha-edit"><div class="vt-linha-topo"><strong>Regra ' + (i + 1) + '</strong>' +
      botoes('horario_especial', i, h.length, 'a regra ' + (i + 1)) + '</div>' +
      cTxt(p + 'rotulo', 'Nome da regra (aparece em "Como calculamos")', x.rotulo, 60) +
      '<fieldset class="vt-dias-semana"><legend>Dias da semana</legend>' +
      DIAS_SEMANA.map((nome, d) => '<label><input type="checkbox" data-path="' + p + 'dias" data-tipo="dia" value="' + d +
        '"' + (x.dias.includes(d) ? ' checked' : '') + '> ' + esc(nome) + '</label>').join('') + '</fieldset>' +
      erroP(p + 'dias') + '<div class="vt-grade-campos">' + cHora(p + 'de', 'De', x.de) +
      cHora(p + 'ate', 'Até (não inclui este horário)', x.ate) + cNum(p + 'adicional', 'Adicional (R$)', x.adicional) +
      '</div></div>';
  }).join('');
  return ajudaP('Vale a PRIMEIRA regra, na ordem abaixo, que combina com a 1ª opção de horário do cliente. Janelas que passam da meia-noite não são permitidas.') +
    (linhas || '<p class="vt-suave">Nenhum horário especial.</p>') +
    '<div class="acoes"><button type="button" class="btn btn-pequeno" data-acao="add-horario"' +
    (h.length >= 10 ? ' disabled' : '') + '>Adicionar horário especial</button></div>';
}

function corpoAgenda(cfg) {
  return '<div class="vt-grade-campos">' +
    cNum('antecedencia_horas', 'Antecedência mínima (horas)', cfg.antecedencia_horas, 'De 0 a 720. Horários mais próximos que isso não aparecem.') +
    cNum('janela_dias', 'Janela de agendamento (dias)', cfg.janela_dias, 'De 1 a 180. Até quantos dias à frente o cliente vê horários.') +
    '</div>';
}

function corpoAviso(cfg) {
  return cArea('aviso_emergencia', 'Texto do aviso de emergência', cfg.aviso_emergencia, 600,
      'Até 600 caracteres. Revise com a equipe: não deve dar diagnóstico nem prometer atendimento 24 horas.') +
    cSim('permitir_urgencia_online', 'Permitir solicitar urgência pelo formulário', cfg.permitir_urgencia_online !== false) +
    ajudaP('Desligado: o motivo de urgência mostra só o aviso e o botão do WhatsApp, e o servidor recusa o envio.');
}

export function corpoSecao(nome, cfg) {
  const mapa = {
    tipos: corpoTipos, extras: corpoExtras, peso: corpoPeso,
    manejo: corpoManejo, horarios: corpoHorarios, agenda: corpoAgenda, aviso: corpoAviso
  };
  return mapa[nome](cfg);
}

// ---------- Validação local ----------
export function validarCfg(cfg) {
  const e = {};
  const valor = (c, v) => {
    if (v === null || v === undefined) return;
    if (!(typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= LIM_VALOR)) {
      e[c] = 'O valor deve estar entre 0 e 100.000 (ou deixe vazio).';
    }
  };

  if (cfg.tipos.length < 1 || cfg.tipos.length > 20) e.tipos = 'Use de 1 a 20 motivos de consulta.';
  else if (!cfg.tipos.some((t) => t.ativo === true)) e.tipos = 'Deixe pelo menos um motivo disponível no site.';
  cfg.tipos.forEach((t, i) => {
    const p = 'tipos.' + i + '.';
    if (!t.nome || t.nome.length > 60) e[p + 'nome'] = 'Informe o nome (até 60 caracteres).';
    valor(p + 'preco_base', t.preco_base);
    if (!USOS_AGENDA.some((u) => u.id === t.agenda)) e[p + 'agenda'] = 'Escolha o grupo de horários.';
  });

  const pr = cfg.precos;
  ESPECIES.forEach((s) => valor('precos.especie_adicional.' + s.id, pr.especie_adicional[s.id]));
  PORTES.forEach((s) => valor('precos.porte_adicional.' + s.id, pr.porte_adicional[s.id]));
  valor('precos.manejo_dificil', pr.manejo_dificil);

  const limites = new Set();
  pr.peso_faixas.forEach((f, i) => {
    const p = 'precos.peso_faixas.' + i + '.';
    const n = f.acima_de_kg;
    if (typeof n !== 'number' || !Number.isFinite(n)) e[p + 'acima_de_kg'] = 'Informe o peso em kg.';
    else if (n < 0.1 || n > 150) e[p + 'acima_de_kg'] = 'O peso deve estar entre 0,1 e 150 kg.';
    else if (limites.has(n)) e[p + 'acima_de_kg'] = 'Já existe uma faixa com esse peso.';
    else limites.add(n);
    valor(p + 'adicional', f.adicional);
  });

  pr.horario_especial.forEach((h, i) => {
    const p = 'precos.horario_especial.' + i + '.';
    if (String(h.rotulo || '').length > 60) e[p + 'rotulo'] = 'O nome deve ter até 60 caracteres.';
    if (!Array.isArray(h.dias) || h.dias.length < 1) e[p + 'dias'] = 'Escolha ao menos um dia da semana.';
    const okDe = HORA_RE.test(String(h.de || ''));
    const okAte = HORA_RE.test(String(h.ate || ''));
    if (!okDe) e[p + 'de'] = 'Informe o horário inicial.';
    if (!okAte) e[p + 'ate'] = 'Informe o horário final.';
    if (okDe && okAte && h.de >= h.ate) e[p + 'ate'] = 'O horário final deve ser depois do inicial.';
    if (typeof h.adicional !== 'number' || !Number.isFinite(h.adicional)) {
      e[p + 'adicional'] = 'Informe o adicional (use 0 se não houver).';
    } else {
      valor(p + 'adicional', h.adicional);
    }
  });

  const ant = cfg.antecedencia_horas;
  if (typeof ant !== 'number' || !Number.isInteger(ant) || ant < 0 || ant > 720) {
    e.antecedencia_horas = 'Informe um número inteiro de 0 a 720.';
  }
  const jan = cfg.janela_dias;
  if (typeof jan !== 'number' || !Number.isInteger(jan) || jan < 1 || jan > 180) {
    e.janela_dias = 'Informe um número inteiro de 1 a 180.';
  }
  if (String(cfg.aviso_emergencia || '').length > 600) e.aviso_emergencia = 'O aviso deve ter no máximo 600 caracteres.';
  return e;
    }
