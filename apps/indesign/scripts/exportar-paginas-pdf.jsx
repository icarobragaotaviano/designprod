/**
 * @ibd-id indesign/exportar-paginas-pdf
 * @ibd-titulo Exportar paginas em PDFs separados
 * @ibd-descricao Gera um PDF por pagina do documento usando um preset de exportacao existente.
 * @ibd-app indesign
 * @ibd-versao 1.0.0
 * @ibd-tags export, pdf, paginas
 */
#target indesign

#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-prefs.jsx"

(function () {
  var ID = 'indesign/exportar-paginas-pdf';
  IBD.exigirHost(['indesign']);

  if (!app.documents.length) {
    IBD.alerta('Abra um documento antes de rodar este script.');
    return;
  }

  var doc = app.activeDocument;
  var salvas = IBD.prefs.ler(ID);
  var presets = app.pdfExportPresets.everyItem().name;

  if (!presets.length) {
    IBD.alerta('Nenhum preset de exportacao PDF encontrado neste InDesign.');
    return;
  }

  var opcoes = IBD.ui.formulario('Exportar paginas em PDF', [
    { id: 'pasta', rotulo: 'Pasta de saida', tipo: 'pasta', padrao: salvas.pasta || Folder.desktop.fsName },
    { id: 'preset', rotulo: 'Preset PDF', tipo: 'escolha', opcoes: presets, padrao: salvas.preset || presets[0] },
    {
      id: 'prefixo',
      rotulo: 'Prefixo do arquivo',
      tipo: 'texto',
      padrao: salvas.prefixo || IBD.slug(IBD.fs.semExtensao(doc.name)),
      ajuda: 'O nome final fica prefixo-01.pdf, prefixo-02.pdf, e assim por diante.'
    }
  ]);

  if (!opcoes) return;
  if (!opcoes.pasta) {
    IBD.alerta('Escolha uma pasta de saida.');
    return;
  }

  IBD.prefs.gravar(ID, opcoes);

  var destino = IBD.fs.garantirPasta(opcoes.pasta);
  var preset = app.pdfExportPresets.itemByName(opcoes.preset);
  var intervaloOriginal = app.pdfExportPreferences.pageRange;
  var total = doc.pages.length;

  var barra = IBD.ui.progresso(total, 'Exportando paginas');
  var exportadas = 0;
  var falhas = [];

  try {
    for (var i = 0; i < total; i++) {
      if (barra.cancelado()) break;
      var pagina = doc.pages[i];
      barra.atualizar(i, 'Pagina ' + (i + 1) + ' de ' + total);
      try {
        app.pdfExportPreferences.pageRange = pagina.name;
        var base = (opcoes.prefixo ? IBD.slug(opcoes.prefixo) + '-' : 'pagina-') + IBD.pad(i + 1, 2);
        doc.exportFile(ExportFormat.PDF_TYPE, IBD.fs.caminhoLivre(destino, base, 'pdf'), false, preset);
        exportadas++;
      } catch (e) {
        falhas.push('Pagina ' + pagina.name + ' — ' + (e.message || e));
      }
    }
  } finally {
    barra.fechar();
    app.pdfExportPreferences.pageRange = intervaloOriginal;
  }

  var relatorio = ['Exportadas: ' + exportadas + ' de ' + total, 'Pasta: ' + destino.fsName];
  if (falhas.length) relatorio.push('', 'Falhas:', falhas.join('\n'));
  IBD.ui.resumo('Exportar paginas em PDF', relatorio);
})();
