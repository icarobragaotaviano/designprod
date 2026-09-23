# Textos e preços no Photoshop

O **editor rápido v2.0.0** altera o PSD aberto. Na janela, escolha o modelo de um ou dois dígitos e informe o nome do produto, os valores DE/POR e a unidade de cada preço. O script ajusta o tamanho da tela, as posições e os tamanhos dos elementos e, opcionalmente, as guias.

## Arquivos

| Arquivo | Uso |
|---|---|
| [editar-textos-precos-rapido.jsx](../apps/photoshop/scripts/editar-textos-precos-rapido.jsx) | Editor atual, integrado ao catálogo e ao painel do projeto |
| [texto-um-digito.psd](../apps/photoshop/templates/textos-precos/texto-um-digito.psd) | Modelo original de 597 × 484 px |
| [texto-dois-digitos.psd](../apps/photoshop/templates/textos-precos/texto-dois-digitos.psd) | Modelo original de 706 × 468 px |
| [gerar-textos-precos-v1.jsx](../historico/photoshop/gerar-textos-precos-v1.jsx) | Primeira versão, preservada como histórico |

Os dois PSDs foram copiados dos arquivos enviados, sem regravação. Os nomes foram padronizados para o repositório; seus conteúdos binários são idênticos aos originais. A fonte usada pelos modelos é **SF Pro Condensed Semibold**, identificada no Photoshop como `SFPro-CondensedSemibold`. Ela precisa estar ativa para editar os textos e não é distribuída neste repositório.

## Como usar

1. Baixe o JSX e um dos PSDs pela opção **Download raw file** do GitHub. Abra o PSD no Photoshop.
2. Acesse **Arquivo → Scripts → Procurar** e selecione `editar-textos-precos-rapido.jsx`. Também é possível instalá-lo pelo fluxo descrito em [Instalação](instalacao.md).
3. Escolha **Um dígito** ou **Dois dígitos**. O mesmo documento pode alternar entre os dois modelos.
4. Preencha o nome do produto, os preços e as unidades. Use Enter para separar as linhas do nome.
5. Clique em **Aplicar no PSD aberto**. Confira o resultado e salve com **Ctrl+S / Cmd+S**, ou use **Salvar como** para guardar uma cópia.

O editor modifica o documento ativo e não salva automaticamente. A aplicação usa uma etapa do Histórico; **Ctrl+Z / Cmd+Z** desfaz a edição. Cancelar a janela mantém o documento como estava.

## Campos da janela

| Campo | Comportamento |
|---|---|
| Modelo | Um dígito aceita até 9,99; dois dígitos aceita até 99,99 |
| Nome do produto | Obrigatório; ajustado ao espaço reservado, com quebras de linha manuais |
| DE R$ | Opcional; vazio oculta o preço antigo e seu risco |
| POR R$ | Obrigatório; aceita `8,90`, `8.90`, `8` ou `R$ 8,90` |
| Unidade DE / POR | Independentes, até oito caracteres: `UN`, `/KG`, `/L`, `CX`, `PCT` ou outro texto curto |
| Ajustar as guias | Ativado por padrão; desmarque para conservar as guias existentes |

`KG` é convertido em `/KG`, e `L` em `/L`. Uma casa decimal é completada com zero: `8,9` vira `8,90`. Valores negativos, separador de milhar e mais de duas casas decimais não são aceitos.

## Medidas dos modelos

As medidas são as dos PSDs fornecidos, em pixels. As guias ficam a 25 px de cada borda.

| Modelo | Tela | Guias verticais | Guias horizontais |
|---|---|---|---|
| Um dígito | 597 × 484 px | 25 e 572 px | 25 e 459 px |
| Dois dígitos | 706 × 468 px | 25 e 681 px | 25 e 443 px |

O script amplia a tela quando necessário, reposiciona os elementos e depois reduz a dimensão excedente. Ele calibra o texto pelas amostras dos modelos antes de aplicar os novos dados, para evitar reduções acumuladas nas trocas de versão.

## Estrutura esperada

Use um dos PSDs fornecidos ou uma cópia com as camadas editáveis e desbloqueadas. O editor localiza estes nomes:

| Local | Camadas |
|---|---|
| Raiz do documento | Texto `PRODUTO`; grupos `VALOR NORM` e `VALOR PROM` |
| Grupo `VALOR NORM` | `VALOR PROM`, `VALOR PROM CENT`, `DE R$`, `UN`, `/KG` e forma `Forma 1` |
| Grupo `VALOR PROM` | `VALOR PROM`, `VALOR PROM CENT`, `POR R$`, `UN` e `/KG` |

Nos originais, os nomes `DE R$ ` e `POR R$ ` têm um espaço ao final; o editor aceita os nomes com ou sem esse espaço. Os nomes das camadas são preservados ao mudar seus conteúdos. O preenchimento de fundo dos modelos permanece independente da edição.

## Por que existe uma versão histórica

O gerador v1 incorpora os dois PSDs e miniaturas dentro do JSX. Ele cria novos arquivos e permite preencher preços e unidades. Houve relato de execução muito lenta no Photoshop.

A v2 trabalha sobre as camadas já abertas e elimina a decodificação de modelos, a criação de miniaturas e a abertura e gravação de PSDs durante a aplicação. O gerador antigo fica em `historico/`, fora do catálogo de ferramentas atuais. A redução de trabalho de arquivo não representa uma medição de desempenho no Photoshop.

## Verificação

```bash
npm run test:textos
npm run catalog && npm test
npm run build:site
```

Há 14 cenários para o editor e 16 para o gerador histórico. Eles cobrem validação dos dados, seleção da janela, troca nos dois sentidos, 20 alternâncias consecutivas, recuperação do tamanho após textos longos, guias, cancelamento e recuperação após falha. Os modelos incorporados no gerador são comparados byte a byte e por SHA-256 com os PSDs originais.

As chamadas de Photoshop, o Histórico e as medidas do texto são simulados nos testes locais. A aparência final, o comportamento do desfazer e o tempo de execução ainda precisam de conferência no Photoshop com a fonte original. Não há teste nativo do aplicativo neste ambiente.
