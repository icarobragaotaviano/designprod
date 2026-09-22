#!/usr/bin/env node
/**
 * Validacao do repositorio. Roda no CI e antes de qualquer release.
 *
 * Verifica:
 *  - metadados completos e coerentes em todos os scripts
 *  - catalog.json sincronizado com os arquivos
 *  - caminhos de #include existentes
 *  - manifest do plugin UXP valido
 *
 * Uso: npm run validate
 */
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarCatalogo, listarArquivos } from './lib/meta.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const erros = [];
const avisos = [];

/* 1. Metadados e catalogo ---------------------------------------------- */

const { catalogo, problemas } = await montarCatalogo(RAIZ);
erros.push(...problemas);

try {
  const emDisco = JSON.parse(await readFile(path.join(RAIZ, 'catalog.json'), 'utf8'));
  if (JSON.stringify(emDisco) !== JSON.stringify(catalogo)) {
    erros.push('catalog.json esta desatualizado. Rode: npm run catalog');
  }
} catch {
  erros.push('catalog.json nao encontrado ou ilegivel. Rode: npm run catalog');
}

/* 2. #include apontando para arquivos existentes ----------------------- */

const scripts = [
  ...(await listarArquivos(path.join(RAIZ, 'apps'), 'jsx')),
  ...(await listarArquivos(path.join(RAIZ, 'core'), 'jsx'))
];

for (const arquivo of scripts) {
  const conteudo = await readFile(arquivo, 'utf8');
  const includes = [...conteudo.matchAll(/^[ \t]*#include\s+"([^"]+)"/gm)].map((m) => m[1]);
  for (const alvo of includes) {
    const resolvido = path.resolve(path.dirname(arquivo), alvo);
    try {
      await access(resolvido);
    } catch {
      erros.push(`${path.relative(RAIZ, arquivo)}: #include quebrado -> ${alvo}`);
    }
  }
  if (!/^\s*\/\*\*/.test(conteudo)) {
    avisos.push(`${path.relative(RAIZ, arquivo)}: arquivo nao comeca com bloco de documentacao.`);
  }
}

/* 3. Documentacao apontada pelos metadados ----------------------------- */

for (const ferramenta of catalogo.ferramentas) {
  if (!ferramenta.doc) continue;
  await access(path.join(RAIZ, ferramenta.doc)).catch(() =>
    erros.push(`${ferramenta.arquivo}: @ibd-doc aponta para arquivo inexistente (${ferramenta.doc})`)
  );
}

/* 4. Deploy: vercel.json coerente com o package.json ------------------- */

try {
  const vercel = JSON.parse(await readFile(path.join(RAIZ, 'vercel.json'), 'utf8'));
  const pacote = JSON.parse(await readFile(path.join(RAIZ, 'package.json'), 'utf8'));

  const comando = String(vercel.buildCommand || '');
  const script = comando.replace(/^npm run /, '');
  if (!comando.startsWith('npm run') || !pacote.scripts[script]) {
    erros.push(`vercel.json: buildCommand "${comando}" nao corresponde a um script do package.json.`);
  }
  if (!vercel.outputDirectory) {
    erros.push('vercel.json: outputDirectory ausente — e dele que tools/build-site.mjs tira a pasta de saida.');
  }
} catch (e) {
  erros.push(`vercel.json ilegivel: ${e.message}`);
}

/* 5. Manifest do plugin UXP -------------------------------------------- */

const manifestPath = path.join(RAIZ, 'plugins', 'photoshop-uxp', 'manifest.json');
try {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  for (const campo of ['id', 'name', 'version', 'main', 'host', 'manifestVersion']) {
    if (manifest[campo] === undefined) erros.push(`manifest.json: campo obrigatorio ausente: ${campo}`);
  }
  if (manifest.version && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    erros.push('manifest.json: version precisa ser x.y.z');
  }
  const principal = path.join(path.dirname(manifestPath), manifest.main || '');
  await access(principal).catch(() => erros.push(`manifest.json: "main" aponta para arquivo inexistente (${manifest.main})`));
} catch (e) {
  erros.push(`manifest.json do plugin ilegivel: ${e.message}`);
}

/* Resultado ------------------------------------------------------------ */

for (const a of avisos) console.warn('aviso: ' + a);

if (erros.length) {
  console.error('\nValidacao falhou:');
  for (const e of erros) console.error('  - ' + e);
  process.exit(1);
}

console.log(`Validacao ok — ${catalogo.ferramentas.length} ferramentas, ${scripts.length} arquivos ExtendScript.`);
