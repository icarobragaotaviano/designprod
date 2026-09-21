/**
 * ibd-prefs.jsx — preferencias por script, gravadas em JSON na pasta
 * de dados do usuario. Serve para o script lembrar a ultima pasta de
 * saida, o ultimo formato escolhido, etc.
 *
 * Requer ibd-core.jsx e ibd-fs.jsx.
 */
#include "ibd-fs.jsx"

(function (IBD) {
  var prefs = {};

  function arquivoDe(idScript) {
    return new File(IBD.fs.pastaDados().fsName + '/prefs-' + IBD.slug(idScript) + '.json');
  }

  /** Le as preferencias do script; devolve {} quando nao houver. */
  prefs.ler = function (idScript) {
    try {
      return IBD.fs.lerJSON(arquivoDe(idScript)) || {};
    } catch (e) {
      IBD.log('Preferencias ilegiveis de ' + idScript + ': ' + e.message);
      return {};
    }
  };

  /** Grava (merge raso) e devolve o estado final. */
  prefs.gravar = function (idScript, valores) {
    var atual = prefs.ler(idScript);
    var chaves = Object.keys(valores);
    for (var i = 0; i < chaves.length; i++) {
      var v = valores[chaves[i]];
      if (v instanceof Folder || v instanceof File) v = v.fsName;
      atual[chaves[i]] = v;
    }
    try {
      IBD.fs.escreverJSON(arquivoDe(idScript), atual);
    } catch (e) {
      IBD.log('Nao foi possivel gravar preferencias: ' + e.message);
    }
    return atual;
  };

  IBD.prefs = prefs;
})($.global.IBD);
