import { montarFolha } from './calculo.mjs';
import { croquis, dimensoes, escolha, espacamento, fibras, fmt, folha, inteiro, lerPapel, marcar, numero, perdas, peca, processos, reservas, sangria, tiragem } from './componentes.mjs';
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
        marcar('allowMixed','Testar corte misto',true),
        escolha('process','Processo','digital',processos),croquis
    ] },
    { titulo:'Máquina, fibra e perdas', fechado:true, campos:[
        ...reservas,
        escolha('grain','Fibra da folha','none',fibras),
        escolha('pieceGrain','Fibra na peça','free',[['free','Livre'],['width','Paralela à largura da peça'],['height','Paralela à altura da peça']]),
        ...perdas
    ] },
    { titulo:'Chapa CTP e separações', fechado:true, campos:[
        marcar('plateView','Conferir encaixe na chapa CTP',false),
        numero('plateW','Largura da chapa',400,{min:.1}),numero('plateH','Altura da chapa',510,{min:.1}),
        numero('plateGrip','Pinça da chapa',35),inteiro('screenLpi','Lineatura',175,{max:1000,unidade:'lpi'}),
        inteiro('colorsFront','Cores na frente',4,{min:0,max:16}),inteiro('colorsBack','Cores no verso',4,{min:0,max:16}),
        inteiro('spotColors','Cores especiais',0,{min:0,max:16})
    ] },
    { titulo:'Acabamentos', fechado:true, campos:[
        escolha('lamination','Laminação','none',[['none','Sem laminação'],['matte','Fosca'],['gloss','Brilho'],['soft','Toque aveludado']]),
        escolha('varnish','Verniz','none',[['none','Sem verniz'],['water','À base de água'],['total_uv','UV total'],['spot_uv','UV localizado']]),
        marcar('hotStamping','Hot stamping',false),marcar('emboss','Relevo',false),marcar('dieCut','Faca especial',false),
        marcar('drill','Furação',false),marcar('perforation','Picote',false),numero('perfOffset','Distância do picote',25),
        marcar('crease','Vinco',false),marcar('numbering','Numeração',false),marcar('padding','Blocagem',false)
    ] }
];

export function lerLink(busca) {
    if (busca.get('origem')!=='sugestao') return null;
    const valores={preset:'custom',paisagem:false};
    for (const {id,tipo} of grupos.flatMap(g=>g.campos)) {
        if (!busca.has(id) || id==='preset' || id==='paisagem') continue;
        const valor=busca.get(id);
        valores[id]=tipo==='number' ? Number(valor) : tipo==='checkbox' ? valor==='true' : valor;
    }
    return valores;
}

export function calcular(valores,alteracoes) { return montarFolha({...lerPapel(valores),...alteracoes}); }

export function iniciarEdicao() {
    let chave='', historico=[{edits:{},extras:[]}], indice=0, sequencia=0;
    const edicao={
        aberta:false,selecionada:'',
        ler(valores) {
            const s=lerPapel(valores);
            const atual=JSON.stringify(['sw','sh','pw','ph','bleed','gapX','gapY','left','right','grip','tail',
                'bar','style','orientation','allowMixed','grain','pieceGrain'].map(k=>s[k]));
            if (chave!==atual) {
                chave=atual;
                historico=[{edits:{},extras:[]}];
                indice=0;
                edicao.selecionada='';
            }
            return historico[indice];
        },
        restaurar(valores,estado) {
            edicao.ler(valores);
            const edits=estado?.edits && typeof estado.edits==='object' && !Array.isArray(estado.edits) ? estado.edits : {};
            const extras=Array.isArray(estado?.extras)?estado.extras:[];
            historico=[{edits,extras}];
            indice=0;
            edicao.selecionada='';
        },
        alterar(peca,alteracao,acao) {
            const anterior=historico[indice];
            const proximo={edits:{...anterior.edits},extras:[...anterior.extras]};
            const extra=proximo.extras.findIndex(p=>p.id===peca.id);
            if (acao==='duplicar') {
                let id;
                do { id='extra-'+(++sequencia); } while (anterior.extras.some(p=>p.id===id));
                proximo.extras.push({...peca,...alteracao,id});
                edicao.selecionada=id;
            } else if (extra>=0) {
                if (acao==='excluir') proximo.extras.splice(extra,1);
                else proximo.extras[extra]={...peca,...alteracao};
            } else {
                proximo.edits[peca.id]=acao==='excluir' ? {deleted:true} : alteracao;
            }
            historico.splice(++indice,Infinity,proximo);
        },
        podeDesfazer:()=>indice>0,
        podeRefazer:()=>indice<historico.length-1,
        desfazer(){if (edicao.podeDesfazer()) indice--;},
        refazer(){if (edicao.podeRefazer()) indice++;}
    };
    return edicao;
}

function editor(edicao,pecas,recalcular) {
    const box=document.createElement('details');
    box.className='editor-posicoes';
    box.open=edicao.aberta;
    box.addEventListener('toggle',()=>{edicao.aberta=box.open;});
    const titulo=document.createElement('summary');
    titulo.textContent='Editar posições e SKUs';
    box.append(titulo);
    const comandos=document.createElement('div');
    comandos.className='editor-comandos';
    function botao(rotulo,acao,desabilitado=false) {
        const b=document.createElement('button');
        b.type='button';
        b.textContent=rotulo;
        b.disabled=desabilitado;
        b.addEventListener('click',acao);
        comandos.append(b);
    }
    botao('Desfazer',()=>{edicao.desfazer();recalcular();},!edicao.podeDesfazer());
    botao('Refazer',()=>{edicao.refazer();recalcular();},!edicao.podeRefazer());
    if (!pecas.length) {
        box.append(comandos);
        return box;
    }
    const campos=document.createElement('div');
    campos.className='editor-campos';
    function campo(rotulo,opcoes) {
        const label=document.createElement('label');
        label.textContent=rotulo;
        const input=document.createElement(opcoes?'select':'input');
        if (opcoes) for (const [id,nome] of opcoes) input.append(new Option(nome,id));
        else Object.assign(input,{type:'number',required:true,step:'any',inputMode:'decimal'});
        label.append(input);
        campos.append(label);
        return input;
    }
    const posicao=campo('Posição',pecas.map((p,i)=>[p.id,(i+1)+' · '+p.id+' · SKU '+p.sku]));
    const x=campo('X do corte (mm)'),y=campo('Y do corte (mm)');
    const angulo=campo('Rotação',[0,90,180,270].map(a=>[a,a+'°']));
    const sku=campo('SKU',['A','B','C','D'].map(a=>[a,a]));
    const pecasPorId=new Map(pecas.map(p=>[p.id,p]));
    posicao.value=pecasPorId.has(edicao.selecionada)?edicao.selecionada:pecas[0].id;
    function preencher() {
        const p=pecasPorId.get(posicao.value);
        edicao.selecionada=p.id;
        x.value=p.x; y.value=p.y; angulo.value=p.angle; sku.value=p.sku;
    }
    preencher();
    posicao.addEventListener('change',preencher);
    function aplicar(acao) {
        if (acao!=='excluir' && (!x.reportValidity() || !y.reportValidity())) return;
        const p=pecasPorId.get(posicao.value);
        const angle=Number(angulo.value),gira=(angle-p.angle)%180!==0;
        edicao.alterar(p,{x:x.valueAsNumber,y:y.valueAsNumber,angle,sku:sku.value,w:gira?p.h:p.w,h:gira?p.w:p.h},acao);
        recalcular();
    }
    botao('Aplicar edição',()=>aplicar('editar'));
    botao('Duplicar na posição informada',()=>aplicar('duplicar'),pecas.length>=700);
    botao('Excluir peça',()=>aplicar('excluir'));
    box.append(campos,comandos);
    return box;
}

export function mostrar(r,valores,ui,edicao,recalcular) {
    const s = lerPapel(valores);
    if (edicao) ui.ferramenta(editor(edicao,r.base??[],recalcular));
    if (!r.faces.length) {
        ui.mensagem(r.errors.join(' ')||'Nenhuma peça para exibir.');
        return;
    }
    const seletor = r.faces.length>1 ? ui.seletor('Face para visualizar',r.faces.map((f,i)=>[i,f.titulo]),0,i=>desenhar(r.faces[Number(i)])) : null;
    function desenhar(face) {
        ui.resultado([
            ['Peças completas por folha',fmt(r.count)],['Folhas totais',fmt(r.total)],['Aproveitamento',fmt(r.usage)+'%']
        ]);
        const diagnosticos=face.titulo==='Verso'?[]:(r.preflightMarkers??[]);
        ui.diagrama(prancha(s,r.area,face,'Montagem · '+face.titulo,diagnosticos),'montagem-'+face.titulo.toLowerCase().replace(' ','-'),
            face.titulo+' · '+dimensoes(s.sw,s.sh),[['Frente','#d8eafa'],...(r.mesmaForma || face.titulo==='Verso'?[['Verso','#e9ddf5']]:[]),['Pinça ou margem','#f4e9cb']],!r.errors.length);
        ui.fatos([
            ['Papel',fmt(r.net)+' folhas líquidas · '+fmt(r.variableLoss+r.makeready)+' de perda e acerto'],
            ['Passada',face.marcas.passNote.replace('1ª passada · ','')],
            ['Área útil',dimensoes(r.area.w,r.area.h)],
            ['Formas e passadas',fmt(r.forms)+' forma(s) · '+fmt(r.passes)+' passada(s) no lote'],
            ['Peso da tiragem',fmt(r.mass)+' kg'],
            ['SKUs na forma',Object.entries(r.skuCounts).filter(([,quantidade])=>quantidade>0).map(([sku,quantidade])=>sku+' × '+fmt(quantidade)).join(' · ')],
            ...(r.usesPlates?[['Chapas',fmt(r.plates)],['CTP',dimensoes(r.plateInfo.w,r.plateInfo.h)+' · '+r.plateInfo.lpi+' lpi']]:[]),
            ...(r.finishTags?.length?[['Acabamentos',r.finishTags.join(' · ')]]:[])
        ]);
        if (r.errors.length) ui.erro(r.errors.join(' '));
        ui.avisos(r.warnings);
        ui.arquivoPlano?.(r.plano,'plano-montagem');
    }
    desenhar(r.faces[Number(seletor?.value??0)]);
}
