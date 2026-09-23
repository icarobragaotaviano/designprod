/**
 * Verificações locais da família Auto Layout.
 * Contas reais; contratos do Photoshop simulados, sem executar Adobe.
 * Uso: npm run test:layout
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
/** Arrays criados dentro do vm tem outro prototipo: normaliza antes de comparar. */
function puro(colecao, fn) { return Array.prototype.map.call(colecao, fn); }
function arr(colecao) { return Array.prototype.slice.call(colecao); }
function approx(a, b, tol) {
  assert.ok(Math.abs(a - b) < (tol === undefined ? 1e-6 : tol), `${a} != ${b}`);
}

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

const NUCLEO = [
  'core/extendscript/ibd-ui.jsx',
  'core/extendscript/ibd-prefs.jsx',
  'core/extendscript/ibd-ps-camadas.jsx'
];

/** Contexto só com o motor, para testar as contas puras. */
function contextoMotor() {
  const sandbox = { alert() {}, confirm: () => true };
  sandbox.$ = { global: sandbox, writeln() {} };
  sandbox.BridgeTalk = { appName: 'photoshop' };
  const ctx = vm.createContext(sandbox);
  const vistos = new Set();
  vm.runInContext(fonte('core/extendscript/ibd-layout.jsx', vistos), ctx);
  return ctx.IBD.layout;
}

const L = contextoMotor();

/* ------------------------------------------------------------------ *
 * 1. Motor: eixo principal
 * ------------------------------------------------------------------ */

function itens(lista) {
  return lista.map((v, i) => ({ id: 'c' + (i + 1), x: v[0], y: v[1], w: v[2], h: v[3] }));
}
function xs(r) { return puro(r.itens, (i) => i.x); }
function ys(r) { return puro(r.itens, (i) => i.y); }

test('Horizontal: itens encostam na origem e respeitam o espaço pedido', () => {
  const r = L.calcular({ direcao: 'horizontal', gap: 20 },
    itens([[0, 0, 100, 50], [500, 300, 60, 50], [10, 10, 40, 50]]));
  assert.deepEqual(xs(r), [0, 120, 200]);
  assert.deepEqual(ys(r), [0, 0, 0]);
  assert.equal(r.caixa.largura, 240);
  assert.equal(r.caixa.altura, 50);
  assert.equal(r.linhas, 1);
});

test('Vertical: empilha pelo topo e a caixa abraça o conteúdo', () => {
  const r = L.calcular({ direcao: 'vertical', gap: 10 },
    itens([[0, 0, 100, 50], [0, 0, 80, 30]]));
  assert.deepEqual(ys(r), [0, 60]);
  assert.deepEqual(xs(r), [0, 0]);
  assert.equal(r.caixa.altura, 90);
  assert.equal(r.caixa.largura, 100);
});

test('Preenchimento empurra o conteúdo para dentro e cresce a caixa', () => {
  const r = L.calcular({ gap: 0, padding: 32 }, itens([[0, 0, 100, 50], [0, 0, 100, 50]]));
  assert.deepEqual(xs(r), [32, 132]);
  assert.deepEqual(ys(r), [32, 32]);
  assert.equal(r.caixa.largura, 200 + 64);
  assert.equal(r.caixa.altura, 50 + 64);
});

test('Preenchimento por lado: topo, direita, base, esquerda', () => {
  const r = L.calcular({ gap: 0, padding: [10, 20, 30, 40] }, itens([[0, 0, 100, 50]]));
  assert.deepEqual(xs(r), [40]);
  assert.deepEqual(ys(r), [10]);
  assert.equal(r.caixa.largura, 100 + 40 + 20);
  assert.equal(r.caixa.altura, 50 + 10 + 30);
});

test('Ordem inversa troca a sequência sem mexer nas medidas', () => {
  const r = L.calcular({ gap: 10, ordem: 'inversa' },
    itens([[0, 0, 100, 50], [0, 0, 20, 50]]));
  assert.deepEqual(puro(r.itens, (i) => i.id), ['c2', 'c1']);
  assert.deepEqual(xs(r), [0, 30]);
});

/* ------------------------------------------------------------------ *
 * 2. Motor: eixo transversal
 * ------------------------------------------------------------------ */

test('Alinhamento transversal: início, centro e fim contra o item mais alto', () => {
  const caixas = itens([[0, 0, 50, 100], [0, 0, 50, 40]]);
  assert.deepEqual(ys(L.calcular({ gap: 0, alinhamento: 'inicio' }, caixas)), [0, 0]);
  assert.deepEqual(ys(L.calcular({ gap: 0, alinhamento: 'centro' }, caixas)), [0, 30]);
  assert.deepEqual(ys(L.calcular({ gap: 0, alinhamento: 'fim' }, caixas)), [0, 60]);
});

test('Esticar iguala a medida transversal e informa a escala', () => {
  const r = L.calcular({ gap: 0, alinhamento: 'esticar' }, itens([[0, 0, 50, 100], [0, 0, 50, 40]]));
  assert.deepEqual(puro(r.itens, (i) => i.h), [100, 100]);
  assert.equal(r.itens[1].redimensionou, true);
  approx(r.itens[1].escalaY, 250);
  assert.equal(r.itens[0].redimensionou, false);
});

test('Com quadro de medida fixa, o alinhamento vale contra o quadro', () => {
  const r = L.calcular({ gap: 0, alinhamento: 'centro', ajuste: 'caixa' },
    itens([[0, 0, 50, 40]]), { x: 0, y: 0, largura: 200, altura: 200 });
  assert.deepEqual(ys(r), [80]);
  assert.equal(r.caixa.altura, 200);
});

/* ------------------------------------------------------------------ *
 * 3. Motor: distribuição
 * ------------------------------------------------------------------ */

test('Espaço entre: primeiro e último encostam nas bordas do quadro', () => {
  const r = L.calcular({ distribuicao: 'entre', ajuste: 'caixa' },
    itens([[0, 0, 100, 10], [0, 0, 100, 10], [0, 0, 100, 10]]),
    { x: 0, y: 0, largura: 500, altura: 10 });
  assert.deepEqual(xs(r), [0, 200, 400]);
});

test('Espaço ao redor e uniforme repartem a sobra como no Figma', () => {
  const caixa = { x: 0, y: 0, largura: 400, altura: 10 };
  const dois = itens([[0, 0, 100, 10], [0, 0, 100, 10]]);
  // sobra 200: ao redor => 50 | 100 | 50 ; uniforme => 66,67 em cada um dos 3 vãos
  assert.deepEqual(xs(L.calcular({ distribuicao: 'ao-redor', ajuste: 'caixa' }, dois, caixa)), [50, 250]);
  const uni = L.calcular({ distribuicao: 'uniforme', ajuste: 'caixa' }, dois, caixa);
  assert.deepEqual(xs(uni), [67, 233]);
});

test('Início, centro e fim posicionam o bloco inteiro dentro do quadro', () => {
  const caixa = { x: 0, y: 0, largura: 400, altura: 10 };
  const dois = itens([[0, 0, 100, 10], [0, 0, 100, 10]]);
  assert.deepEqual(xs(L.calcular({ gap: 0, distribuicao: 'inicio', ajuste: 'caixa' }, dois, caixa)), [0, 100]);
  assert.deepEqual(xs(L.calcular({ gap: 0, distribuicao: 'centro', ajuste: 'caixa' }, dois, caixa)), [100, 200]);
  assert.deepEqual(xs(L.calcular({ gap: 0, distribuicao: 'fim', ajuste: 'caixa' }, dois, caixa)), [200, 300]);
});

test('Distribuição com espaço sem quadro fixo usa a área atual e avisa', () => {
  const r = L.calcular({ distribuicao: 'entre' },
    [{ id: 'a', x: 0, y: 0, w: 50, h: 10 }, { id: 'b', x: 250, y: 0, w: 50, h: 10 }]);
  assert.deepEqual(xs(r), [0, 250]);
  assert.ok(r.avisos.join(' ').indexOf('medida fixa') > -1);
});

test('Conteúdo maior que o quadro entra no relatório em vez de falhar', () => {
  const r = L.calcular({ gap: 0, distribuicao: 'centro', ajuste: 'caixa' },
    itens([[0, 0, 300, 10], [0, 0, 300, 10]]), { x: 0, y: 0, largura: 400, altura: 10 });
  assert.ok(r.avisos.join(' ').indexOf('passa do quadro') > -1);
});

/* ------------------------------------------------------------------ *
 * 4. Motor: quebra de linha
 * ------------------------------------------------------------------ */

test('Quebra em 350 px: três itens de 100 com espaço 20 viram duas linhas', () => {
  const r = L.calcular({ gap: 20, gapLinha: 30, quebra: 350 },
    itens([[0, 0, 100, 50], [0, 0, 100, 50], [0, 0, 100, 50], [0, 0, 100, 50]]));
  assert.equal(r.linhas, 2);
  assert.deepEqual(puro(r.itens, (i) => i.linha), [0, 0, 0, 1]);
  assert.deepEqual(xs(r), [0, 120, 240, 0]);
  assert.deepEqual(ys(r), [0, 0, 0, 80]);
  assert.equal(r.caixa.largura, 350);
});

test('Quebra respeita o preenchimento ao medir a linha', () => {
  const r = L.calcular({ gap: 0, padding: 25, quebra: 250 },
    itens([[0, 0, 100, 10], [0, 0, 100, 10], [0, 0, 100, 10]]));
  assert.equal(r.linhas, 2);
  assert.deepEqual(puro(r.itens, (i) => i.linha), [0, 0, 1]);
});

test('Item maior que a quebra fica sozinho na linha e é reportado', () => {
  const r = L.calcular({ gap: 0, quebra: 100 }, itens([[0, 0, 300, 10], [0, 0, 50, 10]]));
  assert.equal(r.linhas, 2);
  assert.ok(r.avisos.join(' ').indexOf('maior que a quebra') > -1);
});

test('Quebra vertical produz colunas', () => {
  const r = L.calcular({ direcao: 'vertical', gap: 0, quebra: 100 },
    itens([[0, 0, 40, 60], [0, 0, 40, 60]]));
  assert.equal(r.linhas, 2);
  assert.deepEqual(xs(r), [0, 40]);
  assert.deepEqual(ys(r), [0, 0]);
});

/* ------------------------------------------------------------------ *
 * 5. Motor: âncora, arredondamento e recusas
 * ------------------------------------------------------------------ */

test('A âncora é o canto superior esquerdo da área recebida', () => {
  const r = L.calcular({ gap: 10 }, itens([[300, 200, 50, 50], [700, 900, 50, 50]]));
  assert.deepEqual(xs(r), [300, 360]);
  assert.deepEqual(ys(r), [200, 200]);
  assert.equal(r.caixa.x, 300);
  assert.equal(r.caixa.y, 200);
});

test('Deslocamento e sinalização de movimento conferem com a posição antiga', () => {
  const r = L.calcular({ gap: 0 }, itens([[0, 0, 50, 50], [500, 0, 50, 50]]));
  assert.deepEqual(puro(r.itens, (i) => i.dx), [0, -450]);
  assert.deepEqual(puro(r.itens, (i) => i.moveu), [false, true]);
});

test('Posições saem em pixel inteiro por padrão', () => {
  const r = L.calcular({ gap: 7, distribuicao: 'uniforme', ajuste: 'caixa' },
    itens([[0, 0, 33, 10], [0, 0, 33, 10], [0, 0, 33, 10]]), { x: 0, y: 0, largura: 200, altura: 10 });
  for (const i of r.itens) assert.equal(i.x, Math.round(i.x));
});

test('Entradas impossíveis são recusadas com mensagem, não com NaN', () => {
  assert.throws(() => L.calcular({}, []), /Nenhum item/);
  assert.throws(() => L.calcular({}, [{ id: 'a', x: 0, y: 0, w: 0, h: 10 }]), /Medida inv/);
  assert.throws(() => L.calcular({}, [{ id: 'a', x: NaN, y: 0, w: 10, h: 10 }]), /Posição inv/);
  assert.throws(() => L.calcular({ direcao: 'diagonal' }, itens([[0, 0, 10, 10]])), /Direção/);
  assert.throws(() => L.calcular({ alinhamento: 'meio' }, itens([[0, 0, 10, 10]])), /Alinhamento/);
  assert.throws(() => L.calcular({ gap: 'muito' }, itens([[0, 0, 10, 10]])), /Espaçamento/);
  assert.throws(() => L.normalizar({ padding: -5 }), /negativo/);
});

test('Preenchimento que não deixa espaço é recusado antes de mover nada', () => {
  assert.throws(
    () => L.calcular({ padding: 300, ajuste: 'caixa' }, itens([[0, 0, 50, 50]]), { x: 0, y: 0, largura: 400, altura: 400 }),
    /eixo principal/
  );
  assert.throws(
    () => L.calcular({ padding: [300, 10, 300, 10], ajuste: 'caixa' }, itens([[0, 0, 50, 50]]), { x: 0, y: 0, largura: 400, altura: 400 }),
    /eixo transversal/
  );
});

test('Envolver devolve o retângulo que contém todos os itens', () => {
  const r = L.envolver(itens([[10, 20, 30, 40], [100, 5, 10, 10]]));
  assert.deepEqual([r.x, r.y, r.largura, r.altura], [10, 5, 100, 55]);
});

/* ------------------------------------------------------------------ *
 * 6. Etiqueta @auto
 * ------------------------------------------------------------------ */

test('Etiqueta: ida e volta preserva a regra inteira', () => {
  const spec = {
    direcao: 'vertical', gap: 24, gapLinha: 40, padding: [10, 20, 30, 40],
    distribuicao: 'entre', alinhamento: 'centro', quebra: 800,
    ordem: 'inversa', ajuste: 'caixa', unidade: 'mm'
  };
  const nome = L.escreverTag('Cartões', spec);
  const lido = L.lerTag(nome).spec;
  const esperado = L.normalizar(spec);
  for (const k of ['direcao', 'gap', 'gapLinha', 'distribuicao', 'alinhamento', 'quebra', 'ordem', 'ajuste', 'unidade']) {
    assert.equal(lido[k], esperado[k], k);
  }
  assert.deepEqual(arr([lido.padding.topo, lido.padding.direita, lido.padding.base, lido.padding.esquerda]),
    [esperado.padding.topo, esperado.padding.direita, esperado.padding.base, esperado.padding.esquerda]);
});

test('Etiqueta omite o que é padrão e fica curta', () => {
  assert.equal(L.montarTag({ direcao: 'horizontal', gap: 24 }), '@auto[dir=h;gap=24]');
  assert.equal(L.montarTag({ direcao: 'vertical' }), '@auto[dir=v]');
  assert.equal(L.montarTag({ gap: 10, padding: 16 }), '@auto[dir=h;gap=10;pad=16]');
});

test('Etiqueta substitui a anterior em vez de acumular', () => {
  const um = L.escreverTag('Botões', { gap: 10 });
  const dois = L.escreverTag(um, { gap: 20 });
  assert.equal((dois.match(/@auto/g) || []).length, 1);
  assert.equal(L.nomeLimpo(dois), 'Botões');
  assert.equal(L.lerTag(dois).spec.gap, 20);
});

test('Nome sem etiqueta devolve null; etiqueta corrompida avisa', () => {
  assert.equal(L.lerTag('Grupo comum'), null);
  assert.equal(L.temTag('Grupo comum'), false);
  assert.equal(L.temTag('Grupo @auto[dir=h]'), true);
  assert.throws(() => L.lerTag('Grupo @auto[dir=h;lixo]'), /inválida/);
  assert.throws(() => L.lerTag('Grupo @auto[gap=abc]'), /gap/);
  assert.throws(() => L.lerTag('Grupo @auto[pad=1,2]'), /1 ou 4/);
  assert.throws(() => L.lerTag('Grupo @auto[al=meio]'), /Alinhamento/);
});

test('Preenchimento no formato curto aceita 1, 2 e 4 valores', () => {
  assert.deepEqual(arr(L.lerPadding('24')), [24, 24, 24, 24]);
  assert.deepEqual(arr(L.lerPadding('24 40')), [24, 40, 24, 40]);
  assert.deepEqual(arr(L.lerPadding('10 20 30 40')), [10, 20, 30, 40]);
  assert.deepEqual(arr(L.lerPadding('10,20,30,40')), [10, 20, 30, 40]);
  assert.deepEqual(arr(L.lerPadding('  ')), [0, 0, 0, 0]);
  assert.deepEqual(arr(L.lerPadding('3,5')), [3, 5, 3, 5]);
  assert.throws(() => L.lerPadding('1 2 3'), /1, 2 ou 4/);
  assert.throws(() => L.lerPadding('a b'), /Preenchimento/);
});

/* ------------------------------------------------------------------ *
 * 7. Alinhar e distribuir
 * ------------------------------------------------------------------ */

test('Alinhar dentro de uma caixa preserva o outro eixo', () => {
  const r = L.alinhar(itens([[0, 7, 50, 20], [0, 33, 100, 20]]), { x: 0, y: 0, largura: 200, altura: 100 }, 'centro', 'nenhum');
  assert.deepEqual(puro(r.itens, (i) => i.x), [75, 50]);
  assert.deepEqual(puro(r.itens, (i) => i.y), [7, 33]);
});

test('Alinhar pelo fim encosta as bordas direita e inferior', () => {
  const r = L.alinhar(itens([[0, 0, 50, 20]]), { x: 0, y: 0, largura: 200, altura: 100 }, 'fim', 'fim');
  assert.deepEqual([r.itens[0].x, r.itens[0].y], [150, 80]);
});

test('Distribuir por bordas iguala os vãos e mantém as pontas', () => {
  const r = L.distribuir(itens([[0, 0, 50, 10], [100, 0, 50, 10], [350, 0, 50, 10]]), 'horizontal', 'bordas');
  assert.deepEqual(puro(r.itens, (i) => i.x), [0, 175, 350]);
});

test('Distribuir por centros iguala a distância entre centros', () => {
  const r = L.distribuir(itens([[0, 0, 100, 10], [200, 0, 20, 10], [400, 0, 60, 10]]), 'horizontal', 'centros');
  const centros = puro(r.itens, (i) => i.x + i.w / 2);
  approx(centros[1] - centros[0], centros[2] - centros[1], 1);
});

test('Distribuir com espaço fixo encosta uma peça na outra na medida pedida', () => {
  const r = L.distribuir(itens([[0, 0, 100, 10], [500, 0, 50, 10], [900, 0, 30, 10]]), 'horizontal', 'fixo', 10);
  assert.deepEqual(puro(r.itens, (i) => i.x), [0, 110, 170]);
});

test('Distribuir ordena pela posição, não pela ordem de seleção', () => {
  const r = L.distribuir(itens([[400, 0, 50, 10], [0, 0, 50, 10], [200, 0, 50, 10]]), 'horizontal', 'fixo', 0);
  assert.deepEqual(puro(r.itens, (i) => i.id), ['c2', 'c3', 'c1']);
  assert.deepEqual(puro(r.itens, (i) => i.x), [0, 50, 100]);
});

test('Distribuir vertical usa o eixo certo e exige dois itens', () => {
  const r = L.distribuir(itens([[5, 0, 10, 40], [5, 300, 10, 60]]), 'vertical', 'fixo', 20);
  assert.deepEqual(puro(r.itens, (i) => i.y), [0, 60]);
  assert.deepEqual(puro(r.itens, (i) => i.x), [5, 5]);
  assert.throws(() => L.distribuir(itens([[0, 0, 10, 10]]), 'horizontal', 'bordas'), /dois itens/);
});

/* ------------------------------------------------------------------ *
 * 7b. Fase 1 — comportamento do Figma no motor
 * ------------------------------------------------------------------ */

/** Item com propriedades de filho (o que na Fase 2 vem do XMP da camada). */
function com(item, props) { return Object.assign({}, item, props); }
function ws(r) { return puro(r.itens, (i) => i.w); }
function hs(r) { return puro(r.itens, (i) => i.h); }
const CAIXA = (l, a) => ({ x: 0, y: 0, largura: l, altura: a });

test('Preencher: o filho ocupa a sobra do quadro fixo', () => {
  const [a, b, c] = itens([[0, 0, 100, 50], [0, 0, 50, 50], [0, 0, 60, 50]]);
  const r = L.calcular({ gap: 10, ajuste: 'caixa' }, [a, com(b, { largura: 'preencher' }), c], CAIXA(400, 50));
  assert.deepEqual(ws(r), [100, 220, 60]);
  assert.deepEqual(xs(r), [0, 110, 340]);
  assert.equal(r.itens[1].redimensionou, true);
  approx(r.itens[1].escalaX, 440);
});

test('Preencher: dois filhos dividem igual, descontando espaço e preenchimento', () => {
  const [a, b] = itens([[0, 0, 50, 20], [0, 0, 50, 20]]);
  const r = L.calcular({ gap: 20, padding: 10, ajuste: 'caixa' },
    [com(a, { largura: 'preencher' }), com(b, { largura: 'preencher' })], CAIXA(300, 40));
  assert.deepEqual(ws(r), [130, 130]);
  assert.deepEqual(xs(r), [10, 160]);
  assert.deepEqual(ys(r), [10, 10]);
});

test('Preencher: quem bate no máximo fica preso e o resto vai para os outros', () => {
  const [a, b] = itens([[0, 0, 10, 10], [0, 0, 10, 10]]);
  const r = L.calcular({ ajuste: 'caixa' },
    [com(a, { largura: 'preencher', maxLargura: 100 }), com(b, { largura: 'preencher' })], CAIXA(400, 10));
  assert.deepEqual(ws(r), [100, 300]);
  assert.deepEqual(xs(r), [0, 100]);
});

test('Preencher: mínimo maior que a cota é respeitado e os outros encolhem', () => {
  const [a, b, c] = itens([[0, 0, 10, 10], [0, 0, 10, 10], [0, 0, 10, 10]]);
  const r = L.calcular({ ajuste: 'caixa' }, [
    com(a, { largura: 'preencher', minLargura: 200 }),
    com(b, { largura: 'preencher' }),
    com(c, { largura: 'preencher' })
  ], CAIXA(300, 10));
  assert.deepEqual(ws(r), [200, 50, 50]);
});

test('Preencher em quadro que abraça o conteúdo avisa e não mexe na medida', () => {
  const [a] = itens([[0, 0, 100, 20]]);
  const r = L.calcular({}, [com(a, { largura: 'preencher' })]);
  assert.deepEqual(ws(r), [100]);
  assert.ok(r.avisos.join(' ').indexOf('Preencher') > -1);
});

test('Preencher no eixo transversal estica só aquele filho', () => {
  const [a, b] = itens([[0, 0, 50, 20], [0, 0, 50, 20]]);
  const r = L.calcular({ ajuste: 'caixa' }, [com(a, { altura: 'preencher' }), b], CAIXA(300, 100));
  assert.deepEqual(hs(r), [100, 20]);
  assert.deepEqual(ys(r), [0, 0]);
});

test('Esticar do quadro respeita o filho de altura fixa', () => {
  const [a, b, c] = itens([[0, 0, 10, 20], [0, 0, 10, 20], [0, 0, 10, 60]]);
  const r = L.calcular({ alinhamento: 'esticar' }, [a, com(b, { altura: 'fixo' }), c]);
  assert.deepEqual(hs(r), [60, 20, 60]);
});

test('Abraçar obedece a mínimo e máximo do filho; Fixo ignora os dois', () => {
  const [a, b] = itens([[0, 0, 300, 20], [0, 0, 50, 20]]);
  const r = L.calcular({}, [com(a, { maxLargura: 200 }), com(b, { minLargura: 80 })]);
  assert.deepEqual(ws(r), [200, 80]);
  assert.deepEqual(xs(r), [0, 200]);

  const fixo = L.calcular({}, [com(a, { largura: 'fixo', maxLargura: 200 })]);
  assert.deepEqual(ws(fixo), [300]);
});

test('Mínimo do quadro que abraça: o Centro passa a ter espaço para trabalhar', () => {
  const r = L.calcular({ minLargura: 400, distribuicao: 'centro' },
    itens([[0, 0, 100, 50], [0, 0, 100, 50]]));
  assert.equal(r.caixa.largura, 400);
  assert.equal(r.caixa.altura, 50);
  assert.deepEqual(xs(r), [100, 200]);
});

test('Máximo do quadro que abraça: a caixa para no limite e o excesso é avisado', () => {
  const r = L.calcular({ maxLargura: 150 }, itens([[0, 0, 100, 50], [0, 0, 100, 50]]));
  assert.equal(r.caixa.largura, 150);
  assert.ok(r.avisos.join(' ').indexOf('passa do quadro') > -1);
});

test('Absoluto fica fora do fluxo, fora da caixa e parado por padrão', () => {
  const [a, selo, b] = itens([[0, 0, 100, 50], [90, -10, 20, 20], [500, 0, 100, 50]]);
  const r = L.calcular({ gap: 10 }, [a, com(selo, { absoluto: true }), b]);
  const s = r.itens.find((i) => i.id === 'c2');
  assert.deepEqual(puro(r.itens.filter((i) => !i.absoluto), (i) => i.x), [0, 110]);
  assert.equal(s.absoluto, true);
  assert.equal(s.linha, -1);
  assert.deepEqual([s.x, s.y, s.moveu], [90, -10, false]);
  assert.equal(r.caixa.largura, 210, 'o selo não pode alargar o quadro');
  assert.equal(r.caixa.y, 0, 'o selo não pode subir o canto do quadro');
});

test('Absoluto ancorado no canto direito acompanha o quadro quando ele cresce', () => {
  const selo = com({ id: 'selo', x: 0, y: 0, w: 20, h: 20 },
    { absoluto: true, ancora: { h: 'direita', v: 'topo', dx: -5, dy: -5 } });
  const estreito = L.calcular({ padding: 10 }, [{ id: 'a', x: 0, y: 0, w: 100, h: 50 }, selo]);
  const largo = L.calcular({ padding: 10 }, [{ id: 'a', x: 0, y: 0, w: 200, h: 50 }, selo]);
  const x = (r) => r.itens.find((i) => i.id === 'selo');
  assert.deepEqual([x(estreito).x, x(estreito).y], [105, -5]);
  assert.deepEqual([x(largo).x, x(largo).y], [205, -5]);
});

test('Espaço automático nunca fica negativo: sem folga, os itens encostam', () => {
  const tres = itens([[0, 0, 100, 10], [0, 0, 100, 10], [0, 0, 100, 10]]);
  for (const dist of ['entre', 'ao-redor', 'uniforme']) {
    const r = L.calcular({ distribuicao: dist, ajuste: 'caixa' }, tres, CAIXA(150, 10));
    assert.deepEqual(xs(r), [0, 100, 200], dist);
    assert.ok(r.avisos.join(' ').indexOf('não cabe') > -1, dist);
  }
});

test('Item único em "Espaço entre" encosta no início, como no Figma', () => {
  const r = L.calcular({ distribuicao: 'entre', ajuste: 'caixa' }, itens([[50, 0, 100, 10]]), CAIXA(400, 10));
  assert.deepEqual(xs(r), [0]);
});

test('Linha de base: textos de tamanhos diferentes assentam na mesma linha', () => {
  const [a, b, c] = itens([[0, 0, 40, 40], [0, 0, 40, 20], [0, 0, 40, 30]]);
  const r = L.calcular({ alinhamento: 'base' },
    [com(a, { linhaBase: 30 }), com(b, { linhaBase: 16 }), c]);
  assert.deepEqual(ys(r), [0, 14, 0]);
  // A linha de base de cada um, lida do resultado, cai no mesmo y.
  const bases = [30, 16, 30];
  assert.deepEqual(puro(r.itens, (it, k) => it.y + bases[k]), [30, 30, 30]);
  assert.equal(r.caixa.altura, 40);
});

test('Linha de base em fluxo vertical cai no início e avisa', () => {
  const r = L.calcular({ direcao: 'vertical', alinhamento: 'base' },
    itens([[0, 0, 40, 10], [30, 0, 20, 10]]));
  assert.deepEqual(xs(r), [0, 0]);
  assert.ok(r.avisos.join(' ').indexOf('linha de base') > -1);
});

test('Quebra com Preencher: cada linha reparte a própria sobra', () => {
  const [a, b, c, d] = itens([[0, 0, 200, 10], [0, 0, 100, 10], [0, 0, 200, 10], [0, 0, 50, 10]]);
  const r = L.calcular({ quebra: 300 },
    [a, com(b, { largura: 'preencher' }), c, com(d, { largura: 'preencher' })]);
  assert.deepEqual(puro(r.itens, (i) => i.linha), [0, 0, 1, 1]);
  assert.deepEqual(ws(r), [200, 100, 200, 100]);
  assert.deepEqual(xs(r), [0, 200, 0, 200]);
});

test('Etiqueta do quadro guarda limites e linha de base', () => {
  const tag = L.montarTag({ minLargura: 200, maxLargura: 600, alinhamento: 'base' });
  assert.ok(tag.indexOf('al=base') > -1 && tag.indexOf('minw=200') > -1 && tag.indexOf('maxw=600') > -1, tag);
  const lido = L.lerTag('Cartão ' + tag).spec;
  assert.deepEqual([lido.minLargura, lido.maxLargura, lido.alinhamento, lido.minAltura], [200, 600, 'base', null]);
});

test('Limites incoerentes e valores inventados são recusados com o item na mensagem', () => {
  assert.throws(() => L.normalizar({ minLargura: 500, maxLargura: 100 }), /mínimo/);
  assert.throws(() => L.normalizarItem({ largura: 'grande' }), /Largura do item/);
  assert.throws(() => L.normalizarItem({ minAltura: 50, maxAltura: 10 }), /mínimo/);
  assert.throws(() => L.calcular({}, [{ id: 'Título', x: 0, y: 0, w: 10, h: 10, altura: 'imenso' }]), /Título/);
});

test('Propriedades do filho: ida e volta pelo texto que vai para o XMP', () => {
  const props = { largura: 'preencher', altura: 'fixo', maxLargura: 320, absoluto: true,
    ancora: { h: 'direita', v: 'topo', dx: 8, dy: 8 } };
  const texto = L.montarItem(props);
  assert.equal(texto, 'w=preencher;h=fixo;maxw=320;abs=1;ancora=direita,topo,8,8');
  const lido = L.lerItem(texto);
  assert.deepEqual([lido.largura, lido.altura, lido.maxLargura, lido.absoluto, lido.minLargura],
    ['preencher', 'fixo', 320, true, null]);
  assert.deepEqual([lido.ancora.h, lido.ancora.v, lido.ancora.dx, lido.ancora.dy], ['direita', 'topo', 8, 8]);
});

test('Propriedades do filho: vazio é o padrão e texto torto é recusado', () => {
  assert.equal(L.montarItem({}), '');
  const padrao = L.lerItem('');
  assert.deepEqual([padrao.largura, padrao.altura, padrao.absoluto], ['abracar', 'abracar', false]);
  assert.equal(L.lerItem(null).largura, 'abracar');
  assert.throws(() => L.lerItem('w=gigante'), /Largura do item/);
  assert.throws(() => L.lerItem('ancora=direita,topo'), /4 partes/);
  assert.throws(() => L.lerItem('lixo'), /inválida/);
});

/* ------------------------------------------------------------------ *
 * 8. Scripts completos, com o Photoshop simulado
 * ------------------------------------------------------------------ */

function ambiente(config) {
  const cfg = config || {};
  let proximoId = 1;
  const alertas = [];
  const resumos = [];
  const passosHistorico = [];
  let ctx;

  function UV(n) { return { value: Number(n), as: () => Number(n) }; }

  function criarCamada(spec) {
    const estado = {
      x: spec.x || 0, y: spec.y || 0, w: spec.w || 0, h: spec.h || 0,
      efeito: spec.efeito || 0, nome: spec.nome
    };
    const c = {
      typename: spec.filhos ? 'LayerSet' : 'ArtLayer',
      id: proximoId++,
      visible: spec.visivel !== false,
      isBackgroundLayer: !!spec.fundo,
      allLocked: !!spec.travada,
      positionLocked: !!spec.posicaoTravada,
      _estado: estado,
      _falhaMover: !!spec.falhaMover,
      _falhaRenomear: !!spec.falhaRenomear
    };

    if (spec.filhos) c.layers = spec.filhos.map(criarCamada);

    function retangulo(comEfeito) {
      if (c.layers) {
        const visiveis = c.layers.filter((f) => f.visible);
        if (!visiveis.length) return [0, 0, 0, 0];
        const cantos = visiveis.map((f) => f.bounds.map((u) => u.value));
        return [
          Math.min(...cantos.map((b) => b[0])), Math.min(...cantos.map((b) => b[1])),
          Math.max(...cantos.map((b) => b[2])), Math.max(...cantos.map((b) => b[3]))
        ];
      }
      if (estado.w <= 0 || estado.h <= 0) return [0, 0, 0, 0];
      const e = comEfeito ? estado.efeito : 0;
      return [estado.x - e, estado.y - e, estado.x + estado.w + e, estado.y + estado.h + e];
    }

    Object.defineProperties(c, {
      name: {
        get: () => estado.nome,
        set: (v) => {
          if (c._falhaRenomear) throw new Error('Falha simulada ao renomear');
          estado.nome = v;
        }
      },
      bounds: { get: () => retangulo(true).map(UV) },
      boundsNoEffects: { get: () => retangulo(false).map(UV) }
    });

    c.translate = (dx, dy) => {
      if (c._falhaMover) throw new Error('Falha simulada ao mover');
      if (c.layers) { c.layers.forEach((f) => f.translate(dx, dy)); return; }
      estado.x += dx.value;
      estado.y += dy.value;
    };
    c.resize = (px, py, ancora) => {
      assert.equal(ancora, 'topleft', 'Esticar precisa ancorar no canto superior esquerdo');
      estado.w = estado.w * px / 100;
      estado.h = estado.h * py / 100;
    };
    c.state = () => ({ nome: estado.nome, x: estado.x, y: estado.y, w: estado.w, h: estado.h });
    return c;
  }

  const topo = (cfg.camadas || []).map(criarCamada);

  function todas(lista, saida) {
    saida = saida || [];
    for (const c of lista) { saida.push(c); if (c.layers) todas(c.layers, saida); }
    return saida;
  }
  const planaBaixoParaCima = [...topo].reverse();

  function instantaneo() {
    return todas(topo).map((c) => ({ c, ...c._estado }));
  }

  const doc = {
    name: cfg.nome || 'Teste.psd',
    resolution: cfg.resolucao || 72,
    layers: topo,
    activeLayer: null,
    suspendHistory(rotulo, codigo) {
      passosHistorico.push(rotulo);
      vm.runInContext(codigo, ctx);
    }
  };
  Object.defineProperties(doc, {
    width: { get: () => UV(cfg.largura || 1000) },
    height: { get: () => UV(cfg.altura || 1000) },
    activeHistoryState: {
      get: () => instantaneo(),
      set: (v) => v.forEach((s) => Object.assign(s.c._estado, { x: s.x, y: s.y, w: s.w, h: s.h, nome: s.nome }))
    }
  });

  const app = {
    name: 'Adobe Photoshop',
    version: '27.0',
    documents: cfg.semDocumento ? [] : [doc],
    activeDocument: doc,
    preferences: { rulerUnits: 'mm' }
  };

  // Action Manager: leitura da seleção múltipla do painel Camadas.
  // Os índices seguem a convenção do Photoshop — sem Plano de Fundo
  // a contagem de camadas começa em 1.
  function ActionReference() {
    this.putEnumerated = () => { this._alvo = 'documento'; };
    this.putProperty = (_, prop) => { this._propriedade = prop; };
    this.putIndex = (_, i) => { this._indice = i; };
  }
  function executeActionGet(ref) {
    if (ref._alvo === 'documento') {
      const selecionadas = cfg.selecao || [];
      return {
        hasKey: (k) => k === 'targetLayers' && selecionadas.length > 0,
        getList: () => ({
          count: selecionadas.length,
          getReference: (i) => ({ getIndex: () => planaBaixoParaCima.indexOf(topo[selecionadas[i]]) })
        })
      };
    }
    if (ref._propriedade === 'layerID') {
      const temFundo = planaBaixoParaCima.length && planaBaixoParaCima[0].isBackgroundLayer;
      const alvo = temFundo ? planaBaixoParaCima[ref._indice] : planaBaixoParaCima[ref._indice - 1];
      if (!alvo) throw new Error('Índice fora da pilha de camadas');
      return { getInteger: () => alvo.id };
    }
    throw new Error('Referência não suportada no teste');
  }

  const sandbox = {
    app, doc, UnitValue: UV,
    Units: { PIXELS: 'px' },
    AnchorPosition: { TOPLEFT: 'topleft' },
    Direction: { VERTICAL: 'V', HORIZONTAL: 'H' },
    ActionReference, executeActionGet,
    stringIDToTypeID: (s) => s,
    BridgeTalk: { appName: 'photoshop' },
    alert: (m) => alertas.push(String(m)),
    confirm: () => true,
    Window: function () { throw new Error('O teste não deve abrir janela real'); }
  };
  sandbox.$ = { global: sandbox, writeln() {} };
  ctx = vm.createContext(sandbox);

  const vistos = new Set();
  for (const arquivo of NUCLEO) vm.runInContext(fonte(arquivo, vistos), ctx);

  // Preferências e formulário são substituídos: o teste responde o diálogo.
  sandbox.IBD.prefs = { ler: () => cfg.salvas || {}, gravar: () => {} };
  sandbox.IBD.ui.formulario = () => (cfg.form === undefined ? null : cfg.form);
  sandbox.IBD.ui.resumo = (titulo, linhas) => resumos.push(linhas.join('\n'));

  return {
    doc, app, topo, alertas, resumos, passosHistorico,
    camada: (i) => topo[i],
    rodar(arquivo) {
      vm.runInContext(fonte(arquivo, new Set(NUCLEO.map((f) => path.resolve(base, f)))), ctx);
      return this;
    },
    saida: () => resumos.join('\n---\n') + '\n' + alertas.join('\n---\n')
  };
}

const AUTO = 'apps/photoshop/scripts/auto-layout.jsx';
const REAPLICAR = 'apps/photoshop/scripts/auto-layout-reaplicar.jsx';
const ALINHAR = 'apps/photoshop/scripts/alinhar-distribuir.jsx';

const FORM_PADRAO = {
  direcao: 'Horizontal — em linha', unidade: 'px', gap: 20, padding: '0',
  distribuicao: 'Início', alinhamento: 'Início', ajuste: 'Abraçar o conteúdo',
  quebra: 0, gapLinha: 20, ordem: 'Do documento',
  comEfeitos: false, incluirOcultas: false, redimensionar: false, salvarRegra: true
};

function grupo(nome, filhos, extra) {
  return Object.assign({ nome, filhos }, extra || {});
}

test('Auto layout: reposiciona o conteúdo do grupo e guarda a regra no nome', () => {
  const amb = ambiente({
    camadas: [grupo('Cartões', [
      { nome: 'a', x: 0, y: 0, w: 100, h: 60 },
      { nome: 'b', x: 400, y: 300, w: 100, h: 40 },
      { nome: 'c', x: 50, y: 900, w: 100, h: 80 }
    ])],
    form: Object.assign({}, FORM_PADRAO, { gap: 20, padding: '10', alinhamento: 'Centro' })
  });
  amb.doc.activeLayer = amb.camada(0);
  amb.rodar(AUTO);

  const filhos = amb.camada(0).layers.map((c) => c.state());
  assert.deepEqual(filhos.map((f) => f.x), [10, 130, 250]);
  // Altura da linha = 80 (o item mais alto); centro alinha os demais.
  assert.deepEqual(filhos.map((f) => f.y), [10 + 10, 10 + 20, 10]);
  assert.equal(amb.camada(0).name, 'Cartões @auto[dir=h;gap=20;pad=10;al=centro]');
  assert.deepEqual(amb.passosHistorico, ['IBD — Auto layout']);
  assert.equal(amb.app.preferences.rulerUnits, 'mm', 'A régua precisa voltar ao que era');
  assert.ok(amb.saida().indexOf('3 camada(s) reposicionada(s)') > -1);
});

test('Auto layout: camada oculta, bloqueada e vazia ficam fora e são explicadas', () => {
  const amb = ambiente({
    camadas: [grupo('Peças', [
      { nome: 'visível', x: 0, y: 0, w: 100, h: 50 },
      { nome: 'oculta', x: 0, y: 0, w: 100, h: 50, visivel: false },
      { nome: 'travada', x: 0, y: 0, w: 100, h: 50, travada: true },
      { nome: 'vazia', x: 0, y: 0, w: 0, h: 0 },
      { nome: 'outra', x: 900, y: 0, w: 100, h: 50 }
    ])],
    form: Object.assign({}, FORM_PADRAO, { gap: 0 })
  });
  amb.doc.activeLayer = amb.camada(0);
  amb.rodar(AUTO);

  const saida = amb.saida();
  assert.ok(saida.indexOf('oculta — está oculta') > -1);
  assert.ok(saida.indexOf('travada — está totalmente bloqueada') > -1);
  assert.ok(saida.indexOf('vazia — não tem pixels para medir') > -1);
  assert.equal(amb.camada(0).layers[2].state().x, 0, 'A camada bloqueada não pode ter sido movida');
  assert.equal(amb.camada(0).layers[4].state().x, 100);
});

test('Auto layout: cancelar não move nada nem renomeia', () => {
  const amb = ambiente({
    camadas: [grupo('Cartões', [{ nome: 'a', x: 7, y: 9, w: 10, h: 10 }, { nome: 'b', x: 70, y: 90, w: 10, h: 10 }])],
    form: undefined
  });
  amb.doc.activeLayer = amb.camada(0);
  amb.rodar(AUTO);

  assert.deepEqual(amb.camada(0).layers.map((c) => c.state().x), [7, 70]);
  assert.equal(amb.camada(0).name, 'Cartões');
  assert.deepEqual(amb.passosHistorico, []);
});

test('Auto layout: medida em milímetros vira pixel pela resolução do documento', () => {
  const amb = ambiente({
    resolucao: 300,
    camadas: [grupo('Etiquetas', [
      { nome: 'a', x: 0, y: 0, w: 100, h: 50 },
      { nome: 'b', x: 0, y: 0, w: 100, h: 50 }
    ])],
    form: Object.assign({}, FORM_PADRAO, { unidade: 'mm', gap: 10, padding: '5' })
  });
  amb.doc.activeLayer = amb.camada(0);
  amb.rodar(AUTO);

  const pad = Math.round(5 * 300 / 25.4);   // 59
  const gap = 10 * 300 / 25.4;              // 118,11
  const posicoes = amb.camada(0).layers.map((c) => c.state().x);
  assert.equal(posicoes[0], pad);
  assert.equal(posicoes[1], Math.round(pad + 100 + gap));
  assert.ok(amb.camada(0).name.indexOf('un=mm') > -1);
});

test('Auto layout: efeitos de camada entram na medida quando pedido', () => {
  function rodar(comEfeitos) {
    const amb = ambiente({
      camadas: [grupo('Sombras', [
        { nome: 'a', x: 0, y: 0, w: 100, h: 50, efeito: 15 },
        { nome: 'b', x: 0, y: 0, w: 100, h: 50 }
      ])],
      form: Object.assign({}, FORM_PADRAO, { gap: 0, comEfeitos })
    });
    amb.doc.activeLayer = amb.camada(0);
    amb.rodar(AUTO);
    return amb.camada(0).layers.map((c) => c.state().x);
  }
  // Sem efeitos a primeira mede 100 de largura; com efeitos mede 130, e a
  // ancora do conjunto passa a ser a borda da sombra, 15 px antes.
  assert.deepEqual(rodar(false), [0, 100]);
  assert.deepEqual(rodar(true), [0, 115]);
});

test('Auto layout: sem grupo, posiciona a seleção e avisa que a regra não foi guardada', () => {
  const amb = ambiente({
    camadas: [
      { nome: 'topo', x: 500, y: 0, w: 50, h: 50 },
      { nome: 'meio', x: 0, y: 0, w: 50, h: 50 },
      { nome: 'base', x: 250, y: 0, w: 50, h: 50, fundo: true }
    ],
    selecao: [0, 1],
    form: Object.assign({}, FORM_PADRAO, { gap: 10 })
  });
  amb.rodar(AUTO);
  assert.ok(amb.saida().indexOf('regra não foi guardada') > -1);
  assert.ok(amb.saida().indexOf('2 camada(s) reposicionada(s)') > -1);
});

test('Auto layout: falha ao mover uma camada não derruba as outras', () => {
  const amb = ambiente({
    camadas: [grupo('Fila', [
      { nome: 'ok1', x: 0, y: 0, w: 50, h: 50 },
      { nome: 'ruim', x: 300, y: 0, w: 50, h: 50, falhaMover: true },
      { nome: 'ok2', x: 600, y: 0, w: 50, h: 50 }
    ])],
    form: Object.assign({}, FORM_PADRAO, { gap: 0 })
  });
  amb.doc.activeLayer = amb.camada(0);
  amb.rodar(AUTO);

  assert.ok(amb.saida().indexOf('ruim — Falha simulada ao mover') > -1);
  assert.equal(amb.camada(0).layers[2].state().x, 100, 'A camada seguinte ainda é posicionada');
});

test('Auto layout: erro no meio do passo desfaz tudo e avisa', () => {
  const amb = ambiente({
    camadas: [grupo('Fila', [
      { nome: 'a', x: 0, y: 0, w: 50, h: 50 },
      { nome: 'b', x: 300, y: 0, w: 50, h: 50 }
    ], { falhaRenomear: true })],
    form: Object.assign({}, FORM_PADRAO, { gap: 0 })
  });
  amb.doc.activeLayer = amb.camada(0);
  amb.rodar(AUTO);

  assert.deepEqual(amb.camada(0).layers.map((c) => c.state().x), [0, 300], 'Posições precisam voltar ao estado anterior');
  assert.ok(amb.saida().indexOf('Falha simulada ao renomear') > -1);
});

test('Reaplicar: conteúdo mudou de tamanho e a fila volta a ficar certa', () => {
  const amb = ambiente({
    camadas: [grupo('Menu @auto[dir=v;gap=10]', [
      { nome: 'item 1', x: 0, y: 0, w: 200, h: 40 },
      { nome: 'item 2', x: 0, y: 50, w: 200, h: 90 },
      { nome: 'item 3', x: 0, y: 100, w: 200, h: 40 }
    ])],
    form: { alvo: 'Todos os quadros do documento (1)', comEfeitos: false, incluirOcultas: false, redimensionar: false }
  });
  amb.rodar(REAPLICAR);

  assert.deepEqual(amb.camada(0).layers.map((c) => c.state().y), [0, 50, 150]);
  assert.deepEqual(amb.passosHistorico, ['IBD — Reaplicar auto layout']);
  assert.ok(amb.saida().indexOf('1 quadro(s) reaplicado(s)') > -1);
});

test('Reaplicar: quadro aninhado é recalculado antes do quadro que o contém', () => {
  const amb = ambiente({
    camadas: [grupo('Fora @auto[dir=h;gap=100]', [
      { nome: 'bloco', x: 0, y: 0, w: 50, h: 50 },
      grupo('Dentro @auto[dir=h;gap=0]', [
        { nome: 'd1', x: 1000, y: 0, w: 60, h: 50 },
        { nome: 'd2', x: 2000, y: 0, w: 60, h: 50 }
      ])
    ])],
    form: { alvo: 'Todos os quadros do documento (2)', comEfeitos: false, incluirOcultas: false, redimensionar: false }
  });
  amb.rodar(REAPLICAR);

  const dentro = amb.camada(0).layers[1];
  // "Dentro" encolhe para 120 px de largura e só então "Fora" o posiciona.
  assert.deepEqual(dentro.layers.map((c) => c.state().x), [150, 210]);
  assert.equal(amb.camada(0).layers[0].state().x, 0);
  assert.ok(amb.saida().indexOf('2 quadro(s) reaplicado(s)') > -1);
});

test('Reaplicar: etiqueta corrompida em um quadro não impede os outros', () => {
  const amb = ambiente({
    camadas: [
      grupo('Bom @auto[dir=h;gap=0]', [
        { nome: 'a', x: 0, y: 0, w: 50, h: 50 },
        { nome: 'b', x: 400, y: 0, w: 50, h: 50 }
      ]),
      grupo('Ruim @auto[gap=xyz]', [{ nome: 'c', x: 0, y: 0, w: 50, h: 50 }])
    ],
    form: { alvo: 'Todos os quadros do documento (2)', comEfeitos: false, incluirOcultas: false, redimensionar: false }
  });
  amb.rodar(REAPLICAR);

  assert.equal(amb.camada(0).layers[1].state().x, 50);
  const saida = amb.saida();
  assert.ok(saida.indexOf('1 quadro(s) reaplicado(s)') > -1);
  assert.ok(saida.indexOf('Ruim') > -1 && saida.indexOf('Fora da reaplicação') > -1);
});

test('Reaplicar: documento sem quadro etiquetado explica o que fazer', () => {
  const amb = ambiente({ camadas: [grupo('Grupo comum', [{ nome: 'a', x: 0, y: 0, w: 10, h: 10 }])], form: {} });
  amb.rodar(REAPLICAR);
  assert.ok(amb.saida().indexOf('Nenhum quadro de auto layout') > -1);
  assert.deepEqual(amb.passosHistorico, []);
});

test('Alinhar: seleção múltipla do painel é lida pelo Action Manager', () => {
  const amb = ambiente({
    camadas: [
      { nome: 'alta', x: 0, y: 0, w: 100, h: 200 },
      { nome: 'baixa', x: 300, y: 500, w: 50, h: 20 },
      { nome: 'fundo', x: 0, y: 0, w: 1000, h: 1000, fundo: true }
    ],
    selecao: [0, 1],
    form: {
      referencia: 'Área das camadas selecionadas', horizontal: 'Não alterar', vertical: 'Meio',
      distribuir: 'Não distribuir', unidade: 'px', espaco: 0, comEfeitos: false, incluirOcultas: false
    }
  });
  amb.rodar(ALINHAR);

  // União vai de y=0 a y=520; o meio de cada peça encosta em 260.
  assert.equal(amb.camada(0).state().y + 200 / 2, 260);
  assert.equal(amb.camada(1).state().y + 20 / 2, 260);
  assert.deepEqual(amb.passosHistorico, ['IBD — Alinhar e distribuir']);
});

test('Alinhar: alinhamento e distribuição no mesmo passo se somam', () => {
  const amb = ambiente({
    camadas: [
      { nome: 'a', x: 0, y: 0, w: 100, h: 50 },
      { nome: 'b', x: 200, y: 300, w: 100, h: 50 },
      { nome: 'c', x: 900, y: 700, w: 100, h: 50 }
    ],
    selecao: [0, 1, 2],
    form: {
      referencia: 'Área das camadas selecionadas', horizontal: 'Não alterar', vertical: 'Topo',
      distribuir: 'Horizontal — espaço fixo', unidade: 'px', espaco: 25,
      comEfeitos: false, incluirOcultas: false
    }
  });
  amb.rodar(ALINHAR);

  assert.deepEqual(amb.topo.map((c) => c.state().y), [0, 0, 0]);
  assert.deepEqual(amb.topo.map((c) => c.state().x), [0, 125, 250]);
});

test('Alinhar: uma camada só não basta e o script diz o porquê', () => {
  const amb = ambiente({
    camadas: [{ nome: 'sozinha', x: 0, y: 0, w: 10, h: 10 }],
    selecao: [0],
    form: {}
  });
  amb.rodar(ALINHAR);
  assert.ok(amb.saida().indexOf('ao menos duas camadas') > -1);
  assert.deepEqual(amb.passosHistorico, []);
});

test('Sem documento aberto, os três scripts avisam em vez de quebrar', () => {
  for (const arquivo of [AUTO, REAPLICAR, ALINHAR]) {
    const amb = ambiente({ semDocumento: true, camadas: [], form: {} });
    amb.rodar(arquivo);
    assert.ok(amb.alertas.length > 0, arquivo);
    assert.deepEqual(amb.passosHistorico, [], arquivo);
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
console.log(`\n${results.length - falhas.length}/${results.length} verificações de layout passaram.`);
if (falhas.length) process.exit(1);
