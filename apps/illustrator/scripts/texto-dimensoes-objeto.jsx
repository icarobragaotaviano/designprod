/**
 * @ibd-id illustrator/texto-dimensoes-objeto
 * @ibd-titulo Cotar dimensões da seleção em texto
 * @ibd-descricao Calcula a caixa delimitadora dos objetos selecionados, converte para mm, cm, m, px, in ou pt e cria texto L × A na camada 01_TEXTOS.
 * @ibd-app illustrator
 * @ibd-versao 1.0.0
 * @ibd-tags dimensoes, medida, texto, cota, producao
 * @ibd-doc docs/ferramentas-vetor.md
 */
#target illustrator

#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-prefs.jsx"

(function () {
  var ID = 'illustrator/texto-dimensoes-objeto';
  IBD.exigirHost(['illustrator']);

  if (!app.documents.length) {
    IBD.alerta('Abra um documento e selecione pelo menos um objeto.');
    return;
  }

  var doc = app.activeDocument;
  if (!doc.selection || typeof doc.selection.length !== 'number' || !doc.selection.length || doc.selection.typename === 'TextRange') {
    IBD.alerta('Selecione pelo menos um objeto inteiro com a ferramenta Selecao (V) para medir.');
    return;
  }

  var salvas = IBD.prefs.ler(ID);

  var FATORES_PREV = { mm: 72 / 25.4, cm: 720 / 25.4, m: 72000 / 25.4, 'in': 72, px: 1, pt: 1 };

  function limitesObjeto(item, incluirTracado) {
    if (!item || item.hidden) return null;
    if (item.typename === 'PathItem' && item.guides) return null;
    if (item.typename === 'GroupItem' && item.clipped) {
      for (var j = 0; j < item.pageItems.length; j++) {
        var ch = item.pageItems[j];
        if (ch.typename === 'PathItem' && ch.clipping) return ch.geometricBounds;
        if (ch.typename === 'CompoundPathItem') {
          for (var k = 0; k < ch.pathItems.length; k++) {
            if (ch.pathItems[k].clipping) return ch.geometricBounds;
          }
        }
      }
    }
    return incluirTracado ? item.visibleBounds : item.geometricBounds;
  }

  var prevWPt = 283.46, prevHPt = 141.73;
  try {
    var pL = Infinity, pT = -Infinity, pR = -Infinity, pB = Infinity;
    for (var si = 0; si < doc.selection.length; si++) {
      var pb = limitesObjeto(doc.selection[si], true);
      if (!pb) continue;
      if (pb[0] < pL) pL = pb[0];
      if (pb[1] > pT) pT = pb[1];
      if (pb[2] > pR) pR = pb[2];
      if (pb[3] < pB) pB = pb[3];
    }
    if (isFinite(pL) && pR > pL && pT > pB) {
      prevWPt = pR - pL;
      prevHPt = pT - pB;
    }
  } catch (eSel) {}

  function formatarPrev(v) {
    var u = v.unidade || 'mm';
    var f = FATORES_PREV[u] || 1;
    var dec = Math.max(0, Math.min(4, Math.round(Number(v.decimais))));
    if (isNaN(dec)) dec = 1;
    var sw = (prevWPt / f).toFixed(dec);
    var sh = (prevHPt / f).toFixed(dec);
    if (v.virgulaDecimal) { sw = sw.replace('.', ','); sh = sh.replace('.', ','); }
    return sw + ' x ' + sh + ' ' + u;
  }

  var opcoes = IBD.ui.formulario('Cotar dimensões da seleção', [
    {
      id: 'previa',
      tipo: 'preview',
      grupo: 'Prévia do texto',
      largura: 390,
      altura: 118,
      legenda: function (v) {
        return 'Rótulo previsto: "' + formatarPrev(v) + '" · posição: ' + (v.posicao || 'Abaixo');
      },
      desenhar: function (g, w, h, v, d) {
        var boxW = Math.min(180, Math.max(70, w * 0.44));
        var boxH = Math.min(46, Math.max(26, boxW * (prevHPt / Math.max(prevWPt, 1))));
        var bx = (w - boxW) / 2;
        var by = (h - boxH) / 2;
        d.retangulo(g, bx, by, boxW, boxH, d.cor(42, 52, 68, 1), d.cor(104, 168, 232, 1), 1.5);
        var txt = formatarPrev(v);
        var pos = v.posicao || 'Abaixo';
        var tx = Math.max(12, w / 2 - txt.length * 3.1);
        var ty = pos === 'Acima' ? by - 16 : (pos === 'Centro' ? by + boxH / 2 - 6 : by + boxH + 6);
        d.texto(g, txt, tx, ty, d.cor(240, 196, 25, 1), 11, true);
      }
    },
    {
      id: 'unidade',
      rotulo: 'Unidade de medida',
      grupo: 'Formato da medida',
      tipo: 'escolha',
      opcoes: ['mm', 'cm', 'm', 'px', 'in', 'pt'],
      presets: ['mm', 'cm', 'm', 'px', 'in', 'pt'],
      padrao: salvas.unidade || 'mm'
    },
    {
      id: 'decimais',
      rotulo: 'Casas decimais',
      grupo: 'Formato da medida',
      tipo: 'numero',
      presets: [0, 1, 2],
      padrao: salvas.decimais === undefined ? 1 : salvas.decimais
    },
    {
      id: 'virgulaDecimal',
      rotulo: 'Usar virgula decimal (padrao PT-BR)',
      grupo: 'Formato da medida',
      tipo: 'booleano',
      padrao: salvas.virgulaDecimal === undefined ? true : !!salvas.virgulaDecimal
    },
    {
      id: 'tamanhoFonte',
      rotulo: 'Tamanho da fonte (pt)',
      grupo: 'Posição e estilo',
      tipo: 'numero',
      presets: [8, 10, 14, 18],
      padrao: salvas.tamanhoFonte === undefined ? 10 : salvas.tamanhoFonte
    },
    {
      id: 'posicao',
      rotulo: 'Posicao do texto',
      grupo: 'Posição e estilo',
      tipo: 'escolha',
      opcoes: ['Abaixo', 'Acima', 'Centro'],
      presets: ['Abaixo', 'Acima', 'Centro'],
      padrao: salvas.posicao || 'Abaixo'
    },
    {
      id: 'afastamentoMm',
      rotulo: 'Afastamento (mm)',
      grupo: 'Posição e estilo',
      tipo: 'numero',
      presets: [2, 3, 5, 8],
      padrao: salvas.afastamentoMm === undefined ? 3 : salvas.afastamentoMm
    },
    {
      id: 'incluirTracado',
      rotulo: 'Incluir espessura do tracado (Visible Bounds)',
      grupo: 'Posição e estilo',
      tipo: 'booleano',
      padrao: salvas.incluirTracado === undefined ? true : !!salvas.incluirTracado
    },
    {
      id: 'camada',
      rotulo: 'Camada de destino',
      grupo: 'Posição e estilo',
      tipo: 'texto',
      padrao: salvas.camada || '01_TEXTOS'
    }
  ], 'Criar texto', {
    subtitulo: doc.selection.length + ' objeto(s) selecionado(s) · gera texto editável',
    largura: 445
  });

  if (!opcoes) return;

  var decimais = Math.max(0, Math.min(4, Math.round(Number(opcoes.decimais))));
  if (isNaN(decimais)) decimais = 1;
  opcoes.decimais = decimais;

  var tamanhoPt = Number(opcoes.tamanhoFonte);
  if (isNaN(tamanhoPt) || tamanhoPt <= 0) {
    IBD.alerta('Informe um tamanho de fonte maior que zero.');
    return;
  }

  var afastamentoMm = Number(opcoes.afastamentoMm);
  if (isNaN(afastamentoMm) || afastamentoMm < 0) afastamentoMm = 3;
  opcoes.afastamentoMm = afastamentoMm;

  var nomeCamada = (opcoes.camada || '01_TEXTOS').replace(/^\s+|\s+$/g, '') || '01_TEXTOS';
  opcoes.camada = nomeCamada;
  IBD.prefs.gravar(ID, opcoes);

  var FATORES_PT = {
    mm: 72 / 25.4,
    cm: 720 / 25.4,
    m: 72000 / 25.4,
    'in': 72,
    px: 1,
    pt: 1
  };
  var MM_TO_PT = 72 / 25.4;

  var coordOriginal = app.coordinateSystem;
  var camadaOriginal = doc.activeLayer;
  var camadaTexto = obterOuCriarCamada(doc, nomeCamada);
  var bloqueadaAntes = camadaTexto.locked;

  try {
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;

    var minL = Infinity;
    var maxT = -Infinity;
    var maxR = -Infinity;
    var minB = Infinity;
    var i;

    for (i = 0; i < doc.selection.length; i++) {
      var bounds = limitesObjeto(doc.selection[i], opcoes.incluirTracado);
      if (!bounds) continue;
      if (bounds[0] < minL) minL = bounds[0];
      if (bounds[1] > maxT) maxT = bounds[1];
      if (bounds[2] > maxR) maxR = bounds[2];
      if (bounds[3] < minB) minB = bounds[3];
    }

    if (!isFinite(minL)) {
      IBD.alerta('Nao foi possivel ler os limites dos objetos selecionados.');
      return;
    }

    var fator = FATORES_PT[opcoes.unidade] || 1;
    var larguraFormatada = formatarMedida((maxR - minL) / fator, decimais, opcoes.virgulaDecimal);
    var alturaFormatada = formatarMedida((maxT - minB) / fator, decimais, opcoes.virgulaDecimal);
    var rotulo = larguraFormatada + ' x ' + alturaFormatada + ' ' + opcoes.unidade;

    camadaTexto.locked = false;
    camadaTexto.visible = true;
    var centroX = (minL + maxR) / 2;
    var afastamentoPt = afastamentoMm * MM_TO_PT;
    var posY = minB - afastamentoPt - tamanhoPt;
    if (opcoes.posicao === 'Acima') {
      posY = maxT + afastamentoPt;
    } else if (opcoes.posicao === 'Centro') {
      posY = (maxT + minB) / 2;
    }

    var frame = camadaTexto.textFrames.pointText([centroX, posY]);
    frame.contents = rotulo;

    var range = frame.textRange;
    if (range && range.characterAttributes) {
      range.characterAttributes.size = tamanhoPt;
      var fonte = resolverFonte(['MyriadPro-Regular', 'ArialMT', 'Helvetica']);
      if (fonte) range.characterAttributes.textFont = fonte;
    }
    if (range && range.paragraphAttributes) {
      try { range.paragraphAttributes.justification = Justification.CENTER; } catch (eJust) {}
    }

    // Ajuste fino usando a caixa real do frame criado para alinhamento consistente
    try {
      try { app.redraw(); } catch (eRedraw) {}
      var fb = frame.visibleBounds || frame.geometricBounds;
      if (fb && (fb[2] > fb[0] || fb[1] > fb[3])) {
        var fCx = (fb[0] + fb[2]) / 2;
        var fCy = (fb[1] + fb[3]) / 2;
        var dx = centroX - fCx;
        var dy = 0;
        if (opcoes.posicao === 'Abaixo') {
          dy = (minB - afastamentoPt) - fb[1];
        } else if (opcoes.posicao === 'Acima') {
          dy = (maxT + afastamentoPt) - fb[3];
        } else {
          dy = ((maxT + minB) / 2) - fCy;
        }
        frame.translate(dx, dy);
      }
    } catch (eAdj) {}
  } finally {
    try { camadaTexto.locked = bloqueadaAntes; } catch (eLock) {}
    try { doc.activeLayer = camadaOriginal; } catch (eLayer) {}
    try { app.coordinateSystem = coordOriginal; } catch (eCoord) {}
  }

  function formatarMedida(valor, casas, usarVirgula) {
    var txt = Number(valor).toFixed(casas);
    return usarVirgula ? txt.replace('.', ',') : txt;
  }

  function resolverFonte(candidatas) {
    for (var i = 0; i < candidatas.length; i++) {
      try { return app.textFonts.getByName(candidatas[i]); } catch (e) {}
    }
    try {
      return app.textFonts && app.textFonts.length ? app.textFonts[0] : null;
    } catch (eFallback) {
      return null;
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
