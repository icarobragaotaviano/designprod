#!/usr/bin/env node
/**
 * Empacotador de actions do Photoshop.
 *
 * 1. Combina as actions individuais em um conjunto unificado: ibd-producao.atn
 * 2. Gera o kit compactado em downloads/kit-actions-photoshop-v1.0.zip com
 *    o conjunto completo, as actions individuais e o guia de uso.
 *
 * Uso: node tools/pack-actions.mjs
 */
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarZip } from './lib/zip.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_ACTIONS = path.join(RAIZ, 'apps', 'photoshop', 'actions');
const ARQUIVO_BUNDLE = path.join(DIR_ACTIONS, 'ibd-producao.atn');
const DIR_DOWNLOADS = path.join(RAIZ, 'downloads');
const ZIP_SAIDA = path.join(DIR_DOWNLOADS, 'kit-actions-photoshop-v1.0.zip');

export function montarAtnBundle(nomeConjunto, arquivosBuffer) {
  const payloads = [];
  for (const buf of arquivosBuffer) {
    // No formato ATN de 1 action: os primeiros 25 bytes formam o cabeçalho do arquivo
    // (versão 16, nome 'ICARO\0', expandido 1, contagem 1). O restante é o payload da action.
    payloads.push(buf.subarray(25));
  }

  const chars = [];
  for (let i = 0; i < nomeConjunto.length; i++) chars.push(nomeConjunto.charCodeAt(i));
  chars.push(0); // terminador nulo

  const nameBuf = Buffer.alloc(chars.length * 2);
  for (let i = 0; i < chars.length; i++) {
    nameBuf.writeUInt16BE(chars[i], i * 2);
  }

  const header = Buffer.alloc(4 + 4 + nameBuf.length + 1 + 4);
  let pos = 0;
  header.writeUInt32BE(16, pos); pos += 4;
  header.writeUInt32BE(chars.length, pos); pos += 4;
  nameBuf.copy(header, pos); pos += nameBuf.length;
  header.writeUInt8(1, pos); pos += 1;
  header.writeUInt32BE(payloads.length, pos); pos += 4;

  return Buffer.concat([header, ...payloads]);
}

async function main() {
  const entradas = await readdir(DIR_ACTIONS, { withFileTypes: true });
  const arquivosIndividuais = entradas
    .filter((e) => e.isFile() && e.name.endsWith('.atn') && e.name !== 'ibd-producao.atn')
    .map((e) => e.name)
    .sort();

  if (!arquivosIndividuais.length) {
    console.error('Nenhum arquivo .atn individual encontrado em ' + DIR_ACTIONS);
    process.exit(1);
  }

  const buffersIndividuais = [];
  for (const nome of arquivosIndividuais) {
    buffersIndividuais.push(await readFile(path.join(DIR_ACTIONS, nome)));
  }

  // 1. Gera o conjunto consolidado
  const bundleBuf = montarAtnBundle('IBD Produção', buffersIndividuais);
  await writeFile(ARQUIVO_BUNDLE, bundleBuf);
  console.log(`Conjunto consolidado gerado: ${path.relative(RAIZ, ARQUIVO_BUNDLE)} (${bundleBuf.length} bytes, ${arquivosIndividuais.length} actions).`);

  // 2. Prepara o ZIP de distribuição
  const arquivosZip = [
    { nome: 'ibd-producao.atn', dados: bundleBuf },
    {
      nome: 'LEIA-ME.txt',
      dados: Buffer.from(
        [
          '====================================================================',
          ' KIT DE ACTIONS DO PHOTOSHOP — IBD PRODUÇÃO v1.0',
          '====================================================================',
          '',
          'Este pacote contém as ações automatizadas para Photoshop do estúdio IBD.',
          '',
          'CONTEÚDO:',
          '- ibd-producao.atn: Pacote completo (todas as 9 actions em 1 conjunto).',
          '- actions-individuais/: Cada action separada caso prefira instalar avulsa.',
          '',
          'ACTIONS INCLUÍDAS:',
          '1. 150 DPI — Ajusta a resolução para 150 DPI mantendo proporções.',
          '2. Atualizar Vínculos — Atualiza Smart Objects vinculados modificados e salva.',
          '3. Sangria Canvas — Expande a tela com a cor de fundo para área de corte.',
          '4. Place Holder — Insere demarcador visual padrão de produto com texto "IMAGEM".',
          '5. Revincular — Fluxo rápido para revincular objeto inteligente a outro arquivo.',
          '6. Exportar JPEG Impressão — Exportação direta em JPEG de alta qualidade.',
          '7. Exportar PNG — Exportação rápida em PNG com canal alfa (transparência).',
          '8. Salvar PDF/X-1a — Fechamento em PDF normatizado para gráfica em CMYK.',
          '9. Salvar PDF Leitura — PDF leve em baixa resolução para aprovação de clientes.',
          '',
          'COMO INSTALAR NO PHOTOSHOP:',
          'Opção A (Mais rápida):',
          '  Dê duplo clique no arquivo "ibd-producao.atn". O Photoshop abrirá e carregará',
          '  automaticamente o conjunto no painel Ações (Actions).',
          '',
          'Opção B (Pelo Painel):',
          '  1. No Photoshop, abra a janela Ações (Janela > Ações ou Alt+F9 / Opt+F9).',
          '  2. Clique no menu do canto superior direito do painel e escolha "Carregar ações...".',
          '  3. Selecione o arquivo "ibd-producao.atn".',
          '',
          'Opção C (Instalação Permanente em Presets):',
          '  Copie "ibd-producao.atn" para:',
          '  - macOS: /Applications/Adobe Photoshop [versão]/Presets/Actions/',
          '  - Windows: C:\\Program Files\\Adobe\\Adobe Photoshop [versão]\\Presets\\Actions\\',
          '  Assim o conjunto aparece direto na lista do menu do painel Ações.',
          '',
          'DICA DE PRODUTIVIDADE:',
          'No menu do painel Ações, ative o "Modo de Botão" (Button Mode) para executar',
          'cada ação com um único clique colorido.',
          '',
          'Documentação completa do projeto: docs/actions-photoshop.md',
          '===================================================================='
        ].join('\r\n'),
        'utf8'
      )
    }
  ];

  for (let i = 0; i < arquivosIndividuais.length; i++) {
    arquivosZip.push({
      nome: `actions-individuais/${arquivosIndividuais[i]}`,
      dados: buffersIndividuais[i]
    });
  }

  await mkdir(DIR_DOWNLOADS, { recursive: true });
  const zipBuf = criarZip(arquivosZip);
  await writeFile(ZIP_SAIDA, zipBuf);
  console.log(`Kit ZIP gerado: ${path.relative(RAIZ, ZIP_SAIDA)} (${zipBuf.length} bytes, ${arquivosZip.length} entradas).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
