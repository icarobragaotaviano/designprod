# Remendos de adesivos, guias e sangria — Photoshop e Illustrator

Remendos de adesivos 1.1.0 · Sangria e Illustrator 1.0.0 · 21/09/2026 · Caixas de diálogo em português.

Três scripts `.jsx` independentes para os aplicativos Adobe de desktop. Cada arquivo funciona sozinho, sem instalar plugin ou copiar outros arquivos junto dele.

**Estado desta entrega:** código e cálculos verificados localmente; a execução e a aparência dos diálogos dentro do Photoshop e do Illustrator ainda precisam ser validadas. Não há garantia de compatibilidade com uma versão específica sem esse teste.

Baixe o [kit atualizado v1.1](../downloads/kit-remendos-guias-e-sangria-v1.1.zip). A [primeira entrega v1.0](../downloads/kit-guias-e-sangria-v1.zip) permanece como histórico e **não gera documentos de remendos**. O nome do arquivo e o identificador do script no repositório foram mantidos para preservar lançadores e atalhos; o título no catálogo passou a **Remendo de adesivo — seleção e margem**.

## Comece por aqui

1. Baixe ou clone este repositório.
2. Abra o documento no aplicativo correspondente.
3. Execute o arquivo pelo menu indicado abaixo.

| Aplicativo | Arquivo | Resultado |
|---|---|---|
| Photoshop | `apps/photoshop/scripts/guias-selecao-margem.jsx` | Guias, seleção total com margem e novo documento mesclado do remendo. |
| Photoshop | `apps/photoshop/scripts/sangria-guias-canvas.jsx` | Aumenta a tela e cria guias do corte e da borda da sangria. |
| Illustrator | `apps/illustrator/scripts/guias-selecao-margem.jsx` | Guias nos limites do conjunto selecionado e na margem escolhida. |

**Photoshop:** Arquivo → Scripts → Procurar… → escolha o `.jsx`. Esse é o caminho documentado pela [Adobe para executar scripts externos](https://helpx.adobe.com/photoshop/using/scripting.html).

**Illustrator:** Arquivo → Scripts → Outro script… → escolha o `.jsx`. Veja a [orientação da Adobe para scripts do Illustrator](https://helpx.adobe.com/illustrator/desktop/automate-visualize-data/automate-actions/install-and-run-scripts.html).

## 1. Photoshop — remendo de adesivo a partir da arte existente

Use `apps/photoshop/scripts/guias-selecao-margem.jsx` para extrair a parte da arte que será impressa como adesivo de remendo.

1. Na arte original, selecione a **área que o adesivo precisa cobrir** com o Letreiro (`M`).
2. Execute o script e informe a **margem de sobreposição por lado** em mm, cm, px ou pt.
3. Confira o tamanho final e clique em **Criar remendo**.
4. Salve o novo documento em PSD para conservar os atributos de cor e a profundidade de bits suportados pelo formato.

O script executa esta sequência:

1. Cria quatro guias na área inicial e quatro no limite externo da margem. Guias já existentes na mesma posição são reutilizadas.
2. **Seleciona, no original, toda a área retangular delimitada pelas guias externas, incluindo a margem.** A seleção anterior é substituída, sem suavização das bordas.
3. Duplica a composição visível mesclada de toda a arte e, na cópia, recorta somente o retângulo selecionado. A composição é mesclada **antes** do recorte para manter a aparência dos efeitos e ajustes.
4. Abre o remendo como documento independente, na escala original. O novo documento recebe guias da área inicial e da borda, em suas próprias coordenadas.

**Exemplo:** seleção de 400 × 200 px e margem de 10 px por lado → novo documento de **420 × 220 px**. A imagem da margem vem da região vizinha que já existe na arte.

### Fidelidade ao original

A criação usa uma duplicata nativa com as camadas mescladas. O resultado é a composição visível da área, incluindo fundos, textos e efeitos; não é somente a camada ativa. O remendo não mantém camadas editáveis. A transparência existente deve ser conservada pela composição mesclada, sem acrescentar fundo branco.

O script não redimensiona, não reamostra, não converte o modo de cor, não converte o perfil e não passa pela área de transferência. Confere estes atributos tanto depois da duplicação quanto depois do recorte:

| Atributo | Comportamento |
|---|---|
| Resolução em ppi | Igual ao original. |
| Modo de cor | Conserva o modo original, como RGB ou CMYK. |
| Profundidade de bits | Igual ao original. |
| Perfil de cor e condição de perfil atribuído | Conserva o perfil; um original sem perfil continua sem perfil. |
| Proporção dos pixels | Igual ao original. |
| Canais | Confere quantidade, nomes e tipos, incluindo canais auxiliares. |
| Largura e altura em pixels | Correspondem exatamente ao retângulo total selecionado. |

Se o Photoshop devolver características diferentes, dimensões incorretas ou mais de uma camada, o script fecha a cópia incompleta e tenta restaurar as guias e a seleção do original. A conferência de atributos não substitui um teste visual dentro do Photoshop.

### Medidas e limites

A margem é sempre **externa**: trata-se da sobreposição do adesivo. Margem zero recorta apenas a seleção. Aceita vírgula ou ponto decimal. As opções de margem interna e de ambas as direções continuam disponíveis no script de guias do Illustrator.

Para copiar os pixels existentes sem interpolação, o retângulo da seleção é alinhado para fora à grade de pixels e a margem é arredondada para cima ao pixel inteiro. **3 mm a 300 ppi → 36 px = 3,048 mm por lado.** O diálogo informa a dimensão efetiva antes de executar.

A seleção pode ter qualquer formato, mas o remendo gerado é **retangular**. Seleções com suavização são usadas apenas para medir a área: o recorte final não aplica essa suavização à imagem.

A seleção com a margem precisa caber inteiramente na tela original. Se ultrapassar a imagem, reduza a margem ou ajuste a seleção. O script não inventa, estica ou preenche conteúdo externo. Esta versão trabalha com uma tela única e recusa documentos com pranchetas.

O original continua aberto e conserva sua imagem e suas camadas. Nele são alteradas apenas as guias e a seleção total, agrupadas no Histórico. A cópia fica ativa e ainda não salva, com um nome como `Arte_remendo`; remendos já abertos recebem um sufixo numérico para diferenciar os documentos.

Para mostrar as guias no Photoshop: **Exibir → Mostrar → Guias**.

## 2. Photoshop — sangria por guias e tamanho da tela

1. Abra a arte **no tamanho de corte**, antes de adicionar sangria.
2. Execute `sangria-guias-canvas.jsx`.
3. Informe a sangria por lado e confira a prévia numérica. O valor inicial de 3 mm é editável; use a medida exigida para o trabalho.
4. Clique em **Criar sangria**. A opção **Aplicar em uma cópia** começa marcada.
5. Prolongue fundos e imagens até a borda externa e salve o PSD.

O script acrescenta o dobro da sangria à largura e à altura, mantém a arte centralizada e cria quatro guias do corte e quatro da borda externa. As guias são calculadas nas coordenadas da tela final. Posições que já têm guias não são duplicadas.

**Exemplo exato em pixels:** uma tela de **1000 × 600 px**, com **20 px de sangria por lado**, passa a **1040 × 640 px**. O corte fica em X = 20 e 1020; Y = 20 e 620.

Para manter margens simétricas em pixels inteiros, a conversão física é arredondada para cima. Assim, **3 mm a 300 ppi → 36 px → 3,048 mm por lado**. O diálogo informa a medida efetivamente aplicada antes da execução.

O tamanho da arte e sua resolução permanecem iguais. A expansão segue o comportamento de [Tamanho da tela do Photoshop](https://helpx.adobe.com/photoshop/using/adjusting-crop-rotation-canvas.html): sem camada Plano de Fundo, a faixa nova é transparente; com Plano de Fundo, ela pode ser preenchida com uma cor.

**A faixa adicional precisa ser ocupada pela arte.** Criar uma área transparente ou de cor sólida não prolonga automaticamente uma foto ou ilustração. As guias também não geram marcas de corte impressas nem configuram caixas de corte/sangria em um PDF.

Esta versão trabalha com **uma tela única** e recusa documentos com pranchetas. Cada execução acrescenta outra sangria: para trocar a medida, volte ao documento no tamanho de corte ou desfaça a operação anterior. O resultado não é salvo automaticamente.

## 3. Illustrator — seleção + margem

1. Selecione um ou mais objetos inteiros com a ferramenta Seleção (`V`).
2. Execute `guias-selecao-margem.jsx`.
3. Escolha margem, unidade, direção e se deseja incluir a espessura dos traços.
4. Clique em **Criar guias**.

O script mede o **conjunto selecionado**, não cada objeto separadamente. Ele cria guias reais em uma nova camada bloqueada chamada **Guias — seleção + margem**. As linhas atravessam a região das pranchetas e da seleção. As camadas da arte e as guias anteriores são preservadas.

Grupos com máscara de recorte usam o retângulo da própria máscara, mesmo que a arte interna seja menor. Objetos girados usam limites horizontais/verticais. A opção de traços utiliza os limites visíveis informados pelo Illustrator; máscaras de opacidade e efeitos vivos complexos não recebem um tratamento específico nesta versão.

No Illustrator, a conversão do script usa **72 pt por polegada**, com **1 px = 1 pt**, independentemente da resolução de efeitos de rasterização. Para impressão, prefira informar a margem em mm ou cm.

Para visualizar: **Exibir → Guias → Mostrar guias**. Para remover o conjunto, desbloqueie e exclua a camada criada. Uma nova execução cria outra camada e pode sobrepor guias de execuções anteriores.

## Instalação fixa e desfazer

No Photoshop, você pode copiar os dois arquivos para **Presets/Scripts** dentro da pasta do aplicativo e reiniciar o programa para exibi-los no menu. O uso por **Procurar…** dispensa essa instalação.

No Photoshop, as guias e a seleção do original são agrupadas no Histórico. Desfazer essa etapa restaura o original, mas não fecha um remendo já criado: ele é um documento independente. Em caso de erro na criação, o script tenta restaurar o original e fechar a cópia incompleta. A sangria mantém seu próprio agrupamento no Histórico.

No Illustrator, a recuperação de erro remove a camada de guias que estava sendo criada. O script restaura o sistema de coordenadas e a seleção anteriores.

## Se aparecer um erro

Envie a mensagem completa, o nome do script, a versão do aplicativo e uma captura do documento. Os erros tratados incluem a linha quando o aplicativo a fornece. O arquivo [guias-e-sangria-validacao.md](guias-e-sangria-validacao.md) registra os testes locais e exemplos para conferir dentro dos aplicativos.

## Desenvolvimento e testes

```bash
npm run catalog
npm test
```

Os três scripts continuam independentes, com os auxiliares incorporados em cada arquivo. `tools/test-guias.cjs` lê os arquivos reais em `apps/`, executa os cálculos e simula os contratos dos aplicativos. São 40 verificações locais, incluindo as de extração de remendos. Elas não substituem a conferência no Photoshop e no Illustrator.
