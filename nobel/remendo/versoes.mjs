export const scriptsRemendo = [
    ['remendo-adesivo-corel.bas','CorelDRAW · Remendo de adesivo'],
    ['remendo-adesivo-illustrator.jsx','Illustrator · Remendo de adesivo'],
    ['remendo-adesivo-tracedraw.js','TraceDraw · Remendo de adesivo'],
    ['remendo-adesivo-vectorcraft.js','VectorCraft · Remendo de adesivo'],
    ['remendo-adesivo-photocraft.mjs','PhotoCraft · Remendo de adesivo']
];

export const photoshopRemendo = 'photoshop/guias-selecao-margem';

export const familiaRemendo = [
    'web/remendo',
    photoshopRemendo,
    ...scriptsRemendo.map(([arquivo])=>'desktop/'+arquivo)
];
