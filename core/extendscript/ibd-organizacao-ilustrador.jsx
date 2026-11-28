/* Reorganização estrutural sem alterar a ordem de pintura do documento. */
var IBDOrganizacao=(function(p){
  var classes=['Textos','Imagens incorporadas','Vínculos','Elementos gráficos','Grupos mistos'];

  function protegido(l){
    return l.locked || !l.visible || !l.printable ||
      /^(guia|marca(?:s|\b)|faca|vinco|corte|sangria|papel[õo]es|enobrecimento|registro|imposição · (guias|marcas))/i.test(l.name);
  }

  function filhos(pai){
    var saida=[];
    for(var i=0;i<pai.pageItems.length;i++){
      var item=pai.pageItems[i];
      if(item.parent===pai)saida.push(item);
    }
    return saida;
  }

  function ehMascara(item){
    if(item.typename==='PathItem')return item.clipping;
    if(item.typename==='CompoundPathItem'){
      var caminhos=item.pathItems;
      return caminhos && caminhos.length>0 && caminhos[0] && caminhos[0].clipping;
    }
    return false;
  }

  function classe(item){
    switch(item.typename){
      case 'TextFrame':
      case 'TextFrameItem':
      case 'LegacyTextItem': return classes[0];
      case 'RasterItem': return item.embedded ? classes[1] : classes[2];
      case 'PlacedItem': return classes[2];
      case 'GroupItem':
        var grupo=filhos(item), resultado=null;
        for(var i=0;i<grupo.length;i++){
          var x=grupo[i];
          if(item.clipped && ehMascara(x))continue;
          var atual=classe(x);
          if(resultado && resultado!==atual)return classes[4];
          resultado=atual;
        }
        return resultado || classes[3];
      default:return classes[3];
    }
  }

  function numero(n,digitos){
    var s=String(n);
    while(s.length<digitos)s='0'+s;
    return s;
  }

  function separar(doc){
    var result={planos:[],preservadas:0,objetos:0,grupos:0};
    function percorrer(layers){
      for(var i=0;i<layers.length;i++){
        var l=layers[i], itens=filhos(l), grupos=[];
        if(protegido(l)){result.preservadas++;continue;}
        if(l.layers.length){
          if(itens.length) result.preservadas++;
          percorrer(l.layers);
          continue;
        }
        if(!itens.length)continue;
        for(var j=0;j<itens.length;j++){
          var item=itens[j];
          if(item.locked || item.hidden || item.guides){grupos=[];break;}
          var tipo=classe(item), ultimo=grupos[grupos.length-1];
          if(!ultimo || ultimo.tipo!==tipo){ultimo={tipo:tipo,itens:[]};grupos.push(ultimo);}
          ultimo.itens.push(item);
        }
        if(!grupos.length){result.preservadas++;continue;}
        if(grupos.length===1 && /^\d+ · /.test(l.name) && l.name.replace(/^\d+ · /,'')===grupos[0].tipo)continue;
        result.planos.push({layer:l,grupos:grupos,itens:itens,criados:[]});
        result.objetos+=itens.length;
        result.grupos+=grupos.length;
      }
    }
    percorrer(doc.layers);
    return result;
  }

  function mover(itens,destino){
    for(var i=itens.length-1;i>=0;i--) itens[i].move(destino,ElementPlacement.PLACEATBEGINNING);
  }

  function aplicarSeparacao(doc,planos){
    var anterior=doc.activeLayer, i=0;
    try {
      for(;i<planos.length;i++){
        var plano=planos[i];
        for(var j=plano.grupos.length-1;j>=0;j--){
          var grupo=plano.grupos[j], destino=plano.layer.layers.add();
          plano.criados.push(destino);
          destino.name=numero(j+1,2)+' · '+grupo.tipo;
          mover(grupo.itens,destino);
        }
      }
    } catch(erro){
      for(var k=i;k>=0;k--){
        var feito=planos[k];
        if(!feito.criados.length)continue;
        mover(feito.itens,feito.layer);
        for(var m=0;m<feito.criados.length;m++)feito.criados[m].remove();
      }
      throw erro;
    } finally { doc.activeLayer=anterior; }
  }

  function montar(modelo,dados,o){
    if(!modelo || !modelo.replace(/\s/g,''))throw Error('Preencha o modelo de nomes.');
    var nome=modelo.replace(/\{([^{}]+)\}/g,function(_,chave){
      if(!dados.hasOwnProperty(chave))throw Error('Campo indisponível no modelo: {'+chave+'}.');
      return dados[chave];
    }).split('\\').join('-').split('/').join('-').replace(/[:*?"<>|\x00-\x1F]/g,'-').replace(/\s+/g,' ').replace(/^\s+|[.\s]+$/g,'');
    if(!nome)throw Error('O modelo gerou um nome vazio.');
    if(o.caixa===1)nome=nome.toUpperCase();
    if(o.caixa===2)nome=nome.toLowerCase();
    if(o.espacos)nome=nome.replace(/ /g,'_');
    return nome.substring(0,90);
  }

  function nomes(d,o,usarCamadas,usarPranchetas){
    var saida=[];
    function planejar(lista,modelo,pranchetas){
      var usados={}, editaveis=[];
      for(var i=0;i<lista.length;i++){
        var x=lista[i];
        if(pranchetas || !protegido(x))editaveis.push(x);
        else usados['$'+x.name.toLowerCase()]=true;
      }
      for(var j=0;j<editaveis.length;j++){
        var obj=editaveis[j], antes=obj.name, dados={n:numero(j+1,o.digitos),nome:antes};
        if(pranchetas){
          var a=obj.artboardRect;
          dados.largura=String(Math.round((a[2]-a[0])/p.pt*100)/100).replace('.',',');
          dados.altura=String(Math.round((a[1]-a[3])/p.pt*100)/100).replace('.',',');
        }
        var base=montar(modelo,dados,o), nome=base, sufixo=1;
        while(usados['$'+nome.toLowerCase()]){
          var complemento='_'+(++sufixo);
          nome=base.substring(0,90-complemento.length)+complemento;
        }
        usados['$'+nome.toLowerCase()]=true;
        if(antes!==nome)saida.push({obj:obj,antes:antes,depois:nome});
        if(!pranchetas && o.sublayers && obj.layers.length)planejar(obj.layers,modelo,false);
      }
    }
    if(usarCamadas)planejar(d.layers,o.camadas,false);
    if(usarPranchetas)planejar(d.artboards,o.pranchetas,true);
    return saida;
  }

  function aplicarNomes(plano){
    var prefixo='IBD '+(new Date()).getTime()+' ', i;
    try {
      for(i=0;i<plano.length;i++) plano[i].obj.name=prefixo+i;
      for(i=0;i<plano.length;i++) plano[i].obj.name=plano[i].depois;
    } catch(erro){
      for(i=0;i<plano.length;i++) plano[i].obj.name=prefixo+i;
      for(i=0;i<plano.length;i++) plano[i].obj.name=plano[i].antes;
      throw erro;
    }
  }

  return {separar:separar,aplicarSeparacao:aplicarSeparacao,nomes:nomes,aplicarNomes:aplicarNomes};
}(IBDPP));
