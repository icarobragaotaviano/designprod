/**
 * @ibd-id illustrator/deslocamento-expandir-contorno
 * @ibd-titulo Gerar contorno deslocado e expandido
 * @ibd-descricao Aplica Offset Path XML (positivo ou negativo), expande aparência, unifica com Pathfinder opcional, limpa preenchimento e aplica traço CMYK ou RGB.
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

  function corRgbaPreview(preset) {
    if (!preset) return [236 / 255, 72 / 255, 153 / 255, 1];
    if (preset.indexOf('Vermelho') === 0) return [235 / 255, 58 / 255, 58 / 255, 1];
    if (preset.indexOf('Ciano') === 0) return [0 / 255, 188 / 255, 242 / 255, 1];
    if (preset.indexOf('Preto') === 0) return [215 / 255, 220 / 255, 230 / 255, 1];
    if (preset.indexOf('Personalizado') === 0) return [240 / 255, 196 / 255, 25 / 255, 1];
    return [236 / 255, 72 / 255, 153 / 255, 1];
  }

  var opcoes = IBD.ui.formulario('Gerar contorno deslocado e expandido', [
    {
      id: 'previa',
      tipo: 'preview',
      grupo: 'Prévia do deslocamento',
      largura: 390,
      altura: 122,
      legenda: function (v) {
        var off = Number(v.deslocamentoMm);
        var sinal = (!isNaN(off) && off > 0) ? '+' : '';
        return 'Offset ' + (isNaN(off) ? '?' : sinal + off) + ' mm · ' + (v.cantos || 'Mitra') + ' · traço ' + (v.espessuraPt || 1) + ' pt';
      },
      desenhar: function (g, w, h, v, d) {
        var bw = 116, bh = 54;
        var bx = (w - bw) / 2, by = (h - bh) / 2;
        d.retangulo(g, bx, by, bw, bh, d.cor(38, 44, 56, 1), d.cor(120, 130, 150, 1), 1);
        var off = Number(v.deslocamentoMm);
        if (isNaN(off)) off = 2;
        var px = Math.max(-18, Math.min(22, off * 4));
        var ew = Math.max(20, bw + 2 * px);
        var eh = Math.max(12, bh + 2 * px);
        var ex = (w - ew) / 2, ey = (h - eh) / 2;
        var esp = Math.max(1, Math.min(4, Number(v.espessuraPt) || 1));
        var col = corRgbaPreview(v.corPreset);
        if (v.cantos === 'Arredondado') {
          d.circulo(g, ex, ey, ew, eh, null, col, esp);
        } else {
          d.retangulo(g, ex, ey, ew, eh, null, col, esp);
        }
      }
    },
    {
      id: 'deslocamentoMm',
      rotulo: 'Deslocamento (mm)',
      grupo: 'Deslocamento e cantos',
      tipo: 'numero',
      presets: [-3, -2, 2, 3, 5],
      padrao: salvas.deslocamentoMm === undefined ? 2 : salvas.deslocamentoMm,
      ajuda: 'Positivo expande para fora; negativo retrai para dentro.'
    },
    {
      id: 'cantos',
      rotulo: 'Cantos (Join)',
      grupo: 'Deslocamento e cantos',
      tipo: 'escolha',
      opcoes: ['Mitra (reto)', 'Arredondado', 'Chanfrado'],
      presets: ['Mitra (reto)', 'Arredondado', 'Chanfrado'],
      padrao: salvas.cantos || 'Mitra (reto)'
    },
    {
      id: 'limiteMitra',
      rotulo: 'Limite de mitra',
      grupo: 'Deslocamento e cantos',
      tipo: 'numero',
      padrao: salvas.limiteMitra === undefined ? 4 : salvas.limiteMitra
    },
    {
      id: 'espessuraPt',
      rotulo: 'Espessura contorno (pt)',
      grupo: 'Traço e cor',
      tipo: 'numero',
      presets: [0.5, 1, 1.5, 2],
      padrao: salvas.espessuraPt === undefined ? 1 : salvas.espessuraPt
    },
    {
      id: 'corPreset',
      rotulo: 'Cor do contorno',
      grupo: 'Traço e cor',
      tipo: 'escolha',
      opcoes: [
        'Magenta corte (0,100,0,0)',
        'Vermelho (0,100,100,0)',
        'Ciano (100,0,0,0)',
        'Preto (0,0,0,100)',
        'Personalizado (CMYK)'
      ],
      cores: [
        { curto: 'Magenta', valor: 'Magenta corte (0,100,0,0)', rgb: [230, 0, 126] },
        { curto: 'Vermelho', valor: 'Vermelho (0,100,100,0)', rgb: [220, 30, 30] },
        { curto: 'Ciano', valor: 'Ciano (100,0,0,0)', rgb: [0, 160, 230] },
        { curto: 'Preto', valor: 'Preto (0,0,0,100)', rgb: [30, 30, 35] }
      ],
      padrao: salvas.corPreset || 'Magenta corte (0,100,0,0)'
    },
    {
      id: 'cmykCustom',
      rotulo: 'CMYK custom (C,M,Y,K)',
      grupo: 'Traço e cor',
      tipo: 'texto',
      padrao: salvas.cmykCustom || '0, 100, 100, 0'
    },
    {
      id: 'manterOriginal',
      rotulo: 'Duplicar antes de aplicar (manter original)',
      grupo: 'Comportamento',
      tipo: 'booleano',
      padrao: salvas.manterOriginal === undefined ? true : !!salvas.manterOriginal
    },
    {
      id: 'unificar',
      rotulo: 'Unificar formas resultantes (Pathfinder Add)',
      grupo: 'Comportamento',
      tipo: 'booleano',
      padrao: !!salvas.unificar
    }
  ], 'Executar', {
    subtitulo: doc.selection.length + ' objeto(s) selecionado(s) · Offset Path XML + traço limpo',
    largura: 455
  });

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
