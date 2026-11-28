# Folha no DesignProd

A Bancada Nobel, os painéis Adobe e o comando de terminal usam o motor em `core/producao/folha/`. O ponto de partida foi a cópia já distribuída pelo DesignProd, de blob `5fd54fe928c9897275ee62c74a4bd42ce469f2db`, comparada com a `main` do [Folha em `50ead7c`](https://github.com/icarobragaotaviano/ibd-folha/commit/50ead7c62dc7cc95995a6beb32918dfe4e8f46e7). A cópia pública já preservava a busca de corte misto em folhas com mais de 700 posições. O contrato mantém o bloqueio de edição e informa a capacidade calculada nesses casos.

## Operações

| ID | Recursos | Mini app da Bancada |
|---|---|---|
| `montar-pecas` | Grade simples ou mista, viradas, sangria, fibra, CTP, tiragem, métricas, acabamentos e edições por SKU | Montagem e virada |
| `planejar-cadernos` | F4-1, F8-1, F16-1 e 2-up, ordem de páginas, brancos, creep e lombada | Cadernos e lombada |
| `planejar-lona` | Formato de corte, panos, emenda, bainha, bolsas e ilhós | Lona e ilhós |
| `avaliar-orientacoes` | Comparação de retrato, paisagem e corte misto, com seleção de estratégia | Montagem rápida |
| `comparar-folhas` | Até oito formatos em escala proporcional | Comparar folhas |
| `sugerir-folhas` | Ranking por tamanho da peça, família, margem, rendimento e folhas personalizadas | Escolher folha |

O painelamento de produção de **Lona e ilhós** usa o cálculo de panos já existente da Bancada, com as margens informadas. O formato de corte e os ilhós vêm do Folha. Ao comparar saídas, confira qual cálculo produziu o plano de panos.

## Contrato versão 1

Execute `node tools/folha.mjs < pedido.json` em um shell com redirecionamento de entrada. No PowerShell, use `Get-Content -Raw pedido.json | node tools/folha.mjs`.

```json
{
  "versaoContrato": 1,
  "operacao": "montar-pecas",
  "parametros": {"sw": 328, "sh": 478, "pw": 90, "ph": 50, "qty": 1000}
}
```

`parametros` recebe chaves do motor, com os valores omitidos preenchidos por seus padrões. A ordem usa coordenadas de folha em milímetros, com origem no canto superior esquerdo e Y crescente para baixo. As posições de montagem incluem ID, tamanho, ângulo, face e SKU. Para montagem de peças, `faces` devolve as posições por face ou forma única com suas guias. Em todas as operações, `resultado` preserva os campos do motor, `diagnosticos` descreve erros e avisos e `materializavel` indica se há geometria válida para o modo. O comando devolve código 1 quando houver erro de validação ou execução.

O plano exportado contém os parâmetros efetivos e a revisão do motor. O consumidor importa a operação e seus parâmetros e os recalcula antes de agir no editor. A revisão no arquivo identifica o motor que gerou a prova original. Para reproduzir a saída byte a byte, use a revisão original do motor.

## Adaptadores e conferência

- **Bancada Nobel.** Abra a ferramenta pelo catálogo. Em Escolher folha, aplique a sugestão em Montagem e virada. Use a exportação do plano na montagem para abrir a mesma geometria em um editor compatível.
- **Illustrator CEP.** Abra a aba **Imposição** do painel para calcular ou importar um plano. A saída permite gerar um modelo CMYK, repetir arte vinculada ou criar uma prova geométrica no documento aberto. A prova aceita as faces de um plano de frente e verso. O cálculo direto exige um runtime CEP que execute os módulos JavaScript atuais.
- **InDesign UXP.** Calcule ou importe a operação editorial. A prova cria um documento novo, com página por face e quadros técnicos rotulados por página, rotação e creep. A prova pode ser conferida sem alterar o documento ativo.
- **Photoshop UXP.** Calcule, confira e troque arquivos JSON de plano no painel. A aplicação em camadas é uma etapa posterior.

Instalação e uso dos painéis seguem os empacotadores existentes. As verificações automatizadas cobrem o contrato, a paridade com o cálculo direto, os fluxos da Bancada, os pacotes e as pontes com hosts simulados. Para liberar produção, conferir um caso real de cada painel na versão de editor utilizada e medir arte, pranchetas, registro e dobras. A homologação física e a conferência de separações no RIP fazem parte da validação de produção.

## Imposição para produção no Illustrator

1. Escolha a folha (T4, T8, SRA3, 660 × 960 mm ou outro formato), o tamanho final, a sangria e a tiragem. Configure a margem técnica e a pinça. A reserva de pinça soma-se à margem técnica na borda escolhida.
2. Selecione a orientação e o refile. No **corte duplo**, cada peça mantém a própria sangria. Com sangria de 3 mm e folga extra de 0 mm, há 6 mm entre linhas de corte. No **corte simples**, a grade é uniforme, o corte é compartilhado e a sangria fica no perímetro do conjunto. Informe a fibra da folha e o eixo do vinco para restringir as rotações.
3. Calcule e confira a prévia. As poses e as marcas usam as mesmas coordenadas em milímetros. O painel mostra o aproveitamento da folha inteira e da área útil. Em corte misto, as marcas periféricas identificam posições de refile e a sequência depende do arranjo.
4. Escolha **Novo CMYK · Modelo com marcas técnicas** para obter a prancheta de máquina com guias de montagem em uma camada não imprimível. Escolha **Novo CMYK · Repetir arte vinculada** para usar uma arte compatível com todas as poses de uma frente. A opção **Documento aberto · Repetir objeto selecionado** usa o objeto ou grupo selecionado com tamanho de corte.
5. Para PDF ou AI com compatibilidade PDF, o posicionamento usa a primeira página e solicita ao Illustrator a TrimBox ou a BleedBox, conforme a opção de arte sangrada. Em EPS, a caixa reportada pelo Illustrator deve corresponder ao tamanho esperado. A sangria de entrada deve ser simétrica. Se houver divergência acima de 0,05 mm, a montagem vinculada é interrompida sem redimensionar a arte. Em corte simples, as máscaras retêm sangria nas bordas externas do bloco e recortam os excessos internos. Mantenha o arquivo de origem acessível ao transportar o documento de imposição.

As marcas periféricas têm traço configurável de 0,25 a 0,5 pt. O painel ajusta o afastamento para manter o traço fora da sangria e indica quando uma linha de corte ficou sem marca. A camada técnica usa o Registro nativo para marcas, miras e identificação. A barra de controle fica na margem imprimível, com 14 patches CMYK de dimensão configurável. Inclui sólidos, campos de 50%, sobreposições e um campo C50 M40 Y40 de referência. Use os alvos da sua condição de impressão para avaliar os campos no instrumento.

**Conferência SRA3.** Uma folha 320 × 450 mm, com peça 90 × 50 mm, sangria de 3 mm, margem técnica de 5 mm e pinça inferior de 12 mm, rende **21 poses em corte duplo (3 × 7, 65,63% da folha)**. O corte simples rende **24 poses (6 × 4, 75% da folha)**. Na conferência em produção, meça o formato e a pinça, confirme os vínculos e inspecione a cor de Registro, os patches e as separações do PDF exportado.

### Separações do PDF de imposição

Conferência local em 25/11/2026 com Illustrator 2027 (31.0) e Acrobat Pro. A prova SRA3 usa uma arte sintética de 90 × 50 mm com sangria de 3 mm, um campo de magenta e uma tinta especial chamada `IBD_Teste_Verde`. Na região de sobreposição, a tinta especial tem sobreimpressão ativa.

| Prova | Resultado da inspeção do PDF |
| --- | --- |
| Arte vinculada em corte duplo | 21 poses, tinta especial com nome próprio e sobreimpressão preservada |
| Arte vinculada em corte simples | 24 poses rotacionadas, mesma tinta especial e sobreimpressão preservada |
| Marcas e barra | Marcas de corte, miras e OS usam Registro (`/Separation /All`). Os 14 patches de 5 × 5 mm preservam seus valores CMYK |
| Modelo de montagem | As guias ficam ocultas no estado inicial do PDF com camadas. Ao desativar **Criar camadas do Acrobat a partir das camadas de nível superior**, a exportação exclui os traços das guias e mantém as marcas e a barra |

Na exportação de teste, a conversão de cores e a edição no Illustrator foram desativadas. A Visualização de saída do Acrobat confirmou visualmente a sobreimpressão no caso de corte duplo. [Documentação do Acrobat sobre Visualização de saída](https://helpx.adobe.com/acrobat/using/previewing-output-acrobat-pro.html)

A homologação no RIP da gráfica segue pendente. Na fila de prova, use a configuração de produção prevista para o trabalho. Confira quatro separações CMYK e uma separação `IBD_Teste_Verde`. As marcas de Registro devem aparecer nas cinco, e os patches da barra devem aparecer nos canais CMYK correspondentes. Na área sobreposta, confira a presença simultânea de magenta e tinta especial. Use o preset de PDF e os parâmetros de retícula da gráfica para a validação final.

## Impressão e corte no Illustrator

Abra um documento CMYK. Selecione a arte ou o grupo de impressão. Para uma faca personalizada, selecione também o traçado fechado ou composto, separado da arte, e identifique-o como `FACA` ou `CutContour`. Com apenas a arte selecionada, a ferramenta usa uma faca retangular.

No painel **IBD Ferramentas → Ferramentas**, procure **Montagem para impressão e corte**. Informe o formato da folha, a margem e a grade. Use zero em colunas ou linhas para o cálculo automático daquele eixo. A reserva das marcas ópticas pode aumentar a margem efetiva.

- **Estender fundo vetorial** aplica Offset Path sob a arte. Em um grupo, o fundo deve ser um único traçado vetorial chamado `Fundo`, preenchido, fechado e alinhado ao contorno da faca. Confira visualmente a cobertura da sangria em toda a peça.
- **Arte já sangrada** usa a sangria existente. Para faca retangular, o corte recua o valor informado nos quatro lados. Para faca personalizada, selecione o traçado no tamanho final.
- **Marcas ópticas** oferece cantoneiras em L, quadrados sólidos ou círculos sólidos em K100, com medida, recuo e zona livre configuráveis. Ajuste esses valores e o padrão no software da sua máquina. [Manual de marcas ópticas da Graphtec](https://www.graphtecamerica.com/s/FC8600-User-Manual.pdf)

A ferramenta preserva o documento de origem e abre um mestre CMYK com duas pranchetas do mesmo formato. Na pasta de saída, grava `IMPRESSAO.pdf` com arte, sangria e marcas ópticas, `FACA.pdf` com o traçado em cor especial e sobreimpressão, e `CORTE.plt` com os mesmos contornos. O PDF de faca preserva as curvas Bézier. O PLT aproxima as curvas em segmentos com tolerância de 0,025 mm antes da quantização em 40 unidades por mm. [Referência de unidades HP-GL da HP](https://www.hp.com/ctg/Manual/bpl13211.pdf)

| Origem do PLT | Coordenadas |
| --- | --- |
| Canto inferior esquerdo da folha | X para a direita, Y para cima |
| Marca superior esquerda | X para a direita, Y para baixo. A referência é o vértice externo da cantoneira ou do quadrado e o centro do círculo |

Importe o PLT a 100% e confira o sentido dos eixos e a origem na prévia do software de corte. A leitura automática das marcas e a passagem em máquina dependem do equipamento e do perfil configurado.

Consulte também [design.md](design.md).

## Suíte de pré-impressão para Illustrator

Abra **IBD Ferramentas → Ferramentas** e procure pelo nome do módulo. Cada script também pode ser executado por **Arquivo → Scripts → Outro script** usando o arquivo JSX independente.

| Ferramenta | Operações |
| --- | --- |
| Gabaritos de pré-impressão | Retângulo da prancheta no corte ou na sangria, lote de pranchetas, lombada e capa dura com canaletas e vira, guia de Wire-o e espiral |
| Preflight express | Conversão de preto composto para K100 em textos abaixo de 24 pt, códigos de barras identificados e traços finos, com sobreimpressão. Conversão de tipografia em curvas em uma cópia AI |
| Marcas externas de corte e vinco | Marcas de corte e testemunhas tracejadas fora da sangria. Prancheta expandida para exportação da folha de máquina |
| Enobrecimento e prova de registro | Máscara vetorial em `Verniz_UV` ou `Hot_Stamp` com sobreimpressão. PDF de três páginas a partir da prancheta ativa |
| Calendário anual | Mesa com capa, 12 meses e contracapa em 14 faces, folhinha de parede com bloco inferior e cartão de bolso de 90 × 50 mm em duas faces |

- **Capa dura.** Informe as medidas dos papelões e o caliper medido. Com o campo vazio, a gramatura e o papel fornecem uma estimativa. A lombada calcula uma folha para cada duas páginas, arredondando para cima. Meça o miolo encadernado para definir a lombada de produção. As linhas da faca externa, das canaletas e dos papelões ficam em camadas técnicas não imprimíveis.
- **Higienização.** O detector atua em preto composto com as quatro tintas, K de pelo menos 80% e diferença de até 35 pontos percentuais entre C, M e Y. Identifique códigos de barras vetoriais pelo nome do objeto ou do grupo, como `Código de barras`, `Barcode` ou `EAN`. A análise oferece o documento ou a seleção e pede confirmação antes de editar.
- **Curvas.** Informe um nome novo para a cópia. O Illustrator abre a cópia como documento ativo, converte também caixas em camadas ocultas e bloqueadas e restaura esses estados. Confira caixas encadeadas ou com texto que exceda a área antes da conversão.
- **Marcas.** Informe a sangria real. O script eleva o afastamento quando necessário para que o traço de 0,35 pt fique fora da sangria. Os vincos usam distâncias desde o topo esquerdo da peça. Use ponto e vírgula para listar posições. Exporte a prancheta **FOLHA DE MÁQUINA** para incluir as marcas.
- **Enobrecimento.** Selecione caminhos fechados, compostos ou grupos desses vetores. A preparação transfere a seleção para a camada técnica superior. Trabalhe em documento CMYK e incorpore imagens CMYK que precisem entrar na arte. O exportador verifica a prancheta ativa e a camada do acabamento informado. O PDF contém arte de processo, arte com contorno magenta de 0,5 pt em sobreimpressão e preenchimento vetorial K100. Confira sobreimpressão e separações no RIP antes de gravar o clichê.
- **Calendários.** A semana começa no domingo. A versão de mesa oferece 15 mm como reserva inicial de furação e gera 14 faces em ordem de leitura. Mesa, parede e bolso aceitam medidas personalizadas e tipografia editável.
- **Cadernos.** O script Caderno paramétrico gera miolo pautado, quadriculado, pontilhado ou livre. Configure título, rodapé, numeração, pauta e cores. A capa e a contracapa são opcionais. Na encadernação lateral, a reserva pode passar para a borda oposta nas faces de verso.

### Formato, margens e feriados

Em Calendário anual ou Caderno paramétrico, informe o corte final e a sangria. Ao preencher largura e altura da folha, a peça é centralizada na folha de máquina. Com os campos vazios, a prancheta usa o formato mais a sangria solicitada. A margem de arte vale para os quatro lados. Na borda de acabamento, vale o maior recuo entre a margem da arte e a reserva de acabamento. As guias ficam em camada não imprimível. Cada face usa uma prancheta.

As fontes são selecionadas entre as disponíveis no Illustrator. Informe os tamanhos em pontos e as porcentagens CMYK separadas por espaços. O documento mantém os tamanhos solicitados e sinaliza se o texto exceder a área segura.

No calendário, o editor aceita `DD/MM | Nome do feriado` ou `MM | Texto do rodapé`, uma entrada por linha. A lista federal serve como ponto de partida editável. Confira as datas estaduais, municipais e específicas do ano do trabalho. Em tamanhos reduzidos, a opção Somente destaque das datas mantém as marcações e oculta os textos do rodapé. [Referência federal de feriados](https://legis.sigepe.gov.br/legis/detalhar/25014)

Abra os exemplos de [calendário](https://designprod.vercel.app/tutoriais/#calendario-anual), [caderno](https://designprod.vercel.app/tutoriais/#caderno-parametrico) e [capa dura](https://designprod.vercel.app/tutoriais/#lombada-e-capa-dura).


## Estruturas de calendário no Illustrator

Abra **Estruturas de calendário** na vitrine e execute o JSX no Illustrator. Use o modo **Calendário anual** para trabalhar tipografia, rodapés e feriados. O modo estrutural gera a planificação com os meses básicos editáveis quando a peça recebe as datas.

| Modelo | Saída |
| --- | --- |
| Cavalete Wire-o | Aba de colagem com três vincos, trava com lingueta e fenda, ou papelão com três placas, canaletas e vira. A furação aparece em prévia |
| Tenda autoportante | Uma peça planificada com janeiro a junho em uma face e julho a dezembro na outra, orientados para a dobra |
| Cartela e bloco destacável | Cartela com furo de 4 a 6 mm e área de fixação. Bloco de 12 páginas em documento separado com guia de microsserrilha e spot `Serrilha` opcional |
| Pôster de folha única | Calendário anual com escolha de furo central ou varão, com altura da reserva ajustável |
| Miolo Wire-o | Capa, 12 meses e contracapa em 14 faces. O modo tombado gira as faces pares em 180° e move a reserva de furação para o pé dessas pranchetas |

**Exemplo.** Faces de 150 × 120 mm, fundo de 58 mm, sobreposição de 10 mm, lingueta de 18 mm, pescoço de 70 mm, orelhas de 2,5 mm, folga de 0,8 mm e alívios de raio 0,9 mm. A planificação com trava mede 150 × 326 mm e a fenda tem comprimento total de 70,8 mm. Com a aba colada de 22 mm, mede 150 × 320 mm. Para papelão de 1,9 mm, canaletas de 3,5 mm e vira de 18 mm, o forro mede 186 × 341 mm. O ângulo é calculado para um prisma simétrico. Com fundo de 58 mm, é de cerca de 76°. Faça uma amostra no cartão real para conferir estabilidade, trava e fibra.

**Saídas.** A opção 0×0 gera o desenho técnico sem arte. A base impressa inclui fundo inicial CMYK com 3 mm de sangria. Para exportar a impressão, oculte as camadas técnicas de faca e serrilha. Em `FACA_CORTE`, o perímetro e a fenda são caminhos fechados em `Corte`. Em `FACA_VINCO`, os vincos usam a spot `Vinco` com traço de 0,5 pt em sobreimpressão. Para corte digital, confira como o equipamento identifica camada, spot e linha tracejada. Em cartonagem, exporte os papelões separadamente do forro, a partir da camada `PAPELOES · corte separado`. As guias e os furos simulados não são imprimíveis.

## Livretos, frente e verso e organização no Illustrator

### Imposição de livretos

1. Abra a arte CMYK com uma prancheta por página na ordem de leitura. Use o mesmo formato final em todas as páginas. Com sangria de 3 mm, deixe pelo menos 6 mm entre pranchetas.
2. No painel IBD Ferramentas, abra **Imposição → Imposição de livretos**. Informe o intervalo de pranchetas, a folha de máquina, a margem, a sangria e a virada da impressora.
3. Clique em **Gerar imposição**. A montagem para grampo canoa é criada em um novo documento com uma prancheta por face de folha. Um livreto de oito páginas com virada lateral sai como `8 | 1` e `2 | 7` na primeira folha e `6 | 3` e `4 | 5` na segunda. Com seis páginas, as posições 7 e 8 ficam em branco.

### Imposição frente e verso

1. Coloque frente e verso em pranchetas consecutivas. Por exemplo, pranchetas 1 e 2 são o primeiro cartão, e 3 e 4 são o segundo cartão.
2. Abra **Imposição → Frente e verso**. Escolha a folha e a virada. Para uma grade de seis cartões de 90 × 50 mm em SRA3, informe 3 colunas e 2 linhas. Use 0 em qualquer eixo para preencher a capacidade disponível.
3. Confira as pranchetas de frente e verso do novo documento. Na virada lateral, o verso troca de lado na folha. Na virada pelo topo, a posição muda no eixo vertical e a arte do verso gira 180°. A última frente fica com verso em branco se o intervalo tiver quantidade ímpar.
4. Imprima uma folha de prova em escala real e confira a virada e o encontro das marcas antes da tiragem.

### Organizar camadas e pranchetas

1. Abra **Ferramentas → Organizar camadas e pranchetas**. Use **Separar objetos por tipo** para distribuir objetos em subcamadas de texto, imagens incorporadas, vínculos e elementos gráficos. Grupos com tipos diferentes ficam juntos, inclusive quando contêm máscaras.
2. A mesma categoria pode aparecer em mais de uma subcamada para manter a ordem visual. Camadas técnicas, protegidas ou não imprimíveis e ramos com objetos diretos intercalados com subcamadas são preservados.
3. Use uma operação de renomeação para definir seu modelo e conferir a prévia. `{n} · {nome}` gera, por exemplo, `01 · Capa`. Em pranchetas, `OS-3621_{n}_{largura}x{altura}` gera `OS-3621_01_90x50`. Escolha a quantidade de dígitos, a capitalização e o separador de espaços.

## Retângulo da prancheta e Preflight digital

### Retângulo da prancheta em um clique

1. Ative a prancheta desejada. Em um documento com várias pranchetas, clique na área da peça ou selecione-a no painel Pranchetas.
2. No **IBD Ferramentas → Ferramentas**, clique em **Retângulo da prancheta**. Uma prancheta de 90 × 50 mm recebe um caminho editável de 90 × 50 mm, sobre as quatro bordas do corte.
3. O caminho fica na camada **Forma · TrimBox**, com traço preto de 0,5 pt e sem preenchimento. Para um fundo chapado ou um caminho incluindo sangria, use **Gabaritos de pré-impressão → Forma na prancheta**.

### Auditar um trabalho híbrido

1. Em **Ferramentas → Preflight digital**, escolha o equipamento, o substrato e a saída. Para uma apostila com capa colorida e miolo preto, escolha **Híbrido** e informe `1-2` se as duas primeiras pranchetas forem coloridas.
2. Ajuste os limites da bandeja, medidas de folha, sangria, segurança e TAC. As medidas do C4080 correspondem à bandeja com suporte a 330,2 × 487,7 mm. Informe as medidas de acordo com a bandeja e a configuração da gráfica. Os presets sem modelo específico partem de medidas em branco.
3. Clique em **Auditar documento**. Selecione a ocorrência e use **Localizar** para aproximar a área. **Criar guias** desenha referências em uma camada não imprimível.
4. Em **Escolher correções**, marque somente os ajustes desejados. O cinza é aplicado a textos e vetores editáveis que aparecem somente nas páginas P&B. Imagens, cores especiais e arquivos fechados vinculados pedem conferência própria.
5. Salve o AI e use **Fechar PDF/X**. Escolha um preset instalado e aprovado para seu RIP, com `PDF/X-4` ou `PDF/X-1a` no nome conforme a saída escolhida. O preset define o *Output Intent*. Depois da exportação, o relatório acompanha o PDF com o mapa estimado de cliques e as ocorrências.

O preflight verifica cores e geometria expostas pelo Illustrator. O PPI é medido em JPEG vinculado. Gradientes, imagens de outros tipos, arquivos vinculados fechados e aparências complexas podem exigir conferência no PDF. O contador real de cliques, a validação de conformidade PDF/X e as separações de quinta cor devem ser conferidos no RIP ou no Acrobat Preflight.
