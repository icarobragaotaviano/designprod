import assert from 'node:assert/strict';
import vm from 'node:vm';
import {planoEditor, scriptIllustrator, moduloCorel} from '../nobel/gabarito-editores.mjs';

const medidas={largura:210,altura:150,sangria:3,reserva:11,seguranca:3};
for(const [lado, esperado] of Object.entries({
  superior:[[0,14],[210,14]], inferior:[[0,136],[210,136]],
  esquerda:[[14,0],[14,150]], direita:[[196,0],[196,150]]
})){
  const entrada={...medidas,lado};
  assert.deepEqual(planoEditor(entrada).guia,esperado);
  const bas=moduloCorel(entrada);
  assert.match(bas,/pg\.SetSize 210, 150/);
  assert.ok(bas.includes('pg.LeftX + '+esperado[0][0]+', pg.TopY - '+esperado[0][1]));
  const caminho={setEntirePath(p){this.pos=p;}};
  const tecnico={pathItems:{add:()=>caminho}};
  const arte={};
  const doc={activeLayer:arte,artboards:[{artboardRect:[20,500,0,0]}],layers:{add:()=>tecnico}};
  let preset;
  vm.runInNewContext(scriptIllustrator(entrada).replace(/^#target.*\n/,''),{
    DocumentPreset:function(){},DocumentColorSpace:{CMYK:'CMYK'},RulerUnits:{Millimeters:'mm'},
    app:{startupPresetsList:['Impressão'],documents:{addDocument(tipo,p){assert.equal(tipo,'Impressão');assert.equal(p.colorMode,'CMYK');preset=p;return doc;}}}
  });
  const pt=72/25.4;
  assert.equal(preset.width,210*pt);
  assert.deepEqual(Array.from(preset.documentBleedOffsetRect),Array(4).fill(3*pt));
  assert.deepEqual(Array.from(caminho.pos,p=>Array.from(p)),esperado.map(([x,y])=>[20+x*pt,500-y*pt]));
  assert.ok(caminho.guides && tecnico.locked && !tecnico.printable);
  assert.equal(doc.activeLayer,arte);
}
assert.throws(()=>planoEditor({...medidas,lado:'superior',reserva:150}));
assert.throws(()=>planoEditor({...medidas,lado:'diagonal'}));
console.log('Gabaritos de CorelDRAW e Illustrator validados nas quatro bordas.');
