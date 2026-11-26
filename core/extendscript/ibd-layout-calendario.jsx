/* Tipografia e datas editáveis usadas nos calendários editoriais e estruturais. */
var IBDCalendarioLayout = (function(p,e,datas) {
  var pt=p.pt;
  var tipos=['Cor do número','Círculo preenchido','Contorno circular','Tarja','Sublinhado'];
  var dias=['D','S','T','Q','Q','S','S'];
  function marca(destino,a,x,y,w,h,tipo,cor) {
    var d=Math.min(w*0.7,h*0.86);
    if (tipo===tipos[1] || tipo===tipos[2]) {
      var disco=destino.pathItems.ellipse(a[1]-(y-d/2)*pt,a[0]+(x-d/2)*pt,d*pt,d*pt);
      disco.filled=tipo===tipos[1];disco.stroked=!disco.filled;
      if(disco.filled) disco.fillColor=cor;
      else {disco.strokeColor=cor;disco.strokeWidth=0.45;}
    } else if (tipo===tipos[3]) {
      p.ret(destino,a,x-w*0.38,y-d/2,w*0.76,d,cor,0);
    } else if (tipo===tipos[4]) {
      p.linha(destino,a,[x-d*0.35,y+d*0.49,x+d*0.35,y+d*0.49],cor,0.5,false);
    }
  }

  function mes(camada,a,ano,m,regiao,tema,ajustes,compacto) {
    var calendario=p.mes(ano,m), fonte=tema.dia;
    var grupo=camada.typename==='GroupItem' ? camada.groupItems.add() : camada.layers.add();
    grupo.name=calendario.nome;
    var tituloH=tema.titulo.tamanho*1.25/pt, notaH=tema.nota.tamanho*1.3/pt;
    var notas=[];
    if(ajustes.mostraNota) notas=e.quebrar(grupo,datas.rodape(ajustes.dados[m]),tema.nota,regiao.w);
    var alturaNota=notas.length*notaH+(notas.length ? notaH*0.4 : 0);
    var largura=regiao.w/7, altura=(regiao.h-tituloH-alturaNota)/7;
    if (altura<fonte.tamanho*1.18/pt || largura<fonte.tamanho*0.98/pt) {
      throw Error(calendario.nome+' não cabe na área segura com estas fontes e rodapés. Amplie o formato ou reduza as fontes.');
    }
    var nome=compacto ? calendario.nome : calendario.nome+' '+ano;
    e.texto(grupo,a,regiao,regiao.y+tituloH/2,nome,tema.titulo,'centro');
    var corpoY=regiao.y+tituloH, tituloDias={fonte:fonte.fonte,tamanho:fonte.tamanho*0.78,cor:fonte.cor};
    for (var i=0;i<7;i++) {
      e.texto(grupo,a,{x:regiao.x+largura*i,w:largura},corpoY+altura/2,dias[i],tituloDias,'centro');
    }
    for(var d=1;d<=calendario.dias;d++) {
      var celula=calendario.inicio+d-1, col=celula%7, linha=Math.floor(celula/7);
      var x=regiao.x+largura*col,y=corpoY+(1.5+linha)*altura;
      var feriado=ajustes.feriados && !!ajustes.dados[m].dias[d];
      var finde=ajustes.finde && (col===0 || col===6);
      var corDia=fonte.cor;
      if (feriado || finde) {
        marca(grupo,a,x+largura/2,y,largura,altura,ajustes.tipo,ajustes.tinta);
        corDia=ajustes.tinta;
        if (ajustes.tipo===tipos[1] || ajustes.tipo===tipos[3]) corDia=ajustes.branco;
      }
      e.texto(grupo,a,{x:x,w:largura},y,d,fonte,'centro',corDia);
    }
    for(var j=0;j<notas.length;j++) {
      e.texto(grupo,a,regiao,regiao.y+regiao.h-alturaNota+notaH*(0.9+j),notas[j],tema.nota,'esquerda');
    }
  }

  return {mes:mes,tipos:tipos};
}(IBDPP,IBDEditorial,IBDCalendarioDatas));
