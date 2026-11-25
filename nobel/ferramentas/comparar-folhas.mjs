import { planoFolha } from './calculo.mjs';
import { dimensoes, escolha, fmt, inteiro, numero } from './componentes.mjs';
import { comparacaoFolhas, coresFolhas } from './diagramas.mjs';

export const acao = 'Comparar folhas';
const formatos = [
    ['A4',210,297],['A5',148,210],['Nobel T4',328,478],['Nobel T8',238,328],
    ['Nobel T9',220,380],['A3',297,420],['SRA3',320,450],['66 × 96',660,960]
];
export const grupos = [
    { titulo:'Comparação', campos:[
        inteiro('quantidade','Formatos',2,{min:1,max:formatos.length}),
        escolha('compareLayout','Disposição','side',[['side','Lado a lado'],['overlay','Sobrepostas']])
    ] },
    ...formatos.map(([nome,w,h],i)=>({
        titulo:'Formato '+(i+1),exibir:campos=>campos.quantidade.valueAsNumber>i,campos:[
            {id:'nome'+i,rotulo:'Identificação',tipo:'text',valor:nome,max:40},
            numero('w'+i,'Largura',w,{min:.1,max:25000}),numero('h'+i,'Altura',h,{min:.1,max:25000})
        ]
    }))
];

export function calcular(s) {
    const compareSheets=formatos.slice(0,s.quantidade).map((_,i)=>({id:'cmp-'+(i+1),name:s['nome'+i],w:s['w'+i],h:s['h'+i]}));
    return planoFolha('comparar-folhas',{compareSheets,compareLayout:s.compareLayout});
}

export function mostrar(plano,s,ui) {
    const r=plano.resultado;
    if (r.errors.length) {
        ui.mensagem(r.errors.join(' '));
        return;
    }
    const {items,smallest,largest}=r.compareInfo;
    ui.resultado([
        ['Formatos',fmt(items.length)],['Menor área',dimensoes(smallest.w,smallest.h)],['Maior área',dimensoes(largest.w,largest.h)]
    ]);
    ui.diagrama(comparacaoFolhas(items,s.compareLayout),'comparar-folhas','Formatos desenhados na mesma escala',
        items.map((f,i)=>[f.name,coresFolhas[i]]));
    ui.tabela('Áreas e proporções',['Formato','Dimensões','Área','Área em relação ao 1º'],
        items.map(f=>[f.name,dimensoes(f.w,f.h),fmt(f.areaCm2)+' cm²',fmt(f.ratioVsFirst)+'×']));
    ui.arquivoPlano?.(plano,'plano-comparar-folhas');
}
