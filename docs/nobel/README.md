# Projeto Nobel · Plano de desenvolvimento

**Objetivo.** Um atendente localiza o pedido pelo celular, o designer abre a arte no Windows e o impressor recebe a revisão aprovada. As três pessoas trabalham sobre o mesmo número de OS e item. As calculadoras também funcionam antes do cadastro de um pedido.

Este diretório é a especificação de desenvolvimento. Os apps e adaptadores descritos no backlog têm entregas e aceites próprios. As ferramentas já presentes no DesignProd continuam identificadas no catálogo gerado do repositório.

| Para começar | Documento |
|---|---|
| Escolher uma entrega e entender a sequência | [Backlog, dependências e marcos](backlog.md) |
| Implementar a interface entre sistemas | [Arquitetura, dados e publicação](arquitetura.md) |
| Desenvolver para um editor e conferir a saída | [Integrações, produtos e homologação](bancada.md) |

## Escopo e responsabilidades

| Área | Quem usa | Fonte de referência |
|---|---|---|
| Pedido, item, referências, fila e atendimento | Balcão, designer e impressor | [IBD OS Maneger](https://github.com/icarobragaotaviano/ibd-os-maneger). Consumir seus registros e suas regras de identificação. |
| Formato, papel, imposição e acabamento | Orçamento, estoque e pré-impressão | [IBD Folha](https://github.com/icarobragaotaviano/ibd-folha). Reutilizar cálculo e seus testes de referência. |
| Sequência e posição do numerador | Designer e acabamento | [Numera-bloco](https://github.com/icarobragaotaviano/numera-bloco). Conferir o modelo suportado antes de integrar. |
| Edição, catálogo, provas e distribuição | Criação e pré-impressão | DesignProd. Aproveitar scripts de preços, auto layout, remendos, guias e exportação. Manter a rastreabilidade de cada saída até a OS. |

O projeto cobre aplicativos web instaláveis em Android e desktop, automações do Windows, seis editores e conferência no Kodak Preps. O primeiro marco entrega um percurso utilizável antes da integração com contas, bancos e máquinas. O roadmap usa dependências e critérios de saída; datas e esforço serão calibrados com os pilotos.

## Como iniciar uma entrega

1. Selecionar o identificador do backlog e criar uma branch a partir da base de desenvolvimento escolhida para o produto.
2. Na descrição da mudança, registrar entrada, saída, caso de erro, teste de referência e quais partes da estação real precisam ser verificadas.
3. Desenvolver lógica independente da interface quando houver cálculo. Adaptadores convertem unidades e aplicam os resultados ao editor.
4. Seguir o [guia de contribuição](../../CONTRIBUTING.md). Acrescentar entradas pelo gerador do catálogo. Rodar `npm run catalog && npm test`; quando mudar a distribuição web ou Photoshop, rodar respectivamente `npm run build:site` ou `npm run build:plugin`.
5. Registrar a evidência conforme o tipo de entrega: captura ou arquivo de exemplo sintético no editor, PDF conferido, peça medida ou bloco cortado. Usar arquivos sintéticos no repositório público.

## Indicadores do piloto

Medir, antes e depois, o tempo para encontrar um pedido e preparar um calendário; comparar folhas estimadas e consumidas no mesmo serviço; contar revisões reexportadas com nome ou item errado. Usar o mesmo conjunto de serviços e registrar equipamento, versão do software e responsável pela conferência.
