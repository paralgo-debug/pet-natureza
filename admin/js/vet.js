// Pet Natureza - Painel: módulo Consulta Veterinária (#/veterinaria).
// Abas: Solicitações (padrão), Agenda, Tipos e preços.
// Cada aba é um módulo próprio: export async function viewX(alvo, ctx).

import { supabase, configurado } from './supabase.js';
import { esc } from './util.js';
import { carregarCss, abaAtual, msgErro } from './vet-comum.js';

const ABAS = [
  { id: 'solicitacoes', rotulo: 'Solicitações', carregar: () => import('./vet-solicitacoes.js'), fn: 'viewSolicitacoes' },
  { id: 'agenda', rotulo: 'Agenda', carregar: () => import('./vet-agenda.js'), fn: 'viewAgenda' },
  { id: 'precos', rotulo: 'Tipos e preços', carregar: () => import('./vet-precos.js'), fn: 'viewPrecos' }
];

export async function viewVeterinaria(alvo, ctx) {
  carregarCss('css/vet.css');

  const aba = ABAS.find((a) => a.id === abaAtual()) || ABAS[0];

  const links = ABAS.map((a) =>
    '<a class="vt-aba" href="#/veterinaria?aba=' + a.id + '"' +
    (a.id === aba.id ? ' aria-current="page"' : '') + '>' + esc(a.rotulo) + '</a>'
  ).join('');

  alvo.innerHTML =
    '<div class="vt-adm">' +
      '<div class="cab-pagina"><h1>Consulta veterinária</h1></div>' +
      '<div class="vt-metricas" id="vt-metricas" aria-live="polite" hidden></div>' +
      '<nav class="vt-abas" aria-label="Seções da consulta veterinária">' + links + '</nav>' +
      '<div id="vt-aba-corpo"><p class="carregando" role="status">Carregando…</p></div>' +
    '</div>';

  if (!configurado) {
    alvo.querySelector('#vt-aba-corpo').innerHTML =
      '<div class="cartao"><p class="erro" role="alert">O painel ainda não está conectado ao Supabase. Confira o arquivo de configuração.</p></div>';
    return;
  }

  const elMetricas = alvo.querySelector('#vt-metricas');
  let versaoMetricas = 0;

  // Atualiza os números do topo (falha em silêncio: são só um resumo).
  async function atualizarMetricas() {
    const minha = ++versaoMetricas;
    try {
      const { data, error } = await supabase.rpc('vt_metricas');
      if (error || !data || !alvo.isConnected || minha !== versaoMetricas) return;
      const n = (k) => (Number.isFinite(Number(data[k])) ? Number(data[k]) : 0);
      const item = (valor, rotulo, alerta) =>
        '<div class="vt-metrica' + (alerta ? ' vt-metrica-alerta' : '') + '">' +
        '<span class="vt-metrica-num">' + valor + '</span>' +
        '<span class="vt-metrica-rot">' + esc(rotulo) + '</span></div>';
      elMetricas.innerHTML =
        item(n('pendentes'), 'Aguardando atendimento', false) +
        item(n('urgentes_novas'), 'Urgentes em aberto', n('urgentes_novas') > 0) +
        item(n('confirmados'), 'Confirmadas', false) +
        item(n('proximos'), 'Próximos 7 dias', false);
      elMetricas.hidden = false;
    } catch (e) {
      /* mantém o que já está na tela */
    }
  }

  const ctxVet = Object.assign({}, ctx, { atualizarMetricas });
  atualizarMetricas();

  const corpo = alvo.querySelector('#vt-aba-corpo');
  try {
    const modulo = await aba.carregar();
    if (!alvo.isConnected) return;
    corpo.innerHTML = '';
    await modulo[aba.fn](corpo, ctxVet);
  } catch (e) {
    if (!alvo.isConnected) return;
    const detalhe = e && e.message && /permiss|conex|servidor/i.test(msgErro(e)) ? msgErro(e) : '';
    corpo.innerHTML =
      '<div class="cartao"><p class="erro" role="alert">Não foi possível carregar esta seção. ' +
      'Recarregue a página e tente novamente.' + (detalhe ? ' ' + esc(detalhe) : '') + '</p></div>';
  }
      }
