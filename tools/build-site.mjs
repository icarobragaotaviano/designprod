#!/usr/bin/env node
/**
 * Gera a vitrine do catalogo para publicar na Vercel.
 *
 *  1. le catalog.json — a mesma fonte que o painel UXP usa
 *  2. enriquece cada ferramenta com o que so existe no disco: caminho do
 *     codigo servido, link da documentacao no GitHub e o arquivo pronto
 *     para baixar, com os #include ja resolvidos
 *  3. aplica os tokens de brand.config.json no CSS e no HTML
 *  4. gera o pacote do painel UXP e o serve junto, para o site entregar o
 *     plugin pronto em vez de mandar o visitante rodar um build
 *  5. escreve tudo na pasta que o proprio vercel.json declara como saida
 *
 * A pasta de saida vem de vercel.json justamente para nao haver duas
 * verdades sobre onde o site nasce.
 *
 * Uso: npm run build:site
 */
import { readFile, writeFile, cp, rm, mkdir, access, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reunirVersoes } from './familias-site.mjs';
import { padronizarVitrine } from './catalogo-vitrine.mjs';
import { familiaImposicao } from '../nobel/imposicao/versoes.mjs';
import { APPS } from './lib/meta.mjs';
import { resolverIncludes, montarArquivoPublicavel } from './lib/incluir.mjs';
import { ICONES, PALETA_ICONES, gerarCodigoIconesJs } from './lib/icones.mjs';
import { prepararGuias, renderScripts, renderTutoriais } from '../site/src/guias/render.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(RAIZ, 'site', 'src');

const marca = JSON.parse(await readFile(path.join(RAIZ, 'brand.config.json'), 'utf8'));
const catalogo = JSON.parse(await readFile(path.join(RAIZ, 'catalog.json'), 'utf8'));
const vercel = JSON.parse(await readFile(path.join(RAIZ, 'vercel.json'), 'utf8'));

const SAIDA = path.join(RAIZ, vercel.outputDirectory);

/* 1. De onde vem o repositorio ----------------------------------------- */

/**
 * Descobre dono, repositorio e branch. Na Vercel vem das variaveis de
 * ambiente do build; fora dela, do git local. Sem nenhum dos dois, o site
 * sai sem os links do GitHub em vez de sair com link quebrado.
 */
function origem() {
  const dono = process.env.VERCEL_GIT_REPO_OWNER;
  const nome = process.env.VERCEL_GIT_REPO_SLUG;
  const ref = process.env.VERCEL_GIT_COMMIT_REF;
  if (dono && nome) return { url: `https://github.com/${dono}/${nome}`, ref: ref || null };

  try {
    const git = (...args) => execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8' }).trim();
    const remoto = git('remote', 'get-url', 'origin');
    const achado = remoto.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (!achado) return null;
    const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
    return { url: `https://github.com/${achado[1]}`, ref: branch === 'HEAD' ? null : branch };
  } catch {
    return null;
  }
}

const repo = origem();
const fonteNoGitHub = arquivo => repo?.ref ? `${repo.url}/blob/${repo.ref}/${arquivo}` : undefined;

/* 2. Enriquecer as ferramentas ----------------------------------------- */

/**
 * Versao de cada ferramenta pronta para usar no app: os #include viram o
 * proprio conteudo, entao o arquivo baixado roda sozinho por
 * Arquivo > Scripts > Procurar — sem precisar do repositorio na maquina.
 *
 * O nome do arquivo baixado e o mesmo que tools/install-dev.mjs grava na
 * pasta do app, para a ferramenta aparecer no menu com o rotulo de sempre.
 */
const prontos = [];

async function prepararDownload(f) {
  const ext = path.extname(f.arquivo).toLowerCase() || '.jsx';
  const { conteudo, embutidos } = ext === '.jsx'
    ? await resolverIncludes(RAIZ, f.arquivo)
    : { conteudo: await readFile(path.join(RAIZ, f.arquivo), 'utf8'), embutidos: [] };
  const texto = montarArquivoPublicavel(f, marca, conteudo, embutidos);
  // O id ja e unico no catalogo (<app>/<nome>), entao serve de endereco.
  const destino = `downloads/ferramentas/${f.id}${ext}`;

  prontos.push({ destino, texto });
  return {
    baixar: destino,
    baixarNome: `${marca.nome} ${f.titulo}${ext}`,
    baixarTamanho: Math.max(1, Math.round(Buffer.byteLength(texto, 'utf8') / 1024)),
    coreEmbutido: embutidos.length
  };
}

const ferramentas = [];
const nomesUsados = new Set();
for (const f of catalogo.ferramentas) {
  const item = { ...f };
  item.codigo = 'arquivos/' + f.arquivo;
  item.codigoRotulo = f.tipo === 'action' ? 'Baixar action' : 'Ver código';
  if (f.doc && repo && repo.ref) item.docUrl = `${repo.url}/blob/${repo.ref}/${f.doc}`;

  if (f.tipo === 'script') {
    item.fonteRepositorio = fonteNoGitHub(f.arquivo);
    const pronto = await prepararDownload(f);
    if (nomesUsados.has(pronto.baixar)) {
      console.error(`Dois scripts disputariam o mesmo endereco de download: ${pronto.baixar}`);
      process.exit(1);
    }
    nomesUsados.add(pronto.baixar);
    Object.assign(item, pronto);
  } else if (f.tipo === 'action') {
    const dadosAction = await readFile(path.join(RAIZ, f.arquivo));
    const kb = Math.max(1, Math.round(dadosAction.length / 1024));
    item.baixar = 'arquivos/' + f.arquivo;
    item.baixarNome = `${marca.nome} ${f.titulo}.atn`;
    item.baixarTamanho = kb;
    item.codigo = null; // download direto pelo botao principal
  }

  ferramentas.push(item);
}

const semDoc = ferramentas.filter((f) => f.doc && !f.docUrl).length;
if (semDoc) {
  console.warn(`aviso: ${semDoc} ferramenta(s) com @ibd-doc ficaram sem link — origem do repositório desconhecida.`);
}

/* 3. Acoes do cabecalho ------------------------------------------------- */

const acoes = [];
if (repo && repo.ref) {
  acoes.push({
    rotulo: 'Baixar o repositório',
    url: `${repo.url}/archive/refs/heads/${repo.ref}.zip`,
    externa: true
  });
}
if (repo) {
  acoes.push({ rotulo: 'Ver no GitHub', url: repo.url, externa: true, secundaria: true });
}

const nomesApps = {};
for (const [id, info] of Object.entries(APPS)) nomesApps[id] = info.nome;

/* 3b. Pacote do painel UXP ---------------------------------------------- */

/**
 * O pacote e gerado a cada build do site: assim o botao de download nunca
 * entrega um painel mais velho que o catalogo que ele mostra.
 *
 * Falhar aqui derruba o build de proposito. Seguir em frente publicaria uma
 * pagina verde, sem o botao e sem ninguem perceber — o pior dos dois mundos,
 * porque o download do painel e uma promessa da pagina, nao um extra.
 */
async function empacotarPainel() {
  try {
    execFileSync(process.execPath, [path.join(RAIZ, 'tools', 'build-plugin.mjs'), '--all'], {
      cwd: RAIZ,
      stdio: 'pipe'
    });
  } catch (e) {
    const detalhe = (e.stderr || e.stdout || '').toString().trim() || e.message;
    console.error('Nao foi possivel montar os pacotes de plugins:\n' + detalhe);
    process.exit(1);
  }

  await mkdir(path.join(SAIDA, 'downloads'), { recursive: true });
  const basePs = `${marca.id}-ferramentas-${marca.versao}`;

  const specs = [
    {
      id: 'photoshop-uxp',
      titulo: 'Photoshop UXP (Painel nativo)',
      descricao: 'Grade de ícones com execução em 1 clique, busca e favoritos direto no Photoshop.',
      arquivo: `${basePs}.ccx`,
      altArquivo: `${basePs}.zip`,
      icone: 'organizacao'
    },
    {
      id: 'indesign-uxp',
      titulo: 'InDesign UXP (Painel 18.5+)',
      descricao: 'Painel nativo UXP para executar os scripts do InDesign com grade visual de ícones.',
      arquivo: `${marca.id}-indesign-uxp-${marca.versao}.ccx`,
      altArquivo: `${marca.id}-indesign-uxp-${marca.versao}.zip`,
      icone: 'pdf'
    },
    {
      id: 'adobe-cep',
      titulo: 'Illustrator / Adobe CEP Universal',
      descricao: 'Extensão encaixável HTML5 compatível com Illustrator, After Effects, InDesign e Photoshop (inclui instalador 1 clique).',
      arquivo: `${marca.id}-adobe-cep-${marca.versao}.zip`,
      icone: 'guia-interna'
    },
    {
      id: 'aftereffects-dock',
      titulo: 'After Effects (Painel ScriptUI)',
      descricao: 'Arquivo encaixável para Janela > Extensões ou ScriptUI Panels com miniaturas desenhadas no código.',
      arquivo: `${marca.id}-aftereffects-painel-${marca.versao}.zip`,
      icone: 'organizacao'
    },
    {
      id: 'coreldraw-toolbar',
      titulo: 'CorelDRAW (Barra com Ícones .ico)',
      descricao: 'Módulos VBA + pacote de ícones 32×32 (.ico) e macro instaladora que cria a barra de ferramentas pronta no CorelDRAW.',
      arquivo: `${marca.id}-coreldraw-barra-${marca.versao}.zip`,
      icone: 'contorno-offset'
    }
  ];

  const paineis = [];
  for (const spec of specs) {
    const origem = path.join(RAIZ, 'dist', spec.arquivo);
    const tamanho = (await stat(origem)).size;
    if (tamanho < 256) {
      console.error(`dist/${spec.arquivo} saiu vazio (${tamanho} bytes).`);
      process.exit(1);
    }
    await cp(origem, path.join(SAIDA, 'downloads', spec.arquivo));
    const entry = {
      id: spec.id,
      titulo: spec.titulo,
      descricao: spec.descricao,
      icone: spec.icone,
      baixar: `downloads/${spec.arquivo}`,
      nome: spec.arquivo,
      versao: marca.versao,
      tamanho: Math.max(1, Math.round(tamanho / 1024))
    };
    if (spec.altArquivo) {
      await cp(path.join(RAIZ, 'dist', spec.altArquivo), path.join(SAIDA, 'downloads', spec.altArquivo));
      entry.alt = `downloads/${spec.altArquivo}`;
      entry.altNome = spec.altArquivo;
    }
    paineis.push(entry);
  }

  return {
    principal: {
      ccx: `downloads/${basePs}.ccx`,
      zip: `downloads/${basePs}.zip`,
      nome: `${basePs}.ccx`,
      versao: marca.versao,
      tamanho: paineis[0].tamanho
    },
    paineis
  };
}

nomesApps.web='Navegador';
const {apps,desktop} = await import('../nobel/catalogo.mjs');
for(const [id,titulo,categoria,descricao] of apps) ferramentas.push({id:'web/'+id,titulo,descricao,app:'web',tipo:'app',versao:marca.versao,abrir:'/apps/'+id+'/',tags:[categoria]});
for(const [nome,rotulo] of desktop){
  const [editor,titulo]=rotulo.split(' · ');
  const app=editor.toLowerCase();
  nomesApps[app]=editor;
  const id='desktop/'+nome;
  const imposicao=familiaImposicao.includes(id);
  const descricao=imposicao?'Monte duas folhas alinhadas em escala real, com a arte de impressão e a faca de corte.':rotulo;
  const docUrl=imposicao && repo && repo.ref ? `${repo.url}/blob/${repo.ref}/docs/fluxos-de-producao.md#imposição-de-arte-e-corte` : undefined;
  const arquivo = 'nobel/desktop/' + nome;
  ferramentas.push({id,titulo,descricao,docUrl,app,tipo:'utilitário',versao:marca.versao,baixar:'/apps/desktop/'+nome,
    baixarNome:nome,baixarTamanho:Math.max(1,Math.ceil((await stat(path.join(RAIZ,arquivo))).size/1024)),
    codigo:'arquivos/'+arquivo,fonteRepositorio:fonteNoGitHub(arquivo)});
}
padronizarVitrine(ferramentas);
reunirVersoes(ferramentas);
const ferramentasPorId = prepararGuias(ferramentas);
const dados = {
  marca: catalogo.marca,
  versao: catalogo.versao,
  nomesApps,
  acoes,
  icones: { paleta: PALETA_ICONES, definicoes: ICONES },
  ferramentas
};

/* 4. Escrever a saida --------------------------------------------------- */

await rm(SAIDA, { recursive: true, force: true });
await mkdir(SAIDA, { recursive: true });

const empacotados = await empacotarPainel();
dados.painel = empacotados.principal;
dados.paineis = empacotados.paineis;
for(const [id,titulo] of [['painel','Painel de ferramentas do Photoshop'],['renomear','Renomear camadas selecionadas'],['limpar','Limpar nomes de camadas']]){
  ferramentas.push({id:'desktop/uxp/'+id,titulo,descricao:'Disponível no painel UXP do Photoshop.',app:'photoshop',tipo:'plugin',versao:dados.painel.versao,baixar:dados.painel.ccx,baixarNome:dados.painel.nome,baixarTamanho:dados.painel.tamanho});
}
padronizarVitrine(ferramentas);
await cp(path.join(RAIZ,'docs/ibd-theme.css'),path.join(SAIDA,'ibd-theme.css'));

// CSS: mesmos tokens do painel, mesma fonte unica.
const mapaTokens = {
  fundo: 'fundo',
  superficie: 'superficie',
  texto: 'texto',
  textoSecundario: 'texto-secundario',
  acento: 'acento',
  acentoTexto: 'acento-texto',
  borda: 'borda',
  erro: 'erro',
  sucesso: 'sucesso'
};

let css = await readFile(path.join(SRC, 'styles.css'), 'utf8');
for (const [chave, token] of Object.entries(mapaTokens)) {
  const valor = marca.cores[chave];
  if (!valor) continue;
  css = css.replace(new RegExp(`--${token}:\\s*[^;]+;`), () => `--${token}: ${valor};`);
}
await writeFile(path.join(SAIDA, 'styles.css'), css, 'utf8');

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
  `<rect width="64" height="64" rx="14" fill="${marca.cores.acento}"/>` +
  `<text x="32" y="42" text-anchor="middle" font-family="sans-serif" font-size="24" ` +
  `font-weight="bold" fill="${marca.cores.fundo}">${marca.nome}</text></svg>`;

const substituicoes = {
  MARCA: marca.nome,
  NOME_COMPLETO: marca.nomeCompleto || marca.nome,
  VERSAO: catalogo.versao,
  CLONE: repo ? `${repo.url}.git` : 'git@github.com:SEU-USUARIO/designprod.git',
  FAVICON: encodeURIComponent(favicon),
  DADOS: JSON.stringify(dados)
};

let html = await readFile(path.join(SRC, 'index.html'), 'utf8');
for (const [chave, valor] of Object.entries(substituicoes)) {
  // Funcao no lugar da string: o conteudo tem "$" e nao pode virar padrao.
  html = html.replaceAll(`{{${chave}}}`, () => valor);
}
const pendentes = html.match(/\{\{[A-Z_]+\}\}/g);
if (pendentes) {
  console.error('Marcadores sem valor no HTML: ' + [...new Set(pendentes)].join(', '));
  process.exit(1);
}
await writeFile(path.join(SAIDA, 'index.html'), html, 'utf8');

await Promise.all([
  cp(path.join(SRC, 'guias', 'guias.css'), path.join(SAIDA, 'guias.css')),
  cp(path.join(SRC, 'guias', 'guias.js'), path.join(SAIDA, 'guias.js')),
  ...[
    ['tutoriais', renderTutoriais(ferramentasPorId)],
    ['scripts', renderScripts(ferramentas, nomesApps)]
  ].map(async ([rota, pagina]) => {
    const pasta = path.join(SAIDA, rota);
    await mkdir(pasta, { recursive: true });
    await writeFile(path.join(pasta, 'index.html'), pagina, 'utf8');
  })
]);

await writeFile(path.join(SAIDA, 'icones.js'), gerarCodigoIconesJs(), 'utf8');
await cp(path.join(SRC, 'plugin-builder.js'), path.join(SAIDA, 'plugin-builder.js'));
await cp(path.join(SRC, 'app.js'), path.join(SAIDA, 'app.js'));

// Os arquivos prontos para usar no app, um por ferramenta.
for (const { destino, texto } of prontos) {
  const caminho = path.join(SAIDA, destino);
  await mkdir(path.dirname(caminho), { recursive: true });
  await writeFile(caminho, texto, 'utf8');
}

// Os arquivos servidos: o codigo de cada ferramenta e a biblioteca comum.
await cp(path.join(RAIZ, 'apps'), path.join(SAIDA, 'arquivos', 'apps'), { recursive: true });
await cp(path.join(RAIZ, 'core'), path.join(SAIDA, 'arquivos', 'core'), { recursive: true });
await cp(path.join(RAIZ, 'nobel', 'desktop'), path.join(SAIDA, 'arquivos', 'nobel', 'desktop'), { recursive: true });

const downloads = path.join(RAIZ, 'downloads');
if (await access(downloads).then(() => true, () => false)) {
  await cp(downloads, path.join(SAIDA, 'downloads'), { recursive: true });
}

const relativa = path.relative(RAIZ, SAIDA);
console.log(`Site pronto em ${relativa}: ${ferramentas.length} ferramentas, ${prontos.length} prontas para baixar.`);
console.log(`Painel UXP: ${dados.painel.nome} (${dados.painel.tamanho} KB) pronto para download.`);
console.log(repo ? `Origem: ${repo.url}${repo.ref ? ' (' + repo.ref + ')' : ' — branch desconhecida'}` : 'Sem origem git: links do GitHub omitidos.');

await import('./build-nobel.mjs');
