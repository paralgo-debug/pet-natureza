import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../admin/js/config.js';
import { PADRAO_EMPRESA, PADRAO_REDES, PADRAO_INICIO, MODULOS, mesclar } from '../admin/js/padroes.js';

const PAGINA = document.body.dataset.pagina || 'inicio';
const PREVIA = new URLSearchParams(location.search).has('previa');
const LOGO = 'assets/logo-site.png';
const BASE = PAGINA === 'inicio' ? '' : 'index.html';

// ---------- Utilitários ----------
const MAPA = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => MAPA[c]);
const digitos = (v) => String(v ?? '').replace(/\D/g, '');
const urlSegura = (u) => (/^https:\/\/[^\s"'<>]+$/.test(String(u ?? '').trim()) ? String(u).trim() : '');
const lista = (v) => (Array.isArray(v) ? v : []);

function zapLink(numero, mensagem) {
  const d = digitos(numero);
  if (!/^\d{10,15}$/.test(d)) return '';
  return `https://wa.me/${d}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ''}`;
}
function formatarZap(numero) {
  const m = digitos(numero).match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+55 ${m[1]} ${m[2]}-${m[3]}` : String(numero ?? '');
}
const paragrafos = (t) => String(t ?? '').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
const quebrasDeLinha = (t) => esc(t).replace(/\n/g, '<br>');

const ICONE_ZAP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-.8.7a3.6 3.6 0 0 1-1.8-1.8l.7-.8-1-2z" fill="currentColor" stroke="none"/></svg>';
const ICONE_INSTA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>';

// ---------- Carregar dados (publicados; na prévia, os rascunhos de quem está logado) ----------
async function carregar() {
  const r = { empresa: PADRAO_EMPRESA, redes: PADRAO_REDES, inicio: PADRAO_INICIO, previa: null };
  const configurado = !SUPABASE_URL.includes('SEU-PROJETO') && !SUPABASE_ANON_KEY.startsWith('COLE-AQUI');
  if (!configurado) return r;
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: PREVIA, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const chaves = ['empresa', 'redes', 'inicio'];
    const { data, error } = await sb.from('settings_published').select('key,value').in('key', chaves);
    if (error) throw error;
    const pub = Object.fromEntries((data || []).map((x) => [x.key, x.value]));

    let rasc = {};
    if (PREVIA) {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) r.previa = 'sem-login';
      else {
        const d = await sb.from('settings_draft').select('key,value').in('key', chaves);
        rasc = Object.fromEntries((d.data || []).map((x) => [x.key, x.value]));
        r.previa = Object.keys(rasc).length ? 'rascunho' : 'sem-rascunho';
      }
    }
    const val = (k) => rasc[k] ?? pub[k];
    r.empresa = mesclar(PADRAO_EMPRESA, val('empresa'));
    r.redes = mesclar(PADRAO_REDES, val('redes'));
    r.inicio = mesclar(PADRAO_INICIO, val('inicio'));
  } catch (e) {
    console.error('Não foi possível carregar as configurações; usando os valores padrão.', e);
  }
  return r;
}

// ---------- Cabeçalho, rodapé e botão flutuante ----------
function hrefModulo(chave) {
  return MODULOS[chave].pronto ? MODULOS[chave].href : `${BASE}#acoes`;
}

function cabecalho(emp) {
  const zap = zapLink(emp.whatsapp);
  const itens = [
    ['Início', `${BASE}#topo`],
    ['Produtos', hrefModulo('loja')],
    ['Banho & Tosa', hrefModulo('banho')],
    ['Consultas Veterinárias', hrefModulo('vet')],
    ['Sobre Nós', `${BASE}#sobre`],
    ['Contato', `${BASE}#contato`],
  ];
  return `<div class="cont cab-interno">
    <a class="logo-link" href="${BASE || 'index.html'}#topo" aria-label="${esc(emp.nome)} — início">
      <img src="${LOGO}" alt="${esc(emp.nome)}" width="103" height="48">
    </a>
    ${zap ? `<a class="btn btn-escuro btn-pequeno cab-zap" href="${esc(zap)}" target="_blank" rel="noopener">WhatsApp<span class="sr-only"> (abre em nova aba)</span></a>` : ''}
    <button class="btn-menu" id="b-menu" type="button" aria-expanded="false" aria-controls="menu" aria-label="Abrir menu">☰</button>
    <nav class="menu" id="menu" aria-label="Principal">
      <button class="menu-fechar" id="b-fechar" type="button" aria-label="Fechar menu">✕</button>
      <ul>${itens.map(([t, h]) => `<li><a class="item" href="${esc(h)}">${esc(t)}</a></li>`).join('')}</ul>
    </nav>
  </div>
  <div class="fundo-menu" id="fundo-menu" hidden></div>`;
}

function ligarMenu() {
  const menu = document.getElementById('menu');
  const fundo = document.getElementById('fundo-menu');
  const abrir = document.getElementById('b-menu');
  if (!menu) return;
  const alternar = (sim) => {
    menu.classList.toggle('aberto', sim);
    fundo.hidden = !sim;
    abrir.setAttribute('aria-expanded', String(sim));
    if (sim) document.getElementById('b-fechar').focus(); else if (document.activeElement && menu.contains(document.activeElement)) abrir.focus();
  };
  abrir.addEventListener('click', () => alternar(!menu.classList.contains('aberto')));
  document.getElementById('b-fechar').addEventListener('click', () => alternar(false));
  fundo.addEventListener('click', () => alternar(false));
  menu.addEventListener('click', (e) => { if (e.target.closest('a.item')) alternar(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('aberto')) alternar(false); });
}

const GLIFOS = {
  instagram: ['Instagram', ICONE_INSTA],
  facebook: ['Facebook', 'f'],
  threads: ['Threads', '@'],
  tiktok: ['TikTok', '♪'],
};

function redesHTML(redes) {
  const itens = Object.entries(GLIFOS).map(([chave, [nome, glifo]]) => {
    const usuario = String(redes[chave] ?? '').trim();
    if (!usuario) return '';
    const url = urlSegura(redes[`${chave}_url`]);
    const miolo = `<span class="g" aria-hidden="true">${glifo}</span><span>${esc(nome)}: ${esc(usuario)}</span>`;
    return url
      ? `<li><a class="rede" href="${esc(url)}" target="_blank" rel="noopener">${miolo}<span class="sr-only"> (abre em nova aba)</span></a></li>`
      : `<li><span class="rede">${miolo}</span></li>`;
  }).join('');
  return itens;
}

function redesRodape(redes) {
  return Object.entries(GLIFOS).map(([chave, [nome]]) => {
    const usuario = String(redes[chave] ?? '').trim();
    if (!usuario) return '';
    const url = urlSegura(redes[`${chave}_url`]);
    const texto = `${esc(nome)}: ${esc(usuario)}`;
    return url
      ? `<li><a href="${esc(url)}" target="_blank" rel="noopener">${texto}<span class="sr-only"> (abre em nova aba)</span></a></li>`
      : `<li>${texto}</li>`;
  }).join('');
}

function rodape(emp, redes, ini) {
  const zap = zapLink(emp.whatsapp);
  const ano = new Date().getFullYear();
  const copy = String(ini.rodape?.copyright ?? '').replaceAll('{ano}', String(ano));
  const links = [
    ['Produtos', hrefModulo('loja')],
    ['Banho & Tosa', hrefModulo('banho')],
    ['Consultas Veterinárias', hrefModulo('vet')],
    ['Sobre Nós', `${BASE}#sobre`],
    ['Contato', `${BASE}#contato`],
  ];
  const redesLi = redesRodape(redes);
  return `<div class="cont">
    <div class="rodape-grade">
      <div class="rodape-logo">
        <img src="${LOGO}" alt="${esc(emp.nome)}" width="137" height="64">
        <p>${esc(emp.slogan)}</p>
      </div>
      <div><h2>Navegue</h2><ul>${links.map(([t, h]) => `<li><a href="${esc(h)}">${esc(t)}</a></li>`).join('')}</ul></div>
      <div><h2>Contato</h2><ul>
        ${zap ? `<li><a href="${esc(zap)}" target="_blank" rel="noopener">WhatsApp ${esc(formatarZap(emp.whatsapp))}</a></li>` : ''}
        ${emp.email ? `<li><a href="mailto:${esc(emp.email)}">${esc(emp.email)}</a></li>` : ''}
        ${emp.endereco ? `<li>${esc(emp.endereco)}</li>` : ''}
      </ul></div>
      ${redesLi ? `<div><h2>Redes sociais</h2><ul>${redesLi}</ul></div>` : ''}
    </div>
    <p class="copy">${esc(copy)} · <a href="privacidade.html">Política de Privacidade</a></p>
  </div>`;
}

function botaoFlutuante(emp) {
  const zap = zapLink(emp.whatsapp);
  if (!zap) return '';
  return `<a class="zap-flutuante" href="${esc(zap)}" target="_blank" rel="noopener" aria-label="Falar com o ${esc(emp.nome)} no WhatsApp (abre em nova aba)">${ICONE_ZAP}<span>WhatsApp</span></a>`;
}

// ---------- Página inicial ----------
function secaoHero(emp, ini) {
  const h = ini.hero;
  const zap = zapLink(emp.whatsapp, h.mensagem_whatsapp);
  return `<section class="hero" id="topo" aria-labelledby="titulo-hero">
    <svg class="deco deco-agua" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="50" fill="#04A69D"/></svg>
    <svg class="deco deco-branco" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="50" fill="#ffffff"/></svg>
    <svg class="deco deco-pata p1" viewBox="0 0 64 64" aria-hidden="true"><g fill="#0C4E64"><ellipse cx="32" cy="42" rx="14" ry="11"/><ellipse cx="14" cy="26" rx="6" ry="8"/><ellipse cx="26" cy="15" rx="6" ry="8"/><ellipse cx="38" cy="15" rx="6" ry="8"/><ellipse cx="50" cy="26" rx="6" ry="8"/></g></svg>
    <svg class="deco deco-pata p2" viewBox="0 0 64 64" aria-hidden="true"><g fill="#0C4E64"><ellipse cx="32" cy="42" rx="14" ry="11"/><ellipse cx="14" cy="26" rx="6" ry="8"/><ellipse cx="26" cy="15" rx="6" ry="8"/><ellipse cx="38" cy="15" rx="6" ry="8"/><ellipse cx="50" cy="26" rx="6" ry="8"/></g></svg>
    <div class="cont hero-grade">
      <div class="hero-logo"><img src="${LOGO}" alt="Logotipo do ${esc(emp.nome)}" width="900" height="420"></div>
      <div class="hero-texto">
        <p class="hero-nome">${esc(emp.nome)}</p>
        <p class="pill-slogan">${esc(emp.slogan)}</p>
        <h1 id="titulo-hero">${esc(h.titulo)}</h1>
        <p class="hero-intro">${esc(h.texto)}</p>
        ${zap ? `<a class="btn btn-escuro" href="${esc(zap)}" target="_blank" rel="noopener">${esc(h.rotulo_whatsapp)}<span class="sr-only"> (abre em nova aba)</span></a>` : ''}
      </div>
    </div>
  </section>`;
}

function secaoAcoes(emp, ini) {
  const defs = [
    ['loja', 'acao-agua', '🛍️'],
    ['banho', 'acao-petroleo', '🛁'],
    ['vet', 'acao-clara', '🩺'],
  ];
  const cartoes = defs.map(([chave, classe, icone]) => {
    const a = ini.acoes[chave];
    const m = MODULOS[chave];
    const zap = zapLink(emp.whatsapp, m.zap);
    const botao = m.pronto
      ? `<a class="btn" href="${esc(m.href)}">${esc(a.rotulo)}</a>`
      : (zap ? `<a class="btn" href="${esc(zap)}" target="_blank" rel="noopener">Falar no WhatsApp<span class="sr-only"> (abre em nova aba)</span></a>` : '');
    return `<article class="acao ${classe}">
      <span class="acao-icone" aria-hidden="true">${icone}</span>
      <h2>${esc(a.titulo)}</h2>
      <p>${esc(a.descricao)}</p>
      ${m.pronto ? '' : `<span class="acao-aviso">${esc(m.aviso)}</span>`}
      ${botao}
    </article>`;
  }).join('');
  return `<section class="acoes" id="acoes" aria-label="O que você quer fazer?"><div class="cont acoes-grade">${cartoes}</div></section>`;
}

function secaoSobre(emp, ini) {
  const s = ini.sobre;
  const servicos = lista(ini.servicos).filter((x) => x && x.ativo !== false && String(x.nome ?? '').trim());
  return `<section class="secao sobre" id="sobre" aria-labelledby="titulo-sobre">
    <div class="cont sobre-grade">
      <div>
        <h2 id="titulo-sobre">${esc(s.titulo)}</h2>
        <p class="destaque">${esc(emp.slogan)}</p>
        <p>${esc(s.texto)}</p>
        ${s.localizacao ? `<p class="local">📍 ${esc(s.localizacao)}</p>` : ''}
      </div>
      ${servicos.length ? `<div><h3>O que oferecemos</h3><ul class="servicos">${servicos.map((x) => `<li>${esc(x.nome)}</li>`).join('')}</ul></div>` : ''}
    </div>
  </section>`;
}

function secaoGaleria(ini) {
  const g = ini.galeria || {};
  const itens = lista(g.itens).map((x) => ({ ...x, url: urlSegura(x?.url) })).filter((x) => x.url && x.visivel !== false);
  if (!itens.length) return '';
  return `<section class="secao galeria" id="galeria" aria-labelledby="titulo-galeria">
    <div class="cont">
      <h2 class="secao-titulo" id="titulo-galeria">${esc(g.titulo || 'Nossa galeria')}</h2>
      <div class="carrossel" role="region" aria-label="Galeria de fotos" tabindex="0">
        ${itens.map((x) => `<figure><img src="${esc(x.url)}" alt="${esc(x.alt || x.legenda || 'Foto do Pet Natureza')}" loading="lazy">${x.legenda ? `<figcaption>${esc(x.legenda)}</figcaption>` : ''}</figure>`).join('')}
      </div>
    </div>
  </section>`;
}

function secaoDiferenciais(ini) {
  const itens = lista(ini.diferenciais).filter((x) => x && x.ativo !== false && String(x.titulo ?? '').trim());
  if (!itens.length) return '';
  return `<section class="secao dif" aria-labelledby="titulo-dif">
    <div class="cont">
      <h2 class="secao-titulo" id="titulo-dif">Por que escolher o Pet Natureza</h2>
      <div class="dif-grade">${itens.map((x) => `<div class="dif-card"><span class="ico" aria-hidden="true">${esc(x.icone || '🐾')}</span><h3>${esc(x.titulo)}</h3><p>${esc(x.descricao)}</p></div>`).join('')}</div>
    </div>
  </section>`;
}

function secaoContato(emp, redes, ini) {
  const c = ini.contato;
  const zap = zapLink(emp.whatsapp);
  const mapa = emp.endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${emp.nome}, ${emp.endereco}`)}` : '';
  const redesLi = redesHTML(redes);
  return `<section class="secao contato" id="contato" aria-labelledby="titulo-contato">
    <div class="cont">
      <h2 class="secao-titulo" id="titulo-contato">${esc(c.titulo)}</h2>
      <div class="contato-grade">
        <ul class="contato-lista">
          ${emp.endereco ? `<li><strong>Endereço</strong>${esc(emp.endereco)}${c.mostrar_mapa ? `<br><a href="${esc(mapa)}" target="_blank" rel="noopener">Ver no mapa<span class="sr-only"> (abre em nova aba)</span></a>` : ''}</li>` : ''}
          ${zap ? `<li><strong>WhatsApp</strong><a href="${esc(zap)}" target="_blank" rel="noopener">${esc(formatarZap(emp.whatsapp))}<span class="sr-only"> (abre em nova aba)</span></a></li>` : ''}
          ${emp.email ? `<li><strong>E-mail</strong><a href="mailto:${esc(emp.email)}">${esc(emp.email)}</a></li>` : ''}
          ${String(emp.horarios ?? '').trim() ? `<li><strong>Horário de funcionamento</strong><span class="pre">${esc(emp.horarios)}</span></li>` : ''}
        </ul>
        ${redesLi ? `<div class="redes"><h3>Redes sociais</h3><ul>${redesLi}</ul></div>` : ''}
      </div>
    </div>
  </section>`;
}

function paginaInicio(d) {
  return secaoHero(d.empresa, d.inicio) + secaoAcoes(d.empresa, d.inicio) + secaoSobre(d.empresa, d.inicio)
    + secaoGaleria(d.inicio) + secaoDiferenciais(d.inicio) + secaoContato(d.empresa, d.redes, d.inicio);
}

// ---------- Política de privacidade ----------
function paginaPrivacidade(d) {
  const emp = d.empresa;
  const texto = String(d.inicio.politica ?? '')
    .replaceAll('{nome}', emp.nome).replaceAll('{email}', emp.email).replaceAll('{whatsapp}', formatarZap(emp.whatsapp));
  return `<div class="cont texto-pagina">
    <h1>Política de Privacidade</h1>
    ${paragrafos(texto).map((p) => `<p>${esc(p)}</p>`).join('')}
    <p><a class="btn btn-escuro" href="index.html">Voltar para a página inicial</a></p>
  </div>`;
}

// ---------- Iniciar ----------
const BANNERS = {
  rascunho: 'Prévia: você está vendo alterações ainda não publicadas.',
  'sem-rascunho': 'Prévia: não há rascunho salvo; este é o site publicado.',
  'sem-login': 'Prévia indisponível: entre no painel neste navegador e tente de novo. Este é o site publicado.',
};

async function iniciar() {
  const d = await carregar();
  document.getElementById('cabecalho').innerHTML = cabecalho(d.empresa);
  document.getElementById('principal').innerHTML = PAGINA === 'privacidade' ? paginaPrivacidade(d) : paginaInicio(d);
  document.getElementById('rodape').innerHTML = rodape(d.empresa, d.redes, d.inicio);
  document.getElementById('zap-flutuante').innerHTML = botaoFlutuante(d.empresa);
  if (PREVIA && d.previa) document.getElementById('banner-previa').innerHTML = `<div class="banner-previa" role="status">${esc(BANNERS[d.previa])}</div>`;
  if (PAGINA === 'inicio' && d.inicio.seo) {
    if (d.inicio.seo.titulo) document.title = d.inicio.seo.titulo;
    const meta = document.querySelector('meta[name="description"]');
    if (meta && d.inicio.seo.descricao) meta.setAttribute('content', d.inicio.seo.descricao);
  }
  ligarMenu();
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

iniciar();
