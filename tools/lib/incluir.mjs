/**
 * Resolve os #include de um script ExtendScript, gerando um arquivo unico.
 *
 * Dentro do repositorio, um script chama a biblioteca comum por
 * #include "../../../core/extendscript/ibd-ui.jsx". Isso e otimo para
 * manter — e inutil para quem baixa so o .jsx pela vitrine: o caminho
 * relativo nao existe na maquina dele.
 *
 * Aqui o conteudo dos includes entra no lugar da diretiva, na mesma ordem
 * que o ExtendScript usaria, e o resultado roda sozinho em
 * Arquivo > Scripts > Procurar.
 *
 * Diferenca proposital: cada arquivo entra UMA vez. O ExtendScript inclui
 * quantas vezes a diretiva aparecer, e ibd-core.jsx acaba entrando tres
 * vezes num script que use ui, prefs e camadas. Os arquivos do core sao
 * idempotentes (reaproveitam host.IBD se ja existir), entao incluir uma vez
 * so da exatamente o mesmo resultado, com um terco do tamanho.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const RE_INCLUDE = /^[ \t]*#include[ \t]+"([^"]+)"[ \t]*$/gm;

/**
 * @param {string} raiz raiz do repositorio
 * @param {string} relativo caminho do script, relativo a raiz
 * @returns {Promise<{conteudo: string, embutidos: string[]}>}
 */
export async function resolverIncludes(raiz, relativo) {
  const vistos = new Set();
  const embutidos = [];

  async function ler(absoluto, pilha) {
    if (pilha.includes(absoluto)) {
      throw new Error(`#include circular: ${pilha.map((p) => path.relative(raiz, p)).join(' -> ')} -> ${path.relative(raiz, absoluto)}`);
    }

    let texto;
    try {
      texto = await readFile(absoluto, 'utf8');
    } catch {
      throw new Error(`#include aponta para arquivo inexistente: ${path.relative(raiz, absoluto)}`);
    }

    const diretivas = [...texto.matchAll(RE_INCLUDE)];
    if (!diretivas.length) return texto;

    let saida = '';
    let cursor = 0;

    for (const diretiva of diretivas) {
      saida += texto.slice(cursor, diretiva.index);
      cursor = diretiva.index + diretiva[0].length;

      const alvo = path.resolve(path.dirname(absoluto), diretiva[1]);
      const nome = path.relative(raiz, alvo).split(path.sep).join('/');

      if (vistos.has(alvo)) {
        saida += `// (${nome} ja foi embutido acima)`;
        continue;
      }
      vistos.add(alvo);
      embutidos.push(nome);

      const dentro = await ler(alvo, [...pilha, absoluto]);
      saida += [
        `/* ----- inicio de ${nome} ----- */`,
        dentro.replace(/\s*$/, ''),
        `/* ----- fim de ${nome} ----- */`
      ].join('\n');
    }

    saida += texto.slice(cursor);
    return saida;
  }

  const absoluto = path.resolve(raiz, relativo);
  const conteudo = await ler(absoluto, []);

  if (RE_INCLUDE.test(conteudo)) {
    RE_INCLUDE.lastIndex = 0;
    throw new Error(`${relativo}: sobrou #include sem resolver no arquivo gerado.`);
  }
  RE_INCLUDE.lastIndex = 0;

  return { conteudo, embutidos };
}

/**
 * Cabecalho do arquivo gerado. Sem data, de proposito: assim o mesmo
 * conteudo produz sempre o mesmo arquivo.
 */
export function cabecalho(ferramenta, marca, embutidos) {
  const linhas = [
    '/*',
    ` * ${marca.nome} — ${ferramenta.titulo}`,
    ` * ${ferramenta.id} v${ferramenta.versao}`,
    ' *',
    ' * Arquivo pronto para uso: a biblioteca comum do estudio esta embutida,',
    ' * entao ele roda sozinho por Arquivo > Scripts > Procurar.',
    ' *'
  ];

  if (embutidos.length) {
    linhas.push(' * Embutidos:');
    for (const nome of embutidos) linhas.push(` *   ${nome}`);
    linhas.push(' *');
  }

  linhas.push(
    ` * Gerado de ${ferramenta.arquivo}. Nao edite aqui:`,
    ' * a origem e o repositorio, e a proxima geracao sobrescreve este arquivo.',
    ' */',
    ''
  );
  return linhas.join('\n');
}
