import { supabase } from './supabase.js';
import { esc, toast, confirmar, setStatusPub, formatarDataHora, traduzirErro } from './util.js';
import { PADRAO_INICIO, mesclar } from './padroes.js';

const CHAVE = 'inicio';
const CHAVE_LOCAL = `pn-rascunho-local-${CHAVE}`;
const MAX_SERVICOS = 30;
const MAX_DIFERENCIAIS = 12;
const ACOES = [
  ['loja', 'Cartão 1 · Produtos'],
  ['banho', 'Cartão 2 · Banho & Tosa'],
  ['vet', 'Cartão 3 · Consulta Veterinária'],
];

// ---------- Utilitários de caminho ("hero.titulo", "servicos.2.nome") ----------
const obter = (obj, caminho) => caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
function definir(obj, caminho, valor) {
  const ks = caminho.split('.');
  let o = obj;
  for (let i = 0; i < ks.length - 1; i += 1) {
    if (o[ks[i]] == null) o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {};
    o = o[ks[i]];
  }
  o[ks[ks.length - 1]] = valor;
}
const idDe = (caminho) => `f-${caminho.replace(/\./g, '-')}`;

// ---------- Pedaços de HTML ----------
function campo(c, valor, desab) {
  const id = idDe(c.caminho);
  const attrs = [
    `id="${id}"`, `data-caminho="${esc(c.caminho)}"`, 'autocomplete="off"',
    c.max ? `maxlength="${c.max}"` : '',
    c.obrigatorio ? 'required aria-required="true"' : '',
    desab ? 'disabled' : '',
    `aria-describedby="${id}-ajuda ${id}-erro"`,
  ].join(' ');
  const entrada = c.linhas
    ? `<textarea ${attrs} rows="${c.linhas}">${esc(valor)}</textarea>`
    : `<input type="text" ${attrs} value="${esc(valor)}">`;
  return `<div class="campo">
    <label for="${id}">${esc(c.rotulo)}${c.obrigatorio ? ' <span class="obrig">(obrigatório)</span>' : ''}</label>
    ${entrada}
    <p class="ajuda" id="${id}-ajuda">${esc(c.ajuda || '')}</p>
    <p class="erro" id="${id}-erro" role="alert"></p>
  </div>`;
}

function marcar(c, marcado, desab) {
  return `<div class="campo"><label class="check"><input type="checkbox" id="${idDe(c.caminho)}" data-caminho="${esc(c.caminho)}" ${marcado ? 'checked' : ''} ${desab ? 'disabled' : ''}> ${esc(c.rotulo)}</label></div>`;
}

function botoesItem(lista, i, total, nome) {
  return `<div class="acoes">
    <button type="button" class="btn btn-pequeno" data-acao="subir" data-lista="${lista}" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Mover ${esc(nome)} para cima">↑ Subir</button>
    <button type="button" class="btn btn-pequeno" data-acao="descer" data-lista="${lista}" data-i="${i}" ${i === total - 1 ? 'disabled' : ''} aria-label="Mover ${esc(nome)} para baixo">↓ Descer</button>
    <button type="button" class="btn btn-pequeno btn-perigo" data-acao="remover" data-lista="${lista}" data-i="${i}" aria-label="Remover ${esc(nome)}">Remover</button>
  </div>`;
}

function secao(id, titulo, conteudo, abertos) {
  return `<details class="cartao" data-sec="${id}" ${abertos.has(id) ? 'open' : ''}><summary>${esc(titulo)}</summary>${conteudo}</details>`;
}

function formularioHTML(d, desab, abertos) {
  const f = (caminho, rotulo, extra = {}) => campo({ caminho, rotulo, ...extra }, obter(d, caminho), desab);

  const hero = [
    f('hero.titulo', 'Título de boas-vindas', { max: 80, obrigatorio: true }),
    f('hero.texto', 'Texto de apresentação', { max: 300, linhas: 3 }),
    f('hero.rotulo_whatsapp', 'Texto do botão de WhatsApp', { max: 40 }),
    f('hero.mensagem_whatsapp', 'Mensagem inicial do WhatsApp', { max: 200, linhas: 2, ajuda: 'É o texto que já aparece escrito quando o cliente abre a conversa.' }),
    '<p class="sub">O nome, o slogan e o número do WhatsApp vêm de “Informações da Empresa”.</p>',
  ].join('');

  const acoes = `<p class="sub">O destino de cada cartão é fixo (loja, agendamento de Banho &amp; Tosa e agendamento de consulta), para não existirem links quebrados. Enquanto um módulo não estiver no ar, o cartão leva ao WhatsApp.</p>`
    + ACOES.map(([k, nome]) => `<h3>${esc(nome)}</h3>${f(`acoes.${k}.titulo`, 'Título do cartão', { max: 60, obrigatorio: true })}${f(`acoes.${k}.descricao`, 'Descrição', { max: 160, linhas: 2 })}${f(`acoes.${k}.rotulo`, 'Texto do botão', { max: 40, obrigatorio: true })}`).join('');

  const sobre = [
    f('sobre.titulo', 'Título da seção', { max: 60 }),
    f('sobre.texto', 'Texto', { max: 700, linhas: 5 }),
    f('sobre.localizacao', 'Localização (linha curta)', { max: 80 }),
    '<p class="sub">O slogan destacado nesta seção vem de “Informações da Empresa”.</p>',
  ].join('');

  const servicos = lista(d.servicos);
  const servicosHTML = `<ol class="lista-ed">${servicos.map((s, i) => `<li class="item-ed">
      ${campo({ caminho: `servicos.${i}.nome`, rotulo: `Serviço ${i + 1}`, max: 60 }, s.nome, desab)}
      ${marcar({ caminho: `servicos.${i}.ativo`, rotulo: 'Mostrar no site' }, s.ativo !== false, desab)}
      ${desab ? '' : botoesItem('servicos', i, servicos.length, `serviço ${i + 1}`)}
    </li>`).join('')}</ol>
    ${desab || servicos.length >= MAX_SERVICOS ? '' : '<button type="button" class="btn" data-add="servicos">+ Adicionar serviço</button>'}`;

  const difs = lista(d.diferenciais);
  const difsHTML = `<ol class="lista-ed">${difs.map((x, i) => `<li class="item-ed">
      ${campo({ caminho: `diferenciais.${i}.icone`, rotulo: 'Ícone (um emoji)', max: 4 }, x.icone, desab)}
      ${campo({ caminho: `diferenciais.${i}.titulo`, rotulo: `Título ${i + 1}`, max: 60 }, x.titulo, desab)}
      ${campo({ caminho: `diferenciais.${i}.descricao`, rotulo: 'Descrição', max: 160, linhas: 2 }, x.descricao, desab)}
      ${marcar({ caminho: `diferenciais.${i}.ativo`, rotulo: 'Mostrar no site' }, x.ativo !== false, desab)}
      ${desab ? '' : botoesItem('diferenciais', i, difs.length, `diferencial ${i + 1}`)}
    </li>`).join('')}</ol>
    ${desab || difs.length >= MAX_DIFERENCIAIS ? '' : '<button type="button" class="btn" data-add="diferenciais">+ Adicionar diferencial</button>'}`;

  const galeria = '<p>O envio de fotos, a ordem, as legendas e a imagem de destaque serão criados na próxima etapa (Galeria e Mídia). Enquanto não houver fotos publicadas, a galeria não aparece no site.</p>';

  const contato = [
    f('contato.titulo', 'Título da seção', { max: 60 }),
    marcar({ caminho: 'contato.mostrar_mapa', rotulo: 'Mostrar o link “Ver no mapa”' }, d.contato?.mostrar_mapa !== false, desab),
    '<p class="sub">Endereço, WhatsApp, e-mail e horário são editados em <a href="#/empresa">Informações da Empresa</a>. Os links dos perfis ficam em <a href="#/redes">Redes Sociais</a>.</p>',
  ].join('');

  const rodape = f('rodape.copyright', 'Texto de direitos autorais', { max: 160, ajuda: 'Use {ano} para o ano atual aparecer sozinho. O link da Política de Privacidade é adicionado automaticamente.' });

  const seo = [
    f('seo.titulo', 'Título nos buscadores (Google)', { max: 70 }),
    f('seo.descricao', 'Descrição nos buscadores', { max: 160, linhas: 2 }),
  ].join('');

  const politica = f('politica', 'Texto da Política de Privacidade', {
    max: 8000, linhas: 14,
    ajuda: 'Separe os parágrafos com uma linha em branco. Você pode usar {nome}, {email} e {whatsapp}. Este é um texto-base: peça a revisão de um profissional antes de divulgar.',
  });

  return [
    secao('hero', 'Seção principal (topo do site)', hero, abertos),
    secao('acoes', 'Três cartões de ação', acoes, abertos),
    secao('sobre', 'Sobre Nós', sobre, abertos),
    secao('servicos', 'Lista de serviços', servicosHTML, abertos),
    secao('difs', 'Diferenciais', difsHTML, abertos),
    secao('galeria', 'Galeria de fotos', galeria, abertos),
    secao('contato', 'Contato', contato, abertos),
    secao('rodape', 'Rodapé', rodape, abertos),
    secao('seo', 'Buscadores (SEO)', seo, abertos),
    secao('politica', 'Política de Privacidade', politica, abertos),
  ].join('');
}

const lista = (v) => (Array.isArray(v) ? v : []);

// ---------- Limpeza e validação ----------
function limpar(d) {
  const c = structuredClone(d);
  c.servicos = lista(c.servicos)
    .map((s) => ({ nome: String(s.nome ?? '').trim(), ativo: s.ativo !== false }))
    .filter((s) => s.nome);
  c.diferenciais = lista(c.diferenciais)
    .map((x) => ({
      icone: String(x.icone ?? '').trim() || '🐾',
      titulo: String(x.titulo ?? '').trim(),
      descricao: String(x.descricao ?? '').trim(),
      ativo: x.ativo !== false,
    }))
    .filter((x) => x.titulo);
  return c;
}

function validar(d) {
  const erros = {};
  if (!String(d.hero?.titulo ?? '').trim()) erros['hero.titulo'] = 'Preencha este campo.';
  for (const [k] of ACOES) {
    if (!String(d.acoes?.[k]?.titulo ?? '').trim()) erros[`acoes.${k}.titulo`] = 'Preencha este campo.';
    if (!String(d.acoes?.[k]?.rotulo ?? '').trim()) erros[`acoes.${k}.rotulo`] = 'Preencha este campo.';
  }
  return erros;
}

// ---------- Tela ----------
function carregarCss() {
  if (document.querySelector('link[data-inicio-css]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'css/inicio.css';
  l.dataset.inicioCss = '1';
  document.head.appendChild(l);
}

export async function viewInicio(alvo, ctx) {
  carregarCss();
  const [pub, rasc, revs] = await Promise.all([
    supabase.from('settings_published').select('value').eq('key', CHAVE).maybeSingle(),
    supabase.from('settings_draft').select('value').eq('key', CHAVE).maybeSingle(),
    ctx.ehAdmin
      ? supabase.from('settings_revisions').select('id,published_at').eq('key', CHAVE).order('published_at', { ascending: false }).limit(5)
      : Promise.resolve({ data: [] }),
  ]);
  if (pub.error) throw pub.error;
  if (rasc.error) throw rasc.error;

  const temRascunho = !!rasc.data;
  const desab = !ctx.ehAdmin;
  let dados = structuredClone(mesclar(PADRAO_INICIO, rasc.data?.value ?? pub.data?.value ?? {}));
  const inicialJSON = JSON.stringify(dados);
  const abertos = new Set(['hero', 'acoes']);

  const historico = ctx.ehAdmin ? `<details class="cartao"><summary>Histórico de publicações</summary>
    ${(revs.data || []).length
      ? `<ul class="lista">${revs.data.map((r) => `<li><span>Publicado em ${esc(formatarDataHora(r.published_at))}</span><button type="button" class="btn btn-pequeno" data-rev="${esc(r.id)}">Restaurar como rascunho</button></li>`).join('')}</ul>`
      : '<p class="suave">Nenhuma publicação feita pelo painel ainda.</p>'}
  </details>` : '';

  alvo.innerHTML = `
    <header class="cab-pagina">
      <h1>Página Inicial</h1>
      <p class="afeta"><strong>Afeta:</strong> Página inicial do site público</p>
      <p class="selo" id="selo" ${temRascunho ? '' : 'hidden'}>Rascunho não publicado</p>
    </header>
    <div id="banner-local"></div>
    ${desab ? '<p class="nota">Seu perfil (Funcionário) pode apenas visualizar estas informações.</p>' : ''}
    <form id="form" novalidate></form>
    ${desab ? '' : `<div class="barra-fixa">
      <button type="button" class="btn" id="b-salvar">Salvar rascunho</button>
      <button type="button" class="btn btn-primario" id="b-publicar">Publicar</button>
      <a class="btn" href="../?previa=1" target="_blank" rel="noopener">Ver prévia no site</a>
      <button type="button" class="btn btn-perigo" id="b-descartar" ${temRascunho ? '' : 'hidden'}>Descartar rascunho</button>
    </div>
    <p class="sub">A prévia mostra o último rascunho <strong>salvo</strong>. Salve antes de abrir.</p>`}
    ${historico}`;

  const form = alvo.querySelector('#form');
  const botoes = () => [...alvo.querySelectorAll('.barra-fixa button, #form button')];
  const ocupado = (sim) => botoes().forEach((b) => { b.disabled = sim; });
  const sujar = () => { window.onbeforeunload = (e) => { e.preventDefault(); e.returnValue = ''; }; };
  const limparLocal = () => { try { localStorage.removeItem(CHAVE_LOCAL); } catch { /* ignora */ } window.onbeforeunload = null; };
  const recarregar = () => viewInicio(alvo, ctx);

  function desenhar(focoCaminho) {
    form.innerHTML = formularioHTML(dados, desab, abertos);
    if (focoCaminho) form.querySelector(`[data-caminho="${focoCaminho}"]`)?.focus();
  }

  function coletar() {
    form.querySelectorAll('[data-caminho]').forEach((el) => {
      definir(dados, el.dataset.caminho, el.type === 'checkbox' ? el.checked : el.value);
    });
  }

  desenhar();
  if (desab) return;

  // Seções abertas/fechadas (lembra entre redesenhos)
  form.addEventListener('toggle', (e) => {
    const sec = e.target.dataset?.sec;
    if (!sec) return;
    if (e.target.open) abertos.add(sec); else abertos.delete(sec);
  }, true);

  // Recuperação automática de alterações não salvas (neste aparelho)
  try {
    const t = localStorage.getItem(CHAVE_LOCAL);
    const local = t ? JSON.parse(t) : null;
    if (local && JSON.stringify(local.dados) !== inicialJSON) {
      const banner = alvo.querySelector('#banner-local');
      banner.innerHTML = `<div class="nota"><p>Encontramos alterações não salvas feitas neste aparelho em ${esc(formatarDataHora(local.em))}.</p>
        <div class="acoes"><button type="button" class="btn btn-primario" id="b-rest-local">Restaurar alterações</button>
        <button type="button" class="btn" id="b-ign-local">Ignorar</button></div></div>`;
      banner.querySelector('#b-rest-local').addEventListener('click', () => {
        dados = structuredClone(mesclar(PADRAO_INICIO, local.dados));
        desenhar(); banner.innerHTML = ''; sujar();
      });
      banner.querySelector('#b-ign-local').addEventListener('click', () => { limparLocal(); banner.innerHTML = ''; });
    } else if (local) limparLocal();
  } catch { /* localStorage indisponível */ }

  form.addEventListener('input', () => {
    coletar();
    try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify({ dados, em: Date.now() })); } catch { /* ignora */ }
    sujar();
  });

  // Adicionar / mover / remover itens das listas
  form.addEventListener('click', async (e) => {
    const add = e.target.closest('[data-add]');
    const acao = e.target.closest('[data-acao]');
    if (!add && !acao) return;
    coletar();
    if (add) {
      const nome = add.dataset.add;
      if (nome === 'servicos') dados.servicos.push({ nome: '', ativo: true });
      else dados.diferenciais.push({ icone: '🐾', titulo: '', descricao: '', ativo: true });
      abertos.add(nome === 'servicos' ? 'servicos' : 'difs');
      const novo = dados[nome].length - 1;
      desenhar(`${nome}.${novo}.${nome === 'servicos' ? 'nome' : 'titulo'}`);
      sujar();
      return;
    }
    const nome = acao.dataset.lista;
    const i = Number(acao.dataset.i);
    const arr = dados[nome];
    if (acao.dataset.acao === 'remover') {
      if (!(await confirmar('Remover este item da lista?', 'Remover'))) return;
      arr.splice(i, 1);
      desenhar();
    } else {
      const j = acao.dataset.acao === 'subir' ? i - 1 : i + 1;
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      desenhar();
      form.querySelector(`[data-acao="${acao.dataset.acao}"][data-lista="${nome}"][data-i="${j}"]`)?.focus();
    }
    try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify({ dados, em: Date.now() })); } catch { /* ignora */ }
    sujar();
  });

  // Validação com mensagens junto dos campos
  function mostrarErros(erros) {
    form.querySelectorAll('.erro').forEach((p) => { p.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    let primeiro = null;
    for (const [caminho, msg] of Object.entries(erros)) {
      const el = form.querySelector(`[data-caminho="${caminho}"]`);
      if (!el) continue;
      const det = el.closest('details');
      if (det) { det.open = true; abertos.add(det.dataset.sec); }
      form.querySelector(`#${idDe(caminho)}-erro`).textContent = msg;
      el.setAttribute('aria-invalid', 'true');
      primeiro = primeiro || el;
    }
    if (primeiro) primeiro.focus();
    return !primeiro;
  }

  function lerFormulario() {
    coletar();
    const limpo = limpar(dados);
    if (!mostrarErros(validar(limpo))) return null;
    return limpo;
  }

  async function gravarRascunho(valor) {
    const { error } = await supabase.from('settings_draft').upsert({ key: CHAVE, value: valor, updated_by: ctx.user.id });
    if (error) throw error;
  }

  alvo.querySelector('#b-salvar').addEventListener('click', async () => {
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

  alvo.querySelector('#b-publicar').addEventListener('click', async () => {
    const valor = lerFormulario();
    if (!valor) return;
    if (!(await confirmar('Publicar estas alterações? Elas ficarão visíveis no site público.', 'Publicar'))) return;
    ocupado(true);
    setStatusPub('publicando', 'Publicando alterações…');
    try {
      await gravarRascunho(valor);
      const { error } = await supabase.rpc('publish_settings', { p_keys: [CHAVE] });
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
      const { error } = await supabase.rpc('descartar_rascunho', { p_key: CHAVE });
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
