/**
 * @ibd-id illustrator/organizacao-documento
 * @ibd-titulo Organizar camadas e pranchetas
 * @ibd-descricao Separa textos, imagens incorporadas, vínculos e gráficos preservando o empilhamento. Renomeia camadas e pranchetas em lote.
 * @ibd-app illustrator
 * @ibd-versao 1.0.0
 * @ibd-tags organização, camadas, pranchetas, nomes, lote, texto, imagens, links, renomear
 * @ibd-doc docs/folha/README.md
 */
#target illustrator
#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-preimpressao.jsx"
#include "../../../core/extendscript/ibd-editorial.jsx"
#include "../../../core/extendscript/ibd-organizacao-ilustrador.jsx"

(function (p,e,o) {
  var titulo='Organizar camadas e pranchetas';
  var modos=['Separar objetos por tipo','Renomear camadas','Renomear pranchetas','Renomear camadas e pranchetas'];
  var caixas=['Preservar','MAIÚSCULAS','minúsculas'];
  try {
    var d=p.doc(false);
    var v=IBD.ui.formulario(titulo,[
      e.escolha('modo','Operação',modos,null,'Ação'),
      e.campo('camadas','Modelo de camadas','{n} · {nome}','Nomes em lote'),
      e.campo('pranchetas','Modelo de pranchetas','Prancheta {n} · {largura}x{altura} mm','Nomes em lote'),
      e.campo('digitos','Dígitos de {n}','2','Nomes em lote'),
      e.escolha('caixa','Capitalização',caixas,null,'Nomes em lote'),
      e.simNao('sublayers','Incluir subcamadas nos novos nomes',true,'Nomes em lote'),
      e.simNao('espacos','Trocar espaços por sublinhados',false,'Nomes em lote')
    ],'Continuar',{largura:715,rotuloLargura:165,
      subtitulo:'Use {n} e {nome} nos dois modelos. Em pranchetas, {largura} e {altura} inserem as medidas em mm.'});
    if(!v)return;
    if(v.modo===modos[0]){
      var plano=o.separar(d);
      if(!plano.planos.length){
        IBD.ui.resumo(titulo,['Nenhuma camada editável a separar.','Camadas e ramos preservados: '+plano.preservadas]);
        return;
      }
      if(!confirm('Separar '+plano.objetos+' objeto(s) em '+plano.grupos+' subcamada(s)?\nMáscaras, grupos e ordem visual são preservados.'))return;
      o.aplicarSeparacao(d,plano.planos);
      IBD.ui.resumo(titulo,[plano.objetos+' objeto(s) em '+plano.grupos+' subcamada(s).',
        'Camadas e ramos preservados: '+plano.preservadas]);
      return;
    }
    var opcoes={camadas:v.camadas,pranchetas:v.pranchetas,digitos:p.num(v.digitos,'Dígitos',1,6,true),
      sublayers:v.sublayers,espacos:v.espacos,caixa:v.caixa===caixas[1] ? 1 : v.caixa===caixas[2] ? 2 : 0};
    var nomes=o.nomes(d,opcoes,v.modo!==modos[2],v.modo!==modos[1]);
    if(!nomes.length){IBD.ui.resumo(titulo,['Os nomes já seguem o modelo escolhido.']);return;}
    var exemplos=[];
    for(var i=0;i<Math.min(nomes.length,4);i++) exemplos.push(nomes[i].antes+' → '+nomes[i].depois);
    if(!confirm('Aplicar '+nomes.length+' novo(s) nome(s)?\n\n'+exemplos.join('\n')))return;
    o.aplicarNomes(nomes);
    IBD.ui.resumo(titulo,[nomes.length+' novo(s) nome(s) aplicado(s).']);
  } catch (erro) { alert(erro.message); }
}(IBDPP,IBDEditorial,IBDOrganizacao));
