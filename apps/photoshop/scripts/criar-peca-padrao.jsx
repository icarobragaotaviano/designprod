/**
 * @ibd-id photoshop/criar-peca-padrao
 * @ibd-titulo Criar peça gráfica padrão
 * @ibd-descricao Cria novo documento ou ajusta a tela nas medidas das peças mais comuns (cartão 90×50, panfletos 140×100, 140×200, 100×150, A4, A5, tags, etiquetas e outras) com sangria e guias.
 * @ibd-app photoshop
 * @ibd-versao 1.0.0
 * @ibd-tags peca, cartao, panfleto, folder, etiqueta, documento, sangria
 */
#target photoshop

#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-prefs.jsx"
#include "../../../core/extendscript/ibd-formatos.jsx"

(function () {
  var ID = 'photoshop/criar-peca-padrao';
  IBD.exigirHost(['photoshop']);

  var salvas = IBD.prefs.ler(ID);
  var PECAS = IBD.formatos.PECAS;
  var opcoesPecas = IBD.formatos.rotulos(PECAS);
  var temDoc = app.documents.length > 0;
  var acoes = temDoc ? ['Novo documento', 'Redimensionar tela do documento aberto'] : ['Novo documento'];

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
        var dpi = Math.max(72, Number(v.dpi) || 300);
        var totW = dim.w + 2 * s;
        var totH = dim.h + 2 * s;
        var pxW = Math.round(totW * dpi / 25.4);
        var pxH = Math.round(totH * dpi / 25.4);
        return f.curto + ': ' + dim.w + ' × ' + dim.h + ' mm' +
          (s > 0 ? ' (+' + s + ' mm sangria)' : '') +
          ' · ' + pxW + ' × ' + pxH + ' px @ ' + dpi + ' dpi';
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
      grupo: 'Documento e cor',
      tipo: 'escolha',
      opcoes: acoes,
      padrao: (temDoc && salvas.acao && acoes.indexOf(salvas.acao) > -1) ? salvas.acao : acoes[0]
    },
    {
      id: 'dpi',
      rotulo: 'Resolução (DPI)',
      grupo: 'Documento e cor',
      tipo: 'numero',
      presets: [72, 150, 300, 600],
      padrao: salvas.dpi || 300
    },
    {
      id: 'modoCor',
      rotulo: 'Modo de cor',
      grupo: 'Documento e cor',
      tipo: 'escolha',
      opcoes: ['CMYK', 'RGB'],
      presets: ['CMYK', 'RGB'],
      padrao: salvas.modoCor || 'CMYK'
    },
    {
      id: 'fundo',
      rotulo: 'Fundo inicial',
      grupo: 'Documento e cor',
      tipo: 'escolha',
      opcoes: ['Branco', 'Transparente'],
      padrao: salvas.fundo || 'Branco'
    },
    {
      id: 'sangriaMm',
      rotulo: 'Sangria (mm)',
      grupo: 'Acabamento e guias',
      tipo: 'numero',
      presets: [0, 2, 3, 5],
      padrao: salvas.sangriaMm === undefined ? 3 : salvas.sangriaMm
    },
    {
      id: 'margemMm',
      rotulo: 'Margem de segurança (mm)',
      grupo: 'Acabamento e guias',
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
  var dpi = Math.max(36, Math.min(2400, Number(opcoes.dpi) || 300));
  var sangriaMm = Math.max(0, Number(opcoes.sangriaMm) || 0);
  var margemMm = Math.max(0, Number(opcoes.margemMm) || 0);
  var totW = dim.w + 2 * sangriaMm;
  var totH = dim.h + 2 * sangriaMm;

  var reguaAntes = app.preferences.rulerUnits;
  try {
    app.preferences.rulerUnits = Units.PIXELS;
    var doc;
    var resUsada = dpi;

    if (opcoes.acao === 'Redimensionar tela do documento aberto' && app.documents.length) {
      doc = app.activeDocument;
      resUsada = doc.resolution || dpi;
      var wPxR = Math.max(1, Math.round(totW * resUsada / 25.4));
      var hPxR = Math.max(1, Math.round(totH * resUsada / 25.4));
      doc.resizeCanvas(UnitValue(wPxR, 'px'), UnitValue(hPxR, 'px'), AnchorPosition.MIDDLECENTER);
    } else {
      var wPx = Math.max(1, Math.round(totW * dpi / 25.4));
      var hPx = Math.max(1, Math.round(totH * dpi / 25.4));
      var modo = opcoes.modoCor === 'RGB' ? NewDocumentMode.RGB : NewDocumentMode.CMYK;
      var fill = opcoes.fundo === 'Transparente' ? DocumentFill.TRANSPARENT : DocumentFill.WHITE;
      var nomeDoc = formato.curto + '_' + dim.w + 'x' + dim.h + 'mm';
      doc = app.documents.add(UnitValue(wPx, 'px'), UnitValue(hPx, 'px'), dpi, nomeDoc, modo, fill, 1, BitsPerChannelType.EIGHT);
    }

    var sPx = sangriaMm * resUsada / 25.4;
    var mPx = margemMm * resUsada / 25.4;
    var dW = doc.width.as('px');
    var dH = doc.height.as('px');

    if (sangriaMm > 0) {
      doc.guides.add(Direction.VERTICAL, UnitValue(sPx, 'px'));
      doc.guides.add(Direction.VERTICAL, UnitValue(dW - sPx, 'px'));
      doc.guides.add(Direction.HORIZONTAL, UnitValue(sPx, 'px'));
      doc.guides.add(Direction.HORIZONTAL, UnitValue(dH - sPx, 'px'));
    }
    if (margemMm > 0 && (2 * (sPx + mPx)) < dW && (2 * (sPx + mPx)) < dH) {
      doc.guides.add(Direction.VERTICAL, UnitValue(sPx + mPx, 'px'));
      doc.guides.add(Direction.VERTICAL, UnitValue(dW - sPx - mPx, 'px'));
      doc.guides.add(Direction.HORIZONTAL, UnitValue(sPx + mPx, 'px'));
      doc.guides.add(Direction.HORIZONTAL, UnitValue(dH - sPx - mPx, 'px'));
    }
  } finally {
    app.preferences.rulerUnits = reguaAntes;
  }
})();
