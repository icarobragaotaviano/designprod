/**
 * @ibd-id photoshop/exportar-camadas
 * @ibd-titulo Exportar camadas
 * @ibd-descricao Exporta cada camada ou grupo do topo do documento como arquivo separado, com opcao de aparar area transparente.
 * @ibd-app photoshop
 * @ibd-versao 1.0.0
 * @ibd-tags export, camadas, lote
 */
#target photoshop

#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-prefs.jsx"

(function () {
  var ID = 'photoshop/exportar-camadas';
  IBD.exigirHost(['photoshop']);

  if (!app.documents.length) {
    IBD.alerta('Abra um documento antes de rodar este script.');
    return;
  }

  var doc = app.activeDocument;
  var salvas = IBD.prefs.ler(ID);

  var opcoes = IBD.ui.formulario('Exportar camadas', [
    {
      id: 'pasta',
      rotulo: 'Pasta de saida',
      tipo: 'pasta',
      padrao: salvas.pasta || Folder.desktop.fsName
    },
    {
      id: 'formato',
      rotulo: 'Formato',
      tipo: 'escolha',
      opcoes: ['PNG-24', 'JPG'],
      padrao: salvas.formato || 'PNG-24'
    },
    {
      id: 'qualidade',
      rotulo: 'Qualidade JPG',
      tipo: 'numero',
      padrao: salvas.qualidade === undefined ? 80 : salvas.qualidade,
      ajuda: '0 a 100. Ignorado quando o formato for PNG.'
    },
    {
      id: 'aparar',
      rotulo: 'Aparar area transparente',
      tipo: 'booleano',
      padrao: salvas.aparar === undefined ? true : salvas.aparar
    },
    {
      id: 'somenteVisiveis',
      rotulo: 'Somente camadas visiveis',
      tipo: 'booleano',
      padrao: salvas.somenteVisiveis === undefined ? true : salvas.somenteVisiveis
    },
    {
      id: 'prefixo',
      rotulo: 'Prefixo do arquivo',
      tipo: 'texto',
      padrao: salvas.prefixo || ''
    }
  ]);

  if (!opcoes) return;
  if (!opcoes.pasta) {
    IBD.alerta('Escolha uma pasta de saida.');
    return;
  }

  IBD.prefs.gravar(ID, opcoes);

  var unidadeOriginal = app.preferences.rulerUnits;
  app.preferences.rulerUnits = Units.PIXELS;

  var destino = IBD.fs.garantirPasta(opcoes.pasta);
  var alvos = [];
  var i;

  for (i = 0; i < doc.layers.length; i++) {
    if (opcoes.somenteVisiveis && !doc.layers[i].visible) continue;
    alvos.push(i);
  }

  if (!alvos.length) {
    app.preferences.rulerUnits = unidadeOriginal;
    IBD.alerta('Nenhuma camada elegivel encontrada.');
    return;
  }

  var barra = IBD.ui.progresso(alvos.length, 'Exportando camadas');
  var exportadas = 0;
  var falhas = [];

  try {
    for (i = 0; i < alvos.length; i++) {
      if (barra.cancelado()) break;
      var nomeCamada = doc.layers[alvos[i]].name;
      barra.atualizar(i, 'Camada ' + (i + 1) + ' de ' + alvos.length + ': ' + nomeCamada);
      try {
        exportarCamada(doc, alvos[i], destino, opcoes);
        exportadas++;
      } catch (e) {
        falhas.push(nomeCamada + ' — ' + (e.message || e));
      }
    }
  } finally {
    barra.fechar();
    app.preferences.rulerUnits = unidadeOriginal;
    app.activeDocument = doc;
  }

  var relatorio = ['Exportadas: ' + exportadas + ' de ' + alvos.length, 'Pasta: ' + destino.fsName];
  if (falhas.length) relatorio.push('', 'Falhas:', falhas.join('\n'));
  IBD.ui.resumo('Exportar camadas', relatorio);

  /**
   * Duplica o documento, remove tudo menos a camada alvo e exporta.
   */
  function exportarCamada(original, indice, pasta, cfg) {
    var copia = original.duplicate(IBD.fs.semExtensao(original.name) + '-tmp', false);
    try {
      app.activeDocument = copia;

      for (var j = copia.layers.length - 1; j >= 0; j--) {
        if (j !== indice) copia.layers[j].remove();
      }

      var camada = copia.layers[0];
      camada.visible = true;

      if (cfg.aparar) {
        try {
          copia.trim(TrimType.TRANSPARENT);
        } catch (e) {
          // Documento sem transparencia (ex: camada de fundo): segue sem aparar.
        }
      }

      var ehPNG = cfg.formato === 'PNG-24';
      var base = IBD.slug((cfg.prefixo ? cfg.prefixo + '-' : '') + camada.name) ||
        'camada-' + IBD.pad(indice + 1, 3);
      var arquivo = IBD.fs.caminhoLivre(pasta, base, ehPNG ? 'png' : 'jpg');

      var saida = new ExportOptionsSaveForWeb();
      if (ehPNG) {
        saida.format = SaveDocumentType.PNG;
        saida.PNG8 = false;
        saida.transparency = true;
        saida.interlaced = false;
      } else {
        saida.format = SaveDocumentType.JPEG;
        saida.quality = Math.max(0, Math.min(100, cfg.qualidade));
        saida.optimized = true;
      }
      copia.exportDocument(arquivo, ExportType.SAVEFORWEB, saida);
    } finally {
      copia.close(SaveOptions.DONOTSAVECHANGES);
    }
  }
})();
