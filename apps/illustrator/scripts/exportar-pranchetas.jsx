/**
 * @ibd-id illustrator/exportar-pranchetas
 * @ibd-titulo Exportar pranchetas em lote
 * @ibd-descricao Exporta cada prancheta selecionada ou todas em arquivos PNG, JPG ou PDF individuais usando o nome da prancheta e salvando as preferências.
 * @ibd-app illustrator
 * @ibd-versao 1.0.0
 * @ibd-tags export, pranchetas, lote
 */
#target illustrator

#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-prefs.jsx"

(function () {
  var ID = 'illustrator/exportar-pranchetas';
  IBD.exigirHost(['illustrator']);

  if (!app.documents.length) {
    IBD.alerta('Abra um documento antes de rodar este script.');
    return;
  }

  var doc = app.activeDocument;
  var salvas = IBD.prefs.ler(ID);

  var opcoes = IBD.ui.formulario('Exportar pranchetas em lote', [
    { id: 'pasta', rotulo: 'Pasta de saida', grupo: 'Destino', tipo: 'pasta', padrao: salvas.pasta || Folder.desktop.fsName },
    { id: 'prefixo', rotulo: 'Prefixo do arquivo', grupo: 'Destino', tipo: 'texto', padrao: salvas.prefixo || '' },
    { id: 'formato', rotulo: 'Formato', grupo: 'Formato e resolução', tipo: 'escolha', opcoes: ['PNG-24', 'JPG', 'PDF'], presets: ['PNG-24', 'JPG', 'PDF'], padrao: salvas.formato || 'PNG-24' },
    {
      id: 'escala',
      rotulo: 'Escala (%)',
      grupo: 'Formato e resolução',
      tipo: 'numero',
      presets: [100, 150, 200, 300],
      padrao: salvas.escala || 100,
      ajuda: '100 = tamanho do documento. 200 = dobro da resolucao. Ignorado em PDF.'
    },
    { id: 'transparencia', rotulo: 'Fundo transparente (PNG)', grupo: 'Formato e resolução', tipo: 'booleano', padrao: salvas.transparencia === undefined ? true : salvas.transparencia }
  ], 'Exportar', {
    subtitulo: doc.artboards.length + ' prancheta(s) neste documento',
    largura: 460
  });

  if (!opcoes) return;
  if (!opcoes.pasta) {
    IBD.alerta('Escolha uma pasta de saida.');
    return;
  }

  IBD.prefs.gravar(ID, opcoes);

  var destino = IBD.fs.garantirPasta(opcoes.pasta);
  var total = doc.artboards.length;
  var indiceOriginal = doc.artboards.getActiveArtboardIndex();

  var barra = IBD.ui.progresso(total, 'Exportando pranchetas');
  var exportadas = 0;
  var falhas = [];

  try {
    for (var i = 0; i < total; i++) {
      if (barra.cancelado()) break;
      var prancheta = doc.artboards[i];
      barra.atualizar(i, 'Prancheta ' + (i + 1) + ' de ' + total + ': ' + prancheta.name);
      try {
        doc.artboards.setActiveArtboardIndex(i);
        exportarPrancheta(doc, i, prancheta, destino, opcoes);
        exportadas++;
      } catch (e) {
        falhas.push(prancheta.name + ' — ' + (e.message || e));
      }
    }
  } finally {
    barra.fechar();
    doc.artboards.setActiveArtboardIndex(indiceOriginal);
  }

  var relatorio = ['Exportadas: ' + exportadas + ' de ' + total, 'Pasta: ' + destino.fsName];
  if (falhas.length) relatorio.push('', 'Falhas:', falhas.join('\n'));
  IBD.ui.resumo('Exportar pranchetas', relatorio);

  function exportarPrancheta(documento, indice, prancheta, pasta, cfg) {
    var base = IBD.slug((cfg.prefixo ? cfg.prefixo + '-' : '') + prancheta.name) ||
      'prancheta-' + IBD.pad(indice + 1, 2);

    if (cfg.formato === 'PDF') {
      var pdfOpcoes = new PDFSaveOptions();
      pdfOpcoes.artboardRange = String(indice + 1);
      pdfOpcoes.preserveEditability = false;
      pdfOpcoes.viewAfterSaving = false;
      documento.saveAs(IBD.fs.caminhoLivre(pasta, base, 'pdf'), pdfOpcoes);
      return;
    }

    var escala = Math.max(1, cfg.escala);

    if (cfg.formato === 'JPG') {
      var jpgOpcoes = new ExportOptionsJPEG();
      jpgOpcoes.artBoardClipping = true;
      jpgOpcoes.qualitySetting = 80;
      jpgOpcoes.horizontalScale = escala;
      jpgOpcoes.verticalScale = escala;
      jpgOpcoes.antiAliasing = true;
      documento.exportFile(IBD.fs.caminhoLivre(pasta, base, 'jpg'), ExportType.JPEG, jpgOpcoes);
      return;
    }

    var pngOpcoes = new ExportOptionsPNG24();
    pngOpcoes.artBoardClipping = true;
    pngOpcoes.transparency = !!cfg.transparencia;
    pngOpcoes.horizontalScale = escala;
    pngOpcoes.verticalScale = escala;
    pngOpcoes.antiAliasing = true;
    documento.exportFile(IBD.fs.caminhoLivre(pasta, base, 'png'), ExportType.PNG24, pngOpcoes);
  }
})();
