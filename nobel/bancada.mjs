import {scriptIllustrator, moduloCorel} from './gabarito-editores.mjs';
import {consumo, grades, gabarito, ofertas, cartaz, remendo} from './calculos.mjs';
import {parseOrderNumberParts, effectiveOrderLink, effectiveOrderPath, effectiveOrderPrintLink} from './model.js';
import {localList} from './storage.js';

const id = document.body.dataset.app;
const form = document.querySelector('form');
const saida = document.querySelector('#resultado');
const aviso = document.querySelector('#aviso');
let urls = [];
const numero = (n, casas=2) => n.toLocaleString('pt-BR',{maximumFractionDigits:casas});
const campo = (nome, rotulo, valor, tipo='number', min=0.01) => ({nome,rotulo,valor,tipo,min});
const inteiro = (nome, rotulo, valor, min=1) => ({...campo(nome,rotulo,valor,'number',min),step:1});
const escolha = (nome,rotulo,opcoes) => ({nome,rotulo,tipo:'select',opcoes});
const arquivo = campo('imagem','Imagem PNG, JPEG ou WebP','','file');
const largura = (v=328) => campo('largura','Largura (mm)',v);
const altura = (v=478) => campo('altura','Altura (mm)',v);
const campos = {
  enderecos:[campo('os','Cliente e pedido','0123-004567','text')],
  consumo:[inteiro('tiragem','Tiragem',1000),inteiro('rendimento','Peças por folha',8),inteiro('acerto','Folhas de acerto por forma',10,0),inteiro('formas','Formas',1),campo('perda','Perda sobre folhas líquidas (%)',5,'number',0),largura(),altura(),campo('gramatura','Gramatura (g/m²)',250)],
  corte:[largura(660),altura(960),campo('pecaL','Largura da peça (mm)',328),campo('pecaA','Altura da peça (mm)',478),campo('refilo','Refile por borda (mm)',0,'number',0),escolha('fibra','Fibra da folha-mãe',['altura','largura'])],
  gabarito:[campo('os','OS (opcional)','','text'),campo('item','Item','000001','text'),inteiro('revisao','Revisão',1),largura(210),altura(150),campo('sangria','Sangria (mm)',3,'number',0),campo('reserva','Reserva de furação (mm)',11,'number',0),campo('seguranca','Segurança adicional (mm)',3,'number',0),escolha('lado','Borda de encadernação',['superior','esquerda','direita','inferior'])],
  ofertas:[campo('produtos','Uma linha por produto · SKU;Nome;De;Por;Unidade','001;Café especial;24,90;19,90;500 g','textarea'),escolha('formato','Formato',['A5','Story','Horizontal'])],
  remendo:[arquivo,largura(1000),campo('x','X a partir da esquerda (mm)',0,'number',0),campo('y','Y a partir do topo (mm)',0,'number',0),campo('recorteL','Largura do reparo (mm)',100),campo('recorteA','Altura do reparo (mm)',100),campo('margem','Margem extra (mm)',3,'number',0)],
  preflight:[arquivo,largura(100),altura(150),campo('alvo','Resolução de referência (ppi)',300)]
};

function elemento(tipo,texto) {
  const el = document.createElement(tipo);
  if (texto !== undefined) el.textContent=texto;
  return el;
}
for(const spec of campos[id]){
  const label=elemento('label',spec.rotulo);
  const el=elemento(['select','textarea'].includes(spec.tipo)?spec.tipo:'input');
  el.name=spec.nome;
  if(el.tagName==='INPUT') el.type=spec.tipo;
  if(spec.tipo==='number'){el.min=spec.min;el.step=spec.step || 'any';}
  if(spec.tipo==='select') for(const valor of spec.opcoes) el.append(new Option(valor,valor));
  else if(spec.tipo==='file') el.accept='image/png,image/jpeg,image/webp';
  else el.value=spec.valor;
  el.required=!(id==='gabarito' && spec.nome==='os');
  label.append(el);
  form.querySelector('fieldset').append(label);
}
function limpar(){
  urls.forEach(URL.revokeObjectURL);
  urls=[];
  saida.replaceChildren();
  aviso.textContent='';
}
function linha(nome,valor) {
  const item=elemento('div');
  item.className='resultado-linha';
  item.append(elemento('small',nome),elemento('strong',valor));
  saida.append(item);
}
function link(titulo,href,download) {
  const a=elemento('a',titulo);
  a.href=href;
  if(download) a.download=download;
  else {a.target='_blank';a.rel='noopener';}
  a.className='acao';
  saida.append(a);
}
function url(blob){const valor=URL.createObjectURL(blob);urls.push(valor);return valor;}
function svg(titulo,fonte,nome){
  const href=url(new Blob([fonte],{type:'image/svg+xml'}));
  const img=elemento('img');
  img.alt=titulo;img.src=href;
  saida.append(img);link(titulo,href,nome);
}
function copiar(rotulo,valor){
  const b=elemento('button','Copiar '+rotulo);
  b.type='button';b.onclick=async()=>{try{await navigator.clipboard.writeText(valor);aviso.textContent='Copiado.';}catch{aviso.textContent='Selecione e copie o valor exibido acima.';}};
  linha(rotulo,valor);saida.append(b);
}

let versao=0;
async function renderizar(){
  const atual=++versao;
  limpar();
  if(!form.reportValidity())return;
  const dados=Object.fromEntries(new FormData(form));
  for(const spec of campos[id]) if(spec.tipo==='number') dados[spec.nome]=Number(dados[spec.nome]);
  try{
    if(id==='enderecos'){
      const partes=parseOrderNumberParts(dados.os);
      if(!partes) throw Error('Informe quatro dígitos de cliente e seis de pedido, com pedido maior que zero.');
      const lista=await localList();
      if(atual!==versao)return;
      const os=lista.find(item=>item.number===partes.formatted) || {number:partes.formatted};
      copiar('cliente',partes.client);copiar('pedido',partes.request);copiar('OS',partes.formatted);copiar('pasta',effectiveOrderPath(os));
      link('Abrir pedido',effectiveOrderLink(os));link('Versão de impressão',effectiveOrderPrintLink(os));
    }else if(id==='consumo'){
      const r=consumo(dados);
      for(const [nome,val] of [['Folhas líquidas',r.liquidas],['Acerto',r.ajuste],['Perdas',r.perdas],['Total de folhas',r.total],['Peso (kg)',r.kg],['Resmas de 500',r.resmas]]) linha(nome,numero(val));
    }else if(id==='corte'){
      const opcoes=grades(dados);
      if(!opcoes[0].total) throw Error('A peça não cabe na área disponível.');
      for(const r of opcoes) linha(r.girada?'Peça girada 90°':'Peça a 0°',r.total+' peças · '+numero(r.aproveitamento)+'%');
      const r=opcoes[0];
      linha('Plano de corte em grade',r.colunas+' tiras de '+numero(r.w)+' mm; dividir cada tira em '+r.linhas+' peças de '+numero(r.h)+' mm.');
      linha('Fibra paralela à',r.fibra);
    }else if(id==='gabarito'){
      if(dados.os && !parseOrderNumberParts(dados.os))throw Error('OS inválida.');
      if(!/^\d{6}$/.test(dados.item))throw Error('Informe um item de seis dígitos.');
      const r=gabarito(dados);
      linha('Distância à borda',numero(r.distancia)+' mm');
      const nome = [dados.os ? parseOrderNumberParts(dados.os).formatted : 'avulso',dados.item,'rev'+dados.revisao].join('_');
      const script = (texto) => url(new Blob([texto],{type:'text/plain;charset=utf-8'}));
      link('Criar no CorelDRAW (.bas)',script(moduloCorel(dados)),nome+'.bas');
      link('Criar no Illustrator (.jsx)',script(scriptIllustrator(dados)),nome+'.jsx');
      saida.append(elemento('p','CorelDRAW Windows: importe o BAS no editor VBA e execute CriarGabarito. Illustrator: use Arquivo → Scripts → Outro script. Cada comando cria um documento novo.'));
      svg('Baixar prova técnica SVG',r.svg,'gabarito-cotado.svg');
      link('Baixar medidas JSON',url(new Blob([JSON.stringify({versaoContrato:1,os:dados.os ? parseOrderNumberParts(dados.os).formatted : null,item:dados.item,revisao:dados.revisao,estado:'em_prova',produto:'calendario',unidade:'mm',origem:'superior_esquerdo_do_corte',corte:{largura:dados.largura,altura:dados.altura},sangria:Object.fromEntries(['superior','direita','inferior','esquerda'].map(l=>[l,dados.sangria])),acabamento:{tipo:'wire_o',lado:dados.lado,reserva:dados.reserva,segurancaAdicional:dados.seguranca},perfil:{id:'nobel-wire-o',versao:1}},null,2)],{type:'application/json'})),'medidas-gabarito.json');
    }else if(id==='ofertas'){
      for(const produto of ofertas(dados.produtos)) svg('Baixar '+produto.sku,cartaz(produto,dados.formato),'oferta-'+produto.sku.replace(/[^\w-]/g,'_')+'.svg');
    }else{
      const img=await createImageBitmap(dados.imagem);
      try{
        if(versao!==atual)return;
        if(id==='preflight'){
          const px=img.width*25.4/dados.largura,py=img.height*25.4/dados.altura;
          linha('Imagem',img.width+' × '+img.height+' px');linha('Resolução X / Y',numero(px)+' / '+numero(py)+' ppi');
          linha('Conferência',Math.min(px,py)>=dados.alvo?'Dentro da referência':'Abaixo da referência');
          if(Math.abs(px/py-1)>.01)linha('Proporção','O formato informado deforma a imagem.');
        }else{
          const r=remendo(img,dados);
          const canvas=elemento('canvas');canvas.width=r.w;canvas.height=r.h;
          canvas.getContext('2d').drawImage(img,r.esquerda,r.topo,r.w,r.h,0,0,r.w,r.h);
          const blob=await new Promise(ok=>canvas.toBlob(ok,'image/png'));
          if(versao!==atual)return;
          if(!blob)throw Error('O navegador não conseguiu criar o PNG neste tamanho.');
          linha('Aplicação (X / Y)',numero(r.esquerda/r.escala)+' / '+numero(r.topo/r.escala)+' mm');
          linha('Tamanho final para aplicar',numero(r.w/r.escala)+' × '+numero(r.h/r.escala)+' mm');
          saida.append(canvas);link('Baixar remendo PNG',url(blob),'remendo.png');
          const mapa={imagem:dados.imagem.name,unidade:'mm',origem:'superior esquerda',x:r.esquerda/r.escala,y:r.topo/r.escala,largura:r.w/r.escala,altura:r.h/r.escala,ppi:r.escala*25.4};
          const arte=canvas.toDataURL('image/png');
          const svgEscala='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="'+mapa.largura+'mm" height="'+mapa.altura+'mm" viewBox="0 0 '+r.w+' '+r.h+'"><image width="'+r.w+'" height="'+r.h+'" xlink:href="'+arte+'"/></svg>';
          link('Baixar SVG no tamanho físico',url(new Blob([svgEscala],{type:'image/svg+xml'})),'remendo-escala-real.svg');
          link('Baixar mapa de aplicação',url(new Blob([JSON.stringify(mapa,null,2)],{type:'application/json'})),'remendo-mapa.json');
        }
      }finally{img.close();}
    }
  }catch(e){if(versao===atual){limpar();aviso.textContent=e.message;}}
}
form.onsubmit=e=>{e.preventDefault();renderizar();};
form.oninput=()=>{versao++;limpar();};
if(!campos[id].some(c=>c.tipo==='file')) renderizar();
