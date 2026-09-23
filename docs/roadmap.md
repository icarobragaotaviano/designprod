# Roadmap

Ordem pensada para entregar valor cedo e só depois investir em empacotamento.

## Agora — fundação (feito)

- [x] Estrutura do monorepo e biblioteca `core/`
- [x] Catálogo gerado a partir dos metadados
- [x] Validação no CI
- [x] Instalador de scripts nos menus dos apps
- [x] Painel UXP do Photoshop lendo o catálogo
- [x] Cinco scripts de produção + duas ferramentas UXP nativas
- [x] Kit de guias, remendos e sangria
- [x] Família Auto layout: motor app-agnóstico, três scripts e etiqueta `@auto`

## Próximo — provar em uso real

1. **Rodar cada script dentro do app.** Nenhum foi executado em um app Adobe ainda; foram escritos contra a API documentada. É o primeiro passo antes de qualquer coisa nova.
2. **Validar a ponte UXP → ExtendScript** na sua versão do Photoshop ([guia-uxp.md](guia-uxp.md)).
3. **Adicionar as ferramentas que você já usa na mão.** O repositório só se paga quando substitui trabalho repetitivo real — comece pelo que você faz toda semana.
4. **Conferir o auto layout em um job real.** O ponto mais provável de divergência é a leitura da seleção múltipla ([auto-layout.md](auto-layout.md)). Use um grupo com camadas de alturas diferentes e um documento com Plano de Fundo.
5. **Ícone e identidade do painel** no lugar do placeholder em `plugins/photoshop-uxp/src/icons/`.

## Depois — expandir

- **Auto layout no Illustrator e no InDesign.** O motor (`ibd-layout.jsx`) já é app-agnóstico: falta o adaptador de cada app, no molde de `ibd-ps-camadas.jsx`
- **Auto layout v2 — o comportamento do Figma.** Motor pronto (Fase 1): Fixo/Abraçar/Preencher por filho, limites, itens absolutos, linha de base. Faltam o adaptador com XMP e quadro visível (Fase 2) e o painel ao vivo em UXP (Fase 3). Plano e critérios em [auto-layout-v2.md](auto-layout-v2.md)
- Plugin UXP do InDesign (mesma base, filtro trocado)
- Actions `.atn` versionadas em `apps/photoshop/actions/`
- Presets (paletas, estilos, pincéis) em `apps/<app>/presets/`
- Painel ScriptUI para After Effects, enquanto não houver UXP
- Assinatura do `.ccx` — o pacote já é gerado a cada build e baixável pela vitrine, mas sem assinatura; falta confirmar se o Creative Cloud o aceita assim ([guia-uxp.md](guia-uxp.md))

## Mais adiante — só se justificar

- Templates de documento versionados
- Integração com os fluxos de produção IBD (cartela de ofertas, documento de produção)
- Plugin de Illustrator e Premiere, quando a plataforma UXP cobrir os dois

## Critério para entrar no roadmap

Uma ferramenta entra quando **substitui uma tarefa repetitiva que você faz há pelo menos três projetos**. Antes disso, é otimização prematura: o custo de manter passa o tempo que ela economiza.
