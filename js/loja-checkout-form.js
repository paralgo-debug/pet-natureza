// Pet Natureza - Loja: formulário do pedido, validação, resumo e texto do WhatsApp
import { esc, brl, formatarWhatsApp, normalizarWhatsApp } from './loja-api.js';

export function FORM_VAZIO() {
  return {
    nome: '', whats: '', tipo: '', zonaId: '', rua: '', numero: '', bairro: '',
    complemento: '', referencia: '', pagId: '', obs: '', consent: false, honey: ''
  };
}

export function arred(n) { return Math.round(Number(n) * 100) / 100; }

export function subtotalDe(linhas) {
  return arred(linhas.reduce((s, l) => s + arred(Number(l.preco) * Number(l.quantidade)), 0));
}

export function textoTaxa(t) { return Number(t) > 0 ? brl(t) : 'Grátis'; }

function opcoesDe(cfg) {
  return {
    zonas: Array.isArray(cfg && cfg.zonas) ? cfg.zonas : [],
    pags: Array.isArray(cfg && cfg.pagamentos) ? cfg.pagamentos : [],
    ret: !!(cfg && cfg.retirada && cfg.retirada.ativa),
    textoRet: (cfg && cfg.retirada && cfg.retirada.texto) || ''
  };
}

export function bloqueioCheckout(cfg) {
  const o = opcoesDe(cfg);
  if (!o.zonas.length && !o.ret) {
    return 'No momento não há entrega nem retirada disponíveis pelo site. Fale com a gente pelo WhatsApp para combinar seu pedido.';
  }
  if (!o.pags.length) {
    return 'No momento não há formas de pagamento disponíveis pelo site. Fale com a gente pelo WhatsApp para combinar seu pedido.';
  }
  return '';
}

export function ajustarForm(form, cfg) {
  const o = opcoesDe(cfg);
  const tipoOk = (form.tipo === 'entrega' && o.zonas.length > 0) || (form.tipo === 'retirada' && o.ret);
  if (!tipoOk) form.tipo = o.zonas.length ? 'entrega' : (o.ret ? 'retirada' : '');
  if (!o.zonas.some((z) => z.id === form.zonaId)) form.zonaId = '';
  if (!o.pags.some((p) => p.id === form.pagId)) form.pagId = o.pags.length === 1 ? o.pags[0].id : '';
}

export function problemaOpcoes(form, cfg) {
  const o = opcoesDe(cfg);
  if (form.tipo === 'entrega') {
    if (!o.zonas.some((z) => z.id === form.zonaId)) return 'A zona de entrega escolhida não está mais disponível. Escolha outra.';
  } else if (form.tipo === 'retirada') {
    if (!o.ret) return 'A retirada na loja não está disponível no momento.';
  } else {
    return 'Escolha entre entrega e retirada na loja.';
  }
  if (!o.pags.some((p) => p.id === form.pagId)) return 'A forma de pagamento escolhida não está mais disponível. Escolha outra.';
  return '';
}

export function htmlPassos(atual) {
  const nomes = ['Carrinho', 'Dados', 'Resumo'];
  return `<ol class="lj-passos" aria-label="Etapas do pedido">${nomes.map((n, i) => `<li${i + 1 === atual ? ' aria-current="step"' : ''}>${i + 1}. ${n}</li>`).join('')}</ol>`;
}

// ---------- Formulário ----------
function campo(chave, id, rotulo, valor, o = {}) {
  const erro = o.erros && o.erros[chave];
  const eid = `lj-e-${chave}`;
  return `<div class="lj-campo"><label for="${id}">${rotulo}${o.obrig ? '' : ' <span class="lj-ajuda">(opcional)</span>'}</label>
    <input id="${id}" name="${chave}" type="${o.tipo || 'text'}" value="${esc(valor)}"${o.auto ? ` autocomplete="${o.auto}"` : ''}${o.modo ? ` inputmode="${o.modo}"` : ''} maxlength="${o.max || 120}"${o.obrig ? ' aria-required="true"' : ''}${erro ? ` aria-invalid="true" aria-describedby="${eid}"` : ''}>
    ${erro ? `<p class="lj-msg-campo" id="${eid}" role="alert">${esc(erro)}</p>` : ''}</div>`;
}

function opcao(nome, valor, marcado, titulo, detalhe) {
  return `<label class="lj-opcao"><input type="radio" name="${nome}" value="${esc(valor)}"${marcado ? ' checked' : ''}><span><strong>${esc(titulo)}</strong>${detalhe ? `<small>${esc(detalhe)}</small>` : ''}</span></label>`;
}

function grupo(id, chave, legenda, miolo, erros) {
  const erro = erros[chave];
  return `<fieldset class="lj-campo" id="${id}"${erro ? ` aria-describedby="lj-e-${chave}"` : ''}><legend>${legenda}</legend>
    <div class="lj-opcoes">${miolo}</div>
    ${erro ? `<p class="lj-msg-campo" id="lj-e-${chave}" role="alert">${esc(erro)}</p>` : ''}</fieldset>`;
}

export function htmlFormulario(form, cfg, erros = {}, erroGeral = '') {
  const o = opcoesDe(cfg);
  const tipos = (o.zonas.length ? opcao('tipo', 'entrega', form.tipo === 'entrega', 'Entrega', 'Levamos até você') : '')
    + (o.ret ? opcao('tipo', 'retirada', form.tipo === 'retirada', 'Retirada na loja', o.textoRet) : '');
  const zonas = o.zonas.map((z) => opcao('zona', z.id, form.zonaId === z.id, z.nome,
    `Taxa: ${textoTaxa(z.taxa)}${z.prazo ? ` · ${z.prazo}` : ''}`)).join('');
  const pags = o.pags.map((p) => opcao('pag', p.id, form.pagId === p.id, p.nome, p.instrucoes || '')).join('');
  const c = { erros, obrig: true };
  return `<form class="lj-form" id="lj-form" novalidate>
    ${erroGeral ? `<div class="lj-erro" role="alert">${esc(erroGeral)}</div>` : ''}
    ${campo('nome', 'lj-f-nome', 'Nome completo', form.nome, { ...c, auto: 'name' })}
    ${campo('whats', 'lj-f-whats', 'WhatsApp com DDD', form.whats, { ...c, tipo: 'tel', auto: 'tel-national', modo: 'tel', max: 18 })}
    ${grupo('lj-g-tipo', 'tipo', 'Como você quer receber?', tipos, erros)}
    <div id="lj-sec-entrega"${form.tipo === 'entrega' ? '' : ' hidden'}>
      ${grupo('lj-g-zona', 'zona', 'Zona de entrega', zonas, erros)}
      ${campo('rua', 'lj-f-rua', 'Rua', form.rua, { ...c, auto: 'address-line1' })}
      ${campo('numero', 'lj-f-numero', 'Número', form.numero, { ...c, max: 20 })}
      ${campo('bairro', 'lj-f-bairro', 'Bairro', form.bairro, { ...c, max: 80 })}
      ${campo('complemento', 'lj-f-compl', 'Complemento', form.complemento, { erros, max: 80 })}
      ${campo('referencia', 'lj-f-ref', 'Ponto de referência', form.referencia, { erros })}
    </div>
    ${grupo('lj-g-pag', 'pag', 'Forma de pagamento', pags, erros)}
    <p class="lj-ajuda">O pagamento não é feito pelo site: é combinado na entrega, na retirada ou pelo WhatsApp.</p>
    <div class="lj-campo"><label for="lj-f-obs">Observações <span class="lj-ajuda">(opcional)</span></label>
      <textarea id="lj-f-obs" name="obs" maxlength="500">${esc(form.obs)}</textarea></div>
    <div class="sr-only" aria-hidden="true"><label for="lj-f-site">Não preencha este campo</label>
      <input id="lj-f-site" name="contato_site" type="text" tabindex="-1" autocomplete="off" value="${esc(form.honey)}"></div>
    <div class="lj-campo"><label class="lj-opcao"><input type="checkbox" id="lj-f-consent" name="consent"${form.consent ? ' checked' : ''}${erros.consent ? ' aria-invalid="true" aria-describedby="lj-e-consent"' : ''}>
      <span>Li e concordo com a <a href="../privacidade.html" target="_blank" rel="noopener">Política de Privacidade</a> e autorizo o uso dos meus dados para atender este pedido.</span></label>
      ${erros.consent ? `<p class="lj-msg-campo" id="lj-e-consent" role="alert">${esc(erros.consent)}</p>` : ''}</div>
  </form>`;
}

export function lerFormulario(raiz, form) {
  const f = raiz.querySelector('#lj-form');
  if (!f) return form;
  const v = (id) => { const el = f.querySelector(`#${id}`); return el ? el.value : ''; };
  const radio = (nome) => { const el = f.querySelector(`input[name="${nome}"]:checked`); return el ? el.value : ''; };
  form.nome = v('lj-f-nome');
  form.whats = v('lj-f-whats');
  form.tipo = radio('tipo');
  form.zonaId = radio('zona');
  form.rua = v('lj-f-rua');
  form.numero = v('lj-f-numero');
  form.bairro = v('lj-f-bairro');
  form.complemento = v('lj-f-compl');
  form.referencia = v('lj-f-ref');
  form.pagId = radio('pag');
  form.obs = v('lj-f-obs');
  const c = f.querySelector('#lj-f-consent');
  form.consent = !!(c && c.checked);
  form.honey = v('lj-f-site');
  return form;
}

export function validarFormulario(form, cfg) {
  const o = opcoesDe(cfg);
  const e = {};
  if (form.nome.trim().length < 2) e.nome = 'Informe seu nome completo.';
  if (!normalizarWhatsApp(form.whats)) e.whats = 'Informe um WhatsApp válido, com DDD.';
  const tipoOk = (form.tipo === 'entrega' && o.zonas.length > 0) || (form.tipo === 'retirada' && o.ret);
  if (!tipoOk) e.tipo = 'Escolha entre entrega e retirada na loja.';
  if (form.tipo === 'entrega') {
    if (!o.zonas.some((z) => z.id === form.zonaId)) e.zona = 'Escolha a zona de entrega.';
    if (!form.rua.trim()) e.rua = 'Informe a rua.';
    if (!form.numero.trim()) e.numero = 'Informe o número (use S/N se não houver).';
    if (!form.bairro.trim()) e.bairro = 'Informe o bairro.';
  }
  if (!o.pags.some((p) => p.id === form.pagId)) e.pag = 'Escolha a forma de pagamento.';
  if (!form.consent) e.consent = 'É preciso aceitar a Política de Privacidade para enviar o pedido.';
  return e;
}

const ALVOS = [
  ['nome', '#lj-f-nome'], ['whats', '#lj-f-whats'], ['tipo', '#lj-g-tipo input'], ['zona', '#lj-g-zona input'],
  ['rua', '#lj-f-rua'], ['numero', '#lj-f-numero'], ['bairro', '#lj-f-bairro'],
  ['pag', '#lj-g-pag input'], ['consent', '#lj-f-consent']
];

export function primeiroInvalido(raiz, erros) {
  for (const [chave, seletor] of ALVOS) {
    if (erros[chave]) return raiz.querySelector(seletor);
  }
  return null;
}

// ---------- Resumo ----------
function linha(rotulo, valor, cls = '') {
  return `<div class="lj-resumo-linha${cls ? ` ${cls}` : ''}"><dt>${rotulo}</dt><dd>${valor}</dd></div>`;
}

export function htmlResumo(res) {
  const f = res.form;
  const itens = res.linhas.map((l) => linha(`${Number(l.quantidade)}× ${esc(l.nome)}`,
    esc(brl(arred(Number(l.preco) * Number(l.quantidade)))))).join('');
  const entrega = res.tipo === 'entrega'
    ? linha('Recebimento', `Entrega${res.zona ? ` — ${esc(res.zona.nome)}` : ''}`)
      + (res.zona && res.zona.prazo ? linha('Prazo', esc(res.zona.prazo)) : '')
      + linha('Endereço', esc([`${f.rua.trim()}, ${f.numero.trim()} - ${f.bairro.trim()}`, f.complemento.trim(),
        f.referencia.trim() ? `Ref.: ${f.referencia.trim()}` : ''].filter(Boolean).join(' · ')))
    : linha('Recebimento', 'Retirada na loja') + (res.retiradaTexto ? linha('Retirada', esc(res.retiradaTexto)) : '');
  const obs = f.obs.trim();
  return `<div class="lj-resumo">
    <h3>Itens</h3>
    <dl>${itens}
      ${linha('Subtotal', esc(brl(res.subtotal)))}
      ${res.tipo === 'entrega' ? linha('Taxa de entrega', esc(textoTaxa(res.taxa))) : ''}
      ${linha('Total', esc(brl(res.total)), 'lj-resumo-total')}
    </dl>
    <h3>Recebimento</h3><dl>${entrega}</dl>
    <h3>Pagamento</h3><dl>${linha('Forma', esc(res.pag.nome))}${res.pag.instrucoes ? linha('Instruções', esc(res.pag.instrucoes)) : ''}</dl>
    <h3>Seus dados</h3><dl>${linha('Nome', esc(f.nome.trim()))}${linha('WhatsApp', esc(formatarWhatsApp(normalizarWhatsApp(f.whats))))}</dl>
    ${obs ? `<h3>Observações</h3><p>${esc(obs)}</p>` : ''}
  </div>`;
}

// ---------- Texto do WhatsApp (feito a partir do pedido já gravado) ----------
export function textoWhats(r) {
  const L = [];
  L.push(`Olá! Fiz o pedido ${r.numero} na loja do site.`);
  L.push(`Nome: ${r.cliente_nome}`);
  L.push('');
  L.push('Itens:');
  (r.itens || []).forEach((i) => {
    L.push(`- ${i.quantidade}x ${i.nome} (${brl(i.preco_unitario)} cada) = ${brl(i.subtotal)}`);
  });
  L.push('');
  L.push(`Subtotal: ${brl(r.subtotal)}`);
  if (r.tipo_entrega === 'entrega') L.push(`Taxa de entrega: ${brl(r.taxa_entrega)}`);
  L.push(`Total: ${brl(r.total)}`);
  L.push('');
  if (r.tipo_entrega === 'entrega') {
    const e = r.endereco || {};
    const partes = [`${e.rua || ''}, ${e.numero || ''} - ${e.bairro || ''}`, e.complemento || '',
      e.referencia ? `Ref.: ${e.referencia}` : ''].filter(Boolean).join(' · ');
    L.push(`Entrega${r.zona_nome ? ` (${r.zona_nome})` : ''}: ${partes}`);
  } else {
    L.push('Retirada na loja');
  }
  L.push(`Pagamento: ${r.forma_pagamento_nome}`);
  if (r.observacoes) L.push(`Observações: ${r.observacoes}`);
  return L.join('\n');
    }
