/**
 * Ponte UXP -> ExtendScript.
 *
 * O Photoshop ainda executa arquivos .jsx a partir de um plugin UXP por
 * meio do evento "AdobeScriptAutomation Scripts" no batchPlay. A tecnica
 * NAO faz parte da API publica documentada da Adobe: funciona nas versoes
 * em que foi testada, mas pode mudar sem aviso.
 *
 * Por isso a ponte sempre informa a falha em vez de silenciar: quando ela
 * nao funciona, o painel cai no modo manual (Arquivo > Scripts > Procurar).
 *
 * STATUS: precisa ser validado na versao de Photoshop que voce usa antes
 * de considerar confiavel. Veja docs/guia-uxp.md.
 */
const { core, action } = require('photoshop');
const storage = require('uxp').storage;
const fs = storage.localFileSystem;

/**
 * Executa um arquivo .jsx que esta dentro da pasta do plugin.
 * @param {string} caminhoRelativo ex: "bundle/apps/photoshop/scripts/x.jsx"
 * @param {string} rotulo nome que aparece no historico do Photoshop
 * @returns {Promise<{ok: boolean, erro?: string}>}
 */
async function executarExtendScript(caminhoRelativo, rotulo) {
  let entrada;
  try {
    const pastaPlugin = await fs.getPluginFolder();
    entrada = await pastaPlugin.getEntry(caminhoRelativo);
  } catch (e) {
    return { ok: false, erro: `Script nao encontrado no pacote: ${caminhoRelativo}. Rode "npm run build:plugin".` };
  }

  try {
    const token = await fs.createSessionToken(entrada);
    await core.executeAsModal(
      async () => {
        await action.batchPlay(
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
      { commandName: rotulo || 'IBD' }
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e && e.message ? e.message : String(e) };
  }
}

/** Caminho no disco, para o usuario abrir manualmente se a ponte falhar. */
async function caminhoNoDisco(caminhoRelativo) {
  try {
    const pastaPlugin = await fs.getPluginFolder();
    const entrada = await pastaPlugin.getEntry(caminhoRelativo);
    return entrada.nativePath;
  } catch (e) {
    return null;
  }
}

module.exports = { executarExtendScript, caminhoNoDisco };
