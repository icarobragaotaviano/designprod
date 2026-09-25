/**
 * Testes do gerador de ofertas preto e dourado com o Photoshop simulado.
 *
 * O JSX roda inteiro em Node, contra um DOM simulado: camadas, grupos,
 * textos com métricas aproximadas, camadas de forma e de preenchimento
 * criadas pelo Action Manager, máscaras, rotação, guias, histórico,
 * objetos inteligentes e ScriptUI. Verifica os dois modelos (ADS e VT),
 * a edição parcial, o padrão de nomes, resolução e limpeza.
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
const LayerKind = enumeration('LayerKind', ['NORMAL', 'TEXT', 'SMARTOBJECT', 'SOLIDFILL', 'GRADIENTFILL']);
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
const Direction = enumeration('Direction', ['HORIZONTAL', 'VERTICAL']);

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
function bboxOf(points) {
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function roundedPolygon(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    if (!r) return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    const c = [[x + w - r, y + r], [x + w - r, y + h - r], [x + r, y + h - r], [x + r, y + r]], pts = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j <= 12; j++) {
        const a = (i - 1 + j / 12) * Math.PI / 2;
        pts.push([c[i][0] + r * Math.cos(a), c[i][1] + r * Math.sin(a)]);
    }
    return pts;
}
function rotatePoint([x, y], R) {
    if (!R) return [x, y];
    const a = R.deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), dx = x - R.px, dy = y - R.py;
    return [R.px + dx * c - dy * s, R.py + dx * s + dy * c]; // positivo = horário (y para baixo)
}

let nextId = 1;

function photoshop(options = {}) {
    let current = {};
    const log = {alerts: [], actions: [], closed: [], textSizesAt: [], dialogs: 0, prefWrites: 0, historySteps: [], progress: []};
    const images = new Map();
    const fontList = (options.fonts || [['Oswald SemiBold', 'Oswald-SemiBold'], ['Roboto Condensed', 'RobotoCondensed-Regular'], ['Arial', 'ArialMT']])
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
            this.T = {kx: 1, ky: 1, tx: 0, ty: 0}; this.R = null;
            this.image = null; this.text = null; this.shape = null; this.fill = null; this.mask = null;
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
            assert.equal(v, LayerKind.TEXT); assert.equal(this._kind, LayerKind.NORMAL, 'só camada vazia vira texto');
            this._kind = v; this.text = new TextItem(this);
        }
        get textItem() { assert.ok(this.text, `textItem em ${this.name}, que não é texto`); return this.text; }
        alive() { assert.ok(!this.removed, `camada removida: ${this.name}`); }
        leaves() { return this.children ? this.children.flatMap(c => c.leaves()) : [this]; }
        localPoints() {
            if (this.text) { const b = this.text.localBounds(); return b && [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]]; }
            if (this.image) return [[0, 0], [this.image.w, 0], [this.image.w, this.image.h], [0, this.image.h]];
            if (this.shape) return this.shape.outer;
            if (this.fill) return [[0, 0], [this.doc.w, 0], [this.doc.w, this.doc.h], [0, this.doc.h]];
            return null;
        }
        toDoc([x, y]) { return rotatePoint([x * this.T.kx + this.T.tx, y * this.T.ky + this.T.ty], this.R); }
        box() {
            if (this.children) return this.children.filter(c => c.visible).map(c => c.box()).reduce(union, null);
            const pts = this.localPoints();
            return pts && bboxOf(pts.map(p => this.toDoc(p)));
        }
        get bounds() { this.alive(); return (this.box() || [0, 0, 0, 0]).map(n => new UnitValue(n, 'px')); }
        translate(dx, dy) {
            this.alive(); assert.ok(!this.allLocked, 'camada travada');
            const x = num(dx), y = num(dy);
            for (const l of this.leaves()) { l.T.tx += x; l.T.ty += y; if (l.R) { l.R.px += x; l.R.py += y; } }
        }
        resize(xp, yp, anchor) {
            this.alive(); assert.equal(anchor, AnchorPosition.TOPLEFT);
            const b = this.box(); assert.ok(b, `redimensionar camada vazia: ${this.name}`);
            const fx = xp / 100, fy = yp / 100;
            assert.ok(fx > 0 && fy > 0 && Number.isFinite(fx), 'escala inválida');
            for (const l of this.leaves()) {
                if (l.R) { assert.ok(Math.abs(fx - fy) < 1e-9, 'escala não uniforme em camada girada'); l.R.px = b[0] + (l.R.px - b[0]) * fx; l.R.py = b[1] + (l.R.py - b[1]) * fy; }
                l.T.kx *= fx; l.T.ky *= fy;
                l.T.tx = b[0] + (l.T.tx - b[0]) * fx; l.T.ty = b[1] + (l.T.ty - b[1]) * fy;
            }
        }
        rotate(deg, anchor) {
            this.alive(); assert.equal(anchor, AnchorPosition.MIDDLECENTER); assert.ok(!this.children, 'girar grupo não simulado');
            assert.ok(!this.R, 'segunda rotação não simulada');
            const b = this.box(); this.R = {deg, px: (b[0] + b[2]) / 2, py: (b[1] + b[3]) / 2};
        }
        move(rel, where) {
            this.alive();
            const target = rel instanceof Doc ? rel : rel.doc;
            assert.equal(target, this.doc, 'move entre documentos');
            if (!(rel instanceof Doc)) { rel.alive(); assert.notEqual(rel, this, 'mover em relação a si mesma'); }
            for (let p = rel; p && !(p instanceof Doc); p = p._parent) assert.notEqual(p, this, 'grupo dentro de si mesmo');
            detach(this);
            let container, index;
            if (where === ElementPlacement.INSIDE) {
                // A documentação não diz se INSIDE vai ao topo ou à base: base.
                assert.equal(rel.typename, 'LayerSet', 'INSIDE exige grupo'); container = rel; index = rel.children.length;
            } else if (where === ElementPlacement.PLACEATBEGINNING || where === ElementPlacement.PLACEATEND) {
                assert.ok(rel instanceof Doc, 'PLACEATBEGINNING/END simulado só para documento'); container = rel;
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
            const mark = l => { l.removed = true; if (l.children) l.children.forEach(mark); };
            mark(this);
            if (!doc._active || doc._active.removed) doc._active = doc.children[0];
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
            assert.equal(where, ElementPlacement.PLACEATBEGINNING);
            const copy = cloneLayer(this, rel);
            attach(copy, rel, 0);
            return copy;
        }
        painted(X, Y) {
            assert.ok(this.shape, 'painted só para formas');
            if (X < 0 || Y < 0 || X > this.doc.w || Y > this.doc.h) return false;
            if (this.mask && this.mask.some(p => pointInPolygon(X, Y, p))) return false;
            let [x, y] = this.R ? rotatePoint([X, Y], {...this.R, deg: -this.R.deg}) : [X, Y];
            x = (x - this.T.tx) / this.T.kx; y = (y - this.T.ty) / this.T.ky;
            if (!pointInPolygon(x, y, this.shape.outer)) return false;
            return !this.shape.inner || !pointInPolygon(x, y, this.shape.inner);
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
        set position(v) { assert.ok(!this.layer.R, 'posição de texto girado'); assert.ok(Array.isArray(v) && v.length === 2); this.layer.T.tx = num(v[0]); this.layer.T.ty = num(v[1]); }
        get contents() { return this._contents; }
        set contents(v) { this._contents = String(v); this.layer.name = this._contents.split('\r')[0] || ' '; }
        lead() { return this.useAutoLeading || !this.leadingPx ? this.sizePx * 1.2 : this.leadingPx; }
        localBounds() {
            let box = null;
            this._contents.split('\r').forEach((line, k) => {
                const y = k * this.lead(); let x = 0;
                for (const ch of line) {
                    const w = advance(ch) * this.sizePx, a = ascent(ch);
                    if (a !== null) box = union(box, [x, y - a * this.sizePx, x + w, y + descent(ch) * this.sizePx]);
                    x += w;
                }
            });
            return box;
        }
        lineBaselines() { return this._contents.split('\r').map((_, k) => this.layer.T.ty + k * this.lead() * this.layer.T.ky); }
    }

    class Selection {
        constructor(doc) { this.doc = doc; this.parts = []; }
        select(region, type) {
            assert.equal(type || SelectionType.REPLACE, SelectionType.REPLACE, 'só seleção simples é usada');
            assert.ok(Array.isArray(region) && region.length >= 3);
            this.parts = [Array.from(region, p => [num(p[0]), num(p[1])])];
        }
        deselect() { this.parts = []; }
        fill() { throw new Error('preenchimento de pixels: formas precisam ser vetoriais'); }
        clear() { throw new Error('apagar pixels: use máscara'); }
        stroke() { throw new Error('traçar seleção gera pixels'); }
    }

    class Guides extends Array {
        add(direction, coordinate) {
            assert.ok(direction === Direction.HORIZONTAL || direction === Direction.VERTICAL);
            assert.ok(coordinate instanceof UnitValue && coordinate.type === 'px');
            const g = {direction, coordinate: new UnitValue(coordinate.value, 'px')}; this.push(g); return g;
        }
    }

    class Doc {
        constructor({name, width, height, resolution}) {
            this.id = nextId++; this.name = name; this.w = width; this.h = height; this.resolution = resolution;
            this.children = []; this._active = null; this.resizeLog = []; this.guides = new Guides();
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
            this.guides.forEach(g => copy.guides.add(g.direction, g.coordinate));
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
        get activeHistoryState() {
            return {resolution: this.resolution, guides: this.guides.map(g => ({...g})), resizeLog: this.resizeLog.slice(),
                children: this.children.map(c => cloneLayer(c, this, null, true))};
        }
        set activeHistoryState(s) {
            this.children = s.children.map(c => { const k = cloneLayer(c, this, null, true); k._parent = this; return k; });
            this.resolution = s.resolution; this.resizeLog = s.resizeLog.slice();
            this.guides = new Guides(); s.guides.forEach(g => this.guides.push(g));
            this._active = this.children[0]; log.historySteps.push('revertido');
        }
        suspendHistory(name, script) {
            assert.equal(activeDoc, this, 'suspendHistory no documento ativo');
            vm.runInContext(script, ctx);
            log.historySteps.push(name);
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
    // Documento: acima da camada ativa, mesmo quando ela está dentro de um
    // grupo (leitura desfavorável do DOM). Grupo: topo do grupo.
    function aboveActive(doc, l) {
        const a = doc._active && !doc._active.removed ? doc._active : null;
        if (a) attach(l, a._parent, a._parent.children.indexOf(a)); else attach(l, doc, 0);
    }
    function collection(doc, container, typename) {
        return {add() {
            const l = new Layer(doc, typename, typename === 'LayerSet' ? undefined : LayerKind.NORMAL);
            if (container instanceof Doc) aboveActive(doc, l); else { container.alive(); attach(l, container, 0); }
            doc._active = l;
            return l;
        }};
    }
    function cloneLayer(src, doc, map, keepId) {
        const l = new Layer(doc, src.typename, src._kind);
        if (keepId) l.id = src.id;
        Object.assign(l, {name: src.name, visible: src.visible, opacity: src.opacity, allLocked: src.allLocked,
            T: {...src.T}, R: src.R && {...src.R}, image: src.image && {...src.image}, shape: src.shape && structuredClone(src.shape),
            fill: src.fill && structuredClone(src.fill), mask: src.mask && structuredClone(src.mask)});
        if (src.text) { l.text = new TextItem(l); Object.assign(l.text, src.text, {layer: l}); }
        if (src.children) l.children = src.children.map(c => { const k = cloneLayer(c, doc, map, keepId); k._parent = l; return k; });
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
        putUnitDouble(k, unit, v) { assert.ok(Number.isFinite(v), `${k} inválido`); this.put(k, 'unit', {unit, value: v}); }
        putObject(k, cls, d) { assert.ok(d instanceof ActionDescriptor); this.put(k, 'object', {cls, desc: d}); }
        putEnumerated(k, type, v) { this.put(k, 'enum', {type, value: v}); }
        putBoolean(k, v) { assert.equal(typeof v, 'boolean'); this.put(k, 'boolean', v); }
        putString(k, v) { this.put(k, 'string', v); }
        putDouble(k, v) { assert.ok(Number.isFinite(v)); this.put(k, 'double', v); }
        putInteger(k, v) { assert.ok(Number.isInteger(v)); this.put(k, 'integer', v); }
        putList(k, v) { assert.ok(v instanceof ActionList); this.put(k, 'list', v); }
        putPath(k, v) { assert.ok(v instanceof File); this.put(k, 'path', v); }
        putReference(k, v) { assert.ok(v instanceof ActionReference); this.put(k, 'reference', v); }
        putClass(k, v) { this.put(k, 'class', v); }
        get(k) { const v = this.map.get(k); return v && v.value; }
        has(k) { return this.map.has(k); }
    }
    class ActionList {
        constructor() { this.items = []; }
        putObject(cls, d) { this.items.push({cls, desc: d}); }
    }
    class ActionReference {
        constructor() { this.items = []; }
        putClass(c) { this.items.push({cls: c}); }
        putEnumerated(c, t, v) { this.items.push({cls: c, type: t, value: v}); }
    }
    function charIDToTypeID(s) { assert.equal(s.length, 4, `charID ${s}`); return s; }
    function stringIDToTypeID(s) { assert.ok(/^[a-zA-Z]+$/.test(s), `stringID ${s}`); return s; }
    const hex = c => ['Rd  ', 'Grn ', 'Bl  '].map(k => Math.round(c.get(k)).toString(16).padStart(2, '0')).join('').toUpperCase();
    function makeContentLayer(doc, desc) {
        assert.equal(doc.selection.parts.length, 0, 'forma criada com seleção ativa vira máscara');
        const using = desc.get('Usng'); assert.equal(using.cls, 'contentLayer');
        const l = using.desc, type = l.get('Type');
        let layer;
        if (type.cls === 'solidColorLayer') {
            const shp = l.get('Shp '); assert.ok(shp && shp.cls === 'Rctn', 'forma sólida precisa de Rctn');
            const r = shp.desc, u = k => { const v = r.get(k); assert.equal(v.unit, '#Pxl'); return v.value; };
            assert.equal(r.get('unitValueQuadVersion'), 1);
            const box = [u('Left'), u('Top '), u('Rght') - u('Left'), u('Btom') - u('Top ')];
            assert.ok(box[2] > 0 && box[3] > 0, 'retângulo vazio');
            const radii = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'].map(k => r.has(k) ? u(k) : 0);
            assert.ok(radii.every(x => x === radii[0]), 'raios diferentes');
            const stroke = l.has('strokeStyle') ? l.get('strokeStyle').desc : null;
            let strokeInfo = null, fillEnabled = true;
            if (stroke) {
                assert.equal(stroke.get('strokeEnabled'), true);
                fillEnabled = stroke.get('fillEnabled');
                assert.equal(stroke.get('strokeStyleLineAlignment').value, 'strokeStyleAlignInside');
                const w = stroke.get('strokeStyleLineWidth'); assert.equal(w.unit, '#Pxl');
                strokeInfo = {width: w.value, color: hex(stroke.get('strokeStyleContent').desc.get('Clr ').desc)};
            }
            layer = new Layer(doc, 'ArtLayer', LayerKind.SOLIDFILL);
            const outer = roundedPolygon(...box, radii[0]);
            const inner = !fillEnabled && strokeInfo ? roundedPolygon(box[0] + strokeInfo.width, box[1] + strokeInfo.width,
                box[2] - 2 * strokeInfo.width, box[3] - 2 * strokeInfo.width, radii[0] - strokeInfo.width) : null;
            layer.shape = {rect: box, radius: radii[0], fill: fillEnabled ? hex(type.desc.get('Clr ').desc) : null, stroke: strokeInfo, outer, inner};
        } else if (type.cls === 'gradientLayer') {
            const g = type.desc, grad = g.get('Grad').desc;
            layer = new Layer(doc, 'ArtLayer', LayerKind.GRADIENTFILL);
            layer.fill = {angle: g.get('Angl'), type: g.get('Type').value,
                stops: grad.get('Clrs').items.map(s => [s.desc.get('Lctn'), hex(s.desc.get('Clr ').desc)]),
                transparency: grad.get('Trns').items.length};
        } else throw new Error(`contentLayer ${type.cls} não simulado`);
        aboveActive(doc, layer); doc._active = layer;
    }
    function executeAction(id, desc, mode) {
        assert.equal(mode, DialogModes.NO);
        const doc = app.activeDocument;
        log.actions.push({id, desc, resolution: doc.resolution});
        if (current.failAction && current.failAction(id, desc)) throw new Error(`Falha simulada em ${id}`);
        if (id === 'Mk  ' && desc.has('Nw  ')) {
            assert.equal(desc.get('Nw  '), 'Chnl'); assert.equal(desc.get('Usng').value, 'HdSl');
            const l = doc.activeLayer; assert.ok(doc.selection.parts.length, 'máscara sem seleção');
            assert.ok(!l.mask, 'segunda máscara'); l.mask = doc.selection.parts.map(p => p.map(q => [...q]));
        } else if (id === 'Mk  ') {
            assert.equal(desc.get('null').items[0].cls, 'contentLayer');
            makeContentLayer(doc, desc);
        } else if (id === 'Plc ') {
            const file = desc.get('null'), fixture = images.get(file.fsName);
            assert.ok(fixture, `imagem desconhecida ${file.fsName}`);
            assert.ok(!desc.has('Lnkd'), 'imagem vinculada');
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
            preferredSize: {width: 0, height: 0}, enabled: true, visible: true, value: false};
        e.add = (t, bounds, val, pr) => { const c = element(t, val, pr); c.parent = e; e.children.push(c); return c; };
        if (type === 'dropdownlist') {
            e.items = Array.from(value || [], (text, index) => ({text, index}));
            let sel = null;
            // ScriptUI dispara onChange também quando o script muda a seleção.
            Object.defineProperty(e, 'selection', {get: () => sel, set: v => { sel = typeof v === 'number' ? e.items[v] : v; if (e.onChange) e.onChange(); }});
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
                all(w).find(e => e.properties && e.properties.name === 'ok').onClick();
                return w.exitCode === undefined ? 2 : w.exitCode;
            };
        } else {
            assert.equal(type, 'palette');
            w.show = () => {};
            w.close = () => { if (w.onClose) w.onClose(); };
            w.update = () => {
                const text = w.children.find(e => e.type === 'statictext').text;
                const cancel = w.children.find(e => e.type === 'button');
                log.progress.push(text);
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
        const lists = () => all(w).filter(e => e.type === 'dropdownlist');
        const fields = {name: 'Produto', note: 'Complemento'};
        const checkbox = i => all(offerTab(i)).find(e => e.type === 'checkbox');
        return {
            modes: () => Array.from(lists()[0].items, x => x.text),
            mode(i) { lists()[0].selection = i; },
            format(i) { lists()[1].selection = i; },
            formatEnabled: () => lists()[1].enabled,
            size() { const g = tab('Geral'), a = edit(g, 'Largura'), b = edit(g, 'Altura'); return {width: a.text, height: b.text, enabled: a.enabled && b.enabled}; },
            setSize(width, height) { const g = tab('Geral'); edit(g, 'Largura').text = String(width); edit(g, 'Altura').text = String(height); },
            general(label, value) { edit(tab('Geral'), label).text = value; },
            generalValue(label) { return edit(tab('Geral'), label).text; },
            offer(i, values) {
                for (const [k, v] of Object.entries(values)) {
                    if (fields[k]) { edit(offerTab(i), fields[k]).text = v; continue; }
                    if (k === 'alcohol') { checkbox(i).value = v; continue; }
                    const [kind, part] = k.split('.');
                    priceRow(i, kind)[['price', 'unit', 'label'].indexOf(part)].text = v;
                }
            },
            offerValue(i, k) {
                if (fields[k]) return edit(offerTab(i), fields[k]).text;
                if (k === 'alcohol') return checkbox(i).value;
                const [kind, part] = k.split('.');
                return priceRow(i, kind)[['price', 'unit', 'label'].indexOf(part)].text;
            },
            choose(index, file) { current.pick = [file]; imagePanels()[index].children[0].children.find(b => b.text === 'Escolher…').onClick(); },
            clear(index) { imagePanels()[index].children[0].children.find(b => b.text === 'Limpar').onClick(); },
            imageStatus(index) { return imagePanels()[index].children[0].children[0].text; }
        };
    }

    const ctx = vm.createContext({
        app, UnitValue, SolidColor, Window, File, ActionDescriptor, ActionList, ActionReference,
        charIDToTypeID, stringIDToTypeID, executeAction, alert: m => log.alerts.push(String(m)),
        Units, TypeUnits, DialogModes, LayerKind, TextType, Justification, AntiAlias, ElementPlacement, AnchorPosition,
        SelectionType, NewDocumentMode, DocumentFill, BitsPerChannelType, SaveOptions, ResampleMethod, Direction
    });
    ctx.$ = {global: ctx};
    return {
        app, log, prefs, ResampleMethod,
        image(name, w, h) { const f = new File(path.join('/qa/imagens', name)); images.set(f.fsName, {w, h}); return f; },
        open: openDoc,
        run(config = {}) {
            current = config;
            const before = log.alerts.length;
            vm.runInContext(code, ctx, {filename: scriptPath});
            assert.ok(!('__DP_OFERTAS_EDITAR' in ctx), 'função temporária global sobrou');
            return {alerts: log.alerts.slice(before), doc: activeDoc};
        }
    };
}

/* Modelos medidos nos PDFs ADS e VT: a referência dos testes. */
const ROOT = 'DP_OFERTAS_V2';
const OFFERS = ['02_OFERTA_01', '03_OFERTA_02', '04_OFERTA_03'];
const SECTIONS = ['01_MARCA', ...OFFERS, '05_CAMPANHA', '06_RODAPE', '90_GRAFISMOS', '98_AREAS', '99_FUNDO'];
const OTHER = ['01_MARCA', '05_CAMPANHA', '06_RODAPE', '90_GRAFISMOS', '98_AREAS', '99_FUNDO'];
const REF = {
    STORY: {w: 1080, h: 1920, formatIndex: 0, cards: [[250, 1114, 580, 238], [250, 1385, 580, 238]], divider: [241.5, 701, 2.5, 372],
        logo: [830, 140, 190, 160], campaign: [110, 1625, 340, 280], footer: [486, 1748, 470, 70],
        guidesV: [110, 242, 250, 263, 515, 830, 1020], guidesH: [140, 701, 1073, 1114, 1352, 1385, 1623, 1748, 1905]},
    VT: {w: 1920, h: 1080, formatIndex: 1, cards: [[191, 734, 579, 241], [828, 734, 578, 241]], divider: [846, 185, 4, 457],
        frame: [95, 107, 1730, 745], gap: [191, 1406], logo: [1610, 120, 200, 170], campaign: [1445, 700, 405, 340], footer: [191, 1005, 1215, 28],
        guidesV: [95, 191, 340, 846, 966, 1406, 1825], guidesH: [107, 185, 443, 642, 734, 852, 975, 1005]}
};
const NAME_RE = /^(?:\d{2}_)?[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const PREFIXES = {TEXT: ['TXT_'], SMARTOBJECT: ['IMG_'], SOLIDFILL: ['SHP_', 'AREA_'], GRADIENTFILL: ['BG_']};

function at(container, ...names) {
    let node = container;
    for (const n of names) {
        const hits = node.children.filter(c => c.name === n);
        assert.equal(hits.length, 1, `${n}: ${hits.length} ocorrências`);
        node = hits[0];
    }
    return node;
}
function rect(b) { return [b[0], b[1], b[0] + b[2], b[1] + b[3]]; }
function within(inner, outer, label, tol = 0.01) {
    assert.ok(inner, `${label}: sem conteúdo`);
    assert.ok(inner[0] >= outer[0] - tol && inner[1] >= outer[1] - tol && inner[2] <= outer[2] + tol && inner[3] <= outer[3] + tol,
        `${label}: ${fmt(inner)} fora de ${fmt(outer)}`);
}
function disjoint(a, b, label) { assert.ok(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1], `${label}: ${fmt(a)} x ${fmt(b)}`); }
function close(a, b, label, tol = 0.01) { assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} != ${b}`); }
function fmt(b) { return '[' + b.map(n => n.toFixed(2)).join(', ') + ']'; }
function walk(node, fn, prefix = '') {
    for (const c of node.children) { fn(c, prefix + '/' + c.name); if (c.children) walk(c, fn, prefix + '/' + c.name); }
}
function textLayers(node) { const out = []; walk(node, (l, p) => { if (l.kind === LayerKind.TEXT) out.push([p, l]); }); return out; }
function snapshot(node) {
    const one = l => ({name: l.name, visible: l.visible, kind: l._kind, T: l.T, R: l.R, image: l.image, shape: l.shape && l.shape.rect, mask: l.mask,
        fill: l.fill, text: l.text && [l.text._contents, l.text.sizePx, l.text._font], children: l.children && l.children.map(one)});
    return JSON.stringify(node.children ? node.children.map(one) : one(node));
}
function allFields(offers) { return api => offers.forEach((values, i) => values && api.offer(i, values)); }
function area(root, name) { return at(root, '98_AREAS', name).box(); }
function checkPrice(group, box, label) {
    const reais = at(group, 'TXT_REAIS').box(), cents = at(group, 'TXT_CENTAVOS').box();
    const unit = at(group, 'TXT_UNIDADE').box(), caption = at(group, 'TXT_ROTULO').box();
    within([reais, cents, unit, caption].reduce(union, null), box, `${label} no espaço`);
    assert.ok(caption[2] <= reais[0] + 0.01, `${label}: rótulo invade o inteiro`);
    assert.ok(reais[2] <= cents[0] + 0.01 && reais[2] <= unit[0] + 0.01, `${label}: centavos/unidade antes do inteiro`);
    close(cents[1], reais[1], `${label}: centavos no topo do inteiro`);
    close(unit[3], reais[3], `${label}: unidade na base do inteiro`);
    disjoint(cents, unit, `${label}: centavos x unidade`);
}
function newLayout(format, extra) { return api => { api.format(REF[format].formatIndex); if (extra) extra(api); }; }
const settled = ps => [ps.prefs.rulerUnits, ps.prefs.typeUnits, ps.app.displayDialogs];
const ORIGINAL = [Units.CM, TypeUnits.PIXELS, DialogModes.ALL];

/* --------------------------------------------------------------------- */

test('Cabeçalho 2.x, ES3 e sem include, rede, gravação, pixels ou métodos ES5', () => {
    assert.match(version, /^2\.\d+\.\d+$/);
    new vm.Script(code, {filename: scriptPath});
    const bare = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/"(?:\\.|[^"\\\n])*"/g, '""');
    assert.ok(!/\b(?:let|const|class)\s+[A-Za-z_$]/.test(bare), 'let/const/class');
    assert.ok(!bare.includes('=>') && !bare.includes('`'), 'arrow ou template');
    for (const banned of ['#include', 'saveAs', '.save(', 'Socket', 'HttpConnection', 'putCustomOptions', 'pathItems', 'PathPointInfo',
        '.stroke(', '.fill(', '.clear(', '.write(', '.open(', '.forEach(', '.map(', '.filter(', 'Array.isArray', 'JSON.', 'Object.keys', '.trim()']) {
        assert.ok(!bare.includes(banned), banned);
    }
});

for (const format of ['STORY', 'VT']) {
    const R = REF[format];
    test(`${format}: árvore no padrão de nomes, sem camada de pixels e preferências restauradas`, () => {
        const ps = photoshop();
        const {alerts, doc} = ps.run({fill: newLayout(format)});
        assert.equal(ps.app.documents.length, 1);
        assert.deepEqual([doc.w, doc.h, doc.resolution, doc.profile], [R.w, R.h, 72, 'sRGB IEC61966-2.1']);
        assert.deepEqual(doc.children.map(l => l.name), [ROOT], 'só o grupo gerenciado');
        const root = doc.children[0];
        assert.deepEqual(root.children.map(l => l.name), SECTIONS, 'seções na ordem do padrão');
        assert.equal(at(root, '98_AREAS').visible, false);
        walk(root, (l, p) => {
            assert.match(l.name, NAME_RE, `nome fora do padrão: ${p}`);
            if (l.children) {
                const names = l.children.map(c => c.name);
                assert.equal(new Set(names).size, names.length, `irmãos repetidos em ${p}`);
                return;
            }
            assert.notEqual(l.kind, LayerKind.NORMAL, `camada de pixels: ${p}`);
            assert.ok(PREFIXES[l.kind.split('.')[1]].some(x => l.name.startsWith(x)), `prefixo errado para ${l.kind}: ${p}`);
        });
        for (const name of OFFERS) {
            const g = at(root, name);
            for (const p of ['PRECO_DE', 'PRECO_POR']) for (const t of ['TXT_ROTULO', 'TXT_REAIS', 'TXT_CENTAVOS', 'TXT_UNIDADE']) assert.equal(at(g, p, t).kind, LayerKind.TEXT);
            assert.equal(at(g, 'PRECO_DE', 'SHP_RISCO').kind, LayerKind.SOLIDFILL);
            assert.equal(at(g, 'SELO_MODERACAO', 'TXT_SELO').textItem.contents, 'BEBA COM MODERAÇÃO');
        }
        assert.equal(at(root, OFFERS[0], 'TXT_NOME').textItem.font, 'Oswald-SemiBold');
        assert.equal(at(root, '06_RODAPE', 'TXT_AVISO_ANTES').textItem.font, 'RobotoCondensed-Regular');
        assert.equal(at(root, '06_RODAPE', 'TXT_VALIDADE').textItem.font, 'Oswald-SemiBold');
        assert.deepEqual(settled(ps), ORIGINAL);
        assert.equal(alerts.length, 1);
        for (const slot of ['produto 1', 'produto 2', 'produto 3', 'campanha', 'logotipo']) assert.ok(alerts[0].includes(slot), slot);
    });

    test(`${format}: formas vetoriais e degradê de preenchimento nas medidas do PDF`, () => {
        const ps = photoshop();
        const {doc} = ps.run({fill: newLayout(format)});
        const root = doc.children[0];
        [OFFERS[1], OFFERS[2]].forEach((name, k) => {
            const card = at(root, name, 'SHP_CARD').shape;
            assert.deepEqual(card.rect, R.cards[k], `${name}: card`);
            assert.equal(card.fill, null, 'card só com contorno');
            assert.deepEqual(card.stroke, {width: 2.5, color: 'F5BE2E'});
        });
        assert.deepEqual(at(root, OFFERS[0], 'SHP_DIVISORIA').shape.rect, R.divider);
        const inner = at(root, OFFERS[1]).children.filter(l => l.name === 'SHP_DIVISORIA');
        assert.equal(inner.length, format === 'VT' ? 1 : 0, 'divisória interna só no VT');
        if (format === 'VT') assert.deepEqual(inner[0].shape.rect, [191 + 250, 734 + 31, 2, 182]);
        const bg = at(root, '99_FUNDO', 'BG_DEGRADE');
        assert.equal(bg.kind, LayerKind.GRADIENTFILL);
        assert.deepEqual(bg.fill.angle, {unit: '#Ang', value: -90});
        const [start, end] = format === 'VT' ? [0.27, 1] : [0.57, 0.875];
        assert.deepEqual(bg.fill.stops.map(s => s[1]), ['171717', '1D1C19', '393020', '73582F', 'AD8140']);
        close(bg.fill.stops[0][0], 4096 * start, 'início do dourado', 1); close(bg.fill.stops[4][0], 4096 * end, 'fim do dourado', 1);
    });

    test(`${format}: guias do modelo criadas sem duplicar nem remover as existentes`, () => {
        const ps = photoshop();
        const {doc} = ps.run({fill: newLayout(format)});
        const coords = (d, dir) => Array.from(d.guides).filter(g => g.direction === dir).map(g => g.coordinate.value).sort((a, b) => a - b);
        assert.deepEqual(coords(doc, Direction.VERTICAL), R.guidesV.slice().sort((a, b) => a - b));
        assert.deepEqual(coords(doc, Direction.HORIZONTAL), R.guidesH.slice().sort((a, b) => a - b));
        doc.guides.add(Direction.VERTICAL, new UnitValue(333, 'px'));
        const total = doc.guides.length;
        ps.run({fill: api => api.mode(1)});
        const copy = ps.app.documents[1];
        assert.equal(copy.guides.length, total, 'nova cópia não duplica guias');
        assert.ok(copy.guides.some(g => g.coordinate.value === 333), 'guia do usuário mantida');
        ps.app.activeDocument = doc;
        ps.run({fill: api => api.offer(0, {'por.price': '1,11'})});
        assert.equal(doc.guides.length, total, 'edição não mexe em guias');
        // Guias ficam sobre os limites das áreas que elas representam.
        const root = doc.children[0], v = new Set(R.guidesV), h = new Set(R.guidesH);
        const a = area(root, 'AREA_OFERTA_02_NOME'), card = R.cards[0];
        assert.ok(v.has(card[0]) && h.has(card[1]) && h.has(card[1] + card[3]), 'card 1 alinhado às guias');
        assert.ok(v.has(a[0]) || format === 'VT', 'texto dos cards na guia');
    });

    test(`${format}: preços de 1 a 4 dígitos cabem na área, com centavos no topo e unidade na base`, () => {
        const cases = [['7', '7', ',00'], ['12,5', '12', ',50'], ['345,99', '345', ',99'], ['9999,99', '9999', ',99'], ['R$ 0,90', '0', ',90'], ['2.89', '2', ',89']];
        for (const [input, reais, cents] of cases) {
            const ps = photoshop();
            const {doc, alerts} = ps.run({fill: newLayout(format, allFields([0, 1, 2].map(() => ({'de.price': input, 'por.price': input, 'de.unit': 'kg'}))))});
            assert.equal(alerts.length, 1, alerts.join('\n'));
            const root = doc.children[0];
            OFFERS.forEach((name, i) => {
                for (const p of ['PRECO_DE', 'PRECO_POR']) {
                    const g = at(root, name, p);
                    assert.equal(at(g, 'TXT_REAIS').textItem.contents, reais);
                    assert.equal(at(g, 'TXT_CENTAVOS').textItem.contents, cents);
                    checkPrice(g, area(root, `AREA_OFERTA_0${i + 1}_${p}`), `${input} ${name}/${p}`);
                }
                const strike = at(root, name, 'PRECO_DE', 'SHP_RISCO');
                assert.ok(strike.R && strike.R.deg < 0, 'risco sobe da esquerda para a direita');
                assert.equal(strike.shape.fill, 'FFFFFF');
                assert.ok(strike.shape.rect[3] >= 2 - 1e-9, 'risco com espessura legível');
            });
        }
    });

    test(`${format}: nomes longos, complemento e unidades de 8 caracteres ficam nas áreas`, () => {
        const ps = photoshop();
        const {doc, alerts} = ps.run({fill: newLayout(format, allFields([0, 1, 2].map(i => ({
            name: i === 1 ? 'DETERGENTELÍQUIDOCONCENTRADOSUPERECONÔMICOLIMÃO500ML' : 'BISCOITO RECHEADO SABOR CHOCOLATE COM MORANGO\nPACOTE FAMÍLIA 3 X 140 G\nEMBALAGEM ECONÔMICA',
            note: '(FRAGRÂNCIAS SORTIDAS)', 'de.price': '1234,56', 'de.unit': 'bandejas', 'por.price': '999,99', 'por.unit': 'PCT C/12'
        }))))});
        assert.equal(alerts.length, 1, alerts.join('\n'));
        const root = doc.children[0];
        OFFERS.forEach((name, i) => {
            const g = at(root, name), n = `AREA_OFERTA_0${i + 1}_`;
            within(at(g, 'TXT_NOME').box(), area(root, n + 'NOME'), `${name} nome`);
            within(at(g, 'TXT_COMPLEMENTO').box(), union(area(root, n + 'NOME'), area(root, n + 'COMPLEMENTO')), `${name} complemento`);
            disjoint(at(g, 'TXT_COMPLEMENTO').box(), at(g, 'PRECO_POR').box(), `${name} complemento x preço`);
            assert.equal(at(g, 'PRECO_DE', 'TXT_UNIDADE').textItem.contents, 'BANDEJAS');
            checkPrice(at(g, 'PRECO_DE'), area(root, n + 'PRECO_DE'), `${name} DE`);
            checkPrice(at(g, 'PRECO_POR'), area(root, n + 'PRECO_POR'), `${name} POR`);
        });
    });

    test(`${format}: selo BEBA COM MODERAÇÃO só nas bebidas alcoólicas, girado dentro da área`, () => {
        const ps = photoshop();
        const {doc} = ps.run({fill: newLayout(format, allFields([{alcohol: true}, {alcohol: false}, {alcohol: true}]))});
        const root = doc.children[0];
        [true, false, true].forEach((on, i) => {
            const selo = at(root, OFFERS[i], 'SELO_MODERACAO'), a = area(root, `AREA_OFERTA_0${i + 1}_SELO`);
            assert.equal(selo.visible, on);
            assert.deepEqual(at(selo, 'SHP_SELO').shape.rect, [a[0], a[1], a[2] - a[0], a[3] - a[1]]);
            const t = at(selo, 'TXT_SELO'), b = t.box();
            assert.equal(t.R.deg, -90, 'lê de baixo para cima');
            within(b, a, `selo ${i}`);
            assert.ok(b[3] - b[1] > b[2] - b[0], 'texto na vertical');
        });
        assert.equal(at(root, OFFERS[0]).children[0].name, 'SELO_MODERACAO');
    });

    test(`${format}: imagens incorporadas, centralizadas nas áreas e na ordem certa`, () => {
        const ps = photoshop();
        const files = [ps.image('p1.png', 1200, 900), ps.image('p2.png', 300, 900), ps.image('p3.psd', 2000, 400), ps.image('logo.png', 120, 60), ps.image('campanha.png', 4000, 4000)];
        const {doc, alerts} = ps.run({fill: newLayout(format, api => files.forEach((f, i) => api.choose(i, f)))});
        assert.ok(!alerts[0].includes('Espaços sem imagem'), alerts[0]);
        const root = doc.children[0];
        [[at(root, OFFERS[0], 'IMG_PRODUTO'), 'AREA_OFERTA_01_IMAGEM'], [at(root, OFFERS[1], 'IMG_PRODUTO'), 'AREA_OFERTA_02_IMAGEM'],
            [at(root, OFFERS[2], 'IMG_PRODUTO'), 'AREA_OFERTA_03_IMAGEM'], [at(root, '01_MARCA', 'IMG_LOGO'), 'AREA_LOGO'], [at(root, '05_CAMPANHA', 'IMG_CAMPANHA'), 'AREA_CAMPANHA']]
            .forEach(([l, a], i) => {
                const b = l.box(), s = area(root, a);
                assert.equal(l.kind, LayerKind.SMARTOBJECT);
                within(b, s, `imagem ${i}`);
                close((b[0] + b[2]) / 2, (s[0] + s[2]) / 2, `imagem ${i} centro x`); close((b[1] + b[3]) / 2, (s[1] + s[3]) / 2, `imagem ${i} centro y`);
                close((b[2] - b[0]) / (b[3] - b[1]), l.image.w / l.image.h, `imagem ${i} proporção`, 1e-6);
            });
        assert.deepEqual(area(root, 'AREA_LOGO'), rect(R.logo)); assert.deepEqual(area(root, 'AREA_CAMPANHA'), rect(R.campaign));
        assert.deepEqual(at(root, OFFERS[1]).children.map(l => l.name), ['SELO_MODERACAO', 'PRECO_POR', 'PRECO_DE', 'TXT_COMPLEMENTO', 'TXT_NOME', 'IMG_PRODUTO']
            .concat(format === 'VT' ? ['SHP_DIVISORIA', 'SHP_CARD'] : ['SHP_CARD']));
    });

    test(`${format}: rodapé nas linhas do modelo, pela linha de base, sem encobrir a campanha`, () => {
        const ps = photoshop();
        const {doc} = ps.run({fill: newLayout(format, api => api.choose(4, ps.image('selo-alto.png', 600, 1400)))});
        const root = doc.children[0], g = at(root, '06_RODAPE');
        const [antes, data, depois, final] = ['TXT_AVISO_ANTES', 'TXT_VALIDADE', 'TXT_AVISO_DEPOIS', 'TXT_AVISO_FINAL'].map(n => at(g, n));
        within(g.box(), rect(R.footer), 'rodapé na área');
        disjoint(g.box(), at(root, '05_CAMPANHA', 'IMG_CAMPANHA').box(), 'rodapé x campanha');
        const lastBase = antes.textItem.lineBaselines().at(-1);
        close(data.textItem.lineBaselines()[0], lastBase, 'validade na última linha do início', 1e-6);
        close(depois.textItem.lineBaselines()[0], lastBase, 'depois na mesma linha', 1e-6);
        assert.ok(data.box()[2] < depois.box()[0], 'depois à direita da data');
        assert.ok(data.textItem.size.value > antes.textItem.size.value, 'data em destaque');
        if (format === 'STORY') {
            assert.equal(antes.textItem.contents, 'OFERTAS VÁLIDAS EM TODAS AS UNIDADES DO +B SUPERMERCADOS\rDE');
            assert.ok(final.textItem.lineBaselines()[0] > lastBase, 'linhas finais abaixo');
            close(final.textItem.position[0].value, antes.textItem.position[0].value, 'linhas finais na margem', 1e-6);
            close(g.box()[0], R.footer[0], 'alinhado à esquerda', 0.5);
        } else {
            assert.equal(final.visible, false, 'VT em uma linha');
            close((g.box()[0] + g.box()[2]) / 2, (R.gap[0] + R.gap[1]) / 2, 'centralizado sob os cards', 0.5);
        }
    });
}

test('VT: moldura vetorial com máscara que some atrás da fileira de cards', () => {
    const ps = photoshop();
    const {doc} = ps.run({fill: newLayout('VT')});
    const f = at(doc.children[0], '90_GRAFISMOS', 'SHP_MOLDURA');
    assert.equal(f.kind, LayerKind.SOLIDFILL);
    assert.deepEqual(f.shape.rect, REF.VT.frame); assert.equal(f.shape.radius, 70); assert.equal(f.shape.fill, null);
    const y = 852 - 1.25;
    for (let x = 195; x < 1402; x += 5) assert.equal(f.painted(x, y), false, `base visível em x=${x}`);
    for (const x of [170, 185, 1415, 1700]) assert.equal(f.painted(x, y), true, `base some em x=${x}`);
    assert.equal(f.painted(900, 108), true, 'topo'); assert.equal(f.painted(96, 500), true, 'lateral esquerda');
    assert.equal(f.painted(1823.5, 500), true, 'lateral direita'); assert.equal(f.painted(900, 500), false, 'interior vazio');
    const story = photoshop().run({fill: newLayout('STORY')}).doc;
    assert.equal(at(story.children[0], '90_GRAFISMOS').children.length, 0, 'ADS sem moldura');
});

test('Formulário: trocar o formato ajusta tamanho e exemplo, sem apagar texto digitado', () => {
    const ps = photoshop();
    let seen;
    ps.run({fill: api => {
        seen = {start: api.size(), name: api.offerValue(0, 'name'), alcohol: api.offerValue(1, 'alcohol')};
        api.format(1);
        seen.vt = {size: api.size(), name: api.offerValue(0, 'name'), alcohol: api.offerValue(1, 'alcohol')};
        api.offer(0, {name: 'MEU PRODUTO'}); api.format(0);
        seen.back = {size: api.size(), name: api.offerValue(0, 'name')};
    }});
    assert.deepEqual(seen.start, {width: '1080', height: '1920', enabled: true});
    assert.equal(seen.name, 'CARNE BOVINA TRASEIRA\nPATINHO KG'); assert.equal(seen.alcohol, true, 'cerveja do ADS com selo');
    assert.deepEqual(seen.vt, {size: {width: '1920', height: '1080', enabled: true}, name: 'AÇÚCAR TRITURADO\nCAUAXÍ 1 KG', alcohol: false});
    assert.deepEqual(seen.back, {size: {width: '1080', height: '1920', enabled: true}, name: 'MEU PRODUTO'});
    assert.equal(ps.app.documents[0].w, 1080);
});

test('Entradas inválidas são recusadas sem criar documento nem tocar nas preferências', () => {
    const ps = photoshop();
    ps.run({fill: allFields([{'por.unit': 'UNIDADES9'}])});
    ps.run({fill: allFields([null, {'por.price': ''}])});
    ps.run({fill: allFields([null, null, {'de.price': '1.234,56'}])});
    ps.run({fill: allFields([{'de.price': '3,15', 'de.unit': ''}])});
    ps.run({fill: api => api.setSize(500, 1920)});
    assert.equal(ps.app.documents.length, 0);
    assert.match(ps.log.alerts[0], /Oferta 1 \/ POR: unidade de 1 a 8/);
    assert.match(ps.log.alerts[1], /Oferta 2 \/ POR: informe/);
    assert.match(ps.log.alerts[2], /Oferta 3 \/ DE: informe/);
    assert.match(ps.log.alerts[3], /Oferta 1 \/ DE: unidade de 1 a 8/);
    assert.match(ps.log.alerts[4], /Largura deve ficar entre 640 e 7680/);
    assert.equal(ps.log.prefWrites, 0);
});

test('DE vazio oculta o bloco inteiro, dispensa unidade e rótulo e continua vazio ao reabrir', () => {
    const ps = photoshop();
    ps.run({fill: allFields([0, 1, 2].map(() => ({'de.price': '', 'de.unit': '', 'de.label': ''})))});
    const root = ps.app.documents[0].children[0];
    for (const name of OFFERS) {
        const de = at(root, name, 'PRECO_DE');
        assert.equal(de.visible, false);
        assert.equal(at(de, 'TXT_UNIDADE').textItem.contents, 'UN');
        assert.equal(at(root, name, 'PRECO_POR').visible, true);
    }
    let seen;
    ps.run({fill: api => { seen = [0, 1, 2].map(i => api.offerValue(i, 'de.price')); }});
    assert.deepEqual(seen, ['', '', '']);
});

test('Edição parcial: muda só o preço alterado, preserva ajustes manuais e ordem, em um passo', () => {
    const ps = photoshop();
    ps.run({fill: newLayout('VT')});
    const doc = ps.app.documents[0], root = doc.children[0];
    at(root, OFFERS[0], 'TXT_NOME').translate(new UnitValue(13, 'px'), new UnitValue(-7, 'px')); // ajuste manual
    doc.activeLayer = at(root, OFFERS[1], 'TXT_NOME');
    const others = [snapshot(at(root, OFFERS[0])), snapshot(at(root, OFFERS[2]))], sections = OTHER.map(n => snapshot(at(root, n)));
    const offer2 = at(root, OFFERS[1]), order = offer2.children.map(l => l.name), keep = offer2.children.filter(l => l.name !== 'PRECO_POR').map(snapshot);
    let modes, formatEnabled;
    const {alerts} = ps.run({fill: api => { modes = api.modes(); formatEnabled = api.formatEnabled(); api.offer(1, {'por.price': '4,29'}); }});
    assert.deepEqual(modes, ['Editar no documento aberto — só o que mudar', 'Nova cópia reconstruída', 'Novo layout']);
    assert.equal(formatEnabled, false);
    assert.equal(ps.app.documents.length, 1, 'no próprio documento');
    assert.deepEqual(ps.log.historySteps, ['Ofertas — editar elementos']);
    assert.match(alerts[0], /oferta 2 — preço POR/); assert.ok(!/principal|rodapé|nome/.test(alerts[0]), alerts[0]);
    const after = doc.children[0];
    assert.deepEqual([snapshot(at(after, OFFERS[0])), snapshot(at(after, OFFERS[2]))], others);
    assert.deepEqual(OTHER.map(n => snapshot(at(after, n))), sections);
    assert.deepEqual(at(after, OFFERS[1]).children.map(l => l.name), order, 'ordem preservada');
    assert.deepEqual(at(after, OFFERS[1]).children.filter(l => l.name !== 'PRECO_POR').map(snapshot), keep);
    const por = at(after, OFFERS[1], 'PRECO_POR');
    assert.equal(at(por, 'TXT_REAIS').textItem.contents, '4'); assert.equal(at(por, 'TXT_CENTAVOS').textItem.contents, ',29');
    checkPrice(por, area(after, 'AREA_OFERTA_02_PRECO_POR'), 'POR editado');
    assert.deepEqual(settled(ps), ORIGINAL);
});

test('Edição parcial: área movida pelo usuário leva o elemento reconstruído junto', () => {
    const ps = photoshop();
    ps.run();
    const root = ps.app.documents[0].children[0];
    at(root, '98_AREAS', 'AREA_OFERTA_01_PRECO_POR').translate(new UnitValue(-40, 'px'), new UnitValue(120, 'px'));
    const moved = area(root, 'AREA_OFERTA_01_PRECO_POR');
    ps.run({fill: api => api.offer(0, {'por.price': '39,90'})});
    checkPrice(at(ps.app.documents[0].children[0], OFFERS[0], 'PRECO_POR'), moved, 'POR na área movida');
});

test('Edição parcial: imagem, logo, selo e rodapé trocados sem tocar no resto', () => {
    const ps = photoshop();
    const first = [ps.image('a.png', 500, 500), ps.image('b.png', 500, 500), ps.image('c.png', 500, 500), ps.image('logo.png', 200, 100), ps.image('camp.png', 400, 400)];
    ps.run({fill: api => first.forEach((f, i) => api.choose(i, f))});
    const doc = ps.app.documents[0], root = doc.children[0];
    const untouched = [OFFERS[1], OFFERS[2], '05_CAMPANHA'].map(n => snapshot(at(root, n)));
    const nova = ps.image('nova.png', 800, 400);
    const {alerts} = ps.run({fill: api => {
        api.choose(0, nova); api.clear(3); api.offer(0, {alcohol: true});
        api.general('Validade (destaque)', '01 A 03.10.2026');
    }});
    const after = doc.children[0];
    assert.equal(at(after, OFFERS[0], 'IMG_PRODUTO').image.file, nova.fsName);
    within(at(after, OFFERS[0], 'IMG_PRODUTO').box(), area(after, 'AREA_OFERTA_01_IMAGEM'), 'nova imagem');
    assert.equal(at(after, '01_MARCA').children.length, 0, 'logo removido');
    assert.equal(at(after, OFFERS[0], 'SELO_MODERACAO').visible, true);
    assert.equal(at(after, '06_RODAPE', 'TXT_VALIDADE').textItem.contents, '01 A 03.10.2026');
    assert.deepEqual([OFFERS[1], OFFERS[2], '05_CAMPANHA'].map(n => snapshot(at(after, n))), untouched);
    assert.deepEqual(at(after, OFFERS[0]).children.map(l => l.name).slice(-2), ['IMG_PRODUTO', 'SHP_DIVISORIA']);
    for (const piece of ['oferta principal — imagem', 'oferta principal — selo', 'rodapé', 'logotipo']) assert.ok(alerts[0].includes(piece), piece);
    assert.equal(ps.log.historySteps.length, 1);
    const before = snapshot(doc);
    const again = ps.run();
    assert.match(again.alerts[0], /Nenhum valor mudou/);
    assert.equal(snapshot(doc), before); assert.equal(ps.log.historySteps.length, 1);
    // Imagem de volta num espaço vazio: logo no grupo e produto logo acima do card.
    ps.run({fill: api => { api.choose(3, ps.image('logo2.png', 300, 100)); api.clear(1); }});
    assert.equal(at(doc.children[0], '01_MARCA', 'IMG_LOGO').image.w, 300);
    assert.equal(at(doc.children[0], OFFERS[1]).children.filter(l => l.name === 'IMG_PRODUTO').length, 0);
    ps.run({fill: api => api.choose(1, ps.image('volta.png', 400, 400))});
    assert.deepEqual(at(doc.children[0], OFFERS[1]).children.map(l => l.name).slice(-2), ['IMG_PRODUTO', 'SHP_CARD']);
});

test('Edição parcial com falha ou cancelamento volta ao estado anterior do histórico', () => {
    const ps = photoshop();
    ps.run();
    const doc = ps.app.documents[0], before = snapshot(doc);
    ps.run({fill: api => { api.offer(0, {'por.price': '5,55'}); api.choose(4, ps.image('x.png', 300, 300)); }, failAction: id => id === 'Plc '});
    assert.match(ps.log.alerts.at(-1), /Falha simulada em Plc/);
    assert.equal(snapshot(doc), before, 'documento revertido');
    assert.deepEqual(ps.log.historySteps.slice(-2), ['Ofertas — editar elementos', 'revertido']);
    ps.run({fill: api => api.offer(1, {name: 'OUTRO'}), onProgress: (text, cancel) => { if (/Alterando/.test(text)) cancel(); }});
    assert.match(ps.log.alerts.at(-1), /Operação cancelada/);
    assert.equal(snapshot(doc), before);
    assert.deepEqual(settled(ps), ORIGINAL);
});

test('PSD a 300 ppi com réguas em cm: tamanho certo, mesma geometria e resolução devolvida', () => {
    const ps = photoshop();
    ps.run({fill: api => api.offer(0, {'de.price': '1234,56', 'por.price': '999,99'})});
    const source = ps.app.documents[0];
    const reference = new Map(textLayers(source.children[0]).map(([k, l]) => [k, l.box()]));
    source.resizeImage(undefined, undefined, 300, ps.ResampleMethod.NONE);
    ps.prefs.rulerUnits = Units.CM;
    const before = snapshot(source);
    let size;
    const {alerts} = ps.run({fill: api => { size = api.size(); api.mode(1); }});
    assert.equal(alerts.length, 1, alerts.join('\n'));
    assert.deepEqual(size, {width: '1080', height: '1920', enabled: false});
    const copy = ps.app.documents[1];
    assert.equal(copy.resolution, 300); assert.deepEqual(copy.resizeLog, [72, 300]);
    assert.equal(snapshot(source), before);
    for (const [k, l] of textLayers(copy.children[0])) {
        const a = l.box(), b = reference.get(k);
        if (!b) { assert.equal(a, null, k); continue; }
        a.forEach((v, i) => close(v, b[i], `${k}[${i}]`, 1e-6));
    }
    assert.ok(ps.log.textSizesAt.every(r => r === 72), 'textos criados a 72 ppi');
    assert.ok(ps.log.actions.every(a => a.resolution === 72), 'formas criadas a 72 ppi');
    ps.app.activeDocument = source;
    ps.run({fill: api => api.offer(2, {'por.price': '1,99'})});
    assert.equal(source.resolution, 300); assert.deepEqual(source.resizeLog, [300, 72, 300]);
    assert.ok(ps.log.textSizesAt.every(r => r === 72), 'edição também a 72 ppi');
    assert.equal(ps.prefs.rulerUnits, Units.CM);
});

test('Cancelar no formulário ou na geração não deixa rastro', () => {
    const ps = photoshop();
    const user = ps.open({name: 'cliente.psd', width: 2000, height: 1000, resolution: 150});
    assert.deepEqual(ps.run({cancelDialog: true}).alerts, []);
    assert.deepEqual([...ps.app.documents], [user]);
    assert.equal(ps.log.prefWrites, 0);
    ps.run({onProgress: (text, cancel) => { if (text === 'Montando oferta 2') cancel(); }});
    assert.deepEqual([...ps.app.documents], [user]);
    assert.equal(ps.app.activeDocument, user);
    assert.equal(ps.log.closed.length, 1);
    assert.match(ps.log.alerts.at(-1), /Operação cancelada/);
    assert.deepEqual(settled(ps), ORIGINAL);
    ps.run({fill: api => api.choose(4, ps.image('ruim.png', 10, 10)), failAction: id => id === 'Plc '});
    assert.deepEqual([...ps.app.documents], [user]);
    assert.match(ps.log.alerts.at(-1), /Falha simulada em Plc/);
});

test('Reedição por nova cópia recarrega os dados, mantém imagens e camadas externas', () => {
    const ps = photoshop();
    const files = [0, 1, 2, 3, 4].map(i => ps.image(`img-${i}.png`, 500 + i * 100, 400));
    ps.run({fill: newLayout('VT', api => {
        files.forEach((f, i) => api.choose(i, f));
        api.offer(0, {name: 'CAFÉ TORRADO\nPILÃO 500 G', 'de.unit': 'kg', 'por.label': 'SÓ|R$', alcohol: true});
        api.offer(1, {'de.price': ''});
    })});
    const source = ps.app.documents[0];
    const external = source.artLayers.add(); external.name = 'AJUSTE_DO_USUARIO';
    source.activeLayer = at(source.children.find(l => l.name === ROOT), OFFERS[0], 'PRECO_POR', 'TXT_REAIS');
    const before = snapshot(source);
    let seen;
    ps.run({fill: api => {
        seen = {name: api.offerValue(0, 'name'), unit: api.offerValue(0, 'de.unit'), label: api.offerValue(0, 'por.label'),
            alcohol: api.offerValue(0, 'alcohol'), de2: api.offerValue(1, 'de.price'), status: [0, 1, 2, 3, 4].map(api.imageStatus)};
        api.mode(1);
    }});
    assert.deepEqual(seen, {name: 'CAFÉ TORRADO\nPILÃO 500 G', unit: '/KG', label: 'SÓ|R$', alcohol: true, de2: '', status: Array(5).fill('Imagem atual será mantida')});
    assert.equal(snapshot(source), before);
    const copy = ps.app.documents[1], root = copy.children[0];
    assert.equal(root.name, ROOT);
    assert.equal(copy.children.filter(l => l.name === ROOT).length, 1);
    assert.ok(copy.children.some(l => l.name === 'AJUSTE_DO_USUARIO'));
    assert.equal(at(root, OFFERS[0], 'SELO_MODERACAO').visible, true);
    [at(root, OFFERS[0], 'IMG_PRODUTO'), at(root, OFFERS[1], 'IMG_PRODUTO'), at(root, OFFERS[2], 'IMG_PRODUTO'), at(root, '01_MARCA', 'IMG_LOGO'), at(root, '05_CAMPANHA', 'IMG_CAMPANHA')]
        .forEach((l, i) => assert.equal(l.image.file, files[i].fsName));
    assert.equal(ps.log.actions.filter(a => a.id === 'Plc ').length, 5, 'nenhuma imagem recolocada');
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
