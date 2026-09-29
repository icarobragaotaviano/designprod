#!/usr/bin/env node
/**
 * Embute os PSDs de referencia de textos e precos em criar-textos-precos.jsx.
 *
 * Os bytes viram literais de string com escapes \xHH: o proprio interpretador
 * do ExtendScript decodifica, sem laco de base64 no Photoshop.
 * Rode depois de trocar um PSD em apps/photoshop/templates/textos-precos/.
 *
 * Uso: node tools/embutir-modelos-textos.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'apps/photoshop/scripts/criar-textos-precos.jsx');
const MODELOS = ['texto-um-digito.psd', 'texto-dois-digitos.psd'];
const INICIO = '    // >>> MODELOS EMBUTIDOS';
const FIM = '    // <<< MODELOS EMBUTIDOS';

function literal(bytes) {
  let texto = '';
  for (const b of bytes) {
    texto += b >= 0x20 && b < 0x7f && b !== 0x22 && b !== 0x5c ? String.fromCharCode(b) : '\\x' + b.toString(16).padStart(2, '0');
  }
  const partes = [];
  for (let i = 0; i < texto.length;) {
    let fim = Math.min(texto.length, i + 4000);
    // Nao corta um escape ao meio.
    const barra = texto.lastIndexOf('\\', fim - 1);
    if (fim < texto.length && barra > fim - 4) fim = barra;
    partes.push('"' + texto.slice(i, fim) + '"');
    i = fim;
  }
  return partes.join(',\n');
}

const fonte = await readFile(SCRIPT, 'utf8');
const a = fonte.indexOf(INICIO), b = fonte.indexOf(FIM);
if (a < 0 || b < a) throw new Error('Marcadores dos modelos nao encontrados em ' + SCRIPT);
const blocos = [];
for (const nome of MODELOS) {
  blocos.push(literal(await readFile(path.join(RAIZ, 'apps/photoshop/templates/textos-precos', nome))));
}
const corpo = INICIO + ' (gerado por tools/embutir-modelos-textos.mjs; nao editar a mao)\n' +
  '    function templateBytes(index) {\n' +
  '        return (index ? [\n' + blocos[1] + '\n] : [\n' + blocos[0] + '\n]).join("");\n' +
  '    }\n';
await writeFile(SCRIPT, fonte.slice(0, a) + corpo + fonte.slice(b), 'utf8');
console.log('Modelos embutidos em', path.relative(RAIZ, SCRIPT));
