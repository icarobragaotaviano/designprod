/** Testes do gerador v1 histórico; o Photoshop é simulado. Uso: npm run test:textos. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const os = require('node:os');

const base = path.resolve(__dirname, '..');
const sourcePath = path.join(base, 'historico/photoshop/gerar-textos-precos-v1.jsx');
const source = fs.readFileSync(sourcePath, 'utf8').replace(/^\uFEFF/, '').replace(/^#target[^\n]*\n/, '');
new vm.Script(source);
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/textos-precos-modelos.json')))
    .map(fixture => ({...fixture, source: path.join(base, fixture.source)}));
const qa = fs.mkdtempSync(path.join(os.tmpdir(), 'ibd-textos-precos-'));
process.on('exit', () => fs.rmSync(qa, {recursive: true, force: true}));
fs.mkdirSync(qa + '/tmp');
fs.mkdirSync(qa + '/out');

function physical(input) { return decodeURI(typeof input === 'string' ? input : input.fullName); }
function File(input) { this.path = path.resolve(physical(input)); this.error = ''; }
Object.defineProperties(File.prototype, {
    fullName: {get() { return encodeURI(this.path); }},
    fsName: {get() { return this.path; }},
    name: {get() { return encodeURI(path.basename(this.path)); }},
    parent: {get() { return new Folder(path.dirname(this.path)); }},
    exists: {get() { return fs.existsSync(this.path) && fs.statSync(this.path).isFile(); }}
});
File.decode = decodeURI;
File.prototype.open = function(mode) {
    try { this.mode = mode; if (mode === 'w') fs.writeFileSync(this.path, ''); else fs.accessSync(this.path); return true; }
    catch (e) { this.error = e.message; return false; }
};
File.prototype.write = function(bytes) { assert.equal(this.encoding, 'BINARY'); fs.appendFileSync(this.path, Buffer.from(bytes, 'latin1')); return true; };
File.prototype.read = function() { assert.equal(this.encoding, 'BINARY'); return fs.readFileSync(this.path).toString('latin1'); };
File.prototype.close = function() { return true; };
File.prototype.remove = function() { if (this.exists) fs.unlinkSync(this.path); return true; };
File.prototype.rename = function(name) {
    const target = path.join(path.dirname(this.path), decodeURI(name));
    if (fs.existsSync(target)) return false;
    fs.renameSync(this.path, target); this.path = target; return true;
};
function Folder(input) { this.path = path.resolve(physical(input)); }
Object.defineProperties(Folder.prototype, {
    fullName: {get() { return encodeURI(this.path); }},
    fsName: {get() { return this.path; }},
    exists: {get() { return fs.existsSync(this.path) && fs.statSync(this.path).isDirectory(); }}
});
Folder.prototype.create = function() { fs.mkdirSync(this.path, {recursive: true}); return true; };
Folder.prototype.remove = function() { if (this.exists) fs.rmdirSync(this.path); return true; };
Folder.temp = new Folder(qa + '/tmp');
Folder.desktop = new Folder(qa + '/out');
function UnitValue(value, unit) { this.value = value; this.unit = unit; this.as = () => value; }

function makeLayer(fixture) {
    const layer = {name: fixture.name, visible: fixture.visible, kind: fixture.kind === 'type' ? 'TEXT' : fixture.kind,
        typename: fixture.kind === 'group' ? 'LayerSet' : 'ArtLayer', box: [...fixture.bbox]};
    Object.defineProperty(layer, 'bounds', {get() { return this.box.map(n => new UnitValue(n, 'px')); }});
    layer.translate = function(x,y) { this.box = [this.box[0]+x.value, this.box[1]+y.value, this.box[2]+x.value, this.box[3]+y.value]; };
    layer.resize = function(x, y, anchor) { assert.equal(anchor, 'BOTTOMRIGHT'); this.box[0] = this.box[2]-(this.box[2]-this.box[0])*x/100; this.box[1] = this.box[3]-(this.box[3]-this.box[1])*y/100; };
    if (fixture.kind === 'type') {
        layer.text = fixture.text;
        layer.textItem = {};
        Object.defineProperty(layer.textItem, 'contents', {
            get() { return layer.text; },
            set(value) {
                const ratio = value.length / layer.text.length;
                layer.box[2] = layer.box[0] + (layer.box[2] - layer.box[0]) * ratio;
                layer.text = value;
                layer.name = value; // Emulate Photoshop automatic layer renaming.
            }
        });
    }
    if (fixture.children) layer.layers = fixture.children.map(makeLayer);
    return layer;
}

let failSave = false;
let failOpen = false;
const previousDocument = {name: 'Documento do usuario', closed: false};
const app = {documents: [previousDocument], activeDocument: previousDocument, displayDialogs: 'ORIGINAL', fonts: [{postScriptName: 'SFPro-CondensedSemibold'}]};
function snapshot(layer) { return {name: layer.name, text: layer.text, visible: layer.visible, children: layer.layers && layer.layers.map(snapshot)}; }
app.open = function(file) {
    if (failOpen) throw new Error('Simulated open failure');
    const index = file.fsName.includes('DOIS') ? 1 : 0;
    const doc = {layers: fixtures[index].children.map(makeLayer)};
    doc.saveAs = function(output, options, asCopy, extension) {
        if (failSave) throw new Error('Simulated native save failure');
        assert.equal(options.layers, true);
        assert.equal(options.alphaChannels, true);
        assert.equal(options.embedColorProfile, false);
        assert.equal(asCopy, false);
        assert.equal(extension, 'LOWERCASE');
        // A DOM simulation fixture, NOT a Photoshop-rendered PSD.
        fs.writeFileSync(output.fsName, Buffer.concat([fs.readFileSync(fixtures[index].source).subarray(0, 26), Buffer.from(JSON.stringify(doc.layers.map(snapshot)))]));
    };
    doc.close = function() { this.closed = true; app.documents.splice(app.documents.indexOf(this), 1); app.activeDocument = previousDocument; };
    app.documents.push(doc); app.activeDocument = doc;
    return doc;
};

let uiAction = null;
function Control(type, text, root) {
    this.type = type; this.text = text; this.children = []; this.root = root || this;
    this.layout = {layout() {}};
}
Control.prototype.add = function(type, bounds, text) { const c = new Control(type, text, this.root); this.children.push(c); return c; };
Object.defineProperty(Control.prototype, 'selection', {
    get() { return this._selection; },
    set(value) { this._selection = typeof value === 'number' ? {index: value} : value; }
});
Control.prototype.center = function() {};
Control.prototype.show = function() { if (uiAction) uiAction(this); return this.closed; };
Control.prototype.close = function(code) { this.closed = code; };
function Window() { return new Control('window'); }
function controls(root, type) { return root.children.flatMap(c => (c.type === type ? [c] : []).concat(controls(c, type))); }
const alerts = [];
const context = {File, Folder, UnitValue, Window, app, LayerKind: {TEXT: 'TEXT'}, AnchorPosition: {BOTTOMRIGHT: 'BOTTOMRIGHT'},
    DialogModes: {ALL: 'ALL', NO: 'NO'}, Extension: {LOWERCASE: 'LOWERCASE'}, SaveOptions: {DONOTSAVECHANGES: 'DONT'},
    PhotoshopSaveOptions: function() {}, ScriptUI: {newImage(file) { return file; }}, alert(message) { alerts.push(message); }};
const marker = '    try {\n        try { app.bringToFront();';
assert.equal(source.split(marker).length, 2);
const instrumented = source.replace(marker, `    this.API = {MODELS: MODELS, decode64: decode64, crc32: crc32, parseFields: parseFields, originalFields: originalFields, generate: generate, generateCustomized: generateCustomized, applyFields: applyFields, directLayer: directLayer, boundsPx: boundsPx, chooseModel: chooseModel};\n    return;\n${marker}`);
vm.runInNewContext(instrumented, context);
const A = context.API;
let passed = 0;
function test(name, run) { run(); passed++; console.log('PASS ' + name); }
const out = new Folder(qa + '/out');

test('Complete historical JSX compiles and retains embedded templates', () => assert.ok(source.length > 900000));
test('Binary decoder padding and malformed data', () => {
    assert.equal(A.decode64('TQ=='), 'M'); assert.equal(A.decode64('TWE='), 'Ma'); assert.equal(A.decode64('TWFu'), 'Man');
    for (const invalid of ['A===', '====', 'TQ=a', 'TQ==AAAA', 'TR==']) assert.throws(() => A.decode64(invalid));
    assert.equal(A.crc32('123456789'), 0xcbf43926);
});
for (let i = 0; i < 2; i++) test('Embedded model ' + (i+1) + ' matches every original byte and SHA-256', () => {
    const bytes = Buffer.from(A.decode64(A.MODELS[i].psd), 'latin1');
    assert.deepEqual(bytes, fs.readFileSync(fixtures[i].source));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), A.MODELS[i].sha256);
    const saved = A.generate(A.MODELS[i], out);
    assert.deepEqual(fs.readFileSync(saved.fsName), bytes);
});
test('Generating twice preserves earlier files and numbers the new copy', () => {
    const path1 = path.join(out.fsName, 'TEXTO UM DIGITO.psd');
    const old = fs.readFileSync(path1);
    const second = A.generate(A.MODELS[0], out);
    assert.equal(path.basename(second.fsName), 'TEXTO UM DIGITO - 02.psd');
    assert.deepEqual(fs.readFileSync(path1), old);
});
test('Portuguese prices, dot input, zeros and independent units', () => {
    const f = A.parseFields(A.MODELS[1], 'R$ 29,9', '8.50', 'kg', 'cx');
    assert.equal(f.de.text, '29,90'); assert.equal(f.por.text, '8,50'); assert.equal(f.unitDe, '/KG'); assert.equal(f.unitPor, 'CX');
    assert.equal(A.parseFields(A.MODELS[0], '', '0', '', 'L').por.text, '0,00');
    assert.equal(A.parseFields(A.MODELS[0], '', '0', '', 'L').unitPor, '/L');
});
test('Rejects prices exceeding the selected model and malformed inputs', () => {
    for (const value of ['12,50', '-1,00', '1,999', '99,999', 'abc', '100,00', '']) assert.throws(() => A.parseFields(A.MODELS[0], '', value, '', 'UN'));
    assert.throws(() => A.parseFields(A.MODELS[1], '20', '19', 'UN', ''));
    assert.throws(() => A.parseFields(A.MODELS[1], '', '19', '', 'UNIT LONG'));
});
test('Native layer mapping is scoped by price group; names and anchors stay stable', () => {
    const doc = {layers: fixtures[1].children.map(makeLayer)};
    const oldGroup = A.directLayer(doc, 'VALOR NORM', true), promoGroup = A.directLayer(doc, 'VALOR PROM', true);
    const integer = A.directLayer(promoGroup, 'VALOR PROM', false), cents = A.directLayer(promoGroup, 'VALOR PROM CENT', false);
    const right = integer.box[2], centsLeft = cents.box[0];
    A.applyFields(doc, A.parseFields(A.MODELS[1], '29,90', '8,50', '/KG', 'UN'));
    assert.equal(A.directLayer(oldGroup, 'VALOR PROM', false).text, '29');
    assert.equal(integer.text, '8'); assert.equal(integer.name, 'VALOR PROM'); assert.equal(integer.box[2], right);
    assert.equal(cents.text, ',50'); assert.equal(cents.box[0], centsLeft);
    assert.equal(A.directLayer(oldGroup, '/KG', false).visible, true);
    assert.equal(A.directLayer(promoGroup, '/KG', false).visible, false);
    assert.equal(A.directLayer(promoGroup, 'UN', false).visible, true);
    assert.equal(A.directLayer(doc, 'PRODUTO', false).text, fixtures[1].children.at(-1).text);
    assert.equal(A.directLayer(doc, 'Preenchimento de Cor 1', false).visible, false);
});
test('Empty DE hides the complete old-price group and its strike', () => {
    const doc = {layers: fixtures[0].children.map(makeLayer)};
    A.applyFields(doc, A.parseFields(A.MODELS[0], '', '8,90', '', 'UN'));
    assert.equal(A.directLayer(doc, 'VALOR NORM', true).visible, false);
    assert.equal(A.directLayer(doc, 'VALOR PROM', true).visible, true);
});
test('Custom units stay within the unit area and keep editable layer names', () => {
    const doc = {layers: fixtures[1].children.map(makeLayer)};
    const group = A.directLayer(doc, 'VALOR PROM', true), unit = A.directLayer(group, 'UN', false);
    const reference = [...unit.box];
    A.applyFields(doc, A.parseFields(A.MODELS[1], '', '19,90', '', 'PACOTE'));
    assert.equal(unit.text, 'PACOTE'); assert.equal(unit.name, 'UN');
    assert.ok(unit.box[0] >= reference[0] - 0.001); assert.ok(unit.box[1] >= reference[1] - 0.001);
    assert.ok(Math.abs(unit.box[2] - reference[2]) < 0.001); assert.ok(Math.abs(unit.box[3] - reference[3]) < 0.001);
});
test('Customized flow invokes native saving with layers and restores application state (DOM simulation)', () => {
    const choice = {model: A.MODELS[1], folder: out, fields: A.parseFields(A.MODELS[1], '29,90', '19,90', '/KG', 'UN')};
    const output = A.generateCustomized(choice);
    const body = JSON.parse(fs.readFileSync(output.fsName).subarray(26));
    const promo = body.find(l => l.name === 'VALOR PROM');
    assert.equal(promo.children.find(l => l.name === 'VALOR PROM').text, '19');
    assert.equal(promo.children.find(l => l.name === 'VALOR PROM CENT').text, ',90');
    assert.equal(app.displayDialogs, 'ORIGINAL'); assert.equal(app.activeDocument, previousDocument); assert.equal(app.documents.length, 1);
    assert.deepEqual(fs.readdirSync(Folder.temp.fsName), []);
});
test('Native save failure publishes no file and preserves the user document (DOM simulation)', () => {
    const before = fs.readdirSync(out.fsName);
    failSave = true;
    assert.throws(() => A.generateCustomized({model: A.MODELS[0], folder: out, fields: A.parseFields(A.MODELS[0], '', '8,90', '', 'UN')}), /native save failure/);
    failSave = false;
    assert.deepEqual(fs.readdirSync(out.fsName), before);
    assert.equal(app.documents.length, 1); assert.equal(app.activeDocument, previousDocument); assert.equal(app.displayDialogs, 'ORIGINAL');
    assert.deepEqual(fs.readdirSync(Folder.temp.fsName), []);
});
test('Missing source font blocks edits before publishing', () => {
    const fonts = app.fonts; app.fonts = [];
    assert.throws(() => A.generateCustomized({model: A.MODELS[0], folder: out, fields: A.parseFields(A.MODELS[0], '', '8,90', '', 'UN')}), /SF Pro/);
    app.fonts = fonts;
});
test('Default fields take the exact-original path without native editing', () => {
    failOpen = true;
    const model = A.MODELS[1];
    const file = A.generateCustomized({model, folder: out, fields: A.parseFields(model, '99,99', '99,99', '/KG', '/KG')});
    assert.deepEqual(fs.readFileSync(file.fsName), fs.readFileSync(fixtures[1].source));
    failOpen = false;
});
test('Dialog controls pass selected model, DE/POR and independent units to generation', () => {
    uiAction = root => {
        const selector = controls(root, 'dropdownlist')[0]; selector.selection = 1; selector.onChange();
        const inputs = controls(root, 'edittext');
        ['29,90', '/KG', '19,90', 'UN'].forEach((value, i) => { inputs[i].text = value; });
        controls(root, 'button').find(c => c.text === 'Gerar PSD').onClick();
        assert.equal(root.closed, 1);
    };
    const chosen = A.chooseModel();
    assert.equal(chosen.model.digits, 2); assert.equal(chosen.fields.de.text, '29,90'); assert.equal(chosen.fields.por.text, '19,90');
    assert.equal(chosen.fields.unitDe, '/KG'); assert.equal(chosen.fields.unitPor, 'UN');
});
test('Invalid dialog values keep the window open instead of generating', () => {
    uiAction = root => {
        controls(root, 'edittext')[2].text = '123,45';
        controls(root, 'button').find(c => c.text === 'Gerar PSD').onClick();
        assert.equal(root.closed, undefined);
    };
    assert.equal(A.chooseModel(), null);
    assert.match(alerts.at(-1), /inválido/);
});

const report = {passed, nativePhotoshopRun: false, sourceScript: sourcePath, scriptSha256: crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'),
    note: 'Original payloads and binary file generation verified byte for byte. UI and text editing tested with DOM simulations; not a native Photoshop rendering test.'};
console.log(JSON.stringify(report, null, 2));
