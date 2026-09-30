/**
 * ibd-ps-medida.jsx — desenha no Photoshop as marcas de medida.
 *
 * As contas vem prontas de ibd-medida.jsx; aqui mora so o que depende do
 * DOM do Photoshop: ler a selecao, criar o grupo, preencher a linha, criar
 * o texto, medir o texto e coloca-lo no lugar. Os dois scripts da familia
 * (marcas-medida e marcas-medida-opcoes) chamam IBD.marcas.executar.
 *
 * Diferencas de proposito em relacao ao Size Marks original:
 *  - a linha e preenchimento de selecao, nao traco de Lapis: sai no pixel
 *    exato e nao altera o pincel nem a ferramenta ativa do usuario;
 *  - o texto continua editavel, dentro de um grupo com o nome da medida;
 *  - regua e unidade de texto voltam ao que eram mesmo quando algo falha.
 *
 * Derivado do Size Marks 1.3, de Roman Shamin (commit 2cba97d de
 * https://github.com/romashamin/Size-Marks-PS), sob a licenca MIT. Codigo
 * reescrito; alteracoes Copyright (c) 2026 Icaro Braga, tambem MIT. Registro
 * em THIRD_PARTY_NOTICES.md. O aviso do original acompanha toda copia:
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
 *
 * Uso dentro de um script:
 *   #include "../../../core/extendscript/ibd-ps-medida.jsx"
 */

#include "ibd-medida.jsx"
#include "ibd-ps-camadas.jsx"

(function (IBD) {
  var marcas = {};

  /** Chave unica das preferencias: os dois scripts leem e gravam a mesma. */
  marcas.ID_PREFS = 'photoshop/marcas-medida';
  marcas.ROTULO_HISTORICO = 'IBD — Marca de medida';
  marcas.FONTE_RESERVA = 'ArialMT';

  /** Motivo pelo qual o documento nao aceita a marca, ou null. */
  marcas.impedimento = function (doc) {
    try {
      if (doc.quickMaskMode) {
        return 'O documento está em Máscara rápida.\nSaia dela (tecla Q) e refaça a seleção.';
      }
    } catch (e) { /* versao sem a propriedade */ }

    var semCamadas = {};
    try {
      semCamadas[String(DocumentMode.BITMAP)] = 'Bitmap';
      semCamadas[String(DocumentMode.INDEXEDCOLOR)] = 'Cores indexadas';
      semCamadas[String(DocumentMode.MULTICHANNEL)] = 'Multicanal';
    } catch (e2) { /* sem as constantes, nao da para conferir */ }

    var modo = semCamadas[String(doc.mode)];
    if (modo) {
      return 'O modo ' + modo + ' não aceita camadas.\n' +
        'Converta o documento para RGB, CMYK ou Tons de cinza em Imagem › Modo.';
    }
    return null;
  };

  /**
   * Retangulo da selecao em pixels, ou null quando nao ha selecao.
   * Chame dentro de IBD.ps.emPixels.
   */
  marcas.caixaSelecao = function (doc) {
    var b;
    try {
      b = doc.selection.bounds;
    } catch (e) {
      return null;
    }
    if (!b || b.length !== 4) return null;
    var x1 = b[0].as('px');
    var y1 = b[1].as('px');
    var x2 = b[2].as('px');
    var y2 = b[3].as('px');
    if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) return null;
    if (x2 - x1 <= 0 || y2 - y1 <= 0) return null;
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  };

  /** A fonte pedida se estiver instalada; senao ArialMT; senao null (padrao do app). */
  marcas.escolherFonte = function (nome, avisos) {
    var candidatas = nome === marcas.FONTE_RESERVA ? [nome] : [nome, marcas.FONTE_RESERVA];
    for (var i = 0; i < candidatas.length; i++) {
      try {
        app.fonts.getByName(candidatas[i]);
        if (i > 0) {
          avisos.push('A fonte "' + nome + '" não está instalada; o rótulo saiu em ' +
            candidatas[i] + '.\nTroque a fonte em "Marcas de medida — opções".');
        }
        return candidatas[i];
      } catch (e) { /* tenta a proxima */ }
    }
    avisos.push('Nenhuma fonte pedida foi encontrada; o rótulo saiu na fonte padrão do Photoshop.');
    return null;
  };

  /**
   * Area em que o rotulo precisa caber: a prancheta que contem a camada, ou
   * a tela inteira. Pranchetas so existem no primeiro nivel do painel, entao
   * basta olhar o grupo mais externo. A leitura e pelo Action Manager; se
   * falhar (versao sem pranchetas, por exemplo), vale a tela.
   */
  marcas.areaVisivel = function (doc, camada) {
    var tela = { x: 0, y: 0, w: doc.width.as('px'), h: doc.height.as('px') };
    var externo = null;
    try {
      var atual = camada;
      while (atual && atual.typename === 'LayerSet') {
        externo = atual;
        atual = atual.parent;
      }
      if (!externo) return tela;

      var ref = new ActionReference();
      ref.putIdentifier(stringIDToTypeID('layer'), externo.id);
      var desc = executeActionGet(ref);
      var ligada = stringIDToTypeID('artboardEnabled');
      if (!desc.hasKey(ligada) || !desc.getBoolean(ligada)) return tela;

      var r = desc.getObjectValue(stringIDToTypeID('artboard'))
        .getObjectValue(stringIDToTypeID('artboardRect'));
      var esq = r.getDouble(stringIDToTypeID('left'));
      var topo = r.getDouble(stringIDToTypeID('top'));
      var dir = r.getDouble(stringIDToTypeID('right'));
      var base = r.getDouble(stringIDToTypeID('bottom'));
      if (!(dir > esq && base > topo)) return tela;
      return { x: esq, y: topo, w: dir - esq, h: base - topo };
    } catch (e) {
      return tela;
    }
  };

  function selecionar(doc, retangulos) {
    for (var i = 0; i < retangulos.length; i++) {
      var r = retangulos[i];
      doc.selection.select(
        [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]],
        i === 0 ? SelectionType.REPLACE : SelectionType.EXTEND,
        0,
        false
      );
    }
  }

  /**
   * Desenha o plano no documento. Chame dentro de IBD.ps.emPixels, com a
   * unidade de texto em pontos (IBD.marcas.executar ja faz as duas coisas).
   * @returns {{grupo, nome, avisos: string[]}}
   */
  marcas.desenhar = function (doc, plano) {
    var o = plano.opcoes;
    var avisos = [];
    var cor = app.foregroundColor;
    var ativa = null;
    try {
      ativa = doc.activeLayer;
    } catch (e) {
      ativa = null;
    }

    // 1. Grupo logo acima da camada ativa. Com um grupo ativo, entra no topo
    //    dele — o mesmo que o Photoshop faz com Nova camada.
    var grupo = doc.layerSets.add();
    grupo.name = plano.nome;
    if (ativa) {
      try {
        grupo.move(ativa, ativa.typename === 'LayerSet'
          ? ElementPlacement.PLACEATBEGINNING
          : ElementPlacement.PLACEBEFORE);
      } catch (e2) {
        avisos.push('A marca ficou fora do lugar no painel Camadas: não foi possível colocá-la junto de "' +
          ativa.name + '" (' + (e2.message || e2) + ').');
      }
    }

    // 2. Linha e hastes: um preenchimento so, pixel exato.
    var linhas = grupo.artLayers.add();
    linhas.name = 'Linhas';
    doc.activeLayer = linhas;
    selecionar(doc, plano.retangulos);
    doc.selection.fill(cor, ColorBlendMode.NORMAL, 100, false);
    doc.selection.deselect();

    // 3. Rotulos editaveis, medidos depois de criados e entao encaixados.
    var fonte = marcas.escolherFonte(o.fonte, avisos);
    var tela = marcas.areaVisivel(doc, grupo);

    for (var i = 0; i < plano.rotulos.length; i++) {
      var r = plano.rotulos[i];
      var camada = grupo.artLayers.add();
      camada.kind = LayerKind.TEXT;

      var item = camada.textItem;
      item.contents = r.texto;
      // Depois do conteudo: camada de texto sem nome proprio leva o texto como nome.
      camada.name = r.eixo === 'largura' ? 'Largura' : 'Altura';
      item.size = o.tamanhoTexto;
      if (fonte) item.font = fonte;
      item.color = cor;
      item.justification = Justification.LEFT;
      item.position = r.alvo.orientacao === 'h'
        ? [new UnitValue(r.alvo.centro, 'px'), new UnitValue(r.alvo.antes, 'px')]
        : [new UnitValue(r.alvo.depois, 'px'), new UnitValue(r.alvo.centro, 'px')];

      var caixa = IBD.ps.limites(camada, true);
      if (!caixa) {
        throw new Error('O Photoshop não conseguiu medir o rótulo "' + r.texto + '".');
      }
      var p = IBD.medida.encaixar(r.alvo, { w: caixa.w, h: caixa.h }, tela);
      if (p.x !== caixa.x || p.y !== caixa.y) {
        camada.translate(new UnitValue(p.x - caixa.x, 'px'), new UnitValue(p.y - caixa.y, 'px'));
      }
      // Com pranchetas, o Photoshop pode re-aninhar a camada movida em outra
      // prancheta (o problema das versoes 1.1 e 1.3 do Size Marks). Devolver
      // o texto ao grupo, explicitamente, mantem a marca inteira num lugar so
      // e o rotulo acima da linha. E so protecao: se falhar, a marca fica.
      try {
        camada.move(grupo, ElementPlacement.PLACEATBEGINNING);
      } catch (e3) {
        avisos.push('O rótulo "' + r.texto + '" pode ter ficado fora do grupo "' + plano.nome +
          '". Confira no painel Camadas.');
      }
    }

    doc.activeLayer = grupo;
    return { grupo: grupo, nome: plano.nome, avisos: avisos };
  };

  /**
   * Fluxo completo: confere documento e selecao, calcula, desenha num unico
   * passo de historico e restaura as preferencias do app.
   * Silencioso quando da certo — o atalho nao pode parar em alerta.
   * @returns {{grupo, nome, avisos}|null} null quando nada foi desenhado
   */
  marcas.executar = function (opcoes) {
    if (!app.documents.length) {
      IBD.alerta('Abra um documento e selecione o que quer medir com a ferramenta Letreiro retangular (M).');
      return null;
    }

    var doc = app.activeDocument;
    var bloqueio = marcas.impedimento(doc);
    if (bloqueio) {
      IBD.alerta(bloqueio);
      return null;
    }

    var caixa = IBD.ps.emPixels(function () { return marcas.caixaSelecao(doc); });
    if (!caixa) {
      IBD.alerta('Não há seleção.\nSelecione o que quer medir com a ferramenta Letreiro retangular (M).');
      return null;
    }

    var r = IBD.executar('Marcas de medida', function () {
      var plano = IBD.medida.planejar(caixa, doc.resolution, opcoes);
      var resultado = null;
      var tipoAntes = app.preferences.typeUnits;
      try {
        app.preferences.typeUnits = TypeUnits.POINTS;
        IBD.ps.emPixels(function () {
          IBD.ps.historico(doc, marcas.ROTULO_HISTORICO, function () {
            resultado = marcas.desenhar(doc, plano);
          });
        });
      } finally {
        app.preferences.typeUnits = tipoAntes;
      }
      return resultado;
    });

    if (!r.ok || !r.valor) return null;
    if (r.valor.avisos.length) IBD.alerta(r.valor.avisos.join('\n\n'));
    return r.valor;
  };

  IBD.marcas = marcas;
})($.global.IBD);
