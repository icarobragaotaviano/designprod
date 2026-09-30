/**
 * @ibd-id photoshop/marcas-medida-opcoes
 * @ibd-titulo Marcas de medida — opções
 * @ibd-descricao Escolhe o que medir, unidade, casas decimais, posição da linha, fonte e tamanho do rótulo; grava para o atalho e marca a seleção atual.
 * @ibd-app photoshop
 * @ibd-versao 1.0.0
 * @ibd-tags medida, cota, especificacao, handoff, opcoes
 * @ibd-doc docs/marcas-medida.md
 *
 * Configura a versão rápida ("Marcas de medida"), que roda sem diálogo.
 * Guia: docs/marcas-medida.md. Testes: npm run test:medida.
 * A execução dentro do Photoshop ainda precisa ser validada.
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

#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-prefs.jsx"
#include "../../../core/extendscript/ibd-ps-medida.jsx"

(function () {
  var DIMENSOES = {
    'Automática — pela proporção': 'auto',
    'Largura': 'largura',
    'Altura': 'altura',
    'Largura e altura': 'ambas'
  };
  var DECIMAIS = {
    'Automáticas — px 0, mm 1, cm 2, pt 1': 'auto',
    '0': 0,
    '1': 1,
    '2': 2,
    '3': 3
  };
  var SEPARADORES = { 'Vírgula — 12,5': ',', 'Ponto — 12.5': '.' };
  var POSICOES = {
    'Na borda — topo ou esquerda': 'inicio',
    'No centro da seleção': 'centro',
    'Na borda oposta — base ou direita': 'fim'
  };

  function listar(mapa) {
    var saida = [];
    for (var k in mapa) {
      if (Object.prototype.hasOwnProperty.call(mapa, k)) saida.push(k);
    }
    return saida;
  }

  function rotuloDe(mapa, valor) {
    for (var k in mapa) {
      if (Object.prototype.hasOwnProperty.call(mapa, k) && mapa[k] === valor) return k;
    }
    return listar(mapa)[0];
  }

  function campos(o) {
    return [
      {
        id: 'dimensao', rotulo: 'Medir', tipo: 'escolha', opcoes: listar(DIMENSOES),
        padrao: rotuloDe(DIMENSOES, o.dimensao),
        ajuda: 'Automática: seleção mais larga que alta mede a largura; senão, a altura.'
      },
      {
        id: 'unidade', rotulo: 'Unidade', tipo: 'escolha', opcoes: IBD.medida.UNIDADES, padrao: o.unidade,
        ajuda: 'mm, cm e pt usam a resolução do documento (Imagem › Tamanho da imagem).'
      },
      { id: 'mostrarPx', rotulo: 'Mostrar também em px — 25,4 mm / 300 px', tipo: 'booleano', padrao: o.mostrarPx },
      {
        id: 'decimais', rotulo: 'Casas decimais', tipo: 'escolha', opcoes: listar(DECIMAIS),
        padrao: rotuloDe(DECIMAIS, o.decimais)
      },
      {
        id: 'separador', rotulo: 'Separador decimal', tipo: 'escolha', opcoes: listar(SEPARADORES),
        padrao: rotuloDe(SEPARADORES, o.separador)
      },
      {
        id: 'posicao', rotulo: 'Linha', tipo: 'escolha', opcoes: listar(POSICOES),
        padrao: rotuloDe(POSICOES, o.posicao),
        ajuda: 'O rótulo fica do lado de fora; se não couber na tela, passa para o outro lado.'
      },
      { id: 'tamanhoTexto', rotulo: 'Tamanho do texto (pt)', tipo: 'numero', padrao: o.tamanhoTexto },
      {
        id: 'fonte', rotulo: 'Fonte', tipo: 'texto', padrao: o.fonte,
        ajuda: 'Nome PostScript (ArialMT) ou como aparece no menu (Arial Bold).'
      }
    ];
  }

  /**
   * Aceita o nome PostScript ou o nome do menu e devolve o PostScript, que e
   * o que o Photoshop pede. A busca na lista de fontes e lenta com muitas
   * fontes instaladas, por isso acontece aqui, uma vez, e nao no atalho.
   */
  function resolverFonte(texto) {
    var nome = String(texto || '').trim();
    if (!nome) return IBD.medida.PADRAO.fonte;
    try {
      app.fonts.getByName(nome);
      return nome;
    } catch (e) { /* nao e nome PostScript: procura pelo nome do menu */ }

    var alvo = nome.toLowerCase();
    var daFamilia = null;
    for (var i = 0; i < app.fonts.length; i++) {
      var f = app.fonts[i];
      if (String(f.postScriptName).toLowerCase() === alvo ||
          String(f.name).toLowerCase() === alvo ||
          (f.family + ' ' + f.style).toLowerCase() === alvo) {
        return f.postScriptName;
      }
      if (String(f.family).toLowerCase() === alvo &&
          (!daFamilia || /^(regular|roman|book|normal)$/i.test(f.style))) {
        daFamilia = f;
      }
    }
    if (daFamilia) return daFamilia.postScriptName;
    throw new Error(
      'A fonte "' + nome + '" não foi encontrada.\n' +
      'Use o nome PostScript (ArialMT, Roboto-Regular) ou o nome do menu (Arial Bold).'
    );
  }

  IBD.exigirHost(['photoshop']);

  var padrao;
  try {
    padrao = IBD.medida.normalizar(IBD.prefs.ler(IBD.marcas.ID_PREFS));
  } catch (e) {
    // Opções gravadas ilegíveis: o diálogo recomeça dos padrões e corrige.
    padrao = IBD.medida.normalizar({});
  }

  var temSelecao = app.documents.length > 0 && !!IBD.ps.emPixels(function () {
    return IBD.marcas.caixaSelecao(app.activeDocument);
  });

  var opcoes = null;
  while (!opcoes) {
    var resposta = IBD.ui.formulario(
      'Marcas de medida — opções',
      campos(padrao),
      temSelecao ? 'Salvar e marcar' : 'Salvar'
    );
    if (!resposta) return;

    var entrada = {
      dimensao: DIMENSOES[resposta.dimensao],
      unidade: resposta.unidade,
      mostrarPx: resposta.mostrarPx,
      decimais: DECIMAIS[resposta.decimais],
      separador: SEPARADORES[resposta.separador],
      posicao: POSICOES[resposta.posicao],
      tamanhoTexto: resposta.tamanhoTexto,
      fonte: resposta.fonte
    };

    try {
      entrada.fonte = resolverFonte(entrada.fonte);
      opcoes = IBD.medida.normalizar(entrada);
    } catch (e2) {
      // Reabre com o que foi digitado, para corrigir só o campo errado.
      IBD.alerta(e2.message);
      padrao = entrada;
    }
  }

  IBD.prefs.gravar(IBD.marcas.ID_PREFS, opcoes);

  if (temSelecao) {
    IBD.marcas.executar(opcoes);
  } else {
    IBD.alerta(
      'Opções salvas.\n\nSelecione o que quer medir com a ferramenta Letreiro retangular (M) ' +
      'e rode "Marcas de medida" — de preferência por um atalho de teclado.'
    );
  }
})();
