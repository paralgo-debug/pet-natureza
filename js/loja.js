// Pet Natureza - Loja: entrada, rotas por query string e metadados da página
import { montarLayout } from './loja-layout.js';
import { criarCatalogo, normalizarEstado, estadoParaQuery, ESTADO_PADRAO } from './loja-catalogo.js';
import { montarProduto } from './loja-produto.js';
import { criarGaveta } from './loja-checkout.js';
import { linkWhatsApp } from './loja-api.js';

const SLUG_RE = /^[a-z0-9-]{1,120}$/;
const conteudo = document.getElementById('lj-conteudo');
const metaDesc = document.querySelector('meta[name="description"]');
const canonico = document.getElementById('lj-canonical');
const DESC_PADRAO = metaDesc ? (metaDesc.getAttribute('content') || '') : '';

let layout = null;
let montado = null;
let rotaAtual = 'catalogo';
let estadoCatalogo = { ...ESTADO_PADRAO };
let veioDoCatalogo = false;
let manterCampoBusca = false;

if (conteudo) conteudo.removeAttribute('aria-live');

function baseLoja() { return location.origin + location.pathname.replace(/index\.html$/, ''); }
function linkProduto(slug) { return `?produto=${encodeURIComponent(slug)}`; }
function urlCatalogo(estado) { return location.pathname + estadoParaQuery(estado); }
function whatsappHref() {
  const e = layout ? layout.empresa() : {};
  return linkWhatsApp(e.whatsapp, 'Olá! Preciso de ajuda com a loja do site.');
}

function definirMeta(titulo, desc, url) {
  document.title = titulo;
  if (metaDesc) metaDesc.setAttribute('content', desc || DESC_PADRAO);
  if (canonico) canonico.setAttribute('href', url);
}

function lerRota() {
  const p = new URLSearchParams(location.search);
  const slug = (p.get('produto') || '').trim().toLowerCase();
  if (slug && SLUG_RE.test(slug)) return { tipo: 'produto', slug };
  return {
    tipo: 'catalogo',
    estado: normalizarEstado({
      q: p.get('q') || '', categoria: p.get('categoria') || '', ordem: p.get('ordem') || 'relevancia',
      pagina: p.get('pagina') || 1, promo: p.get('promocao') === '1'
    })
  };
}

function desmontar() {
  if (!montado) return;
  try { montado.inst.destruir(); } catch (e) { /* ignora */ }
  montado.caixa.remove();
  montado = null;
}

function novaCaixa() {
  const c = document.createElement('div');
  conteudo.replaceChildren(c);
  return c;
}

function navegar(patch, substituir = false) {
  const trocaPagina = Object.prototype.hasOwnProperty.call(patch, 'pagina');
  const novo = normalizarEstado({ ...estadoCatalogo, ...patch, pagina: trocaPagina ? patch.pagina : 1 });
  const url = urlCatalogo(novo);
  if (rotaAtual === 'catalogo' && url === location.pathname + location.search) {
    estadoCatalogo = novo;
    return;
  }
  estadoCatalogo = novo;
  history[substituir && rotaAtual === 'catalogo' ? 'replaceState' : 'pushState'](null, '', url);
  renderizarRota();
}

function abrirProduto(slug) {
  veioDoCatalogo = rotaAtual === 'catalogo';
  history.pushState(null, '', location.pathname + linkProduto(slug));
  renderizarRota();
}

const ctxCatalogo = {
  navegar: (patch) => navegar(patch),
  abrirProduto,
  linkProduto,
  whatsappHref,
  corrigirPagina(n) {
    estadoCatalogo = { ...estadoCatalogo, pagina: n };
    history.replaceState(null, '', urlCatalogo(estadoCatalogo));
  },
  aoCarregar({ estado, categoria }) {
    let t = 'Loja | Pet Natureza';
    let d = DESC_PADRAO;
    if (estado.q) t = `Busca por “${estado.q}” | Loja Pet Natureza`;
    else if (categoria) {
      t = `${categoria.nome} | Loja Pet Natureza`;
      d = `${categoria.nome}: veja os produtos e faça seu pedido online na Pet Natureza.`;
    }
    if (estado.pagina > 1) t = `${t} (página ${estado.pagina})`;
    definirMeta(t, d, baseLoja() + estadoParaQuery(estado));
  }
};

const ctxProduto = {
  voltar() {
    if (veioDoCatalogo) { history.back(); return; }
    history.pushState(null, '', urlCatalogo(estadoCatalogo));
    renderizarRota();
  },
  hrefCatalogo: () => urlCatalogo(estadoCatalogo),
  abrirProduto,
  linkProduto,
  whatsappHref,
  aoCarregar(p) {
    if (!p) {
      definirMeta('Produto não encontrado | Pet Natureza', DESC_PADRAO, baseLoja());
      return;
    }
    const desc = String(p.descricao_curta || p.descricao || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    definirMeta(`${p.nome} | Pet Natureza`, desc, `${baseLoja()}?produto=${encodeURIComponent(p.slug)}`);
  }
};

function renderizarRota() {
  const r = lerRota();
  if (r.tipo === 'produto') {
    desmontar();
    rotaAtual = 'produto';
    const caixa = novaCaixa();
    montado = { tipo: 'produto', caixa, inst: montarProduto(caixa, r.slug, ctxProduto) };
    return;
  }
  estadoCatalogo = r.estado;
  if (!montado || montado.tipo !== 'catalogo') {
    desmontar();
    const caixa = novaCaixa();
    montado = { tipo: 'catalogo', caixa, inst: criarCatalogo(caixa, ctxCatalogo) };
  }
  rotaAtual = 'catalogo';
  if (layout && !manterCampoBusca) layout.definirBusca(r.estado.q);
  montado.inst.atualizar(r.estado);
}

const gaveta = criarGaveta({
  empresa: () => (layout ? layout.empresa() : {}),
  linkProduto,
  abrirProduto
});

layout = montarLayout({
  aoBuscar(termo) {
    manterCampoBusca = true;
    navegar({ q: termo }, true);
    manterCampoBusca = false;
  },
  aoAbrirCarrinho: (botao) => gaveta.abrir(botao)
});

window.addEventListener('popstate', renderizarRota);
renderizarRota();
