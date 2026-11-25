import { montarFolha } from './calculo.mjs';
import { croquis, dimensoes, escolha, espacamento, fibras, fmt, folha, lerPapel, perdas, peca, processos, reservas, sangria, tiragem } from './componentes.mjs';
import { prancha } from './diagramas.mjs';

export const acao = 'Calcular montagem';
export const grupos = [
    { titulo:'Folha de máquina', campos:folha() },
    { titulo:'Peça e divisão da folha', campos:[...peca(90,50),sangria,...espacamento(),tiragem()] },
    { titulo:'Impressão e virada', campos:[
        escolha('style','Modo de impressão','sheetwise',[
            ['single','Somente frente'],['sheetwise','Frente e verso · formas separadas'],
            ['turn','Tira-retira · virada lateral'],['tumble','Cambalhota · virada topo/base'],['perfector','Reversão automática']
        ]),
        escolha('orientation','Orientação das peças','auto',[['auto','Melhor grade uniforme'],['mixed','Grades mistas (0° e 90°)'],['normal','0°'],['rotate','90°']]),
        escolha('process','Processo','digital',processos),croquis
    ] },
    { titulo:'Máquina, fibra e perdas', fechado:true, campos:[
        ...reservas,
        escolha('grain','Fibra da folha','none',fibras),
        escolha('pieceGrain','Fibra na peça','free',[['free','Livre'],['width','Paralela à largura da peça'],['height','Paralela à altura da peça']]),
        ...perdas
    ] }
];

export function calcular(valores) { return montarFolha(lerPapel(valores)); }

export function mostrar(r,valores,ui) {
    const s = lerPapel(valores);
    if (r.errors.length) {
        ui.mensagem(r.errors.join(' '));
        return;
    }
    const seletor = r.faces.length>1 ? ui.seletor('Face para visualizar',r.faces.map((f,i)=>[i,f.titulo]),0,i=>desenhar(r.faces[Number(i)])) : null;
    function desenhar(face) {
        ui.resultado([
            ['Peças completas por folha',fmt(r.count)],['Folhas totais',fmt(r.total)],['Aproveitamento',fmt(r.usage)+'%']
        ]);
        ui.diagrama(prancha(s,r.area,face,'Montagem · '+face.titulo),'montagem-'+face.titulo.toLowerCase().replace(' ','-'),
            face.titulo+' · '+dimensoes(s.sw,s.sh),[['Frente','#d8eafa'],...(r.mesmaForma || face.titulo==='Verso'?[['Verso','#e9ddf5']]:[]),['Pinça ou margem','#f4e9cb']]);
        ui.fatos([
            ['Papel',fmt(r.net)+' folhas líquidas · '+fmt(r.variableLoss+r.makeready)+' de perda e acerto'],
            ['Passada',face.marcas.passNote.replace('1ª passada · ','')],
            ['Área útil',dimensoes(r.area.w,r.area.h)],
            ['Formas e passadas',fmt(r.forms)+' forma(s) · '+fmt(r.passes)+' passada(s) no lote'],
            ['Peso da tiragem',fmt(r.mass)+' kg']
        ]);
        ui.avisos(r.warnings);
    }
    desenhar(r.faces[Number(seletor?.value??0)]);
}
