/**
 * Testes automatizados das ferramentas vetoriais multiplataforma:
 * Illustrator (.jsx), Affinity (.js), TraceDraw (.js) e CorelDRAW (.bas).
 *
 * Execucao: npm run test:vetor
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const base = path.resolve(__dirname, '..');
const results = [];

function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, error: e.stack }); }
}

function semIncludes(caminhoRelativo) {
  let texto = fs.readFileSync(path.join(base, caminhoRelativo), 'utf8');
  texto = texto.replace(/^[ \t]*#target[^\n]*$/gm, '');
  const baseDir = path.dirname(path.join(base, caminhoRelativo));
  const inclui = (conteudo, dir) => conteudo.replace(/^[ \t]*#include\s+"([^"]+)"/gm, (_, alvo) => {
    const abs = path.resolve(dir, alvo);
    return inclui(fs.readFileSync(abs, 'utf8'), path.dirname(abs));
  });
  return inclui(texto, baseDir);
}

/* ================================================================== */
/* 1. Adobe Illustrator (.jsx, ExtendScript ES3)                      */
/* ================================================================== */

function mockIllustratorWindow(overrides) {
  function comp(tipo, text) {
    return {
      type: tipo,
      text: typeof text === 'string' ? text : '',
      value: false,
      selection: null,
      children: [],
      preferredSize: {},
      characters: 0,
      add(t, bounds, val) {
        const f = comp(t, typeof val === 'string' ? val : (Array.isArray(val) ? '' : ''));
        if (t === 'dropdownlist' && Array.isArray(val)) {
          f._opcoes = val;
          Object.defineProperty(f, 'selection', {
            get() { return this._selIdx !== undefined && this._selIdx !== null ? { text: this._opcoes[this._selIdx] } : null; },
            set(v) { this._selIdx = typeof v === 'number' ? v : this._opcoes.indexOf(v); }
          });
        }
        this.children.push(f);
        return f;
      }
    };
  }
  return function Window(tipo, titulo) {
    const w = comp(tipo, titulo);
    w.center = () => {};
    w.close = () => {};
    w.update = () => {};
    w.show = () => {
      if (overrides) {
        const visitar = (pai) => {
          for (const g of pai.children || []) {
            if (g.type === 'group') {
              const lbl = g.children[0] && g.children[0].text;
              const ctrl = g.children[1] || g.children[0];
              if (ctrl && overrides[lbl] !== undefined) {
                if (ctrl.type === 'checkbox') ctrl.value = !!overrides[lbl];
                else if (ctrl.type === 'dropdownlist') ctrl.selection = overrides[lbl];
                else ctrl.text = String(overrides[lbl]);
              }
            }
            if (g.children && g.children.length) visitar(g);
          }
        };
        visitar(w);
      }
      return 1;
    };
    return w;
  };
}

function executarIllustrator(caminhoRelativo, doc, overrides) {
  const alerts = [];
  const menuCmds = [];
  const code = semIncludes(caminhoRelativo);
  const layers = doc.layers || [];

  const sandbox = {
    app: {
      name: 'Adobe Illustrator',
      version: '28.0',
      coordinateSystem: 'SCREEN',
      userInteractionLevel: 'DISPLAY',
      documents: doc ? [doc] : [],
      activeDocument: doc,
      textFonts: {
        length: 1,
        0: { name: 'ArialMT' },
        getByName: (n) => {
          if (n === 'ArialMT') return { name: 'ArialMT' };
          throw new Error('Fonte ausente');
        }
      },
      redraw: () => {},
      executeMenuCommand: (cmd) => {
        menuCmds.push(cmd);
        if (cmd === 'expandStyle' && doc.selection && doc.selection.length) {
          doc.selection = doc.selection.map((it) => {
            it._expanded = true;
            return it;
          });
        }
      }
    },
    BridgeTalk: { appName: 'illustrator' },
    CoordinateSystem: { DOCUMENTCOORDINATESYSTEM: 'DOCUMENT' },
    DocumentColorSpace: { CMYK: 'CMYK', RGB: 'RGB' },
    ElementPlacement: { PLACEAFTER: 'after' },
    UserInteractionLevel: { DONTDISPLAYALERTS: 'dont', DISPLAYALERTS: 'display' },
    Justification: { CENTER: 'center' },
    StrokeJoin: { ROUNDENDJOIN: 'round', BEVELENDJOIN: 'bevel', MITERENDJOIN: 'miter' },
    CMYKColor: function () { this.cyan = 0; this.magenta = 0; this.yellow = 0; this.black = 0; },
    RGBColor: function () { this.red = 0; this.green = 0; this.blue = 0; },
    Window: mockIllustratorWindow(overrides),
    Folder: function (p) { this.fsName = p || '/tmp'; this.exists = true; this.create = () => true; },
    File: function (p) {
      this.fsName = p || '/tmp/prefs.json';
      this.exists = false;
      this.encoding = 'UTF-8';
      this.open = () => false;
      this.close = () => {};
    },
    alert: (m) => alerts.push(String(m)),
    confirm: () => true
  };
  sandbox.Folder.userData = new sandbox.Folder('/tmp/ibd-test-prefs');
  sandbox.$ = { global: sandbox, writeln() {} };

  vm.runInContext(code, vm.createContext(sandbox));
  return { alerts, menuCmds, sandbox, doc, layers };
}

for (const rel of [
  'apps/illustrator/scripts/margem-seguranca-guias.jsx',
  'apps/illustrator/scripts/texto-dimensoes-objeto.jsx',
  'apps/illustrator/scripts/deslocamento-expandir-contorno.jsx',
  'apps/illustrator/scripts/criar-papel-padrao.jsx',
  'apps/illustrator/scripts/criar-peca-padrao.jsx',
  'apps/photoshop/scripts/criar-papel-padrao.jsx',
  'apps/photoshop/scripts/criar-peca-padrao.jsx',
  'core/extendscript/ibd-formatos.jsx'
]) {
  test(`${rel}: estritamente ES3 (sem let/const/arrow/template nem chave reservada sem aspas)`, () => {
    const raw = fs.readFileSync(path.join(base, rel), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/"(?:\\.|[^"\\\r\n])*"/g, '""')
      .replace(/'(?:\\.|[^'\\\r\n])*'/g, "''");
    assert.ok(!/\b(let|const|class)\b/.test(raw), 'palavra reservada ES6+ detectada');
    assert.ok(!/=>/.test(raw), 'arrow function detectada');
    assert.ok(!/`/.test(raw), 'template string detectada');
    assert.ok(!/[{,]\s*(in|default|delete|class|var|function|new|try|catch|finally)\s*:/.test(raw), 'chave de objeto com palavra reservada ES3 sem aspas');
  });
}

test('Illustrator margem-seguranca-guias: cria guia interna e restaura estado', () => {
  const criadasGuias = [];
  const doc = {
    documentColorSpace: 'CMYK',
    activeLayer: { name: 'Arte' },
    selection: [],
    artboards: {
      length: 2,
      0: { artboardRect: [0, 283.464567, 283.464567, 0] }, // 100 x 100 mm
      1: { artboardRect: [400, 141.73228, 456.6929, 0] }, // 20 x 50 mm
      getActiveArtboardIndex: () => 0
    },
    layers: [
      {
        name: '06_GUIAS',
        locked: true,
        pathItems: {
          rectangle(t, l, w, h) {
            const it = { top: t, left: l, width: w, height: h, filled: true, stroked: true, guides: false };
            criadasGuias.push(it);
            return it;
          }
        }
      }
    ]
  };

  const res = executarIllustrator('apps/illustrator/scripts/margem-seguranca-guias.jsx', doc, {
    'Margem interna': 10,
    'Unidade': 'mm',
    'Aplicar em todas as pranchetas': false
  });
  assert.equal(criadasGuias.length, 1);
  assert.equal(criadasGuias[0].guides, true);
  assert.equal(criadasGuias[0].filled, false);
  assert.equal(criadasGuias[0].stroked, false);
  assert.ok(Math.abs(criadasGuias[0].width - 80 * (72 / 25.4)) < 1e-3);
  assert.equal(doc.layers[0].locked, true, 'bloqueio original nao foi restaurado');
  assert.equal(res.sandbox.app.coordinateSystem, 'SCREEN', 'coordinateSystem nao restaurado');
});

test('Illustrator texto-dimensoes-objeto: mede selecao combinada e posiciona em 01_TEXTOS', () => {
  const framesCriados = [];
  const camadaArte = { name: 'Arte', locked: false };
  const doc = {
    activeLayer: camadaArte,
    selection: [
      { visibleBounds: [0, 100, 50 * (72 / 25.4), 0], geometricBounds: [0, 100, 50 * (72 / 25.4), 0] },
      { visibleBounds: [10, 50 * (72 / 25.4), 100 * (72 / 25.4), 0], geometricBounds: [10, 50 * (72 / 25.4), 100 * (72 / 25.4), 0] }
    ],
    layers: {
      length: 1,
      0: camadaArte,
      add() {
        const lyr = {
          name: '',
          locked: false,
          textFrames: {
            pointText(pos) {
              const tf = {
                position: pos,
                contents: '',
                visibleBounds: [pos[0] - 20, pos[1] + 10, pos[0] + 20, pos[1]],
                textRange: { characterAttributes: {}, paragraphAttributes: {} },
                translate(dx, dy) { this.position[0] += dx; this.position[1] += dy; }
              };
              framesCriados.push(tf);
              return tf;
            }
          }
        };
        this[this.length] = lyr;
        this.length++;
        return lyr;
      }
    }
  };

  executarIllustrator('apps/illustrator/scripts/texto-dimensoes-objeto.jsx', doc, {
    'Unidade de medida': 'mm',
    'Casas decimais': 1,
    'Usar virgula decimal (padrao PT-BR)': true
  });
  assert.equal(framesCriados.length, 1);
  assert.equal(framesCriados[0].contents, '100,0 x 50,0 mm');
  assert.equal(doc.layers[1].name, '01_TEXTOS');
});

test('Illustrator deslocamento-expandir-contorno: aplica XML Offset Path, expandStyle, Pathfinder e cor CMYK', () => {
  const effectsApplied = [];
  const doc = { documentColorSpace: 'CMYK', _sel: [] };
  function makeItem(isOrig) {
    const it = {
      typename: 'PathItem',
      filled: true,
      stroked: false,
      _selected: isOrig,
      get selected() { return this._selected; },
      set selected(v) {
        this._selected = !!v;
        if (this._selected && !doc._sel.includes(it)) doc._sel.push(it);
        else if (!this._selected) doc._sel = doc._sel.filter((x) => x !== it);
      },
      duplicate() { return makeItem(false); },
      applyEffect(xml) { effectsApplied.push(xml); }
    };
    return it;
  }
  doc._sel = [makeItem(true), makeItem(true)];
  Object.defineProperty(doc, 'selection', {
    get() { return doc._sel; },
    set(v) {
      for (const x of doc._sel) x._selected = false;
      doc._sel = Array.isArray(v) ? v.slice() : [];
      for (const x of doc._sel) x._selected = true;
    }
  });

  const res = executarIllustrator('apps/illustrator/scripts/deslocamento-expandir-contorno.jsx', doc, {
    'Deslocamento (mm)': 2,
    'Cantos (Join)': 'Arredondado',
    'Limite de mitra': 4,
    'Espessura contorno (pt)': 1.5,
    'Cor do contorno': 'Magenta corte (0,100,0,0)',
    'Duplicar antes de aplicar (manter original)': true,
    'Unificar formas resultantes (Pathfinder Add)': true
  });

  assert.equal(effectsApplied.length, 2);
  assert.match(effectsApplied[0], /Adobe Offset Path/);
  assert.match(effectsApplied[0], /I jntp 0 /);
  assert.deepEqual(res.menuCmds, ['expandStyle', 'group', 'Live Pathfinder Add', 'expandStyle']);
  assert.equal(doc.selection[0].filled, false);
  assert.equal(doc.selection[0].stroked, true);
  assert.equal(doc.selection[0].strokeWidth, 1.5);
  assert.equal(doc.selection[0].strokeColor.magenta, 100);
});

test('Illustrator criar-papel-padrao: lista Padrao Nobel primeiro e cria nova prancheta T4 (328x478 mm)', () => {
  const adicionadas = [];
  const guiasCriadas = [];
  const camadaGuias = {
    name: '06_GUIAS',
    locked: true,
    visible: false,
    pathItems: {
      rectangle(t, l, w, h) {
        const g = { top: t, left: l, width: w, height: h, filled: true, stroked: true, guides: false };
        guiasCriadas.push(g);
        return g;
      }
    }
  };
  const abList = [{ name: 'Prancheta 1', artboardRect: [0, 500, 300, 0] }];
  const doc = {
    documentColorSpace: 'CMYK',
    activeLayer: { name: 'Arte', locked: false, visible: true },
    selection: [],
    artboards: Object.assign(abList, {
      getActiveArtboardIndex: () => 0,
      setActiveArtboardIndex: () => {},
      add(rect) {
        const ab = { name: '', artboardRect: rect };
        abList.push(ab);
        adicionadas.push(ab);
        return ab;
      }
    }),
    layers: [camadaGuias]
  };
  executarIllustrator('apps/illustrator/scripts/criar-papel-padrao.jsx', doc, {
    'Papel padrão': 'Padrao Nobel T4 — 328 x 478 mm',
    'Onde criar': 'Nova prancheta no documento aberto',
    'Margem de segurança (mm)': 5,
    'Sangria (mm)': 0
  });
  assert.equal(adicionadas.length, 1);
  const r = adicionadas[0].artboardRect;
  const mm = 72 / 25.4;
  assert.ok(Math.abs((r[2] - r[0]) - 328 * mm) < 1e-2);
  assert.ok(Math.abs((r[1] - r[3]) - 478 * mm) < 1e-2);
  assert.equal(guiasCriadas.length, 1);
  assert.equal(guiasCriadas[0].guides, true);
  assert.equal(camadaGuias.visible, true);
});

test('Illustrator criar-peca-padrao: desenha molde de cartao de visita 90x50 mm na prancheta ativa', () => {
  const moldes = [];
  const camadaArte = {
    name: 'Arte',
    locked: false,
    visible: true,
    pathItems: {
      rectangle(t, l, w, h) {
        const it = { name: '', top: t, left: l, width: w, height: h, filled: true, stroked: false, strokeWidth: 0 };
        moldes.push(it);
        return it;
      }
    }
  };
  const doc = {
    documentColorSpace: 'CMYK',
    activeLayer: camadaArte,
    selection: [],
    artboards: {
      length: 1,
      0: { artboardRect: [0, 1000, 1000, 0] },
      getActiveArtboardIndex: () => 0
    },
    layers: [camadaArte]
  };
  executarIllustrator('apps/illustrator/scripts/criar-peca-padrao.jsx', doc, {
    'Peça gráfica': 'Cartao de visita BR — 90 x 50 mm',
    'Onde criar': 'Desenhar molde na prancheta ativa',
    'Margem de segurança (mm)': 0,
    'Sangria (mm)': 0
  });
  assert.equal(moldes.length, 1);
  const mm = 72 / 25.4;
  assert.ok(Math.abs(moldes[0].width - 90 * mm) < 1e-2);
  assert.ok(Math.abs(moldes[0].height - 50 * mm) < 1e-2);
  assert.equal(moldes[0].filled, false);
  assert.equal(moldes[0].stroked, true);
});

/* ================================================================== */
/* 2. Affinity 3.3+ (.js SDK)                                         */
/* ================================================================== */

function criarAffinityHarness(docMock, dlgOverrides) {
  const noop = () => {};
  const logs = [];
  const req = (mod) => ({
    Document: { current: docMock },
    DocumentCommand: {
      createAddGuide: (horiz, at) => ({ kind: 'guide', horizontal: horiz, at }),
      createTransform: (sel, xf) => ({ kind: 'transform', xf })
    },
    CompoundCommandBuilder: {
      create: () => ({
        cmds: [],
        addCommand(c) { this.cmds.push(c); },
        createCommand() { return { kind: 'compound', cmds: this.cmds }; }
      })
    },
    AddChildNodesCommandBuilder: {
      create: () => ({
        added: [],
        addPolyCurveNode(def) { this.added.push(def); },
        createCommand() { return { kind: 'addNodes', added: this.added }; }
      })
    },
    Dialog: {
      create(title) {
        const ctrls = [];
        const dlg = {
          title,
          initialWidth: 300,
          onControlValueChangedHandler: null,
          addColumn() {
            return {
              addGroup() {
                return {
                  addStaticText(lbl, val) { const c = { lbl, text: val || '' }; ctrls.push(c); return c; },
                  addUnitValueEditor(lbl, u1, u2, def) { const c = { lbl, value: def }; ctrls.push(c); return c; },
                  addCheckBox(lbl, def) { const c = { lbl, value: !!def }; ctrls.push(c); return c; },
                  addComboBox(lbl, opts, idx) { const c = { lbl, opts, selectedIndex: idx }; ctrls.push(c); return c; },
                  addTextBox(lbl, def) { const c = { lbl, text: def }; ctrls.push(c); return c; }
                };
              }
            };
          },
          runModal() {
            if (dlgOverrides) {
              for (const c of ctrls) {
                if (dlgOverrides[c.lbl] !== undefined) {
                  if ('selectedIndex' in c) c.selectedIndex = dlgOverrides[c.lbl];
                  else if ('text' in c) c.text = String(dlgOverrides[c.lbl]);
                  else c.value = dlgOverrides[c.lbl];
                }
              }
            }
            return 1;
          }
        };
        return dlg;
      }
    },
    DialogResult: { Ok: 1, Cancel: 0 },
    UnitType: { Millimetre: 8, Centimetre: 9, Pixel: 5, Point: 7, Inch: 6 },
    Transform: { createTranslate: (x, y) => ({ tx: x, ty: y }) },
    Rectangle: function (x, y, w, h) { this.x = x; this.y = y; this.width = w; this.height = h; },
    Curve: {
      createRectangle: (rc) => ({ kind: 'rect', rc }),
      createEllipse: (rc) => ({ kind: 'ellipse', rc })
    },
    CurveBuilder: {
      create: () => ({
        pts: [],
        closed: false,
        beginXY(x, y) { this.pts.push([x, y]); return this; },
        lineToXY(x, y) { this.pts.push([x, y]); return this; },
        close() { this.closed = true; return this; },
        createCurve() { return { kind: 'poly', pts: this.pts, closed: this.closed }; }
      })
    },
    PolyCurve: {
      create: () => ({
        curves: [],
        get curveCount() { return this.curves.length; },
        addCurve(c) { this.curves.push(c); },
        at(i) { return this.curves[i]; }
      })
    },
    PolyCurveNodeDefinition: {
      create: (poly, brushFill, lineFill, lineStyle) => ({ poly, brushFill, lineFill, lineStyle })
    },
    ArtTextNodeDefinition: {
      createFromStoryBuilder: (pt, sb) => ({ kind: 'artText', pt, sb })
    },
    StoryBuilder: {
      create: () => ({
        glyphAtts: {},
        paragraphAtts: {},
        text: '',
        setToArtisticTextDefaultStyle: noop,
        setGlyphAtts(g) { this.glyphAtts = Object.assign({}, g); },
        setParagraphAtts(p) { this.paragraphAtts = Object.assign({}, p); },
        addText(t) { this.text += t; }
      })
    },
    FillDescriptor: {
      createNone: () => ({ none: true }),
      createSolid: (col) => ({ solid: col })
    },
    BlendMode: { Normal: 0 },
    RGBA8: (r, g, b, a) => ({ r, g, b, alpha: a === undefined ? 255 : a }),
    ParagraphAlignXType: { Left: 0, Centre: 1, Right: 2 },
    LineStyle: { create: (o) => o },
    LineStyleDescriptor: { create: (st, opts) => ({ st, opts }) },
    LineCap: { Butt: 0, Round: 1, Square: 2 },
    LineJoin: { Miter: 1, Round: 2, Bevel: 3 },
    LineType: { Solid: 1, None: 0 },
    StrokeAlignment: { Centre: 0 },
    Selection: { create: (d, n) => ({ doc: d, nodes: n }) },
    NodeChildType: { Main: 0 }
  });

  return { req, logs };
}

test('Affinity margem-seguranca-guias: cria 4 guias nativas em CompoundCommandBuilder', () => {
  const executed = [];
  const mmToPx = 300 / 25.4;
  const doc = {
    dpi: 300,
    units: 'Millimetre',
    hasArtboards: false,
    widthPixels: 100 * mmToPx,
    heightPixels: 80 * mmToPx,
    selection: { length: 0 },
    unitValueConverter: { getConversionFactor: (a, b) => (a === 8 && b === 5 ? mmToPx : 1) },
    clearPreviews: () => {},
    executeCommand(cmd, preview) { if (!preview) executed.push(cmd); }
  };
  const h = criarAffinityHarness(doc, { 'Margem interna': 10 * mmToPx });
  const src = fs.readFileSync(path.join(base, 'apps/affinity/scripts/margem-seguranca-guias.js'), 'utf8');
  vm.runInContext(src, vm.createContext({
    require: h.req,
    console: { log: (m) => h.logs.push(m) },
    Math, Number, String, Array, Object
  }));

  assert.equal(executed.length, 1);
  assert.equal(executed[0].cmds.length, 4);
  assert.equal(executed[0].cmds[0].horizontal, false);
  assert.ok(Math.abs(executed[0].cmds[0].at - 10 * mmToPx) < 1e-4);
  assert.ok(Math.abs(executed[0].cmds[1].at - 90 * mmToPx) < 1e-4);
  assert.ok(Math.abs(executed[0].cmds[3].at - 70 * mmToPx) < 1e-4);
});

test('Affinity texto-dimensoes-objeto: cria ArtTextNode com StoryBuilder e unidade exata', () => {
  const mmToPx = 300 / 25.4;
  const nodesAdded = [];
  const doc = {
    dpi: 300,
    format: 0,
    unitValueConverter: { getConversionFactor: () => mmToPx },
    selection: {
      length: 1,
      items: [{ node: { spreadBaseBox: { x: 20, y: 30, width: 50 * mmToPx, height: 25 * mmToPx } } }],
      nodes: { first: null }
    },
    addNode(def) { nodesAdded.push(def); },
    executeCommand: () => {}
  };
  const h = criarAffinityHarness(doc, { 'Unidade': 0, 'Casas decimais': 1 });
  const src = fs.readFileSync(path.join(base, 'apps/affinity/scripts/texto-dimensoes-objeto.js'), 'utf8');
  vm.runInContext(src, vm.createContext({
    require: h.req,
    console: { log: (m) => h.logs.push(m) },
    Math, Number, String, Array, Object, isFinite
  }));

  assert.equal(nodesAdded.length, 1);
  assert.equal(nodesAdded[0].sb.text, '50,0 x 25,0 mm');
});

test('Affinity deslocamento-expandir-contorno: desloca retangulo exato e poligono livre com geometria externa', () => {
  const mmToPx = 96 / 25.4;
  const cmds = [];
  const retangulo = {
    polyCurve: {
      curveCount: 1,
      at: () => ({
        isRectangle: true,
        isEllipse: false,
        getBoundingBox: () => ({ x: 10, y: 20, width: 100, height: 50 })
      })
    }
  };
  const poligono = {
    polyCurve: {
      curveCount: 1,
      at: () => ({
        isRectangle: false,
        isEllipse: false,
        isClosed: true,
        beziers: [
          { start: { x: 0, y: 0 }, c1: { x: 0, y: 0 }, c2: { x: 10, y: 0 }, end: { x: 10, y: 0 }, evaluate: (t) => ({ x: 10 * t, y: 0 }) },
          { start: { x: 10, y: 0 }, c1: { x: 10, y: 0 }, c2: { x: 10, y: 10 }, end: { x: 10, y: 10 }, evaluate: (t) => ({ x: 10, y: 10 * t }) },
          { start: { x: 10, y: 10 }, c1: { x: 10, y: 10 }, c2: { x: 0, y: 10 }, end: { x: 0, y: 10 }, evaluate: (t) => ({ x: 10 * (1 - t), y: 10 }) },
          { start: { x: 0, y: 10 }, c1: { x: 0, y: 10 }, c2: { x: 0, y: 0 }, end: { x: 0, y: 0 }, evaluate: (t) => ({ x: 0, y: 10 * (1 - t) }) }
        ]
      })
    }
  };

  const doc = {
    dpi: 96,
    unitValueConverter: { getConversionFactor: () => mmToPx },
    selection: { length: 2, items: [{ node: retangulo }, { node: poligono }] },
    executeCommand(c) { cmds.push(c); },
    boolOpUnion: () => {},
    deleteSelection: () => {}
  };
  const h = criarAffinityHarness(doc, { 'Deslocamento (+ / -)': 5 });
  const src = fs.readFileSync(path.join(base, 'apps/affinity/scripts/deslocamento-expandir-contorno.js'), 'utf8');
  vm.runInContext(src, vm.createContext({
    require: h.req,
    console: { log: (m) => h.logs.push(m) },
    Math, Number, String, Array, Object, parseFloat, isNaN
  }));

  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].added.length, 2);
  // Retangulo 100x50 deslocado +5px => x=5, y=15, w=110, h=60
  const rc = cmds[0].added[0].poly.curves[0].rc;
  assert.deepEqual({ x: rc.x, y: rc.y, w: rc.width, h: rc.height }, { x: 5, y: 15, w: 110, h: 60 });
  // Quadrado poligonal 0..10 deslocado +5px => vertices -5..15
  const pts = cmds[0].added[1].poly.curves[0].pts;
  const minPx = Math.min(...pts.map((p) => p[0]));
  const maxPx = Math.max(...pts.map((p) => p[0]));
  assert.ok(Math.abs(minPx - (-5)) < 1e-4 && Math.abs(maxPx - 15) < 1e-4, `Esperado -5..15, obtido ${minPx}..${maxPx}`);
  assert.equal(cmds[0].added[0].brushFill.none, true);
});

/* ================================================================== */
/* 3. TraceDraw (.js painel Scripts)                                  */
/* ================================================================== */

test('TraceDraw scripts: executam fluxo completo de guias, texto e contorno SVG', () => {
  const criados = [];
  const logs = [];
  const fakeLayer = {
    Name: '06_GUIAS',
    Locked: false,
    CreateRectangle(x, y, w, h) {
      const sh = { id: criados.length + 1, kind: 'rect', x, y, w, h, Fill: { ApplyNoFill() { sh.noFill = true; } }, Outline: { SetProperties(sw, col) { sh.sw = sw; sh.col = col; } } };
      criados.push(sh);
      return sh;
    },
    CreateArtisticText(x, y, t) {
      const sh = {
        id: criados.length + 1, kind: 'text', x, y, text: t,
        Fill: { ApplyUniformFill() {} }, Outline: { SetNoOutline() {} },
        Bounds: { left: x - 5, bottom: y, right: x + 5, top: y + 4, centerX: x, centerY: y + 2 },
        Move(dx, dy) { this.x += dx; this.y += dy; }
      };
      criados.push(sh);
      return sh;
    },
    CreatePath(d) {
      const sh = { id: criados.length + 1, kind: 'path', d, Fill: { ApplyNoFill() { sh.noFill = true; } }, Outline: { SetProperties(sw) { sh.sw = sw; } } };
      criados.push(sh);
      return sh;
    }
  };

  const selItem = {
    id: 99,
    Name: 'Caixa',
    Type: 'rect',
    Bounds: { left: 10, bottom: 10, right: 60, top: 40, centerX: 35, centerY: 25 },
    PathData: 'M 10 10 L 60 10 L 60 40 L 10 40 Z',
    Delete() {}
  };

  const makeCtx = () => ({
    ActivePage: { SizeWidth: 210, SizeHeight: 297, Layers: { Find: () => null }, CreateLayer: () => fakeLayer },
    ActiveDocument: {
      Selection: {
        Count: 1,
        forEach: (cb) => cb(selItem)
      },
      Pages: { forEach: (cb) => cb({ SizeWidth: 210, SizeHeight: 297, Layers: { Find: () => null }, CreateLayer: () => fakeLayer }) }
    },
    ActiveLayer: fakeLayer,
    Color: { CMYK: (c, m, y, k) => ({ c, m, y, k }), RGB: (r, g, b) => ({ r, g, b }) },
    ShapeRange: function (ids) { this.ids = ids; this.CreateSelection = () => {}; },
    print: (m) => logs.push(String(m)),
    Math, String, Number, Array, Object, isNaN, isFinite, parseFloat
  });

  vm.runInContext(fs.readFileSync(path.join(base, 'apps/tracedraw/scripts/margem-seguranca-guias.js'), 'utf8'), vm.createContext(makeCtx()));
  assert.equal(criados[0].w, 200);
  assert.equal(criados[0].h, 287);
  assert.equal(criados[0].noFill, true);

  vm.runInContext(fs.readFileSync(path.join(base, 'apps/tracedraw/scripts/texto-dimensoes-objeto.js'), 'utf8'), vm.createContext(makeCtx()));
  assert.equal(criados[1].text, '50,0 x 30,0 mm');

  vm.runInContext(fs.readFileSync(path.join(base, 'apps/tracedraw/scripts/deslocamento-expandir-contorno.js'), 'utf8'), vm.createContext(makeCtx()));
  assert.equal(criados[2].kind, 'path');
  assert.equal(criados[2].noFill, true);
  assert.match(criados[2].d, /^M 8\.0000 8\.0000 L 62\.0000 8\.0000 L 62\.0000 42\.0000 L 8\.0000 42\.0000 Z$/);
});

/* ================================================================== */
/* 4. CorelDRAW (.bas VBA)                                            */
/* ================================================================== */

test('CorelDRAW .bas: Attribute VB_Name unicos, CRLF, API valida e novos papeis Nobel/pecas', () => {
  const mods = [
    'apps/coreldraw/scripts/margem-seguranca-guias.bas',
    'apps/coreldraw/scripts/texto-dimensoes-objeto.bas',
    'apps/coreldraw/scripts/deslocamento-expandir-contorno.bas',
    'apps/coreldraw/scripts/criar-papel-padrao.bas',
    'apps/coreldraw/scripts/criar-peca-padrao.bas'
  ];
  const nomes = new Set();
  for (const rel of mods) {
    const src = fs.readFileSync(path.join(base, rel), 'utf8');
    const m = src.match(/^Attribute\s+VB_Name\s*=\s*"([^"]+)"/m);
    assert.ok(m, `${rel}: falta Attribute VB_Name`);
    assert.ok(!nomes.has(m[1]), `${rel}: VB_Name duplicado ${m[1]}`);
    nomes.add(m[1]);
    assert.ok(src.includes('\r\n'), `${rel}: precisa usar quebras de linha CRLF`);
    assert.match(src, /BeginCommandGroup/);
    assert.match(src, /EndCommandGroup/);
    assert.match(src, /Option Explicit/);
  }
  const guias = fs.readFileSync(path.join(base, mods[0]), 'utf8');
  assert.match(guias, /\.CreateGuide\s+xMin \+ m,\s*yMin,\s*xMin \+ m,\s*yMax/);
  const contorno = fs.readFileSync(path.join(base, mods[2]), 'utf8');
  assert.match(contorno, /\.CreateContour\b/);
  assert.match(contorno, /\.Separate\b/);
  assert.match(contorno, /\.Fill\.ApplyNoFill\b/);
  const papel = fs.readFileSync(path.join(base, mods[3]), 'utf8');
  assert.ok(papel.indexOf('Padrao Nobel T9|220|380') < papel.indexOf('A4|210|297'), 'Padrao Nobel deve vir antes de A4');
  assert.match(papel, /Padrao Nobel T4\|328\|478/);
  const peca = fs.readFileSync(path.join(base, mods[4]), 'utf8');
  assert.match(peca, /Cartao de visita BR\|90\|50/);
  assert.match(peca, /Panfleto 140x100\|140\|100/);
  assert.match(peca, /Panfleto 140x200\|140\|200/);
  assert.match(peca, /Panfleto \/ Postal 100x150\|100\|150/);

  const fecharPdf = fs.readFileSync(path.join(base, 'nobel/desktop/fechar-pdf-corel.bas'), 'utf8');
  assert.ok(!/\.ColorBars\b/.test(fecharPdf), 'fechar-pdf-corel.bas nao pode usar PDFSettings.ColorBars inexistente');
  assert.match(fecharPdf, /DensitometerScales/);
});

/* Resultado -------------------------------------------------------- */

const falhas = results.filter((r) => !r.ok);
for (const r of results) {
  console.log((r.ok ? '  ok   ' : '  FALHA') + '  ' + r.name);
  if (!r.ok) console.log(r.error.split('\n').map((l) => '         ' + l).join('\n'));
}
console.log(`\n${results.length - falhas.length}/${results.length} testes de ferramentas vetoriais passaram.`);
if (falhas.length) process.exit(1);
