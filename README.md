# designprod

Scripts, actions e plugins Adobe do estúdio **IBD**.

Um repositório único para todas as ferramentas de produção: os scripts nascem aqui, são catalogados automaticamente e depois aparecem dentro dos plugins de marca — um por app Adobe — sem reescrever nada.

---

## Como funciona

```
script .jsx com cabeçalho @ibd-*
        ↓  npm run catalog
     catalog.json           ← contrato único entre scripts e plugins
        ↓
  ┌─────────────┬──────────────────┐
  menu do app          painel do plugin
  (install:dev)        (build:plugin)
```

O painel do plugin **não** tem lista de ferramentas escrita em código: ele lê `catalog.json`. Ferramenta nova entra no painel só por existir no repositório com o cabeçalho certo.

## Começando

```bash
npm run validate        # checa metadados, catálogo, includes e manifest
npm run catalog         # regenera catalog.json a partir dos scripts
npm run install:dev     # instala os scripts nos menus dos apps Adobe
npm run build:plugin    # empacota o plugin UXP do Photoshop
```

Não há dependências externas — só Node 18+.

## O que já existe

| Ferramenta | App | O que faz |
|---|---|---|
| Exportar camadas | Photoshop | Cada camada/grupo do topo vira um arquivo, com aparo opcional |
| Redimensionar em lote | Photoshop | Pasta inteira reduzida para um lado máximo, sem tocar nos originais |
| Exportar pranchetas | Illustrator | Cada prancheta em PNG, JPG ou PDF |
| Exportar páginas em PDFs separados | InDesign | Um PDF por página, usando um preset existente |
| Organizar projeto | After Effects | Estrutura de pastas padrão, itens classificados automaticamente |
| Renomear camadas / Limpar nomes | Photoshop (UXP) | Ferramentas nativas do painel, sem ExtendScript |

## Estrutura

```
apps/<app>/scripts/     scripts ExtendScript, um arquivo por ferramenta
apps/<app>/actions/     .atn e presets binários
core/extendscript/      biblioteca comum (IBD.fs, IBD.ui, IBD.prefs)
plugins/<app>-uxp/      painéis de marca
tools/                  catálogo, validação, scaffold, instalação
docs/                   instalação, arquitetura, guias
brand.config.json       nome, cores e versão da marca — fonte única
catalog.json            gerado; não editar à mão
```

## Criar uma ferramenta nova

```bash
npm run new -- photoshop exportar-mockups "Exportar mockups" "Gera mockups a partir do PSD aberto."
# implementa o script
npm run catalog && npm run validate
```

Detalhes em [docs/guia-script.md](docs/guia-script.md).

## Documentação

- [docs/instalacao.md](docs/instalacao.md) — instalar scripts e plugin
- [docs/arquitetura.md](docs/arquitetura.md) — decisões estruturais e por quê
- [docs/guia-script.md](docs/guia-script.md) — padrão de script e API do core
- [docs/guia-uxp.md](docs/guia-uxp.md) — plugins, limites de plataforma por app
- [docs/roadmap.md](docs/roadmap.md) — o que vem depois

## Licença

MIT — veja [LICENSE](LICENSE).
