import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { desktop } from '../nobel/catalogo.mjs';
import { scriptsImposicao, familiaImposicao } from '../nobel/imposicao/versoes.mjs';
import { reunirVersoes } from './familias-site.mjs';

const raiz = new URL('../', import.meta.url);
const ler = p => readFileSync(new URL(p, raiz), 'utf8');
const fonte = ler('nobel/imposicao/grade.js');
const { imposicaoOpcoes, imposicaoGrade, imposicaoRetangulo, imposicaoPoligono, imposicaoPt: pt } =
    vm.runInNewContext(fonte + '\n({imposicaoOpcoes,imposicaoGrade,imposicaoRetangulo,imposicaoPoligono,imposicaoPt})');
const normalizar = v => JSON.parse(JSON.stringify(v));
function validarPonto(atual, esperado) {
    assert.equal(atual.length, esperado.length);
    for (let i = 0; i < atual.length; i++) assert.ok(Math.abs(atual[i]-esperado[i]) < 1e-7, atual + ' ≠ ' + esperado);
}

const arte = [20,30,70,50], vertices = [[20,30],[70,30],[70,50],[20,50]];
const deslocada = imposicaoRetangulo(arte, 2);
const grade = imposicaoGrade(imposicaoOpcoes('140;90;10;5;0;2;1;1'), arte, deslocada);
assert.equal(grade.maximo, 4);
assert.equal(grade.posicoes.length, 4);
assert.equal(grade.marcas.length, 8);
const [dx,dy] = grade.posicoes[0];
assert.ok(arte[0]+dx > deslocada[0]+dx);
assert.ok(arte[1]+dy > deslocada[1]+dy);
validarPonto([grade.posicoes[1][0]-dx, grade.posicoes[2][1]-dy], [59+0.25/pt,29+0.25/pt]);
assert.equal(imposicaoOpcoes('130;90;10;5;1;-2,5;1;1').offset, -2.5);
assert.throws(()=>imposicaoGrade(imposicaoOpcoes('140;90;10;5;5;2;1;1'),arte,deslocada), /até 4/);
assert.throws(()=>imposicaoOpcoes('130;90;7;5;0;0;1;1'), /8 mm/);
assert.throws(()=>imposicaoOpcoes('130;90;10;5;11 mm;0;1;1'), /parâmetro/);
assert.throws(()=>imposicaoGrade(imposicaoOpcoes('40;40;10;5;0;0;0;1'),arte,arte), /não cabe/);
assert.throws(()=>imposicaoGrade(imposicaoOpcoes('130;90;1;0;0;0;0;1'),[0,0,0.1,0.1],[0,0,0.1,0.1]), /500/);
assert.throws(()=>imposicaoRetangulo(arte,-10), /anula/);
assert.deepEqual(normalizar(imposicaoPoligono(vertices,2)), [[18,28],[72,28],[72,52],[18,52]]);
assert.deepEqual(normalizar(imposicaoPoligono(vertices.slice().reverse(),-2)), [[22,48],[68,48],[68,32],[22,32]]);
assert.throws(()=>imposicaoPoligono(vertices,-11), /recuo/i);
assert.throws(()=>imposicaoPoligono([[0,0],[10,0],[5,5],[10,10],[0,10]],1), /convexo/);

const ferramentas = JSON.parse(ler('catalog.json')).ferramentas.concat(
    desktop.map(([nome,rotulo])=>({id:'desktop/'+nome, titulo:rotulo, baixar:'/apps/desktop/'+nome})));
const { apps } = await import('../nobel/catalogo.mjs');
for (const [id] of apps) ferramentas.push({id:'web/'+id,abrir:'/apps/'+id+'/'});
reunirVersoes(ferramentas);
assert.equal(familiaImposicao.length,5);
for (const id of familiaImposicao) assert.equal(ferramentas.find(f=>f.id===id).versoes.length,4);

function empacotado(nome) {
    const codigo = ler('nobel/desktop/'+nome);
    assert.equal(codigo.split('/* @ibd-imposicao-grade */').length,2,nome);
    return codigo.replace('/* @ibd-imposicao-grade */',()=>fonte).replace(/^#target[^\n]*\n/,'');
}
for (const [nome] of scriptsImposicao) {
    if (!nome.endsWith('.bas')) new vm.Script(empacotado(nome));
}

const entrada = '130;90;10;5;1;2;1;1';
const coordenadas = [], espelhos = [];
let identificador = 10;
vm.runInNewContext(empacotado('imposicao-arte-corte-vectorcraft.js'), {
    vc: { run(id,p) {
        switch (id) {
            case 'document.inspect': return p.ids ? {nodes:[{bounds:{x:20*pt,y:30*pt,width:50*pt,height:20*pt}}]} :
                {selection:[10],artboards:[{x:0,y:0,width:130*pt,height:90*pt}]};
            case 'artboard.new': coordenadas.push(p); return {index:coordenadas.length};
            case 'object.move': espelhos.push(p); return {ids:[++identificador]};
            case 'path.create': espelhos.push(p); return {id:++identificador};
            case 'paint.setFill': case 'paint.setStroke': case 'stroke.set': case 'select.set': return {};
            default: throw Error(id);
        }
    }},
    prompt:()=>entrada, alert(){}
});
assert.equal(coordenadas.length,2);
assert.equal(coordenadas[0].width,coordenadas[1].width);
const limiteArte = 20 + (espelhos[0].dx-coordenadas[0].x)/pt;
const limiteFaca = (espelhos[1].anchors[0].x-coordenadas[1].x)/pt;
validarPonto([limiteArte-limiteFaca], [2]);
for (let i=0; i<8; i++) {
    const a = espelhos[2+i].anchors[0], b = espelhos[10+i].anchors[0];
    validarPonto([(b.x-a.x)/pt,(b.y-a.y)/pt], [145,0]);
}

const paginas = [];
const original = {
    LeftX:20, TopY:60, RightX:70, BottomY:40,
    CopyToLayer(camada) {
        const copia = {LeftX:7,TopY:88, Move(x,y) { camada.arte.push([7+x,88+y]); }};
        return {Count:1, Item:()=>copia};
    }
};
function pagina() {
    const p = {camadas:[], Activate(){}, SetSize(w,h){this.tamanho=[w,h];},
        CreateLayer(nome) {
            const camada = {nome, arte:[], linhas:[],
                CreateRectangle2(x,y,w,h){this.arte.push([x,y,w,h]);return figura();},
                CreateLineSegment(...pts){this.linhas.push(pts);return figura();}
            };
            this.camadas.push(camada);
            return camada;
        }
    };
    paginas.push(p);
    return p;
}
function figura() {
    return {Fill:{ApplyNoFill(){}}, Outline:{SetNoOutline(){},SetProperties(){}}};
}
const doc = {Unit:9,AddPages:pagina};
vm.runInNewContext(empacotado('imposicao-arte-corte-tracedraw.js')+'\nTraceDrawPlugin.commands[0].run();', {
    ActiveDocument:doc, ActivePage:{Activate(){}}, ActiveSelectionRange:{Count:1,Item:()=>original},
    cdrMillimeter:3, Application:{CreateCMYKColor:(...c)=>c}, prompt:()=>entrada, alert(){}
});
assert.equal(doc.Unit, 9);
assert.deepEqual(paginas.map(p=>[p.Name,p.tamanho]), [['ARTE',[130,90]],['FACA',[130,90]]]);
const [ax,ay] = paginas[0].camadas[0].arte[0], [fx,fy,,fh] = paginas[1].camadas[0].arte[0];
validarPonto([ax-fx,fy+fh-ay],[2,2]);
assert.deepEqual(paginas[0].camadas[1].linhas,paginas[1].camadas[1].linhas);
console.log('Grade, offset, versões e alinhamento da arte com a faca validados.');

const printCut = vm.runInNewContext(fonte + '\n' +
    ler('core/extendscript/ibd-print-cut.jsx').replace(/^#include.*$/m, '') + '\nIBDPrintCut');
const parametrosPrintCut = {
    largura: 320, altura: 450, margem: 10, espaco: 4, colunas: 2, linhas: 4,
    marca: 'l', recuo: 3, tamanho: 12, respiro: 6, origem: 'marca'
};
const cortePrintCut = [0, 0, 90, 50];
const gradePrintCut = printCut.planejar(parametrosPrintCut, [-2, -2, 92, 52], cortePrintCut);
assert.equal(gradePrintCut.posicoes.length, 8);
assert.ok(gradePrintCut.margem > 21 && gradePrintCut.margem < 22);
validarPonto(gradePrintCut.posicoes[0], [66, 113]);
assert.equal(gradePrintCut.marcas.length, 4);
assert.ok(gradePrintCut.marcas.every(m => m.length === 3));
const quadrados = printCut.planejar({ ...parametrosPrintCut, marca: 'quadrado' }, cortePrintCut, cortePrintCut);
assert.ok(quadrados.marcas.every(m => m.length === 4));
assert.throws(() => printCut.planejar({ ...parametrosPrintCut, colunas: 3 }, [-2, -2, 92, 52], cortePrintCut), /Cabem até 2/);
const polilinha = printCut.polilinha(printCut.retangulo(cortePrintCut));
const pltOptico = printCut.plt([polilinha], gradePrintCut.posicoes, parametrosPrintCut);
assert.match(pltOptico, /^IN;\nSP1;\nPA;\nPU2520,4400;\nPD6120,4400;\nPD6120,6400;\nPD2520,6400;\nPD2520,4400;\nPU;/);
assert.equal(pltOptico.match(/^PU[\d,]+;$/gm).length, 8);
const pltFolha = printCut.plt([polilinha], [[10, 20]], { ...parametrosPrintCut, origem: 'folha' });
assert.match(pltFolha, /PU400,17200;\nPD4000,17200;\nPD4000,15200;/);
assert.throws(() => printCut.plt([polilinha], [[-10, 20]], parametrosPrintCut), /ultrapassa/);
const curvaPlt = printCut.polilinha([
    {anchor: [0, 0], left: [0, 0], right: [0, 15]},
    {anchor: [10, 0], left: [10, 15], right: [10, 0]}
]);
assert.ok(curvaPlt.length > 10 && curvaPlt.some(p => p[1] > 10));
assert.equal(curvaPlt[0], curvaPlt[curvaPlt.length - 1]);
assert.doesNotMatch(pltOptico, /NaN|Infinity|PD-\d/);
console.log('Print & Cut mantém escala, origens e curvas e reserva as marcas ópticas.');

const prepress = vm.runInNewContext(ler('core/extendscript/ibd-preimpressao.jsx') + '\nIBDPP');
validarPonto(prepress.medidas('T4'), [328, 478]);
const capa = prepress.margensCapa(215, 303, 129, 0.1, 7, 18);
validarPonto([capa.largura, capa.altura, capa.lombada], [486.5, 339, 6.5]);
const marcas = prepress.marcas(100, 150, 3, 3, 5, true, [50], [75]);
assert.equal(marcas.segmentos.length, 12);
assert.equal(marcas.segmentos.filter(s => s[4]).length, 4);
for (const [x1, y1, x2, y2] of marcas.segmentos) {
    const distancia = Math.max(Math.min(x1, x2)-100, -Math.max(x1, x2), Math.min(y1, y2)-150, -Math.max(y1, y2));
    assert.ok(distancia - 0.35/(2*prepress.pt) > 3);
}
assert.equal(prepress.mes(1900, 1).dias, 28);
assert.equal(prepress.mes(2000, 1).dias, 29);
assert.equal(prepress.mes(2027, 0).inicio, 5);
assert.ok(prepress.rico({ typename: 'CMYKColor', cyan: 40, magenta: 40, yellow: 30, black: 100 }));
assert.ok(!prepress.rico({ typename: 'CMYKColor', cyan: 0, magenta: 0, yellow: 0, black: 100 }));
console.log('Pré-impressão mantém a sangria livre e valida capa, datas e tinta preta.');
