# Kit de guias e sangria — Photoshop e Illustrator

Versão 1.0 · 21/09/2026 · Caixas de diálogo em português.

Três scripts `.jsx` independentes para os aplicativos Adobe de desktop. Cada arquivo funciona sozinho, sem instalar plugin ou copiar outros arquivos junto dele.

**Estado desta entrega:** código e cálculos verificados localmente; a execução e a aparência dos diálogos dentro do Photoshop e do Illustrator ainda precisam ser validadas. Não há garantia de compatibilidade com uma versão específica sem esse teste.

A [primeira entrega em ZIP](../downloads/kit-guias-e-sangria-v1.zip) também está preservada. Dentro dela, os nomes originais e o `LEIA-ME.md` continuam correspondentes entre si. Neste repositório, os nomes seguem a convenção em minúsculas e os scripts incluem os metadados `@ibd-*` para o catálogo.

## Comece por aqui

1. Baixe ou clone este repositório.
2. Abra o documento no aplicativo correspondente.
3. Execute o arquivo pelo menu indicado abaixo.

| Aplicativo | Arquivo | Resultado |
|---|---|---|
| Photoshop | `apps/photoshop/scripts/guias-selecao-margem.jsx` | Guias nos limites da seleção e na margem escolhida. |
| Photoshop | `apps/photoshop/scripts/sangria-guias-canvas.jsx` | Aumenta a tela e cria guias do corte e da borda da sangria. |
| Illustrator | `apps/illustrator/scripts/guias-selecao-margem.jsx` | Guias nos limites do conjunto selecionado e na margem escolhida. |

**Photoshop:** Arquivo → Scripts → Procurar… → escolha o `.jsx`. Esse é o caminho documentado pela [Adobe para executar scripts externos](https://helpx.adobe.com/photoshop/using/scripting.html).

**Illustrator:** Arquivo → Scripts → Outro script… → escolha o `.jsx`. Veja a [orientação da Adobe para scripts do Illustrator](https://helpx.adobe.com/illustrator/desktop/automate-visualize-data/automate-actions/install-and-run-scripts.html).

## 1. Photoshop — seleção + margem

1. Faça uma seleção com o Letreiro (`M`). Para usar a área ocupada por uma camada, use **Ctrl/Cmd + clique na miniatura da camada**.
2. Execute `guias-selecao-margem.jsx`.
3. Digite a margem de cada lado, escolha a unidade e a direção. Clique em **Criar guias**.

| Opção | Guias previstas |
|---|---|
| Externa | 4 nos limites originais + 4 para fora. |
| Interna | 4 nos limites originais + 4 para dentro. |
| Interna e externa | 4 originais + 4 internas + 4 externas. |
| Margem zero | Apenas as 4 originais. |

Aceita **mm, cm, px e pt**, com vírgula ou ponto decimal. A margem é uniforme nos quatro lados. No Photoshop, as medidas físicas consideram a resolução atual do documento.

Guias que já ocupam a mesma posição são reutilizadas. As demais guias são preservadas. Uma margem interna que eliminaria a área útil é recusada antes de aplicar.

O script usa o retângulo que envolve toda a seleção, inclusive quando ela é circular, irregular ou tem várias partes. As guias são horizontais e verticais; não acompanham um contorno. Selecionar somente o nome de uma camada no painel não cria uma seleção de pixels.

Se a margem externa sair do documento, as guias poderão ficar fora da tela. Esse script não aumenta o documento. Para visualizar as guias: **Exibir → Mostrar → Guias**.

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

No Photoshop, as alterações são agrupadas no Histórico com o nome da operação, permitindo desfazer o conjunto. Em caso de erro, o script tenta restaurar o estado anterior; na sangria feita em cópia, tenta fechar somente a cópia temporária.

No Illustrator, a recuperação de erro remove a camada de guias que estava sendo criada. O script restaura o sistema de coordenadas e a seleção anteriores.

## Se aparecer um erro

Envie a mensagem completa, o nome do script, a versão do aplicativo e uma captura do documento. Os erros tratados incluem a linha quando o aplicativo a fornece. O arquivo [guias-e-sangria-validacao.md](guias-e-sangria-validacao.md) registra os testes locais e exemplos para conferir dentro dos aplicativos.

## Desenvolvimento e testes

```bash
npm run catalog
npm test
```

Os três scripts continuam independentes, com os auxiliares incorporados em cada arquivo. `tools/test-guias.cjs` lê os arquivos reais em `apps/`, executa os cálculos e simula os contratos dos aplicativos. Ele não substitui a conferência no Photoshop e no Illustrator.
