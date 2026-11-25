import { xml } from '../calculos.mjs';

export const folhas = [
  ['T4', 328, 478], ['T8', 238, 328], ['SRA3', 320, 450], ['66 × 96', 660, 960], ['64 × 88', 640, 880]
];

export function mapa(w, h, corpo) {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'mm" height="'+h+'mm" viewBox="0 0 '+w+' '+h+'"><rect width="'+w+'" height="'+h+'" fill="white"/>'+corpo+'</svg>';
}

export function desenhoGrade(w, h, borda, pinos, caixas) {
  const l = Math.max(w,h)/62;
  const blocos = caixas.map((c,i) => '<rect x="'+c.x+'" y="'+c.y+'" width="'+c.w+'" height="'+c.h+'" fill="'+['#dce8cf','#f2e2c4','#dfdaf0','#d4e3ec'][i%4]+'" stroke="#394652" stroke-width="'+l/13+'"/><text x="'+(c.x+c.w/2)+'" y="'+(c.y+c.h/2)+'" text-anchor="middle" dominant-baseline="central" font-size="'+Math.min(l,c.w/4,c.h/3)+'" font-family="sans-serif">'+xml(c.nome || i+1)+'</text>').join('');
  return mapa(w,h,'<rect x="'+borda+'" y="0" width="'+(w-2*borda)+'" height="'+(h-pinos)+'" fill="#eef1f4"/><rect y="'+(h-pinos)+'" width="'+w+'" height="'+pinos+'" fill="#f2e2c4"/>'+blocos);
}

export function avaliarFolhas({largura,altura,sangria,calha,tiragem,pinca,lateral,cores,gramatura,bopp,producao,acerto,fibra,vinco}) {
  return folhas.map(([nome,w,h]) => {
    const areaW=Math.max(0,w-2*lateral), areaH=Math.max(0,h-pinca);
    const opcoes=[false,true].map(girou=>{
      const pw=girou?altura:largura, ph=girou?largura:altura;
      const nx=Math.max(0,Math.floor((areaW+calha-2*sangria)/(pw+calha)));
      const ny=Math.max(0,Math.floor((areaH+calha-2*sangria)/(ph+calha)));
      const dobra = vinco === 'Nenhum' || (vinco === fibra) !== girou;
      return {girou,pw,ph,nx,ny,pecas:nx*ny,dobra};
    }).sort((a,b)=>b.pecas-a.pecas || Number(b.dobra)-Number(a.dobra));
    const r=opcoes[0];
    const liquidas=r.pecas?Math.ceil(tiragem/r.pecas):null;
    const caixas=[];
    if(r.pecas && r.pecas <= 1000) for(let y=0;y<r.ny;y++) for(let x=0;x<r.nx;x++) caixas.push({x:lateral+sangria+x*(r.pw+calha),y:sangria+y*(r.ph+calha),w:r.pw,h:r.ph,nome:'·'});
    const alerta=cores==='4×4'&&gramatura>=250&&nome==='T4'?'Prove o registro frente e verso no cartão. Compare com T8.':'';
    const laminacao=bopp==='Sim'&&nome==='T4'?'Confira a largura aceita pela laminadora.':'';
    const corte=calha<2*sangria?'Corte com sangria compartilhada. Confirme a continuidade da arte nas bordas.':'';
    return {...r,nome,w,h,areaW,areaH,liquidas,brutas:liquidas===null?null:liquidas+acerto,aproveitamento:r.pecas*largura*altura*100/(w*h),
      cliques:producao==='Digital'&&liquidas!==null?(liquidas+acerto)*(cores==='4×4'?2:1):null,
      avisos:[alerta,laminacao,corte,!r.dobra?'Fibra perpendicular ao vinco. Faça prova de dobra.':''].filter(Boolean),
      svg:r.pecas?desenhoGrade(w,h,lateral,pinca,caixas):null};
  });
}

export function lerServicos(entrada) {
  const linhas=entrada.trim().split(/\r?\n/).filter(s=>s.trim());
  if(linhas.length<2||linhas.length>8)throw Error('Informe de 2 a 8 itens.');
  return linhas.map((linha,i)=>{
    const [nome,w,h,sangria,tiragem,prioridade,...resto]=linha.split(';').map(s=>s.trim());
    if(resto.length||!nome||nome.length>32)throw Error('Revise o nome na linha '+(i+1)+'.');
    const valores=[w,h,sangria,tiragem,prioridade].map(x=>x?Number(x.replace(',','.')):NaN);
    const [largura,altura,b,total,peso]=valores;
    if(!valores.every(Number.isFinite)||largura<=0||altura<=0||b<0||!Number.isSafeInteger(total)||total<1||peso<1||peso>9)throw Error('Revise as medidas, a tiragem e a prioridade na linha '+(i+1)+'.');
    return {nome,w:largura+2*b,h:altura+2*b,sangria:b,total,peso};
  });
}

export function chapa({largura,altura,margem,calha,itens}) {
  const w=largura-2*margem, h=altura-2*margem;
  const base=itens.map((s,index)=>{
    const op=[[s.w,s.h],[s.h,s.w]].filter(([x,y])=>x<=w&&y<=h);
    if(!op.length)throw Error(s.nome+' não cabe na área útil.');
    return {index,op,total:s.total,peso:s.peso};
  });
  const area=base.reduce((a,i)=>a+itens[i.index].w*itens[i.index].h*i.total,0);
  const estimativa=Math.max(1,Math.ceil(area/(w*h)));
  const ordens=[base,[...base].sort((a,b)=>b.peso-a.peso),[...base].sort((a,b)=>b.op[0][1]-a.op[0][1])];
  const solucoes=[];
  for(const fator of [0.7,1,1.25,1.65,2.2,3,4,8,16]){
    for(const ordem of ordens) for(const orientacao of [0,1]){
      const folhas=Math.max(1,Math.ceil(estimativa*fator));
      const faixas=[];
      let y=margem;
      for(const {index,op,total} of ordem){
        const [pw,ph]=op[orientacao%op.length];
        const n=Math.floor((w+calha)/(pw+calha));
        let faltam=Math.ceil(total/folhas);
        while(faltam>0 && y+ph<=altura-margem && faixas.length<100){
          const qtd=Math.min(n,faltam);
          faixas.push({index,y,h:ph,w:pw,qtd});
          y+=ph+calha;
          faltam-=qtd;
        }
        if(faltam>0)break;
      }
      const contagem=itens.map((_,i)=>faixas.filter(f=>f.index===i).reduce((a,f)=>a+f.qtd,0));
      if(contagem.some(n=>!n)||contagem.reduce((a,n)=>a+n,0)>2000)continue;
      const rodar=Math.max(...itens.map((p,i)=>Math.ceil(p.total/contagem[i])));
      const excesso=itens.reduce((a,p,i)=>a+(contagem[i]*rodar-p.total)*p.peso,0);
      solucoes.push({faixas,contagem,rodar,excesso});
    }
  }
  if(!solucoes.length)throw Error('A grade por faixas não conseguiu reunir todos os serviços. Aumente a folha ou divida a chapa.');
  const r=solucoes.sort((a,b)=>a.rodar-b.rodar||a.excesso-b.excesso)[0];
  const caixas=r.faixas.flatMap((f,i)=>Array.from({length:f.qtd},(_,j)=>({x:margem+j*(f.w+calha),y:f.y,w:f.w,h:f.h,nome:(i+1)+'.'+(j+1)})));
  const cortes=r.faixas.flatMap((f,i)=>{
    const texto=['Faixa '+(i+1)+' · isolar em Y '+red(f.y)+'–'+red(f.y+f.h)+' mm'];
    for(let j=0;j<f.qtd;j++){
      const x=margem+j*(f.w+calha);
      texto.push('Faixa '+(i+1)+', peça '+(j+1)+' · separar em X '+red(x)+'–'+red(x+f.w)+' mm');
    }
    const b=itens[f.index].sangria;
    if(b)texto.push('Faixa '+(i+1)+' · refilar '+red(b)+' mm por lado de cada peça');
    return texto;
  });
  return {...r,cortes,svg:desenhoGrade(largura,altura,margem,margem,caixas)};
}

const red = n=>Math.round(n*100)/100;

export function editorial({largura,altura,dobra,compensacao,paginas,caliper,cola,capas,folga,reserva}) {
  const dupla=dobra==='Carteira'||dobra==='Janela';
  const paineis=dobra==='Janela'?[largura/2-compensacao,largura,largura/2-compensacao]
    : dobra==='Cruzada'?[largura,largura]:[largura,largura,largura-(dupla?compensacao:0)];
  if(paineis.some(x=>x<=0))throw Error('A compensação é maior que a aba.');
  const aberta=paineis.reduce((a,x)=>a+x,0);
  const abertaH=dobra==='Cruzada'?2*altura:altura;
  const vincos=paineis.slice(0,-1).map((_,i)=>paineis.slice(0,i+1).reduce((a,x)=>a+x,0));
  const folhasMiolo=Math.ceil(paginas/2);
  const preenchidas=4*Math.ceil(paginas/4);
  const folhasCanoa=preenchidas/4;
  const lombada=folhasMiolo*caliper+cola;
  const creep=(folhasCanoa-1)*caliper;
  const anel=[[0.25,'1/4', '3:1'],[0.3125,'5/16','3:1'],[0.375,'3/8','3:1'],[0.4375,'7/16','3:1'],[0.5,'1/2','3:1'],[0.5625,'9/16','3:1'],[0.625,'5/8','2:1'],[0.75,'3/4','2:1'],[0.875,'7/8','2:1'],[1,'1','2:1'],[1.25,'1 1/4','2:1']].find(([diametro])=>diametro*25.4>=folhasMiolo*caliper+capas+folga);
  const tra=aberta/480;
  const linhas=vincos.map(x=>'<path d="M'+x+' 0 V'+abertaH+'" stroke="#2b6cb0" stroke-width="'+tra+'"/>').join('');
  const cruzada=dobra==='Cruzada'?'<path d="M0 '+altura+' H'+aberta+'" stroke="#2b6cb0" stroke-width="'+tra+'"/>':'';
  const svg=mapa(aberta,abertaH,'<rect width="'+aberta+'" height="'+abertaH+'" fill="none" stroke="#394652" stroke-width="'+tra+'"/>'+linhas+cruzada);
  return {paineis,aberta,abertaH,vincos,verso:vincos.map(x=>aberta-x).reverse(),lombada,preenchidas,brancas:preenchidas-paginas,folhasCanoa,creep,anel,reserva,svg};
}

export function numerar({inicio,fim,digitos,vias,bloco,colunas}) {
  const total=fim-inicio+1;
  if(total<1||total*vias>200000)throw Error('O intervalo deve gerar entre 1 e 200.000 registros.');
  if(String(fim).length>digitos)throw Error('A máscara é menor que a numeração final.');
  const blocos=Math.ceil(total/bloco);
  const folhas=Math.ceil(blocos/colunas)*bloco;
  const porPilha=folhas;
  if(folhas*colunas*vias>400000)throw Error('A grade resultaria em mais de 400.000 células. Divida o lote.');
  const formatar=n=>String(n).padStart(digitos,'0');
  const em=(folha,coluna)=>inicio+coluna*porPilha+folha;
  const registro=(folha,coluna)=>em(folha,coluna)<=fim?formatar(em(folha,coluna)):'';
  function* linhas(){
    yield 'Folha;Via;'+Array.from({length:colunas},(_,c)=>'Pilha '+(c+1)).join(';');
    for(let folha=0;folha<folhas;folha++) for(let via=1;via<=vias;via++){
      yield [folha+1,via,...Array.from({length:colunas},(_,c)=>registro(folha,c))].join(';');
    }
  }
  return {folhas,blocos,brancos:folhas*colunas-total,linhas,primeira:Array.from({length:colunas},(_,c)=>registro(0,c)),ultima:Array.from({length:colunas},(_,c)=>registro(folhas-1,c))};
}

export function painelamento({largura,altura,bobina,margem,emenda,sangria,ajuste=0}) {
  const util=bobina-2*margem;
  if(emenda>=util || util<=2*sangria)throw Error('Sangria, emenda e margem excedem a largura da bobina.');
  return [false,true].map(horizontal=>{
    const a=(horizontal?altura:largura)+2*sangria, b=(horizontal?largura:altura)+2*sangria;
    const qtd=Math.max(1,Math.ceil((a-emenda)/(util-emenda)));
    if(qtd>400)throw Error('Reduza o número de faixas.');
    const passo=(a-emenda)/qtd;
    const deslocamento=qtd>1?ajuste:0;
    const faixas=Array.from({length:qtd},(_,i)=>{
      const pos=i*passo+(i?deslocamento:0);
      const ex=i+1===qtd?a:(i+1)*passo+deslocamento+emenda;
      return {pos,largura:ex-pos};
    });
    const valido=faixas.every(f=>f.largura<=util+1e-8&&f.largura>emenda);
    const caixas=faixas.map((f,i)=>horizontal?{x:0,y:f.pos,w:b,h:f.largura,nome:i+1}:{x:f.pos,y:0,w:f.largura,h:b,nome:i+1});
    const area=qtd*b*bobina/1e6;
    return {horizontal,faixas,qtd,b,area,valido,metros:qtd*b/1000,sobra:100*(1-b*faixas.reduce((acc,f)=>acc+f.largura,0)/1e6/area),
      svg:valido?desenhoGrade(horizontal?b:a,horizontal?a:b,0,0,caixas):null};
  });
}

export function consumoEtapas(liquidas,etapas){
  let folhas=liquidas;
  const calculadas=[...etapas].reverse().map(({nome,acerto,perda})=>{
    const antes=Math.ceil(folhas/(1-perda/100))+acerto;
    const linha={nome,antes,depois:folhas,quebra:antes-folhas};
    folhas=antes;return linha;
  }).reverse();
  return {folhas,calculadas};
}

export function compararCustos(qtd, digital, offset, maximo) {
  const custo=(n,o)=>{
    let folhas=Math.ceil(n/o.rendimento);
    const etapas=o.etapas||[];
    for(let i=etapas.length-1;i>=0;i--){
      const etapa=etapas[i];
      folhas=Math.ceil(folhas/(1-etapa.perda/100))+etapa.acerto;
    }
    return o.fixo+folhas*o.folha;
  };
  const consulta=[custo(qtd,digital),custo(qtd,offset)];
  let virada=null;
  for(let n=1;n<=maximo;n++){
    if(custo(n,offset)+1e-8<custo(n,digital)){virada=n;break;}
  }
  return {consulta,virada};
}
