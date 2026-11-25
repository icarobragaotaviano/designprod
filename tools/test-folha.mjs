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
