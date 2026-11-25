# designprod

Scripts, actions e plugins Adobe do estúdio **IBD**.

Um repositório único para todas as ferramentas de produção: os scripts nascem aqui, são catalogados automaticamente e depois aparecem dentro dos plugins de marca — um por app Adobe — sem reescrever nada.

---

## Aplicativos online e ferramentas de desktop

O catálogo principal reúne os apps web, scripts, ações e plugins. Os apps abrem em `/apps/<app>/`. A identidade visual segue [DESIGN.md](DESIGN.md). A branch de trabalho é `main`. Consulte o [projeto de produção gráfica](docs/nobel/README.md) para escopo e homologação.

O [Folha](docs/folha/README.md) reúne cálculo de imposição, planejamento editorial e grandes formatos na Bancada e nos painéis Adobe, com um contrato de planos reutilizável.

Os fluxos de preflight, impressão, acabamento e atendimento estão descritos no [guia de produção](docs/fluxos-de-producao.md).

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

O painel do plugin **não** tem lista de ferramentas escrita em código: ele lê `catalog.json`. Ferramenta nova entra no painel só por existir no repositório com o cabeçalho certo. A [vitrine web](docs/site.md) é o terceiro leitor do mesmo catálogo.

## Começando

```bash
npm run validate        # checa metadados, catálogo, includes e manifest
npm test                # valida estrutura e executa os testes do repositório
npm run catalog         # regenera catalog.json a partir dos scripts
npm run install:dev     # instala os scripts nos menus dos apps Adobe
npm run build:plugin    # empacota o plugin UXP do Photoshop em dist/*.ccx
npm run build:site      # gera a vitrine do catálogo publicada na Vercel
```

Não há dependências externas — só Node 18+.

## O que já existe

| Ferramenta | App | O que faz |
|---|---|---|
| Exportar camadas em lote | Photoshop | Cada camada ou grupo visível do topo vira PNG, JPG ou PSD, com aparo opcional |
| Redimensionar imagens em lote | Photoshop | Pasta inteira reduzida proporcionalmente para um lado máximo, sem tocar nos originais |
| Exportar pranchetas em lote | Illustrator | Cada prancheta selecionada ou todas em PNG, JPG ou PDF |
| Exportar páginas em PDFs individuais | InDesign | Um PDF por página do documento aberto usando um preset existente |
| Organizar pastas do projeto | After Effects | Estrutura de pastas padrão no painel Project, com itens classificados automaticamente |
| Renomear camadas selecionadas em sequência / Limpar sufixos e espaços de camadas | Photoshop (UXP) | Comandos nativos do painel lateral UXP, sem ExtendScript |
| Criar remendo de adesivo com margem | Photoshop, Illustrator, CorelDRAW, TraceDraw, VectorCraft, PhotoCraft, Web | Recorta ou duplica a seleção com margem para remendo na escala e cores originais |
| Adicionar sangria e guias no canvas | Photoshop | Amplia a tela sem redimensionar a arte e insere guias de corte e borda externa |
| Criar guias externas pela seleção | Illustrator | Guias externas nos limites combinados da seleção com a margem escolhida em camada separada |
| Aplicar auto layout ao grupo | Photoshop | Arruma as camadas de um grupo em linha ou coluna e guarda a regra no nome do grupo |
| Reaplicar auto layout nos grupos | Photoshop | Recalcula todos os quadros etiquetados depois que o conteúdo mudou |
| Alinhar e distribuir camadas | Photoshop | Alinha pela seleção, pela tela ou por uma camada de referência, com espaço fixo em px ou mm |
| Kit completo de actions (9 rotinas) | Photoshop | Suíte `.atn` com 9 rotinas rápidas: 150 DPI, vínculos, sangria, placeholder, JPEG/PNG e PDFs |
| Editar textos e preços no PSD | Photoshop | Atualiza produto, preços DE/POR e unidades UN ou /KG no PSD aberto de 1 ou 2 dígitos |
| Criar cartazes de preço em série | Photoshop | Gera novos PSDs a partir dos modelos embutidos, com texto, unidades e imagens vinculadas ou incorporadas |
| Criar margem de segurança interna (guias) | Illustrator, CorelDRAW, Affinity, TraceDraw | Cria guias internas de margem de segurança a partir das bordas da prancheta ou página |
| Cotar dimensões da seleção em texto | Illustrator, CorelDRAW, Affinity, TraceDraw | Mede a seleção na unidade escolhida (`mm`, `cm`, `m`, `px`, `in`, `pt`) e cria texto na camada `01_TEXTOS` |
| Gerar contorno deslocado e expandido | Illustrator, CorelDRAW, Affinity, TraceDraw | Gera caminho deslocado, separa/expande quando aplicável, remove preenchimento e aplica traço técnico |

A [família Auto layout](docs/auto-layout.md) traz para o Photoshop o que o auto layout do Figma faz: o grupo é o quadro, as camadas de dentro são os itens, e a regra de arrumação fica guardada no nome do grupo para ser reaplicada quando o conteúdo mudar. As contas ficam em `core/extendscript/ibd-layout.jsx`, sem nenhuma chamada de app — o mesmo motor vai servir Illustrator e InDesign.

O [kit de guias e sangria](docs/guias-e-sangria.md) inclui instruções e exemplos. O [ZIP atualizado v1.1](downloads/kit-remendos-guias-e-sangria-v1.1.zip) inclui a criação de documentos de remendo; o [ZIP v1.0](downloads/kit-guias-e-sangria-v1.zip) fica como histórico. A lógica passou em 40 testes locais com contratos simulados; a execução dentro dos aplicativos Adobe ainda precisa ser validada.

A [suíte de actions do Photoshop](docs/actions-photoshop.md) organiza rotinas ágeis de fechamento e manipulação de arquivos. O [ZIP do kit de actions v1.0](downloads/kit-actions-photoshop-v1.0.zip) entrega o conjunto unificado `ibd-producao.atn` e todos os arquivos avulsos prontos para importação.

O [editor de textos e preços](docs/textos-e-precos.md) inclui os dois PSDs originais e aplica os dados no documento aberto, sem recriar o arquivo. O criador em série usa os mesmos modelos para gerar um arquivo novo por produto, sem fechar a janela entre um e outro. A primeira versão do gerador fica preservada em [histórico](historico/photoshop/README.md). Há 44 cenários locais com Photoshop simulado; a conferência visual e de desempenho no aplicativo ainda está pendente.

## Estrutura

```
apps/<app>/scripts/     scripts por ferramenta (ExtendScript .jsx, VBA .bas, JavaScript .js)
apps/<app>/actions/     .atn e presets binários
apps/<app>/templates/   documentos-base das ferramentas
historico/              versões anteriores fora do catálogo atual
core/extendscript/      biblioteca comum (IBD.fs, IBD.ui, IBD.prefs, IBD.layout, IBD.ps)
plugins/<app>-uxp/      painéis de marca
site/src/               vitrine do catálogo publicada na Vercel
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

- [docs/textos-e-precos.md](docs/textos-e-precos.md) — editor de preços, modelos PSD, estrutura de camadas e testes
- [docs/ferramentas-vetor.md](docs/ferramentas-vetor.md) — ferramentas vetoriais (Illustrator, CorelDRAW, Affinity e TraceDraw), limites das APIs e validação
- [docs/actions-photoshop.md](docs/actions-photoshop.md) — suíte de actions: rotinas, instalação, modo de botão e kit
- [docs/auto-layout.md](docs/auto-layout.md) — família auto layout: modelo, parâmetros e etiqueta `@auto`
- [docs/site.md](docs/site.md) — vitrine do catálogo: como é montada e como publicar na Vercel
- [docs/guias-e-sangria.md](docs/guias-e-sangria.md) — uso dos três scripts e download do kit
- [docs/guias-e-sangria-validacao.md](docs/guias-e-sangria-validacao.md) — testes locais e conferência nos apps
- [docs/instalacao.md](docs/instalacao.md) — instalar scripts e plugin
- [docs/arquitetura.md](docs/arquitetura.md) — decisões estruturais e por quê
- [docs/guia-script.md](docs/guia-script.md) — padrão de script e API do core
- [docs/guia-uxp.md](docs/guia-uxp.md) — plugins, limites de plataforma por app
- [docs/roadmap.md](docs/roadmap.md) — o que vem depois

## Licença

MIT — veja [LICENSE](LICENSE).
