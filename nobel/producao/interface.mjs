import { scriptIllustratorPlano, moduloCorelPlano } from '../gabarito-editores.mjs';
import { avaliarFolhas, chapa, lerServicos, editorial, numerar, painelamento, consumoEtapas, compararCustos, folhas, mapa } from './calculo.mjs';
import { achados, passaporte, pretos, substratos, tintaBranca, triagem } from './fluxo.mjs';
import { codigo } from './codigos.mjs';
import { xml } from '../calculos.mjs';

const form=document.querySelector('form');
const saida=document.querySelector('#resultado');
const aviso=document.querySelector('#aviso');
const id=document.body.dataset.app;
const fmt=(x,d=2)=>Number(x).toLocaleString('pt-BR',{maximumFractionDigits:d});
const n=(key,label,value,min=0,step='any',max=1e7)=>({key,label,value,min,step,max,kind:'number'});
const i=(key,label,value,min=1,max=1e6)=>n(key,label,value,min,1,max);
const t=(key,label,value='',kind='text',optional=false)=>({key,label,value,kind,optional});
const select=(key,label,values)=>({key,label,values,kind:'select'});
const dims=(w,h)=>[n('largura','Largura (mm)',w,.01),n('altura','Altura (mm)',h,.01)];
const perfis=()=>select('papel','Substrato',Object.keys(substratos));
const colors=()=>select('cores','Cores',['4×0','4×4','1×0']);
const sides=['Largura','Altura'];
const nomesFolha=folhas.map(([nome])=>nome);
const fechamento=['PDF/X-4','PDF/X-1a:2001'];
const apps={
  'preto-tac':[perfis(),n('limite','Limite TAC (%)',300,1,1,400),select('receita','Receita de preto',Object.keys(pretos)),
    ...['C','M','Y','K'].map((x,j)=>n(x,x+' (%)',[50,40,40,100][j],0,.1,100))],
  'fechamento':[select('perfil','Padrão de saída',fechamento),perfis(),n('sangria','Sangria (mm)',3),select('mascara','Enobrecimento',['Nenhum','Somente frente','Frente e verso'])],
  'lote-imagens':[perfis(),n('ppi','Resolução do arquivo (ppi)',300,1,1,2400),n('alvo','Lado maior desejado (mm; 0 preserva pixels)',0),select('intencao','Tipo de imagem',['Fotografia','Produto ou gráfico'])],
  'avaliar-folha':[...dims(90,50),n('sangria','Sangria externa (mm)',3),n('calha','Calha entre peças (mm)',6),colors(),n('gramatura','Gramatura (g/m²)',250,1),
    i('tiragem','Tiragem',1000),n('pinca','Pinça (mm)',12),n('lateral','Margem lateral (mm por lado)',5),i('acerto','Acerto (folhas)',5,0),
    select('producao','Processo',['Digital','Offset']),select('bopp','Laminação BOPP',['Não','Sim']),select('fibra','Fibra da folha',sides),select('vinco','Eixo do vinco na peça',['Nenhum',...sides])],
  'chapa-coletiva':[...dims(328,478),n('margem','Margem nas quatro bordas (mm)',8),n('calha','Espaço entre peças com sangria (mm)',0),
    t('servicos','Uma linha por item · nome; largura mm; altura mm; sangria mm; tiragem; prioridade 1–9','Cartão;90;50;3;1000;2\nTag;60;35;3;500;1','textarea')],
  'dobras':[...dims(100,200),select('dobra','Dobra',['Carteira','Sanfona','Janela','Cruzada']),n('sangria','Sangria externa (mm)',3),n('compensacao','Recuo da aba interna (mm)',2),
    i('paginas','Páginas de miolo',22),n('caliper','Espessura de uma folha (mm)',.1,.001),n('cola','Espessura estimada da cola (mm)',.4),
    n('capas','Espessura somada das capas (mm)',.8),n('folga','Folga de giro (mm)',3),n('reserva','Reserva da furação (mm)',15),select('virada','Virada configurada',['Sheetwise','Work-and-Turn','Work-and-Tumble'])],
  'cut-stack':[i('inicio','Numeração inicial',15001,0),i('fim','Numeração final',17500),i('digitos','Dígitos',5,1,12),i('vias','Vias',2,1,3),
    i('bloco','Folhas por bloco',50,1,1000),i('colunas','Pilhas por folha',2,1,12)],
  'codigos':[select('tipo','Código',['QR','Code 128 B']),t('valor','Conteúdo','https://example.com'),n('modulo','Módulo físico (mm)',.5,.05,.01,10),n('altura','Altura do Code 128 (mm)',18,5,.1,400),select('papel','Superfície',['Revestido','Absorvente'])],
  'painelamento':[...dims(3000,2200),n('bobina','Largura de bobina (mm)',1520,1),n('margem','Margem de máquina (mm por lado)',10),n('emenda','Sobreposição (mm)',20),n('sangria','Sangria externa (mm)',10),n('ajuste','Deslocar emendas (mm)',0,-1e5)],
  'escala-lona':[...dims(4000,2000),n('distancia','Distância de leitura (m)',3,.1),n('alvo','PPI final (0 usa referência pela distância)',0),n('limite','Lado máximo no editor (mm)',5767,1),
    n('virada','Sobra por lado para virada (mm)',30),n('bainha','Bainha por lado (mm)',30),n('bolsa','Bolsa adicional no topo (mm)',0),
    n('seguranca','Margem de segurança interna (mm)',35),n('recuo','Centro do ilhós à borda de corte (mm)',20),n('passo','Passo máximo entre ilhós (mm)',300,1)],
  'tinta-branca':[select('midia','Mídia',['Transparente','Escura','Rígida opaca']),select('lado','Lado de aplicação',['Interno do vidro','Externo ou direto']),
    select('faces','Visibilidade',['Uma face','Duas faces']),n('choke','Recuo do branco (mm)',.15),...dims(100,100),t('spot','Nome da tinta conforme o RIP','White_Ink')],
  'triagem':achados.map(([key,grupo,label])=>({key,label,grupo,kind:'checkbox'})),
  'ficha-os':[t('os','Número da OS','1420'),t('cliente','Cliente'),t('produto','Produto'),...dims(200,140),n('abertaL','Largura aberta (mm; opcional)',0),
    n('abertaA','Altura aberta (mm; opcional)',0),colors(),t('papel','Substrato e gramatura','Triplex 250 g/m²'),i('tiragem','Tiragem',1000),
    select('processo','Processo',['Digital','Offset','Comunicação visual']),t('acabamento','Roteiro de acabamento','Laminação BOPP → Corte'),
    select('folha','Folha de máquina',nomesFolha),i('rendimento','Peças por folha',8),select('fibra','Fibra',sides),n('pinca','Pinça (mm)',12),
    t('icc','Perfil ICC','ISO Coated v2 300% (ECI)'),select('pdf','Padrão de saída',fechamento),t('preto','Receita de preto','Textos em K100'),
    i('acerto','Quebra de acerto (folhas)',5,0),n('tolerancia','Tolerância de corte acordada (mm)',1),t('conferente','Conferente de preflight','','text',true)],
  'custos':[i('tiragem','Tiragem',1000),i('rendimento','Peças por folha',8),t('etapas','Etapa; folhas de acerto; perda percentual','Impressão;5;2\nBOPP;4;1\nCorte;2;0','textarea'),
    n('dFixo','Custo fixo digital (R$)',10),n('dPapel','Papel por folha digital (R$)',.4),n('dClick','Clique digital por face (R$)',.8),i('dFaces','Faces digital',1,1,2),i('dRend','Rendimento digital',8),
    n('oFixo','Acerto offset (R$)',80),n('oChapa','Custo por chapa (R$)',30),i('oChapas','Quantidade de chapas',4,0),n('oMil','Custo por mil folhas rodadas (R$)',200),n('oPapel','Papel por folha offset (R$)',.4),i('oRend','Rendimento offset',12),
    n('m2','Área útil de mídia (m²)',0),n('sobra','Sobra de mídia (%)',10,0,.1,100),n('midiaPreco','Preço de mídia por m² (R$)',0),n('insumos','Ilhós, bastões e demais insumos (R$)',0)]
};

function el(tipo,conteudo) {
  const node=document.createElement(tipo);
  if(conteudo!==undefined)node.textContent=conteudo;
  return node;
}
let grupoAnterior;
for(const c of apps[id]){
  if(c.grupo && c.grupo!==grupoAnterior){
    const h=el('h2',c.grupo);h.className='campo-largo';form.querySelector('fieldset').append(h);grupoAnterior=c.grupo;
  }
  const label=el('label',c.kind==='checkbox'?undefined:c.label);
  const campo=el(c.kind==='select'||c.kind==='textarea'?c.kind:'input');
  campo.name=c.key;
  if(campo.tagName==='INPUT')campo.type=c.kind;
  campo.required=c.kind!=='checkbox'&&!c.optional;
  if(c.kind==='number')Object.assign(campo,{min:c.min,max:c.max,step:c.step});
  if(c.kind==='select')for(const v of c.values)campo.append(new Option(v,v));
  else campo.value=c.kind==='checkbox'?'sim':c.value;
  if(c.kind==='text'||c.kind==='textarea')campo.maxLength=c.kind==='textarea'?12000:900;
  label.append(campo);
  if(c.kind==='checkbox'){label.append(c.label);label.className='check-row campo-largo';}
  form.querySelector('fieldset').append(label);
}

function texto(titulo,valor){
  const box=el('div');box.className='resultado-linha';
  box.append(el('small',titulo),el('strong',valor));saida.append(box);
}
function dica(t){const p=el('p',t);p.className='nota-tecnica';saida.append(p);}
function tabela(colunas,linhas){
  const wrap=el('div');wrap.className='tabela-scroll';
  const tab=el('table');const head=tab.createTHead().insertRow();
  for(const c of colunas){const item=el('th',c);item.scope='col';head.append(item);}
  const corpo=tab.createTBody();
  for(const linha of linhas){const row=corpo.insertRow();for(const c of linha)row.append(el('td',c));}
  wrap.append(tab);saida.append(wrap);
}
const urls=[];
function url(parte,mime){
  const u=URL.createObjectURL(new Blob(Array.isArray(parte)?parte:[parte],{type:mime}));
  urls.push(u);return u;
}
function baixar(nome,arquivo,parte,mime){
  const a=el('a',nome);a.className='acao';a.href=url(parte,mime);a.download=arquivo;saida.append(a);return a.href;
}
function bloco(titulo,valor){
  const label=el('label',titulo);label.className='campo-largo';
  const area=el('textarea');area.readOnly=true;area.value=valor;label.append(area);
  const b=el('button','Copiar '+titulo.toLowerCase());b.type='button';
  b.onclick=async()=>{try{await navigator.clipboard.writeText(valor);aviso.textContent='Copiado.';}catch{area.focus();area.select();aviso.textContent='Texto selecionado para cópia.';}};
  saida.append(label,b);
}
function diagrama(t,s,nome){
  const href=baixar('Baixar '+t,nome+'.svg',s,'image/svg+xml');
  const img=el('img');img.alt=t;img.src=href;saida.append(img);
}
function imprimir(){
  const b=el('button','Imprimir / Salvar em PDF');b.type='button';b.onclick=()=>window.print();saida.append(b);
}
function dados(){
  const d=Object.fromEntries(new FormData(form));
  for(const c of apps[id])if(c.kind==='number')d[c.key]=Number(d[c.key]);
  return d;
}
function instrucao(script,rotulo){const a=el('a',rotulo);a.className='acao';a.href='/apps/desktop/'+script;a.download=script;saida.append(a);}
function json(nome,arquivo,obj){baixar(nome,arquivo,JSON.stringify(obj,null,2),'application/json');}

const render={
  'preto-tac'(d){
    const p=substratos[d.papel],sum=[d.C,d.M,d.Y,d.K].reduce((a,b)=>a+b);
    const r=pretos[d.receita],tac=r.reduce((a,b)=>a+b);
    texto('Cobertura da amostra',fmt(sum)+'% · '+(sum>d.limite?'Acima do teto':'Dentro do teto'));
    texto('Receita',r.map((v,j)=>'CMYK'[j]+v).join(' ')+' · '+tac+'%');
    if(tac>d.limite) dica('A receita escolhida excede o limite de tinta.');
    texto('Perfil de referência',p.icc);
    dica('Ajuste o teto ao perfil aprovado para a máquina. TAC desta tela é a soma nominal CMYK, sem simular transparências e separações do RIP.');
    instrucao('auditar-arte-illustrator.jsx','Auditar no Illustrator');
    instrucao('auditar-arte-corel.bas','Auditar no CorelDRAW');
  },
  'fechamento'(d){
    const modern=d.perfil==='PDF/X-4';
    const plano={padrao:d.perfil,icc:substratos[d.papel].icc,sangria:d.sangria,marcas:modern?'Somente se o fornecedor solicitar, com afastamento ≥ sangria.':'Desligadas.',
      acao:modern?'Manter transparência e fontes conforme a predefinição.':'Usar o preset homologado de PDF/X-1a:2001, achatar transparência e converter texto apenas na cópia, se exigido.'};
    for(const [k,v] of Object.entries(plano))texto(k,String(v));
    if(d.mascara!=='Nenhum'){
      plano.paginas=d.mascara==='Somente frente'?['1 · Máscara frente K100','2 · Arte frente CMYK']:['1 · Máscara frente K100','2 · Arte frente CMYK','3 · Máscara verso K100','4 · Arte verso CMYK'];
      bloco('Ordem acordada com o fornecedor',plano.paginas.join('\n'));
    }
    dica('Confirme o OutputIntent, as caixas de página e as separações no PDF exportado. Para layers ISO 19593-1, confira o suporte e o mapeamento na ferramenta de fechamento.');
    json('Baixar plano de fechamento','fechamento.json',plano);
    instrucao('fechar-pdf-illustrator.jsx','Exportar pelo Illustrator');
    instrucao('fechar-pdf-corel.bas','Exportar pelo CorelDRAW');
  },
  'lote-imagens'(d){
    const config={icc:substratos[d.papel].icc,ppi:d.ppi,mm:d.alvo,perceptual:d.intencao==='Fotografia'};
    texto('Destino CMYK',config.icc);
    texto('Saída','Cópias JPEG na pasta _PREPRESS_OK');
    dica('Instale o ICC selecionado no Photoshop. O lote mantém os originais. Confira as cópias e o relatório antes de enviar ao fechamento.');
    const b=el('button','Gerar script configurado (.psjs)');
    b.type='button';
    b.onclick=async()=>{
      b.disabled=true;
      try{
        const resposta=await fetch('lote-ps.txt');
        if(!resposta.ok)throw Error('Script indisponível.');
        const source=await resposta.text();
        if(!b.isConnected)return;
        baixar('Baixar script Photoshop','ibd-prepress.psjs','const CONFIG = '+JSON.stringify(config)+';\n'+source,'text/plain');
        b.remove();
      }catch(e){aviso.textContent=e.message;b.disabled=false;}
    };
    saida.append(b);
  },
  'avaliar-folha'(d){
    if(d.calha!==0&&d.calha<2*d.sangria)throw Error('No corte duplo, deixe pelo menos duas sangrias entre as peças.');
    const r=avaliarFolhas(d);
    tabela(['Formato','Área útil (mm)','Grade','Folhas líquidas + acerto','Ocupação','Cliques'],r.map(f=>[f.nome,fmt(f.areaW)+' × '+fmt(f.areaH),f.pecas?f.nx+' × '+f.ny+(f.girou?' ↻':''):'—',f.brutas??'—',fmt(f.aproveitamento)+'%',f.cliques??'—']));
    const melhores=r.slice(0,3).filter(f=>f.liquidas).sort((a,b)=>Number(b.dobra)-Number(a.dobra)||a.brutas-b.brutas);
    if(melhores.length)texto('Formato sugerido pela fibra e consumo',melhores[0].nome+' · '+melhores[0].brutas+' folha(s)');
    for(const f of r.filter(x=>x.svg)){
      if(f.avisos.length)dica(f.nome+' · '+f.avisos.join(' '));
      diagrama('grade '+f.nome,f.svg,'grade-'+f.nome.replaceAll(' ',''));
    }
    if(!r.some(f=>f.pecas))dica('A peça não cabe nos formatos com as margens informadas.');
    dica('O cálculo de cliques assume uma cobrança por face impressa. A equivalência entre formatos depende do contrato da máquina.');
  },
  'chapa-coletiva'(d){
    const itens=lerServicos(d.servicos);
    const r=chapa({...d,itens});
    texto('Folhas para atingir as tiragens',r.rodar);
    tabela(['Item','Por folha','Produzidas','Excedente'],itens.map((s,i)=>[s.nome,r.contagem[i],r.contagem[i]*r.rodar,r.contagem[i]*r.rodar-s.total]));
    diagrama('mapa de chapa',r.svg,'chapa-coletiva');
    bloco('Sequência de cortes',r.cortes.map((x,i)=>(i+1)+'. '+x).join('\n'));
    dica('Layout por faixas retas. Rode juntos serviços com substrato, face e cores compatíveis.');
    imprimir();
  },
  'dobras'(d){
    const r=editorial(d);
    texto('Formato aberto',fmt(r.aberta)+' × '+fmt(r.abertaH)+' mm');
    texto('Painéis',r.paineis.map(x=>fmt(x)).join(' / ')+' mm');
    texto('Vincos X frente / verso',r.vincos.map(x=>fmt(x)).join(', ')+' / '+r.verso.map(x=>fmt(x)).join(', ')+' mm');
    if(d.dobra==='Cruzada')texto('Vinco horizontal Y',fmt(d.altura)+' mm');
    texto('Canoa',r.preenchidas+' páginas · '+r.brancas+' em branco');
    texto('Lombada quadrada estimada',fmt(r.lombada)+' mm');
    texto('Wire-o sugerido',r.anel?r.anel[1]+'" · passo '+r.anel[2]+' · reserva '+fmt(r.reserva)+' mm':'Acima da tabela de anéis');
    texto('Preps 9',d.virada+' · creep estimado máximo '+fmt(r.creep,3)+' mm · incremento '+fmt(d.caliper,3)+' mm/folha');
    dica('Confira a pilha física, a capacidade do anel e o sinal do shingling no Preps conforme o método de imposição.');
    diagrama('gabarito de dobras',r.svg,'gabarito-dobras');imprimir();
    json('Baixar parâmetros','preps-dobras.json',{...d,...r,svg:undefined});
    const linhas=r.vincos.map(x=>[[x,0],[x,r.abertaH]]);
    if(d.dobra==='Cruzada')linhas.push([[0,d.altura],[r.aberta,d.altura]]);
    const plano={largura:r.aberta,altura:r.abertaH,sangria:d.sangria,linhas,camada:'Guias de vinco'};
    baixar('Criar no CorelDRAW','gabarito-dobras.bas',moduloCorelPlano(plano),'text/plain');
    baixar('Criar no Illustrator','gabarito-dobras.jsx',scriptIllustratorPlano(plano),'text/plain');
  },
  'cut-stack'(d){
    const r=numerar(d);
    texto('Blocos e folhas numeradas por via',r.blocos+' blocos · '+r.folhas+' folhas');
    texto('Espaços em branco por via',r.brancos);
    tabela(['Folha',...r.primeira.map((_,i)=>'Pilha '+(i+1))],[['Primeira',...r.primeira],['Última',...r.ultima]]);
    baixar('Baixar CSV de mesclagem','cut-and-stack.csv',['\uFEFF',...Array.from(r.linhas(),l=>l+'\r\n')],'text/csv;charset=utf-8');
    dica('Empilhe folhas em ordem crescente em cada via, corte e reúna as pilhas na ordem das colunas. Células vazias são sobras de imposição.');
  },
  'codigos'(d){
    const r=codigo(d,globalThis.qrcode);
    texto('Tamanho físico com área livre',fmt(r.w)+' × '+fmt(r.h)+' mm');
    if(d.modulo<r.minimo)dica('Módulo inferior à referência inicial de '+fmt(r.minimo)+' mm para esta superfície. Faça prova de leitura.');
    diagrama('código vetorial',r.svg,'codigo');
    baixar('Baixar PDF vetorial K100','codigo-k100.pdf',r.pdf,'application/pdf');
    dica('Mantenha a área branca livre em torno do símbolo. Confira a leitura no tamanho final e após laminação.');
  },
  'painelamento'(d){
    const r=painelamento(d);
    tabela(['Corte','Faixas','Bobina (m)','Área (m²)','Sobra'],r.map(a=>[a.horizontal?'Horizontal':'Vertical',a.qtd,a.valido?fmt(a.metros):'Excede largura útil',fmt(a.area),fmt(a.sobra)+'%']));
    for(const a of r.filter(x=>x.valido)){
      const nome=a.horizontal?'horizontal':'vertical';
      diagrama('mapa '+nome,a.svg,'painel-'+nome);
      bloco('Medidas · '+nome,a.faixas.map((f,i)=>'Faixa '+(i+1)+' · início '+fmt(f.pos)+' mm · '+fmt(f.largura)+' × '+fmt(a.b)+' mm').join('\n'));
    }
    imprimir();
  },
  'escala-lona'(d){
    const w=d.largura+2*(d.virada+d.bainha),h=d.altura+2*(d.virada+d.bainha)+d.bolsa;
    const escala=[1,2,5,10].find(x=>Math.max(w,h)/x<=d.limite);
    const ppi=d.alvo||Math.max(20,Math.min(150,Math.ceil(87.3/d.distancia)));
    texto('Material aberto',fmt(w)+' × '+fmt(h)+' mm');
    texto('Configuração de arquivo',escala?'1:'+escala+' · '+fmt(ppi*escala)+' ppi no arquivo · '+fmt(ppi)+' ppi finais':'O tamanho excede o limite em 1:10.');
    if(2*d.recuo>=Math.min(d.largura,d.altura))throw Error('Recuo dos ilhós ocupa toda a peça.');
    const wa=d.largura-2*d.recuo,ha=d.altura-2*d.recuo;
    const nx=Math.ceil(wa/d.passo),ny=Math.ceil(ha/d.passo);
    if(nx+ny>1000)throw Error('Aumente o passo dos ilhós.');
    const pts=[];
    for(let x=0;x<=nx;x++)for(const y of [0,ha])pts.push([x*wa/nx,y]);
    for(let y=1;y<ny;y++)for(const x of [0,wa])pts.push([x,y*ha/ny]);
    const s=Math.max(d.seguranca,d.recuo+5), shift=d.virada+d.bainha;
    if(2*s>=Math.min(d.largura,d.altura))throw Error('Margem de segurança ocupa toda a peça.');
    const svg=mapa(w,h,'<rect x="'+shift+'" y="'+(shift+d.bolsa)+'" width="'+d.largura+'" height="'+d.altura+'" fill="none" stroke="#495462"/><rect x="'+(shift+s)+'" y="'+(shift+d.bolsa+s)+'" width="'+(d.largura-2*s)+'" height="'+(d.altura-2*s)+'" fill="none" stroke="#2b6cb0"/>'+pts.map(([x,y])=>'<circle cx="'+(x+d.recuo+shift)+'" cy="'+(y+d.recuo+shift+d.bolsa)+'" r="4" fill="#d91b77"/>').join(''));
    texto('Ilhós e passo',pts.length+' · horizontal '+fmt(wa/nx)+' mm · vertical '+fmt(ha/ny)+' mm');
    dica('A resolução por distância é uma estimativa inicial. Considere RIP, mídia e conteúdo da peça. Os ilhós são definidos em relação à borda do formato final.');
    diagrama('lona com ilhós',svg,'lona-ilhos');
  },
  'tinta-branca'(d){
    const r=tintaBranca(d);
    if(!/^[\w. -]{1,40}$/.test(d.spot))throw Error('Informe um nome de tinta simples, conforme o RIP.');
    texto('Orientação',r.espelho?'Espelhar horizontalmente a arte vista pelo vidro':'Manter a orientação da arte');
    texto('Ordem de impressão sugerida',r.camadas.join(' → '));
    texto('Tinta especial e recuo',r.spot+' · '+fmt(r.choke,3)+' mm');
    dica('A ordem indica a pilha proposta para a aplicação. Confirme sentido de impressão, nome da tinta especial e interpretação da fila no RIP.');
    dica('O gabarito aplica o recuo a uma base retangular. Para silhuetas livres, aplique e confira o recuo sobre a forma no editor.');
    const [x,y,w,h]=r.base;
    diagrama('mapa da base retangular',mapa(d.largura,d.altura,'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="#d4e3ec" stroke="#2b6cb0"/>'),'base-retangular');
    const jsx='#target illustrator\n(function(){var p='+JSON.stringify({...d,base:r.base})+';var k=72/25.4;var doc=app.documents.add(DocumentColorSpace.CMYK,p.largura*k,p.altura*k);var layer=doc.layers.add();layer.name=p.spot;var spot=doc.spots.add();spot.name=p.spot;spot.colorType=ColorModel.SPOT;var ink=new CMYKColor();ink.cyan=35;spot.color=ink;var c=new SpotColor();c.spot=spot;c.tint=100;var a=doc.artboards[0].artboardRect;var r=layer.pathItems.rectangle(a[1]-p.base[1]*k,a[0]+p.base[0]*k,p.base[2]*k,p.base[3]*k);r.stroked=false;r.filled=true;r.fillColor=c;r.fillOverprint=true;}());\n';
    baixar('Baixar base retangular para Illustrator','tinta-branca.jsx',jsx,'text/plain');
    instrucao('camada-tecnica-illustrator.jsx','Gerar camada pela seleção no Illustrator');
    json('Baixar receita técnica','tinta-branca.json',r);
  },
  'triagem'(d){
    const r=triagem(Object.keys(d));texto('Prontidão',r.score+' / 100 · '+r.status);bloco('Mensagem para o cliente',r.mensagem);
  },
  'ficha-os'(d){
    if(Boolean(d.abertaL)!==Boolean(d.abertaA))throw Error('Preencha as duas medidas do formato aberto.');
    const r=passaporte(d);
    bloco('Nome do arquivo',r.nome);bloco('Aprovação do cliente',r.cliente);
    tabela(['Campo','Produção'],Object.entries(r.ficha).filter(([,v])=>v!==null));
    json('Baixar passaporte JSON','passaporte-os.json',r);
    const html='<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Passaporte OS</title><h1>Passaporte OS</h1><dl>'+Object.entries(r.ficha).filter(([,v])=>v!==null).map(([k,v])=>'<dt>'+xml(k)+'</dt><dd>'+xml(v)+'</dd>').join('')+'</dl></html>';
    baixar('Baixar passaporte HTML','PASSAPORTE_OS.html',html,'text/html');imprimir();
    instrucao('pastas-passaporte.ps1','Criador de pastas Windows');
    instrucao('pastas-passaporte.bat','Lançador Windows');
  },
  'custos'(d){
    const etapas=d.etapas.trim().split(/\r?\n/).map((s,j)=>{
      const [nome,a,p,...resto]=s.split(';');const acerto=Number(a),perda=Number((p||'').replace(',','.'));
      if(resto.length||!nome.trim()||!a?.trim()||!p?.trim()||!Number.isSafeInteger(acerto)||acerto<0||!Number.isFinite(perda)||perda<0||perda>=100)throw Error('Revise a linha '+(j+1)+' de acertos.');
      return {nome,acerto,perda};
    });
    const r=consumoEtapas(Math.ceil(d.tiragem/d.rendimento),etapas);
    tabela(['Etapa','Entrada','Perda e acerto','Saída'],r.calculadas.map(l=>[l.nome,l.antes,l.quebra,l.depois]));
    texto('Total de folhas para iniciar',r.folhas);
    if(etapas.length>25)throw Error('Use até 25 etapas para comparar os custos.');
    const c=compararCustos(d.tiragem,{fixo:d.dFixo,rendimento:d.dRend,folha:d.dPapel+d.dClick*d.dFaces,etapas},
      {fixo:d.oFixo+d.oChapa*d.oChapas,rendimento:d.oRend,folha:d.oPapel+d.oMil/1000,etapas},200000);
    texto('Digital / offset na tiragem informada','R$ '+fmt(c.consulta[0])+' / R$ '+fmt(c.consulta[1]));
    texto('Primeira tiragem com offset mais barato',c.virada??'Não encontrada até 200.000 unidades');
    dica('Degraus de aproveitamento podem mudar o menor custo de uma tiragem para a próxima.');
    if(d.m2)texto('Mídia e insumos',fmt(d.m2*(1+d.sobra/100))+' m² · R$ '+fmt(d.m2*(1+d.sobra/100)*d.midiaPreco+d.insumos));
  }
};

function atualizar(){
  for(const u of urls.splice(0))URL.revokeObjectURL(u);
  saida.replaceChildren();aviso.textContent='';
  if(!form.reportValidity())return;
  try{render[id](dados());}
  catch(e){saida.replaceChildren();aviso.textContent=e.message||String(e);}
}
form.addEventListener('submit',e=>{e.preventDefault();atualizar();});
if(id==='triagem')form.addEventListener('change',atualizar);
if(id==='preto-tac')form.elements.papel.addEventListener('change',e=>{form.elements.limite.value=substratos[e.target.value].tac;});
atualizar();
