import { FOLD_PATTERNS, planejarCadernos } from './calculo.mjs';
import { croquis, dimensoes, escolha, fibras, folha, fmt, inteiro, lerPapel, numero, peca, perdas, processos, reservas, sangria, tiragem } from './componentes.mjs';
import { caderno } from './diagramas.mjs';

export const acao = 'Planejar cadernos';
export const grupos = [
    { titulo:'Miolo e dobra', campos:[
        ...peca(148,210,['Largura da página','Altura da página']),
        inteiro('pages','Páginas do miolo',32,{max:512}),tiragem(100),
        escolha('foldPattern','Esquema de dobra','F8-1',Object.values(FOLD_PATTERNS).map(p=>[p.code,p.name])),
        escolha('binding','Encadernação','saddle',[['saddle','Grampo canoa'],['perfect','Lombada quadrada'],['spiral','Espiral'],['wireo','Wire-o'],['pad','Bloco']]),
        numero('caliper','Espessura de uma folha',.1,{min:.001,max:10})
    ] },
    { titulo:'Folha de máquina', campos:[...folha(),sangria,croquis] },
    { titulo:'Refilos e encadernação', fechado:true, campos:[
        numero('bindingMargin','Reserva na lombada',11),numero('spineGutter','Intervalo na lombada',0),
        numero('headTrim','Refilo de cabeça',4),numero('footTrim','Refilo de pé',0),
        numero('milling','Fresagem por lado',0),numero('faceGutter','Intervalo entre pares de páginas',0),
        escolha('creepMode','Compensação de encadernação','auto',[['auto','Calculada pela espessura'],['manual','Informada manualmente']]),
        numero('creep','Compensação manual',0)
    ] },
    { titulo:'Máquina, fibra e perdas', fechado:true, campos:[
        escolha('process','Processo','digital',processos),escolha('grain','Fibra da folha','none',fibras),...reservas,...perdas
    ] }
];

export function calcular(valores){ return planejarCadernos(lerPapel(valores)); }

export function mostrar(r,valores,ui) {
    if (r.errors.length) {
        ui.mensagem(r.errors.join(' '));
        return;
    }
    const s=lerPapel(valores);
    const indices=ui.seletor('Caderno',r.plan.map((p,i)=>[i,'Caderno '+(i+1)]),0,()=>desenhar());
    const faces=ui.seletor('Face',[['front','Frente'],['back','Verso']],'front',()=>desenhar());
    function desenhar() {
        const indice=Number(indices.value);
        const entrada=r.plan[indice];
        const verso=faces.value==='back';
        const titulo='Caderno '+(indice+1)+' · '+(verso?'Verso':'Frente');
        ui.resultado([
            ['Cadernos por exemplar',fmt(r.plan.length)],['Páginas em branco',fmt(r.brancas)],['Lombada estimada',fmt(r.spineWidth)+' mm']
        ]);
        ui.diagrama(caderno(s,r.area,r.items[0],verso?entrada.backCells:entrada.frontCells,verso,titulo),
            'caderno-'+(indice+1)+'-'+faces.value,titulo+' · '+dimensoes(s.sw,s.sh),
            [['Páginas',verso?'#e9ddf5':'#d8eafa'],['Reserva de encadernação','#f0dfbd']]);
        ui.fatos([
            ['Páginas por caderno',fmt(r.porCaderno)],
            ['Compensação de encadernação',fmt(r.effectiveCreep)+' mm no conjunto · '+fmt(entrada.shift)+' mm neste caderno'],
            ['Papel',fmt(r.net)+' folhas líquidas · '+fmt(r.total)+' com perdas e acerto']
        ]);
        ui.avisos(r.warnings);
    }
    desenhar();
}
