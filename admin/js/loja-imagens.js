// Pet Natureza - Painel: imagens do produto (redimensiona, envia ao bucket "produtos", organiza)
import { supabase } from './supabase.js';
import { esc, toast, confirmar } from './util.js';
import { urlImagem, msgErro } from './loja-util.js';

const MAX_IMAGENS = 8;
const LADO_GRANDE = 1200;
const LADO_MINI = 400;
const LIMITE_BYTES = 1572864;
const MAX_ORIGINAL = 25 * 1024 * 1024;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

function aleatorio() {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

async function abrirImagem(arquivo) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(arquivo, { imageOrientation: 'from-image' }); } catch (e) { /* tenta o outro jeito */ }
  }
  return new Promise((ok, erro) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); erro(new Error('Não foi possível ler esta imagem.')); };
    img.src = url;
  });
}

function desenhar(fonte, lado, fundoBranco) {
  const w0 = fonte.naturalWidth || fonte.width;
  const h0 = fonte.naturalHeight || fonte.height;
  const fator = Math.min(1, lado / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * fator));
  const h = Math.max(1, Math.round(h0 * fator));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (fundoBranco) { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); }
  g.imageSmoothingQuality = 'high';
  g.drawImage(fonte, 0, 0, w, h);
  return c;
}

const paraBlob = (c, tipo, q) => new Promise((ok) => c.toBlob(ok, tipo, q));

async function codificar(fonte, lado) {
  let c = desenhar(fonte, lado, false);
  for (const q of [0.82, 0.7, 0.58, 0.46]) {
    const b = await paraBlob(c, 'image/webp', q);
    if (!b || b.type !== 'image/webp') break;
    if (b.size <= LIMITE_BYTES) return { blob: b, ext: 'webp', tipo: 'image/webp' };
  }
  c = desenhar(fonte, lado, true);
  for (const q of [0.85, 0.72, 0.6, 0.48, 0.38]) {
    const b = await paraBlob(c, 'image/jpeg', q);
    if (b && b.size <= LIMITE_BYTES) return { blob: b, ext: 'jpg', tipo: 'image/jpeg' };
  }
  throw new Error('A imagem continuou grande demais depois de reduzida. Use uma foto menor.');
}

async function enviarArquivo(produtoId, arquivo) {
  const fonte = await abrirImagem(arquivo);
  try {
    const grande = await codificar(fonte, LADO_GRANDE);
    const mini = await codificar(fonte, LADO_MINI);
    const base = aleatorio();
    const path = `${produtoId}/${base}.${grande.ext}`;
    const thumb = `${produtoId}/${base}_t.${mini.ext}`;
    const balde = supabase.storage.from('produtos');
    const opc = { cacheControl: '31536000', upsert: false };
    let r = await balde.upload(path, grande.blob, { ...opc, contentType: grande.tipo });
    if (r.error) throw r.error;
    r = await balde.upload(thumb, mini.blob, { ...opc, contentType: mini.tipo });
    if (r.error) { await balde.remove([path]); throw r.error; }
    return { path, thumb };
  } finally {
    if (fonte && typeof fonte.close === 'function') fonte.close();
  }
}

// opc: { nome (texto alternativo padrão), aoMudar() }
export async function montarImagens(alvo, produtoId, opc = {}) {
  let imgs = [];
  let ocupado = false;

  alvo.innerHTML = `<section class="cartao" aria-labelledby="lj-img-tit">
    <h3 id="lj-img-tit">Imagens do produto</h3>
    <p class="ajuda">Até ${MAX_IMAGENS} imagens (JPG, PNG ou WebP). Elas são reduzidas automaticamente antes de enviar. A imagem principal aparece primeiro na loja.</p>
    <div id="lj-img-lista"><p class="carregando">Carregando imagens…</p></div>
    <div class="campo"><label for="lj-img-arq">Adicionar imagens</label>
      <input type="file" id="lj-img-arq" accept="image/jpeg,image/png,image/webp" multiple></div>
    <p class="suave" id="lj-img-status" role="status" aria-live="polite"></p>
  </section>`;
  const lista = alvo.querySelector('#lj-img-lista');
  const entrada = alvo.querySelector('#lj-img-arq');
  const status = alvo.querySelector('#lj-img-status');

  function avisarMudanca() { if (typeof opc.aoMudar === 'function') opc.aoMudar(imgs.slice()); }

  function desenharLista() {
    entrada.disabled = ocupado || imgs.length >= MAX_IMAGENS;
    if (!imgs.length) {
      lista.innerHTML = '<p class="lj-vazio">Este produto ainda não tem imagens. Na loja aparece o emoji da categoria.</p>';
      return;
    }
    lista.innerHTML = `<p class="suave">${imgs.length} de ${MAX_IMAGENS} imagens</p><ul class="lj-imgs">${imgs.map((im, i) => `
      <li class="lj-img${im.principal ? ' lj-img-principal' : ''}" data-id="${esc(im.id)}">
        <img src="${esc(urlImagem(im.thumb_path || im.path))}" alt="" width="200" height="200" loading="lazy">
        <div class="campo"><label for="lj-alt-${esc(im.id)}">Texto alternativo (imagem ${i + 1})</label>
          <input id="lj-alt-${esc(im.id)}" data-alt maxlength="160" value="${esc(im.alt)}"></div>
        <div class="lj-img-acoes">
          <label class="lj-linha-check"><input type="radio" name="lj-principal" data-principal${im.principal ? ' checked' : ''}> Principal</label>
          <button type="button" class="btn btn-pequeno" data-sobe aria-label="Mover imagem ${i + 1} para antes"${i === 0 ? ' disabled' : ''}>&larr;</button>
          <button type="button" class="btn btn-pequeno" data-desce aria-label="Mover imagem ${i + 1} para depois"${i === imgs.length - 1 ? ' disabled' : ''}>&rarr;</button>
          <button type="button" class="btn btn-pequeno btn-perigo" data-remove aria-label="Remover imagem ${i + 1}">Remover</button>
        </div>
      </li>`).join('')}</ul>`;
    if (ocupado) lista.querySelectorAll('button, input').forEach((el) => { el.disabled = true; });
  }

  async function carregar() {
    const { data, error } = await supabase.from('lj_produto_imagens').select('*')
      .eq('produto_id', produtoId).order('ordem').order('id');
    if (error) { lista.innerHTML = `<p class="erro" role="alert">${esc(msgErro(error))}</p>`; return; }
    imgs = data || [];
    desenharLista();
    avisarMudanca();
  }

  async function executar(fn) {
    if (ocupado) return;
    ocupado = true;
    desenharLista();
    try { await fn(); } catch (e) { toast(msgErro(e), 'erro'); } finally { ocupado = false; await carregar(); }
  }

  async function salvarOrdem(lote) {
    const r = await Promise.all(lote.map((im, i) => supabase.from('lj_produto_imagens').update({ ordem: i }).eq('id', im.id)));
    const falha = r.find((x) => x.error);
    if (falha) throw falha.error;
  }

  alvo.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-sobe],[data-desce],[data-remove]');
    const li = b && b.closest('[data-id]');
    if (!li) return;
    const i = imgs.findIndex((x) => x.id === li.dataset.id);
    if (i < 0) return;
    if (b.hasAttribute('data-remove')) {
      executar(async () => {
        if (!await confirmar('Remover esta imagem? Ela também será apagada do armazenamento.', 'Remover')) return;
        const im = imgs[i];
        const { error } = await supabase.from('lj_produto_imagens').delete().eq('id', im.id);
        if (error) throw error;
        await supabase.storage.from('produtos').remove([im.path, im.thumb_path].filter(Boolean));
        const resto = imgs.filter((x) => x.id !== im.id);
        if (im.principal && resto.length) {
          const r = await supabase.from('lj_produto_imagens').update({ principal: true }).eq('id', resto[0].id);
          if (r.error) throw r.error;
        }
        await salvarOrdem(resto);
      });
    } else {
      const j = b.hasAttribute('data-sobe') ? i - 1 : i + 1;
      if (j < 0 || j >= imgs.length) return;
      executar(async () => {
        const novo = imgs.slice();
        [novo[i], novo[j]] = [novo[j], novo[i]];
        await salvarOrdem(novo);
      });
    }
  });

  alvo.addEventListener('change', (ev) => {
    const t = ev.target;
    const li = t.closest('[data-id]');
    if (t.matches('[data-alt]') && li) {
      executar(async () => {
        const { error } = await supabase.from('lj_produto_imagens').update({ alt: t.value.trim().slice(0, 160) }).eq('id', li.dataset.id);
        if (error) throw error;
        toast('Texto alternativo salvo.');
      });
    } else if (t.matches('[data-principal]') && li) {
      executar(async () => {
        const { error } = await supabase.from('lj_produto_imagens').update({ principal: true }).eq('id', li.dataset.id);
        if (error) throw error;
        toast('Imagem principal atualizada.');
      });
    } else if (t === entrada) {
      const arquivos = Array.from(entrada.files || []);
      entrada.value = '';
      if (arquivos.length) enviarVarios(arquivos);
    }
  });

  function enviarVarios(arquivos) {
    executar(async () => {
      const vagas = MAX_IMAGENS - imgs.length;
      if (vagas <= 0) { toast(`O limite é de ${MAX_IMAGENS} imagens por produto.`, 'erro'); return; }
      const lote = arquivos.slice(0, vagas);
      if (arquivos.length > vagas) toast(`Só cabem mais ${vagas} imagem(ns). As demais foram ignoradas.`, 'erro');
      let ordem = imgs.length ? Math.max(...imgs.map((x) => Number(x.ordem) || 0)) + 1 : 0;
      let temPrincipal = imgs.some((x) => x.principal);
      let enviadas = 0;
      for (let n = 0; n < lote.length; n += 1) {
        const arq = lote[n];
        status.textContent = `Enviando imagem ${n + 1} de ${lote.length}…`;
        if (!TIPOS.includes(arq.type)) { toast(`"${arq.name}" não é JPG, PNG ou WebP.`, 'erro'); continue; }
        if (arq.size > MAX_ORIGINAL) { toast(`"${arq.name}" é grande demais (máximo 25 MB).`, 'erro'); continue; }
        let up = null;
        try {
          up = await enviarArquivo(produtoId, arq);
          const { error } = await supabase.from('lj_produto_imagens').insert({
            produto_id: produtoId, path: up.path, thumb_path: up.thumb,
            alt: String(opc.nome || '').slice(0, 160), ordem, principal: !temPrincipal
          });
          if (error) throw error;
          temPrincipal = true;
          ordem += 1;
          enviadas += 1;
        } catch (e) {
          if (up) await supabase.storage.from('produtos').remove([up.path, up.thumb]);
          toast(`Não foi possível enviar "${arq.name}": ${msgErro(e)}`, 'erro');
        }
      }
      status.textContent = enviadas ? `${enviadas} imagem(ns) enviada(s). Confira o texto alternativo de cada uma.` : '';
    });
  }

  await carregar();
  return { recarregar: carregar };
}
