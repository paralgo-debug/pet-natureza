import { supabase } from './supabase.js';
import { esc, formatarDataHora } from './util.js';
import { FORMULARIOS } from './configuracoes.js';

// Estas métricas passam a mostrar números reais quando cada módulo for criado.
// Até lá exibimos "—" (nunca números inventados).
const METRICAS_FUTURAS = [
  ['Produtos ativos', 'Loja'],
  ['Produtos sem estoque', 'Loja'],
  ['Produtos com estoque baixo', 'Loja'],
  ['Promoções ativas', 'Loja'],
  ['Pedidos novos', 'Loja'],
  ['Solicitações de Banho & Tosa pendentes', 'Banho & Tosa'],
  ['Solicitações de consulta pendentes', 'Consulta Veterinária'],
  ['Agendamentos confirmados', 'Agenda'],
  ['Próximos agendamentos', 'Agenda'],
];

const VERBOS = { publicar: 'Publicou', descartar: 'Descartou o rascunho de', restaurar: 'Restaurou uma versão de' };

export async function viewPainel(alvo, ctx) {
  const [rascunhos, ultima] = await Promise.all([
    supabase.from('settings_draft').select('key', { count: 'exact', head: true }),
    supabase.from('settings_published').select('published_at').order('published_at', { ascending: false }).limit(1),
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
        <a class="btn" href="../" target="_blank" rel="noopener">Ver site público</a>
      </div>
    </section>

    <section aria-labelledby="t-modulos">
      <h2 id="t-modulos">Movimento da loja e agenda</h2>
      <div class="grade">
        ${METRICAS_FUTURAS.map(([rotulo, modulo]) => `<div class="metrica"><div class="valor">—</div><div class="rotulo">${esc(rotulo)}</div><div class="detalhe">Disponível quando o módulo ${esc(modulo)} for criado</div></div>`).join('')}
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
