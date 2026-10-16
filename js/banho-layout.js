// PET NATUREZA - Banho & Tosa - cabeçalho, rodapé e ajuda fixa.
// Roda sozinho (não depende de js/site.js) e exporta utilitários para js/banho.js.

const ZAP_PADRAO = '5598984402286';
const URL_SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const MENU = [
  ['Início', '../index.html#topo'],
  ['Produtos', '../index.html#acoes'],
  ['Banho & Tosa', './'],
  ['Consultas Veterinárias', '../consulta-veterinaria/'],
  ['Sobre Nós', '../index.html#sobre'],
  ['Contato', '../index.html#contato']
];

const REDES = [
  ['instagram', 'Instagram'],
  ['facebook', 'Facebook'],
  ['threads', 'Threads'],
  ['tiktok', 'TikTok']
];

const PADRAO = {
  empresa: { nome: 'Pet Natureza', slogan: '', descricao: '', whatsapp: ZAP_PADRAO, email: '', endereco: '', horarios: '' },
  redes: {}
};

// ---------------------------------------------------------------------
// Utilitários exportados
// ---------------------------------------------------------------------
export function soDigitos(v) {
  return String(v === null || v === undefined ? '' : v).replace(/\D/g, '');
}

export function numeroWhatsApp(v) {
  const d = soDigitos(v);
  return /^55\d{10,11}$/.test(d) ? d : ZAP_PADRAO;
}

export function linkWhatsApp(numero, texto) {
  const base = 'https://wa.me/' + numeroWhatsApp(numero);
  return texto ? base + '?text=' + encodeURIComponent(texto) : base;
}

export function formatarTelefoneBR(valor) {
  let d = soDigitos(valor);
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  return d;
}

// ---------------------------------------------------------------------
// Cliente Supabase (somente leitura pública; sem guardar sessão)
// Devolve null se config.js ainda tiver os textos de exemplo ou falhar.
// ---------------------------------------------------------------------
let promessaCliente = null;

export function obterSupabase() {
  if (!promessaCliente) promessaCliente = criarCliente();
  return promessaCliente;
}

async function criarCliente() {
  try {
    const cfg = await import('../admin/js/config.js');
    const url = String(cfg.SUPABASE_URL || '');
    const chave = String(cfg.SUPABASE_ANON_KEY || '');
    if (!/^https:\/\//i.test(url) || !chave || /SEU-PROJETO|COLE-AQUI/i.test(url + chave)) return null;
    const lib = await import(URL_SUPABASE_JS);
    return lib.createClient(url, chave, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
  } catch (e) {
    return null;
  }
}

function comTempo(promessa, ms) {
  return Promise.race([
    promessa,
    new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error('tempo esgotado')), ms))
  ]);
}

// ---------------------------------------------------------------------
// Dados do site (empresa e redes), com valores padrão se a leitura falhar
// ---------------------------------------------------------------------
function mesclarTextos(base, extra) {
  const saida = { ...base };
  if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
    for (const k of Object.keys(extra)) {
      const v = extra[k];
      if (typeof v === 'string' && v.trim() !== '') saida[k] = v.trim();
      else if (typeof v === 'number' && Number.isFinite(v)) saida[k] = String(v);
    }
  }
  return saida;
}

async function carregarDados() {
  let empresa = { ...PADRAO.empresa };
  let redes = {};
  try {
    const cliente = await obterSupabase();
    if (!cliente) return { empresa, redes };
    const { data, error } = await comTempo(
      cliente.from('settings_published').select('key,value').in('key', ['empresa', 'redes']),
      8000
    );
    if (error || !Array.isArray(data)) return { empresa, redes };
    for (const linha of data) {
      if (linha.key === 'empresa') empresa = mesclarTextos(PADRAO.empresa, linha.value);
      if (linha.key === 'redes') redes = mesclarTextos({}, linha.value);
    }
  } catch (e) {
    /* mantém os padrões */
  }
  return { empresa, redes };
}

export const dadosSite = carregarDados();

// ---------------------------------------------------------------------
// Construção do HTML (sempre com textContent / setAttribute)
// ---------------------------------------------------------------------
function el(tag, attrs, filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'texto') n.textContent = v;
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const f of filhos || []) n.append(f);
  return n;
}

function linhas(tag, texto) {
  const n = el(tag);
  String(texto).split(/\r?\n/).forEach((parte, i) => {
    if (i > 0) n.append(document.createElement('br'));
    n.append(document.createTextNode(parte));
  });
  return n;
}

function urlSegura(v) {
  return typeof v === 'string' && /^https:\/\/[^\s]+$/i.test(v.trim()) ? v.trim() : '';
}

function montarCabecalho(zap) {
  const alvo = document.getElementById('cabecalho');
  if (!alvo) return;

  const itens = MENU.map(([rotulo, href]) =>
    el('li', {}, [el('a', { href, texto: rotulo, 'aria-current': href === './' ? 'page' : null })])
  );

  const dentro = el('div', { class: 'cont cab-interno' }, [
    el('a', { class: 'logo-link', href: '../index.html#topo' }, [
      el('img', { src: '../assets/logo-site.png', alt: 'Pet Natureza', width: '103', height: '48' })
    ]),
    el('a', {
      class: 'btn btn-escuro btn-pequeno', id: 'cab-zap', href: linkWhatsApp(zap),
      target: '_blank', rel: 'noopener', texto: 'WhatsApp'
    }),
    el('button', {
      class: 'btn-menu', id: 'b-menu', type: 'button', 'aria-expanded': 'false',
      'aria-controls': 'menu', 'aria-label': 'Abrir menu', texto: '☰'
    }),
    el('nav', { class: 'menu', id: 'menu', 'aria-label': 'Principal' }, [
      el('button', { class: 'menu-fechar', id: 'b-fechar', type: 'button', 'aria-label': 'Fechar menu', texto: '✕' }),
      el('ul', {}, itens)
    ])
  ]);

  const fundo = el('div', { class: 'fundo-menu', id: 'fundo-menu', hidden: true });
  alvo.replaceChildren(dentro, fundo);
  ligarMenu();
}

function ligarMenu() {
  const botao = document.getElementById('b-menu');
  const menu = document.getElementById('menu');
  const fechar = document.getElementById('b-fechar');
  const fundo = document.getElementById('fundo-menu');
  if (!botao || !menu || !fechar || !fundo) return;

  const aberto = () => menu.classList.contains('aberto');

  function abrir() {
    menu.classList.add('aberto');
    fundo.hidden = false;
    botao.setAttribute('aria-expanded', 'true');
    fechar.focus();
  }

  function fecharMenu(voltarFoco) {
    menu.classList.remove('aberto');
    fundo.hidden = true;
    botao.setAttribute('aria-expanded', 'false');
    if (voltarFoco) botao.focus();
  }

  botao.addEventListener('click', () => (aberto() ? fecharMenu(true) : abrir()));
  fechar.addEventListener('click', () => fecharMenu(true));
  fundo.addEventListener('click', () => fecharMenu(true));
  menu.addEventListener('click', (ev) => {
    if (ev.target.closest('a')) fecharMenu(false);
  });

  document.addEventListener('keydown', (ev) => {
    if (!aberto()) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      fecharMenu(true);
      return;
    }
    if (ev.key === 'Tab') {
      const focaveis = Array.from(menu.querySelectorAll('a[href], button')).filter((n) => !n.disabled);
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (ev.shiftKey && document.activeElement === primeiro) {
        ev.preventDefault();
        ultimo.focus();
      } else if (!ev.shiftKey && document.activeElement === ultimo) {
        ev.preventDefault();
        primeiro.focus();
      }
    }
  });
}

function montarRodape(dados) {
  const alvo = document.getElementById('rodape');
  if (!alvo) return;
  const e = dados.empresa;
  const r = dados.redes;

  // Marca
  const colMarca = el('div', {}, [
    el('img', { src: '../assets/logo-site.png', alt: e.nome, width: '103', height: '48' })
  ]);
  if (e.slogan) colMarca.append(el('p', { texto: e.slogan }));

  // Navegação
  const colNav = el('nav', { 'aria-label': 'Rodapé' }, [
    el('p', {}, [el('strong', { texto: 'Navegação' })]),
    el('ul', {}, MENU.map(([rotulo, href]) => el('li', {}, [el('a', { href, texto: rotulo })])))
  ]);

  // Contato
  const colContato = el('div', {}, [el('p', {}, [el('strong', { texto: 'Contato' })])]);
  colContato.append(el('p', {}, [
    el('a', {
      href: linkWhatsApp(e.whatsapp), target: '_blank', rel: 'noopener',
      texto: 'WhatsApp ' + formatarTelefoneBR(numeroWhatsApp(e.whatsapp))
    })
  ]));
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email)) {
    colContato.append(el('p', {}, [el('a', { href: 'mailto:' + e.email, texto: e.email })]));
  }
  if (e.endereco) colContato.append(linhas('p', e.endereco));
  if (e.horarios) colContato.append(linhas('p', e.horarios));

  const colunas = [colMarca, colNav, colContato];

  // Redes sociais (só as que têm link seguro)
  const itensRedes = [];
  for (const [chave, rotulo] of REDES) {
    const url = urlSegura(r[chave + '_url']) || urlSegura(r[chave]);
    if (url) {
      itensRedes.push(el('li', {}, [el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', texto: rotulo })]));
    }
  }
  if (itensRedes.length > 0) {
    colunas.push(el('div', {}, [
      el('p', {}, [el('strong', { texto: 'Redes sociais' })]),
      el('ul', {}, itensRedes)
    ]));
  }

  const copy = el('p', { class: 'copy' }, [
    document.createTextNode('© ' + new Date().getFullYear() + ' ' + e.nome + '. '),
    el('a', { href: '../privacidade.html', texto: 'Política de Privacidade' })
  ]);

  alvo.replaceChildren(el('div', { class: 'cont' }, [el('div', { class: 'rodape-grade' }, colunas), copy]));
}

// ---------------------------------------------------------------------
// Início: monta com padrões e atualiza quando os dados chegarem
// ---------------------------------------------------------------------
montarCabecalho(ZAP_PADRAO);
montarRodape(PADRAO);

dadosSite.then((dados) => {
  const zap = numeroWhatsApp(dados.empresa.whatsapp);
  const cab = document.getElementById('cab-zap');
  if (cab) cab.setAttribute('href', linkWhatsApp(zap));
  const ajuda = document.getElementById('ajuda-link');
  if (ajuda) ajuda.setAttribute('href', linkWhatsApp(zap));
  montarRodape(dados);
});
