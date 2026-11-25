#!/usr/bin/env node
/**
 * Testes abrangentes dos plugins instalaveis, sistema de icones ("iconezinhos"),
 * criador CLI (tools/criar-plugin.mjs), construtor em navegador (site/src/plugin-builder.js)
 * e ScriptUI Visual 2.0 (core/extendscript/ibd-ui.jsx).
 *
 * Uso: npm run test:plugins
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ICONES, PALETA_ICONES, resolverIconeId, iconeSvg, gerarPngIcone, gerarIcoIcone, gerarCodigoIconesJs } from './lib/icones.mjs';
import { criarPluginCustom } from './criar-plugin.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];

function test(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      return r.then(
        () => results.push({ name, ok: true }),
        (e) => results.push({ name, ok: false, error: e.stack || String(e) })
      );
    }
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, error: e.stack || String(e) });
  }
  return Promise.resolve();
}

function lerZip(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  let fim = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { fim = i; break; }
  }
  assert.ok(fim >= 0, 'EOCD ausente no ZIP');
  const total = buf.readUInt16LE(fim + 10);
  const tamanhoCd = buf.readUInt32LE(fim + 12);
  const inicioCd = buf.readUInt32LE(fim + 16);
  assert.equal(inicioCd + tamanhoCd, fim, 'Diretorio central desalinhado');

  const mapa = new Map();
  let p = inicioCd;
  for (let i = 0; i < total; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50, 'Cabecalho central invalido');
    const metodo = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const comp = buf.readUInt32LE(p + 20);
    const cru = buf.readUInt32LE(p + 24);
    const nomeLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const comLen = buf.readUInt16LE(p + 32);
    const offset = buf.readUInt32LE(p + 42);
    const nome = buf.toString('utf8', p + 46, p + 46 + nomeLen);

    assert.equal(buf.readUInt32LE(offset), 0x04034b50, `Cabecalho local invalido: ${nome}`);
    const nomeLoc = buf.readUInt16LE(offset + 26);
    const extraLoc = buf.readUInt16LE(offset + 28);
    const inicio = offset + 30 + nomeLoc + extraLoc;
    const corpo = buf.subarray(inicio, inicio + comp);
    const dados = metodo === 8 ? zlib.inflateRawSync(corpo) : Buffer.from(corpo);
    assert.equal(dados.length, cru, `Tamanho inconsistente em ${nome}`);
    assert.equal(zlib.crc32(dados), crc, `CRC incorreto em ${nome}`);
    mapa.set(nome, dados);
    p += 46 + nomeLen + extraLen + comLen;
  }
  return mapa;
}

function conferirPng(buf, tamanhoEsperado) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  assert.deepEqual(b.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'Assinatura PNG invalida');
  assert.equal(b.toString('ascii', 12, 16), 'IHDR');
  assert.equal(b.readUInt32BE(16), tamanhoEsperado);
  assert.equal(b.readUInt32BE(20), tamanhoEsperado);
  const idatIdx = b.indexOf(Buffer.from('IDAT', 'ascii'));
  assert.ok(idatIdx > 20, 'Chunk IDAT ausente');
  const idatLen = b.readUInt32BE(idatIdx - 4);
  const inflated = zlib.inflateSync(b.subarray(idatIdx + 4, idatIdx + 4 + idatLen));
  assert.equal(inflated.length, tamanhoEsperado * (tamanhoEsperado * 4 + 1));
}

function conferirIco(buf, tamanhoEsperado) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  assert.equal(b.readUInt16LE(0), 0);
  assert.equal(b.readUInt16LE(2), 1);
  assert.equal(b.readUInt16LE(4), 1);
  assert.equal(b[6], tamanhoEsperado);
  assert.equal(b[7], tamanhoEsperado);
  assert.equal(b.readUInt32LE(22), 40);
  assert.equal(b.readInt32LE(26), tamanhoEsperado);
  assert.equal(b.readInt32LE(30), tamanhoEsperado * 2);
}

const assincronos = [];

assincronos.push(test('icones.mjs gera SVG, PNG RGBA 48/96px e ICO 32px validos', () => {
  assert.ok(Object.keys(ICONES).length >= 16);
  for (const id of Object.keys(ICONES)) {
    const svg = iconeSvg(id, '#f0c419', 24);
    assert.match(svg, /<svg[^>]+viewBox="0 0 24 24"/);
  }
  assert.equal(resolverIconeId('illustrator/margem-seguranca-guias', 'script'), 'guia-interna');
  assert.equal(resolverIconeId('photoshop/actions/x', 'action'), 'acao');

  conferirPng(gerarPngIcone('guia-interna', 48, PALETA_ICONES[1].hex, PALETA_ICONES[1].fundo), 48);
  conferirPng(gerarPngIcone('cotas', 96, PALETA_ICONES[0].hex, PALETA_ICONES[0].fundo), 96);
  conferirIco(gerarIcoIcone('contorno-offset', 32, PALETA_ICONES[3].hex, PALETA_ICONES[3].fundo), 32);

  const umd = gerarCodigoIconesJs();
  const sandbox = { window: {}, self: {} };
  sandbox.self = sandbox;
  vm.runInContext(umd, vm.createContext(sandbox));
  assert.ok(sandbox.IBDIcones.ICONES['guia-interna']);
  assert.match(sandbox.IBDIcones.iconeSvg('cotas', '#f0c419', 20), /<svg/);
}));

assincronos.push(test('npm run build:plugins empacota todos os 5 softwares com arquivos integros', () => {
  execFileSync(process.execPath, [path.join(RAIZ, 'tools', 'build-plugin.mjs'), '--all'], { cwd: RAIZ, stdio: 'pipe' });
  const marca = JSON.parse(fs.readFileSync(path.join(RAIZ, 'brand.config.json'), 'utf8'));
  const v = marca.versao;

  const psMap = lerZip(fs.readFileSync(path.join(RAIZ, 'dist', `${marca.id}-ferramentas-${v}.ccx`)));
  assert.ok(psMap.has('manifest.json'));
  assert.ok(psMap.has('src/lib/icones.js'));
  assert.ok(psMap.has('src/bundle/standalone/photoshop/scripts/criar-papel-padrao.jsx'));
  assert.ok(psMap.has('src/bundle/standalone/photoshop/scripts/criar-peca-padrao.jsx'));
  assert.match(psMap.get('src/lib/es-bridge.js').toString('utf8'), /interactive:\s*true/);
  assert.match(psMap.get('src/main.js').toString('utf8'), /ibd-ps-uxp-ocultas-v1/);
  assert.match(psMap.get('src/index.html').toString('utf8'), /id="btn-gerenciar"/);
  conferirPng(psMap.get('src/icons/icone-48.png'), 48);
  conferirPng(psMap.get('src/icons/icone-48@2x.png'), 96);

  const idMap = lerZip(fs.readFileSync(path.join(RAIZ, 'dist', `${marca.id}-indesign-uxp-${v}.ccx`)));
  const idMan = JSON.parse(idMap.get('manifest.json').toString('utf8'));
  assert.equal(idMan.host[0].app, 'ID');
  assert.ok(idMap.has('src/lib/id-bridge.js'));
  assert.ok(idMap.has('src/bundle/standalone/indesign/scripts/exportar-paginas-pdf.jsx'));
  assert.match(idMap.get('src/main.js').toString('utf8'), /ibd-id-uxp-ocultas-v1/);
  conferirPng(idMap.get('src/icons/icone-48.png'), 48);

  const cepMap = lerZip(fs.readFileSync(path.join(RAIZ, 'dist', `${marca.id}-adobe-cep-${v}.zip`)));
  const cepXml = cepMap.get('CSXS/manifest.xml').toString('utf8');
  assert.match(cepXml, /Host Name="ILST"/);
  assert.match(cepXml, /Host Name="AEFT"/);
  assert.ok(cepMap.has('js/CSInterface.js'));
  assert.ok(cepMap.has('js/icones.js'));
  assert.ok(cepMap.has('host/runner.jsx'));
  assert.ok(cepMap.has('Instalar-macOS.command'));
  assert.ok(cepMap.has('Instalar-Windows.bat'));
  assert.match(cepMap.get('Instalar-Windows.bat').toString('utf8'), /15 16/);
  assert.match(cepMap.get('main.js').toString('utf8'), /ibd-cep-ocultas-v1/);
  assert.match(cepMap.get('main.js').toString('utf8'), /EvalScript error\./);
  assert.ok(cepMap.has('bundle/standalone/illustrator/scripts/margem-seguranca-guias.jsx'));
  assert.ok(cepMap.has('bundle/standalone/illustrator/scripts/criar-papel-padrao.jsx'));
  assert.ok(cepMap.has('bundle/standalone/illustrator/scripts/criar-peca-padrao.jsx'));
  assert.ok(cepMap.has('bundle/standalone/photoshop/scripts/criar-papel-padrao.jsx'));
  assert.ok(cepMap.has('bundle/standalone/photoshop/scripts/criar-peca-padrao.jsx'));

  const aeMap = lerZip(fs.readFileSync(path.join(RAIZ, 'dist', `${marca.id}-aftereffects-painel-${v}.zip`)));
  const aeJsx = aeMap.get('IBD Ferramentas Painel.jsx').toString('utf8');
  const aeSemCom = aeJsx.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/\b(let|const|class)\b/.test(aeSemCom), 'Painel After Effects precisa ser ES3');
  assert.ok(!/=>/.test(aeSemCom));
  assert.match(aeJsx, /aftereffects\/painel-ocultas/);

  const cdMap = lerZip(fs.readFileSync(path.join(RAIZ, 'dist', `${marca.id}-coreldraw-barra-${v}.zip`)));
  const cdBas = cdMap.get('IBD_InstalarBarraFerramentas.bas').toString('utf8');
  assert.match(cdBas, /Attribute VB_Name = "IBD_BarraFerramentas"/);
  assert.match(cdBas, /\.AddCustomButton\b/);
  assert.match(cdBas, /\.SetIcon2\b/);
  assert.match(cdBas, /2cc24a3e-fe24-4708-9a74-9c75406eebcd/);
  assert.ok(!/\bCommandBarControl\b|\bcdrBarTop\b|\bcdrCmdCategoryMacros\b/.test(cdBas), 'IBD_InstalarBarraFerramentas.bas nao pode conter identificadores VBA invalidos');
  assert.ok(cdBas.includes('\r\n'), 'IBD_InstalarBarraFerramentas.bas precisa usar CRLF');
  assert.ok(cdMap.has('IBD_Painel_Corel.hta'));
  assert.ok(cdMap.has('Attach-Painel-Corel.ps1'));
  assert.ok(cdMap.has('Abrir-Painel-CorelDRAW.bat'));
  assert.ok(cdMap.has('Instalar-CorelDRAW.bat'));
  assert.ok(cdMap.has('IBD_PainelCorel.bas'));
  const hta = cdMap.get('IBD_Painel_Corel.hta').toString('utf8');
  assert.match(hta, /Const CDR_MM = 3/);
  assert.match(hta, /Const CDR_PT = 14/);
  assert.match(hta, /btn-gerenciar/);
  assert.match(hta, /Padrao Nobel T9/);
  assert.match(hta, /Cartao de visita BR/);
  conferirIco(cdMap.get('icones/painel-ibd.ico'), 32);
  conferirIco(cdMap.get('icones/margem-seguranca-guias.ico'), 32);
  conferirIco(cdMap.get('icones/texto-dimensoes-objeto.ico'), 32);
  conferirIco(cdMap.get('icones/deslocamento-expandir-contorno.ico'), 32);
  conferirIco(cdMap.get('icones/criar-papel-padrao.ico'), 32);
  conferirIco(cdMap.get('icones/criar-peca-padrao.ico'), 32);
}));

assincronos.push(test('criar-plugin.mjs gera pacotes customizados com icone e cor para CEP, UXP e CorelDRAW', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ibd-custom-plugin-'));
  try {
    const cepOut = path.join(tmpDir, 'margem-cep.zip');
    const r1 = await criarPluginCustom({
      tools: ['illustrator/margem-seguranca-guias'],
      nome: 'Margem Express',
      icone: 'guia-interna',
      cor: '#68a8e8',
      fundo: '#142234',
      formato: 'adobe-cep',
      saida: cepOut
    });
    assert.equal(r1.formato, 'adobe-cep');
    const cepEntries = lerZip(fs.readFileSync(cepOut));
    assert.ok(cepEntries.has('CSXS/manifest.xml'));
    assert.match(cepEntries.get('index.html').toString('utf8'), /Margem Express/);

    const psOut = path.join(tmpDir, 'kit-ps.ccx');
    const r2 = await criarPluginCustom({
      tools: ['photoshop/auto-layout', 'photoshop/redimensionar-lote'],
      nome: 'Kit Producao PS',
      icone: 'auto-layout',
      cor: '#a78bfa',
      fundo: '#211b36',
      formato: 'photoshop-uxp',
      saida: psOut
    });
    assert.equal(r2.formato, 'photoshop-uxp');
    const psEntries = lerZip(fs.readFileSync(psOut));
    conferirPng(psEntries.get('src/icons/icone-48.png'), 48);
    assert.equal(psEntries.size, 7);

    const cdOut = path.join(tmpDir, 'cd-custom.zip');
    await criarPluginCustom({
      tools: ['coreldraw/deslocamento-expandir-contorno'],
      nome: 'Faca Rapida',
      icone: 'contorno-offset',
      cor: '#ec4899',
      formato: 'coreldraw-barra',
      saida: cdOut
    });
    const cdEntries = lerZip(fs.readFileSync(cdOut));
    conferirIco(cdEntries.get('icones/faca-rapida.ico'), 32);
    assert.match(cdEntries.get('IBD_InstalarCustom.bas').toString('utf8'), /Faca Rapida/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}));

assincronos.push(test('site/src/plugin-builder.js gera .ccx, CEP .zip e CorelDRAW .zip/.ico validos em navegador simulado', async () => {
  const ctx = {
    window: {},
    self: {},
    Uint8Array, DataView, ArrayBuffer, Object, Array, String, Number, Math, Date, Promise, Error, JSON,
    encodeURIComponent, unescape, parseInt, isNaN,
    TextEncoder
  };
  ctx.self = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(gerarCodigoIconesJs(), ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'site', 'src', 'plugin-builder.js'), 'utf8'), ctx);

  const builder = ctx.IBDPluginBuilder;
  assert.ok(builder);

  const pkgUxp = await builder.construirPacote({
    ferramentas: [{ id: 'photoshop/auto-layout', titulo: 'Auto Layout', descricao: 'Desc', app: 'photoshop', arquivo: 'apps/photoshop/scripts/auto-layout.jsx' }],
    nome: 'Auto Layout Web',
    iconeId: 'auto-layout',
    corHex: '#a78bfa',
    fundoHex: '#211b36',
    formato: 'photoshop-uxp',
    obterCodigo: () => 'alert("ok");'
  });
  assert.equal(pkgUxp.nomeArquivo, 'ibd-custom-auto-layout-web.ccx');
  const uxpZip = lerZip(pkgUxp.bytes);
  conferirPng(uxpZip.get('src/icons/icone-48.png'), 48);
  conferirPng(uxpZip.get('src/icons/icone-48@2x.png'), 96);

  const pkgCd = await builder.construirPacote({
    ferramentas: [{ id: 'coreldraw/margem-seguranca-guias', titulo: 'Margem Segura', descricao: 'Desc', app: 'coreldraw', arquivo: 'apps/coreldraw/scripts/margem-seguranca-guias.bas' }],
    nome: 'Margem Corel',
    iconeId: 'guia-interna',
    corHex: '#68a8e8',
    fundoHex: '#142234',
    formato: 'coreldraw-barra',
    obterCodigo: () => 'Attribute VB_Name = "IBD_M"\nPublic Sub Run()\nEnd Sub\n'
  });
  const cdZip = lerZip(pkgCd.bytes);
  conferirIco(cdZip.get('icones/margem-corel.ico'), 32);
  assert.match(cdZip.get('IBD_InstalarCustom.bas').toString('utf8'), /SetIcon2/);
}));

assincronos.push(test('IBD.ui.formulario Visual 2.0 suporta grupo, presets, cores, onDraw e resumo no ES3', () => {
  const coreSrc = fs.readFileSync(path.join(RAIZ, 'core', 'extendscript', 'ibd-core.jsx'), 'utf8');
  const uiSrc = fs.readFileSync(path.join(RAIZ, 'core', 'extendscript', 'ibd-ui.jsx'), 'utf8')
    .replace(/^[ \t]*#include\b[^\r\n]*/gm, '');

  let drawCalls = 0;
  function makeCtrl(type, txt) {
    const c = {
      type, text: txt || '', children: [], value: false, items: [], selection: { index: 0, text: '' },
      preferredSize: { width: 100, height: 24 }, alignment: 'fill', alignChildren: [], margins: 0, spacing: 0,
      graphics: {
        BrushType: { SOLID_COLOR: 0 }, PenType: { SOLID_COLOR: 0 },
        newBrush: () => ({}), newPen: () => ({}), newPath: () => {},
        rectPath: () => {}, ellipsePath: () => {}, moveto: () => {}, lineto: () => {},
        fillPath: () => {}, strokePath: () => {}, drawString: () => {}, measureString: () => [20, 12]
      },
      add(t, _b, init) {
        const sub = makeCtrl(t, Array.isArray(init) ? '' : init);
        if (t === 'dropdownlist' && Array.isArray(init)) {
          sub.items = init;
          let sel = { index: 0, text: init[0] || '' };
          Object.defineProperty(sub, 'selection', {
            get() { return sel; },
            set(v) {
              if (typeof v === 'number') sel = { index: v, text: init[v] || '' };
              else sel = v;
            }
          });
        }
        c.children.push(sub);
        return sub;
      }
    };
    return c;
  }

  let previewCtrl = null;
  let btnPreset5 = null;
  let btnSwatch = null;

  const sandbox = {
    $: { global: null },
    app: { name: 'Adobe Illustrator' },
    BridgeTalk: { appName: 'illustrator' },
    ScriptUI: { FontStyle: { BOLD: 1, REGULAR: 0 }, newFont: () => ({}) },
    alert: () => {},
    Window: function (_t, title) {
      const w = makeCtrl('dialog', title);
      w.center = () => {};
      w.layout = { layout: () => {} };
      w.show = () => {
        const achar = (node) => {
          for (const ch of node.children) {
            if (ch.type === 'panel' && ch.onDraw && ch.preferredSize && ch.preferredSize.height > 60) {
              previewCtrl = ch;
            }
            if (ch.type === 'button' && ch.text === '5') btnPreset5 = ch;
            if (ch.type === 'button' && ch.text === 'Ciano') btnSwatch = ch;
            achar(ch);
          }
        };
        achar(w);
        if (previewCtrl && previewCtrl.onDraw) previewCtrl.onDraw.call(previewCtrl);
        if (btnPreset5 && btnPreset5.onClick) btnPreset5.onClick();
        if (btnSwatch && btnSwatch.onClick) btnSwatch.onClick();
        return 1;
      };
      return w;
    }
  };
  sandbox.$.global = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(coreSrc, sandbox);
  vm.runInContext(uiSrc, sandbox);

  const out = sandbox.IBD.ui.formulario('Teste Visual', [
    {
      id: 'margem', rotulo: 'Margem (mm)', tipo: 'numero', grupo: 'Config', padrao: 10, presets: [3, 5, 10]
    },
    {
      id: 'cor', rotulo: 'Cor', tipo: 'escolha', grupo: 'Config',
      opcoes: ['Magenta', 'Ciano'],
      cores: [
        { valor: 'Magenta', curto: 'Magenta', rgb: [230, 0, 126] },
        { valor: 'Ciano', curto: 'Ciano', rgb: [0, 160, 230] }
      ],
      padrao: 'Magenta'
    },
    {
      id: 'prev', tipo: 'preview', grupo: 'Previa', altura: 100,
      desenhar: (_g, _w, _h, vals) => { drawCalls++; return 'M=' + vals.margem; }
    }
  ], 'OK', { subtitulo: 'Subtitulo de teste' });

  sandbox.IBD.ui.resumo('Teste Resumo', ['Linha 1', 'Linha 2']);

  assert.equal(out.margem, 5);
  assert.equal(out.cor, 'Ciano');
  assert.ok(drawCalls >= 1);
  assert.ok(previewCtrl);
}));

await Promise.all(assincronos);

const falhas = results.filter((r) => !r.ok);
for (const r of results) {
  console.log((r.ok ? '  ok   ' : '  FALHA') + '  ' + r.name);
  if (!r.ok) console.log(r.error.split('\n').map((l) => '         ' + l).join('\n'));
}
console.log(`\n${results.length - falhas.length}/${results.length} testes de plugins, icones e UI passaram.`);
if (falhas.length) process.exit(1);
