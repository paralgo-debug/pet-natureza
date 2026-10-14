import { viewBanho } from './banho.js';
import { supabase, configurado } from './supabase.js';
import { $, $$, esc, toast, setStatusPub, traduzirErro } from './util.js';
import { SECOES, viewPlaceholder, viewAjuda } from './secoes.js';
import { FORMULARIOS, viewConfig } from './configuracoes.js';
import { viewPainel } from './painel.js';
import { viewInicio } from './inicio.js';

const raiz = $('#raiz');
const ctx = { user: null, perfil: null, ehAdmin: false, atualizarStatus };

// ---------- Estado de publicação (barra fixa no topo) ----------
async function atualizarStatus() {
  const { count, error } = await supabase.from('settings_draft').select('key', { count: 'exact', head: true });
  if (error) return setStatusPub('falha', 'Não foi possível verificar o estado de publicação.');
  if (count > 0) setStatusPub('rascunho', `${count} ${count === 1 ? 'item' : 'itens'} com rascunho aguardando publicação`);
  else setStatusPub('ok', 'Sem alterações não publicadas');
}

// ---------- Telas fora do painel ----------
function telaAviso(titulo, texto, comSair = false) {
  raiz.innerHTML = `<main class="login"><section class="cartao login-cartao">
    <h1>${esc(titulo)}</h1><p>${texto}</p>
    ${comSair ? '<button class="btn btn-bloco" id="b-sair" type="button">Sair</button>' : ''}</section></main>`;
  $('#b-sair')?.addEventListener('click', sair);
}

function telaLogin() {
  window.onbeforeunload = null;
  raiz.innerHTML = `<main class="login"><section class="cartao login-cartao">
    <img class="login-logo" src="assets/logo.png" alt="Pet Natureza" width="96" height="96">
    <h1>Painel Pet Natureza</h1>
    <form id="f-login" novalidate>
      <div class="campo"><label for="email">E-mail</label>
        <input id="email" type="email" autocomplete="username" required></div>
      <div class="campo"><label for="senha">Senha</label>
        <input id="senha" type="password" autocomplete="current-password" required></div>
      <p id="erro-login" class="erro" role="alert"></p>
      <button class="btn btn-primario btn-bloco" type="submit">Entrar</button>
    </form>
    <button class="link" id="esqueci" type="button">Esqueci minha senha</button>
  </section></main>`;

  const erro = $('#erro-login');
  $('#f-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    erro.textContent = '';
    const email = $('#email').value.trim();
    const senha = $('#senha').value;
    if (!email || !senha) { erro.textContent = 'Informe e-mail e senha.'; return; }
    const botao = e.submitter; botao.disabled = true;
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    botao.disabled = false;
    if (error) {
      erro.textContent = /failed to fetch/i.test(error.message)
        ? 'Sem conexão. Verifique a internet e tente novamente.'
        : 'E-mail ou senha incorretos.';
      return;
    }
    await entrar();
  });

  $('#esqueci').addEventListener('click', async () => {
    erro.textContent = '';
    const email = $('#email').value.trim();
    if (!email) { erro.textContent = 'Informe seu e-mail acima para receber o link.'; $('#email').focus(); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) { erro.textContent = traduzirErro(error); return; }
    toast('Se este e-mail estiver cadastrado, enviaremos um link para criar uma nova senha.');
  });
}

function telaNovaSenha() {
  raiz.innerHTML = `<main class="login"><section class="cartao login-cartao">
    <h1>Criar nova senha</h1>
    <form id="f-senha" novalidate>
      <div class="campo"><label for="nova">Nova senha</label>
        <input id="nova" type="password" autocomplete="new-password" required>
        <p class="ajuda">Use pelo menos 10 caracteres.</p></div>
      <div class="campo"><label for="conf">Repita a nova senha</label>
        <input id="conf" type="password" autocomplete="new-password" required></div>
      <p id="erro-senha" class="erro" role="alert"></p>
      <button class="btn btn-primario btn-bloco" type="submit">Salvar nova senha</button>
    </form></section></main>`;
  $('#f-senha').addEventListener('submit', async (e) => {
    e.preventDefault();
    const erro = $('#erro-senha');
    const nova = $('#nova').value;
    if (nova.length < 10) { erro.textContent = 'A senha precisa ter pelo menos 10 caracteres.'; return; }
    if (nova !== $('#conf').value) { erro.textContent = 'As senhas não são iguais.'; return; }
    const { error } = await supabase.auth.updateUser({ password: nova });
    if (error) { erro.textContent = traduzirErro(error); return; }
    history.replaceState(null, '', location.pathname);
    toast('Senha alterada com sucesso.');
    await entrar();
  });
}

// ---------- Sessão ----------
async function sair() {
  await supabase.auth.signOut();
  ctx.user = null; ctx.perfil = null; ctx.ehAdmin = false;
  telaLogin();
}

async function entrar() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return telaLogin();

  const { data: perfil, error } = await supabase
    .from('profiles').select('id,nome,papel,ativo').eq('id', user.id).maybeSingle();

  if (error || !perfil || !perfil.ativo) {
    return telaAviso('Sem acesso ao painel',
      'Sua conta não tem permissão para usar o painel. Peça a um administrador para liberar o acesso.', true);
  }
  ctx.user = user; ctx.perfil = perfil; ctx.ehAdmin = perfil.papel === 'administrador';
  montarPainel();
  await atualizarStatus();
  await rotear();
}

// ---------- Estrutura do painel ----------
function montarPainel() {
  raiz.innerHTML = `
    <header class="topo">
      <div class="topo-linha">
        <button class="btn btn-menu" id="b-menu" type="button" aria-expanded="false" aria-controls="lateral" aria-label="Abrir menu">☰</button>
        <span class="topo-titulo">Painel Pet Natureza</span>
      </div>
      <div class="statuspub" id="statusPub" role="status" data-estado="ok">Verificando publicações…</div>
    </header>
    <div class="fundo-menu" id="fundo-menu" hidden></div>
    <nav class="lateral" id="lateral" aria-label="Menu principal">
      <div class="lateral-marca"><img src="assets/logo.png" alt="" width="40" height="40"><span>Pet Natureza</span></div>
      <ul>${SECOES.map((s) => `<li><a class="item" href="#/${s.id}" data-secao="${s.id}">
        <span class="item-icone" aria-hidden="true">${s.icone}</span><span>${esc(s.rotulo)}</span>
        ${s.pronto ? '' : '<span class="em-breve">em breve</span>'}</a></li>`).join('')}</ul>
      <div class="lateral-rodape">
        <p class="quem">${esc(ctx.perfil.nome)}<br>${ctx.ehAdmin ? 'Administrador' : 'Funcionário'}</p>
        <button class="btn btn-bloco" id="b-sair" type="button">Sair</button>
      </div>
    </nav>
    <main class="conteudo" id="conteudo" tabindex="-1"></main>`;

  const lateral = $('#lateral'); const fundo = $('#fundo-menu'); const botao = $('#b-menu');
  const alternar = (abrir) => {
    lateral.classList.toggle('aberta', abrir);
    fundo.hidden = !abrir;
    botao.setAttribute('aria-expanded', String(abrir));
    botao.setAttribute('aria-label', abrir ? 'Fechar menu' : 'Abrir menu');
  };
  botao.addEventListener('click', () => alternar(!lateral.classList.contains('aberta')));
  fundo.addEventListener('click', () => alternar(false));
  lateral.addEventListener('click', (e) => { if (e.target.closest('a.item')) alternar(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') alternar(false); });
  $('#b-sair').addEventListener('click', sair);
}

async function rotear() {
  if (!ctx.user) return;
  window.onbeforeunload = null;
  const id = location.hash.replace(/^#\//, '').split('?')[0] || 'painel';
  const secao = SECOES.find((s) => s.id === id) || SECOES[0];

  $$('a.item').forEach((a) => {
    if (a.dataset.secao === secao.id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  const alvo = $('#conteudo');
  alvo.innerHTML = '<p class="carregando">Carregando…</p>';
  try {
    if (secao.id === 'painel') await viewPainel(alvo, ctx);
    else if (secao.id === 'inicio') await viewInicio(alvo, ctx);
    else if (secao.id === 'banho-tosa') await viewBanho(alvo, ctx);
    else if (secao.id === 'produtos') await (await import('./loja.js')).viewLoja(alvo, ctx);
    else if (secao.id === 'entrega') await (await import('./loja-entrega.js')).viewEntrega(alvo, ctx);
    else if (secao.id === 'pagamentos') await (await import('./loja-pagamentos.js')).viewPagamentos(alvo, ctx);
    else if (FORMULARIOS[secao.id] && !FORMULARIOS[secao.id].custom) await viewConfig(alvo, ctx, secao.id);
    else if (secao.id === 'ajuda') viewAjuda(alvo);
    else viewPlaceholder(alvo, secao);
  } catch (e) {
    console.error(e);
    alvo.innerHTML = `<div class="cartao"><h1>Não foi possível carregar</h1>
      <p class="erro">${esc(traduzirErro(e))}</p>
      <p>Verifique se o arquivo SQL da pasta supabase foi executado e tente novamente.</p>
      <button class="btn" id="b-tentar" type="button">Tentar de novo</button></div>`;
    $('#b-tentar').addEventListener('click', rotear);
  }
  document.title = `${secao.rotulo} · Painel Pet Natureza`;
  alvo.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', rotear);

// ---------- Início ----------
async function iniciar() {
  if (!configurado) {
    return telaAviso('Configuração pendente',
      'Abra o arquivo <code>admin/js/config.js</code> e cole a URL e a chave anon do seu projeto Supabase. Veja o README.');
  }
  // O listener é registrado antes de qualquer espera para não perder o evento de recuperação de senha.
  supabase.auth.onAuthStateChange((evento) => {
    if (evento === 'PASSWORD_RECOVERY') telaNovaSenha();
    else if (evento === 'SIGNED_OUT' && !ctx.user) telaLogin();
  });
  const { data: { session } } = await supabase.auth.getSession();
  if (document.querySelector('#f-senha')) return; // já está na tela de nova senha
  if (session) await entrar();
  else telaLogin();
}

iniciar();
