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
- **Marcas ópticas** oferece cantoneiras em L ou quadrados sólidos em K100, com medida, recuo e zona livre configuráveis. Ajuste esses valores e o padrão no software da sua máquina. [Manual de marcas ópticas da Graphtec](https://www.graphtecamerica.com/s/FC8600-User-Manual.pdf)

A ferramenta preserva o documento de origem e abre um mestre CMYK com duas pranchetas do mesmo formato. Na pasta de saída, grava `IMPRESSAO.pdf` com arte, sangria e marcas ópticas, `FACA.pdf` com o traçado em cor especial e sobreimpressão, e `CORTE.plt` com os mesmos contornos. O PDF de faca preserva as curvas Bézier. O PLT aproxima as curvas em segmentos com tolerância de 0,025 mm antes da quantização em 40 unidades por mm. [Referência de unidades HP-GL da HP](https://www.hp.com/ctg/Manual/bpl13211.pdf)

| Origem do PLT | Coordenadas |
| --- | --- |
| Canto inferior esquerdo da folha | X para a direita, Y para cima |
| Marca superior esquerda | X para a direita, Y para baixo. A referência é o vértice externo da cantoneira ou do quadrado |

Importe o PLT a 100% e confira o sentido dos eixos e a origem na prévia do software de corte. A leitura automática das marcas e a passagem em máquina dependem do equipamento e do perfil configurado.

Consulte também [design.md](design.md).
