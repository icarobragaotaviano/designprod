import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { familiaRemendo, scriptsRemendo } from '../nobel/remendo/versoes.mjs';
import { reunirVersoes } from './familias-site.mjs';
import { apps, desktop } from '../nobel/catalogo.mjs';

const origem = new URL('../nobel/',import.meta.url);
const geometria = readFileSync(new URL('remendo/janela.js',origem),'utf8');
const funcoes = vm.runInNewContext(geometria+'\n({janelaRemendo,medidasRemendo});');
const janela = (...m)=>Array.from(funcoes.janelaRemendo(...m));
assert.deepEqual(janela(200,100,10,10,50,30,3),[7,7,56,36]);
assert.deepEqual(janela(200,100,0,90,10,10,3),[0,87,13,13]);
assert.deepEqual(Array.from(funcoes.medidasRemendo('0; 0; 50,25; 30; 3')),[0,0,50.25,30,3]);
assert.throws(()=>funcoes.medidasRemendo('0;0;50mm;30;3'),/Revise/);
assert.throws(()=>janela(100,100,90,0,50,10,3),/caber/);

const base = new URL('../catalog.json',import.meta.url);
const ferramentas=JSON.parse(readFileSync(base,'utf8')).ferramentas;
for(const [id] of apps) ferramentas.push({id:'web/'+id,abrir:'/apps/'+id+'/'});
for(const [nome] of desktop) ferramentas.push({id:'desktop/'+nome,baixar:'/apps/desktop/'+nome});
reunirVersoes(ferramentas);
assert.equal(ferramentas.find(f=>f.id==='web/remendo').versoes.length,familiaRemendo.length-1);
assert.ok(ferramentas.find(f=>f.id==='photoshop/guias-selecao-margem').versoes.some(f=>f.abrir==='/apps/remendo/'));

function lerScript(nome){
    return readFileSync(new URL('desktop/'+nome,origem),'utf8');
}
function combinado(nome){
    const codigo=lerScript(nome);
    assert.equal(codigo.split('/* @ibd-remendo-janela */').length,2,nome);
    return codigo.replace('/* @ibd-remendo-janela */',geometria).replace(/^#target[^\n]*\n/,'');
}
for(const [nome] of scriptsRemendo.filter(([n])=>/\.(jsx|js)$/.test(n))) new vm.Script(combinado(nome));

const escala=72/25.4;
const comandos=[];
let mensagem;
const prompts=['1','10;10;50;30;3'];
vm.runInNewContext(combinado('remendo-adesivo-vectorcraft.js'),{
    vc:{run(id,params){
        if(id==='document.json')return {document:{artboards:[{rect:{x0:50,y0:20,x1:50+200*escala,y1:20+100*escala}}]}};
        comandos.push([id,params]);
    },log(){}},
    prompt:()=>prompts.shift(),alert:s=>{mensagem=s;}
});
assert.equal(comandos[0][0],'artboard.new');
const {x,y,width,height}=comandos[0][1];
assert.ok(Math.abs(x-(50+7*escala))<1e-8 && Math.abs(y-(20+7*escala))<1e-8);
assert.ok(Math.abs(width-56*escala)<1e-8 && Math.abs(height-36*escala)<1e-8);
assert.match(mensagem,/56 × 36 mm/);

const trace=[];
const selecao={Count:1,Duplicate(){return {Move:(x,y)=>trace.push(['mover',x,y]),MoveToLayer:()=>trace.push(['camada']),AddToClipFrame:(_,centro)=>trace.push(['clip',centro])};}};
const pagina={SetSize:(w,h)=>trace.push(['pagina',w,h]),Activate(){},CreateLayer(){return {
    CreateRectangle2:(x,y,w,h)=>{trace.push(['retangulo',x,y,w,h]);return {Fill:{NoFill(){}},Outline:{NoOutline(){}}};}
};}};
const doc={Unit:1,AddPages:()=>pagina};
vm.runInNewContext(combinado('remendo-adesivo-tracedraw.js')+'\nTraceDrawPlugin.commands[0].run();',{
    ActiveDocument:doc,ActivePage:{SizeWidth:200,SizeHeight:100,Activate(){}},ActiveSelectionRange:selecao,
    cdrMillimeter:3,prompt:()=> '10;10;50;30;3',alert(){}
});
assert.deepEqual(trace,[['pagina',56,36],['mover',-7,-57],['camada'],['retangulo',0,0,56,36],['clip',false]]);
assert.equal(doc.Unit,1);
const original = {name:'arte.ai',saved:true,artboards:[{artboardRect:[28,400,28+200*escala,400-100*escala]}]};
original.artboards.getActiveArtboardIndex=()=>0;
let temporario,alvoSalvo;
original.fullName={parent:{fsName:'/tmp/arte'},fsName:'/tmp/arte/arte.ai',copy(f){f.exists=true;temporario=f;return true;}};
const copia={artboards:[{}],saveAs(alvo){alvoSalvo=alvo.name;}};
function Arquivo(path){this.fsName=path;this.exists=false;this.remove=()=>{this.exists=false;};}
Arquivo.saveDialog=()=>({name:'remendo.ai',fsName:'/tmp/arte/remendo.ai'});
vm.runInNewContext(combinado('remendo-adesivo-illustrator.jsx'),{
    app:{documents:[original],activeDocument:original,open:()=>copia},
    IllustratorSaveOptions:function(){},File:Arquivo,prompt:()=> '10;10;50;30;3',alert(){}
});
assert.equal(alvoSalvo,'remendo.ai');
assert.equal(copia.artboards[0].name,'Remendo');
const il=copia.artboards[0].artboardRect;
assert.ok(Math.abs((il[2]-il[0])/escala-56)<1e-8 && Math.abs((il[1]-il[3])/escala-36)<1e-8);
assert.equal(temporario.exists,false);
console.log('Geometria, versões e fluxo vetorial do remendo validados.');
