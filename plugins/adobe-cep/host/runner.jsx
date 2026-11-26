/* ExtendScript host runner (ES3) para extensao CEP IBD Ferramentas. */
function ibdExecutarArquivo(caminho) {
  try {
    var f = new File(caminho);
    if (!f.exists) {
      return 'ERRO:Arquivo nao encontrado -> ' + caminho;
    }
    $.evalFile(f);
    return 'OK';
  } catch (e) {
    var msg = (e && e.message) ? String(e.message) : String(e);
    if (e && e.line) msg += ' (linha ' + e.line + ')';
    return 'ERRO:' + msg;
  }
}

/* Ponte Illustrator: nenhuma expressão do plano é executada pelo ExtendScript. */
function ibdLerGeometriaFolha(texto) {
  if (typeof texto !== 'string' || texto.length > 300000) throw Error('Plano Folha inválido.');
  function numeros(linha, total) {
    var valores = linha.split(',');
    if (valores.length !== total) throw Error('Geometria incompleta.');
    for (var i = 0; i < total; i++) {
      if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(valores[i])) throw Error('Medida inválida.');
      valores[i] = Number(valores[i]);
      if (!isFinite(valores[i])) throw Error('Medida fora da faixa.');
    }
    return valores;
  }
  var partes = texto.split('|');
  var cab = numeros(partes[0], 6);
  var w = cab[1], h = cab[2], sangria = cab[3], copiar = cab[4] === 1;
  if (cab[0] !== 1 || w <= 0 || h <= 0 || w > 5000 || h > 5000 || sangria < 0 ||
      (cab[4] !== 0 && cab[4] !== 1) || (cab[5] !== 1 && cab[5] !== 2) || partes.length !== cab[5] + 1 ||
      (copiar && cab[5] !== 1)) throw Error('Cabeçalho Folha inválido.');

  var faces = [], tolerancia = 0.0001;
  for (var f = 1; f < partes.length; f++) {
    var linhas = partes[f].split(';'), face = [];
    if (linhas.length > 1400) throw Error('O plano excede o limite de posições do adaptador.');
    for (var j = 0; j < linhas.length; j++) {
      var p = numeros(linhas[j], 5);
      if (p[2] <= 0 || p[3] <= 0 || p[0] - sangria < -tolerancia || p[1] - sangria < -tolerancia ||
          p[0] + p[2] + sangria > w + tolerancia || p[1] + p[3] + sangria > h + tolerancia ||
          p[4] % 90 !== 0 || Math.abs(p[4]) > 360) throw Error('Peça fora da folha ou com rotação incompatível.');
      face.push(p);
    }
    faces.push(face);
  }
  return { w: w, h: h, sangria: sangria, copiar: copiar, faces: faces };
}

function ibdAplicarFolha(texto) {
  var camadas = [], pranchetas = [], sistema, doc, ativa, camadaAtiva;
  try {
    var plano = ibdLerGeometriaFolha(texto);
    if (!app.documents.length) throw Error('Abra um documento no Illustrator.');
    doc = app.activeDocument;
    sistema = app.coordinateSystem;
    ativa = doc.artboards.getActiveArtboardIndex();
    camadaAtiva = doc.activeLayer;
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    var pt = 72 / 25.4, origemX = -Infinity, origemY = -Infinity, original;
    if (plano.copiar) {
      var selecao = doc.selection;
      if (!selecao || selecao.length !== 1 || typeof selecao[0].duplicate !== 'function') {
        throw Error('Selecione um objeto ou grupo para repetir a arte.');
      }
      original = selecao[0];
      var limites = original.visibleBounds;
      var largura = (limites[2] - limites[0]) / pt, altura = (limites[1] - limites[3]) / pt;
      var itens = plano.faces[0];
      for (var k = 0; k < itens.length; k++) {
        var item = itens[k], girado = Math.abs(item[4] % 180) === 90;
        if (Math.abs(item[2] - (girado ? altura : largura)) > 0.25 ||
            Math.abs(item[3] - (girado ? largura : altura)) > 0.25) {
          throw Error('A seleção deve ter o tamanho final das peças do plano (tolerância 0,25 mm).');
        }
      }
    }
    if (!confirm('Criar ' + plano.faces.length + ' prancheta(s) de imposição e suas camadas no documento aberto?')) return 'Cancelado.';

    var arteLimites = doc.visibleBounds;
    origemX = Math.max(origemX, arteLimites[2]);
    origemY = Math.max(origemY, arteLimites[1]);
    for (var i = 0; i < doc.artboards.length; i++) {
      var caixa = doc.artboards[i].artboardRect;
      origemX = Math.max(origemX, caixa[2]);
      origemY = Math.max(origemY, caixa[1]);
    }
    origemX += 15 * pt;
    var corCorte = new CMYKColor(); corCorte.magenta = 100;
    var corSangria = new CMYKColor(); corSangria.cyan = 100;
    function retangulo(destino, p, folga, cor) {
      var caminho = destino.pathItems.rectangle(origemY - (p[1] - folga) * pt, origemX + (p[0] - folga) * pt,
        (p[2] + 2 * folga) * pt, (p[3] + 2 * folga) * pt);
      caminho.filled = false;
      caminho.stroked = true;
      caminho.strokeColor = cor;
      caminho.strokeWidth = 0.25;
      if (folga) caminho.strokeDashes = [2, 2];
    }

    for (var f = 0; f < plano.faces.length; f++) {
      var prancheta = doc.artboards.add([origemX, origemY, origemX + plano.w * pt, origemY - plano.h * pt]);
      pranchetas.push(prancheta);
      prancheta.name = 'Folha ' + (doc.artboards.length) + ' · Face ' + (f + 1);
      var arte = original ? doc.layers.add() : null;
      if (arte) { camadas.push(arte); arte.name = 'Folha · Arte'; }
      var tecnicas = doc.layers.add();
      camadas.push(tecnicas);
      tecnicas.name = 'Folha · Corte e sangria · Face ' + (f + 1);
      for (var j = 0; j < plano.faces[f].length; j++) {
        var p = plano.faces[f][j];
        if (original) {
          var copia = original.duplicate(arte, ElementPlacement.PLACEATEND);
          if (p[4]) copia.rotate(-p[4], true, true, true, true, Transformation.CENTER);
          var b = copia.visibleBounds;
          copia.translate(origemX + p[0] * pt - b[0], origemY - p[1] * pt - b[1]);
        }
        if (plano.sangria) retangulo(tecnicas, p, plano.sangria, corSangria);
        retangulo(tecnicas, p, 0, corCorte);
      }
      origemX += (plano.w + 15) * pt;
    }
    return 'OK';
  } catch (erro) {
    for (var c = camadas.length - 1; c >= 0; c--) try { camadas[c].remove(); } catch (_) {}
    for (var a = pranchetas.length - 1; a >= 0; a--) try { pranchetas[a].remove(); } catch (_) {}
    return 'ERRO: ' + erro.message;
  } finally {
    if (doc) {
      try { doc.artboards.setActiveArtboardIndex(ativa); } catch (_) {}
      try { doc.activeLayer = camadaAtiva; } catch (_) {}
    }
    if (sistema !== undefined) app.coordinateSystem = sistema;
  }
}

/* A produção usa o documento CMYK e a posição real da prancheta recém-criada. */
function ibdLerTecnicasFolha(texto, plano) {
  if (typeof texto !== 'string' || texto.length > 300000) throw Error('Marcas Folha inválidas.');
  function numeros(linha, total) {
    var campos = linha.split(',');
    if (campos.length !== total) throw Error('Marcas Folha incompletas.');
    for (var i = 0; i < total; i++) {
      if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(campos[i])) throw Error('Medida técnica inválida.');
      campos[i] = Number(campos[i]);
      if (!isFinite(campos[i])) throw Error('Medida técnica fora da faixa.');
    }
    return campos;
  }
  function lista(bloco, total, max) {
    var linhas = bloco ? bloco.split(';') : [];
    if (linhas.length > max) throw Error('Quantidade de marcas fora da faixa.');
    for (var i = 0; i < linhas.length; i++) linhas[i] = numeros(linhas[i], total);
    return linhas;
  }
  function dentro(x, y) { return x >= 0 && y >= 0 && x <= plano.w && y <= plano.h; }
  function caixa(b) { return dentro(b[0], b[1]) && dentro(b[2], b[3]) && b[2] > b[0] && b[3] > b[1]; }

  var partes = texto.split('|');
  if (partes.length !== 6 || plano.faces.length !== 1 || plano.copiar) throw Error('A montagem de produção aceita uma frente por documento.');
  var opt = numeros(partes[0], 5);
  var trim = numeros(partes[1], 4);
  if (opt[0] < 0 || opt[2] < 0.25 || opt[2] > 0.5 || !caixa(trim) ||
      opt[1] % 1 || opt[1] < 0 || opt[1] > 1 || opt[3] % 1 || opt[3] < 0 || opt[3] > 1 ||
      opt[4] % 1 || opt[4] < 0 || opt[4] > 1 || (opt[1] ? plano.sangria !== 0 : plano.sangria !== opt[0])) {
    throw Error('Opções de montagem inválidas.');
  }
  var eps = 0.0001;
  if (trim[0] - opt[0] < -eps || trim[1] - opt[0] < -eps ||
      trim[2] + opt[0] > plano.w + eps || trim[3] + opt[0] > plano.h + eps) throw Error('Sangria fora da folha.');
  var itens = plano.faces[0];
  for (var p = 0; p < itens.length; p++) {
    var item = itens[p];
    if (item[0] < trim[0] - eps || item[1] < trim[1] - eps ||
        item[0] + item[2] > trim[2] + eps || item[1] + item[3] > trim[3] + eps) throw Error('Pose fora dos limites do bloco.');
  }
  var linhas = lista(partes[2], 4, 5600), miras = lista(partes[3], 3, 4), escala = lista(partes[4], 8, 14);
  var os = partes[5] ? numeros(partes[5], 4) : null;
  var i, b, raio;
  for (i = 0; i < linhas.length; i++) {
    b = linhas[i];
    if (!dentro(b[0], b[1]) || !dentro(b[2], b[3]) || (b[0] === b[2]) === (b[1] === b[3])) throw Error('Marca de corte inválida.');
  }
  for (i = 0; i < miras.length; i++) {
    b = miras[i];
    raio = b[2] * 1.6;
    if (raio <= 0 || !caixa([b[0] - raio, b[1] - raio, b[0] + raio, b[1] + raio])) throw Error('Mira fora da folha.');
  }
  for (i = 0; i < escala.length; i++) {
    b = escala[i];
    if (!caixa([b[0], b[1], b[0] + b[2], b[1] + b[3]])) throw Error('Patch fora da folha.');
    for (var canal = 4; canal < 8; canal++) if (b[canal] < 0 || b[canal] > 100) throw Error('Valor CMYK inválido.');
  }
  if (os && !caixa(os)) throw Error('Identificação fora da folha.');
  return { sangria: opt[0], compartilhado: opt[1] === 1, stroke: opt[2], vincular: opt[3] === 1,
    sangrada: opt[4] === 1, trim: trim, linhas: linhas, miras: miras, escala: escala, os: os };
}

function ibdCorRegistroFolha(doc) {
  for (var i = 0; i < doc.spots.length; i++) {
    var spot = doc.spots[i];
    if (spot.colorType === ColorModel.REGISTRATION) {
      var cor = new SpotColor();
      cor.spot = spot;
      cor.tint = 100;
      return cor;
    }
  }
  throw Error('O documento não oferece uma amostra de Registro nativa.');
}

function ibdGerarFolha(texto, tecnicas, identificacao) {
  var doc, sistema, prefs, caixaPDF, paginaPDF;
  try {
    var plano = ibdLerGeometriaFolha(texto);
    var t = ibdLerTecnicasFolha(tecnicas, plano);
    if (typeof identificacao !== 'string' || identificacao.length > 80 || /[\x00-\x1f\x7f]/.test(identificacao)) {
      throw Error('Identificação da OS inválida.');
    }
    var arquivo, itens = plano.faces[0];
    if (t.vincular) {
      var filtro = /windows/i.test($.os) ? 'Arquivos de arte:*.pdf;*.ai;*.eps' : function (f) {
        return f instanceof Folder || /\.(pdf|ai|eps)$/i.test(f.name);
      };
      arquivo = File.openDialog('Selecione a arte final em PDF, AI ou EPS', filtro, false);
      if (!arquivo) return 'Cancelado.';
      if (!arquivo.exists || !/\.(pdf|ai|eps)$/i.test(arquivo.name)) throw Error('Selecione um arquivo PDF, AI ou EPS válido.');
    }

    var pt = 72 / 25.4;
    sistema = app.coordinateSystem;
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    doc = app.documents.add(DocumentColorSpace.CMYK, plano.w * pt, plano.h * pt);
    var aba = doc.artboards[0], borda = aba.artboardRect;
    aba.name = identificacao || 'Folha de máquina';
    function x(mm) { return borda[0] + mm * pt; }
    function y(mm) { return borda[1] - mm * pt; }
    function ret(container, b) {
      return container.pathItems.rectangle(y(b[1]), x(b[0]), (b[2] - b[0]) * pt, (b[3] - b[1]) * pt);
    }

    if (arquivo) {
      var arte = doc.layers[0];
      arte.name = 'Folha · Arte vinculada';
      if (/\.(pdf|ai)$/i.test(arquivo.name)) {
        prefs = app.preferences.PDFFileOptions;
        caixaPDF = prefs.pDFCropToBox;
        paginaPDF = prefs.pageToOpen;
        prefs.pDFCropToBox = t.sangrada ? PDFBoxType.PDFBLEEDBOX : PDFBoxType.PDFTRIMBOX;
        prefs.pageToOpen = 1;
      }
      var fonte = doc.placedItems.add();
      fonte.file = arquivo;
      if (prefs) {
        prefs.pDFCropToBox = caixaPDF;
        prefs.pageToOpen = paginaPDF;
        prefs = null;
      }
      var tamanho = fonte.geometricBounds;
      var adicional = t.sangrada ? t.sangria : 0;
      var w = (tamanho[2] - tamanho[0]) / pt - 2 * adicional;
      var h = (tamanho[1] - tamanho[3]) / pt - 2 * adicional;
      var tolerancia = 0.05;
      for (var i = 0; i < itens.length; i++) {
        var p = itens[i], girou = Math.abs(p[4] % 180) === 90;
        if (Math.abs(p[2] - (girou ? h : w)) > tolerancia || Math.abs(p[3] - (girou ? w : h)) > tolerancia) {
          throw Error('A arte posicionada mede ' + (w + 2 * adicional).toFixed(2) + ' × ' +
            (h + 2 * adicional).toFixed(2) + ' mm. Confira o formato, a caixa e a opção de sangria. A arte precisa servir a todas as poses.');
        }
      }
      for (var j = 0; j < itens.length; j++) {
        var pose = itens[j];
        var copia = fonte.duplicate(arte, ElementPlacement.PLACEATEND);
        if (pose[4]) copia.rotate(-pose[4], true, true, true, true, Transformation.CENTER);
        var bounds = copia.geometricBounds;
        copia.translate(x(pose[0] + pose[2] / 2) - (bounds[0] + bounds[2]) / 2,
          y(pose[1] + pose[3] / 2) - (bounds[1] + bounds[3]) / 2);
        if (t.compartilhado && adicional) {
          var grupo = arte.groupItems.add();
          copia.move(grupo, ElementPlacement.PLACEATEND);
          var corte = ret(grupo, [
            Math.abs(pose[0] - t.trim[0]) < 0.0001 ? pose[0] - adicional : pose[0],
            Math.abs(pose[1] - t.trim[1]) < 0.0001 ? pose[1] - adicional : pose[1],
            Math.abs(pose[0] + pose[2] - t.trim[2]) < 0.0001 ? pose[0] + pose[2] + adicional : pose[0] + pose[2],
            Math.abs(pose[1] + pose[3] - t.trim[3]) < 0.0001 ? pose[1] + pose[3] + adicional : pose[1] + pose[3]
          ]);
          corte.filled = false;
          corte.stroked = false;
          corte.clipping = true;
          corte.zOrder(ZOrderMethod.BRINGTOFRONT);
          grupo.clipped = true;
        }
      }
      fonte.remove();
    }

    if (!arquivo) {
      var guias = doc.layers[0];
      guias.name = 'Folha · Guias de montagem';
      guias.printable = false;
      var corCorte = new CMYKColor();
      var corSangria = new CMYKColor();
      corCorte.magenta = 100;
      corSangria.cyan = 100;
      var guia = function (b, folga, cor) {
        var path = ret(guias, [b[0] - folga, b[1] - folga, b[2] + folga, b[3] + folga]);
        path.filled = false;
        path.stroked = true;
        path.strokeWidth = 0.25;
        path.strokeColor = cor;
        if (folga) path.strokeDashes = [2, 2];
      };
      if (t.compartilhado && t.sangria) guia(t.trim, t.sangria, corSangria);
      for (var g = 0; g < itens.length; g++) {
        var item = itens[g], caixa = [item[0], item[1], item[0] + item[2], item[1] + item[3]];
        if (!t.compartilhado && t.sangria) guia(caixa, t.sangria, corSangria);
        guia(caixa, 0, corCorte);
      }
      guias.locked = true;
    }

    var camada = doc.layers.add();
    camada.name = 'Folha · Marcas técnicas';
    var registro = t.linhas.length || t.miras.length || t.os ? ibdCorRegistroFolha(doc) : null;
    function fio(path) {
      path.filled = false;
      path.stroked = true;
      path.strokeWidth = t.stroke;
      path.strokeColor = registro;
      path.strokeCap = StrokeCap.BUTTENDCAP;
    }
    function linha(b) {
      var path = camada.pathItems.add();
      path.setEntirePath([[x(b[0]), y(b[1])], [x(b[2]), y(b[3])]]);
      fio(path);
    }
    for (var l = 0; l < t.linhas.length; l++) linha(t.linhas[l]);
    for (var m = 0; m < t.miras.length; m++) {
      var mira = t.miras[m], mx = mira[0], my = mira[1], r = mira[2], d = r * 1.6;
      fio(camada.pathItems.ellipse(y(my - r), x(mx - r), 2 * r * pt, 2 * r * pt));
      linha([mx - d, my, mx + d, my]);
      linha([mx, my - d, mx, my + d]);
    }
    if (t.escala.length) {
      var barra = camada.groupItems.add();
      barra.name = 'Folha · Barra CMYK';
      for (var e = 0; e < t.escala.length; e++) {
        var b = t.escala[e], cmyk = new CMYKColor();
        cmyk.cyan = b[4]; cmyk.magenta = b[5]; cmyk.yellow = b[6]; cmyk.black = b[7];
        var patch = ret(barra, [b[0], b[1], b[0] + b[2], b[1] + b[3]]);
        patch.stroked = false;
        patch.filled = true;
        patch.fillColor = cmyk;
      }
    }

    var obs = '';
    if (t.os && identificacao) {
      var slug = camada.textFrames.add();
      slug.contents = identificacao;
      var atributos = slug.textRange.characterAttributes;
      atributos.size = 7;
      atributos.fillColor = registro;
      var maxW = (t.os[2] - t.os[0]) * pt, maxH = (t.os[3] - t.os[1]) * pt;
      while (atributos.size > 5 && (slug.width > maxW || slug.height > maxH)) atributos.size -= 0.5;
      if (slug.width <= maxW && slug.height <= maxH) {
        slug.left = x(t.os[0]);
        slug.top = y(t.os[1]);
      } else {
        slug.remove();
        obs = ' A identificação não coube no espaço disponível.';
      }
    }
    camada.locked = true;
    return 'OK' + obs;
  } catch (erro) {
    if (doc) try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (_) {}
    return 'ERRO: ' + erro.message;
  } finally {
    if (prefs) {
      try { prefs.pDFCropToBox = caixaPDF; prefs.pageToOpen = paginaPDF; } catch (_) {}
    }
    if (sistema !== undefined) app.coordinateSystem = sistema;
  }
}
