/**
 * @ibd-id illustrator/imposicao-livretos
 * @ibd-titulo Imposição de livretos
 * @ibd-descricao Monta cadernos de grampo canoa com frente e verso, páginas em branco, sangria e marcas de refilo e dobra.
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

IBDPP.executar('Imposição de livretos',function () {
  IBDImposicaoArte.abrir('Imposição de livretos',true);
});
