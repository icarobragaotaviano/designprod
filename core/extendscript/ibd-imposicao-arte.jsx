/* Monta um documento novo a partir das pranchetas numeradas da arte original. */
var IBDImposicaoArte = (function(p,e,plano){
  var pt=p.pt;
  var viradas=['Lateral · esquerda ↔ direita','Pelo topo · cabeça com pé'];
  var formatos=['SRA3 · 450 × 320','T4 · 478 × 328','T8 · 328 × 238','A4 · 297 × 210','Personalizada'];
  var dimensoes=[[450,320],[478,328],[328,238],[297,210]];
  var tolerancia=0.1*pt;
  var precisao=0.001;

  function origem(doc,inicio,fim,b) {
    var selecionadas=[], todas=[], itens=doc.pageItems;
    for(var i=0;i<doc.artboards.length;i++) todas.push(doc.artboards[i].artboardRect);
    var primeira=todas[inicio], w=primeira[2]-primeira[0], h=primeira[1]-primeira[3];
    for(var j=inicio;j<=fim;j++) {
      var a=todas[j], limite=p.sangria(a,b), capturados=[];
      if(Math.abs(a[2]-a[0]-w)>tolerancia || Math.abs(a[1]-a[3]-h)>tolerancia) {
        throw Error('A prancheta '+(j+1)+' tem outra medida. Use um único formato final no intervalo.');
      }
      for(var k=0;k<todas.length;k++){
        if(k===j)continue;
        var outro=p.sangria(todas[k],b);
        if(Math.min(limite[2],outro[2])-Math.max(limite[0],outro[0])>precisao &&
            Math.min(limite[1],outro[1])-Math.max(limite[3],outro[3])>precisao) {
          throw Error('Separe as pranchetas '+(j+1)+' e '+(k+1)+' para que suas sangrias não se cruzem.');
        }
      }
      for(var n=0;n<itens.length;n++){
        var x=itens[n];
        if(x.parent.typename!=='Layer' || x.guides || !p.visivel(x))continue;
        var ret=x.visibleBounds;
        if(ret[0]<limite[2]-precisao && ret[2]>limite[0]+precisao &&
            ret[1]>limite[3]+precisao && ret[3]<limite[1]-precisao)capturados.push(x);
      }
      selecionadas.push({ret:a,itens:capturados,numero:j+1});
    }
    return {paginas:selecionadas,w:w/pt,h:h/pt};
  }

  function copiarPagina(pagina,destino,a,c) {
    var g=destino.groupItems.add(), b=pagina.ret;
    g.name='Prancheta original '+pagina.numero;
    try {
      for(var i=pagina.itens.length-1;i>=0;i--){
        p.copiarEm(pagina.itens[i],g,a[0]+c.x*pt-b[0],a[1]-c.y*pt-b[1]);
      }
      var esquerda=c.l,direita=c.r,topo=c.t,base=c.b;
      if(c.ang){esquerda=c.r;direita=c.l;topo=c.b;base=c.t;}
      var mascara=p.ret(g,a,c.x-esquerda,c.y-topo,c.w+esquerda+direita,c.h+topo+base,null,0);
      mascara.zOrder(ZOrderMethod.BRINGTOFRONT);mascara.clipping=true;g.clipped=true;
      if(c.ang){
        g.rotate(c.ang,true,true,true,true,Transformation.CENTER);
        var real=mascara.geometricBounds;
        g.translate(a[0]+(c.x-c.l)*pt-real[0],a[1]-(c.y-c.t)*pt-real[1],true,true,true,true);
      }
      return g;
    } catch(erro){throw Error('Prancheta original '+pagina.numero+': '+erro.message);}
  }

  function guiasETracos(guia,marcas,a,folha,o) {
    var poses=folha.poses, xs=[],ys=[],l=Infinity,t=Infinity,r=-Infinity,b=-Infinity;
    var azul=p.cmyk(100,30,0,0), preto=p.cmyk(0,0,0,100);
    function adicionar(lista,n){
      for(var j=0;j<lista.length;j++) if(Math.abs(lista[j]-n)<1e-5)return;
      lista.push(n);
    }
    for(var i=0;i<poses.length;i++){
      var c=poses[i];
      var caixa=p.ret(guia,a,c.x,c.y,c.w,c.h,azul,0.25);
      caixa.guides=true;
      caixa.name=c.pagina ? 'Página '+c.pagina : 'Em branco';
      adicionar(xs,c.x);adicionar(xs,c.x+c.w);adicionar(ys,c.y);adicionar(ys,c.y+c.h);
      l=Math.min(l,c.x);t=Math.min(t,c.y);r=Math.max(r,c.x+c.w);b=Math.max(b,c.y+c.h);
    }
    if(folha.dobra!==null){
      var dobra=p.linha(guia,a,[folha.dobra,t,folha.dobra,b],azul,0.25,true);
      dobra.guides=true;dobra.name='Dobra central';
    }
    if(!marcas)return;
    var ini=o.b+1, fim=ini+4;
    function tra(pontos,dobrar){p.linha(marcas,a,pontos,preto,0.35,dobrar).name=dobrar ? 'Dobra' : 'Refilo';}
    for(var x=0;x<xs.length;x++){
      var dob=folha.dobra!==null && Math.abs(xs[x]-folha.dobra)<1e-5;
      tra([xs[x],t-ini,xs[x],t-fim],dob);tra([xs[x],b+ini,xs[x],b+fim],dob);
    }
    for(var y=0;y<ys.length;y++){
      tra([l-ini,ys[y],l-fim,ys[y]],false);tra([r+ini,ys[y],r+fim,ys[y]],false);
    }
  }

  function gerar(fonte,o,mapa) {
    var nomes=[];
    for(var i=0;i<mapa.faces.length;i++) nomes.push(mapa.faces[i].nome);
    var d=e.novo(o,nomes);
    try {
      var arte=d.layers[0];arte.name='Imposição · Arte';
      var guia=d.layers.add();guia.name='Imposição · Guias';guia.printable=false;
      var marcas=o.marcas ? d.layers.add() : null;
      if(marcas)marcas.name='Imposição · Marcas K100';
      for(var f=0;f<mapa.faces.length;f++){
        var folha=mapa.faces[f], a=d.artboards[f].artboardRect, grupos={};
        var face=arte.groupItems.add();face.name=folha.nome;
        for(var j=0;j<folha.poses.length;j++){
          var c=folha.poses[j];
          var pagina=c.pagina ? fonte.paginas[c.pagina-1] : null;
          if(!pagina || !pagina.itens.length)continue;
          var mestre=grupos[c.pagina];
          if(mestre){
            var copia=mestre.objeto.duplicate(face,ElementPlacement.PLACEATEND);
            copia.translate((c.x-mestre.x)*pt,(mestre.y-c.y)*pt,true,true,true,true);
          } else grupos[c.pagina]={objeto:copiarPagina(pagina,face,a,c),x:c.x,y:c.y};
        }
        guiasETracos(guia,marcas,a,folha,o);
      }
      guia.locked=true;
      return d;
    } catch(erro){p.fechar(d);throw erro;}
  }

  function abrir(titulo,livreto){
    var d=p.doc(true), qtd=d.artboards.length;
    var campos=[e.campo('inicio','Primeira prancheta','1','Origem'),
      e.campo('fim','Última prancheta',String(qtd),'Origem'),
      e.escolha('formato','Formato',formatos,null,'Folha'),
      e.campo('sw','Largura manual (mm)','450','Folha'),
      e.campo('sh','Altura manual (mm)','320','Folha'),
      e.campo('margem','Margem mínima (mm)','8','Acabamento'),
      e.campo('sangria','Sangria (mm)','0','Acabamento'),
      e.escolha('virada','Virada do verso',viradas,null,'Acabamento'),
      e.simNao('marcas','Imprimir marcas de refilo'+(livreto ? ' e dobra' : ''),true,'Acabamento')];
    if(!livreto){
      campos.push(e.campo('colunas','Colunas · 0 automático','0','Grade'),
        e.campo('linhas','Linhas · 0 automático','0','Grade'),e.campo('folga','Folga entre sangrias','3','Grade'));
    }
    var ui=IBD.ui.formulario(titulo,campos,'Gerar imposição',{
      largura:715,rotuloLargura:135,subtitulo:'Use pranchetas em ordem de leitura, separadas pelas sangrias. A saída é um novo documento CMYK.'});
    if(!ui)return;
    var ini=p.num(ui.inicio,'Primeira prancheta',1,qtd,true)-1;
    var fim=p.num(ui.fim,'Última prancheta',ini+1,qtd,true)-1;
    if(fim-ini+1>200)throw Error('Selecione até 200 pranchetas por operação.');
    if(!livreto && fim===ini)throw Error('Selecione ao menos duas pranchetas para montar frente e verso.');
    var b=p.num(ui.sangria,'Sangria',0,20), medida;
    for(var i=0;i<dimensoes.length;i++) if(ui.formato===formatos[i])medida=dimensoes[i];
    if(!medida)medida=p.medidas('Personalizada',ui.sw,ui.sh);
    var info=origem(d,ini,fim,b);
    var o={sw:medida[0],sh:medida[1],w:info.w,h:info.h,b:b,paginas:info.paginas.length,
      margem:Math.max(ui.marcas ? 5.2 : 0,p.num(ui.margem,'Margem',0,100)),
      marcas:ui.marcas,tombado:ui.virada===viradas[1]};
    if(!livreto){
      o.folga=p.num(ui.folga,'Folga entre sangrias',0,100);
      o.colunas=p.num(ui.colunas,'Colunas',0,100,true);o.linhas=p.num(ui.linhas,'Linhas',0,100,true);
    }
    var mapa=livreto ? plano.livreto(o) : plano.duplex(o);
    gerar(info,o,mapa);
    IBD.ui.resumo(titulo,[mapa.folhas+' folha(s) com frente e verso · '+mapa.brancas+' página(s) em branco adicionada(s)',
      mapa.colunas+' coluna(s) × '+mapa.linhas+' linha(s) · '+o.sw+' × '+o.sh+' mm',
      ui.virada+' · faça uma prova da virada antes da tiragem.']);
  }
  return {abrir:abrir,origem:origem,gerar:gerar};
}(IBDPP,IBDEditorial,IBDPlanoImposicao));
