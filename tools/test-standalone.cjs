/**
 * Verificações dos arquivos prontos para baixar.
 *
 * A vitrine entrega um .jsx por ferramenta com os #include já resolvidos.
 * Se a ordem da junção estiver errada, o arquivo abre no Photoshop e morre
 * num ReferenceError — depois de o designer ter baixado. Então aqui cada
 * ferramenta é executada de verdade, com o app simulado, e precisa terminar
 * sem lançar.
 *
 * Uso: npm run test:standalone
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const base = path.resolve(__dirname, '..');
const results = [];

function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, error: e.stack }); }
}

/** Versao que espera a promessa antes de registrar o resultado. */
async function testeAsync(name, fn) {
  try { await fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, error: e.stack }); }
}

/** Nome que o IBD.host() reconhece para cada app do catálogo. */
const HOSTS = {
  photoshop: 'photoshop',
  illustrator: 'illustrator',
  indesign: 'indesign',
  aftereffects: 'aftereffects',
  premiere: 'premiere',
  bridge: 'bridge'
};

/**
 * ScriptUI mínima: toda janela abre e é cancelada. Assim um script que pede
 * formulário sai limpo, e um que exige documento cai no alerta — os dois
 * caminhos terminam sem lançar, que é o que se quer provar.
 */
function janelaCancelada() {
  function elemento(tipo, valor) {
    const e = {
      type: tipo,
      text: typeof valor === 'string' ? valor : '',
      children: [],
      properties: {},
      preferredSize: {},
      value: false,
      enabled: true,
      selection: null,
      add(t, bounds, val, props) {
        const filho = elemento(t, val);
        filho.properties = props || {};
        e.children.push(filho);
        return filho;
      }
    };
    return e;
  }
  return function Window(tipo, titulo) {
    const w = elemento(tipo, titulo);
    w.center = () => {};
    w.close = () => {};
    w.update = () => {};
    w.show = () => 0;          // 0 = cancelado
    return w;
  };
}

function executar(texto, appId) {
  const alertas = [];
  let janelas = 0;
  const Janela = janelaCancelada();

  const sandbox = {
    app: {
      name: 'Adobe ' + appId,
      version: '27.0',
      documents: [],
      activeDocument: null,
      project: null,
      preferences: { rulerUnits: 'mm' }
    },
    BridgeTalk: { appName: HOSTS[appId] },
    alert: (m) => alertas.push(String(m)),
    confirm: () => true,
    Units: { PIXELS: 'px', POINTS: 'pt' },
    UnitValue: (n) => ({ value: Number(n), as: () => Number(n) }),
    AnchorPosition: { TOPLEFT: 'topleft', MIDDLECENTER: 'center' },
    Direction: { VERTICAL: 'V', HORIZONTAL: 'H' },
    SaveOptions: { DONOTSAVECHANGES: 'no' },
    SelectionType: { REPLACE: 'replace' },
    Folder: function () { this.fsName = '/tmp'; },
    File: function () { this.fsName = '/tmp/x'; this.exists = false; },
    Window: function (tipo, titulo) { janelas++; return new Janela(tipo, titulo); },
    stringIDToTypeID: (s) => s,
    ActionReference: function () { this.putEnumerated = () => {}; this.putProperty = () => {}; this.putIndex = () => {}; },
    executeActionGet: () => { throw new Error('sem Action Manager no teste'); }
  };
  sandbox.Folder.selectDialog = () => null;
  sandbox.File.openDialog = () => null;
  sandbox.$ = { global: sandbox, writeln() {} };

  const ctx = vm.createContext(sandbox);
  vm.runInContext(texto.replace(/^[ \t]*#target[^\n]*$/gm, ''), ctx);
  return { alertas, janelas, IBD: sandbox.IBD };
}

/* ------------------------------------------------------------------ */

(async () => {
  const { resolverIncludes, montarArquivoPublicavel } = await import('../tools/lib/incluir.mjs');
  const catalogo = JSON.parse(fs.readFileSync(path.join(base, 'catalog.json'), 'utf8'));
  const marca = JSON.parse(fs.readFileSync(path.join(base, 'brand.config.json'), 'utf8'));
  const scripts = catalogo.ferramentas.filter((f) => f.tipo === 'script');

  /* O resolvedor ---------------------------------------------------- */

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ibd-inc-'));
  const escrever = (nome, texto) => {
    const alvo = path.join(temp, nome);
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    fs.writeFileSync(alvo, texto, 'utf8');
    return nome;
  };

  await testeAsync('Cada arquivo entra uma vez só, mesmo incluído por dois caminhos', async () => {
    escrever('nucleo.jsx', 'var NUCLEO = 1;');
    escrever('a.jsx', '#include "nucleo.jsx"\nvar A = 1;');
    escrever('b.jsx', '#include "nucleo.jsx"\nvar B = 1;');
    escrever('principal.jsx', '#include "a.jsx"\n#include "b.jsx"\nvar P = 1;');
    return resolverIncludes(temp, 'principal.jsx').then((r) => {
      assert.equal((r.conteudo.match(/var NUCLEO = 1;/g) || []).length, 1, 'núcleo duplicado');
      assert.deepEqual(r.embutidos, ['a.jsx', 'nucleo.jsx', 'b.jsx']);
      assert.match(r.conteudo, /ja foi embutido acima/);
    });
  });

  await testeAsync('#include circular é recusado em vez de rodar para sempre', async () => {
    escrever('ping.jsx', '#include "pong.jsx"');
    escrever('pong.jsx', '#include "ping.jsx"');
    return resolverIncludes(temp, 'ping.jsx').then(
      () => { throw new Error('deveria ter recusado'); },
      (e) => assert.match(e.message, /circular/)
    );
  });

  await testeAsync('#include para arquivo inexistente falha com o caminho na mensagem', async () => {
    escrever('orfao.jsx', '#include "sumido.jsx"');
    return resolverIncludes(temp, 'orfao.jsx').then(
      () => { throw new Error('deveria ter recusado'); },
      (e) => assert.match(e.message, /sumido\.jsx/)
    );
  });

  await testeAsync('A ordem do arquivo é preservada: o include entra onde estava', async () => {
    escrever('antes.jsx', 'var ANTES = 1;');
    escrever('ordem.jsx', 'var TOPO = 1;\n#include "antes.jsx"\nvar BASE = 1;');
    return resolverIncludes(temp, 'ordem.jsx').then((r) => {
      assert.ok(r.conteudo.indexOf('var TOPO') < r.conteudo.indexOf('var ANTES'));
      assert.ok(r.conteudo.indexOf('var ANTES') < r.conteudo.indexOf('var BASE'));
    });
  });

  fs.rmSync(temp, { recursive: true, force: true });

  /* Cada ferramenta de verdade -------------------------------------- */

  for (const f of scripts) {
    const ext = path.extname(f.arquivo).toLowerCase();
    const resolvido = ext === '.jsx'
      ? await resolverIncludes(base, f.arquivo)
      : { conteudo: fs.readFileSync(path.join(base, f.arquivo), 'utf8'), embutidos: [] };
    const texto = montarArquivoPublicavel(f, marca, resolvido.conteudo, resolvido.embutidos);

    if (ext === '.jsx') {
      test(`${f.id}: sem #include e com #target preservado`, () => {
        assert.ok(!/^[ \t]*#include/m.test(texto), 'sobrou #include no arquivo baixável');
        assert.match(texto, new RegExp('^#target ' + f.app, 'm'), 'perdeu a diretiva #target');
        assert.match(texto, /Arquivo pronto para uso/, 'perdeu o cabeçalho explicativo');
      });

      test(`${f.id}: roda sozinho, sem o repositório na máquina`, () => {
        const saida = executar(texto, f.app);
        assert.ok(saida.alertas.length > 0 || saida.janelas > 0,
          'o script não alertou nem abriu janela — provavelmente não chegou a rodar');
        for (const mensagem of saida.alertas) {
          assert.ok(!/is not defined|undefined is not|Cannot read/i.test(mensagem),
            'erro de referência ao rodar: ' + mensagem);
        }
        if (resolvido.embutidos.length) {
          assert.ok(saida.IBD, 'a biblioteca não foi montada');
          assert.equal(typeof saida.IBD.slug, 'function');
          assert.equal(saida.IBD.VERSAO, '0.1.0');
        }
      });
    } else if (ext === '.js') {
      test(`${f.id}: sintaxe JS válida e cabeçalho preservado`, () => {
        assert.ok(!/^[ \t]*#include/m.test(texto), 'sobrou #include no arquivo baixável');
        assert.match(texto, /Arquivo pronto para uso/, 'perdeu o cabeçalho explicativo');
        new vm.Script(texto, { filename: f.arquivo });
      });

      test(`${f.id}: executa sem erro em ambiente ${f.app} simulado`, () => {
        const logs = [];
        const noop = () => {};
        const mockUnitType = { Millimetre: 8, Centimetre: 9, Pixel: 5, Inch: 6, Point: 7, Metre: 10 };
        const mockCtx = {
          console: { log: (m) => logs.push(String(m)) },
          print: (m) => logs.push(String(m)),
          Math, Number, String, Boolean, Array, Object, JSON, parseFloat, parseInt, isNaN, isFinite,
          Error
        };
        if (f.app === 'affinity') {
          mockCtx.require = (mod) => ({
            Document: { current: null },
            DocumentCommand: { createAddHorizontalGuide: noop, createAddVerticalGuide: noop, createAddGuide: noop },
            CompoundCommandBuilder: { create: () => ({ addCommand: noop, createCommand: noop }) },
            AddChildNodesCommandBuilder: { create: () => ({ createCommand: noop }) },
            Dialog: { create: () => ({ show: noop, runModal: () => 0, addColumn: () => ({ addGroup: () => ({}) }) }) },
            DialogResult: { Ok: 1, Cancel: 0 },
            UnitType: mockUnitType,
            Rectangle: function (x, y, w, h) { this.x = x; this.y = y; this.width = w; this.height = h; },
            Point: function (x, y) { this.x = x; this.y = y; },
            PolyCurve: { create: () => ({ addCurve: noop }) },
            Curve: { createRectangle: noop },
            CurveBuilder: { create: () => ({ beginXY: function () { return this; }, lineToXY: function () { return this; }, close: function () { return this; }, createCurve: noop }) },
            PolyCurveNodeDefinition: { create: noop },
            ShapeNodeDefinition: { create: noop },
            ShapeRectangle: { create: noop },
            ShapeEllipse: { create: noop },
            ArtTextNodeDefinition: { createFromStoryBuilder: noop },
            StoryBuilder: { create: () => ({ setToArtisticTextDefaultStyle: noop, addText: noop }) },
            FillDescriptor: { createNone: noop, createSolid: noop },
            BlendMode: { Normal: 0 },
            LineStyle: { create: noop },
            LineStyleDescriptor: { create: noop },
            LineCap: { Butt: 0, Round: 1, Square: 2 },
            LineJoin: { Miter: 1, Round: 2, Bevel: 3 },
            LineType: { Solid: 1, None: 0 },
            StrokeAlignment: { Centre: 0, Outside: 2, Inside: 1 },
            RGBA8: (r, g, b, a) => ({ r, g, b, alpha: a === undefined ? 255 : a }),
            CMYK: (c, m, y, k) => ({ c, m, y, k }),
            Font: { create: noop, createDefault: noop },
            FontWeight: { Normal: 400, Bold: 700 },
            FontWidth: { Normal: 5 },
            ParagraphAlignXType: { Left: 0, Centre: 1, Right: 2 },
            Selection: { create: () => ({}) },
            Transform: { createTranslate: noop, createScale: noop },
            unionRects: noop,
            NodeChildType: { Main: 0 }
          });
        } else {
          const fakeLayer = {
            Name: '06_GUIAS',
            Locked: false,
            CreateRectangle: () => ({ Fill: { ApplyNoFill: noop }, Outline: { SetProperties: noop }, Move: noop }),
            CreateArtisticText: () => ({ Fill: { ApplyUniformFill: noop }, Outline: { SetNoOutline: noop }, Bounds: { x: 0, y: 0, width: 10, height: 5, centerX: 5, centerY: 2.5 }, SetPosition: noop }),
            CreatePath: () => ({ Fill: { ApplyNoFill: noop }, Outline: { SetProperties: noop }, Duplicate: noop })
          };
          mockCtx.ActiveDocument = {
            Selection: { Count: 0, Item: noop, forEach: noop },
            SelectionRange: { Count: 0, Item: noop, forEach: noop }
          };
          mockCtx.ActivePage = {
            SizeWidth: 210,
            SizeHeight: 297,
            Layers: { Find: () => null },
            CreateLayer: () => fakeLayer
          };
          mockCtx.ActiveLayer = fakeLayer;
          mockCtx.ActiveSelection = mockCtx.ActiveDocument.Selection;
          mockCtx.Color = {
            RGB: (r, g, b) => ({ v: { r, g, b } }),
            CMYK: (c, m, y, k) => ({ v: { c, m, y, k } })
          };
          mockCtx.ShapeRange = function (ids) { this.ids = ids || []; this.Count = this.ids.length; };
        }
        vm.runInContext(texto, vm.createContext(mockCtx));
        assert.ok(logs.length > 0, 'o script não registrou saída ao rodar');
      });
    } else if (ext === '.bas') {
      test(`${f.id}: estrutura de módulo VBA (.bas) válida`, () => {
        assert.match(texto, /^Attribute\s+VB_Name\s*=\s*"IBD_[A-Za-z0-9_]+"/m, 'falta Attribute VB_Name no topo');
        assert.match(texto, /Arquivo pronto para uso/, 'perdeu o cabeçalho explicativo');
        assert.match(texto, /^\s*Option Explicit\b/m, 'falta Option Explicit');
        assert.match(texto, /^\s*(?:Public\s+)?Sub\s+[A-Za-z0-9_]+\s*\(\)/m, 'falta Sub de entrada pública');
        assert.match(texto, /^\s*End Sub\b/m, 'falta End Sub');
      });
    }
  }

  // O teste abaixo confere a saida publicada, entao ele mesmo constroi o
  // site: assim `npm test` passa num clone novo, sem depender da ordem dos
  // passos do CI.
  const publico = path.join(base, JSON.parse(fs.readFileSync(path.join(base, 'vercel.json'), 'utf8')).outputDirectory);
  require('child_process').execFileSync(process.execPath, [path.join(base, 'tools', 'build-site.mjs')], {
    cwd: base, stdio: 'pipe'
  });

  test('Toda ferramenta do catálogo tem um arquivo pronto para baixar', () => {
    const html = fs.readFileSync(path.join(publico, 'index.html'), 'utf8');
    const dados = JSON.parse(html.match(/<script id="dados" type="application\/json">([\s\S]*?)<\/script>/)[1]);
    for (const f of dados.ferramentas) {
      if (f.tipo !== 'script') continue;
      assert.ok(f.baixar, f.id + ' sem link de download');
      assert.ok(f.baixarNome.startsWith(marca.nome + ' '), f.id + ': nome fora do padrão do instalador');
      const arquivo = path.join(publico, f.baixar);
      assert.ok(fs.existsSync(arquivo), 'arquivo não publicado: ' + f.baixar);
      assert.ok(fs.statSync(arquivo).size > 400, 'arquivo publicado vazio: ' + f.baixar);
    }
  });

  /* Resultado -------------------------------------------------------- */

  const falhas = results.filter((r) => !r.ok);
  for (const r of results) {
    console.log((r.ok ? '  ok   ' : '  FALHA') + '  ' + r.name);
    if (!r.ok) console.log(r.error.split('\n').map((l) => '         ' + l).join('\n'));
  }
  console.log(`\n${results.length - falhas.length}/${results.length} verificações de arquivo pronto passaram.`);
  if (falhas.length) process.exit(1);
})();
