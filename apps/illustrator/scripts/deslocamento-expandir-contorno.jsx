/**
 * @ibd-id illustrator/deslocamento-expandir-contorno
 * @ibd-titulo Deslocamento, expandir e contorno
 * @ibd-descricao Aplica deslocamento (Offset Path) positivo ou negativo na selecao, expande a aparencia e converte em contorno tecnico sem preenchimento.
 * @ibd-app illustrator
 * @ibd-versao 1.0.0
 * @ibd-tags offset, deslocamento, contorno, faca, sangria, expand
 * @ibd-doc docs/ferramentas-vetor.md
 */
#target illustrator

#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-prefs.jsx"

(function () {
  var ID = 'illustrator/deslocamento-expandir-contorno';
  IBD.exigirHost(['illustrator']);

  if (!app.documents.length) {
    IBD.alerta('Abra um documento e selecione pelo menos um objeto.');
    return;
  }

  var doc = app.activeDocument;
  if (!doc.selection || !doc.selection.length) {
    IBD.alerta('Selecione pelo menos um caminho, forma ou grupo.');
    return;
  }

  var salvas = IBD.prefs.ler(ID);

  var opcoes = IBD.ui.formulario('Deslocamento + Expandir + Contorno', [
    {
      id: 'deslocamentoMm',
      rotulo: 'Deslocamento (mm)',
      tipo: 'numero',
      padrao: salvas.deslocamentoMm === undefined ? 2 : salvas.deslocamentoMm,
      ajuda: 'Positivo expande para fora; negativo retrai para dentro.'
    },
    {
      id: 'cantos',
      rotulo: 'Cantos (Join)',
      tipo: 'escolha',
      opcoes: ['Mitra (reto)', 'Arredondado', 'Chanfrado'],
      padrao: salvas.cantos || 'Mitra (reto)'
    },
    {
      id: 'limiteMitra',
      rotulo: 'Limite de mitra',
      tipo: 'numero',
      padrao: salvas.limiteMitra === undefined ? 4 : salvas.limiteMitra
    },
    {
      id: 'espessuraPt',
      rotulo: 'Espessura contorno (pt)',
      tipo: 'numero',
      padrao: salvas.espessuraPt === undefined ? 1 : salvas.espessuraPt
    },
    {
      id: 'corPreset',
      rotulo: 'Cor do contorno',
      tipo: 'escolha',
      opcoes: [
        'Magenta corte (0,100,0,0)',
        'Vermelho (0,100,100,0)',
        'Ciano (100,0,0,0)',
        'Preto (0,0,0,100)',
        'Personalizado (CMYK)'
      ],
      padrao: salvas.corPreset || 'Magenta corte (0,100,0,0)'
    },
    {
      id: 'cmykCustom',
      rotulo: 'CMYK custom (C,M,Y,K)',
      tipo: 'texto',
      padrao: salvas.cmykCustom || '0, 100, 100, 0'
    },
    {
      id: 'manterOriginal',
      rotulo: 'Duplicar antes de aplicar (manter original)',
      tipo: 'booleano',
      padrao: salvas.manterOriginal === undefined ? true : !!salvas.manterOriginal
    },
    {
      id: 'unificar',
      rotulo: 'Unificar formas resultantes (Pathfinder Add)',
      tipo: 'booleano',
      padrao: !!salvas.unificar
    }
  ], 'Executar');

  if (!opcoes) return;

  var offsetMm = Number(opcoes.deslocamentoMm);
  var limiteMitra = Number(opcoes.limiteMitra);
  var espessuraPt = Number(opcoes.espessuraPt);

  if (isNaN(offsetMm) || offsetMm === 0) {
    IBD.alerta('Informe um deslocamento diferente de zero (em mm).');
    return;
  }
  if (isNaN(limiteMitra) || limiteMitra < 1) limiteMitra = 4;
  if (isNaN(espessuraPt) || espessuraPt <= 0) {
    IBD.alerta('A espessura do contorno deve ser maior que zero.');
    return;
  }

  var cmyk = resolverCmyk(opcoes.corPreset, opcoes.cmykCustom);
  if (!cmyk) {
    IBD.alerta('Cor CMYK invalida. Use quatro valores entre 0 e 100 separados por virgula.');
    return;
  }

  opcoes.limiteMitra = limiteMitra;
  IBD.prefs.gravar(ID, opcoes);

  var MM_TO_PT = 72 / 25.4;
  var offsetPt = offsetMm * MM_TO_PT;
  var joinCode = opcoes.cantos === 'Arredondado' ? 0 : (opcoes.cantos === 'Chanfrado' ? 1 : 2);
  var corContorno = criarCorDocumento(doc, cmyk);

  var xmlEffect =
    '<LiveEffect name="Adobe Offset Path">' +
    '<Dict data="R mlim ' + limiteMitra.toFixed(3) + ' R ofst ' + offsetPt.toFixed(4) + ' I jntp ' + joinCode + ' "/>' +
    '</LiveEffect>';

  var interacaoOriginal = app.userInteractionLevel;
  var originais = [];
  var i;
  for (i = 0; i < doc.selection.length; i++) {
    originais.push(doc.selection[i]);
  }

  try {
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

    var alvos = [];
    for (i = 0; i < originais.length; i++) {
      var alvo = opcoes.manterOriginal
        ? originais[i].duplicate(originais[i], ElementPlacement.PLACEAFTER)
        : originais[i];
      alvos.push(alvo);
    }

    doc.selection = null;
    for (i = 0; i < alvos.length; i++) {
      limparPreenchimento(alvos[i]);
      alvos[i].selected = true;
      alvos[i].applyEffect(xmlEffect);
    }

    try { app.redraw(); } catch (eRedraw) {}
    app.executeMenuCommand('expandStyle');

    if (opcoes.unificar && doc.selection && doc.selection.length > 1) {
      app.executeMenuCommand('Live Pathfinder Add');
      try { app.redraw(); } catch (eRedraw2) {}
      app.executeMenuCommand('expandStyle');
    }

    if (doc.selection && doc.selection.length) {
      for (i = 0; i < doc.selection.length; i++) {
        aplicarContornoLimpo(doc.selection[i], espessuraPt, corContorno, joinCode, limiteMitra);
      }
    }
  } finally {
    try { app.userInteractionLevel = interacaoOriginal; } catch (eUi) {}
  }

  function resolverCmyk(preset, customStr) {
    if (preset.indexOf('Magenta') === 0) return [0, 100, 0, 0];
    if (preset.indexOf('Vermelho') === 0) return [0, 100, 100, 0];
    if (preset.indexOf('Ciano') === 0) return [100, 0, 0, 0];
    if (preset.indexOf('Preto') === 0) return [0, 0, 0, 100];

    var partes = String(customStr || '').replace(/;/g, ',').split(',');
    if (partes.length !== 4) return null;
    var vals = [];
    for (var p = 0; p < 4; p++) {
      var n = parseFloat(partes[p].replace(/^\s+|\s+$/g, ''));
      if (isNaN(n) || n < 0 || n > 100) return null;
      vals.push(n);
    }
    return vals;
  }

  function criarCorDocumento(documento, cmykArr) {
    var c = cmykArr[0], m = cmykArr[1], y = cmykArr[2], k = cmykArr[3];
    if (typeof DocumentColorSpace !== 'undefined' && documento.documentColorSpace === DocumentColorSpace.RGB) {
      var rgb = new RGBColor();
      rgb.red = Math.round(255 * (1 - c / 100) * (1 - k / 100));
      rgb.green = Math.round(255 * (1 - m / 100) * (1 - k / 100));
      rgb.blue = Math.round(255 * (1 - y / 100) * (1 - k / 100));
      return rgb;
    }
    var col = new CMYKColor();
    col.cyan = c;
    col.magenta = m;
    col.yellow = y;
    col.black = k;
    return col;
  }

  function limparPreenchimento(item) {
    if (!item) return;
    if (item.typename === 'PathItem') {
      item.filled = false;
    } else if (item.typename === 'CompoundPathItem') {
      for (var p = 0; p < item.pathItems.length; p++) {
        item.pathItems[p].filled = false;
      }
    } else if (item.typename === 'GroupItem') {
      for (var g = 0; g < item.pageItems.length; g++) {
        limparPreenchimento(item.pageItems[g]);
      }
    }
  }

  function aplicarContornoLimpo(item, larguraPt, cor, jCode, mlim) {
    if (!item) return;
    if (item.typename === 'PathItem') {
      item.filled = false;
      item.stroked = true;
      item.strokeWidth = larguraPt;
      item.strokeColor = cor;
      try {
        if (typeof StrokeJoin !== 'undefined') {
          item.strokeJoin = jCode === 0
            ? StrokeJoin.ROUNDENDJOIN
            : (jCode === 1 ? StrokeJoin.BEVELENDJOIN : StrokeJoin.MITERENDJOIN);
          if (jCode === 2) item.strokeMiterLimit = mlim;
        }
      } catch (eJoin) {}
    } else if (item.typename === 'CompoundPathItem') {
      for (var p = 0; p < item.pathItems.length; p++) {
        aplicarContornoLimpo(item.pathItems[p], larguraPt, cor, jCode, mlim);
      }
    } else if (item.typename === 'GroupItem') {
      for (var g = 0; g < item.pageItems.length; g++) {
        aplicarContornoLimpo(item.pageItems[g], larguraPt, cor, jCode, mlim);
      }
    }
  }
})();
