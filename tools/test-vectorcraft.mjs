import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const script = readFileSync(new URL('../nobel/desktop/conferir-faca-vectorcraft.js',import.meta.url),'utf8');
function conferir(layers) {
  const copia = structuredClone(layers);
  let resultado;
  runInNewContext(script,{
    vc:{run(id){assert.equal(id,'document.json');return {layers};},log(s){resultado=s;}},
    alert(){}
  });
  assert.deepEqual(layers,copia);
  return resultado;
}
const pontos = [[0,0],[90,0],[90,50],[0,50]].map(p=>({p}));
function caminho(id,anchors,closed=true) {
  return {id,kind:{type:'path',path:{subpaths:[{anchors,closed}]}}};
}
const camada = (name,children) => ({name,kind:{type:'layer',children}});
const inversa = [pontos[2],pontos[1],pontos[0],pontos[3]];
const objetos = [caminho(1,pontos),caminho(2,inversa),caminho(3,pontos,false),
  caminho(4,[{...pontos[0],out:[2,3]},...pontos.slice(1)]),
  {...caminho(5,pontos),hidden:true}];
const resultado = conferir([camada('FACA',objetos),camada('Arte',[caminho(6,pontos)])]);
assert.match(resultado,/4 traçado\(s\) conferido\(s\). 2 ocorrência/);
assert.match(resultado,/#2.*coincide com.*#1/);
assert.match(resultado,/#3.*aberto/);
assert.match(conferir([camada('Arte',objetos)]),/Nomeie a camada/);
assert.match(conferir([camada('meio_corte',[])]),/Nenhum caminho/);
console.log('Conferência de faca validada.');
