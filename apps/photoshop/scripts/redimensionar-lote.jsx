/**
 * @ibd-id photoshop/redimensionar-lote
 * @ibd-titulo Redimensionar imagens em lote
 * @ibd-descricao Abre os arquivos de uma pasta, reduz proporcionalmente até o lado máximo em px e salva em JPG ou PNG na pasta de saída sem tocar nos originais.
 * @ibd-app photoshop
 * @ibd-versao 1.0.0
 * @ibd-tags lote, redimensionar, export
 */
#target photoshop

#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-prefs.jsx"

(function () {
  var ID = 'photoshop/redimensionar-lote';
  IBD.exigirHost(['photoshop']);

  var EXTENSOES = ['psd', 'psb', 'tif', 'tiff', 'jpg', 'jpeg', 'png', 'webp'];
  var salvas = IBD.prefs.ler(ID);

  var opcoes = IBD.ui.formulario('Redimensionar imagens em lote', [
    { id: 'entrada', rotulo: 'Pasta de origem', grupo: 'Pastas', tipo: 'pasta', padrao: salvas.entrada || '' },
    { id: 'saida', rotulo: 'Pasta de saida', grupo: 'Pastas', tipo: 'pasta', padrao: salvas.saida || '' },
    { id: 'recursivo', rotulo: 'Incluir subpastas', grupo: 'Pastas', tipo: 'booleano', padrao: !!salvas.recursivo },
    {
      id: 'ladoMaximo',
      rotulo: 'Lado maior (px)',
      grupo: 'Tamanho e formato',
      tipo: 'numero',
      presets: [800, 1200, 2000, 3000],
      padrao: salvas.ladoMaximo || 2000,
      ajuda: 'A imagem so e reduzida. Arquivos menores que isso sao copiados no tamanho original.'
    },
    { id: 'formato', rotulo: 'Formato', grupo: 'Tamanho e formato', tipo: 'escolha', opcoes: ['JPG', 'PNG-24'], presets: ['JPG', 'PNG-24'], padrao: salvas.formato || 'JPG' },
    { id: 'qualidade', rotulo: 'Qualidade JPG', grupo: 'Tamanho e formato', tipo: 'numero', presets: [75, 85, 95], padrao: salvas.qualidade === undefined ? 85 : salvas.qualidade }
  ], 'Processar lote', {
    subtitulo: 'Reduz proporcionalmente sem alterar os arquivos originais',
    largura: 470
  });

  if (!opcoes) return;
  if (!opcoes.entrada || !opcoes.saida) {
    IBD.alerta('Escolha a pasta de origem e a pasta de saida.');
    return;
  }
  if (String(opcoes.entrada) === String(opcoes.saida)) {
    IBD.alerta('A pasta de saida precisa ser diferente da origem, para nao sobrescrever os originais.');
    return;
  }

  IBD.prefs.gravar(ID, opcoes);

  var arquivos = IBD.fs.listar(opcoes.entrada, EXTENSOES, opcoes.recursivo);
  if (!arquivos.length) {
    IBD.alerta('Nenhuma imagem compativel encontrada em:\n' + opcoes.entrada.fsName);
    return;
  }

  var destino = IBD.fs.garantirPasta(opcoes.saida);
  var unidadeOriginal = app.preferences.rulerUnits;
  var dialogosOriginal = app.displayDialogs;
  app.preferences.rulerUnits = Units.PIXELS;
  app.displayDialogs = DialogModes.NO;

  var barra = IBD.ui.progresso(arquivos.length, 'Redimensionando');
  var processados = 0;
  var falhas = [];

  try {
    for (var i = 0; i < arquivos.length; i++) {
      if (barra.cancelado()) break;
      barra.atualizar(i, (i + 1) + ' de ' + arquivos.length + ': ' + decodeURI(arquivos[i].name));
      try {
        processar(arquivos[i], destino, opcoes);
        processados++;
      } catch (e) {
        falhas.push(decodeURI(arquivos[i].name) + ' — ' + (e.message || e));
      }
    }
  } finally {
    barra.fechar();
    app.preferences.rulerUnits = unidadeOriginal;
    app.displayDialogs = dialogosOriginal;
  }

  var relatorio = ['Processados: ' + processados + ' de ' + arquivos.length, 'Pasta: ' + destino.fsName];
  if (falhas.length) relatorio.push('', 'Falhas:', falhas.join('\n'));
  IBD.ui.resumo('Redimensionar em lote', relatorio);

  function processar(arquivo, pasta, cfg) {
    var doc = app.open(arquivo);
    try {
      var largura = doc.width.as('px');
      var altura = doc.height.as('px');
      var maior = Math.max(largura, altura);

      if (maior > cfg.ladoMaximo) {
        var escala = cfg.ladoMaximo / maior;
        doc.resizeImage(
          UnitValue(Math.round(largura * escala), 'px'),
          UnitValue(Math.round(altura * escala), 'px'),
          doc.resolution,
          ResampleMethod.BICUBICSHARPER
        );
      }

      var ehPNG = cfg.formato === 'PNG-24';
      var base = IBD.slug(IBD.fs.semExtensao(arquivo));
      var saidaArquivo = IBD.fs.caminhoLivre(pasta, base, ehPNG ? 'png' : 'jpg');

      var exportar = new ExportOptionsSaveForWeb();
      if (ehPNG) {
        exportar.format = SaveDocumentType.PNG;
        exportar.PNG8 = false;
        exportar.transparency = true;
      } else {
        exportar.format = SaveDocumentType.JPEG;
        exportar.quality = Math.max(0, Math.min(100, cfg.qualidade));
        exportar.optimized = true;
      }
      doc.exportDocument(saidaArquivo, ExportType.SAVEFORWEB, exportar);
    } finally {
      doc.close(SaveOptions.DONOTSAVECHANGES);
    }
  }
})();
