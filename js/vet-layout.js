// Pet Natureza - Consulta Veterinária
// Cabeçalho, menu, rodapé e dados de contato (empresa/redes).
// Independente de js/site.js. Lê settings_published por REST (leitura pública).

import { esc, formatarTelefone } from '../admin/js/vet-calculo.js';

const ZAP_PADRAO = '5598984402286';

const LINKS = [
  ['Início', '../index.html#topo'],
  ['Produtos', '../loja/'],
  ['Banho & Tosa', '../banho-e-tosa/'],
  ['Consultas Veterinárias', './'],
  ['Sobre Nós', '../index.html#sobre'],
  ['Contato', '../index.html#contato']
];

let empresa = {
  nome: 'Pet Natureza', slogan: '', whatsapp: ZAP_PADRAO,
  email: '', endereco: '', horarios: ''
};
let redes = [];

// ---------- WhatsApp ----------
export function whatsappAtual() {
  return empresa.whatsapp;
}

export function linkWhatsApp(mensagem) {
  const base = 'https://wa.me/' + empresa.whatsapp;
  return mensagem ? base + '?text=' + encodeURIComponent(mensagem) : base;
}

// Atualiza todos os links [data-zap] (use data-zap-msg para a mensagem).
export function atualizarLinksWhatsApp(raiz) {
  (raiz || document).querySelectorAll('a[data-zap]').forEach((a) => {
    a.href = linkWhatsApp(a.getAttribute('data-zap-msg') || '');
    a.target = '_blank';
    a.rel = 'noopener';
  });
}

// ---------- Leitura de empresa e redes ----------
async function lerPublicadas() {
  let cfg;
  try {
    cfg = await import('../admin/js/config.js');
  } catch (e) {
    return null;
  }
  const url = String(cfg.SUPABASE_URL || '');
  const chave = String(cfg.SUPABASE_ANON_KEY || '');
  if (!url || !chave || /SEU-PROJETO|COLE-AQUI/.test(url + chave)) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const r = await fetch(
      url.replace(/\/+$/, '') + '/rest/v1/settings_published?select=key,value&key=in.(empresa,redes)',
      { headers: { apikey: chave, Authorization: 'Bearer ' + chave }, signal: ctrl.signal }
    );
    if (!r.ok) return null;
    const dados = await r.json();
    return Array.isArray(dados) ? dados : null;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function rotuloRede(k) {
  const mapa = {
    instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok',
    youtube: 'YouTube', x: 'X', twitter: 'X', linkedin: 'LinkedIn'
  };
  const chave = String(k || '').toLowerCase();
  return mapa[chave] || (chave.charAt(0).toUpperCase() + chave.slice(1));
}

// Aceita objeto {instagram:'https://…'}, objeto de objetos {url,nome,ativo} ou lista.
function listarRedes(r) {
  const saida = [];
  const adicionar = (nome, url, ativo) => {
    const u = String(url || '').trim();
    if (ativo === false || !/^https:\/\/\S+$/i.test(u) || saida.length >= 8) return;
    saida.push({ nome: String(nome || '').trim() || 'Rede social', url: u });
  };
  if (Array.isArray(r)) {
    r.forEach((x) => {
      if (x && typeof x === 'object') adicionar(x.nome || x.rede, x.url || x.link, x.ativo);
    });
  } else if (r && typeof r === 'object') {
    Object.keys(r).forEach((k) => {
      const v = r[k];
      if (typeof v === 'string') adicionar(rotuloRede(k), v);
      else if (v && typeof v === 'object') adicionar(v.nome || rotuloRede(k), v.url || v.link, v.ativo);
    });
  }
  return saida;
}

function aplicarDados(linhas) {
  linhas.forEach((linha) => {
    if (!linha || typeof linha !== 'object') return;
    const v = linha.value;
    if (linha.key === 'empresa' && v && typeof v === 'object') {
      ['nome', 'slogan', 'email', 'endereco'].forEach((c) => {
        if (typeof v[c] === 'string' && v[c].trim()) empresa[c] = v[c].trim();
      });
      if (typeof v.horarios === 'string' && v.horarios.trim()) {
        empresa.horarios = v.horarios.trim();
      } else if (Array.isArray(v.horarios)) {
        const t = v.horarios.filter((x) => typeof x === 'string' && x.trim()).join('; ');
        if (t) empresa.horarios = t;
      }
      const d = String(v.whatsapp || '').replace(/\D/g, '');
      if (/^\d{10,15}$/.test(d)) empresa.whatsapp = d;
    } else if (linha.key === 'redes') {
      redes = listarRedes(v);
    }
  });
}

// ---------- Cabeçalho e menu ----------
function itensMenu(atual) {
  return LINKS.map(([rotulo, href]) =>
    '<li><a href="' + esc(href) + '"' + (href === atual ? ' aria-current="page"' : '') + '>' +
    esc(rotulo) + '</a></li>'
  ).join('');
}

function montarCabecalho() {
  const cab = document.getElementById('cab');
  if (!cab) return;
  cab.innerHTML =
    '<div class="cont cab-interno">' +
      '<a class="logo-link" href="../index.html#topo">' +
        '<img src="../assets/logo-site.png" alt="Pet Natureza" width="103" height="48"></a>' +
      '<a class="btn btn-escuro btn-pequeno" href="' + esc(linkWhatsApp('')) + '" data-zap ' +
        'target="_blank" rel="noopener">WhatsApp</a>' +
      '<button class="btn-menu" id="b-menu" type="button" aria-expanded="false" ' +
        'aria-controls="menu" aria-label="Abrir menu">☰</button>' +
      '<nav class="menu" id="menu" aria-label="Principal">' +
        '<button class="menu-fechar" id="b-fechar" type="button" aria-label="Fechar menu">✕</button>' +
        '<ul>' + itensMenu('./') + '</ul>' +
      '</nav>' +
    '</div>' +
    '<div class="fundo-menu" id="fundo-menu" hidden></div>';

  const menu = document.getElementById('menu');
  const botao = document.getElementById('b-menu');
  const fechar = document.getElementById('b-fechar');
  const fundo = document.getElementById('fundo-menu');

  const aberto = () => menu.classList.contains('aberto');

  function abrir() {
    menu.classList.add('aberto');
    botao.setAttribute('aria-expanded', 'true');
    fundo.hidden = false;
    fechar.focus();
  }

  function fecharMenu(voltarFoco) {
    menu.classList.remove('aberto');
    botao.setAttribute('aria-expanded', 'false');
    fundo.hidden = true;
    if (voltarFoco) botao.focus();
  }

  botao.addEventListener('click', () => (aberto() ? fecharMenu(true) : abrir()));
  fechar.addEventListener('click', () => fecharMenu(true));
  fundo.addEventListener('click', () => fecharMenu(true));
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => fecharMenu(false)));

  document.addEventListener('keydown', (ev) => {
    if (!aberto()) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      fecharMenu(true);
      return;
    }
    if (ev.key === 'Tab') {
      const itens = Array.from(menu.querySelectorAll('a[href], button'));
      if (!itens.length) return;
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
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

// ---------- Rodapé ----------
function montarRodape() {
  const el = document.getElementById('rodape');
  if (!el) return;

  const contato = [];
  contato.push(
    '<li><a href="' + esc(linkWhatsApp('')) + '" data-zap target="_blank" rel="noopener">WhatsApp: ' +
    esc(formatarTelefone(empresa.whatsapp)) + '</a></li>'
  );
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(empresa.email)) {
    contato.push('<li><a href="mailto:' + esc(empresa.email) + '">' + esc(empresa.email) + '</a></li>');
  }
  if (empresa.endereco) {
    contato.push('<li>' + esc(empresa.endereco).replace(/\n/g, '<br>') + '</li>');
  }
  if (empresa.horarios) {
    contato.push('<li>' + esc(empresa.horarios).replace(/\n/g, '<br>') + '</li>');
  }

  const blocoRedes = redes.length
    ? '<div><p><strong>Redes sociais</strong></p><ul>' +
      redes.map((r) =>
        '<li><a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.nome) + '</a></li>'
      ).join('') + '</ul></div>'
    : '';

  el.innerHTML =
    '<div class="cont rodape-grade">' +
      '<div><img src="../assets/logo-site.png" alt="Pet Natureza" width="103" height="48">' +
        (empresa.slogan ? '<p>' + esc(empresa.slogan) + '</p>' : '') + '</div>' +
      '<nav aria-label="Rodapé"><p><strong>Navegação</strong></p><ul>' + itensMenu('./') + '</ul></nav>' +
      '<div><p><strong>Contato</strong></p><ul>' + contato.join('') + '</ul></div>' +
      blocoRedes +
    '</div>' +
    '<p class="cont copy">© ' + new Date().getFullYear() + ' ' + esc(empresa.nome) +
    '. <a href="../privacidade.html">Política de Privacidade</a></p>';
}

// ---------- Inicialização ----------
// Promise que nunca rejeita: { empresa, redes, carregou }
export const pronto = (async () => {
  let carregou = false;
  try {
    montarCabecalho();
    montarRodape();
    atualizarLinksWhatsApp();
    const linhas = await lerPublicadas();
    if (linhas) {
      aplicarDados(linhas);
      carregou = true;
      montarRodape();
      atualizarLinksWhatsApp();
    }
  } catch (e) {
    /* mantém os padrões */
  }
  return { empresa, redes, carregou };
})();
