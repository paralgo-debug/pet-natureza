// Pet Natureza - Painel: aba Pedidos (Administrador e Funcionário)
import { supabase } from './supabase.js';
import { esc, toast, confirmar } from './util.js';
import { brl, dataHoraBR, msgErro, debounce, rotuloStatus, classeStatus, STATUS_PEDIDO, UUID_RE, paramsAba } from './loja-util.js';

const POR_PAGINA = 20;
const LISTA = '#/produtos?aba=pedidos';
const ORDENS = { recentes: ['criado_em', false], antigos: ['criado_em', true], maior: ['total', false], menor: ['total', true] };
const ROT_ORDEM = { recentes: 'Mais recentes', antigos: 'Mais antigos', maior: 'Maior valor', menor: 'Menor valor' };
const FLUXO = ['novo', 'confirmado', 'em_preparo', 'concluido'];
const filtros = { q: '', status: '', de: '', ate: '', ordem: 'recentes', pagina: 1 };

function fmtWhats(d) {
  let s = String(d || '').replace(/\D/g, '');
  if (s.length > 11 && s.startsWith('55')) s = s.slice(2);
  if (s.length === 11) return `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7)}`;
  if (s.length === 10) return `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}`;
  return s;
}

export async function viewPedidos(alvo, ctx) {
  const id = paramsAba().get('pedido');
  if (id) return telaDetalhe(alvo, id, ctx);
  return telaLista(alvo);
}

// ---------- Lista ----------
function telaLista(alvo) {
  alvo.innerHTML = `
    <form class="lj-barra" role="search" id="lj-o-filtros">
      <div class="campo"><label for="lj-o-q">Buscar (cliente, número ou WhatsApp)</label>
        <input id="lj-o-q" type="search" maxlength="100" value="${esc(filtros.q)}"></div>
      <div class="campo"><label for="lj-o-st">Status</label><select id="lj-o-st"><option value="">Todos</option>
        ${STATUS_PEDIDO.map(([k, r]) => `<option value="${k}">${r}</option>`).join('')}</select></div>
      <div class="campo"><label for="lj-o-de">De</label><input id="lj-o-de" type="date" value="${esc(filtros.de)}"></div>
      <div class="campo"><label for="lj-o-ate">Até</label><input id="lj-o-ate" type="date" value="${esc(filtros.ate)}"></div>
      <div class="campo"><label for="lj-o-ord">Ordenar por</label><select id="lj-o-ord">
        ${Object.entries(ROT_ORDEM).map(([k, r]) => `<option value="${k}">${r}</option>`).join('')}</select></div>
      <button type="button" class="btn" id="lj-o-atualizar">Atualizar</button>
    </form>
    <p class="suave" id="lj-o-info" role="status" aria-live="polite"></p>
    <div id="lj-o-lista"></div>
    <nav class="lj-pag-adm" id="lj-o-pag" aria-label="Paginação"></nav>`;
  const q = alvo.querySelector('#lj-o-q');
  const selSt = alvo.querySelector('#lj-o-st');
  const de = alvo.querySelector('#lj-o-de');
  const ate = alvo.querySelector('#lj-o-ate');
  const selOrd = alvo.querySelector('#lj-o-ord');
  const info = alvo.querySelector('#lj-o-info');
  const lista = alvo.querySelector('#lj-o-lista');
  const pag = alvo.querySelector('#lj-o-pag');
  selSt.value = filtros.status;
  selOrd.value = filtros.ordem;

  function cartao(p) {
    return `<li class="lj-item sem-mini">
      <div>
        <div class="lj-item-topo"><p class="lj-item-nome">${esc(p.numero)} · ${esc(p.cliente_nome)}</p>
          <span class="${classeStatus(p.status)}">${rotuloStatus(p.status)}</span></div>
        <p class="lj-item-meta">${esc(dataHoraBR(p.criado_em))} · ${p.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada'} · <strong>${esc(brl(p.total))}</strong> · ${esc(fmtWhats(p.cliente_whatsapp))}</p>
      </div>
      <div class="lj-item-acoes"><a class="btn btn-pequeno" href="${LISTA}&pedido=${esc(p.id)}" aria-label="Abrir pedido ${esc(p.numero)}">Abrir pedido</a></div></li>`;
  }

  async function carregar() {
    lista.setAttribute('aria-busy', 'true');
    info.textContent = 'Carregando…';
    let c = supabase.from('lj_pedidos')
      .select('id,numero,criado_em,status,cliente_nome,cliente_whatsapp,tipo_entrega,total', { count: 'exact' });
    if (filtros.status) c = c.eq('status', filtros.status);
    if (filtros.de) c = c.gte('criado_em', `${filtros.de}T00:00:00-03:00`);
    if (filtros.ate) c = c.lte('criado_em', `${filtros.ate}T23:59:59.999-03:00`);
    const termo = filtros.q.trim().replace(/[^\p{L}\p{N} .\-]/gu, '').trim();
    if (termo) {
      const t = termo.replace(/\s+/g, '*');
      const dig = termo.replace(/\D/g, '');
      const partes = [`numero.ilike.*${t}*`, `cliente_nome.ilike.*${t}*`];
      if (dig.length >= 3) partes.push(`cliente_whatsapp.ilike.*${dig}*`);
      c = c.or(partes.join(','));
    }
    const [col, asc] = ORDENS[filtros.ordem] || ORDENS.recentes;
    c = c.order(col, { ascending: asc });
    if (col !== 'criado_em') c = c.order('criado_em', { ascending: false });
    const ini = (filtros.pagina - 1) * POR_PAGINA;
    const { data, error, count } = await c.range(ini, ini + POR_PAGINA - 1);
    lista.setAttribute('aria-busy', 'false');
    if (error) {
      if (filtros.pagina > 1) { filtros.pagina = 1; return carregar(); }
      info.textContent = '';
      lista.innerHTML = `<p class="erro" role="alert">${esc(msgErro(error))}</p>`;
      pag.innerHTML = '';
      return undefined;
    }
    const total = count || 0;
    const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    info.textContent = total ? `${total} ${total === 1 ? 'pedido' : 'pedidos'}` : '';
    lista.innerHTML = (data || []).length
      ? `<ul class="lj-cards">${data.map(cartao).join('')}</ul>`
      : '<p class="lj-vazio">Nenhum pedido encontrado.</p>';
    pag.innerHTML = paginas > 1
      ? `<button type="button" class="btn" data-pg="${filtros.pagina - 1}"${filtros.pagina <= 1 ? ' disabled' : ''}>Anterior</button>
         <span>Página ${filtros.pagina} de ${paginas}</span>
         <button type="button" class="btn" data-pg="${filtros.pagina + 1}"${filtros.pagina >= paginas ? ' disabled' : ''}>Próxima</button>` : '';
    return undefined;
  }

  function datasOk() {
    if (de.value && ate.value && de.value > ate.value) {
      toast('A data inicial não pode ser depois da data final.', 'erro');
      return false;
    }
    return true;
  }

  q.addEventListener('input', debounce(() => { filtros.q = q.value.trim(); filtros.pagina = 1; carregar(); }, 350));
  alvo.querySelector('#lj-o-filtros').addEventListener('submit', (ev) => ev.preventDefault());
  selSt.addEventListener('change', () => { filtros.status = selSt.value; filtros.pagina = 1; carregar(); });
  selOrd.addEventListener('change', () => { filtros.ordem = selOrd.value; filtros.pagina = 1; carregar(); });
  de.addEventListener('change', () => { if (!datasOk()) return; filtros.de = de.value; filtros.pagina = 1; carregar(); });
  ate.addEventListener('change', () => { if (!datasOk()) return; filtros.ate = ate.value; filtros.pagina = 1; carregar(); });
  alvo.querySelector('#lj-o-atualizar').addEventListener('click', () => carregar());
  pag.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-pg]');
    if (!b || b.disabled) return;
    filtros.pagina = Number(b.dataset.pg);
    carregar();
  });
  return carregar();
}

// ---------- Detalhe ----------
function opcoesStatus(atual) {
  if (atual === 'cancelado') return [];
  const i = FLUXO.indexOf(atual);
  return FLUXO.slice(i + 1).concat(['cancelado']);
}

const comQuebras = (t) => esc(t).replace(/\r?\n/g, '<br>');

async function telaDetalhe(alvo, id, ctx, foco) {
  const voltar = `<div class="acoes"><a class="btn" href="${LISTA}">&larr; Voltar aos pedidos</a></div>`;
  if (!UUID_RE.test(id)) {
    alvo.innerHTML = `${voltar}<div class="cartao"><p class="erro" role="alert">Pedido inválido.</p></div>`;
    return;
  }
  alvo.innerHTML = '<p class="carregando">Carregando pedido…</p>';
  const [pr, ir, hr, nr] = await Promise.all([
    supabase.from('lj_pedidos').select('*').eq('id', id).maybeSingle(),
    supabase.from('lj_pedido_itens').select('*').eq('pedido_id', id).order('id'),
    supabase.from('lj_pedido_historico').select('*').eq('pedido_id', id).order('criado_em', { ascending: false }).order('id', { ascending: false }),
    supabase.from('lj_pedido_notas').select('*').eq('pedido_id', id).order('criado_em', { ascending: false }).order('id', { ascending: false })
  ]);
  const erro = pr.error || ir.error || hr.error || nr.error;
  if (erro || !pr.data) {
    alvo.innerHTML = `${voltar}<div class="cartao"><p class="erro" role="alert">${esc(erro ? msgErro(erro) : 'Pedido não encontrado.')}</p></div>`;
    return;
  }
  const ped = pr.data;
  const itens = ir.data || [];
  const hist = hr.data || [];
  const notas = nr.data || [];

  const ids = Array.from(new Set(hist.map((h) => h.por).concat(notas.map((n) => n.autor)).filter(Boolean)));
  const nomes = new Map();
  if (ids.length) {
    const r = await supabase.from('profiles').select('id,nome').in('id', ids);
    if (!r.error) (r.data || []).forEach((x) => nomes.set(x.id, x.nome));
  }
  const quem = (uid, padrao) => (uid ? (nomes.get(uid) || 'equipe') : padrao);

  const primeiroNome = String(ped.cliente_nome || '').split(' ')[0];
  const zap = `https://wa.me/${encodeURIComponent(String(ped.cliente_whatsapp).replace(/\D/g, ''))}?text=${encodeURIComponent(`Olá, ${primeiroNome}! Aqui é da Pet Natureza, sobre o seu pedido ${ped.numero}.`)}`;
  const endereco = [`${ped.end_rua}, ${ped.end_numero} - ${ped.end_bairro}`, ped.end_complemento,
    ped.end_referencia ? `Ref.: ${ped.end_referencia}` : ''].filter(Boolean).join(' · ');
  const proximos = opcoesStatus(ped.status);

  alvo.innerHTML = `${voltar}
    <section class="cartao" aria-labelledby="lj-d-tit">
      <div class="lj-item-topo"><h2 id="lj-d-tit" tabindex="-1">Pedido ${esc(ped.numero)}</h2><span class="${classeStatus(ped.status)}">${rotuloStatus(ped.status)}</span></div>
      <p class="suave">Feito em ${esc(dataHoraBR(ped.criado_em))}. Consentimento da política de privacidade registrado em ${esc(dataHoraBR(ped.consentimento_em))}.</p>
    </section>
    <section class="cartao" aria-labelledby="lj-d-cli"><h3 id="lj-d-cli">Cliente</h3>
      <dl class="lj-dl"><dt>Nome</dt><dd>${esc(ped.cliente_nome)}</dd><dt>WhatsApp</dt><dd>${esc(fmtWhats(ped.cliente_whatsapp))}</dd></dl>
      <div class="acoes"><a class="btn btn-primario" href="${esc(zap)}" target="_blank" rel="noopener">Chamar no WhatsApp<span class="lj-so-leitor"> (abre em outra aba)</span></a></div>
    </section>
    <section class="cartao" aria-labelledby="lj-d-itens"><h3 id="lj-d-itens">Itens e valores</h3>
      <p class="ajuda">Valores gravados no momento do pedido. Mudanças posteriores de preço ou de nome não alteram este pedido.</p>
      <ul class="lj-hist">${itens.map((i) => `<li><strong>${Number(i.quantidade)}× ${esc(i.nome)}</strong>${i.sku ? ` (SKU ${esc(i.sku)})` : ''}${i.em_promocao ? ' <span class="lj-tag lj-tag-ok">Promoção</span>' : ''}
        <small>${esc(brl(i.preco_unitario))} cada · subtotal ${esc(brl(i.subtotal))}</small></li>`).join('')}</ul>
      <dl class="lj-dl"><dt>Subtotal</dt><dd>${esc(brl(ped.subtotal))}</dd>
        ${ped.tipo_entrega === 'entrega' ? `<dt>Taxa de entrega</dt><dd>${esc(brl(ped.taxa_entrega))}</dd>` : ''}
        <dt>Total</dt><dd><strong>${esc(brl(ped.total))}</strong></dd></dl>
    </section>
    <section class="cartao" aria-labelledby="lj-d-rec"><h3 id="lj-d-rec">Recebimento e pagamento</h3>
      <dl class="lj-dl"><dt>Recebimento</dt><dd>${ped.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada na loja'}</dd>
        ${ped.tipo_entrega === 'entrega' ? `<dt>Zona</dt><dd>${esc(ped.zona_nome || '')}</dd><dt>Endereço</dt><dd>${esc(endereco)}</dd>` : ''}
        <dt>Pagamento</dt><dd>${esc(ped.forma_pagamento_nome)}</dd>
        ${ped.observacoes ? `<dt>Observações do cliente</dt><dd>${comQuebras(ped.observacoes)}</dd>` : ''}</dl>
    </section>
    <section class="cartao" aria-labelledby="lj-d-st"><h3 id="lj-d-st">Status do pedido</h3>
      ${proximos.length ? `<form id="lj-d-form-st" novalidate>
        <div class="lj-grade-form">
          <div class="campo"><label for="lj-d-novo">Mudar para</label><select id="lj-d-novo">${proximos.map((s) => `<option value="${s}">${rotuloStatus(s)}</option>`).join('')}</select></div>
          <div class="campo"><label for="lj-d-detalhe">Observação para o histórico (opcional)</label><input id="lj-d-detalhe" maxlength="500" autocomplete="off"></div>
        </div>
        <p class="lj-aviso-loja" id="lj-d-aviso-cancel" role="note" hidden>Ao cancelar, os produtos com controle de estoque voltam ao estoque (uma única vez). O cancelamento não pode ser desfeito.</p>
        <div class="lj-acoes-fixas"><button type="submit" class="btn btn-primario" id="lj-d-salvar">Atualizar status</button></div>
      </form>` : '<p class="suave">Este pedido foi cancelado e não pode mais mudar de status. O estoque dos itens já foi devolvido.</p>'}
    </section>
    <section class="cartao" aria-labelledby="lj-d-notas"><h3 id="lj-d-notas">Notas internas</h3>
      <p class="ajuda">Só a equipe vê estas notas. O cliente não.</p>
      <form id="lj-d-form-nota" novalidate>
        <div class="campo"><label for="lj-n-texto">Nova nota</label><textarea id="lj-n-texto" maxlength="1000"></textarea></div>
        <p class="erro" id="lj-n-erro" role="alert" hidden></p>
        <div class="lj-acoes-fixas"><button type="submit" class="btn" id="lj-n-salvar">Adicionar nota</button></div>
      </form>
      ${notas.length ? `<ul class="lj-notas">${notas.map((n) => `<li>${comQuebras(n.texto)}<small>${esc(quem(n.autor, 'equipe'))} · ${esc(dataHoraBR(n.criado_em))}</small></li>`).join('')}</ul>` : '<p class="suave">Nenhuma nota ainda.</p>'}
    </section>
    <section class="cartao" aria-labelledby="lj-d-hist"><h3 id="lj-d-hist">Histórico</h3>
      <ul class="lj-hist">${hist.map((h) => `<li><strong>${h.de ? `${rotuloStatus(h.de)} → ` : ''}${rotuloStatus(h.para)}</strong>${h.detalhe ? `<br>${comQuebras(h.detalhe)}` : ''}
        <small>${esc(dataHoraBR(h.criado_em))} · ${esc(quem(h.por, 'site'))}</small></li>`).join('')}</ul>
    </section>`;

  const formSt = alvo.querySelector('#lj-d-form-st');
  if (formSt) {
    const sel = formSt.querySelector('#lj-d-novo');
    const avisoCancel = formSt.querySelector('#lj-d-aviso-cancel');
    sel.addEventListener('change', () => { avisoCancel.hidden = sel.value !== 'cancelado'; });
    formSt.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const novo = sel.value;
      const detalhe = formSt.querySelector('#lj-d-detalhe').value.trim();
      if (novo === 'cancelado' && !await confirmar(
        `Cancelar o pedido ${ped.numero}? Os produtos com controle de estoque voltam ao estoque. Esta ação não pode ser desfeita.`, 'Cancelar pedido')) return;
      const btn = formSt.querySelector('#lj-d-salvar');
      btn.disabled = true;
      const r = await supabase.rpc('lj_alterar_status_pedido', { p_id: id, p_status: novo, p_detalhe: detalhe || null });
      if (r.error) {
        toast(msgErro(r.error), 'erro');
        btn.disabled = false;
        return;
      }
      toast(novo === 'cancelado' ? 'Pedido cancelado e estoque devolvido.' : 'Status atualizado.');
      await telaDetalhe(alvo, id, ctx, '#lj-d-tit');
    });
  }

  const formNota = alvo.querySelector('#lj-d-form-nota');
  formNota.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const campo = formNota.querySelector('#lj-n-texto');
    const erroEl = formNota.querySelector('#lj-n-erro');
    const texto = campo.value.trim();
    erroEl.hidden = true;
    if (!texto) { erroEl.textContent = 'Escreva a nota antes de adicionar.'; erroEl.hidden = false; campo.focus(); return; }
    const btn = formNota.querySelector('#lj-n-salvar');
    btn.disabled = true;
    const r = await supabase.from('lj_pedido_notas').insert({ pedido_id: id, autor: ctx.user.id, texto });
    if (r.error) {
      erroEl.textContent = msgErro(r.error);
      erroEl.hidden = false;
      btn.disabled = false;
      return;
    }
    toast('Nota adicionada.');
    await telaDetalhe(alvo, id, ctx, '#lj-n-texto');
  });

  const alvoFoco = alvo.querySelector(foco || '#lj-d-tit');
  if (alvoFoco) alvoFoco.focus({ preventScroll: !foco });
                                                                                                                                               }
