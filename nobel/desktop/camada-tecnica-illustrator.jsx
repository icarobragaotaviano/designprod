#target illustrator
(function () {
  if (!app.documents.length) { alert("Abra a arte."); return; }
  var doc=app.activeDocument, fontes=doc.selection, m=72/25.4;
  if (!fontes || !fontes.length) { alert("Selecione os contornos fechados da silhueta."); return; }
  var janela=new Window("dialog","IBD · Gerar camada técnica");
  janela.add("statictext",undefined,"Selecione a finalidade e confirme o nome da tinta com o RIP.");
  var modos=janela.add("dropdownlist",undefined,["Meio-corte","Corte total","Vinco","Branco"]);
  modos.selection=0;
  var tinta=janela.add("edittext",undefined,"CutContour"); tinta.characters=26;
  janela.add("statictext",undefined,"Offset (mm). Branco usa recuo. Para curvas, use 0 e aplique o offset no editor.");
  var valor=janela.add("edittext",undefined,"0"); valor.characters=8;
  modos.onChange=function () { tinta.text=["CutContour","PerfCutContour","Vinco","White_Ink"][modos.selection.index]; };
  var acoes=janela.add("group"); acoes.add("button",undefined,"Gerar",{name:"ok"}); acoes.add("button",undefined,"Cancelar",{name:"cancel"});
  if(janela.show()!==1)return;
  var modo=modos.selection.text, nome=tinta.text, mm=Number(valor.text.replace(",","."));
  if(!/^[\w. -]{1,40}$/.test(nome)||!valor.text||!isFinite(mm)||mm<0||mm>50){alert("Revise o nome da tinta e o offset.");return;}
  function cruz(a,b){return a[0]*b[1]-a[1]*b[0];}
  function delta(a,b){return [a[0]-b[0],a[1]-b[1]];}
  function offset(obj,d){
    var pontos=[],i;
    for(i=0;i<obj.pathPoints.length;i++){
      var v=obj.pathPoints[i], p=v.anchor;
      if(String(p)!==String(v.leftDirection)||String(p)!==String(v.rightDirection))throw Error("Seleção com curvas. Use offset 0 neste comando.");
      pontos.push(p);
    }
    var n=pontos.length, orientacao=0;
    for(i=0;i<n;i++){
      var curva=cruz(delta(pontos[(i+1)%n],pontos[i]),delta(pontos[(i+2)%n],pontos[(i+1)%n]));
      if(!curva)throw Error("Seleção com nós colineares ou coincidentes.");
      var sinal=curva>0?1:-1;
      if(orientacao && sinal!==orientacao)throw Error("Use offset apenas em polígonos convexos.");
      orientacao=sinal;
    }
    // Todo vértice deve ficar do mesmo lado da aresta. Evita polígonos auto-intersectantes.
    for(i=0;i<n;i++)for(var j=0;j<n;j++){
      if(j===i||j===(i+1)%n)continue;
      if(cruz(delta(pontos[(i+1)%n],pontos[i]),delta(pontos[j],pontos[i]))*orientacao<=0)
        throw Error("Polígono não convexo ou auto-intersectante.");
    }
    var arestas=[];
    for(i=0;i<n;i++){
      var orig=pontos[i], v=delta(pontos[(i+1)%n],orig), l=Math.sqrt(v[0]*v[0]+v[1]*v[1]);
      arestas.push({p:[orig[0]+v[1]/l*d*orientacao,orig[1]-v[0]/l*d*orientacao],v:v});
    }
    var result=[];
    for(i=0;i<n;i++){
      var a=arestas[(i+n-1)%n],b=arestas[i];
      var t=cruz(delta(b.p,a.p),b.v)/cruz(a.v,b.v);
      result.push([a.p[0]+a.v[0]*t,a.p[1]+a.v[1]*t]);
    }
    for(i=0;i<n;i++)if(cruz(delta(result[(i+1)%n],result[i]),delta(result[(i+2)%n],result[(i+1)%n]))*orientacao<=0)
      throw Error("Recuo maior que a geometria disponível.");
    if(d<0)for(i=0;i<n;i++)for(var k=0;k<n;k++){
      var aresta=arestas[k];
      if(cruz(aresta.v,delta(result[i],aresta.p))*orientacao < -0.00001)throw Error("O recuo ultrapassa o miolo do contorno.");
    }
    return result;
  }
  var geometrias=[],i;
  try{
    for(i=0;i<fontes.length;i++){
      if(fontes[i].typename!=="PathItem"||(!fontes[i].closed&&modo!=="Vinco")||fontes[i].guides||fontes[i].clipping)throw Error("Selecione caminhos vetoriais válidos, sem grupos ou máscaras.");
      if(fontes[i].pathPoints.length<2 || (modo==="Branco"&&fontes[i].pathPoints.length<3))throw Error("Caminho com poucos nós.");
      if(mm && (!fontes[i].closed || fontes[i].pathPoints.length<3 || fontes[i].pathPoints.length>512))throw Error("Offset disponível para caminhos fechados com 3 a 512 nós.");
      geometrias.push(mm?offset(fontes[i],mm*m*(modo==="Branco"?-1:1)):null);
    }
  }catch(e){alert(e.message);return;}
  var spot,novoSpot=false,camada;
  try {
    try { spot=doc.spots.getByName(nome); } catch(e) {}
    if(spot && spot.colorType!==ColorModel.SPOT)throw Error("O nome já existe com outro tipo de cor.");
    if(!spot){
      spot=doc.spots.add(); novoSpot=true; spot.name=nome; spot.colorType=ColorModel.SPOT;
      var apresentacao=new CMYKColor(); apresentacao.magenta=100; spot.color=apresentacao;
    }
    var cor=new SpotColor();cor.spot=spot;cor.tint=100;
    camada=doc.layers.add();camada.name=nome;
    for(i=0;i<fontes.length;i++){
      var p;
      if(geometrias[i]){p=camada.pathItems.add();p.setEntirePath(geometrias[i]);p.closed=true;}
      else p=fontes[i].duplicate(camada,ElementPlacement.PLACEATEND);
      p.filled=modo==="Branco";p.stroked=modo!=="Branco";
      if(p.filled){p.fillColor=cor;p.fillOverprint=true;}
      else{p.strokeColor=cor;p.strokeWidth=.25;p.strokeOverprint=true;}
    }
    alert("Camada técnica criada. Confira a separação de "+nome+" no PDF ou no RIP.");
  }catch(e){
    if(camada)camada.remove();
    if(novoSpot&&spot)spot.remove();
    alert(e.message);
  }
}());
