#target illustrator
(function () {
  if(!app.documents.length||!app.activeDocument.selection||!app.activeDocument.selection.length){alert("Selecione os caminhos de corte.");return;}
  var doc=app.activeDocument, pt=25.4/72, caminhos=[];
  function recolher(o) {
    if(o.hidden||o.locked)return;
    var i;
    if(o.typename==="PathItem"&&!o.guides&&!o.clipping)caminhos.push(o);
    if(o.typename==="CompoundPathItem")for(i=0;i<o.pathItems.length;i++)recolher(o.pathItems[i]);
    if(o.typename==="GroupItem")for(i=0;i<o.pageItems.length;i++)if(o.pageItems[i].parent===o)recolher(o.pageItems[i]);
  }
  for(var i=0;i<doc.selection.length;i++)recolher(doc.selection[i]);
  if(!caminhos.length){alert("Nenhum traçado exportável.");return;}
  var w=new Window("dialog","IBD · Exportar corte 1:1");
  w.add("statictext",undefined,"SVG mantém Béziers. DXF converte curvas em polilinhas de tolerância 0,025 mm.");
  var tipo=w.add("dropdownlist",undefined,["SVG","DXF"]);tipo.selection=0;
  var abrir=w.add("checkbox",undefined,"Aceitar caminhos abertos para vinco ou gravação");
  var acoes=w.add("group");acoes.add("button",undefined,"Exportar",{name:"ok"});acoes.add("button",undefined,"Cancelar",{name:"cancel"});
  if(w.show()!==1)return;
  var ext=tipo.selection.text.toLowerCase();
  var left=Infinity,right=-Infinity,top=-Infinity,bottom=Infinity;
  for(i=0;i<caminhos.length;i++){
    var b=caminhos[i].geometricBounds;
    left=Math.min(left,b[0]);right=Math.max(right,b[2]);top=Math.max(top,b[1]);bottom=Math.min(bottom,b[3]);
    if(!caminhos[i].closed&&!abrir.value){alert("A seleção contém caminho aberto. Confira a finalidade antes de exportar.");return;}
  }
  function coord(p){return [(p[0]-left)*pt,(p[1]-bottom)*pt];}
  function num(n){return Number(n.toFixed(5)).toString();}
  function dist2(a,b){var x=a[0]-b[0],y=a[1]-b[1];return x*x+y*y;}
  function meio(a,b){return [(a[0]+b[0])/2,(a[1]+b[1])/2];}
  function afastamento(p,a,b){
    var l=dist2(a,b);
    if(!l)return dist2(p,a);
    var t=Math.max(0,Math.min(1,((p[0]-a[0])*(b[0]-a[0])+(p[1]-a[1])*(b[1]-a[1]))/l));
    return dist2(p,[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
  }
  function linearizar(a,b,c,d,pts,n){
    if(Math.max(afastamento(b,a,d),afastamento(c,a,d))<=.025*.025){pts.push(d);return;}
    if(n>=16||pts.length>50000)throw Error("Curva complexa demais para DXF nesta tolerância. Exporte em SVG.");
    var ab=meio(a,b),bc=meio(b,c),cd=meio(c,d),abc=meio(ab,bc),bcd=meio(bc,cd),m=meio(abc,bcd);
    linearizar(a,ab,abc,m,pts,n+1);
    linearizar(m,bcd,cd,d,pts,n+1);
  }
  var width=Math.max(.001,(right-left)*pt),height=Math.max(.001,(top-bottom)*pt);
  var svg=[],dxf=[],vistos={};
  function svgPt(p){return num(p[0])+" "+num(height-p[1]);}
  try {
    for(i=0;i<caminhos.length;i++){
      var p=caminhos[i],n=p.pathPoints.length;
      if(n<2)continue;
      var chaves=[], trechos=[];
      for(var j=0;j<(p.closed?n:n-1);j++){
        var a=p.pathPoints[j],b=p.pathPoints[(j+1)%n];
        var a0=coord(a.anchor),a1=coord(a.rightDirection),b1=coord(b.leftDirection),b0=coord(b.anchor);
        if(dist2(a0,b0)===0&&dist2(a0,a1)===0&&dist2(b0,b1)===0)continue;
        var ida=[a0,a1,b1,b0].join("/"),volta=[b0,b1,a1,a0].join("/");
        chaves.push(ida<volta?ida:volta);
        trechos.push([a0,a1,b1,b0]);
      }
      if(!trechos.length)continue;
      var chave=String(p.closed)+" "+chaves.sort().join(";");
      if(vistos[chave])continue;vistos[chave]=true;
      var inicial=trechos[0][0], d="M"+svgPt(inicial), pts=[inicial];
      for(j=0;j<trechos.length;j++){
        var t=trechos[j];
        if(ext==="svg")d+=" C"+svgPt(t[1])+" "+svgPt(t[2])+" "+svgPt(t[3]);
        else linearizar(t[0],t[1],t[2],t[3],pts,0);
      }
      if(ext==="svg")svg.push('<path d="'+d+(p.closed?" Z":"")+'"/>');
      else {
        if(p.closed&&dist2(pts[pts.length-1],pts[0])===0)pts.pop();
        dxf.push("0\nLWPOLYLINE\n100\nAcDbEntity\n8\nCUT\n100\nAcDbPolyline\n90\n"+pts.length+"\n70\n"+(p.closed?"1":"0")+"\n");
        for(j=0;j<pts.length;j++)dxf.push("10\n"+num(pts[j][0])+"\n20\n"+num(pts[j][1])+"\n");
      }
    }
    if(!svg.length&&!dxf.length)throw Error("Nenhum caminho com segmentos válidos.");
    var texto=ext==="svg"?'<svg xmlns="http://www.w3.org/2000/svg" width="'+num(width)+'mm" height="'+num(height)+'mm" viewBox="0 0 '+num(width)+' '+num(height)+'"><g fill="none" stroke="black" stroke-width=".05">'+svg.join("")+"</g></svg>"
      :"0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n"+dxf.join("")+"0\nENDSEC\n0\nEOF\n";
    var destino=File.saveDialog("Salvar "+ext.toUpperCase()+" de corte");
    if(!destino)return;
    if(destino.name.toLowerCase().slice(-ext.length-1)!=="."+ext)destino=new File(destino.fsName+"."+ext);
    if(destino.exists)throw Error("Escolha outro nome para preservar o arquivo existente.");
    destino.encoding="UTF-8";
    if(!destino.open("w"))throw Error("Não foi possível abrir o arquivo para gravação.");
    try{if(!destino.write(texto))throw Error("Falha ao gravar o arquivo.");}finally{destino.close();}
    alert("Saída em milímetros · "+num(width)+" × "+num(height)+" mm. Confira escala e sentido na importação da máquina.");
  }catch(e){alert(e.message);}
}());
