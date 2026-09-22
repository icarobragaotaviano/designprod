/**
 * ibd-ps-camadas.jsx — adaptador entre o Photoshop e o motor de layout.
 *
 * Tudo que depende do DOM do Photoshop mora aqui: medir camada, mover,
 * redimensionar, descobrir o que esta selecionado, achar os quadros de auto
 * layout e embrulhar a operacao em um unico passo de historico.
 *
 * O motor (ibd-layout.jsx) nao conhece este arquivo. Este arquivo conhece os
 * dois lados — e o unico ponto que precisa mudar se a API do Photoshop mudar.
 *
 * Uso dentro de um script:
 *   #include "../../../core/extendscript/ibd-ps-camadas.jsx"
 */

#include "ibd-layout.jsx"

(function (IBD) {
  var ps = {};

  /* ---------------------------------------------------------------- *
   * Unidades
   * ---------------------------------------------------------------- */

  /**
   * Executa com a regua em pixels e devolve a preferencia anterior.
   * Toda medida do motor esta em pixels do documento.
   */
  ps.emPixels = function (fn) {
    var antes = app.preferences.rulerUnits;
    try {
      app.preferences.rulerUnits = Units.PIXELS;
      return fn();
    } finally {
      app.preferences.rulerUnits = antes;
    }
  };

  /** Converte mm, cm, pt ou px em pixels do documento. */
  ps.emPx = function (valor, unidade, resolucao) {
    var v = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(',', '.'));
    if (isNaN(v) || !isFinite(v)) throw new Error('Medida inválida: "' + valor + '".');
    if (!isFinite(resolucao) || resolucao <= 0) throw new Error('Resolução do documento inválida.');
    var fator = unidade === 'mm' ? resolucao / 25.4
      : unidade === 'cm' ? resolucao / 2.54
      : unidade === 'pt' ? resolucao / 72
      : 1;
    return v * fator;
  };

  /** Converte pixels do documento na unidade pedida. */
  ps.dePx = function (px, unidade, resolucao) {
    var fator = unidade === 'mm' ? resolucao / 25.4
      : unidade === 'cm' ? resolucao / 2.54
      : unidade === 'pt' ? resolucao / 72
      : 1;
    return px / fator;
  };

  /* ---------------------------------------------------------------- *
   * Medida
   * ---------------------------------------------------------------- */

  /**
   * Retangulo da camada em pixels.
   * @param {Layer} camada
   * @param {boolean} comEfeitos incluir sombra, brilho e traco no calculo
   * @returns {{x, y, w, h}|null} null quando a camada esta vazia
   */
  ps.limites = function (camada, comEfeitos) {
    var b = null;
    if (!comEfeitos) {
      // boundsNoEffects nao existe em todo tipo de camada nem em versao antiga.
      try {
        b = camada.boundsNoEffects;
      } catch (e) {
        b = null;
      }
    }
    if (!b) b = camada.bounds;
    if (!b || b.length !== 4) return null;

    var x1 = b[0].as('px'), y1 = b[1].as('px');
    var x2 = b[2].as('px'), y2 = b[3].as('px');
    if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) return null;
    if (x2 - x1 <= 0 || y2 - y1 <= 0) return null;
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  };

  /** Motivo pelo qual a camada nao pode ser movida, ou null se pode. */
  ps.impedimento = function (camada) {
    try {
      if (camada.isBackgroundLayer) return 'é a camada Plano de Fundo';
    } catch (e) { /* tipo sem a propriedade */ }
    try {
      if (camada.allLocked) return 'está totalmente bloqueada';
    } catch (e2) { /* idem */ }
    try {
      if (camada.positionLocked) return 'está com a posição bloqueada';
    } catch (e3) { /* idem */ }
    return null;
  };

  /* ---------------------------------------------------------------- *
   * Selecao e coleta
   * ---------------------------------------------------------------- */

  /** Percorre camadas e grupos recursivamente. */
  ps.percorrer = function (camadas, visitar) {
    for (var i = 0; i < camadas.length; i++) {
      visitar(camadas[i]);
      if (camadas[i].typename === 'LayerSet') ps.percorrer(camadas[i].layers, visitar);
    }
  };

  function camadaPorId(doc, id) {
    var achada = null;
    ps.percorrer(doc.layers, function (c) {
      if (!achada && c.id === id) achada = c;
    });
    return achada;
  }

  /**
   * Camadas selecionadas no painel, na ordem do documento.
   *
   * O DOM legado so expoe activeLayer; a selecao multipla vem do Action
   * Manager. Quando a leitura falhar, devolve a camada ativa sozinha — nunca
   * uma lista vazia com documento aberto.
   *
   * @returns {Layer[]}
   */
  ps.selecionadas = function (doc) {
    var saida = [];
    try {
      var refDoc = new ActionReference();
      refDoc.putEnumerated(
        stringIDToTypeID('document'),
        stringIDToTypeID('ordinal'),
        stringIDToTypeID('targetEnum')
      );
      var descDoc = executeActionGet(refDoc);
      var chave = stringIDToTypeID('targetLayers');

      if (descDoc.hasKey(chave)) {
        var lista = descDoc.getList(chave);
        // Sem Plano de Fundo, os indices do Action Manager comecam em 1.
        var deslocamento = 1;
        try {
          if (doc.layers[doc.layers.length - 1].isBackgroundLayer) deslocamento = 0;
        } catch (e) { /* mantem 1 */ }

        for (var i = 0; i < lista.count; i++) {
          var indice = lista.getReference(i).getIndex() + deslocamento;
          var refId = new ActionReference();
          refId.putProperty(stringIDToTypeID('property'), stringIDToTypeID('layerID'));
          refId.putIndex(stringIDToTypeID('layer'), indice);
          var id = executeActionGet(refId).getInteger(stringIDToTypeID('layerID'));
          var camada = camadaPorId(doc, id);
          if (camada) saida.push(camada);
        }
      }
    } catch (e2) {
      saida = [];
    }

    if (!saida.length) {
      try {
        if (doc.activeLayer) saida.push(doc.activeLayer);
      } catch (e3) { /* documento sem camada ativa */ }
    }
    return saida;
  };

  /**
   * Itens prontos para o motor, a partir de uma lista de camadas.
   * Devolve tambem o que foi descartado e por que.
   *
   * @param {Layer[]} camadas
   * @param {object} [opcoes] {comEfeitos, incluirOcultas}
   * @returns {{itens: Array, descartadas: Array}}
   */
  ps.medir = function (camadas, opcoes) {
    var o = opcoes || {};
    var itens = [];
    var descartadas = [];

    for (var i = 0; i < camadas.length; i++) {
      var camada = camadas[i];
      var nome = String(camada.name);

      if (!o.incluirOcultas && !camada.visible) {
        descartadas.push({ nome: nome, motivo: 'está oculta' });
        continue;
      }

      var caixa = ps.limites(camada, !!o.comEfeitos);
      if (!caixa) {
        descartadas.push({ nome: nome, motivo: 'não tem pixels para medir' });
        continue;
      }

      var trava = ps.impedimento(camada);
      if (trava) {
        descartadas.push({ nome: nome, motivo: trava });
        continue;
      }

      itens.push({ id: nome, ref: camada, x: caixa.x, y: caixa.y, w: caixa.w, h: caixa.h });
    }

    return { itens: itens, descartadas: descartadas };
  };

  /** Grupos do documento que carregam a etiqueta @auto, do mais interno ao mais externo. */
  ps.quadros = function (doc) {
    var achados = [];
    ps.percorrer(doc.layers, function (c) {
      if (c.typename === 'LayerSet' && IBD.layout.temTag(c.name)) achados.push(c);
    });
    return achados;
  };

  /* ---------------------------------------------------------------- *
   * Aplicacao
   * ---------------------------------------------------------------- */

  /**
   * Move (e opcionalmente redimensiona) as camadas segundo o resultado do motor.
   * Uma falha em uma camada nao derruba o resto: entra no relatorio.
   *
   * @param {Array} itens resultado de IBD.layout.calcular().itens
   * @param {object} [opcoes] {redimensionar: boolean}
   * @returns {{movidas: number, redimensionadas: number, falhas: Array}}
   */
  ps.aplicar = function (itens, opcoes) {
    var o = opcoes || {};
    var relatorio = { movidas: 0, redimensionadas: 0, falhas: [] };

    for (var i = 0; i < itens.length; i++) {
      var item = itens[i];
      if (!item.ref) continue;

      try {
        // Redimensiona antes de mover: com a ancora no canto superior
        // esquerdo, o deslocamento calculado continua valendo.
        if (o.redimensionar && item.redimensionou) {
          item.ref.resize(item.escalaX, item.escalaY, AnchorPosition.TOPLEFT);
          relatorio.redimensionadas++;
        }
        if (item.moveu) {
          item.ref.translate(UnitValue(item.dx, 'px'), UnitValue(item.dy, 'px'));
          relatorio.movidas++;
        }
      } catch (e) {
        relatorio.falhas.push({ nome: String(item.id), motivo: e.message || String(e) });
      }
    }

    return relatorio;
  };

  /* ---------------------------------------------------------------- *
   * Historico
   * ---------------------------------------------------------------- */

  /**
   * Executa fn como um unico passo de historico, com reversao se falhar.
   * Um Ctrl+Z desfaz o layout inteiro, nao camada por camada.
   */
  ps.historico = function (doc, rotulo, fn) {
    var antes = doc.activeHistoryState;
    var falha = null;
    var chave = '__IBD_LAYOUT_' + new Date().getTime();

    $.global[chave] = function () {
      try {
        fn();
      } catch (e) {
        falha = e;
      }
    };

    try {
      doc.suspendHistory(rotulo, '$.global.' + chave + '();');
      if (falha) throw falha;
    } catch (e2) {
      try {
        doc.activeHistoryState = antes;
      } catch (e3) {
        throw new Error((e2.message || e2) +
          '\nNão foi possível reverter automaticamente. Confira o painel Histórico.');
      }
      throw e2;
    } finally {
      delete $.global[chave];
    }
  };

  IBD.ps = ps;
})($.global.IBD);
