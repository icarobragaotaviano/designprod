# Auto layout v2 — o comportamento do Figma no Photoshop

Especificação e plano da segunda geração do auto layout. A primeira ([auto-layout.md](auto-layout.md)) arruma camadas em linha ou coluna e guarda a regra no nome do grupo. A v2 traz o resto do modelo do Figma: cada filho com a sua medida, limites, itens fora do fluxo, quadro visível e recálculo ao vivo.

Este documento é a fonte única do plano. Decisões de arquitetura ficam em [arquitetura.md](arquitetura.md) (decisões 7, 8 e 10); o uso das ferramentas atuais, em [auto-layout.md](auto-layout.md).

---

## Decisões tomadas

| Decisão | Escolha | Por quê |
|---|---|---|
| Onde ficam as propriedades do **quadro** | No nome do grupo, `@auto[...]`, como hoje | O grupo continua mostrando que é um quadro |
| Onde ficam as propriedades de **cada filho** | No metadado XMP da camada | Etiqueta em toda camada viraria sopa no painel Camadas — decisão 10 |
| Meta de experiência | **Recálculo ao vivo** num painel UXP; "Reaplicar" continua como alternativa | É o que faz parecer Figma |
| Grade (`display: grid`) | **Fora da v1** | Fixo/Abraçar/Preencher com quebra de linha já cobrem cartões, barras e listas; a Grade dobra o escopo |

## Do Figma para o Photoshop

| Figma | CSS equivalente | No motor | Situação |
|---|---|---|---|
| Fluxo horizontal/vertical, espaço, preenchimento | `flex-direction`, `gap`, `padding` | `direcao`, `gap`, `padding` | ✅ v1 |
| Quebra de linha | `flex-wrap` | `quebra`, `gapLinha` | ✅ v1 |
| Entre / uniforme / ao redor | `space-between/evenly/around` | `distribuicao` | ✅ v1 |
| Espaço automático nunca negativo | — (border-box) | limitado em 0; itens encostam a partir do início | ✅ Fase 1 |
| Item único em "Entre" vai para o início | — | idem | ✅ Fase 1 |
| **Fixo / Abraçar / Preencher por filho** | `flex: 0 0 auto` / `auto` / `flex: 1` | `largura`, `altura` do item | ✅ Fase 1 (motor) |
| Mínimo e máximo do filho | `min-/max-width/height` | `minLargura`… do item | ✅ Fase 1 |
| Mínimo e máximo do quadro | idem no contêiner | `minLargura`… do quadro, `minw`… na etiqueta | ✅ Fase 1 |
| Ignorar auto layout | `position: absolute` | `absoluto`, `ancora` | ✅ Fase 1 |
| Linha de base do texto | `align-items: baseline` | `alinhamento: 'base'` + `linhaBase` do item | ✅ Fase 1 (motor) |
| Contorno interno conta, externo não | `border` × `outline` | "medir com efeitos" desligado = efeito fica de fora | ✅ v1 |
| Preenchimento irredutível | border-box | o motor recusa em vez de esmagar | ✅ v1 — diferença consciente, ver abaixo |
| Fundo e contorno do quadro | `background`, `border-radius` | camada de fundo convencionada | ⏳ Fase 2 |
| Ordem de empilhamento | `z-index` | ordem das camadas ≠ ordem do fluxo | ⏳ Fase 2 |
| Recálculo ao vivo | — | painel UXP ouvindo edições | ⏳ Fase 3 |
| Grade, `fr`, ocupação de várias células | `display: grid`, `span` | — | 🚫 fora da v1 |
| Tokens de espaçamento | variables | — | futuro |
| Slots, componentes | — | objeto inteligente vinculado | futuro |

**Diferença consciente — preenchimento maior que o quadro.** No Figma, o quadro cresce para caber o preenchimento. O motor **recusa** e não move nada. No Photoshop, deixar passar significaria reposicionar arte com um quadro impossível — o erro com mensagem é mais seguro.

## Propriedades do filho

Cada filho do quadro aceita:

| Propriedade | Valores | Padrão |
|---|---|---|
| `largura`, `altura` | `fixo` · `abracar` · `preencher` | `abracar` |
| `minLargura`, `maxLargura`, `minAltura`, `maxAltura` | px, ou vazio = sem limite | vazio |
| `absoluto` | fica fora do fluxo | não |
| `ancora` | `{h: esquerda·centro·direita, v: topo·centro·base, dx, dy}` | a distância atual até o canto superior esquerdo |

**Fixo** mantém a medida medida. **Abraçar** também, mas obedece a mínimo e máximo — no Photoshop "o conteúdo" de uma camada é a própria camada. **Preencher** reparte a sobra do quadro com o algoritmo do `flex-grow`: quem bate no limite fica preso nele e o resto é redividido entre os demais. Preencher nunca leva uma camada abaixo de 1 px.

Preencher no eixo principal exige quadro de medida fixa (ajuste "Manter a área atual", quebra de linha, ou mínimo/máximo que fixe o eixo). Num quadro que abraça, o motor avisa e mantém a medida — o Figma também não permite essa combinação.

### O formato gravado no XMP

Mesmo estilo da etiqueta do quadro, sem o `@auto[...]`. Só entra o que foge do padrão:

```
w=preencher;h=fixo;maxw=320;abs=1;ancora=direita,topo,8,8
```

`IBD.layout.montarItem(props)` escreve e `IBD.layout.lerItem(texto)` lê. Texto torto é recusado com mensagem, nunca adivinhado — a mesma regra da etiqueta do quadro.

## "Preencher" depende do tipo de camada

No Figma redimensionar nunca perde qualidade; no Photoshop perde, conforme a camada. O motor calcula a medida; o adaptador da Fase 2 decide como aplicar:

| Camada | Como aplicar Preencher | Custo |
|---|---|---|
| Forma (vetor) | muda a geometria | nenhum |
| Texto de parágrafo | muda a **caixa**; o texto reflui | nenhum |
| Texto de ponto | só posiciona | não se aplica |
| Objeto inteligente | escala | aceitável |
| Pixel | **recusado por padrão** | reamostragem |

---

## Fases

### Fase 0 — validar a v1 no Photoshop real

Os três scripts de auto layout nunca rodaram dentro do Photoshop, e o Illustrator acabou de mostrar o que o DOM simulado deixa passar.

**Pronto quando:** `auto-layout`, `auto-layout-reaplicar` e `alinhar-distribuir` tiverem rodado uma vez num PSD real, cada um com o roteiro de [auto-layout.md](auto-layout.md#testar).

### Fase 1 — motor com o comportamento do Figma ✅

Código puro em `core/extendscript/ibd-layout.jsx`, sem nenhuma chamada da Adobe. Feito:

- Fixo/Abraçar/Preencher por filho, nos dois eixos
- mínimo e máximo do filho e do quadro — o quadro que abraça e fura o próprio limite é recalculado com a medida limitada, e por isso "Centro" funciona dentro de uma largura mínima
- filho absoluto fora do fluxo e fora da caixa do quadro, com âncora
- espaço automático limitado em 0; item único em "Entre" no início
- alinhamento pela linha de base, com a medida vinda do adaptador
- formato de texto das propriedades do filho, pronto para o XMP

**Critério cumprido:** 21 verificações novas em `npm run test:layout` (72 no total), e as 51 anteriores passam sem alteração — os três scripts atuais se comportam exatamente como antes. Seis mutações no motor (tirar o limite em 0, desligar o congelamento do flex, devolver o absoluto ao fluxo, ignorar a linha de base, ignorar os limites do quadro e os do filho) derrubam pelo menos um teste cada.

**O que a Fase 1 não muda:** nenhum script expõe as propriedades novas ainda. Elas existem no motor e esperam o adaptador.

### Fase 2 — adaptador por tipo de camada e quadro visível

- ler e gravar as propriedades do filho no XMP da camada (Action Manager, `layerXMP`)
- aplicar Preencher segundo a tabela acima; pixel recusado com mensagem
- medir a linha de base das camadas de texto
- **camada de fundo:** a camada mais de baixo do grupo, com nome `fundo`, sai do fluxo e é redimensionada para a caixa do quadro, preenchimento incluído — é o que dá ao grupo um fundo com cantos arredondados que acompanha o conteúdo
- testes com o DOM simulado no padrão dos atuais

**Pronto quando:** um cartão com fundo arredondado, título e botão cresce certo quando o texto do título muda — no DOM simulado e num PSD real.

### Fase 3 — painel Auto Layout ao vivo (UXP)

- painel com as propriedades do quadro e do filho selecionado, como o do Figma
- recálculo automático ao editar texto, mover ou redimensionar uma camada de quadro
- espera curta para juntar edições seguidas; um único passo de histórico por recálculo
- o mesmo `ibd-layout.jsx` carregado no UXP — um motor, dois ambientes (decisão 7)
- "Reaplicar" continua existindo para quem não usa o painel

**Pronto quando:** editar o texto de um botão dentro de um quadro reflui a fila sem nenhum clique, em menos de meio segundo num PSD de produção.

### Fase 4 — Grade (depois da v1)

Colunas e linhas, unidades `fr`, ocupação de várias células. Só quando as fases 1 a 3 estiverem em uso real.

## Riscos

| Risco | Onde pega | Mitigação |
|---|---|---|
| Desempenho do recálculo ao vivo em PSD grande | Fase 3 | espera curta, recalcular só o quadro tocado e os de fora dele; medir num arquivo real antes de prometer |
| XMP de camada lido de forma diferente entre versões do Photoshop | Fase 2 | falha explícita com mensagem; a regra do quadro continua no nome e sobrevive |
| Leitura da seleção múltipla pelo Action Manager | todas | já é o ponto frágil conhecido; a Fase 0 confere |
| DOM simulado mais generoso que o app | todas | nenhuma fase fecha sem uma execução real |
| Trabalho paralelo no repositório | todas | a v2 fica em `core/extendscript/`, `apps/photoshop/scripts/auto-layout*` e `plugins/photoshop-uxp/`; nada na raiz além do catálogo gerado |
