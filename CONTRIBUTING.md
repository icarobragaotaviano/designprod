# Como contribuir

## Antes do commit

```bash
npm run catalog && npm run validate
```

O CI roda a mesma coisa. Metadado incompleto, catálogo desatualizado, `#include` quebrado ou manifest inválido reprovam o push.

## Convenções

- **Nome de arquivo:** minúsculas, sem acento, hífen entre palavras — `exportar-camadas.jsx`
- **`@ibd-id`:** sempre `<app>/<nome-do-arquivo>`
- **Versão:** semver no cabeçalho do script; suba a minor quando mudar comportamento
- **Interface em português, identificador sem acento**
- **Um script, uma responsabilidade.** Precisa de duas etapas independentes? São dois scripts.

## Commits

Mensagem no imperativo, primeira linha até 72 caracteres, em português:

```
adiciona script de exportar mockups no Photoshop
corrige unidade de régua não restaurada em redimensionar-lote
```

## Alterando o `core/`

`core/extendscript/` é usado por todos os scripts de todos os apps. Antes de mudar uma assinatura de função, rode os scripts que a usam — não existe teste automatizado que pegue a quebra.

Adição é livre; alteração e remoção pedem uma passada em `apps/`.

## Arquivos gerados — não editar à mão

- `catalog.json`
- `plugins/*/src/catalog.json`
- `plugins/*/src/bundle/`
- tokens de cor em `plugins/*/src/styles.css` (vêm de `brand.config.json`)
