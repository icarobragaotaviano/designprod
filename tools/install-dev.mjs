#!/usr/bin/env node
/**
 * Instala os scripts nos menus dos apps Adobe sem copiar codigo.
 *
 * Em vez de copiar o .jsx (o que quebraria os #include relativos e criaria
 * uma segunda copia para manter), grava um lancador de uma linha na pasta
 * de scripts do app apontando para o arquivo do repositorio. Editar o
 * script aqui passa a valer no app na proxima execucao.
 *
 * Uso:
 *   npm run install:dev            instala
 *   npm run install:dev -- --list  so mostra as pastas detectadas
 *   npm run uninstall:dev          remove os lancadores gerados
 */
import { readdir, readFile, writeFile, unlink, access } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { montarCatalogo } from './lib/meta.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const marca = JSON.parse(await readFile(path.join(RAIZ, 'brand.config.json'), 'utf8'));
const MARCADOR = `// gerado-por: ${marca.nome} tools/install-dev.mjs`;

const apenasListar = process.argv.includes('--list');
const remover = process.argv.includes('--remove');

const existe = (p) => access(p).then(() => true, () => false);

/** Expande um caminho com "*" percorrendo os diretorios de verdade. */
async function expandir(padrao) {
  const partes = padrao.split(path.sep).filter((p, i) => p !== '' || i === 0);
  let candidatos = [padrao.startsWith(path.sep) ? path.sep : partes.shift()];

  for (const parte of partes) {
    if (!parte) continue;
    const proximos = [];
    for (const base of candidatos) {
      if (!parte.includes('*')) {
        const completo = path.join(base, parte);
        if (await existe(completo)) proximos.push(completo);
        continue;
      }
      const regex = new RegExp('^' + parte.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
      let entradas = [];
      try {
        entradas = await readdir(base, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entrada of entradas) {
        if (entrada.isDirectory() && regex.test(entrada.name)) {
          proximos.push(path.join(base, entrada.name));
        }
      }
    }
    candidatos = proximos;
  }
  return candidatos;
}

function padroesPorApp() {
  const casa = os.homedir();

  if (process.platform === 'darwin') {
    return {
      photoshop: ['/Applications/Adobe Photoshop */Presets/Scripts'],
      illustrator: ['/Applications/Adobe Illustrator */Presets/*/Scripts'],
      indesign: [path.join(casa, 'Library/Preferences/Adobe InDesign/Version */*/Scripts/Scripts Panel')],
      aftereffects: ['/Applications/Adobe After Effects */Scripts/ScriptUI Panels'],
      bridge: []
    };
  }

  if (process.platform === 'win32') {
    const programas = process.env['ProgramFiles'] || 'C:\\Program Files';
    const appdata = process.env['APPDATA'] || path.join(casa, 'AppData', 'Roaming');
    return {
      photoshop: [path.join(programas, 'Adobe', 'Adobe Photoshop *', 'Presets', 'Scripts')],
      illustrator: [path.join(programas, 'Adobe', 'Adobe Illustrator *', 'Presets', '*', 'Scripts')],
      indesign: [path.join(appdata, 'Adobe', 'InDesign', 'Version *', '*', 'Scripts', 'Scripts Panel')],
      aftereffects: [path.join(programas, 'Adobe', 'Adobe After Effects *', 'Support Files', 'Scripts', 'ScriptUI Panels')],
      bridge: []
    };
  }

  return { photoshop: [], illustrator: [], indesign: [], aftereffects: [], bridge: [] };
}

function padroesActionsPorApp() {
  if (process.platform === 'darwin') {
    return {
      photoshop: ['/Applications/Adobe Photoshop */Presets/Actions']
    };
  }
  if (process.platform === 'win32') {
    const programas = process.env['ProgramFiles'] || 'C:\\Program Files';
    return {
      photoshop: [path.join(programas, 'Adobe', 'Adobe Photoshop *', 'Presets', 'Actions')]
    };
  }
  return { photoshop: [] };
}

const padroes = padroesPorApp();
const padroesActions = padroesActionsPorApp();
const { catalogo } = await montarCatalogo(RAIZ);
const scripts = catalogo.ferramentas.filter((f) => f.tipo === 'script');
const actions = catalogo.ferramentas.filter((f) => f.tipo === 'action');

let instalados = 0;
let removidos = 0;
const semPasta = [];

for (const [appId, lista] of Object.entries(padroes)) {
  const doApp = scripts.filter((f) => f.app === appId);
  if (!doApp.length) continue;

  const pastas = [];
  for (const padrao of lista) pastas.push(...(await expandir(padrao)));

  if (!pastas.length) {
    semPasta.push(appId + ' (scripts)');
    continue;
  }

  for (const pasta of pastas) {
    console.log(`${appId} (scripts): ${pasta}`);
    if (apenasListar) continue;

    for (const ferramenta of doApp) {
      const origem = path.join(RAIZ, ferramenta.arquivo);
      const destino = path.join(pasta, `${marca.nome} ${ferramenta.titulo}.jsx`);

      if (remover) {
        if (!(await existe(destino))) continue;
        const conteudo = await readFile(destino, 'utf8').catch(() => '');
        if (!conteudo.includes(MARCADOR)) {
          console.warn(`  pulado (nao foi gerado por este script): ${path.basename(destino)}`);
          continue;
        }
        await unlink(destino);
        removidos++;
        continue;
      }

      const lancador = [
        MARCADOR,
        `// ferramenta: ${ferramenta.id} v${ferramenta.versao}`,
        '// Editar o arquivo original no repositorio; este e so um atalho.',
        `#include "${origem.split(path.sep).join('/')}"`,
        ''
      ].join('\n');

      try {
        await writeFile(destino, lancador, 'utf8');
        instalados++;
      } catch (e) {
        console.error(`  falhou em ${path.basename(destino)}: ${e.code === 'EACCES' || e.code === 'EPERM'
          ? 'sem permissao de escrita. Rode com privilegio de administrador ou copie manualmente.'
          : e.message}`);
      }
    }
  }
}

/* Actions do Photoshop ------------------------------------------------ */

for (const [appId, lista] of Object.entries(padroesActions)) {
  const doApp = actions.filter((f) => f.app === appId);
  if (!doApp.length) continue;

  const pastas = [];
  for (const padrao of lista) pastas.push(...(await expandir(padrao)));

  if (!pastas.length) {
    semPasta.push(appId + ' (actions)');
    continue;
  }

  for (const pasta of pastas) {
    console.log(`${appId} (actions): ${pasta}`);
    if (apenasListar) continue;

    for (const ferramenta of doApp) {
      const origem = path.join(RAIZ, ferramenta.arquivo);
      const destino = path.join(pasta, `${marca.nome} ${path.basename(ferramenta.arquivo)}`);

      if (remover) {
        if (await existe(destino)) {
          await unlink(destino);
          removidos++;
        }
        continue;
      }

      try {
        const dados = await readFile(origem);
        await writeFile(destino, dados);
        instalados++;
      } catch (e) {
        console.error(`  falhou ao copiar action ${path.basename(destino)}: ${e.code === 'EACCES' || e.code === 'EPERM'
          ? 'sem permissao de escrita. Copie manualmente ou rode com administrador.'
          : e.message}`);
      }
    }
  }
}

if (semPasta.length) {
  console.warn(`\nPasta nao encontrada para: ${semPasta.join(', ')}.`);
  console.warn('O app pode nao estar instalado, ou usar caminho diferente. Veja docs/instalacao.md.');
}

if (apenasListar) {
  console.log('\nModo --list: nada foi escrito.');
} else if (remover) {
  console.log(`\nRemovidos ${removidos} item(ns).`);
} else {
  console.log(`\nInstalados ${instalados} item(ns). Reinicie os apps abertos.`);
}
