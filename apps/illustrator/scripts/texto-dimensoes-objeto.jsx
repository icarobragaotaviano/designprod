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
  if (!doc.selection || !doc.selection.length) {
    IBD.alerta('Selecione pelo menos um objeto para medir.');
    return;
  }

  var salvas = IBD.prefs.ler(ID);

  var opcoes = IBD.ui.formulario('Dimensoes do objeto selecionado', [
    {
      id: 'unidade',
      rotulo: 'Unidade de medida',
      tipo: 'escolha',
      opcoes: ['mm', 'cm', 'm', 'px', 'in', 'pt'],
      padrao: salvas.unidade || 'mm'
    },
    {
      id: 'decimais',
      rotulo: 'Casas decimais',
      tipo: 'numero',
      padrao: salvas.decimais === undefined ? 1 : salvas.decimais
    },
    {
      id: 'virgulaDecimal',
      rotulo: 'Usar virgula decimal (padrao PT-BR)',
      tipo: 'booleano',
      padrao: salvas.virgulaDecimal === undefined ? true : !!salvas.virgulaDecimal
    },
    {
      id: 'tamanhoFonte',
      rotulo: 'Tamanho da fonte (pt)',
      tipo: 'numero',
      padrao: salvas.tamanhoFonte === undefined ? 10 : salvas.tamanhoFonte
    },
    {
      id: 'posicao',
      rotulo: 'Posicao do texto',
      tipo: 'escolha',
      opcoes: ['Abaixo', 'Acima', 'Centro'],
      padrao: salvas.posicao || 'Abaixo'
    },
    {
      id: 'afastamentoMm',
      rotulo: 'Afastamento (mm)',
      tipo: 'numero',
      padrao: salvas.afastamentoMm === undefined ? 3 : salvas.afastamentoMm
    },
    {
      id: 'incluirTracado',
      rotulo: 'Incluir espessura do tracado (Visible Bounds)',
      tipo: 'booleano',
      padrao: salvas.incluirTracado === undefined ? true : !!salvas.incluirTracado
    },
    {
      id: 'camada',
      rotulo: 'Camada de destino',
      tipo: 'texto',
      padrao: salvas.camada || '01_TEXTOS'
    }
  ], 'Criar texto');

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
    in: 72,
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
      var bounds = opcoes.incluirTracado
        ? doc.selection[i].visibleBounds
        : doc.selection[i].geometricBounds;
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
      var fb = frame.visibleBounds || frame.geometricBounds;
      if (fb) {
        var fW = fb[2] - fb[0];
        var fH = fb[1] - fb[3];
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
