import { painelamento } from '../producao/calculo.mjs';
import { computeGrommets } from './calculo.mjs';
import { dimensoes, fmt, numero, tiragem } from './componentes.mjs';
import { lona } from './diagramas.mjs';

export function planejarLona(s) {
    const { pw, ph, sw, margem, hem, polePocketTop, polePocketBottom, weld, qty, grommetSpacing, grommetInset, safeMargin } = s;
    const cutW = pw + 2*hem;
    const cutH = ph + 2*hem + polePocketTop + polePocketBottom;
    if (2*safeMargin >= Math.min(pw,ph)) throw Error('A área segura precisa caber dentro do formato final.');
    if (grommetSpacing && 2*grommetInset >= Math.min(pw,ph)) throw Error('O recuo dos ilhós precisa caber dentro do formato final.');
    if (grommetSpacing && (grommetSpacing<1 || 2*(pw+ph)/grommetSpacing>5000)) {
        throw Error('Aumente o espaçamento para gerar até 5.000 posições de ilhós.');
    }
    const emenda=cutW>sw-2*margem ? weld : 0;
    const [vertical] = painelamento({ largura:cutW, altura:cutH, bobina:sw, margem, emenda, sangria:0, orientacao:'vertical' });
    if (!vertical.valido) throw Error('O painelamento não cabe na largura útil da bobina.');
    const grommets = computeGrommets(pw,ph,grommetSpacing,grommetInset);
    if (grommets.length>5000) throw Error('Aumente o espaçamento para gerar até 5.000 posições de ilhós.');
    const warnings = [];
    if (grommets.length && safeMargin < grommetInset+10) warnings.push('A margem de segurança está próxima dos ilhós. Confira a distância até textos e logotipos.');
    if (grommets.length && (polePocketTop || polePocketBottom)) warnings.push('Há bolsa e ilhós na mesma peça. Confira as bordas que vão receber ilhós.');
    return { cutW, cutH, grommets, warnings, paineis:vertical.faixas, larguraUtil:sw-2*margem,
        x:hem, y:hem+polePocketTop, material:vertical.metros*qty, areaCorte:cutW*cutH*qty/1e6 };
}

export const acao = 'Calcular corte e ilhós';
const mm = (id,label,value,min=0,max=25000) => numero(id,label,value,{min,max});
export const grupos = [
    { titulo:'Formato final', campos:[mm('pw','Largura',2000,1),mm('ph','Altura',1000,1),tiragem(1)] },
    { titulo:'Bobina e emendas', campos:[
        mm('sw','Largura da bobina',1520,1),mm('margem','Margem da máquina por lado',10),mm('weld','Sobreposição da emenda',25)
    ] },
    { titulo:'Bainhas, bolsas e ilhós', campos:[
        mm('hem','Bainha por lado',30),mm('polePocketTop','Bolsa superior',0),mm('polePocketBottom','Bolsa inferior',0),
        mm('safeMargin','Margem de segurança',35),mm('grommetInset','Recuo do centro do ilhós',15),
        mm('grommetSpacing','Espaçamento de referência dos ilhós',250)
    ], nota:'Use espaçamento zero para montar uma lona sem ilhós.' }
];

export { planejarLona as calcular };

export function mostrar(r,s,ui) {
    ui.resultado([
        ['Formato de corte',dimensoes(r.cutW,r.cutH)],['Panos por peça',fmt(r.paineis.length)],
        ['Ilhós por peça',fmt(r.grommets.length)]
    ]);
    ui.diagrama(lona(s,r),'mapa-corte-lona', 'Formato final '+dimensoes(s.pw,s.ph),
        [['Formato final','#e0eefb'],['Bainhas e bolsas','#efe9db'],...(r.paineis.length>1?[['Sobreposição','#d48745']]:[]),['Ilhós','#172e44']]);
    ui.fatos([
        ['Largura útil da bobina',fmt(r.larguraUtil)+' mm'],
        ['Consumo estimado de bobina',fmt(r.material)+' m lineares'],
        ['Área de corte do lote',fmt(r.areaCorte)+' m²'],
        ['Total de ilhós',fmt(r.grommets.length*s.qty)]
    ]);
    ui.tabela('Medidas dos panos',['Pano','Início no corte (mm)','Largura (mm)','Comprimento (mm)'],
        r.paineis.map((p,i)=>[i+1,fmt(p.pos),fmt(p.largura),fmt(r.cutH)]));
    if(r.grommets.length) ui.csv('Baixar posições dos ilhós','posicoes-ilhos',[
        ['Ilhós','X a partir do corte (mm)','Y a partir do corte (mm)'],
        ...r.grommets.map((g,i)=>[i+1,Math.round((r.x+g.x)*1000)/1000,Math.round((r.y+g.y)*1000)/1000])
    ]);
    ui.avisos(r.warnings);
}
