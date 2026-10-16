// Pet Natureza - Consulta Veterinária
// Constantes, utilidades e cálculo da estimativa.
// Compartilhado entre o painel (admin/js) e o site (../admin/js/vet-calculo.js).
// Espelha EXATAMENTE a função SQL vt_calcular. Sem dependências.

export const FUSO = 'America/Fortaleza';

export const ESPECIES = [
  { id: 'cachorro', nome: 'Cachorro' },
  { id: 'gato', nome: 'Gato' },
  { id: 'outro', nome: 'Outro' }
];

export const PORTES = [
  { id: 'mini', nome: 'Mini' },
  { id: 'pequeno', nome: 'Pequeno' },
  { id: 'medio', nome: 'Médio' },
  { id: 'grande', nome: 'Grande' },
  { id: 'gigante', nome: 'Gigante' }
];

export const SEXOS = [
  { id: 'macho', nome: 'Macho' },
  { id: 'femea', nome: 'Fêmea' },
  { id: 'nao_sei', nome: 'Não sei' }
];

export const CASTRADO = [
  { id: 'sim', nome: 'Sim' },
  { id: 'nao', nome: 'Não' },
  { id: 'nao_sei', nome: 'Não sei' }
];

export const DURACOES = [
  { id: 'hoje', nome: 'Começou hoje' },
  { id: '1_3_dias', nome: 'De 1 a 3 dias' },
  { id: '4_7_dias', nome: 'De 4 a 7 dias' },
  { id: 'mais_1_semana', nome: 'Mais de 1 semana' },
  { id: 'mais_1_mes', nome: 'Mais de 1 mês' },
  { id: 'nao_sei', nome: 'Não sei informar' }
];

export const USOS_AGENDA = [
  { id: 'geral', nome: 'Geral' },
  { id: 'retorno', nome: 'Retorno' },
  { id: 'urgencia', nome: 'Urgência' }
];

export const STATUS = [
  { id: 'novo', nome: 'Novo' },
  { id: 'em_contato', nome: 'Em contato' },
  { id: 'confirmado', nome: 'Confirmado' },
  { id: 'cancelado', nome: 'Cancelado' },
  { id: 'realizado', nome: 'Realizado' }
];

export const DIAS_SEMANA = [
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'
];
export const DIAS_SEMANA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export const TEXTOS = {
  ESTIMATIVA: 'Este é apenas um valor aproximado. O valor final será confirmado pela equipe após a avaliação.',
  HORARIO_MUDAR: 'O valor pode mudar conforme o horário confirmado.',
  SEM_ESTIMATIVA: 'O valor será informado pela equipe após a avaliação.',
  NAO_CONFIRMADO: 'Esta é uma solicitação de consulta, não um agendamento confirmado.',
  NAO_SUBSTITUI: 'As informações enviadas não substituem o exame clínico feito pelo veterinário.',
  SUCESSO: 'Em breve nós do Pet shop Pet Natureza retornaremos pelo WhatsApp para confirmar o agendamento e o valor da consulta.',
  EMERGENCIA_PADRAO: 'Em caso de emergência (por exemplo: dificuldade para respirar, convulsão, sangramento intenso, trauma grave, suspeita de envenenamento ou desmaio), não espere o retorno deste formulário. Chame a equipe agora pelo WhatsApp ou procure imediatamente um atendimento veterinário de emergência.',
  URGENCIA_BLOQUEADA: 'Em caso de emergência, chame a equipe agora pelo WhatsApp.'
};

// Configuração padrão (igual ao seed do banco).
export function configPadrao() {
  const t = (id, nome, agenda, exige, estimar) => ({
    id, nome, ativo: true, preco_base: null,
    exige_sintomas: exige, estimar, agenda
  });
  return {
    tipos: [
      t('checkup', 'Check-up', 'geral', false, true),
      t('vacina', 'Vacina', 'geral', false, true),
      t('consulta_clinica', 'Consulta clínica', 'geral', true, true),
      t('retorno', 'Retorno', 'retorno', false, true),
      t('urgencia', 'Emergência ou urgência', 'urgencia', true, false),
      t('cirurgia', 'Consulta relacionada a cirurgia', 'geral', false, true),
      t('outros', 'Outros motivos', 'geral', true, true)
    ],
    precos: {
      especie_adicional: { cachorro: null, gato: null, outro: null },
      porte_adicional: { mini: null, pequeno: null, medio: null, grande: null, gigante: null },
      peso_faixas: [],
      manejo_dificil: null,
      horario_especial: []
    },
    antecedencia_horas: 12,
    janela_dias: 30,
    aviso_emergencia: TEXTOS.EMERGENCIA_PADRAO,
    permitir_urgencia_online: true
  };
}

// ---------- Utilidades ----------
export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Merge próprio: base define os padrões; extra vence quando definido (null vale).
// Listas de extra substituem as da base. Padrão null aceita objeto de extra.
export function mesclar(base, extra) {
  if (extra === undefined) return clone(base);
  if (Array.isArray(extra)) return clone(extra);
  if (ehObjeto(extra)) {
    if (!ehObjeto(base)) return clone(extra);
    const saida = {};
    const chaves = new Set([...Object.keys(base), ...Object.keys(extra)]);
    chaves.forEach((k) => { saida[k] = mesclar(base[k], extra[k]); });
    return saida;
  }
  return extra;
}

export function mesclarConfig(cfg) {
  return mesclar(configPadrao(), ehObjeto(cfg) ? cfg : {});
}

// Aceita vírgula. "" -> null; inválido -> NaN. Ex.: "1.234,50" -> 1234.5
export function parseNumero(texto) {
  let s = String(texto ?? '').trim().replace(/\s/g, '');
  if (s === '') return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

export function normalizarWhatsApp(v) {
  const d = String(v ?? '').replace(/\D/g, '');
  if (/^\d{10,11}$/.test(d)) return '55' + d;
  if (/^55\d{10,11}$/.test(d)) return d;
  return null;
}

export function formatarTelefone(digitos) {
  let d = String(digitos ?? '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length > 11) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function moeda(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

export function horaCurta(h) {
  return String(h ?? '').slice(0, 5);
}

export function dataBR(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export function diaDaSemana(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return -1;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
}

export function dataCurta(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return '';
  return `${DIAS_SEMANA_CURTO[diaDaSemana(iso)]}, ${m[3]}/${m[2]}`;
}

export function somarDias(iso, dias) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + dias));
  return d.toISOString().slice(0, 10);
}

// Data e hora de agora no fuso de Fortaleza: { data: 'AAAA-MM-DD', hora: 'HH:MM' }
export function agoraFortaleza() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const p = {};
  partes.forEach((x) => { p[x.type] = x.value; });
  const hh = p.hour === '24' ? '00' : p.hour;
  return { data: `${p.year}-${p.month}-${p.day}`, hora: `${hh}:${p.minute}` };
}

// Identificador estável a partir do nome (a-z0-9_), sem acentos.
export function gerarSlug(nome) {
  let s = String(nome ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  if (s.length < 2) s = 'motivo';
  return s;
}

export function uuid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---------- Cálculo (espelha vt_calcular) ----------
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const HORA_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

// entrada: { tipoId, especie, porte, peso, dificil, data:'AAAA-MM-DD', hora:'HH:MM' }
// Retorno: { total:number|null, itens:[{rotulo,valor}], motivo, horarioEspecial }
// motivo: null | 'falta_dados' | 'sem_estimativa' | 'sem_preco'
export function calcular(cfg, entrada) {
  const e = entrada || {};
  const vazio = (motivo) => ({ total: null, itens: [], motivo, horarioEspecial: false });

  const tipos = Array.isArray(cfg && cfg.tipos) ? cfg.tipos : [];
  const tipo = tipos.find((t) => t && t.id === e.tipoId);
  if (!tipo || !ESPECIES.some((x) => x.id === e.especie)) return vazio('falta_dados');
  if (tipo.estimar === false) return vazio('sem_estimativa');
  const base = num(tipo.preco_base);
  if (base === null) return vazio('sem_preco');

  const precos = (cfg && cfg.precos) || {};
  const itens = [];
  let centavos = 0;
  const somar = (rotulo, valor, sempre) => {
    const v = r2(valor);
    if (v > 0 || sempre) {
      centavos += Math.round(v * 100);
      itens.push({ rotulo, valor: v });
    }
  };

  somar('Valor base: ' + (typeof tipo.nome === 'string' && tipo.nome.trim() ? tipo.nome.trim() : e.tipoId), base, true);

  const ad = (precos.especie_adicional || {})[e.especie];
  somar('Adicional por espécie', num(ad) ?? 0);

  if (PORTES.some((x) => x.id === e.porte)) {
    somar('Adicional por porte', num((precos.porte_adicional || {})[e.porte]) ?? 0);
  }

  // Peso: só a MAIOR faixa ultrapassada (não acumula)
  if (num(e.peso) !== null && Array.isArray(precos.peso_faixas)) {
    let melhor = null;
    let melhorVal = 0;
    precos.peso_faixas.forEach((f) => {
      const lim = num(f && f.acima_de_kg);
      if (lim !== null && e.peso > lim && (melhor === null || lim > melhor)) {
        melhor = lim;
        melhorVal = num(f.adicional) ?? 0;
      }
    });
    somar('Adicional por peso', melhorVal);
  }

  if (e.dificil) somar('Manejo especial', num(precos.manejo_dificil) ?? 0);

  // Horário especial pela 1ª opção: vale a PRIMEIRA regra que casa
  let horarioEspecial = false;
  const dataOk = /^\d{4}-\d{2}-\d{2}$/.test(String(e.data ?? ''));
  const hora = horaCurta(e.hora);
  if (dataOk && HORA_RE.test(hora) && Array.isArray(precos.horario_especial)) {
    const dow = diaDaSemana(e.data);
    for (const r of precos.horario_especial) {
      if (!r || !Array.isArray(r.dias)) continue;
      const casa = r.dias.some((d) => typeof d === 'number' && d === dow)
        && typeof r.de === 'string' && HORA_RE.test(r.de)
        && typeof r.ate === 'string' && HORA_RE.test(r.ate)
        && hora >= r.de && hora < r.ate;
      if (casa) {
        const v = r2(num(r.adicional) ?? 0);
        if (v > 0) {
          centavos += Math.round(v * 100);
          horarioEspecial = true;
          const rot = typeof r.rotulo === 'string' && r.rotulo.trim() ? r.rotulo.trim() : 'Adicional de horário';
          itens.push({ rotulo: rot, valor: v });
        }
        break;
      }
    }
  }

  return { total: r2(centavos / 100), itens, motivo: null, horarioEspecial };
}

// Texto para quando não há valor: explica o que falta ou que a equipe informará.
export function descreverSemValor(res, entrada) {
  if (!res || res.motivo === null) return '';
  if (res.motivo === 'falta_dados') {
    const falta = [];
    const e = entrada || {};
    if (!e.tipoId) falta.push('o motivo da consulta');
    if (!ESPECIES.some((x) => x.id === e.especie)) falta.push('a espécie do pet');
    if (falta.length === 0) return TEXTOS.SEM_ESTIMATIVA;
    return 'Para ver o valor aproximado, informe ' + falta.join(' e ') + '.';
  }
  return TEXTOS.SEM_ESTIMATIVA;
    }
