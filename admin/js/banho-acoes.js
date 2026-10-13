// PET NATUREZA - Banho & Tosa (painel) - ações do cartão: status, notas e foto
import { supabase } from './supabase.js';
import { toast, confirmar } from './util.js';

export function msgErro(e) {
  const m = e && e.message ? String(e.message).trim() : '';
  if (/failed to fetch|network|load failed/i.test(m)) return 'Falha de conexão. Verifique a internet e tente de novo.';
  return m || 'Não foi possível concluir a ação.';
}

// Retorna true se o status foi alterado
export async function alterarStatus(card) {
  const id = card.dataset.id;
  const status = card.querySelector('[data-campo="status"]').value;
  const detalhe = card.querySelector('[data-campo="detalhe"]').value.trim();
  let data = null;
  let hora = null;

  if (status === 'confirmado') {
    const marcado = card.querySelector('input[data-conf]:checked');
    let v = marcado ? marcado.value : '';
    if (v === 'outro') v = card.querySelector('[data-campo="outro"]').value;
    const m = /^(\d{4}-\d{2}-\d{2})\|(\d{2}:\d{2})$/.exec(v);
    if (!m) {
      toast('Escolha o horário do agendamento.', 'erro');
      return false;
    }
    data = m[1];
    hora = m[2];
  }

  if (status === 'cancelado') {
    const msg = card.dataset.final
      ? 'Cancelar esta solicitação? O horário confirmado será liberado.'
      : 'Cancelar esta solicitação?';
    if (!(await confirmar(msg, 'Cancelar solicitação'))) return false;
  } else if (card.dataset.final && status !== 'confirmado' && status !== 'realizado') {
    if (!(await confirmar('Mudar o status vai liberar o horário já confirmado. Continuar?', 'Continuar'))) return false;
  }

  const { error } = await supabase.rpc('bt_alterar_status', {
    p_id: id, p_status: status, p_data: data, p_hora: hora, p_detalhe: detalhe || null
  });
  if (error) {
    toast(msgErro(error), 'erro');
    return false;
  }
  toast('Status atualizado.');
  return true;
}

export async function adicionarNota(card, userId) {
  const campo = card.querySelector('[data-campo="nota"]');
  const texto = campo.value.trim();
  if (!texto) {
    toast('Escreva a nota antes de adicionar.', 'erro');
    campo.focus();
    return false;
  }
  const { error } = await supabase.from('bt_notas').insert({
    solicitacao_id: card.dataset.id, autor: userId, texto
  });
  if (error) {
    toast(msgErro(error), 'erro');
    return false;
  }
  toast('Nota adicionada.');
  return true;
}

export async function verFoto(botao) {
  const area = botao.closest('.bt-bloco').querySelector('[data-foto-area]');
  const { data, error } = await supabase.storage.from('banho-fotos').createSignedUrl(botao.dataset.foto, 300);
  if (error || !data || !data.signedUrl) {
    toast('Não foi possível abrir a foto. Ela pode não ter sido enviada.', 'erro');
    return;
  }
  const img = document.createElement('img');
  img.className = 'bt-foto-img';
  img.alt = 'Foto do pet enviada pelo cliente';
  img.src = data.signedUrl;
  area.replaceChildren(img);
      }
