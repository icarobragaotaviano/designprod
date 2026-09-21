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
  const alerts=[], docs=[], events=[];
  function UV(n) { return {value:Number(n),as:()=>Number(n)}; }
  const app={version:'27.0',preferences:{rulerUnits:'mm'},documents:docs,activeDocument:null};
  function docModel(seed) {
    const s=Object.assign({name:'Teste.psd',width:1000,height:600,resolution:300,origin:[81,37],
      guides:[],selection:[100,100,500,300],layerSets:[],content:[10,20],mutations:0,
      mode:'RGB',bitsPerChannel:'16',pixelAspectRatio:1,colorProfileType:'CUSTOM',colorProfileName:'sRGB IEC61966-2.1',
      channels:[{name:'Red',kind:'component'},{name:'Green',kind:'component'},{name:'Blue',kind:'component'}],
      layers:[{name:'Fundo',visible:true},{name:'Arte',visible:true},{name:'Oculta',visible:false}],
      activeChannelNames:['Red','Green','Blue'],raster:null,isDuplicate:false}, seed);
    s.guides=s.guides.map(x=>({...x})); s.origin=s.origin.slice(); s.content=s.content.slice();
    const d={id:nextId++, name:s.name, layerSets:s.layerSets,
      resizeCanvas(w,h,anchor) {
        assert.equal(anchor,'center');
        const dx=(w.value-s.width)/2,dy=(h.value-s.height)/2;
        s.guides.forEach(g=>g.p+=g.axis==='V'?dx:dy);
        s.content[0]+=dx; s.content[1]+=dy;
        if(s.selection) s.selection=s.selection.map((v,i)=>v+(i%2?dy:dx));
        s.width=w.value; s.height=h.value; s.mutations++;
      },
      duplicate(name,merge) {
        events.push({op:'duplicate',doc:d.id,merge});
        if(config.failDuplicate) throw new Error('Falha simulada ao duplicar');
        const copy={...plain(s),name,isDuplicate:true,...(config.duplicateMismatch||{})};
        if(merge) copy.layers=[{name:'Composição mesclada',visible:true}];
        return docModel(copy);
      },
      crop(bounds) {
        assert.equal(arguments.length,1,'Recorte não deve informar tamanho de saída nem reamostrar');
        assert.equal(app.activeDocument,d);
        events.push({op:'crop',doc:d.id,bounds:bounds.map(v=>v.value)});
        if(config.failCrop) throw new Error('Falha simulada no recorte');
        const [l,t,r,b]=bounds.map(v=>v.value);
        if(s.raster) s.raster=s.raster.slice(t,b).map(row=>row.slice(l,r));
        s.guides.forEach(g=>g.p-=g.axis==='V'?l:t);
        s.content[0]-=l; s.content[1]-=t;
        s.width=r-l; s.height=b-t;
        Object.assign(s,config.cropMismatch||{});
      },
      close() { events.push({op:'close',doc:d.id}); docs.splice(docs.indexOf(d),1); },
      suspendHistory(label,code) { vm.runInContext(code,ctx); },
      state:()=>plain(s)
    };
    Object.defineProperties(d,{
      width:{get:()=>UV(s.width)},height:{get:()=>UV(s.height)},
      resolution:{get:()=>s.resolution},mode:{get:()=>s.mode},bitsPerChannel:{get:()=>s.bitsPerChannel},
      pixelAspectRatio:{get:()=>s.pixelAspectRatio},colorProfileType:{get:()=>s.colorProfileType},
      colorProfileName:{get:()=>{
        if(s.colorProfileType==='NONE') throw new Error('Documento sem perfil');
        return s.colorProfileName;
      }},
      channels:{get:()=>s.channels},layers:{get:()=>s.layers},
      componentChannels:{get:()=>s.channels.filter(c=>c.kind==='component')},
      activeChannels:{get:()=>s.channels.filter(c=>s.activeChannelNames.includes(c.name)),set:v=>s.activeChannelNames=v.map(c=>c.name)},
      activeHistoryState:{get:()=>plain(s),set:v=>Object.assign(s,plain(v))},
      guides:{get:()=> {
        const a=s.guides.map(g=>({direction:g.axis,coordinate:UV(g.p),remove(){s.guides.splice(s.guides.indexOf(g),1);}}));
        a.add=(axis,p)=> {
          if(config.failGuideAt && s.mutations+1===config.failGuideAt) throw new Error('Falha simulada em guia');
          if(config.failTargetGuide && s.isDuplicate) throw new Error('Falha simulada em guia do remendo');
          events.push({op:'guide',doc:d.id,axis,p:p.value});
          s.guides.push({axis,p:p.value}); s.mutations++;
        };
        return a;
      }}
    });
    d.selection={
      select(points,type,feather,antialias) {
        assert.equal(app.activeDocument,d); assert.equal(type,'replace'); assert.equal(feather,0); assert.equal(antialias,false);
        events.push({op:'select',doc:d.id});
        s.selection=[points[0][0],points[0][1],points[2][0],points[2][1]];
      },
      deselect() { s.selection=null; events.push({op:'deselect',doc:d.id}); }
    };
    Object.defineProperty(d.selection,'bounds',{get:()=>{
      if(!s.selection) throw new Error('Sem seleção');
      return s.selection.map(UV);
    }});
    docs.push(d); return d;
  }
  const source=docModel(config.seed||{}); app.activeDocument=source;
  if(config.existingName) docModel({name:config.existingName});
  if(config.noDoc) docs.length=0;
  const sandbox={app,UnitValue:UV,Units:{PIXELS:'px'},Direction:{VERTICAL:'V',HORIZONTAL:'H'},
    AnchorPosition:{MIDDLECENTER:'center'},SaveOptions:{DONOTSAVECHANGES:'no'},
    SelectionType:{REPLACE:'replace'},
    Window:uiMock(config),alert:s=>alerts.push(s),
    stringIDToTypeID:s=>s,ActionReference:function(){this.putIdentifier=(key,id)=>this.id=id;},
    executeActionGet:ref=>({hasKey:()=>true,getBoolean:()=>ref.id===99})};
  sandbox.$={global:sandbox}; ctx=vm.createContext(sandbox);
  const f=name==='selection'?'apps/photoshop/scripts/guias-selecao-margem.jsx':'apps/photoshop/scripts/sangria-guias-canvas.jsx';
  vm.runInContext(fs.readFileSync(path.join(base,f),'utf8').replace(/^#target[^\n]*\n/gm,''),ctx);
  return {source,app,docs,alerts,events};
}
test('PS: guias corretas, preferências preservadas e seleção ampliada até a margem',()=> {
  const r=runPS('selection',{value:10,unit:'px'});
  assert.deepEqual(r.source.state().guides.map(g=>g.p),[100,500,100,300,90,510,90,310]);
  assert.deepEqual(r.source.state().origin,[81,37]); assert.equal(r.app.preferences.rulerUnits,'mm');
  assert.deepEqual(r.source.state().selection,[90,90,510,310]);
});
test('PS: posições existentes são reutilizadas sem apagar guias',()=> {
  const r=runPS('selection',{value:10,unit:'px',seed:{guides:[{axis:'V',p:100},{axis:'H',p:400}]}});
  assert.equal(r.source.state().guides.length,9);
  assert.ok(r.source.state().guides.some(x=>x.axis==='H'&&x.p===400));
});
test('PS: cancelamento e margem inválida não criam guias',()=> {
  for(const cfg of [{cancel:true},{value:1000,unit:'px'}]) {
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

test('Remendo: guias → seleção total → duplicata mesclada → recorte',()=> {
  const r=runPS('selection',{value:10,unit:'px'});
  const ops=r.events.map(e=>e.op);
  const selection=ops.indexOf('select'),duplicate=ops.indexOf('duplicate'),crop=ops.indexOf('crop');
  assert.ok(selection>0&&duplicate>selection&&crop>duplicate);
  assert.ok(r.events.slice(0,selection).every(e=>e.op==='guide'&&e.doc===r.source.id));
  assert.equal(r.events[duplicate].merge,true);
  const out=r.app.activeDocument.state();
  assert.equal(out.width,420); assert.equal(out.height,220); assert.equal(out.layers.length,1);
  assert.equal(out.selection,null); assert.equal(r.source.state().layers.length,3);
});
test('Remendo: recorte copia os pixels da composição e mantém transparência',()=> {
  const raster=Array.from({length:6},(_,y)=>Array.from({length:8},(_,x)=>[x*30,y*30,100,x===1?0:255]));
  const r=runPS('selection',{value:1,unit:'px',seed:{width:8,height:6,selection:[2,2,5,4],raster}});
  assert.equal(r.docs.length,2);
  assert.deepEqual(r.app.activeDocument.state().raster,raster.slice(1,5).map(row=>row.slice(1,6)));
  assert.deepEqual(r.source.state().raster,raster);
  assert.deepEqual(r.source.state().selection,[1,1,6,5]);
});
test('Remendo: modo, resolução, bits, perfil e proporção de pixel são herdados',()=> {
  const attributes={mode:'CMYK',resolution:150,bitsPerChannel:'16',pixelAspectRatio:1.2,colorProfileType:'CUSTOM',
    colorProfileName:'ISO Coated v2 300% (ECI)',channels:[{name:'Cyan',kind:'component'},{name:'Magenta',kind:'component'},
      {name:'Yellow',kind:'component'},{name:'Black',kind:'component'},{name:'Branco',kind:'spot'}]};
  const r=runPS('selection',{value:10,unit:'px',seed:attributes});
  assert.equal(r.docs.length,2);
  for(const key of Object.keys(attributes)) assert.deepEqual(r.app.activeDocument.state()[key],attributes[key]);
});
test('Remendo: não atribui um perfil a um original sem perfil',()=> {
  const r=runPS('selection',{value:0,unit:'px',seed:{colorProfileType:'NONE',colorProfileName:null}});
  assert.equal(r.docs.length,2); assert.equal(r.app.activeDocument.state().colorProfileType,'NONE');
  assert.equal(r.app.activeDocument.state().colorProfileName,null);
});
test('Remendo: 3 mm a 300 ppi inclui 36 px por lado e guias locais corretas',()=> {
  const r=runPS('selection',{value:3,unit:'mm'});
  const out=r.app.activeDocument.state();
  assert.equal(out.width,472); assert.equal(out.height,272);
  assert.deepEqual(r.source.state().selection,[64,64,536,336]);
  assert.deepEqual(out.guides.filter(g=>g.axis==='V').map(g=>g.p).sort((a,b)=>a-b),[0,36,436,472]);
  assert.deepEqual(out.guides.filter(g=>g.axis==='H').map(g=>g.p).sort((a,b)=>a-b),[0,36,236,272]);
});
test('Remendo: coordenadas fracionárias são expandidas sem reamostrar pixels',()=> {
  const r=runPS('selection',{value:0.2,unit:'px',seed:{selection:[100.25,100.5,500.1,300.1]}});
  assert.deepEqual(r.source.state().selection,[99,99,502,302]);
  assert.equal(r.app.activeDocument.state().width,403); assert.equal(r.app.activeDocument.state().height,203);
});
test('Remendo: margem zero extrai só a seleção; margem fora da arte é recusada',()=> {
  const zero=runPS('selection',{value:0,unit:'px'});
  assert.equal(zero.app.activeDocument.state().width,400); assert.equal(zero.app.activeDocument.state().height,200);
  const outside=runPS('selection',{value:101,unit:'px'});
  assert.equal(outside.docs.length,1); assert.equal(outside.source.state().guides.length,0);
  assert.deepEqual(outside.source.state().selection,[100,100,500,300]);
});
test('Remendo: divergência de características na duplicata aborta e reverte',()=> {
  for(const mismatch of [{resolution:72},{bitsPerChannel:'8'},{mode:'CMYK'},{pixelAspectRatio:1.1},
    {colorProfileName:'Adobe RGB (1998)'},{colorProfileType:'NONE'},{channels:[]}]) {
    const r=runPS('selection',{value:10,unit:'px',duplicateMismatch:mismatch});
    assert.equal(r.docs.length,1); assert.equal(r.app.activeDocument,r.source);
    assert.equal(r.source.state().guides.length,0); assert.deepEqual(r.source.state().selection,[100,100,500,300]);
    assert.ok(r.alerts[0].includes('interrompido'));
  }
});
test('Remendo: mudança de resolução ou dimensão durante o recorte aborta',()=> {
  for(const mismatch of [{resolution:72},{width:419},{height:219}]) {
    const r=runPS('selection',{value:10,unit:'px',cropMismatch:mismatch});
    assert.equal(r.docs.length,1); assert.equal(r.source.state().guides.length,0);
    assert.deepEqual(r.source.state().selection,[100,100,500,300]);
  }
});
test('Remendo: falhas ao duplicar, recortar ou criar guias locais desfazem o original',()=> {
  for(const failure of [{failDuplicate:true},{failCrop:true},{failTargetGuide:true}]) {
    const r=runPS('selection',{value:10,unit:'px',...failure,seed:{guides:[{axis:'H',p:77}]}});
    assert.equal(r.docs.length,1); assert.equal(r.app.activeDocument,r.source);
    assert.deepEqual(r.source.state().guides,[{axis:'H',p:77}]);
    assert.deepEqual(r.source.state().selection,[100,100,500,300]);
    assert.equal(r.app.preferences.rulerUnits,'mm');
  }
});
test('Remendo: nomes distintos e apenas guias do remendo no novo documento',()=> {
  const r=runPS('selection',{value:10,unit:'px',existingName:'Teste_remendo',seed:{guides:[{axis:'V',p:777}]}});
  assert.equal(r.app.activeDocument.name,'Teste_remendo_2');
  assert.equal(r.app.activeDocument.state().guides.length,8);
  assert.ok(r.source.state().guides.some(g=>g.p===777));
});
test('Remendo: pranchetas são recusadas antes de alterar guias ou seleção',()=> {
  const r=runPS('selection',{seed:{layerSets:[{id:99,layerSets:[]}]}});
  assert.equal(r.docs.length,1); assert.equal(r.source.state().guides.length,0);
  assert.ok(r.alerts[0].includes('pranchetas'));
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
const report={date:new Date().toISOString().slice(0,10),kind:'Cálculos reais; contratos dos aplicativos simulados em Node.js. Não executado no Photoshop/Illustrator.',
  passed:results.filter(x=>x.ok).length,total:results.length,results};
console.log(JSON.stringify(report,null,2));
if(report.passed!==report.total) process.exit(1);
