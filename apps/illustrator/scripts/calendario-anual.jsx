/**
 * @ibd-id illustrator/calendario-anual
 * @ibd-titulo Calendário anual
 * @ibd-descricao Gera calendários editáveis de mesa em 14 pranchetas, de parede com 12 meses em bloco inferior e de bolso em duas faces.
 * @ibd-app illustrator
 * @ibd-versao 1.0.0
 * @ibd-tags calendário, folhinha, wire-o, calendário de mesa, cartão
 * @ibd-doc docs/folha/README.md
 */
#target illustrator
#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-preimpressao.jsx"

(function (p) {
  var titulo='Calendário anual', pt=p.pt;
  var modelos=['Mesa · 14 páginas','Parede · folhinha','Bolso · 90 × 50 mm'];
  var dias=['D','S','T','Q','Q','S','S'];
  var cores;

  function texto(camada,a,x,y,n,valor,cor,posicao,limite) {
    var t=camada.textFrames.pointText([a[0]+x*pt,a[1]-y*pt]);
    t.contents=String(valor);
    var chars=t.textRange.characterAttributes;
    chars.size=n;
    chars.fillColor=cor;
    if (limite && t.width>limite*pt) chars.size=n*limite*pt/t.width;
    if (posicao==='centro') t.left-=t.width/2;
    return t;
  }

  function mes(camada,a,ano,m,x,y,w,h,compacto) {
    var info=p.mes(ano,m);
    var diaW=w/7, linhaH=h/9;
    var xTexto=x+w/2, anoMes=compacto ? info.nome : info.nome+' '+ano;
    var tit=Math.min(compacto ? 16 : 32,linhaH*pt*0.83,w*pt/6);
    var corpo=Math.min(compacto ? 13 : 24,linhaH*pt*0.65,diaW*pt*0.68);
    texto(camada,a,xTexto,y+linhaH,tit,anoMes,cores.preto,'centro',w*0.95);
    for (var i=0;i<7;i++) {
      var centro=x+diaW*(i+0.5);
      texto(camada,a,centro,y+2*linhaH,corpo*0.82,dias[i],i===0||i===6 ? cores.destaque : cores.preto,'centro');
    }
    for (var d=1;d<=info.dias;d++) {
      var celula=info.inicio+d-1, col=celula%7, linha=Math.floor(celula/7);
      texto(camada,a,x+diaW*(col+0.5),y+(3+linha)*linhaH,corpo,d,
        col===0||col===6 ? cores.destaque : cores.preto,'centro');
    }
  }

  function guiasMesa(d,w) {
    var guia=d.layers.add();
    guia.name='Wire-o · margem de segurança 15 mm';
    guia.printable=false;
    for (var i=0;i<d.artboards.length;i++) {
      var linha=p.linha(guia,d.artboards[i].artboardRect,[0,15,w,15],cores.destaque,0.5,false);
      linha.guides=true;
      linha.name='Wire-o · 15 mm';
    }
    guia.locked=true;
  }

  function mesa(d,ano,w,h) {
    var camada=d.layers[0]; camada.name='Calendário de mesa';
    var a=d.artboards[0].artboardRect, fim=d.artboards[13].artboardRect;
    texto(camada,a,w/2,h*0.57,64,ano,cores.preto,'centro',w-20);
    texto(camada,a,w/2,h*0.72,12,'CALENDÁRIO',cores.destaque,'centro',w-20);
    for (var i=0;i<12;i++) {
      mes(camada,d.artboards[i+1].artboardRect,ano,i,w*0.1,21,w*0.8,h-27,false);
    }
    texto(camada,fim,w/2,h*0.6,24,ano,cores.preto,'centro',w-20);
    guiasMesa(d,w);
  }

  function parede(d,ano,w,h) {
    var a=d.artboards[0].artboardRect, camada=d.layers[0];
    camada.name='Folhinha anual';
    var m=w*0.04, y=h*0.48, cw=(w-2*m)/4, ch=(h-y-4-m)/3;
    texto(camada,a,m,y,24,ano,cores.preto,null,w-2*m);
    for (var i=0;i<12;i++) mes(camada,a,ano,i,m+(i%4)*cw,y+4+Math.floor(i/4)*ch,cw*0.94,ch,true);
  }

  function bolso(d,ano) {
    var camada=d.layers[0]; camada.name='Cartão calendário';
    for (var i=0;i<2;i++) {
      var a=d.artboards[i].artboardRect;
      texto(camada,a,45,4.6,7.8,i===0 ? ano+' · JAN–JUN' : ano+' · JUL–DEZ',cores.preto,'centro',84);
      for (var j=0;j<6;j++) mes(camada,a,ano,i*6+j,3+(j%3)*28,5+Math.floor(j/3)*21,25,21,true);
    }
  }

  function criar(ano,modelo,w,h) {
    var nomes, d;
    if (modelo===modelos[0]) {
      nomes=['01 · Capa'];
      for (var i=0;i<12;i++) {
        var ordem=String(i+2);
        if (ordem.length<2) ordem='0'+ordem;
        nomes.push(ordem+' · '+p.mes(ano,i).nome);
      }
      nomes.push('14 · Contracapa');
      d=p.novaGrade([w,h],14,4,10,nomes);
    } else if (modelo===modelos[1]) {
      d=p.novaGrade([w,h],1,1,0,['Folhinha '+ano]);
    } else {
      d=p.novaGrade([90,50],2,2,10,['01 · Janeiro a junho','02 · Julho a dezembro']);
    }
    try {
      cores={preto:p.cmyk(0,0,0,100),destaque:p.cmyk(0,82,65,28)};
      if (modelo===modelos[0]) mesa(d,ano,w,h);
      else if (modelo===modelos[1]) parede(d,ano,w,h);
      else bolso(d,ano);
      return d;
    } catch(e) { p.fechar(d); throw e; }
  }

  p.executar(titulo,function () {
    var base=IBD.ui.formulario(titulo,[
      {id:'ano',rotulo:'Ano',padrao:String(new Date().getFullYear()+1)},
      {id:'modelo',rotulo:'Modelo',tipo:'escolha',opcoes:modelos,padrao:modelos[0]}
    ],'Continuar');
    if (!base) return;
    var ano=p.num(base.ano,'Ano',1900,2199,true), w, h;
    if (base.modelo!==modelos[2]) {
      var mesaPadrao=base.modelo===modelos[0];
      var v=IBD.ui.formulario(base.modelo,[
        {id:'w',rotulo:'Largura (mm)',padrao:mesaPadrao?'210':'290'},
        {id:'h',rotulo:'Altura (mm)',padrao:mesaPadrao?'150':'390'}
      ],'Gerar');
      if (!v) return;
      w=p.num(v.w,'Largura',mesaPadrao?100:180,700);
      h=p.num(v.h,'Altura',mesaPadrao?75:220,1000);
    }
    var d=criar(ano,base.modelo,w,h);
    IBD.ui.resumo(titulo,[base.modelo+' · '+ano,d.artboards.length+' pranchetas em um novo documento CMYK.']);
  });
}(IBDPP));
