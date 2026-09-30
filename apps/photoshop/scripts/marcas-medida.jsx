/**
 * @ibd-id photoshop/marcas-medida
 * @ibd-titulo Marcas de medida
 * @ibd-descricao Transforma a seleção retangular em cota com rótulo editável — largura, altura ou as duas, em px, mm, cm ou pt. Roda sem diálogo, feito para atalho.
 * @ibd-app photoshop
 * @ibd-versao 1.0.0
 * @ibd-tags medida, cota, especificacao, handoff, selecao
 * @ibd-doc docs/marcas-medida.md
 *
 * Versão rápida: usa as opções gravadas por "Marcas de medida — opções"
 * (ou os padrões) e não pergunta nada. Guia: docs/marcas-medida.md.
 * Testes: npm run test:medida. A execução dentro do Photoshop ainda
 * precisa ser validada.
 *
 * Crédito e licença
 * -----------------
 * Obra derivada do Size Marks 1.3, de Roman Shamin
 * (https://github.com/romashamin/Size-Marks-PS, commit 2cba97d), que é
 * distribuído sob a licença MIT. O código foi reescrito; a ideia, o fluxo
 * e a regra paisagem → largura, retrato → altura vêm do original.
 * Alterações: Copyright (c) 2026 Ícaro Braga, também sob a licença MIT
 * (LICENSE na raiz do repositório). Este projeto não é afiliado ao autor
 * original nem endossado por ele.
 *
 * O aviso abaixo é do original e precisa acompanhar toda cópia:
 *
 * The MIT License (MIT)
 *
 * Copyright 2014 Roman Shamin https://github.com/romashamin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

#target photoshop

#include "../../../core/extendscript/ibd-prefs.jsx"
#include "../../../core/extendscript/ibd-ps-medida.jsx"

(function () {
  IBD.exigirHost(['photoshop']);

  var opcoes;
  try {
    opcoes = IBD.medida.normalizar(IBD.prefs.ler(IBD.marcas.ID_PREFS));
  } catch (e) {
    IBD.alerta(
      'As opções gravadas das marcas de medida estão inválidas:\n' + e.message +
      '\n\nAbra "Marcas de medida — opções" para corrigir.'
    );
    return;
  }

  IBD.marcas.executar(opcoes);
})();
