export type LegalPolicyId = "terms" | "privacy" | "cookies"

export const LEGAL_POLICY_VERSIONS = {
  terms: "2026-08-30",
  privacy: "2026-08-30",
  cookies: "2026-08-30",
} as const

export const LEGAL_CONTACT_EMAIL = "vendas@criatai.studio"

export interface LegalSection {
  heading: string
  paragraphs: string[]
  bullets?: string[]
}

export interface LegalPolicy {
  id: LegalPolicyId
  label: string
  title: string
  summary: string
  version: string
  effectiveDate: string
  sections: LegalSection[]
}

export const LEGAL_POLICIES: Record<LegalPolicyId, LegalPolicy> = {
  terms: {
    id: "terms",
    label: "Termos de Uso",
    title: "Termos de Uso do Criatai Studio",
    summary:
      "As regras de acesso e uso da plataforma de criação, edição e processamento de mídias com Inteligência Artificial.",
    version: LEGAL_POLICY_VERSIONS.terms,
    effectiveDate: "30 de agosto de 2026",
    sections: [
      {
        heading: "1. Aceite e escopo",
        paragraphs: [
          "Ao criar uma conta ou utilizar o Criatai Studio, você declara que leu estes Termos de Uso e concorda com eles. Estes termos regulam o acesso à plataforma, seus recursos de criação e processamento de mídias, os planos contratados e as integrações ativadas pelo usuário.",
          "A Política de Privacidade e a Política de Cookies complementam estes Termos. Quando houver uso de rosto, voz ou outra característica identificável de uma pessoa, também é necessário obter e manter o consentimento específico exigido no painel.",
        ],
      },
      {
        heading: "2. Conta, acesso e segurança",
        paragraphs: [
          "O usuário deve fornecer informações verdadeiras, manter suas credenciais em segurança e utilizar a conta somente em nome próprio ou com autorização válida da empresa que representa. Cada workspace deve ser utilizado de acordo com o plano contratado e com os limites exibidos no painel.",
          "Podemos suspender ou limitar o acesso quando houver indícios de fraude, violação destes Termos, risco de segurança, uso ilegal ou inadimplência, preservando as informações necessárias para cumprir obrigações legais.",
        ],
      },
      {
        heading: "3. Conteúdo enviado pelo usuário",
        paragraphs: [
          "Você mantém os direitos que já possuía sobre textos, imagens, vídeos, áudios, marcas, rostos, vozes e demais materiais enviados à plataforma. Você é responsável por possuir as autorizações necessárias para usar esse conteúdo e para solicitar sua edição, processamento ou publicação.",
          "Ao enviar conteúdo, você concede ao Criatai Studio uma licença limitada, não exclusiva e necessária para hospedar, transmitir, analisar, processar e entregar o resultado solicitado. Essa licença termina quando não for mais necessária para prestar o serviço, sem prejuízo de cópias técnicas, registros de segurança ou obrigações legais.",
        ],
        bullets: [
          "Não envie conteúdo que viole direitos autorais, marcas, imagem, voz, privacidade ou outros direitos de terceiros.",
          "Não use a plataforma para fraude, desinformação, discriminação, exploração sexual, violência, malware ou qualquer finalidade ilegal.",
          "Não tente contornar cotas, controles de segurança, limites de uso ou regras de publicação das plataformas integradas.",
        ],
      },
      {
        heading: "4. Inteligência Artificial e serviços de terceiros",
        paragraphs: [
          "Os resultados gerados por Inteligência Artificial podem conter imprecisões, semelhanças não intencionais ou elementos que exigem revisão humana. O usuário deve revisar roteiro, imagens, áudio, legendas e permissões antes de publicar ou utilizar comercialmente o material.",
          "Para executar determinados recursos, o conteúdo pode ser processado por provedores de hospedagem, armazenamento, IA, transcrição, pagamento ou redes sociais. Esses provedores recebem somente o que for necessário para executar a operação solicitada, conforme a Política de Privacidade e os termos aplicáveis.",
        ],
      },
      {
        heading: "5. Planos, cotas e disponibilidade",
        paragraphs: [
          "Os recursos, créditos, limites de geração, espaço de armazenamento e preços vigentes são os apresentados na página de preços, na contratação e no painel. O uso de uma integração externa também está sujeito aos limites e regras do respectivo provedor.",
          "A plataforma pode passar por manutenção, indisponibilidade de provedores ou alterações de recursos. Quando uma alteração afetar materialmente um plano pago, comunicaremos a mudança pelos canais disponíveis e aplicaremos a legislação de consumo pertinente.",
        ],
      },
      {
        heading: "6. Retenção, expiração e download",
        paragraphs: [
          "O Criatai Studio é uma ferramenta de criação e processamento, não um serviço de backup permanente ou armazenamento em nuvem ilimitado. O usuário deve baixar os arquivos que deseja conservar.",
          "Para controlar custos e proteger a disponibilidade do serviço, aplicam-se as seguintes regras operacionais, sempre com o aviso exibido no painel:",
        ],
        bullets: [
          "Arquivos temporários de processamento: podem ser removidos em até 7 dias, e normalmente em até 24 horas após a conclusão ou falha da tarefa.",
          "Contas gratuitas: uploads brutos e vídeos renderizados podem ser removidos após 14 dias corridos contados, respectivamente, do upload e da renderização.",
          "Contas pagas: ficam sujeitas à cota de armazenamento informada no plano e à expiração de mídias sem atividade por 90 dias. Download, edição, nova renderização ou outra atividade indicada no painel pode renovar o prazo.",
          "Antes da remoção, a plataforma poderá exibir avisos no painel ou enviar notificações para o contato cadastrado. Após a remoção do arquivo físico, roteiro, projeto e metadados poderão permanecer disponíveis para permitir nova renderização, quando isso for compatível com a Política de Privacidade.",
          "Arquivos removidos pelo ciclo de retenção não são recuperáveis como regra geral. Processos judiciais, obrigações legais, segurança e prevenção a fraude podem exigir a preservação de determinados registros.",
        ],
      },
      {
        heading: "7. Re-renderização e publicação",
        paragraphs: [
          "A possibilidade de re-renderizar depende da permanência do projeto, dos insumos e dos provedores necessários. Uma nova renderização pode consumir créditos ou gerar cobrança conforme o plano vigente.",
          "A publicação em Instagram, TikTok, YouTube ou outra rede depende de autorização válida, disponibilidade da API oficial e regras da rede. O usuário continua responsável pelo conteúdo publicado e pela conta social conectada.",
        ],
      },
      {
        heading: "8. Propriedade intelectual do serviço",
        paragraphs: [
          "A marca Criatai, o software, a interface, os modelos de operação, os componentes e os materiais próprios da plataforma pertencem ao respectivo titular e não são transferidos ao usuário. O conteúdo do usuário não se torna propriedade do Criatai apenas por ser processado na plataforma.",
        ],
      },
      {
        heading: "9. Encerramento e alterações",
        paragraphs: [
          "O usuário pode deixar de utilizar a plataforma e solicitar a exclusão da conta pelos canais disponíveis. O encerramento não elimina obrigações já vencidas nem registros que precisem ser mantidos por lei, segurança ou defesa de direitos.",
          "Podemos atualizar estes Termos para refletir mudanças no serviço ou na legislação. A nova versão terá uma data e versão próprias; quando necessário, pediremos novo aceite antes de continuar o uso de funcionalidades afetadas.",
        ],
      },
      {
        heading: "10. Contato",
        paragraphs: [
          `Dúvidas sobre estes Termos podem ser encaminhadas para ${LEGAL_CONTACT_EMAIL}. A identificação jurídica completa do controlador, endereço e canal formal de privacidade devem ser confirmados antes da publicação definitiva deste documento.`,
        ],
      },
    ],
  },
  privacy: {
    id: "privacy",
    label: "Política de Privacidade",
    title: "Política de Privacidade do Criatai Studio",
    summary:
      "Como tratamos dados de conta, projetos, mídias, consentimentos e uso da plataforma.",
    version: LEGAL_POLICY_VERSIONS.privacy,
    effectiveDate: "30 de agosto de 2026",
    sections: [
      {
        heading: "1. Quem somos e o que esta política cobre",
        paragraphs: [
          "Esta Política explica como o Criatai Studio trata dados pessoais quando você visita o site, cria uma conta, utiliza o painel, envia conteúdo, solicita uma geração ou conecta uma rede social.",
          "A identificação jurídica do controlador, CNPJ, endereço e canal oficial do encarregado devem ser preenchidos pela empresa responsável antes da publicação definitiva. Enquanto isso, dúvidas podem ser encaminhadas para o contato informado no final desta página.",
        ],
      },
      {
        heading: "2. Dados que podem ser tratados",
        paragraphs: [
          "Coletamos somente os dados necessários para operar, proteger e melhorar o serviço. Dependendo do recurso usado, isso pode incluir:",
        ],
        bullets: [
          "Dados de cadastro e conta, como e-mail, nome do negócio, identificadores de usuário e workspace.",
          "Dados de autenticação, sessão, segurança, endereço IP, navegador, dispositivo e registros de acesso.",
          "Textos, roteiros, briefings, imagens, vídeos, áudios, marcas, referências e projetos enviados ou gerados.",
          "Registros de consentimento de rosto e voz, quando o usuário utiliza pessoa real em uma produção.",
          "Dados de plano, consumo, cobrança e status de integrações, sem armazenar credenciais de pagamento além do necessário para processar a transação.",
          "Informações técnicas, erros e eventos necessários para diagnóstico, segurança e prevenção de abuso.",
        ],
      },
      {
        heading: "3. Finalidades e bases",
        paragraphs: [
          "Usamos esses dados para executar o contrato e entregar os recursos solicitados, cumprir obrigações legais, proteger a plataforma e exercer direitos. Quando a finalidade depender de consentimento, solicitaremos uma ação específica e permitiremos sua revogação.",
        ],
        bullets: [
          "Criar e proteger sua conta, autenticar acessos e oferecer suporte.",
          "Processar briefings e mídias, produzir resultados e disponibilizar download ou publicação.",
          "Controlar créditos, cotas, armazenamento, retenção e re-renderização.",
          "Registrar consentimentos de imagem e voz e bloquear produções sem autorização válida.",
          "Processar pagamentos, prevenir fraude e cumprir obrigações fiscais e legais.",
          "Enviar comunicações operacionais e, quando permitido, comunicações de produto ou marketing.",
        ],
      },
      {
        heading: "4. Compartilhamento e provedores",
        paragraphs: [
          "Podemos compartilhar dados com fornecedores que hospedam o serviço, armazenam arquivos, processam IA, transcrevem áudio, processam pagamentos, enviam comunicações ou fornecem suporte. Esses fornecedores devem tratar os dados conforme suas instruções, contratos e medidas de segurança aplicáveis.",
          "Quando você escolhe conectar ou publicar em uma rede social, os dados necessários são enviados àquela rede. O tratamento posterior também fica sujeito à política de privacidade do respectivo provedor.",
        ],
      },
      {
        heading: "5. Transferências internacionais",
        paragraphs: [
          "Alguns fornecedores podem processar dados fora do Brasil. Nesses casos, adotaremos as medidas contratuais e organizacionais aplicáveis para proteger os dados e informar o usuário quando a legislação exigir.",
        ],
      },
      {
        heading: "6. Retenção e exclusão",
        paragraphs: [
          "Arquivos de mídia seguem os prazos de retenção publicados nos Termos de Uso e nos avisos do painel. Projetos, roteiros e metadados podem permanecer enquanto forem necessários para prestar o serviço, atender uma solicitação de re-renderização, cumprir obrigação legal ou proteger direitos.",
          "Registros de segurança, cobrança, aceite de políticas e consentimentos podem ser mantidos pelo período necessário para cumprir lei, auditoria, prevenção de fraude ou defesa de direitos. Quando a finalidade terminar, os dados serão eliminados, anonimizados ou bloqueados conforme a tecnologia e a obrigação aplicável.",
        ],
      },
      {
        heading: "7. Direitos do titular",
        paragraphs: [
          "Nos limites da legislação aplicável, você pode solicitar confirmação de tratamento, acesso, correção, anonimização, bloqueio, eliminação, portabilidade, informação sobre compartilhamentos e revisão de decisões automatizadas, além de revogar consentimentos quando essa for a base legal.",
          `Para exercer seus direitos, escreva para ${LEGAL_CONTACT_EMAIL} informando o pedido e o e-mail da conta. Podemos solicitar informações adicionais para confirmar a identidade e proteger a conta.`,
        ],
      },
      {
        heading: "8. Segurança",
        paragraphs: [
          "Aplicamos controles técnicos e organizacionais proporcionais ao risco, incluindo autenticação, controle de acesso, registros de segurança e proteção de credenciais. Nenhum serviço conectado à internet é totalmente imune a incidentes; se ocorrer um evento relevante, adotaremos as medidas de resposta e comunicação exigidas.",
        ],
      },
      {
        heading: "9. Crianças e adolescentes",
        paragraphs: [
          "A plataforma não é direcionada a crianças. Não solicitamos intencionalmente dados de crianças sem a participação e autorização exigidas dos responsáveis. Se você acredita que uma criança forneceu dados, entre em contato para que possamos avaliar a remoção.",
        ],
      },
      {
        heading: "10. Atualizações e contato",
        paragraphs: [
          "Esta política pode ser atualizada para refletir mudanças no serviço, nos fornecedores ou na legislação. A versão vigente, a data de atualização e o histórico de aceite ficam identificados no produto.",
          `Contato de privacidade: ${LEGAL_CONTACT_EMAIL}. A empresa responsável deve substituir este contato pelo canal formal do encarregado antes de disponibilizar a versão definitiva.`,
        ],
      },
    ],
  },
  cookies: {
    id: "cookies",
    label: "Política de Cookies",
    title: "Política de Cookies do Criatai Studio",
    summary:
      "Quais cookies e tecnologias semelhantes usamos e como você pode controlar preferências.",
    version: LEGAL_POLICY_VERSIONS.cookies,
    effectiveDate: "30 de agosto de 2026",
    sections: [
      {
        heading: "1. O que são cookies",
        paragraphs: [
          "Cookies são pequenos arquivos gravados no navegador para lembrar preferências ou permitir que um site funcione. Tecnologias semelhantes incluem armazenamento local e identificadores de sessão.",
        ],
      },
      {
        heading: "2. Uso atual no Criatai Studio",
        paragraphs: [
          "Neste ambiente, usamos apenas recursos estritamente necessários para funcionamento e segurança. A interface pode armazenar a preferência de abertura da barra lateral, e a sessão da aplicação pode usar armazenamento local para manter o estado de acesso.",
          "Não ativamos cookies de publicidade, venda de dados ou rastreamento comportamental nesta versão. Se ferramentas de análise ou marketing forem adicionadas, elas só devem ser ativadas após atualizar esta política e disponibilizar uma escolha específica.",
        ],
      },
      {
        heading: "3. Como controlar",
        paragraphs: [
          "Você pode apagar ou bloquear cookies nas configurações do navegador. O bloqueio de cookies estritamente necessários pode impedir login, preferências ou partes do painel de funcionarem corretamente.",
          "A preferência de cookies não substitui o aceite dos Termos de Uso nem o reconhecimento da Política de Privacidade. São decisões diferentes e devem permanecer separadas.",
        ],
      },
      {
        heading: "4. Atualizações e contato",
        paragraphs: [
          "Atualizaremos esta política quando novos cookies, fornecedores ou finalidades forem adicionados. Dúvidas podem ser encaminhadas para " + LEGAL_CONTACT_EMAIL + ".",
        ],
      },
    ],
  },
}
