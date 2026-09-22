/**
 * Leitura dos metadados @ibd-* no cabecalho dos scripts ExtendScript.
 * Esses metadados sao a unica fonte de verdade do catalogo.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export const APPS = {
  photoshop: { nome: 'Photoshop', extensaoScript: 'jsx' },
  illustrator: { nome: 'Illustrator', extensaoScript: 'jsx' },
  indesign: { nome: 'InDesign', extensaoScript: 'jsx' },
  aftereffects: { nome: 'After Effects', extensaoScript: 'jsx' },
  premiere: { nome: 'Premiere Pro', extensaoScript: 'jsx' },
  bridge: { nome: 'Bridge', extensaoScript: 'jsx' }
};

export const CAMPOS_OBRIGATORIOS = ['id', 'titulo', 'descricao', 'app', 'versao'];

/** Extrai o bloco @ibd-* do inicio do arquivo. */
export function lerMetadados(conteudo) {
  const bloco = conteudo.match(/\/\*\*[\s\S]*?\*\//);
  if (!bloco) return null;

  const meta = {};
  const linhas = bloco[0].split('\n');
  for (const linha of linhas) {
    const m = linha.match(/@ibd-([a-z]+)\s+(.+?)\s*$/);
    if (!m) continue;
    const [, chave, valor] = m;
    meta[chave] = chave === 'tags'
      ? valor.split(',').map((t) => t.trim()).filter(Boolean)
      : valor.trim();
  }
  return Object.keys(meta).length ? meta : null;
}

/** Lista recursivamente os arquivos com a extensao pedida. */
export async function listarArquivos(dir, extensao) {
  let entradas;
  try {
    entradas = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const saida = [];
  for (const entrada of entradas) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      saida.push(...(await listarArquivos(completo, extensao)));
    } else if (entrada.name.toLowerCase().endsWith(`.${extensao}`)) {
      saida.push(completo);
    }
  }
  return saida.sort();
}

/** Monta o catalogo completo a partir de apps/. */
export async function montarCatalogo(raiz) {
  const marca = JSON.parse(await readFile(path.join(raiz, 'brand.config.json'), 'utf8'));
  const ferramentas = [];
  const problemas = [];

  for (const [appId, appInfo] of Object.entries(APPS)) {
    const dirScripts = path.join(raiz, 'apps', appId, 'scripts');
    for (const arquivo of await listarArquivos(dirScripts, appInfo.extensaoScript)) {
      const relativo = path.relative(raiz, arquivo).split(path.sep).join('/');
      const meta = lerMetadados(await readFile(arquivo, 'utf8'));

      if (!meta) {
        problemas.push(`${relativo}: sem bloco de metadados @ibd-*.`);
        continue;
      }

      const faltando = CAMPOS_OBRIGATORIOS.filter((c) => !meta[c]);
      if (faltando.length) {
        problemas.push(`${relativo}: faltam os campos ${faltando.join(', ')}.`);
        continue;
      }

      const esperado = `${appId}/${path.basename(arquivo, `.${appInfo.extensaoScript}`)}`;
      if (meta.id !== esperado) {
        problemas.push(`${relativo}: @ibd-id deveria ser "${esperado}", esta "${meta.id}".`);
      }
      if (meta.app !== appId) {
        problemas.push(`${relativo}: @ibd-app deveria ser "${appId}", esta "${meta.app}".`);
      }
      if (!/^\d+\.\d+\.\d+$/.test(meta.versao)) {
        problemas.push(`${relativo}: @ibd-versao "${meta.versao}" nao e semver (x.y.z).`);
      }
      if (meta.descricao.length > 200) {
        problemas.push(`${relativo}: @ibd-descricao passa de 200 caracteres.`);
      }

      const ferramenta = {
        id: meta.id,
        titulo: meta.titulo,
        descricao: meta.descricao,
        app: appId,
        tipo: 'script',
        arquivo: relativo,
        versao: meta.versao,
        tags: meta.tags || []
      };
      // Opcional: pagina de documentacao da ferramenta. A chave so entra no
      // catalogo quando existe, para nao encher o arquivo de nulos.
      if (meta.doc) ferramenta.doc = meta.doc;
      ferramentas.push(ferramenta);
    }

    const dirActions = path.join(raiz, 'apps', appId, 'actions');
    for (const arquivo of await listarArquivos(dirActions, 'atn')) {
      const relativo = path.relative(raiz, arquivo).split(path.sep).join('/');
      const nome = path.basename(arquivo, '.atn');
      ferramentas.push({
        id: `${appId}/actions/${nome}`,
        titulo: nome.replace(/[-_]/g, ' '),
        descricao: 'Conjunto de actions do Photoshop. Instale pelo painel Actions.',
        app: appId,
        tipo: 'action',
        arquivo: relativo,
        versao: '1.0.0',
        tags: ['action']
      });
    }
  }

  const ids = ferramentas.map((f) => f.id);
  const duplicados = ids.filter((id, i) => ids.indexOf(id) !== i);
  for (const id of new Set(duplicados)) problemas.push(`id duplicado no catalogo: ${id}`);

  return {
    catalogo: {
      marca: marca.nome,
      versao: marca.versao,
      geradoPor: 'tools/build-catalog.mjs',
      ferramentas: ferramentas.sort((a, b) => a.id.localeCompare(b.id))
    },
    problemas
  };
}
