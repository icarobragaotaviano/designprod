/**
 * @ibd-id illustrator/calendario-anual
 * @ibd-titulo Calendário anual
 * @ibd-descricao Gera calendários de mesa, parede e bolso com folha, margens, tipografia, destaques, feriados e rodapés por mês configuráveis.
 * @ibd-app illustrator
 * @ibd-versao 2.0.0
 * @ibd-tags calendário, folhinha, wire-o, calendário de mesa, cartão, feriados, rodapé
 * @ibd-doc docs/folha/README.md
 */
#target illustrator
#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-preimpressao.jsx"
#include "../../../core/extendscript/ibd-editorial.jsx"
#include "../../../core/extendscript/ibd-datas-calendario.jsx"

(function (p,e,datas) {
  var titulo='Calendário anual', pt=p.pt;
  var modelos=['Mesa · 14 páginas','Parede · folhinha','Bolso · 2 faces'];
  var tipos=['Cor do número','Círculo preenchido','Contorno circular','Tarja','Sublinhado'];
  var alvos=['Feriados e fins de semana','Somente feriados','Somente fins de semana','Nenhum'];
  var modosNota=['Rodapé em cada mês','Somente destaque das datas'];
  var dias=['D','S','T','Q','Q','S','S'];
  var bases=[
    {w:210,h:150,sangria:0,arte:5,borda:'Superior',acabamento:15,titulo:24,data:15,rodape:8},
    {w:290,h:390,sangria:0,arte:8,borda:'Sem reserva',acabamento:0,titulo:11,data:9,rodape:7},
    {w:90,h:50,sangria:0,arte:2,borda:'Sem reserva',acabamento:0,titulo:5,data:4,rodape:4}
  ];

  function editarDatas(ano,referencia) {
    var w=new Window('dialog','Feriados e rodapés · '+ano);
    w.orientation='column';w.alignChildren='fill';w.margins=16;
    w.add('statictext',undefined,'DD/MM | Feriado marca uma data. MM | Nota acrescenta texto ao rodapé do mês.');
    w.add('statictext',undefined,'Exemplos   19/03 | São José   ·   03 | Atendimento em horário especial');
    var input=w.add('edittext',undefined,referencia,{multiline:true,scrolling:true});
    input.preferredSize=[540,265];
    var botoes=w.add('group');
    botoes.alignment='right';
    botoes.add('button',undefined,'Cancelar',{name:'cancel'});
    botoes.add('button',undefined,'Gerar calendário',{name:'ok'});
    if (w.show()!==1) return null;
    return datas.ler(ano,input.text);
  }

  function temaDoModelo(base,modelo) {
    return e.tipografia('Tipografia, cor e destaques',[
      ['titulo','Título dos meses',base.titulo,'0 0 0 100','Arial-BoldMT'],
      ['dia','Dias e cabeçalho',base.data,'0 0 0 100','ArialMT'],
      ['nota','Rodapé',base.rodape,'0 0 0 85','ArialMT']
    ],[
      e.escolha('tipo','Marcador',tipos,tipos[1],'Destaques'),
      e.escolha('alvo','Marcar',alvos,alvos[0],'Destaques'),
      e.campo('tinta','Destaque CMYK (%)','0 82 65 28','Destaques'),
      e.escolha('notas','Texto dos feriados',modosNota,modelo===2 ? modosNota[1] : modosNota[0],'Rodapés')
    ]);
  }

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
    var grupo=camada.layers.add();grupo.name=calendario.nome;
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

  function criar(ano,modelo,g,tema,ajustes) {
    var nomes=[];
    if (modelo===0) {
      nomes.push('01 · Capa');
      for(var i=0;i<12;i++) nomes.push(('0'+(i+2)).slice(-2)+' · '+p.mes(ano,i).nome);
      nomes.push('14 · Contracapa');
    } else if(modelo===1) {
      nomes.push('Folhinha '+ano);
    } else {
      nomes=['01 · Janeiro a junho','02 · Julho a dezembro'];
    }
    var doc=e.novo(g,nomes);
    try {
      var camada=doc.layers[0];camada.name='Calendário · '+ano;
      var r=e.area(g,false);
      for(var j=0;j<nomes.length;j++) {
        var a=doc.artboards[j].artboardRect;
        if(modelo===0){
          if(j===0 || j===13) e.texto(camada,a,r,r.y+r.h/2,ano,tema.titulo,'centro');
          else mes(camada,a,ano,j-1,r,tema,ajustes,false);
          continue;
        }
        var cols=3,rows=2,inicio=j*6,desloc=tema.titulo.tamanho*1.45/pt;
        if(modelo===1) {
          cols=4;rows=3;inicio=0;
          desloc=Math.max(desloc,r.h*0.44);
        }
        var folga=Math.min(3,r.w/32), cw=(r.w-(cols-1)*folga)/cols, ch=(r.h-desloc-(rows-1)*folga)/rows;
        var cab=ano;
        if(modelo===2) cab=ano+(j===0 ? ' · JAN–JUN' : ' · JUL–DEZ');
        e.texto(camada,a,r,r.y+desloc-tema.titulo.tamanho*0.7/pt,cab,tema.titulo,'centro');
        for(var k=0;k<cols*rows;k++) {
          var celula={x:r.x+(cw+folga)*(k%cols),y:r.y+desloc+(ch+folga)*Math.floor(k/cols),w:cw,h:ch};
          mes(camada,a,ano,inicio+k,celula,tema,ajustes,true);
        }
      }
      e.criarGuias(doc,g,[]);
      return doc;
    } catch(err){p.fechar(doc);throw err;}
  }

  p.executar(titulo,function () {
    var calendarios=['Referência federal do Brasil','Lista em branco'];
    var ui=IBD.ui.formulario(titulo,[
      e.campo('ano','Ano',String(new Date().getFullYear()+1)),
      e.escolha('modelo','Modelo',modelos),
      e.escolha('feriados','Feriados iniciais',calendarios)
    ],'Continuar',{subtitulo:'Escolha o modelo. Você poderá editar todos os feriados e escrever uma nota para cada mês.'});
    if(!ui) return;
    var ano=p.num(ui.ano,'Ano',1900,2199,true);
    var modelo=0;
    if(ui.modelo===modelos[1]) modelo=1;
    if(ui.modelo===modelos[2]) modelo=2;
    var g=e.geometria('Formato, folha e margens',bases[modelo],false);
    if(!g) return;
    var tema=temaDoModelo(bases[modelo],modelo);
    if(!tema) return;
    var ref=ui.feriados===calendarios[0] ? datas.referencia(ano) : '';
    var lista=editarDatas(ano,ref);
    if(!lista) return;
    var op=tema.opcoes;
    var doc=criar(ano,modelo,g,tema,{
      tipo:op.tipo,tinta:e.cor(op.tinta,'Cor de destaque'), branco:p.cmyk(0,0,0,0), dados:lista,
      feriados:op.alvo===alvos[0]||op.alvo===alvos[1],finde:op.alvo===alvos[0]||op.alvo===alvos[2],
      mostraNota:op.notas===modosNota[0]
    });
    IBD.ui.resumo(titulo,[ui.modelo+' · '+ano+' · '+doc.artboards.length+' faces',
      'Formato final '+g.w+' × '+g.h+' mm · Folha '+g.sw+' × '+g.sh+' mm',
      'As linhas de corte, sangria e segurança são guias. Confira a lista de feriados da localidade antes da tiragem.']);
  });
}(IBDPP,IBDEditorial,IBDCalendarioDatas));
