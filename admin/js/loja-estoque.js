// Pet Natureza - Painel: aba Estoque (Administrador e Funcionário)
import { supabase } from './supabase.js';
import { esc, toast } from './util.js';
import { msgErro, semAcento, debounce, rotuloStatus, classeStatus, dataHoraBR } from './loja-util.js';

const POR_PAGINA = 20;
const ROT_TIPO = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste', venda: 'Venda', cancelamento: 'Cancelamento' };
const filtro = { q: '', sit: '', pagina: 1 };

async function buscarTodos() {
  const todos = [];
  for (let de = 0; de < 5000; de += 1000) {
    const { data, error } = await supabase.from('lj_produtos')
      .select('id,nome,sku,estoque,estoque_minimo,status')
      .eq('controla_estoque', true).order('nome').range(de, de + 999);
    if (error) throw error;
    todos.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return todos;
}

const esgotado = (p) => Number(p.estoque) <= 0;
const baixo = (p) => Number(p.estoque) > 0 && Number(p.estoque) <= Number(p.estoque_minimo);

export async function viewEstoque(alvo) {
  let todos = [];
  alvo.innerHTML = `
    <p class="suave">Aqui aparecem os produtos com controle de estoque. Para ligar ou desligar o controle, edite o produto na aba Produtos.</p>
    <form class="lj-barra" role="search" id="lj-e-filtros">
      <div class="campo"><label for="lj-e-q">Buscar por nome ou SKU</label><input id="lj-e-q" type="search" maxlength="100" value="${esc(filtro.q)}"></div>
      <div class="campo"><label for="lj-e-sit">Situação</label><select id="lj-e-sit">
        <option value="">Todos</option><option value="baixo">Estoque baixo</option><option value="esgotado">Esgotados</option></select></div>
    </form>
    <p class="suave" id="lj-e-info" role="status" aria-live="polite"></p>
    <div id="lj-e-lista"><p class="carregando">Carregando estoque…</p></div>
    <nav class="lj-pag-adm" id="lj-e-pag" aria-label="Paginação"></nav>`;
  const q = alvo.querySelector('#lj-e-q');
  const sit = alvo.querySelector('#lj-e-sit');
  const info = alvo.querySelector('#lj-e-info');
  const lista = alvo.querySelector('#lj-e-lista');
  const pag = alvo.querySelector('#lj-e-pag');
  sit.value = filtro.sit;

  function filtrados() {
    const termo = semAcento(filtro.q).trim();
    return todos.filter((p) => {
      if (filtro.sit === 'esgotado' && !esgotado(p)) return false;
      if (filtro.sit === 'baixo' && !baixo(p)) return false;
      if (!termo) return true;
      return semAcento(p.nome).includes(termo) || semAcento(p.sku || '').includes(termo);
    });
  }

  function cartao(p) {
    const tag = esgotado(p) ? '<span class="lj-tag lj-tag-alerta">Esgotado</span>'
      : baixo(p) ? '<span class="lj-tag lj-tag-preparo">Estoque baixo</span>' : '<span class="lj-tag lj-tag-ok">Em estoque</span>';
    const nome = esc(p.nome);
    return `<li class="lj-item sem-mini" data-id="${esc(p.id)}">
      <div>
        <div class="lj-item-topo"><p class="lj-item-nome">${nome}</p><span class="${classeStatus(p.status)}">${rotuloStatus(p.status)}</span></div>
        <p class="lj-item-meta">${p.sku ? `SKU ${esc(p.sku)} · ` : ''}Estoque: <strong>${Number(p.estoque)}</strong> ${tag} · Mínimo: ${Number(p.estoque_minimo)}</p>
      </div>
      <div class="lj-item-acoes">
        <button type="button" class="btn btn-pequeno" data-acao="ajustar" aria-label="Ajustar estoque de ${nome}">Ajustar estoque</button>
        <button type="button" class="btn btn-pequeno" data-acao="historico" aria-label="Ver histórico de ${nome}">Histórico</button>
      </div>
      <div data-painel></div></li>`;
  }

  function desenhar() {
    const lis = filtrados();
    const paginas = Math.max(1, Math.ceil(lis.length / POR_PAGINA));
    if (filtro.pagina > paginas) filtro.pagina = paginas;
    const de = (filtro.pagina - 1) * POR_PAGINA;
    const nEsg = todos.filter(esgotado).length;
    const nBai = todos.filter(baixo).length;
    info.textContent = todos.length
      ? `${lis.length} de ${todos.length} produtos · ${nEsg} esgotado(s) · ${nBai} com estoque baixo` : '';
    lista.innerHTML = lis.length
      ? `<ul class="lj-cards">${lis.slice(de, de + POR_PAGINA).map(cartao).join('')}</ul>`
      : `<p class="lj-vazio">${todos.length ? 'Nenhum produto encontrado.' : 'Nenhum produto com controle de estoque ainda.'}</p>`;
    pag.innerHTML = paginas > 1
      ? `<button type="button" class="btn" data-pg="${filtro.pagina - 1}"${filtro.pagina <= 1 ? ' disabled' : ''}>Anterior</button>
         <span>Página ${filtro.pagina} de ${paginas}</span>
         <button type="button" class="btn" data-pg="${filtro.pagina + 1}"${filtro.pagina >= paginas ? ' disabled' : ''}>Próxima</button>` : '';
  }

  async function recarregar() {
    try { todos = await buscarTodos(); } catch (e) {
      lista.innerHTML = `<p class="erro" role="alert">${esc(msgErro(e))}</p>`;
      return;
    }
    desenhar();
  }

  function painelAjuste(p) {
    const id = esc(p.id);
    return `<form class="lj-grade-form" data-ajuste novalidate aria-label="Ajustar estoque de ${esc(p.nome)}">
      <p class="erro lj-col-2" role="alert" hidden data-erro></p>
      <div class="campo"><label for="lj-a-tipo-${id}">Tipo de movimento</label>
        <select id="lj-a-tipo-${id}" data-tipo>
          <option value="entrada">Entrada (chegou mercadoria)</option>
          <option value="saida">Saída (perda, doação, uso)</option>
          <option value="ajuste">Ajuste (contagem do estoque)</option></select></div>
      <div class="campo"><label for="lj-a-qtd-${id}" data-rotulo>Quantidade que entrou</label>
        <input id="lj-a-qtd-${id}" inputmode="numeric" autocomplete="off" data-qtd>
        <p class="ajuda" data-ajuda>Estoque atual: ${Number(p.estoque)}</p></div>
      <div class="campo lj-col-2"><label for="lj-a-mot-${id}">Motivo (obrigatório)</label>
        <input id="lj-a-mot-${id}" maxlength="300" autocomplete="off" data-motivo placeholder="Ex.: chegou pedido do fornecedor"></div>
      <div class="lj-acoes-fixas lj-col-2">
        <button type="submit" class="btn btn-primario">Registrar</button>
        <button type="button" class="btn" data-fechar>Cancelar</button></div></form>`;
  }

  async function painelHistorico(p, el) {
    el.innerHTML = '<p class="carregando">Carregando histórico…</p>';
    const { data, error } = await supabase.from('lj_movimentos_estoque').select('*')
      .eq('produto_id', p.id).order('criado_em', { ascending: false }).limit(30);
    if (error) { el.innerHTML = `<p class="erro" role="alert">${esc(msgErro(error))}</p>`; return; }
    if (!data.length) { el.innerHTML = '<p class="lj-vazio">Ainda não há movimentos para este produto.</p>'; return; }
    const ids = Array.from(new Set(data.map((m) => m.por).filter(Boolean)));
    const nomes = new Map();
    if (ids.length) {
      const r = await supabase.from('profiles').select('id,nome').in('id', ids);
      if (!r.error) (r.data || []).forEach((x) => nomes.set(x.id, x.nome));
    }
    el.innerHTML = `<ul class="lj-hist">${data.map((m) => `<li>
      <strong>${esc(ROT_TIPO[m.tipo] || m.tipo)}: ${m.delta > 0 ? '+' : ''}${Number(m.delta)}</strong> (estoque ficou em ${Number(m.estoque_apos)})
      ${m.motivo ? `<br>${esc(m.motivo)}` : ''}
      <small>${esc(dataHoraBR(m.criado_em))}${m.por ? ` · ${esc(nomes.get(m.por) || 'equipe')}` : (m.tipo === 'venda' ? ' · site' : '')}</small></li>`).join('')}</ul>`;
  }

  async function registrar(form, p) {
    const erroEl = form.querySelector('[data-erro]');
    const falha = (msg, sel) => { erroEl.textContent = msg; erroEl.hidden = false; form.querySelector(sel).focus(); };
    erroEl.hidden = true;
    const tipo = form.querySelector('[data-tipo]').value;
    const txt = form.querySelector('[data-qtd]').value.trim();
    const motivo = form.querySelector('[data-motivo]').value.trim();
    if (!/^\d{1,7}$/.test(txt)) { falha('Informe um número inteiro, 0 ou maior (sem sinal).', '[data-qtd]'); return; }
    const n = Number(txt);
    if (motivo.length < 3) { falha('Informe o motivo (pelo menos 3 letras).', '[data-motivo]'); return; }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const a = await supabase.from('lj_produtos').select('estoque').eq('id', p.id).single();
      if (a.error) throw a.error;
      const atual = Number(a.data.estoque);
      let delta;
      if (tipo === 'entrada') delta = n;
      else if (tipo === 'saida') delta = -n;
      else delta = n - atual;
      if (tipo !== 'ajuste' && n < 1) { falha('Informe uma quantidade maior que zero.', '[data-qtd]'); return; }
      if (tipo === 'saida' && n > atual) { falha(`A saída é maior que o estoque atual (${atual}).`, '[data-qtd]'); return; }
      if (delta === 0) { falha('O novo estoque é igual ao atual. Nada a registrar.', '[data-qtd]'); return; }
      const r = await supabase.rpc('lj_ajustar_estoque', { p_produto: p.id, p_delta: delta, p_tipo: tipo, p_motivo: motivo });
      if (r.error) throw r.error;
      toast(`Estoque atualizado: agora são ${r.data && r.data.estoque != null ? r.data.estoque : atual + delta} unidades.`);
      await recarregar();
    } catch (e) {
      erroEl.textContent = msgErro(e);
      erroEl.hidden = false;
    } finally { btn.disabled = false; }
  }

  q.addEventListener('input', debounce(() => { filtro.q = q.value.trim(); filtro.pagina = 1; desenhar(); }, 250));
  alvo.querySelector('#lj-e-filtros').addEventListener('submit', (ev) => ev.preventDefault());
  sit.addEventListener('change', () => { filtro.sit = sit.value; filtro.pagina = 1; desenhar(); });
  pag.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-pg]');
    if (!b || b.disabled) return;
    filtro.pagina = Number(b.dataset.pg);
    desenhar();
    alvo.scrollIntoView({ block: 'start' });
  });

  lista.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-acao],[data-fechar]');
    const li = b && b.closest('[data-id]');
    if (!li) return;
    const p = todos.find((x) => x.id === li.dataset.id);
    if (!p) return;
    const painel = li.querySelector('[data-painel]');
    if (b.hasAttribute('data-fechar')) { painel.innerHTML = ''; li.querySelector('[data-acao="ajustar"]').focus(); return; }
    lista.querySelectorAll('[data-painel]').forEach((x) => { if (x !== painel) x.innerHTML = ''; });
    if (b.dataset.acao === 'ajustar') {
      painel.innerHTML = painelAjuste(p);
      painel.querySelector('[data-tipo]').focus();
    } else {
      painelHistorico(p, painel);
    }
  });

  lista.addEventListener('change', (ev) => {
    if (!ev.target.matches('[data-tipo]')) return;
    const form = ev.target.closest('form');
    const t = ev.target.value;
    form.querySelector('[data-rotulo]').textContent = t === 'entrada' ? 'Quantidade que entrou'
      : t === 'saida' ? 'Quantidade que saiu' : 'Estoque correto (resultado da contagem)';
  });

  lista.addEventListener('submit', (ev) => {
    if (!ev.target.matches('[data-ajuste]')) return;
    ev.preventDefault();
    const li = ev.target.closest('[data-id]');
    const p = li && todos.find((x) => x.id === li.dataset.id);
    if (p) registrar(ev.target, p);
  });

  await recarregar();
}
