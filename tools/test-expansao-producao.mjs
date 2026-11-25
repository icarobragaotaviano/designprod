import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { avaliarFolhas, chapa, lerServicos, editorial, numerar, painelamento, consumoEtapas, compararCustos } from '../nobel/producao/calculo.mjs';
import { triagem, passaporte, tintaBranca } from '../nobel/producao/fluxo.mjs';
import { codigo } from '../nobel/producao/codigos.mjs';
import { apps, desktop } from '../nobel/catalogo.mjs';

const grade = avaliarFolhas({largura:90,altura:50,sangria:3,calha:6,tiragem:1000,pinca:12,lateral:5,cores:'4×4',gramatura:250,bopp:'Sim',producao:'Digital',acerto:5,fibra:'Largura',vinco:'Largura'});
assert.equal(grade[0].nome,'T4');
assert.equal(grade[0].cliques,grade[0].brutas*2);
assert.ok(grade[0].svg.includes('viewBox="0 0 328 478"'));
const itens = lerServicos('Cartão;90;50;3;1000;2\nTag;60;35;3;500;1');
const r = chapa({largura:328,altura:478,margem:8,calha:1,itens});
assert.ok(r.contagem.every((c,i)=>c*r.rodar>=itens[i].total));
for(let i=1;i<r.faixas.length;i++)assert.ok(r.faixas[i].y>=r.faixas[i-1].y+r.faixas[i-1].h);
assert.ok(r.cortes.some(x=>x.includes('refilar')));
const ed = editorial({largura:100,altura:200,dobra:'Carteira',compensacao:2,paginas:22,caliper:.1,cola:.4,capas:.8,folga:3,reserva:15});
assert.equal(ed.aberta,298);
assert.deepEqual(ed.verso,[98,198]);
assert.equal(ed.brancas,2);
assert.equal(ed.creep,.5);
const seq=numerar({inicio:15001,fim:17500,digitos:5,vias:2,bloco:50,colunas:2});
assert.deepEqual(seq.primeira,['15001','16251']);
assert.deepEqual(seq.ultima,['16250','17500']);
const [header, primeira, segunda]=seq.linhas();
assert.equal(header,'Folha;Via;Pilha 1;Pilha 2');
assert.equal(primeira,'1;1;15001;16251');
assert.equal(segunda,'1;2;15001;16251');
assert.throws(()=>numerar({inicio:2,fim:1,digitos:2,vias:1,bloco:1,colunas:1}));
const faixas=painelamento({largura:3000,altura:2200,bobina:1520,margem:10,emenda:20,sangria:10,ajuste:4});
for(const p of faixas){
  assert.ok(p.valido);
  for(let j=1;j<p.faixas.length;j++)assert.ok(Math.abs(p.faixas[j-1].pos+p.faixas[j-1].largura-p.faixas[j].pos-20)<1e-8);
}
assert.equal(consumoEtapas(100,[{nome:'Impressão',acerto:4,perda:2},{nome:'Corte',acerto:2,perda:0}]).folhas,109);
assert.equal(compararCustos(31,{fixo:0,rendimento:1,folha:2},{fixo:30,rendimento:1,folha:1},100).virada,31);
assert.equal(triagem(['sangria','qr']).score,67);
assert.match(triagem(['sangria']).mensagem,/filete branco/);
const ficha=passaporte({os:'1420',cliente:'João & Cia',produto:'Flyer',largura:200,altura:140,cores:'4×0',papel:'Triplex 250',tiragem:50,acabamento:'BOPP',tolerancia:1});
assert.equal(ficha.nome,'OS1420_Joao_Cia_Flyer_200x140_4x0_Triplex_250_BOPP.pdf');
assert.deepEqual(tintaBranca({midia:'Transparente',lado:'Interno do vidro',faces:'Uma face',choke:.1,largura:50,altura:50}).camadas,['Cor','Branco']);

const qrSource=readFileSync(new URL('../nobel/producao/qrcode.js',import.meta.url),'utf8');
const qr=vm.runInNewContext(qrSource+'\nqrcode;');
for(const [tipo,valor] of [['QR','https://ibd.com.br/'],['Code 128 B','OS1420']]){
  const c=codigo({tipo,valor,modulo:.5,papel:'Revestido',altura:20},qr);
  assert.ok(c.w>0&&c.h>0);
  assert.match(c.pdf,/0 0 0 1 k/);
  assert.equal(c.pdf.slice(Number(c.pdf.match(/startxref\n(\d+)/)[1]),-1).startsWith('xref'),true);
  assert.match(c.svg,/shape-rendering="crispEdges"/);
}
assert.throws(()=>codigo({tipo:'Code 128 B',valor:'Ç',modulo:.5,altura:20},qr));
assert.equal(new Set(apps.map(([id])=>id)).size,apps.length);
for(const [nome] of desktop)assert.ok(readFileSync(new URL('../nobel/desktop/'+nome,import.meta.url)).length);
for(const [arquivo] of desktop.filter(([p])=>p.endsWith('.jsx')))new vm.Script(readFileSync(new URL('../nobel/desktop/'+arquivo,import.meta.url),'utf8').replace(/^#target[^\n]*\n/,''));
new vm.Script('const CONFIG={};\n'+readFileSync(new URL('../nobel/producao/lote-ps.txt',import.meta.url),'utf8'));
console.log('Expansão de produção validada.');

function testarCorte(tipo){
  const arquivo=readFileSync(new URL('../nobel/desktop/exportar-corte-illustrator.jsx',import.meta.url),'utf8').replace(/^#target[^\n]*\n/,'');
  const pt=72/25.4;
  const nos=[[0,0],[100*pt,0],[100*pt,50*pt],[0,50*pt]].map(anchor=>({anchor,leftDirection:anchor,rightDirection:anchor}));
  const caminho={typename:'PathItem',closed:true,pathPoints:nos,geometricBounds:[0,50*pt,100*pt,0]};
  const inverso={...caminho,pathPoints:[...nos].reverse()};
  let saida='', mensagem='';
  function Janela(){
    this.show=()=>1;
    this.add=t=>t==='group'?{add(){}}:t==='dropdownlist'?{get selection(){return {text:tipo};},set selection(v){}}:{};
  }
  const destino={name:'prova.'+tipo.toLowerCase(),open(){return true;},write(s){saida=s;return true;},close(){}};
  vm.runInNewContext(arquivo,{app:{documents:[{}],activeDocument:{selection:[caminho,inverso]}},Window:Janela,File:{saveDialog:()=>destino},alert:t=>{mensagem=t;}});
  assert.match(mensagem,/100 × 50 mm/);
  return saida;
}
const svgCorte=testarCorte('SVG');
assert.match(svgCorte,/width="100mm" height="50mm"/);
assert.equal((svgCorte.match(/<path /g)||[]).length,1);
const dxfCorte=testarCorte('DXF');
assert.match(dxfCorte,/\$INSUNITS\n70\n4/);
assert.equal((dxfCorte.match(/LWPOLYLINE/g)||[]).length,1);
assert.match(dxfCorte,/\n90\n4\n70\n1/);
