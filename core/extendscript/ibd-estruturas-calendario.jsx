/* Geometria em milímetros, a partir do canto superior esquerdo da peça. */
var IBDEstruturas = (function () {
  function ret(x,y,w,h) {return [x,y,w,h];}
  function cantos(w,h) {return [[0,0],[w,0],[w,h],[0,h]];}
  function painel(nome,y,h) {return {nome:nome,y:y,h:h};}

  function prisma(v) {
    var W=v.w,H=v.h,B=v.fundo,A=v.aba;
    if (B>=2*H) throw Error('O fundo precisa ser menor que a soma das duas faces.');
    var p={w:W,paineis:[],vincos:[],furos:[],placas:[],
      inclinacao:Math.acos(B/(2*H))*180/Math.PI};
    if (v.tipo==='dura') {
      if (v.canal<v.caliper) throw Error('A canaleta deve acomodar a espessura do papelão.');
      var C=v.canal,V=v.vira;
      p.w=W+2*V;p.h=2*H+B+2*C+2*V;
      p.placas=[ret(V,V,W,H),ret(V,V+H+C,W,B),ret(V,V+H+B+2*C,W,H)];
      p.contorno=cantos(p.w,p.h);
      p.paineis=[painel('Frente',V,H),painel('Fundo',V+H+C,B),painel('Verso',V+H+B+2*C,H)];
      return p;
    }
    if (v.tipo==='cola') {
      p.h=2*H+B+A;
      p.paineis=[painel('Frente',0,H),painel('Fundo',H,B),painel('Verso',H+B,H),painel('Aba de colagem',2*H+B,A)];
      p.contorno=cantos(W,p.h);
      p.vincos=[H,H+B,2*H+B];
      return p;
    }
    var M=(B+A)/2,F=M,raiz=F+2*H+M,entrada=4;
    var encaixe=B-M-entrada, slotY=F-encaixe;
    var x=W/2, q=v.neck/2, o=v.orelha, t=v.lingueta;
    var dobra=4, chanfro=Math.min(8,q/2,t*0.4);
    var R=v.raio, abertura=v.caliper+0.15,L=v.neck+v.folga;
    if (encaixe<5 || slotY-R<4 || slotY+R>F-5) throw Error('A aba fêmea não comporta a fenda. Aumente o fundo ou reduza a sobreposição.');
    if (W/2-q-o<6 || W<L+12) throw Error('A lingueta ou a fenda está próxima demais da lateral.');
    if (v.folga>=o*2 || R<=abertura/2 || L<=4*R || t<=dobra+4) {
      throw Error('Revise orelha, folga, alívio e altura da lingueta. As orelhas precisam ultrapassar a fenda.');
    }
    p.h=raiz+t;
    p.paineis=[painel('Aba fêmea',0,F),painel('Frente',F,H),painel('Verso',F+H,H),painel('Aba macho',F+2*H,M)];
    p.contorno=[[0,0],[W,0],[W,raiz],[x+q,raiz],[x+q+o,raiz+dobra],
      [x+q+o,raiz+t-chanfro],[x+q+o-chanfro,raiz+t],[x-q-o+chanfro,raiz+t],
      [x-q-o,raiz+t-chanfro],[x-q-o,raiz+dobra],[x-q,raiz],[0,raiz]];
    p.vincos=[F,F+H,F+2*H];
    p.vincoLingueta=[x-q,raiz,x+q,raiz];
    p.fenda={x:x,y:slotY,l:L,raio:R,abertura:abertura};
    return p;
  }

  function parede(w,h,diametro,recuo,fixacao,blockH) {
    if (recuo<diametro/2+2 || recuo+diametro/2>h-fixacao-blockH-5 ||
        diametro/2+2>w/2) throw Error('O furo, o bloco ou a área de fixação não cabem com respiro na cartela.');
    return {w:w,h:h,contorno:cantos(w,h),paineis:[painel('Cartela',0,h)],
      vincos:[],placas:[],furos:[[w/2,recuo,diametro]],fixacao:h-fixacao-blockH};
  }

  function wire(w,passo,diametro,margem) {
    var intervalo=25.4/passo;
    var n=Math.floor((w-2*margem)/intervalo)+1;
    if (n<2 || diametro>=intervalo-1 || margem<diametro/2+2) throw Error('A furação não cabe. Revise passo, furo e margem lateral.');
    var primeiro=(w-(n-1)*intervalo)/2, xs=[];
    for(var i=0;i<n;i++) xs.push(primeiro+i*intervalo);
    return xs;
  }

  return {prisma:prisma,parede:parede,wire:wire,cantos:cantos};
}());
