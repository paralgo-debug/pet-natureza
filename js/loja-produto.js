// Pet Natureza - Loja: página do produto (galeria, preço, quantidade, relacionados)
import { obterProduto, esc, urlImagem, htmlPreco, formatarDataHora } from './loja-api.js';
import { quantidadeDe, assinar } from './loja-carrinho.js';
import { adicionarComAviso, htmlCartao, htmlEstoque } from './loja-catalogo.js';

function dois(n) { return String(n).padStart(2, '0'); }

function formatarRestante(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const hora = `${dois(h)}:${dois(m)}:${dois(s)}`;
  return d > 0 ? `${d} ${d === 1 ? 'dia' : 'dias'} e ${hora}` : hora;
}

function baseDaLoja() {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

function ehClique(ev) {
  return ev.button === 0 && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && !ev.altKey;
}

// ctx: { voltar(), hrefCatalogo(), abrirProduto(slug), linkProduto(slug),
//        whatsappHref(), aoCarregar(produto | null) }
export function montarProduto(alvo, slug, ctx) {
  let seq = 0;
  let recargas = 0;
  let intervalo = null;
  let produto = null;
  let relacionados = new Map();
  const wa = () => (typeof ctx.whatsappHref === 'function' ? ctx.whatsappHref() : 'https://wa.me/5598984402286');

  function pararContagem() {
    if (intervalo) { clearInterval(intervalo); intervalo = null; }
  }

  function removerJsonLd() {
    const el = document.getElementById('lj-jsonld');
    if (el) el.remove();
  }

  function aplicarJsonLd(p) {
    removerJsonLd();
    const url = `${baseDaLoja()}?produto=${encodeURIComponent(p.slug)}`;
    const imagens = (p.imagens || []).map((i) => urlImagem(i.path)).filter(Boolean);
    const oferta = {
      '@type': 'Offer',
      priceCurrency: 'BRL',
      price: Number(p.preco).toFixed(2),
      availability: p.estoque_status === 'esgotado' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      url
    };
    if (p.promocao_valida && p.promocao_ate) oferta.priceValidUntil = String(p.promocao_ate).slice(0, 10);
    const dados = { '@context': 'https://schema.org', '@type': 'Product', name: p.nome, url, offers: oferta };
    const desc = p.descricao_curta || p.descricao;
    if (desc) dados.description = String(desc).slice(0, 300);
    if (p.sku) dados.sku = p.sku;
    if (imagens.length) dados.image = imagens;
    if (p.categoria && p.categoria.nome) dados.category = p.categoria.nome;
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.id = 'lj-jsonld';
    s.textContent = JSON.stringify(dados).replace(/</g, '\\u003c');
    document.head.appendChild(s);
  }

  function htmlGaleria(p, imgs) {
    if (!imgs.length) {
      return `<div class="lj-gal-pal"><span class="lj-reserva" aria-hidden="true">${esc(p.emoji || '🐾')}</span></div>`;
    }
    const total = imgs.length;
    const setas = total > 1
      ? `<button type="button" class="lj-gal-seta lj-gal-ant" data-gal="-1" aria-label="Foto anterior">&#8249;</button>
         <button type="button" class="lj-gal-seta lj-gal-prox" data-gal="1" aria-label="Próxima foto">&#8250;</button>
         <span class="lj-gal-cont" id="lj-gal-cont" aria-live="polite">1 / ${total}</span>`
      : '';
    const minis = total > 1
      ? `<ul class="lj-gal-minis">${imgs.map((im, i) => `<li><button type="button" class="lj-mini" data-i="${i}" aria-label="Ver foto ${i + 1} de ${total}"${i === 0 ? ' aria-current="true"' : ''}><img src="${esc(urlImagem(im.thumb_path || im.path))}" alt="" width="64" height="64" loading="lazy" decoding="async"></button></li>`).join('')}</ul>`
      : '';
    return `<div class="lj-gal-pal" id="lj-gal-pal">
        <img id="lj-gal-img" src="${esc(urlImagem(imgs[0].path))}" alt="${esc(imgs[0].alt || p.nome)}" width="800" height="800" decoding="async">
        ${setas}
      </div>${minis}`;
  }

  function ligarGaleria(p, imgs) {
    const total = imgs.length;
    if (total < 2) return;
    let idx = 0;
    const img = alvo.querySelector('#lj-gal-img');
    const cont = alvo.querySelector('#lj-gal-cont');
    const pal = alvo.querySelector('#lj-gal-pal');
    const galeria = alvo.querySelector('.lj-galeria');
    const minis = Array.from(alvo.querySelectorAll('.lj-mini'));

    function mostrar(i) {
      idx = (i + total) % total;
      img.src = urlImagem(imgs[idx].path);
      img.alt = imgs[idx].alt || p.nome;
      cont.textContent = `${idx + 1} / ${total}`;
      minis.forEach((m, k) => {
        if (k === idx) m.setAttribute('aria-current', 'true'); else m.removeAttribute('aria-current');
      });
      minis[idx].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    galeria.addEventListener('click', (ev) => {
      const seta = ev.target.closest('[data-gal]');
      if (seta) { mostrar(idx + Number(seta.dataset.gal)); return; }
      const mini = ev.target.closest('[data-i]');
      if (mini) mostrar(Number(mini.dataset.i));
    });
    galeria.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); mostrar(idx - 1); }
      else if (ev.key === 'ArrowRight') { ev.preventDefault(); mostrar(idx + 1); }
    });
    let x0 = null;
    let y0 = null;
    pal.addEventListener('touchstart', (ev) => {
      const t = ev.changedTouches[0];
      x0 = t.clientX; y0 = t.clientY;
    }, { passive: true });
    pal.addEventListener('touchend', (ev) => {
      if (x0 === null) return;
      const t = ev.changedTouches[0];
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) mostrar(idx + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }

  function ligarCompra(p, max) {
    const btnAdd = alvo.querySelector('#lj-add');
    const inp = alvo.querySelector('#lj-qtd');
    if (!btnAdd || !inp) return;
    const menos = alvo.querySelector('#lj-menos');
    const mais = alvo.querySelector('#lj-mais');
    const ajustar = () => {
      let n = Math.floor(Number(inp.value));
      if (!Number.isFinite(n) || n < 1) n = 1;
      if (n > max) n = max;
      inp.value = String(n);
      menos.disabled = n <= 1;
      mais.disabled = n >= max;
      return n;
    };
    inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D+/g, '').slice(0, 2); });
    inp.addEventListener('change', ajustar);
    inp.addEventListener('blur', ajustar);
    menos.addEventListener('click', () => { inp.value = String(ajustar() - 1); ajustar(); });
    mais.addEventListener('click', () => { inp.value = String(ajustar() + 1); ajustar(); });
    btnAdd.addEventListener('click', () => {
      adicionarComAviso({ id: p.id, nome: p.nome, preco: p.preco, max }, ajustar());
    });
    ajustar();
  }

  function atualizarAviso() {
    const el = alvo.querySelector('#lj-no-carrinho');
    if (!el || !produto) return;
    const n = quantidadeDe(produto.id);
    el.textContent = n > 0 ? `Você já tem ${n} ${n === 1 ? 'unidade' : 'unidades'} deste produto no carrinho.` : '';
  }

  function iniciarContagem(p) {
    pararContagem();
    if (!p.promocao_valida || !p.promocao_ate) return;
    const fim = new Date(p.promocao_ate).getTime();
    const el = alvo.querySelector('#lj-contagem');
    if (!Number.isFinite(fim) || !el) return;
    const tick = () => {
      const falta = fim - Date.now();
      if (falta <= 0) {
        pararContagem();
        if (recargas < 2) { recargas += 1; carregar(false); } else el.hidden = true;
        return;
      }
      el.textContent = `Promoção termina em ${formatarRestante(falta)}`;
    };
    tick();
    if (!intervalo && alvo.contains(el)) intervalo = setInterval(tick, 1000);
  }

  function renderizar(p, primeira) {
    produto = p;
    relacionados = new Map((p.relacionados || []).map((x) => [x.id, x]));
    const imgs = Array.isArray(p.imagens) ? p.imagens : [];
    const rawMax = Number(p.max_quantidade);
    const max = Math.max(0, Math.min(99, Number.isFinite(rawMax) ? rawMax : 99));
    const nome = esc(p.nome);
    const selos = (p.promocao_valida ? '<span class="lj-selo lj-selo-promo">Promoção</span> ' : '')
      + (p.destaque ? '<span class="lj-selo lj-selo-dest">Destaque</span>' : '');
    const promo = p.promocao_valida && p.promocao_ate
      ? `<p class="lj-contagem" id="lj-contagem" role="timer"></p>
         <p class="lj-ajuda">Promoção válida até ${esc(formatarDataHora(p.promocao_ate))}</p>`
      : '';
    const compra = max < 1
      ? '<div class="lj-comprar"><button type="button" class="lj-btn" disabled>Esgotado</button></div>'
      : `<div class="lj-comprar">
          <div class="lj-qtd" role="group" aria-label="Quantidade">
            <button type="button" id="lj-menos" aria-label="Diminuir quantidade">&minus;</button>
            <input id="lj-qtd" type="text" inputmode="numeric" pattern="[0-9]*" value="1" aria-label="Quantidade" autocomplete="off">
            <button type="button" id="lj-mais" aria-label="Aumentar quantidade">+</button>
          </div>
          <button type="button" class="lj-btn" id="lj-add">Adicionar ao carrinho</button>
        </div>`;
    const rel = (p.relacionados || []).length
      ? `<section class="lj-relacionados" aria-labelledby="lj-rel-tit"><h2 id="lj-rel-tit">Veja também</h2>
          <ul class="lj-grade">${p.relacionados.map((x) => htmlCartao(x, ctx.linkProduto)).join('')}</ul></section>`
      : '';

    alvo.innerHTML = `
      <a class="lj-voltar" href="${esc(ctx.hrefCatalogo())}" data-voltar>&larr; Voltar ao catálogo</a>
      <article class="lj-prod">
        <div class="lj-galeria" role="group" aria-label="Fotos de ${nome}"${imgs.length > 1 ? ' tabindex="0"' : ''}>${htmlGaleria(p, imgs)}</div>
        <div class="lj-prod-info">
          ${p.categoria ? `<span class="lj-cat">${esc(p.categoria.nome)}</span>` : ''}
          <h1 id="lj-prod-tit" tabindex="-1">${nome}</h1>
          ${selos ? `<p>${selos}</p>` : ''}
          <div class="lj-prod-preco">${htmlPreco(p)}</div>
          ${promo}
          ${p.descricao_curta ? `<p>${esc(p.descricao_curta)}</p>` : ''}
          ${htmlEstoque(p)}
          ${compra}
          <p class="lj-ajuda" id="lj-no-carrinho" aria-live="polite"></p>
          ${p.sku ? `<p class="lj-ajuda">Código: ${esc(p.sku)}</p>` : ''}
          ${p.descricao ? `<h2 class="lj-card-nome">Descrição</h2><div class="lj-desc">${esc(p.descricao)}</div>` : ''}
        </div>
      </article>
      ${rel}`;

    ligarGaleria(p, imgs);
    ligarCompra(p, max);
    iniciarContagem(p);
    atualizarAviso();
    aplicarJsonLd(p);
    if (typeof ctx.aoCarregar === 'function') ctx.aoCarregar(p);
    if (primeira) {
      window.scrollTo(0, 0);
      const h1 = alvo.querySelector('#lj-prod-tit');
      if (h1) h1.focus({ preventScroll: true });
    }
  }

  function htmlNaoEncontrado() {
    return `<div class="lj-caixa"><p><strong>Produto não encontrado</strong></p>
      <p>Este produto não está mais disponível ou o link está incorreto.</p>
      <a class="lj-btn" href="${esc(ctx.hrefCatalogo())}" data-voltar>Ver todos os produtos</a></div>`;
  }

  function htmlErro(e) {
    const msg = (e && e.message) ? e.message : 'Não foi possível carregar este produto agora.';
    return `<div class="lj-erro" role="alert"><p>${esc(msg)}</p>
      <div class="lj-card-acoes">
        <button type="button" class="lj-btn lj-btn-peq" data-tentar>Tentar de novo</button>
        <a class="lj-btn lj-btn-sec lj-btn-peq" href="${esc(wa())}" target="_blank" rel="noopener">Falar no WhatsApp</a>
      </div></div>`;
  }

  async function carregar(primeira) {
    const minha = ++seq;
    if (primeira) {
      pararContagem();
      removerJsonLd();
      alvo.innerHTML = '<div class="lj-esq" aria-hidden="true"></div><p class="carregando">Carregando produto…</p>';
    }
    try {
      const p = await obterProduto(slug);
      if (minha !== seq) return;
      if (!p) {
        pararContagem();
        removerJsonLd();
        produto = null;
        alvo.innerHTML = htmlNaoEncontrado();
        if (typeof ctx.aoCarregar === 'function') ctx.aoCarregar(null);
        return;
      }
      renderizar(p, primeira);
    } catch (e) {
      if (minha !== seq) return;
      if (primeira) alvo.innerHTML = htmlErro(e);
    }
  }

  function aoClicar(ev) {
    const t = ev.target.closest('[data-voltar],[data-add],a[data-slug],[data-tentar]');
    if (!t || !alvo.contains(t)) return;
    if (t.hasAttribute('data-voltar')) {
      if (!ehClique(ev)) return;
      ev.preventDefault();
      ctx.voltar();
    } else if (t.matches('a[data-slug]')) {
      if (!ehClique(ev)) return;
      ev.preventDefault();
      ctx.abrirProduto(t.dataset.slug);
    } else if (t.hasAttribute('data-add')) {
      const x = relacionados.get(t.dataset.add);
      if (x) {
        const max = !x.controla_estoque ? 99
          : x.estoque_status === 'esgotado' ? 0
            : x.estoque_status === 'ultimas' ? Math.min(99, Number(x.estoque_restante) || 1) : 99;
        adicionarComAviso({ id: x.id, nome: x.nome, preco: x.preco, max }, 1);
      }
    } else if (t.hasAttribute('data-tentar')) {
      carregar(true);
    }
  }

  alvo.addEventListener('click', aoClicar);
  const desassinar = assinar(atualizarAviso);
  carregar(true);

  return {
    destruir() {
      seq += 1;
      pararContagem();
      removerJsonLd();
      desassinar();
      alvo.removeEventListener('click', aoClicar);
    }
  };
                                                              }
