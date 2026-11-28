/* Regras sem dependência do DOM do Illustrator. Limites em mm, pt e porcentagens. */
var IBDPreflightRegras = (function () {
  var maquinas=[
    {nome:'Konica Minolta Color · C4080',w:330.2,h:487.7,pinca:5,mono:false,estacao:false},
    {nome:'Konica Minolta Mono · configurável',w:0,h:0,pinca:5,mono:true,estacao:false},
    {nome:'Ricoh Color + 5ª estação · configurável',w:0,h:0,pinca:5,mono:false,estacao:true},
    {nome:'Ricoh Mono · configurável',w:0,h:0,pinca:5,mono:true,estacao:false}
  ];
  var substratos=[
    {nome:'Couchê · referência FOGRA51',tac:300},
    {nome:'Offset ou Pólen · referência FOGRA52',tac:280},
    {nome:'Cartão ou Triplex · perfil da gráfica',tac:300},
    {nome:'Sintético ou Especial · perfil da gráfica',tac:0}
  ];
  var especiais=['White','Clear','NeonPink','NeonYellow','Gold','Silver'];

  function paginas(texto,n){
    var mapa={}, entrada=String(texto).replace(/\s+/g,'').split(',');
    for(var i=0;i<entrada.length;i++){
      var m=entrada[i].match(/^(\d+)(?:-(\d+))?$/);
      if(!m)throw Error('Informe as páginas coloridas como 1-2,5.');
      var de=Number(m[1]), ate=m[2] ? Number(m[2]) : de;
      if(de<1 || ate<de || ate>n)throw Error('Use páginas entre 1 e '+n+' no modo Híbrido.');
      for(var j=de;j<=ate;j++)mapa[j]=true;
    }
    return mapa;
  }

  function contem(lista,valor){
    for(var i=0;i<lista.length;i++)if(lista[i]===valor)return true;
    return false;
  }

  function registro(c){return c && c.typename==='SpotColor' && String(c.spot.colorType).toUpperCase().indexOf('REGISTRATION')>=0;}

  function tinta(c){
    if(!c || c.typename==='NoColor')return {tipo:'vazio'};
    if(c.typename==='CMYKColor'){
      var chroma=c.cyan+c.magenta+c.yellow;
      return {tipo:chroma>0.01?'composta':'k',tac:chroma+c.black,k:c.black,branco:chroma+c.black<0.01};
    }
    if(c.typename==='GrayColor')return {tipo:'k',k:c.gray,branco:c.gray<0.01};
    if(c.typename==='RGBColor')return {tipo:'rgb',branco:c.red>254.99 && c.green>254.99 && c.blue>254.99};
    if(registro(c))return {tipo:'registro'};
    if(c.typename==='SpotColor')return {tipo:'spot',nome:c.spot.name};
    return {tipo:'indeterminada'};
  }

  function encaixa(w,h,limW,limH){
    if(!limW || !limH)return true;
    var eps=0.05;
    return (w<=limW+eps && h<=limH+eps) || (h<=limW+eps && w<=limH+eps);
  }

  return {maquinas:maquinas,substratos:substratos,paginas:paginas,contem:contem,tinta:tinta,
    especiais:especiais,encaixa:encaixa};
}());
