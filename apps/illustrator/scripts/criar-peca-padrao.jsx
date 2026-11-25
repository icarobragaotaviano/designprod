/**
 * @ibd-id illustrator/criar-peca-padrao
 * @ibd-titulo Criar peça gráfica padrão
 * @ibd-descricao Cria documento, prancheta ou molde vetorial nas medidas das peças mais comuns (cartão 90×50, panfletos 140×100, 140×200, 100×150, A4, A5, tags, etiquetas e outras).
 * @ibd-app illustrator
 * @ibd-versao 1.0.0
 * @ibd-tags peca, cartao, panfleto, folder, etiqueta, prancheta, documento
 */
#target illustrator

#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-prefs.jsx"
#include "../../../core/extendscript/ibd-formatos.jsx"

(function () {
  var ID = 'illustrator/criar-peca-padrao';
  IBD.exigirHost(['illustrator']);

  var MM_TO_PT = 72 / 25.4;
  var salvas = IBD.prefs.ler(ID);
  var PECAS = IBD.formatos.PECAS;
  var opcoesPecas = IBD.formatos.rotulos(PECAS);
  var temDoc = app.documents.length > 0;

  var acoes = temDoc
    ? ['Novo documento', 'Nova prancheta no documento aberto', 'Redimensionar prancheta ativa', 'Desenhar molde na prancheta ativa']
    : ['Novo documento'];

  var atalhos = [
    { rotulo: '90x50', valor: PECAS[0].rotulo },
    { rotulo: '140x100', valor: PECAS[1].rotulo },
    { rotulo: '140x200', valor: PECAS[3].rotulo },
    { rotulo: '100x150', valor: PECAS[4].rotulo },
    { rotulo: 'A4', valor: PECAS[6].rotulo },
    { rotulo: 'A5', valor: PECAS[7].rotulo }
  ];

  var opcoes = IBD.ui.formulario('Criar peça gráfica padrão', [
    {
      id: 'previa',
      tipo: 'preview',
      grupo: 'Prévia da peça',
      largura: 580,
      altura: 96,
      legenda: function (v) {
        var f = IBD.formatos.porRotulo(PECAS, v.formato);
        var dim = IBD.formatos.aplicarOrientacao(f, v.orientacao);
        var s = Math.max(0, Number(v.sangriaMm) || 0);
        var m = Math.max(0, Number(v.margemMm) || 0);
        return f.curto + ': ' + dim.w + ' × ' + dim.h + ' mm' +
          (s > 0 ? ' · sangria ' + s + ' mm' : '') +
          (m > 0 ? ' · margem ' + m + ' mm' : '') +
          ' · ' + (v.acao || acoes[0]);
      },
      desenhar: function (g, w, h, v, d) {
        var f = IBD.formatos.porRotulo(PECAS, v.formato);
        var dim = IBD.formatos.aplicarOrientacao(f, v.orientacao);
        var s = Math.max(0, Number(v.sangriaMm) || 0);
        var m = Math.max(0, Number(v.margemMm) || 0);
        var totW = dim.w + 2 * s;
        var totH = dim.h + 2 * s;
        var esc = Math.min((w - 56) / Math.max(totW, 1), (h - 22) / Math.max(totH, 1));
        var pw = Math.max(18, dim.w * esc);
        var ph = Math.max(14, dim.h * esc);
        var bx = (w - pw) / 2;
        var by = (h - ph) / 2;
        if (s > 0) {
          var sp = s * esc;
          d.retangulo(g, bx - sp, by - sp, pw + 2 * sp, ph + 2 * sp, null, d.cor(236, 72, 153, 1), 1);
        }
        d.retangulo(g, bx, by, pw, ph, d.cor(44, 40, 30, 1), d.cor(240, 196, 25, 1), 1.5);
        if (m > 0 && 2 * m < dim.w && 2 * m < dim.h) {
          var mp = m * esc;
          var corG = d.cor(0, 195, 255, 1);
          d.tracejado(g, bx + mp, by + mp, bx + pw - mp, by + mp, corG, 1, 4);
          d.tracejado(g, bx + pw - mp, by + mp, bx + pw - mp, by + ph - mp, corG, 1, 4);
          d.tracejado(g, bx + pw - mp, by + ph - mp, bx + mp, by + ph - mp, corG, 1, 4);
          d.tracejado(g, bx + mp, by + ph - mp, bx + mp, by + mp, corG, 1, 4);
        }
        d.texto(g, dim.w + ' x ' + dim.h + ' mm', bx + 6, by + 4, d.cor(240, 196, 25, 1), 10, true);
      }
    },
    {
      id: 'formato',
      rotulo: 'Peça gráfica',
      grupo: 'Medida da peça',
      tipo: 'escolha',
      opcoes: opcoesPecas,
      presets: atalhos,
      padrao: salvas.formato || PECAS[0].rotulo
    },
    {
      id: 'orientacao',
      rotulo: 'Orientação',
      grupo: 'Medida da peça',
      tipo: 'escolha',
      opcoes: ['Padrão do formato', 'Retrato (vertical)', 'Paisagem (horizontal)'],
      presets: ['Retrato (vertical)', 'Paisagem (horizontal)'],
      padrao: salvas.orientacao || 'Padrão do formato'
    },
    {
      id: 'acao',
      rotulo: 'Onde criar',
      grupo: 'Destino e cor',
      tipo: 'escolha',
      opcoes: acoes,
      padrao: (temDoc && salvas.acao && acoes.indexOf(salvas.acao) > -1) ? salvas.acao : acoes[0]
    },
    {
      id: 'modoCor',
      rotulo: 'Modo de cor (novo doc)',
      grupo: 'Destino e cor',
      tipo: 'escolha',
      opcoes: ['CMYK', 'RGB'],
      presets: ['CMYK', 'RGB'],
      padrao: salvas.modoCor || 'CMYK'
    },
    {
      id: 'sangriaMm',
      rotulo: 'Sangria (mm)',
      grupo: 'Acabamento',
      tipo: 'numero',
      presets: [0, 2, 3, 5],
      padrao: salvas.sangriaMm === undefined ? 3 : salvas.sangriaMm
    },
    {
      id: 'margemMm',
      rotulo: 'Margem de segurança (mm)',
      grupo: 'Acabamento',
      tipo: 'numero',
      presets: [0, 3, 5, 8],
      padrao: salvas.margemMm === undefined ? 5 : salvas.margemMm
    }
  ], 'Criar peça', {
    subtitulo: 'Cartão 90×50, panfletos 140×100 / 140×200 / 100×150, A4, A5, folders, etiquetas e mais'
  });

  if (!opcoes) return;
  IBD.prefs.gravar(ID, opcoes);

  var formato = IBD.formatos.porRotulo(PECAS, opcoes.formato);
  var dim = IBD.formatos.aplicarOrientacao(formato, opcoes.orientacao);
  var wPt = dim.w * MM_TO_PT;
  var hPt = dim.h * MM_TO_PT;
  var sangriaMm = Math.max(0, Number(opcoes.sangriaMm) || 0);
  var margemMm = Math.max(0, Number(opcoes.margemMm) || 0);
  var nomePeca = formato.curto + ' ' + dim.w + 'x' + dim.h + 'mm';

  var doc;
  var rectAlvo;

  if (opcoes.acao === 'Desenhar molde na prancheta ativa' && app.documents.length) {
    doc = app.activeDocument;
    var coordAntes = app.coordinateSystem;
    try {
      app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
      var idx = doc.artboards.getActiveArtboardIndex();
      var ar = doc.artboards[idx].artboardRect;
      var cx = (ar[0] + ar[2]) / 2;
      var cy = (ar[1] + ar[3]) / 2;
      var left = cx - wPt / 2;
      var top = cy + hPt / 2;
      var camada = doc.activeLayer;
      if (camada.locked || !camada.visible) camada = obterOuCriarCamada(doc, '01_PECAS');
      camada.locked = false;
      camada.visible = true;
      var ret = camada.pathItems.rectangle(top, left, wPt, hPt);
      ret.name = nomePeca;
      ret.filled = false;
      ret.stroked = true;
      ret.strokeWidth = 0.5;
      if (doc.documentColorSpace === DocumentColorSpace.RGB) {
        var rgb = new RGBColor(); rgb.red = 230; rgb.green = 0; rgb.blue = 126;
        ret.strokeColor = rgb;
      } else {
        var cmyk = new CMYKColor(); cmyk.cyan = 0; cmyk.magenta = 100; cmyk.yellow = 0; cmyk.black = 0;
        ret.strokeColor = cmyk;
      }
      rectAlvo = [left, top, left + wPt, top - hPt];
      if (margemMm > 0 || sangriaMm > 0) {
        adicionarGuias(doc, rectAlvo, margemMm * MM_TO_PT, sangriaMm * MM_TO_PT);
      }
      doc.selection = [ret];
    } finally {
      try { app.coordinateSystem = coordAntes; } catch (eC) {}
    }
    return;
  }

  if (opcoes.acao === 'Novo documento' || !app.documents.length) {
    var preset = new DocumentPreset();
    preset.width = wPt;
    preset.height = hPt;
    preset.units = RulerUnits.Millimeters;
    preset.colorMode = opcoes.modoCor === 'RGB' ? DocumentColorSpace.RGB : DocumentColorSpace.CMYK;
    try { preset.title = nomePeca; } catch (eTit) {}
    try {
      if (sangriaMm > 0) {
        var bPt = sangriaMm * MM_TO_PT;
        preset.documentBleedOffset = [bPt, bPt, bPt, bPt];
      }
    } catch (eBleed) {}
    doc = app.documents.addDocument(preset.colorMode, preset);
    doc.artboards[0].name = nomePeca;
    rectAlvo = doc.artboards[0].artboardRect;
  } else if (opcoes.acao === 'Redimensionar prancheta ativa') {
    doc = app.activeDocument;
    var idxAtiva = doc.artboards.getActiveArtboardIndex();
    var rAnt = doc.artboards[idxAtiva].artboardRect;
    rectAlvo = [rAnt[0], rAnt[1], rAnt[0] + wPt, rAnt[1] - hPt];
    doc.artboards[idxAtiva].artboardRect = rectAlvo;
    doc.artboards[idxAtiva].name = nomePeca;
  } else {
    doc = app.activeDocument;
    var maxR = -Infinity;
    var topRef = 0;
    for (var i = 0; i < doc.artboards.length; i++) {
      var arb = doc.artboards[i].artboardRect;
      if (arb[2] > maxR) {
        maxR = arb[2];
        topRef = arb[1];
      }
    }
    var gapPt = 15 * MM_TO_PT;
    var leftN = isFinite(maxR) ? (maxR + gapPt) : 0;
    rectAlvo = [leftN, topRef, leftN + wPt, topRef - hPt];
    var nova = doc.artboards.add(rectAlvo);
    nova.name = nomePeca;
    doc.artboards.setActiveArtboardIndex(doc.artboards.length - 1);
  }

  if (margemMm > 0 || (sangriaMm > 0 && opcoes.acao !== 'Novo documento')) {
    adicionarGuias(doc, rectAlvo, margemMm * MM_TO_PT, (opcoes.acao !== 'Novo documento' ? sangriaMm * MM_TO_PT : 0));
  }

  function adicionarGuias(documento, rect, margemPt, sangriaPt) {
    var coordAntes = app.coordinateSystem;
    var camadaAntes = documento.activeLayer;
    var camada = obterOuCriarCamada(documento, '06_GUIAS');
    var travadaAntes = camada.locked;
    try {
      app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
      camada.locked = false;
      camada.visible = true;
      var l = rect[0], t = rect[1], r = rect[2], b = rect[3];
      var w = r - l, h = t - b;
      if (margemPt > 0 && (2 * margemPt) < w && (2 * margemPt) < h) {
        var gIn = camada.pathItems.rectangle(t - margemPt, l + margemPt, w - 2 * margemPt, h - 2 * margemPt);
        gIn.filled = false; gIn.stroked = false; gIn.guides = true;
      }
      if (sangriaPt > 0) {
        var gOut = camada.pathItems.rectangle(t + sangriaPt, l - sangriaPt, w + 2 * sangriaPt, h + 2 * sangriaPt);
        gOut.filled = false; gOut.stroked = false; gOut.guides = true;
      }
    } finally {
      try { camada.locked = travadaAntes; } catch (e1) {}
      try { documento.activeLayer = camadaAntes; } catch (e2) {}
      try { app.coordinateSystem = coordAntes; } catch (e3) {}
    }
  }

  function obterOuCriarCamada(documento, nome) {
    for (var i = 0; i < documento.layers.length; i++) {
      if (documento.layers[i].name === nome) return documento.layers[i];
    }
    var nova = documento.layers.add();
    nova.name = nome;
    return nova;
  }
})();
