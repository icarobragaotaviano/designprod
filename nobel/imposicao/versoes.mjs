export const scriptsImposicao = [
    ['imposicao-arte-corte-illustrator.jsx','Illustrator · Imposição de arte e corte'],
    ['imposicao-arte-corte-corel.bas','CorelDRAW · Imposição de arte e corte'],
    ['imposicao-arte-corte-affinity.js','Affinity · Imposição de arte e corte'],
    ['imposicao-arte-corte-vectorcraft.js','VectorCraft · Imposição de arte e corte'],
    ['imposicao-arte-corte-tracedraw.js','TraceDraw · Imposição de arte e corte']
];

export const familiaImposicao = scriptsImposicao.map(([arquivo])=>'desktop/'+arquivo);
