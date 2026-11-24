# Especificação de bancada e homologação

## Produtos e adaptadores

| Destino | Implementação prevista | Primeira evidência de funcionamento |
|---|---|---|
| CorelDRAW Windows | Barra Nobel VBA/GMS. Abrir OS pelo CDR, aplicar página e gabarito, montar seleção, numerar, criar camadas de faca/verniz e exportar por item | CDR editável preservado e PDF do calendário 210 × 150 mm medido na saída |
| Illustrator | Estender JSX de guias e exportação de pranchetas. Aplicar plano do Folha com conversão de origem e rotação | Duas pranchetas com origens distintas exportadas com revisão e item corretos |
| TraceDraw | JavaScript no painel de scripts; empacotar os comandos homologados como plugin de menu. Criar cotas, margens e paginação | Comparar a mesma peça em escala 1:1; reabrir o mestre para verificar texto e curvas |
| VectorCraft | Filtro WebAssembly para caminhos abertos, duplicados e dimensões; depois exportador dedicado para recorte | Medir contorno assimétrico e conferir orientação e fechamento na plotter |
| Photoshop | Aproveitar JSX, ações e painel UXP. Edição de ofertas, auto layout, remendos e exportação por camada | Rever um preço e gerar provas sem alterar os outros SKUs; validar fonte e renderização no editor |
| PhotoCraft | Inspeção e processamento em lote pela CLI do desktop, com modelos PSD em camadas | Conferir texto, máscara, transparência, objeto inteligente e dimensões com a prova aprovada |
| Kodak Preps | Templates T4/T8 com SmartMarks, identificação de OS/item e referência de virada. Avaliar JDF em etapa posterior | Imprimir, dobrar e conferir o boneco antes de aprovar cada caderno |

O DesignProd tem código Adobe em diferentes branches. Referências para portar com rastreabilidade: [main analisada](https://github.com/icarobragaotaviano/designprod/tree/2f1f2f889939a57f8fd7c4099f6d2021095809b9), [cotas e créditos](https://github.com/icarobragaotaviano/designprod/blob/8b8861d04ffa0b3c0b5cde7c6977ccd424f71a5e/docs/marcas-medida.md) e [modelos de ofertas](https://github.com/icarobragaotaviano/designprod/blob/fe399740e30b16bda1d57f8b8c3f6737319a6a9b/apps/photoshop/docs/ofertas-preto-dourado.md). Antes de incorporar outra branch, comparar escopo e dependências e preservar créditos. A ponte JSX do painel Photoshop depende de comportamento que o projeto identifica como não documentado; manter o caminho pelo menu de scripts durante a homologação.

## Regras de produto

- **Campanhas.** CSV por SKU com descrição, preços DE/POR, unidade, vigência e imagem. Rejeitar SKU duplicado e preço inválido. Compor story, horizontal e A5 com modelos próprios. Manter preço inteiro, centavos e unidade editáveis. Testar a mudança de 9,99 para 109,90.
- **Papel.** T4 mede 328 × 478 mm e T8 mede 238 × 328 mm. Considerar área útil da máquina, fibra, virada e custo do processo. Comparar cliques em digital e formas/passagens em offset. Guardar parâmetros usados no cálculo. A calha de corte duplo de 6 mm já pode acomodar duas sangrias de 3 mm.
- **Gabaritos.** Diferenciar corte, sangria, segurança, furação, vinco, bainha e bolsa. No calendário com 11 + 3 mm de reserva, a primeira área livre fica a 14 mm da borda do Wire-o. O perfil de 15 mm tem identificação própria. Gramatura e espessura medida são campos distintos.
- **Remendos.** Salvar a posição X/Y na peça acabada, a revisão, as dimensões e a margem. Produzir reparo em escala real e mapa de colocação. Em seleção junto à borda, mostrar a área de imagem realmente disponível.
- **Preflight.** Conferir fonte, vínculo, resolução efetiva e área de segurança no mestre. Conferir caixas de página, cores especiais, sobreimpressão e preset no PDF. O perfil define o tratamento de preto composto e limiar de resolução. Registrar verificações pendentes e executar correções em cópia de saída.
- **Reimpressão.** O nome de saída inclui OS, item, finalidade e revisão. A aprovação aponta para aquela revisão; o recebimento pela impressão registra o arquivo efetivamente entregue.

## Amostras de regressão

| Amostra | Resultado esperado |
|---|---|
| OS 0123-004567 | Cliente 0123, pedido 004567, ID web 4567, final do caminho 0123/Pedido 4567. O caminho Windows usa separadores locais. |
| Corte seco 3 × 3 na T4 com 3 mm externos e sem reserva adicional | Área geométrica 322 × 472 mm; peça 322/3 × 472/3 mm. Arredondar somente na apresentação. Recalcular quando a máquina exigir pinça. |
| Papel 660 × 960 mm, 250 g/m², 500 folhas | Massa teórica de 79,2 kg. |
| NCR, 50 blocos × 50, início 15001, duas colunas | Primeira folha 15001 / 16251; última 16250 / 17500; próximo início 17501. Conferir a repetição nas vias. |
| Bitmap de 1.200 px aplicado a 100 e 200 mm | 304,8 e 152,4 ppi respectivamente. O alerta depende do destino. |
| Canoa de 16 páginas em folhas de quatro páginas encaixadas | Folha externa frente 16/1, verso 2/15. Conferir orientação física e brancos após dobrar. |
| Calendário com furação superior e depois lateral | A guia a 14 mm acompanha a borda escolhida. A prova mostra cotas; a saída do miolo contém a arte destinada à impressão. |

**Registro de homologação:** identificar ferramenta e versão, editor/SO, perfil de máquina, OS fictícia ou referência interna, passos executados, resultado esperado, medida observada e decisão da área responsável. Usar as categorias “testado por cálculo”, “testado no editor” e “aprovado em produção” para que o operador saiba que evidência está disponível.

[TraceDraw · plugins](https://tracedraw.github.io/tracedraw/help/pt-BR/customize/plugins.html) · [VectorCraft · plugins](https://github.com/storytold/vectorcraft/blob/main/docs/plugins.md) · [PhotoCraft · CLI](https://github.com/storytold/photocraft/blob/main/book/src/automation/cli.md)
