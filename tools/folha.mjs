#!/usr/bin/env node
import '../core/producao/folha/engine.js';
import '../core/producao/folha/operacoes.js';

try {
  let entrada = '';
  process.stdin.setEncoding('utf8');
  for await (const trecho of process.stdin) entrada += trecho;
  const plano = globalThis.FolhaOperacoes.executar(JSON.parse(entrada.replace(/^\uFEFF/, '')));
  process.stdout.write(JSON.stringify(plano, null, 2) + '\n');
  if (plano.diagnosticos.some(item => item.gravidade === 'erro')) process.exitCode = 1;
} catch (erro) {
  process.stderr.write(`Folha: ${erro.message}\n`);
  process.exitCode = 1;
}
