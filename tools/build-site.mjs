#!/usr/bin/env node
/**
 * Gera a vitrine do catalogo para publicar na Vercel.
 *
 *  1. le catalog.json — a mesma fonte que o painel UXP usa
 *  2. enriquece cada ferramenta com o que so existe no disco: caminho do
 *     codigo servido, link da documentacao no GitHub e se ela depende de core/
 *  3. aplica os tokens de brand.config.json no CSS e no HTML
 *  4. gera o pacote do painel UXP e o serve junto, para o site entregar o
 *     plugin instalado em vez de mandar o visitante rodar um build
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

async function dependeDoCore(relativo) {
  try {
    const conteudo = await readFile(path.join(RAIZ, relativo), 'utf8');
    return /^[ \t]*#include\s+"/m.test(conteudo);
  } catch {
    return false;
  }
}

const ferramentas = [];
for (const f of catalogo.ferramentas) {
  const item = { ...f };
  item.codigo = 'arquivos/' + f.arquivo;
  item.codigoRotulo = f.tipo === 'action' ? 'Baixar action' : 'Ver código';
  if (f.tipo === 'script') item.precisaCore = await dependeDoCore(f.arquivo);
  if (f.doc && repo && repo.ref) item.docUrl = `${repo.url}/blob/${repo.ref}/${f.doc}`;
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
 * entrega um painel mais velho que o catalogo que ele mostra. Se a geracao
 * falhar, o site sai sem o botao em vez de sair com um link quebrado.
 */
async function empacotarPainel() {
  const base = `${marca.id}-ferramentas-${marca.versao}`;
  try {
    execFileSync(process.execPath, [path.join(RAIZ, 'tools', 'build-plugin.mjs'), 'photoshop-uxp'], {
      cwd: RAIZ,
      stdio: 'pipe'
    });

    const origem = path.join(RAIZ, 'dist', `${base}.ccx`);
    const tamanho = (await stat(origem)).size;
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
  } catch (e) {
    console.warn(`aviso: o pacote do painel nao pode ser gerado (${e.message.split('\n')[0]}); o site sai sem o botao.`);
    return null;
  }
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

// Os arquivos servidos: o codigo de cada ferramenta e a biblioteca comum.
await cp(path.join(RAIZ, 'apps'), path.join(SAIDA, 'arquivos', 'apps'), { recursive: true });
await cp(path.join(RAIZ, 'core'), path.join(SAIDA, 'arquivos', 'core'), { recursive: true });

const downloads = path.join(RAIZ, 'downloads');
if (await access(downloads).then(() => true, () => false)) {
  await cp(downloads, path.join(SAIDA, 'downloads'), { recursive: true });
}

const relativa = path.relative(RAIZ, SAIDA);
console.log(`Site pronto em ${relativa}: ${ferramentas.length} ferramentas.`);
console.log(dados.painel
  ? `Painel UXP: ${dados.painel.nome} (${dados.painel.tamanho} KB) pronto para download.`
  : 'Painel UXP: pacote ausente — o botao de download nao aparece.');
console.log(repo ? `Origem: ${repo.url}${repo.ref ? ' (' + repo.ref + ')' : ' — branch desconhecida'}` : 'Sem origem git: links do GitHub omitidos.');
