// PET NATUREZA - Banho & Tosa (site) - resumo da revisão/sucesso e texto do WhatsApp
import { el } from './banho-util.js';
import { ESPECIES, PORTES, PELAGENS, AVISO_ESTIMATIVA, brl, explicarSemEstimativa, rotuloDe } from '../admin/js/banho-calculo.js';
import { formatarTelefoneBR } from './banho-layout.js';

function linha(dl, titulo, valores) {
  const dd = el('dd');
  valores.forEach((t, i) => {
    if (i > 0) dd.append(document.createElement('br'));
    dd.append(typeof t === 'string' ? document.createTextNode(t) : t);
  });
  dl.append(el('div', {}, [el('dt', { texto: titulo }), dd]));
}

// d = { v, servicos: [nomes], opcoes, est, fotoUrl, descrever }
// completo = true na revisão (inclui contato, saúde, observações e foto)
export function preencherResumo(dl, d, completo) {
  dl.replaceChildren();
  const v = d.v;

  if (completo) linha(dl, 'Contato', [v.nome, formatarTelefoneBR(v.whatsapp)]);

  const pet = ['Nome: ' + v.pet_nome, 'Espécie: ' + rotuloDe(ESPECIES, v.especie)];
  if (v.raca) pet.push('Raça: ' + v.raca);
  if (completo && v.idade) pet.push('Idade: ' + v.idade);
  if (Number.isFinite(v.peso) && v.peso !== null) pet.push('Peso: ' + String(v.peso).replace('.', ',') + ' kg');
  if (v.porte) pet.push('Porte: ' + rotuloDe(PORTES, v.porte));
  if (v.pelagem) pet.push('Pelagem: ' + rotuloDe(PELAGENS, v.pelagem));
  if (completo) {
    pet.push('Agressivo ou difícil de manejar: ' + (v.dificil ? 'Sim' : 'Não'));
    if (v.dificil && v.comportamento) pet.push('Comportamento: ' + v.comportamento);
    pet.push('Doença, alergia ou restrição: ' + (v.temRestricao ? 'Sim. ' + v.restricao : 'Não'));
  }
  linha(dl, 'Pet', pet);

  linha(dl, 'Serviços', d.servicos);
  if (completo && v.obs) linha(dl, 'Observações', [v.obs]);

  linha(dl, 'Opções de data e horário', d.opcoes.map((o, i) => (i + 1) + 'ª opção: ' + d.descrever(o)));

  const valor = d.est && d.est.ok ? [brl(d.est.total)] : [explicarSemEstimativa(d.est)];
  valor.push(AVISO_ESTIMATIVA);
  linha(dl, 'Valor aproximado', valor);

  if (completo) {
    if (d.fotoUrl) {
      const caixa = el('div', { class: 'bt-foto-previa' }, [
        el('img', { src: d.fotoUrl, alt: 'Foto do pet que será enviada', width: '260', height: '260' })
      ]);
      linha(dl, 'Foto', [caixa]);
    } else {
      linha(dl, 'Foto', ['Sem foto']);
    }
  }
}

// Mensagem pré-formatada para o WhatsApp (sem dados de saúde)
export function textoWhatsApp(d, protocolo) {
  const v = d.v;
  const linhas = [
    'Olá! Acabei de enviar uma solicitação de Banho & Tosa pelo site.',
    'Solicitação: ' + protocolo,
    'Tutor: ' + v.nome,
    'Pet: ' + v.pet_nome,
    'Serviços: ' + d.servicos.join(', '),
    'Opções de horário:'
  ];
  d.opcoes.forEach((o, i) => linhas.push((i + 1) + 'ª opção: ' + d.descrever(o)));
  if (d.est && d.est.ok) linhas.push('Valor aproximado: ' + brl(d.est.total) + ' (a confirmar pela equipe)');
  return linhas.join('\n');
    }
