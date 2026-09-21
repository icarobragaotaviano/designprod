#!/usr/bin/env node
/**
 * Cria um script novo ja com cabecalho de metadados e includes corretos.
 *
 * Uso:
 *   npm run new -- photoshop exportar-mockups "Exportar mockups" "O que ele faz."
 */
import { writeFile, access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPS } from './lib/meta.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [app, nome, titulo, descricao] = process.argv.slice(2);

if (!app || !nome || !titulo) {
  console.error('Uso: npm run new -- <app> <nome-do-arquivo> "<Titulo>" "<Descricao>"');
  console.error('Apps: ' + Object.keys(APPS).join(', '));
  process.exit(1);
}

if (!APPS[app]) {
  console.error(`App desconhecido: ${app}. Use um de: ${Object.keys(APPS).join(', ')}`);
  process.exit(1);
}

const arquivoNome = `${nome.replace(/\.jsx$/, '')}.jsx`;
const destino = path.join(RAIZ, 'apps', app, 'scripts', arquivoNome);

if (await access(destino).then(() => true, () => false)) {
  console.error(`Ja existe: ${path.relative(RAIZ, destino)}`);
  process.exit(1);
}

const alvoTarget = app === 'aftereffects' ? '' : `#target ${app === 'premiere' ? 'premierepro' : app}\n`;

const modelo = `/**
 * @ibd-id ${app}/${path.basename(arquivoNome, '.jsx')}
 * @ibd-titulo ${titulo}
 * @ibd-descricao ${descricao || 'Descreva em uma frase o que o script entrega.'}
 * @ibd-app ${app}
 * @ibd-versao 0.1.0
 * @ibd-tags
 */
${alvoTarget}
#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-prefs.jsx"

(function () {
  var ID = '${app}/${path.basename(arquivoNome, '.jsx')}';
  IBD.exigirHost(['${app}']);

  var salvas = IBD.prefs.ler(ID);

  var opcoes = IBD.ui.formulario('${titulo}', [
    { id: 'pasta', rotulo: 'Pasta de saida', tipo: 'pasta', padrao: salvas.pasta || Folder.desktop.fsName }
  ]);

  if (!opcoes) return;
  IBD.prefs.gravar(ID, opcoes);

  var resultado = IBD.executar('${titulo}', function () {
    // TODO: implementar.
    return 0;
  });

  if (resultado.ok) {
    IBD.ui.resumo('${titulo}', ['Concluido.']);
  }
})();
`;

await mkdir(path.dirname(destino), { recursive: true });
await writeFile(destino, modelo, 'utf8');

console.log(`Criado: ${path.relative(RAIZ, destino)}`);
console.log('Proximo passo: implementar e rodar "npm run catalog".');
