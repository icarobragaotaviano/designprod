const esc = texto => String(texto).replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'
}[char]));
const limite = (n,min,max) => Math.min(max,Math.max(min,n));
const num = n => +n.toFixed(4);
const linha = (x,y,x2,y2,cor='#34495d',extra='') =>
    `<line x1="${num(x)}" y1="${num(y)}" x2="${num(x2)}" y2="${num(y2)}" stroke="${cor}" vector-effect="non-scaling-stroke" ${extra}/>`;
const caixa = (x,y,w,h,fill,stroke,extra='') =>
    `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="${fill}" stroke="${stroke}" vector-effect="non-scaling-stroke" ${extra}/>`;
const texto = (x,y,s,tamanho,extra='') =>
    `<text x="${num(x)}" y="${num(y)}" font-size="${num(tamanho)}" text-anchor="middle" dominant-baseline="central" fill="#172e44" ${extra}>${esc(s)}</text>`;
const corFrente = '#d8eafa', corVerso = '#e9ddf5', corCorte = '#48627b';

function svg(w,h,titulo,conteudo) {
    return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(titulo)}" width="${num(w)}mm" height="${num(h)}mm" viewBox="0 0 ${num(w)} ${num(h)}" font-family="monospace"><title>${esc(titulo)}</title>${caixa(0,0,w,h,'#fff','#9daab7')}${conteudo}</svg>`;
}

function marcas(p,bleed,sw,sh) {
    const marcas = [];
    const alcance = Math.min(4,bleed);
    const posicoes = [p.x,p.x+p.w];
    const alturas = [p.y,p.y+p.h];
    for (const x of posicoes) {
        if (p.y > 0) marcas.push(linha(x,Math.max(0,p.y-alcance),x,p.y));
        if (p.y+p.h < sh) marcas.push(linha(x,p.y+p.h,x,Math.min(sh,p.y+p.h+alcance)));
    }
    for (const y of alturas) {
        if (p.x > 0) marcas.push(linha(Math.max(0,p.x-alcance),y,p.x,y));
        if (p.x+p.w < sw) marcas.push(linha(p.x+p.w,y,Math.min(sw,p.x+p.w+alcance),y));
    }
    return marcas.join('');
}
export function prancha(s,area,face,titulo) {
    const { sw,sh,bleed } = s;
    const fundo = face.marcas?.gripper;
    const areaVisivel = fundo === 'top' && s.style === 'perfector' ? { ...area, y:sh-area.y-area.h } : area;
    const { x,y,w,h } = areaVisivel;
    const reserva = caixa(x,y,w,h,'none','#72879b','stroke-dasharray="4 3"');
    const faixa = fundo && s.grip ? caixa(0,fundo==='top'?0:sh-s.grip,sw,s.grip,'#f4e9cb','none') : '';
    const partes = face.items.map((p,i)=>{
        const verso = p.label==='V';
        const cx=p.x+p.w/2,cy=p.y+p.h/2;
        return (bleed ? caixa(p.x-bleed,p.y-bleed,p.w+2*bleed,p.h+2*bleed,'#edf1f6','#8d9cad','stroke-dasharray="2 2"'):'') +
            caixa(p.x,p.y,p.w,p.h,verso?corVerso:corFrente,corCorte) +
            (face.items.length<=120 ? texto(cx,cy,(verso?'V':'F')+' '+(i+1),limite(Math.min(p.w,p.h)/5,1,16),
                `transform="rotate(${p.angle||0} ${cx} ${cy})"`) : '') +
            (s.marks && bleed ? marcas(p,bleed,sw,sh):'');
    }).join('');
    const eixo = s.style === 'turn' ? linha(sw/2,0,sw/2,sh,'#b46424','stroke-dasharray="5 3"') :
        s.style === 'tumble' ? linha(0,sh/2,sw,sh/2,'#b46424','stroke-dasharray="5 3"') : '';
    return svg(sw,sh,titulo,faixa+reserva+partes+eixo);
}

export function caderno(s,area,p,cells,verso,titulo) {
    if (verso) p={ ...p,x:s.sw-p.x-p.w };
    const pagina = cells.map((row,r)=>row.map((cell,c)=>{
        const x=p.x+c*s.pw+Math.floor(c/2)*(p.millingAllowance+p.faceGap)+(c%2?p.millingAllowance:0);
        const y=p.y+r*(s.ph+p.headGap);
        const reserva=limite(p.bindingMargin,0,s.pw/2);
        const faixa=c%2?x:x+s.pw-reserva;
        const cx=x+s.pw/2,cy=y+s.ph/2;
        const angulo=cell.angle;
        return caixa(x,y,s.pw,s.ph,cell.isBlank?'#f2f3f4':verso?corVerso:corFrente,corCorte)+
            (reserva ? caixa(faixa,y,reserva,s.ph,'#f0dfbd','none'):'')+
            texto(cx,cy,cell.isBlank?'Branca':cell.page,
                Math.min(s.pw,s.ph)/7,`transform="rotate(${angulo} ${cx} ${cy})"`);
    }).join('')).join('');
    const sangria = s.bleed ? caixa(p.x-s.bleed,p.y-s.bleed,p.w+2*s.bleed,p.h+2*s.bleed,'#edf1f6','#8d9cad','stroke-dasharray="3 2"') : '';
    const contorno=caixa(area.x,area.y,area.w,area.h,'none','#8d9cad','stroke-dasharray="5 3"');
    return svg(s.sw,s.sh,titulo,contorno+sangria+pagina+(s.marks && s.bleed?marcas(p,s.bleed,s.sw,s.sh):''));
}

export function lona(s,r) {
    const {pw,ph,safeMargin,weld}=s;
    const {cutW,cutH,x,y,grommets,paineis}=r;
    const regioes = caixa(0,0,cutW,cutH,'#efe9db','#8e816e')+caixa(x,y,pw,ph,'#e0eefb','#48627b');
    const segura = safeMargin ? caixa(x+safeMargin,y+safeMargin,pw-2*safeMargin,ph-2*safeMargin,
        'none','#5c748b','stroke-dasharray="5 3"') : '';
    const emendas=paineis.slice(1).map(p=>caixa(p.pos,0,weld,cutH,'#d48745','#9a570b','fill-opacity=".35"')).join('');
    const raio=Math.min(4,pw/28,ph/28);
    const furos=grommets.map(p=>`<circle cx="${num(x+p.x)}" cy="${num(y+p.y)}" r="${num(raio)}" fill="#172e44"/>`).join('');
    return svg(cutW,cutH,'Mapa de corte da lona com acabamento e ilhós',regioes+segura+emendas+furos);
}
