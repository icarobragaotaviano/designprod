/* Lê apenas os cabeçalhos JPEG. A matriz e a caixa do Illustrator medem o PPI no layout. */
var IBDPreflightImagens=(function () {
  function jpeg(arquivo){
    var ext=arquivo.name.match(/\.jpe?g$/i);
    if(!ext)return null;
    arquivo.encoding='BINARY';
    if(!arquivo.open('r'))return null;
    function octeto(s,i){return s.charCodeAt(i)&255;}
    function palavra(s,i){return octeto(s,i)*256+octeto(s,i+1);}
    var info={largura:0,altura:0,canais:0,bits:0,app14:null,icc:false};
    try {
      var inicio=arquivo.read(2);
      if(inicio.length!==2 || palavra(inicio,0)!==65496)return null;
      var lim=0;
      while(!arquivo.eof && lim++<4096){
        var marker=arquivo.read(2);
        if(marker.length!==2 || octeto(marker,0)!==255)break;
        var id=octeto(marker,1);
        while(id===255 && !arquivo.eof)id=octeto(arquivo.read(1),0);
        if(id===218 || id===217)break;
        var cab=arquivo.read(2);
        if(cab.length!==2)break;
        var n=palavra(cab,0)-2;
        if(n<0 || arquivo.tell()+n>arquivo.length)break;
        var pos=arquivo.tell(), dados;
        if(id===238 && n>=12){
          dados=arquivo.read(12);
          if(dados.substr(0,5)==='Adobe')info.app14=octeto(dados,11);
        }else if(id===226 && n>=14){
          info.icc=info.icc || arquivo.read(12)==='ICC_PROFILE\x00';
        }else if(id>=192 && id<=207 && id!==196 && id!==200 && id!==204 && n>=6){
          dados=arquivo.read(6);
          info.bits=octeto(dados,0);info.altura=palavra(dados,1);
          info.largura=palavra(dados,3);info.canais=octeto(dados,5);
        }
        if(!arquivo.seek(pos+n,0))break;
      }
      return info.largura && info.altura ? info : null;
    } finally { arquivo.close(); }
  }

  function resolucao(item,j){
    // A caixa local conserva a largura/altura mesmo com a imagem girada.
    var b=item.boundingBox, m=item.matrix;
    var mmX=Math.sqrt(m.mValueA*m.mValueA+m.mValueB*m.mValueB);
    var mmY=Math.sqrt(m.mValueC*m.mValueC+m.mValueD*m.mValueD);
    var w=Math.abs(b[2]-b[0])*mmX,h=Math.abs(b[1]-b[3])*mmY;
    return w>0 && h>0 ? Math.round(Math.min(j.largura*72/w,j.altura*72/h)) : 0;
  }

  return {jpeg:jpeg,resolucao:resolucao};
}());
