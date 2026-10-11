import { supabase } from './supabase.js';
import {
  esc, toast, confirmar, setStatusPub, normalizarWhatsApp, formatarWhatsApp,
  formatarDataHora, traduzirErro,
} from './util.js';

export const FORMULARIOS = {
  empresa: {
    titulo: 'Informações da Empresa',
    afeta: 'Todas as páginas públicas (cabeçalho, contato, rodapé e links de WhatsApp)',
    campos: [
      { nome: 'nome', rotulo: 'Nome da empresa', tipo: 'text', obrigatorio: true, max: 80 },
      { nome: 'slogan', rotulo: 'Slogan', tipo: 'text', max: 140 },
      { nome: 'descricao', rotulo: 'Descrição do negócio', tipo: 'textarea', max: 400, linhas: 4 },
      {
        nome: 'whatsapp', rotulo: 'WhatsApp', tipo: 'tel', obrigatorio: true,
        ajuda: 'Com DDD. O link do WhatsApp (wa.me) é gerado automaticamente em todas as páginas.',
      },
      { nome: 'email', rotulo: 'E-mail', tipo: 'email', max: 120 },
      { nome: 'endereco', rotulo: 'Endereço', tipo: 'textarea', max: 200, linhas: 2 },
      {
        nome: 'horarios', rotulo: 'Horário de funcionamento', tipo: 'textarea', max: 300, linhas: 3,
        ajuda: 'Uma linha por dia ou faixa. Exemplo: Segunda a sexta, 8h às 18h.',
      },
    ],
  },
  redes: {
    titulo: 'Redes Sociais',
    afeta: 'Página inicial (seção de contato e rodapé)',
    campos: [
      { nome: 'instagram', rotulo: 'Instagram', tipo: 'text', max: 60, ajuda: 'Exemplo: @petnatureza' },
      { nome: 'facebook', rotulo: 'Facebook', tipo: 'text', max: 80, ajuda: 'Nome da página. Exemplo: Pet Natureza' },
      { nome: 'threads', rotulo: 'Threads', tipo: 'text', max: 60, ajuda: 'Exemplo: petnatureza' },
      { nome: 'tiktok', rotulo: 'TikTok', tipo: 'text', max: 60, ajuda: 'Exemplo: petnatureza' },
    ],
  },
};

const PREVIAS = {
  empresa(v) {
    const zap = /^55\d{10,11}$/.test(v.whatsapp || '') ? `https://wa.me/${v.whatsapp}` : '';
    return `<h2>${esc(v.nome)}</h2>
      <p><strong>${esc(v.slogan)}</strong></p>
      <p>${esc(v.descricao)}</p>
      <dl class="previa-bloco">
        <dt>WhatsApp</dt><dd>${zap ? `<a href="${esc(zap)}" target="_blank" rel="noopener">${esc(formatarWhatsApp(v.whatsapp))}</a>` : '—'}</dd>
        <dt>E-mail</dt><dd>${esc(v.email) || '—'}</dd>
        <dt>Endereço</dt><dd>${esc(v.endereco) || '—'}</dd>
        <dt>Horário de funcionamento</dt><dd>${esc(v.horarios) || '—'}</dd>
      </dl>`;
  },
  redes(v) {
    return `<dl class="previa-bloco">
      <dt>Instagram</dt><dd>${esc(v.instagram) || '—'}</dd>
      <dt>Facebook</dt><dd>${esc(v.facebook) || '—'}</dd>
      <dt>Threads</dt><dd>${esc(v.threads) || '—'}</dd>
      <dt>TikTok</dt><dd>${esc(v.tiktok) || '—'}</dd>
    </dl>`;
  },
};

function valorExibicao(campo, valor) {
  return campo.nome === 'whatsapp' ? formatarWhatsApp(valor) : (valor ?? '');
}

function campoHTML(c, valor, desabilitado) {
  const id = `f-${c.nome}`;
  const attrs = [
    `id="${id}"`, `name="${c.nome}"`, 'autocomplete="off"',
    c.obrigatorio ? 'required aria-required="true"' : '',
    c.max ? `maxlength="${c.max}"` : '',
    desabilitado ? 'disabled' : '',
    `aria-describedby="${id}-ajuda ${id}-erro"`,
  ].join(' ');
  const entrada = c.tipo === 'textarea'
    ? `<textarea ${attrs} rows="${c.linhas || 3}">${esc(valor)}</textarea>`
    : `<input type="${c.tipo}" ${attrs} value="${esc(valor)}">`;
  return `<div class="campo">
    <label for="${id}">${esc(c.rotulo)}${c.obrigatorio ? ' <span class="obrig">(obrigatório)</span>' : ''}</label>
    ${entrada}
    <p class="ajuda" id="${id}-ajuda">${esc(c.ajuda || '')}</p>
    <p class="erro" id="${id}-erro" role="alert"></p>
  </div>`;
}

function coletar(form, def) {
  const v = {};
  for (const c of def.campos) {
    let x = form.elements[c.nome].value.trim();
    if (c.nome === 'whatsapp') x = normalizarWhatsApp(x);
    v[c.nome] = x;
  }
  return v;
}

function validar(v, def) {
  const erros = {};
  for (const c of def.campos) {
    const x = v[c.nome] || '';
    if (c.obrigatorio && !x) erros[c.nome] = 'Preencha este campo.';
    else if (c.tipo === 'email' && x && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)) erros[c.nome] = 'Informe um e-mail válido.';
    else if (c.nome === 'whatsapp' && x && !/^55\d{10,11}$/.test(x)) erros[c.nome] = 'Informe um WhatsApp válido com DDD. Exemplo: (98) 98440-2286.';
  }
  return erros;
}

function mostrarErros(form, def, erros) {
  let primeiro = null;
  for (const c of def.campos) {
    const msg = erros[c.nome] || '';
    form.querySelector(`#f-${c.nome}-erro`).textContent = msg;
    const el = form.elements[c.nome];
    if (msg) { el.setAttribute('aria-invalid', 'true'); primeiro = primeiro || el; }
    else el.removeAttribute('aria-invalid');
  }
  if (primeiro) primeiro.focus();
  return !primeiro;
}

export async function viewConfig(alvo, ctx, chave) {
  const def = FORMULARIOS[chave];
  const [pub, rasc, revs] = await Promise.all([
    supabase.from('settings_published').select('value,published_at').eq('key', chave).maybeSingle(),
    supabase.from('settings_draft').select('value,updated_at').eq('key', chave).maybeSingle(),
    ctx.ehAdmin
      ? supabase.from('settings_revisions').select('id,published_at').eq('key', chave)
          .order('published_at', { ascending: false }).limit(5)
      : Promise.resolve({ data: [] }),
  ]);
  if (pub.error) throw pub.error;
  if (rasc.error) throw rasc.error;

  const temRascunho = !!rasc.data;
  const inicial = rasc.data?.value ?? pub.data?.value ?? {};
  const desab = !ctx.ehAdmin;
  const chaveLocal = `pn-rascunho-local-${chave}`;
  const norm = (v) => JSON.stringify(def.campos.map((c) => String(v?.[c.nome] ?? '')));

  const historico = ctx.ehAdmin ? `
    <details class="cartao">
      <summary>Histórico de publicações</summary>
      ${(revs.data || []).length
        ? `<ul class="lista">${revs.data.map((r) => `<li><span>Publicado em ${esc(formatarDataHora(r.published_at))}</span>
            <button type="button" class="btn btn-pequeno" data-rev="${esc(r.id)}">Restaurar como rascunho</button></li>`).join('')}</ul>`
        : '<p class="suave">Nenhuma publicação feita pelo painel ainda.</p>'}
    </details>` : '';

  alvo.innerHTML = `
    <header class="cab-pagina">
      <h1>${esc(def.titulo)}</h1>
      <p class="afeta"><strong>Afeta:</strong> ${esc(def.afeta)}</p>
      <p class="selo" ${temRascunho ? '' : 'hidden'}>Rascunho não publicado</p>
    </header>
    <div id="banner-local"></div>
    ${desab ? '<p class="nota">Seu perfil (Funcionário) pode apenas visualizar estas informações.</p>' : ''}
    <form id="form" class="cartao" novalidate>
      ${def.campos.map((c) => campoHTML(c, valorExibicao(c, inicial[c.nome]), desab)).join('')}
      ${desab ? '' : `<div class="acoes">
        <button type="button" class="btn" id="b-previa">Ver prévia</button>
        <button type="submit" class="btn" id="b-salvar">Salvar rascunho</button>
        <button type="button" class="btn btn-primario" id="b-publicar">Publicar</button>
        <button type="button" class="btn btn-perigo" id="b-descartar" ${temRascunho ? '' : 'hidden'}>Descartar rascunho</button>
      </div>`}
    </form>
    <section id="previa" class="cartao" aria-live="polite" hidden></section>
    ${historico}`;

  if (desab) return;

  const form = alvo.querySelector('#form');
  const botoes = [...form.querySelectorAll('button')];
  const ocupado = (sim) => botoes.forEach((b) => { b.disabled = sim; });
  const limparLocal = () => { try { localStorage.removeItem(chaveLocal); } catch { /* ignora */ } window.onbeforeunload = null; };
  const recarregar = () => viewConfig(alvo, ctx, chave);

  // Recuperação automática: alterações não salvas ficam neste aparelho.
  try {
    const t = localStorage.getItem(chaveLocal);
    const local = t ? JSON.parse(t) : null;
    if (local && norm(local.valor) !== norm(inicial)) {
      const banner = alvo.querySelector('#banner-local');
      banner.innerHTML = `<div class="nota"><p>Encontramos alterações não salvas feitas neste aparelho em ${esc(formatarDataHora(local.em))}.</p>
        <div class="acoes"><button type="button" class="btn btn-primario" id="b-restaurar-local">Restaurar alterações</button>
        <button type="button" class="btn" id="b-ignorar-local">Ignorar</button></div></div>`;
      banner.querySelector('#b-restaurar-local').addEventListener('click', () => {
        for (const c of def.campos) form.elements[c.nome].value = valorExibicao(c, local.valor[c.nome]);
        banner.innerHTML = '';
        window.onbeforeunload = (e) => { e.preventDefault(); e.returnValue = ''; };
      });
      banner.querySelector('#b-ignorar-local').addEventListener('click', () => { limparLocal(); banner.innerHTML = ''; });
    } else if (local) limparLocal();
  } catch { /* localStorage indisponível */ }

  form.addEventListener('input', () => {
    try { localStorage.setItem(chaveLocal, JSON.stringify({ valor: coletar(form, def), em: Date.now() })); } catch { /* ignora */ }
    window.onbeforeunload = (e) => { e.preventDefault(); e.returnValue = ''; };
  });

  async function gravarRascunho(valor) {
    const { error } = await supabase.from('settings_draft').upsert({ key: chave, value: valor, updated_by: ctx.user.id });
    if (error) throw error;
  }

  function lerFormulario() {
    const valor = coletar(form, def);
    return mostrarErros(form, def, validar(valor, def)) ? valor : null;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const valor = lerFormulario();
    if (!valor) return;
    ocupado(true);
    try {
      await gravarRascunho(valor);
      limparLocal();
      toast('Rascunho salvo. As alterações ainda não estão no site.');
      await ctx.atualizarStatus();
      await recarregar();
    } catch (err) {
      toast(traduzirErro(err), 'erro');
      ocupado(false);
    }
  });

  alvo.querySelector('#b-previa').addEventListener('click', () => {
    const valor = coletar(form, def);
    const caixa = alvo.querySelector('#previa');
    caixa.innerHTML = `<h2>Prévia (ainda não publicada)</h2>${PREVIAS[chave](valor)}`;
    caixa.hidden = false;
    caixa.scrollIntoView({ block: 'nearest' });
  });

  alvo.querySelector('#b-publicar').addEventListener('click', async () => {
    const valor = lerFormulario();
    if (!valor) return;
    if (!(await confirmar('Publicar estas alterações? Elas ficarão visíveis no site público.', 'Publicar'))) return;
    ocupado(true);
    setStatusPub('publicando', 'Publicando alterações…');
    try {
      await gravarRascunho(valor);
      const { error } = await supabase.rpc('publish_settings', { p_keys: [chave] });
      if (error) throw error;
      limparLocal();
      setStatusPub('sucesso', 'Publicado com sucesso');
      toast('Publicado. As alterações já estão no site.');
      setTimeout(() => ctx.atualizarStatus(), 4000);
      await recarregar();
    } catch (err) {
      const msg = traduzirErro(err);
      setStatusPub('falha', `Não foi possível publicar: ${msg}`);
      toast(`Não foi possível publicar. ${msg}`, 'erro');
      ocupado(false);
    }
  });

  alvo.querySelector('#b-descartar').addEventListener('click', async () => {
    if (!(await confirmar('Descartar o rascunho? As alterações não publicadas serão perdidas.', 'Descartar'))) return;
    ocupado(true);
    try {
      const { error } = await supabase.rpc('descartar_rascunho', { p_key: chave });
      if (error) throw error;
      limparLocal();
      toast('Rascunho descartado.');
      await ctx.atualizarStatus();
      await recarregar();
    } catch (err) {
      toast(traduzirErro(err), 'erro');
      ocupado(false);
    }
  });

  alvo.querySelectorAll('[data-rev]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmar('Restaurar esta versão como rascunho? O rascunho atual será substituído.', 'Restaurar'))) return;
    try {
      const { error } = await supabase.rpc('restaurar_revisao', { p_revisao: Number(b.dataset.rev) });
      if (error) throw error;
      limparLocal();
      toast('Versão restaurada como rascunho. Revise e publique.');
      await ctx.atualizarStatus();
      await recarregar();
    } catch (err) {
      toast(traduzirErro(err), 'erro');
    }
  }));
}
