import { modulos } from './conteudo.mjs';
import { figuras } from './figuras.mjs';

const entidades = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const texto = valor => String(valor).replace(/[&<>"']/g, letra => entidades[letra]);
const absoluto = url => url.startsWith('/') ? url : '/' + url;

export function prepararGuias(ferramentas) {
  const porId = new Map(ferramentas.map(ferramenta => [ferramenta.id, ferramenta]));
  const vistos = new Set();
  for (const modulo of modulos) {
    for (const licao of modulo.licoes) {
      const ferramenta = porId.get(licao.ferramenta);
      if (!ferramenta || !figuras[licao.id] || vistos.has(licao.id)) {
        throw new Error(`Tutorial sem ferramenta, ilustração ou ID único: ${licao.id}.`);
      }
      vistos.add(licao.id);
      ferramenta.tutorial ||= `/tutoriais/#${modulo.id}`;
    }
  }
  return porId;
}

function acoes(f) {
  const baixar = f.baixar
    ? `<a class="acao acao-baixar" href="${texto(absoluto(f.baixar))}" download="${texto(f.baixarNome)}">Baixar script</a>`
    : '';
  const abrir = f.abrir ? `<a class="acao acao-baixar" href="${texto(absoluto(f.abrir))}">Abrir app</a>` : '';
  const codigo = f.codigo ? `<a class="acao" href="${texto(absoluto(f.codigo))}">Ver código</a>` : '';
  const repositorio = f.fonteRepositorio
    ? `<a class="acao" href="${texto(f.fonteRepositorio)}">GitHub</a>` : '';
  return `<div class="acoes">${baixar}${abrir}${codigo}${repositorio}</div>`;
}

function pagina(secao, titulo, descricao, conteudo) {
  const aba = (id, rotulo) => `<a href="/${id}/"${secao === id ? ' aria-current="page"' : ''}>${rotulo}</a>`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#181a1f">
  <meta name="description" content="${texto(descricao)}">
  <title>${texto(titulo)} · DesignProd</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&amp;family=Space+Mono:wght@400;700&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/ibd-theme.css">
  <link rel="stylesheet" href="/guias.css">
  <script src="/guias.js" defer></script>
</head>
<body>
  <a class="pular" href="#conteudo">Pular para o conteúdo</a>
  <header class="topo-guia">
    <div class="largura topo-interno">
      <a class="marca-site" href="/"><span class="monograma" aria-hidden="true">ib<span>.</span></span>designprod<span>.</span></a>
      <nav aria-label="DesignProd"><a href="/">Ferramentas</a>${aba('scripts','Scripts')}${aba('tutoriais','Tutoriais')}</nav>
    </div>
  </header>
  <main class="largura" id="conteudo">
    ${conteudo}
  </main>
  <footer class="largura rodape-guia"><a href="/">DesignProd</a><a href="#conteudo">Voltar ao início ↑</a></footer>
</body>
</html>
`;
}

function busca(rotulo, dica) {
  return `<div class="busca" hidden><label for="buscar-guias">${rotulo}</label><input id="buscar-guias" type="search" placeholder="${dica}" autocomplete="off"><output id="resultado-busca" aria-live="polite"></output></div>`;
}

function renderLicao(licao, porId) {
  const f = porId.get(licao.ferramenta);
  const [legenda, imagem] = figuras[licao.id];
  return `<article class="licao" id="${licao.id}" data-item aria-labelledby="${licao.id}-titulo">
    <header>
      <h3 id="${licao.id}-titulo">${texto(licao.titulo)}</h3>
      <p>${texto(licao.uso)}</p>
    </header>
    <div class="licao-exemplo">
      <figure><div class="palco" aria-hidden="true">${imagem}</div><figcaption>${texto(legenda)}</figcaption></figure>
      <dl class="parametros">${licao.dados.map(([k,v]) => `<div><dt>${texto(k)}</dt><dd>${texto(v)}</dd></div>`).join('')}</dl>
    </div>
    <ol class="passos">${licao.passos.map(([nome, instrucao]) => `<li><strong>${texto(nome)}</strong><p>${texto(instrucao)}</p></li>`).join('')}</ol>
    <p class="checagem"><strong>Conferência</strong> ${texto(licao.checagem)}</p>
    <div class="licao-rodape"><span>${texto(f.titulo)}</span>${acoes(f)}</div>
  </article>`;
}

export function renderTutoriais(porId) {
  const indice = modulos.map(({id,titulo,licoes}) => `<details open data-indice="${id}"><summary><a href="#${id}">${texto(titulo)}</a></summary><ul>${licoes.map(l => `<li><a href="#${l.id}" data-indice-item="${l.id}">${texto(l.titulo)}</a></li>`).join('')}</ul></details>`).join('');
  return pagina('tutoriais', 'Tutoriais de pré-impressão', 'Exemplos ilustrados e passo a passo de pré-impressão, acabamento e calendários no Illustrator.', `
    <header class="abertura">
      <div><p class="linha-fina">Pré-impressão no Illustrator</p><h1>Tutoriais de produção gráfica</h1>
      <p>Reproduza cada operação com medidas de exemplo e confira a saída antes de imprimir ou finalizar o trabalho.</p>
      <a class="primaria" href="#gabaritos">Começar pelos gabaritos ↓</a></div>
      <div class="como-abrir"><h2>Como abrir uma ferramenta</h2><ol>
        <li>No painel, abra <strong>Janela → Extensões → IBD Ferramentas</strong> e procure pelo nome indicado na lição.</li>
        <li>Para usar um JSX avulso, clique em <strong>Baixar script</strong> e abra o arquivo em <strong>Arquivo → Scripts → Outro script</strong>.</li>
      </ol></div>
    </header>
    ${busca('Buscar tutorial', 'Sangria, Wire-o ou verniz')}
    <div class="leitura">
      <aside class="indice"><nav aria-label="Índice de tutoriais"><h2>Etapas de produção</h2>${indice}</nav></aside>
      <div class="grupos">${modulos.map(m => `<section class="grupo" data-grupo id="${m.id}" aria-labelledby="${m.id}-titulo">
        <h2 id="${m.id}-titulo">${texto(m.titulo)}</h2>
        ${m.licoes.map(l => renderLicao(l, porId)).join('')}
      </section>`).join('')}
      <p class="sem-resultados" hidden>Nenhum tutorial corresponde à busca.</p></div>
    </div>`);
}

export function scriptsDaVitrine(ferramentas) {
  return ferramentas.filter(f => f.tipo === 'script' || (f.id.startsWith('desktop/') && f.tipo === 'utilitário'));
}

export function renderScripts(ferramentas, nomesApps) {
  const scripts = scriptsDaVitrine(ferramentas);
  const grupos = new Map();
  for (const f of scripts) {
    if (!f.baixar || !f.codigo) throw new Error(`Script sem download ou código: ${f.id}.`);
    if (!grupos.has(f.app)) grupos.set(f.app, []);
    grupos.get(f.app).push(f);
  }
  const editores = [...grupos].sort(([a], [b]) => nomesApps[a].localeCompare(nomesApps[b], 'pt-BR'));
  return pagina('scripts', 'Scripts do DesignProd', 'Scripts de produção gráfica publicados no DesignProd para baixar e consultar no GitHub.', `
    <header class="abertura abertura-scripts">
      <div><p class="linha-fina">Repositório DesignProd</p><h1>Scripts</h1><p>${scripts.length} scripts de produção gráfica e automação. Escolha o editor, baixe o arquivo pronto ou abra o código-fonte.</p></div>
    </header>
    ${busca('Buscar script', 'Illustrator, corte ou calendário')}
    ${editores.map(([app,lista]) => `<section class="grupo grupo-scripts" data-grupo id="${texto(app)}">
      <h2>${texto(nomesApps[app])}</h2>
      <ul class="scripts-lista">${lista.map(f => `<li class="script" data-item data-busca="${texto([nomesApps[app], f.id, ...(f.tags || [])].join(' '))}">
        <div><h3>${texto(f.titulo)}</h3><p>${texto(f.descricao)}</p></div>
        ${f.tutorial ? `<a class="acao tutorial-link" href="${texto(f.tutorial)}">Tutorial</a>` : ''}
        ${acoes(f)}
      </li>`).join('')}</ul>
    </section>`).join('')}
    <p class="sem-resultados" hidden>Nenhum script corresponde à busca.</p>`);
}
