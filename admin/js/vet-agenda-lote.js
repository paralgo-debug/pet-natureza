// Pet Natureza - Painel: geração de horários em lote (somente Administrador).
// Período de até 120 dias, dias da semana, lista de horários, vagas e uso;
// no máximo 600 linhas por vez. Horários que já existem são mantidos.

import { supabase } from './supabase.js';
import { toast } from './util.js';
import { esc, msgErro } from './vet-comum.js';
import { USOS_AGENDA, DIAS_SEMANA, somarDias, diaDaSemana } from './vet-calculo.js';

const MAX_LINHAS = 600;
const MAX_PERIODO = 120;
const BLOCO = 200;

const partes = (s) => /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));

export function dataValida(s) {
  const m = partes(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function diasEntre(a, b) {
  const x = partes(a);
  const y = partes(b);
  if (!x || !y) return NaN;
  return Math.round((Date.UTC(+y[1], +y[2] - 1, +y[3]) - Date.UTC(+x[1], +x[2] - 1, +x[3])) / 86400000);
}

export function htmlLote() {
  return '<details class="cartao" id="vt-lote"><summary>Gerar horários em lote</summary>' +
    '<p class="ajuda">Cria vários horários de uma vez no rascunho. Horários que já existem não são alterados. Depois, publique a agenda.</p>' +
    '<div class="vt-lote-grade">' +
      '<div class="campo"><label for="vt-lote-ini">De</label><input type="date" id="vt-lote-ini"></div>' +
      '<div class="campo"><label for="vt-lote-fim">Até</label><input type="date" id="vt-lote-fim"></div>' +
      '<fieldset class="vt-dias-semana"><legend>Dias da semana</legend>' +
        DIAS_SEMANA.map((nome, i) =>
          '<label><input type="checkbox" name="vt-lote-dia" value="' + i + '"' + (i >= 1 && i <= 5 ? ' checked' : '') +
          '> ' + esc(nome) + '</label>').join('') + '</fieldset>' +
      '<div class="campo"><label for="vt-lote-horas">Horários (HH:MM)</label>' +
        '<textarea id="vt-lote-horas" rows="3" placeholder="08:00, 09:00, 10:00"></textarea>' +
        '<p class="ajuda">Separe por vírgula, espaço ou linha.</p></div>' +
      '<div class="campo"><label for="vt-lote-vagas">Vagas por horário (1 a 20)</label>' +
        '<input type="number" id="vt-lote-vagas" min="1" max="20" step="1" value="1"></div>' +
      '<div class="campo"><label for="vt-lote-uso">Uso</label><select id="vt-lote-uso">' +
        USOS_AGENDA.map((u) => '<option value="' + u.id + '">' + esc(u.nome) + '</option>').join('') + '</select></div>' +
    '</div>' +
    '<p class="ajuda" id="vt-lote-previa" aria-live="polite"></p>' +
    '<p class="vt-campo-erro" id="vt-lote-erro" role="alert" hidden></p>' +
    '<div class="acoes"><button type="button" class="btn btn-primario" id="vt-lote-gerar">Gerar horários</button></div>' +
    '</details>';
}

export function ligarLote(raiz, { hoje, aoGerar }) {
  const q = (id) => raiz.querySelector('#' + id);
  const elIni = q('vt-lote-ini');
  const elFim = q('vt-lote-fim');
  const elHoras = q('vt-lote-horas');
  const elVagas = q('vt-lote-vagas');
  const elUso = q('vt-lote-uso');
  const elPrevia = q('vt-lote-previa');
  const elErro = q('vt-lote-erro');
  const botao = q('vt-lote-gerar');
  if (!botao) return;
  elIni.min = hoje;
  elFim.min = hoje;

  // Devolve { erro, linhas } sem tocar na tela.
  function calcular() {
    const ini = elIni.value;
    const fim = elFim.value;
    if (!dataValida(ini) || !dataValida(fim)) return { erro: 'Informe o período (de e até).', linhas: [] };
    if (ini < hoje) return { erro: 'O período não pode começar antes de hoje.', linhas: [] };
    if (fim < ini) return { erro: 'A data final deve ser igual ou depois da inicial.', linhas: [] };
    if (diasEntre(ini, fim) + 1 > MAX_PERIODO) {
      return { erro: 'O período pode ter no máximo ' + MAX_PERIODO + ' dias.', linhas: [] };
    }
    const dias = new Set(Array.from(raiz.querySelectorAll('input[name="vt-lote-dia"]:checked'), (c) => Number(c.value)));
    if (!dias.size) return { erro: 'Escolha ao menos um dia da semana.', linhas: [] };

    const fichas = elHoras.value.split(/[\s,;]+/).filter(Boolean);
    if (!fichas.length) return { erro: 'Informe ao menos um horário (exemplo: 08:00, 09:30).', linhas: [] };
    const horas = new Set();
    for (const t of fichas) {
      const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(t);
      if (!m) return { erro: 'Horário inválido: "' + t + '". Use o formato HH:MM.', linhas: [] };
      horas.add(m[1].padStart(2, '0') + ':' + m[2]);
    }

    const cap = Number(elVagas.value);
    if (!Number.isInteger(cap) || cap < 1 || cap > 20) {
      return { erro: 'As vagas devem ser um número inteiro de 1 a 20.', linhas: [] };
    }
    const uso = elUso.value;
    if (!USOS_AGENDA.some((u) => u.id === uso)) return { erro: 'Escolha o uso dos horários.', linhas: [] };

    const lista = Array.from(horas).sort();
    const linhas = [];
    for (let d = ini; d <= fim; d = somarDias(d, 1)) {
      if (!dias.has(diaDaSemana(d))) continue;
      lista.forEach((h) => linhas.push({ data: d, hora: h, capacidade: cap, uso, bloqueado: false }));
      if (linhas.length > MAX_LINHAS) break;
    }
    if (!linhas.length) return { erro: 'Nenhum dia do período combina com os dias da semana escolhidos.', linhas };
    if (linhas.length > MAX_LINHAS) {
      return { erro: 'Isso criaria mais de ' + MAX_LINHAS + ' horários. Reduza o período, os dias ou os horários.', linhas: [] };
    }
    return { erro: '', linhas };
  }

  function atualizarPrevia() {
    elErro.hidden = true;
    const r = calcular();
    elPrevia.textContent = r.erro ? '' : 'Serão criados até ' + r.linhas.length +
      (r.linhas.length === 1 ? ' horário' : ' horários') + ' (os que já existem são mantidos).';
  }
  raiz.querySelector('#vt-lote').addEventListener('input', atualizarPrevia);
  raiz.querySelector('#vt-lote').addEventListener('change', atualizarPrevia);

  botao.addEventListener('click', async () => {
    const r = calcular();
    if (r.erro) {
      elErro.textContent = r.erro;
      elErro.hidden = false;
      return;
    }
    elErro.hidden = true;
    botao.disabled = true;
    const rotulo = botao.textContent;
    botao.textContent = 'Gerando…';
    let criados = 0;
    try {
      for (let i = 0; i < r.linhas.length; i += BLOCO) {
        const { data, error } = await supabase.from('vt_slots')
          .upsert(r.linhas.slice(i, i + BLOCO), { onConflict: 'data,hora', ignoreDuplicates: true })
          .select('data');
        if (error) throw error;
        criados += Array.isArray(data) ? data.length : 0;
      }
      const jaExistiam = r.linhas.length - criados;
      toast(criados + (criados === 1 ? ' horário criado' : ' horários criados') +
        (jaExistiam > 0 ? ' (' + jaExistiam + ' já existiam)' : '') + '. Lembre-se de publicar a agenda.');
      elPrevia.textContent = '';
      await aoGerar();
    } catch (e) {
      const m = msgErro(e);
      elErro.textContent = (criados ? 'Alguns horários foram criados antes do erro. ' : '') + m;
      elErro.hidden = false;
      toast(m, 'erro');
      if (criados) await aoGerar();
    }
    botao.disabled = false;
    botao.textContent = rotulo;
  });
                              }
