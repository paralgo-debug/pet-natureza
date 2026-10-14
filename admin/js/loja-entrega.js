// Pet Natureza - Painel: Entrega e Retirada (rota #/entrega) - somente Administrador
import { supabase } from './supabase.js';
import { esc, toast, confirmar } from './util.js';
import { brl, parsePreco, precoParaInput, msgErro, carregarCss } from './loja-util.js';

export async function viewEntrega(alvo, ctx) {
  carregarCss();
  if (!ctx.ehAdmin) {
    alvo.innerHTML = '<div class="cab-pagina"><h1>Entrega e retirada</h1></div><div class="cartao"><p class="erro" role="alert">Só o Administrador pode alterar entrega e retirada.</p></div>';
    return;
  }
  let zonas = [];
  let usos = new Map();
  let editando = null;
  let cfg = { retirada_ativa: true, retirada_texto: '' };

  alvo.innerHTML = `
    <div class="cab-pagina"><h1>Entrega e retirada</h1>
      <p class="suave">Defina as zonas de entrega, com taxa e prazo, e se a retirada na loja está disponível.</p></div>
    <p class="lj-aviso-loja" role="note">Alterações aqui valem na hora na loja e não mudam pedidos já feitos, que guardam os valores da época.</p>
    <p class="lj-aviso-loja" id="lj-e-aviso" role="alert" hidden></p>
    <section class="cartao" aria-labelledby="lj-z-tit"><h2 id="lj-z-tit">Zonas de entrega</h2>
      <div class="acoes"><button type="button" class="btn btn-primario" id="lj-z-novo">Nova zona</button></div>
      <div id="lj-z-form"></div>
      <div id="lj-z-lista"><p class="carregando">Carregando zonas…</p></div></section>
    <section class="cartao" aria-labelledby="lj-r-tit"><h2 id="lj-r-tit">Retirada na loja</h2>
      <form id="lj-r-form" novalidate>
        <div class="lj-grade-form">
          <label class="lj-linha-check lj-col-2"><input type="checkbox" id="lj-r-ativa"> Retirada na loja disponível</label>
          <div class="campo lj-col-2"><label for="lj-r-texto">Texto mostrado ao cliente (até 300 caracteres)</label>
            <textarea id="lj-r-texto" maxlength="300"></textarea>
            <p class="ajuda">Use para explicar como e quando retirar o pedido.</p></div>
        </div>
        <p class="erro" id="lj-r-erro" role="alert" hidden></p>
        <div class="lj-acoes-fixas"><button type="submit" class="btn btn-primario" id="lj-r-salvar">Salvar retirada</button></div>
      </form></section>`;
  const aviso = alvo.querySelector('#lj-e-aviso');
  const formEl = alvo.querySelector('#lj-z-form');
  const listaEl = alvo.querySelector('#lj-z-lista');
  const rForm = alvo.querySelector('#lj-r-form');
  const rAtiva = alvo.querySelector('#lj-r-ativa');
  const rTexto = alvo.querySelector('#lj-r-texto');

  function atualizarAviso() {
    const semOpcao = !zonas.some((z) => z.ativa) && !cfg.retirada_ativa;
    aviso.hidden = !semOpcao;
    if (semOpcao) aviso.textContent = 'Atenção: sem nenhuma zona de entrega ativa e com a retirada desligada, a loja não consegue receber pedidos.';
  }

  function desenharLista(foco) {
    if (!zonas.length) {
      listaEl.innerHTML = '<p class="lj-vazio">Nenhuma zona de entrega cadastrada. Sem zonas, a loja só aceita retirada.</p>';
      return;
    }
    listaEl.innerHTML = `<ul class="lj-cards">${zonas.map((z, i) => {
      const n = usos.get(z.id) || 0;
      const nome = esc(z.nome);
      return `<li class="lj-item sem-mini" data-id="${esc(z.id)}">
        <div>
          <div class="lj-item-topo"><p class="lj-item-nome">${nome}</p>
            <span class="lj-tag ${z.ativa ? 'lj-tag-ok' : 'lj-tag-neutro'}">${z.ativa ? 'Ativa' : 'Desativada'}</span></div>
          <p class="lj-item-meta">Taxa: ${Number(z.taxa) > 0 ? esc(brl(z.taxa)) : 'Grátis'}${z.prazo ? ` · Prazo: ${esc(z.prazo)}` : ''} · ${n ? `usada em ${n} ${n === 1 ? 'pedido' : 'pedidos'}` : 'nunca usada'}</p>
        </div>
        <div class="lj-item-acoes">
          <button type="button" class="btn btn-pequeno" data-acao="editar" aria-label="Editar ${nome}">Editar</button>
          <span class="lj-ordem-btns">
            <button type="button" class="btn btn-pequeno" data-acao="sobe" aria-label="Mover ${nome} para cima"${i === 0 ? ' disabled' : ''}>&uarr;</button>
            <button type="button" class="btn btn-pequeno" data-acao="desce" aria-label="Mover ${nome} para baixo"${i === zonas.length - 1 ? ' disabled' : ''}>&darr;</button>
          </span>
          <button type="button" class="btn btn-pequeno" data-acao="ativa">${z.ativa ? 'Desativar' : 'Ativar'}<span class="lj-so-leitor"> ${nome}</span></button>
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
    const [zr, cr] = await Promise.all([
      supabase.from('lj_zonas_entrega').select('*').order('ordem').order('nome'),
      supabase.from('lj_config').select('*').eq('id', 1).maybeSingle()
    ]);
    if (zr.error) { listaEl.innerHTML = `<p class="erro" role="alert">${esc(msgErro(zr.error))}</p>`; return; }
    zonas = zr.data || [];
    if (!cr.error && cr.data) cfg = cr.data;
    const c = await Promise.all(zonas.map((z) => supabase.from('lj_pedidos')
      .select('id', { count: 'exact', head: true }).eq('zona_id', z.id)));
    usos = new Map(zonas.map((z, i) => [z.id, c[i].count || 0]));
    rAtiva.checked = !!cfg.retirada_ativa;
    rTexto.value = cfg.retirada_texto || '';
    desenharLista(foco);
    atualizarAviso();
  }

  function desenharForm() {
    if (!editando) { formEl.innerHTML = ''; return; }
    const novo = editando === 'novo';
    const z = novo ? { nome: '', taxa: 0, prazo: '', ativa: true } : editando;
    formEl.innerHTML = `<form class="cartao" id="lj-z-f" novalidate>
      <h3>${novo ? 'Nova zona de entrega' : 'Editar zona de entrega'}</h3>
      <p class="erro" id="lj-z-erro" role="alert" hidden></p>
      <div class="lj-grade-form">
        <div class="campo"><label for="lj-z-nome">Nome (bairro ou região)</label><input id="lj-z-nome" maxlength="80" value="${esc(z.nome)}" aria-required="true"></div>
        <div class="campo"><label for="lj-z-taxa">Taxa de entrega (R$)</label><input id="lj-z-taxa" inputmode="decimal" autocomplete="off" value="${esc(precoParaInput(z.taxa))}" aria-required="true">
          <p class="ajuda">Use 0 para entrega grátis.</p></div>
        <div class="campo"><label for="lj-z-prazo">Prazo estimado (opcional)</label><input id="lj-z-prazo" maxlength="80" autocomplete="off" value="${esc(z.prazo || '')}"></div>
        <label class="lj-linha-check"><input type="checkbox" id="lj-z-ativa"${z.ativa ? ' checked' : ''}> Zona ativa (aparece no checkout)</label>
      </div>
      <div class="lj-acoes-fixas"><button type="submit" class="btn btn-primario" id="lj-z-salvar">Salvar</button>
        <button type="button" class="btn" id="lj-z-cancelar">Cancelar</button></div></form>`;
    const f = (id) => formEl.querySelector(`#${id}`);
    f('lj-z-cancelar').addEventListener('click', () => { editando = null; desenharForm(); });
    formEl.querySelector('#lj-z-f').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const erroEl = f('lj-z-erro');
      const falha = (m, campo) => { erroEl.textContent = m; erroEl.hidden = false; f(campo).focus(); };
      erroEl.hidden = true;
      const nome = f('lj-z-nome').value.trim();
      const taxa = parsePreco(f('lj-z-taxa').value);
      if (!nome) { falha('Informe o nome da zona.', 'lj-z-nome'); return; }
      if (taxa === null || taxa < 0) { falha('Informe a taxa em reais, por exemplo 8,00. Use 0 para grátis.', 'lj-z-taxa'); return; }
      const dados = { nome, taxa, prazo: f('lj-z-prazo').value.trim() || null, ativa: f('lj-z-ativa').checked };
      const btn = f('lj-z-salvar');
      btn.disabled = true;
      try {
        if (novo) {
          const ordem = zonas.length ? Math.max(...zonas.map((x) => Number(x.ordem) || 0)) + 1 : 1;
          const r = await supabase.from('lj_zonas_entrega').insert({ ...dados, ordem });
          if (r.error) throw r.error;
          toast('Zona criada.');
        } else {
          const r = await supabase.from('lj_zonas_entrega').update(dados).eq('id', z.id);
          if (r.error) throw r.error;
          toast('Zona salva.');
        }
        editando = null;
        desenharForm();
        await carregar();
      } catch (e) {
        erroEl.textContent = msgErro(e);
        erroEl.hidden = false;
      } finally { btn.disabled = false; }
    });
    f('lj-z-nome').focus();
  }

  async function mover(i, j, id, acao) {
    if (j < 0 || j >= zonas.length) return;
    const novo = zonas.slice();
    [novo[i], novo[j]] = [novo[j], novo[i]];
    const r = await Promise.all(novo.map((z, k) => (Number(z.ordem) === k ? null
      : supabase.from('lj_zonas_entrega').update({ ordem: k }).eq('id', z.id))).filter(Boolean));
    const falha = r.find((x) => x.error);
    if (falha) { toast(msgErro(falha.error), 'erro'); return; }
    await carregar({ id, acao });
  }

  alvo.querySelector('#lj-z-novo').addEventListener('click', () => { editando = 'novo'; desenharForm(); });

  listaEl.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-acao]');
    const li = b && b.closest('[data-id]');
    if (!li || b.disabled) return;
    const i = zonas.findIndex((x) => x.id === li.dataset.id);
    if (i < 0) return;
    const z = zonas[i];
    const n = usos.get(z.id) || 0;
    const acao = b.dataset.acao;
    if (acao === 'editar') { editando = z; desenharForm(); return; }
    b.disabled = true;
    try {
      if (acao === 'sobe') await mover(i, i - 1, z.id, 'sobe');
      else if (acao === 'desce') await mover(i, i + 1, z.id, 'desce');
      else if (acao === 'ativa') {
        const r = await supabase.from('lj_zonas_entrega').update({ ativa: !z.ativa }).eq('id', z.id);
        if (r.error) { toast(msgErro(r.error), 'erro'); return; }
        toast(z.ativa ? 'Zona desativada.' : 'Zona ativada.');
        await carregar({ id: z.id, acao: 'ativa' });
      } else if (acao === 'excluir') {
        if (n > 0) { toast(`"${z.nome}" já foi usada em ${n} pedido(s) e não pode ser excluída. Desative a zona.`, 'erro'); return; }
        if (!await confirmar(`Excluir a zona "${z.nome}"? Isso não pode ser desfeito.`, 'Excluir')) return;
        const r = await supabase.from('lj_zonas_entrega').delete().eq('id', z.id);
        if (r.error) { toast(msgErro(r.error), 'erro'); return; }
        toast('Zona excluída.');
        await carregar();
      }
    } finally { b.disabled = false; }
  });

  rForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const erroEl = alvo.querySelector('#lj-r-erro');
    const btn = alvo.querySelector('#lj-r-salvar');
    erroEl.hidden = true;
    btn.disabled = true;
    const r = await supabase.from('lj_config').upsert({ id: 1, retirada_ativa: rAtiva.checked, retirada_texto: rTexto.value.trim().slice(0, 300) });
    btn.disabled = false;
    if (r.error) { erroEl.textContent = msgErro(r.error); erroEl.hidden = false; return; }
    cfg = { ...cfg, retirada_ativa: rAtiva.checked, retirada_texto: rTexto.value.trim() };
    atualizarAviso();
    toast('Retirada salva.');
  });

  await carregar();
                                                                                                }
