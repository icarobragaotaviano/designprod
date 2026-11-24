Identidade Visual & Design System — IBD (Ícaro Braga Design)

Guia oficial de estilo, tokens CSS, anatomia de cabeçalho e padrões de UI para os aplicativos do ecossistema IBD (folha., numera-bloco., os-maneger. e novas ferramentas standalone ou integradas). Base reutilizável pronta para importar: docs/ibd-theme.css.

1. Conceito Visual e Regra Cromática 60-30-10

A linguagem visual IBD adota uma estética de Estúdio Técnico Editorial em modo escuro de baixo brilho (low-glare dark slate), otimizada para longas jornadas em pré-impressão, cálculo gráfico e gestão de produção:

60% Dominante (#181a1f / #14161a): Fundos escuros neutros que reduzem fadiga visual e dão destaque máximo ao papel/diagrama técnico branco no palco SVG.
30% Secundária (#20232a / #282c35 + #68a8e8): Painéis elevados, bordas suaves (#2e333d, #3a404d), tipografia off-white confortável (#e4e7ee) e azul técnico (#68a8e8) para foco, links e seleções ativas.
10% Destaque (#f0c419): Reservado estritamente para ações primárias (CTA), aba/módulo ativo no nível corrente, ponto da marca (.brand-dot) e seleção de texto (::selection).

IMPORTANT

Regra de Ouro do Amarelo (#f0c419): Nunca coloque dois grupos empilhados competindo com botões amarelos ativos no mesmo cabeçalho. O amarelo deve apontar exatamente qual é a ação ou visão dominante da tela.

1.1 Tokens de Cor (:root)
Token CSS	Valor	Papel / Uso
--surface	#181a1f	Fundo principal da página (body), meta[name="theme-color"]
--stage-bg	#14161a	Fundo do palco técnico / área de desenho
--paper / --card	#20232a	Painéis, cards principais, containers de abas
--raised	#282c35	Superfícies elevadas, botões secundários, hover de linhas, logo mark
--ink	#e4e7ee	Texto principal, títulos e valores numéricos em destaque
--ink-soft	#b6bcc8	Rótulos de campos, texto descritivo secundário, badges neutros
--muted	#8890a0	Metadados, subtítulos, eyebrows, placeholders, abas inativas
--line	#2e333d	Bordas principais de painéis, divisores de topo e tabelas
--line-soft	#242830	Divisores internos sutis entre linhas de listas
--rule	#3a404d	Bordas de inputs, botões, pills e cartões elevados
--secondary	#68a8e8	Azul técnico: foco de inputs, seleções, links de texto, eyebrows informativos
--secondary-soft	rgba(104, 168, 232, 0.12)	Fundo suave de badges informativos e hover de links
--accent	#f0c419	Amarelo IBD: CTA primário, aba ativa, .brand-dot, ::selection
--accent-hover	#ddb211	Estado :hover de botões e abas primárias
--accent-soft	rgba(240, 196, 25, 0.12)	Realce suave em cards/botões secundários ao passar o mouse
--on-accent	#16181d	Cor do texto/ícone sobre fundo --accent (contraste alto)
1.2 Tokens Semânticos de Validação e Workflow
Estado / Categoria	Texto / Ícone	Fundo	Borda	Uso
OK / Validado	--ok: #52b788	rgba(82, 183, 136, 0.14)	rgba(82, 183, 136, 0.45)	Status validado, sincronizado, preflight limpo
Aviso (warn)	--warn: #e5a93c (#f5d08a em cards)	rgba(229, 169, 60, 0.14)	rgba(229, 169, 60, 0.45)	Alertas técnicos não impeditivos, modo offline
Erro (danger)	--danger: #f29ca6	rgba(217, 91, 106, 0.14)	rgba(217, 91, 106, 0.45)	Colisões, medidas inválidas, ações destrutivas
Paleta de Etapas de Workflow (Padrão os-maneger)

Utilizada com a variável local --tone em bolinhas indicadoras (.stage::before) e tags .colored:

.s0 Recebido: #68a8e8
.s1 Em espera / análise: #a992f7
.s2 Processando: #e5a93c
.s3 Pausado: #949ba8
.s4 Aguardando cliente / aprovação: #e28ca9
.s5 Pronto para retirada: #52b788
.s6 Concluído / Arquivado: #5bc0be
.s7 Prova: #f0a96b
Complexidade: .c0 #52b788 · .c1 #e5a93c · .c2 #e07a68 · .c-1 #8890a0

NOTE

Padronização entre repositórios: Em arquivos anteriores (README.md, nobel/index.html) aparecem menções históricas a #111110 / #ffd401, e numera-bloco/index.html usa os nomes --primary e --font-mono em vez de --accent e --mono. Em novos apps (e em docs/ibd-theme.css), adote --surface: #181a1f e --accent: #f0c419 como padrão oficial — o arquivo base já expõe --primary e --mono como aliases para retrocompatibilidade. Já os ícones vetoriais logo.svg e favicon.svg preservam o amarelo puro #FFD401 sobre #010101.

2. Tipografia e Ícones
2.1 Famílias Oficiais (Google Fonts)
html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
UI & Títulos (--font-sans): 'Space Grotesk', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
Dados Técnicos, Métricas, Badges & Eyebrows (--font-mono): 'Space Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace
Ícones (quando necessário): Material Symbols Outlined carregado sob demanda com icon_names=... para manter payload mínimo.
2.2 Escala e Regras Tipográficas
Elemento	Fonte	Tamanho / Peso	Tracking / Estilo
body	--font-sans	13.5px / 1.45 (400)	-webkit-font-smoothing: antialiased
h1 / .suite-h1	--font-sans	clamp(26px, 3.5vw, 36px) (700)	letter-spacing: -0.04em; line-height: 1.08
.brand-name	--font-sans	20px (700)	letter-spacing: -0.05em; line-height: 1.05 (nome minúsculo + ponto amarelo: folha.)
h2 (Painéis)	--font-sans	14.5px–17px (700)	letter-spacing: -0.02em
.step-eyebrow / .eyebrow	--font-mono	10px–11px (600)	letter-spacing: 0.10em; text-transform: uppercase
.brand-sub	--font-mono	9px (600)	letter-spacing: 0.14em; text-transform: uppercase
.metric b / Números técnicos	--font-mono	19px–32px (700)	font-variant-numeric: tabular-nums
input[type="number"]	--font-mono	12.5px–16px	font-variant-numeric: tabular-nums
3. Marca e Arquitetura do Cabeçalho (Melhoria Aplicada)
3.1 Construção da Marca

O bloco de identidade à esquerda (.brand-group) segue sempre a mesma assinatura modular:

Monograma (.brand-mark): 36×36px, border-radius: 10px, fundo linear-gradient(180deg, var(--raised), var(--paper)), borda 1px solid var(--rule), texto ib. (ib em --ink, . em --accent).
Wordmark (.brand-text):
Nome em caixa baixa + ponto final amarelo: folha., numera-bloco., os-maneger., <novo-app>.
Subtítulo técnico em --font-mono: ex. ESTÚDIO DE IMPOSIÇÃO GRÁFICA · IBD ou SUÍTE DE PRODUÇÃO GRÁFICA IBD.
Tag de Versão (.version): Pill monoespaçada (v8 · standalone ou v6 · suite).
3.2 Diagnóstico do Cabeçalho Atual (ibd-folha v8 · standalone)

Na versão atual observada na interface standalone com 6 modos (01 a 06), existem quatro atritos visuais claros:

Desalinhamento de largura: .topbar-inner está limitado a max-width: 1380px, enquanto main (onde ficam .studio-bar e .workspace) usa max-width: 1880px. Em telas largas, o cabeçalho superior fica recuado e desalinhado das colunas abaixo.
Quebra órfã no 6º modo (06 Sugerir folha): .mode-nav usa grid-template-columns: repeat(5, minmax(128px, auto)). Ao inserir a 6ª aba, ela cai sozinha para uma segunda linha dentro do container, dobrando a altura da barra, deixando um vazio assimétrico à direita e desalinhando os botões Desfazer / Refazer / Glossário / Status.
Switcher amarelo redundante no modo standalone: No canto superior direito, .suite-switcher exibe apenas 1 botão amarelo ativo (01 Folha Imposição). Isso não troca de módulo e cria dois destaques amarelos concorrentes empilhados (topo direito + aba ativa do .mode-nav).
Má distribuição entre as duas faixas: A faixa superior fica subutilizada com apenas um botão à direita, enquanto a faixa inferior tenta acomodar 6 modos + 3 ferramentas + badge longo de status na mesma linha.
3.3 Solução Recomendada (Cabeçalho Unificado em 2 Faixas)

O que muda na prática:

Mesma largura máxima (--shell-max: 1880px) para .topbar-inner e main, alinhando perfeitamente esquerda e direita em qualquer resolução.
Zero switcher de aba única no standalone: Em apps standalone, o antigo pill 01 Folha Imposição vira um badge neutro discreto (.module-pill: 01 · FOLHA) ou é omitido, e o lado direito da .topbar recebe Desfazer, Refazer, Glossário e o badge ✓ Montagem validada — aproveitando o espaço nobre do topo!
Ribbon de modos em linha única real: Com as ferramentas movidas para a .topbar, .mode-nav ganha 100% da largura com grid-template-columns: repeat(6, minmax(0, 1fr)) (data-cols="6"), mantendo todas as 6 abas alinhadas em 1 fileira no desktop, 3×2 simétrico em tablets (<= 1199px) e 2×3 simétrico em celulares (<= 767px) — sem nenhuma aba órfã.
Foco visual único: Apenas a aba de trabalho ativa (04 Montagem rápida) recebe #f0c419.
HTML Pronto para App Standalone (ibd-folha v8 · standalone)
html
<header class="topbar">
  <div class="topbar-inner">
    <div class="brand-group">
      <a class="brand" href="./" aria-label="IBD Folha — Estúdio de Imposição Gráfica">
        <span class="brand-mark" aria-hidden="true">ib<span>.</span></span>
        <span class="brand-text">
          <span class="brand-name">folha<span class="brand-dot">.</span></span>
          <span class="brand-sub">ESTÚDIO DE IMPOSIÇÃO GRÁFICA · IBD</span>
        </span>
      </a>
      <span class="version" title="Versão standalone do módulo Folha">v8 · standalone</span>
      <span class="module-pill">01 · FOLHA IMPOSIÇÃO</span>
    </div>
    <div class="topbar-actions" role="toolbar" aria-label="Ferramentas e status da montagem">
      <button id="undo" type="button" title="Desfazer última alteração" aria-label="Desfazer última alteração">
        ↶ <span class="btn-label">Desfazer</span>
      </button>
      <button id="redo" type="button" title="Refazer alteração" aria-label="Refazer alteração">
        ↷ <span class="btn-label">Refazer</span>
      </button>
      <button id="openGlossary" type="button" class="glossary-trigger" aria-haspopup="dialog" title="Abrir Glossário Técnico">
        📖 <span class="btn-label">Glossário</span>
      </button>
      <span class="topbar-divider" aria-hidden="true"></span>
      <span id="status" class="status-badge" role="status">✓ Montagem validada · pronta para conferência</span>
    </div>
  </div>
</header>
<main>
  <section class="studio-bar" aria-label="Modos de trabalho">
    <nav class="mode-nav" data-cols="6" aria-label="Modo de trabalho">
      <button id="flatTab" type="button">
        <span class="mode-head"><span class="mode-index">01</span><strong>Peças avulsas</strong></span>
        <small>Ganging e imposição comercial</small>
      </button>
      <button id="bookTab" type="button">
        <span class="mode-head"><span class="mode-index">02</span><strong>Editorial</strong></span>
        <small>Cadernos e encadernação</small>
      </button>
      <button id="visualTab" type="button">
        <span class="mode-head"><span class="mode-index">03</span><strong>Grandes formatos</strong></span>
        <small>Comunicação visual</small>
      </button>
      <button id="freeTab" type="button" class="active">
        <span class="mode-head"><span class="mode-index">04</span><strong>Montagem rápida</strong></span>
        <small>Visualização livre</small>
      </button>
      <button id="compareTab" type="button">
        <span class="mode-head"><span class="mode-index">05</span><strong>Comparar folhas</strong></span>
        <small>Tamanhos lado a lado</small>
      </button>
      <button id="suggestTab" type="button">
        <span class="mode-head"><span class="mode-index">06</span><strong>Sugerir folha</strong></span>
        <small>Indicações por peça</small>
      </button>
    </nav>
  </section>
</main>
Alternativa Mínima (CSS-only, sem mexer no HTML atual do ibd-folha)

Caso queira corrigir o cabeçalho de ibd-folha somente via CSS, sem mover os botões do DOM:

css
/* 1. Alinha largura da barra superior ao workspace */
.topbar-inner,
main {
  max-width: 1880px;
}
/* 2. Remove destaque amarelo concorrente quando o switcher tiver apenas 1 modulo */
.suite-switcher:has(.suite-tab:only-child) {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  padding: 0;
}
.suite-switcher:has(.suite-tab:only-child) .suite-tab.active {
  background: var(--raised);
  color: var(--ink-soft);
  border: 1px solid var(--rule);
  box-shadow: none;
  pointer-events: none;
}
.suite-switcher:has(.suite-tab:only-child) .suite-tab.active span {
  color: var(--accent);
}
/* 3. Garante que 6 abas fiquem em 1 linha no desktop e 3x2 / 2x3 sem orfas */
.studio-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}
.mode-nav {
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}
.mode-nav button {
  min-width: 0;
  padding: 8px 11px;
}
.mode-nav button strong,
.mode-nav button small {
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
@media (max-width: 1420px) {
  .studio-bar {
    grid-template-columns: 1fr;
  }
  .studio-status {
    justify-content: flex-end;
  }
}
@media (max-width: 1199px) {
  .mode-nav {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 767px) {
  .mode-nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .mode-nav button:last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }
}
3.4 Variante Suíte Multi-Módulo (v6 · suite)

Quando o aplicativo pertence à suíte unificada (3 módulos na mesma barra), .topbar-inner mantém três zonas:

Esquerda: .brand-group (ib. + <app>. + v6 · suite)
Centro: .suite-switcher (01 Folha Imposição, 02 Numera Bloco, 03 OS Maneger)
Direita: #suiteCloudStatus (chip do usuário / sync dot / botão Google ou Modo offline)
4. Biblioteca de Componentes & Tokens de UI
4.1 Superfícies, Luz Atmosférica e Profundidade
Gradiente sutil no body: radial-gradient(ellipse 85% 42% at 50% -10%, rgba(104, 168, 232, 0.065), transparent)
Topbar Glass: background: rgba(24, 26, 31, 0.84); backdrop-filter: blur(18px) saturate(155%);
Painéis (.panel):
Fundo --paper (#20232a), borda 1px solid var(--line), border-radius: 15px (16px no NBL/OSM), padding: 16px
Sombra padrão: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 12px 32px rgba(0, 0, 0, 0.26)
Raios padrão:
6px–8px: botões, inputs, checkboxes, linhas internas
10px–12px: cards KPI, itens de acordeão, cards do switcher, .brand-mark
14px–16px: painéis principais, modais, barra .mode-nav
999px: pills, badges de status, barra flutuante .zoom-bar, chips
4.2 Hierarquia de Botões
Primário (.primary / .btn.primary): Fundo --accent (#f0c419), texto --on-accent (#16181d), font-weight: 700, box-shadow: 0 4px 14px rgba(240, 196, 25, 0.22).
Secundário padrão (button / .btn): Fundo --raised (#282c35), borda --rule (#3a404d), hover #303540.
Neutro discreto (.secondary-action / .glossary-trigger): Fundo --paper (#20232a), texto --ink-soft, hover --raised.
Link de ação (.text-link-btn): Sem borda/fundo, texto --secondary (#68a8e8), hover var(--secondary-soft).
Micro-feedback tátil: :active { transform: translateY(1px); }, :disabled { opacity: 0.45; cursor: not-allowed; }.
4.3 Formulários, Inputs e Acordeões
Campos (input, select, textarea): fundo --surface (#181a1f), borda 1px solid var(--rule), border-radius: 8px, foco azul --secondary com halo 0 0 0 3px rgba(104, 168, 232, 0.18).
Labels com unidade: .label-head com .label-text + .unit-tag em --font-mono 10px (mm, g/m², LPI).
Acordeões (.cfg-group via <details>): resumo clicável em --raised com seta ▸ animada (rotate(90deg) quando [open]) e .cfg-badge em pílula mono à direita.
Linhas de checkbox (.check-row): fundo --paper, borda --line, alinhamento horizontal com accent-color: var(--accent).
4.4 Cards de Métrica (KPI)
Classe .metric: fundo linear-gradient(180deg, rgba(255, 255, 255, 0.025), rgba(24, 26, 31, 0.65)), borda 1px solid var(--line), border-radius: 12px, hover translateY(-2px).
Valor principal em --font-mono 19px–27px 700 tabular-nums; rótulo em 10.5px --muted.
No os-maneger, cards KPI usam border-top: 2px solid color-mix(in srgb, var(--tone) 45%, transparent) para filtrar a fila por etapa.
4.5 Palco Técnico SVG e Zoom Bar (Apps Gráficos)
Superfície pontilhada (.stage): background-color: #14161a; background-image: radial-gradient(#282c35 1px, transparent 1px); background-size: 16px 16px;
Zoom Bar Flutuante (.zoom-bar): pílula centralizada (border-radius: 999px) sobre a base do palco, background: rgba(24, 26, 31, 0.88), backdrop-filter: blur(14px) saturate(150%), sombra 0 12px 32px rgba(0, 0, 0, 0.48).
Paleta Técnica dentro do SVG (para manter contraste sobre papel branco #ffffff):
SKU A: frente #dce8cf / verso #d4e3ec / traço #6c8a62
SKU B: #f2e2c4 / #e8d8bd / #9c7a44
SKU C: #dfdaf0 / #d5d0e8 / #6f6594
SKU D: #f0d8d8 / #e6cece / #965d5d
Esquadro lateral: #d4882a · Dobra: #2b6cb0 · Faca especial: #d91b77 · Preflight erro: #c92a2a · Preflight aviso: #d97706 · Chapa CTP: #d7e1e8 (borda #687d8c).
4.6 Tabelas, Modais e Notificações
Tabelas: cabeçalho th com position: sticky; top: 0; background: rgba(24, 26, 31, 0.94); backdrop-filter: blur(8px);, fonte --font-mono, divisores 1px solid var(--line).
Modais / <dialog>: backdrop rgba(12, 14, 18, 0.76) com backdrop-filter: blur(4px), painel --paper, borda --rule, raio 11px–16px, animação modalPopIn 180ms cubic-bezier(0.22, 1, 0.36, 1).
Toast flutuante (.toast): fixo no rodapé central, pílula amarela --accent com texto --on-accent, font-weight: 700.
5. Responsividade, Acessibilidade e Impressão
Breakpoints padrão:
1199px: workspace em 3 colunas colapsa para fluxo mobile com .mobile-nav flutuante fixa na base (bottom: 10px, border-radius: 18px, glass blur); .mode-nav passa a 3 colunas.
900px / 1080px: layouts de 2 colunas (NBL, Comparar, Livre) empilham em 1fr.
767px: .btn-label pode ocultar em botões secundários da barra para economizar espaço; .mode-nav passa a 2 colunas; .zoom-bar ocupa largura total com border-radius: 14px.
Acessibilidade:
:focus-visible obrigatório com outline: 2px solid var(--accent); outline-offset: 2px;
@media (prefers-reduced-motion: reduce) reduz transições e desliga animações.
Atributos ARIA (role="tablist", aria-selected, aria-pressed, role="status", aria-live="polite").
Impressão (@media print):
Oculta .topbar, .studio-bar, barras de ferramenta, painéis laterais e .mobile-nav.
Converte body e .stage para fundo #ffffff e texto #000000 sem sombras.
6. Como Aplicar em Novos Apps IBD (Passo a Passo)
Copie a folha base: inclua docs/ibd-theme.css (ou importe seus tokens :root no topo do CSS do novo app).
Configure o <head> padrão:
html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#181a1f">
  <title>Nome do App · IBD</title>
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="ibd-theme.css">
  <link rel="stylesheet" href="app.css">
</head>
Ajuste a largura máxima se o app for compacto:
Apps com palco/kanban amplo: mantenha --shell-max: 1880px (padrão).
Calculadoras ou CRUDs focados (numera-bloco, os-maneger): sobrescreva no CSS do app:
css
:root { --shell-max: 1380px; }
Assim .topbar-inner e main permanecem sempre alinhados automaticamente.
Escolha o modo do cabeçalho:
Standalone: .brand-group + .module-pill à esquerda e .topbar-actions (ferramentas + .status-badge) à direita; se houver abas de trabalho, use .mode-nav com data-cols="N" logo abaixo.
Suíte: .brand-group à esquerda, .suite-switcher ao centro e #suiteCloudStatus à direita.
Checklist rápido de consistência:
 meta[name="theme-color"] está em #181a1f
 Wordmark em minúsculas + ponto amarelo (nome.)
 Apenas um destaque amarelo sólido (#f0c419) ativo por nível de navegação
 Todos os valores numéricos/técnicos usam --font-mono com tabular-nums
 Foco de inputs em azul --secondary e :focus-visible de teclado em --accent
 Testado abaixo de 1200px e 768px sem abas órfãs ou overflow horizontal