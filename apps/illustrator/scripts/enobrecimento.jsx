/**
 * @ibd-id illustrator/enobrecimento
 * @ibd-titulo Enobrecimento e prova de registro
 * @ibd-descricao Prepara máscaras spot com sobreimpressão para verniz ou hot stamping e exporta arte CMYK, prova magenta e máscara K100 em um PDF.
 * @ibd-app illustrator
 * @ibd-versao 1.0.0
 * @ibd-tags verniz, hot stamping, spot, overprint, PDF, máscara, enobrecimento
 * @ibd-doc docs/folha/README.md
 */
#target illustrator
#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-preimpressao.jsx"

(function (p) {
  var titulo='Enobrecimento e prova de registro', prefixo='ENOBRECIMENTO · ';
  var acoes=['Preparar máscara spot', 'Exportar PDF de 3 páginas'];
  var nomes=['Verniz_UV','Hot_Stamp'];

  function filhos(itens, item, executar) {
    for (var i=0;i<itens.length;i++) {
      if (itens[i].parent===item) executar(itens[i]);
    }
  }

  function vetor(item, executar) {
    if (item.hidden) throw Error('Remova os elementos ocultos do grupo da máscara.');
    if (item.typename==='GroupItem' && !item.clipped) {
      if (!item.pageItems.length) throw Error('A máscara contém um grupo vazio.');
      filhos(item.pageItems,item,function (i) { vetor(i,executar); });
      if (executar) { item.opacity=100; item.blendingMode=BlendModes.NORMAL; }
      return;
    }
    if (item.typename==='CompoundPathItem' && item.pathItems.length) {
      for (var i=0;i<item.pathItems.length;i++) vetor(item.pathItems[i],executar);
      return;
    }
    if (item.typename!=='PathItem' || !item.closed || item.guides || item.clipping) {
      throw Error('A máscara exige formas vetoriais fechadas. Expanda textos, traços e efeitos antes de preparar.');
    }
    if (executar) executar(item);
  }

  function vetorLimpo(origem, destino) {
    if (origem.typename==='GroupItem') {
      var grupo=destino.groupItems.add();
      for (var i=origem.pageItems.length-1;i>=0;i--) {
        var item=origem.pageItems[i];
        if (item.parent===origem) vetorLimpo(item,grupo);
      }
      grupo.name=origem.name;
      return grupo;
    }
    if (origem.typename==='CompoundPathItem') {
      var composto=destino.compoundPathItems.add();
      for (var j=0;j<origem.pathItems.length;j++) vetorLimpo(origem.pathItems[j],composto);
      composto.name=origem.name;
      return composto;
    }
    var caminho=destino.pathItems.add(), pontos=origem.pathPoints, ancoras=[];
    for (var k=0;k<pontos.length;k++) ancoras.push(pontos[k].anchor);
    caminho.setEntirePath(ancoras);
    for (var n=0;n<pontos.length;n++) {
      var alvo=caminho.pathPoints[n];
      alvo.leftDirection=pontos[n].leftDirection;
      alvo.rightDirection=pontos[n].rightDirection;
      alvo.pointType=pontos[n].pointType;
    }
    caminho.closed=true;
    caminho.evenodd=origem.evenodd;
    caminho.polarity=origem.polarity;
    caminho.name=origem.name;
    return caminho;
  }

  function aplicar(item, cor, modo) {
    var prova=modo==='prova', spot=modo==='spot';
    vetor(item,function (path) {
      path.opacity=100;
      path.blendingMode=BlendModes.NORMAL;
      path.filled=!prova;
      path.stroked=prova;
      if (prova) {
        path.strokeColor=cor; path.strokeWidth=0.5; path.strokeDashes=[];
      } else path.fillColor=cor;
      path.fillOverprint=spot;
      path.strokeOverprint=prova;
    });
  }

  function emCamadaMascara(item) {
    for (var x=item;x && x.typename!=='Document';x=x.parent) {
      if (x.typename==='Layer' && x.name.indexOf(prefixo)===0) return true;
    }
    return false;
  }

  function preparar(d,nome) {
    if (!d.selection || !d.selection.length) throw Error('Selecione os vetores do acabamento.');
    var origem=[];
    for (var i=0;i<d.selection.length;i++) {
      var x=d.selection[i];
      if (emCamadaMascara(x)) throw Error('A seleção já pertence a uma camada de enobrecimento.');
      vetor(x);
      origem.push(x);
    }
    var cor=p.spot(d,nome), camada;
    try { camada=d.layers.getByName(prefixo+nome); } catch (_) {}
    var nova=!camada;
    if (nova) {
      camada=d.layers.add(); camada.name=prefixo+nome;
    } else if (camada.locked || !camada.visible || !camada.printable) {
      throw Error('Desbloqueie e habilite a camada técnica para impressão.');
    }
    var grupo;
    try {
      grupo=camada.groupItems.add();
      grupo.name=nome+' · Editável';
      for (var j=origem.length-1;j>=0;j--) {
        var copia=vetorLimpo(origem[j],grupo);
        aplicar(copia,cor,'spot');
      }
      if (!nova && d.layers[0]!==camada) camada.move(d.layers[0],ElementPlacement.PLACEBEFORE);
    } catch (e) {
      if (nova) { try { camada.remove(); } catch (_) {} }
      else if (grupo) { try { grupo.remove(); } catch (_) {} }
      throw e;
    }
    for (var k=0;k<origem.length;k++) origem[k].remove();
    grupo.selected=true;
    return camada;
  }

  function processo(cor) {
    if (!cor || cor.typename==='NoColor' || cor.typename==='CMYKColor') return true;
    if (cor.typename!=='GradientColor') return false;
    var stops=cor.gradient.gradientStops;
    for (var i=0;i<stops.length;i++) if (!processo(stops[i].color)) return false;
    return true;
  }

  function conferir(item) {
    var tipo=item.typename, valido=false;
    if (!p.visivel(item)) return;
    if (tipo==='GroupItem') {
      filhos(item.pageItems,item,conferir);
      return;
    }
    if (tipo==='CompoundPathItem') {
      for (var i=0;i<item.pathItems.length;i++) conferir(item.pathItems[i]);
      return;
    }
    if (tipo==='PathItem') valido=(!item.filled || processo(item.fillColor)) && (!item.stroked || processo(item.strokeColor));
    if (tipo==='TextFrame') {
      valido=true;
      var chars=item.textRange.characters;
      for (var j=0;j<chars.length;j++) {
        var a=chars[j].characterAttributes;
        if (!processo(a.fillColor) || !processo(a.strokeColor)) valido=false;
      }
    }
    if (tipo==='RasterItem') valido=item.embedded && item.imageColorSpace===ImageColorSpace.CMYK;
    if (!valido) {
      throw Error('Prepare a arte em cores de processo CMYK. Revise vínculos, spots, padrões e objetos sem separação confirmável. Objeto: '+(item.name || tipo)+'.');
    }
  }

  function dentro(b,a) {
    var eps=0.01;
    return b[0]>=a[0]-eps && b[1]<=a[1]+eps && b[2]<=a[2]+eps && b[3]>=a[3]-eps;
  }

  function fonte(d,a,nome) {
    var camada;
    try { camada=d.layers.getByName(prefixo+nome); } catch (_) {}
    if (!camada || !p.visivel(camada)) throw Error('Prepare e deixe visível a camada '+prefixo+nome+'.');
    var arte=[], mascara=[], itens=d.pageItems;
    for (var i=0;i<itens.length;i++) {
      var x=itens[i];
      if (x.parent.typename!=='Layer' || !p.visivel(x) || x.guides || !p.recorte(x.visibleBounds,a)) continue;
      if (emCamadaMascara(x)) {
        if (x.layer.name!==camada.name) continue;
        if (!dentro(x.visibleBounds,a)) throw Error('Toda a máscara deve caber na prancheta ativa.');
        vetor(x); mascara.push(x);
      } else {
        conferir(x); arte.push(x);
      }
    }
    if (!arte.length || !mascara.length) throw Error('A prancheta ativa precisa conter arte CMYK e uma máscara vetorial do acabamento escolhido.');
    return {arte:arte,mascara:mascara};
  }

  function copiarLista(itens,destino,origem,placa,cor,modo) {
    for (var i=itens.length-1;i>=0;i--) {
      var c=p.copiarEm(itens[i],destino,placa[0]-origem[0],placa[1]-origem[1]);
      if (cor) aplicar(c,cor,modo);
    }
  }

  function arteNaPagina(itens,camada,origem,a) {
    var grupo=camada.groupItems.add();
    copiarLista(itens,grupo,origem,a);
    var r=p.ret(grupo,a,0,0,(a[2]-a[0])/p.pt,(a[1]-a[3])/p.pt,null,0);
    r.zOrder(ZOrderMethod.BRINGTOFRONT);
    r.clipping=true;
    grupo.clipped=true;
  }

  function gerarPDF(itens,a,arquivo) {
    var dim=[(a[2]-a[0])/p.pt,(a[1]-a[3])/p.pt];
    var out=p.novaGrade(dim,3,3,20,['01 · Arte CMYK','02 · Prova de registro','03 · Máscara K100']);
    try {
      var arte=out.layers[0]; arte.name='Arte CMYK';
      var prova=out.layers.add(); prova.name='Prova magenta';
      var producao=out.layers.add(); producao.name='Máscara de produção K100';
      var a1=out.artboards[0].artboardRect, a2=out.artboards[1].artboardRect, a3=out.artboards[2].artboardRect;
      arteNaPagina(itens.arte,arte,a,a1);
      arteNaPagina(itens.arte,arte,a,a2);
      copiarLista(itens.mascara,prova,a,a2,p.cmyk(0,100,0,0),'prova');
      copiarLista(itens.mascara,producao,a,a3,p.cmyk(0,0,0,100),'producao');
      p.pdf(out,arquivo,'1-3');
    } finally { p.fechar(out); }
  }

  p.executar(titulo,function () {
    var v=IBD.ui.formulario(titulo,[
      {id:'acao',rotulo:'Operação',tipo:'escolha',opcoes:acoes,padrao:acoes[0]},
      {id:'nome',rotulo:'Acabamento',tipo:'escolha',opcoes:nomes,padrao:nomes[0]}
    ],'Continuar',{subtitulo:'O PDF usa a prancheta ativa. Prepare vetores fechados para a máscara e arte de processo CMYK.'});
    if (!v) return;
    var d=p.doc(true);
    if (v.acao===acoes[0]) {
      if (!confirm('Mover a seleção para a camada técnica '+v.nome+' e aplicar a amostra spot com sobreimpressão?')) return;
      var camada=preparar(d,v.nome);
      IBD.ui.resumo(titulo,[camada.name,'Máscara em cor especial com preenchimento em sobreimpressão.']);
    } else {
      var a=d.artboards[d.artboards.getActiveArtboardIndex()].artboardRect;
      var itens=fonte(d,a,v.nome);
      var arquivo=p.salvarArquivo('Salvar PDF de enobrecimento','pdf');
      if (!arquivo) return;
      gerarPDF(itens,a,arquivo);
      IBD.ui.resumo(titulo,['1 · Arte CMYK','2 · Prova magenta em sobreimpressão','3 · Máscara vetorial K100',arquivo.fsName]);
    }
  });
}(IBDPP));
