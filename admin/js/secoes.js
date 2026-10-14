import { esc } from './util.js';

export const SECOES = [
  { id: 'painel', rotulo: 'Painel', icone: '🏠', pronto: true, afeta: 'Visão geral' },
  { id: 'inicio', rotulo: 'Página Inicial', icone: '📄', pronto: true, afeta: 'Página inicial' },
  { id: 'produtos', rotulo: 'Produtos', icone: '🛍️', pronto: true, afeta: 'Loja',
    resumo: 'Cadastro de produtos e categorias, imagens, estoque, promoções, destaques e histórico de ajustes.' },
  { id: 'entrega', rotulo: 'Entrega e Retirada', icone: '🚚', pronto: true, afeta: 'Loja',
    resumo: 'Locais de entrega, taxas, disponibilidade, retirada na loja e prazos estimados.' },
  { id: 'banho-tosa', rotulo: 'Banho & Tosa', icone: '🛁', pronto: true, afeta: 'Banho & Tosa',
    resumo: 'Datas e horários, capacidade, bloqueios, regras de preço e solicitações com status e contato por WhatsApp.' },
  { id: 'veterinaria', rotulo: 'Consultas Veterinárias', icone: '🩺', afeta: 'Consulta Veterinária',
    resumo: 'Agenda própria, tipos de consulta, preços, aviso de emergência e solicitações com status.' },
  { id: 'agenda', rotulo: 'Agenda', icone: '📅', afeta: 'Banho & Tosa e Consulta Veterinária',
    resumo: 'Calendário com horários livres, solicitados, confirmados e bloqueados.' },
  { id: 'galeria', rotulo: 'Galeria e Mídia', icone: '🖼️', afeta: 'Página inicial e Loja',
    resumo: 'Envio, legenda, visibilidade e ordem das imagens.' },
  { id: 'empresa', rotulo: 'Informações da Empresa', icone: '🏪', pronto: true, afeta: 'Todas as páginas' },
  { id: 'aparencia', rotulo: 'Aparência e Marca', icone: '🎨', afeta: 'Todas as páginas públicas',
    resumo: 'Logo, cores e imagens de marca do site público.' },
  { id: 'redes', rotulo: 'Redes Sociais', icone: '🔗', pronto: true, afeta: 'Página inicial' },
  { id: 'pagamentos', rotulo: 'Formas de Pagamento', icone: '💳', pronto: true, afeta: 'Loja',
    resumo: 'Formas de pagamento disponíveis no fechamento do pedido.' },
  { id: 'relatorios', rotulo: 'Relatórios', icone: '📊', afeta: 'Painel',
    resumo: 'Vendas, pedidos, agendamentos e estoque a partir dos dados reais.' },
  { id: 'usuarios', rotulo: 'Usuários e Permissões', icone: '👥', afeta: 'Painel',
    resumo: 'Convite de pessoas da equipe, perfis (Administrador e Funcionário) e ativação de contas.' },
  { id: 'sistema', rotulo: 'Configurações do Sistema', icone: '⚙️', afeta: 'Painel e site público',
    resumo: 'Fuso horário, regras gerais e manutenção.' },
  { id: 'ajuda', rotulo: 'Ajuda e Manutenção', icone: '❓', pronto: true, afeta: 'Painel' },
];

export function viewPlaceholder(alvo, secao) {
  alvo.innerHTML = `
    <header class="cab-pagina">
      <h1>${esc(secao.rotulo)}</h1>
      <p class="afeta"><strong>Afeta:</strong> ${esc(secao.afeta)}</p>
    </header>
    <div class="cartao">
      <h2>Esta seção será criada nas próximas etapas</h2>
      <p>${esc(secao.resumo || '')}</p>
      <p class="suave">Por enquanto, já é possível editar as informações da empresa e as redes sociais.</p>
      <a class="btn btn-primario" href="#/empresa">Ir para Informações da Empresa</a>
    </div>`;
}

export function viewAjuda(alvo) {
  alvo.innerHTML = `
    <header class="cab-pagina"><h1>Ajuda e Manutenção</h1></header>

    <details class="cartao" open>
      <summary>Como funcionam rascunho e publicação</summary>
      <p>Ao clicar em <strong>Salvar rascunho</strong>, a alteração fica guardada só no painel. O site público não muda.</p>
      <p>Ao clicar em <strong>Publicar</strong>, as informações são validadas e passam a aparecer no site. Pedidos e solicitações de clientes nunca são alterados por uma publicação.</p>
      <p>Se fechar a página sem salvar, as alterações ficam neste aparelho e você pode restaurá-las ao voltar.</p>
    </details>

    <details class="cartao">
      <summary>Perfis de acesso</summary>
      <p><strong>Administrador:</strong> edita, publica e vê o histórico de atividades.</p>
      <p><strong>Funcionário:</strong> visualiza as informações. Nas próximas etapas, atenderá pedidos e solicitações.</p>
    </details>

    <details class="cartao">
      <summary>Esqueci minha senha</summary>
      <p>Na tela de entrada, informe o e-mail e use <strong>Esqueci minha senha</strong>. Você receberá um link para criar uma nova senha.</p>
      <p>Se ninguém conseguir entrar, o responsável técnico pode redefinir a senha em Supabase &gt; Authentication &gt; Users.</p>
    </details>

    <details class="cartao">
      <summary>Cópia de segurança</summary>
      <p>Os dados ficam no banco do Supabase. Confira no seu plano do Supabase como são feitos os backups e exporte o banco periodicamente. O passo a passo está no arquivo README do projeto.</p>
    </details>`;
}
