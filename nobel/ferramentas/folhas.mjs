import { escolherFolhas, nomeFormato } from './calculo.mjs';
import { dimensoes, escolha, fmt, marcar, numero, peca, processos, reservas, perdas, sangria, espacamento, tiragem } from './componentes.mjs';
import { prancha } from './diagramas.mjs';

export const acao = 'Comparar formatos';
export const grupos = [
    { titulo:'Peça e tiragem', campos:[...peca(90,50),tiragem(),sangria,...espacamento()] },
    { titulo:'Comparação', campos:[
        escolha('process','Processo','digital',processos),
        escolha('suggestMarginPreset','Reservas de máquina','process',[['process','Usar margens informadas'],['digital','Padrão digital'],['offset','Padrão offset'],['zero','Sem reservas']]),
        escolha('suggestFamily','Grupo de formatos','all',[['all','Todos'],['nobel','T4, T8 e T9'],['digital','Digitais e comerciais'],['offset_large','Offset grande']]),
        escolha('suggestSort','Priorizar','usage',[['usage','Aproveitamento na folha'],['effective','Aproveitamento da tiragem'],['count','Peças por folha'],['area','Menor consumo de papel']]),
        marcar('allowMixed','Testar peças em duas orientações na mesma folha',true)
    ] },
    { titulo:'Margens e perdas', fechado:true, campos:[...reservas,...perdas] },
    { titulo:'Folha adicional', fechado:true, campos:[
        numero('customW','Largura',0),numero('customH','Altura',0)
    ], nota:'Deixe as duas medidas em zero para comparar apenas os formatos do catálogo.' }
];

export { escolherFolhas as calcular };

export function linkMontagem(s,f,margens) {
    const {pw,ph,qty,bleed,gapX,gapY,gsm,allowMixed}=s;
    const parametros={
        origem:'sugestao',pw,ph,qty,bleed,gapX,gapY,gsm,allowMixed,
        ...margens,sw:f.sw,sh:f.sh,style:'single',orientation:f.strategyOrientation
    };
    return '/apps/montagem/?'+new URLSearchParams(parametros);
}

export function mostrar(r,s,ui) {
    if (!r.suggestions.length) {
        ui.mensagem('Nenhum formato do grupo comporta a peça e as reservas informadas.');
        return;
    }
    const lista = r.suggestions;
    const escolhaFolha = ui.seletor('Formato para visualizar',
        lista.map((f,i)=>[i,nomeFormato(f.name)+' · '+dimensoes(f.sw,f.sh)]),0,i=>desenhar(lista[Number(i)]));
    const tabela = () => ui.tabela('Comparação de formatos',['Formato','Peças/folha','Aproveitamento','Folhas totais','Consumo'],
        lista.map(f=>[nomeFormato(f.name)+' · '+dimensoes(f.sw,f.sh),fmt(f.count),fmt(f.sheetUsagePct)+'%',fmt(f.totalSheets),fmt(f.grossAreaM2)+' m²']));
    function desenhar(f) {
        ui.resultado([
            ['Peças por folha',fmt(f.count)],['Aproveitamento na folha',fmt(f.sheetUsagePct)+'%'],['Folhas totais',fmt(f.totalSheets)]
        ]);
        ui.diagrama(prancha({ ...s, sw:f.sw,sh:f.sh },f.area,{items:f.items},'Montagem em '+nomeFormato(f.name)),
            'escolher-folha-'+f.sw+'x'+f.sh, f.strategyTitle+' · '+fmt(f.netSheets)+' folhas líquidas · '+fmt(f.extraPieces)+' peças excedentes',
            [['Peças','#d8eafa'],['Sangria','#edf1f6']]);
        ui.link?.('Abrir na montagem',linkMontagem(s,f,r.margins));
        tabela();
        ui.avisos(f.warnings);
    }
    desenhar(lista[Number(escolhaFolha.value)]);
}
