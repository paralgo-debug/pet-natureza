// PET NATUREZA - Banho & Tosa (painel) - abas e roteamento interno
import { esc, traduzirErro } from './util.js';

const ABAS = [
  ['solicitacoes', 'Solicitações'],
  ['agenda', 'Agenda'],
  ['precos', 'Serviços e preços']
];

function garantirCss() {
  if (document.getElementById('bt-admin-css')) return;
  const l = document.createElement('link');
  l.id = 'bt-admin-css';
  l.rel = 'stylesheet';
  l.href = 'css/banho.css';
  document.head.append(l);
}

function abaAtual() {
  const a = new URLSearchParams(location.hash.split('?')[1] || '').get('aba');
  return ABAS.some((x) => x[0] === a) ? a : 'solicitacoes';
}

export async function viewBanho(alvo, ctx) {
  garantirCss();
  const aba = abaAtual();
  const links = ABAS.map(([id, rotulo]) =>
    '<a class="bt-aba" href="#/banho-tosa?aba=' + id + '"' + (id === aba ? ' aria-current="page"' : '') + '>' + esc(rotulo) + '</a>'
  ).join('');

  alvo.innerHTML =
    '<div class="cab-pagina"><h1>Banho &amp; Tosa</h1></div>' +
    '<nav class="bt-abas" aria-label="Seções de Banho e Tosa">' + links + '</nav>' +
    '<div id="bt-conteudo"><p class="carregando">Carregando…</p></div>';
  const conteudo = alvo.querySelector('#bt-conteudo');

  const arquivos = {
    solicitacoes: ['./banho-solicitacoes.js', 'viewSolicitacoes'],
    agenda: ['./banho-agenda.js', 'viewAgenda'],
    precos: ['./banho-precos.js', 'viewPrecos']
  };
  const [arquivo, funcao] = arquivos[aba];

  let modulo;
  try {
    modulo = await import(arquivo);
  } catch (e) {
    conteudo.innerHTML = '<p class="nota">Não foi possível carregar esta aba. O arquivo <strong>' +
      esc(arquivo.replace('./', 'admin/js/')) + '</strong> pode ainda não ter sido criado ou está com erro.</p>';
    return;
  }

  try {
    await modulo[funcao](conteudo, ctx);
  } catch (e) {
    conteudo.innerHTML = '<p class="erro" role="alert">' + esc(traduzirErro(e)) + '</p>';
  }
}
