# Roadmap

Ordem pensada para entregar valor cedo e só depois investir em empacotamento.

## Agora — fundação (feito)

- [x] Estrutura do monorepo e biblioteca `core/`
- [x] Catálogo gerado a partir dos metadados
- [x] Validação no CI
- [x] Instalador de scripts nos menus dos apps
- [x] Painel UXP do Photoshop lendo o catálogo
- [x] Cinco scripts de produção + duas ferramentas UXP nativas

## Próximo — provar em uso real

1. **Rodar cada script dentro do app.** Nenhum foi executado em um app Adobe ainda; foram escritos contra a API documentada. É o primeiro passo antes de qualquer coisa nova.
2. **Validar a ponte UXP → ExtendScript** na sua versão do Photoshop ([guia-uxp.md](guia-uxp.md)).
3. **Adicionar as ferramentas que você já usa na mão.** O repositório só se paga quando substitui trabalho repetitivo real — comece pelo que você faz toda semana.
4. **Ícone e identidade do painel** no lugar do placeholder em `plugins/photoshop-uxp/src/icons/`.

## Depois — expandir

- Plugin UXP do InDesign (mesma base, filtro trocado)
- Actions `.atn` versionadas em `apps/photoshop/actions/`
- Presets (paletas, estilos, pincéis) em `apps/<app>/presets/`
- Painel ScriptUI para After Effects, enquanto não houver UXP
- Empacotamento `.ccx` assinado para instalar em outra máquina

## Mais adiante — só se justificar

- Templates de documento versionados
- Integração com os fluxos de produção IBD (cartela de ofertas, documento de produção)
- Plugin de Illustrator e Premiere, quando a plataforma UXP cobrir os dois

## Critério para entrar no roadmap

Uma ferramenta entra quando **substitui uma tarefa repetitiva que você faz há pelo menos três projetos**. Antes disso, é otimização prematura: o custo de manter passa o tempo que ela economiza.
