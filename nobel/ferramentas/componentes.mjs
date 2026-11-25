import { PAPER_PRESETS, nomeFormato } from './calculo.mjs';

export const fmt = (n, casas=2) => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:casas}).format(n);
export const dimensoes = (w,h) => fmt(w)+' × '+fmt(h)+' mm';
export const numero = (id,rotulo,valor,{min=0,max=5000,step='any',unidade='mm'}={}) =>
    ({id,rotulo,valor,min,max,step,unidade,tipo:'number'});
export const inteiro = (id,rotulo,valor,{min=1,max=1e7,unidade=''}={}) => numero(id,rotulo,valor,{min,max,step:1,unidade});
export const escolha = (id,rotulo,valor,opcoes) => ({id,rotulo,valor,opcoes,tipo:'select'});
export const marcar = (id,rotulo,valor) => ({id,rotulo,valor,tipo:'checkbox'});
export const par = (a,b,rotulos,valores,max=5000) => [numero(a,rotulos[0],valores[0],{min:.1,max}),numero(b,rotulos[1],valores[1],{min:.1,max})];
export const papel = (valor='nobel-t4') => escolha('preset','Formato de folha',valor,[
    ...PAPER_PRESETS.filter(p=>!p.id.endsWith('-l')).map(p=>[p.id,nomeFormato(p.label)]),['custom','Personalizado']
]);
export const processos = [['digital','Digital'],['offset','Offset'],['pb','Offset preto e branco'],['laser','Laser']];
export const fibras = [['none','Não informada'],['x','Paralela à largura'],['y','Paralela à altura']];
export const folha = (dim=[328,478]) => [papel(),...par('sw','sh',['Largura da folha','Altura da folha'],dim),marcar('paisagem','Inverter largura e altura',false)];
export const peca = (w,h,rotulos=['Largura final','Altura final']) => par('pw','ph',rotulos,[w,h]);
export const espacamento = (x=6,y=6) => [numero('gapX','Folga horizontal após a sangria',x),numero('gapY','Folga vertical após a sangria',y)];
export const tiragem = (valor=1000) => inteiro('qty','Tiragem',valor,{unidade:'un.'});
export const sangria = numero('bleed','Sangria por lado',3);
export const croquis = marcar('marks','Mostrar marcas de corte',false);
export const reservas = [
    numero('left','Margem esquerda',5),numero('right','Margem direita',5),
    numero('grip','Pinça inferior',5),numero('tail','Margem superior',5),numero('bar','Reserva para barra de cor',0)
];
export const perdas = [
    inteiro('setup','Acerto por forma',2,{min:0,unidade:'folhas'}),
    numero('waste','Perda variável',1,{max:100,unidade:'%'}),
    numero('gsm','Gramatura',150,{min:1,max:1000,unidade:'g/m²'})
];

export function lerPapel(s) {
    if (!s.paisagem) return s;
    return { ...s, sw:s.sh, sh:s.sw };
}
