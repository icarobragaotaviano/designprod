/* Plano ortogonal em mm para as pranchetas de impressão no Illustrator. */
var IBDPlanoImposicao = (function () {
  function completar(n, mult) {return Math.ceil(n / mult) * mult;}
  function celula(pagina,x,y,o,l,r) {
    return {pagina:pagina<=o.paginas ? pagina : 0,x:x,y:y,w:o.w,h:o.h,
      l:l,r:r,t:o.b,b:o.b,ang:0};
  }

  function virar(c,o) {
    if(o.tombado) {
      return {pagina:c.pagina,x:c.x,y:o.sh-c.y-c.h,w:c.w,h:c.h,l:c.l,r:c.r,t:c.b,b:c.t,ang:(c.ang+180)%360};
    }
    return {pagina:c.pagina,x:o.sw-c.x-c.w,y:c.y,w:c.w,h:c.h,l:c.r,r:c.l,t:c.t,b:c.b,ang:c.ang};
  }

  function numerar(n) {return n<10 ? '0'+n : String(n);}
  function face(folha,verso,poses,dobra) {
    return {nome:'Folha '+numerar(folha)+' · '+(verso ? 'Verso' : 'Frente'),poses:poses,dobra:dobra};
  }

  function livreto(o) {
    var total=completar(o.paginas,4), folhas=total/4, w=2*o.w;
    var x=(o.sw-w)/2,y=(o.sh-o.h)/2, faces=[];
    if(x+1e-7<o.b+o.margem || y+1e-7<o.b+o.margem) {
      throw Error('A dupla de páginas, a sangria externa e as margens precisam caber na folha.');
    }
    for(var i=0;i<folhas;i++){
      var baixa=1+2*i, alta=total-2*i, f=[
        celula(alta,x,y,o,o.b,0),celula(baixa,x+o.w,y,o,0,o.b)
      ];
      var v=[celula(alta-1,x,y,o,o.b,0),celula(baixa+1,x+o.w,y,o,0,o.b)];
      v=[virar(v[1],o),virar(v[0],o)];
      if(o.tombado){
        // A ordem original lateral é [baixa+1, alta-1]. Na virada pelo topo, gira a forma toda.
        v=[virar(celula(alta-1,x,y,o,o.b,0),o),virar(celula(baixa+1,x+o.w,y,o,0,o.b),o)];
      }
      faces.push(face(i+1,false,f,x+o.w),face(i+1,true,v,x+o.w));
    }
    return {faces:faces,folhas:folhas,brancas:total-o.paginas,colunas:2,linhas:1};
  }

  function duplex(o) {
    // O intervalo da grade é a faixa livre entre as duas sangrias.
    var geom=imposicaoGrade({largura:o.sw,altura:o.sh,margem:o.margem,espaco:o.folga,
      quantidade:0,colunas:o.colunas,linhas:o.linhas,marcas:0},[-o.b,-o.b,o.w+o.b,o.h+o.b],[0,0,o.w,o.h]);
    var pts=geom.posicoes, a=pts[0],z=pts[pts.length-1];
    var dx=(o.sw-(z[0]-a[0]+o.w))/2-a[0];
    var dy=(o.sh-(z[1]-a[1]+o.h))/2-a[1];
    var faces=[], folhas=Math.ceil(o.paginas/2), cols=0;
    if (pts.length*folhas*2>5000) throw Error('A montagem ultrapassa 5.000 poses. Reduza a grade ou o intervalo de pranchetas.');
    while(cols<pts.length && pts[cols][1]===a[1]) cols++;
    for(var i=0;i<folhas;i++){
      var frente=[],verso=[];
      for(var j=0;j<pts.length;j++){
        var pos=pts[j];
        frente.push(celula(2*i+1,pos[0]+dx,pos[1]+dy,o,o.b,o.b));
        verso.push(virar(celula(2*i+2,pos[0]+dx,pos[1]+dy,o,o.b,o.b),o));
      }
      faces.push(face(i+1,false,frente,null),face(i+1,true,verso,null));
    }
    return {faces:faces,folhas:folhas,brancas:o.paginas%2,colunas:cols,linhas:pts.length/cols};
  }

  return {livreto:livreto,duplex:duplex};
}());
