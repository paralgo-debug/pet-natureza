// Pet Natureza - Painel: aba Produtos (lista, formulário, imagens) - somente Administrador
import { supabase } from './supabase.js';
import { esc, toast, confirmar } from './util.js';
import {
  brl, slugify, semAcento, parsePreco, precoParaInput, isoParaInput, inputParaIso, urlImagem,
  msgErro, debounce, rotuloStatus, classeStatus, STATUS_PRODUTO, UUID_RE, paramsAba, dataHoraBR
} from './loja-util.js';
import { montarImagens } from './loja-imagens.js';

const POR_PAGINA = 20;
const COLS = 'id,slug,nome,sku,preco,preco_promocional,promocao_ate,status,destaque,controla_estoque,estoque,estoque_minimo,emoji,categoria_id,lj_categorias(nome,emoji),lj_produto_imagens(path,thumb_path,principal,ordem)';
const LISTA = '#/produtos?aba=produtos';
const filtros = { q: '', cat: '', status: '', pagina: 1 };

export async function viewProdutos(alvo, ctx) {
  if (!ctx.ehAdmin) {
    alvo.innerHTML = '<div class="cartao"><p class="erro" role="alert">Só o Administrador pode editar produtos.</p></div>';
    return;
  }
  const editar = paramsAba().get('editar');
  const { data, error } = await supabase.from('lj_categorias').select('id,nome,emoji,ativo').order('ordem').order('nome');
  if (error) {
    alvo.innerHTML = `<div class="cartao"><p class="erro" role="alert">${esc(msgErro(error))}</p></div>`;
    return;
  }
  if (editar) return telaForm(alvo, editar, data || []);
  return telaLista(alvo, data || []);
}

const promoValida = (p) => p.preco_promocional != null && Number(p.preco_promocional) < Number(p.preco)
  && (!p.promocao_ate || new Date(p.promocao_ate) > new Date());

// ---------- Lista ----------
function telaLista(alvo, cats) {
  alvo.innerHTML = `
    <div class="acoes"><a class="btn btn-primario" href="${LISTA}&editar=novo">Novo produto</a></div>
    ${cats.length ? '' : '<p class="lj-aviso-loja" role="status">Crie ao menos uma categoria (aba Categorias) antes de cadastrar produtos.</p>'}
    <form class="lj-barra" role="search" id="lj-p-filtros">
      <div class="campo"><label for="lj-p-q">Buscar por nome ou SKU</label><input id="lj-p-q" type="search" maxlength="100" value="${esc(filtros.q)}"></div>
      <div class="campo"><label for="lj-p-cat">Categoria</label><select id="lj-p-cat"><option value="">Todas</option>
        ${cats.map((c) => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}</select></div>
      <div class="campo"><label for="lj-p-st">Status</label><select id="lj-p-st"><option value="">Todos</option>
        ${STATUS_PRODUTO.map(([k, r]) => `<option value="${k}">${r}</option>`).join('')}</select></div>
    </form>
    <p class="suave" id="lj-p-info" role="status" aria-live="polite"></p>
    <div id="lj-p-lista"></div>
    <nav class="lj-pag-adm" id="lj-p-pag" aria-label="Paginação"></nav>`;
  const q = alvo.querySelector('#lj-p-q');
  const selCat = alvo.querySelector('#lj-p-cat');
  const selSt = alvo.querySelector('#lj-p-st');
  const info = alvo.querySelector('#lj-p-info');
  const lista = alvo.querySelector('#lj-p-lista');
  const pag = alvo.querySelector('#lj-p-pag');
  selCat.value = filtros.cat;
  selSt.value = filtros.status;

  function cartao(p) {
    const imgs = (p.lj_produto_imagens || []).slice().sort((a, b) => (Number(b.principal) - Number(a.principal)) || (a.ordem - b.ordem));
    const cat = p.lj_categorias;
    const mini = imgs[0]
      ? `<img src="${esc(urlImagem(imgs[0].thumb_path || imgs[0].path))}" alt="" width="64" height="64" loading="lazy">`
      : esc(p.emoji || (cat && cat.emoji) || '🐾');
    const ok = promoValida(p);
    const preco = ok ? `${brl(p.preco_promocional)} (de ${brl(p.preco)})` : brl(p.preco);
    let estoque = '';
    if (p.controla_estoque) {
      const t = p.estoque <= 0 ? '<span class="lj-tag lj-tag-alerta">Esgotado</span>'
        : p.estoque <= p.estoque_minimo ? '<span class="lj-tag lj-tag-preparo">Estoque baixo</span>' : '';
      estoque = ` · Estoque: ${p.estoque} ${t}`;
    }
    const vencida = p.preco_promocional != null && !ok ? ' <span class="lj-tag lj-tag-alerta">Promoção vencida</span>' : '';
    return `<li class="lj-item" data-id="${esc(p.id)}">
      <div class="lj-mini">${mini}</div>
      <div>
        <div class="lj-item-topo"><p class="lj-item-nome">${esc(p.nome)}</p><span class="${classeStatus(p.status)}">${rotuloStatus(p.status)}</span></div>
        <p class="lj-item-meta">${esc(cat ? cat.nome : '')}${p.sku ? ` · SKU ${esc(p.sku)}` : ''} · ${esc(preco)}${ok ? ' <span class="lj-tag lj-tag-ok">Promoção</span>' : ''}${vencida}${p.destaque ? ' <span class="lj-tag lj-tag-novo">Destaque</span>' : ''}${estoque}</p>
      </div>
      <div class="lj-item-acoes">
        <a class="btn btn-pequeno" href="${LISTA}&editar=${esc(p.id)}" aria-label="Editar ${esc(p.nome)}">Editar</a>
        <button type="button" class="btn btn-pequeno" data-acao="duplicar" aria-label="Duplicar ${esc(p.nome)}">Duplicar</button>
        ${p.status === 'publicado'
    ? `<button type="button" class="btn btn-pequeno" data-acao="ocultar" aria-label="Ocultar ${esc(p.nome)} da loja">Ocultar</button>`
    : `<button type="button" class="btn btn-pequeno" data-acao="publicar" aria-label="Publicar ${esc(p.nome)}">Publicar</button>`}
        ${p.status !== 'arquivado' ? `<button type="button" class="btn btn-pequeno btn-perigo" data-acao="arquivar" aria-label="Arquivar ${esc(p.nome)}">Arquivar</button>` : ''}
      </div></li>`;
  }

  async function carregar() {
    lista.setAttribute('aria-busy', 'true');
    info.textContent = 'Carregando…';
    let c = supabase.from('lj_produtos').select(COLS, { count: 'exact' });
    if (filtros.cat) c = c.eq('categoria_id', filtros.cat);
    if (filtros.status) c = c.eq('status', filtros.status);
    const termo = semAcento(filtros.q).replace(/[^a-z0-9 ._-]/g, '').trim().replace(/\s+/g, '*');
    if (termo) c = c.or(`nome_busca.ilike.*${termo}*,sku.ilike.*${termo}*`);
    const de = (filtros.pagina - 1) * POR_PAGINA;
    const { data, error, count } = await c.order('atualizado_em', { ascending: false }).range(de, de + POR_PAGINA - 1);
    lista.setAttribute('aria-busy', 'false');
    if (error) {
      if (filtros.pagina > 1) { filtros.pagina = 1; return carregar(); }
      info.textContent = '';
      lista.innerHTML = `<p class="erro" role="alert">${esc(msgErro(error))}</p>`;
      pag.innerHTML = '';
      return undefined;
    }
    const total = count || 0;
    const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    info.textContent = total ? `${total} ${total === 1 ? 'produto' : 'produtos'}` : '';
    lista.innerHTML = (data || []).length
      ? `<ul class="lj-cards">${data.map(cartao).join('')}</ul>`
      : '<p class="lj-vazio">Nenhum produto encontrado.</p>';
    pag.innerHTML = paginas > 1
      ? `<button type="button" class="btn" data-pg="${filtros.pagina - 1}"${filtros.pagina <= 1 ? ' disabled' : ''}>Anterior</button>
         <span>Página ${filtros.pagina} de ${paginas}</span>
         <button type="button" class="btn" data-pg="${filtros.pagina + 1}"${filtros.pagina >= paginas ? ' disabled' : ''}>Próxima</button>` : '';
    return undefined;
  }

  async function mudarStatus(id, status, msg) {
    const { error } = await supabase.from('lj_produtos').update({ status }).eq('id', id);
    if (error) { toast(msgErro(error), 'erro'); return; }
    toast(msg);
    await carregar();
  }

  async function duplicar(id) {
    const { data, error } = await supabase.from('lj_produtos').select('*').eq('id', id).maybeSingle();
    if (error || !data) { toast(error ? msgErro(error) : 'Produto não encontrado.', 'erro'); return; }
    const copia = { ...data };
    ['id', 'criado_em', 'atualizado_em', 'nome_busca'].forEach((k) => delete copia[k]);
    copia.nome = `${data.nome} (cópia)`.slice(0, 120);
    copia.slug = `${data.slug.slice(0, 100)}-copia-${Math.random().toString(36).slice(2, 6)}`;
    copia.sku = null;
    copia.status = 'rascunho';
    copia.destaque = false;
    copia.estoque = 0;
    const r = await supabase.from('lj_produtos').insert(copia).select('id').single();
    if (r.error) { toast(msgErro(r.error), 'erro'); return; }
    toast('Cópia criada como rascunho (sem imagens e com estoque zero).');
    location.hash = `${LISTA}&editar=${r.data.id}`;
  }

  const buscar = debounce(() => { filtros.q = q.value.trim(); filtros.pagina = 1; carregar(); }, 350);
  q.addEventListener('input', buscar);
  alvo.querySelector('#lj-p-filtros').addEventListener('submit', (ev) => ev.preventDefault());
  selCat.addEventListener('change', () => { filtros.cat = selCat.value; filtros.pagina = 1; carregar(); });
  selSt.addEventListener('change', () => { filtros.status = selSt.value; filtros.pagina = 1; carregar(); });
  pag.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-pg]');
    if (!b || b.disabled) return;
    filtros.pagina = Number(b.dataset.pg);
    carregar();
  });
  lista.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-acao]');
    const li = b && b.closest('[data-id]');
    if (!li) return;
    const id = li.dataset.id;
    const acao = b.dataset.acao;
    b.disabled = true;
    try {
      if (acao === 'duplicar') await duplicar(id);
      else if (acao === 'ocultar') await mudarStatus(id, 'rascunho', 'Produto ocultado (voltou para rascunho).');
      else if (acao === 'publicar') await mudarStatus(id, 'publicado', 'Produto publicado na loja.');
      else if (acao === 'arquivar') {
        if (await confirmar('Arquivar este produto? Ele sai da loja, mas os pedidos antigos continuam guardados.', 'Arquivar')) {
          await mudarStatus(id, 'arquivado', 'Produto arquivado.');
        }
      }
    } finally { b.disabled = false; }
  });
  return carregar();
}

// ---------- Formulário ----------
async function telaForm(alvo, id, cats) {
  const novo = id === 'novo';
  let p = null;
  if (!novo) {
    if (!UUID_RE.test(id)) { alvo.innerHTML = `<div class="cartao"><p class="erro" role="alert">Produto inválido.</p><a class="btn" href="${LISTA}">Voltar à lista</a></div>`; return; }
    const { data, error } = await supabase.from('lj_produtos').select('*').eq('id', id).maybeSingle();
    if (error || !data) {
      alvo.innerHTML = `<div class="cartao"><p class="erro" role="alert">${esc(error ? msgErro(error) : 'Produto não encontrado.')}</p><a class="btn" href="${LISTA}">Voltar à lista</a></div>`;
      return;
    }
    p = data;
  }
  const v = p || {
    nome: '', slug: '', sku: null, categoria_id: '', status: 'rascunho', descricao_curta: '', descricao: '', preco: null,
    preco_promocional: null, promocao_ate: null, destaque: false, controla_estoque: false, estoque: 0, estoque_minimo: 0, emoji: ''
  };
  const emPromo = v.preco_promocional != null;

  alvo.innerHTML = `
    <div class="acoes"><a class="btn" href="${LISTA}">&larr; Voltar à lista</a></div>
    <form class="cartao" id="lj-p-form" novalidate>
      <h2>${novo ? 'Novo produto' : 'Editar produto'}</h2>
      <p class="erro" id="lj-p-erro" role="alert" hidden></p>
      <div class="lj-grade-form">
        <div class="campo lj-col-2"><label for="lj-f-nome">Nome</label>
          <input id="lj-f-nome" maxlength="120" value="${esc(v.nome)}" aria-required="true"></div>
        <div class="campo"><label for="lj-f-slug">Endereço (slug)</label>
          <input id="lj-f-slug" maxlength="120" autocomplete="off" value="${esc(v.slug)}">
          <p class="ajuda">Usado no link do produto. Só letras minúsculas, números e hífen.</p></div>
        <div class="campo"><label for="lj-f-sku">SKU (opcional)</label>
          <input id="lj-f-sku" maxlength="60" autocomplete="off" value="${esc(v.sku || '')}"></div>
        <div class="campo"><label for="lj-f-cat">Categoria</label>
          <select id="lj-f-cat" aria-required="true"><option value="">Escolha…</option>
            ${cats.map((c) => `<option value="${esc(c.id)}"${c.id === v.categoria_id ? ' selected' : ''}>${esc(c.nome)}${c.ativo ? '' : ' (desativada)'}</option>`).join('')}</select></div>
        <div class="campo"><label for="lj-f-status">Status</label>
          <select id="lj-f-status">${STATUS_PRODUTO.map(([k, r]) => `<option value="${k}"${k === v.status ? ' selected' : ''}>${r}</option>`).join('')}</select>
          <p class="ajuda">Só "Publicado" aparece na loja.</p></div>
        <div class="campo lj-col-2"><label for="lj-f-curta">Descrição curta (até 200 caracteres)</label>
          <input id="lj-f-curta" maxlength="200" value="${esc(v.descricao_curta)}"></div>
        <div class="campo lj-col-2"><label for="lj-f-desc">Descrição completa (até 4000 caracteres)</label>
          <textarea id="lj-f-desc" maxlength="4000">${esc(v.descricao)}</textarea></div>
        <div class="campo"><label for="lj-f-preco">Preço normal (R$)</label>
          <input id="lj-f-preco" inputmode="decimal" autocomplete="off" value="${esc(precoParaInput(v.preco))}" aria-required="true"></div>
        <div class="campo"><label for="lj-f-emoji">Emoji de reserva (opcional)</label>
          <input id="lj-f-emoji" maxlength="8" autocomplete="off" value="${esc(v.emoji || '')}">
          <p class="ajuda">Aparece quando o produto não tem imagem. Sem emoji, vale o da categoria.</p></div>
        <label class="lj-linha-check lj-col-2"><input type="checkbox" id="lj-f-promo"${emPromo ? ' checked' : ''}> Em promoção</label>
        <div class="lj-grade-form lj-col-2" id="lj-sec-promo"${emPromo ? '' : ' hidden'}>
          <div class="campo"><label for="lj-f-promopreco">Preço promocional (R$)</label>
            <input id="lj-f-promopreco" inputmode="decimal" autocomplete="off" value="${esc(precoParaInput(v.preco_promocional))}"></div>
          <div class="campo"><label for="lj-f-ate">Promoção termina em (opcional)</label>
            <input id="lj-f-ate" type="datetime-local" value="${esc(v.promocao_ate ? isoParaInput(v.promocao_ate) : '')}">
            <p class="ajuda">Horário de Fortaleza. Sem data, a promoção vale até você desmarcá-la.</p></div>
        </div>
        <label class="lj-linha-check lj-col-2"><input type="checkbox" id="lj-f-dest"${v.destaque ? ' checked' : ''}> Destaque na loja</label>
        <label class="lj-linha-check lj-col-2"><input type="checkbox" id="lj-f-ctl"${v.controla_estoque ? ' checked' : ''}> Controlar estoque deste produto</label>
        <div class="lj-grade-form lj-col-2" id="lj-sec-estoque"${v.controla_estoque ? '' : ' hidden'}>
          ${novo
    ? '<div class="campo"><label for="lj-f-estoque">Estoque inicial</label><input id="lj-f-estoque" inputmode="numeric" value="0"></div>'
    : `<p class="ajuda">Estoque atual: <strong>${Number(v.estoque)}</strong>. Para entrada, saída ou ajuste, use a aba <a href="#/produtos?aba=estoque">Estoque</a>.</p>`}
          <div class="campo"><label for="lj-f-min">Estoque mínimo (aviso de "Últimas unidades")</label>
            <input id="lj-f-min" inputmode="numeric" value="${Number(v.estoque_minimo) || 0}"></div>
        </div>
      </div>
      <div class="lj-acoes-fixas">
        <button type="submit" class="btn btn-primario" id="lj-p-salvar">${novo ? 'Criar produto' : 'Salvar alterações'}</button>
        <a class="btn" href="${LISTA}">Cancelar</a>
      </div>
    </form>
    <div id="lj-prod-imagens">${novo ? '<div class="cartao"><p class="suave">As imagens podem ser adicionadas depois de criar o produto.</p></div>' : ''}</div>`;

  const form = alvo.querySelector('#lj-p-form');
  const f = (sid) => form.querySelector(`#${sid}`);
  const erroEl = f('lj-p-erro');
  let slugTocado = !novo;

  f('lj-f-nome').addEventListener('input', () => { if (!slugTocado) f('lj-f-slug').value = slugify(f('lj-f-nome').value); });
  f('lj-f-slug').addEventListener('input', () => { slugTocado = true; });
  f('lj-f-slug').addEventListener('blur', () => { f('lj-f-slug').value = slugify(f('lj-f-slug').value); });
  f('lj-f-promo').addEventListener('change', () => { f('lj-sec-promo').hidden = !f('lj-f-promo').checked; });
  f('lj-f-ctl').addEventListener('change', () => { f('lj-sec-estoque').hidden = !f('lj-f-ctl').checked; });

  function falha(msg, campo) {
    erroEl.textContent = msg;
    erroEl.hidden = false;
    if (campo) f(campo).focus(); else erroEl.scrollIntoView({ block: 'center' });
    return null;
  }

  function ler() {
    erroEl.hidden = true;
    const nome = f('lj-f-nome').value.trim();
    const slug = slugify(f('lj-f-slug').value || nome);
    const emoji = f('lj-f-emoji').value.trim();
    if (!nome) return falha('Informe o nome do produto.', 'lj-f-nome');
    if (!slug) return falha('Informe o endereço (slug) do produto.', 'lj-f-slug');
    if (!f('lj-f-cat').value) return falha('Escolha a categoria.', 'lj-f-cat');
    const preco = parsePreco(f('lj-f-preco').value);
    if (preco === null || preco < 0) return falha('Informe o preço normal, por exemplo 49,90.', 'lj-f-preco');
    if (Array.from(emoji).length > 4) return falha('O emoji de reserva pode ter no máximo 4 caracteres.', 'lj-f-emoji');
    let promo = null;
    let ate = null;
    if (f('lj-f-promo').checked) {
      promo = parsePreco(f('lj-f-promopreco').value);
      if (promo === null || promo < 0) return falha('Informe o preço promocional, por exemplo 39,90.', 'lj-f-promopreco');
      if (promo >= preco) return falha('O preço promocional precisa ser menor que o preço normal.', 'lj-f-promopreco');
      if (f('lj-f-ate').value) {
        ate = inputParaIso(f('lj-f-ate').value);
        if (!ate) return falha('A data final da promoção é inválida.', 'lj-f-ate');
        if (new Date(ate) <= new Date()) return falha('A data final da promoção precisa estar no futuro.', 'lj-f-ate');
      }
    }
    const controla = f('lj-f-ctl').checked;
    const minimo = controla ? Number(f('lj-f-min').value) : Number(v.estoque_minimo) || 0;
    if (!Number.isInteger(minimo) || minimo < 0) return falha('O estoque mínimo precisa ser um número inteiro, 0 ou maior.', 'lj-f-min');
    const dados = {
      nome, slug, sku: f('lj-f-sku').value.trim() || null, categoria_id: f('lj-f-cat').value, status: f('lj-f-status').value,
      descricao_curta: f('lj-f-curta').value.trim(), descricao: f('lj-f-desc').value.trim(), preco,
      preco_promocional: promo, promocao_ate: ate, destaque: f('lj-f-dest').checked, controla_estoque: controla,
      estoque_minimo: minimo, emoji: emoji || null
    };
    if (novo) {
      const ini = controla ? Number(f('lj-f-estoque').value) : 0;
      if (!Number.isInteger(ini) || ini < 0) return falha('O estoque inicial precisa ser um número inteiro, 0 ou maior.', 'lj-f-estoque');
      dados.estoque = ini;
    }
    return dados;
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const dados = ler();
    if (!dados) return;
    const btn = f('lj-p-salvar');
    btn.disabled = true;
    try {
      if (novo) {
        const r = await supabase.from('lj_produtos').insert(dados).select('id').single();
        if (r.error) throw r.error;
        toast('Produto criado. Agora você pode adicionar as imagens.');
        location.hash = `${LISTA}&editar=${r.data.id}`;
      } else {
        const r = await supabase.from('lj_produtos').update(dados).eq('id', id);
        if (r.error) throw r.error;
        toast('Produto salvo.');
      }
    } catch (e) {
      falha(msgErro(e));
    } finally { btn.disabled = false; }
  });

  if (!novo) await montarImagens(alvo.querySelector('#lj-prod-imagens'), id, { nome: v.nome });
      }
