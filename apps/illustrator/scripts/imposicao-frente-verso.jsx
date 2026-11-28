/**
 * @ibd-id illustrator/imposicao-frente-verso
 * @ibd-titulo Imposição frente e verso
 * @ibd-descricao Repete pares de pranchetas em uma grade alinhada, com virada lateral ou pelo topo e marcas de refilo.
 * @ibd-app illustrator
 * @ibd-versao 1.0.0
 * @ibd-tags imposição, livreto, frente e verso, dobra, sangria, refilo
 * @ibd-doc docs/folha/README.md
 */
#target illustrator
#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-preimpressao.jsx"
#include "../../../core/extendscript/ibd-editorial.jsx"
#include "../../../nobel/imposicao/grade.js"
#include "../../../core/extendscript/ibd-plano-imposicao.jsx"
#include "../../../core/extendscript/ibd-imposicao-arte.jsx"

IBDPP.executar('Imposição frente e verso',function () {
  IBDImposicaoArte.abrir('Imposição frente e verso',false);
});
