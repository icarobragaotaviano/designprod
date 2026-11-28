/* Levanta ocorrências e prepara correções sem modificar o documento durante a análise. */
var IBDPreflightDigital=(function (p,regras,imagens) {
  var margemEps=0.005, overlay='_PREFLIGHT_ALERTAS';
  var fixos={branco:'Remover sobreimpressão de brancos',preto:'Sanear preto composto em texto pequeno e traço fino',
    mono:'Converter vetores e textos das páginas P&B para cinza',spot:'Ativar sobreimpressão nas cores da 5ª estação'};

  function cruzar(a,b){
    var r=[Math.max(a[0],b[0]),Math.min(a[1],b[1]),Math.min(a[2],b[2]),Math.max(a[3],b[3])];
    return r[0]<r[2]+margemEps && r[1]>r[3]-margemEps ? r : null;
  }

  function naPrancheta(r,a){
    return r[0]<a[2]-margemEps && r[2]>a[0]+margemEps && r[1]>a[3]+margemEps && r[3]<a[1]-margemEps;
  }

  function limites(item,memo){
    var r=item.visibleBounds;
    for(var x=item.parent;x && x.typename!=='Document';x=x.parent){
      if(x.typename!=='GroupItem' || !x.clipped)continue;
      var key=x.uuid ? '$'+x.uuid : null;
      var mascara=key && memo[key] || null;
      if(!mascara){
        var caminhos=x.pathItems;
        for(var i=0;i<caminhos.length;i++)if(caminhos[i].parent===x && caminhos[i].clipping){mascara=caminhos[i].geometricBounds;break;}
        if(!mascara){
          var compostos=x.compoundPathItems;
          for(var j=0;j<compostos.length;j++){
            var filhos=compostos[j].pathItems;
            if(compostos[j].parent===x && filhos.length && filhos[0] && filhos[0].clipping){mascara=compostos[j].geometricBounds;break;}
          }
        }
        if(key && mascara)memo[key]=mascara;
      }
      if(mascara){r=cruzar(r,mascara);if(!r)return null;}
    }
    return r;
  }

  function numero(n){return Math.round(n*100)/100;}
  function formato(r){return [(r[2]-r[0])/p.pt,(r[1]-r[3])/p.pt];}
  function ehMarca(item){
    for(var x=item;x && x.typename!=='Document';x=x.parent){
      if(x.typename==='Layer' && /^(marcas(?:\b|_)|imposição · marcas|folha · marcas|registro)/i.test(x.name))return true;
    }
    return false;
  }
  function ehBarcode(item){
    for(var x=item;x && x.typename!=='Document';x=x.parent){
      if(/barcode|c[oó]digo de barras|(?:^|\W)(ean|upc|gtin|qr)(?:$|\W)/i.test(x.name || ''))return true;
    }
    return false;
  }

  function analisar(d,o){
    var out={paginas:[],achados:[],fixes:[],criticos:0,alertas:0};
    var memo={}, jpeg={}, vistos={};
    var cores=o.modo==='Híbrido'?regras.paginas(o.coloridas,d.artboards.length):{};
    function avisar(nivel,regra,texto,pag,item,bounds,unico){
      if(unico){
        var key='$'+regra+'|'+pag+'|'+(item && item.uuid || '')+'|'+texto;
        if(vistos[key])return;
        vistos[key]=true;
      }
      out.achados.push({nivel:nivel,regra:regra,texto:texto,pagina:pag,item:item,bounds:bounds});
      if(nivel==='Bloqueio')out.criticos++;
      else out.alertas++;
    }

    for(var n=0;n<d.artboards.length;n++){
      var a=d.artboards[n], r=a.artboardRect, med=formato(r), k=n+1;
      var mono=o.modo==='P&B estrito' || o.modo==='Híbrido' && !cores[k];
      out.paginas.push({numero:k,nome:a.name,rect:r,mono:mono,colorida:false,indefinida:false,arte:false});
      if(!regras.encaixa(med[0],med[1],o.maxW,o.maxH)){
        avisar('Bloqueio','Folha excede o limite',numero(med[0])+' × '+numero(med[1])+' mm. Limite '+o.maxW+' × '+o.maxH+' mm.',k,null,r);
      }
      if(o.folhaW && o.folhaH && !((Math.abs(med[0]-o.folhaW)<0.1 && Math.abs(med[1]-o.folhaH)<0.1) ||
          (Math.abs(med[1]-o.folhaW)<0.1 && Math.abs(med[0]-o.folhaH)<0.1))){
        avisar('Atenção','Formato fora do padrão do trabalho','Prancheta de '+numero(med[0])+' × '+numero(med[1])+' mm.',k,null,r);
      }
      if(o.duplex && n%2){
        var ant=formato(out.paginas[n-1].rect);
        if(Math.abs(ant[0]-med[0])>0.1 || Math.abs(ant[1]-med[1])>0.1){
          avisar('Bloqueio','Par duplex incompatível','Confira dimensões e orientação das pranchetas '+n+' e '+k+'.',k,null,r);
        }
      }
    }
    if(o.duplex && out.paginas.length%2)avisar('Bloqueio','Frente sem verso','A última prancheta ficou sem verso. Acrescente uma face em branco se necessário.',out.paginas.length,null,null);
    if(o.modo!=='P&B estrito' && d.documentColorSpace!==DocumentColorSpace.CMYK)
      avisar('Bloqueio','Documento RGB','Confira o espaço de trabalho e o perfil de saída antes de fechar em CMYK.',0,null,null);
    if(o.maquina.mono && o.modo!=='P&B estrito')
      avisar('Bloqueio','Modo incompatível','O preset de equipamento monocromático exige P&B estrito.',0,null,null);
    if(!o.maxW || !o.maxH)avisar('Atenção','Limite da máquina não informado','Preencha as duas dimensões máximas para validar o formato.',0,null,null);

    function adicionarFix(tipo,obj,cor,sobre,valor,op,bool){
      out.fixes.push({tipo:tipo,obj:obj,cor:cor,sobre:sobre,antes:valor,op:op,acionar:bool});
    }
    function pintura(obj,cor,sobre,item,r,ps,os,art,nivel){
      var c=obj[cor], t=regras.tinta(c), op=!!obj[sobre], flags={}, editavel=p.editavel(item);
      if(t.tipo==='vazio')return;
      for(var j=0;j<ps.length;j++){
        var pag=ps[j], k=pag.numero;
        function informar(sev,regra,msg){avisar(sev,regra,msg+' ('+nivel+').',k,item,r,true);}
        if(t.tipo==='indeterminada')pag.indefinida=true;
        if(t.tipo==='composta' || t.tipo==='rgb' || t.tipo==='spot' || t.tipo==='registro')pag.colorida=true;
        if(t.branco && op){informar('Bloqueio','Branco em sobreimpressão','O branco pode desaparecer no RIP');flags.branco=true;}
        if(t.tac>o.tac && o.tac){informar('Atenção','TAC acima do limite',numero(t.tac)+'% detectado. Referência de '+o.tac+'%');}
        if(t.tipo==='registro' && !art){informar('Bloqueio','Cor de registro na arte','Reserve a cor de registro para marcas técnicas');}
        if(pag.mono && (t.tipo==='composta' || t.tipo==='rgb' || t.tipo==='spot' || t.tipo==='registro')){
          informar('Bloqueio','Possível clique colorido','Canal de cor em prancheta P&B');
          if(t.tipo==='composta' || t.tipo==='rgb')flags.mono=true;
        }
        if(pag.mono && t.tipo==='k' && t.k>0 && (t.k<8 || t.k>=88 && t.k<=95))
          informar('Atenção','Tonalidade próxima dos extremos','Confira a reprodução de '+numero(t.k)+'% de preto');
        if(t.tipo==='spot'){
          var quinta=regras.contem(o.spots,t.nome);
          if(o.maquina.estacao && !quinta)informar('Atenção','Spot fora da lista da máquina','Confirme o nome exato de '+t.nome+' no RIP');
          if(!op){
            informar( o.maquina.estacao && quinta ? 'Bloqueio':'Atenção','Spot sem sobreimpressão','Confira a aplicação de '+t.nome);
            if(o.maquina.estacao && quinta)flags.spot=true;
          }
          if(o.legado)informar('Atenção','Cor especial em PDF/X-1a','Confira transparências e a separação da cor especial');
        }
        if(os && t.tipo==='composta' && p.rico(c)){
          informar('Atenção','Preto composto em elemento fino','Considere preto puro K100');
          flags.preto=true;
        }
      }
      if(!editavel)return;
      if(flags.branco)adicionarFix('branco',obj,cor,sobre,c,op,false);
      if(flags.preto)adicionarFix('preto',obj,cor,sobre,c,op,true);
      if(flags.mono){
        var todasMono=true;
        for(var i=0;i<ps.length;i++)if(!ps[i].mono)todasMono=false;
        if(todasMono)adicionarFix('mono',obj,cor,sobre,c,op,op && !t.branco);
      }
      if(flags.spot && !flags.branco)adicionarFix('spot',obj,cor,sobre,c,op,true);
    }

    for(var i=0;i<d.pageItems.length;i++){
      var item=d.pageItems[i], tipo=item.typename, r, pags=[];
      var camada=item.layer;
      if(camada && (camada.printable===false || camada.visible===false))continue;
      if(!p.visivel(item) || tipo==='PathItem' && (item.guides || item.clipping))continue;
      if(tipo==='PathItem' && item.parent.typename==='CompoundPathItem' &&
          item.parent.pathItems.length && item.parent.pathItems[0]!==item)continue;
      if(tipo==='CompoundPathItem')continue;
      var alvo=tipo==='PathItem' && item.parent.typename==='CompoundPathItem' ? item.parent : item;
      try {r=limites(alvo,memo);} catch(_) {r=null;}
      if(!r)continue;
      for(var j=0;j<out.paginas.length;j++)if(naPrancheta(r,out.paginas[j].rect))pags.push(out.paginas[j]);
      if(!pags.length)continue;

      var tecnica=ehMarca(item), path=tipo==='PathItem', texto=tipo==='TextFrame' || tipo==='TextFrameItem';
      var bitmap=tipo==='RasterItem' || tipo==='PlacedItem';
      var arquivo=null, jinfo=null, faltou=false, ppi=0, monoImagem=false;
      if(bitmap){
        var vinculado=tipo==='PlacedItem' || !item.embedded;
        if(vinculado){
          try {arquivo=item.file;}catch(_) {}
          faltou=!arquivo || !arquivo.exists;
          if(!faltou && tipo==='PlacedItem'){
            var key='$'+arquivo.absoluteURI;
            if(!jpeg.hasOwnProperty(key))jpeg[key]=imagens.jpeg(arquivo);
            jinfo=jpeg[key];
            if(jinfo){
              ppi=imagens.resolucao(item,jinfo);
              monoImagem=jinfo.canais===1;
            }
          }
        }
        if(tipo==='RasterItem')monoImagem=/GRAY|BITMAP/.test(String(item.imageColorSpace).toUpperCase()) && !item.colorizedGrayscale;
      }

      for(var s=0;s<pags.length;s++){
        var pg=pags[s], caixa=pg.rect, pgN=pg.numero;
        function nota(sev,regra,msg){avisar(sev,regra,msg,pgN,alvo,r,true);}
        if(tipo!=='GroupItem')pg.arte=true;
        if(!tecnica && o.pinca>0 && r[1]>caixa[1]-o.pinca*p.pt && r[3]<caixa[1])
          nota('Atenção','Área de pinça','A arte alcança os '+o.pinca+' mm da borda superior prevista.');
        if(texto && o.seg>0 && (r[0]<=caixa[0]+o.seg*p.pt || r[2]>=caixa[2]-o.seg*p.pt ||
            r[1]>=caixa[1]-o.seg*p.pt || r[3]<=caixa[3]+o.seg*p.pt))
          nota('Atenção','Texto próximo ao corte','Confira a margem de segurança de '+o.seg+' mm.');
        if(!tecnica && path && item.filled && item.closed && o.sangria>0){
          var sang=o.sangria*p.pt;
          if(r[0]<=caixa[0]+margemEps && r[0]>caixa[0]-sang+margemEps ||
             r[2]>=caixa[2]-margemEps && r[2]<caixa[2]+sang-margemEps ||
             r[1]>=caixa[1]-margemEps && r[1]<caixa[1]+sang-margemEps ||
             r[3]<=caixa[3]+margemEps && r[3]>caixa[3]-sang+margemEps)
            nota('Atenção','Possível sangria insuficiente','Forma próxima ao corte sem alcançar os '+o.sangria+' mm previstos.');
        }
        if(o.legado && (item.opacity<99.99 || String(item.blendingMode).toUpperCase().indexOf('NORMAL')<0))
          nota('Atenção','Transparência em saída legada','Confira o achatamento na prova do PDF/X-1a.');
        if(path && item.stroked && item.strokeWidth>0 && item.strokeWidth<0.25)
          nota('Atenção','Traço inferior a 0,25 pt',numero(item.strokeWidth)+' pt. Confira a reprodução na máquina.');
        if(path && !item.closed && /^(faca|corte)/i.test(item.layer.name))
          nota('Atenção','Caminho aberto em camada de faca','Confirme se é um corte aberto intencional.');
        if(bitmap){
          if(faltou)nota('Bloqueio','Vínculo ausente',arquivo ? decodeURI(arquivo.name) : 'Localize o arquivo na janela Vínculos.');
          else if(jinfo && jinfo.canais===4)
            nota('Atenção','JPEG de quatro canais','Confira CMYK/YCCK, APP14 '+(jinfo.app14===null?'ausente':jinfo.app14)+' e '+(jinfo.icc?'perfil ICC presente.':'perfil ICC ausente.'));
          if(ppi && ppi<(jinfo.bits===1 && pg.mono ? 600 : 300))
            nota(ppi<240?'Bloqueio':'Atenção','Resolução efetiva baixa',ppi+' PPI no eixo de menor resolução.');
          if(!faltou && !ppi)pg.indefinida=true;
          if(pg.mono && !monoImagem){
            if(jinfo && jinfo.canais>1) {pg.colorida=true;nota('Bloqueio','Imagem colorida em página P&B','Converta a imagem no arquivo de origem e atualize o vínculo.');}
            else pg.indefinida=true;
          }
        }else if(tipo!=='GroupItem' && !path && !texto)pg.indefinida=true;
      }

      if(path){
        var codigo=ehBarcode(item);
        if(item.filled)pintura(item,'fillColor','fillOverprint',item,r,pags,codigo,tecnica,'preenchimento');
        if(item.stroked)pintura(item,'strokeColor','strokeOverprint',item,r,pags,codigo || item.strokeWidth<=0.75,tecnica,'traço');
      }else if(texto){
        var caracteres=item.textRange.characters;
        if(caracteres.length){
          var attrs=caracteres[0].characterAttributes, min=Number(attrs.size);
          if(min<6 && regras.tinta(attrs.fillColor).branco)
            avisar('Atenção','Texto branco menor que 6 pt','Confira a legibilidade em fundos escuros.',pags[0].numero,item,r,true);
          avisar('Atenção','Fonte viva','Confira incorporação de '+(attrs.textFont ? attrs.textFont.name : 'fonte')+' no PDF.',pags[0].numero,item,r,true);
        }
        for(var c=0;c<caracteres.length;c++){
          var prop=caracteres[c].characterAttributes;
          pintura(prop,'fillColor','overprintFill',item,r,pags,prop.size<24,tecnica,'texto');
          if(prop.strokeWeight>0)pintura(prop,'strokeColor','overprintStroke',item,r,pags,prop.size<24,tecnica,'contorno de texto');
        }
      }
    }

    for(var h=0;h<out.paginas.length;h++){
      var pg=out.paginas[h];
      if(pg.indefinida && pg.mono)
        avisar('Atenção','Clique depende do RIP','Há imagens, aparências complexas ou conteúdo vinculado que precisa ser conferido nas separações.',pg.numero,null,pg.rect);
    }
    return out;
  }

  function cinza(c){
    var src, numeros;
    if(c.typename==='CMYKColor'){
      src=ImageColorSpace.CMYK;numeros=[c.cyan,c.magenta,c.yellow,c.black];
    }else{
      src=ImageColorSpace.RGB;numeros=[c.red,c.green,c.blue];
    }
    var v=app.convertSampleColor(src,numeros,ImageColorSpace.GrayScale,ColorConvertPurpose.defaultpurpose);
    if(v.length!==1 || !isFinite(v[0]))throw Error('Não foi possível converter a cor para cinza.');
    var g=new GrayColor();g.gray=Math.max(0,Math.min(100,v[0]));return g;
  }

  function corrigir(plano,opcoes){
    var feitas=[], puro=p.cmyk(0,0,0,100), i, f;
    // Cinza precede preto puro para que elementos escuros selecionados terminem em K100.
    var ordem=['mono','preto','branco','spot'];
    try {
      for(var n=0;n<ordem.length;n++){
        var tipo=ordem[n];
        if(!opcoes[tipo])continue;
        for(i=0;i<plano.length;i++){
          f=plano[i];if(f.tipo!==tipo)continue;
          feitas.push(f);
          if(tipo==='mono')f.obj[f.cor]=cinza(f.antes);
          if(tipo==='preto')f.obj[f.cor]=puro;
          f.obj[f.sobre]=f.acionar;
        }
      }
      return feitas.length;
    }catch(e){
      for(i=feitas.length-1;i>=0;i--){
        f=feitas[i];
        try{f.obj[f.cor]=f.antes;f.obj[f.sobre]=f.op;}catch(_){}
      }
      throw e;
    }
  }

  function localizar(d,x){
    if(x.pagina)d.artboards.setActiveArtboardIndex(x.pagina-1);
    var v=d.activeView, b=x.bounds;
    if(x.item && p.editavel(x.item)){d.selection=null;x.item.selected=true;}
    if(b){
      var w=Math.max(24,b[2]-b[0]),h=Math.max(24,b[1]-b[3]);
      var tela=v.bounds,fator=v.zoom, zx=(tela[2]-tela[0])*fator/w, zy=(tela[1]-tela[3])*fator/h;
      v.zoom=Math.max(0.02,Math.min(8,0.7*zx,0.7*zy));
      v.centerPoint=[(b[0]+b[2])/2,(b[1]+b[3])/2];
    }
    app.redraw();
  }

  function desenharMargens(d,o){
    var camada=d.layers.add();
    try {
      camada.name=overlay;camada.printable=false;
      var cores=[p.cmyk(0,100,0,0),p.cmyk(100,0,0,0)];
      for(var i=0;i<d.artboards.length;i++){
        var r=d.artboards[i].artboardRect, m=formato(r), s=o.seg,b=o.sangria;
        if(b>0){var x=p.ret(camada,r,-b,-b,m[0]+2*b,m[1]+2*b,cores[0],0.5);x.guides=true;x.name='Sangria de '+b+' mm';}
        if(s>0 && 2*s<Math.min(m[0],m[1])){var y=p.ret(camada,r,s,s,m[0]-2*s,m[1]-2*s,cores[1],0.5);y.guides=true;y.name='Segurança de '+s+' mm';}
      }
      camada.locked=true;
    }catch(e){try{camada.remove();}catch(_){}throw e;}
  }

  function relatorio(a,o,d,historico){
    var linhas=['DESIGNPROD · PREFLIGHT DIGITAL',d.name,'Equipamento: '+o.maquina.nome,'Modo: '+o.modo,
      'Substrato: '+o.substrato.nome,'Saída: '+(o.legado?'PDF/X-1a':'PDF/X-4')+(o.pdfPreset?' · '+o.pdfPreset:''),
      'Bloqueios: '+a.criticos+' · Atenções: '+a.alertas,'','MAPA ESTIMADO DE CLIQUES'];
    for(var i=0;i<a.paginas.length;i++){
      var x=a.paginas[i];
      var detalhe=x.colorida?'cor detectada':x.indefinida?'conferir separações':x.arte?'somente preto detectado':'sem arte detectada';
      linhas.push(x.numero+' · '+x.nome+' · '+(x.mono?'P&B':'Colorido')+' · '+detalhe);
    }
    linhas.push('','OCORRÊNCIAS');
    for(var j=0;j<a.achados.length;j++){
      var item=a.achados[j];
      linhas.push(item.nivel+' · '+(item.pagina?'Prancheta '+item.pagina:'Documento')+' · '+item.regra+' · '+item.texto);
    }
    if(historico && historico.length)linhas.push('','CORREÇÕES NESTA SESSÃO',historico.join('\n'));
    linhas.push('','Conferência na fila Hold: formato e virada, Output Intent, separações, quinta cor, contagem de cliques e prova física.');
    return linhas.join('\n')+'\n';
  }

  return {analisar:analisar,fixos:fixos,corrigir:corrigir,localizar:localizar,desenharMargens:desenharMargens,relatorio:relatorio};
}(IBDPP,IBDPreflightRegras,IBDPreflightImagens));
