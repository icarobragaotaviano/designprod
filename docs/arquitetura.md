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

## Limites conhecidos

- A ponte UXP → ExtendScript usa um evento não documentado do batchPlay. Ela falha de forma explícita e o painel cai no modo manual. Detalhes em [guia-uxp.md](guia-uxp.md).
- `install:dev` precisa de permissão de escrita na pasta do app. No macOS, a pasta do Photoshop costuma exigir administrador.
- Os scripts foram escritos contra as APIs documentadas de cada app, mas ainda **não foram executados dentro dos apps**. Rode cada um uma vez antes de confiar em produção.
