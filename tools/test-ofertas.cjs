/**
 * Testes do gerador de ofertas preto e dourado com o Photoshop simulado.
 *
 * O JSX roda inteiro em Node, contra um DOM simulado: camadas, grupos,
 * seleções poligonais, textos com métricas aproximadas, objetos
 * inteligentes, descritores Grdn/Plc e ScriptUI. Verifica encaixe,
 * alinhamento, estrutura, reedição, resolução e limpeza.
 *
 * Não é execução nativa: a fonte real, o rasterizador e o comportamento
 * do Photoshop não são reproduzidos. Onde o DOM real é ambíguo, a
 * simulação escolhe a leitura mais desfavorável ao script.
 *
 * Uso: npm run test:ofertas
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const base = path.resolve(__dirname, '..');
const scriptPath = path.join(base, 'apps/photoshop/scripts/gerar-ofertas-preto-dourado.jsx');
const raw = fs.readFileSync(scriptPath, 'utf8').replace(/^﻿/, '');
const code = raw.replace(/^#target[^\n]*$/m, '');
const version = (/@ibd-versao\s+(\S+)/.exec(raw) || [])[1];

const results = [];
function test(name, fn) {
    try { fn(); results.push({name, ok: true}); }
    catch (e) { results.push({name, ok: false, error: e.stack}); }
}

/* Enumerações: membro desconhecido é erro, para pegar nome digitado errado. */
function enumeration(name, members) {
    const o = {};
    for (const m of members) o[m] = `${name}.${m}`;
    return new Proxy(o, {get(t, k) {
        if (typeof k !== 'string' || k in t) return t[k];
        throw new Error(`${name}.${k} não simulado`);
    }});
}
const Units = enumeration('Units', ['PIXELS', 'CM', 'MM', 'INCHES', 'POINTS', 'PERCENT']);
const TypeUnits = enumeration('TypeUnits', ['PIXELS', 'POINTS', 'MM']);
const DialogModes = enumeration('DialogModes', ['NO', 'ALL', 'ERROR']);
const LayerKind = enumeration('LayerKind', ['NORMAL', 'TEXT', 'SMARTOBJECT']);
const TextType = enumeration('TextType', ['POINTTEXT', 'PARAGRAPHTEXT']);
const Justification = enumeration('Justification', ['LEFT', 'CENTER', 'RIGHT']);
const AntiAlias = enumeration('AntiAlias', ['SHARP', 'CRISP', 'STRONG', 'SMOOTH', 'NONE']);
const ElementPlacement = enumeration('ElementPlacement', ['INSIDE', 'PLACEATBEGINNING', 'PLACEATEND', 'PLACEBEFORE', 'PLACEAFTER']);
const AnchorPosition = enumeration('AnchorPosition', ['TOPLEFT', 'MIDDLECENTER', 'BOTTOMRIGHT']);
const SelectionType = enumeration('SelectionType', ['REPLACE', 'DIMINISH', 'EXTEND', 'INTERSECT']);
const NewDocumentMode = enumeration('NewDocumentMode', ['RGB', 'CMYK', 'GRAYSCALE']);
const DocumentFill = enumeration('DocumentFill', ['TRANSPARENT', 'WHITE', 'BACKGROUNDCOLOR']);
const BitsPerChannelType = enumeration('BitsPerChannelType', ['EIGHT', 'SIXTEEN']);
const SaveOptions = enumeration('SaveOptions', ['DONOTSAVECHANGES', 'SAVECHANGES', 'PROMPTTOSAVECHANGES']);
const ResampleMethod = enumeration('ResampleMethod', ['NONE', 'BICUBIC', 'BILINEAR', 'NEARESTNEIGHBOR']);

/* UnitValue com a base padrão do ExtendScript: 1 px = 1 pt = 1/72 pol. */
const TO_POINTS = {px: 1, pt: 1, cm: 72 / 2.54, mm: 72 / 25.4, in: 72};
class UnitValue {
    constructor(value, type) { this.value = Number(value); this.type = type; assert.ok(type in TO_POINTS, `unidade ${type}`); }
    as(type) { return this.value * TO_POINTS[this.type] / TO_POINTS[type]; }
}
function num(v) {
    if (v instanceof UnitValue) { assert.equal(v.type, 'px', 'coordenada fora de px'); return v.value; }
    assert.equal(typeof v, 'number'); assert.ok(Number.isFinite(v), 'coordenada inválida'); return v;
}

/* Métricas de uma fonte condensada genérica, em frações do corpo. */
const ACCENTED = 'ÁÀÂÃÉÊÍÓÔÕÚÜ';
function advance(ch) {
    if (ch === ' ') return 0.25;
    if (',.;:'.includes(ch)) return 0.22;
    if ('()/|'.includes(ch)) return 0.32;
    if ('MW'.includes(ch)) return 0.72;
    if ('I1'.includes(ch)) return 0.3;
    if (/[0-9]/.test(ch)) return 0.52;
    if (/[a-zà-ÿ]/.test(ch)) return 0.46;
    return 0.55;
}
function ascent(ch) {
    if (ch === ' ') return null;
    if (ACCENTED.includes(ch)) return 0.92;
    if ('()'.includes(ch)) return 0.8;
    if (',.'.includes(ch)) return 0.12;
    return 0.72;
}
function descent(ch) { return ',;QÇçgjpqy()'.includes(ch) ? 0.2 : 0; }

function pointInPolygon(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}
function union(a, b) { return !a ? b : !b ? a : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]; }

let nextId = 1;

function photoshop(options = {}) {
    let current = {};
    const log = {alerts: [], actions: [], closed: [], textSizesAt: [], dialogs: 0, prefWrites: 0};
    const images = new Map();
    const fontList = (options.fonts || [['Oswald SemiBold', 'Oswald-SemiBold'], ['Arial', 'ArialMT']])
        .map(([name, postScriptName]) => ({name, postScriptName}));
    const fonts = Object.assign(fontList.slice(), {
        getByName(n) { const f = fontList.find(x => x.postScriptName === n); if (!f) throw new Error('Fonte não encontrada'); return f; }
    });
    const prefs = {rulerUnits: options.rulerUnits || Units.CM, typeUnits: options.typeUnits || TypeUnits.PIXELS};
    const preferences = {};
    for (const k of Object.keys(prefs)) {
        Object.defineProperty(preferences, k, {get: () => prefs[k], set: v => { assert.ok(v, `${k} indefinido`); log.prefWrites++; prefs[k] = v; }});
    }
    let activeDoc = null;
    const documents = [];
    const app = {
        version: '27.0', preferences, fonts, displayDialogs: DialogModes.ALL,
        get documents() { return documents; },
        get activeDocument() { if (!activeDoc) throw new Error('Nenhum documento aberto'); return activeDoc; },
        set activeDocument(d) { assert.ok(documents.includes(d), 'documento fechado ou alheio'); activeDoc = d; }
    };

    class Layer {
        constructor(doc, typename, kind) {
            this.id = nextId++; this.doc = doc; this.typename = typename; this._kind = kind;
            this.name = typename === 'LayerSet' ? 'Grupo 1' : 'Camada 1';
            this.visible = true; this.opacity = 100; this.allLocked = false;
            this._parent = null; this.removed = false;
            this.T = {kx: 1, ky: 1, tx: 0, ty: 0}; this.ops = []; this.image = null; this.text = null;
            if (typename === 'LayerSet') {
                this.children = [];
                this.artLayers = collection(doc, this, 'ArtLayer');
                this.layerSets = collection(doc, this, 'LayerSet');
            }
        }
        get parent() { return this._parent; }
        get layers() { assert.ok(this.children, 'layers em camada'); return this.children; }
        get kind() { return this._kind; }
        set kind(v) {
            this.alive();
            assert.equal(v, LayerKind.TEXT); assert.equal(this._kind, LayerKind.NORMAL); assert.equal(this.ops.length, 0, 'só camada vazia vira texto');
            this._kind = v; this.text = new TextItem(this);
        }
        get textItem() { assert.ok(this.text, `textItem em ${this.name}, que não é texto`); return this.text; }
        alive() { assert.ok(!this.removed, `camada removida: ${this.name}`); }
        leaves() { return this.children ? this.children.flatMap(c => c.leaves()) : [this]; }
        box() {
            if (this.children) return this.children.filter(c => c.visible).map(c => c.box()).reduce(union, null);
            const T = this.T, map = b => b && [b[0] * T.kx + T.tx, b[1] * T.ky + T.ty, b[2] * T.kx + T.tx, b[3] * T.ky + T.ty];
            if (this.text) return map(this.text.localBounds());
            if (this.image) return map([0, 0, this.image.w, this.image.h]);
            return map(this.ops.filter(o => o.type === 'fill').map(o => o.localBox).reduce(union, null));
        }
        get bounds() { this.alive(); return (this.box() || [0, 0, 0, 0]).map(n => new UnitValue(n, 'px')); }
        translate(dx, dy) {
            this.alive(); assert.ok(!this.allLocked, 'camada travada');
            const x = num(dx), y = num(dy);
            for (const l of this.leaves()) { l.T.tx += x; l.T.ty += y; }
        }
        resize(xp, yp, anchor) {
            this.alive(); assert.equal(anchor, AnchorPosition.TOPLEFT);
            const b = this.box(); assert.ok(b, `redimensionar camada vazia: ${this.name}`);
            const fx = xp / 100, fy = yp / 100;
            assert.ok(fx > 0 && fy > 0 && Number.isFinite(fx), 'escala inválida');
            for (const l of this.leaves()) {
                l.T.kx *= fx; l.T.ky *= fy;
                l.T.tx = b[0] + (l.T.tx - b[0]) * fx; l.T.ty = b[1] + (l.T.ty - b[1]) * fy;
            }
        }
        move(rel, where) {
            this.alive();
            const target = rel instanceof Doc ? rel : rel.doc;
            assert.equal(target, this.doc, 'move entre documentos');
            if (!(rel instanceof Doc)) rel.alive();
            for (let p = rel; p && !(p instanceof Doc); p = p._parent) assert.notEqual(p, this, 'grupo dentro de si mesmo');
            detach(this);
            let container, index;
            if (where === ElementPlacement.INSIDE) {
                // A documentação não diz se INSIDE vai ao topo ou à base: base.
                assert.equal(rel.typename, 'LayerSet', 'INSIDE exige grupo'); container = rel; index = rel.children.length;
            } else if (where === ElementPlacement.PLACEATBEGINNING || where === ElementPlacement.PLACEATEND) {
                assert.ok(rel instanceof Doc || rel.typename === 'LayerSet'); container = rel;
                index = where === ElementPlacement.PLACEATBEGINNING ? 0 : rel.children.length;
            } else if (where === ElementPlacement.PLACEBEFORE || where === ElementPlacement.PLACEAFTER) {
                container = rel._parent; index = container.children.indexOf(rel) + (where === ElementPlacement.PLACEAFTER ? 1 : 0);
            } else throw new Error(`posição ${where}`);
            attach(this, container, index);
        }
        remove() {
            this.alive(); assert.ok(!this.allLocked, `remover camada travada: ${this.name}`);
            const doc = this.doc;
            detach(this);
            assert.ok(doc.children.length > 0, 'o documento ficaria sem camadas');
            const gone = l => l === this || (l && l._parent && l._parent !== doc && gone(l._parent));
            const mark = l => { l.removed = true; if (l.children) l.children.forEach(mark); };
            mark(this);
            if (!doc._active || doc._active.removed || gone(doc._active)) doc._active = doc.children[0];
        }
        duplicate(rel, where) {
            this.alive();
            if (rel === undefined) {
                const copy = cloneLayer(this, this.doc);
                attach(copy, this._parent, this._parent.children.indexOf(this));
                this.doc._active = copy;
                return copy;
            }
            assert.ok(rel instanceof Doc, 'duplicate simulado só para documento');
            assert.equal(activeDoc, this.doc, 'duplicate exige o documento de origem ativo');
            assert.ok(where === ElementPlacement.PLACEATBEGINNING || where === ElementPlacement.PLACEATEND);
            const copy = cloneLayer(this, rel);
            attach(copy, rel, where === ElementPlacement.PLACEATBEGINNING ? 0 : rel.children.length);
            return copy;
        }
        addOp(type, parts, color) {
            const T = this.T, doc = this.doc;
            const local = ([x, y]) => [(x - T.tx) / T.kx, (y - T.ty) / T.ky];
            const polys = parts.map(p => ({mode: p.mode, poly: p.poly.map(local)}));
            const canvas = [...local([0, 0]), ...local([doc.w, doc.h])];
            let box = null;
            for (const p of polys) if (p.mode === 'add') {
                const xs = p.poly.map(q => q[0]), ys = p.poly.map(q => q[1]);
                box = union(box, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
            }
            if (box) box = [Math.max(box[0], canvas[0]), Math.max(box[1], canvas[1]), Math.min(box[2], canvas[2]), Math.min(box[3], canvas[3])];
            if (box && (box[2] <= box[0] || box[3] <= box[1])) box = null;
            this.ops.push({type, polys, canvas, color, localBox: box});
        }
        painted(X, Y) {
            const x = (X - this.T.tx) / this.T.kx, y = (Y - this.T.ty) / this.T.ky;
            let on = false;
            for (const op of this.ops) {
                const c = op.canvas;
                if (x < c[0] || y < c[1] || x > c[2] || y > c[3]) continue;
                let inside = false;
                for (const p of op.polys) if (pointInPolygon(x, y, p.poly)) inside = p.mode === 'add';
                if (inside) on = op.type === 'fill';
            }
            return on;
        }
    }

    class TextItem {
        constructor(layer) {
            this.layer = layer; this.kind = TextType.POINTTEXT; this._font = 'ArialMT';
            this.sizePx = 12 * layer.doc.resolution / 72; this.leadingPx = null; this._contents = '';
            this.useAutoLeading = true; this.color = null; this.justification = Justification.LEFT; this.antiAliasMethod = AntiAlias.SHARP;
        }
        get font() { return this._font; }
        set font(v) { assert.equal(typeof v, 'string'); this._font = v; }
        get size() { return new UnitValue(this.sizePx * 72 / this.layer.doc.resolution, 'pt'); }
        set size(v) {
            assert.ok(v instanceof UnitValue && v.type === 'pt', 'tamanho em pt');
            assert.equal(prefs.typeUnits, TypeUnits.POINTS, 'typeUnits precisa estar em pontos');
            assert.ok(v.value >= 0.01 && v.value <= 1296, `corpo fora do limite do Photoshop: ${v.value} pt`);
            log.textSizesAt.push(this.layer.doc.resolution);
            this.sizePx = v.value * this.layer.doc.resolution / 72;
        }
        get leading() { return new UnitValue((this.leadingPx || this.sizePx * 1.2) * 72 / this.layer.doc.resolution, 'pt'); }
        set leading(v) { assert.ok(v instanceof UnitValue && v.type === 'pt'); this.leadingPx = v.value * this.layer.doc.resolution / 72; }
        get position() { return [new UnitValue(this.layer.T.tx, 'px'), new UnitValue(this.layer.T.ty, 'px')]; }
        set position(v) { assert.ok(Array.isArray(v) && v.length === 2); this.layer.T.tx = num(v[0]); this.layer.T.ty = num(v[1]); }
        get contents() { return this._contents; }
        set contents(v) { this._contents = String(v); this.layer.name = this._contents.split('\r')[0] || ' '; }
        localBounds() {
            const lead = this.useAutoLeading || !this.leadingPx ? this.sizePx * 1.2 : this.leadingPx;
            let box = null;
            this._contents.split('\r').forEach((line, k) => {
                const y = k * lead; let x = 0;
                for (const ch of line) {
                    const w = advance(ch) * this.sizePx, a = ascent(ch);
                    if (a !== null) box = union(box, [x, y - a * this.sizePx, x + w, y + descent(ch) * this.sizePx]);
                    x += w;
                }
            });
            return box;
        }
    }

    class Selection {
        constructor(doc) { this.doc = doc; this.parts = []; }
        select(region, type, feather, antiAlias) {
            type = type || SelectionType.REPLACE;
            assert.ok(Array.isArray(region) && region.length >= 3, 'região com ao menos 3 pontos');
            const poly = Array.from(region, p => { assert.ok(Array.isArray(p) && p.length === 2); return [num(p[0]), num(p[1])]; });
            if (type === SelectionType.REPLACE) this.parts = [{mode: 'add', poly}];
            else if (type === SelectionType.EXTEND) this.parts.push({mode: 'add', poly});
            else if (type === SelectionType.DIMINISH) { assert.ok(this.parts.length, 'subtrair sem seleção'); this.parts.push({mode: 'sub', poly}); }
            else throw new Error(`tipo de seleção ${type}`);
        }
        deselect() { this.parts = []; }
        target() {
            const l = this.doc.activeLayer; l.alive();
            assert.equal(l.typename, 'ArtLayer', 'pintura em grupo'); assert.equal(l.kind, LayerKind.NORMAL, `pintura em ${l.kind}`);
            for (let p = l; p && !(p instanceof Doc); p = p._parent) assert.ok(p.visible, `alvo oculto: ${p.name}`);
            return l;
        }
        fill(c) {
            const whole = [{mode: 'add', poly: [[0, 0], [this.doc.w, 0], [this.doc.w, this.doc.h], [0, this.doc.h]]}];
            this.target().addOp('fill', this.parts.length ? this.parts : whole, c.rgb.hexValue);
        }
        clear() { assert.ok(this.parts.length, 'limpar sem seleção'); this.target().addOp('clear', this.parts, null); }
    }

    class Doc {
        constructor({name, width, height, resolution}) {
            this.id = nextId++; this.name = name; this.w = width; this.h = height; this.resolution = resolution;
            this.children = []; this._active = null; this.resizeLog = [];
            this.artLayers = collection(this, this, 'ArtLayer'); this.layerSets = collection(this, this, 'LayerSet');
            this.selection = new Selection(this);
        }
        get layers() { return this.children; }
        get width() { return ruler(this, this.w); }
        get height() { return ruler(this, this.h); }
        get activeLayer() { assert.ok(this._active, 'sem camada ativa'); return this._active; }
        set activeLayer(l) { l.alive(); assert.equal(l.doc, this); this._active = l; }
        duplicate(name, merged) {
            assert.equal(merged, false);
            const copy = new Doc({name, width: this.w, height: this.h, resolution: this.resolution});
            const map = new Map();
            copy.children = this.children.map(c => { const k = cloneLayer(c, copy, map); k._parent = copy; return k; });
            copy._active = map.get(this._active) || copy.children[0];
            documents.push(copy); activeDoc = copy;
            return copy;
        }
        close(option) {
            assert.equal(option, SaveOptions.DONOTSAVECHANGES);
            documents.splice(documents.indexOf(this), 1); log.closed.push(this);
            if (activeDoc === this) activeDoc = documents[documents.length - 1] || null;
        }
        resizeImage(width, height, resolution, method) {
            assert.equal(width, undefined); assert.equal(height, undefined);
            assert.equal(method, ResampleMethod.NONE, 'resolução só pode mudar sem reamostrar');
            this.resolution = resolution; this.resizeLog.push(resolution);
        }
    }
    // Réguas fora de px: .as('px') converte pela base de 72 ppi (leitura desfavorável).
    function ruler(doc, pixels) {
        if (prefs.rulerUnits === Units.PIXELS) return new UnitValue(pixels, 'px');
        if (prefs.rulerUnits === Units.CM) return new UnitValue(pixels / doc.resolution * 2.54, 'cm');
        throw new Error(`réguas ${prefs.rulerUnits}`);
    }
    function detach(l) { const c = l._parent.children; c.splice(c.indexOf(l), 1); l._parent = null; }
    function attach(l, container, index) { container.children.splice(index, 0, l); l._parent = container; }
    function aboveActive(doc, l) {
        const a = doc._active && !doc._active.removed ? doc._active : null;
        if (a) attach(l, a._parent, a._parent.children.indexOf(a)); else attach(l, doc, 0);
    }
    // Grupo: cria no topo do grupo. Documento: acima da camada ativa, mesmo
    // quando ela está dentro de um grupo (leitura desfavorável do DOM).
    function collection(doc, container, typename) {
        return {add() {
            const l = new Layer(doc, typename, typename === 'LayerSet' ? undefined : LayerKind.NORMAL);
            if (container instanceof Doc) aboveActive(doc, l); else { container.alive(); attach(l, container, 0); }
            doc._active = l;
            return l;
        }};
    }
    function cloneLayer(src, doc, map) {
        const l = new Layer(doc, src.typename, src._kind);
        Object.assign(l, {name: src.name, visible: src.visible, opacity: src.opacity, allLocked: src.allLocked,
            T: {...src.T}, ops: src.ops.map(o => ({...o})), image: src.image && {...src.image}});
        if (src.text) { l.text = new TextItem(l); Object.assign(l.text, src.text, {layer: l}); }
        if (src.children) l.children = src.children.map(c => { const k = cloneLayer(c, doc, map); k._parent = l; return k; });
        if (map) map.set(src, l);
        return l;
    }

    app.documents.add = (width, height, resolution, name, mode, fill, aspect, bits, profile) => {
        assert.equal(mode, NewDocumentMode.RGB); assert.equal(fill, DocumentFill.TRANSPARENT); assert.equal(bits, BitsPerChannelType.EIGHT);
        const d = new Doc({name, width: num(width), height: num(height), resolution});
        d.profile = profile;
        const first = new Layer(d, 'ArtLayer', LayerKind.NORMAL); attach(first, d, 0); d._active = first;
        documents.push(d); activeDoc = d;
        return d;
    };
    function openDoc(spec) {
        const d = new Doc(spec);
        for (const name of spec.layers || ['Fundo']) { const l = new Layer(d, 'ArtLayer', LayerKind.NORMAL); l.name = name; attach(l, d, d.children.length); }
        d._active = d.children[0]; documents.push(d); activeDoc = d;
        return d;
    }

    class ActionDescriptor {
        constructor() { this.map = new Map(); }
        put(k, type, value) { assert.equal(typeof k, 'string'); this.map.set(k, {type, value}); }
        putUnitDouble(k, unit, v) { this.put(k, 'unit', {unit, value: v}); }
        putObject(k, cls, d) { this.put(k, 'object', {cls, desc: d}); }
        putEnumerated(k, type, v) { this.put(k, 'enum', {type, value: v}); }
        putBoolean(k, v) { this.put(k, 'boolean', v); }
        putString(k, v) { this.put(k, 'string', v); }
        putDouble(k, v) { this.put(k, 'double', v); }
        putInteger(k, v) { assert.ok(Number.isInteger(v)); this.put(k, 'integer', v); }
        putList(k, v) { assert.ok(v instanceof ActionList); this.put(k, 'list', v); }
        putPath(k, v) { assert.ok(v instanceof File); this.put(k, 'path', v); }
        get(k) { return this.map.get(k); }
    }
    class ActionList {
        constructor() { this.items = []; }
        putObject(cls, d) { this.items.push({cls, desc: d}); }
    }
    function charIDToTypeID(s) { assert.equal(s.length, 4, `charID ${s}`); return s; }
    function executeAction(id, desc, mode) {
        assert.equal(mode, DialogModes.NO);
        const doc = app.activeDocument;
        log.actions.push({id, desc, resolution: doc.resolution});
        if (current.failAction && current.failAction(id, desc)) throw new Error(`Falha simulada em ${id}`);
        if (id === 'Grdn') {
            assert.equal(doc.selection.parts.length, 0, 'degradê com seleção ativa');
            const target = doc.selection.target();
            target.addOp('fill', [{mode: 'add', poly: [[0, 0], [doc.w, 0], [doc.w, doc.h], [0, doc.h]]}], 'gradient');
        } else if (id === 'Plc ') {
            const file = desc.get('null').value, fixture = images.get(file.fsName);
            assert.ok(fixture, `imagem desconhecida ${file.fsName}`);
            assert.ok(!desc.map.has('Lnkd'), 'imagem vinculada');
            const l = new Layer(doc, 'ArtLayer', LayerKind.SMARTOBJECT);
            l.name = path.basename(file.fsName).replace(/\.[^.]+$/, ''); l.image = {...fixture, file: file.fsName};
            const k = Math.min(1, doc.w / fixture.w, doc.h / fixture.h);
            l.T = {kx: k, ky: k, tx: (doc.w - fixture.w * k) / 2, ty: (doc.h - fixture.h * k) / 2};
            aboveActive(doc, l); doc._active = l;
        } else throw new Error(`evento ${id} não simulado`);
    }

    class SolidColor { constructor() { this.rgb = {hexValue: '000000'}; } }
    class File {
        constructor(p) { this.fsName = path.resolve(String(p)); }
        get name() { return encodeURI(path.basename(this.fsName)); }
        get exists() { return images.has(this.fsName); }
    }
    File.openDialog = () => (current.pick || []).shift() || null;

    function element(type, value, props) {
        const e = {type, text: typeof value === 'string' ? value : '', children: [], properties: props || {},
            preferredSize: {width: 0, height: 0}, enabled: true, visible: true};
        e.add = (t, bounds, val, pr) => { const c = element(t, val, pr); c.parent = e; e.children.push(c); return c; };
        if (type === 'dropdownlist') {
            e.items = (value || []).map((text, index) => ({text, index}));
            let sel = null;
            Object.defineProperty(e, 'selection', {get: () => sel, set: v => { sel = typeof v === 'number' ? e.items[v] : v; }});
        }
        return e;
    }
    function Window(type, title) {
        const w = element(type, title);
        w.center = () => {};
        if (type === 'dialog') {
            w.close = v => { w.exitCode = v; };
            w.show = () => {
                log.dialogs++;
                if (current.cancelDialog) return 2;
                const api = dialogApi(w);
                if (current.fill) current.fill(api);
                w.exitCode = undefined;
                const ok = all(w).find(e => e.properties && e.properties.name === 'ok');
                ok.onClick();
                return w.exitCode === undefined ? 2 : w.exitCode;
            };
        } else {
            assert.equal(type, 'palette');
            w.show = () => {};
            w.close = () => { if (w.onClose) w.onClose(); };
            w.update = () => {
                const text = w.children.find(e => e.type === 'statictext').text;
                const cancel = w.children.find(e => e.type === 'button');
                if (current.onProgress) current.onProgress(text, () => cancel.onClick());
            };
        }
        return w;
    }
    function all(n) { return [n, ...n.children.flatMap(all)]; }
    function dialogApi(w) {
        const tab = title => { const t = all(w).find(e => e.type === 'tab' && e.text === title); assert.ok(t, `aba ${title}`); return t; };
        const edit = (scope, label) => {
            for (const g of all(scope)) {
                const i = g.children.findIndex(c => c.type === 'statictext' && c.text === label);
                const e = i >= 0 && g.children.slice(i + 1).find(c => c.type === 'edittext');
                if (e) return e;
            }
            throw new Error(`campo ${label}`);
        };
        const offerTab = i => tab(i === 0 ? 'Oferta principal' : `Oferta ${i + 1}`);
        const priceRow = (i, kind) => all(offerTab(i)).find(g => g.children.some(c => c.type === 'statictext' && c.text === (kind === 'de' ? 'DE ' : 'POR')))
            .children.filter(c => c.type === 'edittext');
        const imagePanels = () => all(w).filter(e => e.type === 'panel' && /^(Imagem do produto|Logotipo|Campanha)/.test(e.text));
        const modeList = () => all(w).find(e => e.type === 'dropdownlist');
        const fields = {name: 'Produto', note: 'Complemento'};
        return {
            modes: () => Array.from(modeList().items, x => x.text),
            mode(i) { const d = modeList(); d.selection = i; if (d.onChange) d.onChange(); },
            size() { const g = tab('Geral'), a = edit(g, 'Largura'), b = edit(g, 'Altura'); return {width: a.text, height: b.text, enabled: a.enabled && b.enabled}; },
            setSize(width, height) { const g = tab('Geral'); edit(g, 'Largura').text = String(width); edit(g, 'Altura').text = String(height); },
            general(label, value) { edit(tab('Geral'), label).text = value; },
            generalValue(label) { return edit(tab('Geral'), label).text; },
            offer(i, values) {
                for (const [k, v] of Object.entries(values)) {
                    if (fields[k]) { edit(offerTab(i), fields[k]).text = v; continue; }
                    const [kind, part] = k.split('.');
                    priceRow(i, kind)[['price', 'unit', 'label'].indexOf(part)].text = v;
                }
            },
            offerValue(i, k) {
                if (fields[k]) return edit(offerTab(i), fields[k]).text;
                const [kind, part] = k.split('.');
                return priceRow(i, kind)[['price', 'unit', 'label'].indexOf(part)].text;
            },
            choose(index, file) { current.pick = [file]; imagePanels()[index].children[0].children.find(b => b.text === 'Escolher…').onClick(); },
            clear(index) { imagePanels()[index].children[0].children.find(b => b.text === 'Limpar').onClick(); },
            imageStatus(index) { return imagePanels()[index].children[0].children[0].text; }
        };
    }

    const ctx = vm.createContext({
        app, UnitValue, SolidColor, Window, File, ActionDescriptor, ActionList, charIDToTypeID, executeAction,
        alert: m => log.alerts.push(String(m)),
        Units, TypeUnits, DialogModes, LayerKind, TextType, Justification, AntiAlias, ElementPlacement, AnchorPosition,
        SelectionType, NewDocumentMode, DocumentFill, BitsPerChannelType, SaveOptions, ResampleMethod
    });
    return {
        app, log, prefs, ResampleMethod,
        image(name, w, h) { const f = new File(path.join('/qa/imagens', name)); images.set(f.fsName, {w, h}); return f; },
        open: openDoc,
        run(config = {}) {
            current = config;
            const before = log.alerts.length;
            vm.runInContext(code, ctx, {filename: scriptPath});
            return {alerts: log.alerts.slice(before), doc: activeDoc};
        }
    };
}

/* Consultas sobre a árvore gerada. */
const ROOT = 'DESIGNPROD_OFERTAS_V1';
const OFFERS = ['02_OFERTA_DESTAQUE', '03_OFERTA_02', '04_OFERTA_03'];
const GROUPS = ['01_MARCA', ...OFFERS, '05_CAMPANHA', '06_RODAPE', '90_GRAFISMOS', '98_GUIAS', '99_FUNDO'];
const SPECS = [
    {image: [245, 115, 440, 460], title: [900, 112, 640, 148], note: [900, 270, 610, 42], de: [900, 382, 172, 112], por: [1184, 382, 320, 216]},
    {image: [138, 757, 180, 182], title: [390, 755, 288, 70], note: [390, 825, 284, 22], de: [390, 862, 79, 67], por: [506, 862, 135, 82]},
    {image: [792, 750, 220, 190], title: [1052, 755, 298, 70], note: [1052, 825, 296, 22], de: [1052, 862, 79, 67], por: [1165, 862, 171, 82]}
];
const CARDS = [[75, 712, 617, 256], [755, 712, 617, 256]];
const SLOTS = [SPECS[0].image, SPECS[1].image, SPECS[2].image, [1595, 36, 194, 172], [1407, 687, 418, 346]];
const FOOTER = [119, 1040, 1560, 30];

function at(container, ...names) {
    let node = container;
    for (const n of names) {
        const hits = node.children.filter(c => c.name === n);
        assert.equal(hits.length, 1, `${n}: ${hits.length} ocorrências`);
        node = hits[0];
    }
    return node;
}
function rect(b, sx = 1, sy = sx) { return [b[0] * sx, b[1] * sy, (b[0] + b[2]) * sx, (b[1] + b[3]) * sy]; }
function within(inner, outer, label, tol = 0.01) {
    assert.ok(inner, `${label}: sem conteúdo`);
    assert.ok(inner[0] >= outer[0] - tol && inner[1] >= outer[1] - tol && inner[2] <= outer[2] + tol && inner[3] <= outer[3] + tol,
        `${label}: ${fmt(inner)} fora de ${fmt(outer)}`);
}
function disjoint(a, b, label) { assert.ok(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1], `${label}: ${fmt(a)} x ${fmt(b)}`); }
function close(a, b, label, tol = 0.01) { assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} != ${b}`); }
function fmt(b) { return '[' + b.map(n => n.toFixed(2)).join(', ') + ']'; }
function textLayers(node, prefix = '') {
    if (!node.children) return node.kind === LayerKind.TEXT ? [[prefix, node]] : [];
    return node.children.flatMap(c => textLayers(c, prefix + '/' + c.name));
}
function snapshot(doc) {
    const walk = l => ({name: l.name, visible: l.visible, kind: l._kind, T: l.T, ops: l.ops.length, image: l.image,
        text: l.text && [l.text._contents, l.text.sizePx, l.text._font], children: l.children && l.children.map(walk)});
    return JSON.stringify({w: doc.w, h: doc.h, resolution: doc.resolution, layers: doc.children.map(walk)});
}
function allFields(offers) {
    return api => offers.forEach((values, i) => values && api.offer(i, values));
}
/* Confere a anatomia de um bloco de preço já gerado. */
function checkPrice(group, box, label) {
    const g = group.box(), reais = at(group, 'TXT_REAIS').box(), cents = at(group, 'TXT_CENTAVOS').box();
    const unit = at(group, 'TXT_UNIDADE').box(), caption = at(group, 'TXT_ROTULO').box();
    within(g, box, `${label} no espaço`);
    assert.ok(caption[2] <= reais[0] + 0.01, `${label}: rótulo invade o inteiro`);
    assert.ok(reais[2] <= cents[0] + 0.01 && reais[2] <= unit[0] + 0.01, `${label}: centavos/unidade antes do inteiro`);
    close(cents[1], reais[1], `${label}: centavos no topo do inteiro`);
    close(unit[3], reais[3], `${label}: unidade na base do inteiro`);
    disjoint(cents, unit, `${label}: centavos x unidade`);
}

/* --------------------------------------------------------------------- */

test('Cabeçalho em semver, ES3, sem include, rede, gravação, PathItem ou Traçar', () => {
    assert.match(version, /^\d+\.\d+\.\d+$/);
    new vm.Script(code, {filename: scriptPath});
    const bare = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/"(?:\\.|[^"\\\n])*"/g, '""');
    assert.ok(!/\b(?:let|const|class)\s+[A-Za-z_$]/.test(bare), 'let/const/class');
    assert.ok(!bare.includes('=>') && !bare.includes('`'), 'arrow ou template');
    for (const banned of ['#include', 'saveAs', '.save(', 'Socket', 'HttpConnection', 'putCustomOptions', 'pathItems', 'PathPointInfo', '.stroke(', '.write(', '.open(']) {
        assert.ok(!bare.includes(banned), banned);
    }
});

test('Documento novo: estrutura gerenciada, textos editáveis e preferências restauradas', () => {
    const ps = photoshop();
    const {alerts, doc} = ps.run();
    assert.equal(ps.app.documents.length, 1);
    assert.deepEqual([doc.w, doc.h, doc.resolution, doc.profile], [1920, 1080, 72, 'sRGB IEC61966-2.1']);
    assert.deepEqual(doc.children.map(l => l.name), [ROOT], 'só o grupo gerenciado no topo');
    const root = doc.children[0];
    assert.deepEqual(root.children.map(l => l.name).sort(), GROUPS.slice().sort());
    assert.equal(at(root, '98_GUIAS').visible, false);
    assert.equal(at(root, '90_GRAFISMOS', 'FORMA_MOLDURA').kind, LayerKind.NORMAL);
    for (const name of OFFERS) {
        const g = at(root, name);
        for (const t of ['TXT_NOME', 'TXT_COMPLEMENTO']) assert.equal(at(g, t).kind, LayerKind.TEXT);
        for (const p of ['PRECO_ANTERIOR', 'PRECO_ATUAL']) for (const t of ['TXT_ROTULO', 'TXT_REAIS', 'TXT_CENTAVOS', 'TXT_UNIDADE']) {
            assert.equal(at(g, p, t).kind, LayerKind.TEXT, `${name}/${p}/${t}`);
        }
    }
    assert.equal(at(root, OFFERS[0], 'TXT_NOME').textItem.contents, 'AÇÚCAR TRITURADO\rCAUAXÍ 1 KG');
    assert.equal(at(root, OFFERS[0], 'TXT_NOME').textItem.font, 'Oswald-SemiBold');
    assert.deepEqual([ps.prefs.rulerUnits, ps.prefs.typeUnits, ps.app.displayDialogs], [Units.CM, TypeUnits.PIXELS, DialogModes.ALL]);
    assert.equal(alerts.length, 1);
    for (const slot of ['produto 1', 'produto 2', 'produto 3', 'campanha', 'logotipo']) assert.ok(alerts[0].includes(slot), slot);
});

test('Descritor Grdn: linear, 3 cores de preto a dourado, de 32% da altura até a base, em px', () => {
    const ps = photoshop();
    ps.run({fill: api => api.setSize(1280, 720)});
    const grad = ps.log.actions.filter(a => a.id === 'Grdn');
    assert.equal(grad.length, 1);
    const d = grad[0].desc, from = d.get('From').value.desc, to = d.get('T   ').value.desc;
    assert.deepEqual([from.get('Hrzn').value, from.get('Vrtc').value], [{unit: '#Pxl', value: 0}, {unit: '#Pxl', value: 720 * 0.32}]);
    assert.deepEqual([to.get('Hrzn').value, to.get('Vrtc').value], [{unit: '#Pxl', value: 0}, {unit: '#Pxl', value: 720}]);
    assert.equal(d.get('Type').value.value, 'Lnr ');
    const g = d.get('Grad').value.desc;
    assert.equal(g.get('Intr').value, 4096);
    const stops = g.get('Clrs').value.items.map(s => [s.desc.get('Lctn').value, ...['Rd  ', 'Grn ', 'Bl  '].map(k => s.desc.get('Clr ').value.desc.get(k).value)]);
    assert.deepEqual(stops, [[0, 23, 23, 23], [2048, 69, 56, 34], [4096, 169, 130, 57]]);
    assert.equal(g.get('Trns').value.items.length, 2);
    assert.equal(ps.app.documents[0].children[0].children.length, 9);
    assert.equal(at(ps.app.documents[0].children[0], '99_FUNDO', 'BG_DEGRADE_PRETO_DOURADO').ops[0].color, 'gradient');
});

test('Preços de 1 a 4 dígitos cabem no espaço, com centavos no topo e unidade na base', () => {
    const cases = [['7', '7', ',00'], ['12,5', '12', ',50'], ['345,99', '345', ',99'], ['9999,99', '9999', ',99'], ['R$ 0,90', '0', ',90'], ['2.89', '2', ',89']];
    const heights = [];
    for (const [input, reais, cents] of cases) {
        const ps = photoshop();
        const {doc, alerts} = ps.run({fill: allFields([0, 1, 2].map(() => ({'de.price': input, 'por.price': input})))});
        assert.equal(alerts.length, 1, alerts.join('\n'));
        const root = doc.children[0];
        OFFERS.forEach((name, i) => {
            for (const [p, key] of [['PRECO_ANTERIOR', 'de'], ['PRECO_ATUAL', 'por']]) {
                const g = at(root, name, p);
                assert.equal(g.visible, true);
                assert.equal(at(g, 'TXT_REAIS').textItem.contents, reais);
                assert.equal(at(g, 'TXT_CENTAVOS').textItem.contents, cents);
                checkPrice(g, rect(SPECS[i][key]), `${input} ${name}/${p}`);
            }
        });
        heights.push(at(root, OFFERS[0], 'PRECO_ATUAL').box());
        assert.ok(at(root, OFFERS[1], 'PRECO_ANTERIOR', 'FORMA_RISCO').box(), 'risco do DE');
    }
    const h = b => b[3] - b[1];
    assert.ok(h(heights[3]) < h(heights[0]), 'quatro dígitos reduzem o bloco em vez de vazar');
});

test('Nomes longos, complementos e unidades de 8 caracteres ficam nas suas áreas', () => {
    const longName = 'BISCOITO RECHEADO SABOR CHOCOLATE COM MORANGO\nPACOTE FAMÍLIA TRIPLO 3 X 140 G\nEMBALAGEM ECONÔMICA PROMOCIONAL';
    const ps = photoshop();
    const {doc, alerts} = ps.run({fill: allFields([0, 1, 2].map(i => ({
        name: i === 1 ? 'DETERGENTELÍQUIDOCONCENTRADOSUPERECONÔMICOLIMÃOEHORTELÃ500ML' : longName,
        note: '(FRAGRÂNCIAS SORTIDAS, EXCETO LAVANDA E CAMPOS DE ALGODÃO)',
        'de.price': '1234,56', 'de.unit': 'bandejas', 'por.price': '999,99', 'por.unit': 'PCT C/12'
    })))});
    assert.equal(alerts.length, 1, alerts.join('\n'));
    const root = doc.children[0];
    OFFERS.forEach((name, i) => {
        const g = at(root, name);
        within(at(g, 'TXT_NOME').box(), rect(SPECS[i].title), `${name} nome`);
        const note = at(g, 'TXT_COMPLEMENTO').box();
        if (i === 2) {
            within(note, [SPECS[2].title[0], SPECS[2].title[1], SPECS[2].title[0] + SPECS[2].title[2], SPECS[2].note[1] + SPECS[2].note[3]], `${name} complemento`);
            disjoint(note, at(g, 'PRECO_ATUAL').box(), `${name} complemento x preço`);
        } else within(note, rect(SPECS[i].note), `${name} complemento`);
        assert.equal(at(g, 'PRECO_ANTERIOR', 'TXT_UNIDADE').textItem.contents, 'BANDEJAS');
        assert.equal(at(g, 'PRECO_ATUAL', 'TXT_UNIDADE').textItem.contents, 'PCT C/12');
        checkPrice(at(g, 'PRECO_ANTERIOR'), rect(SPECS[i].de), `${name} DE`);
        checkPrice(at(g, 'PRECO_ATUAL'), rect(SPECS[i].por), `${name} POR`);
        disjoint(at(g, 'TXT_NOME').box(), at(g, 'PRECO_ATUAL').box(), `${name} nome x preço`);
    });
});

test('Unidade com 9 caracteres, POR vazio e preço com milhar são recusados sem criar documento', () => {
    const ps = photoshop();
    ps.run({fill: allFields([{'por.unit': 'UNIDADES9'}])});
    ps.run({fill: allFields([null, {'por.price': ''}])});
    ps.run({fill: allFields([null, null, {'de.price': '1.234,56'}])});
    ps.run({fill: allFields([{'de.price': '3,15', 'de.unit': ''}])});
    assert.equal(ps.app.documents.length, 0);
    assert.match(ps.log.alerts[0], /Oferta 1 \/ POR: unidade de 1 a 8/);
    assert.match(ps.log.alerts[1], /Oferta 2 \/ POR: informe/);
    assert.match(ps.log.alerts[2], /Oferta 3 \/ DE: informe/);
    assert.match(ps.log.alerts[3], /Oferta 1 \/ DE: unidade de 1 a 8/);
    assert.equal(ps.log.prefWrites, 0, 'preferências intocadas');
});

test('DE vazio oculta o bloco inteiro e dispensa unidade e rótulo', () => {
    const ps = photoshop();
    const {doc, alerts} = ps.run({fill: allFields([0, 1, 2].map(() => ({'de.price': '', 'de.unit': '', 'de.label': ''})))});
    assert.equal(alerts.length, 1, alerts.join('\n'));
    const root = doc.children[0];
    for (const name of OFFERS) {
        const de = at(root, name, 'PRECO_ANTERIOR');
        assert.equal(de.visible, false);
        assert.equal(at(de, 'TXT_UNIDADE').textItem.contents, 'UN');
        assert.equal(at(de, 'TXT_ROTULO').textItem.contents, 'DE\rR$');
        assert.equal(at(root, name, 'PRECO_ATUAL').visible, true);
    }
    // Recarregado, o DE continua vazio.
    ps.run({fill: api => { for (let i = 0; i < 3; i++) assert.equal(api.offerValue(i, 'de.price'), ''); }});
    assert.equal(ps.app.documents.length, 2);
    assert.equal(at(ps.app.documents[1].children[0], OFFERS[0], 'PRECO_ANTERIOR').visible, false);
});

test('Imagens: Plc incorporado, encaixe proporcional centralizado e ordem acima da divisória', () => {
    const ps = photoshop();
    const files = [ps.image('produto-principal.png', 1200, 900), ps.image('produto-02.png', 300, 900),
        ps.image('produto-03.psd', 2000, 400), ps.image('logo.png', 120, 60), ps.image('campanha.png', 4000, 4000)];
    const {doc, alerts} = ps.run({fill: api => files.forEach((f, i) => api.choose(i, f))});
    assert.ok(!alerts[0].includes('Espaços sem imagem'), alerts[0]);
    assert.equal(ps.log.actions.filter(a => a.id === 'Plc ').length, 5);
    const root = doc.children[0];
    const placed = [at(root, OFFERS[0], 'IMG_PRODUTO'), at(root, OFFERS[1], 'IMG_PRODUTO'), at(root, OFFERS[2], 'IMG_PRODUTO'),
        at(root, '01_MARCA', 'IMG_LOGO'), at(root, '05_CAMPANHA', 'IMG_CAMPANHA')];
    placed.forEach((l, i) => {
        const b = l.box(), s = rect(SLOTS[i]);
        assert.equal(l.kind, LayerKind.SMARTOBJECT);
        within(b, s, `imagem ${i}`);
        close((b[0] + b[2]) / 2, (s[0] + s[2]) / 2, `imagem ${i} centro x`); close((b[1] + b[3]) / 2, (s[1] + s[3]) / 2, `imagem ${i} centro y`);
        assert.ok(Math.abs((b[2] - b[0]) - (s[2] - s[0])) < 0.01 || Math.abs((b[3] - b[1]) - (s[3] - s[1])) < 0.01, `imagem ${i} encosta num lado`);
        close((b[2] - b[0]) / (b[3] - b[1]), l.image.w / l.image.h, `imagem ${i} proporção`, 1e-6);
    });
    assert.deepEqual(at(root, OFFERS[1]).children.map(l => l.name),
        ['PRECO_ATUAL', 'PRECO_ANTERIOR', 'TXT_COMPLEMENTO', 'TXT_NOME', 'IMG_PRODUTO', 'FORMA_DIVISORIA', 'FORMA_CARTAO', 'BG_CARTAO']);
    assert.deepEqual(at(root, OFFERS[0]).children.map(l => l.name).slice(-2), ['IMG_PRODUTO', 'FORMA_DIVISORIA']);
});

test('Moldura não reaparece dentro dos cards e não vira traço na borda esquerda da tela', () => {
    for (const [w, h] of [[1920, 1080], [1080, 1350], [3840, 2160]]) {
        const ps = photoshop();
        const {doc} = ps.run({fill: api => api.setSize(w, h)});
        const sx = w / 1920, sy = h / 1080, s = Math.min(sx, sy), lw = 2.5 * s;
        const root = doc.children[0], frame = at(root, '90_GRAFISMOS', 'FORMA_MOLDURA');
        const y = 845 * sy - lw / 2;
        for (const c of CARDS) for (let x = c[0] + 2; x < c[0] + c[2] - 2; x += 3) {
            assert.equal(frame.painted(x * sx, y), false, `${w}x${h}: moldura dentro do card em x=${x}`);
        }
        assert.equal(frame.painted(723 * sx, y), true, `${w}x${h}: moldura entre os cards`);
        assert.equal(frame.painted(1500 * sx, y), true, `${w}x${h}: moldura à direita dos cards`);
        assert.equal(frame.painted(900 * sx, 10 * sy + lw / 2), true, `${w}x${h}: topo da moldura`);
        assert.equal(frame.painted((1819 * sx) - lw / 2, 400 * sy), true, `${w}x${h}: lado direito`);
        for (let yy = 50; yy < 1070; yy += 10) assert.equal(frame.painted(0.5, yy * sy), false, `${w}x${h}: traço na borda esquerda em y=${yy}`);
        assert.equal(frame.painted(900 * sx, 400 * sy), false, `${w}x${h}: interior vazio`);
        const card = at(root, OFFERS[1], 'FORMA_CARTAO');
        assert.equal(card.painted(383 * sx, 712 * sy + lw / 2), true, 'contorno do card');
        assert.equal(card.painted(383 * sx, 840 * sy), false, 'interior do card');
        assert.equal(at(root, OFFERS[1], 'BG_CARTAO').opacity, 22);
    }
});

test('Rodapé não encobre a campanha e mantém a linha de base comum (16:9, 4:5, 4K, 720p)', () => {
    for (const [w, h] of [[1920, 1080], [1080, 1350], [3840, 2160], [1280, 720]]) {
        const ps = photoshop();
        const tall = ps.image('selo-alto.png', 600, 1400);
        const {doc} = ps.run({fill: api => {
            api.setSize(w, h); api.choose(4, tall);
            api.general('Rodapé — final', 'OU ENQUANTO DURAR O ESTOQUE. PROMOÇÃO NÃO CUMULATIVA, LIMITADA A 5 UNIDADES POR CLIENTE. IMAGENS MERAMENTE ILUSTRATIVAS.');
        }});
        const root = doc.children[0], sx = w / 1920, sy = h / 1080;
        const footer = at(root, '06_RODAPE').box(), campaign = at(root, '05_CAMPANHA', 'IMG_CAMPANHA').box();
        within(footer, rect(FOOTER, sx, sy), `${w}x${h}: rodapé`);
        disjoint(footer, campaign, `${w}x${h}: rodapé x campanha`);
        assert.ok(footer[1] >= campaign[3], `${w}x${h}: rodapé abaixo da campanha`);
        assert.ok(footer[3] <= h, `${w}x${h}: rodapé dentro da tela`);
        const base = ['TXT_AVISO_ANTES', 'TXT_VALIDADE', 'TXT_AVISO_DEPOIS'].map(n => at(root, '06_RODAPE', n).textItem.position[1].value);
        close(base[1], base[0], `${w}x${h}: base da validade`, 1e-6); close(base[2], base[0], `${w}x${h}: base do aviso final (Q/Ç/vírgula)`, 1e-6);
        const [a, v, d] = ['TXT_AVISO_ANTES', 'TXT_VALIDADE', 'TXT_AVISO_DEPOIS'].map(n => at(root, '06_RODAPE', n).box());
        assert.ok(a[2] < v[0] && v[2] < d[0], `${w}x${h}: ordem e espaço entre os textos`);
    }
});

test('Reedição: nova cópia recarrega tudo, mantém imagens e camadas externas e não toca no original', () => {
    const ps = photoshop();
    const files = [0, 1, 2, 3, 4].map(i => ps.image(`img-${i}.png`, 500 + i * 100, 400));
    ps.run({fill: api => {
        files.forEach((f, i) => api.choose(i, f));
        api.offer(0, {name: 'CAFÉ TORRADO\nPILÃO 500 G', 'de.price': '19,90', 'de.unit': 'kg', 'por.price': '15,49', 'por.unit': 'kg', 'por.label': 'SÓ|R$'});
        api.offer(1, {'de.price': ''});
        api.general('Validade', '01 A 05.10.2026');
    }});
    const source = ps.app.documents[0];
    const external = source.artLayers.add(); external.name = 'AJUSTE_DO_USUARIO';
    source.activeLayer = at(source.children.find(l => l.name === ROOT), OFFERS[0], 'PRECO_ATUAL', 'TXT_REAIS');
    const before = snapshot(source);
    let seen;
    ps.run({fill: api => {
        seen = {modes: api.modes(), size: api.size(), name: api.offerValue(0, 'name'), de: api.offerValue(0, 'de.price'), unit: api.offerValue(0, 'de.unit'),
            label: api.offerValue(0, 'por.label'), de2: api.offerValue(1, 'de.price'), dates: api.generalValue('Validade'), status: [0, 1, 2, 3, 4].map(api.imageStatus)};
        api.offer(2, {name: 'AMACIANTE DOWNY\nCONCENTRADO 1 L', 'por.price': '21,90'});
    }});
    assert.deepEqual(seen, {modes: ['Nova cópia do layout aberto', 'Novo layout com os dados abaixo'], size: {width: '1920', height: '1080', enabled: false},
        name: 'CAFÉ TORRADO\nPILÃO 500 G', de: '19,90', unit: '/KG', label: 'SÓ|R$', de2: '', dates: '01 A 05.10.2026',
        status: Array(5).fill('Imagem atual será mantida')});
    assert.equal(snapshot(source), before, 'original alterado');
    assert.equal(ps.app.documents.length, 2);
    const copy = ps.app.documents[1];
    assert.equal(ps.app.activeDocument, copy);
    assert.equal(copy.children[0].name, ROOT);
    assert.equal(copy.children.filter(l => l.name === ROOT).length, 1, 'grupo antigo removido');
    assert.ok(copy.children.some(l => l.name === 'AJUSTE_DO_USUARIO'), 'camada externa mantida');
    assert.ok(!JSON.stringify(snapshot(copy)).includes('__DP_TEMP'));
    const root = copy.children[0];
    assert.equal(at(root, OFFERS[2], 'TXT_NOME').textItem.contents, 'AMACIANTE DOWNY\rCONCENTRADO 1 L');
    assert.equal(at(root, OFFERS[0], 'PRECO_ATUAL', 'TXT_ROTULO').textItem.contents, 'SÓ\rR$');
    assert.equal(at(root, OFFERS[1], 'PRECO_ANTERIOR').visible, false);
    const imgs = [at(root, OFFERS[0], 'IMG_PRODUTO'), at(root, OFFERS[1], 'IMG_PRODUTO'), at(root, OFFERS[2], 'IMG_PRODUTO'),
        at(root, '01_MARCA', 'IMG_LOGO'), at(root, '05_CAMPANHA', 'IMG_CAMPANHA')];
    imgs.forEach((l, i) => { assert.equal(l.image.file, files[i].fsName); within(l.box(), rect(SLOTS[i]), `imagem mantida ${i}`); });
    assert.equal(ps.log.actions.filter(a => a.id === 'Plc ').length, 5, 'nenhuma imagem recolocada');
    // Terceira execução: limpa o logo, troca a campanha e gera novo layout em outro tamanho.
    const novo = ps.image('campanha-nova.png', 800, 800);
    const {alerts} = ps.run({fill: api => { api.mode(1); api.setSize(1080, 1080); api.clear(3); api.choose(4, novo); }});
    const third = ps.app.documents[2];
    assert.deepEqual([third.w, third.h], [1080, 1080]);
    assert.equal(at(third.children[0], '01_MARCA').children.length, 0);
    assert.equal(at(third.children[0], '05_CAMPANHA', 'IMG_CAMPANHA').image.file, novo.fsName);
    assert.match(alerts[0], /Espaços sem imagem: logotipo\./);
});

test('PSD a 300 ppi com réguas em cm: tamanho certo, mesma geometria dos textos e resolução devolvida', () => {
    const ps = photoshop();
    ps.run({fill: api => api.offer(0, {'de.price': '1234,56', 'por.price': '999,99'})});
    const source = ps.app.documents[0];
    const reference = new Map(textLayers(source.children[0]).map(([k, l]) => [k, l.box()]));
    source.resizeImage(undefined, undefined, 300, ps.ResampleMethod.NONE); // o usuário muda só a resolução
    ps.prefs.rulerUnits = Units.CM;
    const before = snapshot(source);
    let size;
    const {alerts} = ps.run({fill: api => { size = api.size(); }});
    assert.equal(alerts.length, 1, alerts.join('\n'));
    assert.deepEqual(size, {width: '1920', height: '1080', enabled: false});
    const copy = ps.app.documents[1];
    assert.equal(copy.resolution, 300);
    assert.deepEqual(copy.resizeLog, [72, 300]);
    assert.equal(snapshot(source), before);
    const texts = textLayers(copy.children[0]);
    assert.equal(texts.length, reference.size);
    for (const [k, l] of texts) {
        const a = l.box(), b = reference.get(k);
        if (!b) { assert.equal(a, null, k); continue; }
        a.forEach((v, i) => close(v, b[i], `${k}[${i}]`, 1e-6));
    }
    close(at(copy.children[0], OFFERS[0], 'TXT_NOME').textItem.size.value, 76 * 72 / 300, 'corpo em pt a 300 ppi', 1e-9);
    assert.ok(ps.log.textSizesAt.every(r => r === 72), 'textos criados a 72 ppi');
    assert.ok(ps.log.actions.every(a => a.resolution === 72), 'descritores executados a 72 ppi');
    assert.equal(ps.prefs.rulerUnits, Units.CM);
    // Novo layout a partir do PSD de 300 ppi continua em 72 ppi.
    ps.run({fill: api => api.mode(1)});
    assert.equal(ps.app.documents[2].resolution, 72);
});

test('Cancelar no formulário não cria documento nem altera preferências ou documento ativo', () => {
    const ps = photoshop();
    const user = ps.open({name: 'cliente.psd', width: 2000, height: 1000, resolution: 150});
    const {alerts} = ps.run({cancelDialog: true});
    assert.deepEqual(alerts, []);
    assert.deepEqual([...ps.app.documents], [user]);
    assert.equal(ps.app.activeDocument, user);
    assert.equal(ps.log.prefWrites, 0);
    assert.deepEqual([ps.prefs.rulerUnits, ps.prefs.typeUnits, ps.app.displayDialogs], [Units.CM, TypeUnits.PIXELS, DialogModes.ALL]);
});

test('Cancelar durante a geração fecha o parcial e restaura preferências, resolução e documento ativo', () => {
    const ps = photoshop();
    const user = ps.open({name: 'cliente.psd', width: 2000, height: 1000, resolution: 150});
    ps.run({onProgress: (text, cancel) => { if (text === 'Montando oferta 2') cancel(); }});
    assert.deepEqual([...ps.app.documents], [user]);
    assert.equal(ps.app.activeDocument, user);
    assert.equal(ps.log.closed.length, 1);
    assert.match(ps.log.alerts.at(-1), /Geração cancelada/);
    assert.deepEqual([ps.prefs.rulerUnits, ps.prefs.typeUnits, ps.app.displayDialogs], [Units.CM, TypeUnits.PIXELS, DialogModes.ALL]);
    // Cópia de um layout a 300 ppi cancelada: o original continua a 300 ppi e intacto.
    ps.run();
    const source = ps.app.documents[1];
    source.resizeImage(undefined, undefined, 300, ps.ResampleMethod.NONE);
    const before = snapshot(source);
    ps.run({onProgress: (text, cancel) => { if (text === 'Compondo o rodapé') cancel(); }});
    assert.equal(ps.app.documents.length, 2);
    assert.equal(ps.app.activeDocument, source);
    assert.equal(snapshot(source), before);
    assert.equal(ps.log.closed.length, 2);
});

test('Falha nativa no meio (Plc recusado) também fecha o parcial e restaura o estado', () => {
    const ps = photoshop();
    const bad = ps.image('corrompida.png', 100, 100);
    ps.run({fill: api => api.choose(4, bad), failAction: id => id === 'Plc '});
    assert.equal(ps.app.documents.length, 0);
    assert.equal(ps.log.closed.length, 1);
    assert.match(ps.log.alerts.at(-1), /Falha simulada em Plc/);
    assert.deepEqual([ps.prefs.rulerUnits, ps.prefs.typeUnits, ps.app.displayDialogs], [Units.CM, TypeUnits.PIXELS, DialogModes.ALL]);
});

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.ok ? '' : '\n' + r.error}`);
const report = {
    passed: results.filter(r => r.ok).length, total: results.length, nativePhotoshopRun: false,
    script: path.relative(base, scriptPath), version,
    scriptSha256: crypto.createHash('sha256').update(fs.readFileSync(scriptPath)).digest('hex'),
    note: 'JSX completo executado contra um DOM do Photoshop simulado em Node.js, com métricas de texto aproximadas. Não é execução nem renderização nativa.'
};
console.log(JSON.stringify(report, null, 2));
if (report.passed !== report.total) process.exit(1);
