// Pet Natureza - Painel: simulador de valor aproximado.
// Usa as regras que estão na tela (mesmo calcular() do site). Não rouba o foco.

import { esc } from './vet-comum.js';
import { calcular, descreverSemValor, moeda, parseNumero, ESPECIES, PORTES, TEXTOS } from './vet-calculo.js';

export function htmlSimulador() {
  return '<p class="ajuda">Teste o cálculo com as regras digitadas, mesmo antes de salvar. Nada daqui é enviado ou gravado.</p>' +
    '<div class="vt-grade-campos">' +
      '<div class="campo"><label for="vt-sim-tipo">Motivo</label><select id="vt-sim-tipo"></select></div>' +
      '<div class="campo"><label for="vt-sim-especie">Espécie</label><select id="vt-sim-especie">' +
        ESPECIES.map((e) => '<option value="' + e.id + '">' + esc(e.nome) + '</option>').join('') + '</select></div>' +
      '<div class="campo"><label for="vt-sim-porte">Porte</label><select id="vt-sim-porte"><option value="">Não informado</option>' +
        PORTES.map((e) => '<option value="' + e.id + '">' + esc(e.nome) + '</option>').join('') + '</select></div>' +
      '<div class="campo"><label for="vt-sim-peso">Peso (kg)</label>' +
        '<input type="text" id="vt-sim-peso" inputmode="decimal" autocomplete="off" aria-describedby="vt-sim-peso-erro">' +
        '<p class="vt-campo-erro" id="vt-sim-peso-erro" hidden></p></div>' +
      '<div class="campo"><label for="vt-sim-data">Data da 1ª opção</label><input type="date" id="vt-sim-data"></div>' +
      '<div class="campo"><label for="vt-sim-hora">Horário da 1ª opção</label><input type="time" step="60" id="vt-sim-hora"></div>' +
      '<div class="campo"><label for="vt-sim-dificil"><input type="checkbox" id="vt-sim-dificil"> Pet agressivo ou difícil</label></div>' +
    '</div>' +
    '<div class="vt-sim" id="vt-sim-saida" aria-live="polite" aria-atomic="true"></div>';
}

export function ligarSimulador(raiz, obterCfg) {
  const q = (id) => raiz.querySelector('#' + id);
  const selTipo = q('vt-sim-tipo');
  const saida = q('vt-sim-saida');
  let ultimo = null;

  function motivos() {
    const atual = selTipo.value;
    const tipos = (obterCfg().tipos || []).filter((t) => t && t.id);
    selTipo.innerHTML = tipos.map((t) =>
      '<option value="' + esc(t.id) + '">' + esc(t.nome || t.id) + (t.ativo === true ? '' : ' (indisponível)') + '</option>'
    ).join('');
    selTipo.value = tipos.some((t) => t.id === atual) ? atual : (tipos[0] ? tipos[0].id : '');
  }

  function atualizar() {
    let peso = parseNumero(q('vt-sim-peso').value);
    const erroPeso = q('vt-sim-peso-erro');
    if (Number.isNaN(peso)) {
      erroPeso.textContent = 'Use apenas números (exemplo: 8,5).';
      erroPeso.hidden = false;
      peso = null;
    } else {
      erroPeso.hidden = true;
    }
    const entrada = {
      tipoId: selTipo.value || null,
      especie: q('vt-sim-especie').value || null,
      porte: q('vt-sim-porte').value || null,
      peso,
      dificil: q('vt-sim-dificil').checked,
      data: q('vt-sim-data').value || null,
      hora: q('vt-sim-hora').value || null
    };
    const res = calcular(obterCfg(), entrada);

    let html;
    if (res.total === null) {
      html = '<p>' + esc(descreverSemValor(res, entrada)) + '</p>';
    } else {
      html = '<p class="vt-sim-total">' + esc(moeda(res.total)) + '</p><ul class="vt-sim-itens">' +
        res.itens.map((i) => '<li><span>' + esc(i.rotulo) + '</span><span>' + esc(moeda(i.valor)) + '</span></li>').join('') +
        '</ul><p class="vt-sim-aviso">' + esc(TEXTOS.ESTIMATIVA) + '</p>' +
        (res.horarioEspecial ? '<p class="vt-sim-aviso">' + esc(TEXTOS.HORARIO_MUDAR) + '</p>' : '');
    }
    if (html !== ultimo) {
      saida.innerHTML = html;
      ultimo = html;
    }
  }

  raiz.addEventListener('input', atualizar);
  raiz.addEventListener('change', atualizar);
  motivos();
  atualizar();
  return { motivos, atualizar };
      }
