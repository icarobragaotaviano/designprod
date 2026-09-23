/**
 * ibd-layout.jsx — motor de layout automatico do estudio (auto layout).
 *
 * Calcula posicao e tamanho de um conjunto de caixas a partir de uma
 * especificacao no modelo do auto layout do Figma: direcao, espacamento,
 * preenchimento interno, alinhamento no eixo transversal, distribuicao no
 * eixo principal e quebra de linha.
 *
 * O motor e puro: recebe numeros, devolve numeros. Nao conhece Photoshop,
 * Illustrator nem InDesign. Quem conhece o app e o adaptador
 * (ibd-ps-camadas.jsx) e os scripts em apps/. Isso mantem a mesma conta
 * valendo em qualquer app e permite testar tudo fora da Adobe
 * (npm run test:layout).
 *
 * Sistema de coordenadas: [x, y] no canto superior esquerdo, y para baixo,
 * na mesma unidade dos itens recebidos (os scripts trabalham em pixels).
 *
 * Uso dentro de um script:
 *   #include "../../../core/extendscript/ibd-layout.jsx"
 */

#include "ibd-core.jsx"

(function (IBD) {
  var layout = {};

  var EPS = 0.000001;

  layout.DIRECOES = ['horizontal', 'vertical'];
  layout.DISTRIBUICOES = ['inicio', 'centro', 'fim', 'entre', 'ao-redor', 'uniforme'];
  layout.ALINHAMENTOS = ['inicio', 'centro', 'fim', 'esticar', 'base'];
  layout.ORDENS = ['documento', 'inversa'];
  layout.AJUSTES = ['conteudo', 'caixa'];

  /** Como cada filho se comporta em cada eixo — Fixo, Abracar e Preencher do Figma. */
  layout.MODOS_MEDIDA = ['fixo', 'abracar', 'preencher'];
  layout.ANCORAS_H = ['esquerda', 'centro', 'direita'];
  layout.ANCORAS_V = ['topo', 'centro', 'base'];

  layout.PADRAO = {
    direcao: 'horizontal',
    gap: 0,
    gapLinha: null,
    padding: { topo: 0, direita: 0, base: 0, esquerda: 0 },
    distribuicao: 'inicio',
    alinhamento: 'inicio',
    quebra: 0,
    ordem: 'documento',
    ajuste: 'conteudo',
    minLargura: null,
    maxLargura: null,
    minAltura: null,
    maxAltura: null,
    arredondar: true,
    unidade: 'px'
  };

  layout.PADRAO_ITEM = {
    largura: 'abracar',
    altura: 'abracar',
    minLargura: null,
    maxLargura: null,
    minAltura: null,
    maxAltura: null,
    absoluto: false,
    ancora: null
  };

  /* ---------------------------------------------------------------- *
   * Validacao
   * ---------------------------------------------------------------- */

  function numero(valor, rotulo, permitirNegativo) {
    var n = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(',', '.'));
    if (isNaN(n) || !isFinite(n)) {
      throw new Error(rotulo + ': informe um número válido.');
    }
    if (!permitirNegativo && n < 0) {
      throw new Error(rotulo + ': o valor não pode ser negativo.');
    }
    return n;
  }

  /** Numero opcional: vazio vira null, que significa "sem limite". */
  function opcional(valor, rotulo) {
    if (valor === undefined || valor === null || valor === '') return null;
    return numero(valor, rotulo);
  }

  function escolha(valor, aceitos, rotulo, padrao) {
    if (valor === undefined || valor === null || valor === '') return padrao;
    var v = String(valor);
    if (aceitos.indexOf(v) === -1) {
      throw new Error(rotulo + ': "' + v + '" não é um valor aceito (' + aceitos.join(', ') + ').');
    }
    return v;
  }

  function conferirLimites(min, max, rotulo) {
    if (min !== null && max !== null && min > max) {
      throw new Error(rotulo + ': o mínimo (' + min + ') é maior que o máximo (' + max + ').');
    }
  }

  /** Aceita numero (todos os lados), array [t,d,b,e] ou objeto. */
  function normalizarPadding(valor) {
    var p = { topo: 0, direita: 0, base: 0, esquerda: 0 };
    if (valor === undefined || valor === null) return p;

    if (typeof valor === 'number' || typeof valor === 'string') {
      var uniforme = numero(valor, 'Preenchimento');
      return { topo: uniforme, direita: uniforme, base: uniforme, esquerda: uniforme };
    }

    // Comparacao por toString: reconhece array tambem quando ele vem de
    // outro contexto de execucao, onde "instanceof Array" e falso.
    if (Object.prototype.toString.call(valor) === '[object Array]') {
      if (valor.length !== 4) {
        throw new Error('Preenchimento em lista precisa ter 4 valores: topo, direita, base, esquerda.');
      }
      return {
        topo: numero(valor[0], 'Preenchimento (topo)'),
        direita: numero(valor[1], 'Preenchimento (direita)'),
        base: numero(valor[2], 'Preenchimento (base)'),
        esquerda: numero(valor[3], 'Preenchimento (esquerda)')
      };
    }

    p.topo = numero(valor.topo || 0, 'Preenchimento (topo)');
    p.direita = numero(valor.direita || 0, 'Preenchimento (direita)');
    p.base = numero(valor.base || 0, 'Preenchimento (base)');
    p.esquerda = numero(valor.esquerda || 0, 'Preenchimento (esquerda)');
    return p;
  }

  /**
   * Completa a especificacao do quadro com os padroes e recusa valor incoerente.
   * @param {object} spec
   * @returns {object} copia normalizada, segura para usar
   */
  layout.normalizar = function (spec) {
    var s = spec || {};
    var padding = normalizarPadding(s.padding);
    var gap = numero(s.gap === undefined ? layout.PADRAO.gap : s.gap, 'Espaçamento', true);
    var gapLinha = s.gapLinha === undefined || s.gapLinha === null
      ? gap
      : numero(s.gapLinha, 'Espaçamento entre linhas', true);

    var saida = {
      direcao: escolha(s.direcao, layout.DIRECOES, 'Direção', layout.PADRAO.direcao),
      gap: gap,
      gapLinha: gapLinha,
      padding: padding,
      distribuicao: escolha(s.distribuicao, layout.DISTRIBUICOES, 'Distribuição', layout.PADRAO.distribuicao),
      alinhamento: escolha(s.alinhamento, layout.ALINHAMENTOS, 'Alinhamento', layout.PADRAO.alinhamento),
      quebra: numero(s.quebra === undefined ? 0 : s.quebra, 'Quebra'),
      ordem: escolha(s.ordem, layout.ORDENS, 'Ordem', layout.PADRAO.ordem),
      ajuste: escolha(s.ajuste, layout.AJUSTES, 'Ajuste', layout.PADRAO.ajuste),
      minLargura: opcional(s.minLargura, 'Largura mínima do quadro'),
      maxLargura: opcional(s.maxLargura, 'Largura máxima do quadro'),
      minAltura: opcional(s.minAltura, 'Altura mínima do quadro'),
      maxAltura: opcional(s.maxAltura, 'Altura máxima do quadro'),
      arredondar: s.arredondar === undefined ? true : !!s.arredondar,
      unidade: s.unidade || 'px'
    };
    conferirLimites(saida.minLargura, saida.maxLargura, 'Largura do quadro');
    conferirLimites(saida.minAltura, saida.maxAltura, 'Altura do quadro');
    return saida;
  };

  /**
   * Propriedades de um filho do quadro — o que no Figma fica no painel do
   * item selecionado. No Photoshop elas moram no metadado XMP da camada
   * (decisao 10 da arquitetura); aqui so se valida e completa.
   *
   * @param {object} props {largura, altura, minLargura, maxLargura,
   *                 minAltura, maxAltura, absoluto, ancora: {h, v, dx, dy}}
   */
  layout.normalizarItem = function (props) {
    var p = props || {};
    var saida = {
      largura: escolha(p.largura, layout.MODOS_MEDIDA, 'Largura do item', layout.PADRAO_ITEM.largura),
      altura: escolha(p.altura, layout.MODOS_MEDIDA, 'Altura do item', layout.PADRAO_ITEM.altura),
      minLargura: opcional(p.minLargura, 'Largura mínima do item'),
      maxLargura: opcional(p.maxLargura, 'Largura máxima do item'),
      minAltura: opcional(p.minAltura, 'Altura mínima do item'),
      maxAltura: opcional(p.maxAltura, 'Altura máxima do item'),
      absoluto: !!p.absoluto,
      ancora: null
    };
    conferirLimites(saida.minLargura, saida.maxLargura, 'Largura do item');
    conferirLimites(saida.minAltura, saida.maxAltura, 'Altura do item');

    if (p.ancora) {
      saida.ancora = {
        h: escolha(p.ancora.h, layout.ANCORAS_H, 'Âncora horizontal', 'esquerda'),
        v: escolha(p.ancora.v, layout.ANCORAS_V, 'Âncora vertical', 'topo'),
        dx: numero(p.ancora.dx === undefined ? 0 : p.ancora.dx, 'Distância da âncora (x)', true),
        dy: numero(p.ancora.dy === undefined ? 0 : p.ancora.dy, 'Distância da âncora (y)', true)
      };
    }
    return saida;
  };

  /* ---------------------------------------------------------------- *
   * Geometria auxiliar
   * ---------------------------------------------------------------- */

  /** Retangulo que envolve todos os itens. */
  layout.envolver = function (itens) {
    if (!itens || !itens.length) throw new Error('Nenhum item para medir.');
    var x1 = itens[0].x, y1 = itens[0].y;
    var x2 = itens[0].x + itens[0].w, y2 = itens[0].y + itens[0].h;
    for (var i = 1; i < itens.length; i++) {
      x1 = Math.min(x1, itens[i].x);
      y1 = Math.min(y1, itens[i].y);
      x2 = Math.max(x2, itens[i].x + itens[i].w);
      y2 = Math.max(y2, itens[i].y + itens[i].h);
    }
    return { x: x1, y: y1, largura: x2 - x1, altura: y2 - y1 };
  };

  function copiarItens(itens) {
    if (!itens || !itens.length) throw new Error('Nenhum item para posicionar.');
    var saida = [];
    for (var i = 0; i < itens.length; i++) {
      var it = itens[i];
      var rotulo = it && it.id !== undefined ? String(it.id) : 'item ' + (i + 1);
      if (!it || !isFinite(it.x) || !isFinite(it.y)) {
        throw new Error('Posição inválida em ' + rotulo + '.');
      }
      if (!isFinite(it.w) || !isFinite(it.h) || it.w <= 0 || it.h <= 0) {
        throw new Error('Medida inválida em ' + rotulo + ': largura e altura precisam ser maiores que zero.');
      }
      var props;
      try {
        props = layout.normalizarItem(it);
      } catch (e) {
        throw new Error(rotulo + ': ' + e.message);
      }
      saida.push({
        id: it.id, ref: it.ref, x: it.x, y: it.y, w: it.w, h: it.h,
        // Distancia do topo do item ate a linha de base do texto, medida
        // pelo adaptador. Sem ela, o item alinha pela propria base.
        linhaBase: isFinite(it.linhaBase) && it.linhaBase >= 0 && it.linhaBase <= it.h ? it.linhaBase : null,
        props: props
      });
    }
    return saida;
  }

  function arredondar(v) {
    return Math.round(v * 1000000) / 1000000;
  }

  /** Prende o valor entre min e max; null em qualquer ponta e "sem limite". */
  function limitar(valor, min, max) {
    var v = valor;
    if (max !== null && max !== undefined && v > max) v = max;
    if (min !== null && min !== undefined && v < min) v = min;
    return v;
  }

  /* ---------------------------------------------------------------- *
   * Calculo principal
   * ---------------------------------------------------------------- */

  /**
   * Posiciona os itens segundo a especificacao.
   *
   * Cada item pode trazer as propriedades de layout.normalizarItem (medida
   * por eixo, limites, posicao absoluta) e, para o alinhamento pela linha
   * de base, a distancia linhaBase. Item sem propriedade nenhuma se comporta
   * como antes: mantem a medida e entra no fluxo.
   *
   * @param {object} spec especificacao do quadro (veja layout.PADRAO)
   * @param {Array} itens [{id, ref, x, y, w, h, ...props, linhaBase}]
   * @param {object} [caixa] {x, y, largura, altura} do quadro. Quando ausente,
   *                 usa o retangulo que envolve os itens do fluxo. A ancora do
   *                 resultado e sempre o canto superior esquerdo dessa caixa.
   * @returns {{itens: Array, caixa: object, linhas: number, avisos: string[], spec: object}}
   */
  layout.calcular = function (spec, itens, caixa) {
    var s = layout.normalizar(spec);
    var lista = copiarItens(itens);
    var horizontal = s.direcao === 'horizontal';
    var i;

    var fluxo = [];
    var absolutos = [];
    for (i = 0; i < lista.length; i++) {
      (lista[i].props.absoluto ? absolutos : fluxo).push(lista[i]);
    }
    if (s.ordem === 'inversa') fluxo.reverse();

    // A caixa de referencia vem so do fluxo: um selo pendurado para fora do
    // quadro nao pode empurrar o canto do quadro.
    var base = caixa && isFinite(caixa.x) && isFinite(caixa.y) &&
      isFinite(caixa.largura) && isFinite(caixa.altura)
      ? { x: caixa.x, y: caixa.y, largura: caixa.largura, altura: caixa.altura }
      : layout.envolver(fluxo.length ? fluxo : lista);

    var minP = horizontal ? s.minLargura : s.minAltura;
    var maxP = horizontal ? s.maxLargura : s.maxAltura;
    var minT = horizontal ? s.minAltura : s.minLargura;
    var maxT = horizontal ? s.maxAltura : s.maxLargura;

    // Eixo fixo: a quebra fixa o principal; o ajuste "caixa" fixa os dois.
    var fixoP = null;
    var fixoT = null;
    if (s.quebra > 0) fixoP = s.quebra;
    else if (s.ajuste === 'caixa') fixoP = horizontal ? base.largura : base.altura;
    if (s.ajuste === 'caixa' && !(s.quebra > 0)) fixoT = horizontal ? base.altura : base.largura;
    if (fixoP !== null) fixoP = limitar(fixoP, minP, maxP);
    if (fixoT !== null) fixoT = limitar(fixoT, minT, maxT);

    var r = executar(s, fluxo, base, fixoP, fixoT, horizontal);

    // Quadro que abraca o conteudo mas fura o proprio minimo ou maximo:
    // refaz com a medida limitada fixada naquele eixo. E o que faz um
    // "Centro" funcionar dentro de uma largura minima, por exemplo.
    var refazP = fixoP === null ? limitar(r.principal, minP, maxP) : fixoP;
    var refazT = fixoT === null ? limitar(r.transversal, minT, maxT) : fixoT;
    var mudouP = fixoP === null && Math.abs(refazP - r.principal) > EPS;
    var mudouT = fixoT === null && Math.abs(refazT - r.transversal) > EPS;
    if (mudouP || mudouT) {
      r = executar(s, fluxo, base, mudouP ? refazP : fixoP, mudouT ? refazT : fixoT, horizontal);
    }

    var quadro = {
      x: base.x,
      y: base.y,
      largura: horizontal ? r.principal : r.transversal,
      altura: horizontal ? r.transversal : r.principal
    };

    var resultado = r.itens;
    for (i = 0; i < absolutos.length; i++) {
      resultado.push(posicionarAbsoluto(absolutos[i], quadro, base, s));
    }

    return {
      itens: resultado,
      caixa: quadro,
      linhas: r.linhas,
      avisos: r.avisos,
      spec: s
    };
  };

  /** Item pronto para o adaptador: posicao, medida e o que mudou. */
  function montarSaida(item, x, y, w, h, linha, s) {
    var novo = {
      id: item.id,
      ref: item.ref,
      linha: linha,
      absoluto: !!item.props.absoluto,
      x: x, y: y, w: w, h: h,
      anterior: { x: item.x, y: item.y, w: item.w, h: item.h }
    };
    var arred = s.arredondar ? Math.round : arredondar;
    novo.x = arred(novo.x);
    novo.y = arred(novo.y);
    novo.w = arred(novo.w);
    novo.h = arred(novo.h);

    novo.dx = novo.x - item.x;
    novo.dy = novo.y - item.y;
    novo.escalaX = item.w ? (novo.w / item.w) * 100 : 100;
    novo.escalaY = item.h ? (novo.h / item.h) * 100 : 100;
    novo.moveu = Math.abs(novo.dx) > EPS || Math.abs(novo.dy) > EPS;
    novo.redimensionou = Math.abs(novo.w - item.w) > EPS || Math.abs(novo.h - item.h) > EPS;
    return novo;
  }

  /**
   * Filho absoluto ("Ignorar auto layout"): fica fora do fluxo e preso a um
   * canto do quadro. Sem ancora declarada, guarda a distancia que ja tem do
   * canto superior esquerdo — como o canto nao se move, o item fica parado.
   */
  function posicionarAbsoluto(item, quadro, base, s) {
    var a = item.props.ancora || { h: 'esquerda', v: 'topo', dx: item.x - base.x, dy: item.y - base.y };
    var x, y;

    if (a.h === 'direita') x = quadro.x + quadro.largura - a.dx - item.w;
    else if (a.h === 'centro') x = quadro.x + (quadro.largura - item.w) / 2 + a.dx;
    else x = quadro.x + a.dx;

    if (a.v === 'base') y = quadro.y + quadro.altura - a.dy - item.h;
    else if (a.v === 'centro') y = quadro.y + (quadro.altura - item.h) / 2 + a.dy;
    else y = quadro.y + a.dy;

    return montarSaida(item, x, y, item.w, item.h, -1, s);
  }

  /**
   * Divide o espaco entre os filhos que preenchem, respeitando min e max de
   * cada um. Mesmo algoritmo do flex-grow do CSS: quem estoura um limite
   * fica preso nele, e o resto do espaco e redividido entre os demais.
   */
  function distribuirPreencher(itens, espaco, medida, minDe, maxDe) {
    var ativos = itens.slice(0);
    var resto = espaco;
    var guarda = 0;

    while (ativos.length && guarda++ < 100) {
      var cota = resto / ativos.length;
      var alvos = [];
      var violacao = 0;
      var k;

      for (k = 0; k < ativos.length; k++) {
        // Preencher nunca zera uma camada: abaixo de 1 px ela some do documento.
        var minimo = Math.max(minDe(ativos[k]) === null ? 0 : minDe(ativos[k]), 1);
        var alvo = limitar(cota, minimo, maxDe(ativos[k]));
        alvos.push(alvo);
        violacao += alvo - cota;
      }

      if (Math.abs(violacao) < EPS) {
        for (k = 0; k < ativos.length; k++) medida(ativos[k], alvos[k]);
        return;
      }

      // Congela so os que estouraram no sentido da violacao total.
      var seguem = [];
      for (k = 0; k < ativos.length; k++) {
        var estourou = violacao > 0 ? alvos[k] > cota + EPS : alvos[k] < cota - EPS;
        if (estourou) {
          medida(ativos[k], alvos[k]);
          resto -= alvos[k];
        } else {
          seguem.push(ativos[k]);
        }
      }
      ativos = seguem;
    }
  }

  /**
   * Uma passada de layout com os eixos fixos ja decididos.
   * @returns {{itens: Array, principal: number, transversal: number, linhas: number, avisos: string[]}}
   */
  function executar(s, fluxo, base, fixoP, fixoT, horizontal) {
    var avisos = [];
    var i, j, k;

    var padIni = horizontal ? s.padding.esquerda : s.padding.topo;
    var padFim = horizontal ? s.padding.direita : s.padding.base;
    var padCruzIni = horizontal ? s.padding.topo : s.padding.esquerda;
    var padCruzFim = horizontal ? s.padding.base : s.padding.direita;

    // Espaco disponivel no eixo principal: sem eixo fixo, o quadro abraca o
    // conteudo e a distribuicao nao tem folga para trabalhar.
    var mainDisp = fixoP === null ? null : fixoP - padIni - padFim;

    var espalha = s.distribuicao === 'entre' || s.distribuicao === 'ao-redor' || s.distribuicao === 'uniforme';
    if (espalha && mainDisp === null) {
      mainDisp = (horizontal ? base.largura : base.altura) - padIni - padFim;
      avisos.push('A distribuição com espaço precisa de um quadro de medida fixa; foi usada a área atual do conjunto.');
    }

    if (mainDisp !== null && mainDisp <= 0) {
      throw new Error('O preenchimento interno não deixa espaço no eixo principal. Reduza o preenchimento ou aumente o quadro.');
    }

    var cruzDisp = fixoT === null ? null : fixoT - padCruzIni - padCruzFim;
    if (cruzDisp !== null && cruzDisp <= 0) {
      throw new Error('O preenchimento interno não deixa espaço no eixo transversal. Reduza o preenchimento ou aumente o quadro.');
    }

    var alinhamento = s.alinhamento;
    if (alinhamento === 'base' && !horizontal) {
      alinhamento = 'inicio';
      avisos.push('O alinhamento pela linha de base só vale no fluxo horizontal; foi usado o início.');
    }

    /* Medidas de trabalho de cada item, por eixo ---------------------- */

    function modoP(it) { return horizontal ? it.props.largura : it.props.altura; }
    function modoT(it) { return horizontal ? it.props.altura : it.props.largura; }
    function minPDe(it) { return horizontal ? it.props.minLargura : it.props.minAltura; }
    function maxPDe(it) { return horizontal ? it.props.maxLargura : it.props.maxAltura; }
    function minTDe(it) { return horizontal ? it.props.minAltura : it.props.minLargura; }
    function maxTDe(it) { return horizontal ? it.props.maxAltura : it.props.maxLargura; }

    var trabalho = [];
    for (i = 0; i < fluxo.length; i++) {
      var it = fluxo[i];
      var p0 = horizontal ? it.w : it.h;
      var t0 = horizontal ? it.h : it.w;
      // Fixo e a medida atual, sem conversa. Abracar e a medida do conteudo,
      // mas obedece a min e max. Preencher comeca da medida atual e cresce
      // depois, quando se sabe quanto espaco sobra.
      trabalho.push({
        item: it,
        p: modoP(it) === 'abracar' ? limitar(p0, minPDe(it), maxPDe(it)) : p0,
        t: modoT(it) === 'abracar' ? limitar(t0, minTDe(it), maxTDe(it)) : t0
      });
    }
    function prop(fn) { return function (w) { return fn(w.item); }; }

    /* Quebra em linhas ------------------------------------------------ */

    var linhas = [];
    var atual = [];
    var usado = 0;

    for (i = 0; i < trabalho.length; i++) {
      var m = trabalho[i].p;
      if (s.quebra > 0 && atual.length && usado + s.gap + m > mainDisp + EPS) {
        linhas.push(atual);
        atual = [];
        usado = 0;
      }
      if (atual.length) usado += s.gap;
      atual.push(trabalho[i]);
      usado += m;
      if (s.quebra > 0 && m > mainDisp + EPS && atual.length === 1) {
        var idq = trabalho[i].item.id;
        avisos.push('"' + (idq === undefined ? 'um item' : idq) + '" é maior que a quebra e vai ultrapassar o quadro.');
      }
    }
    if (atual.length) linhas.push(atual);

    /* Eixo principal, linha a linha ------------------------------------ */

    var avisouPreencher = false;

    function planoDaLinha(itensLinha) {
      var n = itensLinha.length;
      var preenchem = [];
      var soma = 0;

      for (k = 0; k < n; k++) {
        if (modoP(itensLinha[k].item) === 'preencher') preenchem.push(itensLinha[k]);
      }

      if (preenchem.length) {
        if (mainDisp === null) {
          if (!avisouPreencher) {
            avisos.push('"Preencher" no eixo principal precisa de um quadro de medida fixa; os itens mantiveram a medida atual.');
            avisouPreencher = true;
          }
        } else {
          var ocupado = s.gap * (n - 1);
          for (k = 0; k < n; k++) {
            if (modoP(itensLinha[k].item) !== 'preencher') ocupado += itensLinha[k].p;
          }
          distribuirPreencher(preenchem, mainDisp - ocupado,
            function (w, v) { w.p = v; }, prop(minPDe), prop(maxPDe));
        }
      }

      for (k = 0; k < n; k++) soma += itensLinha[k].p;

      if (mainDisp === null) {
        return { inicio: 0, gap: s.gap, comprimento: soma + s.gap * (n - 1) };
      }

      var livre = mainDisp - soma;
      var plano;

      // Com filho que preenche nao sobra espaco para distribuir: vale o
      // espaco entre itens declarado, como no Figma.
      if (preenchem.length || !espalha) {
        var bloco = soma + s.gap * (n - 1);
        var sobra = mainDisp - bloco;
        var dist = preenchem.length ? 'inicio' : s.distribuicao;
        plano = {
          inicio: dist === 'centro' ? sobra / 2 : (dist === 'fim' ? sobra : 0),
          gap: s.gap,
          comprimento: mainDisp
        };
        if (sobra < -EPS) {
          avisos.push('O conteúdo passa do quadro em ' + Math.abs(Math.round(sobra)) + ' px no eixo principal.');
        }
        return plano;
      }

      if (s.distribuicao === 'entre') {
        plano = { inicio: 0, gap: n > 1 ? livre / (n - 1) : 0, comprimento: mainDisp };
      } else if (s.distribuicao === 'ao-redor') {
        plano = { inicio: livre / n / 2, gap: livre / n, comprimento: mainDisp };
      } else {
        plano = { inicio: livre / (n + 1), gap: livre / (n + 1), comprimento: mainDisp };
      }

      // Espaco automatico nunca fica negativo: sem folga, os itens encostam
      // a partir do inicio em vez de se sobreporem.
      if (livre < -EPS) {
        plano.inicio = 0;
        plano.gap = 0;
        avisos.push('O conteúdo não cabe no quadro: os itens ficaram encostados, sem espaço entre eles.');
      }
      return plano;
    }

    /* Montagem ------------------------------------------------------- */

    var origemPrincipal = (horizontal ? base.x : base.y) + padIni;
    var origemTransversal = (horizontal ? base.y : base.x) + padCruzIni;

    var cursorCruz = 0;
    var maiorComprimento = 0;
    var resultado = [];

    for (i = 0; i < linhas.length; i++) {
      var linha = linhas[i];
      var plano = planoDaLinha(linha);
      maiorComprimento = Math.max(maiorComprimento, plano.comprimento);

      var alturaLinha = 0;
      var acima = 0;
      var abaixo = 0;
      for (j = 0; j < linha.length; j++) {
        alturaLinha = Math.max(alturaLinha, linha[j].t);
        var b = linha[j].item.linhaBase === null ? linha[j].t : linha[j].item.linhaBase;
        acima = Math.max(acima, b);
        abaixo = Math.max(abaixo, linha[j].t - b);
      }
      if (alinhamento === 'base') alturaLinha = Math.max(alturaLinha, acima + abaixo);
      // Linha unica em quadro de medida fixa: o alinhamento vale contra o
      // quadro inteiro, nao so contra o item mais alto.
      if (linhas.length === 1 && cruzDisp !== null) alturaLinha = cruzDisp;

      var cursorPrincipal = plano.inicio;

      for (j = 0; j < linha.length; j++) {
        var w = linha[j];
        var item = w.item;
        var novoT = w.t;
        var deslocamento = 0;

        var estica = modoT(item) === 'preencher' ||
          (alinhamento === 'esticar' && modoT(item) !== 'fixo');

        if (estica) {
          novoT = limitar(alturaLinha, minTDe(item), maxTDe(item));
        } else if (alinhamento === 'centro') {
          deslocamento = (alturaLinha - novoT) / 2;
        } else if (alinhamento === 'fim') {
          deslocamento = alturaLinha - novoT;
        } else if (alinhamento === 'base') {
          deslocamento = acima - (item.linhaBase === null ? novoT : item.linhaBase);
        }

        var posPrincipal = origemPrincipal + cursorPrincipal;
        var posCruz = origemTransversal + cursorCruz + deslocamento;

        resultado.push(montarSaida(item,
          horizontal ? posPrincipal : posCruz,
          horizontal ? posCruz : posPrincipal,
          horizontal ? w.p : novoT,
          horizontal ? novoT : w.p,
          i, s));
        cursorPrincipal += w.p + plano.gap;
      }

      cursorCruz += alturaLinha + (i < linhas.length - 1 ? s.gapLinha : 0);
    }

    return {
      itens: resultado,
      principal: (mainDisp !== null ? mainDisp : maiorComprimento) + padIni + padFim,
      transversal: (cruzDisp !== null && linhas.length === 1 ? cruzDisp : cursorCruz) + padCruzIni + padCruzFim,
      linhas: linhas.length,
      avisos: avisos
    };
  }

  /* ---------------------------------------------------------------- *
   * Alinhar e distribuir (barra de alinhamento, sem quadro)
   * ---------------------------------------------------------------- */

  /**
   * Alinha itens dentro de uma caixa, preservando a posicao no outro eixo.
   * @param {Array} itens
   * @param {object} caixa {x, y, largura, altura}
   * @param {string} modoH nenhum | inicio | centro | fim
   * @param {string} modoV nenhum | inicio | centro | fim
   */
  layout.alinhar = function (itens, caixa, modoH, modoV) {
    var lista = copiarItens(itens);
    var aceitos = ['nenhum', 'inicio', 'centro', 'fim'];
    var h = escolha(modoH, aceitos, 'Alinhamento horizontal', 'nenhum');
    var v = escolha(modoV, aceitos, 'Alinhamento vertical', 'nenhum');
    var area = caixa && isFinite(caixa.x) ? caixa : layout.envolver(lista);
    var saida = [];

    for (var i = 0; i < lista.length; i++) {
      var it = lista[i];
      var x = it.x;
      var y = it.y;

      if (h === 'inicio') x = area.x;
      else if (h === 'centro') x = area.x + (area.largura - it.w) / 2;
      else if (h === 'fim') x = area.x + area.largura - it.w;

      if (v === 'inicio') y = area.y;
      else if (v === 'centro') y = area.y + (area.altura - it.h) / 2;
      else if (v === 'fim') y = area.y + area.altura - it.h;

      x = Math.round(x);
      y = Math.round(y);
      saida.push({
        id: it.id, ref: it.ref, x: x, y: y, w: it.w, h: it.h,
        dx: x - it.x, dy: y - it.y,
        moveu: Math.abs(x - it.x) > EPS || Math.abs(y - it.y) > EPS,
        anterior: { x: it.x, y: it.y, w: it.w, h: it.h }
      });
    }
    return { itens: saida, caixa: area };
  };

  /**
   * Distribui itens em um eixo, preservando o outro.
   * @param {Array} itens
   * @param {string} eixo horizontal | vertical
   * @param {string} modo bordas | centros | fixo
   * @param {number} [valor] espacamento quando modo = fixo
   */
  layout.distribuir = function (itens, eixo, modo, valor) {
    var lista = copiarItens(itens);
    var dir = escolha(eixo, layout.DIRECOES, 'Eixo', 'horizontal');
    var m = escolha(modo, ['bordas', 'centros', 'fixo'], 'Modo', 'bordas');
    var horizontal = dir === 'horizontal';
    var i;

    if (lista.length < 2) {
      throw new Error('Distribuir exige pelo menos dois itens.');
    }
    if (m === 'fixo' && lista.length < 2) {
      throw new Error('Distribuir com espaçamento fixo exige pelo menos dois itens.');
    }

    function pos(it) { return horizontal ? it.x : it.y; }
    function tam(it) { return horizontal ? it.w : it.h; }

    lista.sort(function (a, b) { return pos(a) - pos(b); });

    var area = layout.envolver(lista);
    var inicio = horizontal ? area.x : area.y;
    var extensao = horizontal ? area.largura : area.altura;
    var n = lista.length;
    var alvos = [];

    if (m === 'centros') {
      var primeiroCentro = pos(lista[0]) + tam(lista[0]) / 2;
      var ultimoCentro = pos(lista[n - 1]) + tam(lista[n - 1]) / 2;
      var passo = (ultimoCentro - primeiroCentro) / (n - 1);
      for (i = 0; i < n; i++) alvos.push(primeiroCentro + passo * i - tam(lista[i]) / 2);
    } else {
      var soma = 0;
      for (i = 0; i < n; i++) soma += tam(lista[i]);
      var espaco = m === 'fixo'
        ? numero(valor === undefined ? 0 : valor, 'Espaçamento', true)
        : (extensao - soma) / (n - 1);
      var cursor = inicio;
      for (i = 0; i < n; i++) {
        alvos.push(cursor);
        cursor += tam(lista[i]) + espaco;
      }
    }

    var saida = [];
    for (i = 0; i < n; i++) {
      var it = lista[i];
      var alvo = Math.round(alvos[i]);
      var x = horizontal ? alvo : it.x;
      var y = horizontal ? it.y : alvo;
      saida.push({
        id: it.id, ref: it.ref, x: x, y: y, w: it.w, h: it.h,
        dx: x - it.x, dy: y - it.y,
        moveu: Math.abs(x - it.x) > EPS || Math.abs(y - it.y) > EPS,
        anterior: { x: it.x, y: it.y, w: it.w, h: it.h }
      });
    }
    return { itens: saida, caixa: area };
  };

  /**
   * Le preenchimento no formato curto usado nos formularios, no estilo CSS:
   *   "24"          todos os lados
   *   "24 40"       vertical, horizontal
   *   "24 40 16 40" topo, direita, base, esquerda
   *
   * @returns {number[]} [topo, direita, base, esquerda]
   */
  layout.lerPadding = function (texto) {
    var bruto = String(texto === undefined || texto === null ? '' : texto)
      .replace(/^\s+|\s+$/g, '');
    if (!bruto) return [0, 0, 0, 0];

    var partes = bruto.split(/[\s,;]+/);
    var n = [];
    for (var i = 0; i < partes.length; i++) {
      if (partes[i] !== '') n.push(numero(partes[i], 'Preenchimento'));
    }

    if (n.length === 1) return [n[0], n[0], n[0], n[0]];
    if (n.length === 2) return [n[0], n[1], n[0], n[1]];
    if (n.length === 4) return [n[0], n[1], n[2], n[3]];
    throw new Error('Preenchimento aceita 1, 2 ou 4 valores. Recebido: "' + bruto + '".');
  };

  /* ---------------------------------------------------------------- *
   * Etiqueta no nome do quadro
   *
   * A especificacao mora no proprio nome do grupo, entre "@auto[...]".
   * E o que permite reaplicar o layout depois de editar o conteudo, sem
   * banco de dados paralelo nem metadado invisivel: quem abre o PSD ve a
   * regra no painel Camadas e pode apaga-la a mao.
   * ---------------------------------------------------------------- */

  var RE_TAG = /@auto\[([^\]]*)\]/;

  var ABREV_DIST = { inicio: 'inicio', centro: 'centro', fim: 'fim', entre: 'entre', 'ao-redor': 'aoredor', uniforme: 'uniforme' };
  var ABREV_ORDEM = { documento: 'doc', inversa: 'inv' };

  function chaveDe(mapa, valor) {
    for (var k in mapa) {
      if (Object.prototype.hasOwnProperty.call(mapa, k) && mapa[k] === valor) return k;
    }
    return null;
  }

  /** Nome sem a etiqueta e sem espaco sobrando. */
  layout.nomeLimpo = function (nome) {
    return String(nome).replace(RE_TAG, '').replace(/\s+/g, ' ').trim();
  };

  /** true quando o nome carrega uma etiqueta de auto layout. */
  layout.temTag = function (nome) {
    return RE_TAG.test(String(nome));
  };

  /**
   * Le a etiqueta do nome.
   * @returns {{spec: object, nome: string}|null} null quando nao ha etiqueta
   * @throws {Error} quando a etiqueta existe mas esta corrompida
   */
  /** "a=1;b=2" vira {a: '1', b: '2'}; trecho sem "=" e recusado com a origem na mensagem. */
  function lerPares(conteudo, rotulo, origem) {
    var bruto = {};
    var pares = String(conteudo).split(';');
    for (var i = 0; i < pares.length; i++) {
      var par = pares[i].replace(/^\s+|\s+$/g, '');
      if (!par) continue;
      var corte = par.indexOf('=');
      if (corte < 1) {
        throw new Error(rotulo + ' inválida em "' + origem + '": trecho "' + par + '".');
      }
      bruto[par.substring(0, corte).replace(/\s+/g, '')] = par.substring(corte + 1).replace(/^\s+|\s+$/g, '');
    }
    return bruto;
  }

  layout.lerTag = function (nome) {
    var texto = String(nome);
    var achado = texto.match(RE_TAG);
    if (!achado) return null;

    var bruto = lerPares(achado[1], 'Etiqueta @auto', texto);

    var spec = {};
    if (bruto.dir) spec.direcao = bruto.dir === 'v' ? 'vertical' : (bruto.dir === 'h' ? 'horizontal' : bruto.dir);
    if (bruto.gap !== undefined) spec.gap = numero(bruto.gap, 'Etiqueta @auto (gap)', true);
    if (bruto.gapl !== undefined) spec.gapLinha = numero(bruto.gapl, 'Etiqueta @auto (gapl)', true);
    if (bruto.quebra !== undefined) spec.quebra = numero(bruto.quebra, 'Etiqueta @auto (quebra)');
    if (bruto.dist) spec.distribuicao = chaveDe(ABREV_DIST, bruto.dist) || bruto.dist;
    if (bruto.al) spec.alinhamento = bruto.al;
    if (bruto.ordem) spec.ordem = chaveDe(ABREV_ORDEM, bruto.ordem) || bruto.ordem;
    if (bruto.ajuste) spec.ajuste = bruto.ajuste;
    if (bruto.un) spec.unidade = bruto.un;
    if (bruto.minw !== undefined) spec.minLargura = numero(bruto.minw, 'Etiqueta @auto (minw)');
    if (bruto.maxw !== undefined) spec.maxLargura = numero(bruto.maxw, 'Etiqueta @auto (maxw)');
    if (bruto.minh !== undefined) spec.minAltura = numero(bruto.minh, 'Etiqueta @auto (minh)');
    if (bruto.maxh !== undefined) spec.maxAltura = numero(bruto.maxh, 'Etiqueta @auto (maxh)');

    if (bruto.pad !== undefined) {
      var partes = bruto.pad.split(',');
      if (partes.length === 1) {
        spec.padding = numero(partes[0], 'Etiqueta @auto (pad)');
      } else if (partes.length === 4) {
        spec.padding = [
          numero(partes[0], 'Etiqueta @auto (pad topo)'),
          numero(partes[1], 'Etiqueta @auto (pad direita)'),
          numero(partes[2], 'Etiqueta @auto (pad base)'),
          numero(partes[3], 'Etiqueta @auto (pad esquerda)')
        ];
      } else {
        throw new Error('Etiqueta @auto inválida: "pad" aceita 1 ou 4 valores.');
      }
    }

    return { spec: layout.normalizar(spec), nome: layout.nomeLimpo(texto) };
  };

  /** Monta so o trecho "@auto[...]" da especificacao. */
  layout.montarTag = function (spec) {
    var s = layout.normalizar(spec);
    var p = s.padding;
    var partes = ['dir=' + (s.direcao === 'vertical' ? 'v' : 'h')];

    if (s.gap) partes.push('gap=' + s.gap);
    if (s.gapLinha !== s.gap) partes.push('gapl=' + s.gapLinha);

    if (p.topo || p.direita || p.base || p.esquerda) {
      partes.push(p.topo === p.direita && p.direita === p.base && p.base === p.esquerda
        ? 'pad=' + p.topo
        : 'pad=' + p.topo + ',' + p.direita + ',' + p.base + ',' + p.esquerda);
    }

    if (s.distribuicao !== layout.PADRAO.distribuicao) partes.push('dist=' + (ABREV_DIST[s.distribuicao] || s.distribuicao));
    if (s.alinhamento !== layout.PADRAO.alinhamento) partes.push('al=' + s.alinhamento);
    if (s.quebra) partes.push('quebra=' + s.quebra);
    if (s.ordem !== layout.PADRAO.ordem) partes.push('ordem=' + (ABREV_ORDEM[s.ordem] || s.ordem));
    if (s.ajuste !== layout.PADRAO.ajuste) partes.push('ajuste=' + s.ajuste);
    if (s.minLargura !== null) partes.push('minw=' + s.minLargura);
    if (s.maxLargura !== null) partes.push('maxw=' + s.maxLargura);
    if (s.minAltura !== null) partes.push('minh=' + s.minAltura);
    if (s.maxAltura !== null) partes.push('maxh=' + s.maxAltura);
    if (s.unidade && s.unidade !== 'px') partes.push('un=' + s.unidade);

    return '@auto[' + partes.join(';') + ']';
  };

  /** Nome do quadro com a etiqueta atualizada (substitui a anterior). */
  layout.escreverTag = function (nome, spec) {
    return (layout.nomeLimpo(nome) + ' ' + layout.montarTag(spec)).replace(/^\s+/, '');
  };

  /* ---------------------------------------------------------------- *
   * Propriedades do filho em texto
   *
   * O quadro guarda a regra no nome do grupo; os filhos guardam as suas no
   * metadado XMP da camada, para o painel Camadas nao virar uma sopa de
   * etiquetas (decisao 10 da arquitetura). O formato e o mesmo da etiqueta
   * do quadro — chave=valor separados por ";" — so que sem o "@auto[...]":
   *
   *   w=preencher;h=fixo;maxw=320;abs=1;ancora=direita,topo,8,8
   *
   * Gravar e ler o XMP e trabalho do adaptador (Fase 2). Aqui so o texto.
   * ---------------------------------------------------------------- */

  /** Texto curto com o que foge do padrao; vazio quando o item e todo padrao. */
  layout.montarItem = function (props) {
    var p = layout.normalizarItem(props);
    var d = layout.PADRAO_ITEM;
    var partes = [];

    if (p.largura !== d.largura) partes.push('w=' + p.largura);
    if (p.altura !== d.altura) partes.push('h=' + p.altura);
    if (p.minLargura !== null) partes.push('minw=' + p.minLargura);
    if (p.maxLargura !== null) partes.push('maxw=' + p.maxLargura);
    if (p.minAltura !== null) partes.push('minh=' + p.minAltura);
    if (p.maxAltura !== null) partes.push('maxh=' + p.maxAltura);
    if (p.absoluto) partes.push('abs=1');
    if (p.ancora) partes.push('ancora=' + p.ancora.h + ',' + p.ancora.v + ',' + p.ancora.dx + ',' + p.ancora.dy);

    return partes.join(';');
  };

  /** Le o texto de layout.montarItem. Vazio ou ausente devolve o padrao. */
  layout.lerItem = function (texto) {
    if (texto === undefined || texto === null || String(texto).replace(/\s+/g, '') === '') {
      return layout.normalizarItem({});
    }
    var bruto = lerPares(texto, 'Propriedade de item', texto);
    var props = {};

    if (bruto.w) props.largura = bruto.w;
    if (bruto.h) props.altura = bruto.h;
    if (bruto.minw !== undefined) props.minLargura = numero(bruto.minw, 'Item (minw)');
    if (bruto.maxw !== undefined) props.maxLargura = numero(bruto.maxw, 'Item (maxw)');
    if (bruto.minh !== undefined) props.minAltura = numero(bruto.minh, 'Item (minh)');
    if (bruto.maxh !== undefined) props.maxAltura = numero(bruto.maxh, 'Item (maxh)');
    if (bruto.abs !== undefined) props.absoluto = bruto.abs === '1' || bruto.abs === 'sim';

    if (bruto.ancora !== undefined) {
      var a = bruto.ancora.split(',');
      if (a.length !== 4) {
        throw new Error('Propriedade de item inválida: "ancora" precisa de 4 partes — horizontal, vertical, dx, dy.');
      }
      props.ancora = { h: a[0], v: a[1], dx: numero(a[2], 'Item (ancora dx)', true), dy: numero(a[3], 'Item (ancora dy)', true) };
    }

    return layout.normalizarItem(props);
  };

  /** Uma linha legivel descrevendo a especificacao, para relatorio. */
  layout.descrever = function (spec) {
    var s = layout.normalizar(spec);
    var p = s.padding;
    var pad = (p.topo === p.direita && p.direita === p.base && p.base === p.esquerda)
      ? String(p.topo)
      : p.topo + '/' + p.direita + '/' + p.base + '/' + p.esquerda;
    return (s.direcao === 'vertical' ? 'Vertical' : 'Horizontal') +
      ' | espaço ' + s.gap + ' px' +
      ' | preenchimento ' + pad + ' px' +
      ' | distribuição ' + s.distribuicao +
      ' | alinhamento ' + s.alinhamento +
      (s.quebra ? ' | quebra em ' + s.quebra + ' px' : '') +
      (s.ordem === 'inversa' ? ' | ordem inversa' : '');
  };

  IBD.layout = layout;
})($.global.IBD);
