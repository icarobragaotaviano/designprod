# Ferramentas vetoriais multiplataforma

Três rotinas de produção gráfica implementadas para **Adobe Illustrator** (`.jsx`), **CorelDRAW** (`.bas`), **Affinity** (`.js`, SDK Beta 3.3+) e **TraceDraw** (`.js`, painel Scripts):

1. **Margem de segurança (guias)** — cria guias internas recuadas das bordas da prancheta ou página ativa (oposto da sangria), com opção multi-prancheta/página conforme a API do host.
2. **Texto com dimensões do objeto** — lê a caixa delimitadora combinada da seleção, converte para `mm`, `cm`, `m`, `px`, `in` ou `pt`, e gera um rótulo tipográfico na camada de textos (`01_TEXTOS`).
3. **Deslocamento, expandir e contorno** — gera o caminho deslocado para fora (`+`) ou para dentro (`-`), converte em traço sem preenchimento com cor CMYK/RGB e espessura configurável.

---

## Como instalar e executar em cada aplicativo

| Plataforma | Arquivo | Onde instalar / executar |
| --- | --- | --- |
| **Adobe Illustrator** | `.jsx` | *Arquivo > Scripts > Outro Script...* (ou via `npm run install:dev`) |
| **CorelDRAW** | `.bas` | Abra o editor VBA (`Alt + F11`), selecione **GlobalMacros**, clique com o botão direito > *Importar Arquivo...* e execute pela janela *Scripts / Macros* |
| **Affinity (3.3+)** | `.js` | *Janela > Scripts* (Scripting Studio Beta). Em documentos com pranchetas, selecione a prancheta antes de rodar guias |
| **TraceDraw** | `.js` / `.bas` | Painel **Scripts** (ajuste as constantes no topo do `.js` e clique em **Run**) ou importe os `.bas` no **Macro Manager** |

---

## Comportamento e limites por API (documentação oficial)

- **Adobe Illustrator (ExtendScript ES3):**
  - `margem-seguranca-guias.jsx` usa `CoordinateSystem.DOCUMENTCOORDINATESYSTEM` ao ler `artboardRect`, restaura o bloqueio da camada `06_GUIAS` e suporta prancheta ativa ou todas.
  - `texto-dimensoes-objeto.jsx` suporta *Visible Bounds* ou *Geometric Bounds*, vírgula ou ponto decimal, e reposiciona o texto pela caixa real criada.
  - `deslocamento-expandir-contorno.jsx` aplica `Adobe Offset Path` via `applyEffect`, expande com `app.executeMenuCommand('expandStyle')` e, opcionalmente, unifica múltiplos objetos com `Live Pathfinder Add`.

- **CorelDRAW (VBA `.bas`):**
  - Salvos como módulos `.bas` em texto puro (`Attribute VB_Name`) prontos para importar em `GlobalMacros.gms` ou no **Macro Manager** do TraceDraw.
  - `margem-seguranca-guias.bas` usa os limites reais da página (`pg.LeftX`, `pg.RightX`, `pg.BottomY`, `pg.TopY`) com `Layer.CreateGuide(x1, y1, x2, y2)` (assinatura oficial de 4 coordenadas), preservando `doc.Unit` e encapsulando tudo em um único *Undo* (`BeginCommandGroup`).
  - `deslocamento-expandir-contorno.bas` usa `Shape.CreateContour`, `Effect.Separate`, unificação opcional por `Weld` e `Outline.SetProperties` temporariamente em `cdrPoint` para consistência de espessura em pontos.

- **Affinity (JavaScript — API Beta 3.3+):**
  - `margem-seguranca-guias.js` e `texto-dimensoes-objeto.js` usam `Dialog`, `DocumentCommand.createAddGuide`, `CompoundCommandBuilder`, `StoryBuilder` e `ArtTextNodeDefinition.createFromStoryBuilder`. Em documentos com pranchetas, as guias pertencem à prancheta em foco (limitação documentada da API do Affinity).
  - **Limitação da SDK Beta 3.3+ em contorno/expansão:** a API JavaScript atual do Affinity não expõe comandos para a ferramenta *Contour* nem para *Expand Stroke*. Por isso, `deslocamento-expandir-contorno.js` realiza deslocamento geométrico exato em retângulos e elipses e amostragem poligonal adaptativa com cantos *Mitra / Arredondado / Chanfrado* em curvas de Bézier, aplicando `FillDescriptor.createNone()` e `LineStyleDescriptor` em um novo `PolyCurveNodeDefinition`.

- **TraceDraw (JavaScript — painel Scripts):**
  - O painel **Scripts** executa JavaScript puro em unidade nativa **milímetros**, origem no canto inferior esquerdo com eixo **Y para cima**, sem caixas de diálogo modais — cada script traz um bloco de constantes editáveis no topo.
  - O modelo do painel Scripts não expõe `AddGuide` nativo nem `Effect.Separate`; por isso `margem-seguranca-guias.js` cria um quadro sem preenchimento na camada bloqueada `06_GUIAS`, e `deslocamento-expandir-contorno.js` lê `Shape.PathData` (SVG) e reconstrói a curva deslocada via `ActiveLayer.CreatePath(...)`. Para usar guias nativas e `CreateContour` nativo dentro do TraceDraw, importe os arquivos `.bas` de `apps/coreldraw/scripts/` no **Macro Manager**.

---

## Verificação realizada

As 12 ferramentas foram validadas localmente via `npm test` (`tools/validate.mjs`, `tools/test-standalone.cjs` e `tools/test-vetor.cjs`) quanto a metadados, geração de pacotes independentes, sintaxe ES3/JS/VBA, geometria e simulação dos contratos de DOM de cada plataforma. A execução direta dentro dos aplicativos desktop instalados (Illustrator, CorelDRAW, Affinity e TraceDraw) deve ser conferida visualmente no ambiente de produção.
