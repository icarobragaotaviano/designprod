# Auto layout no Photoshop

Família de ferramentas que traz para o Photoshop o que o auto layout do Figma faz: **o grupo é o quadro, as camadas de dentro são os itens, e a regra de arrumação fica guardada** para ser reaplicada quando o conteúdo mudar.

O Photoshop não tem motor de layout. Ele alinha camadas pela barra de opções e distribui espaço igual — e para por aí. Trocar um texto por um mais longo desalinha a fila inteira, e refazer é trabalho manual a cada rodada de alteração. Esta família fecha essa lacuna.

---

## O modelo

```
Grupo "Cartões @auto[dir=h;gap=24;pad=32]"     ← o quadro, com a regra no nome
  ├── Cartão 3                                  ← itens, na ordem do painel
  ├── Cartão 2
  └── Cartão 1
```

Três decisões que valem para tudo aqui:

1. **O quadro é um grupo de camadas.** Sem grupo não há onde guardar a regra — as camadas ainda são posicionadas, mas a arrumação não pode ser repetida depois.
2. **A âncora é o canto superior esquerdo.** O conteúdo é arrumado a partir de onde ele já está; o quadro cresce para a direita e para baixo. Nada salta para o meio da tela.
3. **A regra mora no nome do grupo.** Quem abre o PSD vê a regra no painel Camadas e pode apagá-la à mão. Não há banco de dados paralelo nem metadado invisível.

## As três ferramentas

| Ferramenta | Quando usar |
|---|---|
| **Auto layout do quadro** | Definir a regra: direção, espaço, preenchimento, alinhamento, distribuição, quebra |
| **Reaplicar auto layout** | Depois de editar o conteúdo — recalcula todos os quadros etiquetados do documento |
| **Alinhar e distribuir camadas** | Ajuste pontual em camadas soltas, sem criar quadro, com espaço fixo em mm |

Todas rodam por `Arquivo > Scripts` ou pelo painel IBD Ferramentas.

---

## Auto layout do quadro

Selecione o grupo no painel Camadas e rode. Se selecionar camadas soltas em vez de um grupo, elas são posicionadas do mesmo jeito, mas a regra não é guardada.

### Parâmetros

| Campo | O que faz |
|---|---|
| **Direção** | Horizontal (em linha) ou vertical (em coluna) |
| **Unidade** | px, mm, cm ou pt. Medidas físicas usam a resolução do documento |
| **Espaço entre itens** | A distância entre uma peça e a seguinte |
| **Preenchimento** | Margem interna do quadro. `24`, `24 40` (vertical, horizontal) ou `24 40 16 40` (topo, direita, base, esquerda) |
| **Eixo principal** | Onde o bloco fica quando sobra espaço: Início, Centro, Fim, ou reparte a sobra com Espaço entre / ao redor / uniforme |
| **Eixo transversal** | Alinhamento das peças de alturas diferentes: Início, Centro, Fim ou Esticar |
| **Medida do quadro** | *Abraçar o conteúdo* (o quadro encolhe até o conteúdo) ou *Manter a área atual* (o quadro fica do tamanho que já tem) |
| **Quebrar em** | Medida a partir da qual os itens passam para a linha seguinte. `0` não quebra |
| **Espaço entre linhas** | Só vale quando há quebra |
| **Ordem dos itens** | Do documento (de cima para baixo no painel) ou inversa |
| **Medir incluindo efeitos** | Sombra, brilho e traço entram na medida da peça |
| **Incluir camadas ocultas** | Por padrão camada oculta fica parada |
| **Deixar "Esticar" alterar o tamanho** | Sem isso, Esticar só alinha. Com isso, camadas de pixel são reamostradas |
| **Guardar a regra no nome do grupo** | O que permite reaplicar depois |

### As opções de espaço precisam de um quadro fixo

*Espaço entre*, *ao redor* e *uniforme* repartem a sobra — e só há sobra quando o quadro tem medida própria. Com *Abraçar o conteúdo*, o script usa a área atual do conjunto como quadro e avisa no relatório. Para controlar a medida, use *Manter a área atual* ou defina uma quebra.

---

## Reaplicar auto layout

O passo que faltava. Editou um texto, trocou uma foto, mudou a largura de uma peça: rode e toda a fila volta ao lugar.

- Varre o documento procurando grupos com a etiqueta `@auto`.
- Recalcula do **mais interno para o mais externo** — um quadro aninhado é resolvido antes do quadro que o contém, para o de fora medir o filho já no tamanho novo.
- Tudo em um único passo de histórico: um Ctrl+Z desfaz a reaplicação inteira.
- Quadro com etiqueta corrompida entra no relatório e não impede os outros.

## Alinhar e distribuir camadas

Para as vezes em que criar um quadro é demais. Selecione duas ou mais camadas.

**Alinhar em relação a:** a área das camadas selecionadas, a tela do documento, ou a camada ativa — que serve de referência e fica parada, como o objeto-chave do Illustrator.

**Distribuir:** espaço igual entre bordas, centros igualmente espaçados, ou **espaço fixo** em mm — o que a arte-final precisa e o Photoshop não oferece. A distribuição roda depois do alinhamento e mantém a primeira e a última peça no lugar.

---

## A etiqueta `@auto`

```
Cartões @auto[dir=h;gap=24;pad=32;al=centro]
```

Fica no fim do nome do grupo e guarda só o que foge do padrão. Valores sempre em **pixels do documento** — assim a reaplicação não muda de resultado se o documento for reamostrado depois; `un=mm` registra apenas em que unidade o formulário deve reabrir.

| Chave | Significado | Padrão |
|---|---|---|
| `dir` | `h` horizontal, `v` vertical | `h` |
| `gap` | espaço entre itens, em px | `0` |
| `gapl` | espaço entre linhas, em px | igual a `gap` |
| `pad` | preenchimento: um valor, ou `topo,direita,base,esquerda` | `0` |
| `dist` | `inicio`, `centro`, `fim`, `entre`, `aoredor`, `uniforme` | `inicio` |
| `al` | `inicio`, `centro`, `fim`, `esticar` | `inicio` |
| `quebra` | medida da quebra em px; `0` não quebra | `0` |
| `ordem` | `doc` ou `inv` | `doc` |
| `ajuste` | `conteudo` ou `caixa` | `conteudo` |
| `un` | unidade do formulário | `px` |

Editar a etiqueta à mão funciona. Apagá-la tira o grupo da reaplicação, sem desfazer nada. Etiqueta escrita errado é recusada com mensagem — o script não adivinha.

---

## O que fica de fora do layout

Cada exclusão aparece no relatório com o motivo:

| Situação | Por quê |
|---|---|
| Camada oculta | Não se move o que não se vê, a menos que você peça |
| Camada bloqueada ou com posição travada | O bloqueio é uma decisão sua |
| Camada Plano de Fundo | O Photoshop não permite movê-la |
| Camada vazia | Não tem pixels para medir |

## Limites conhecidos

- **Ainda não foi executado dentro do Photoshop.** A lógica passa em 51 verificações locais com o DOM simulado (`npm run test:layout`), mas os scripts foram escritos contra a API documentada. Rode cada um uma vez antes de confiar em produção.
- **A leitura da seleção múltipla** usa o Action Manager (`targetLayers`), porque o DOM legado só expõe uma camada ativa. A conversão de índice para camada muda conforme o documento tenha ou não Plano de Fundo; é o ponto mais provável de divergência entre versões do Photoshop. Quando a leitura falha, o script cai na camada ativa sozinha em vez de errar silenciosamente.
- **Esticar reamostra pixels.** Em camada rasterizada, esticar degrada. Em objeto inteligente, não. Por isso o redimensionamento é opt-in.
- **Pranchetas não são tratadas como quadro.** Um grupo dentro de uma prancheta funciona normalmente; a prancheta em si não vira quadro de auto layout.
- **Texto não reflui.** O layout mede a caixa da camada como ela está. Trocar o texto muda a medida — é exatamente para isso que existe o reaplicar.

## Testar

```bash
npm run test:layout     # 51 verificações: motor, etiqueta e os três scripts
npm test                # tudo: validação do repositório + guias + layout
```

As verificações cobrem as contas do motor (posição, preenchimento, quebra, distribuição, arredondamento), a ida e volta da etiqueta, e os três scripts completos contra um Photoshop simulado — incluindo cancelamento, camada bloqueada, falha no meio do passo com reversão do histórico e quadros aninhados.

Dentro do Photoshop, antes de marcar como pronto:

1. Um grupo com três camadas de alturas diferentes, alinhamento Centro.
2. O mesmo grupo depois de trocar o conteúdo de uma camada — rode o reaplicar.
3. Um grupo com camada oculta, bloqueada e com Plano de Fundo no documento.
4. Quebra em uma medida que force três linhas.
5. Confira se a régua voltou à unidade que estava antes.
