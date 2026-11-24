export function consumo({tiragem, rendimento, acerto, formas, perda, largura, altura, gramatura}) {
  const liquidas = Math.ceil(tiragem / rendimento);
  const perdas = Math.ceil(liquidas * perda / 100);
  const ajuste = acerto * formas;
  const total = liquidas + perdas + ajuste;
  return {liquidas, perdas, ajuste, total, kg: total * largura * altura * gramatura / 1e9, resmas: total / 500};
}

export function grades({largura, altura, pecaL, pecaA, refilo, fibra}) {
  return [false, true].map(girada => {
    const w = girada ? pecaA : pecaL;
    const h = girada ? pecaL : pecaA;
    const utilL = largura - 2 * refilo;
    const utilA = altura - 2 * refilo;
    const colunas = Math.max(0, Math.floor(utilL / w));
    const linhas = Math.max(0, Math.floor(utilA / h));
    const total = colunas * linhas;
    return {girada, w, h, colunas, linhas, total, aproveitamento: total * w * h * 100 / (largura * altura),
      fibra: (fibra === 'largura') !== girada ? 'largura da peça' : 'altura da peça'};
  }).sort((a,b) => b.total - a.total);
}

export const xml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function gabarito({largura, altura, sangria, reserva, seguranca, lado}) {
  const horizontal = ['superior','inferior'].includes(lado);
  const distancia = reserva + seguranca;
  if (distancia >= (horizontal ? altura : largura)) throw Error('A reserva ocupa toda a peça.');
  const w = largura + 2 * sangria, h = altura + 2 * sangria;
  const x = sangria + (lado === 'direita' ? largura - distancia : distancia);
  const y = sangria + (lado === 'inferior' ? altura - distancia : distancia);
  const guia = horizontal ? [sangria,y,sangria+largura,y] : [x,sangria,x,sangria+altura];
  return {distancia, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}"><title>Prova técnica · ${largura} × ${altura} mm</title><g id="sangria"><rect width="${w}" height="${h}" fill="#fff2dc"/></g><g id="corte"><rect x="${sangria}" y="${sangria}" width="${largura}" height="${altura}" fill="white" stroke="#172e38" stroke-width=".3"/></g><g id="seguranca"><line x1="${guia[0]}" y1="${guia[1]}" x2="${guia[2]}" y2="${guia[3]}" stroke="#e15726" stroke-width=".4" stroke-dasharray="2 1"/></g><text x="${w/2}" y="${h/2}" text-anchor="middle" font-family="sans-serif" font-size="${Math.min(w,h)/22}">${largura} × ${altura} mm · ${distancia} mm · ${xml(lado)}</text></svg>`};
}

export function ofertas(texto) {
  const vistos = new Set();
  return texto.trim().split(/\r?\n/).map((linha,i) => {
    const campos = linha.split(';').map(v => v.trim());
    const [sku,nome,de,por,unidade] = campos;
    if (campos.length !== 5 || campos.some(v => !v) || ![de,por].every(v => /^\d{1,6}([,.]\d{1,2})?$/.test(v))) throw Error('Revise os cinco campos e os preços na linha ' + (i+1));
    if (vistos.has(sku)) throw Error('SKU repetido: ' + sku);
    vistos.add(sku);
    return {sku,nome,de:Number(de.replace(',','.')),por:Number(por.replace(',','.')),unidade};
  });
}
export function cartaz(p, formato) {
  const [w,h,un] = formato === 'A5' ? [148,210,'mm'] : formato === 'Story' ? [1080,1920,'px'] : [1920,1080,'px'];
  const moeda = n => n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const linha = (y,t,tam,cor) => `<text x="${w*.08}" y="${h*y}" font-size="${Math.min(w*tam,w*1.28/Math.max(1,String(t).length))}" fill="${cor}">${xml(t)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}${un}" height="${h}${un}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#18272c"/><g font-family="Arial,sans-serif" font-weight="bold">${linha(.16,'OFERTA',.09,'#ffc45b')}${linha(.40,p.nome,.11,'white')}${linha(.58,'De '+moeda(p.de),.07,'#e3dfd6')}${linha(.76,moeda(p.por),.19,'#ffc45b')}${linha(.85,p.unidade,.06,'white')}</g></svg>`;
}
export function remendo(imagem, {largura, x, y, recorteL, recorteA, margem}) {
  const escala = imagem.width / largura;
  const altura = imagem.height / escala;
  if (x + recorteL > largura + 1e-6 || y + recorteA > altura + 1e-6) throw Error('O recorte precisa caber na peça.');
  const esquerda = Math.max(0,Math.floor((x-margem)*escala));
  const topo = Math.max(0,Math.floor((y-margem)*escala));
  const direita = Math.min(imagem.width,Math.ceil((x+recorteL+margem)*escala));
  const inferior = Math.min(imagem.height,Math.ceil((y+recorteA+margem)*escala));
  return {esquerda,topo,w:direita-esquerda,h:inferior-topo,escala,altura};
}
