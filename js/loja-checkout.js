// Pet Natureza - Loja: gaveta do carrinho e etapas do pedido
import { configLoja, criarPedido, esc, brl, urlImagem, novoUuid, linkWhatsApp, normalizarWhatsApp, mascaraWhatsApp } from './loja-api.js';
import { validar, definir, remover, limpar } from './loja-carrinho.js';
import { toast } from './loja-layout.js';
import {
  FORM_VAZIO, arred, subtotalDe, htmlPassos, htmlFormulario, bloqueioCheckout, lerFormulario,
  validarFormulario, primeiroInvalido, ajustarForm, problemaOpcoes, htmlResumo, textoWhats, textoTaxa
} from './loja-checkout-form.js';

const IDS_FUNDO = ['lj-cab', 'lj-main', 'lj-rodape'];
const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), select:not([disabled])';

// ctx: { empresa(), linkProduto(slug), abrirProduto(slug) }
export function criarGaveta(ctx) {
  let aberta = false;
  let vista = 'carrinho';
  let linhas = [];
  let avisos = [];
  let cfg = null;
  let resumo = null;
  let sucesso = null;
  let form = FORM_VAZIO();
  let pedidoId = novoUuid();
  let enviando = false;
  let erroGeral = '';
  let erroEnvio = '';
  let abridor = null;
  let seq = 0;

  const fundo = document.createElement('div');
  fundo.className = 'lj-fundo';
  fundo.hidden = true;
  const gaveta = document.createElement('div');
  gaveta.className = 'lj-gaveta';
  gaveta.hidden = true;
  gaveta.setAttribute('role', 'dialog');
  gaveta.setAttribute('aria-modal', 'true');
  gaveta.setAttribute('aria-labelledby', 'lj-gaveta-tit');
  gaveta.innerHTML = `<div class="lj-gaveta-cab">
      <h2 id="lj-gaveta-tit" tabindex="-1">Seu carrinho</h2>
      <button type="button" class="lj-fechar" data-fechar aria-label="Fechar">&times;</button>
    </div>
    <div class="lj-gaveta-corpo" id="lj-g-corpo"></div>
    <div class="lj-gaveta-rod" id="lj-g-rod" hidden></div>`;
  document.body.append(fundo, gaveta);
  const titulo = gaveta.querySelector('#lj-gaveta-tit');
  const corpo = gaveta.querySelector('#lj-g-corpo');
  const rod = gaveta.querySelector('#lj-g-rod');

  const empresa = () => ctx.empresa() || {};
  const wa = () => linkWhatsApp(empresa().whatsapp, 'Olá! Preciso de ajuda com meu pedido na loja do site.');

  function pintar(tit, htmlCorpo, htmlRod, manter) {
    titulo.textContent = tit;
    corpo.innerHTML = htmlCorpo;
    rod.innerHTML = htmlRod || '';
    rod.hidden = !htmlRod;
    if (!manter) {
      corpo.scrollTop = 0;
      titulo.focus({ preventScroll: true });
    }
  }

  function carregando(tit, msg) {
    pintar(tit, `<p class="carregando" role="status">${esc(msg)}</p>`, '');
  }

  function erroTela(tit, e, volta) {
    const msg = (e && e.message) ? e.message : 'Não foi possível continuar agora.';
    pintar(tit, `<div class="lj-erro" role="alert"><p>${esc(msg)}</p><div class="lj-card-acoes">
      <button type="button" class="lj-btn lj-btn-peq" data-tentar="${volta}">Tentar de novo</button>
      <a class="lj-btn lj-btn-sec lj-btn-peq" href="${esc(wa())}" target="_blank" rel="noopener">Falar no WhatsApp</a></div></div>`, '');
  }

  const htmlAvisos = () => (avisos.length
    ? `<ul class="lj-avisos" role="status">${avisos.map((a) => `<li class="lj-aviso">${esc(a)}</li>`).join('')}</ul>` : '');

  // ---------- Carrinho ----------
  function htmlLinha(l) {
    const nome = esc(l.nome);
    const im = l.imagem_principal;
    const arq = im ? (im.thumb_path || im.path) : '';
    const midia = arq
      ? `<img src="${esc(urlImagem(arq))}" alt="" width="64" height="64" loading="lazy" decoding="async">`
      : `<span aria-hidden="true">${esc(l.emoji || '🐾')}</span>`;
    const q = Number(l.quantidade);
    const max = Math.min(99, Math.max(1, Number(l.max_quantidade) || 99));
    return `<li class="lj-linha" data-id="${esc(l.id)}">
      <div class="lj-linha-img">${midia}</div>
      <p class="lj-linha-nome"><a href="${esc(ctx.linkProduto(l.slug))}" data-slug="${esc(l.slug)}">${nome}</a><br>
        <small>${esc(brl(l.preco))} cada${l.promocao_valida ? ' · promoção' : ''}</small></p>
      <div class="lj-linha-ctl">
        <div class="lj-qtd" role="group" aria-label="Quantidade de ${nome}">
          <button type="button" data-menos aria-label="Diminuir quantidade de ${nome}"${q <= 1 ? ' disabled' : ''}>&minus;</button>
          <input type="text" inputmode="numeric" pattern="[0-9]*" data-qtd value="${q}" aria-label="Quantidade de ${nome}" autocomplete="off">
          <button type="button" data-mais aria-label="Aumentar quantidade de ${nome}"${q >= max ? ' disabled' : ''}>+</button>
        </div>
        <span class="lj-linha-sub"><span class="sr-only">Subtotal: </span>${esc(brl(arred(Number(l.preco) * q)))}</span>
        <button type="button" class="lj-linha-rem" data-remover aria-label="Remover ${nome} do carrinho">Remover</button>
      </div></li>`;
  }

  function renderCarrinho(foco) {
    vista = 'carrinho';
    const err = erroGeral ? `<div class="lj-erro" role="alert">${esc(erroGeral)}</div>` : '';
    if (!linhas.length) {
      pintar('Seu carrinho', `${err}${htmlAvisos()}<div class="lj-caixa"><p><strong>Seu carrinho está vazio.</strong></p>
        <p>Escolha produtos no catálogo e volte aqui.</p><button type="button" class="lj-btn lj-btn-peq" data-fechar>Ver produtos</button></div>`, '');
      return;
    }
    pintar('Seu carrinho', `${err}${htmlAvisos()}<ul class="lj-linhas">${linhas.map(htmlLinha).join('')}</ul>`,
      `<p class="lj-total-linha"><span>Subtotal</span><strong>${esc(brl(subtotalDe(linhas)))}</strong></p>
       <p class="lj-ajuda">A taxa de entrega, se houver, aparece na próxima etapa.</p>
       <button type="button" class="lj-btn lj-btn-bloco" data-ir="dados">Continuar</button>
       <button type="button" class="lj-btn lj-btn-sec lj-btn-bloco" data-fechar>Continuar comprando</button>`, !!foco);
    if (foco) {
      const li = corpo.querySelector(`[data-id="${foco.id}"]`);
      const el = li && li.querySelector(foco.sel);
      const alvo = el && !el.disabled ? el : (li && li.querySelector('[data-qtd]'));
      if (alvo) alvo.focus();
    }
  }

  async function carregarCarrinho(msg) {
    const minha = ++seq;
    vista = 'carrinho';
    erroGeral = msg || '';
    carregando('Seu carrinho', 'Atualizando preços e estoque…');
    try {
      const r = await validar();
      if (minha !== seq) return;
      linhas = r.linhas;
      avisos = r.avisos;
      renderCarrinho();
    } catch (e) {
      if (minha !== seq) return;
      erroTela('Seu carrinho', e, 'carrinho');
    }
  }

  function mudarQtd(id, q, sel) {
    const l = linhas.find((x) => x.id === id);
    if (!l) return;
    const r = definir(id, q, Number(l.max_quantidade));
    if (!r.ok) return;
    l.quantidade = r.quantidade;
    if (r.limitado) toast(`Só temos ${r.quantidade} unidade${r.quantidade === 1 ? '' : 's'} de ${l.nome}.`, 'erro');
    renderCarrinho({ id, sel });
  }

  // ---------- Dados ----------
  async function irParaDados(msg) {
    const minha = ++seq;
    vista = 'dados';
    erroGeral = msg || '';
    carregando('Seus dados', 'Carregando opções de entrega e pagamento…');
    try {
      const c = await configLoja();
      if (minha !== seq) return;
      cfg = c;
    } catch (e) {
      if (minha !== seq) return;
      erroTela('Seus dados', e, 'dados');
      return;
    }
    ajustarForm(form, cfg);
    renderDados({});
  }

  function renderDados(erros) {
    vista = 'dados';
    const bloqueio = bloqueioCheckout(cfg);
    const aviso = bloqueio
      ? `<div class="lj-aviso" role="alert"><p>${esc(bloqueio)}</p><a class="lj-btn lj-btn-sec lj-btn-peq" href="${esc(wa())}" target="_blank" rel="noopener">Falar no WhatsApp</a></div>` : '';
    pintar('Seus dados', htmlPassos(2) + aviso + htmlFormulario(form, cfg, erros, erroGeral),
      `<button type="submit" form="lj-form" class="lj-btn lj-btn-bloco"${bloqueio ? ' disabled' : ''}>Revisar pedido</button>
       <button type="button" class="lj-btn lj-btn-sec lj-btn-bloco" data-ir="carrinho">Voltar ao carrinho</button>`);
    const primeiro = primeiroInvalido(corpo, erros);
    if (primeiro) primeiro.focus();
  }

  // ---------- Resumo e envio ----------
  async function irParaResumo(opc = {}) {
    const minha = ++seq;
    vista = 'resumo';
    carregando('Confira seu pedido', 'Conferindo preços, estoque e taxa de entrega…');
    let r;
    let c;
    try {
      [r, c] = await Promise.all([validar(), configLoja()]);
    } catch (e) {
      if (minha !== seq) return;
      erroTela('Confira seu pedido', e, 'resumo');
      return;
    }
    if (minha !== seq) return;
    linhas = r.linhas;
    avisos = r.avisos;
    cfg = c;
    if (!linhas.length) { erroGeral = ''; renderCarrinho(); return; }
    const problema = problemaOpcoes(form, cfg);
    if (problema) {
      ajustarForm(form, cfg);
      erroGeral = problema;
      renderDados({});
      return;
    }
    const zona = form.tipo === 'entrega' ? cfg.zonas.find((z) => z.id === form.zonaId) : null;
    const pag = cfg.pagamentos.find((p) => p.id === form.pagId);
    const subtotal = subtotalDe(linhas);
    const taxa = zona ? arred(zona.taxa) : 0;
    const total = arred(subtotal + taxa);
    let msg = opc.mensagem || '';
    if (opc.totalAnterior != null && Math.abs(opc.totalAnterior - total) > 0.004) {
      msg = `${msg} O total mudou de ${brl(opc.totalAnterior)} para ${brl(total)}.`.trim();
    }
    resumo = {
      linhas: linhas.map((l) => ({ ...l })), subtotal, taxa, total, tipo: form.tipo, zona, pag,
      form: { ...form }, retiradaTexto: (cfg.retirada && cfg.retirada.texto) || ''
    };
    erroEnvio = msg;
    renderResumo();
  }

  function renderResumo() {
    vista = 'resumo';
    const err = erroEnvio ? `<div class="lj-erro" role="alert">${esc(erroEnvio)}</div>` : '';
    pintar('Confira seu pedido', htmlPassos(3) + err + htmlAvisos() + htmlResumo(resumo),
      `<button type="button" class="lj-btn lj-btn-bloco" data-enviar>Enviar pedido</button>
       <button type="button" class="lj-btn lj-btn-sec lj-btn-bloco" data-ir="dados">Voltar e editar</button>`);
  }

  function marcarEnviando(sim) {
    gaveta.setAttribute('aria-busy', String(sim));
    gaveta.querySelectorAll('[data-enviar],[data-ir],[data-fechar]').forEach((b) => { b.disabled = sim; });
    const b = rod.querySelector('[data-enviar]');
    if (b && sim) b.textContent = 'Enviando…';
  }

  async function enviar() {
    if (enviando || !resumo) return;
    enviando = true;
    marcarEnviando(true);
    const f = resumo.form;
    const payload = {
      id: pedidoId,
      nome: f.nome.trim(),
      whatsapp: normalizarWhatsApp(f.whats),
      tipo_entrega: resumo.tipo,
      zona_id: resumo.zona ? resumo.zona.id : null,
      endereco: resumo.tipo === 'entrega'
        ? { rua: f.rua.trim(), numero: f.numero.trim(), bairro: f.bairro.trim(), complemento: f.complemento.trim(), referencia: f.referencia.trim() }
        : null,
      forma_pagamento_id: resumo.pag.id,
      observacoes: f.obs.trim() || null,
      itens: resumo.linhas.map((l) => ({ produto_id: l.id, quantidade: Number(l.quantidade) })),
      total_exibido: resumo.total,
      consentimento: true,
      contato_site: f.honey || ''
    };
    try {
      const r = await criarPedido(payload);
      limpar();
      pedidoId = novoUuid();
      form.consent = false;
      form.obs = '';
      form.honey = '';
      sucesso = r;
      linhas = [];
      avisos = [];
      resumo = null;
      renderSucesso();
    } catch (e) {
      await tratarErro(e);
    } finally {
      enviando = false;
      gaveta.setAttribute('aria-busy', 'false');
    }
  }

  async function tratarErro(e) {
    const cod = e && e.codigo;
    const msg = (e && e.message) || 'Não foi possível enviar o pedido.';
    enviando = false;
    if (cod === 'TOTAL_MUDOU') {
      await irParaResumo({ mensagem: msg, totalAnterior: resumo ? resumo.total : null });
    } else if (cod === 'ESTOQUE_INSUFICIENTE' || cod === 'PRODUTO_INDISPONIVEL') {
      await carregarCarrinho(msg);
    } else if (cod === 'VALIDACAO') {
      await irParaDados(msg);
    } else {
      erroEnvio = cod === 'REDE' ? `${msg} Seus dados foram mantidos: é só tentar de novo.` : msg;
      renderResumo();
    }
  }

  function renderSucesso() {
    vista = 'sucesso';
    const r = sucesso;
    const nome = String(r.cliente_nome || '').split(' ')[0];
    const l = (rot, val, cls) => `<div class="lj-resumo-linha${cls ? ` ${cls}` : ''}"><dt>${rot}</dt><dd>${val}</dd></div>`;
    const itens = (r.itens || []).map((i) => l(`${Number(i.quantidade)}× ${esc(i.nome)}`, esc(brl(i.subtotal)))).join('');
    const link = linkWhatsApp(empresa().whatsapp, textoWhats(r));
    pintar('Pedido enviado', `<div class="lj-sucesso">
      <p class="lj-numero">${esc(r.numero)}</p>
      <p><strong>Obrigado${nome ? `, ${esc(nome)}` : ''}!</strong></p>
      <p>Seu pedido já foi registrado. Abrir o WhatsApp é um passo separado: ele não paga o pedido nem garante que a mensagem foi entregue.</p>
      <div class="lj-resumo"><dl>${itens}
        ${l('Subtotal', esc(brl(r.subtotal)))}
        ${r.tipo_entrega === 'entrega' ? l('Taxa de entrega', esc(textoTaxa(r.taxa_entrega))) : ''}
        ${l('Total', esc(brl(r.total)), 'lj-resumo-total')}
        ${l('Recebimento', r.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada na loja')}
        ${l('Pagamento', esc(r.forma_pagamento_nome))}</dl></div>
      <a class="lj-btn lj-wa-btn lj-btn-bloco" href="${esc(link)}" target="_blank" rel="noopener">Abrir WhatsApp com o resumo do pedido</a>
    </div>`, '<button type="button" class="lj-btn lj-btn-sec lj-btn-bloco" data-fechar>Continuar comprando</button>');
  }

  // ---------- Abrir e fechar ----------
  function inertar(sim) {
    IDS_FUNDO.forEach((id) => { const el = document.getElementById(id); if (el) el.inert = sim; });
    document.documentElement.classList.toggle('lj-trava', sim);
    document.body.classList.toggle('lj-trava', sim);
  }

  function abrir(botao) {
    if (aberta) return;
    aberta = true;
    abridor = botao || document.activeElement;
    fundo.hidden = false;
    gaveta.hidden = false;
    void gaveta.offsetWidth;
    gaveta.classList.add('aberta');
    fundo.classList.add('aberto');
    inertar(true);
    sucesso = null;
    carregarCarrinho();
  }

  function fechar(devolverFoco = true) {
    if (!aberta || enviando) return;
    aberta = false;
    seq += 1;
    gaveta.classList.remove('aberta');
    fundo.classList.remove('aberto');
    inertar(false);
    setTimeout(() => { if (!aberta) { gaveta.hidden = true; fundo.hidden = true; } }, 260);
    if (devolverFoco && abridor && document.contains(abridor)) abridor.focus();
  }

  fundo.addEventListener('click', () => fechar(true));

  document.addEventListener('keydown', (ev) => {
    if (!aberta) return;
    if (ev.key === 'Escape') { ev.preventDefault(); fechar(true); return; }
    if (ev.key !== 'Tab') return;
    const itens = Array.from(gaveta.querySelectorAll(FOCAVEIS)).filter((el) => el.offsetParent !== null);
    if (!itens.length) { ev.preventDefault(); titulo.focus(); return; }
    const primeiro = itens[0];
    const ultimo = itens[itens.length - 1];
    if (!gaveta.contains(document.activeElement)) { ev.preventDefault(); primeiro.focus(); }
    else if (ev.shiftKey && document.activeElement === primeiro) { ev.preventDefault(); ultimo.focus(); }
    else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primeiro.focus(); }
  });

  gaveta.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-fechar],[data-menos],[data-mais],[data-remover],[data-ir],[data-enviar],[data-tentar],a[data-slug]');
    if (!t || !gaveta.contains(t)) return;
    if (t.matches('a[data-slug]')) {
      if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      ev.preventDefault();
      fechar(false);
      ctx.abrirProduto(t.dataset.slug);
      return;
    }
    if (t.hasAttribute('data-fechar')) { fechar(true); return; }
    if (t.hasAttribute('data-enviar')) { enviar(); return; }
    if (t.hasAttribute('data-tentar')) {
      const v = t.dataset.tentar;
      if (v === 'dados') irParaDados(); else if (v === 'resumo') irParaResumo(); else carregarCarrinho();
      return;
    }
    if (t.hasAttribute('data-ir')) {
      if (vista === 'dados') lerFormulario(corpo, form);
      const v = t.dataset.ir;
      if (v === 'dados') irParaDados(); else carregarCarrinho();
      return;
    }
    const li = t.closest('[data-id]');
    const l = li && linhas.find((x) => x.id === li.dataset.id);
    if (!l) return;
    if (t.hasAttribute('data-remover')) {
      remover(l.id);
      linhas = linhas.filter((x) => x.id !== l.id);
      renderCarrinho();
    } else if (t.hasAttribute('data-menos')) {
      mudarQtd(l.id, Number(l.quantidade) - 1, '[data-menos]');
    } else if (t.hasAttribute('data-mais')) {
      mudarQtd(l.id, Number(l.quantidade) + 1, '[data-mais]');
    }
  });

  gaveta.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.matches('[data-qtd]')) { t.value = t.value.replace(/\D+/g, '').slice(0, 2); return; }
    if (t.id === 'lj-f-whats') t.value = mascaraWhatsApp(t.value);
    if (vista === 'dados') lerFormulario(corpo, form);
  });

  gaveta.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.matches('[data-qtd]')) {
      const li = t.closest('[data-id]');
      const l = li && linhas.find((x) => x.id === li.dataset.id);
      if (!l) return;
      const n = parseInt(t.value, 10);
      if (!Number.isFinite(n) || n < 1) { t.value = String(l.quantidade); return; }
      mudarQtd(l.id, n, '[data-qtd]');
      return;
    }
    if (vista === 'dados') {
      lerFormulario(corpo, form);
      const sec = corpo.querySelector('#lj-sec-entrega');
      if (sec) sec.hidden = form.tipo !== 'entrega';
    }
  });

  gaveta.addEventListener('submit', (ev) => {
    if (ev.target.id !== 'lj-form') return;
    ev.preventDefault();
    lerFormulario(corpo, form);
    const erros = validarFormulario(form, cfg);
    if (Object.keys(erros).length) { renderDados(erros); return; }
    irParaResumo();
  });

  return { abrir, fechar };
    }
