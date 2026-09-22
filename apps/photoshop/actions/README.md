# Actions do Photoshop

Arquivos `.atn` versionados nesta pasta entram no catálogo (`catalog.json`) e aparecem no painel UXP e na vitrine web como itens do tipo `action`.

## Arquivos Versionados

- `ibd-producao.atn` — Pacote consolidado contendo todas as rotinas em um único conjunto de actions do Photoshop.
- `150-dpi.atn` — Converte resolução para 150 DPI mantendo proporções.
- `atualizar-vinculos.atn` — Atualiza todos os objetos inteligentes modificados e salva.
- `sangria-canvas.atn` — Expande a tela com a cor de fundo para área de corte.
- `place-holder.atn` — Cria elemento visual de produto com forma e texto "IMAGEM".
- `revincular.atn` — Fluxo rápido de revinculação de Smart Object vinculado.
- `exportar-jpeg-impressao.atn` — Exporta JPEG em qualidade máxima.
- `exportar-png.atn` — Exporta PNG transparente.
- `salvar-pdf-x1a.atn` — Salva PDF/X-1a para gráfica comercial em CMYK.
- `salvar-pdf-leitura.atn` — Salva PDF leve para aprovação e leitura de cliente.

## Metadados

Os metadados (títulos, descrições ricas, tags e páginas de documentação) são controlados pelo arquivo [actions.meta.json](actions.meta.json).
Ao adicionar uma action nova, registre suas propriedades no JSON e execute:

```bash
npm run catalog
```

## Empacotamento Automático

Para atualizar o conjunto consolidado `ibd-producao.atn` e gerar o kit ZIP de distribuição em `downloads/kit-actions-photoshop-v1.0.zip`:

```bash
node tools/pack-actions.mjs
```

## Instalação no Photoshop

Veja o guia detalhado em [docs/actions-photoshop.md](../../../docs/actions-photoshop.md).
