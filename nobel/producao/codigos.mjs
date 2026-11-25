import { BARS } from './code128.mjs';
import { mapa } from './calculo.mjs';

export function codigo({tipo,valor,modulo,altura,papel}, qr) {
  const minimo=papel==='Absorvente'?.5:.33;
  const caixas=[];
  let w,h;
  if(tipo==='QR'){
    qr.stringToBytes=qr.stringToBytesFuncs['UTF-8'];
    const matriz=qr(0,'M');
    matriz.addData(valor,'Byte');
    try{matriz.make();}catch{throw Error('Conteúdo grande demais para o QR Code.');}
    const n=matriz.getModuleCount();
    w=h=(n+8)*modulo;
    for(let y=0;y<n;y++) for(let x=0;x<n;x++) if(matriz.isDark(y,x))caixas.push([(x+4)*modulo,(y+4)*modulo,modulo,modulo]);
  }else{
    if(!/^[\x20-\x7e]{1,80}$/.test(valor))throw Error('Code 128 B aceita de 1 a 80 caracteres ASCII imprimíveis.');
    const chars=Array.from(valor,c=>c.charCodeAt(0)-32);
    const soma=chars.reduce((sum,c,i)=>sum+c*(i+1),104)%103;
    const bits=[104,...chars,soma,106].map(i=>String(BARS[i])).join('');
    w=(bits.length+20)*modulo;h=altura;
    for(let x=0;x<bits.length;x++)if(bits[x]==='1')caixas.push([(x+10)*modulo,0,modulo,h]);
  }
  const svg=mapa(w,h,'<g shape-rendering="crispEdges">'+caixas.map(([x,y,w,h])=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'"/>').join('')+'</g>');
  return {w,h,svg,pdf:pdfCodigo(w,h,caixas),minimo};
}

// PDF ASCII, um único content stream vetorial e espaço de cor DeviceCMYK.
function pdfCodigo(w,h,caixas){
  const pt=n=>(n*72/25.4).toFixed(5);
  const stream='0 0 0 0 k\n0 0 '+pt(w)+' '+pt(h)+' re f\n0 0 0 1 k\n'+caixas.map(([x,y,larg,alt])=>[pt(x),pt(h-y-alt),pt(larg),pt(alt)].join(' ')+' re f').join('\n')+'\n';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+pt(w)+' '+pt(h)+'] /Resources << >> /Contents 4 0 R >>',
    '<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream'];
  let pdf='%PDF-1.4\n';
  const offsets=[];
  for(const [i,obj] of objects.entries()){
    offsets.push(pdf.length);
    pdf+=(i+1)+' 0 obj\n'+obj+'\nendobj\n';
  }
  const inicio=pdf.length;
  return pdf+'xref\n0 5\n0000000000 65535 f \n'+offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Root 1 0 R /Size 5 >>\nstartxref\n'+inicio+'\n%%EOF\n';
}
