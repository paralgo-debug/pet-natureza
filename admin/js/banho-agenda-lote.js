// PET NATUREZA - Banho & Tosa (painel) - agenda: datas auxiliares e gerador em lote
import { supabase } from './supabase.js';
import { esc, toast } from './util.js';

// ---------------------------------------------------------------------
// Datas (trabalha com texto AAAA-MM-DD, sem depender do fuso do aparelho)
// ---------------------------------------------------------------------
const DIA_MS = 86400000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

export const dataValida = (iso) => ISO.test(String(iso || '')) && !Number.isNaN(Date.parse(iso + 'T00:00:00Z'));
const paraMs = (iso) => Date.parse(iso + 'T00:00:00Z');
const deMs = (ms) => new Date(ms).toISOString().slice(0, 10);

export function hojeISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
}
export const somarDias = (iso, n) => deMs(paraMs(iso) + n * DIA_MS);
export const diasEntre = (a, b) => Math.round((paraMs(b) - paraMs(a)) / DIA_MS);
export const diaSemana = (iso) => new Date(paraMs(iso)).getUTCDay();

// Lê horários digitados (HH:MM, separados por vírgula, ponto e vírgula ou linha)
export function lerHoras(texto) {
  const horas = [];
  const invalidas = [];
  String(texto || '').split(/[\n,;]+/).map((t) => t.trim()).filter(Boolean).forEach((t) => {
    const m = /^(\d{1,2})[:hH](\d{2})$/.exec(t);
    if (m && Number(m[1]) <= 23 && Number(m[2]) <= 59) {
      const h = String(Number(m[1])).padStart(2, '0') + ':' + m[2];
      if (!horas.includes(h)) horas.push(h);
    } else {
      invalidas.push(t);
    }
  });
  horas.sort();
  return { horas, invalidas };
}

// ---------------------------------------------------------------------
// Gerador em lote
// ---------------------------------------------------------------------
const MAX_DIAS = 120;
const MAX_LINHAS = 600;
const TAMANHO_LOTE = 200;

export function htmlLote() {
  const hoje = hojeISO();
  const dias = SEMANA.map((nome, i) =>
    '<label><input type="checkbox" name="bt-l-dia" value="' + i + '"' + (i >= 1 && i <= 6 ? ' checked' : '') + '> <span>' +
    esc(nome.slice(0, 3)) + '</span></label>').join('');
  return '<details class="cartao bt-lote"><summary>Gerar horários em lote</summary><div class="bt-lote-corpo">' +
    '<p class="ajuda">Cria vários horários de uma vez no rascunho. Horários que já existem são mantidos como estão (não são sobrescritos). Nada vai para os clientes até você publicar a agenda.</p>' +
    '<div class="bt-periodo-campos">' +
    '<div class="campo"><label for="bt-l-ini">De</label><input type="date" id="bt-l-ini" value="' + esc(hoje) + '"></div>' +
    '<div class="campo"><label for="bt-l-fim">Até (máximo de ' + MAX_DIAS + ' dias)</label><input type="date" id="bt-l-fim" value="' + esc(somarDias(hoje, 29)) + '"></div>' +
    '</div>' +
    '<fieldset class="bt-dias-sem"><legend>Dias da semana</legend><div class="bt-dias-sem-lista">' + dias + '</div></fieldset>' +
    '<div class="campo"><label for="bt-l-horas">Horários (HH:MM, separados por vírgula ou por linha)</label>' +
    '<textarea id="bt-l-horas" rows="3" placeholder="Ex.: 09:00, 10:00, 14:00"></textarea></div>' +
    '<div class="campo"><label for="bt-l-vagas">Vagas por horário (1 a 20)</label>' +
    '<input type="number" id="bt-l-vagas" min="1" max="20" step="1" inputmode="numeric" value="1"></div>' +
    '<p class="erro" id="bt-l-erro" role="alert" hidden></p>' +
    '<p class="ajuda" id="bt-l-ok" role="status" hidden></p>' +
    '<div class="acoes"><button type="button" class="btn btn-primario" id="bt-l-gerar">Gerar horários</button></div>' +
    '</div></details>';
}

export function ligarLote(alvo, aoConcluir) {
  const $ = (id) => alvo.querySelector('#' + id);
  const botao = $('bt-l-gerar');

  function erro(texto) {
    $('bt-l-erro').textContent = texto || '';
    $('bt-l-erro').hidden = !texto;
  }

  botao.addEventListener('click', async () => {
    erro('');
    $('bt-l-ok').hidden = true;

    const ini = $('bt-l-ini').value;
    const fim = $('bt-l-fim').value;
    if (!dataValida(ini) || !dataValida(fim)) return erro('Informe a data inicial e a final.');
    if (fim < ini) return erro('A data final não pode ser antes da inicial.');
    const n = diasEntre(ini, fim) + 1;
    if (n > MAX_DIAS) return erro('O período pode ter no máximo ' + MAX_DIAS + ' dias.');

    const dias = new Set(Array.from(alvo.querySelectorAll('input[name="bt-l-dia"]:checked')).map((i) => Number(i.value)));
    if (dias.size === 0) return erro('Marque pelo menos um dia da semana.');

    const { horas, invalidas } = lerHoras($('bt-l-horas').value);
    if (invalidas.length > 0) return erro('Horário inválido: ' + invalidas.slice(0, 3).join(', ') + '. Use o formato HH:MM, por exemplo 09:00.');
    if (horas.length === 0) return erro('Informe pelo menos um horário, por exemplo 09:00.');

    const vagas = Number($('bt-l-vagas').value);
    if (!Number.isInteger(vagas) || vagas < 1 || vagas > 20) return erro('Informe de 1 a 20 vagas por horário.');

    const linhas = [];
    for (let i = 0; i < n; i += 1) {
      const d = somarDias(ini, i);
      if (!dias.has(diaSemana(d))) continue;
      for (const h of horas) linhas.push({ data: d, hora: h, capacidade: vagas, bloqueado: false });
    }
    if (linhas.length === 0) return erro('Nenhum dia do período combina com os dias da semana marcados.');
    if (linhas.length > MAX_LINHAS) {
      return erro('Isso geraria ' + linhas.length + ' horários, e o máximo é ' + MAX_LINHAS + '. Reduza o período, os dias ou os horários.');
    }

    botao.disabled = true;
    botao.textContent = 'Gerando…';
    try {
      for (let i = 0; i < linhas.length; i += TAMANHO_LOTE) {
        const { error } = await supabase.from('bt_slots')
          .upsert(linhas.slice(i, i + TAMANHO_LOTE), { onConflict: 'data,hora', ignoreDuplicates: true });
        if (error) throw error;
      }
      const ok = $('bt-l-ok');
      ok.textContent = 'Pronto: ' + linhas.length + ' horário(s) processado(s) no rascunho (os que já existiam foram mantidos). ' +
        'Se não aparecerem abaixo, ajuste o período mostrado acima. Lembre-se de publicar a agenda.';
      ok.hidden = false;
      toast('Horários gerados no rascunho.');
      await aoConcluir();
    } catch (e) {
      const m = e && e.message ? String(e.message) : '';
      erro('Não foi possível gerar todos os horários. ' + (m || 'Tente novamente.') + ' Parte deles pode ter sido criada; confira a lista.');
    } finally {
      botao.disabled = false;
      botao.textContent = 'Gerar horários';
    }
  });
        }
