/**
 * Ponte UXP -> ExtendScript para Photoshop (24.0 - 27.x+).
 *
 * Usa os arquivos standalone gerados em bundle/standalone/ (com #include ja resolvido)
 * com fallback para o caminho original em bundle/, e habilita interactive: true no
 * executeAsModal para que dialogos ScriptUI abram normalmente no Photoshop 2024+.
 */
const { core, action } = require('photoshop');
const storage = require('uxp').storage;
const fs = storage.localFileSystem;

function caminhoStandalone(caminhoRelativo) {
  if (caminhoRelativo.indexOf('bundle/apps/') === 0) {
    return 'bundle/standalone/' + caminhoRelativo.slice('bundle/apps/'.length);
  }
  return caminhoRelativo;
}

/**
 * Executa um arquivo .jsx que esta dentro da pasta do plugin.
 * @param {string} caminhoRelativo ex: "bundle/apps/photoshop/scripts/x.jsx"
 * @param {string} rotulo nome que aparece no historico do Photoshop
 * @returns {Promise<{ok: boolean, erro?: string}>}
 */
async function executarExtendScript(caminhoRelativo, rotulo) {
  let entrada = null;
  const pastaPlugin = await fs.getPluginFolder();
  const candidatos = [caminhoStandalone(caminhoRelativo), caminhoRelativo];

  for (const cand of candidatos) {
    try {
      entrada = await pastaPlugin.getEntry(cand);
      if (entrada) break;
    } catch (e) { /* tenta o proximo */ }
  }

  if (!entrada) {
    return { ok: false, erro: `Script nao encontrado no pacote: ${caminhoRelativo}. Rode "npm run build:plugin".` };
  }

  try {
    const token = await fs.createSessionToken(entrada);
    let resultadoPlay = null;
    await core.executeAsModal(
      async () => {
        resultadoPlay = await action.batchPlay(
          [
            {
              _obj: 'AdobeScriptAutomation Scripts',
              javaScript: { _path: token, _kind: 'local' },
              javaScriptMessage: 'BatchPlay',
              _options: { dialogOptions: 'display' }
            }
          ],
          { synchronousExecution: false }
        );
      },
      { commandName: rotulo || 'IBD', interactive: true }
    );

    if (Array.isArray(resultadoPlay) && resultadoPlay.length > 0) {
      const primeiro = resultadoPlay[0];
      if (primeiro && (primeiro._obj === 'error' || primeiro.message)) {
        return { ok: false, erro: String(primeiro.message || 'Erro retornado pelo Photoshop ao rodar o script.') };
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e && e.message ? e.message : String(e) };
  }
}

/** Caminho no disco, para o usuario abrir manualmente se a ponte falhar. */
async function caminhoNoDisco(caminhoRelativo) {
  try {
    const pastaPlugin = await fs.getPluginFolder();
    const candidatos = [caminhoStandalone(caminhoRelativo), caminhoRelativo];
    for (const cand of candidatos) {
      try {
        const entrada = await pastaPlugin.getEntry(cand);
        if (entrada) return entrada.nativePath;
      } catch (e) {}
    }
    return null;
  } catch (e) {
    return null;
  }
}

module.exports = { executarExtendScript, caminhoNoDisco };
