/**
 * @ibd-id illustrator/marcas-corte-vinco
 * @ibd-titulo Marcas externas de corte e vinco
 * @ibd-descricao Cria marcas de corte com afastamento paramétrico e testemunhas tracejadas de vinco fora da sangria, em prancheta de máquina.
 * @ibd-app illustrator
 * @ibd-versao 1.0.0
 * @ibd-tags corte, vinco, sangria, marcas, refile, guilhotina
 * @ibd-doc docs/folha/README.md
 */
#target illustrator
#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-preimpressao.jsx"

(function (p) {
  var titulo='Marcas externas de corte e vinco', pt=p.pt;
  var modos=['Corte','Corte e vinco','Somente vinco'];

  function posicoes(v,lim,rotulo) {
    if (!v) return [];
    var partes=v.split(';'), r=[];
    if (partes.length>50) throw Error('Informe no máximo 50 posições por eixo.');
    for (var i=0;i<partes.length;i++) {
      var n=p.num(partes[i],rotulo,0.1,lim-0.1);
      for (var j=0;j<r.length;j++) if (Math.abs(r[j]-n)<=0.1) throw Error('Separe as posições de vinco por mais de 0,1 mm.');
      r.push(n);
    }
    return r;
  }

  function montar(d, v) {
    var indice=d.artboards.getActiveArtboardIndex(), nome=d.artboards[indice].name;
    var a=d.artboards[indice].artboardRect;
    var w=(a[2]-a[0])/pt, h=(a[1]-a[3])/pt;
    var cortes=v.modo!==modos[2], vincos=v.modo!==modos[0];
    var xs=vincos ? posicoes(v.xs,w,'Posição X do vinco') : [];
    var ys=vincos ? posicoes(v.ys,h,'Posição Y do vinco') : [];
    if (vincos && !xs.length && !ys.length) throw Error('Informe ao menos uma posição de vinco.');
    var m=p.marcas(w,h,p.num(v.sangria,'Sangria da peça',0,30),p.num(v.offset,'Afastamento',3,5),
      p.num(v.comprimento,'Comprimento',2,15),cortes,xs,ys);
    var rect=p.sangria(a,m.expansao);
    var nomeSaida='FOLHA DE MÁQUINA · '+nome;
    for (var i=0;i<d.artboards.length;i++) {
      var outra=d.artboards[i];
      if (i!==indice && (outra.name===nomeSaida || p.recorte(rect,outra.artboardRect))) {
        throw Error('A folha expandida toca outra prancheta. Separe as pranchetas antes de gerar as marcas.');
      }
    }
    var camada=null, folha=null;
    try {
      folha=d.artboards.add(rect); folha.name=nomeSaida;
      camada=d.layers.add(); camada.name='Marcas · '+nome;
      var cor=p.preta(d);
      for (var j=0;j<m.segmentos.length;j++) {
        var s=m.segmentos[j];
        p.linha(camada,a,s,cor,0.35,s[4]).name=s[4] ? 'Vinco externo' : 'Marca de corte';
      }
      camada.locked=true;
      d.artboards.setActiveArtboardIndex(d.artboards.length-1);
      return m;
    } catch (e) {
      try { if(camada) {camada.locked=false;camada.remove();} } catch (_) {}
      try { if(folha) folha.remove(); } catch (_) {}
      throw e;
    }
  }

  p.executar(titulo,function () {
    var d=p.doc(false);
    var v=IBD.ui.formulario(titulo,[
      {id:'modo',rotulo:'Marcas',tipo:'escolha',opcoes:modos,padrao:modos[0],grupo:'Folha de máquina'},
      {id:'sangria',rotulo:'Sangria real (mm)',padrao:'3',grupo:'Folha de máquina'},
      {id:'offset',rotulo:'Afastamento (mm)',padrao:'4',grupo:'Folha de máquina'},
      {id:'comprimento',rotulo:'Comprimento (mm)',padrao:'5',grupo:'Folha de máquina'},
      {id:'xs',rotulo:'X · Vincos verticais',padrao:'',grupo:'Vincos em mm'},
      {id:'ys',rotulo:'Y · Vincos horizontais',padrao:'',grupo:'Vincos em mm'}
    ],'Criar marcas',{subtitulo:'Meça os vincos a partir do topo esquerdo do formato final. Separe várias posições por ponto e vírgula.'});
    if (!v) return;
    var m=montar(d,v);
    IBD.ui.resumo(titulo,[
      m.segmentos.length+' marcas · afastamento efetivo '+m.offset.toFixed(2)+' mm',
      'Exporte somente a prancheta FOLHA DE MÁQUINA para incluir as marcas externas.'
    ]);
  });
}(IBDPP));
