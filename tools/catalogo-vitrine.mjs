/**
 * Nomenclatura padronizada e descricoes detalhadas dos cartoes web,
 * utilitarios desktop e itens UXP exibidos na vitrine.
 *
 * Mantido separado de nobel/ para evitar conflitos com melhorias paralelas
 * nos aplicativos de navegador e preservar os contratos dos testes de producao.
 */

export const METADADOS_VITRINE = {
  /* Web apps (/apps/*) ------------------------------------------------ */
  'web/enderecos': {
    titulo: 'Localizar pasta e links da OS',
    descricao: 'Informe cliente e pedido (0000-000000) para montar e copiar o caminho de rede no servidor, o link do pedido e a versão de impressão.'
  },
  'web/balcao': {
    titulo: 'Registrar briefing e cronômetro de OS',
    descricao: 'Cronometre ajustes de arte no atendimento ao balcão, registre o briefing técnico do cliente e converta o atendimento diretamente em OS.'
  },
  'web/fila': {
    titulo: 'Gerenciar fila e ficha do impressor',
    descricao: 'Organize ordens de serviço por prazo de entrega, acompanhe etapas de produção e gere a ficha técnica de impressão pronta para consulta.'
  },
  'web/folhas': {
    titulo: 'Escolher melhor formato de folha',
    descricao: 'Compara formatos gráficos disponíveis para a tiragem e indica a folha que reduz perdas e aproveita melhor a área útil.'
  },
  'web/consumo': {
    titulo: 'Calcular consumo, peso e resmas',
    descricao: 'Calcula folhas líquidas, acerto por forma, percentual de perda, total bruto de papel, peso em quilos e quantidade de resmas de 500.'
  },
  'web/corte': {
    titulo: 'Planejar corte de folha-mãe',
    descricao: 'Compara a montagem na vertical e horizontal da folha-mãe considerando refilo de borda e sentido da fibra do papel.'
  },
  'web/montagem': {
    titulo: 'Simular montagem frente e verso',
    descricao: 'Visualiza o posicionamento das peças na frente e no verso da folha de máquina para conferir alinhamento, pinça e virada.'
  },
  'web/cadernos': {
    titulo: 'Calcular cadernos, lombada e creep',
    descricao: 'Planeja número de páginas, dobras de caderno, espessura de lombada por gramatura e compensação de creep no acabamento.'
  },
  'web/gabarito': {
    titulo: 'Gerar gabarito de corte, sangria e Wire-o',
    descricao: 'Calcula áreas seguras e exporta prova SVG cotada com marca de corte, sangria externa e reserva de furação ou Wire-o.'
  },
  'web/lona': {
    titulo: 'Planejar lona, bainha e ilhós',
    descricao: 'Calcula medidas finais para impressão em lona com sobras de bainha, bolsas de acabamento, emendas e distribuição de ilhoses.'
  },
  'web/numeracao': {
    titulo: 'Gerar numeração de blocos e talões',
    descricao: 'Distribui sequências numéricas por colunas de corte na folha e confere o primeiro e o último número de cada bloco ou via.'
  },
  'web/ofertas': {
    titulo: 'Gerar cartazes de ofertas (SVG)',
    descricao: 'Converte lista de produtos (SKU;Nome;De;Por;Unidade) em cartazes SVG vetoriais editáveis nos formatos A5, Story ou Horizontal.'
  },
  'web/remendo': {
    titulo: 'Criar remendo de adesivo com imagem',
    descricao: 'Recorta uma região selecionada de imagem com margem extra de segurança e gera janela exata para reaplicação do remendo na escala.'
  },
  'web/preflight': {
    titulo: 'Conferir resolução real (PPI) da imagem',
    descricao: 'Mede o PPI efetivo de imagens PNG, JPEG ou WebP no tamanho físico impresso para identificar baixa resolução antes do fechamento.'
  },
  'web/preto-tac': {
    titulo: 'Verificar preto composto e cobertura CMYK',
    descricao: 'Compara fórmulas CMYK com o limite máximo de tinta (TAC) de cada papel para evitar excesso de carga, decalque e secagem lenta.'
  },
  'web/fechamento': {
    titulo: 'Montar plano de fechamento PDF X',
    descricao: 'Define perfil de saída, sangria, predefinição PDF/X e ordem de máscaras técnicas para orientar o fechamento seguro com fornecedores.'
  },
  'web/lote-imagens': {
    titulo: 'Gerar script de tratamento de imagens (ICC)',
    descricao: 'Configura perfil ICC, resolução alvo e intenção de renderização e gera script Photoshop pronto para converter imagens em lote.'
  },
  'web/avaliar-folha': {
    titulo: 'Comparar aproveitamento, pinça e fibra',
    descricao: 'Avalia T4, T8, SRA3 e folhas-mãe considerando margem de pinça, calha, direção da fibra, vinco e total de cliques.'
  },
  'web/chapa-coletiva': {
    titulo: 'Agrupar serviços em chapa coletiva',
    descricao: 'Combina impressos compatíveis em faixas de corte na mesma chapa de máquina e mostra aproveitamento, rodagem e excedentes.'
  },
  'web/dobras': {
    titulo: 'Calcular dobras e marcas para Preps',
    descricao: 'Calcula largura de painéis em dobras (carteira, sanfona, envoltório), compensações de dobra e parâmetros para conferir no Preps.'
  },
  'web/cut-stack': {
    titulo: 'Gerar CSV de numeração Cut & Stack',
    descricao: 'Gera arquivo CSV de dados variáveis com numeração em pilhas (Cut & Stack) e controle de múltiplas vias para talões e blocos.'
  },
  'web/codigos': {
    titulo: 'Gerar QR Code e Código de Barras (K100)',
    descricao: 'Cria códigos QR e Code 128 vetoriais em SVG e PDF com preto puro (K100), dimensão física exata em mm e área livre (quiet zone).'
  },
  'web/painelamento': {
    titulo: 'Calcular painelamento e emendas de bobina',
    descricao: 'Compara divisão em faixas horizontais e verticais para painéis maiores que a bobina, calculando emendas e mapa de instalação.'
  },
  'web/escala-lona': {
    titulo: 'Calcular escala, PPI e acabamento de lona',
    descricao: 'Calcula fator de escala para grandes formatos, PPI real após ampliação, bainha, bolsa e espaçamento uniforme dos ilhoses.'
  },
  'web/tinta-branca': {
    titulo: 'Gerar receita de tinta branca e sanduíche UV',
    descricao: 'Monta a ordem de camadas do RIP (Cor, Branco, Sanduíche) para mídias transparentes ou escuras e calcula recuo (choke) da base branca.'
  },
  'web/triagem': {
    titulo: 'Fazer triagem técnica e parecer da arte',
    descricao: 'Registra falhas de sangria, resolução, fontes e perfil de cor na arte do cliente, calcula pontuação técnica e gera mensagem de retorno.'
  },
  'web/ficha-os': {
    titulo: 'Gerar passaporte técnico e texto de aprovação',
    descricao: 'Padroniza o nome do arquivo da OS, cria mensagem de aprovação pronta para envio ao cliente e gera o passaporte JSON técnico.'
  },
  'web/custos': {
    titulo: 'Comparar custos de produção e perdas',
    descricao: 'Soma perdas percentuais por etapa produtiva (impressão, corte e acabamento) e compara ponto de virada entre digital, offset e mídia.'
  },

  /* Desktop helpers & cross-editor utilities (/apps/desktop/*) ------- */
  'desktop/preparar-pasta.ps1': {
    titulo: 'Criar estrutura padrão de pastas da OS',
    descricao: 'Script PowerShell que valida o código da OS (0000-000000) e cria as subpastas padrão (Recebido, Editável, PDF, Preps e Corte) no servidor.'
  },
  'desktop/abrir-os-corel.bas': {
    titulo: 'Abrir pasta da OS no servidor',
    descricao: 'Macro VBA que detecta a OS no arquivo aberto (ou por entrada manual) e abre diretamente a pasta da ordem de serviço no Windows.'
  },
  'desktop/abrir-gabarito-illustrator.jsx': {
    titulo: 'Abrir gabarito SVG da prova',
    descricao: 'Abre no Illustrator a prova vetorial em SVG exportada pelo gerador de gabarito, mantendo cotas e dimensões físicas em escala real.'
  },
  'desktop/trace-calendario.js': {
    titulo: 'Criar gabarito de calendário (210 × 150 mm)',
    descricao: 'Desenha na camada técnica do TraceDraw os retângulos de corte final (210 × 150 mm) e a faixa interna de segurança de 14 mm em milímetros.'
  },
  'desktop/conferir-faca-vectorcraft.js': {
    titulo: 'Conferir camadas e facas de corte',
    descricao: 'Inspeciona em modo leitura as camadas FACA, MEIO-CORTE e MEIO_CORTE no VectorCraft para validar âncoras, fechamento e integridade.'
  },
  'desktop/inspecionar-photocraft.ps1': {
    titulo: 'Inspecionar lote de PSDs e gerar JSON',
    descricao: 'Varre uma pasta de arquivos PSD com o photocraft-cli e exporta relatório JSON consolidado com dimensões, camadas e erros.'
  },
  'desktop/auditar-arte-corel.bas': {
    titulo: 'Auditar arte (TAC, RGB e resolução)',
    descricao: 'Percorre todas as páginas no CorelDRAW verificando cobertura CMYK máxima (TAC), objetos RGB e resolução baixa, permitindo selecionar cada item.'
  },
  'desktop/auditar-arte-illustrator.jsx': {
    titulo: 'Auditar arte (TAC, RGB e overprint)',
    descricao: 'Identifica objetos RGB, cor Registro, cobertura CMYK acima do limite, branco em sobreimpressão e texto composto pequeno, com opção de correção.'
  },
  'desktop/fechar-pdf-corel.bas': {
    titulo: 'Fechar PDF de impressão (estilo Corel)',
    descricao: 'Cria cópia temporária do CDR salvo, carrega estilo PDF homologado e aplica opções Web-to-Print (textos em curvas e sem marcas) ao publicar.'
  },
  'desktop/fechar-pdf-illustrator.jsx': {
    titulo: 'Fechar PDF de impressão (preset Adobe)',
    descricao: 'Exporta PDF/X de uma cópia segura do .ai com predefinição Adobe, modo Web-to-Print opcional e intercalação de máscaras K100 frente e verso.'
  },
  'desktop/camada-tecnica-illustrator.jsx': {
    titulo: 'Criar camada técnica (corte, vinco ou branco)',
    descricao: 'Cria camada técnica com tinta Spot configurada para RIP (CutContour, PerfCutContour, Vinco ou White_Ink), overprint ativo e offset opcional.'
  },
  'desktop/exportar-corte-illustrator.jsx': {
    titulo: 'Exportar faca de corte em SVG ou DXF (1:1)',
    descricao: 'Coleta os caminhos de corte removendo duplicatas e exporta em escala 1:1 (mm) para SVG (Béziers) ou DXF (polilinhas para router e laser).'
  },
  'desktop/conferir-corte-illustrator.jsx': {
    titulo: 'Conferir caminhos de corte e fresa',
    descricao: 'Verifica na seleção se há caminhos abertos, contornos duplicados sobrepostos ou peças menores que o diâmetro da fresa informado.'
  },
  'desktop/pastas-passaporte.ps1': {
    titulo: 'Criar pastas e passaporte HTML da OS',
    descricao: 'Script PowerShell que lê o passaporte JSON exportado (ou perfil de estúdio) e cria a árvore de pastas junto ao resumo PASSAPORTE_OS.html.'
  },
  'desktop/pastas-passaporte.bat': {
    titulo: 'Executar criador de pastas e passaporte',
    descricao: 'Lançador Windows (.bat) que permite escolher entre perfil OS de Gráfica ou Estúdio e inicia o criador PowerShell de pastas e passaporte.'
  },

  /* Remendo de adesivo (família editores desktop) --------------------- */
  'desktop/remendo-adesivo-corel.bas': {
    titulo: 'Criar remendo de adesivo com margem',
    descricao: 'Duplica a seleção no CorelDRAW com a margem escolhida em mm, aplica PowerClip na janela exata e cria página na escala real do remendo.'
  },
  'desktop/remendo-adesivo-illustrator.jsx': {
    titulo: 'Criar remendo de adesivo com margem',
    descricao: 'Lê a janela de recorte e margem em mm e gera cópia do arquivo .ai com prancheta ajustada no tamanho exato para imprimir o remendo.'
  },
  'desktop/remendo-adesivo-tracedraw.js': {
    titulo: 'Criar remendo de adesivo com margem',
    descricao: 'Posiciona a seleção na janela recortada com margem extra e configura página em escala real no TraceDraw pronta para saída do remendo.'
  },
  'desktop/remendo-adesivo-vectorcraft.js': {
    titulo: 'Criar remendo de adesivo com margem',
    descricao: 'Calcula a janela ampliada com margem em mm a partir da prancheta no VectorCraft e adiciona nova prancheta exata para o remendo.'
  },
  'desktop/remendo-adesivo-photocraft.mjs': {
    titulo: 'Criar remendo de adesivo com margem',
    descricao: 'Utilitário Node/CLI para PhotoCraft que aplica a geometria de janela com margem sobre PSDs e gera o documento final de remendo.'
  },

  /* Imposição de arte e faca de corte (família 5 editores) ------------ */
  'desktop/imposicao-arte-corte-illustrator.jsx': {
    titulo: 'Impor grade de arte e faca de corte',
    descricao: 'Monta grade de impressão e faca de corte alinhadas em duas pranchetas no Illustrator, com offset, calha, margens e marcas de registro.'
  },
  'desktop/imposicao-arte-corte-corel.bas': {
    titulo: 'Impor grade de arte e faca de corte',
    descricao: 'Monta grade de impressão e faca de corte alinhadas em duas páginas no CorelDRAW, com deslocamento, calha, margens e marcas de registro.'
  },
  'desktop/imposicao-arte-corte-affinity.js': {
    titulo: 'Impor grade de arte e faca de corte',
    descricao: 'Monta grade alinhada de arte e faca de corte por nós no Affinity com deslocamento, calha, margens de folha e marcas de registro.'
  },
  'desktop/imposicao-arte-corte-vectorcraft.js': {
    titulo: 'Impor grade de arte e faca de corte',
    descricao: 'Monta grade de arte e faca de corte em duas pranchetas no VectorCraft, mantendo escala real, offset, calha e marcas de registro.'
  },
  'desktop/imposicao-arte-corte-tracedraw.js': {
    titulo: 'Impor grade de arte e faca de corte',
    descricao: 'Gera páginas pareadas de impressão e faca de corte no TraceDraw com espaçamento, offset, margens e marcas de registro alinhadas.'
  },

  /* Plugin UXP (Photoshop) -------------------------------------------- */
  'desktop/uxp/painel': {
    titulo: 'Instalar painel de ferramentas (UXP)',
    descricao: 'Extensão nativa UXP que reúne todos os scripts e actions do Photoshop em um painel lateral com busca rápida e execução em um clique.'
  },
  'desktop/uxp/renomear': {
    titulo: 'Renomear camadas selecionadas em sequência',
    descricao: 'Comando nativo do painel UXP que renomeia as camadas selecionadas em ordem numérica (_01, _02...) usando o nome do arquivo como prefixo.'
  },
  'desktop/uxp/limpar': {
    titulo: 'Limpar sufixos e espaços de camadas',
    descricao: 'Comando nativo do painel UXP que remove automaticamente sufixos de duplicação ("cópia", "copy") e espaços extras nos nomes das camadas.'
  }
};

export function padronizarVitrine(ferramentas) {
  for (const f of ferramentas) {
    const meta = METADADOS_VITRINE[f.id];
    if (!meta) continue;
    if (meta.titulo) f.titulo = meta.titulo;
    if (meta.descricao) f.descricao = meta.descricao;
  }
  return ferramentas;
}
