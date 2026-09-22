#!/usr/bin/env node
/**
 * Empacota o plugin UXP:
 *  1. aplica os tokens de brand.config.json no CSS e no manifest
 *  2. copia catalog.json para dentro do plugin
 *  3. copia apps/ e core/ para src/bundle/, preservando a profundidade
 *     relativa — assim os #include dos scripts continuam resolvendo
 *  4. empacota tudo em dist/<marca>-<versao>.ccx, pronto para instalar
 *
 * Uso: npm run build:plugin
 */
import { readFile, writeFile, readdir, cp, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarZip } from './lib/zip.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = process.argv[2] || 'photoshop-uxp';
const DIR = path.join(RAIZ, 'plugins', plugin);
const SRC = path.join(DIR, 'src');

const marca = JSON.parse(await readFile(path.join(RAIZ, 'brand.config.json'), 'utf8'));

/* 1. Tokens de cor ------------------------------------------------------ */

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

const cssPath = path.join(SRC, 'styles.css');
let css = await readFile(cssPath, 'utf8');
for (const [chave, token] of Object.entries(mapaTokens)) {
  const valor = marca.cores[chave];
  if (!valor) continue;
  css = css.replace(new RegExp(`(--${token}:\\s*)[^;]+;`), `$1${valor};`);
}
await writeFile(cssPath, css, 'utf8');

/* 2. Identidade no manifest -------------------------------------------- */

const manifestPath = path.join(DIR, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.name = `${marca.nome} Ferramentas`;
manifest.version = marca.versao;
manifest.entrypoints[0].label.default = `${marca.nome} Ferramentas`;
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

/* 3. Catalogo + bundle dos scripts -------------------------------------- */

await cp(path.join(RAIZ, 'catalog.json'), path.join(SRC, 'catalog.json'));

const bundle = path.join(SRC, 'bundle');
await rm(bundle, { recursive: true, force: true });
await mkdir(bundle, { recursive: true });
await cp(path.join(RAIZ, 'core'), path.join(bundle, 'core'), { recursive: true });
await cp(path.join(RAIZ, 'apps'), path.join(bundle, 'apps'), { recursive: true });

/* 4. Pacote instalavel --------------------------------------------------- */

/** Todos os arquivos da pasta, em caminho relativo com barra normal. */
async function varrer(dir, base = dir) {
  const entradas = await readdir(dir, { withFileTypes: true });
  const saida = [];
  for (const entrada of entradas) {
    // Arquivo oculto do sistema nao entra no pacote.
    if (entrada.name.startsWith('.')) continue;
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      saida.push(...(await varrer(completo, base)));
    } else if (entrada.isFile()) {
      saida.push(path.relative(base, completo).split(path.sep).join('/'));
    }
  }
  return saida.sort();
}

const caminhos = await varrer(DIR);
if (!caminhos.includes('manifest.json')) {
  console.error('manifest.json precisa estar na raiz do plugin para o pacote ser instalavel.');
  process.exit(1);
}

const entradas = [];
for (const relativo of caminhos) {
  entradas.push({ nome: relativo, dados: await readFile(path.join(DIR, relativo)) });
}

const pacote = criarZip(entradas);
const DIST = path.join(RAIZ, 'dist');
await mkdir(DIST, { recursive: true });

// O mesmo conteudo sob dois nomes: .ccx para o Creative Cloud abrir com um
// duplo clique, .zip para quem vai descompactar e carregar no UXP Developer
// Tool. Sao os dois caminhos de instalacao, e o arquivo e identico.
const base = `${marca.id}-ferramentas-${marca.versao}`;
await writeFile(path.join(DIST, `${base}.ccx`), pacote);
await writeFile(path.join(DIST, `${base}.zip`), pacote);

console.log(`Plugin ${plugin} pronto em ${path.relative(RAIZ, DIR)}.`);
console.log(`Pacote: dist/${base}.ccx e dist/${base}.zip — ${entradas.length} arquivos, ${(pacote.length / 1024).toFixed(0)} KB.`);
console.log('Instale pelo Creative Cloud (.ccx) ou carregue o .zip descompactado no Adobe UXP Developer Tool.');
