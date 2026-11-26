/* Datas gregorianas e notas mensais editáveis do calendário. */
var IBDCalendarioDatas = (function (p) {
  function numero(n) { return ('0'+n).slice(-2); }

  function paixao(ano) {
    // Computus gregoriano de Meeus/Jones/Butcher. A Sexta-feira é Páscoa menos dois dias.
    var a=ano%19,b=Math.floor(ano/100),c=ano%100,d=Math.floor(b/4),e=b%4;
    var f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30;
    var i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7;
    var m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;
    return new Date(Date.UTC(ano,Math.floor(n/31)-1,n%31-1));
  }

  function referencia(ano) {
    var s=paixao(ano);
    var lista=[
      '01/01 | Confraternização Universal',
      numero(s.getUTCDate())+'/'+numero(s.getUTCMonth()+1)+' | Paixão de Cristo',
      '21/04 | Tiradentes','01/05 | Dia do Trabalho','07/09 | Independência do Brasil',
      '12/10 | Nossa Senhora Aparecida','02/11 | Finados','15/11 | Proclamação da República'
    ];
    if (ano>=2024) lista.push('20/11 | Dia da Consciência Negra');
    lista.push('25/12 | Natal');
    return lista.join('\n');
  }

  function ler(ano,texto) {
    if (texto.length>18000) throw Error('Reduza as anotações para até 18.000 caracteres.');
    var dados=[], linhas=texto.split(/\r\n|\r|\n/);
    for(var i=0;i<12;i++) dados.push({dias:{},notas:[]});
    for(var j=0;j<linhas.length;j++) {
      var l=linhas[j].replace(/^\s+|\s+$/g,'');
      if (!l || /^#/.test(l)) continue;
      var pedacos=l.match(/^(?:(\d{1,2})\/)?(\d{1,2})\s*\|\s*(\S.*)$/);
      if (!pedacos) throw Error('Linha '+(j+1)+': use DD/MM | Feriado ou MM | Nota.');
      var m=Number(pedacos[2]),d=Number(pedacos[1]);
      if (m<1 || m>12 || pedacos[1] && (d<1 || d>p.mes(ano,m-1).dias)) {
        throw Error('Data inválida na linha '+(j+1)+' para '+ano+'.');
      }
      var x=dados[m-1], item=pedacos[3];
      if (!pedacos[1]) x.notas.push(item);
      else {
        if (!x.dias[d]) x.dias[d]=[];
        x.dias[d].push(item);
      }
    }
    return dados;
  }

  function rodape(unidade) {
    var tmp=unidade.notas.slice(0);
    for(var d=1;d<=31;d++) {
      if(unidade.dias[d]) tmp.push(numero(d)+' '+unidade.dias[d].join(' / '));
    }
    return tmp.join(' · ');
  }

  return {paixao:paixao,referencia:referencia,ler:ler,rodape:rodape};
}(IBDPP));
