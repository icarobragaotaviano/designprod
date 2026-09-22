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
  const { resolverIncludes, cabecalho } = await import('../tools/lib/incluir.mjs');
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
    const { conteudo, embutidos } = await resolverIncludes(base, f.arquivo);
    const texto = cabecalho(f, marca, embutidos) + conteudo;

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
      if (embutidos.length) {
        assert.ok(saida.IBD, 'a biblioteca não foi montada');
        assert.equal(typeof saida.IBD.slug, 'function');
        assert.equal(saida.IBD.VERSAO, '0.1.0');
      }
    });
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
      assert.ok(fs.statSync(arquivo).size > 500, 'arquivo publicado vazio: ' + f.baixar);
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
