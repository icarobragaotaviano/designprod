/**
 * @ibd-id illustrator/retangulo-prancheta
 * @ibd-titulo Retângulo da prancheta
 * @ibd-descricao Cria com um clique um retângulo editável, sem preenchimento e alinhado às quatro bordas da prancheta ativa.
 * @ibd-app illustrator
 * @ibd-versao 1.0.0
 * @ibd-tags retângulo, forma, prancheta, centralizar, corte, trimbox, gabarito
 * @ibd-doc docs/folha/README.md
 */
#target illustrator
#include "../../../core/extendscript/ibd-preimpressao.jsx"

IBDPP.executar('Retângulo da prancheta', function () {
  var d=IBDPP.doc(false);
  var a=d.artboards[d.artboards.getActiveArtboardIndex()];
  IBDPP.retanguloPrancheta(d,a.artboardRect,0,true);
});
