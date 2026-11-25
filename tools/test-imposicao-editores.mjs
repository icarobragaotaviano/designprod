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
