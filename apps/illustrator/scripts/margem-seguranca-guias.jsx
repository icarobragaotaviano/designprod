/**
 * @ibd-id illustrator/margem-seguranca-guias
 * @ibd-titulo Margem de seguranca (guias)
 * @ibd-descricao Cria guias internas de margem de seguranca a partir das bordas da prancheta ativa ou de todas as pranchetas, na unidade escolhida.
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

  var opcoes = IBD.ui.formulario('Margem de seguranca (guias)', [
    {
      id: 'margem',
      rotulo: 'Margem interna',
      tipo: 'numero',
      padrao: salvas.margem === undefined ? 5 : salvas.margem,
      ajuda: 'Distancia das bordas da prancheta para dentro (oposto da sangria).'
    },
    {
      id: 'unidade',
      rotulo: 'Unidade',
      tipo: 'escolha',
      opcoes: ['mm', 'cm', 'pt', 'px'],
      padrao: salvas.unidade || 'mm'
    },
    {
      id: 'todasPranchetas',
      rotulo: 'Aplicar em todas as pranchetas',
      tipo: 'booleano',
      padrao: !!salvas.todasPranchetas
    },
    {
      id: 'camada',
      rotulo: 'Camada de guias',
      tipo: 'texto',
      padrao: salvas.camada || '06_GUIAS'
    }
  ], 'Criar guias');

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
