// Valores padrão e regras compartilhadas entre o site público e o painel.
// O site e o painel combinam estes padrões com o que foi publicado no banco:
// se algo ainda não foi publicado (ou o banco estiver fora do ar), o padrão é usado.

/**
 * Módulos do site. Enquanto "pronto" for false, o cartão correspondente da página
 * inicial leva para o WhatsApp (não existe link quebrado).
 * Quando o módulo for publicado, troque "pronto" para true.
 */
export const MODULOS = {
  loja: {
    href: 'loja/', pronto: true,
    aviso: 'Loja online em breve',
    zap: 'Olá! Gostaria de ver os produtos do Pet Natureza.',
  },
  banho: {
    href: 'banho-e-tosa/', pronto: true,
    aviso: 'Agendamento online em breve',
    zap: 'Olá! Gostaria de agendar Banho & Tosa para o meu pet.',
  },
  vet: {
    href: 'consulta-veterinaria/', pronto: true,
    aviso: 'Agendamento online em breve',
    zap: 'Olá! Gostaria de agendar uma consulta veterinária para o meu pet.',
  },
};

export const PADRAO_EMPRESA = {
  nome: 'Pet Natureza',
  slogan: 'Há 9 anos cuidando do bem-estar do seu Pet!',
  descricao: 'Pet shop na Cidade Operária, com Banho & Tosa, serviços veterinários, farmácia pet, acessórios, itens de higiene, rações, petiscos e muito mais!',
  whatsapp: '5598984402286',
  email: 'petnatureza@gmail.com',
  endereco: 'Av. 205, n° 10, Cidade Operária, São Luís, Maranhão',
  horarios: '',
};

export const PADRAO_REDES = {
  instagram: '@petnatureza',
  facebook: 'Pet Natureza',
  threads: 'petnatureza',
  tiktok: 'petnatureza',
  instagram_url: '',
  facebook_url: '',
  threads_url: '',
  tiktok_url: '',
};

export const PADRAO_INICIO = {
  hero: {
    titulo: 'Bem-vindo ao Pet Natureza!',
    texto: 'Banho & Tosa, consultas veterinárias, farmácia pet, rações, petiscos e acessórios. Tudo o que seu pet precisa, aqui na Cidade Operária.',
    rotulo_whatsapp: 'Chamar no WhatsApp',
    mensagem_whatsapp: 'Olá! Vim pelo site do Pet Natureza e gostaria de mais informações.',
  },
  acoes: {
    loja: {
      titulo: 'Ver produtos',
      descricao: 'Encontre rações, petiscos, acessórios, itens de higiene e muito mais.',
      rotulo: 'Acessar a loja',
    },
    banho: {
      titulo: 'Agendar Banho & Tosa',
      descricao: 'Solicite um horário para cuidar da higiene e do bem-estar do seu pet.',
      rotulo: 'Solicitar horário',
    },
    vet: {
      titulo: 'Agendar Consulta Veterinária',
      descricao: 'Envie sua solicitação de consulta para a equipe do Pet Natureza.',
      rotulo: 'Solicitar consulta',
    },
  },
  sobre: {
    titulo: 'Sobre Nós',
    texto: 'O Pet Natureza é um pet shop na Cidade Operária, em São Luís, que reúne Banho & Tosa, serviços veterinários, farmácia pet, acessórios, itens de higiene, rações, petiscos e muito mais. Nosso objetivo é cuidar do bem-estar do seu pet com atenção e carinho.',
    localizacao: 'Cidade Operária, São Luís/MA',
  },
  servicos: [
    { nome: 'Banho & Tosa', ativo: true },
    { nome: 'Consultas Veterinárias', ativo: true },
    { nome: 'Farmácia Pet', ativo: true },
    { nome: 'Acessórios', ativo: true },
    { nome: 'Itens de Higiene', ativo: true },
    { nome: 'Rações', ativo: true },
    { nome: 'Petiscos', ativo: true },
    { nome: 'Muito mais', ativo: true },
  ],
  diferenciais: [
    { icone: '💛', titulo: 'Atendimento com carinho', descricao: 'Recebemos você e seu pet com atenção e simpatia.', ativo: true },
    { icone: '🐾', titulo: 'Cuidado e bem-estar animal', descricao: 'O bem-estar do seu pet está no centro do nosso trabalho.', ativo: true },
    { icone: '🛍️', titulo: 'Variedade de produtos', descricao: 'Rações, petiscos, acessórios, higiene e farmácia pet em um só lugar.', ativo: true },
    { icone: '📅', titulo: 'Praticidade para agendar', descricao: 'Peça seu horário de forma simples, pelo site ou pelo WhatsApp.', ativo: true },
    { icone: '📍', titulo: 'Atendimento próximo ao cliente', descricao: 'Estamos na Cidade Operária, em São Luís.', ativo: true },
  ],
  galeria: { titulo: 'Nossa galeria', itens: [] },
  contato: { titulo: 'Fale com a gente', mostrar_mapa: true },
  rodape: { copyright: '© {ano} Pet Natureza. Todos os direitos reservados.' },
  seo: {
    titulo: 'Pet Natureza | Pet shop na Cidade Operária, São Luís',
    descricao: 'Pet shop na Cidade Operária, em São Luís, com Banho & Tosa, serviços veterinários, farmácia pet, acessórios, itens de higiene, rações e petiscos.',
  },
  politica: [
    'Esta política explica, de forma simples, como o {nome} trata informações pessoais.',
    'Quais informações podemos receber: nome, telefone ou WhatsApp, e-mail, endereço de entrega e dados do seu pet (como nome, espécie, raça, peso e informações de saúde), quando você faz um pedido, solicita um horário de Banho & Tosa ou uma consulta veterinária, ou entra em contato conosco.',
    'Para que usamos: para atender a sua solicitação, confirmar horários e valores, entregar pedidos e falar com você, normalmente pelo WhatsApp.',
    'Quem pode ver: as informações ficam em um banco de dados protegido e são acessadas apenas pela equipe autorizada do {nome}. Quando você escolhe abrir o WhatsApp, a conversa passa a seguir as regras do próprio WhatsApp.',
    'Seus direitos: você pode pedir acesso, correção ou exclusão dos seus dados pelo e-mail {email} ou pelo WhatsApp {whatsapp}.',
    'Esta página inicial não coleta dados pessoais por conta própria. Ela carrega fontes do Google Fonts, que podem receber o endereço de IP do seu navegador. Os formulários de pedido e agendamento terão um aviso próprio.',
  ].join('\n\n'),
};

/** Combina o padrão com o valor salvo: objetos são combinados campo a campo; listas e textos são substituídos. */
export function mesclar(padrao, salvo) {
  if (salvo === undefined || salvo === null) return padrao;
  if (Array.isArray(padrao) || typeof padrao !== 'object') return salvo;
  if (typeof salvo !== 'object' || Array.isArray(salvo)) return padrao;
  const r = { ...padrao };
  for (const k of Object.keys(salvo)) r[k] = k in padrao ? mesclar(padrao[k], salvo[k]) : salvo[k];
  return r;
}
