/**
 * Verificações do escritor de ZIP e do pacote do painel UXP.
 *
 * O ZIP é escrito à mão (tools/lib/zip.mjs) para o repositório continuar sem
 * dependência. Um erro de offset ali gera um arquivo que parece pronto e o
 * Creative Cloud recusa — então aqui o pacote é lido de volta por um leitor
 * independente, escrito neste arquivo, e conferido também com o `unzip` do
 * sistema quando ele existe.
 *
 * Uso: npm run test:pacote
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const assert = require('assert/strict');
const { execFileSync } = require('child_process');

const base = path.resolve(__dirname, '..');
let crcDoModulo = null;   // preenchido apos o import de tools/lib/zip.mjs
const results = [];

function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, error: e.stack }); }
}

/* ------------------------------------------------------------------ *
 * Leitor de ZIP independente: percorre o diretório central, não os
 * cabeçalhos locais, que é como um descompactador de verdade faz.
 * ------------------------------------------------------------------ */

function lerZip(buffer) {
  const FIM = 0x06054b50;
  const CENTRAL = 0x02014b50;
  const LOCAL = 0x04034b50;

  let fim = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === FIM) { fim = i; break; }
  }
  assert.ok(fim >= 0, 'EOCD não encontrado');

  const total = buffer.readUInt16LE(fim + 10);
  const tamanhoCd = buffer.readUInt32LE(fim + 12);
  const inicioCd = buffer.readUInt32LE(fim + 16);
  assert.equal(inicioCd + tamanhoCd, fim, 'diretório central não encosta no EOCD');

  const entradas = [];
  let p = inicioCd;
  for (let i = 0; i < total; i++) {
    assert.equal(buffer.readUInt32LE(p), CENTRAL, `assinatura central na entrada ${i}`);
    const metodo = buffer.readUInt16LE(p + 10);
    const crc = buffer.readUInt32LE(p + 16);
    const comp = buffer.readUInt32LE(p + 20);
    const cru = buffer.readUInt32LE(p + 24);
    const nomeLen = buffer.readUInt16LE(p + 28);
    const extraLen = buffer.readUInt16LE(p + 30);
    const comentarioLen = buffer.readUInt16LE(p + 32);
    const offset = buffer.readUInt32LE(p + 42);
    const nome = buffer.toString('utf8', p + 46, p + 46 + nomeLen);

    assert.equal(buffer.readUInt32LE(offset), LOCAL, `assinatura local de ${nome}`);
    const nomeLocal = buffer.readUInt16LE(offset + 26);
    const extraLocal = buffer.readUInt16LE(offset + 28);
    const inicio = offset + 30 + nomeLocal + extraLocal;
    const corpo = buffer.subarray(inicio, inicio + comp);

    const dados = metodo === 8 ? zlib.inflateRawSync(corpo) : Buffer.from(corpo);
    assert.equal(dados.length, cru, `tamanho de ${nome}`);
    // Preferimos o CRC do zlib, que e implementacao independente. Sem ele,
    // cai no nosso — ja conferido contra os vetores canonicos no 1o teste.
    const conferir = zlib.crc32 || crcDoModulo;
    assert.ok(conferir, 'sem funcao de CRC para conferir o pacote');
    assert.equal(conferir(dados), crc, `crc de ${nome}`);

    entradas.push({ nome, metodo, crc, dados });
    p += 46 + nomeLen + extraLen + comentarioLen;
  }
  return entradas;
}

function comUnzip(buffer, args) {
  const arquivo = path.join(require('os').tmpdir(), 'ibd-teste-' + Date.now() + '.zip');
  fs.writeFileSync(arquivo, buffer);
  try {
    return execFileSync('unzip', [...args, arquivo], { encoding: 'utf8' });
  } finally {
    fs.unlinkSync(arquivo);
  }
}

let temUnzip = true;
try { execFileSync('unzip', ['-v'], { stdio: 'ignore' }); } catch { temUnzip = false; }

/* ------------------------------------------------------------------ */

(async () => {
  const { criarZip, crc32 } = await import('../tools/lib/zip.mjs');
  crcDoModulo = crc32;

  test('CRC-32 bate com o valor canônico do padrão', () => {
    assert.equal(crc32(Buffer.from('123456789')), 0xCBF43926);
    assert.equal(crc32(Buffer.alloc(0)), 0);
    assert.equal(crc32(Buffer.from('a')), 0xE8B7BE43);
  });

  test('Ida e volta: cada arquivo sai igual ao que entrou', () => {
    const entradas = [
      { nome: 'manifest.json', dados: Buffer.from('{"id":"com.ibd.teste"}', 'utf8') },
      { nome: 'src/index.html', dados: Buffer.from('<h1>ação · três</h1>'.repeat(120), 'utf8') },
      { nome: 'src/icons/i.png', dados: Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]) }
    ];
    const lidas = lerZip(criarZip(entradas));
    assert.equal(lidas.length, 3);
    for (const original of entradas) {
      const achada = lidas.find((x) => x.nome === original.nome);
      assert.ok(achada, original.nome);
      assert.equal(Buffer.compare(achada.dados, original.dados), 0, original.nome);
    }
  });

  test('Acento no conteúdo e no caminho sobrevive ao ZIP', () => {
    const lidas = lerZip(criarZip([
      { nome: 'pasta com espaço/ação.txt', dados: Buffer.from('coração — ç ã õ', 'utf8') }
    ]));
    assert.equal(lidas[0].nome, 'pasta com espaço/ação.txt');
    assert.equal(lidas[0].dados.toString('utf8'), 'coração — ç ã õ');
  });

  test('O mesmo conteúdo gera sempre os mesmos bytes', () => {
    const arquivos = [
      { nome: 'b.txt', dados: Buffer.from('bbb') },
      { nome: 'a.txt', dados: Buffer.from('aaa') }
    ];
    const um = criarZip(arquivos);
    const dois = criarZip([...arquivos].reverse());
    assert.equal(Buffer.compare(um, dois), 0, 'a ordem de entrada não pode mudar o pacote');
    assert.equal(Buffer.compare(um, criarZip(arquivos)), 0, 'dois builds seguidos precisam bater');
  });

  test('Dado incompressível é armazenado em vez de crescer', () => {
    const aleatorio = require('crypto').randomBytes(4096);
    const lidas = lerZip(criarZip([
      { nome: 'ruido.bin', dados: aleatorio },
      { nome: 'repetido.txt', dados: Buffer.from('a'.repeat(4096)) }
    ]));
    assert.equal(lidas.find((x) => x.nome === 'ruido.bin').metodo, 0, 'esperado armazenado');
    assert.equal(lidas.find((x) => x.nome === 'repetido.txt').metodo, 8, 'esperado deflate');
  });

  test('Caminho perigoso e pacote vazio são recusados', () => {
    assert.throws(() => criarZip([]), /nenhuma entrada/);
    assert.throws(() => criarZip([{ nome: '/etc/passwd', dados: Buffer.from('x') }]), /invalido/);
    assert.throws(() => criarZip([{ nome: '../fuga.txt', dados: Buffer.from('x') }]), /invalido/);
    assert.throws(() => criarZip([{ nome: '', dados: Buffer.from('x') }]), /invalido/);
  });

  test('A barra invertida do Windows vira barra normal no pacote', () => {
    const lidas = lerZip(criarZip([{ nome: 'src\\lib\\x.js', dados: Buffer.from('1') }]));
    assert.equal(lidas[0].nome, 'src/lib/x.js');
  });

  test(temUnzip ? 'O unzip do sistema aceita o pacote' : 'O unzip do sistema aceita o pacote (pulado)', () => {
    if (!temUnzip) return;
    const zip = criarZip([
      { nome: 'manifest.json', dados: Buffer.from('{"a":1}') },
      { nome: 'src/fundo/x.txt', dados: Buffer.from('conteúdo', 'utf8') }
    ]);
    assert.match(comUnzip(zip, ['-t']), /No errors detected/);
    assert.match(comUnzip(zip, ['-l']), /src\/fundo\/x\.txt/);
  });

  /* Pacote real do painel ------------------------------------------- */

  execFileSync(process.execPath, [path.join(base, 'tools', 'build-plugin.mjs'), 'photoshop-uxp'], {
    cwd: base, stdio: 'pipe'
  });
  const marca = JSON.parse(fs.readFileSync(path.join(base, 'brand.config.json'), 'utf8'));
  const nomeBase = `${marca.id}-ferramentas-${marca.versao}`;
  const ccx = path.join(base, 'dist', `${nomeBase}.ccx`);

  test('O build gera o pacote do painel nos dois nomes', () => {
    assert.ok(fs.existsSync(ccx), 'dist/*.ccx não foi gerado');
    const zip = path.join(base, 'dist', `${nomeBase}.zip`);
    assert.ok(fs.existsSync(zip), 'dist/*.zip não foi gerado');
    assert.equal(Buffer.compare(fs.readFileSync(ccx), fs.readFileSync(zip)), 0,
      '.ccx e .zip precisam ser o mesmo arquivo');
  });

  test('O manifest fica na raiz do pacote — sem isso não instala', () => {
    const entradas = lerZip(fs.readFileSync(ccx));
    const manifest = entradas.find((e) => e.nome === 'manifest.json');
    assert.ok(manifest, 'manifest.json não está na raiz do pacote');
    const lido = JSON.parse(manifest.dados.toString('utf8'));
    assert.equal(lido.version, marca.versao, 'versão do manifest fora de sincronia com a marca');
    assert.equal(lido.manifestVersion, 5);
    assert.ok(lido.host.some((h) => h.app === 'PS'), 'o pacote precisa declarar o Photoshop');
  });

  test('O pacote leva o painel inteiro: página, catálogo e biblioteca', () => {
    const nomes = lerZip(fs.readFileSync(ccx)).map((e) => e.nome);
    for (const obrigatorio of [
      'src/index.html',
      'src/main.js',
      'src/styles.css',
      'src/catalog.json',
      'src/lib/ferramentas-uxp.js',
      'src/bundle/core/extendscript/ibd-layout.jsx',
      'src/bundle/apps/photoshop/scripts/auto-layout.jsx'
    ]) {
      assert.ok(nomes.includes(obrigatorio), 'faltando no pacote: ' + obrigatorio);
    }
    assert.ok(!nomes.some((n) => n.split('/').some((p) => p.startsWith('.'))),
      'arquivo oculto não deveria entrar no pacote');
  });

  test('O catálogo dentro do pacote é o mesmo do repositório', () => {
    const dentro = lerZip(fs.readFileSync(ccx)).find((e) => e.nome === 'src/catalog.json');
    const fora = fs.readFileSync(path.join(base, 'catalog.json'));
    assert.equal(Buffer.compare(dentro.dados, fora), 0,
      'o painel empacotado mostraria uma lista diferente da do repositório');
  });

  /* Resultado -------------------------------------------------------- */

  const falhas = results.filter((r) => !r.ok);
  for (const r of results) {
    console.log((r.ok ? '  ok   ' : '  FALHA') + '  ' + r.name);
    if (!r.ok) console.log(r.error.split('\n').map((l) => '         ' + l).join('\n'));
  }
  console.log(`\n${results.length - falhas.length}/${results.length} verificações de pacote passaram.`);
  if (falhas.length) process.exit(1);
})();
