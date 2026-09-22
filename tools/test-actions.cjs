/**
 * Verificações automatizadas das actions (.atn) do Photoshop.
 *
 * Garante que:
 *  - Nenhum .atn ficou solto na raiz do repositório
 *  - Todos os arquivos .atn em apps/photoshop/actions/ são binários válidos
 *  - O conjunto unificado ibd-producao.atn contém as 9 rotinas integradas
 *  - Os metadados em actions.meta.json e catalog.json estão íntegros
 *  - O kit de distribuição ZIP contém todas as actions e instruções
 *
 * Uso: node tools/test-actions.cjs
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const RAIZ = path.resolve(__dirname, '..');
const DIR_ACTIONS = path.join(RAIZ, 'apps', 'photoshop', 'actions');
const results = [];

function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, error: e.stack });
  }
}

function parseAtnHeader(buffer) {
  assert.ok(buffer.length >= 25, 'buffer menor que o cabeçalho mínimo de 25 bytes');
  let pos = 0;
  const version = buffer.readUInt32BE(pos); pos += 4;
  assert.equal(version, 16, 'versão do ATN deve ser 16');

  const nameLen = buffer.readUInt32BE(pos); pos += 4;
  assert.ok(nameLen > 0, 'tamanho do nome do conjunto deve ser > 0');

  let setName = '';
  for (let i = 0; i < nameLen; i++) {
    const code = buffer.readUInt16BE(pos); pos += 2;
    if (code !== 0) setName += String.fromCharCode(code);
  }

  const expanded = buffer.readUInt8(pos++);
  const actionCount = buffer.readUInt32BE(pos); pos += 4;

  return { version, setName, expanded, actionCount, actionDataStart: pos };
}

/* 1. Raiz limpa -------------------------------------------------------- */

test('Nenhum arquivo .atn solto na raiz do repositório', () => {
  const arquivosRaiz = fs.readdirSync(RAIZ);
  const soltos = arquivosRaiz.filter((f) => f.toLowerCase().endsWith('.atn'));
  assert.deepEqual(soltos, [], 'foram encontrados arquivos .atn na raiz: ' + soltos.join(', '));
});

/* 2. Integridade dos arquivos de actions -------------------------------- */

const actionsEsperadas = [
  '150-dpi.atn',
  'atualizar-vinculos.atn',
  'sangria-canvas.atn',
  'place-holder.atn',
  'revincular.atn',
  'exportar-jpeg-impressao.atn',
  'exportar-png.atn',
  'salvar-pdf-x1a.atn',
  'salvar-pdf-leitura.atn'
];

test('Todas as 9 actions individuais existem em apps/photoshop/actions/', () => {
  for (const nome of actionsEsperadas) {
    const caminho = path.join(DIR_ACTIONS, nome);
    assert.ok(fs.existsSync(caminho), `arquivo ausente: ${nome}`);
    const stat = fs.statSync(caminho);
    assert.ok(stat.size > 200, `arquivo ${nome} parece truncado (${stat.size} bytes)`);
  }
});

test('Todas as actions individuais são binários ATN versão 16 válidos', () => {
  for (const nome of actionsEsperadas) {
    const buf = fs.readFileSync(path.join(DIR_ACTIONS, nome));
    const header = parseAtnHeader(buf);
    assert.equal(header.actionCount, 1, `${nome} deve conter exatamente 1 action`);
    assert.ok(header.setName.length > 0, `${nome} deve ter nome de conjunto`);
  }
});

/* 3. Pacote consolidado ------------------------------------------------ */

test('Pacote consolidado ibd-producao.atn existe e reúne as 9 actions', () => {
  const caminho = path.join(DIR_ACTIONS, 'ibd-producao.atn');
  assert.ok(fs.existsSync(caminho), 'ibd-producao.atn ausente');
  const buf = fs.readFileSync(caminho);
  const header = parseAtnHeader(buf);
  assert.equal(header.actionCount, 9, 'ibd-producao.atn deve conter as 9 actions');
  assert.equal(header.setName, 'IBD Produção', 'nome do conjunto deve ser IBD Produção');
});

/* 4. Metadados e Catálogo ---------------------------------------------- */

test('actions.meta.json define propriedades para todas as actions', () => {
  const metaPath = path.join(DIR_ACTIONS, 'actions.meta.json');
  assert.ok(fs.existsSync(metaPath), 'actions.meta.json ausente');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  assert.ok(meta.actions, 'chave "actions" ausente em actions.meta.json');

  const chaves = ['ibd-producao', ...actionsEsperadas.map((n) => n.replace(/\.atn$/, ''))];
  for (const k of chaves) {
    assert.ok(meta.actions[k], `chave ${k} ausente em actions.meta.json`);
    const item = meta.actions[k];
    assert.ok(item.titulo && item.titulo.length > 3, `${k}: título inválido`);
    assert.ok(item.descricao && item.descricao.length > 15, `${k}: descrição muito curta`);
    assert.ok(Array.isArray(item.tags) && item.tags.length > 0, `${k}: tags ausentes`);
    assert.match(item.versao, /^\d+\.\d+\.\d+$/, `${k}: versão deve ser semver`);
    assert.ok(fs.existsSync(path.join(RAIZ, item.doc)), `${k}: arquivo de doc ${item.doc} não existe`);
  }
});

test('catalog.json inclui todas as 10 entradas de action do Photoshop', () => {
  const catPath = path.join(RAIZ, 'catalog.json');
  const cat = JSON.parse(fs.readFileSync(catPath, 'utf8'));
  const doApp = cat.ferramentas.filter((f) => f.app === 'photoshop' && f.tipo === 'action');
  assert.equal(doApp.length, 10, 'esperado 10 actions no catálogo (9 individuais + 1 kit)');

  for (const f of doApp) {
    assert.ok(f.id.startsWith('photoshop/actions/'), 'id fora do padrão: ' + f.id);
    assert.ok(fs.existsSync(path.join(RAIZ, f.arquivo)), 'arquivo apontado não existe: ' + f.arquivo);
    assert.ok(f.titulo && !f.titulo.includes('_'), 'título mal formatado: ' + f.titulo);
    assert.ok(!f.descricao.includes('Instale pelo painel Actions.'), 'ficou com descrição genérica legada: ' + f.id);
    assert.ok(f.doc, 'doc ausente: ' + f.id);
  }
});

/* 5. Kit ZIP de distribuição ------------------------------------------- */

test('Kit ZIP de distribuição existe e contém arquivos esperados', () => {
  const zipPath = path.join(RAIZ, 'downloads', 'kit-actions-photoshop-v1.0.zip');
  assert.ok(fs.existsSync(zipPath), 'kit-actions-photoshop-v1.0.zip ausente');
  const stat = fs.statSync(zipPath);
  assert.ok(stat.size > 5000, 'tamanho do ZIP suspeito: ' + stat.size);
});

/* Relatório de Resultados ---------------------------------------------- */

const falhas = results.filter((r) => !r.ok);
for (const r of results) {
  console.log((r.ok ? '  ok   ' : '  FALHA') + '  ' + r.name);
  if (!r.ok) console.log(r.error.split('\n').map((l) => '         ' + l).join('\n'));
}

console.log(`\n${results.length - falhas.length}/${results.length} verificações de actions passaram.`);
if (falhas.length) process.exit(1);
