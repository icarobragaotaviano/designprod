export const modulos = [
  {
    id: 'gabaritos', titulo: 'Gabaritos e estrutura', licoes: [
      {
        id: 'forma-na-prancheta', titulo: 'Retângulo no corte ou na sangria', ferramenta: 'illustrator/gabaritos-pre-impressao',
        uso: 'Crie um fundo que alcance a sangria de um panfleto de 100 × 150 mm.',
        dados: [['Prancheta', '100 × 150 mm'], ['Sangria', '3 mm por lado'], ['Forma gerada', '106 × 156 mm']],
        passos: [
          ['Ative a prancheta', 'Abra o arquivo e selecione a prancheta de 100 × 150 mm no painel Pranchetas.'],
          ['Escolha o limite', 'Em Gabaritos de pré-impressão, selecione Forma na prancheta. Escolha Sangria (BleedBox), informe 3 mm e selecione Fundo chapado.'],
          ['Crie e ajuste o fundo', 'Clique em Criar forma. No painel Transformar, confira 106 × 156 mm. Aplique a cor do trabalho e coloque a camada atrás da arte.']
        ],
        checagem: 'A prancheta continua com 100 × 150 mm. Use Corte (TrimBox) para obter um retângulo no tamanho final.'
      },
      {
        id: 'pranchetas-em-lote', titulo: 'Pranchetas em lote', ferramenta: 'illustrator/gabaritos-pre-impressao',
        uso: 'Prepare seis pranchetas T8 para lâminas promocionais.',
        dados: [['Formato', 'T8 · 238 × 328 mm'], ['Grade', '3 colunas × 2 linhas'], ['Intervalo', '8 mm']],
        passos: [
          ['Abra a configuração do lote', 'Em Gabaritos de pré-impressão, selecione Pranchetas em lote e clique em Continuar.'],
          ['Preencha formato e grade', 'Selecione T8 e orientação Original. Informe 6 pranchetas, 3 colunas e intervalo de 8 mm.'],
          ['Confira o novo documento', 'Clique em Criar e abra Janela → Pranchetas. Verifique os seis itens, com a primeira linha da esquerda para a direita.']
        ],
        checagem: 'A4, A5, T4, SRA3 e 10 × 15 cm também estão disponíveis. Use Personalizado para digitar largura e altura.'
      },
      {
        id: 'lombada-e-capa-dura', titulo: 'Lombada e planificação de capa dura', ferramenta: 'illustrator/gabaritos-pre-impressao',
        uso: 'Planifique a capa de um livro de 128 páginas com papelões de 215 × 303 mm.',
        dados: [['Caliper medido', '0,10 mm por folha'], ['Canaleta e vira', '7 mm e 18 mm'], ['Capa aberta', '486,4 × 339 mm']],
        passos: [
          ['Meça os materiais', 'Anote as dimensões reais de cada papelão e o caliper de uma folha do miolo. No exemplo, use 128 páginas, Couchê 115 g/m² e caliper de 0,10 mm.'],
          ['Monte a planificação', 'Selecione Lombada e capa dura. Informe 215 × 303 mm em Cada papelão, 7 mm de canaleta e 18 mm de vira. Clique em Planificar.'],
          ['Confira a lombada e a vira', 'O resumo mostra 64 folhas × 0,10 mm = 6,4 mm de lombada. No documento, confira contracapa, canaleta, lombada, canaleta e frente.']
        ],
        checagem: 'Com caliper vazio, o script estima a espessura pelo papel e pela gramatura. Meça o miolo encadernado antes de fechar a capa. As linhas técnicas ficam em camadas não imprimíveis.'
      },
      {
        id: 'wire-o', titulo: 'Guia de segurança para Wire-o e espiral', ferramenta: 'illustrator/gabaritos-pre-impressao',
        uso: 'Reserve espaço para a furação superior de um calendário de mesa.',
        dados: [['Prancheta', '210 × 150 mm'], ['Borda', 'Superior'], ['Recuo', '15 mm']],
        passos: [
          ['Ative a face do calendário', 'Escolha a prancheta que receberá a furação.'],
          ['Defina o lado do acabamento', 'Em Gabaritos de pré-impressão, selecione Guia Wire-o / espiral. Informe borda Superior e recuo de 15 mm. Clique em Criar guia.'],
          ['Revise a composição', 'Mantenha logotipo, datas e títulos abaixo da guia. Se ela estiver oculta, use Exibir → Guias → Mostrar guias.']
        ],
        checagem: 'A guia fica em uma camada bloqueada e não imprimível. Combine a margem com a posição real da furação.'
      }
    ]
  },
  {
    id: 'preflight', titulo: 'Preflight e tipografia', licoes: [
      {
        id: 'auto-k100', titulo: 'Preto puro com sobreimpressão', ferramenta: 'illustrator/preflight-express',
        uso: 'Corrija corpo de 12 pt, código EAN vetorial e filetes de 0,5 pt carregados nas quatro tintas.',
        dados: [['Preto de entrada', 'C40 M35 Y30 K100'], ['Preto de saída', 'C0 M0 Y0 K100'], ['Limite de traço', '0,75 pt']],
        passos: [
          ['Prepare a seleção', 'Trabalhe em um documento CMYK. No painel Camadas, nomeie o grupo vetorial do código como EAN ou Código de barras.'],
          ['Analise os objetos', 'Em Preflight express, escolha Higienizar preto. Defina 0,75 pt como espessura máxima e use Documento ou Seleção. Clique em Analisar.'],
          ['Aplique e inspecione', 'Revise a contagem no diálogo e confirme. Abra Janela → Atributos e confira a sobreimpressão de preenchimento ou traçado. Na Visualização de separações, confira a chapa K.']
        ],
        checagem: 'O script avalia texto abaixo de 24 pt e preto de quatro tintas com K ≥ 80% e diferença máxima de 35 pontos entre C, M e Y. Para códigos, o nome do objeto ou do grupo é usado na identificação.'
      },
      {
        id: 'tipografia-em-curvas', titulo: 'Tipografia em curvas em lote', ferramenta: 'illustrator/preflight-express',
        uso: 'Feche um convite com frente e verso e preserve um AI com fontes editáveis.',
        dados: [['Origem', 'convite-editavel.ai'], ['Saída', 'convite-curvas.ai'], ['Escopo', 'Todas as pranchetas']],
        passos: [
          ['Salve o documento editável', 'Conclua as revisões no AI. Confira se todas as fontes abriram e se o texto cabe nas caixas.'],
          ['Converta em uma cópia', 'Em Preflight express, escolha Converter tipografia em curvas. Salve com um novo nome, como convite-curvas.ai.'],
          ['Inspecione as duas faces', 'Na cópia, selecione um título com a ferramenta Seleção direta. Confira os pontos de ancoragem. Reabra o original para futuras revisões.']
        ],
        checagem: 'Caixas em camadas ocultas ou bloqueadas também são processadas. Se o script sinalizar texto excedente ou encadeado, revise a composição e execute novamente.'
      }
    ]
  },
  {
    id: 'marcas', titulo: 'Corte e vinco', licoes: [
      {
        id: 'marcas-de-corte', titulo: 'Marcas de corte com afastamento', ferramenta: 'illustrator/marcas-corte-vinco',
        uso: 'Prepare um impresso de 100 × 150 mm com sangria de 3 mm para refile manual.',
        dados: [['Peça acabada', '100 × 150 mm'], ['Sangria', '3 mm'], ['Afastamento e haste', '4 mm e 5 mm']],
        passos: [
          ['Ative o formato final', 'Selecione a prancheta de 100 × 150 mm e confirme que a arte já se estende 3 mm além dos quatro lados.'],
          ['Configure as cantoneiras', 'Em Marcas externas de corte e vinco, escolha Corte. Informe Sangria real de 3 mm, Afastamento de 4 mm e Comprimento de 5 mm.'],
          ['Exporte a folha de máquina', 'Clique em Criar marcas. Na faixa de pranchetas da exportação, selecione apenas FOLHA DE MÁQUINA. Abra o PDF e confira as oito hastes externas.']
        ],
        checagem: 'O afastamento é medido a partir da linha de refile. O script aumenta um valor insuficiente para manter o traço de 0,35 pt fora da sangria.'
      },
      {
        id: 'vinco-externo', titulo: 'Vinco externo para dobra manual', ferramenta: 'illustrator/marcas-corte-vinco',
        uso: 'Marque o meio de um folder aberto de 200 × 100 mm, com a dobra vertical no X = 100 mm.',
        dados: [['Formato aberto', '200 × 100 mm'], ['Vinco vertical', 'X = 100 mm'], ['Modo', 'Corte e vinco']],
        passos: [
          ['Defina a referência', 'Ative a prancheta final. Meça a posição do vinco a partir do canto superior esquerdo.'],
          ['Informe as posições', 'Escolha Corte e vinco. Digite 100 em X · Vincos verticais e deixe Y vazio. Uma dobra horizontal usa a distância Y a partir do topo.'],
          ['Alinhe e finalize', 'Exporte a prancheta FOLHA DE MÁQUINA. Na folha impressa, alinhe a régua entre os dois tracejados, faça o vinco e refile pelas marcas de corte.']
        ],
        checagem: 'As duas testemunhas ficam fora da sangria e somem com o refile. Para vários vincos no mesmo eixo, separe as medidas por ponto e vírgula.'
      }
    ]
  },
  {
    id: 'enobrecimento', titulo: 'Verniz e hot stamping', licoes: [
      {
        id: 'mascara-spot', titulo: 'Máscara spot com sobreimpressão', ferramenta: 'illustrator/enobrecimento',
        uso: 'Prepare a silhueta fechada de um logo para verniz localizado em um cartão.',
        dados: [['Amostra', 'Verniz_UV'], ['Intensidade', '100% da tinta especial'], ['Atributo', 'Sobreimpressão de preenchimento']],
        passos: [
          ['Prepare a silhueta', 'Use caminhos vetoriais fechados. Se o logotipo também precisa sair impresso em CMYK, duplique-o na mesma posição e selecione somente a cópia destinada ao verniz.'],
          ['Crie a tinta especial', 'Em Enobrecimento e prova de registro, selecione Preparar máscara spot e Verniz_UV. Clique em Continuar e confirme a transferência dos vetores.'],
          ['Confira as chapas', 'No painel Camadas, localize ENOBRECIMENTO · Verniz_UV. Em Atributos, confira a sobreimpressão. Na Visualização de separações, isole a tinta Verniz_UV.']
        ],
        checagem: 'Para metalização, escolha Hot_Stamp. Antes de usar a máscara, expanda textos, traços e efeitos que precisam fazer parte da silhueta.'
      },
      {
        id: 'pdf-de-enobrecimento', titulo: 'PDF de enobrecimento em três páginas', ferramenta: 'illustrator/enobrecimento',
        uso: 'Envie a arte, a prova de encaixe e a máscara de um impresso de 100 × 150 mm em um único PDF.',
        dados: [['Página 1', 'Arte de processo CMYK'], ['Página 2', 'Contorno M100 · 0,5 pt'], ['Página 3', 'Vetor K100']],
        passos: [
          ['Revise a prancheta ativa', 'Use um documento CMYK com a arte de processo e a camada visível do acabamento. Incorpore imagens CMYK que precisem entrar na arte.'],
          ['Exporte o acabamento certo', 'Escolha Exportar PDF de 3 páginas, selecione Verniz_UV ou Hot_Stamp de acordo com a camada preparada, clique em Continuar e salve o PDF.'],
          ['Inspecione página por página', 'Confirme a arte na página 1. Compare o contorno magenta em sobreimpressão com o logo na página 2. Na página 3, isole a chapa K e confira a máscara.']
        ],
        checagem: 'As páginas devem ter o mesmo formato e o mesmo registro. O PDF de teste foi inspecionado localmente. A homologação no RIP da gráfica segue pendente.'
      }
    ]
  },
  {
    id: 'calendarios', titulo: 'Calendários e cadernos', licoes: [
      {
        id: 'calendario-anual', titulo: 'Calendários de mesa, parede e bolso', ferramenta: 'illustrator/calendario-anual',
        uso: 'Monte um calendário de mesa de 2028, com rodapés mensais e reserva superior para Wire-o, em folhas SRA3.',
        dados: [['Formato final', '210 × 150 mm'], ['Folha e sangria', '320 × 450 mm · 3 mm'], ['Área segura', '5 mm de arte · 15 mm no topo']],
        passos: [
          ['Escolha o modelo e o ano', 'Abra Calendário anual. Use 2028 e Mesa · 14 páginas para este exemplo. A folhinha de parede agrupa os meses na parte inferior. O bolso usa duas faces e começa em 90 × 50 mm.'],
          ['Defina o formato e as reservas', 'Informe 210 × 150 mm de formato final e 320 × 450 mm de folha. Use sangria de 3 mm, margem de arte de 5 mm e reserva superior de 15 mm para o Wire-o.'],
          ['Escolha as fontes e cores', 'Experimente título de 24 pt, dias de 15 pt e rodapé de 8 pt. Informe cada cor em C M Y K, por exemplo 0 0 0 100. Escolha Contorno circular e Somente feriados para marcar apenas as datas cadastradas.'],
          ['Edite feriados e rodapés', 'Use uma linha DD/MM | Nome para cada data, como 19/03 | São José, se aplicável à localidade. Use MM | Nota para um texto mensal, como 03 | Atendemos por agendamento.'],
          ['Confira as faces e o encaixe', 'Gere e confira 29 de fevereiro, os rodapés e a guia superior. Em formatos compactos, reduza as fontes, aumente o formato ou selecione Somente destaque das datas se o rodapé não couber.']
        ],
        checagem: 'Calendários de mesa saem com capa, 12 meses e contracapa em ordem de leitura. A referência federal é editável. Confirme as datas locais antes de imprimir.'
      },
      {
        id: 'estruturas-calendario', titulo: 'Cavalete com trava, tenda e calendário de parede', ferramenta: 'illustrator/estruturas-calendario',
        uso: 'Monte uma base de 150 × 120 mm com trava sem cola e confira a faca antes de testar no cartão.',
        dados: [['Fundo e sobreposição', '58 mm · 10 mm'], ['Pescoço e fenda', '70 mm · 70,8 mm'], ['Planificação', '150 × 326 mm, antes da sangria']],
        passos: [
          ['Defina a base', 'Escolha Cavalete Wire-o, Trava sem cola e faces de 150 × 120 mm. Use fundo de 58 mm, sobreposição de 10 mm e cartão de 0,45 mm.'],
          ['Configure o encaixe', 'Use pescoço de 70 mm, lingueta de 18 mm, orelhas de 2,5 mm, folga de 0,8 mm e alívios de raio 0,9 mm. A lingueta integra o perímetro. Na outra aba, procure a fenda de 70,8 mm.'],
          ['Confira as camadas', 'Isole FACA_CORTE e FACA_VINCO para revisar o desenho técnico. Para imprimir a arte, oculte as duas camadas. Compare a orientação da fibra com os vincos e teste o passo de furação.'],
          ['Escolha outros formatos', 'Aba colada e Base dura empastada são opções do cavalete. A Tenda coloca seis meses de cada lado. A cartela gera um bloco separado. O pôster pode usar varão ou furo. No miolo Wire-o, selecione Versos tombados para a virada pelo topo.']
        ],
        checagem: 'Os furos do Wire-o são guias visuais. A trava e a dobra exigem prova no material final. O mapeamento das cores técnicas deve ser conferido no seu equipamento.'
      },
      {
        id: 'caderno-parametrico', titulo: 'Caderno A5 com pauta e margem de Wire-o', ferramenta: 'illustrator/caderno-parametrico',
        uso: 'Gere capa, contracapa e 40 páginas de miolo, com encadernação lateral espelhada no verso.',
        dados: [['Formato final', 'A5 · 148 × 210 mm'], ['Pauta', '7 mm · traço 0,5 pt'], ['Acabamento', '15 mm na lateral']],
        passos: [
          ['Escolha o miolo', 'Abra Caderno paramétrico, selecione Pautado e informe 40 páginas. Ative capa, contracapa e numeração. Digite o título e um rodapé, como Oficina gráfica.'],
          ['Defina a área segura', 'Informe 148 × 210 mm, margem de arte de 8 mm, acabamento na esquerda e reserva de 15 mm. Marque Espelhar a lateral no verso. Se houver folha de máquina, digite seu tamanho nos dois campos.'],
          ['Ajuste o estilo', 'Escolha as fontes do título e do rodapé, suas cores CMYK e um destaque para o cabeçalho. Digite intervalo de 7 mm e traço de 0,5 pt. Também há miolo quadriculado, pontilhado ou livre.'],
          ['Confira duas faces consecutivas', 'As faces saem em ordem de leitura. Confira se a pauta termina antes do rodapé e se a reserva de encadernação muda de lado no verso.']
        ],
        checagem: 'O exemplo gera 42 pranchetas. As guias de corte, sangria, arte e acabamento ficam em camada técnica. Para a planificação da capa dura, use Lombada e capa dura em Gabaritos.'
      }
    ]
  },
  {
    id: 'producao', titulo: 'Fluxos de produção', licoes: [
      {
        id: 'imposicao-sra3', titulo: 'Imposição de cartões em SRA3', ferramenta: 'web/montagem',
        uso: 'Monte cartões de 90 × 50 mm em folha 320 × 450 mm, com refile duplo e reserva de pinça.',
        dados: [['Peça e sangria', '90 × 50 mm · 3 mm'], ['Folha', 'SRA3 · 320 × 450 mm'], ['Saída esperada no CEP', '21 poses · 3 × 7']],
        passos: [
          ['Monte o cenário', 'Na aba Imposição do painel Illustrator, informe 320 × 450 mm para a folha, 90 × 50 mm para a peça e sangria de 3 mm.'],
          ['Reserve espaço de máquina', 'Configure margem técnica de 5 mm e pinça inferior de 12 mm. Selecione corte duplo e refile com folga extra de 0 mm. Confira a prévia de 21 poses.'],
          ['Gere e confira', 'Para testar a geometria, escolha Novo CMYK · Modelo com marcas técnicas. Para trabalhar com arte existente, use a opção de repetição de arte vinculada e confirme a caixa de sangria do arquivo.']
        ],
        checagem: 'No exemplo, a arte acabada ocupa 65,63% da folha. O app Montagem e virada abre no navegador. Execute a geração vetorial pela aba Imposição do Illustrator.'
      },
      {
        id: 'impressao-e-corte', titulo: 'Impressão e corte com faca alinhada', ferramenta: 'illustrator/impressao-e-corte',
        uso: 'Prepare oito adesivos de 90 × 50 mm em uma folha SRA3 e confira a faca no software da plotter.',
        dados: [['Grade', '2 colunas × 4 linhas'], ['Sangria', '2 mm'], ['Arquivos', 'IMPRESSAO.pdf · FACA.pdf · CORTE.plt']],
        passos: [
          ['Separe a arte e a faca', 'Abra um documento CMYK. Agrupe a arte já sangrada com 2 mm. Selecione a arte e o traçado fechado separado, nomeado FACA ou CutContour.'],
          ['Configure a folha e a leitura', 'Abra Montagem para impressão e corte. Informe 320 × 450 mm, margem 10 mm, grade 2 × 4 e intervalo 4 mm. Escolha Arte já sangrada. Use a origem e o padrão de marcas do seu equipamento. Para pontos redondos, escolha Círculos sólidos e informe o diâmetro. O padrão inicial é 5 mm.'],
          ['Valide os três arquivos', 'Clique em Gerar arquivos e selecione a pasta de saída. Compare a arte e a faca nos dois PDFs. Importe CORTE.plt a 100% e confira orientação, origem e medida antes da leitura óptica.']
        ],
        checagem: 'A arte e a faca compartilham as posições. A passagem em máquina depende da origem e do padrão de marcas aceitos pela plotter.'
      }
    ]
  }
];
