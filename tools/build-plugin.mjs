#!/usr/bin/env node
/**
 * Empacota o plugin UXP:
 *  1. aplica os tokens de brand.config.json no CSS e no manifest
 *  2. copia catalog.json para dentro do plugin
 *  3. copia apps/ e core/ para src/bundle/, preservando a profundidade
 *     relativa — assim os #include dos scripts continuam resolvendo
 *
 * Uso: npm run build:plugin
 */
import { readFile, writeFile, cp, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

console.log(`Plugin ${plugin} pronto em ${path.relative(RAIZ, DIR)}.`);
console.log('Carregue-o no Adobe UXP Developer Tool apontando para o manifest.json.');
