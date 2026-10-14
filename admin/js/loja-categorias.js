// Pet Natureza - Painel: aba Categorias (somente Administrador)
import { supabase } from './supabase.js';
import { esc, toast, confirmar } from './util.js';
import { slugify, msgErro } from './loja-util.js';

export async function viewCategorias(alvo, ctx) {
  if (!ctx.ehAdmin) {
    alvo.innerHTML = '<div class="cartao"><p class="erro" role="alert">Só o Administrador pode editar categorias.</p></div>';
    return;
  }
  let cats = [];
  let contagem = new Map();
  let editando = null; // null | 'novo' | objeto da categoria

  alvo.innerHTML = `
    <p class="lj-aviso-loja" role="note">Alterações em categorias valem na hora na loja e não mudam pedidos já feitos.</p>
    <div class="acoes"><button type="button" class="btn btn-primario" id="lj-c-novo">Nova categoria</button></div>
    <div id="lj-c-form"></div>
    <div id="lj-c-lista"><p class="carregando">Carregando categorias…</p></div>`;
  const formEl = alvo.querySelector('#lj-c-form');
  const listaEl = alvo.querySelector('#lj-c-lista');

  function desenharLista(foco) {
    if (!cats.length) {
      listaEl.innerHTML = '<p class="lj-vazio">Nenhuma categoria ainda. Crie a primeira.</p>';
      return;
    }
    listaEl.innerHTML = `<ul class="lj-cards">${cats.map((c, i) => {
      const n = contagem.get(c.id) || 0;
      const nome = esc(c.nome);
      return `<li class="lj-item sem-mini" data-id="${esc(c.id)}">
        <div>
          <div class="lj-item-topo"><p class="lj-item-nome"><span aria-hidden="true">${esc(c.emoji || '')}</span> ${nome}</p>
            <span class="lj-tag ${c.ativo ? 'lj-tag-ok' : 'lj-tag-neutro'}">${c.ativo ? 'Ativa' : 'Desativada'}</span></div>
          <p class="lj-item-meta">Endereço: ${esc(c.slug)} · ${n} ${n === 1 ? 'produto' : 'produtos'}</p>
        </div>
        <div class="lj-item-acoes">
          <button type="button" class="btn btn-pequeno" data-acao="editar" aria-label="Editar ${nome}">Editar</button>
          <span class="lj-ordem-btns">
            <button type="button" class="btn btn-pequeno" data-acao="sobe" aria-label="Mover ${nome} para cima"${i === 0 ? ' disabled' : ''}>&uarr;</button>
            <button type="button" class="btn btn-pequeno" data-acao="desce" aria-label="Mover ${nome} para baixo"${i === cats.length - 1 ? ' disabled' : ''}>&darr;</button>
          </span>
          <button type="button" class="btn btn-pequeno" data-acao="ativo">${c.ativo ? 'Desativar' : 'Ativar'}<span class="lj-so-leitor"> ${nome}</span></button>
          <button type="button" class="btn btn-pequeno btn-perigo" data-acao="excluir">Excluir<span class="lj-so-leitor"> ${nome}</span></button>
        </div></li>`;
    }).join('')}</ul>`;
    if (foco) {
      const li = listaEl.querySelector(`[data-id="${foco.id}"]`);
      const b = li && li.querySelector(`[data-acao="${foco.acao}"]`);
      const alt = li && li.querySelector('[data-acao="editar"]');
      const alvoFoco = b && !b.disabled ? b : alt;
      if (alvoFoco) alvoFoco.focus();
    }
  }

  async function carregar(foco) {
    const { data, error } = await supabase.from('lj_categorias').select('*').order('ordem').order('nome');
    if (error) {
      listaEl.innerHTML = `<p class="erro" role="alert">${esc(msgErro(error))}</p>`;
      return;
    }
    cats = data || [];
    const r = await Promise.all(cats.map((c) => supabase.from('lj_produtos')
      .select('id', { count: 'exact', head: true }).eq('categoria_id', c.id)));
    contagem = new Map(cats.map((c, i) => [c.id, r[i].count || 0]));
    desenharLista(foco);
  }

  function desenharForm() {
    if (!editando) { formEl.innerHTML = ''; return; }
    const novo = editando === 'novo';
    const c = novo ? { nome: '', slug: '', emoji: '', ativo: true } : editando;
    formEl.innerHTML = `<form class="cartao" id="lj-c-f" novalidate>
      <h2>${novo ? 'Nova categoria' : 'Editar categoria'}</h2>
      <p class="erro" id="lj-c-erro" role="alert" hidden></p>
      <div class="lj-grade-form">
        <div class="campo"><label for="lj-c-nome">Nome</label>
          <input id="lj-c-nome" maxlength="60" value="${esc(c.nome)}" aria-required="true"></div>
        <div class="campo"><label for="lj-c-slug">Endereço (slug)</label>
          <input id="lj-c-slug" maxlength="80" autocomplete="off" value="${esc(c.slug)}">
          <p class="ajuda">Usado no link do filtro da loja. Só letras minúsculas, números e hífen.</p></div>
        <div class="campo"><label for="lj-c-emoji">Emoji</label>
          <input id="lj-c-emoji" maxlength="8" autocomplete="off" value="${esc(c.emoji || '')}">
          <p class="ajuda">Aparece nos filtros e como imagem de reserva dos produtos.</p></div>
        <label class="lj-linha-check"><input type="checkbox" id="lj-c-ativo"${c.ativo ? ' checked' : ''}> Categoria ativa (aparece na loja)</label>
      </div>
      <div class="lj-acoes-fixas">
        <button type="submit" class="btn btn-primario" id="lj-c-salvar">Salvar</button>
        <button type="button" class="btn" id="lj-c-cancelar">Cancelar</button>
      </div></form>`;
    const f = (id) => formEl.querySelector(`#${id}`);
    let tocado = !novo;
    f('lj-c-nome').addEventListener('input', () => { if (!tocado) f('lj-c-slug').value = slugify(f('lj-c-nome').value, 80); });
    f('lj-c-slug').addEventListener('input', () => { tocado = true; });
    f('lj-c-slug').addEventListener('blur', () => { f('lj-c-slug').value = slugify(f('lj-c-slug').value, 80); });
    f('lj-c-cancelar').addEventListener('click', () => { editando = null; desenharForm(); });
    formEl.querySelector('#lj-c-f').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const erroEl = f('lj-c-erro');
      const falha = (msg, campo) => { erroEl.textContent = msg; erroEl.hidden = false; f(campo).focus(); };
      erroEl.hidden = true;
      const nome = f('lj-c-nome').value.trim();
      const slug = slugify(f('lj-c-slug').value || nome, 80);
      const emoji = f('lj-c-emoji').value.trim();
      if (!nome) { falha('Informe o nome da categoria.', 'lj-c-nome'); return; }
      if (!slug) { falha('Informe o endereço (slug) da categoria.', 'lj-c-slug'); return; }
      if (Array.from(emoji).length > 4) { falha('O emoji pode ter no máximo 4 caracteres.', 'lj-c-emoji'); return; }
      const dados = { nome, slug, emoji: emoji || null, ativo: f('lj-c-ativo').checked };
      const btn = f('lj-c-salvar');
      btn.disabled = true;
      try {
        if (novo) {
          const ordem = cats.length ? Math.max(...cats.map((x) => Number(x.ordem) || 0)) + 1 : 1;
          const r = await supabase.from('lj_categorias').insert({ ...dados, ordem });
          if (r.error) throw r.error;
          toast('Categoria criada.');
        } else {
          const r = await supabase.from('lj_categorias').update(dados).eq('id', c.id);
          if (r.error) throw r.error;
          toast('Categoria salva.');
        }
        editando = null;
        desenharForm();
        await carregar();
      } catch (e) {
        erroEl.textContent = msgErro(e);
        erroEl.hidden = false;
      } finally { btn.disabled = false; }
    });
    f('lj-c-nome').focus();
  }

  async function mover(i, j, id, acao) {
    if (j < 0 || j >= cats.length) return;
    const novo = cats.slice();
    [novo[i], novo[j]] = [novo[j], novo[i]];
    const pend = novo.map((c, k) => (Number(c.ordem) === k ? null : supabase.from('lj_categorias').update({ ordem: k }).eq('id', c.id))).filter(Boolean);
    const r = await Promise.all(pend);
    const falha = r.find((x) => x.error);
    if (falha) { toast(msgErro(falha.error), 'erro'); return; }
    await carregar({ id, acao });
  }

  alvo.querySelector('#lj-c-novo').addEventListener('click', () => { editando = 'novo'; desenharForm(); });

  listaEl.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-acao]');
    const li = b && b.closest('[data-id]');
    if (!li || b.disabled) return;
    const i = cats.findIndex((x) => x.id === li.dataset.id);
    if (i < 0) return;
    const c = cats[i];
    const n = contagem.get(c.id) || 0;
    const acao = b.dataset.acao;
    if (acao === 'editar') { editando = c; desenharForm(); return; }
    b.disabled = true;
    try {
      if (acao === 'sobe') await mover(i, i - 1, c.id, 'sobe');
      else if (acao === 'desce') await mover(i, i + 1, c.id, 'desce');
      else if (acao === 'ativo') {
        if (c.ativo && n > 0 && !await confirmar(`Desativar "${c.nome}"? Os ${n} produto(s) dela deixam de aparecer na loja.`, 'Desativar')) return;
        const r = await supabase.from('lj_categorias').update({ ativo: !c.ativo }).eq('id', c.id);
        if (r.error) { toast(msgErro(r.error), 'erro'); return; }
        toast(c.ativo ? 'Categoria desativada.' : 'Categoria ativada.');
        await carregar({ id: c.id, acao: 'ativo' });
      } else if (acao === 'excluir') {
        if (n > 0) {
          toast(`"${c.nome}" tem ${n} produto(s). Mova os produtos para outra categoria ou desative esta categoria.`, 'erro');
          return;
        }
        if (!await confirmar(`Excluir a categoria "${c.nome}"? Isso não pode ser desfeito.`, 'Excluir')) return;
        const r = await supabase.from('lj_categorias').delete().eq('id', c.id);
        if (r.error) { toast(msgErro(r.error), 'erro'); return; }
        toast('Categoria excluída.');
        await carregar();
      }
    } finally { b.disabled = false; }
  });

  await carregar();
}
