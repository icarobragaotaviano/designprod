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
