# Vitrine do catálogo

Página web que mostra as ferramentas do repositório, publicada na Vercel. Serve para instalar em outra máquina, mandar o link para alguém e ter em um lugar só o que o estúdio já automatizou.

**Ela não tem lista de ferramentas escrita em código.** Lê `catalog.json` — a mesma fonte que o painel UXP usa. Ferramenta nova aparece no site só por existir no repositório com o cabeçalho `@ibd-*` certo, depois de `npm run catalog`.

---

## Comandos

```bash
npm run build:site      # gera a pasta que a Vercel publica
```

Para conferir antes de publicar, abra `site/publico/index.html` direto no navegador — os dados ficam embutidos no HTML, então funciona sem servidor. Se preferir servir:

```bash
python3 -m http.server -d site/publico 8000
```

## Como o site é montado

```
catalog.json ─┐
brand.config ─┼─→ tools/build-site.mjs ─→ site/publico/  ─→ Vercel
site/src/     ┘                            (gerado, fora do git)
```

O builder faz quatro coisas:

1. **Lê `catalog.json`** e acrescenta o que só existe no disco: o caminho do código servido pelo site, o link da documentação no GitHub (vindo de `@ibd-doc`) e se a ferramenta depende da pasta `core/` — descoberto procurando `#include` no arquivo.
2. **Aplica os tokens de `brand.config.json`** no CSS e no HTML, como o `build:plugin` já fazia com o painel.
3. **Embute os dados no HTML** em vez de buscá-los por `fetch`. Uma requisição a menos, e a página abre até do sistema de arquivos.
4. **Copia `apps/`, `core/` e `downloads/`** para a saída, para os links "Ver código" servirem o arquivo de verdade.

A pasta de saída vem do `outputDirectory` do próprio `vercel.json`. É intencional: assim não existem duas verdades sobre onde o site nasce, e mudar o destino é editar um arquivo só.

## Publicar na Vercel

1. Em [vercel.com](https://vercel.com), **Add New → Project** e importe o repositório.
2. Em **Framework Preset**, escolha **Other**. Não preencha Build Command nem Output Directory: a Vercel lê os dois do `vercel.json`.
3. **Deploy**.
4. Em **Settings → Git → Production Branch**, escolha a branch que deve virar o endereço de produção. Este repositório ainda não tem `main` — sem esse ajuste, a Vercel usa a branch padrão do GitHub e os deploys das outras branches ficam como pré-visualização.

Não há variáveis de ambiente para configurar. O builder descobre o repositório e a branch pelas variáveis que a própria Vercel injeta (`VERCEL_GIT_REPO_OWNER`, `VERCEL_GIT_REPO_SLUG`, `VERCEL_GIT_COMMIT_REF`) e, fora dela, pelo `git remote` local.

**Repositório privado:** o site continua sendo gerado, mas os botões "Baixar o repositório", "Ver no GitHub" e "Documentação" levam para o GitHub e vão pedir login de quem tiver acesso. O código servido em `/arquivos/` não depende disso — ele é copiado para dentro do site. Se o repositório for privado e a Vercel publicar o site aberto, **esse código fica público**. Considere proteger o projeto na Vercel (Settings → Deployment Protection) antes de publicar.

## O que a página mostra

- **Busca** por nome, descrição, tag ou id, com todas as palavras precisando aparecer — `auto photoshop` filtra de verdade.
- **Filtro por aplicativo**, com a contagem de cada um.
- **Cartão por ferramenta**: título, aplicativo, descrição, tags, versão, link para o código e, quando houver `@ibd-doc`, link para a documentação.
- **Etiqueta `precisa do core/`** nas ferramentas que usam `#include`, porque baixar só o `.jsx` delas não funciona.
- **Filtro no endereço**: `#app=photoshop&q=layout` reabre a página já filtrada, então dá para mandar um link pronto.
- Atalho `/` para focar a busca, `Esc` para limpar.

## O campo `@ibd-doc`

Opcional, no cabeçalho do script:

```jsx
 * @ibd-tags auto-layout, layout, camadas
 * @ibd-doc docs/auto-layout.md
```

Quando presente, vira o botão **Documentação** no cartão. `npm run validate` recusa um caminho que não exista — link quebrado no site passa a quebrar o CI.

## Limites conhecidos

- **A documentação abre no GitHub**, não no próprio site: renderizar Markdown exigiria uma dependência, e o repositório não tem nenhuma. Se a doc precisar viver no site um dia, é aí que entra um gerador.
- **Sem origem git, os links do GitHub somem** em vez de sair quebrados — o build avisa no console e continua.
- **A página é estática.** Não há busca no servidor, contador de download nem área logada; para isso seria preciso um backend, que hoje não se paga.
