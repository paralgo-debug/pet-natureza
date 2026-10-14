// Pet Natureza - Loja: cabeçalho, rodapé, menu e avisos (não depende de site.js)
import {
  carregarEmpresa, EMPRESA_PADRAO, esc, debounce, formatarWhatsApp, linkWhatsApp
} from './loja-api.js';
import { assinar, totalUnidades } from './loja-carrinho.js';

const SVG = (corpo) => `<svg class="lj-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${corpo}</svg>`;
const ICO_BUSCA = SVG('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>');
const ICO_CARRINHO = SVG('<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L21 7H6"/>');
const ICO_MENU = SVG('<path d="M4 6h16M4 12h16M4 18h16"/>');

const MSG_WA = 'Olá! Vim pela loja do site e gostaria de ajuda.';
const REDES = [
  ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['threads', 'Threads'], ['tiktok', 'TikTok']
];

// ---------- Avisos rápidos ----------
let caixaToast = null;

function garantirCaixaToast() {
  if (caixaToast && document.body.contains(caixaToast)) return caixaToast;
  caixaToast = document.createElement('div');
  caixaToast.className = 'lj-toasts';
  caixaToast.setAttribute('role', 'status');
  caixaToast.setAttribute('aria-live', 'polite');
  document.body.appendChild(caixaToast);
  return caixaToast;
}

export function toast(mensagem, tipo = 'ok') {
  const caixa = garantirCaixaToast();
  const el = document.createElement('div');
  el.className = tipo === 'erro' ? 'lj-toast lj-toast-erro' : 'lj-toast';
  el.textContent = String(mensagem || '');
  caixa.appendChild(el);
  setTimeout(() => el.remove(), tipo === 'erro' ? 5500 : 3500);
}

// ---------- HTML ----------
function htmlCabecalho(whats) {
  return `
  <div class="cab-interno cont">
    <a class="logo-link" href="../index.html#topo" aria-label="Pet Natureza, página inicial">
      <img src="../assets/logo-site.png" alt="Pet Natureza">
    </a>
    <nav class="menu" id="lj-menu" aria-label="Principal">
      <button type="button" class="menu-fechar" id="lj-menu-fechar" aria-label="Fechar menu">&times;</button>
      <a href="../index.html#topo">Início</a>
      <a href="./" aria-current="page">Produtos</a>
      <a href="../index.html#sobre">Sobre</a>
      <a href="../index.html#contato">Contato</a>
      <a class="btn btn-amarelo btn-pequeno" id="lj-wa-cab" href="${esc(linkWhatsApp(whats, MSG_WA))}" target="_blank" rel="noopener">WhatsApp</a>
    </nav>
    <form class="lj-busca" id="lj-form-busca" role="search">
      <label class="sr-only" for="lj-busca-campo">Buscar produtos</label>
      <input type="search" id="lj-busca-campo" name="q" placeholder="Buscar produtos" autocomplete="off" enterkeyhint="search" maxlength="100">
      <button type="submit" aria-label="Buscar">${ICO_BUSCA}</button>
    </form>
    <div class="lj-cab-acoes">
      <button type="button" class="lj-carrinho-btn" id="lj-btn-carrinho" aria-haspopup="dialog" aria-label="Abrir carrinho, vazio">
        ${ICO_CARRINHO}<span class="lj-contador" id="lj-contador" aria-hidden="true" hidden>0</span>
      </button>
      <button type="button" class="btn-menu" id="lj-btn-menu" aria-expanded="false" aria-controls="lj-menu" aria-label="Abrir menu">${ICO_MENU}</button>
    </div>
  </div>`;
}

function textoComQuebras(v) {
  return esc(v).replace(/\r?\n/g, '<br>');
}

function urlRede(redes, chave) {
  const u = String((redes && redes[`${chave}_url`]) || '').trim();
  return /^https:\/\/\S+$/i.test(u) ? u : '';
}

function htmlRodape(emp, redes) {
  const ano = new Date().getFullYear();
  const nome = emp.nome || EMPRESA_PADRAO.nome;
  const email = String(emp.email || '').trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const links = REDES
    .map(([chave, rotulo]) => [rotulo, urlRede(redes, chave)])
    .filter(([, url]) => url)
    .map(([rotulo, url]) => `<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(rotulo)}</a></li>`)
    .join('');
  return `
  <div class="cont rodape-grade">
    <div>
      <img src="../assets/logo-site.png" alt="${esc(nome)}">
      ${emp.slogan ? `<p>${esc(emp.slogan)}</p>` : ''}
    </div>
    <nav aria-label="Rodapé">
      <h2>Navegação</h2>
      <ul>
        <li><a href="../index.html#topo">Início</a></li>
        <li><a href="./">Produtos</a></li>
        <li><a href="../index.html#sobre">Sobre</a></li>
        <li><a href="../index.html#contato">Contato</a></li>
      </ul>
    </nav>
    <div>
      <h2>Contato</h2>
      <ul>
        <li><a href="${esc(linkWhatsApp(emp.whatsapp, MSG_WA))}" target="_blank" rel="noopener">WhatsApp: ${esc(formatarWhatsApp(emp.whatsapp))}</a></li>
        ${emailOk ? `<li><a href="mailto:${esc(email)}">${esc(email)}</a></li>` : ''}
        ${emp.endereco ? `<li>${textoComQuebras(emp.endereco)}</li>` : ''}
        ${emp.horarios ? `<li>${textoComQuebras(emp.horarios)}</li>` : ''}
      </ul>
    </div>
    ${links ? `<div><h2>Redes sociais</h2><ul>${links}</ul></div>` : ''}
  </div>
  <p class="copy cont">&copy; ${ano} ${esc(nome)}. Todos os direitos reservados. <a href="../privacidade.html">Política de Privacidade</a></p>`;
}

// ---------- Montagem ----------
export function montarLayout(opc = {}) {
  const aoBuscar = typeof opc.aoBuscar === 'function' ? opc.aoBuscar : () => {};
  const aoAbrirCarrinho = typeof opc.aoAbrirCarrinho === 'function' ? opc.aoAbrirCarrinho : () => {};

  const cab = document.getElementById('lj-cab');
  const rod = document.getElementById('lj-rodape');
  let empresa = { ...EMPRESA_PADRAO };
  let redes = {};

  garantirCaixaToast();
  cab.innerHTML = htmlCabecalho(empresa.whatsapp);
  rod.innerHTML = htmlRodape(empresa, redes);

  const menu = document.getElementById('lj-menu');
  const btnMenu = document.getElementById('lj-btn-menu');
  const btnFechar = document.getElementById('lj-menu-fechar');
  const form = document.getElementById('lj-form-busca');
  const campo = document.getElementById('lj-busca-campo');
  const btnCarrinho = document.getElementById('lj-btn-carrinho');
  const contador = document.getElementById('lj-contador');

  const fundo = document.createElement('div');
  fundo.className = 'fundo-menu';
  cab.insertAdjacentElement('afterend', fundo);

  // altura do cabeçalho -> espaço no topo da página
  const ajustarAltura = () => {
    document.body.style.setProperty('--lj-cab', `${Math.ceil(cab.getBoundingClientRect().height)}px`);
  };
  ajustarAltura();
  if ('ResizeObserver' in window) new ResizeObserver(ajustarAltura).observe(cab);
  else window.addEventListener('resize', ajustarAltura);

  // menu hambúrguer
  const mq = window.matchMedia('(min-width: 960px)');
  const menuAberto = () => menu.classList.contains('aberto');
  const sincronizarInert = () => { menu.inert = !mq.matches && !menuAberto(); };

  function abrirMenu() {
    menu.classList.add('aberto');
    fundo.classList.add('aberto');
    btnMenu.setAttribute('aria-expanded', 'true');
    sincronizarInert();
    btnFechar.focus();
  }

  function fecharMenu(devolverFoco) {
    const estavaAberto = menuAberto();
    menu.classList.remove('aberto');
    fundo.classList.remove('aberto');
    btnMenu.setAttribute('aria-expanded', 'false');
    sincronizarInert();
    if (estavaAberto && devolverFoco) btnMenu.focus();
  }

  btnMenu.addEventListener('click', () => (menuAberto() ? fecharMenu(true) : abrirMenu()));
  btnFechar.addEventListener('click', () => fecharMenu(true));
  fundo.addEventListener('click', () => fecharMenu(true));
  menu.addEventListener('click', (ev) => {
    if (ev.target.closest('a')) fecharMenu(false);
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && menuAberto()) fecharMenu(true);
  });
  menu.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Tab' || !menuAberto() || mq.matches) return;
    const itens = Array.from(menu.querySelectorAll('a[href], button:not([disabled])'));
    if (!itens.length) return;
    const primeiro = itens[0];
    const ultimo = itens[itens.length - 1];
    if (ev.shiftKey && document.activeElement === primeiro) { ev.preventDefault(); ultimo.focus(); }
    else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primeiro.focus(); }
  });
  const aoMudarTela = () => {
    if (mq.matches) fecharMenu(false);
    sincronizarInert();
  };
  if (mq.addEventListener) mq.addEventListener('change', aoMudarTela);
  else mq.addListener(aoMudarTela);
  sincronizarInert();

  // busca (com atraso e Enter)
  let ultimoTermo = '';
  const emitirBusca = (valor) => {
    const termo = String(valor || '').trim();
    if (termo === ultimoTermo) return;
    ultimoTermo = termo;
    aoBuscar(termo);
  };
  const emitirComAtraso = debounce(() => emitirBusca(campo.value), 300);
  campo.addEventListener('input', emitirComAtraso);
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    emitirBusca(campo.value);
    campo.blur();
  });

  // carrinho
  const atualizarContador = (n) => {
    contador.textContent = n > 99 ? '99+' : String(n);
    contador.hidden = n === 0;
    btnCarrinho.setAttribute('aria-label', n === 0
      ? 'Abrir carrinho, vazio'
      : `Abrir carrinho, ${n} ${n === 1 ? 'unidade' : 'unidades'}`);
  };
  atualizarContador(totalUnidades());
  assinar(() => atualizarContador(totalUnidades()));
  btnCarrinho.addEventListener('click', () => aoAbrirCarrinho(btnCarrinho));

  // dados da empresa e redes (sem bloquear a página)
  const pronto = carregarEmpresa().then((dados) => {
    empresa = dados.empresa;
    redes = dados.redes;
    const wa = document.getElementById('lj-wa-cab');
    if (wa) wa.href = linkWhatsApp(empresa.whatsapp, MSG_WA);
    rod.innerHTML = htmlRodape(empresa, redes);
    return empresa;
  });

  return {
    pronto,
    empresa: () => empresa,
    botaoCarrinho: btnCarrinho,
    definirBusca(texto) {
      const t = String(texto || '');
      campo.value = t;
      ultimoTermo = t.trim();
    }
  };
        }
