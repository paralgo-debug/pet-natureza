// Pet Natureza - Painel: Formas de pagamento (rota #/pagamentos) - somente Administrador
import { supabase } from './supabase.js';
import { esc, toast, confirmar } from './util.js';
import { msgErro, carregarCss } from './loja-util.js';

export async function viewPagamentos(alvo, ctx) {
  carregarCss();
  if (!ctx.ehAdmin) {
    alvo.innerHTML = '<div class="cab-pagina"><h1>Formas de pagamento</h1></div><div class="cartao"><p class="erro" role="alert">Só o Administrador pode alterar as formas de pagamento.</p></div>';
    return;
  }
  let formas = [];
  let usos = new Map();
  let editando = null;

  alvo.innerHTML = `
    <div class="cab-pagina"><h1>Formas de pagamento</h1>
      <p class="suave">A loja não cobra online: o cliente escolhe a forma e o pagamento é combinado na entrega, na retirada ou pelo WhatsApp.</p></div>
    <p class="lj-aviso-loja" role="note">Alterações aqui valem na hora na loja e não mudam pedidos já feitos, que guardam a forma escolhida na época.</p>
    <p class="lj-aviso-loja" id="lj-fp-aviso" role="alert" hidden></p>
    <div class="acoes"><button type="button" class="btn btn-primario" id="lj-fp-novo">Nova forma de pagamento</button></div>
    <div id="lj-fp-form"></div>
    <div id="lj-fp-lista"><p class="carregando">Carregando formas de pagamento…</p></div>`;
  const aviso = alvo.querySelector('#lj-fp-aviso');
  const formEl = alvo.querySelector('#lj-fp-form');
  const listaEl = alvo.querySelector('#lj-fp-lista');

  function atualizarAviso() {
    const sem = !formas.some((f) => f.ativa);
    aviso.hidden = !sem;
    if (sem) aviso.textContent = 'Atenção: sem nenhuma forma de pagamento ativa, o cliente não consegue finalizar o pedido no site. Ele será orientado a falar pelo WhatsApp.';
  }

  function desenharLista(foco) {
    if (!formas.length) {
      listaEl.innerHTML = '<p class="lj-vazio">Nenhuma forma de pagamento cadastrada ainda. Crie a primeira.</p>';
      return;
    }
    listaEl.innerHTML = `<ul class="lj-cards">${formas.map((f, i) => {
      const n = usos.get(f.id) || 0;
      const nome = esc(f.nome);
      return `<li class="lj-item sem-mini" data-id="${esc(f.id)}">
        <div>
          <div class="lj-item-topo"><p class="lj-item-nome">${nome}</p>
            <span class="lj-tag ${f.ativa ? 'lj-tag-ok' : 'lj-tag-neutro'}">${f.ativa ? 'Ativa' : 'Desativada'}</span></div>
          <p class="lj-item-meta">${f.instrucoes ? `${esc(f.instrucoes)} · ` : ''}${n ? `usada em ${n} ${n === 1 ? 'pedido' : 'pedidos'}` : 'nunca usada'}</p>
        </div>
        <div class="lj-item-acoes">
          <button type="button" class="btn btn-pequeno" data-acao="editar" aria-label="Editar ${nome}">Editar</button>
          <span class="lj-ordem-btns">
            <button type="button" class="btn btn-pequeno" data-acao="sobe" aria-label="Mover ${nome} para cima"${i === 0 ? ' disabled' : ''}>&uarr;</button>
            <button type="button" class="btn btn-pequeno" data-acao="desce" aria-label="Mover ${nome} para baixo"${i === formas.length - 1 ? ' disabled' : ''}>&darr;</button>
          </span>
          <button type="button" class="btn btn-pequeno" data-acao="ativa">${f.ativa ? 'Desativar' : 'Ativar'}<span class="lj-so-leitor"> ${nome}</span></button>
          <button type="button" class="btn btn-pequeno btn-perigo" data-acao="excluir">Excluir<span class="lj-so-leitor"> ${nome}</span></button>
        </div></li>`;
    }).join('')}</ul>`;
    if (foco) {
      const li = listaEl.querySelector(`[data-id="${foco.id}"]`);
      const b = li && li.querySelector(`[data-acao="${foco.acao}"]`);
      const alt = li && li.querySelector('[data-acao="editar"]');
      const el = b && !b.disabled ? b : alt;
      if (el) el.focus();
    }
  }

  async function carregar(foco) {
    const { data, error } = await supabase.from('lj_formas_pagamento').select('*').order('ordem').order('nome');
    if (error) { listaEl.innerHTML = `<p class="erro" role="alert">${esc(msgErro(error))}</p>`; return; }
    formas = data || [];
    const c = await Promise.all(formas.map((f) => supabase.from('lj_pedidos')
      .select('id', { count: 'exact', head: true }).eq('forma_pagamento_id', f.id)));
    usos = new Map(formas.map((f, i) => [f.id, c[i].count || 0]));
    desenharLista(foco);
    atualizarAviso();
  }

  function desenharForm() {
    if (!editando) { formEl.innerHTML = ''; return; }
    const novo = editando === 'novo';
    const f0 = novo ? { nome: '', instrucoes: '', ativa: true } : editando;
    formEl.innerHTML = `<form class="cartao" id="lj-fp-f" novalidate>
      <h2>${novo ? 'Nova forma de pagamento' : 'Editar forma de pagamento'}</h2>
      <p class="erro" id="lj-fp-erro" role="alert" hidden></p>
      <div class="lj-grade-form">
        <div class="campo"><label for="lj-fp-nome">Nome</label><input id="lj-fp-nome" maxlength="60" value="${esc(f0.nome)}" aria-required="true"></div>
        <label class="lj-linha-check"><input type="checkbox" id="lj-fp-ativa"${f0.ativa ? ' checked' : ''}> Forma ativa (aparece no checkout)</label>
        <div class="campo lj-col-2"><label for="lj-fp-instr">Instruções para o cliente (opcional, até 300 caracteres)</label>
          <textarea id="lj-fp-instr" maxlength="300">${esc(f0.instrucoes || '')}</textarea>
          <p class="ajuda">Aparece junto da opção no checkout, por exemplo como e quando o pagamento será feito.</p></div>
      </div>
      <div class="lj-acoes-fixas"><button type="submit" class="btn btn-primario" id="lj-fp-salvar">Salvar</button>
        <button type="button" class="btn" id="lj-fp-cancelar">Cancelar</button></div></form>`;
    const f = (id) => formEl.querySelector(`#${id}`);
    f('lj-fp-cancelar').addEventListener('click', () => { editando = null; desenharForm(); });
    formEl.querySelector('#lj-fp-f').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const erroEl = f('lj-fp-erro');
      erroEl.hidden = true;
      const nome = f('lj-fp-nome').value.trim();
      if (!nome) { erroEl.textContent = 'Informe o nome da forma de pagamento.'; erroEl.hidden = false; f('lj-fp-nome').focus(); return; }
      const dados = { nome, instrucoes: f('lj-fp-instr').value.trim() || null, ativa: f('lj-fp-ativa').checked };
      const btn = f('lj-fp-salvar');
      btn.disabled = true;
      try {
        if (novo) {
          const ordem = formas.length ? Math.max(...formas.map((x) => Number(x.ordem) || 0)) + 1 : 1;
          const r = await supabase.from('lj_formas_pagamento').insert({ ...dados, ordem });
          if (r.error) throw r.error;
          toast('Forma de pagamento criada.');
        } else {
          const r = await supabase.from('lj_formas_pagamento').update(dados).eq('id', f0.id);
          if (r.error) throw r.error;
          toast('Forma de pagamento salva.');
        }
        editando = null;
        desenharForm();
        await carregar();
      } catch (e) {
        erroEl.textContent = msgErro(e);
        erroEl.hidden = false;
      } finally { btn.disabled = false; }
    });
    f('lj-fp-nome').focus();
  }

  async function mover(i, j, id, acao) {
    if (j < 0 || j >= formas.length) return;
    const novo = formas.slice();
    [novo[i], novo[j]] = [novo[j], novo[i]];
    const r = await Promise.all(novo.map((f, k) => (Number(f.ordem) === k ? null
      : supabase.from('lj_formas_pagamento').update({ ordem: k }).eq('id', f.id))).filter(Boolean));
    const falha = r.find((x) => x.error);
    if (falha) { toast(msgErro(falha.error), 'erro'); return; }
    await carregar({ id, acao });
  }

  alvo.querySelector('#lj-fp-novo').addEventListener('click', () => { editando = 'novo'; desenharForm(); });

  listaEl.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-acao]');
    const li = b && b.closest('[data-id]');
    if (!li || b.disabled) return;
    const i = formas.findIndex((x) => x.id === li.dataset.id);
    if (i < 0) return;
    const f = formas[i];
    const n = usos.get(f.id) || 0;
    const acao = b.dataset.acao;
    if (acao === 'editar') { editando = f; desenharForm(); return; }
    b.disabled = true;
    try {
      if (acao === 'sobe') await mover(i, i - 1, f.id, 'sobe');
      else if (acao === 'desce') await mover(i, i + 1, f.id, 'desce');
      else if (acao === 'ativa') {
        const r = await supabase.from('lj_formas_pagamento').update({ ativa: !f.ativa }).eq('id', f.id);
        if (r.error) { toast(msgErro(r.error), 'erro'); return; }
        toast(f.ativa ? 'Forma de pagamento desativada.' : 'Forma de pagamento ativada.');
        await carregar({ id: f.id, acao: 'ativa' });
      } else if (acao === 'excluir') {
        if (n > 0) { toast(`"${f.nome}" já foi usada em ${n} pedido(s) e não pode ser excluída. Desative-a.`, 'erro'); return; }
        if (!await confirmar(`Excluir "${f.nome}"? Isso não pode ser desfeito.`, 'Excluir')) return;
        const r = await supabase.from('lj_formas_pagamento').delete().eq('id', f.id);
        if (r.error) { toast(msgErro(r.error), 'erro'); return; }
        toast('Forma de pagamento excluída.');
        await carregar();
      }
    } finally { b.disabled = false; }
  });

  await carregar();
    }
