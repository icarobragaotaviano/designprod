/**
 * Escritor de ZIP minimo, sem dependencia externa.
 *
 * O repositorio nao tem pacote instalado — so Node — e um .ccx de plugin UXP
 * nada mais e que um ZIP com o manifest.json na raiz. Em vez de trazer uma
 * dependencia inteira para escrever um arquivo por build, o formato esta
 * implementado aqui: cabecalho local, diretorio central e EOCD.
 *
 * Limites assumidos de proposito: sem zip64 (arquivos e pacote abaixo de 4 GB),
 * sem senha, sem entradas de pasta. Da conta do plugin e falha alto se um dia
 * nao der.
 *
 * As datas sao fixas: o mesmo conteudo gera sempre os mesmos bytes, entao um
 * rebuild so muda o pacote quando o plugin mudou de verdade.
 */
import { deflateRawSync } from 'node:zlib';

const ASSINATURA_LOCAL = 0x04034b50;
const ASSINATURA_CENTRAL = 0x02014b50;
const ASSINATURA_FIM = 0x06054b50;

const VERSAO = 20;      // 2.0: o necessario para deflate
const BANDEIRA_UTF8 = 0x0800;

const METODO_ARMAZENADO = 0;
const METODO_DEFLATE = 8;

const LIMITE = 0xFFFFFFFF;

/** Data fixa (2020-01-01 00:00) para o pacote ser reproduzivel. */
const HORA_DOS = 0;
const DATA_DOS = ((2020 - 1980) << 9) | (1 << 5) | 1;

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

/** CRC-32 (IEEE), o que o formato ZIP exige em cada entrada. */
export function crc32(dados) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < dados.length; i++) {
    c = TABELA_CRC[(c ^ dados[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function validarNome(nome) {
  const limpo = String(nome).split('\\').join('/');
  if (!limpo || limpo.startsWith('/') || limpo.includes('..')) {
    throw new Error(`Nome invalido para o ZIP: "${nome}".`);
  }
  return limpo;
}

/**
 * Monta um ZIP em memoria.
 * @param {Array<{nome: string, dados: Buffer}>} entradas
 * @returns {Buffer}
 */
export function criarZip(entradas) {
  if (!entradas || !entradas.length) throw new Error('ZIP sem nenhuma entrada.');

  const pedacos = [];
  const central = [];
  let deslocamento = 0;

  // Ordem estavel: o mesmo conjunto de arquivos gera sempre o mesmo pacote.
  const ordenadas = [...entradas].sort((a, b) => a.nome.localeCompare(b.nome, 'en'));

  for (const entrada of ordenadas) {
    const nome = Buffer.from(validarNome(entrada.nome), 'utf8');
    const cru = Buffer.isBuffer(entrada.dados) ? entrada.dados : Buffer.from(entrada.dados);

    const comprimido = deflateRawSync(cru, { level: 9 });
    // Comprimir so vale quando encolhe: arquivo ja compactado cresceria.
    const usaDeflate = comprimido.length < cru.length;
    const corpo = usaDeflate ? comprimido : cru;
    const metodo = usaDeflate ? METODO_DEFLATE : METODO_ARMAZENADO;
    const soma = crc32(cru);

    if (cru.length > LIMITE || corpo.length > LIMITE || deslocamento > LIMITE) {
      throw new Error(`"${entrada.nome}" passa do limite de 4 GB: este escritor nao faz zip64.`);
    }

    const local = Buffer.alloc(30);
    local.writeUInt32LE(ASSINATURA_LOCAL, 0);
    local.writeUInt16LE(VERSAO, 4);
    local.writeUInt16LE(BANDEIRA_UTF8, 6);
    local.writeUInt16LE(metodo, 8);
    local.writeUInt16LE(HORA_DOS, 10);
    local.writeUInt16LE(DATA_DOS, 12);
    local.writeUInt32LE(soma, 14);
    local.writeUInt32LE(corpo.length, 18);
    local.writeUInt32LE(cru.length, 22);
    local.writeUInt16LE(nome.length, 26);
    local.writeUInt16LE(0, 28);

    pedacos.push(local, nome, corpo);

    const cabecalho = Buffer.alloc(46);
    cabecalho.writeUInt32LE(ASSINATURA_CENTRAL, 0);
    cabecalho.writeUInt16LE(VERSAO, 4);
    cabecalho.writeUInt16LE(VERSAO, 6);
    cabecalho.writeUInt16LE(BANDEIRA_UTF8, 8);
    cabecalho.writeUInt16LE(metodo, 10);
    cabecalho.writeUInt16LE(HORA_DOS, 12);
    cabecalho.writeUInt16LE(DATA_DOS, 14);
    cabecalho.writeUInt32LE(soma, 16);
    cabecalho.writeUInt32LE(corpo.length, 20);
    cabecalho.writeUInt32LE(cru.length, 24);
    cabecalho.writeUInt16LE(nome.length, 28);
    cabecalho.writeUInt16LE(0, 30);   // extra
    cabecalho.writeUInt16LE(0, 32);   // comentario
    cabecalho.writeUInt16LE(0, 34);   // disco
    cabecalho.writeUInt16LE(0, 36);   // atributos internos
    cabecalho.writeUInt32LE(0, 38);   // atributos externos
    cabecalho.writeUInt32LE(deslocamento, 42);

    central.push(cabecalho, nome);
    deslocamento += local.length + nome.length + corpo.length;
  }

  const diretorio = Buffer.concat(central);

  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(ASSINATURA_FIM, 0);
  fim.writeUInt16LE(0, 4);
  fim.writeUInt16LE(0, 6);
  fim.writeUInt16LE(ordenadas.length, 8);
  fim.writeUInt16LE(ordenadas.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  fim.writeUInt16LE(0, 20);

  return Buffer.concat([...pedacos, diretorio, fim]);
}
