// Pet Natureza - Consulta Veterinária
// Validação no navegador (espelha as regras do servidor), entrada do cálculo
// e montagem do payload de vt_criar_solicitacao. Funções puras.

import { ESPECIES, TEXTOS, agoraFortaleza } from '../admin/js/vet-calculo.js';
import { tipoPorId, urgenciaBloqueada } from './vet-horarios.js';

const LIMITES = [
  ['raca', 60, 'pet_raca', 'A raça deve ter no máximo 60 caracteres.'],
  ['idade', 40, 'pet_idade', 'A idade deve ter no máximo 40 caracteres.'],
  ['sintomas', 1000, 'sintomas', 'Os sintomas devem ter no máximo 1000 caracteres.'],
  ['medicacao', 500, 'medicacao', 'O campo de tratamento deve ter no máximo 500 caracteres.'],
  ['condicoes', 500, 'condicoes', 'O campo de doenças e alergias deve ter no máximo 500 caracteres.'],
  ['comportamento', 500, 'pet_comportamento', 'O campo de comportamento deve ter no máximo 500 caracteres.'],
  ['observacoes', 800, 'observacoes', 'As observações devem ter no máximo 800 caracteres.']
];

// Devolve { chave: mensagem } na ordem em que os campos aparecem na página.
// d vem de criarFormulario().ler(); opcoes = estado.opcoes.
export function validar(d, { cfg, opcoes }) {
  const e = {};
  const tipo = tipoPorId(cfg, d.tipoId);

  if (!d.tipoId || !tipo || tipo.ativo !== true) {
    e.tipo = 'Escolha o motivo da consulta.';
  } else if (urgenciaBloqueada(cfg, d.tipoId)) {
    e.tipo = TEXTOS.URGENCIA_BLOQUEADA + ' Este motivo não pode ser enviado pelo formulário.';
  }

  if (!opcoes || opcoes.length < 1 || opcoes.length > 3) {
    e.opcoes = 'Escolha de 1 a 3 opções de data e horário.';
  }

  if (d.nome.length < 2 || d.nome.length > 100) {
    e.nome = 'Informe seu nome completo (de 2 a 100 caracteres).';
  }
  if (!d.whatsapp) {
    e.whatsapp = 'Informe um WhatsApp válido, com DDD.';
  }
  if (d.petNome.length < 1 || d.petNome.length > 60) {
    e.pet_nome = 'Informe o nome do pet (até 60 caracteres).';
  }
  if (!ESPECIES.some((x) => x.id === d.especie)) {
    e.pet_especie = 'Escolha a espécie do pet.';
  }

  if (d.pesoTexto !== '') {
    if (typeof d.peso !== 'number' || !Number.isFinite(d.peso)) {
      e.peso_kg = 'Informe o peso em números (exemplo: 8,5).';
    } else if (d.peso <= 0 || d.peso > 150) {
      e.peso_kg = 'O peso deve ser maior que 0 e de no máximo 150 kg.';
    }
  }

  if (d.nascimento) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.nascimento) || d.nascimento < '1980-01-01') {
      e.pet_nascimento = 'Data de nascimento inválida.';
    } else if (d.nascimento > agoraFortaleza().data) {
      e.pet_nascimento = 'A data de nascimento não pode estar no futuro.';
    }
  }

  LIMITES.forEach(([campo, max, chave, msg]) => {
    if (d[campo].length > max && !e[chave]) e[chave] = msg;
  });

  if (tipo && tipo.exige_sintomas === true && !d.sintomas) {
    e.sintomas = 'Descreva os sintomas ou a queixa do seu pet.';
  }
  if (d.emTratamento && !d.medicacao) {
    e.medicacao = 'Informe qual tratamento ou medicação o pet está usando.';
  }
  if (d.temCondicoes && !d.condicoes) {
    e.condicoes = 'Informe as doenças, alergias ou restrições do pet.';
  }
  if (!d.consentimento) {
    e.consentimento = 'É necessário concordar com o uso dos dados para enviar a solicitação.';
  }

  // reordena na ordem da página (a lista de limites pode ter inserido fora de ordem)
  const ordem = ['tipo', 'opcoes', 'nome', 'whatsapp', 'pet_nome', 'pet_especie', 'pet_raca',
    'peso_kg', 'pet_idade', 'pet_nascimento', 'sintomas', 'medicacao', 'condicoes',
    'pet_comportamento', 'observacoes', 'consentimento'];
  const saida = {};
  ordem.forEach((k) => { if (e[k]) saida[k] = e[k]; });
  return saida;
}

// Entrada para calcular() de vet-calculo.js (usa a 1ª opção para o horário especial).
export function entradaCalculo(d, opcoes) {
  const p = opcoes && opcoes[0];
  return {
    tipoId: d.tipoId || null,
    especie: d.especie || null,
    porte: d.porte || null,
    peso: typeof d.peso === 'number' && Number.isFinite(d.peso) ? d.peso : null,
    dificil: !!d.dificil,
    data: p ? p.data : null,
    hora: p ? p.hora : null
  };
}

// Corpo do RPC vt_criar_solicitacao. Chame só depois de validar() vazio.
// ctx = { id, opcoes, estimativaTotal (número ou null), fotos (caminhos enviados) }
export function montarPayload(d, ctx) {
  const ou = (s) => (s ? s : null);
  return {
    id: ctx.id,
    nome: d.nome,
    whatsapp: d.whatsapp,
    pet_nome: d.petNome,
    pet_especie: d.especie,
    pet_raca: ou(d.raca),
    peso_kg: typeof d.peso === 'number' && Number.isFinite(d.peso) ? d.peso : null,
    pet_porte: ou(d.porte),
    pet_idade: ou(d.idade),
    pet_nascimento: ou(d.nascimento),
    pet_sexo: d.sexo || 'nao_sei',
    pet_castrado: d.castrado || 'nao_sei',
    tipo_id: d.tipoId,
    sintomas: ou(d.sintomas),
    sintomas_duracao: ou(d.duracao),
    em_tratamento: d.emTratamento,
    medicacao: d.emTratamento ? ou(d.medicacao) : null,
    tem_condicoes: d.temCondicoes,
    condicoes: d.temCondicoes ? ou(d.condicoes) : null,
    pet_dificil: d.dificil,
    pet_comportamento: d.dificil ? ou(d.comportamento) : null,
    observacoes: ou(d.observacoes),
    opcoes: ctx.opcoes.map((o, i) => ({ prioridade: i + 1, data: o.data, hora: o.hora })),
    estimativa_total: typeof ctx.estimativaTotal === 'number' ? ctx.estimativaTotal : null,
    consentimento: true,
    fotos: Array.isArray(ctx.fotos) ? ctx.fotos : [],
    contato_site: d.honeypot || ''
  };
                  }
