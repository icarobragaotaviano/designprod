# Fluxos de produção gráfica

A página inicial reúne as ferramentas nas categorias **Online** e **Desktop**. As calculadoras seguem o [DESIGN.MD](../DESIGN.md). Cada app guarda os recursos de cálculo no dispositivo depois da primeira visita e da ativação do service worker. Os scripts são baixados pelo catálogo ou pelo resultado da ferramenta correspondente.

| Frente | O que está disponível | Conferência de produção |
|---|---|---|
| 1. Auditoria | JSX e VBA para cores, sobreimpressão, filetes, textos e imagens. O VBA percorre grupos e PowerClips. Correções disponíveis para branco em sobreimpressão e texto pequeno em preto composto. | O Illustrator sinaliza resolução de raster e vínculos para inspeção manual. Revisar cor Registro em separações. |
| 2. Preto e TAC | Presets de preto, teto ajustável de tinta, amostra CMYK e verificação de cobertura nas macros. | Homologar a receita e o ICC de destino. A soma nominal CMYK não substitui a medição das separações. |
| 3. Fechamento | Plano PDF/X, estilos nativos de CorelDRAW e Illustrator e exportação em cópia. W2P permite texto em curvas e saída sem marcas. | O Illustrator pode intercalar máscaras vetoriais K100 das camadas MASCARA_FRENTE e MASCARA_VERSO numa cópia CMYK. Escolha a predefinição PDF/X aprovada. A validação de PDF/X, OCG ISO 19593-1 e OutputIntent é feita no PDF final. |
| 4. Photoshop | Gerador UXP para abrir lotes, aplicar ICC, definir resolução, achatar e salvar JPEG CMYK em `_PREPRESS_OK`. | Instalar o ICC e testar uma amostra do lote. A intenção usa o tipo de conteúdo escolhido no formulário. |
| 5. Aproveitamento | T4, T8, SRA3, duas folhas-mãe, rotação, calha, pinça, fibra, folha líquida e estimativa de cliques. | Conferir a equivalência de cliques, a disponibilidade da laminadora e o registro frente e verso na máquina selecionada. |
| 6. Chapa coletiva | Imposição por faixas guilhotináveis para 2–8 itens, excedentes, sequência de corte e SVG. | O resultado é a melhor grade entre as combinações testadas. Conferir a sequência e a compatibilidade antes de rodar. |
| 7. Dobras e editorial | Carteira, sanfona, janela e cruzada, mapa de vinco, folhas em branco, estimativas de lombada e creep e tabela de anéis. | Calibrar espessura, capacidade do anel, cola e sinal do shingling no Preps 9. Exportação SVG, JSON e gabaritos nativos para CorelDRAW e Illustrator. |
| 8. Numeração e códigos | CSV cut-and-stack por pilha e via, QR e Code 128 B em SVG ou PDF K100. | Conferir a pilha após o corte. Testar leitura dos códigos no tamanho final. |
| 9. Painelamento | Comparativo vertical e horizontal, emendas com deslocamento, consumo e mapa numerado. | Deslocar as emendas ao conferir o mapa com a arte. Exportar as faixas no editor. |
| 10. Lona | Escala, resolução estimada por distância, virada, bainha, bolsa e ilhós simétricos. | Homologar resolução e folgas com o RIP e o acabamento. |
| 11. Branco UV | Orientação, pilha de impressão e base retangular em tinta especial. O JSX de camada técnica duplica a silhueta selecionada e pode recuar polígonos convexos. | Conferir o perfil do RIP e aplicar choke sobre a silhueta para geometrias livres. |
| 12. Corte | Conferência de traçados abertos, duplicatas exatas e menor dimensão para fresa no Illustrator, com preparo separado de camada de meio-corte, corte total ou vinco. O VectorCraft continua com sua auditoria própria. | O JSX aplica offset em polígonos convexos e preserva as curvas quando o offset é zero. O exportador do Illustrator preserva Béziers em SVG ou usa tolerância de 0,025 mm no DXF. A saída retira contornos idênticos e segmentos de comprimento zero. PLT segue no editor. |
| 13. Triagem | Seleção de bloqueadores e alertas, pontuação e mensagem de ajuste para o cliente. | Registrar só os achados efetivamente conferidos no arquivo enviado. |
| 14. OS | Formulário com nome do arquivo, aprovação, ficha imprimível e passaporte JSON/HTML. | A ficha carrega os valores definidos pelo operador. |
| 15. Custos | Quebra encadeada por etapa, custo digital/offset, primeira tiragem com menor custo offset e mídia com insumos. | A comparação usa os valores da gráfica e apresenta o primeiro cruzamento, pois o rendimento causa degraus. |
| 16. Pastas | PowerShell com perfil OS e Estúdio, passaporte HTML e lançador BAT. | Mantenha PS1 e BAT na mesma pasta. Os espaços reservados de Estúdio usam a extensão `.placeholder.txt` para indicar onde salvar o arquivo editável real. |

Teste a primeira peça no equipamento de destino. Os testes automatizados cobrem geometria, quebra, preços, codificação e geração dos catálogos. A confirmação em CorelDRAW, Illustrator, Photoshop, Preps e no RIP depende das versões e dos perfis instalados.

## Instalação dos scripts

- **CorelDRAW Windows.** Importe o BAS no editor VBA. Execute `AuditarArte`, `CorrigirBrancoSelecionado`, `PretoPuroEmTextosSelecionados` ou `FecharPDF`.
- **Illustrator.** Abra o JSX por Arquivo → Scripts → Outro script. Para o exportador PDF, salve o mestre em AI e tenha uma predefinição aprovada pelo fornecedor.
- **Photoshop.** Escolha o perfil no app Preparar Lote de Imagens e execute o PSJS gerado pelo menu Arquivo → Scripts. O script escreve cópias e o relatório na subpasta `_PREPRESS_OK`.
- **Windows.** Abra o lançador BAT com o PowerShell correspondente ao lado. Para OS, baixe primeiro o passaporte JSON do catálogo e informe seu caminho no prompt.

## Imposição de arte e corte

Em **Desktop**, busque **Imposição de arte e corte** e escolha o editor. Baixe o arquivo pelo catálogo para obter o script autônomo. Abra a arte, selecione uma peça e execute a versão correspondente.

| Editor | Execução | Seleção e contorno |
| --- | --- | --- |
| Illustrator | Execute o `.jsx` em Arquivo → Scripts → Outro script. | Traçado simples fechado para extrair a faca. O modo retangular aceita uma arte ou grupo. O deslocamento do traçado é calculado para polígonos convexos de lados retos. |
| CorelDRAW para Windows | Importe o `.bas` em um projeto VBA e execute `MontarArteEFaca`. | Converta o contorno em curva fechada simples ou use a faca retangular para a seleção. O deslocamento usa o contorno nativo. |
| Affinity | Execute o `.js` na edição com suporte a scripts. Trabalhe em um documento com pranchetas. | Selecione um objeto convertido em curvas. A cópia mantém a geometria e o estilo vetorial básico. Para a faca vetorial, use um traçado fechado simples. O deslocamento do traçado é calculado para polígonos convexos de lados retos. |
| VectorCraft | Execute o `.js` pelo menu de scripts. | Use uma curva fechada simples para a faca vetorial ou escolha o modo retangular. O deslocamento usa Offset Path. |
| TraceDraw | Carregue o `.js` como plug-in de script e execute **Montar arte e faca**. | Use uma curva fechada simples ou a faca retangular. O deslocamento usa o contorno nativo. |

O formato inicial é **T4 (328 × 478 mm)**. Para T8, informe **238 × 328 mm**. Use o intervalo entre peças e a margem da folha em milímetros. Informe a quantidade manual ou `0` para preencher a grade na orientação atual. Se a capacidade superar 500, informe uma quantidade manual de até 500. A faca sai com traço vermelho de 0,25 pt e sem preenchimento. Use deslocamento positivo para fora e negativo para dentro. Com deslocamento zero, o traçado curvo mantém sua geometria. Para uma faca retangular, o deslocamento é aplicado aos quatro lados da caixa.

**ARTE** e **FACA** têm o mesmo tamanho e as mesmas coordenadas locais. Quando você ativa as cruzes, há quatro em cada folha e a margem mínima é de 8 mm. São referências visuais de registro. Use as marcas do equipamento quando o seu plotter exigir leitura óptica. Exporte as duas saídas em escala 1:1. Aplique o nome da cor especial de corte exigido pelo RIP quando o fluxo usar uma tinta técnica.
