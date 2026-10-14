// Pet Natureza - Painel: Loja (rota #/produtos) com abas por ?aba=
import { esc } from './util.js';
import { carregarCss, paramsAba } from './loja-util.js';

const ABAS = [
  ['pedidos', 'Pedidos', './loja-pedidos.js', 'viewPedidos', false],
  ['produtos', 'Produtos', './loja-produtos.js', 'viewProdutos', true],
  ['categorias', 'Categorias', './loja-categorias.js', 'viewCategorias', true],
  ['estoque', 'Estoque', './loja-estoque.js', 'viewEstoque', false]
];

export async function viewLoja(alvo, ctx) {
  carregarCss();
  const visiveis = ABAS.filter((a) => ctx.ehAdmin || !a[4]);
  let aba = paramsAba().get('aba') || 'pedidos';
  if (!visiveis.some((a) => a[0] === aba)) aba = 'pedidos';
  const atual = visiveis.find((a) => a[0] === aba);

  alvo.innerHTML = `
    <div class="cab-pagina">
      <h1>Loja</h1>
      <p class="suave">Pedidos, produtos, categorias e estoque da loja virtual.</p>
    </div>
    <nav class="lj-abas" aria-label="Seções da loja">
      ${visiveis.map(([k, r]) => `<a class="lj-aba" href="#/produtos?aba=${k}"${k === aba ? ' aria-current="page"' : ''}>${esc(r)}</a>`).join('')}
    </nav>
    <div class="lj-aba-conteudo" id="lj-aba-conteudo"><p class="carregando">Carregando…</p></div>`;

  const dentro = alvo.querySelector('#lj-aba-conteudo');
  try {
    const mod = await import(atual[2]);
    if (typeof mod[atual[3]] !== 'function') throw new Error('Seção incompleta.');
    await mod[atual[3]](dentro, ctx);
  } catch (e) {
    console.error('Loja:', e);
    dentro.innerHTML = `<div class="cartao"><p class="erro" role="alert">Não foi possível abrir esta seção.
      Confira se todos os arquivos da loja foram criados no GitHub e tente de novo.</p>
      <div class="acoes"><a class="btn" href="#/produtos?aba=${esc(aba)}">Tentar de novo</a></div></div>`;
  }
}
