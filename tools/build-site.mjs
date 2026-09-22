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
import { APPS } from './lib/meta.mjs';
import { resolverIncludes, cabecalho } from './lib/incluir.mjs';

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
  const { conteudo, embutidos } = await resolverIncludes(RAIZ, f.arquivo);
  const texto = cabecalho(f, marca, embutidos) + conteudo;
  // O id ja e unico no catalogo (<app>/<nome>), entao serve de endereco.
  const destino = `downloads/ferramentas/${f.id}.jsx`;

  prontos.push({ destino, texto });
  return {
    baixar: destino,
    baixarNome: `${marca.nome} ${f.titulo}.jsx`,
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
  const base = `${marca.id}-ferramentas-${marca.versao}`;

  try {
    execFileSync(process.execPath, [path.join(RAIZ, 'tools', 'build-plugin.mjs'), 'photoshop-uxp'], {
      cwd: RAIZ,
      stdio: 'pipe'
    });
  } catch (e) {
    const detalhe = (e.stderr || e.stdout || '').toString().trim() || e.message;
    console.error('Nao foi possivel montar o pacote do painel UXP:\n' + detalhe);
    process.exit(1);
  }

  const origem = path.join(RAIZ, 'dist', `${base}.ccx`);
  let tamanho = 0;
  try {
    tamanho = (await stat(origem)).size;
  } catch {
    console.error(`O build do plugin terminou sem gerar dist/${base}.ccx.`);
    process.exit(1);
  }

  // Um pacote minusculo significa build vazio: melhor parar que publicar.
  if (tamanho < 1024) {
    console.error(`dist/${base}.ccx tem so ${tamanho} bytes — o pacote saiu vazio.`);
    process.exit(1);
  }

  await mkdir(path.join(SAIDA, 'downloads'), { recursive: true });
  await cp(origem, path.join(SAIDA, 'downloads', `${base}.ccx`));
  await cp(path.join(RAIZ, 'dist', `${base}.zip`), path.join(SAIDA, 'downloads', `${base}.zip`));

  return {
    ccx: `downloads/${base}.ccx`,
    zip: `downloads/${base}.zip`,
    nome: `${base}.ccx`,
    versao: marca.versao,
    tamanho: Math.round(tamanho / 1024)
  };
}

const dados = { marca: catalogo.marca, versao: catalogo.versao, nomesApps, acoes, ferramentas };

/* 4. Escrever a saida --------------------------------------------------- */

await rm(SAIDA, { recursive: true, force: true });
await mkdir(SAIDA, { recursive: true });

dados.painel = await empacotarPainel();

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

const downloads = path.join(RAIZ, 'downloads');
if (await access(downloads).then(() => true, () => false)) {
  await cp(downloads, path.join(SAIDA, 'downloads'), { recursive: true });
}

const relativa = path.relative(RAIZ, SAIDA);
console.log(`Site pronto em ${relativa}: ${ferramentas.length} ferramentas, ${prontos.length} prontas para baixar.`);
console.log(`Painel UXP: ${dados.painel.nome} (${dados.painel.tamanho} KB) pronto para download.`);
console.log(repo ? `Origem: ${repo.url}${repo.ref ? ' (' + repo.ref + ')' : ' — branch desconhecida'}` : 'Sem origem git: links do GitHub omitidos.');
