import { supabase } from './supabase.js';
import { esc, formatarDataHora } from './util.js';
import { FORMULARIOS } from './configuracoes.js';

// Métricas vêm de funções do banco. Se uma falhar, mostramos "—"
// (nunca números inventados).
const METRICAS_LOJA = [
  ['produtos_ativos', 'Produtos ativos', '#/produtos?aba=produtos', true],
  ['produtos_sem_estoque', 'Produtos sem estoque', '#/produtos?aba=estoque', false],
  ['produtos_estoque_baixo', 'Produtos com estoque baixo', '#/produtos?aba=estoque', false],
  ['promocoes_ativas', 'Promoções ativas', '#/produtos?aba=produtos', true],
  ['pedidos_novos', 'Pedidos novos', '#/produtos?aba=pedidos', false],
];

const METRICAS_VET = [
  ['pendentes', 'Consultas pendentes', '#/veterinaria'],
  ['urgentes_novas', 'Consultas urgentes novas', '#/veterinaria'],
  ['confirmados', 'Consultas confirmadas', '#/veterinaria'],
  ['proximos', 'Próximas consultas', '#/veterinaria'],
];

const METRICAS_FUTURAS = [
  ['Solicitações de Banho & Tosa pendentes', 'Banho & Tosa'],
];

const VERBOS = { publicar: 'Publicou', descartar: 'Descartou o rascunho de', restaurar: 'Restaurou uma versão de' };

export async function viewPainel(alvo, ctx) {
  const [rascunhos, ultima, loja, vet] = await Promise.all([
    supabase.from('settings_draft').select('key', { count: 'exact', head: true }),
    supabase.from('settings_published').select('published_at').order('published_at', { ascending: false }).limit(1),
    supabase.rpc('lj_metricas').then((r) => r, () => ({ data: null, error: true })),
    supabase.rpc('vt_metricas').then((r) => r, () => ({ data: null, error: true })),
  ]);

  let atividade = [];
  let nomes = new Map();
  if (ctx.ehAdmin) {
    const [ev, pf] = await Promise.all([
      supabase.from('audit_events').select('acao,entidade,detalhes,criado_em,user_id').order('criado_em', { ascending: false }).limit(8),
      supabase.from('profiles').select('id,nome'),
    ]);
    atividade = ev.data || [];
    nomes = new Map((pf.data || []).map((p) => [p.id, p.nome]));
  }

  const qtdRascunhos = rascunhos.error ? '—' : String(rascunhos.count ?? 0);
  const ultimaPub = ultima.data?.[0]?.published_at;

  const dadosLoja = !loja.error && loja.data && typeof loja.data === 'object' ? loja.data : null;
  const dadosVet = !vet.error && vet.data && typeof vet.data === 'object' ? vet.data : null;

  const cartao = (dados, chave, rotulo, destino, semLink) => {
    const n = dados ? Number(dados[chave]) : NaN;
    if (!Number.isFinite(n)) {
      return `<div class="metrica"><div class="valor">—</div><div class="rotulo">${esc(rotulo)}</div><div class="detalhe">Não foi possível carregar agora</div></div>`;
    }
    const link = semLink
      ? 'Dados do módulo'
      : `<a href="${esc(destino)}">Ver detalhes<span class="sr-only"> de ${esc(rotulo)}</span></a>`;
    return `<div class="metrica"><div class="valor">${esc(String(n))}</div><div class="rotulo">${esc(rotulo)}</div><div class="detalhe">${link}</div></div>`;
  };

  const cartaoLoja = ([chave, rotulo, destino, soAdmin]) =>
    cartao(dadosLoja, chave, rotulo, destino, soAdmin && !ctx.ehAdmin);
  const cartaoVet = ([chave, rotulo, destino]) =>
    cartao(dadosVet, chave, rotulo, destino, false);

  const linhaAtividade = (a) => {
    const quem = nomes.get(a.user_id) || 'Alguém da equipe';
    const verbo = VERBOS[a.acao] || a.acao;
    const o_que = FORMULARIOS[a.detalhes?.chave]?.titulo || a.entidade;
    return `<li><span>${esc(quem)} ${esc(verbo.toLowerCase())} “${esc(o_que)}”</span><span class="suave">${esc(formatarDataHora(a.criado_em))}</span></li>`;
  };

  alvo.innerHTML = `
    <header class="cab-pagina">
      <h1>Olá, ${esc(ctx.perfil.nome)}</h1>
      <p class="afeta">Perfil: ${ctx.ehAdmin ? 'Administrador' : 'Funcionário'}</p>
    </header>

    <section aria-labelledby="t-estado">
      <h2 id="t-estado">Estado do site</h2>
      <div class="grade">
        <div class="metrica"><div class="valor">${esc(qtdRascunhos)}</div><div class="rotulo">Itens com rascunho</div><div class="detalhe">Alterações aguardando publicação</div></div>
        <div class="metrica"><div class="valor">${esc(ultimaPub ? formatarDataHora(ultimaPub) : '—')}</div><div class="rotulo">Última publicação</div><div class="detalhe">Horário de Fortaleza</div></div>
      </div>
    </section>

    <section aria-labelledby="t-atalhos" class="cartao">
      <h2 id="t-atalhos">Ações rápidas</h2>
      <div class="atalhos">
        <a class="btn" href="#/empresa">Editar informações da empresa</a>
        <a class="btn" href="#/redes">Editar redes sociais</a>
        <a class="btn" href="#/inicio">Editar página inicial</a>
        <a class="btn" href="#/produtos">Adicionar produto</a>
        <a class="btn" href="#/agenda">Abrir agenda</a>
        <a class="btn" href="#/banho-tosa">Revisar solicitações</a>
        <a class="btn" href="#/veterinaria">Consultas veterinárias</a>
        <a class="btn" href="../" target="_blank" rel="noopener">Ver site público</a>
      </div>
    </section>

    <section aria-labelledby="t-modulos">
      <h2 id="t-modulos">Movimento da loja e agenda</h2>
      <div class="grade">
        ${METRICAS_LOJA.map(cartaoLoja).join('')}
        ${METRICAS_VET.map(cartaoVet).join('')}
        ${METRICAS_FUTURAS.map(([rotulo, modulo]) => `<div class="metrica"><div class="valor">—</div><div class="rotulo">${esc(rotulo)}</div><div class="detalhe">Disponível quando o módulo ${esc(modulo)} for ligado aqui</div></div>`).join('')}
      </div>
    </section>

    <section aria-labelledby="t-atividade" class="cartao">
      <h2 id="t-atividade">Atividade recente</h2>
      ${!ctx.ehAdmin
        ? '<p class="suave">O histórico de atividades é visível apenas para administradores.</p>'
        : atividade.length
          ? `<ul class="lista">${atividade.map(linhaAtividade).join('')}</ul>`
          : '<p class="suave">Nenhuma atividade registrada ainda. Publique uma alteração para ver o histórico aqui.</p>'}
    </section>`;
}
