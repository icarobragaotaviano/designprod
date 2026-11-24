/**
 * Verificações locais das Marcas de medida.
 * Contas reais; contratos do Photoshop simulados, sem executar Adobe.
 * Uso: npm run test:medida
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
/** Objetos criados dentro do vm têm outro protótipo: normaliza antes de comparar. */
function puro(v) { return JSON.parse(JSON.stringify(v)); }
function perto(a, b, tol) {
  assert.ok(Math.abs(a - b) <= (tol === undefined ? 0.5 : tol), `${a} está longe de ${b}`);
}

const H = '\u200A';

/* ------------------------------------------------------------------ *
 * Carga do ExtendScript em Node: resolve #include e remove #target
 * ------------------------------------------------------------------ */

function fonte(arquivo, vistos) {
  const abs = path.resolve(base, arquivo);
  if (vistos.has(abs)) return '';
  vistos.add(abs);
  return fs.readFileSync(abs, 'utf8')
    .replace(/^[ \t]*#target[^\n]*$/gm, '')
    .replace(/^[ \t]*#include[ \t]+"([^"]+)"[ \t]*$/gm, (_, alvo) =>
      fonte(path.relative(base, path.resolve(path.dirname(abs), alvo)), vistos));
}

function contextoMotor() {
  const sandbox = { alert() {}, confirm: () => true };
  sandbox.$ = { global: sandbox, writeln() {} };
  sandbox.BridgeTalk = { appName: 'photoshop' };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fonte('core/extendscript/ibd-medida.jsx', new Set()), ctx);
  return ctx.IBD.medida;
}

const M = contextoMotor();
const O = (o) => M.normalizar(o || {});

/* ------------------------------------------------------------------ *
 * 1. Números e rótulo
 * ------------------------------------------------------------------ */

test('Conversão: 300 px a 300 ppi são 25,4 mm, 2,54 cm e 72 pt', () => {
  perto(M.converter(300, 'mm', 300), 25.4, 1e-9);
  perto(M.converter(300, 'cm', 300), 2.54, 1e-9);
  perto(M.converter(300, 'pt', 300), 72, 1e-9);
  assert.equal(M.converter(300, 'px', 300), 300);
});

test('Arredondamento meio para cima, sem o erro do toFixed', () => {
  assert.equal(M.numero(0.35, 1, ',', false), '0,4');
  assert.equal(M.numero(1.005, 2, ',', true), '1,01');
  assert.equal(M.numero(12.5, 2, ',', true), '12,50');
  assert.equal(M.numero(12.5, 2, ',', false), '12,5');
  assert.equal(M.numero(25, 1, ',', false), '25');
  assert.equal(M.numero(-0.04, 1, ',', false), '0', 'não pode sair "-0"');
  assert.equal(M.numero(1920, 0, ',', false), '1920');
  assert.equal(M.numero(2.54, 2, '.', true), '2.54');
});

test('Rótulo: unidade principal, px junto e espaço fino antes da unidade', () => {
  assert.equal(M.rotulo(200, 300, O({ unidade: 'mm' })), `16,9${H}mm / 200${H}px`);
  assert.equal(M.rotulo(200, 300, O({ unidade: 'mm', mostrarPx: false })), `16,9${H}mm`);
  assert.equal(M.rotulo(200, 300, O({ unidade: 'px', mostrarPx: true })), `200${H}px`, 'px não se repete');
  assert.equal(M.rotulo(300, 300, O({ unidade: 'cm', separador: '.', decimais: 3 })), `2.540${H}cm / 300${H}px`);
  assert.equal(M.rotulo(144, 144, O({ unidade: 'pt' })), `72${H}pt / 144${H}px`, 'o "pt / px" do Size Marks');
});

/* ------------------------------------------------------------------ *
 * 2. Opções
 * ------------------------------------------------------------------ */

test('Padrões: vazio vira o padrão, chave estranha é ignorada, número em texto é aceito', () => {
  const o = puro(M.normalizar({ tamanhoTexto: '12,5', fonte: '  ', lixo: 1 }));
  assert.equal(o.tamanhoTexto, 12.5);
  assert.equal(o.fonte, 'ArialMT');
  assert.equal(o.lixo, undefined);
  assert.deepEqual(puro(O()), {
    dimensao: 'auto', unidade: 'px', decimais: 'auto', separador: ',',
    mostrarPx: true, posicao: 'inicio', tamanhoTexto: 10, fonte: 'ArialMT'
  });
});

test('Opções impossíveis são recusadas com mensagem, não adivinhadas', () => {
  assert.throws(() => O({ unidade: 'pol' }), /Unidade desconhecida/);
  assert.throws(() => O({ dimensao: 'diagonal' }), /Dimensão desconhecida/);
  assert.throws(() => O({ posicao: 'meio' }), /Posição desconhecida/);
  assert.throws(() => O({ decimais: 7 }), /Casas decimais/);
  assert.throws(() => O({ decimais: 1.5 }), /Casas decimais/);
  assert.throws(() => O({ separador: ';' }), /Separador/);
  assert.throws(() => O({ tamanhoTexto: 0 }), /tamanho do texto/);
  assert.throws(() => O({ tamanhoTexto: 'grande' }), /tamanho do texto/);
  assert.throws(() => M.converter(10, 'mm', 0), /Resolução/);
});

/* ------------------------------------------------------------------ *
 * 3. Geometria
 * ------------------------------------------------------------------ */

test('Regra automática do Size Marks: paisagem mede largura; retrato e quadrado, altura', () => {
  assert.deepEqual(puro(M.eixos(200, 100, 'auto')), ['largura']);
  assert.deepEqual(puro(M.eixos(100, 200, 'auto')), ['altura']);
  assert.deepEqual(puro(M.eixos(100, 100, 'auto')), ['altura']);
  assert.deepEqual(puro(M.eixos(100, 200, 'largura')), ['largura']);
  assert.deepEqual(puro(M.eixos(100, 200, 'ambas')), ['largura', 'altura']);
});

test('Métricas: 72 ppi reproduz o desenho original; 300 ppi engrossa a linha', () => {
  assert.deepEqual(puro(M.metricas(72)), { espessura: 1, haste: 3, afastamento: 5 });
  assert.deepEqual(puro(M.metricas(300)), { espessura: 4, haste: 13, afastamento: 21 });
  assert.deepEqual(puro(M.metricas(144)), { espessura: 2, haste: 6, afastamento: 10 });
});

test('Largura: linha no topo com o comprimento exato da seleção e hastes simétricas', () => {
  const p = M.planejar({ x: 10, y: 20, w: 200, h: 50 }, 72, {});
  assert.deepEqual(puro(p.retangulos), [[10, 20, 210, 21], [10, 17, 11, 24], [209, 17, 210, 24]]);
  assert.equal(p.rotulos.length, 1);
  assert.equal(p.rotulos[0].texto, `200${H}px`);
  assert.deepEqual(puro(p.rotulos[0].alvo), { orientacao: 'h', centro: 110, antes: 15, depois: 26, lado: 'antes' });
  assert.equal(p.nome, 'Medida L 200 px');
});

test('Altura: linha na borda esquerda e rótulo do lado de fora', () => {
  const p = M.planejar({ x: 10, y: 20, w: 50, h: 200 }, 72, {});
  assert.deepEqual(puro(p.retangulos), [[10, 20, 11, 220], [7, 20, 14, 21], [7, 219, 14, 220]]);
  assert.deepEqual(puro(p.rotulos[0].alvo), { orientacao: 'v', centro: 120, antes: 5, depois: 16, lado: 'antes' });
  assert.equal(p.nome, 'Medida A 200 px');
});

test('Posição "fim" leva a linha para a base ou a direita e o rótulo para fora', () => {
  const h = M.planejar({ x: 10, y: 20, w: 200, h: 50 }, 72, { posicao: 'fim' });
  assert.deepEqual(puro(h.retangulos[0]), [10, 69, 210, 70]);
  assert.equal(h.rotulos[0].alvo.lado, 'depois');
  const v = M.planejar({ x: 10, y: 20, w: 50, h: 200 }, 72, { posicao: 'fim' });
  assert.deepEqual(puro(v.retangulos[0]), [59, 20, 60, 220]);
  assert.equal(v.rotulos[0].alvo.lado, 'depois');
});

test('Posição "centro" põe a linha no meio da seleção', () => {
  const p = M.planejar({ x: 0, y: 0, w: 200, h: 51 }, 72, { posicao: 'centro' });
  assert.deepEqual(puro(p.retangulos[0]), [0, 25, 200, 26]);
});

test('Largura e altura: duas linhas, dois rótulos e o nome com as duas medidas', () => {
  const p = M.planejar({ x: 0, y: 0, w: 300, h: 150 }, 300, { dimensao: 'ambas', unidade: 'mm' });
  assert.equal(p.retangulos.length, 6);
  assert.deepEqual(puro(p.rotulos.map((r) => r.texto)), [`25,4${H}mm / 300${H}px`, `12,7${H}mm / 150${H}px`]);
  assert.equal(p.nome, 'Medida 25,4 × 12,7 mm');
  assert.deepEqual(puro(p.retangulos[0]), [0, 0, 300, 4], 'linha de 4 px a 300 ppi');
});

test('Duas linhas no centro: cada rótulo vai para uma metade, longe do cruzamento', () => {
  const p = M.planejar({ x: 0, y: 0, w: 200, h: 100 }, 72, { dimensao: 'ambas', posicao: 'centro' });
  assert.equal(p.rotulos[0].alvo.centro, (0 + 99) / 2);
  assert.equal(p.rotulos[1].alvo.centro, (49 + 1 + 100) / 2);
});

test('Seleção com borda fracionada é arredondada ao pixel', () => {
  const p = M.planejar({ x: 10.4, y: 20.6, w: 99.8, h: 10 }, 72, { dimensao: 'largura' });
  assert.deepEqual(puro(p.caixa), { x: 10, y: 21, w: 100, h: 10 });
  assert.throws(() => M.planejar({ x: 0, y: 0, w: 0.2, h: 10 }, 72, {}), /1 px/);
});

/* ------------------------------------------------------------------ *
 * 4. Encaixe do rótulo
 * ------------------------------------------------------------------ */

const TELA = { w: 1000, h: 1000 };

test('Encaixe: acima quando cabe; abaixo quando sairia pelo topo', () => {
  const alvo = { orientacao: 'h', centro: 110, antes: 15, depois: 26, lado: 'antes' };
  assert.deepEqual(puro(M.encaixar(alvo, { w: 40, h: 10 }, TELA)), { x: 90, y: 5, lado: 'antes', virou: false });
  const topo = Object.assign({}, alvo, { antes: 5 });
  assert.deepEqual(puro(M.encaixar(topo, { w: 40, h: 10 }, TELA)), { x: 90, y: 26, lado: 'depois', virou: true });
});

test('Encaixe: na borda esquerda vira para a direita e é empurrado para dentro ao longo da linha', () => {
  const alvo = { orientacao: 'v', centro: 3, antes: 5, depois: 16, lado: 'antes' };
  assert.deepEqual(puro(M.encaixar(alvo, { w: 40, h: 10 }, TELA)), { x: 16, y: 0, lado: 'depois', virou: true });
});

test('Encaixe: sem espaço dos dois lados, fica no lado pedido', () => {
  const alvo = { orientacao: 'h', centro: 5, antes: 2, depois: 8, lado: 'antes' };
  const p = puro(M.encaixar(alvo, { w: 40, h: 30 }, { w: 10, h: 10 }));
  assert.equal(p.lado, 'antes');
  assert.equal(p.virou, false);
  assert.equal(p.x, 0);
});

test('Encaixe: a área pode ser uma prancheta fora da origem da tela', () => {
  const alvo = { orientacao: 'h', centro: 300, antes: 205, depois: 216, lado: 'antes' };
  const prancheta = { x: 100, y: 200, w: 400, h: 300 };
  // Acima da linha haveria tela, mas não prancheta: o rótulo desce.
  assert.deepEqual(puro(M.encaixar(alvo, { w: 40, h: 10 }, prancheta)), { x: 280, y: 216, lado: 'depois', virou: true });
  // Ao longo da linha, fica dentro da prancheta.
  const canto = Object.assign({}, alvo, { centro: 105 });
  assert.equal(M.encaixar(canto, { w: 40, h: 10 }, prancheta).x, 100);
});

/* ------------------------------------------------------------------ *
 * 5. Scripts completos, com o Photoshop simulado
 * ------------------------------------------------------------------ */

const NUCLEO = [
  'core/extendscript/ibd-ui.jsx',
  'core/extendscript/ibd-prefs.jsx',
  'core/extendscript/ibd-ps-medida.jsx'
];
const ATALHO = 'apps/photoshop/scripts/marcas-medida.jsx';
const OPCOES = 'apps/photoshop/scripts/marcas-medida-opcoes.jsx';

const DocumentMode = {
  RGB: 'DocumentMode.RGB', CMYK: 'DocumentMode.CMYK', BITMAP: 'DocumentMode.BITMAP',
  INDEXEDCOLOR: 'DocumentMode.INDEXEDCOLOR', MULTICHANNEL: 'DocumentMode.MULTICHANNEL'
};

function ambiente(config) {
  const cfg = config || {};
  const alertas = [];
  const historico = [];
  const gravadas = [];
  const dialogos = [];
  const respostas = (cfg.respostas || []).slice();
  let ctx;
  let proximoId = 1;

  function UV(n) { return { value: Number(n), as: () => Number(n) }; }
  const corFrente = { nome: 'cor da frente' };
  const resolucao = cfg.resolucao || 72;

  /* Camadas ---------------------------------------------------------- */

  function tirar(camada) {
    const lista = camada.parent.layers;
    lista.splice(lista.indexOf(camada), 1);
  }

  function mover(camada, relativa, onde) {
    if (cfg.falhaMover) throw new Error('Falha simulada ao mover');
    tirar(camada);
    if (onde === 'begin') {
      assert.equal(relativa.typename, 'LayerSet', 'PLACEATBEGINNING só vale para grupo');
      relativa.layers.unshift(camada);
      camada.parent = relativa;
    } else {
      assert.equal(onde, 'before');
      const lista = relativa.parent.layers;
      lista.splice(lista.indexOf(relativa), 0, camada);
      camada.parent = relativa.parent;
    }
  }

  function novaCamada(pai, nome) {
    const c = {
      typename: 'ArtLayer', id: proximoId++, name: nome || 'Camada ' + proximoId,
      parent: pai, pixels: [], textItem: null, _dx: 0, _dy: 0, _kind: 'NORMAL'
    };
    Object.defineProperty(c, 'kind', {
      get: () => c._kind,
      set: (v) => {
        assert.equal(v, 'TEXT');
        assert.equal(c.pixels.length, 0, 'só camada vazia vira texto');
        c._kind = v;
        c.textItem = textItem();
      }
    });
    Object.defineProperty(c, 'bounds', {
      get: () => {
        if (!c.textItem) return [0, 0, 0, 0].map(UV);
        const t = c.textItem;
        const corpo = t.size * resolucao / 72;
        const largura = t.contents.length * corpo * 0.5;
        const x = t._pos[0] + c._dx;
        const y = t._pos[1] + c._dy;   // linha de base
        return [x, y - corpo * 0.72, x + largura, y + corpo * 0.21].map(UV);
      }
    });
    c.translate = (dx, dy) => {
      c._dx += dx.value;
      c._dy += dy.value;
      // Re-aninhamento automático das pranchetas: a camada movida sai do grupo.
      if (cfg.reaninhar && c.textItem) {
        tirar(c);
        doc.layers.unshift(c);
        c.parent = raiz;
      }
    };
    c.move = (rel, onde) => mover(c, rel, onde);
    return c;
  }

  function textItem() {
    const t = { contents: '', _size: 12, _font: 'MyriadPro-Regular', color: null, justification: null, _pos: [0, 0] };
    Object.defineProperties(t, {
      size: {
        get: () => t._size,
        set: (v) => {
          assert.equal(sandbox.app.preferences.typeUnits, 'pt', 'o corpo precisa ser dado com a unidade de texto em pontos');
          t._size = v;
        }
      },
      font: {
        get: () => t._font,
        set: (v) => {
          assert.ok(fontesInstaladas.some((f) => f.postScriptName === v), 'fonte não instalada: ' + v);
          t._font = v;
        }
      },
      position: {
        get: () => t._pos.map(UV),
        set: (v) => { t._pos = [v[0].value, v[1].value]; }
      }
    });
    return t;
  }

  function novoGrupo(pai, nome, filhos, prancheta) {
    const g = { typename: 'LayerSet', id: proximoId++, name: nome || 'Grupo', parent: pai, layers: [], _prancheta: prancheta };
    g.artLayers = {
      add: () => {
        const c = novaCamada(g);
        g.layers.unshift(c);
        doc.activeLayer = c;
        return c;
      }
    };
    g.move = (rel, onde) => mover(g, rel, onde);
    for (const f of filhos || []) {
      const c = f.filhos ? novoGrupo(g, f.nome, f.filhos) : novaCamada(g, f.nome);
      g.layers.push(c);
    }
    return g;
  }

  /* Documento -------------------------------------------------------- */

  let selecao = cfg.selecao ? [cfg.selecao.x, cfg.selecao.y, cfg.selecao.x + cfg.selecao.w, cfg.selecao.y + cfg.selecao.h] : null;

  const doc = {
    name: 'Teste.psd',
    resolution: resolucao,
    mode: cfg.modo || DocumentMode.RGB,
    quickMaskMode: !!cfg.mascaraRapida,
    layers: [],
    activeLayer: null,
    selection: {
      select(regiao, tipo, difusao, suavizar) {
        assert.equal(difusao, 0);
        assert.equal(suavizar, false, 'linha sem suavização sai no pixel exato');
        const r = [regiao[0][0], regiao[0][1], regiao[2][0], regiao[2][1]];
        if (tipo === 'replace') doc.selection._retangulos = [r];
        else { assert.equal(tipo, 'extend'); doc.selection._retangulos.push(r); }
        selecao = r;
      },
      fill(cor, modo, opacidade, preservar) {
        if (cfg.falhaPreencher) throw new Error('Falha simulada ao preencher');
        assert.equal(modo, 'normal');
        assert.equal(opacidade, 100);
        assert.equal(preservar, false);
        doc.activeLayer.pixels.push(...doc.selection._retangulos.map((r) => ({ r, cor })));
      },
      deselect() { selecao = null; doc.selection._retangulos = []; },
      _retangulos: []
    },
    suspendHistory(rotulo, codigo) {
      historico.push(rotulo);
      vm.runInContext(codigo, ctx);
    }
  };
  Object.defineProperty(doc.selection, 'bounds', {
    get: () => {
      if (!selecao) throw new Error('Não há seleção');
      return selecao.map(UV);
    }
  });
  Object.defineProperties(doc, {
    width: { get: () => UV(cfg.largura || 1000) },
    height: { get: () => UV(cfg.altura || 800) },
    activeHistoryState: {
      get: () => instantaneo(),
      set: (s) => restaurar(s)
    }
  });

  const raiz = { typename: 'Document', layers: doc.layers };
  doc.layerSets = {
    add: () => {
      const g = novoGrupo(raiz);
      doc.layers.unshift(g);
      doc.activeLayer = g;
      return g;
    }
  };
  for (const spec of cfg.camadas || [{ nome: 'Fundo' }]) {
    doc.layers.push(spec.filhos ? novoGrupo(raiz, spec.nome, spec.filhos, spec.prancheta) : novaCamada(raiz, spec.nome));
  }
  doc.activeLayer = doc.layers[cfg.ativa || 0];

  function grupos(lista, saida) {
    for (const c of lista) if (c.layers) { saida.push(c); grupos(c.layers, saida); }
    return saida;
  }
  function instantaneo() {
    return {
      raiz: doc.layers.slice(),
      filhos: grupos(doc.layers, []).map((g) => [g, g.layers.slice()]),
      selecao: selecao && selecao.slice(),
      ativa: doc.activeLayer
    };
  }
  function restaurar(s) {
    doc.layers.splice(0, doc.layers.length, ...s.raiz);
    for (const [g, filhos] of s.filhos) g.layers.splice(0, g.layers.length, ...filhos);
    selecao = s.selecao;
    doc.activeLayer = s.ativa;
  }

  /* App --------------------------------------------------------------- */

  const fontesInstaladas = (cfg.fontes || ['ArialMT', 'Helvetica']).map((f) =>
    typeof f === 'string' ? { name: f, family: f, style: 'Regular', postScriptName: f } : f);
  const fonts = fontesInstaladas.slice();
  fonts.getByName = (nome) => {
    const f = fontesInstaladas.find((x) => x.postScriptName === nome);
    if (!f) throw new Error('Fonte não encontrada: ' + nome);
    return f;
  };

  const app = {
    name: 'Adobe Photoshop',
    version: '27.0',
    documents: cfg.semDocumento ? [] : [doc],
    activeDocument: cfg.semDocumento ? null : doc,
    foregroundColor: corFrente,
    fonts,
    preferences: { rulerUnits: 'mm', typeUnits: 'mm-tipo' }
  };

  // Action Manager: só o que areaVisivel pergunta sobre pranchetas.
  function ActionReference() {
    this.putIdentifier = (classe, id) => { assert.equal(classe, 'layer'); this._id = id; };
  }
  function executeActionGet(ref) {
    const g = grupos(doc.layers, []).find((x) => x.id === ref._id);
    const r = g && g._prancheta;
    const retangulo = r && { top: r.y, left: r.x, bottom: r.y + r.h, right: r.x + r.w };
    return {
      hasKey: (k) => k === 'artboardEnabled',
      getBoolean: () => !!r,
      getObjectValue: (k) => {
        assert.equal(k, 'artboard');
        return { getObjectValue: () => ({ getDouble: (lado) => retangulo[lado] }) };
      }
    };
  }

  function UnitValue(n, unidade) {
    assert.equal(unidade, 'px');
    return UV(n);
  }

  const sandbox = {
    app, UnitValue, DocumentMode,
    stringIDToTypeID: (x) => x,
    Units: { PIXELS: 'px' },
    TypeUnits: { POINTS: 'pt' },
    SelectionType: { REPLACE: 'replace', EXTEND: 'extend' },
    ColorBlendMode: { NORMAL: 'normal' },
    ElementPlacement: { PLACEBEFORE: 'before', PLACEATBEGINNING: 'begin' },
    LayerKind: { TEXT: 'TEXT', NORMAL: 'NORMAL' },
    Justification: { LEFT: 'left' },
    BridgeTalk: { appName: 'photoshop' },
    alert: (m) => alertas.push(String(m)),
    confirm: () => true,
    Window: function () { throw new Error('O teste não deve abrir janela real'); }
  };
  if (cfg.actionManager) Object.assign(sandbox, { ActionReference, executeActionGet });
  sandbox.$ = { global: sandbox, writeln() {} };
  ctx = vm.createContext(sandbox);

  const vistos = new Set();
  for (const arquivo of NUCLEO) vm.runInContext(fonte(arquivo, vistos), ctx);

  // Preferências e formulário são substituídos: o teste responde o diálogo.
  sandbox.IBD.prefs = {
    ler: (id) => { assert.equal(id, 'photoshop/marcas-medida'); return cfg.salvas || {}; },
    gravar: (id, v) => gravadas.push({ id, v: puro(v) })
  };
  sandbox.IBD.ui.formulario = (titulo, campos, ok) => {
    dialogos.push({ titulo, campos: puro(campos), ok });
    return respostas.length ? respostas.shift() : null;
  };

  return {
    doc, app, alertas, historico, gravadas, dialogos, corFrente,
    selecao: () => selecao,
    rodar(arquivo) {
      vm.runInContext(fonte(arquivo, new Set(NUCLEO.map((f) => path.resolve(base, f)))), ctx);
      return this;
    }
  };
}

function nomes(lista) { return lista.map((c) => c.name); }
function caixa(camada) { return camada.bounds.map((u) => u.value); }
function retangulos(camada) { return camada.pixels.map((p) => p.r); }

test('Atalho: seleção paisagem vira cota de largura num grupo logo acima da camada ativa', () => {
  const amb = ambiente({
    camadas: [{ nome: 'Título' }, { nome: 'Foto' }, { nome: 'Fundo' }],
    ativa: 1,
    selecao: { x: 100, y: 200, w: 300, h: 80 }
  });
  amb.rodar(ATALHO);

  assert.deepEqual(amb.alertas, [], 'o atalho não pode parar em alerta quando dá certo');
  assert.deepEqual(nomes(amb.doc.layers), ['Título', 'Medida L 300 px', 'Foto', 'Fundo']);
  const grupo = amb.doc.layers[1];
  assert.deepEqual(nomes(grupo.layers), ['Largura', 'Linhas']);

  const [texto, linhas] = grupo.layers;
  assert.deepEqual(retangulos(linhas), [[100, 200, 400, 201], [100, 197, 101, 204], [399, 197, 400, 204]]);
  assert.ok(linhas.pixels.every((p) => p.cor === amb.corFrente), 'a linha usa a cor da frente');

  assert.equal(texto.kind, 'TEXT', 'o rótulo continua texto editável');
  assert.equal(texto.textItem.contents, `300${H}px`);
  assert.equal(texto.textItem.size, 10);
  assert.equal(texto.textItem.font, 'ArialMT');
  assert.equal(texto.textItem.color, amb.corFrente);
  const b = caixa(texto);
  perto(b[3], 195, 0.5);                  // base do texto 5 px acima da linha
  perto((b[0] + b[2]) / 2, 250, 0.5);     // centrado na seleção

  assert.deepEqual(amb.historico, ['IBD — Marca de medida']);
  assert.equal(amb.app.preferences.rulerUnits, 'mm', 'a régua volta ao que era');
  assert.equal(amb.app.preferences.typeUnits, 'mm-tipo', 'a unidade de texto volta ao que era');
  assert.equal(amb.selecao(), null, 'a seleção sai de cena, como no original');
  assert.equal(amb.doc.activeLayer, grupo, 'o grupo fica ativo: teclas numéricas mudam a opacidade');
});

test('Atalho: mm a 300 ppi, largura e altura, com px junto', () => {
  const amb = ambiente({
    resolucao: 300, largura: 3000, altura: 3000,
    salvas: { unidade: 'mm', dimensao: 'ambas', mostrarPx: true },
    selecao: { x: 1000, y: 300, w: 600, h: 300 }
  });
  amb.rodar(ATALHO);

  assert.deepEqual(amb.alertas, []);
  const grupo = amb.doc.layers[0];
  assert.equal(grupo.name, 'Medida 50,8 × 25,4 mm');
  assert.deepEqual(nomes(grupo.layers), ['Altura', 'Largura', 'Linhas']);
  assert.equal(grupo.layers[1].textItem.contents, `50,8${H}mm / 600${H}px`);
  assert.equal(grupo.layers[0].textItem.contents, `25,4${H}mm / 300${H}px`);
  const linhas = retangulos(grupo.layers[2]);
  assert.equal(linhas.length, 6);
  assert.deepEqual(linhas[0], [1000, 300, 1600, 304], 'linha de 4 px a 300 ppi');
  // Rótulo da altura à esquerda da linha vertical, do lado de fora.
  const b = caixa(grupo.layers[0]);
  perto(b[2], 1000 - 21, 0.5);
  perto((b[1] + b[3]) / 2, 450, 0.5);
});

test('Atalho: rótulo que sairia pelo topo da tela passa para baixo da linha', () => {
  const amb = ambiente({ selecao: { x: 100, y: 0, w: 300, h: 50 } });
  amb.rodar(ATALHO);
  const texto = amb.doc.layers[0].layers[0];
  perto(caixa(texto)[1], 6, 0.5);
});

test('Atalho: rótulo de altura na borda esquerda passa para a direita', () => {
  const amb = ambiente({ selecao: { x: 0, y: 100, w: 50, h: 300 } });
  amb.rodar(ATALHO);
  const grupo = amb.doc.layers[0];
  assert.equal(grupo.name, 'Medida A 300 px');
  perto(caixa(grupo.layers[0])[0], 6, 0.5);
});

test('Atalho: com um grupo ativo, a marca entra no topo dele', () => {
  const amb = ambiente({
    camadas: [{ nome: 'Cartão', filhos: [{ nome: 'a' }] }, { nome: 'Fundo' }],
    ativa: 0,
    selecao: { x: 10, y: 10, w: 100, h: 20 }
  });
  amb.rodar(ATALHO);
  assert.deepEqual(nomes(amb.doc.layers), ['Cartão', 'Fundo']);
  assert.deepEqual(nomes(amb.doc.layers[0].layers), ['Medida L 100 px', 'a']);
});

test('Atalho: na prancheta, o rótulo respeita a borda dela, não só a da tela', () => {
  const amb = ambiente({
    actionManager: true,
    camadas: [{ nome: 'Prancheta 1', filhos: [{ nome: 'a' }], prancheta: { x: 0, y: 200, w: 600, h: 400 } }],
    ativa: 0,
    selecao: { x: 100, y: 200, w: 300, h: 50 }
  });
  amb.rodar(ATALHO);
  const grupo = amb.doc.layers[0].layers[0];
  assert.equal(grupo.name, 'Medida L 300 px', 'a marca entra na prancheta ativa');
  // Acima da linha ainda é tela, mas já é fora da prancheta: o rótulo desce.
  perto(caixa(grupo.layers[0])[1], 206, 0.5);
});

test('Atalho: texto que o Photoshop tirar do grupo ao mover volta para ele', () => {
  const amb = ambiente({ reaninhar: true, selecao: { x: 10, y: 50, w: 100, h: 20 } });
  amb.rodar(ATALHO);
  assert.deepEqual(nomes(amb.doc.layers), ['Medida L 100 px', 'Fundo']);
  assert.deepEqual(nomes(amb.doc.layers[0].layers), ['Largura', 'Linhas']);
  assert.deepEqual(amb.alertas, []);
});

test('Atalho: não conseguir mover o grupo avisa, mas a marca sai', () => {
  const amb = ambiente({ falhaMover: true, selecao: { x: 10, y: 10, w: 100, h: 20 } });
  amb.rodar(ATALHO);
  assert.equal(amb.alertas.length, 1);
  assert.match(amb.alertas[0], /fora do lugar no painel Camadas/);
  assert.equal(amb.doc.layers[0].name, 'Medida L 100 px');
});

test('Atalho: fonte ausente cai em ArialMT e o aviso diz como corrigir', () => {
  const amb = ambiente({ salvas: { fonte: 'Inexistente-Bold' }, selecao: { x: 10, y: 10, w: 100, h: 20 } });
  amb.rodar(ATALHO);
  assert.equal(amb.doc.layers[0].layers[0].textItem.font, 'ArialMT');
  assert.equal(amb.alertas.length, 1);
  assert.match(amb.alertas[0], /Inexistente-Bold/);
  assert.match(amb.alertas[0], /Marcas de medida — opções/);
});

test('Atalho: falha no meio desfaz tudo, avisa e devolve as preferências', () => {
  const amb = ambiente({ falhaPreencher: true, selecao: { x: 10, y: 10, w: 100, h: 20 } });
  amb.rodar(ATALHO);
  assert.deepEqual(nomes(amb.doc.layers), ['Fundo'], 'o grupo criado foi desfeito');
  assert.deepEqual(amb.selecao(), [10, 10, 110, 30], 'a seleção original voltou');
  assert.equal(amb.alertas.length, 1);
  assert.match(amb.alertas[0], /Marcas de medida: Falha simulada ao preencher/);
  assert.equal(amb.app.preferences.rulerUnits, 'mm');
  assert.equal(amb.app.preferences.typeUnits, 'mm-tipo');
});

test('Atalho: sem documento, sem seleção, Bitmap ou Máscara rápida — avisa e não mexe em nada', () => {
  const casos = [
    [{ semDocumento: true }, /Abra um documento/],
    [{}, /Não há seleção/],
    [{ modo: DocumentMode.BITMAP, selecao: { x: 0, y: 0, w: 10, h: 10 } }, /Bitmap não aceita camadas/],
    [{ modo: DocumentMode.INDEXEDCOLOR, selecao: { x: 0, y: 0, w: 10, h: 10 } }, /Cores indexadas/],
    [{ mascaraRapida: true, selecao: { x: 0, y: 0, w: 10, h: 10 } }, /Máscara rápida/]
  ];
  for (const [cfg, mensagem] of casos) {
    const amb = ambiente(cfg);
    amb.rodar(ATALHO);
    assert.equal(amb.alertas.length, 1, String(mensagem));
    assert.match(amb.alertas[0], mensagem);
    assert.deepEqual(amb.historico, []);
  }
});

test('Atalho: opções gravadas inválidas são explicadas, não adivinhadas', () => {
  const amb = ambiente({ salvas: { unidade: 'pol' }, selecao: { x: 0, y: 0, w: 10, h: 10 } });
  amb.rodar(ATALHO);
  assert.equal(amb.alertas.length, 1);
  assert.match(amb.alertas[0], /Unidade desconhecida/);
  assert.match(amb.alertas[0], /Marcas de medida — opções/);
  assert.deepEqual(amb.historico, []);
});

const FORM = {
  dimensao: 'Largura e altura',
  unidade: 'cm',
  mostrarPx: false,
  decimais: '2',
  separador: 'Ponto — 12.5',
  posicao: 'Na borda oposta — base ou direita',
  tamanhoTexto: 12,
  fonte: 'Arial Bold'
};
const FONTES = ['ArialMT', { name: 'Arial Bold', family: 'Arial', style: 'Bold', postScriptName: 'Arial-BoldMT' }];

test('Opções: grava valores do motor (não rótulos), resolve a fonte do menu e marca a seleção', () => {
  const amb = ambiente({
    resolucao: 300, largura: 3000, altura: 3000, fontes: FONTES,
    respostas: [FORM], selecao: { x: 0, y: 0, w: 600, h: 300 }
  });
  amb.rodar(OPCOES);

  assert.equal(amb.dialogos.length, 1);
  assert.equal(amb.dialogos[0].ok, 'Salvar e marcar');
  assert.deepEqual(amb.gravadas, [{
    id: 'photoshop/marcas-medida',
    v: {
      dimensao: 'ambas', unidade: 'cm', decimais: 2, separador: '.', mostrarPx: false,
      posicao: 'fim', tamanhoTexto: 12, fonte: 'Arial-BoldMT'
    }
  }]);
  const grupo = amb.doc.layers[0];
  assert.equal(grupo.name, 'Medida 5.08 × 2.54 cm');
  assert.equal(grupo.layers[1].textItem.contents, `5.08${H}cm`);
  assert.equal(grupo.layers[1].textItem.font, 'Arial-BoldMT');
  assert.deepEqual(amb.alertas, []);
});

test('Opções: o diálogo abre com o que estava gravado', () => {
  const amb = ambiente({ salvas: { unidade: 'mm', posicao: 'centro', decimais: 1, mostrarPx: false } });
  amb.rodar(OPCOES);
  const padrao = {};
  for (const c of amb.dialogos[0].campos) padrao[c.id] = c.padrao;
  assert.equal(padrao.unidade, 'mm');
  assert.equal(padrao.posicao, 'No centro da seleção');
  assert.equal(padrao.decimais, '1');
  assert.equal(padrao.mostrarPx, false);
  assert.equal(padrao.dimensao, 'Automática — pela proporção');
  assert.equal(amb.dialogos[0].ok, 'Salvar', 'sem seleção, o botão só salva');
  assert.deepEqual(amb.gravadas, [], 'cancelar não grava');
});

test('Opções: valor inválido reabre o diálogo com o que foi digitado', () => {
  const amb = ambiente({
    fontes: FONTES,
    respostas: [Object.assign({}, FORM, { tamanhoTexto: 0 }), null],
    selecao: { x: 0, y: 0, w: 10, h: 10 }
  });
  amb.rodar(OPCOES);
  assert.equal(amb.dialogos.length, 2);
  assert.match(amb.alertas[0], /tamanho do texto/);
  const segundo = {};
  for (const c of amb.dialogos[1].campos) segundo[c.id] = c.padrao;
  assert.equal(segundo.tamanhoTexto, 0);
  assert.equal(segundo.unidade, 'cm');
  assert.deepEqual(amb.gravadas, []);
  assert.deepEqual(amb.historico, []);
});

test('Opções: fonte que não existe é recusada com exemplo do nome certo', () => {
  const amb = ambiente({ respostas: [Object.assign({}, FORM, { fonte: 'Comic Neue' }), null] });
  amb.rodar(OPCOES);
  assert.match(amb.alertas[0], /"Comic Neue" não foi encontrada/);
  assert.deepEqual(amb.gravadas, []);
});

test('Opções: sem documento, grava e explica como usar o atalho', () => {
  const amb = ambiente({ semDocumento: true, fontes: FONTES, respostas: [FORM] });
  amb.rodar(OPCOES);
  assert.equal(amb.gravadas.length, 1);
  assert.equal(amb.dialogos[0].ok, 'Salvar');
  assert.match(amb.alertas[0], /Opções salvas/);
  assert.deepEqual(amb.historico, []);
});

/* ------------------------------------------------------------------ *
 * 6. Licença do original
 * ------------------------------------------------------------------ */

test('Licença: os quatro arquivos derivados e o aviso de terceiros carregam o MIT do Size Marks na íntegra', () => {
  const avisos = fs.readFileSync(path.join(base, 'THIRD_PARTY_NOTICES.md'), 'utf8');
  const trecho = avisos.match(/```text\n([\s\S]*?)```/);
  assert.ok(trecho, 'THIRD_PARTY_NOTICES.md precisa trazer o texto da licença num bloco ```text');
  const linhas = trecho[1].split('\n').map((l) => l.trim()).filter(Boolean);
  assert.ok(linhas.includes('Copyright 2014 Roman Shamin https://github.com/romashamin'));
  assert.ok(linhas.some((l) => l.startsWith('Permission is hereby granted')));

  const derivados = [ATALHO, OPCOES, 'core/extendscript/ibd-medida.jsx', 'core/extendscript/ibd-ps-medida.jsx'];
  for (const arquivo of derivados) {
    const bloco = fs.readFileSync(path.join(base, arquivo), 'utf8').match(/\/\*\*[\s\S]*?\*\//)[0];
    const texto = bloco.split('\n').map((l) => l.replace(/^\s*\*\s?/, '').trim());
    for (const linha of linhas) {
      assert.ok(texto.includes(linha), `${arquivo}: falta a linha da licença "${linha}"`);
    }
  }
});

/* ------------------------------------------------------------------ *
 * Resultado
 * ------------------------------------------------------------------ */

const falhas = results.filter((r) => !r.ok);
for (const r of results) {
  console.log((r.ok ? '  ok   ' : '  FALHA') + '  ' + r.name);
  if (!r.ok) console.log(r.error.split('\n').map((l) => '         ' + l).join('\n'));
}
console.log(`\n${results.length - falhas.length}/${results.length} verificações das marcas de medida passaram.`);
if (falhas.length) process.exit(1);
