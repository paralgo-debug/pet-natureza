// Pet Natureza - Loja: catálogo (busca, filtros, grade e paginação)
import { listarCategorias, listarProdutos, esc, urlImagem, htmlPreco, rotuloEstoque } from './loja-api.js';
import { adicionar } from './loja-carrinho.js';
import { toast } from './loja-layout.js';

export const ESTADO_PADRAO = { q: '', categoria: '', ordem: 'relevancia', pagina: 1, promo: false };

const ORDENS = [
  ['relevancia', 'Relevância'], ['menor_preco', 'Menor preço'], ['maior_preco', 'Maior preço'],
  ['nome', 'Nome A–Z'], ['promocoes', 'Promoções']
];

export function normalizarEstado(e = {}) {
  const q = String(e.q ?? '').trim().slice(0, 100);
  const cat = String(e.categoria ?? '');
  const categoria = /^[a-z0-9-]{0,80}$/.test(cat) ? cat : '';
  const ordem = ORDENS.some(([v]) => v === e.ordem) ? e.ordem : 'relevancia';
  const pagina = Math.min(Math.max(1, Math.floor(Number(e.pagina)) || 1), 100000);
  const promo = e.promo === true || e.promo === '1' || e.promo === 'true';
  return { q, categoria, ordem, pagina, promo };
}

export function estadoParaQuery(e) {
  const s = normalizarEstado(e);
  const p = new URLSearchParams();
  if (s.q) p.set('q', s.q);
  if (s.categoria) p.set('categoria', s.categoria);
  if (s.ordem !== 'relevancia') p.set('ordem', s.ordem);
  if (s.promo) p.set('promocao', '1');
  if (s.pagina > 1) p.set('pagina', String(s.pagina));
  const t = p.toString();
  return t ? `?${t}` : '';
}

// Quantidade máxima conhecida a partir do resumo do produto (o servidor confere de novo)
export function maxConhecido(p) {
  if (!p.controla_estoque) return 99;
  if (p.estoque_status === 'esgotado') return 0;
  if (p.estoque_status === 'ultimas') return Math.min(99, Number(p.estoque_restante) || 1);
  return 99;
}

export function adicionarComAviso(info, q = 1) {
  const r = adicionar(info.id, q, { nome: info.nome, preco: info.preco, max: info.max });
  const nome = info.nome || 'O produto';
  if (r.ok) {
    if (r.limitado) {
      toast(`Só temos ${r.quantidade} unidade${r.quantidade === 1 ? '' : 's'} de ${nome}. Adicionamos o máximo possível.`);
    } else {
      toast(`${nome} foi adicionado ao carrinho.`);
    }
  } else if (r.motivo === 'esgotado') {
    toast(`${nome} está esgotado.`, 'erro');
  } else if (r.motivo === 'limite_itens') {
    toast('O carrinho aceita no máximo 50 produtos diferentes.', 'erro');
  } else if (r.motivo === 'limite_quantidade') {
    toast(`Você já tem o máximo disponível de ${nome} no carrinho (${r.quantidade}).`, 'erro');
  } else {
    toast('Não foi possível adicionar este produto.', 'erro');
  }
  return r;
}

const CLASSE_ESTOQUE = { em_estoque: 'ok', ultimas: 'ultimas', esgotado: 'esgotado' };

export function htmlEstoque(p) {
  const rotulo = rotuloEstoque(p);
  if (!rotulo) return '';
  return `<p class="lj-estoque lj-estoque-${CLASSE_ESTOQUE[p.estoque_status] || 'ok'}">${esc(rotulo)}</p>`;
}

export function htmlCartao(p, linkProduto) {
  const href = esc(linkProduto(p.slug));
  const nome = esc(p.nome);
  const slug = esc(p.slug);
  const im = p.imagem_principal;
  const arquivo = im ? (im.thumb_path || im.path) : '';
  const midia = arquivo
    ? `<img src="${esc(urlImagem(arquivo))}" alt="${esc(im.alt || p.nome)}" width="400" height="400" loading="lazy" decoding="async">`
    : `<span class="lj-reserva" aria-hidden="true">${esc(p.emoji || '🐾')}</span>`;
  const selos = (p.promocao_valida ? '<span class="lj-selo lj-selo-promo">Promoção</span>' : '')
    + (p.destaque ? '<span class="lj-selo lj-selo-dest">Destaque</span>' : '');
  const esgotado = p.estoque_status === 'esgotado';
  return `<li class="lj-card">
    <a class="lj-card-img" href="${href}" data-slug="${slug}" tabindex="-1" aria-hidden="true">${midia}${selos ? `<span class="lj-selos">${selos}</span>` : ''}</a>
    <div class="lj-card-corpo">
      ${p.categoria ? `<span class="lj-cat">${esc(p.categoria.nome)}</span>` : ''}
      <h3 class="lj-card-nome"><a href="${href}" data-slug="${slug}">${nome}</a></h3>
      ${htmlPreco(p)}
      ${htmlEstoque(p)}
      <div class="lj-card-acoes">
        <a class="lj-btn lj-btn-sec lj-btn-peq" href="${href}" data-slug="${slug}" aria-label="Ver detalhes de ${nome}">Ver detalhes</a>
        <button type="button" class="lj-btn lj-btn-peq" data-add="${esc(p.id)}" aria-label="Adicionar ${nome} ao carrinho"${esgotado ? ' disabled' : ''}>${esgotado ? 'Esgotado' : 'Adicionar ao carrinho'}</button>
      </div>
    </div>
  </li>`;
}

function numerosPagina(atual, total) {
  const base = [1, total, atual - 1, atual, atual + 1]
    .filter((n) => n >= 1 && n <= total);
  const lista = Array.from(new Set(base)).sort((a, b) => a - b);
  const saida = [];
  let ant = 0;
  for (const n of lista) {
    if (n - ant === 2) saida.push(ant + 1);
    else if (n - ant > 2) saida.push(null);
    saida.push(n);
    ant = n;
  }
  return saida;
}

function htmlPaginacao(r) {
  const atual = Number(r.pagina);
  const total = Number(r.paginas);
  if (!(total > 1)) return '';
  const numeros = numerosPagina(atual, total).map((n) => (n === null
    ? '<li class="lj-pag-reticencias" aria-hidden="true">…</li>'
    : `<li><button type="button" class="lj-pag-btn" data-pagina="${n}" aria-label="Página ${n}"${n === atual ? ' aria-current="page"' : ''}>${n}</button></li>`)).join('');
  return `<nav class="lj-pag" aria-label="Paginação">
    <p class="lj-pag-info">Página ${atual} de ${total}</p>
    <ul class="lj-pag-lista">
      <li><button type="button" class="lj-pag-btn" data-pagina="${atual - 1}"${atual <= 1 ? ' disabled' : ''}>Anterior</button></li>
      ${numeros}
      <li><button type="button" class="lj-pag-btn" data-pagina="${atual + 1}"${atual >= total ? ' disabled' : ''}>Próxima</button></li>
    </ul>
  </nav>`;
}

function esqueleto() {
  return `<ul class="lj-grade" aria-hidden="true">${'<li class="lj-esq"></li>'.repeat(8)}</ul>`;
}

// ctx: { navegar(patch), abrirProduto(slug), linkProduto(slug), corrigirPagina(n),
//        whatsappHref(), aoCarregar({ resposta, categoria, estado }) }
export function criarCatalogo(alvo, ctx) {
  alvo.innerHTML = `
    <div class="lj-topo">
      <h1 class="lj-tit" id="lj-tit">Nossos produtos</h1>
      <p class="lj-sub">Monte seu carrinho e envie o pedido. O pagamento é combinado na entrega, na retirada ou pelo WhatsApp.</p>
    </div>
    <div class="lj-chips" id="lj-chips" role="group" aria-label="Categorias" hidden></div>
    <div class="lj-ferramentas">
      <div class="lj-ordem">
        <label for="lj-ordem">Ordenar por</label>
        <select id="lj-ordem">${ORDENS.map(([v, r]) => `<option value="${v}">${r}</option>`).join('')}</select>
      </div>
      <label class="lj-check"><input type="checkbox" id="lj-promo"> Só promoções</label>
    </div>
    <p class="lj-resultado-info" id="lj-info" aria-live="polite" tabindex="-1"></p>
    <h2 class="sr-only">Lista de produtos</h2>
    <div id="lj-lista" aria-busy="false"></div>
    <div id="lj-paginacao"></div>`;

  const q = (s) => alvo.querySelector(s);
  const elTit = q('#lj-tit');
  const elChips = q('#lj-chips');
  const selOrdem = q('#lj-ordem');
  const chkPromo = q('#lj-promo');
  const elInfo = q('#lj-info');
  const elLista = q('#lj-lista');
  const elPag = q('#lj-paginacao');

  let estado = { ...ESTADO_PADRAO };
  let categorias = null;
  let carregandoCats = false;
  let seq = 0;
  let paginaAnterior = null;
  let porId = new Map();

  const wa = () => (typeof ctx.whatsappHref === 'function' ? ctx.whatsappHref() : 'https://wa.me/5598984402286');

  function renderChips() {
    if (!categorias || !categorias.length) { elChips.hidden = true; elChips.innerHTML = ''; return; }
    const total = categorias.reduce((s, c) => s + (Number(c.quantidade) || 0), 0);
    const chip = (slug, rotulo, qtd) => `<button type="button" class="lj-chip" data-cat="${esc(slug)}" aria-pressed="${estado.categoria === slug}">${rotulo}<small>(${qtd})</small></button>`;
    elChips.innerHTML = chip('', 'Todos', total)
      + categorias.map((c) => chip(c.slug, `${c.emoji ? `${esc(c.emoji)} ` : ''}${esc(c.nome)}`, Number(c.quantidade) || 0)).join('');
    elChips.hidden = false;
  }

  async function carregarCategorias() {
    if (carregandoCats || categorias) return;
    carregandoCats = true;
    try {
      const r = await listarCategorias();
      categorias = Array.isArray(r) ? r : [];
      renderChips();
      atualizarTitulo();
    } catch (e) {
      categorias = null;
    } finally {
      carregandoCats = false;
    }
  }

  function atualizarTitulo() {
    let t = 'Nossos produtos';
    if (estado.q) t = `Resultados para “${estado.q}”`;
    else if (estado.categoria && categorias) {
      const c = categorias.find((x) => x.slug === estado.categoria);
      if (c) t = c.nome;
    }
    elTit.textContent = t;
  }

  function sincronizarControles() {
    selOrdem.value = estado.ordem;
    chkPromo.checked = estado.promo;
    elChips.querySelectorAll('.lj-chip').forEach((b) => {
      const ativo = b.dataset.cat === estado.categoria;
      b.setAttribute('aria-pressed', String(ativo));
    });
    atualizarTitulo();
  }

  function rolarParaLista() {
    const cab = document.getElementById('lj-cab');
    const desloc = (cab ? cab.getBoundingClientRect().height : 0) + 12;
    const topo = q('.lj-ferramentas').getBoundingClientRect().top + window.scrollY - desloc;
    const reduzido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: Math.max(0, topo), behavior: reduzido ? 'auto' : 'smooth' });
    elInfo.focus({ preventScroll: true });
  }

  function htmlErro(e) {
    const msg = (e && e.message) ? e.message : 'Não foi possível carregar os produtos agora.';
    return `<div class="lj-erro" role="alert"><p>${esc(msg)}</p>
      <div class="lj-card-acoes">
        <button type="button" class="lj-btn lj-btn-peq" data-tentar>Tentar de novo</button>
        <a class="lj-btn lj-btn-sec lj-btn-peq" href="${esc(wa())}" target="_blank" rel="noopener">Falar no WhatsApp</a>
      </div></div>`;
  }

  async function atualizar(novo) {
    estado = normalizarEstado(novo);
    sincronizarControles();
    const minha = ++seq;
    elLista.setAttribute('aria-busy', 'true');
    elLista.innerHTML = esqueleto();
    elInfo.textContent = 'Carregando produtos…';
    elPag.innerHTML = '';
    if (!categorias) carregarCategorias();
    try {
      const r = await listarProdutos({
        busca: estado.q, categoria: estado.categoria, ordem: estado.ordem,
        pagina: estado.pagina, somentePromocao: estado.promo
      });
      if (minha !== seq) return;
      if (Number(r.pagina) !== estado.pagina) {
        estado.pagina = Number(r.pagina) || 1;
        if (typeof ctx.corrigirPagina === 'function') ctx.corrigirPagina(estado.pagina);
      }
      const itens = Array.isArray(r.itens) ? r.itens : [];
      porId = new Map(itens.map((p) => [p.id, p]));
      if (!itens.length) {
        elInfo.textContent = 'Nenhum produto encontrado.';
        elLista.innerHTML = `<div class="lj-caixa"><p><strong>Nenhum produto encontrado</strong></p>
          <p>Tente outras palavras ou veja todos os produtos.</p>
          <button type="button" class="lj-btn lj-btn-peq" data-limpar>Limpar filtros</button></div>`;
      } else {
        elInfo.textContent = `Mostrando ${r.de}–${r.ate} de ${r.total} ${Number(r.total) === 1 ? 'produto' : 'produtos'}`;
        elLista.innerHTML = `<ul class="lj-grade">${itens.map((p) => htmlCartao(p, ctx.linkProduto)).join('')}</ul>`;
        elPag.innerHTML = htmlPaginacao(r);
      }
      elLista.setAttribute('aria-busy', 'false');
      if (paginaAnterior !== null && paginaAnterior !== estado.pagina) rolarParaLista();
      paginaAnterior = estado.pagina;
      const cat = categorias ? categorias.find((c) => c.slug === estado.categoria) : null;
      if (typeof ctx.aoCarregar === 'function') ctx.aoCarregar({ resposta: r, categoria: cat || null, estado: { ...estado } });
    } catch (e) {
      if (minha !== seq) return;
      elInfo.textContent = '';
      elLista.setAttribute('aria-busy', 'false');
      elLista.innerHTML = htmlErro(e);
    }
  }

  alvo.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-cat],[data-pagina],[data-add],[data-limpar],[data-tentar],a[data-slug]');
    if (!t || !alvo.contains(t)) return;
    if (t.matches('a[data-slug]')) {
      if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      ev.preventDefault();
      ctx.abrirProduto(t.dataset.slug);
    } else if (t.hasAttribute('data-cat')) {
      ctx.navegar({ categoria: t.dataset.cat });
      t.scrollIntoView({ block: 'nearest', inline: 'center' });
    } else if (t.hasAttribute('data-pagina')) {
      if (!t.disabled) ctx.navegar({ pagina: Number(t.dataset.pagina) });
    } else if (t.hasAttribute('data-add')) {
      const p = porId.get(t.dataset.add);
      if (p) adicionarComAviso({ id: p.id, nome: p.nome, preco: p.preco, max: maxConhecido(p) }, 1);
    } else if (t.hasAttribute('data-limpar')) {
      ctx.navegar({ q: '', categoria: '', ordem: 'relevancia', promo: false, pagina: 1 });
    } else if (t.hasAttribute('data-tentar')) {
      atualizar(estado);
    }
  });
  selOrdem.addEventListener('change', () => ctx.navegar({ ordem: selOrdem.value }));
  chkPromo.addEventListener('change', () => ctx.navegar({ promo: chkPromo.checked }));

  carregarCategorias();

  return {
    atualizar,
    destruir() { seq += 1; }
  };
}
