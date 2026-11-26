import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import '../core/producao/folha/engine.js';
import '../core/producao/folha/operacoes.js';

const { executar } = globalThis.FolhaOperacoes;
const calcular = (operacao, parametros = {}) => executar({ versaoContrato: 1, operacao, parametros });
const motor = globalThis.Folha;
const cenario = { pw: 120, ph: 80, sw: 300, sh: 300, bleed: 0, gapX: 0, gapY: 0, left: 0, right: 0,
  grip: 0, tail: 0, bar: 0, regMarks: false, colorBar: false, sheetInfoStrip: false };
const cenarios = [
  ['montar-pecas', 'flat', {}],
  ['montar-pecas', 'flat', { sw: 660, sh: 960, gsm: 250, setup: 10, waste: 5 }],
  ['montar-pecas', 'flat', { ...cenario, orientation: 'mixed' }],
  ...['sheetwise', 'perfector', 'turn', 'tumble'].map(style => ['montar-pecas', 'flat', { style }]),
  ['montar-pecas', 'flat', { plateView: true, plateW: 100, plateH: 100 }],
  ...['F4-1', 'F8-1', 'F16-1', 'LOOSE-2'].map(foldPattern => ['planejar-cadernos', 'book', {
    foldPattern, pages: 13, sw: 660, sh: 960, creepMode: 'auto', pageOverrides: { 1: 'blank', 2: 7 }
  }]),
  ['planejar-lona', 'visual', { pw: 1700, ph: 1200, sw: 800, sh: 3000, process: 'plotter', weld: 25 }],
  ['avaliar-orientacoes', 'free', { ...cenario, freeMarginMode: 'zero' }],
  ['comparar-folhas', 'compare', { compareSheets: [{ id: 'a', name: 'A4', w: 210, h: 297 }, { id: 'b', name: 'A5', w: 148, h: 210 }] }],
  ['sugerir-folhas', 'suggest', { pw: 90, ph: 50, customPapers: [{ id: 'custom', label: 'Extra', sw: 400, sh: 500 }] }]
];
for (const [operacao, mode, parametros] of cenarios) {
  const plano = calcular(operacao, parametros);
  assert.deepEqual(plano.resultado, motor.compute({ ...parametros, mode }), operacao);
  assert.equal(plano.unidade, 'mm');
}

assert.equal(calcular('montar-pecas').resultado.count, 21);
assert.equal(calcular('montar-pecas', cenarios[1][2]).resultado.ream, 79.2);
assert.equal(calcular('montar-pecas', { ...cenario, orientation: 'mixed' }).resultado.count, 7);
const editado = calcular('montar-pecas', { edits: { p0: { deleted: true }, p1: { sku: 'B' } } });
assert.equal(editado.resultado.count, 20);
assert.equal(editado.resultado.skuCounts.B, 1);
const mistoGrande = calcular('montar-pecas', { ...cenario, orientation: 'mixed', pw: 9, ph: 5 });
assert.equal(mistoGrande.materializavel, false);
assert.ok(mistoGrande.resultado.capacity > 700);
assert.ok(mistoGrande.diagnosticos.some(d => d.codigo === 'LIMITE_EDITAVEL'));
const chapa = calcular('montar-pecas', { plateView: true, plateW: 100, plateH: 100 });
assert.ok(chapa.diagnosticos.find(item => item.codigo === 'PLATE_OVERFLOW').regiao);
assert.equal(chapa.materializavel, false);
const frenteVerso = calcular('montar-pecas', { style: 'sheetwise' });
assert.equal(frenteVerso.faces.length, 2);
const p = frenteVerso.faces[0].items[0];
assert.equal(frenteVerso.faces[1].items[0].x, frenteVerso.parametros.sw - p.x - p.w);
assert.throws(() => executar({ versaoContrato: 2, operacao: 'montar-pecas', parametros: {} }), /Versão/);
assert.throws(() => calcular('constructor'), /desconhecida/);
assert.throws(() => calcular('montar-pecas', { extras: [null] }), /extras/);

const cli = fileURLToPath(new URL('folha.mjs', import.meta.url));
const entrada = { versaoContrato: 1, operacao: 'montar-pecas', parametros: {} };
const sa = spawnSync(process.execPath, [cli], { input: JSON.stringify(entrada), encoding: 'utf8' });
assert.equal(sa.status, 0, sa.stderr);
assert.deepEqual(JSON.parse(sa.stdout), JSON.parse(JSON.stringify(executar(entrada))));

const runner = readFileSync(new URL('../plugins/adobe-cep/host/runner.jsx', import.meta.url), 'utf8');
const host = vm.createContext({});
vm.runInContext(runner, host);
const blocos = [[1, frenteVerso.parametros.sw, frenteVerso.parametros.sh, frenteVerso.parametros.bleed, 0, 2].join(',')];
for (const face of frenteVerso.faces) blocos.push(face.items.map(item => [item.x, item.y, item.w, item.h, item.angle].join(',')).join(';'));
assert.equal(host.ibdLerGeometriaFolha(blocos.join('|')).faces.length, 2);
assert.throws(() => host.ibdLerGeometriaFolha('1,320,450,3,0,1|alert(1),10,90,50,0'), /Medida inválida/);
assert.throws(() => host.ibdLerGeometriaFolha('1,320,450,3,0,1|20,20,90,50,45'), /rotação/);
assert.throws(() => host.ibdLerGeometriaFolha('1,320,450,3,0,1|300,20,90,50,0'), /fora/);

const pt = 72 / 25.4;
const abas = [{ artboardRect: [0, 400, 300, 0] }];
const camadas = [];
let ativa = 0;
let aceitar = true;
let simularFalha = false;
const camadaOriginal = { name: 'Arte original' };
abas.getActiveArtboardIndex = () => ativa;
abas.setActiveArtboardIndex = indice => { ativa = indice; };
abas.add = artboardRect => {
  const aba = { artboardRect, remove() { abas.splice(abas.indexOf(aba), 1); } };
  abas.push(aba);
  ativa = abas.length - 1;
  return aba;
};
const doc = { artboards: abas, visibleBounds: [0, 400, 300, 0], activeLayer: camadaOriginal, layers: {
  add() {
    const provas = [];
    const camada = { provas, pathItems: { rectangle(...limites) {
      if (simularFalha) throw Error('Falha de desenho');
      provas.push(limites);
      return {};
    } }, remove() { camadas.splice(camadas.indexOf(camada), 1); } };
    camadas.push(camada);
    doc.activeLayer = camada;
    return camada;
  }
} };
Object.assign(host, { app: { documents: [doc], activeDocument: doc, coordinateSystem: 'original' },
  confirm: () => aceitar, CMYKColor: function () {}, CoordinateSystem: { DOCUMENTCOORDINATESYSTEM: 'documento' } });
const umCartao = '1,320,450,3,0,1|20,30,90,50,0';
assert.equal(host.ibdAplicarFolha(umCartao), 'OK');
assert.equal(abas.length, 2);
assert.equal(ativa, 0);
assert.equal(doc.activeLayer, camadaOriginal);
assert.equal(host.app.coordinateSystem, 'original');
const [topo, esquerda, largura, altura] = camadas[0].provas[1];
assert.equal(topo, abas[1].artboardRect[1] - 30 * pt);
assert.equal(esquerda, abas[1].artboardRect[0] + 20 * pt);
assert.equal(largura, 90 * pt);
assert.equal(altura, 50 * pt);
aceitar = false;
assert.equal(host.ibdAplicarFolha(umCartao), 'Cancelado.');
aceitar = true;
simularFalha = true;
assert.equal(host.ibdAplicarFolha(umCartao), 'ERRO: Falha de desenho');
assert.equal(abas.length, 2);
assert.equal(camadas.length, 1);
console.log(`${cenarios.length} cenários de paridade Folha, contrato, CLI e ponte Illustrator validados.`);

await import('../plugins/adobe-cep/js/folha-producao.js');
const producao = globalThis.IBDFolhaProducao;
const maquina = { margem: 5, pinca: 12, pincaLado: 'bottom', compartilhado: false, barra: true, patchH: 5 };
const valores = { sw: 320, sh: 450, pw: 90, ph: 50, bleed: 3, qty: 1000 };
const opcoes = { offset: 3.5, comprimento: 5, stroke: 0.35, registro: true, barra: true,
  patchW: 5, patchH: 5, os: 'OS 10482', arteSangrada: true };
const montar = (ajustes = {}, medidas = {}) => producao.calcular({ ...valores, ...medidas }, { ...maquina, ...ajustes });
const duplo = montar();
const simples = montar({ compartilhado: true });
assert.equal(duplo.plano.resultado.count, 21);
assert.equal(duplo.plano.resultado.items[1].x - duplo.plano.resultado.items[0].x, 96);
assert.equal(21 * 90 * 50 / (320 * 450), 0.65625);
assert.equal(simples.plano.resultado.count, 24);
assert.equal(simples.plano.resultado.items[1].x - simples.plano.resultado.items[0].x, 50);
assert.equal(simples.plano.resultado.items[0].angle, 90);
assert.throws(() => montar({ compartilhado: true }, { orientation: 'mixed' }), /uniforme/);
const fibra = montar({}, { grain: 'x', pieceGrain: 'height' });
assert.ok(fibra.plano.resultado.items.length > 0);
assert.ok(fibra.plano.resultado.items.every(item => item.angle === 90));

for (const pincaLado of ['top', 'bottom', 'left', 'right']) {
  for (const compartilhado of [false, true]) {
    const m = montar({ pincaLado, compartilhado });
    const t = producao.tecnicas(m, opcoes);
    const expected = { top: [0, 12, 320, 450], bottom: [0, 0, 320, 438],
      left: [12, 0, 320, 450], right: [0, 0, 308, 450] };
    assert.deepEqual(t.area, expected[pincaLado]);
    assert.equal(t.faltantes, 0);
    assert.equal(t.escala.length, 14);
    assert.equal(t.miras.length, 4);
    assert.equal(t.os.length, 4);
    const folga = opcoes.stroke / (2 * pt);
    const regioes = t.linhas.map(l => [l[0] - folga, l[1] - folga, l[2] + folga, l[3] + folga])
      .concat(t.miras.map(([x, y, raio]) => [x - 1.6 * raio, y - 1.6 * raio, x + 1.6 * raio, y + 1.6 * raio]))
      .concat(t.escala.map(([x, y, w, h]) => [x, y, x + w, y + h]), [t.os]);
    for (const b of regioes) {
      const [x1, y1, x2, y2] = b;
      const [ax1, ay1, ax2, ay2] = t.arte;
      assert.ok(x1 >= t.area[0] && y1 >= t.area[1] && x2 <= t.area[2] && y2 <= t.area[3]);
      assert.ok(x2 <= ax1 || y2 <= ay1 || x1 >= ax2 || y1 >= ay2, 'Marca sobre a sangria');
    }
  }
}
assert.ok(producao.tecnicas(duplo, { ...opcoes, offset: 0 }).avisos.some(a => a.includes('Afastamento')));
assert.equal(producao.tecnicas(duplo, { ...opcoes, patchW: 100 }).escala.length, 0);
assert.ok(producao.tecnicas(duplo, { ...opcoes, comprimento: 1000 }).faltantes > 0);

const dados = producao.tecnicas(simples, opcoes);
const geometria = producao.codificar(simples.plano, false);
const comandos = producao.codificarTecnicas(simples, dados, opcoes, true);
assert.equal(host.ibdLerTecnicasFolha(comandos, host.ibdLerGeometriaFolha(geometria)).escala.length, 14);
assert.throws(() => host.ibdLerTecnicasFolha(comandos.replace('0.35', '1'), host.ibdLerGeometriaFolha(geometria)), /inválidas/);

const pdfPrefs = { pDFCropToBox: 'preferência', pageToOpen: 7 };
let arquivoFonte = { name: 'cartao.pdf', exists: true };
let larguraVinculo = 96;
let chamadasCriacao = 0;
let gerado;
const origemReal = [123, 789];
const spotRegistro = { colorType: 'registro' };
function caminhos(destino) {
  function criar() {
    const path = { setEntirePath(pontos) { this.pontos = pontos; }, zOrder() {} };
    destino.paths.push(path);
    return path;
  }
  return { add: criar, rectangle(...b) { const path = criar(); path.ret = b; return path; },
    ellipse(...b) { const path = criar(); path.elipse = b; return path; } };
}
function camada() {
  const c = { paths: [], grupos: [], textos: [], printable: true };
  c.pathItems = caminhos(c);
  c.groupItems = { add() {
    const g = { paths: [] };
    g.pathItems = caminhos(g);
    c.grupos.push(g);
    return g;
  } };
  c.textFrames = { add() {
    const t = { textRange: { characterAttributes: {} }, width: 30, height: 9 };
    c.textos.push(t);
    return t;
  } };
  return c;
}
function novoDocumento(modo, w, h) {
  assert.equal(modo, 'CMYK');
  assert.ok(Math.abs(w - 320 * pt) < 1e-8 && Math.abs(h - 450 * pt) < 1e-8);
  chamadasCriacao++;
  const layers = [camada()];
  layers.add = () => { const c = camada(); layers.unshift(c); return c; };
  return gerado = {
    layers, spots: [{ name: 'Registro personalizado', colorType: 'spot' }, spotRegistro], copias: [],
    artboards: [{ artboardRect: [...origemReal, origemReal[0] + w, origemReal[1] - h] }],
    close(opcao) { assert.equal(opcao, 'descartar'); this.fechou = true; },
    placedItems: { add() {
      return {
        set file(arquivo) {
          assert.equal(arquivo, arquivoFonte);
          assert.equal(pdfPrefs.pageToOpen, 1);
          assert.equal(pdfPrefs.pDFCropToBox, 'BleedBox');
          this.geometricBounds = [0, 0, larguraVinculo * pt, -56 * pt];
        },
        duplicate() {
          const copia = {
            geometricBounds: this.geometricBounds.slice(),
            rotate(graus) {
              assert.equal(graus, -90);
              const b = this.geometricBounds;
              this.geometricBounds = [0, 0, -b[3], -b[2]];
            },
            translate(dx, dy) { this.deslocamento = [dx, dy]; },
            move(g) { g.arte = this; }
          };
          gerado.copias.push(copia);
          return copia;
        },
        remove() { gerado.removeuFonte = true; }
      };
    } }
  };
}
Object.assign(host, {
  app: { coordinateSystem: 'anterior', preferences: { PDFFileOptions: pdfPrefs }, documents: { add: novoDocumento } },
  ColorModel: { REGISTRATION: 'registro' }, SpotColor: function () {}, StrokeCap: { BUTTENDCAP: 'reto' },
  DocumentColorSpace: { CMYK: 'CMYK' }, SaveOptions: { DONOTSAVECHANGES: 'descartar' },
  Transformation: { CENTER: 'centro' }, ElementPlacement: { PLACEATEND: 'fim' }, ZOrderMethod: { BRINGTOFRONT: 'frente' },
  PDFBoxType: { PDFBLEEDBOX: 'BleedBox', PDFTRIMBOX: 'TrimBox' }, $: { os: 'Windows' },
  File: { openDialog: () => arquivoFonte }
});
assert.equal(host.ibdGerarFolha(geometria, comandos, opcoes.os), 'OK');
assert.equal(gerado.copias.length, 24);
assert.equal(gerado.layers[1].grupos.length, 24);
assert.ok(gerado.layers[1].grupos.every(g => g.clipped && g.paths[0].clipping));
const [recorteTopo, recorteX, recorteLarg, recorteAlt] = gerado.layers[1].grupos[0].paths[0].ret;
const pose = simples.plano.faces[0].items[0];
assert.equal(recorteTopo, origemReal[1] - (pose.y - 3) * pt);
assert.equal(recorteX, origemReal[0] + (pose.x - 3) * pt);
assert.equal(recorteLarg, 53 * pt);
assert.equal(recorteAlt, 93 * pt);
assert.equal(gerado.layers[0].paths[0].strokeColor.spot, spotRegistro);
assert.equal(gerado.layers[0].grupos[0].paths.length, 14);
assert.equal(gerado.layers[0].grupos[0].paths[0].fillColor.cyan, 100);
assert.equal(gerado.layers[0].textos[0].contents, opcoes.os);
assert.equal(gerado.removeuFonte, true);
assert.equal(host.app.coordinateSystem, 'anterior');
assert.deepEqual(pdfPrefs, { pDFCropToBox: 'preferência', pageToOpen: 7 });

const desvinculado = producao.codificarTecnicas(simples, dados, opcoes, false);
assert.equal(host.ibdGerarFolha(geometria, desvinculado, opcoes.os), 'OK');
assert.equal(gerado.layers[1].paths.length, 25);
assert.equal(gerado.layers[1].printable, false);
larguraVinculo = 95;
assert.match(host.ibdGerarFolha(geometria, comandos, opcoes.os), /Confira o formato/);
assert.equal(gerado.fechou, true);
assert.deepEqual(pdfPrefs, { pDFCropToBox: 'preferência', pageToOpen: 7 });
const contagemAntes = chamadasCriacao;
arquivoFonte = null;
assert.equal(host.ibdGerarFolha(geometria, comandos, opcoes.os), 'Cancelado.');
assert.equal(chamadasCriacao, contagemAntes);
console.log('Montagem de produção, pinça, matriz vinculada, sangria compartilhada e marcas técnicas validadas.');
