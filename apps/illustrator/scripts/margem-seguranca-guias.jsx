/**
 * @ibd-id illustrator/margem-seguranca-guias
 * @ibd-titulo Criar margem de segurança interna (guias)
 * @ibd-descricao Cria retângulos-guia internos na camada 06_GUIAS com a distância escolhida (mm, cm, px, in ou pt) para dentro da prancheta ativa ou de todas.
 * @ibd-app illustrator
 * @ibd-versao 1.0.0
 * @ibd-tags guias, margem, seguranca, prancheta, acabamento
 * @ibd-doc docs/ferramentas-vetor.md
 */
#target illustrator

#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-prefs.jsx"

(function () {
  var ID = 'illustrator/margem-seguranca-guias';
  IBD.exigirHost(['illustrator']);

  if (!app.documents.length) {
    IBD.alerta('Abra um documento antes de rodar este script.');
    return;
  }

  var doc = app.activeDocument;
  var salvas = IBD.prefs.ler(ID);

  var FATORES_PREV = { mm: 72 / 25.4, cm: 720 / 25.4, pt: 1, px: 1 };
  var abRefW = 210, abRefH = 297;
  try {
    var abIdx0 = doc.artboards.getActiveArtboardIndex();
    var r0 = doc.artboards[abIdx0].artboardRect;
    abRefW = Math.abs(r0[2] - r0[0]) / FATORES_PREV.mm;
    abRefH = Math.abs(r0[1] - r0[3]) / FATORES_PREV.mm;
  } catch (eAb) {}

  var opcoes = IBD.ui.formulario('Criar margem de segurança interna', [
    {
      id: 'previa',
      tipo: 'preview',
      grupo: 'Prévia da prancheta',
      largura: 380,
      altura: 128,
      legenda: function (v) {
        var u = v.unidade || 'mm';
        var fat = FATORES_PREV[u] || FATORES_PREV.mm;
        var mMm = (Number(v.margem) * fat) / FATORES_PREV.mm;
        var livreL = abRefW - 2 * mMm;
        var livreA = abRefH - 2 * mMm;
        if (isNaN(mMm) || mMm <= 0) return 'Informe uma margem maior que zero.';
        if (livreL <= 0 || livreA <= 0) return 'Aviso: a margem ultrapassa a prancheta (' + abRefW.toFixed(1) + ' x ' + abRefH.toFixed(1) + ' mm).';
        return 'Área segura: ' + livreL.toFixed(1) + ' × ' + livreA.toFixed(1) + ' mm (margem ' + v.margem + ' ' + u + ')';
      },
      desenhar: function (g, w, h, v, d) {
        var u = v.unidade || 'mm';
        var fat = FATORES_PREV[u] || FATORES_PREV.mm;
        var mMm = (Number(v.margem) * fat) / FATORES_PREV.mm;
        var escala = Math.min((w - 48) / Math.max(abRefW, 1), (h - 28) / Math.max(abRefH, 1));
        var bw = Math.max(20, abRefW * escala);
        var bh = Math.max(20, abRefH * escala);
        var bx = (w - bw) / 2;
        var by = (h - bh) / 2;
        d.retangulo(g, bx, by, bw, bh, d.cor(36, 40, 48, 1), d.cor(140, 152, 170, 1), 1.5);
        var ins = (isNaN(mMm) ? 0 : mMm) * escala;
        if (ins > 0 && 2 * ins < bw && 2 * ins < bh) {
          var corGuia = d.cor(0, 195, 255, 1);
          d.tracejado(g, bx + ins, by + ins, bx + bw - ins, by + ins, corGuia, 1.5, 5);
          d.tracejado(g, bx + bw - ins, by + ins, bx + bw - ins, by + bh - ins, corGuia, 1.5, 5);
          d.tracejado(g, bx + bw - ins, by + bh - ins, bx + ins, by + bh - ins, corGuia, 1.5, 5);
          d.tracejado(g, bx + ins, by + bh - ins, bx + ins, by + ins, corGuia, 1.5, 5);
          d.texto(g, v.margem + ' ' + u, bx + 4, by + 2, d.cor(240, 196, 25, 1), 9, true);
        } else {
          d.texto(g, 'Margem excede a prancheta', bx + 8, by + bh / 2 - 6, d.cor(242, 156, 166, 1), 10, true);
        }
      }
    },
    {
      id: 'margem',
      rotulo: 'Margem interna',
      grupo: 'Medidas e unidade',
      tipo: 'numero',
      padrao: salvas.margem === undefined ? 5 : salvas.margem,
      presets: [3, 5, 10, 15, 20],
      ajuda: 'Distância das bordas da prancheta para dentro (oposto da sangria).'
    },
    {
      id: 'unidade',
      rotulo: 'Unidade',
      grupo: 'Medidas e unidade',
      tipo: 'escolha',
      opcoes: ['mm', 'cm', 'pt', 'px'],
      presets: ['mm', 'cm', 'pt', 'px'],
      padrao: salvas.unidade || 'mm'
    },
    {
      id: 'todasPranchetas',
      rotulo: 'Aplicar em todas as pranchetas',
      grupo: 'Destino',
      tipo: 'booleano',
      padrao: !!salvas.todasPranchetas
    },
    {
      id: 'camada',
      rotulo: 'Camada de guias',
      grupo: 'Destino',
      tipo: 'texto',
      padrao: salvas.camada || '06_GUIAS'
    }
  ], 'Criar guias', {
    subtitulo: 'Prancheta ativa: ' + abRefW.toFixed(1) + ' × ' + abRefH.toFixed(1) + ' mm · camada de guias bloqueada',
    largura: 430
  });

  if (!opcoes) return;

  var FATORES_PT = {
    mm: 72 / 25.4,
    cm: 720 / 25.4,
    pt: 1,
    px: 1
  };
  var fator = FATORES_PT[opcoes.unidade] || FATORES_PT.mm;
  var margemPt = Number(opcoes.margem) * fator;

  if (!opcoes.margem || isNaN(margemPt) || margemPt <= 0) {
    IBD.alerta('Informe um valor numerico maior que zero para a margem interna.');
    return;
  }

  var nomeCamada = (opcoes.camada || '06_GUIAS').replace(/^\s+|\s+$/g, '') || '06_GUIAS';
  opcoes.camada = nomeCamada;
  IBD.prefs.gravar(ID, opcoes);

  var coordOriginal = app.coordinateSystem;
  var camadaOriginal = doc.activeLayer;
  var camadaGuias = obterOuCriarCamada(doc, nomeCamada);
  var bloqueadaAntes = camadaGuias.locked;

  var criadas = 0;
  var ignoradas = 0;

  try {
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    camadaGuias.locked = false;

    if (opcoes.todasPranchetas) {
      for (var i = 0; i < doc.artboards.length; i++) {
        if (adicionarGuiaMargem(camadaGuias, doc.artboards[i].artboardRect, margemPt)) {
          criadas++;
        } else {
          ignoradas++;
        }
      }
    } else {
      var ativa = doc.artboards.getActiveArtboardIndex();
      if (adicionarGuiaMargem(camadaGuias, doc.artboards[ativa].artboardRect, margemPt)) {
        criadas++;
      } else {
        ignoradas++;
      }
    }
  } finally {
    try { camadaGuias.locked = bloqueadaAntes; } catch (eLock) {}
    try { doc.activeLayer = camadaOriginal; } catch (eLayer) {}
    try { app.coordinateSystem = coordOriginal; } catch (eCoord) {}
  }

  if (criadas === 0) {
    IBD.alerta('A margem informada (' + opcoes.margem + ' ' + opcoes.unidade + ') excede a largura ou altura util da prancheta.');
    return;
  }

  if (ignoradas > 0) {
    IBD.ui.resumo('Margem de seguranca (guias)', [
      'Guias criadas em ' + criadas + ' prancheta(s) na camada "' + nomeCamada + '".',
      'Ignoradas: ' + ignoradas + ' prancheta(s) menores que o dobro da margem.'
    ]);
  }

  function obterOuCriarCamada(documento, nome) {
    for (var i = 0; i < documento.layers.length; i++) {
      if (documento.layers[i].name === nome) return documento.layers[i];
    }
    var nova = documento.layers.add();
    nova.name = nome;
    return nova;
  }

  function adicionarGuiaMargem(camada, rect, margem) {
    var left = rect[0];
    var top = rect[1];
    var right = rect[2];
    var bottom = rect[3];
    var largura = right - left;
    var altura = top - bottom;

    if ((2 * margem) >= largura || (2 * margem) >= altura) {
      return false;
    }

    var guia = camada.pathItems.rectangle(
      top - margem,
      left + margem,
      largura - (2 * margem),
      altura - (2 * margem)
    );
    guia.filled = false;
    guia.stroked = false;
    guia.guides = true;
    return true;
  }
})();
