/** Testes do editor v2 com o DOM do Photoshop simulado. Uso: npm run test:textos. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const nodePath = require('node:path');
const base = nodePath.resolve(__dirname, '..');
const path = nodePath.join(base, 'apps/photoshop/scripts/editar-textos-precos-rapido.jsx');
const source = fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, '').replace(/^[ \t]*#target[^\n]*$/gm, '');
const fixtures = JSON.parse(fs.readFileSync(nodePath.join(__dirname, 'fixtures/textos-precos-modelos.json')));
const clone = value => JSON.parse(JSON.stringify(value));
let transformFailure = false;
let nativeCalls = 0;
function UnitValue(value, unit) { this.value = value; this.as = () => value; }

function textWidth(text) {
    const lines = text.split('\r').filter(l => l.length);
    return Math.max(1, ...lines.map(line => [...line].reduce((sum, c) => sum + (/[,/. ]/.test(c) ? 0.5 : c === '1' ? 0.8 : 1), 0)));
}
function lineCount(text) { return Math.max(1, text.split('\r').filter(l => l.length).length); }
function makeLayer(f) {
    const layer = {name: f.name, visible: f.visible, typename: f.kind === 'group' ? 'LayerSet' : 'ArtLayer',
        kind: f.kind === 'type' ? 'TEXT' : f.kind, allLocked: false, positionLocked: false,
        box: [...f.bbox], sx: 1, sy: 1, baseBox: [...f.bbox], original: f.text, text: f.text};
    Object.defineProperty(layer, 'bounds', {get() {
        if (this.kind === 'TEXT') {
            // PSD fixtures show side bearings: two digits are not twice the ink width of one.
            let width;
            if (/^9{1,2}$/.test(this.original)) {
                const big=this.baseBox[3]-this.baseBox[1]>100;
                width=((big?103:52)+(this.text.length-1)*(big?114:57))*this.sx;
            } else width = (this.baseBox[2]-this.baseBox[0]) * textWidth(this.text)/textWidth(this.original) * this.sx;
            const height = (this.baseBox[3]-this.baseBox[1]) * lineCount(this.text)/lineCount(this.original) * this.sy;
            return [this.box[0],this.box[1],this.box[0]+width,this.box[1]+height].map(v=>new UnitValue(v,'px'));
        }
        return this.box.map(v=>new UnitValue(v,'px'));
    }});
    if (f.kind === 'type') {
        layer.textItem = {font: 'SFPro-CondensedSemibold'};
        Object.defineProperty(layer.textItem, 'contents', {get() { return layer.text; }, set(value) { nativeCalls++; layer.text = value; layer.name = value; }});
    }
    layer.translate = function(x,y) {
        nativeCalls++;
        if (transformFailure) throw new Error('Simulated transform error');
        this.box = [this.box[0]+x.value,this.box[1]+y.value,this.box[2]+x.value,this.box[3]+y.value];
    };
    layer.resize = function(x,y,anchor) {
        nativeCalls++; assert.equal(anchor, 'TOPLEFT');
        if (this.kind === 'TEXT') { this.sx *= x/100; this.sy *= y/100; }
        else { this.box[2] = this.box[0]+(this.box[2]-this.box[0])*x/100; this.box[3] = this.box[1]+(this.box[3]-this.box[1])*y/100; }
    };
    if (f.children) layer.layers = f.children.map(makeLayer);
    return layer;
}
function snapshotLayer(l) { return {name:l.name,visible:l.visible,kind:l.kind,box:[...l.box],sx:l.sx,sy:l.sy,text:l.text,children:l.layers&&l.layers.map(snapshotLayer)}; }
function restoreLayer(layer,s) {
    layer.name=s.name;layer.visible=s.visible;layer.box=[...s.box];layer.sx=s.sx;layer.sy=s.sy;layer.text=s.text;
    if(layer.layers)layer.layers.forEach((child,i)=>restoreLayer(child,s.children[i]));
}
function guideCollection(items=[]) {
    const result=[];
    result.add=function(direction,coordinate) {
        nativeCalls++;
        const g={direction,coordinate,remove(){nativeCalls++;result.splice(result.indexOf(g),1);}};
        result.push(g);return g;
    };
    items.forEach(([p,d])=>result.add(d===0?'VERTICAL':'HORIZONTAL',new UnitValue(p,'px')));
    return result;
}
function makeDocument(index) {
    const f=fixtures[index];
    const doc={name:f.stem+'.psd',layers:f.children.map(makeLayer),width:new UnitValue(f.width,'px'),height:new UnitValue(f.height,'px'),guides:guideCollection(),historyCalls:0,resizes:[]};
    doc.activeLayer=doc.layers.at(-1);
    doc.resizeCanvas=function(w,h,anchor){nativeCalls++;assert.equal(anchor,'TOPLEFT');this.width=w;this.height=h;this.resizes.push([w.value,h.value]);};
    doc.suspendHistory=function(label,code){this.historyCalls++;vm.runInNewContext(code,context);};
    function snapshot(){return {width:doc.width.value,height:doc.height.value,layers:doc.layers.map(snapshotLayer),guides:doc.guides.map(g=>[g.coordinate.value,g.direction==='VERTICAL'?0:1])};}
    Object.defineProperty(doc,'activeHistoryState',{get:snapshot,set(state){doc.width=new UnitValue(state.width,'px');doc.height=new UnitValue(state.height,'px');doc.layers.forEach((l,i)=>restoreLayer(l,state.layers[i]));doc.guides=guideCollection(state.guides);}});
    return doc;
}
let uiAction=null;
function Control(type,text,root){this.type=type;this.text=text;this.children=[];this.root=root||this;this.preferredSize={};}
Control.prototype.add=function(type,bounds,text){const child=new Control(type,text,this.root);this.children.push(child);return child;};
Object.defineProperty(Control.prototype,'selection',{get(){return this._selection;},set(v){this._selection=typeof v==='number'?{index:v}:v;}});
Control.prototype.center=function(){};
Control.prototype.show=function(){if(uiAction)uiAction(this);return this.closed;};
Control.prototype.close=function(n){this.closed=n;};
function controls(root,type){return root.children.flatMap(c=>(c.type===type?[c]:[]).concat(controls(c,type)));}
const alerts=[];
const context={app:{preferences:{rulerUnits:'MM'},displayDialogs:'ALL',fonts:{getByName(name){assert.equal(name,'SFPro-CondensedSemibold');return {name};}}},
    UnitValue,LayerKind:{TEXT:'TEXT'},AnchorPosition:{TOPLEFT:'TOPLEFT'},Direction:{VERTICAL:'VERTICAL',HORIZONTAL:'HORIZONTAL'},Units:{PIXELS:'PX'},DialogModes:{NO:'NO'},
    Window:function(){return new Control('window');},alert(msg){alerts.push(msg);},$:{global:{}},
    File:function(){throw new Error('File access is forbidden in editor');},Folder:function(){throw new Error('Folder access is forbidden in editor');}};
const marker='    try {\n        if (!app.documents.length)';
assert.equal(source.split(marker).length,2);
vm.runInNewContext(source.replace(marker,'    this.API = {layouts:LAYOUTS, collect:collect, parseData:parseData, applyLayout:applyLayout, transaction:transaction, dialog:dialog, bounds:bounds, readGuides:readGuides, ensureFont:ensureFont};\n    return;\n'+marker),context);
const A=context.API;
let passed=0;
function test(name,run){run();passed++;console.log('PASS '+name);}
function near(actual,expected,tolerance=0.01){assert.equal(actual.length,expected.length);actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<tolerance,JSON.stringify({actual,expected})));}
function data(index,de,por,unitDe,unitPor,product='Lorem ipsum\rdolor sit amet',guides=true){return A.parseData(A.layouts[index],product,de,por,unitDe,unitPor,guides);}
function checkOriginalGeometry(doc,targetIndex){
    const expected=fixtures[targetIndex];
    function walk(actual,expected){
        expected.forEach((e,i)=>{
            const a=actual[i];assert.equal(a.name,e.name);
            if(e.kind==='type'||e.kind==='shape')near(A.bounds(a),e.bbox,0.02);
            if(e.children)walk(a.layers,e.children);
        });
    }
    walk(doc.layers,expected.children);
}

test('Small complete script compiles and contains no binary payload or disk IO',()=>{
    new vm.Script(source);assert.ok(Buffer.byteLength(source)<25000);
    assert.doesNotMatch(source,/decode64|base64|\.saveAs\(|app\.open\(|new File\(|new Folder\(/);
});
test('Data validation covers decimals, model width and independent units',()=>{
    const d=data(1,'R$ 29,9','8.50','kg','cx');assert.equal(d.de.integer,'29');assert.equal(d.de.cents,',90');assert.equal(d.unitDe,'/KG');assert.equal(d.unitPor,'CX');
    assert.equal(data(0,'','0','','L').unitPor,'/L');
    for(const price of ['12,50','100','-2','3,123',''])assert.throws(()=>data(0,'',price,'','UN'));
    assert.throws(()=>data(1,'','19,90','',''));assert.throws(()=>data(1,'','19,90','','UN',''));
});
test('One-digit source changes to two-digit geometry and source guides',()=>{
    const doc=makeDocument(0),refs=A.collect(doc);
    A.transaction(doc,refs,A.layouts[1],data(1,'99,99','99,99','/KG','/KG'));
    assert.equal(doc.width.value,706);assert.equal(doc.height.value,468);
    checkOriginalGeometry(doc,1);
    near(doc.resizes[0],[706,484]);near(doc.resizes[1],[706,468]);
    assert.deepEqual(JSON.parse(JSON.stringify(A.readGuides(doc))).sort(),[[25,0],[25,1],[681,0],[443,1]].sort());
    assert.equal(refs.de.kg.visible,true);assert.equal(refs.por.un.visible,false);
    assert.equal(doc.historyCalls,1);assert.equal(context.app.preferences.rulerUnits,'MM');assert.equal(context.app.displayDialogs,'ALL');
});
test('Two-digit source changes to one-digit geometry without an early width crop',()=>{
    const doc=makeDocument(1);
    A.transaction(doc,A.collect(doc),A.layouts[0],data(0,'9,99','9,99','UN','UN'));
    checkOriginalGeometry(doc,0);
    near(doc.resizes[0],[706,484]);near(doc.resizes[1],[597,484]);
    assert.deepEqual(JSON.parse(JSON.stringify(A.readGuides(doc))).sort(),[[25,0],[25,1],[572,0],[459,1]].sort());
});
test('Repeated switches do not accumulate movement or scaling',()=>{
    const doc=makeDocument(0);
    for(let i=0;i<20;i++){
        const idx=i%2===0?1:0,price=idx?'99,99':'9,99',unit=idx?'/KG':'UN';
        A.transaction(doc,A.collect(doc),A.layouts[idx],data(idx,price,price,unit,unit));
        checkOriginalGeometry(doc,idx);
    }
});
test('Custom prices preserve integer/right and cents/left anchors',()=>{
    const doc=makeDocument(1),refs=A.collect(doc);
    A.transaction(doc,refs,A.layouts[1],data(1,'29,90','8,50','/KG','UN'));
    assert.equal(refs.de.integer.text,'29');assert.equal(refs.de.cents.text,',90');
    assert.equal(refs.por.integer.text,'8');assert.equal(refs.por.cents.text,',50');
    assert.equal(A.bounds(refs.por.integer)[2],593);assert.equal(A.bounds(refs.por.cents)[0],601);
    assert.equal(refs.de.kg.visible,true);assert.equal(refs.por.un.visible,true);
});
test('Long units and names can return to their original sizes',()=>{
    const doc=makeDocument(0),refs=A.collect(doc);
    A.transaction(doc,refs,A.layouts[0],data(0,'','8,90','','PACOTE','NOME DE PRODUTO MUITO LONGO PARA O ESPACO\rOUTRA LINHA MUITO GRANDE\rTERCEIRA LINHA'));
    assert.ok(refs.por.un.sy<1);assert.ok(refs.product.sy<1);assert.equal(refs.de.group.visible,false);
    A.transaction(doc,refs,A.layouts[0],data(0,'9,99','9,99','UN','UN'));
    checkOriginalGeometry(doc,0);
    assert.equal(refs.de.group.visible,true);
});
test('Hidden DE also follows the chosen layout and preserves editable layers',()=>{
    const doc=makeDocument(0),refs=A.collect(doc);
    A.transaction(doc,refs,A.layouts[1],data(1,'','19,90','','CX'));
    assert.equal(refs.de.group.visible,false);assert.equal(refs.de.strike.name,'Forma 1');
    near(A.bounds(refs.de.strike),[32,258,216,355]);
    assert.equal(refs.por.un.kind,'TEXT');assert.equal(refs.por.un.name,'UN');assert.equal(refs.por.un.text,'CX');
});
test('Guide opt-out preserves existing guides',()=>{
    const doc=makeDocument(0);doc.guides=guideCollection([[10,0],[75,1]]);
    A.transaction(doc,A.collect(doc),A.layouts[1],data(1,'99','19','UN','UN','Produto',false));
    assert.deepEqual(JSON.parse(JSON.stringify(A.readGuides(doc))),[[10,0],[75,1]]);
});
test('Failure restores canvas, text, visibility, guides and application preferences',()=>{
    const doc=makeDocument(0);doc.guides=guideCollection([[10,0],[75,1]]);
    const before=clone(doc.activeHistoryState);transformFailure=true;
    assert.throws(()=>A.transaction(doc,A.collect(doc),A.layouts[1],data(1,'29,90','19,90','UN','UN')),/desfeitas/);
    transformFailure=false;assert.deepEqual(clone(doc.activeHistoryState),before);
    assert.equal(context.app.preferences.rulerUnits,'MM');assert.equal(context.app.displayDialogs,'ALL');
    assert.equal(context.$.global.__IBD_EditarTextos_2,undefined);
});
test('Undo history snapshot recovers the unmodified document',()=>{
    const doc=makeDocument(0),before=doc.activeHistoryState;
    A.transaction(doc,A.collect(doc),A.layouts[1],data(1,'29,90','19,90','/KG','UN'));
    assert.equal(doc.historyCalls,1);doc.activeHistoryState=before;
    assert.deepEqual(clone(doc.activeHistoryState),clone(before));
});
test('Structure validation rejects missing and locked layers before editing',()=>{
    const doc=makeDocument(0);doc.layers.at(-1).name='Outro nome';assert.throws(()=>A.collect(doc),/PRODUTO/);
    const locked=makeDocument(0);locked.layers.at(-1).allLocked=true;assert.throws(()=>A.collect(locked),/Desbloqueie/);
});
test('Dialog starts from current PSD values and applies model/data choices',()=>{
    const doc=makeDocument(0),refs=A.collect(doc);
    uiAction=root=>{
        const inputs=controls(root,'edittext');assert.equal(inputs[1].text,'9,99');assert.equal(inputs[2].text,'UN');
        controls(root,'dropdownlist')[0].selection=1;
        ['PRODUTO NOVO\nPACOTE 5 KG','29,90','/KG','19,90','UN'].forEach((s,i)=>inputs[i].text=s);
        controls(root,'button').find(b=>b.text==='Aplicar no PSD aberto').onClick();assert.equal(root.closed,1);
    };
    const choice=A.dialog(doc,refs);assert.equal(choice.layout.digits,2);assert.equal(choice.data.product,'PRODUTO NOVO\rPACOTE 5 KG');assert.equal(choice.data.unitPor,'UN');
});
test('Cancel does not modify the open document',()=>{
    const doc=makeDocument(0),before=clone(doc.activeHistoryState);
    uiAction=root=>controls(root,'button').find(b=>b.text==='Cancelar').onClick();
    assert.equal(A.dialog(doc,A.collect(doc)),null);assert.deepEqual(clone(doc.activeHistoryState),before);
});
const result={passed,bytes:fs.statSync(path).size,nativePhotoshopTest:false,note:'Geometry compared against PSD inspection fixtures. Native APIs and history simulated. No native Photoshop performance or rendering claim.'};
console.log(JSON.stringify(result,null,2));
