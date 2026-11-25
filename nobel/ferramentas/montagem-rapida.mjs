import { planoFolha } from './calculo.mjs';
import { croquis, dimensoes, escolha, espacamento, fmt, folha, lerPapel, marcar, peca, reservas, sangria, tiragem } from './componentes.mjs';
import { prancha } from './diagramas.mjs';

export const acao = 'Comparar montagens';
export const grupos = [
    { titulo:'Folha de máquina', campos:folha() },
    { titulo:'Peça e tiragem', campos:[...peca(90,50),tiragem(),sangria,...espacamento()] },
    { titulo:'Estratégia', campos:[
        escolha('freeStrategy','Montagem no diagrama','best',[
            ['best','Melhor rendimento'],['normal','Retrato (0°)'],['rotate','Paisagem (90°)'],['mixed','Corte misto']
        ]),
        marcar('allowMixed','Testar corte misto',true),croquis
    ] },
    { titulo:'Margens', fechado:true, campos:[
        escolha('freeMarginMode','Reservas na folha','auto',[['auto','Automáticas'],['zero','Sem reservas'],['custom','Usar reservas informadas']]),
        ...reservas
    ] }
];

export function calcular(valores) {
    return planoFolha('avaliar-orientacoes',lerPapel(valores));
}

export function mostrar(plano,valores,ui) {
    const r=plano.resultado;
    if (r.errors.length) {
        ui.mensagem(r.errors.join(' '));
        return;
    }
    const s=lerPapel(valores);
    const comparacao=r.freeComparison;
    const opcoes=[comparacao.normal,comparacao.rotate,comparacao.mixed];
    ui.resultado([
        ['Peças na montagem exibida',fmt(r.count)],['Melhor rendimento',fmt(comparacao.winnerCount)],['Folhas totais',fmt(r.total)]
    ]);
    ui.diagrama(prancha(s,r.area,{items:r.items},'Montagem rápida'),'montagem-rapida',
        dimensoes(s.sw,s.sh)+' · '+r.layoutNote,[['Peças','#d8eafa'],['Sangria','#edf1f6']]);
    ui.tabela('Estratégias de montagem',['Estratégia','Peças/folha','Aproveitamento','Grade'],
        opcoes.map(o=>[o.title,fmt(o.count),fmt(o.usage)+'%',o.desc]));
    ui.avisos(r.warnings);
    ui.arquivoPlano?.(plano,'plano-montagem-rapida');
}
