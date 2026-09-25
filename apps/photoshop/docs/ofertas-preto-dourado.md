# Ofertas preto e dourado

[Baixar o script](../scripts/gerar-ofertas-preto-dourado.jsx) · versão 1.0.0

Cria uma arte horizontal de **1920 × 1080 px**, RGB, 72 ppi, com uma oferta principal e duas ofertas menores, a partir do print fornecido. A interface reúne os textos e cinco seletores de imagem. As dimensões podem ser alteradas antes de criar um novo layout.

O print foi usado como referência visual. Este arquivo não é uma reprodução extraída do PSD: posições, gradiente e proporções foram reconstruídos. A fonte original, as fotografias recortadas, o logotipo e a campanha não foram fornecidos. A aparência exata depende desses materiais e de conferência no Photoshop.

## Executar

1. No GitHub, abra o JSX e use **Download raw file**.
2. No Photoshop, escolha **Arquivo → Scripts → Procurar** e selecione o JSX. Ele é independente, sem biblioteca ou instalador.
3. Em **Geral**, confira dimensões, fonte instalada, validade e rodapé.
4. Nas três abas de oferta, preencha produto, complemento, preço anterior, preço atual, unidades e rótulos.
5. Em cada aba, escolha a imagem do produto. Em **Marca e campanha**, escolha o logotipo e o selo.
6. Clique em **Gerar arte**. Confira o novo documento e salve manualmente quando desejar.

O desenvolvimento deste recurso é feito diretamente no GitHub. A execução do JSX acontece no Photoshop do usuário. O script não grava PSD, preferências, arquivos temporários, imagens ou qualquer outro arquivo; também não acessa a rede. O aplicativo pode manter seu próprio histórico, cache e recuperação automática conforme as preferências do usuário.

## Editar todos os textos novamente

Com uma arte gerada por este script aberta, execute o JSX outra vez. Ele reconhece o grupo **DESIGNPROD_OFERTAS_V1** e carrega os textos existentes.

**Nova cópia do layout aberto** duplica o documento e reconstrói o grupo gerenciado com os novos dados. As imagens existentes são mantidas se você não escolher uma substituta nem clicar em Limpar. O documento de origem permanece intacto. Grupos externos ao grupo gerenciado continuam na cópia.

A composição do grupo gerenciado é reconstruída: ajustes manuais de posição, tamanho, efeitos e camadas adicionais dentro dele não são transferidos. Para preservar esses ajustes, mantenha a versão original. Não renomeie os grupos/camadas gerenciados nem rasterize seus textos se quiser recarregá-los.

**Novo layout com os dados abaixo** usa o formulário em um novo documento RGB. É a opção que permite mudar as dimensões. Imagens atuais também são reaproveitadas enquanto não forem substituídas ou limpas.

## Campos e preços

- Produto: texto com quebras manuais de linha. Nomes longos são reduzidos proporcionalmente para caber.
- Complemento: texto opcional separado do nome, como **(FRAGRÂNCIAS)**.
- Preço: aceita **2,89**, **2.89**, **2** e **R$ 2,89**, entre 0,00 e 9999,99, sem separador de milhar.
- Preço anterior vazio: oculta o grupo inteiro, incluindo o risco.
- Unidades DE e POR: independentes, de 1 a 8 caracteres; KG e L são convertidos em /KG e /L.
- Rótulos: editáveis por oferta. **POR|R$** gera duas linhas.
- Rodapé: início, validade e final ficam em três camadas de texto.
- Os preços anteriores dos dois cards menores começam vazios porque seus centavos não são legíveis com confiança no print.
- Textos presentes em imagens de marca, produtos ou campanha continuam incorporados a essas imagens.

Todos os textos criados pelo script usam a fonte escolhida na lista de fontes instaladas. Oswald Semibold e Roboto Condensed Bold são sugestões visuais quando instaladas; não são fontes confirmadas do arquivo original. Nenhuma fonte é instalada ou distribuída.

## Imagens

São cinco espaços independentes: produto principal, produto 02, produto 03, logo e campanha.

PNG, PSD, PSB, JPG, TIFF e WebP são aceitos. Cada imagem é incorporada como objeto inteligente, centralizada e ajustada proporcionalmente ao espaço. O script não remove fundo nem gera automaticamente as montagens com várias embalagens vistas no print. Use recortes ou montagens prontos, preferencialmente com transparência. Margens internas na imagem afetam o encaixe.

Escolher uma imagem substitui apenas esse espaço no resultado. **Limpar** deixa o espaço vazio. Sem imagens selecionadas, a arte pode ser criada; o resumo identifica os espaços vazios e o grupo oculto **98_GUIAS** mostra suas áreas se ativado manualmente.

## Camadas

Dentro de **DESIGNPROD_OFERTAS_V1**:

| Grupo | Conteúdo |
|---|---|
| 01_MARCA | IMG_LOGO |
| 02_OFERTA_DESTAQUE | produto principal, nome, complemento, preços e divisória |
| 03_OFERTA_02 | segunda oferta e moldura do card |
| 04_OFERTA_03 | terceira oferta e moldura do card |
| 05_CAMPANHA | IMG_CAMPANHA |
| 06_RODAPE | TXT_AVISO_ANTES, TXT_VALIDADE, TXT_AVISO_DEPOIS |
| 90_GRAFISMOS | FORMA_MOLDURA |
| 98_GUIAS | áreas de imagem, ocultas no resultado |
| 99_FUNDO | BG_DEGRADE_PRETO_DOURADO |

Cada oferta possui **IMG_PRODUTO**, **TXT_NOME**, **TXT_COMPLEMENTO**, **PRECO_ANTERIOR** e **PRECO_ATUAL**. Cada preço contém **TXT_ROTULO**, **TXT_REAIS**, **TXT_CENTAVOS** e **TXT_UNIDADE**; o anterior inclui **FORMA_RISCO**.

Texto permanece texto; as imagens são objetos inteligentes; divisórias, contornos, risco e gradiente são camadas raster separadas. O script mantém proporções e não achata o documento.

## Verificação e limites

Os testes automatizados exercitam lógica e contratos de um Photoshop simulado, sem executar o aplicativo Adobe. O CI também confere metadados, catálogo e geração da vitrine.

A conferência nativa ainda é necessária, principalmente para o descritor do gradiente, a importação das imagens, fontes e medidas reais dos textos. Para validar: gerar a arte; trocar textos curtos por longos; alternar preços de um a quatro dígitos; carregar e substituir as cinco imagens; cancelar; executar novamente e conferir que o original e as preferências continuam intactos.

A versão atual não lê um PSD arbitrário nem recupera camadas do print. Ela reconhece somente sua própria estrutura.

Referências Adobe: [executar scripts JSX](https://helpx.adobe.com/photoshop/using/scripting.html), [eventos de Photoshop](https://developer.adobe.com/photoshop/uxp/2022/ps-reference/media/eventcodes), [referência ExtendScript](https://github.com/Adobe-CEP/CEP-Resources/blob/master/Documentation/Product%20specific%20Documentation/Photoshop%20Scripting/photoshop-javascript-ref-2020.pdf).
