/**
 * @ibd-id illustrator/impressao-e-corte
 * @ibd-titulo Montagem para impressão e corte
 * @ibd-descricao Repete arte e faca em duas pranchetas sincronizadas. Gera PDFs separados, marcas ópticas configuráveis e PLT em escala 1:1.
 * @ibd-app illustrator
 * @ibd-versao 1.1.0
 * @ibd-doc docs/folha/README.md
 * @ibd-tags print cut, adesivo, faca, plotter, hpgl, plt, sangria, imposicao
 */
#target illustrator

#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-fs.jsx"
#include "../../../core/extendscript/ibd-print-cut.jsx"

(function () {
  var pt = imposicaoPt;
  var titulo = 'Impressão e corte';
  var nomesMarca = ['Sem marcas', 'Cantoneiras em L', 'Quadrados sólidos', 'Círculos sólidos'];
  var nomesSangria = ['Estender fundo vetorial', 'Arte já sangrada', 'Sem sangria'];
  var nomesOrigem = ['Canto inferior esquerdo · Y para cima', 'Marca superior esquerda · Y para baixo'];

  function formulario() {
    return IBD.ui.formulario(titulo, [
      { id: 'largura', rotulo: 'Largura (mm)', grupo: 'Folha', padrao: '320' },
      { id: 'altura', rotulo: 'Altura (mm)', grupo: 'Folha', padrao: '450' },
      { id: 'margem', rotulo: 'Margem (mm)', grupo: 'Folha', padrao: '10' },
      { id: 'colunas', rotulo: 'Colunas · 0 auto', grupo: 'Grade', padrao: '0' },
      { id: 'linhas', rotulo: 'Linhas · 0 auto', grupo: 'Grade', padrao: '0' },
      { id: 'espaco', rotulo: 'Intervalo (mm)', grupo: 'Grade', padrao: '4' },
      { id: 'modo', rotulo: 'Sangria', grupo: 'Arte e faca', tipo: 'escolha', opcoes: nomesSangria, padrao: nomesSangria[0] },
      { id: 'sangria', rotulo: 'Sangria (mm)', grupo: 'Arte e faca', padrao: '2' },
      { id: 'spot', rotulo: 'Nome da cor spot', grupo: 'Arte e faca', padrao: 'CutContour' },
      { id: 'marca', rotulo: 'Padrão', grupo: 'Marcas ópticas', tipo: 'escolha', opcoes: nomesMarca, padrao: nomesMarca[1] },
      { id: 'tamanho', rotulo: 'Haste/lado (mm)', grupo: 'Marcas ópticas', padrao: '12' },
      { id: 'diametro', rotulo: 'Círculo · Ø (mm)', grupo: 'Marcas ópticas', padrao: '5' },
      { id: 'recuo', rotulo: 'Recuo (mm)', grupo: 'Marcas ópticas', padrao: '3' },
      { id: 'respiro', rotulo: 'Zona livre (mm)', grupo: 'Marcas ópticas', padrao: '6' },
      { id: 'origem', rotulo: 'Origem do PLT', grupo: 'Exportação', tipo: 'escolha', opcoes: nomesOrigem, padrao: nomesOrigem[0] }
    ], 'Gerar arquivos', {
      subtitulo: 'Selecione a arte e, para faca personalizada, um traçado fechado separado chamado FACA ou CutContour.',
      largura: 745,
      rotuloLargura: 120
    });
  }

  function opcoes(v) {
    var o = {};
    var specs = [
      ['largura', 2, 2000], ['altura', 2, 2000], ['margem', 0, 500], ['espaco', 0, 100],
      ['colunas', 0, 500], ['linhas', 0, 500], ['sangria', 0, 20],
      ['tamanho', 0.5, 50], ['recuo', 0.5, 100], ['respiro', 0, 100]
    ];
    for (var i = 0; i < specs.length; i++) {
      var spec = specs[i], campo = spec[0];
      var texto = String(v[campo]).replace(/^\s+|\s+$/g, '').replace(',', '.');
      var n = Number(texto);
      if (!/^\d+(?:\.\d+)?$/.test(texto) || !isFinite(n) || n < spec[1] || n > spec[2]) {
        throw Error('Confira ' + campo + ' (' + spec[1] + ' a ' + spec[2] + ').');
      }
      o[campo] = n;
    }
    if (o.colunas % 1 || o.linhas % 1) throw Error('Colunas e linhas devem ser inteiras.');
    o.marca = 'nenhuma';
    if (v.marca === nomesMarca[1]) o.marca = 'l';
    if (v.marca === nomesMarca[2]) o.marca = 'quadrado';
    if (v.marca === nomesMarca[3]) {
      o.marca = 'circulo';
      var dm = String(v.diametro || '5').replace(',', '.').replace(/^\s+|\s+$/g, '');
      o.tamanho = Number(dm);
      if (!/^\d+(?:\.\d+)?$/.test(dm) || o.tamanho < 1 || o.tamanho > 30) throw Error('Confira o diâmetro do círculo (1 a 30 mm).');
    }
    o.origem = v.origem === nomesOrigem[1] ? 'marca' : 'folha';
    if (o.origem === 'marca' && o.marca === 'nenhuma') throw Error('A origem na marca exige marcas ópticas.');
    o.modo = 'sem';
    if (v.modo === nomesSangria[0]) o.modo = 'automatico';
    if (v.modo === nomesSangria[1]) o.modo = 'pronto';
    if (o.modo === 'sem') o.sangria = 0;
    o.spot = String(v.spot).replace(/^\s+|\s+$/g, '');
    if (!/^[A-Za-z][A-Za-z0-9_ -]{0,31}$/.test(o.spot) || /^all$|^registration$|^none$/i.test(o.spot)) {
      throw Error('Use um nome de cor técnica com até 32 letras ASCII, números, espaços ou hífens.');
    }
    return o;
  }

  function caminhos(item) {
    if (item.typename === 'PathItem') return [item];
    if (item.typename === 'CompoundPathItem') {
      var lista = [];
      for (var i = 0; i < item.pathItems.length; i++) lista.push(item.pathItems[i]);
      return lista;
    }
    return [];
  }

  function percorrer(item, visitar) {
    visitar(item);
    if (item.typename !== 'GroupItem') return;
    for (var i = 0; i < item.pageItems.length; i++) {
      var filho = item.pageItems[i];
      if (filho.parent === item && !filho.hidden) percorrer(filho, visitar);
    }
  }

  function ehFaca(item, spot) {
    if (!caminhos(item).length) return false;
    if (/^(faca|cut[ _-]?contour)$/i.test(item.name)) return true;
    var primeiro = caminhos(item)[0];
    var cor = primeiro.stroked && primeiro.strokeColor;
    return cor && cor.typename === 'SpotColor' &&
      (cor.spot.name.toLowerCase() === spot.toLowerCase() || /^(faca|cut[ _-]?contour)$/i.test(cor.spot.name));
  }

  function selecionar(selecao, o) {
    if (!selecao || selecao.length < 1 || selecao.length > 2) {
      throw Error('Selecione a arte agrupada ou a arte junto de uma faca separada.');
    }
    var arte = selecao[0], faca = null, fundo = null;
    if (selecao.length === 2) {
      var primeira = ehFaca(selecao[0], o.spot), segunda = ehFaca(selecao[1], o.spot);
      if (Boolean(primeira) === Boolean(segunda)) throw Error('Identifique exatamente um dos objetos como FACA ou CutContour.');
      arte = primeira ? selecao[1] : selecao[0];
      faca = primeira ? selecao[0] : selecao[1];
    }
    if (typeof arte.duplicate !== 'function' || arte.guides || arte.clipping) throw Error('Selecione arte vetorial, imagem ou grupo de página.');
    percorrer(arte, function (item) {
      if (ehFaca(item, o.spot)) throw Error('Separe a faca técnica da arte antes de montar.');
      if (!o.sangria || o.modo !== 'automatico') return;
      if (item === arte && caminhos(item).length || /^fundo$/i.test(item.name)) {
        if (!caminhos(item).length || fundo) throw Error('Use um único fundo vetorial fechado chamado Fundo.');
        fundo = item;
      }
    });
    return { arte: arte, faca: faca, fundo: fundo };
  }

  function caixa(bounds, ref) {
    return [(bounds[0] - ref[0]) / pt, (ref[1] - bounds[1]) / pt,
      (bounds[2] - ref[0]) / pt, (ref[1] - bounds[3]) / pt];
  }

  function facaGeometria(selecao, o, origem) {
    var w = (origem[2] - origem[0]) / pt, h = (origem[1] - origem[3]) / pt;
    if (!selecao.faca) {
      var d = o.modo === 'pronto' ? o.sangria : 0;
      var b = imposicaoRetangulo([0, 0, w, h], -d);
      return { limites: b, curvas: [IBDPrintCut.retangulo(b)] };
    }
    function relativo(p) { return [(p[0] - origem[0]) / pt, (origem[1] - p[1]) / pt]; }
    var cp = caminhos(selecao.faca), contornos = [], vistos = {};
    for (var i = 0; i < cp.length; i++) {
      var item = cp[i], pontos = item.pathPoints, curva = [], chaves = [];
      if (!item.closed || item.clipping || item.guides || pontos.length < 2) {
        throw Error('A faca precisa ter somente contornos vetoriais fechados.');
      }
      for (var j = 0; j < pontos.length; j++) {
        var no = pontos[j];
        curva.push({ anchor: relativo(no.anchor), left: relativo(no.leftDirection), right: relativo(no.rightDirection) });
      }
      for (var k = 0; k < curva.length; k++) {
        var a = curva[k], bNo = curva[(k + 1) % curva.length];
        var ida = [a.anchor, a.right, bNo.left, bNo.anchor].join('/');
        var volta = [bNo.anchor, bNo.left, a.right, a.anchor].join('/');
        chaves.push(ida < volta ? ida : volta);
      }
      var chave = chaves.sort().join(';');
      if (vistos[chave]) throw Error('Há contornos duplicados na faca.');
      vistos[chave] = true;
      var box = caixa(item.geometricBounds, origem);
      contornos.push({ curva: curva, area: (box[2] - box[0]) * (box[3] - box[1]) });
    }
    contornos.sort(function (a, b) { return a.area - b.area; });
    var curvas = [];
    for (var c = 0; c < contornos.length; c++) curvas.push(contornos[c].curva);
    return { limites: caixa(selecao.faca.geometricBounds, origem), curvas: curvas };
  }

  function duplicarEm(obj, destino, x, y) {
    var documento = destino;
    while (documento.typename !== 'Document') documento = documento.parent;
    var copia = obj.duplicate(documento, ElementPlacement.PLACEATEND);
    copia.move(destino, ElementPlacement.PLACEATEND);
    var b = copia.visibleBounds;
    copia.translate(x - b[0], y - b[1], true, true, true, true);
    return copia;
  }

  function sangrar(doc, selecao, destino, o, faca, ref, board) {
    if (!o.sangria || o.modo !== 'automatico') return;
    if (!selecao.fundo) throw Error('Para gerar sangria, nomeie o fundo vetorial fechado do grupo como Fundo.');
    var partes = caminhos(selecao.fundo);
    for (var i = 0; i < partes.length; i++) {
      if (!partes[i].closed || partes[i].clipping || partes[i].guides || !partes[i].filled) {
        throw Error('O fundo precisa ser uma forma vetorial fechada e preenchida.');
      }
    }
    var fundo = caixa(selecao.fundo.geometricBounds, ref);
    for (var k = 0; k < 4; k++) {
      if (Math.abs(fundo[k] - faca[k]) > 0.15) throw Error('Alinhe o fundo vetorial aos limites da faca para gerar sangria.');
    }
    var area = destino.groupItems.add();
    var lim = caixa(selecao.fundo.visibleBounds, ref);
    var copia = duplicarEm(selecao.fundo, area, board[0] + lim[0] * pt, board[1] - lim[1] * pt);
    copia.applyEffect('<LiveEffect name="Adobe Offset Path"><Dict data="R mlim 4 R ofst ' +
      (o.sangria * pt).toFixed(5) + ' I jntp 0 "/></LiveEffect>');
    doc.selection = null;
    copia.selected = true;
    app.redraw();
    app.executeMenuCommand('expandStyle');
    doc.selection = null;
    verificarSangria(caixa(area.visibleBounds, board), faca, o.sangria);
  }

  function verificarSangria(lim, faca, folga) {
    var alvo = imposicaoRetangulo(faca, folga);
    if (lim[0] > alvo[0] + 0.15 || lim[1] > alvo[1] + 0.15 ||
        lim[2] < alvo[2] - 0.15 || lim[3] < alvo[3] - 0.15) {
      throw Error('O fundo não cobre a sangria informada. Confira a arte e a faca.');
    }
  }

  function corProcesso(magenta, preto) {
    var cor = new CMYKColor();
    cor.cyan = 0; cor.magenta = magenta; cor.yellow = 0; cor.black = preto;
    return cor;
  }

  function corFaca(doc, name) {
    var swatch = doc.spots.add();
    swatch.name = name;
    if (swatch.name !== name) throw Error('A arte já usa o nome da tinta técnica. Escolha outro nome para a faca.');
    swatch.colorType = ColorModel.SPOT;
    swatch.color = corProcesso(100, 0);
    var spot = new SpotColor();
    spot.spot = swatch;
    spot.tint = 100;
    return spot;
  }

  function pontosEm(destino, curva, dx, dy, board, tinta) {
    var corte = destino.pathItems.add();
    function pos(p) { return [board[0] + (p[0] + dx) * pt, board[1] - (p[1] + dy) * pt]; }
    for (var j = 0; j < curva.length; j++) {
      var no = corte.pathPoints.add();
      no.anchor = pos(curva[j].anchor);
      no.leftDirection = pos(curva[j].left);
      no.rightDirection = pos(curva[j].right);
    }
    corte.closed = true;
    corte.filled = false;
    corte.stroked = true;
    corte.strokeWidth = 0.25;
    corte.strokeColor = tinta;
    corte.strokeOverprint = true;
  }

  function desenharMarcas(destino, marcas, o, board) {
    if (!marcas.length) return;
    var camada = destino.groupItems.add();
    camada.name = 'Marcas ópticas K100';
    var quadrado = o.marca === 'quadrado', preto = corProcesso(0, 100);
    for (var i = 0; i < marcas.length; i++) {
      if (o.marca === 'circulo') {
        var centro = marcas[i][0], d = o.tamanho * pt;
        var ponto = camada.pathItems.ellipse(board[1] - centro[1] * pt + d / 2, board[0] + centro[0] * pt - d / 2, d, d);
        ponto.filled = true;
        ponto.stroked = false;
        ponto.fillColor = preto;
        continue;
      }
      var curva = camada.pathItems.add(), pontos = [];
      for (var j = 0; j < marcas[i].length; j++) {
        var p = marcas[i][j];
        pontos.push([board[0] + p[0] * pt, board[1] - p[1] * pt]);
      }
      curva.setEntirePath(pontos);
      curva.closed = quadrado;
      curva.filled = quadrado;
      curva.stroked = !quadrado;
      if (quadrado) curva.fillColor = preto;
      else {
        curva.strokeColor = preto;
        curva.strokeWidth = 1.8;
        curva.strokeCap = StrokeCap.BUTTENDCAP;
        curva.strokeJoin = StrokeJoin.MITERENDJOIN;
      }
    }
  }

  function pdf(grupo, board, arquivo, o) {
    var temp = app.documents.add(DocumentColorSpace.CMYK, o.largura * pt, o.altura * pt);
    try {
      var ret = temp.artboards[0].artboardRect;
      var b = grupo.visibleBounds;
      duplicarEm(grupo, temp.layers[0], ret[0] + b[0] - board[0], ret[1] + b[1] - board[1]);
      var opts = new PDFSaveOptions();
      opts.artboardRange = '1';
      opts.compatibility = PDFCompatibility.ACROBAT7;
      opts.preserveEditability = false;
      opts.acrobatLayers = false;
      opts.colorConversionID = ColorConversion.None;
      opts.trimMarks = false;
      opts.registrationMarks = false;
      opts.colorBars = false;
      opts.pageInformation = false;
      opts.viewAfterSaving = false;
      temp.saveAs(arquivo, opts);
      if (!arquivo.exists || !arquivo.length) throw Error('Falha ao salvar ' + arquivo.name + '.');
    } finally {
      temp.close(SaveOptions.DONOTSAVECHANGES);
    }
  }

  function exportar(s, o, raiz, nome) {
    var doc = null, pasta = null, arquivos = [];
    var sistema = app.coordinateSystem;
    try {
      app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
      var ref = s.arte.visibleBounds;
      var faca = facaGeometria(s, o, ref);
      var curvasPlt = [];
      for (var k = 0; k < faca.curvas.length; k++) curvasPlt.push(IBDPrintCut.polilinha(faca.curvas[k]));
      doc = app.documents.add(DocumentColorSpace.CMYK, o.largura * pt, o.altura * pt);
      var a = doc.artboards[0].artboardRect;
      var b = [a[2] + 20 * pt, a[1], a[2] + (20 + o.largura) * pt, a[3]];
      doc.artboards[0].name = 'IMPRESSAO';
      doc.artboards.add(b).name = 'FACA_CORTE';

      var impressao = doc.layers[0], tecnica = doc.layers.add();
      impressao.name = 'IMPRESSAO'; tecnica.name = 'FACA_CORTE';
      var grupoArte = impressao.groupItems.add(), grupoFaca = tecnica.groupItems.add();
      var molde = grupoArte.groupItems.add();
      sangrar(doc, s, molde, o, faca.limites, ref, a);
      var arte = duplicarEm(s.arte, molde, a[0], a[1]);
      arte.zOrder(ZOrderMethod.BRINGTOFRONT);
      var limites = caixa(molde.visibleBounds, a);
      if (o.modo === 'pronto' && o.sangria) verificarSangria(limites, faca.limites, o.sangria);
      var plano = IBDPrintCut.planejar(o, limites, faca.limites);
      var plt = IBDPrintCut.plt(curvasPlt, plano.posicoes, o);

      var tinta = corFaca(doc, o.spot);
      for (var i = 0; i < plano.posicoes.length; i++) {
        var desloc = plano.posicoes[i];
        var copia = molde.duplicate(grupoArte, ElementPlacement.PLACEATEND);
        copia.translate(desloc[0] * pt, -desloc[1] * pt, true, true, true, true);
        for (var n = 0; n < faca.curvas.length; n++) pontosEm(grupoFaca, faca.curvas[n], desloc[0], desloc[1], b, tinta);
      }
      molde.remove();
      desenharMarcas(grupoArte, plano.marcas, o, a);

      var prefixo = IBD.fs.juntar(raiz.fsName, nome + '-print-cut-' + IBD.carimbo());
      var destino = new Folder(prefixo), sufixo = 1;
      while (destino.exists && sufixo <= 999) destino = new Folder(prefixo + '-' + sufixo++);
      if (destino.exists || !destino.create()) throw Error('Não foi possível criar uma pasta nova para o trabalho.');
      pasta = destino;
      arquivos = [
        new File(IBD.fs.juntar(pasta.fsName, 'IMPRESSAO.pdf')),
        new File(IBD.fs.juntar(pasta.fsName, 'FACA.pdf')),
        new File(IBD.fs.juntar(pasta.fsName, 'CORTE.plt'))
      ];
      pdf(grupoArte, a, arquivos[0], o);
      pdf(grupoFaca, b, arquivos[1], o);
      IBD.fs.escreverTexto(arquivos[2], plt, 'ASCII');
      if (!arquivos[2].exists || IBD.fs.lerTexto(arquivos[2], 'ASCII').replace(/\r\n?/g, '\n') !== plt) {
        throw Error('Falha ao conferir a gravação do PLT.');
      }
      doc.activate();
      doc.artboards.setActiveArtboardIndex(0);
      return { doc: doc, pasta: pasta, poses: plano.posicoes.length, margem: plano.margem };
    } catch (e) {
      if (doc) try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (_) {}
      for (var j = 0; j < arquivos.length; j++) try { if (arquivos[j].exists) arquivos[j].remove(); } catch (_) {}
      if (pasta) try { pasta.remove(); } catch (_) {}
      throw e;
    } finally {
      app.coordinateSystem = sistema;
    }
  }

  try {
    if (!app.documents.length) throw Error('Abra um documento CMYK e selecione a arte.');
    var fonte = app.activeDocument;
    if (fonte.documentColorSpace !== DocumentColorSpace.CMYK) throw Error('Use um documento CMYK para preservar as separações e o preto das marcas.');
    if (!fonte.selection || !fonte.selection.length) throw Error('Selecione a arte antes de começar.');
    var valores = formulario();
    if (!valores) return;
    var o = opcoes(valores);
    var s = selecionar(fonte.selection, o);
    var raiz = Folder.selectDialog('Escolha a pasta de saída');
    if (!raiz) return;
    var resultado = exportar(s, o, raiz, IBD.slug(IBD.fs.semExtensao(fonte.name)) || 'trabalho');
    IBD.ui.resumo(titulo, [
      resultado.poses + ' poses · margem efetiva ' + Number(resultado.margem.toFixed(2)) + ' mm',
      'IMPRESSAO.pdf · FACA.pdf · CORTE.plt',
      resultado.pasta.fsName,
      'Origem PLT · ' + (o.origem === 'marca' ? nomesOrigem[1] : nomesOrigem[0]),
      'Confira escala 1:1, sentido e padrão óptico no software da plotter.'
    ]);
  } catch (e) {
    alert(titulo + '\n' + e.message);
  }
}());
