# Marcas de medida

Selecione algo com o Letreiro retangular (M), aperte o atalho e a seleção vira uma cota: linha com hastes nas pontas e o valor escrito ao lado, num grupo com o nome da medida. Serve para especificação de layout, entrega para desenvolvimento e conferência de arte-final.

| Script | Para quê |
|---|---|
| **Marcas de medida** | Marca a seleção na hora, sem diálogo. É o que vai no atalho de teclado. |
| **Marcas de medida — opções** | Escolhe o que medir, unidade, casas decimais, posição, fonte e tamanho. Grava para o atalho e já marca a seleção atual, se houver. |

É uma versão reescrita e ampliada do [Size Marks](https://github.com/romashamin/Size-Marks-PS), de Roman Shamin, distribuído sob a licença MIT. Crédito e licença em [Licença e crédito](#licença-e-crédito).

## Instalar e criar o atalho

1. Instale pelo caminho de sempre ([instalacao.md](instalacao.md)) — `npm run install:dev` — ou baixe os dois `.jsx` prontos na vitrine.
2. Reinicie o Photoshop.
3. **Editar › Atalhos de teclado…** → **Menus de aplicativo** → **Arquivo** → **Scripts** → **IBD Marcas de medida**.
4. Sugestão: `Shift+Cmd+P` no macOS, `Shift+Ctrl+P` no Windows — a mesma do original. Se já estiver em uso, o Photoshop avisa.

## Usar

1. Escolha a cor da marca como **cor da frente** (tecla I para o conta-gotas).
2. Selecione a área com o **Letreiro retangular (M)**.
3. Rode **Marcas de medida** pelo atalho.

O resultado é um grupo `Medida L 300 px` (largura), `Medida A 80 px` (altura) ou `Medida 300 × 80 px` (as duas), criado logo acima da camada ativa. Se a camada ativa for um grupo ou uma prancheta, a marca entra no topo dele — o mesmo que o Photoshop faz com Nova camada. Dentro do grupo:

- **Linhas** — linha e hastes, em pixels, na cor da frente;
- **Largura** / **Altura** — o rótulo, como texto editável.

Em documento com pranchetas, deixe ativa uma camada da prancheta que vai receber a marca: o rótulo passa a respeitar a borda dela, e não só a da tela.

O grupo fica selecionado: as teclas numéricas mudam a opacidade na hora (`6` = 60%). Tudo entra como um passo só no painel Histórico, **IBD — Marca de medida**; um `Cmd/Ctrl+Z` desfaz a marca inteira.

## Opções

| Opção | Valores | Padrão |
|---|---|---|
| Medir | Automática, Largura, Altura, Largura e altura | Automática — seleção mais larga que alta mede a largura; retrato ou quadrada mede a altura (a regra do original) |
| Unidade | px, mm, cm, pt | px |
| Mostrar também em px | liga ou desliga | ligado — `25,4 mm / 300 px` |
| Casas decimais | Automáticas (px 0, mm 1, cm 2, pt 1, sem zeros sobrando) ou fixas de 0 a 3 | Automáticas |
| Separador decimal | vírgula ou ponto | vírgula |
| Linha | na borda (topo ou esquerda), no centro, na borda oposta (base ou direita) | na borda |
| Tamanho do texto | em pt, de 1 a 1296 | 10 pt |
| Fonte | nome PostScript (`ArialMT`) ou o nome do menu (`Arial Bold`) | ArialMT |

mm, cm e pt são calculados pela resolução do documento (**Imagem › Tamanho da imagem**). Para ter o `pt / px` do Size Marks num documento retina de 144 ppi, escolha **pt** com **Mostrar também em px**.

O rótulo fica do lado de fora da seleção, para não cobrir o que está sendo medido. Quando não cabe na tela desse lado, passa para o outro lado da linha; ao longo da linha, é empurrado para dentro da tela.

As opções ficam gravadas na pasta de dados do IBD (`prefs-photoshop-marcas-medida.json`), compartilhadas pelos dois scripts. Opção inválida é recusada com mensagem — nunca adivinhada.

## O que mudou em relação ao Size Marks

| | Size Marks 1.3 | Marcas de medida |
|---|---|---|
| O que mede | Uma medida por vez, pela proporção | Automática, largura, altura ou **as duas** de uma vez |
| Unidades | px, e pt quando a resolução não é 72 ppi | **px, mm, cm e pt**, com px junto opcional |
| Números | ponto decimal, uma casa em pt | vírgula ou ponto, casas automáticas ou fixas, arredondamento sem o erro do `toFixed` |
| Rótulo | rasterizado e mesclado com a linha | **texto editável**, num grupo com o nome da medida |
| Tamanho | linha de 1 px e texto no corpo padrão em qualquer resolução | linha, hastes e afastamento **proporcionais à resolução** (4 px a 300 ppi); corpo do texto em pt |
| Desenho | traço de Lápis em traçado temporário | preenchimento de seleção, no pixel exato |
| Estado do app | mudava o diâmetro do Lápis e trocava a ferramenta ativa; em erro, não devolvia régua nem unidade de texto | não mexe em ferramenta nem pincel; régua e unidade de texto voltam **mesmo em erro**, e o passo do histórico é desfeito |
| Posição do rótulo | acima da linha horizontal; à direita da vertical, por dentro | sempre por fora; troca de lado quando sairia da tela |
| Posição da linha | topo ou esquerda | topo/esquerda, centro ou base/direita |
| Pranchetas | desligava o aninhamento automático por um evento do Action Manager | devolve o rótulo ao grupo depois de movê-lo e mantém o rótulo dentro da prancheta |
| Documentos | — | recusa com explicação Bitmap, Cores indexadas, Multicanal e Máscara rápida |
| Configuração | nenhuma | script de opções, sem tirar a rapidez do atalho |
| Idioma | inglês | português |

O que ficou igual, de propósito: um atalho, nenhuma pergunta, a regra paisagem → largura, a cor da frente como cor da marca, o espaço fino entre número e unidade e um único passo no Histórico.

## Limites conhecidos

- **Ainda não foi executado dentro do Photoshop.** As contas e o fluxo passam em 36 verificações com o Photoshop simulado (`npm run test:medida`), mas criação de texto, preenchimento e movimentação de grupo só se confirmam no app. Roteiro de conferência abaixo.
- Seleção não retangular (laço, varinha) é medida pelo retângulo que a envolve.
- Com **Largura e altura** e a linha **no centro**, cada rótulo vai para o meio de uma das metades, para não ficar sobre a outra linha. Em seleção pequena com rótulo grande, os dois ainda podem se encostar.
- O rótulo usa a fonte gravada nas opções. Se ela não estiver instalada, sai em ArialMT e um aviso diz como corrigir.

### Conferência no Photoshop

1. Documento RGB 72 ppi: seleção paisagem, retrato e quadrada — confira linha, hastes, rótulo e nome do grupo.
2. Documento CMYK 300 ppi em mm: a linha deve ter 4 px e o rótulo 10 pt no painel Caractere.
3. Seleção encostada no topo e na borda esquerda: o rótulo troca de lado.
4. Documento com duas pranchetas, com uma camada da segunda ativa e a seleção encostada no topo dela: a marca entra na segunda prancheta, o rótulo desce para dentro dela e o texto continua dentro do grupo da marca.
5. `Cmd/Ctrl+Z` uma vez desfaz a marca inteira; a régua e a unidade de texto continuam como estavam.

## Arquivos

| Arquivo | Papel |
|---|---|
| `core/extendscript/ibd-medida.jsx` | Contas: conversão, texto do rótulo, linha, hastes e encaixe. Não chama a Adobe. |
| `core/extendscript/ibd-ps-medida.jsx` | Adaptador do Photoshop: seleção, grupo, preenchimento, texto, histórico. |
| `apps/photoshop/scripts/marcas-medida.jsx` | Atalho, sem diálogo. |
| `apps/photoshop/scripts/marcas-medida-opcoes.jsx` | Diálogo de opções. |
| `tools/test-medida.cjs` | 36 verificações: contas, os dois scripts com o Photoshop simulado e a presença do aviso de licença. |

## Licença e crédito

Obra derivada do **Size Marks 1.3**, © 2014 Roman Shamin, sob a licença MIT — origem fixada no commit `2cba97d` de [romashamin/Size-Marks-PS](https://github.com/romashamin/Size-Marks-PS). O código foi reescrito; a ideia e o fluxo vêm do original. As alterações são © 2026 Ícaro Braga, também sob MIT.

O aviso de licença do original está na íntegra no cabeçalho dos quatro arquivos da família — cada um pode ser copiado ou baixado sozinho — e em [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). Não remova esse aviso: a licença MIT só permite a cópia e a modificação com ele junto, e `npm run test:medida` falha se ele sumir.

Esta versão é independente: não é afiliada ao autor original, não foi endossada por ele e não é contribuída de volta ao projeto.
