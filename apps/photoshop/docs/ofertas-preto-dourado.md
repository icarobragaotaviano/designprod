# Ofertas preto e dourado

[Baixar o script](../scripts/gerar-ofertas-preto-dourado.jsx) · versão 2.0.0

Monta a peça de ofertas do cliente em dois formatos, medidos nos arquivos de referência:

| Formato | Tamanho | Referência | Diferenças |
|---|---|---|---|
| **Story (ADS)** | 1080 × 1920 px | `ADS.pdf` | Oferta principal no alto, dois cards empilhados, campanha no canto inferior esquerdo, rodapé em três linhas |
| **Horizontal (VT)** | 1920 × 1080 px | `VT.pdf` | Moldura arredondada, oferta principal à direita do produto, dois cards lado a lado com divisória interna, rodapé em uma linha |

Os dois usam o mesmo degradê preto → dourado, a mesma anatomia de preço (rótulo, inteiro, centavos no topo, unidade na base, risco no preço anterior) e o selo **BEBA COM MODERAÇÃO** para bebidas alcoólicas.

**Nada vira pixel.** Textos são texto editável; cards, moldura, divisórias, risco e selo são **camadas de forma** (vetor, editáveis com as ferramentas de forma e no painel Propriedades); o degradê é uma **camada de preenchimento de degradê** (duplo clique para editar); imagens são **objetos inteligentes** incorporados. O documento sai com **guias** do modelo.

## Executar

1. No GitHub, abra o JSX e use **Download raw file**.
2. No Photoshop, **Arquivo → Scripts → Procurar** e selecione o JSX. Ele é independente, sem biblioteca ou instalador.
3. Escolha o **Resultado** (abaixo), confira os campos e clique em **Aplicar**.

O script não grava arquivos, preferências nem acessa a rede. Salvar fica com você.

## Três modos

Com um documento gerado por este script aberto (grupo **DP_OFERTAS_V2**), o formulário abre com os valores atuais e oferece:

| Modo | O que faz | Quando usar |
|---|---|---|
| **Editar no documento aberto — só o que mudar** (padrão) | Compara o formulário com o documento e reconstrói **apenas** os elementos cujo valor mudou. Todo o resto fica intacto, inclusive ajustes manuais. Um único passo no histórico: **Ctrl+Z desfaz tudo**. | Troca de preço, nome, validade, uma imagem |
| **Nova cópia reconstruída** | Duplica o documento e refaz o grupo gerenciado inteiro. O original não muda. | Voltar a composição ao modelo |
| **Novo layout** | Documento novo com os dados do formulário. Único modo que permite trocar formato e tamanho. | Peça nova, ou a mesma oferta no outro formato |

Sem documento gerado aberto, só existe **Novo layout**.

### O que conta como elemento na edição

| Elemento | Muda quando | O que é refeito |
|---|---|---|
| Nome e complemento da oferta | texto de Produto ou Complemento | `TXT_NOME` e `TXT_COMPLEMENTO` |
| Preço DE | preço, unidade ou rótulo DE | grupo `PRECO_DE` |
| Preço POR | preço, unidade ou rótulo POR | grupo `PRECO_POR` |
| Selo | caixa "Bebida alcoólica" | só liga ou desliga `SELO_MODERACAO` |
| Imagem do produto, logotipo, campanha | **Escolher…** ou **Limpar** | só aquela imagem |
| Rodapé | qualquer um dos quatro campos | grupo `06_RODAPE` |
| Fonte principal | troca da fonte | todos os textos que a usam |

Cada elemento refeito entra **no mesmo lugar da pilha** do anterior. Se nenhum valor mudou, o documento não é tocado.

### Áreas: onde cada elemento encaixa

O grupo oculto **98_AREAS** guarda um retângulo vetorial para cada espaço (`AREA_OFERTA_01_NOME`, `AREA_OFERTA_02_PRECO_POR`, `AREA_LOGO`…). Ao refazer um elemento, o script encaixa o conteúdo novo na área correspondente.

Para mudar de vez onde um elemento fica, **mova ou redimensione a área** (ligue a visibilidade de 98_AREAS, ajuste, desligue). Mover só o elemento funciona até a próxima edição daquele elemento — ela o devolve à área.

## Guias

Todo documento novo e toda cópia recebem as guias do modelo: margens, eixo da divisória, início dos textos, topo e base dos cards, rodapé. O script:

- não duplica guia que já existe na mesma posição;
- nunca remove guia, nem as suas;
- não mexe em guias no modo de edição.

Os elementos são posicionados pelas mesmas medidas das guias, então cards, divisória e textos caem sobre elas.

## Campos

- **Formato**, **Largura**, **Altura**: só no modo Novo layout. Trocar o formato ajusta o tamanho e, se os textos ainda forem os de exemplo, troca pelos exemplos do outro formato. Outros tamanhos escalam o modelo; ele foi desenhado para 9:16 e 16:9.
- **Fonte principal**: nomes, preços, validade e selo. **Fonte de apoio**: textos do rodapé. As sugestões (Oswald, Roboto Condensed) valem se estiverem instaladas; a fonte original não foi identificada.
- **Rodapé**: *antes da data* (pode ter várias linhas; a última continua na linha da validade), *validade* (em destaque, fonte principal), *depois da data* (mesma linha) e *linhas finais* (começam na margem). O ADS usa as quatro partes; o VT, uma linha só.
- **Produto** e **Complemento**: nomes longos são reduzidos para caber. Nos cards, o complemento vai para o fim da última linha do nome quando cabe, como "(FRAGRÂNCIAS)" no VT.
- **Preços**: aceitam **2,89**, **2.89**, **2** e **R$ 2,89**, de 0,00 a 9999,99, sem separador de milhar. DE vazio oculta o bloco inteiro, com risco; unidade e rótulo DE podem ficar vazios nesse caso.
- **Unidades**: de 1 a 8 caracteres; KG e L viram /KG e /L. Ficam apoiadas na base do número inteiro.
- **Bebida alcoólica**: liga o selo vertical BEBA COM MODERAÇÃO ao lado da oferta.
- **Imagens**: PNG, PSD, PSB, JPG, TIFF ou WebP, incorporadas, centralizadas e ajustadas à área sem distorcer. Use recortes prontos, de preferência com transparência.

## Camadas

Nomes no [padrão de nomenclatura do ecossistema](../../../docs/padrao-nomenclatura-camadas.md). Ordem do painel, de cima para baixo:

```
DP_OFERTAS_V2
├─ 01_MARCA            IMG_LOGO
├─ 02_OFERTA_01        oferta principal
├─ 03_OFERTA_02        card 1
├─ 04_OFERTA_03        card 2
├─ 05_CAMPANHA         IMG_CAMPANHA
├─ 06_RODAPE           TXT_AVISO_ANTES · TXT_VALIDADE · TXT_AVISO_DEPOIS · TXT_AVISO_FINAL
├─ 90_GRAFISMOS        SHP_MOLDURA (só VT, com máscara atrás dos cards)
├─ 98_AREAS            AREA_… (oculto)
└─ 99_FUNDO            BG_DEGRADE
```

Cada oferta, de cima para baixo:

```
SELO_MODERACAO   SHP_SELO · TXT_SELO (girado)
PRECO_POR        TXT_ROTULO · TXT_REAIS · TXT_CENTAVOS · TXT_UNIDADE
PRECO_DE         o mesmo + SHP_RISCO
TXT_COMPLEMENTO
TXT_NOME
IMG_PRODUTO
SHP_DIVISORIA    (principal; e interna dos cards no VT)
SHP_CARD         (só nos cards)
```

Não renomeie nem rasterize camadas gerenciadas se quiser editá-las pelo script. Camadas fora de DP_OFERTAS_V2 não são tocadas.

## Verificação e limites

`npm run test:ofertas` (parte do `npm test` e do CI) executa o JSX inteiro contra um Photoshop simulado em Node.js. A simulação cobre camadas de forma e de preenchimento via Action Manager, máscaras, rotação, guias, histórico, textos com métricas aproximadas, objetos inteligentes e a interface. Onde o comportamento real é ambíguo — `artLayers.add()` do documento, `ElementPlacement.INSIDE`, conversão de unidades com réguas fora de px —, ela adota a leitura mais desfavorável ao script. Os 28 testes cobrem, nos dois formatos:

- árvore completa no padrão de nomes, sem camada de pixels e com o prefixo certo para cada tipo;
- medidas dos cards, divisórias, moldura, logotipo, campanha e rodapé conferidas com os PDFs;
- degradê como camada de preenchimento e guias sem duplicação;
- preços de 1 a 4 dígitos, nomes longos, unidades de 8 caracteres, DE vazio e entradas inválidas;
- selo girado dentro da área, imagens centralizadas e ordem das camadas;
- rodapé pela linha de base e sem encobrir a campanha;
- edição parcial: só o elemento alterado muda, a ordem se mantém, ajustes manuais sobrevivem, a área movida é respeitada, e falha ou cancelamento voltam o histórico;
- PSD a 300 ppi com réguas em cm, nova cópia e cancelamentos sem deixar rastro.

Isso não é execução nativa. Continuam pendentes de conferência no Photoshop:

- criação das camadas de forma pelo descritor `Mk contentLayer` com `Rctn`, raios e `strokeStyle` (contorno interno, sem preenchimento);
- camada de preenchimento de degradê com ângulo −90° (preto em cima);
- máscara de camada da moldura (`Mk Chnl`, ocultar seleção);
- rotação da forma do risco e do texto do selo;
- `suspendHistory` e a volta de estado do histórico após falha;
- `doc.guides.add` e a comparação com guias existentes;
- métricas da fonte escolhida: encaixe, linha de base, acentos;
- resposta do botão Cancelar da barra de progresso durante a execução.

Roteiro nativo: gerar ADS e VT sem imagens e com as cinco imagens; editar só um preço e conferir no histórico um único passo; mover uma área e editar o elemento; ligar e desligar o selo; limpar e repor uma imagem; mudar a resolução para 300 ppi sem reamostrar e editar; cancelar no formulário e durante a execução.

Limites visuais por falta de material original: posições, raios, espessuras e o degradê foram medidos nos PDFs (JPEG dentro do PDF), com erro de 1 a 2 px. A textura granulada do fundo não foi reproduzida. Sem a fonte original, larguras e altura das maiúsculas mudam o tamanho final dos preços dentro de cada área. Fotos, logotipo e selo da campanha vêm das imagens escolhidas.

A versão 2 não lê o grupo `DESIGNPROD_OFERTAS_V1` da versão 1: um layout antigo aberto é tratado como documento comum, e a peça precisa ser gerada de novo.
