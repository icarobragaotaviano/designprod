/**
 * Ponte UXP -> ExtendScript no Adobe InDesign (18.5+).
 * Executa scripts standalone embutidos no pacote via app.doScript().
 */
const { app, ScriptLanguage } = require('indesign');
const fs = require('uxp').storage.localFileSystem;

function caminhoStandalone(caminhoCatalogo) {
  return 'bundle/standalone/' + caminhoCatalogo.replace(/^apps\//, '');
}

async function executarInDesignScript(caminhoCatalogo) {
  const rel = caminhoStandalone(caminhoCatalogo);
  let entrada;
  try {
    const pasta = await fs.getPluginFolder();
    entrada = await pasta.getEntry(rel);
  } catch (e) {
    return { ok: false, erro: 'Script nao encontrado no pacote: ' + rel };
  }

  try {
    const codigo = await entrada.read();
    app.doScript(codigo, ScriptLanguage.JAVASCRIPT);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e && e.message ? e.message : String(e) };
  }
}

async function caminhoNoDisco(caminhoRelativo) {
  try {
    const pasta = await fs.getPluginFolder();
    const entrada = await pasta.getEntry(caminhoRelativo);
    return entrada.nativePath;
  } catch (e) {
    return null;
  }
}

module.exports = { executarInDesignScript, caminhoNoDisco, caminhoStandalone };
