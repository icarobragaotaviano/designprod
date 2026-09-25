# Ofertas preto e dourado

[Baixar o script](../scripts/gerar-ofertas-preto-dourado.jsx) · versão 1.1.0

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

**Nova cópia do layout aberto** duplica o documento e reconstrói o grupo gerenciado com os novos dados. As imagens existentes são mantidas se você não escolher uma substituta nem clicar em Limpar. O documento de origem permanece intacto. Grupos externos ao grupo gerenciado continuam na cópia, e o grupo gerenciado volta ao topo da pilha.

Se o layout aberto estiver em outra resolução (por exemplo, 300 ppi definidos em Tamanho da imagem sem reamostrar), a cópia é montada a 72 ppi **sem reamostrar** — os pixels não mudam — e volta à resolução original no final. Assim textos, preços e molduras têm a mesma geometria em pixels de um layout a 72 ppi. O corpo exibido no painel Caractere acompanha a resolução: 76 pt a 72 ppi aparecem como 18,24 pt a 300 ppi, no mesmo tamanho visual. Largura e altura são lidas em pixels, qualquer que seja a unidade das réguas.

A composição do grupo gerenciado é reconstruída: ajustes manuais de posição, tamanho, efeitos e camadas adicionais dentro dele não são transferidos. Para preservar esses ajustes, mantenha a versão original. Não renomeie os grupos/camadas gerenciados nem rasterize seus textos se quiser recarregá-los.

**Novo layout com os dados abaixo** usa o formulário em um novo documento RGB. É a opção que permite mudar as dimensões. Imagens atuais também são reaproveitadas enquanto não forem substituídas ou limpas.

## Campos e preços

- Produto: texto com quebras manuais de linha. Nomes longos são reduzidos proporcionalmente para caber.
- Complemento: texto opcional separado do nome, como **(FRAGRÂNCIAS)**.
- Preço: aceita **2,89**, **2.89**, **2** e **R$ 2,89**, entre 0,00 e 9999,99, sem separador de milhar.
- Preço anterior vazio: oculta o grupo inteiro, incluindo o risco. A unidade e o rótulo DE podem ficar vazios nesse caso; o grupo oculto recebe **UN** e **DE|R$** só para continuar recarregável.
- Unidades DE e POR: independentes, de 1 a 8 caracteres; KG e L são convertidos em /KG e /L. Unidades longas são reduzidas para caber e ficam apoiadas na base do número inteiro.
- Preços de 1 a 4 dígitos usam o mesmo bloco: o inteiro define onde entram centavos e unidade, e o bloco inteiro é reduzido proporcionalmente quando fica mais largo.
- Rótulos: editáveis por oferta. **POR|R$** gera duas linhas.
- Rodapé: início, validade e final ficam em três camadas de texto, na mesma linha de base, reduzidas juntas para caber acima da borda inferior e abaixo do espaço da campanha.
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

A moldura e os contornos dos cards são anéis preenchidos a partir de seleções poligonais (12 segmentos por canto, desvio máximo de 0,15 px num raio de 65 px). A moldura sai pela borda esquerda sem desenhar linha nessa borda, e o trecho inferior que passa atrás dos cards é apagado para não aparecer através do fundo translúcido. Cada imagem de produto fica logo acima da divisória da sua oferta e abaixo dos textos.

## Verificação e limites

`npm run test:ofertas` (parte do `npm test` e do CI) executa o JSX inteiro contra um Photoshop simulado em Node.js: camadas, grupos, seleções poligonais, textos com métricas aproximadas, objetos inteligentes, descritores `Grdn` e `Plc ` e a interface ScriptUI. Onde o comportamento do DOM real é ambíguo — `artLayers.add()` do documento, `ElementPlacement.INSIDE`, conversão de `UnitValue` com réguas fora de px —, a simulação adota a leitura mais desfavorável ao script. Os 15 testes cobrem:

- estrutura gerenciada, textos editáveis e preferências restauradas;
- conteúdo do descritor do gradiente;
- preços de 1 a 4 dígitos, nomes e complementos longos, unidades de 8 caracteres e recusa de entradas inválidas;
- DE vazio;
- colocação incorporada, encaixe centralizado e ordem das camadas das cinco imagens;
- moldura ausente dentro dos cards e sem traço na borda da tela, em 16:9, 4:5 e 4K;
- rodapé abaixo da campanha e na mesma linha de base, em quatro formatos;
- reedição por nova cópia, com imagens e camadas externas mantidas e original intacto;
- layout a 300 ppi com réguas em cm, com geometria idêntica à de 72 ppi e resolução devolvida;
- cancelamento no formulário, cancelamento durante a geração e falha nativa no meio, com limpeza completa.

Isso não é execução nativa. Continuam pendentes de conferência no Photoshop:

- se o descritor `Grdn` ainda aplica o degradê clássico na versão instalada;
- a colocação `Plc ` com PNG, PSD, JPG, TIFF e WebP reais;
- a seleção poligonal com suavização e o preenchimento dos anéis;
- métricas reais da fonte escolhida: encaixe dos textos, linha de base e acentos;
- `resizeImage` sem reamostrar em um layout de 300 ppi e a volta à resolução original;
- se o botão Cancelar da barra de progresso responde durante a execução (o Esc do Photoshop pode interromper a execução; qualquer interrupção que chegue ao script fecha o documento parcial e restaura as preferências);
- aparência final comparada ao print.

Roteiro nativo: gerar a arte sem imagens; gerar com as cinco imagens; trocar nomes curtos por longos; alternar preços de um a quatro dígitos e DE vazio; mudar a resolução para 300 ppi sem reamostrar e executar **Nova cópia**; cancelar no formulário e durante a geração; conferir que o original, as réguas e a unidade de texto continuam como estavam.

O layout foi desenhado em 16:9. Em outras proporções as posições acompanham largura e altura separadamente e os corpos acompanham o menor dos dois fatores; o resultado é válido, mas não é uma diagramação própria para 4:5 ou 9:16.

Limites visuais por falta de material original: sem o PSD, as posições, raios, espessuras, opacidades e o degradê foram estimados do print; sem as fotos recortadas, o logotipo e o selo, os espaços ficam vazios ou recebem o material escolhido, sem a montagem de várias embalagens do print; sem a fonte original, os textos usam a fonte instalada escolhida, e larguras, altura das maiúsculas e acentos mudam o encaixe. Os centavos dos preços anteriores dos cards menores não eram legíveis no print.

A versão atual não lê um PSD arbitrário nem recupera camadas do print. Ela reconhece somente sua própria estrutura.

Referências Adobe: [executar scripts JSX](https://helpx.adobe.com/photoshop/using/scripting.html), [eventos de Photoshop](https://developer.adobe.com/photoshop/uxp/2022/ps-reference/media/eventcodes), [referência ExtendScript](https://github.com/Adobe-CEP/CEP-Resources/blob/master/Documentation/Product%20specific%20Documentation/Photoshop%20Scripting/photoshop-javascript-ref-2020.pdf).
