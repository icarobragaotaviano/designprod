# Padrão de nomenclatura de camadas

Vale para toda camada e grupo **criados ou lidos** por scripts, actions e painéis do ecossistema. O nome da camada é a interface entre o arquivo e a automação: script encontra camada pelo nome, action seleciona camada pelo nome, e quem abre o PSD entende a estrutura pelo nome. Nome fora do padrão é tratado como camada do usuário e não é tocado.

Versão do padrão: **1.0** (setembro de 2026).

## Regra curta

```
[NN_]PREFIXO[_PARTE…][_NN][ @etiqueta[…]]
```

- Maiúsculas ASCII, dígitos e `_`. Sem acento, sem espaço, sem hífen.
- Número sempre com dois dígitos: `01`, `02`… `99`.
- O nome diz **o que a camada é**, nunca o conteúdo dela. O conteúdo fica no texto, na imagem ou na forma.
- Único entre irmãos. Scripts procuram pelo caminho (`RAIZ/SEÇÃO/CAMADA`), nunca por busca global.

Expressão regular da parte-base (antes de qualquer etiqueta):

```
^(?:\d{2}_)?[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$
```

## Três níveis de grupo

| Nível | Forma | Exemplo | Função |
|---|---|---|---|
| Raiz gerenciada | `DP_<MODULO>_V<maior>` | `DP_OFERTAS_V2` | Marca o que o script criou e pode reconstruir. O número é a versão **maior** da estrutura, não do script. |
| Seção | `NN_<NOME>` | `02_OFERTA_01`, `06_RODAPE` | Primeiro nível dentro da raiz. `NN` ordena a leitura e o painel. |
| Componente | `<NOME>[_NN]` | `PRECO_DE`, `SELO_MODERACAO` | Grupo reutilizável dentro de uma seção. |

Faixas de `NN` nas seções:

| Faixa | Uso |
|---|---|
| `01`–`89` | Conteúdo, na ordem de leitura (marca, ofertas, campanha, rodapé…) |
| `90`–`97` | Grafismos e decoração (`90_GRAFISMOS`) |
| `98` | Referências ocultas: áreas, grade, marcações (`98_AREAS`) |
| `99` | Fundo (`99_FUNDO`) |

## Prefixo das camadas

| Prefixo | Tipo no Photoshop | Exemplo |
|---|---|---|
| `TXT_` | Texto editável | `TXT_NOME`, `TXT_REAIS` |
| `IMG_` | Objeto inteligente (imagem incorporada ou vinculada) | `IMG_PRODUTO`, `IMG_LOGO` |
| `SHP_` | Forma vetorial (camada de forma) | `SHP_CARD`, `SHP_RISCO` |
| `BG_` | Camada de preenchimento de fundo (cor, degradê, padrão) | `BG_DEGRADE` |
| `ADJ_` | Camada de ajuste | `ADJ_CURVAS` |
| `AREA_` | Retângulo de referência oculto, que define onde um elemento encaixa | `AREA_OFERTA_01_NOME` |
| `PIX_` | Camada de pixels — último recurso, só quando não houver forma, texto ou objeto inteligente que resolva | `PIX_TEXTURA` |

O prefixo descreve o **tipo**, e o tipo não muda por acidente: forma é forma, texto é texto. Rasterizar um `TXT_` ou um `SHP_` quebra o contrato; o script recusa a camada em vez de adivinhar.

## Vocabulário comum

Use estas palavras antes de inventar outras. Palavra nova entra aqui antes de entrar em um script.

| Palavra | Significado |
|---|---|
| `MARCA`, `LOGO` | Assinatura do anunciante |
| `OFERTA` | Conjunto produto + nome + preços |
| `PRODUTO` | Imagem do produto |
| `NOME`, `COMPLEMENTO` | Nome do produto e texto auxiliar (sabores, fragrâncias) |
| `PRECO_DE`, `PRECO_POR` | Preço anterior (riscado) e preço atual |
| `ROTULO`, `REAIS`, `CENTAVOS`, `UNIDADE` | Partes do preço: "DE R$", inteiro, ",99", "UN" ou "/KG" |
| `RISCO` | Traço sobre o preço anterior |
| `SELO` | Aviso fixo em caixa (ex.: `SELO_MODERACAO`) |
| `CAMPANHA` | Arte de campanha ou promoção |
| `RODAPE`, `AVISO`, `VALIDADE` | Texto legal e período da oferta |
| `CARD`, `MOLDURA`, `DIVISORIA` | Contornos e linhas |
| `DEGRADE`, `FUNDO` | Fundo |

## Etiquetas de máquina

Regras que a automação precisa ler viajam no fim do nome, depois de um espaço e de `@`:

```
04_CARDS @auto[dir=v;gap=24]
```

A parte antes da etiqueta segue o padrão normalmente. Hoje a única etiqueta é `@auto[…]` do auto layout ([decisão 8 da arquitetura](arquitetura.md)). Etiqueta nova precisa de nome curto, entrar nesta página e ser ignorada com segurança por quem não a conhece.

## Temporárias

Camada criada só durante a execução começa com `__DP_` (ex.: `__DP_TEMP`). Ela nunca pode sobrar no documento: o script remove no fim e também no caminho de erro. Nome com `__DP_` encontrado ao abrir um arquivo indica execução interrompida e pode ser apagado.

## Estados

Estado é visibilidade, não nome. Preço anterior ausente = `PRECO_DE` oculto; selo desligado = `SELO_MODERACAO` oculto. Não use sufixos como `_OFF`, `_V2` ou `_COPIA` em camadas.

## Regras para scripts

1. Crie a camada, preencha o conteúdo e **só então** defina o nome. O Photoshop renomeia texto ao mudar o conteúdo.
2. Procure por caminho a partir da raiz gerenciada. Nome duplicado entre irmãos é erro, nunca "pegar o primeiro".
3. Não toque em nada fora da raiz gerenciada, a não ser que a ferramenta exista para isso.
4. Mudança de nome ou de hierarquia é mudança **maior**: sobe o `V<maior>` da raiz e a versão maior do script, e a documentação registra a migração.
5. Os testes de cada script conferem os nomes criados com a expressão regular desta página.

## Regras para actions

1. Selecione camadas pelo nome do padrão, nunca pela posição ("camada acima", "camada 3").
2. Action que depende de estrutura deve partir de um documento gerado por script ou de um modelo já no padrão.
3. Nomes criados por action seguem o mesmo padrão; nomes automáticos do Photoshop ("Camada 1", "Forma 1", "Retângulo 2") não podem sobrar.

## Modelos antigos

Modelos de cliente anteriores a este padrão continuam sendo lidos pelos nomes que já têm — o [editor rápido de textos e preços](textos-e-precos.md) usa `VALOR PROM`, `VALOR NORM`, `DE R$` e `Forma 1`. Ao migrar um modelo:

| Antes | Padrão |
|---|---|
| `VALOR NORM` (grupo) | `PRECO_DE` |
| `VALOR PROM` (grupo) | `PRECO_POR` |
| `VALOR PROM` / `VALOR PROM CENT` (texto) | `TXT_REAIS` / `TXT_CENTAVOS` |
| `DE R$`, `POR R$` | `TXT_ROTULO` |
| `UN`, `/KG` | `TXT_UNIDADE` |
| `Forma 1` (risco) | `SHP_RISCO` |
| `PRODUTO` (texto) | `TXT_NOME` |

Referência de aplicação: [Ofertas preto e dourado](../apps/photoshop/docs/ofertas-preto-dourado.md), cuja árvore completa segue este padrão e é verificada no CI.
