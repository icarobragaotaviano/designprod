#!/usr/bin/env node
/**
 * Gera catalog.json a partir dos metadados dos scripts.
 * O catalogo e o contrato entre os scripts e os plugins: o painel
 * do plugin le esse arquivo, nao uma lista fixa em codigo.
 *
 * Uso: npm run catalog
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarCatalogo } from './lib/meta.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { catalogo, problemas } = await montarCatalogo(RAIZ);

if (problemas.length) {
  console.error('Problemas encontrados:');
  for (const p of problemas) console.error('  - ' + p);
  process.exitCode = 1;
}

const destino = path.join(RAIZ, 'catalog.json');
await writeFile(destino, JSON.stringify(catalogo, null, 2) + '\n', 'utf8');

// O plugin le uma copia local para nao depender da arvore do repo em runtime.
const copiaPlugin = path.join(RAIZ, 'plugins', 'photoshop-uxp', 'src', 'catalog.json');
await writeFile(copiaPlugin, JSON.stringify(catalogo, null, 2) + '\n', 'utf8');

console.log(`catalog.json atualizado: ${catalogo.ferramentas.length} ferramentas.`);
