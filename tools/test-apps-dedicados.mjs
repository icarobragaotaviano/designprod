import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { apps } from '../nobel/catalogo.mjs';
import { prancha, lona as mapaLona } from '../nobel/ferramentas/diagramas.mjs';
import { migrarModelo } from '../nobel/ferramentas/interface.mjs';

const raiz = new URL('../',import.meta.url);
const ler = p=>readFileSync(new URL(p,raiz),'utf8');
const ids = ['folhas','montagem','cadernos','lona','montagem-rapida','comparar-folhas'];
const valores = m=>Object.fromEntries(m.grupos.flatMap(g=>g.campos.map(c=>[c.id,c.valor])));
const modulos = await Promise.all(ids.map(id=>import('../nobel/ferramentas/'+id+'.mjs')));
const [folhas,montagem,cadernos,lona,rapida,comparar] = modulos;
const escolha = valores(folhas);
const rFolhas = folhas.calcular(escolha);
assert.ok(rFolhas.suggestions.length > 3);
const t4 = rFolhas.suggestions.find(x=>x.id==='nobel-t4');
assert.ok(t4?.count > 0);
assert.ok(t4.totalSheets>=Math.ceil(escolha.qty/t4.count));
assert.throws(()=>folhas.calcular({...escolha,customW:240}),/largura e a altura/);
assert.ok(folhas.calcular({...escolha,customW:341,customH:489}).suggestions.some(x=>x.id==='personalizada'));
assert.equal(folhas.calcular({...escolha,pw:4000,ph:4000}).suggestions.length,0);
for (const suggestMarginPreset of ['process','digital','offset','zero']) {
    const entrada={...escolha,suggestMarginPreset};
    const ranking=folhas.calcular(entrada);
    for (const item of ranking.suggestions) {
        const url=new URL(folhas.linkMontagem(entrada,item,ranking.margins),'https://designprod.example');
        const params=montagem.lerLink(url.searchParams);
        const aplicada=montagem.calcular({...valores(montagem),...params});
        assert.deepEqual(aplicada.items,item.items,url.search);
        assert.equal(aplicada.total,item.totalSheets,url.search);
    }
}

const s = valores(montagem);
const r = montagem.calcular(s);
assert.deepEqual(r.errors,[]);
assert.equal(r.faces.length,2);
const [frente,verso] = r.faces.map(f=>f.items[0]);
assert.ok(Math.abs(frente.x+verso.x+frente.w-s.sw)<1e-7);
assert.equal(verso.y,frente.y);
for(const style of ['single','turn','tumble','perfector']){
    const rr=montagem.calcular({...s,style,process:'offset'});
    assert.deepEqual(rr.errors,[]);
    assert.equal(rr.faces.length,style==='perfector'?2:1);
    if(style==='turn'||style==='tumble') assert.ok(rr.items.some(p=>p.label==='V'));
    if(style==='perfector') {
        assert.equal(rr.faces[1].marcas.gripper,'top');
        assert.ok(Math.abs(rr.items[0].y+rr.faces[1].items[0].y+rr.items[0].h-s.sh)<1e-7);
    }
}
const ocupado=montagem.calcular({...s,pw:.1,ph:.1,bleed:0,gapX:0,gapY:0,orientation:'mixed'});
assert.match(ocupado.errors.join(' '),/posições/);
assert.match(prancha(s,r.area,r.faces[0],'Teste & peça'),/<title>Teste &amp; peça<\/title>/);
const edicao=montagem.iniciarEdicao();
edicao.ler(s);
const peca=r.base[0];
edicao.alterar(peca,{sku:'B'},'editar');
const editada=montagem.calcular(s,edicao.ler(s));
assert.equal(editada.faces[0].items[0].sku,'B');
assert.equal(editada.faces[1].items[0].sku,'B');
edicao.alterar(editada.base[0],{},'duplicar');
assert.ok(!montagem.calcular(s,edicao.ler(s)).plano.materializavel);
edicao.desfazer();
assert.equal(montagem.calcular(s,edicao.ler(s)).faces[0].items[0].sku,'B');
edicao.refazer();
assert.ok(edicao.podeDesfazer());
assert.deepEqual(edicao.ler({...s,sw:s.sw+1}),{edits:{},extras:[]});
edicao.restaurar(s,{edits:{[peca.id]:{sku:'C'}},extras:[]});
assert.equal(montagem.calcular(s,edicao.ler(s)).faces[0].items[0].sku,'C');
assert.equal(edicao.podeDesfazer(),false);

const miolo = valores(cadernos);
const livro = cadernos.calcular({...miolo,pages:21});
assert.deepEqual(livro.errors,[]);
assert.equal(livro.plan.length,3);
assert.equal(livro.brancas,3);
assert.equal(livro.plan.flatMap(p=>[...p.frontCells.flat(),...p.backCells.flat()]).filter(c=>c.isBlank).length,3);
assert.ok(livro.effectiveCreep>0);
assert.ok(cadernos.calcular({...miolo,pw:550}).errors.length);

const acabamento=valores(lona);
const painel=lona.calcular({...acabamento,pw:2980});
assert.ok(painel.paineis.length>1);
assert.ok(painel.paineis.every(f=>f.largura<=painel.larguraUtil+1e-7));
assert.ok(painel.grommets.every(g=>g.x>0&&g.x<2980&&g.y>0&&g.y<acabamento.ph));
assert.equal(lona.calcular({...acabamento,grommetSpacing:0}).grommets.length,0);
assert.throws(()=>lona.calcular({...acabamento,grommetInset:999}),/recuo/);
assert.throws(()=>lona.calcular({...acabamento,grommetSpacing:.1}),/espaçamento/);
assert.match(mapaLona({...acabamento,pw:2980},painel),/viewBox="0 0 3040 1060"/);

const rRapida=rapida.calcular(valores(rapida)).resultado;
assert.equal(rRapida.freeComparison.winnerCount,rRapida.count);
const rComparar=comparar.calcular({...valores(comparar),quantidade:8,compareLayout:'overlay'}).resultado;
assert.equal(rComparar.compareInfo.items.length,8);
assert.equal(rComparar.compareInfo.items[0].ratioVsFirst,1);
const legado=migrarModelo({mode:'compare',compareLayout:'overlay',compareSheets:[{name:'Papel serviço',w:350,h:510}]},'comparar-folhas');
assert.equal(comparar.calcular({...valores(comparar),...legado}).resultado.compareInfo.items[0].name,'Papel serviço');

for(let j=0;j<modulos.length;j++){
    const m=modulos[j], s=valores(m), visuais=[];
    const seletor=(nome,opcoes,valor,onchange)=>({value:valor,opcoes,onchange});
    m.mostrar(m.calcular(s),s,{
        seletor,resultado(pares){assert.ok(pares.length);},mensagem(e){assert.fail(e);},
        diagrama(svg){assert.match(svg,/^<svg/);visuais.push(svg);},avisos(){},tabela(){},fatos(){},csv(){}
    });
    assert.equal(visuais.length,1,ids[j]);
}

execFileSync(process.execPath,[fileURLToPath(new URL('tools/build-nobel.mjs',raiz))],{stdio:'pipe'});
for (const id of ids) {
    assert.equal(apps.find(a=>a[0]===id)[4],'dedicado');
    const base='site/publico/apps/'+id+'/';
    const html=ler(base+'index.html');
    assert.match(html,new RegExp('<base href="/apps/'+id+'/">'));
    assert.match(html,/<body data-app="[^"]+" data-app-layout="dedicado">/);
    assert.doesNotMatch(html,/<iframe|mode-nav|studio-bar|setMode|<script [^>]*src="app\.js"/i);
    assert.match(html,/<link rel="stylesheet" href="layout-app\.css">/);
    const manifesto=JSON.parse(ler(base+'manifest.webmanifest'));
    assert.equal(manifesto.scope,'/apps/'+id+'/');
    assert.equal(manifesto.start_url,manifesto.scope);
    const sw=ler(base+'sw.js');
    new vm.Script(sw);
    const recursos=JSON.parse(sw.match(/^const recursos=(\[.*\]);$/m)[1]);
    for (const arq of recursos.filter(x=>x!=='./')) assert.ok(ler(base+arq).length,base+arq);
    assert.ok(recursos.includes('ferramentas/'+id+'.mjs'));
    for (const nome of ['engine.js','operacoes.js']) assert.ok(recursos.includes('core/producao/folha/'+nome));
    for (const outro of ids.filter(x=>x!==id)) assert.ok(!recursos.includes('ferramentas/'+outro+'.mjs'));
    assert.ok(!recursos.includes('app.js'));
}
console.log('Seis apps independentes, fórmulas, transferência da sugestão, desenhos e pacotes offline validados.');
