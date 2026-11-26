/* Funções compartilhadas pelos módulos de pré-impressão do Illustrator. */
var IBDPP = (function () {
  var pt = 72 / 25.4;
  var meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var formatos = {
    'A4': [210,297], 'A5': [148,210], 'T4': [328,478], 'T8': [238,328],
    'SRA3': [320,450], '10 × 15 cm': [100,150], '90 × 50 mm': [90,50]
  };

  function num(valor, nome, minimo, maximo, inteiro) {
    var texto = String(valor).replace(/^\s+|\s+$/g, '').replace(',', '.');
    var n = Number(texto);
    if (!/^\d+(?:\.\d+)?$/.test(texto) || !isFinite(n) || n < minimo || n > maximo || (inteiro && n % 1)) {
      throw Error(nome + ' deve ser ' + (inteiro ? 'um inteiro' : 'um número') + ' entre ' + minimo + ' e ' + maximo + '.');
    }
    return n;
  }

  function medidas(formato, largura, altura) {
    if (formatos[formato]) return formatos[formato].slice(0);
    return [num(largura, 'Largura', 1, 2000), num(altura, 'Altura', 1, 2000)];
  }

  function cmyk(c, m, y, k) {
    var cor = new CMYKColor();
    cor.cyan = c; cor.magenta = m; cor.yellow = y; cor.black = k;
    return cor;
  }

  function preta(doc) {
    if (doc.documentColorSpace === DocumentColorSpace.CMYK) return cmyk(0,0,0,100);
    var cor = new RGBColor();
    cor.red = 0; cor.green = 0; cor.blue = 0;
    return cor;
  }

  function doc(cmykObrigatorio) {
    if (!app.documents.length) throw Error('Abra um documento no Illustrator.');
    var atual = app.activeDocument;
    if (cmykObrigatorio && atual.documentColorSpace !== DocumentColorSpace.CMYK) throw Error('Use um documento CMYK.');
    return atual;
  }

  function executar(titulo, rotina) {
    var antes = app.coordinateSystem;
    try {
      app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
      rotina();
    } catch (e) {
      alert(titulo + '\n' + e.message);
    } finally {
      app.coordinateSystem = antes;
    }
  }

  function novaGrade(dim, qtd, colunas, intervalo, nomes) {
    var w = dim[0], h = dim[1];
    colunas = Math.min(qtd, colunas);
    if (colunas * w + (colunas - 1) * intervalo > 4300 ||
        Math.ceil(qtd / colunas) * (h + intervalo) - intervalo > 4300) {
      throw Error('A grade excede o limite de 4.300 mm. Reduza as dimensões, o intervalo ou o número de pranchetas.');
    }
    var d = app.documents.add(DocumentColorSpace.CMYK, w * pt, h * pt);
    try {
      var base = d.artboards[0].artboardRect;
      for (var i = 0; i < qtd; i++) {
        var x = base[0] + i % colunas * (w + intervalo) * pt;
        var y = base[1] - Math.floor(i / colunas) * (h + intervalo) * pt;
        var a = i ? d.artboards.add([x, y, x + w * pt, y - h * pt]) : d.artboards[0];
        a.name = nomes ? nomes[i] : 'Prancheta ' + (i + 1);
      }
      d.artboards.setActiveArtboardIndex(0);
      return d;
    } catch (e) {
      fechar(d);
      throw e;
    }
  }

  function fechar(doc) {
    try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (_) {}
  }

  function ret(destino, a, x, y, w, h, cor, traco) {
    var p = destino.pathItems.rectangle(a[1] - y * pt, a[0] + x * pt, w * pt, h * pt);
    p.stroked = !!traco;
    p.filled = !traco && !!cor;
    if (p.stroked) { p.strokeWidth = traco; p.strokeColor = cor; }
    if (p.filled) p.fillColor = cor;
    return p;
  }

  function linha(destino, a, segmento, cor, traco, tracejado) {
    var p = destino.pathItems.add();
    p.setEntirePath([[a[0] + segmento[0] * pt, a[1] - segmento[1] * pt],
      [a[0] + segmento[2] * pt, a[1] - segmento[3] * pt]]);
    p.filled = false; p.stroked = true; p.strokeColor = cor; p.strokeWidth = traco;
    p.strokeCap = StrokeCap.BUTTENDCAP;
    if (tracejado) p.strokeDashes = [1.1 * pt, 0.65 * pt];
    return p;
  }

  function margensCapa(w, h, paginas, caliper, canal, vira) {
    var lombada = Math.ceil(paginas / 2) * caliper;
    var miolo = vira + w + canal;
    return { largura: 2 * vira + 2 * w + 2 * canal + lombada, altura: h + 2 * vira,
      lombada: lombada, paineis: [[vira, vira, w, h], [miolo, vira, lombada, h],
        [miolo + lombada + canal, vira, w, h]] };
  }

  function marcas(w, h, sangria, offset, comprimento, cortes, xs, ys) {
    var d = Math.max(offset, sangria + 0.35 / (2 * pt) + 0.01);
    var e = d + comprimento;
    var segmentos = [];
    function adicionar(x1,y1,x2,y2,vinco) { segmentos.push([x1,y1,x2,y2,!!vinco]); }
    if (cortes) {
      var xx = [0,w], yy = [0,h];
      for (var i = 0; i < 2; i++) {
        adicionar(xx[i], -d, xx[i], -e);
        adicionar(xx[i], h + d, xx[i], h + e);
        adicionar(-d, yy[i], -e, yy[i]);
        adicionar(w + d, yy[i], w + e, yy[i]);
      }
    }
    for (var j = 0; j < xs.length; j++) {
      adicionar(xs[j], -d, xs[j], -e, true);
      adicionar(xs[j], h + d, xs[j], h + e, true);
    }
    for (var k = 0; k < ys.length; k++) {
      adicionar(-d, ys[k], -e, ys[k], true);
      adicionar(w + d, ys[k], w + e, ys[k], true);
    }
    return { offset: d, expansao: e + 0.5, segmentos: segmentos };
  }

  function mes(ano, indice) {
    var inicio = new Date(Date.UTC(ano, indice, 1)).getUTCDay();
    var dias = new Date(Date.UTC(ano, indice + 1, 0)).getUTCDate();
    return { nome: meses[indice], inicio: inicio, dias: dias, semanas: Math.ceil((inicio + dias) / 7) };
  }

  function rico(cor) {
    if (!cor || cor.typename !== 'CMYKColor' || cor.black < 80) return false;
    var menor = Math.min(cor.cyan, cor.magenta, cor.yellow);
    var maior = Math.max(cor.cyan, cor.magenta, cor.yellow);
    return menor > 0 && maior - menor <= 35;
  }

  function visivel(item) {
    var p = item;
    while (p && p.typename !== 'Document') {
      if (p.hidden || p.typename === 'Layer' && (!p.visible || !p.printable)) return false;
      p = p.parent;
    }
    return true;
  }

  function editavel(item) {
    var p = item;
    while (p && p.typename !== 'Document') {
      if (p.locked || p.hidden || p.typename === 'Layer' && !p.visible) return false;
      p = p.parent;
    }
    return true;
  }

  function recorte(a, b) {
    return a[0] < b[2] && a[2] > b[0] && a[1] > b[3] && a[3] < b[1];
  }

  function copiarEm(item, destino, dx, dy) {
    var d = destino;
    while (d.typename !== 'Document') d = d.parent;
    var b = item.visibleBounds;
    var c = item.duplicate(d, ElementPlacement.PLACEATEND);
    c.move(destino, ElementPlacement.PLACEATBEGINNING);
    var atual = c.visibleBounds;
    c.translate(dx + b[0] - atual[0], dy + b[1] - atual[1], true, true, true, true);
    return c;
  }

  function spot(doc, nome) {
    var s;
    try { s = doc.spots.getByName(nome); } catch (_) {}
    if (!s) {
      try {
        var amostra = doc.swatches.getByName(nome);
        if (amostra) throw Error('Já existe uma amostra com o nome ' + nome + '. Renomeie a amostra antes de continuar.');
      } catch (e) { if (amostra) throw e; }
      s = doc.spots.add();
      s.name = nome;
      s.colorType = ColorModel.SPOT;
      s.color = cmyk(0,100,0,0);
    }
    if (s.colorType !== ColorModel.SPOT) throw Error('A amostra ' + nome + ' precisa ser uma cor especial.');
    var cor = new SpotColor();
    cor.spot = s; cor.tint = 100;
    return cor;
  }

  function pdf(doc, arquivo, intervalo) {
    var o = new PDFSaveOptions();
    o.artboardRange = intervalo;
    o.compatibility = PDFCompatibility.ACROBAT7;
    o.preserveEditability = false;
    o.acrobatLayers = false;
    o.colorConversionID = ColorConversion.None;
    o.viewAfterSaving = false;
    o.trimMarks = false; o.registrationMarks = false; o.colorBars = false; o.pageInformation = false;
    doc.saveAs(arquivo, o);
    if (!arquivo.exists || !arquivo.length) throw Error('O PDF não foi gravado.');
  }

  function salvarArquivo(titulo, ext) {
    var f = File.saveDialog(titulo);
    if (!f) return null;
    if (f.name.toLowerCase().slice(-ext.length - 1) !== '.' + ext) f = new File(f.fsName + '.' + ext);
    if (f.exists) throw Error('Escolha um nome novo para preservar o arquivo existente.');
    return f;
  }

  function sangria(a, b) {
    return [a[0] - b * pt, a[1] + b * pt, a[2] + b * pt, a[3] - b * pt];
  }

  return { pt: pt, num: num, medidas: medidas, cmyk: cmyk, preta: preta, doc: doc, executar: executar,
    novaGrade: novaGrade, fechar: fechar, ret: ret, linha: linha, margensCapa: margensCapa, marcas: marcas,
    mes: mes, rico: rico, visivel: visivel, editavel: editavel, recorte: recorte, copiarEm: copiarEm,
    spot: spot, pdf: pdf, salvarArquivo: salvarArquivo, sangria: sangria };
}());
