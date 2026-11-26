/**
 * @ibd-id illustrator/caderno-parametrico
 * @ibd-titulo Caderno paramétrico
 * @ibd-descricao Gera capa, miolo paginado pautado, quadriculado, pontilhado ou livre com tipografia, cor e reservas de encadernação.
 * @ibd-app illustrator
 * @ibd-versao 1.0.0
 * @ibd-tags caderno, miolo, pauta, pontilhado, capa, acabamento, rodapé, wire-o
 * @ibd-doc docs/folha/README.md
 */
#target illustrator
#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-preimpressao.jsx"
#include "../../../core/extendscript/ibd-editorial.jsx"

(function (p,e) {
  var titulo='Caderno paramétrico', pt=p.pt;
  var tipos=['Pautado','Quadriculado','Pontilhado','Livre'];
  var destaques=['Título em cor','Filete','Faixa de cor','Nenhum'];

  function pauta(camada,a,r,config) {
    if(config.tipo===tipos[3]) return;
    var x0=r.x,y0=r.y,x1=x0+r.w,y1=y0+r.h;
    var h=Math.floor(r.h/config.intervalo),w=Math.floor(r.w/config.intervalo);
    if(h<1 || w<1) throw Error('A pauta não cabe na área segura. Reduza o intervalo.');
    var tinta=config.pauta, passo=config.intervalo, esp=config.traco;
    var offsetY=(r.h-h*passo)/2,offsetX=(r.w-w*passo)/2;
    var i,j;
    if(config.tipo===tipos[2]){
      if(h*w>6000) throw Error('A área e o intervalo excedem 6.000 pontos por face. Aumente o intervalo.');
      var raio=Math.min(esp*1.05,passo*pt*0.2)/2;
      for(i=0;i<h;i++){
        for(j=0;j<w;j++){
          var x=(x0+offsetX+(j+0.5)*passo)*pt, y=(y0+offsetY+(i+0.5)*passo)*pt;
          var ponto=camada.pathItems.ellipse(a[1]-y+raio,a[0]+x-raio,raio*2,raio*2);
          ponto.filled=true;ponto.stroked=false;ponto.fillColor=tinta;
        }
      }
      return;
    }
    for(i=0;i<h;i++){
      var yy=y0+offsetY+(i+0.5)*passo;
      p.linha(camada,a,[x0,yy,x1,yy],tinta,esp,false);
    }
    if(config.tipo===tipos[1]){
      for(j=0;j<w;j++){
        var xx=x0+offsetX+(j+0.5)*passo;
        p.linha(camada,a,[xx,y0,xx,y1],tinta,esp,false);
      }
    }
  }

  function criar(g,config,tema) {
    var nomes=[],versos=[];
    if(config.capa){nomes.push('Capa');versos.push(false);}
    for(var n=0;n<config.quantidade;n++){
      nomes.push('Miolo '+(config.numero+n));
      versos.push(g.espelho && n%2===1);
    }
    if(config.capa){nomes.push('Contracapa');versos.push(g.espelho);}
    var doc=e.novo(g,nomes);
    try {
      var grafismo=doc.layers[0];grafismo.name='Pauta e destaques';
      var texto=doc.layers.add();texto.name='Tipografia e rodapés';
      var limites=e.area(g,false);
      var notas=e.quebrar(texto,config.rodape,tema.rodape,limites.w);
      var notaH=tema.rodape.tamanho*1.35/pt;
      var reservaNota=notaH*(notas.length+(config.numerar ? 1 : 0));
      var modeloPauta=null;
      var temTitulo=!!config.titulo;
      var cabH=temTitulo ? tema.titulo.tamanho*1.4/pt+2 : 0;
      for(var j=0;j<nomes.length;j++){
        var a=doc.artboards[j].artboardRect;
        var r=e.area(g,versos[j]), y=r.y;
        var eCapa=config.capa && (j===0 || j===nomes.length-1);
        if(eCapa){
          e.texto(texto,a,r,r.y+r.h*0.42,config.titulo,tema.titulo,'centro',config.destaque);
          e.texto(texto,a,r,r.y+r.h*0.57,config.subtitulo,tema.rodape,'centro');
        } else {
          if(temTitulo){
            if(config.estilo===destaques[2]) p.ret(grafismo,a,r.x,y,r.w,cabH-1,config.destaque,0);
            if(config.estilo===destaques[1]) p.linha(grafismo,a,[r.x,y+cabH-1,r.x+r.w,y+cabH-1],config.destaque,0.6,false);
            var tinta=tema.titulo.cor;
            if(config.estilo===destaques[0]) tinta=config.destaque;
            if(config.estilo===destaques[2]) tinta=p.cmyk(0,0,0,0);
            e.texto(texto,a,r,y+(cabH-1)/2,config.titulo,tema.titulo,'centro',tinta);
          }
          var h=r.h-cabH-reservaNota-2;
          if(h<8) throw Error('Título, rodapé e reservas deixam menos de 8 mm para o miolo.');
          if(config.tipo!==tipos[3]){
            var yPauta=y+cabH+1;
            var refX=a[0]+r.x*pt,refY=a[1]-yPauta*pt;
            if(modeloPauta){
              var copia=modeloPauta.grupo.duplicate(grafismo,ElementPlacement.PLACEATBEGINNING);
              copia.translate(refX-modeloPauta.x,refY-modeloPauta.y,true,true,true,true);
            } else {
              var grupo=grafismo.groupItems.add();grupo.name='Pauta · '+config.tipo;
              pauta(grupo,a,{x:r.x,y:yPauta,w:r.w,h:h},config);
              modeloPauta={grupo:grupo,x:refX,y:refY};
            }
          }
        }
        var rodY=y+r.h-reservaNota;
        for(var k=0;k<notas.length;k++) e.texto(texto,a,r,rodY+(k+0.5)*notaH,notas[k],tema.rodape,'esquerda');
        if(config.numerar && !eCapa) {
          var numero=config.numero+j-(config.capa ? 1 : 0);
          var lado=versos[j] ? 'esquerda' : 'direita';
          e.texto(texto,a,r,rodY+(notas.length+0.5)*notaH,numero,tema.rodape,lado);
        }
      }
      e.criarGuias(doc,g,versos);
      return doc;
    } catch(err){p.fechar(doc);throw err;}
  }

  p.executar(titulo,function () {
    var v=IBD.ui.formulario(titulo,[
      e.escolha('tipo','Miolo',tipos,null,'Páginas'),
      e.campo('qtd','Páginas de miolo','40','Páginas'),
      e.campo('inicio','Numeração inicial','1','Páginas'),
      e.simNao('numerar','Numerar o miolo',true,'Páginas'),
      e.simNao('capa','Gerar capa e contracapa',true,'Páginas'),
      e.campo('titulo','Título','Meu caderno','Textos'),
      e.campo('sub','Subtítulo das capas','','Textos'),
      e.campo('rodape','Rodapé das páginas','','Textos')
    ],'Continuar',{subtitulo:'Configure um miolo editorial em sequência de leitura. Cada face ocupa sua própria prancheta.'});
    if(!v) return;
    var quantidade=p.num(v.qtd,'Páginas do miolo',1,120,true);
    var numero=p.num(v.inicio,'Numeração inicial',1,9999,true);
    var g=e.geometria('Formato, folha e margens',{w:148,h:210,sangria:0,arte:8,borda:'Esquerda',acabamento:15},true);
    if(!g) return;
    var tema=e.tipografia('Tipografia, pauta e destaques',[
      ['titulo','Título',15,'0 0 0 100','Arial-BoldMT'],
      ['rodape','Rodapé e paginação',8,'0 0 0 85','ArialMT']
    ],[
      e.campo('intervalo','Intervalo (mm)','7','Pauta'),
      e.campo('traco','Espessura (pt)','0,5','Pauta'),
      e.campo('pauta','Pauta CMYK (%)','0 0 0 23','Pauta'),
      e.escolha('estilo','Tipo de destaque',destaques,destaques[1],'Destaque'),
      e.campo('tinta','Destaque CMYK (%)','90 55 20 20','Destaque')
    ]);
    if(!tema) return;
    var op=tema.opcoes;
    var config={
      tipo:v.tipo,quantidade:quantidade,numero:numero,numerar:v.numerar,capa:v.capa,titulo:v.titulo,subtitulo:v.sub,rodape:v.rodape,
      intervalo:p.num(op.intervalo,'Intervalo da pauta',2,30),traco:p.num(op.traco,'Espessura do traço',0.2,2),
      pauta:e.cor(op.pauta,'Cor da pauta'),estilo:op.estilo,destaque:e.cor(op.tinta,'Cor de destaque')
    };
    var doc=criar(g,config,tema);
    IBD.ui.resumo(titulo,[doc.artboards.length+' faces · '+v.tipo+' · '+quantidade+' páginas de miolo',
      'Formato final '+g.w+' × '+g.h+' mm · Folha '+g.sw+' × '+g.sh+' mm',
      'As pranchetas estão em ordem de leitura. A margem de encadernação pode espelhar a lateral do verso.']);
  });
}(IBDPP,IBDEditorial));
