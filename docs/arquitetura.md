# Arquitetura

Registro das decisões estruturais e do motivo de cada uma. Serve para não reabrir discussão encerrada.

## 1. Monorepo, não um repositório por app

**Decisão:** tudo em `designprod`.

Os scripts de Photoshop, Illustrator e InDesign compartilham a mesma biblioteca (`core/`), o mesmo padrão de formulário e o mesmo catálogo. Repositórios separados obrigariam a versionar e publicar `core/` como pacote, o que é overhead sem ganho para um estúdio de uma pessoa.

**Quando reavaliar:** se um plugin virar produto vendido com ciclo de release próprio, ele sai para um repositório próprio consumindo `core/` publicado.

## 2. `catalog.json` é o contrato

**Decisão:** o catálogo é gerado a partir dos metadados `@ibd-*` no cabeçalho de cada script, nunca escrito à mão.

Sem isso, cada plugin novo viraria uma lista de ferramentas mantida em paralelo — cinco apps, cinco listas desatualizando em ritmos diferentes. Com o catálogo, o painel de qualquer app é um leitor genérico: filtra por `app` e desenha o que encontrar.

Consequência prática: **metadado incompleto quebra o CI**. É proposital.

## 3. ExtendScript primeiro, UXP como camada de interface

**Decisão:** a lógica de produção vive em `.jsx`; o plugin é interface.

ExtendScript roda hoje em Photoshop, Illustrator, InDesign, After Effects, Premiere e Bridge. UXP não cobre todos esses apps (veja [guia-uxp.md](guia-uxp.md)). Escrever a lógica em UXP hoje significaria reescrevê-la para cada app que ainda não a suporta.

**Exceção:** ferramenta que só mexe em camada do Photoshop nasce em UXP (`plugins/photoshop-uxp/src/lib/ferramentas-uxp.js`), porque a API é suportada e o resultado é mais rápido e mais estável que a ponte.

## 4. Lançadores em vez de cópias

**Decisão:** `install:dev` grava na pasta do app um arquivo de uma linha com `#include` apontando para o repositório.

Copiar o `.jsx` criaria uma segunda cópia para manter e quebraria os `#include` relativos ao `core/`. Com o lançador, editar o script aqui já vale na próxima execução dentro do app.

## 5. Marca em um arquivo só

**Decisão:** `brand.config.json` guarda nome, cores e versão; `build:plugin` propaga para o CSS e o manifest.

Trocar a identidade visual dos painéis é editar um arquivo e rodar um comando, em vez de caçar hex code em cada plugin.

## 6. Português nos nomes, sem acento em identificador

Rótulos de interface, documentação e comentários em português. Nomes de arquivo, `@ibd-id` e chaves de objeto sem acento e sem espaço — ExtendScript e sistemas de arquivo de três plataformas diferentes tratam acento de forma inconsistente.

## 7. Motor de layout separado do app

**Decisão:** as contas do auto layout vivem em `core/extendscript/ibd-layout.jsx`, que não chama nenhuma API da Adobe. Quem fala com o Photoshop é `ibd-ps-camadas.jsx`.

A regra 3 diz que ferramenta que só mexe em camada do Photoshop nasce em UXP. O auto layout é a exceção, por dois motivos: o mesmo motor vai atender Illustrator e InDesign, que não têm UXP equivalente, e um motor puro pode ser testado inteiro fora da Adobe — as 51 verificações de `npm run test:layout` rodam em Node, incluindo os três scripts completos contra um DOM simulado.

Se o motor dependesse do app, cada conta só poderia ser conferida abrindo o Photoshop. É a diferença entre um erro de arredondamento aparecer no CI e aparecer na gráfica.

**Quando reavaliar:** se o motor precisar de medida que só o UXP expõe (por exemplo, métrica de texto ao vivo), o adaptador cresce; o motor continua onde está.

## 8. A regra do quadro mora no nome do grupo

**Decisão:** a especificação do auto layout é gravada como `@auto[...]` no fim do nome do grupo.

As alternativas eram metadado XMP no documento ou um arquivo ao lado do PSD. XMP é invisível para quem abre o arquivo e some em vários caminhos de exportação; arquivo ao lado se separa do PSD no primeiro envio por e-mail.

No nome, a regra viaja junto com o documento, aparece no painel Camadas, pode ser editada e apagada à mão, e sobrevive a quem não tem os scripts instalados. O custo é um nome de grupo mais longo — aceitável perto de perder a regra.

**Consequência prática:** etiqueta escrita errado é recusada com mensagem, nunca adivinhada. Um quadro com etiqueta corrompida entra no relatório e não impede a reaplicação dos outros.

## 9. A vitrine web é mais um leitor do catálogo

**Decisão:** o site publicado na Vercel monta a lista a partir de `catalog.json`, como o painel UXP. A pasta de saída sai do `outputDirectory` do `vercel.json`, e não de uma constante no builder.

Uma página com a lista de ferramentas escrita à mão seria a quarta cópia da mesma informação — depois do menu do app, do painel e do README — e a primeira a desatualizar, porque ninguém roda o site no dia a dia. Lendo o catálogo, publicar uma ferramenta nova é `npm run catalog` e um push.

O mesmo raciocínio vale para a pasta de saída: se o builder tivesse a sua e o `vercel.json` a dele, o deploy quebraria em silêncio no dia em que uma das duas mudasse. Hoje `npm run validate` ainda confere se o `buildCommand` do `vercel.json` existe no `package.json`.

**Consequência:** o site precisa de dados que não são do catálogo — o arquivo pronto para baixar e qual é a documentação da ferramenta. O primeiro é derivado no build, resolvendo os `#include` do script; o segundo virou o campo opcional `@ibd-doc`, validado no CI. Nada disso é escrito duas vezes.

A decisão 4 continua valendo dentro do repositório: `install:dev` grava lançadores, não cópias. O arquivo com a biblioteca embutida existe só na saída do site, para quem não tem o repositório — e é gerado, nunca versionado, então não vira uma segunda cópia para manter.

## 10. As propriedades de cada filho moram no XMP da camada

**Decisão:** o quadro continua com a regra no nome do grupo (decisão 8). Já as propriedades de cada filho — Fixo, Abraçar ou Preencher, mínimo e máximo, posição absoluta — vão para o metadado XMP da própria camada, no formato de `IBD.layout.montarItem`.

A decisão 8 escolheu o nome pela transparência, e ela continua valendo para o quadro: quem abre o PSD vê que aquele grupo é um quadro. Mas repetir a lógica nos filhos poria uma etiqueta em quase toda camada do documento, e o painel Camadas é a ferramenta de trabalho do dia a dia — poluí-lo custa mais do que a transparência ganha.

O preço é que a propriedade do filho fica invisível sem o painel Auto Layout. Por isso o texto gravado é o mesmo `chave=valor` legível da etiqueta do quadro, e o painel da Fase 3 o mostra. Perder o XMP (exportar para um formato que não o preserva, por exemplo) faz o filho voltar ao padrão, Abraçar — o quadro e a regra dele continuam intactos.

**Quando reavaliar:** se o XMP de camada se mostrar instável entre versões do Photoshop na Fase 2, as propriedades do filho passam para uma camada de dados dentro do grupo, invisível e travada. Detalhes em [auto-layout-v2.md](auto-layout-v2.md).

## 11. Nome de camada é contrato

**Decisão:** toda camada criada ou lida pela automação segue o [padrão de nomenclatura](padrao-nomenclatura-camadas.md): raiz `DP_<MODULO>_V<maior>`, seções `NN_NOME`, prefixo pelo tipo (`TXT_`, `IMG_`, `SHP_`, `BG_`, `AREA_`…), maiúsculas ASCII e temporárias `__DP_`.

Scripts e actions encontram camadas pelo nome. Sem um padrão comum, cada ferramenta inventa o seu e uma não consegue trabalhar sobre o arquivo da outra. O prefixo pelo tipo também deixa o contrato verificável: um teste pode confirmar que `SHP_` é forma e que nada virou pixel.

**Quando reavaliar:** se o nome precisar carregar dado que muda com frequência. Dado vai para o conteúdo da camada, para uma etiqueta `@…` (decisão 8) ou para o XMP (decisão 10) — não para a parte-base do nome.

## Limites conhecidos

- A ponte UXP → ExtendScript usa um evento não documentado do batchPlay. Ela falha de forma explícita e o painel cai no modo manual. Detalhes em [guia-uxp.md](guia-uxp.md).
- `install:dev` precisa de permissão de escrita na pasta do app. No macOS, a pasta do Photoshop costuma exigir administrador.
- Os scripts foram escritos contra as APIs documentadas de cada app, mas ainda **não foram executados dentro dos apps**. Rode cada um uma vez antes de confiar em produção.
- A vitrine leva a documentação para o GitHub em vez de renderizá-la: Markdown no site exigiria uma dependência, e o repositório não tem nenhuma. Detalhes em [site.md](site.md).
- A leitura da seleção múltipla de camadas depende do Action Manager (`targetLayers`), e a conversão de índice para camada muda conforme o documento tenha ou não Plano de Fundo. Quando falha, `IBD.ps.selecionadas` cai na camada ativa em vez de devolver lista vazia. Detalhes em [auto-layout.md](auto-layout.md).
