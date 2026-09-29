/** Testes do criador em série com o DOM do Photoshop simulado. Uso: npm run test:textos. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const nodePath = require('node:path');
const base = nodePath.resolve(__dirname, '..');
const path = nodePath.join(base, 'apps/photoshop/scripts/criar-textos-precos.jsx');
const source = fs.readFileSync(path, 'utf8').replace(/^﻿/, '').replace(/^[ \t]*#target[^\n]*$/gm, '');
const fixtures = JSON.parse(fs.readFileSync(nodePath.join(__dirname, 'fixtures/textos-precos-modelos.json')));
function UnitValue(value) { this.value = value; this.as = () => value; }

/* Camadas: mesmo modelo de medida do teste do editor. */
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
            let width;
            if (/^9{1,2}$/.test(this.original)) {
                const big = this.baseBox[3] - this.baseBox[1] > 100;
                width = ((big ? 103 : 52) + (this.text.length - 1) * (big ? 114 : 57)) * this.sx;
            } else width = (this.baseBox[2] - this.baseBox[0]) * textWidth(this.text) / textWidth(this.original) * this.sx;
            const height = (this.baseBox[3] - this.baseBox[1]) * lineCount(this.text) / lineCount(this.original) * this.sy;
            return [this.box[0], this.box[1], this.box[0] + width, this.box[1] + height].map(v => new UnitValue(v));
        }
        return this.box.map(v => new UnitValue(v));
    }});
    if (f.kind === 'type') {
        layer.textItem = {};
        Object.defineProperty(layer.textItem, 'contents', {get() { return layer.text; }, set(value) { layer.text = value; layer.name = value; }});
    }
    layer.translate = function (x, y) { this.box = [this.box[0] + x.value, this.box[1] + y.value, this.box[2] + x.value, this.box[3] + y.value]; };
    layer.resize = function (x, y, anchor) {
        if (this.kind === 'TEXT') { this.sx *= x / 100; this.sy *= y / 100; return; }
        const w = (this.box[2] - this.box[0]) * x / 100, h = (this.box[3] - this.box[1]) * y / 100;
        if (anchor === 'MIDDLECENTER') {
            const cx = (this.box[0] + this.box[2]) / 2, cy = (this.box[1] + this.box[3]) / 2;
            this.box = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
        } else this.box = [this.box[0], this.box[1], this.box[0] + w, this.box[1] + h];
    };
    if (f.children) layer.layers = f.children.map(makeLayer);
    return layer;
}
function guideCollection(items = []) {
    const result = [];
    result.add = function (direction, coordinate) {
        const g = {direction, coordinate, remove() { result.splice(result.indexOf(g), 1); }};
        result.push(g); return g;
    };
    items.forEach(([p, d]) => result.add(d === 0 ? 'VERTICAL' : 'HORIZONTAL', new UnitValue(p)));
    return result;
}

/* Sistema de arquivos e Photoshop simulados. */
const disk = new Set(['/userdata', '/desktop', '/fotos/arroz.png', '/fotos/feijao.jpg', '/saida']);
const contents = new Map();
const MODEL_DIR = '/userdata/IBD/modelos-textos-precos-1';
let templateWrites = 0;
function File(p) { this.fsName = String(p); this.name = encodeURI(this.fsName.split('/').pop()); }
Object.defineProperty(File.prototype, 'exists', {get() { return disk.has(this.fsName); }});
Object.defineProperty(File.prototype, 'length', {get() { return (contents.get(this.fsName) || '').length; }});
Object.defineProperty(File.prototype, 'parent', {get() { return new Folder(this.fsName.replace(/\/[^/]*$/, '')); }});
File.prototype.open = function (mode) {
    if (mode === 'r' && !this.exists) return false;
    if (mode === 'w') { if (!disk.has(this.parent.fsName)) return false; contents.set(this.fsName, ''); disk.add(this.fsName); if (this.fsName.startsWith(MODEL_DIR)) templateWrites++; }
    this.mode = mode; this.pos = 0; return true;
};
File.prototype.read = function () { assert.equal(this.encoding, 'BINARY'); return contents.get(this.fsName); };
File.prototype.write = function (t) { assert.equal(this.encoding, 'BINARY'); contents.set(this.fsName, contents.get(this.fsName) + t); return true; };
File.prototype.close = function () { return true; };
function Folder(p) { this.fsName = String(p); }
Object.defineProperty(Folder.prototype, 'exists', {get() { return disk.has(this.fsName); }});
Object.defineProperty(Folder.prototype, 'parent', {get() { return new Folder(this.fsName.replace(/\/[^/]*$/, '')); }});
Folder.prototype.create = function () { if (!disk.has(this.parent.fsName)) return false; disk.add(this.fsName); return true; };
Folder.userData = new Folder('/userdata');
Folder.desktop = new Folder('/desktop');
const psdBytes = ['texto-um-digito.psd', 'texto-dois-digitos.psd'].map(n => fs.readFileSync(nodePath.join(base, 'apps/photoshop/templates/textos-precos', n)).toString('latin1'));

const log = {opened: [], saved: [], closed: [], placed: []};
let failPlacement = false;
function makeDocument(file) {
    const f = fixtures.find(x => x.source.endsWith(file.fsName.split('/').pop()));
    const doc = {name: file.name, fullName: file, layers: f.children.map(makeLayer),
        width: new UnitValue(f.width), height: new UnitValue(f.height), guides: guideCollection(f.width === 597 ? [[25, 0], [25, 1], [572, 0], [459, 1]] : [[25, 0], [681, 0], [25, 1], [443, 1]])};
    doc.activeLayer = doc.layers[0];
    doc.resizeCanvas = function (w, h) { this.width = w; this.height = h; };
    doc.saveAs = function (target, options) {
        assert.equal(options.layers, true);
        log.saved.push({path: target.fsName, doc: this}); disk.add(target.fsName);
    };
    doc.close = function (mode) { log.closed.push(mode); context.app.documents.splice(context.app.documents.indexOf(this), 1); };
    return doc;
}
function ActionDescriptor() { this.values = {}; }
ActionDescriptor.prototype.putPath = function (k, v) { this.values[k] = v; };
ActionDescriptor.prototype.putBoolean = function (k, v) { this.values[k] = v; };
ActionDescriptor.prototype.putEnumerated = function () {};
function executeAction(id, d) {
    assert.equal(id, 'Plc ');
    if (failPlacement) throw new Error('Formato não suportado');
    const doc = context.app.activeDocument;
    assert.equal(doc.activeLayer, doc.layers.at(-1), 'a imagem deve entrar logo acima da camada do fundo');
    const layer = makeLayer({name: 'placed', kind: 'smartobject', visible: true, bbox: [0, 0, 1200, 800]});
    doc.layers.splice(doc.layers.length - 1, 0, layer);
    doc.activeLayer = layer;
    log.placed.push({file: d.values.null.fsName, linked: d.values.Lnkd === true, layer});
}

let uiAction = null;
function Control(type, text, props) {
    this.type = type; this.text = typeof text === 'string' ? text : ''; this.children = []; this.preferredSize = {}; this.items = [];
    this.properties = props || {};
    if (Array.isArray(text)) this.items = text.map((t, i) => ({text: t, index: i}));
}
Control.prototype.add = function (type, bounds, text, props) {
    if (type === 'item') { const it = {text, index: this.items.length}; this.items.push(it); return it; }
    const child = new Control(type, text, props); this.children.push(child); return child;
};
Control.prototype.removeAll = function () { this.items = []; };
Object.defineProperty(Control.prototype, 'selection', {get() { return this._sel; }, set(v) { this._sel = typeof v === 'number' ? {index: v} : v; }});
Control.prototype.center = function () {};
Control.prototype.show = function () { return uiAction ? uiAction(this) : 0; };
Control.prototype.close = function (n) { this.closed = n; };
function controls(root, type) { return root.children.flatMap(c => (c.type === type ? [c] : []).concat(controls(c, type))); }
function button(root, text) { return controls(root, 'button').find(b => b.text === text); }

const alerts = [];
const context = {
    app: {preferences: {rulerUnits: 'MM'}, displayDialogs: 'ALL', documents: [], activeDocument: null,
        fonts: {getByName(name) { assert.equal(name, 'SFPro-CondensedSemibold'); return {}; }},
        open(file) {
            assert.ok(file.exists, 'abriu arquivo inexistente');
            assert.equal(contents.get(file.fsName), psdBytes[file.fsName.endsWith('dois-digitos.psd') ? 1 : 0], 'abriu um modelo diferente da referência');
            log.opened.push(file.fsName);
            const doc = makeDocument(file); this.documents.push(doc); this.activeDocument = doc; return doc;
        }},
    UnitValue, File, Folder, ActionDescriptor, executeAction, charIDToTypeID: s => s,
    PhotoshopSaveOptions: function () {}, Extension: {LOWERCASE: 'lower'}, SaveOptions: {DONOTSAVECHANGES: 'no'},
    LayerKind: {TEXT: 'TEXT'}, AnchorPosition: {TOPLEFT: 'TOPLEFT', MIDDLECENTER: 'MIDDLECENTER'},
    Direction: {VERTICAL: 'VERTICAL', HORIZONTAL: 'HORIZONTAL'}, Units: {PIXELS: 'PX'}, DialogModes: {NO: 'NO'},
    Window: function (type, title) { return new Control('window', title); },
    alert(msg) { alerts.push(String(msg)); }, confirm: () => true, $: {global: {}, fileName: '/repo/apps/photoshop/scripts/criar-textos-precos.jsx'}
};
const marker = '    try {\n        run(initialState());';
assert.equal(source.split(marker).length, 2);
vm.runInNewContext(source.replace(marker, '    this.API = {layouts:LAYOUTS, parseData:parseData, autoFileName:autoFileName, safeFileName:safeFileName, create:create, dialog:dialog, run:run, initialState:initialState, bounds:bounds, readGuides:readGuides, layoutIndexFor:layoutIndexFor, templateBytes:templateBytes, templateFile:templateFile};\n    return;\n' + marker), context);
const A = context.API;

let passed = 0;
function test(name, run) {
    log.opened = []; log.saved = []; log.closed = []; log.placed = []; alerts.length = 0; uiAction = null; failPlacement = false;
    context.app.documents.length = 0;
    run(); passed++; console.log('PASS ' + name);
}
function near(actual, expected, tolerance = 0.02) {
    assert.equal(actual.length, expected.length);
    actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < tolerance, JSON.stringify({actual, expected})));
}
function checkGeometry(doc, index) {
    const expected = fixtures[index];
    assert.equal(doc.width.value ?? doc.width, expected.width);
    function walk(actual, list) {
        list.forEach(e => {
            const a = actual.find(l => l.name === e.name);
            assert.ok(a, 'faltou a camada ' + e.name);
            if (e.kind === 'type' || e.kind === 'shape') near(A.bounds(a), e.bbox);
            if (e.children) walk(a.layers, e.children);
        });
    }
    walk(doc.layers, expected.children);
}
function fields(extra = {}) {
    return Object.assign({product: 'Lorem ipsum\ndolor sit amet', de: '', por: '9,99', unitDe: 'UN', unitPor: 'UN', labelDe: 'DE\nR$', labelPor: 'POR\nR$'}, extra);
}
function job(index, extra = {}, data = {}) {
    return Object.assign({layout: A.layouts[index], layoutIndex: index, data: A.parseData(A.layouts[index], fields(data)),
        file: new File('/saida/teste.psd'), images: [], linked: false, fit: 0, keepOpen: false}, extra);
}

test('Script compila e traz os dois PSDs de referência byte a byte, sem base64', () => {
    new vm.Script(source);
    assert.doesNotMatch(source, /decode64|base64|templates\/textos-precos|selectDialog\("Pasta com/);
    assert.equal(A.templateBytes(0), psdBytes[0]); assert.equal(A.templateBytes(1), psdBytes[1]);
});
test('Modelo embutido é gravado uma vez e reaproveitado; cópia corrompida é regravada', () => {
    templateWrites = 0;
    const f = A.templateFile(1);
    assert.equal(f.fsName, MODEL_DIR + '/texto-dois-digitos.psd'); assert.equal(contents.get(f.fsName), psdBytes[1]);
    A.templateFile(1); assert.equal(templateWrites, 1, 'não deve regravar um modelo íntegro');
    contents.set(f.fsName, psdBytes[1].slice(0, -1) + 'x');
    A.templateFile(1); assert.equal(templateWrites, 2); assert.equal(contents.get(f.fsName), psdBytes[1]);
});
test('Modelo escolhido pelo preço: dois dígitos em DE ou POR usa o modelo largo', () => {
    assert.equal(A.layoutIndexFor('', '9,99'), 0); assert.equal(A.layoutIndexFor('12,90', '9,99'), 1);
    assert.equal(A.layoutIndexFor('', 'R$ 10'), 1); assert.equal(A.layoutIndexFor('', '09,90'), 0);
});
test('Dados: unidades UN e /KG, rótulos editáveis e validação de preço', () => {
    const d = A.parseData(A.layouts[1], fields({de: 'R$ 29,9', por: '8.5', unitDe: 'kg', unitPor: 'un', labelPor: 'SÓ\nR$'}));
    assert.equal(d.de.integer, '29'); assert.equal(d.de.cents, ',90'); assert.equal(d.por.cents, ',50');
    assert.equal(d.unitDe, '/KG'); assert.equal(d.unitPor, 'UN');
    assert.equal(d.labelDe, 'DE\rR$\r'); assert.equal(d.labelPor, 'SÓ\rR$\r');
    assert.throws(() => A.parseData(A.layouts[0], fields({por: '19,90'})), /Dois dígitos/);
    assert.throws(() => A.parseData(A.layouts[0], fields({product: '  '})), /nome do produto/);
    assert.throws(() => A.parseData(A.layouts[0], fields({labelPor: ''})), /rótulo POR/);
});
test('Nome do arquivo: sugestão automática e caracteres proibidos', () => {
    assert.equal(A.autoFileName('Arroz Tipo 1\n5 kg', '19,9'), 'Arroz Tipo 1 5 kg 19,90');
    assert.equal(A.safeFileName('Feijão: 1/2 kg?.psd'), 'Feijão 1 2 kg');
    assert.equal(A.autoFileName('', ''), 'texto-preco');
});
test('Arquivo novo sai do modelo certo, com a geometria original, e o modelo não é regravado', () => {
    A.create(job(1, {}, {de: '99,99', por: '99,99', unitDe: '/KG', unitPor: '/KG'}));
    assert.deepEqual(log.opened, [MODEL_DIR + '/texto-dois-digitos.psd']);
    assert.deepEqual(log.saved.map(s => s.path), ['/saida/teste.psd']);
    assert.deepEqual(log.closed, ['no']);
    const doc = log.saved[0].doc;
    assert.equal(doc.width.value, 706); assert.equal(doc.height.value, 468);
    checkGeometry(doc, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(A.readGuides(doc))).sort(), [[25, 0], [25, 1], [681, 0], [443, 1]].sort());
    assert.equal(context.app.preferences.rulerUnits, 'MM'); assert.equal(context.app.displayDialogs, 'ALL');
});
test('Unidade /KG e UN alternam as camadas do modelo', () => {
    A.create(job(0, {}, {de: '8,90', por: '7,49', unitDe: 'UN', unitPor: '/KG'}));
    const doc = log.saved[0].doc, norm = doc.layers.find(l => l.name === 'VALOR NORM'), prom = doc.layers.find(l => l.name === 'VALOR PROM');
    const get = (g, n) => g.layers.find(l => l.name === n);
    assert.equal(get(norm, 'UN').visible, true); assert.equal(get(norm, '/KG').visible, false);
    assert.equal(get(prom, 'UN').visible, false); assert.equal(get(prom, '/KG').visible, true);
    assert.equal(get(prom, 'VALOR PROM').text, '7'); assert.equal(get(prom, 'VALOR PROM CENT').text, ',49');
});
test('Imagens incorporadas e vinculadas entram atrás dos textos e ajustadas à tela', () => {
    A.create(job(0, {images: [new File('/fotos/arroz.png')], linked: false, fit: 0}));
    A.create(job(0, {images: [new File('/fotos/feijao.jpg')], linked: true, fit: 1}));
    assert.deepEqual(log.placed.map(p => p.linked), [false, true]);
    const contain = log.placed[0].layer, cover = log.placed[1].layer;
    assert.equal(contain.name, 'IMAGEM - arroz'); assert.equal(cover.name, 'IMAGEM - feijao');
    near(A.bounds(contain), [0, (484 - 398) / 2, 597, (484 - 398) / 2 + 398], 0.5);
    near(A.bounds(cover), [(597 - 726) / 2, 0, (597 - 726) / 2 + 726, 484], 0.5);
    const doc = log.saved[0].doc;
    assert.equal(doc.layers.at(-2), contain, 'imagem logo acima do preenchimento e abaixo dos textos');
});
test('Falha ao colocar imagem fecha a cópia sem salvar', () => {
    failPlacement = true;
    assert.throws(() => A.create(job(0, {images: [new File('/fotos/arroz.png')]})), /arroz\.png/);
    assert.deepEqual(log.saved, []); assert.deepEqual(log.closed, ['no']);
    assert.equal(context.app.preferences.rulerUnits, 'MM');
});
test('Modelo aberto no Photoshop não é tocado', () => {
    context.app.documents.push({fullName: new File(MODEL_DIR + '/texto-um-digito.psd')});
    assert.throws(() => A.create(job(0)), /Feche o arquivo/);
    assert.deepEqual(log.opened, []);
});
// edittext na ordem: produto, DE, outra DE, rótulo DE, POR, outra POR, rótulo POR, nome do arquivo.
test('Janela abre pronta: pasta na Área de Trabalho, UN marcado e sem pedir modelo', () => {
    uiAction = root => {
        assert.equal(controls(root, 'button').some(b => /Modelos|modelo/i.test(b.text)), false);
        const texts = controls(root, 'statictext').map(t => t.text);
        assert.ok(texts.includes('/desktop')); assert.ok(texts.some(t => /um dígito — 597 × 484/.test(t)));
        const radios = controls(root, 'radiobutton');
        assert.deepEqual(radios.slice(0, 3).map(r => r.value), [true, false, false]);
        assert.equal(controls(root, 'edittext')[2].enabled, false, 'campo Outra desligado com UN');
        button(root, 'Fechar').onClick(); return 0;
    };
    A.run(A.initialState());
});
test('Salvar e criar outro: janela volta com os dados, sem as imagens, e grava vários arquivos', () => {
    let round = 0;
    uiAction = root => {
        round++;
        const inputs = controls(root, 'edittext'), radios = controls(root, 'radiobutton');
        if (round === 1) {
            inputs[0].text = 'Arroz Tipo 1\n5 kg'; inputs[0].onChanging();
            inputs[4].text = '19,90'; inputs[4].onChanging();
            assert.equal(inputs[7].text, 'Arroz Tipo 1 5 kg 19,90', 'nome automático acompanha produto e preço');
            assert.ok(controls(root, 'statictext').some(t => /dois dígitos — 706 × 468/.test(t.text)), 'modelo acompanha o preço');
            radios[3].value = false; radios[4].value = true; radios[4].onClick();
            radios[6].value = false; radios[7].value = true;
            button(root, 'Salvar e criar outro').onClick();
        } else if (round === 2) {
            assert.match(controls(root, 'statictext')[0].text, /Salvo: Arroz Tipo 1 5 kg 19,90\.psd/);
            assert.equal(controls(root, 'listbox')[0].items.length, 0, 'imagens limpas para o próximo');
            assert.equal(inputs[0].text, 'Arroz Tipo 1\n5 kg', 'dados mantidos');
            assert.equal(radios[4].value, true, '/KG mantido'); assert.equal(radios[7].value, true, 'modo vinculado mantido');
            inputs[0].text = 'Feijão'; inputs[0].onChanging();
            inputs[7].text = 'meu-nome'; inputs[7].onChanging();
            inputs[0].text = 'Feijão Carioca'; inputs[0].onChanging();
            assert.equal(inputs[7].text, 'meu-nome', 'nome digitado não é sobrescrito');
            radios[4].value = false; radios[5].value = true; radios[5].onClick();
            assert.equal(inputs[5].enabled, true); inputs[5].text = 'cx';
            button(root, 'Salvar e fechar').onClick();
        } else throw new Error('janela reaberta depois de Salvar e fechar');
        return root.closed;
    };
    const state = A.initialState();
    state.output = new Folder('/saida');
    assert.equal(A.run(state), 2);
    assert.deepEqual(log.saved.map(s => s.path), ['/saida/Arroz Tipo 1 5 kg 19,90.psd', '/saida/meu-nome.psd']);
    assert.deepEqual(log.opened, [MODEL_DIR + '/texto-dois-digitos.psd', MODEL_DIR + '/texto-dois-digitos.psd']);
    const prom = log.saved[1].doc.layers.find(l => l.name === 'VALOR PROM');
    assert.equal(prom.layers.find(l => l.name === 'UN').text, 'CX');
    assert.deepEqual(alerts, []);
});
test('Erro de dados mantém a janela aberta; erro ao gravar volta com os mesmos dados', () => {
    let round = 0;
    uiAction = root => {
        round++;
        const inputs = controls(root, 'edittext');
        if (round === 1) {
            inputs[4].text = '9,999';
            button(root, 'Salvar e criar outro').onClick();
            assert.equal(root.closed, undefined); assert.match(alerts[0], /preço POR/);
            inputs[4].text = '9,90';
            button(root, 'Salvar e criar outro').onClick();
            assert.equal(root.closed, 1);
            failPlacement = true;
            return 1;
        }
        assert.match(controls(root, 'statictext')[0].text, /não foi salvo/);
        assert.equal(inputs[4].text, '9,90');
        button(root, 'Fechar').onClick();
        return 0;
    };
    const state = A.initialState();
    state.output = new Folder('/saida');
    state.images = [new File('/fotos/arroz.png')];
    assert.equal(A.run(state), 0);
    assert.deepEqual(log.saved, []);
    assert.match(alerts[1], /Nada foi salvo/);
});
test('Fechar sem salvar não abre nem grava nada', () => {
    uiAction = root => { button(root, 'Fechar').onClick(); return 0; };
    assert.equal(A.run(A.initialState()), 0);
    assert.deepEqual(log.opened, []); assert.deepEqual(log.saved, []);
});

console.log(JSON.stringify({passed, bytes: fs.statSync(path).size, nativePhotoshopTest: false,
    note: 'Geometria comparada com os PSDs de referência. Photoshop, Place e disco simulados.'}, null, 2));
