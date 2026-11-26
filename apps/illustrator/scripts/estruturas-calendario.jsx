/**
 * @ibd-id illustrator/estruturas-calendario
 * @ibd-titulo Estruturas de calendário
 * @ibd-descricao Planifica cavaletes, tendas e cartelas com facas spot, vinco, trava de encaixe, bases empastadas e miolo Wire-o tombado.
 * @ibd-app illustrator
 * @ibd-versao 1.0.0
 * @ibd-tags calendário, cavalete, faca, vinco, vira, wire-o, tenda, encaixe, fibra, pôster
 * @ibd-doc docs/folha/README.md
 */
#target illustrator
#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-preimpressao.jsx"
#include "../../../core/extendscript/ibd-editorial.jsx"
#include "../../../core/extendscript/ibd-datas-calendario.jsx"
#include "../../../core/extendscript/ibd-layout-calendario.jsx"
#include "../../../core/extendscript/ibd-estruturas-calendario.jsx"

(function(p,e,datas,layout,geo) {
  var titulo='Estruturas de calendário', pt=p.pt;
  var modos=['Cavalete Wire-o','Tenda autoportante','Cartela e bloco destacável','Pôster de folha única','Miolo Wire-o · 14 faces'];
  var fechamentos=['Aba colada','Trava sem cola','Base dura empastada'];
  var fibras=['Paralela aos vincos','Perpendicular aos vincos','A conferir'];
  var orientacoes=['Versos tombados (cabeça com pé)','Ordem de leitura'];

  function camada(doc,nome,imprime) {
    var l=doc.layers.add();
    l.name=nome;l.printable=imprime;
    return l;
  }

  function tecnico(path,cor,tracejado) {
    path.filled=false;path.stroked=true;path.strokeColor=cor;
    path.strokeWidth=0.5;path.strokeOverprint=true;
    path.strokeCap=StrokeCap.BUTTENDCAP;
    if(tracejado) path.strokeDashes=[2*pt,1*pt];
    return path;
  }

  function desenho(parent,a,pts,cor,nome,raio) {
    var path=parent.pathItems.add();
    function pos(x,y){return [a[0]+x*pt,a[1]-y*pt];}
    function inserir(x,y){var no=path.pathPoints.add(), xy=pos(x,y);no.anchor=xy;no.leftDirection=xy;no.rightDirection=xy;return no;}
    // Arredonda os extremos da lingueta mantendo os segmentos retos e um único perímetro.
    for(var i=0;i<pts.length;i++){
      var b=pts[i], before=pts[(i+pts.length-1)%pts.length], after=pts[(i+1)%pts.length];
      if(raio && i>=4 && i<=9){
        var dx=before[0]-b[0],dy=before[1]-b[1],ux=after[0]-b[0],uy=after[1]-b[1];
        var t=raio/Math.sqrt(dx*dx+dy*dy),u=raio/Math.sqrt(ux*ux+uy*uy);
        var n1=inserir(b[0]+dx*t,b[1]+dy*t);
        n1.rightDirection=pos(b[0]+dx*t*0.4,b[1]+dy*t*0.4);
        var n2=inserir(b[0]+ux*u,b[1]+uy*u);
        n2.leftDirection=pos(b[0]+ux*u*0.4,b[1]+uy*u*0.4);
      } else inserir(b[0],b[1]);
    }
    path.closed=true;path.name=nome;
    return tecnico(path,cor,false);
  }

  function fenda(parent,a,s,cor) {
    var path=parent.pathItems.add();
    var r=s.raio, ang=Math.asin(s.abertura/(2*r));
    var x1=s.x-s.l/2+r,x2=s.x+s.l/2-r,y=s.y;
    function pos(x,y){return [a[0]+x*pt,a[1]-y*pt];}
    function arco(cx,de,ate) {
      var n=Math.ceil(Math.abs(ate-de)/(Math.PI/2)), passo=(ate-de)/n;
      var previous=null;
      for(var i=0;i<=n;i++) {
        var t=de+i*passo, x=cx+r*Math.cos(t), yy=y+r*Math.sin(t);
        var dx=-r*Math.sin(t),dy=r*Math.cos(t);
        var k=4/3*Math.tan(passo/4);
        var no=path.pathPoints.add();
        var xy=pos(x,yy);
        no.anchor=xy;no.leftDirection=xy;no.rightDirection=xy;
        if(i>0) {
          no.leftDirection=pos(x-k*dx,yy-k*dy);
          previous.rightDirection=pos(px+k*pdx,py+k*pdy);
        }
        var px=x,py=yy,pdx=dx,pdy=dy;
        previous=no;
      }
    }
    arco(x1,ang,2*Math.PI-ang);
    arco(x2,Math.PI+ang,3*Math.PI-ang);
    path.name='Fenda única · '+s.l.toFixed(2)+' mm · alívios R'+s.raio;
    path.closed=true;
    tecnico(path,cor,false);
  }

  function furo(parent,a,x,y,d,redondo) {
    if(!redondo) return p.ret(parent,a,x-d/2,y-d/2,d,d,p.cmyk(0,0,0,100),0);
    return parent.pathItems.ellipse(a[1]-(y-d/2)*pt,a[0]+(x-d/2)*pt,d*pt,d*pt);
  }

  function furos(doc,a,pares,w,wire,x0) {
    var xs=geo.wire(w,wire.passo,wire.furo,wire.margem);
    var l=camada(doc,'FUROS_WIREO',false);
    for(var i=0;i<pares.length;i++) for(var j=0;j<xs.length;j++) {
      var f=furo(l,a,x0+xs[j],pares[i],wire.furo,wire.redondo);
      f.filled=true;f.stroked=false;f.fillColor=p.cmyk(0,70,0,35);f.opacity=30;
    }
    l.locked=true;
  }

  function apresentacao(doc,a,m,offset,config,wire) {
    var l=camada(doc,'GUIAS_SEGURANCA',false);
    var s=p.cmyk(75,15,0,0), zona=p.cmyk(0,85,0,0);
    var rec=config.margem;
    if (rec>0) for(var i=0;i<m.paineis.length;i++) {
      var painel=m.paineis[i], margem=Math.min(rec,painel.h/3), lateral=Math.min(rec,m.w/4);
      var r=p.ret(l,a,offset+lateral,offset+painel.y+margem,m.w-2*lateral,painel.h-2*margem,s,0.35);
      r.name=painel.nome+' · área segura';r.guides=true;
    }
    var pares=[];
    if(wire){
      var face1=m.paineis[0], face2=m.paineis[m.paineis.length-2];
      if(config.tipo!=='cola') face2=m.paineis[2];
      function faixa(f,reflete) {
        var bx=config.tipo==='dura' ? config.vira : 0;
        var borda=reflete ? f.y+f.h : f.y;
        var yy=borda+(reflete ? -wire.reserva : wire.reserva);
        var linha=p.linha(l,a,[offset+bx,offset+yy,offset+bx+config.w,offset+yy],zona,0.5,false);
        linha.name='Wire-o · reserva '+wire.reserva+' mm';linha.guides=true;
        pares.push(offset+borda+(reflete ? -wire.recuo : wire.recuo));
      }
      if(config.tipo==='trava') face1=m.paineis[1];
      faixa(face1,config.tipo==='trava');faixa(face2,config.tipo!=='trava');
      furos(doc,a,pares,config.w,wire,offset+(config.tipo==='dura' ? config.vira : 0));
    }
    if (m.vincos.length || m.placas.length) {
      var y=offset+(m.vincos.length ? m.vincos[0] : m.paineis[1].y);
      var f=p.linha(l,a,[offset+6,y,offset+m.w-6,y],s,0.5,false);
      f.name='FIBRA PARALELA AO VINCO · eixo horizontal';f.guides=true;
    }
    l.locked=true;
  }

  function corte(doc,a,modelo,borda) {
    var corte=camada(doc,'FACA_CORTE',true), spot=p.spot(doc,'Corte');
    var b=[a[0]+borda*pt,a[1]-borda*pt,a[2]-borda*pt,a[3]+borda*pt];
    desenho(corte,b,modelo.contorno,spot,'Perímetro',modelo.fenda ? 0.65 : 0);
    if(modelo.fenda) fenda(corte,b,modelo.fenda,spot);
    for(var i=0;i<modelo.furos.length;i++){
      var x=modelo.furos[i];
      var h=tecnico(furo(corte,b,x[0],x[1],x[2],true),spot,false);
      h.name='Furo / ilhós · Ø '+x[2]+' mm';
    }
    if(modelo.placas.length) {
      var placas=camada(doc,'PAPELOES · corte separado',false);
      for(var j=0;j<modelo.placas.length;j++){
        var q=modelo.placas[j],r=tecnico(p.ret(placas,b,q[0],q[1],q[2],q[3],spot,0.5),spot,false);
        r.name='Papelão · '+modelo.paineis[j].nome;
      }
      placas.locked=true;
    }
    if(modelo.vincos.length){
      var vinco=camada(doc,'FACA_VINCO',true), verde=p.spot(doc,'Vinco');
      verde.spot.color=p.cmyk(88,0,95,15);
      for(var k=0;k<modelo.vincos.length;k++){
        var y=modelo.vincos[k];
        tecnico(p.linha(vinco,b,[0,y,modelo.w,y],verde,0.5,true),verde,true).name='Vinco '+(k+1);
      }
      if(modelo.vincoLingueta) tecnico(p.linha(vinco,b,modelo.vincoLingueta,verde,0.5,true),verde,true).name='Vinco da lingueta';
    }
  }

  function tema(tit,dia) {
    var bold=null, regular=null;
    try {bold=app.textFonts.getByName('Arial-BoldMT');regular=app.textFonts.getByName('ArialMT');}catch(_){}
    var k=p.cmyk(0,0,0,100);
    return {titulo:{fonte:bold,tamanho:tit,cor:k},dia:{fonte:regular,tamanho:dia,cor:k},nota:{fonte:regular,tamanho:5.5,cor:k}};
  }

  function opCalendario(ano) {
    return {tipo:layout.tipos[0],tinta:p.cmyk(0,85,60,25),dados:datas.ler(ano,''),feriados:false,finde:true,mostraNota:false};
  }

  function grade(layer,a,ano,r,cols,rows,primeiro,gap,estilo,ajustes,inverter) {
    var w=(r.w-(cols-1)*gap)/cols,h=(r.h-(rows-1)*gap)/rows;
    for(var i=0;i<cols*rows;i++){
      var c=i%cols,n=Math.floor(i/cols),grupo=layer.groupItems.add();
      if(inverter){c=cols-c-1;n=rows-n-1;}
      var cell={x:r.x+c*(w+gap),y:r.y+n*(h+gap),w:w,h:h};
      layout.mes(grupo,a,ano,primeiro+i,cell,estilo,ajustes,true);
      if(inverter){
        grupo.rotate(180);
        // A origem da rotação preserva a célula mesmo nos meses com quatro ou cinco semanas.
        var b=grupo.geometricBounds;
        var alvoX=a[0]+(cell.x+cell.w/2)*pt,alvoY=a[1]-(cell.y+cell.h/2)*pt;
        grupo.translate(alvoX-(b[0]+b[2])/2,alvoY-(b[1]+b[3])/2);
      }
    }
  }

  function arte(doc,a,m,b,config,modo,ano) {
    var l=doc.layers[0];l.name='ARTE_IMPRESSAO';
    p.ret(l,a,0,0,m.w+2*b,m.h+2*b,p.cmyk(2,0,0,0),0).name='Fundo CMYK · sangria';
    var cinza=p.cmyk(0,0,0,92), tinta={tamanho:14,cor:cinza};
    if(modo===1){
      var folga=config.margem+2, estilo=tema(8,6), ajustes=opCalendario(ano);
      for(var i=0;i<m.paineis.length;i++){
        var f=m.paineis[i], inicio=f.nome==='Verso' ? 6 : 0;
        if(f.nome!=='Frente' && f.nome!=='Verso') continue;
        grade(l,a,ano,{x:b+folga,y:b+f.y+folga,w:m.w-2*folga,h:f.h-2*folga},
          3,2,inicio,3,estilo,ajustes,config.tipo==='trava' ? f.nome==='Frente' : f.nome==='Verso');
      }
    } else if(modo===3) {
      var mg=config.margem+4, cab=m.h*0.42, limitePe=Math.max(mg,config.varao||0);
      e.texto(l,a,{x:b+mg,w:m.w-2*mg},b+cab-8,ano,tinta,'centro');
      grade(l,a,ano,{x:b+mg,y:b+cab,w:m.w-2*mg,h:m.h-cab-limitePe},4,3,0,4,tema(10,8),opCalendario(ano),false);
    }
  }

  function renderBase(m,config,modo,ano,wire) {
    var b=config.imprime ? 3 : 0, respiro=config.imprime ? b : 0.3;
    var doc=p.novaGrade([m.w+2*respiro,m.h+2*respiro],1,1,0,[modos[modo]]);
    try {
      var a=doc.artboards[0].artboardRect;
      if(config.imprime) arte(doc,a,m,b,config,modo,ano);
      else doc.layers[0].name='Base virgem · 0×0';
      corte(doc,a,m,respiro);
      apresentacao(doc,a,m,respiro,config,wire);
      if(config.varao) {
        var suporte=camada(doc,'FIXACAO_VARAO',false), y1=respiro+config.varao, y2=respiro+m.h-config.varao;
        var cor=p.cmyk(85,20,0,0);
        p.linha(suporte,a,[respiro,y1,respiro+m.w,y1],cor,0.4,false).guides=true;
        p.linha(suporte,a,[respiro,y2,respiro+m.w,y2],cor,0.4,false).guides=true;
        suporte.locked=true;
      }
      if(typeof m.fixacao==='number'){
        var g=camada(doc,'FIXACAO_BLOCO',false);
        var r=p.ret(g,a,respiro+config.margem,respiro+m.fixacao,m.w-2*config.margem,config.blockH,p.cmyk(100,0,0,0),0.35);
        r.name='Área de aplicação do bloco';r.guides=true;
        g.locked=true;
      }
      return doc;
    } catch(err){p.fechar(doc);throw err;}
  }

  function renderPaginas(config,wire,ano) {
    var g={w:config.w,h:config.h,sw:config.w,sh:config.h,x:0,y:0,sangria:0,
      arte:config.margem,acabamento:wire ? wire.reserva : 0,borda:wire ? 'Superior' : 'Sem reserva'};
    var nomes=[];
    if(wire) nomes.push('01 · Capa');
    for(var i=0;i<12;i++) {
      var nome=p.mes(ano,i).nome;
      if(wire && config.tombado && i%2===0) nome+=' · verso tombado';
      nomes.push(nome);
    }
    if(wire) nomes.push(config.tombado ? '14 · Contracapa tombada' : '14 · Contracapa');
    var d=e.novo(g,nomes);
    try {
      var l=d.layers[0];l.name='ARTE_IMPRESSAO';
      var tecnica=camada(d,'GUIAS_SEGURANCA',false);
      var f=wire ? camada(d,'FUROS_WIREO',false) : null;
      var serrilha=config.serrilha ? camada(d,'FACA_SERRILHA',true) : null;
      var sep=serrilha ? p.spot(d,'Serrilha') : null;
      if(sep) sep.spot.color=p.cmyk(90,35,0,10);
      var xs=wire ? geo.wire(g.w,wire.passo,wire.furo,wire.margem) : [];
      var tip=tema(wire ? 20 : 12,wire ? 12 : 8), ajustes=opCalendario(ano), r=e.area(g,false);
      if(config.serrilha) {
        var corteY=Math.max(10,config.margem);
        r.y+=corteY+2-config.margem;
        r.h=g.h-config.margem-r.y;
      }
      for(var j=0;j<nomes.length;j++){
        var a=d.artboards[j].artboardRect, grupo=l.groupItems.add(), verso=wire && config.tombado && j%2===1;
        if(wire && (j===0 || j===13)) e.texto(grupo,a,r,r.y+r.h/2,ano,tip.titulo,'centro');
        else layout.mes(grupo,a,ano,wire ? j-1 : j,r,tip,ajustes,false);
        if(verso){
          var b=grupo.geometricBounds;
          grupo.rotate(180);
          grupo.translate(a[0]+a[2]-b[0]-b[2],a[1]+a[3]-b[1]-b[3]);
        }
        if(wire){
          var y=verso ? g.h-wire.reserva : wire.reserva;
          var furoY=verso ? g.h-wire.recuo : wire.recuo;
          var guia=p.linha(tecnica,a,[0,y,g.w,y],p.cmyk(0,85,0,0),0.5,false);
          guia.name='Reserva Wire-o · '+wire.reserva+' mm';guia.guides=true;
          for(var k=0;k<xs.length;k++){
            var h=furo(f,a,xs[k],furoY,wire.furo,wire.redondo);
            h.filled=true;h.stroked=false;h.fillColor=p.cmyk(0,70,0,35);h.opacity=30;
          }
        } else {
          var yS=Math.max(10,config.margem), faixa=[0,yS,g.w,yS];
          var s=p.linha(tecnica,a,faixa,p.cmyk(0,85,0,0),0.5,true);
          s.name='Guia de microsserrilha';s.guides=true;
          if(serrilha) tecnico(p.linha(serrilha,a,faixa,sep,0.5,true),sep,true).name='Microsserrilha';
        }
      }
      tecnica.locked=true;
      if(f)f.locked=true;
      return d;
    } catch(err){p.fechar(d);throw err;}
  }

  function mm(v,nome,min,max) {return p.num(v,nome,min,max);}
  function wireo(w,h) {
    var v=IBD.ui.formulario('Furação de Wire-o',[
      e.escolha('passo','Passo',['3:1','2:1'],'3:1','Furação'),
      e.escolha('forma','Geometria',['Redonda','Quadrada'],'Redonda','Furação'),
      e.campo('furo','Diâmetro/lado (mm)','4','Furação'),
      e.campo('margem','Margem lateral (mm)','8','Posição'),
      e.campo('recuo','Centro desde a borda','7','Posição'),
      e.campo('reserva','Área de segurança','15','Posição')
    ],'Continuar',{subtitulo:'Os furos são simulações em camada não imprimível. Use o passo correspondente ao seu pente.'});
    if(!v) return null;
    var f=mm(v.furo,'Furo',1,9), recuo=mm(v.recuo,'Recuo do centro',2,25), reserva=mm(v.reserva,'Segurança',4,h/2);
    if(recuo<f/2+1 || recuo+f/2+1>reserva)throw Error('O furo precisa caber integralmente na reserva com respiro.');
    var wire={passo:v.passo==='3:1' ? 3 : 2,redondo:v.forma==='Redonda',furo:f,recuo:recuo,reserva:reserva,
      margem:mm(v.margem,'Margem lateral',3,w/4)};
    geo.wire(w,wire.passo,f,wire.margem);
    return wire;
  }

  function opPrisma(v,config) {
    var campos=[
      e.campo('fundo','Fundo de apoio (mm)',String(Math.round(config.h*0.48)),'Estrutura'),
      e.escolha('fibra','Fibra do material',fibras,fibras[2],'Estrutura')
    ];
    var tipo=config.tipo;
    if(tipo==='cola') campos.push(e.campo('aba','Aba de colagem (mm)','22','Estrutura'));
    if(tipo==='dura'){
      campos.push(e.campo('caliper','Papelão (mm)','1,9','Cartonagem'),e.campo('canal','Canaleta (mm)','3,5','Cartonagem'),
        e.campo('vira','Vira (mm)','18','Cartonagem'));
    }
    if(tipo==='trava') {
      campos.push(e.campo('aba','Sobreposição (mm)','10','Estrutura'),e.campo('caliper','Cartão (mm)','0,45','Estrutura'),
        e.campo('neck','Pescoço (mm)',String(Math.round(config.w*0.48)),'Trava'),e.campo('lingueta','Lingueta (mm)','18','Trava'),
        e.campo('orelha','Orelha por lado (mm)','2,5','Trava'),e.campo('folga','Folga da fenda (mm)','0,8','Trava'),
        e.campo('raio','Raio de alívio (mm)','0,9','Trava'));
    }
    var r=IBD.ui.formulario(v.modo+' · medidas',campos,'Continuar',{largura:720,rotuloLargura:138,
      subtitulo:'O vinco é horizontal na planificação. Confira o sentido da fibra antes de impor a peça.'});
    if(!r) return null;
    config.fibra=r.fibra;
    config.fundo=mm(r.fundo,'Fundo de apoio',20,Math.min(500,config.h*1.5));
    if(tipo==='cola') config.aba=mm(r.aba,'Aba',10,60);
    if(tipo==='dura'){
      config.caliper=mm(r.caliper,'Papelão',0.5,5);
      config.canal=mm(r.canal,'Canaleta',2,10);
      config.vira=mm(r.vira,'Vira',10,30);
    }
    if(tipo==='trava') {
      config.aba=mm(r.aba,'Sobreposição',5,35);
      config.caliper=mm(r.caliper,'Cartão',0.15,2);
      config.neck=mm(r.neck,'Pescoço',10,config.w-10);
      config.lingueta=mm(r.lingueta,'Lingueta',10,35);
      config.orelha=mm(r.orelha,'Orelha por lado',1,5);
      config.folga=mm(r.folga,'Folga',0.3,2);
      config.raio=mm(r.raio,'Raio de alívio',0.5,2);
    }
    return geo.prisma(config);
  }

  p.executar(titulo,function(){
    var v=IBD.ui.formulario(titulo,[
      e.escolha('modo','Modelo',modos),e.campo('ano','Ano',String(new Date().getFullYear()+1))
    ],'Continuar',{subtitulo:'Gere a planificação, o desenho técnico e a simulação de acabamento.'});
    if(!v) return;
    var ano=p.num(v.ano,'Ano',1900,2199,true), modo=0;
    for(var i=0;i<modos.length;i++) if(modos[i]===v.modo) modo=i;
    var parede=modo===2||modo===3, c=[e.campo('w','Largura (mm)',parede ? '328' : '150','Formato'),
      e.campo('h','Altura (mm)',parede ? '478' : '120','Formato'),
      e.campo('margem','Margem de arte (mm)','5','Formato')];
    if(modo<2) c.push(e.escolha('tipo','Fechamento',modo===0 ? fechamentos : fechamentos.slice(0,2),null,'Estrutura'));
    if(modo!==4) c.push(e.simNao('imprime','Impressa com 3 mm de sangria',true,'Estrutura'));
    if(modo===3) c.push(e.escolha('fixacao','Acabamento',['Furo / ilhós','Varão'],null,'Estrutura'));
    if(modo===4) c.push(e.escolha('orientacao','Orientação',orientacoes,null,'Impressão'));
    var r=IBD.ui.formulario(v.modo,c,'Continuar',{subtitulo:'Informe as medidas de cada face do cavalete ou o formato final do modelo de parede.'});
    if(!r) return;
    var config={w:mm(r.w,'Largura',parede ? 170 : 75,800),h:mm(r.h,'Altura',parede ? 230 : 70,800),
      margem:mm(r.margem,'Margem de arte',0,30),imprime:r.imprime,tipo:'cola',
      tombado:r.orientacao===orientacoes[0]};
    if(r.tipo===fechamentos[1]) config.tipo='trava';
    if(r.tipo===fechamentos[2]) config.tipo='dura';
    var wire=null,modelo;
    if(modo<2){
      modelo=opPrisma(v,config);
      if(!modelo) return;
      if(config.fibra===fibras[1] && !confirm('A fibra informada cruza os vincos. Continuar para fazer uma prova?')) return;
    }
    if(modo===0 || modo===4){
      wire=wireo(config.w,config.h);
      if(!wire) return;
    }
    if(modo===4){
      renderPaginas(config,wire,ano);
      IBD.ui.resumo(titulo,['14 faces · '+r.orientacao,'Confira a virada horizontal com uma prova frente e verso.']);
      return;
    }
    if(parede){
      var furoAtivo=modo===2||r.fixacao==='Furo / ilhós';
      var campos=[];
      if(furoAtivo) campos.push(e.campo('furo','Ø do furo (mm)','5','Fixação'),e.campo('recuo','Centro desde o topo','12','Fixação'));
      if(modo===2) campos.push(e.campo('blockH','Altura do bloco','120','Bloco'),e.campo('fix','Recuo do bloco no pé','10','Bloco'),
        e.simNao('serrilha','Gerar spot Serrilha no bloco',false,'Bloco')); 
      if(!furoAtivo) campos.push(e.campo('varao','Reserva do varão (mm)','12','Fixação'));
      if(campos.length){
        var o=IBD.ui.formulario(v.modo+' · acabamento',campos,'Gerar');
        if(!o) return;
        config.blockH=modo===2 ? mm(o.blockH,'Altura do bloco',60,config.h-30) : 0;
        config.serrilha=!!o.serrilha;
        if(furoAtivo) {
          modelo=geo.parede(config.w,config.h,mm(o.furo,'Diâmetro',4,6),mm(o.recuo,'Recuo',4,60),
            modo===2 ? mm(o.fix,'Recuo do bloco',0,50) : 0,config.blockH);
        } else {
          config.varao=mm(o.varao,'Reserva do varão',5,30);
          modelo={w:config.w,h:config.h,contorno:geo.cantos(config.w,config.h),paineis:[{nome:'Pôster',y:0,h:config.h}],
            vincos:[],placas:[],furos:[]};
        }
      }
    }
    var doc=renderBase(modelo,config,modo,ano,wire);
    if(modo===2) {
      try {renderPaginas({w:config.w-2*config.margem,h:config.blockH,margem:config.margem,serrilha:config.serrilha},null,ano);}
      catch(err){p.fechar(doc);throw err;}
    }
    var info=['Formato aberto · '+modelo.w.toFixed(2)+' × '+modelo.h.toFixed(2)+' mm'];
    if(modo<2) {
      info.push('Inclinação teórica da face · '+modelo.inclinacao.toFixed(1)+'° · fibra paralela aos vincos');
      if(modelo.fenda) info.push('Fenda total · '+modelo.fenda.l.toFixed(2)+' mm · prototipe no cartão real.');
    }
    if(modo===2) info.push('Bloco em documento separado com 12 faces.');
    if(config.serrilha) info.push('Oculte FACA_SERRILHA ao exportar apenas a arte do bloco.');
    if(config.imprime) info.push('Para a impressão, oculte FACA_CORTE e FACA_VINCO.');
    IBD.ui.resumo(titulo,info);
  });
}(IBDPP,IBDEditorial,IBDCalendarioDatas,IBDCalendarioLayout,IBDEstruturas));
