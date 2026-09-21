/**
 * Verificações locais do Kit Guias e Sangria.
 * Cálculos reais; contratos dos aplicativos simulados, sem executar Adobe.
 * Uso: npm run test:guias
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const base = path.resolve(__dirname, '..');
const scriptFiles = [
  'apps/photoshop/scripts/guias-selecao-margem.jsx',
  'apps/photoshop/scripts/sangria-guias-canvas.jsx',
  'apps/illustrator/scripts/guias-selecao-margem.jsx'
];
const results = [];
function test(name, fn) {
  try { fn(); results.push({name, ok:true}); }
  catch (e) { results.push({name, ok:false, error:e.stack}); }
}
function plain(v) { return JSON.parse(JSON.stringify(v)); }
function approx(a,b) { assert.ok(Math.abs(a-b)<1e-7, `${a} != ${b}`); }
const core = vm.createContext({});
const selectionCode = fs.readFileSync(path.join(base, scriptFiles[0]), 'utf8');
const coreStart = selectionCode.indexOf('var G = (function () {');
const coreEnd = selectionCode.indexOf('var PS = (function () {');
assert.ok(coreStart >= 0 && coreEnd > coreStart, 'Núcleo geométrico não encontrado no script.');
vm.runInContext(selectionCode.slice(coreStart, coreEnd), core);
const G = core.G;
test('Margem externa: oito posições nos quatro limites e a 10 px deles',()=> {
  assert.deepEqual(plain(G.rectangles([100,100,500,300],10,0)).map(x=>x.b),
    [[100,100,500,300],[90,90,510,310]]);
  assert.equal(G.plan(G.rectangles([100,100,500,300],10,0)).length,8);
});
test('Margem interna e ambas: orientação, simetria e 12 posições',()=> {
  const rs=plain(G.rectangles([100,100,500,300],10,2));
  assert.deepEqual(rs.map(x=>x.b),[[100,100,500,300],[110,110,490,290],[90,90,510,310]]);
  assert.equal(G.plan(rs).length,12);
});
test('Margem zero: somente quatro posições',()=>assert.equal(G.plan(G.rectangles([0,0,500,300],0,2)).length,4));
test('Margem interna não colapsa nem inverte a área',()=> {
  assert.throws(()=>G.rectangles([0,0,100,50],25,1));
  assert.throws(()=>G.rectangles([0,0,100,50],26,2));
});
test('Entradas inválidas são recusadas; vírgula decimal é aceita',()=> {
  for(const s of ['', '3mm', '-2','1.000,5','NaN','Infinity','2e3']) assert.throws(()=>G.number(s));
  assert.equal(G.number(' 3,5 '),3.5); assert.equal(G.number('.5'),0.5);
});
test('Conversões físicas usam a resolução correta',()=> {
  approx(G.toBase(25.4,'mm',300),300); approx(G.toBase(2.54,'cm',150),150);
  approx(G.toBase(72,'pt',300),300); approx(G.toBase(30,'px',600),30);
  approx(G.toBase(25.4,'mm',72),72);
});
test('Sangria 3 mm a 300 ppi: 36 px por lado e corte sem redimensionar',()=> {
  const c=G.bleed(1000,600,3,'mm',300);
  assert.equal(c.px,36); assert.equal(c.width,1072); assert.equal(c.height,672);
  approx(c.mm,3.048);
  assert.deepEqual(plain(c.rects).map(x=>x.b),[[36,36,1036,636],[0,0,1072,672]]);
});
test('Sangria física nunca fica abaixo do pedido (diferentes resoluções)',()=> {
  for(const ppi of [72,96,100,150,240,300,600,1200]) {
    for(const mm of [0.1,1,2,3,3.5,5,10,25.4]) {
      const c=G.bleed(997,601,mm,'mm',ppi);
      assert.ok(c.mm+1e-9>=mm); assert.ok(c.mm-mm < 25.4/ppi+1e-9);
      assert.equal(c.width%2,1); assert.equal(c.height%2,1);
    }
  }
  assert.equal(G.bleed(1000,600,25.4,'mm',300).px,300);
});
test('Sangria rejeita valor zero e negativo',()=> {
  assert.throws(()=>G.bleed(1000,600,0,'mm',300));
  assert.throws(()=>G.bleed(1000,600,-1,'mm',300));
});

function uiMock(config) {
  const all=[];
  function element(type, value, properties) {
    const e={type, text:typeof value==='string'?value:'', children:[], value:false, enabled:true,
      add(t, bounds, val, props) { const child=element(t,val,props); e.children.push(child); all.push(child); return child; }};
    if(type==='dropdownlist') {
      e.items=value.map((text,index)=>({text,index})); let selected=null;
      Object.defineProperty(e,'selection',{get:()=>selected,set:v=>selected=typeof v==='number'?e.items[v]:v});
    }
    if(properties) e.properties=properties;
    return e;
  }
  return function Window(type,title) {
    const w=element(type,title); w.center=()=>{}; w.close=v=>w.exitCode=v;
    w.show=()=> {
      if(config.cancel) return 0;
      const value=all.find(e=>e.type==='edittext');
      if(config.value!==undefined) value.text=String(config.value);
      const units=all.filter(e=>e.type==='dropdownlist');
      if(config.unit) units[0].selection=units[0].items.find(x=>x.text===config.unit);
      if(config.mode!==undefined) units[1].selection=config.mode;
      const checkbox=all.find(e=>e.type==='checkbox');
      if(checkbox && config.checkbox!==undefined) checkbox.value=config.checkbox;
      if(value.onChanging) value.onChanging();
      const ok=all.find(e=>e.properties && e.properties.name==='ok');
      if(!ok.enabled) return 0;
      ok.onClick(); return w.exitCode;
    };
    return w;
  };
}
function runPS(name, config={}) {
  let ctx, nextId=1;
  const alerts=[], docs=[];
  function UV(n) { return {value:Number(n),as:()=>Number(n)}; }
  const app={version:'27.0',preferences:{rulerUnits:'mm'},documents:docs,activeDocument:null};
  function docModel(seed) {
    const s=Object.assign({name:'Teste.psd',width:1000,height:600,resolution:300,origin:[81,37],
      guides:[],selection:[100,100,500,300],layerSets:[],content:[10,20],mutations:0}, seed);
    s.guides=s.guides.map(x=>({...x})); s.origin=s.origin.slice(); s.content=s.content.slice();
    const d={id:nextId++, name:s.name, resolution:s.resolution, layerSets:s.layerSets,
      resizeCanvas(w,h,anchor) {
        assert.equal(anchor,'center');
        const dx=(w.value-s.width)/2,dy=(h.value-s.height)/2;
        s.guides.forEach(g=>g.p+=g.axis==='V'?dx:dy);
        s.content[0]+=dx; s.content[1]+=dy;
        if(s.selection) s.selection=s.selection.map((v,i)=>v+(i%2?dy:dx));
        s.width=w.value; s.height=h.value; s.mutations++;
      },
      duplicate(name,merge) { assert.equal(merge,false); return docModel({...plain(s),name}); },
      close() { docs.splice(docs.indexOf(d),1); },
      suspendHistory(label,code) { vm.runInContext(code,ctx); },
      state:()=>plain(s)
    };
    Object.defineProperties(d,{
      width:{get:()=>UV(s.width)},height:{get:()=>UV(s.height)},
      activeHistoryState:{get:()=>plain(s),set:v=>Object.assign(s,plain(v))},
      guides:{get:()=> {
        const a=s.guides.map(g=>({direction:g.axis,coordinate:UV(g.p)}));
        a.add=(axis,p)=> {
          if(config.failGuideAt && s.mutations+1===config.failGuideAt) throw new Error('Falha simulada em guia');
          s.guides.push({axis,p:p.value}); s.mutations++;
        };
        return a;
      }}
    });
    d.selection={};
    Object.defineProperty(d.selection,'bounds',{get:()=>{
      if(!s.selection) throw new Error('Sem seleção');
      return s.selection.map(UV);
    }});
    docs.push(d); return d;
  }
  const source=docModel(config.seed||{}); app.activeDocument=source;
  if(config.noDoc) docs.length=0;
  const sandbox={app,UnitValue:UV,Units:{PIXELS:'px'},Direction:{VERTICAL:'V',HORIZONTAL:'H'},
    AnchorPosition:{MIDDLECENTER:'center'},SaveOptions:{DONOTSAVECHANGES:'no'},
    Window:uiMock(config),alert:s=>alerts.push(s),
    stringIDToTypeID:s=>s,ActionReference:function(){this.putIdentifier=(key,id)=>this.id=id;},
    executeActionGet:ref=>({hasKey:()=>true,getBoolean:()=>ref.id===99})};
  sandbox.$={global:sandbox}; ctx=vm.createContext(sandbox);
  const f=name==='selection'?'apps/photoshop/scripts/guias-selecao-margem.jsx':'apps/photoshop/scripts/sangria-guias-canvas.jsx';
  vm.runInContext(fs.readFileSync(path.join(base,f),'utf8').replace(/^#target[^\n]*\n/gm,''),ctx);
  return {source,app,docs,alerts};
}
test('PS: coordenadas da imagem, preferências e seleção preservadas',()=> {
  const r=runPS('selection',{value:10,unit:'px'});
  assert.deepEqual(r.source.state().guides.map(g=>g.p),[100,500,100,300,90,510,90,310]);
  assert.deepEqual(r.source.state().origin,[81,37]); assert.equal(r.app.preferences.rulerUnits,'mm');
  assert.deepEqual(r.source.state().selection,[100,100,500,300]);
});
test('PS: posições existentes são reutilizadas sem apagar guias',()=> {
  const r=runPS('selection',{value:10,unit:'px',seed:{guides:[{axis:'V',p:100},{axis:'H',p:400}]}});
  assert.equal(r.source.state().guides.length,9);
  assert.ok(r.source.state().guides.some(x=>x.axis==='H'&&x.p===400));
});
test('PS: cancelamento e margem inválida não criam guias',()=> {
  for(const cfg of [{cancel:true},{value:100,unit:'px',mode:1}]) {
    const r=runPS('selection',cfg); assert.equal(r.source.state().guides.length,0);
    assert.equal(r.app.preferences.rulerUnits,'mm');
  }
});
test('PS: falta de seleção informa o usuário e restaura preferências',()=> {
  const r=runPS('selection',{seed:{selection:null}});
  assert.ok(r.alerts[0].includes('seleção')); assert.equal(r.source.state().guides.length,0);
  assert.equal(r.app.preferences.rulerUnits,'mm'); assert.deepEqual(r.source.state().origin,[81,37]);
});
test('PS: falha parcial ao criar guias reverte a operação inteira',()=> {
  const r=runPS('selection',{value:10,unit:'px',failGuideAt:3});
  assert.equal(r.source.state().guides.length,0); assert.ok(r.alerts[0].includes('Falha simulada'));
  assert.equal(r.app.preferences.rulerUnits,'mm');
});
test('PS: sangria em cópia mantém original; centro, guias e resolução corretos',()=> {
  const r=runPS('bleed',{value:3,unit:'mm',seed:{guides:[{axis:'V',p:0}]}});
  assert.equal(r.docs.length,2); assert.equal(r.source.state().width,1000);
  assert.deepEqual(r.source.state().content,[10,20]);
  const out=r.app.activeDocument.state(); assert.equal(out.width,1072); assert.equal(out.height,672);
  assert.equal(out.resolution,300); assert.deepEqual(out.content,[46,56]);
  assert.equal(out.guides.length,8);
  assert.deepEqual(out.guides.filter(x=>x.axis==='V').map(x=>x.p).sort((a,b)=>a-b),[0,36,1036,1072]);
});
test('PS: sangria de 20 px no documento atual acrescenta 40 px à tela',()=> {
  const r=runPS('bleed',{value:20,unit:'px',checkbox:false});
  assert.equal(r.docs.length,1); assert.equal(r.source.state().width,1040); assert.equal(r.source.state().height,640);
});
test('PS: falha de sangria no original reverte tela, conteúdo e guias',()=> {
  const r=runPS('bleed',{value:20,unit:'px',checkbox:false,failGuideAt:3});
  assert.equal(r.source.state().width,1000); assert.deepEqual(r.source.state().content,[10,20]);
  assert.equal(r.source.state().guides.length,0); assert.ok(r.alerts[0].includes('Falha simulada'));
});
test('PS: falha na cópia remove apenas a cópia temporária',()=> {
  const r=runPS('bleed',{value:20,unit:'px',failGuideAt:3});
  assert.equal(r.docs.length,1); assert.equal(r.app.activeDocument,r.source); assert.equal(r.source.state().width,1000);
});
test('PS: documentos com pranchetas são recusados antes de alterar a tela',()=> {
  const r=runPS('bleed',{seed:{layerSets:[{id:99,layerSets:[]}]}});
  assert.equal(r.docs.length,1); assert.equal(r.source.state().width,1000); assert.ok(r.alerts[0].includes('pranchetas'));
});

function item(type, geometric, visible=geometric) {
  return {typename:type,geometricBounds:geometric,visibleBounds:visible,hidden:false,guides:false};
}
function group(children,clipped=false) {
  const g={typename:'GroupItem',pageItems:children,clipped,hidden:false};
  for(const c of children) c.parent=g;
  return g;
}
function runAI(config={}) {
  const alerts=[],layers=[{name:'Arte'}];
  const selection=config.selection||[item('PathItem',[100,500,500,300])];
  const doc={selection,activeLayer:layers[0],artboards:[{artboardRect:[0,600,1000,0]}],layers};
  layers.add=()=> {
    const l={name:'',locked:false,paths:[],remove(){layers.splice(layers.indexOf(l),1);}};
    l.pathItems={add:()=> {
      if(config.failPathAt===l.paths.length+1) throw new Error('Falha simulada no caminho');
      const p={setEntirePath(points){this.points=points;}}; l.paths.push(p); return p;
    }};
    layers.push(l); return l;
  };
  const app={version:'30.0',documents:[doc],activeDocument:doc,coordinateSystem:'artboard',redraw:()=>{}};
  const ctx=vm.createContext({app,CoordinateSystem:{DOCUMENTCOORDINATESYSTEM:'document'},Window:uiMock(config),alert:s=>alerts.push(s)});
  vm.runInContext(fs.readFileSync(path.join(base,'apps/illustrator/scripts/guias-selecao-margem.jsx'),'utf8').replace(/^#target[^\n]*\n/gm,''),ctx);
  return {app,doc,layers,alerts,selection};
}
function aiGuideCoords(r,axis) {
  return r.layers[1].paths.filter(p=>p.name.endsWith('/ '+axis)).map(p=>p.points[0][axis==='V'?0:1]).sort((a,b)=>a-b);
}
test('AI: guias externas corretas com eixo Y para cima e camada separada',()=> {
  const r=runAI({value:10,unit:'px'});
  assert.deepEqual(aiGuideCoords(r,'V'),[90,100,500,510]); assert.deepEqual(aiGuideCoords(r,'H'),[290,300,500,510]);
  assert.equal(r.layers[1].locked,true); assert.equal(r.app.coordinateSystem,'artboard');
  assert.equal(r.doc.activeLayer,r.layers[0]); assert.equal(r.doc.selection[0],r.selection[0]);
  assert.ok(r.layers[1].paths.every(x=>x.guides===true));
});
test('AI: opção de traços usa limites visíveis ou geométricos',()=> {
  const selected=item('PathItem',[100,500,500,300],[98,502,502,298]);
  const r=runAI({value:0,unit:'px',selection:[selected]});
  assert.deepEqual(aiGuideCoords(r,'V'),[98,502]);
  const s=runAI({value:0,unit:'px',selection:[selected],checkbox:false});
  assert.deepEqual(aiGuideCoords(s,'V'),[100,500]);
});
test('AI: grupo recortado usa máscara e ignora arte que ultrapassa o recorte',()=> {
  const clip=item('PathItem',[100,500,500,300]); clip.clipping=true;
  const big=item('PlacedItem',[-1000,2000,2000,-1000]);
  const r=runAI({value:0,unit:'px',selection:[group([clip,big],true)]});
  assert.deepEqual(aiGuideCoords(r,'V'),[100,500]); assert.deepEqual(aiGuideCoords(r,'H'),[300,500]);
});
test('AI: união de múltiplos objetos e grupos ignora guias selecionadas',()=> {
  const guide=item('PathItem',[-500,1000,1000,-500]); guide.guides=true;
  const r=runAI({value:0,unit:'px',selection:[group([item('PathItem',[100,500,200,400]),
    item('PathItem',[300,300,500,100])]),guide]});
  assert.deepEqual(aiGuideCoords(r,'V'),[100,500]); assert.deepEqual(aiGuideCoords(r,'H'),[100,500]);
});
test('AI: cancelamento preserva a camada e o sistema de coordenadas',()=> {
  const r=runAI({cancel:true}); assert.equal(r.layers.length,1); assert.equal(r.app.coordinateSystem,'artboard');
});
test('AI: erro parcial remove a camada de guias incompleta',()=> {
  const r=runAI({value:10,unit:'px',failPathAt:3});
  assert.equal(r.layers.length,1); assert.equal(r.app.coordinateSystem,'artboard'); assert.ok(r.alerts[0].includes('Falha simulada'));
});
for(const f of scriptFiles) {
  test('Sintaxe JavaScript do arquivo completo: '+f,()=> {
    const code=fs.readFileSync(path.join(base,f),'utf8').replace(/^#target[^\n]*\n/gm,'');
    new vm.Script(code,{filename:f});
    assert.ok(!/\b(?:let|const|class)\s+[a-zA-Z_$]/.test(code));
    assert.ok(!code.includes('=>'));
  });
}
const report={date:'2026-09-21',kind:'Cálculos reais; contratos dos aplicativos simulados em Node.js. Não executado no Photoshop/Illustrator.',
  passed:results.filter(x=>x.ok).length,total:results.length,results};
console.log(JSON.stringify(report,null,2));
if(report.passed!==report.total) process.exit(1);
