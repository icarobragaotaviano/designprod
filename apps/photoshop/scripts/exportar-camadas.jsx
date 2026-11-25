/**
 * @ibd-id photoshop/exportar-camadas
 * @ibd-titulo Exportar camadas em lote
 * @ibd-descricao Salva cada camada ou grupo visível do nível superior como PNG, JPG ou PSD separado, com opção de aparar áreas transparentes.
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
      grupo: 'Destino e nomenclatura',
      padrao: salvas.pasta || Folder.desktop.fsName
    },
    {
      id: 'prefixo',
      rotulo: 'Prefixo do arquivo',
      tipo: 'texto',
      grupo: 'Destino e nomenclatura',
      padrao: salvas.prefixo || ''
    },
    {
      id: 'formato',
      rotulo: 'Formato',
      tipo: 'escolha',
      grupo: 'Formato e compressao',
      opcoes: ['PNG-24', 'JPG', 'PSD'],
      presets: ['PNG-24', 'JPG', 'PSD'],
      padrao: salvas.formato || 'PNG-24'
    },
    {
      id: 'qualidade',
      rotulo: 'Qualidade JPG',
      tipo: 'numero',
      grupo: 'Formato e compressao',
      padrao: salvas.qualidade === undefined ? 80 : salvas.qualidade,
      presets: [60, 80, 90, 100],
      ajuda: '0 a 100. Ignorado quando o formato for PNG ou PSD.'
    },
    {
      id: 'aparar',
      rotulo: 'Aparar area transparente',
      tipo: 'booleano',
      grupo: 'Opcoes de corte',
      padrao: salvas.aparar === undefined ? true : salvas.aparar
    },
    {
      id: 'somenteVisiveis',
      rotulo: 'Somente camadas visiveis',
      tipo: 'booleano',
      grupo: 'Opcoes de corte',
      padrao: salvas.somenteVisiveis === undefined ? true : salvas.somenteVisiveis
    }
  ], 'Exportar', {
    subtitulo: 'Salva cada camada em PNG-24 transparente, JPG otimizado ou PSD'
  });

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
        if (j !== indice) {
          var lyr = copia.layers[j];
          try { if (lyr.isBackgroundLayer) lyr.isBackgroundLayer = false; } catch (eBg) {}
          try { lyr.allLocked = false; } catch (eLk) {}
          lyr.remove();
        }
      }

      var camada = copia.layers[0];
      try { if (camada.allLocked) camada.allLocked = false; } catch (eLk2) {}
      camada.visible = true;

      if (cfg.aparar) {
        try {
          copia.trim(TrimType.TRANSPARENT);
        } catch (e) {
          // Documento sem transparencia (ex: camada de fundo): segue sem aparar.
        }
      }

      var base = IBD.slug((cfg.prefixo ? cfg.prefixo + '-' : '') + camada.name) ||
        'camada-' + IBD.pad(indice + 1, 3);

      if (cfg.formato === 'PSD') {
        var psdArq = IBD.fs.caminhoLivre(pasta, base, 'psd');
        var psdOpt = new PhotoshopSaveOptions();
        psdOpt.layers = true;
        psdOpt.embedColorProfile = true;
        copia.saveAs(psdArq, psdOpt, true, Extension.LOWERCASE);
        return;
      }

      // SaveForWeb falha em 16/32 bits ou CMYK no PS 2024+: normaliza na copia temporaria.
      try {
        if (copia.bitsPerChannel !== BitsPerChannelType.EIGHT) {
          copia.bitsPerChannel = BitsPerChannelType.EIGHT;
        }
      } catch (eBits) {}
      try {
        if (copia.mode !== DocumentMode.RGB) {
          copia.changeMode(ChangeMode.RGB);
        }
      } catch (eMode) {}

      var ehPNG = cfg.formato === 'PNG-24';
      var arquivo = IBD.fs.caminhoLivre(pasta, base, ehPNG ? 'png' : 'jpg');

      try {
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
      } catch (eSfw) {
        // Fallback para arquivos > 8192 px ou versoes onde SaveForWeb recusa exportar.
        if (ehPNG) {
          var pngOpt = new PNGSaveOptions();
          pngOpt.compression = 6;
          pngOpt.interlaced = false;
          copia.saveAs(arquivo, pngOpt, true, Extension.LOWERCASE);
        } else {
          var jpgOpt = new JPEGSaveOptions();
          jpgOpt.quality = Math.max(1, Math.min(12, Math.round((cfg.qualidade || 80) * 12 / 100)));
          jpgOpt.embedColorProfile = true;
          copia.saveAs(arquivo, jpgOpt, true, Extension.LOWERCASE);
        }
      }
    } finally {
      try { copia.close(SaveOptions.DONOTSAVECHANGES); } catch (eClose) {}
      try { app.activeDocument = original; } catch (eAct) {}
    }
  }
})();
