/**
 * @ibd-id illustrator/criar-papel-padrao
 * @ibd-titulo Criar documento ou prancheta em papel padrão
 * @ibd-descricao Cria novo documento, nova prancheta ou redimensiona a prancheta ativa nos papéis padrão Nobel (T9, T8, T4) e formatos gráficos/ISO (A4, A5, A3, SRA3 e outros).
 * @ibd-app illustrator
 * @ibd-versao 1.0.0
 * @ibd-tags papel, nobel, prancheta, documento, formato, a4, a5, t4, t8, t9
 */
#target illustrator

#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-prefs.jsx"
#include "../../../core/extendscript/ibd-formatos.jsx"

(function () {
  var ID = 'illustrator/criar-papel-padrao';
  IBD.exigirHost(['illustrator']);

  var MM_TO_PT = 72 / 25.4;
  var salvas = IBD.prefs.ler(ID);
  var PAPEIS = IBD.formatos.PAPEIS;
  var opcoesPapeis = IBD.formatos.rotulos(PAPEIS);
  var temDoc = app.documents.length > 0;

  var acoes = temDoc
    ? ['Novo documento', 'Nova prancheta no documento aberto', 'Redimensionar prancheta ativa']
    : ['Novo documento'];

  var atalhos = [
    { rotulo: 'T9', valor: PAPEIS[0].rotulo },
    { rotulo: 'T8', valor: PAPEIS[1].rotulo },
    { rotulo: 'T4', valor: PAPEIS[2].rotulo },
    { rotulo: 'A4', valor: PAPEIS[3].rotulo },
    { rotulo: 'A3', valor: PAPEIS[7].rotulo },
    { rotulo: 'SRA3', valor: PAPEIS[8].rotulo }
  ];

  var opcoes = IBD.ui.formulario('Criar papel padrão (Nobel e ISO)', [
    {
      id: 'previa',
      tipo: 'preview',
      grupo: 'Prévia do formato',
      largura: 580,
      altura: 96,
      legenda: function (v) {
        var f = IBD.formatos.porRotulo(PAPEIS, v.formato);
        var dim = IBD.formatos.aplicarOrientacao(f, v.orientacao);
        var s = Math.max(0, Number(v.sangriaMm) || 0);
        var m = Math.max(0, Number(v.margemMm) || 0);
        return f.curto + ': ' + dim.w + ' × ' + dim.h + ' mm' +
          (s > 0 ? ' · sangria ' + s + ' mm' : '') +
          (m > 0 ? ' · margem ' + m + ' mm' : '') +
          ' · ' + (v.acao || acoes[0]);
      },
      desenhar: function (g, w, h, v, d) {
        var f = IBD.formatos.porRotulo(PAPEIS, v.formato);
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
        d.retangulo(g, bx, by, pw, ph, d.cor(38, 44, 56, 1), d.cor(104, 168, 232, 1), 1.5);
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
      rotulo: 'Papel padrão',
      grupo: 'Formato do papel',
      tipo: 'escolha',
      opcoes: opcoesPapeis,
      presets: atalhos,
      padrao: salvas.formato || PAPEIS[2].rotulo
    },
    {
      id: 'orientacao',
      rotulo: 'Orientação',
      grupo: 'Formato do papel',
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
      grupo: 'Guias opcionais',
      tipo: 'numero',
      presets: [0, 2, 3, 5],
      padrao: salvas.sangriaMm === undefined ? 0 : salvas.sangriaMm
    },
    {
      id: 'margemMm',
      rotulo: 'Margem de segurança (mm)',
      grupo: 'Guias opcionais',
      tipo: 'numero',
      presets: [0, 3, 5, 10],
      padrao: salvas.margemMm === undefined ? 5 : salvas.margemMm
    }
  ], 'Criar papel', {
    subtitulo: 'Padrão Nobel (T9, T8, T4) primeiro + todos os formatos gráficos e ISO'
  });

  if (!opcoes) return;
  IBD.prefs.gravar(ID, opcoes);

  var formato = IBD.formatos.porRotulo(PAPEIS, opcoes.formato);
  var dim = IBD.formatos.aplicarOrientacao(formato, opcoes.orientacao);
  var wPt = dim.w * MM_TO_PT;
  var hPt = dim.h * MM_TO_PT;
  var sangriaMm = Math.max(0, Number(opcoes.sangriaMm) || 0);
  var margemMm = Math.max(0, Number(opcoes.margemMm) || 0);
  var nomePrancheta = formato.curto + ' ' + dim.w + 'x' + dim.h + 'mm';

  var doc;
  var rectAlvo;

  if (opcoes.acao === 'Novo documento' || !app.documents.length) {
    var preset = new DocumentPreset();
    preset.width = wPt;
    preset.height = hPt;
    preset.units = RulerUnits.Millimeters;
    preset.colorMode = opcoes.modoCor === 'RGB' ? DocumentColorSpace.RGB : DocumentColorSpace.CMYK;
    try { preset.title = nomePrancheta; } catch (eTit) {}
    try {
      if (sangriaMm > 0) {
        var bPt = sangriaMm * MM_TO_PT;
        preset.documentBleedOffset = [bPt, bPt, bPt, bPt];
      }
    } catch (eBleed) {}
    doc = app.documents.addDocument(preset.colorMode, preset);
    doc.artboards[0].name = nomePrancheta;
    rectAlvo = doc.artboards[0].artboardRect;
  } else if (opcoes.acao === 'Redimensionar prancheta ativa') {
    doc = app.activeDocument;
    var idxAtiva = doc.artboards.getActiveArtboardIndex();
    var rAnt = doc.artboards[idxAtiva].artboardRect;
    rectAlvo = [rAnt[0], rAnt[1], rAnt[0] + wPt, rAnt[1] - hPt];
    doc.artboards[idxAtiva].artboardRect = rectAlvo;
    doc.artboards[idxAtiva].name = nomePrancheta;
  } else {
    doc = app.activeDocument;
    var maxR = -Infinity;
    var topRef = 0;
    for (var i = 0; i < doc.artboards.length; i++) {
      var ar = doc.artboards[i].artboardRect;
      if (ar[2] > maxR) {
        maxR = ar[2];
        topRef = ar[1];
      }
    }
    var gapPt = 20 * MM_TO_PT;
    var leftN = isFinite(maxR) ? (maxR + gapPt) : 0;
    rectAlvo = [leftN, topRef, leftN + wPt, topRef - hPt];
    var nova = doc.artboards.add(rectAlvo);
    nova.name = nomePrancheta;
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
