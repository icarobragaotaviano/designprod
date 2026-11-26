/* Campos, medidas e tipografia compartilhados por calendários e cadernos. */
var IBDEditorial = (function (p) {
  var pt=p.pt, metricas={};
  var bordas=['Sem reserva','Superior','Inferior','Esquerda','Direita'];

  function campo(id,rotulo,padrao,grupo) {
    return {id:id,rotulo:rotulo,padrao:padrao,grupo:grupo};
  }

  function escolha(id,rotulo,opcoes,padrao,grupo) {
    return {id:id,rotulo:rotulo,tipo:'escolha',opcoes:opcoes,padrao:padrao||opcoes[0],grupo:grupo};
  }

  function simNao(id,rotulo,padrao,grupo) {
    return {id:id,rotulo:rotulo,tipo:'booleano',padrao:padrao,grupo:grupo};
  }

  function margem(valor,nome,maximo) {
    return p.num(valor,nome,0,maximo);
  }

  function medir(v) {
    var w=p.num(v.w,'Largura final',30,1200), h=p.num(v.h,'Altura final',30,1200);
    var sangria=margem(v.sangria,'Sangria',30), arte=margem(v.arte,'Margem de arte',120);
    var acabamento=0;
    if (v.borda!==bordas[0]) acabamento=margem(v.acabamento,'Reserva de acabamento',120);
    var minW=w+2*sangria, minH=h+2*sangria;
    if (!!v.sw!==!!v.sh) throw Error('Preencha as duas medidas da folha ou deixe ambas vazias.');
    var sw=v.sw ? p.num(v.sw,'Largura da folha',30,1500) : minW;
    var sh=v.sh ? p.num(v.sh,'Altura da folha',30,1500) : minH;
    if (sw<minW-0.000001 || sh<minH-0.000001) throw Error('O formato final mais a sangria precisa caber na folha.');
    var m={w:w,h:h,sw:sw,sh:sh,sangria:sangria,arte:arte,acabamento:acabamento,borda:v.borda,
      x:(sw-w)/2,y:(sh-h)/2};
    area(m,false);
    return m;
  }

  function area(m,espelhar) {
    var borde=m.borda;
    if (espelhar && borde==='Esquerda') borde='Direita';
    else if (espelhar && borde==='Direita') borde='Esquerda';
    var top=m.arte,right=m.arte,bottom=m.arte,left=m.arte;
    var reserva=Math.max(m.arte,m.acabamento);
    if (borde==='Superior') top=reserva;
    if (borde==='Inferior') bottom=reserva;
    if (borde==='Esquerda') left=reserva;
    if (borde==='Direita') right=reserva;
    var w=m.w-left-right,h=m.h-top-bottom;
    if (w<18 || h<18) throw Error('As margens deixam menos de 18 mm de área útil. Revise o formato e as reservas.');
    return {x:m.x+left,y:m.y+top,w:w,h:h,borda:borde};
  }

  function geometria(titulo,base,duplex) {
    var f=[
      campo('w','Largura final (mm)',base.w,'Formato final'),
      campo('h','Altura final (mm)',base.h,'Formato final'),
      campo('sangria','Sangria (mm)',base.sangria,'Formato final'),
      campo('sw','Largura da folha (mm)','','Folha de máquina'),
      campo('sh','Altura da folha (mm)','','Folha de máquina'),
      campo('arte','Margem da arte (mm)',base.arte,'Área segura'),
      escolha('borda','Borda de acabamento',bordas,base.borda,'Área segura'),
      campo('acabamento','Reserva na borda (mm)',base.acabamento,'Área segura')
    ];
    if (duplex) f.push(simNao('espelho','Espelhar a lateral no verso',true,'Área segura'));
    var v=IBD.ui.formulario(titulo,f,'Continuar',{largura:760,rotuloLargura:140,
      subtitulo:'Folha em branco usa o formato final mais a sangria. Com folha maior, a peça fica centralizada.'});
    if (!v) return null;
    var m=medir(v);
    m.espelho=!!v.espelho;
    return m;
  }

  function novo(m,nomes) {
    var n=nomes.length, gap=10;
    var maxColunas=Math.floor((4300+gap)/(m.sw+gap));
    var maxLinhas=Math.floor((4300+gap)/(m.sh+gap));
    if (maxColunas*maxLinhas<n) throw Error('As '+n+' folhas ultrapassam a área do Illustrator. Gere um lote menor ou reduza a folha.');
    var colunas=Math.min(maxColunas,Math.max(Math.ceil(n/maxLinhas),Math.ceil(Math.sqrt(n*m.sh/m.sw))));
    metricas={};
    return p.novaGrade([m.sw,m.sh],n,colunas,gap,nomes);
  }

  function guia(camada,a,x,y,w,h,cor,nome) {
    var r=p.ret(camada,a,x,y,w,h,cor,0.4);
    r.name=nome;
    r.guides=true;
  }

  function criarGuias(doc,m,versos) {
    var g=doc.layers.add();
    g.name='Guias · corte, sangria, arte e acabamento';
    g.printable=false;
    var azul=p.cmyk(90,20,0,0), magenta=p.cmyk(0,90,0,0), verde=p.cmyk(65,0,90,0);
    for (var i=0;i<doc.artboards.length;i++) {
      var a=doc.artboards[i].artboardRect;
      var r=area(m,!!versos[i]);
      guia(g,a,m.x,m.y,m.w,m.h,azul,'Formato final');
      if (m.sangria>0) guia(g,a,m.x-m.sangria,m.y-m.sangria,m.w+2*m.sangria,m.h+2*m.sangria,magenta,'Sangria');
      if (m.arte>0) guia(g,a,m.x+m.arte,m.y+m.arte,m.w-2*m.arte,m.h-2*m.arte,verde,'Margem da arte · '+m.arte+' mm');
      if (m.acabamento>0) {
        var x1=m.x,y1=m.y,x2=m.x+m.w,y2=m.y+m.h;
        if (r.borda==='Superior') {y1+=m.acabamento; y2=y1;}
        if (r.borda==='Inferior') {y2-=m.acabamento; y1=y2;}
        if (r.borda==='Esquerda') {x1+=m.acabamento; x2=x1;}
        if (r.borda==='Direita') {x2-=m.acabamento; x1=x2;}
        var linha=p.linha(g,a,[x1,y1,x2,y2],magenta,0.4,false);
        linha.name='Acabamento · '+r.borda+' · '+m.acabamento+' mm';
        linha.guides=true;
      }
    }
    g.locked=true;
  }

  function cor(valor,nome) {
    var partes=String(valor).replace(/^\s+|\s+$/g,'').split(/\s+/);
    if (partes.length!==4) throw Error(nome+' deve ter quatro valores separados por espaços. Exemplo: 0 0 0 100.');
    var c=[];
    for (var i=0;i<4;i++) c.push(p.num(partes[i],nome+' ('+'CMYK'.charAt(i)+')',0,100));
    return p.cmyk(c[0],c[1],c[2],c[3]);
  }

  function estilo(nome,tamanho,tinta,pasta) {
    var font=null;
    if (nome!=='Fonte do documento') {
      try {font=app.textFonts.getByName(nome);}
      catch (_) {throw Error('A fonte '+nome+' deixou de estar disponível no Illustrator.');}
    }
    return {fonte:font,tamanho:p.num(tamanho,pasta+' em pontos',1,150),cor:cor(tinta,pasta+' CMYK')};
  }

  function tipografia(titulo,papeis,extras) {
    var fontes=[];
    for (var i=0;i<app.textFonts.length;i++) fontes.push(app.textFonts[i].name);
    fontes.sort();
    fontes.unshift('Fonte do documento');
    var campos=[], resultado={};
    for (var j=0;j<papeis.length;j++) {
      var r=papeis[j];
      campos.push(escolha(r[0]+'fonte','Fonte',fontes,destacarFonte(fontes,r[4]),r[1]));
      campos.push(campo(r[0]+'pt','Tamanho (pt)',r[2],r[1]));
      campos.push(campo(r[0]+'cmyk','Cor CMYK (%)',r[3],r[1]));
    }
    for (var k=0;k<extras.length;k++) campos.push(extras[k]);
    var v=IBD.ui.formulario(titulo,campos,'Continuar',{largura:745,
      subtitulo:'Os tamanhos são preservados. Digite C M Y K separados por espaços. As fontes vêm do Illustrator.'});
    if (!v) return null;
    for (var n=0;n<papeis.length;n++) {
      var id=papeis[n][0];
      resultado[id]=estilo(v[id+'fonte'],v[id+'pt'],v[id+'cmyk'],papeis[n][1]);
    }
    resultado.opcoes=v;
    return resultado;
  }

  function destacarFonte(fontes,preferida) {
    for (var i=0;i<fontes.length;i++) if (fontes[i]===preferida) return preferida;
    return fontes[0];
  }

  function aplicar(t,s,tinta) {
    var a=t.textRange.characterAttributes;
    if (s.fonte) a.textFont=s.fonte;
    a.size=s.tamanho;
    a.fillColor=tinta||s.cor;
  }

  function texto(destino,a,r,pos,valor,s,alinhamento,tinta) {
    if (!valor) return;
    var chave=(s.fonte ? s.fonte.name : '')+'|'+s.tamanho+'|'+valor;
    var medidas=metricas[chave], t;
    if (!medidas) {
      t=destino.textFrames.pointText([a[0],a[1]]);
      t.contents=String(valor);
      aplicar(t,s,tinta);
      medidas={w:t.width,h:t.height,dx:t.left-a[0],dy:t.top-a[1]};
      metricas[chave]=medidas;
    }
    if (medidas.w>r.w*pt+0.1) {
      if (t) t.remove();
      throw Error('O texto “'+String(valor).slice(0,42)+'” excede a largura útil. Diminua a fonte ou amplie o formato.');
    }
    var x=r.x*pt;
    if (alinhamento==='centro') x+=(r.w*pt-medidas.w)/2;
    if (alinhamento==='direita') x+=r.w*pt-medidas.w;
    var y=a[1]-pos*pt+medidas.h/2;
    if (t) {
      t.left=a[0]+x;
      t.top=y;
    } else {
      t=destino.textFrames.pointText([a[0]+x-medidas.dx,y-medidas.dy]);
      t.contents=String(valor);
      aplicar(t,s,tinta);
    }
    return t;
  }

  function quebrar(camada,conteudo,s,w) {
    if (!conteudo) return [];
    var t=camada.textFrames.pointText([0,0]);
    try {
      var palavras=conteudo.split(/\s+/), linhas=[], atual='';
      for (var i=0;i<palavras.length;i++) {
        var proximo=atual ? atual+' '+palavras[i] : palavras[i];
        t.contents=proximo; aplicar(t,s);
        if (t.width<=w*pt+0.1) {
          atual=proximo;
          continue;
        }
        if (!atual) throw Error('“'+palavras[i]+'” não cabe no rodapé. Ajuste a largura ou a fonte.');
        linhas.push(atual); atual=palavras[i];
        t.contents=atual; aplicar(t,s);
        if (t.width>w*pt+0.1) throw Error('“'+atual+'” não cabe no rodapé. Ajuste a largura ou a fonte.');
      }
      if (atual) linhas.push(atual);
      return linhas;
    } finally {t.remove();}
  }

  return {campo:campo,escolha:escolha,simNao:simNao,medir:medir,area:area,geometria:geometria,novo:novo,
    criarGuias:criarGuias,tipografia:tipografia,cor:cor,texto:texto,quebrar:quebrar};
}(IBDPP));
