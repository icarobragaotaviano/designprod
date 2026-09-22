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
  layout.ALINHAMENTOS = ['inicio', 'centro', 'fim', 'esticar'];
  layout.ORDENS = ['documento', 'inversa'];
  layout.AJUSTES = ['conteudo', 'caixa'];

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
    arredondar: true,
    unidade: 'px'
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

  function escolha(valor, aceitos, rotulo, padrao) {
    if (valor === undefined || valor === null || valor === '') return padrao;
    var v = String(valor);
    if (aceitos.indexOf(v) === -1) {
      throw new Error(rotulo + ': "' + v + '" não é um valor aceito (' + aceitos.join(', ') + ').');
    }
    return v;
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
   * Completa a especificacao com os padroes e recusa valor incoerente.
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

    return {
      direcao: escolha(s.direcao, layout.DIRECOES, 'Direção', layout.PADRAO.direcao),
      gap: gap,
      gapLinha: gapLinha,
      padding: padding,
      distribuicao: escolha(s.distribuicao, layout.DISTRIBUICOES, 'Distribuição', layout.PADRAO.distribuicao),
      alinhamento: escolha(s.alinhamento, layout.ALINHAMENTOS, 'Alinhamento', layout.PADRAO.alinhamento),
      quebra: numero(s.quebra === undefined ? 0 : s.quebra, 'Quebra'),
      ordem: escolha(s.ordem, layout.ORDENS, 'Ordem', layout.PADRAO.ordem),
      ajuste: escolha(s.ajuste, layout.AJUSTES, 'Ajuste', layout.PADRAO.ajuste),
      arredondar: s.arredondar === undefined ? true : !!s.arredondar,
      unidade: s.unidade || 'px'
    };
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
      saida.push({ id: it.id, ref: it.ref, x: it.x, y: it.y, w: it.w, h: it.h });
    }
    return saida;
  }

  function arredondar(v) {
    return Math.round(v * 1000000) / 1000000;
  }

  /* ---------------------------------------------------------------- *
   * Calculo principal
   * ---------------------------------------------------------------- */

  /**
   * Posiciona os itens segundo a especificacao.
   *
   * @param {object} spec especificacao (veja layout.PADRAO)
   * @param {Array} itens [{id, ref, x, y, w, h}]
   * @param {object} [caixa] {x, y, largura, altura} do quadro. Quando ausente,
   *                 usa o retangulo que envolve os itens. A ancora do resultado
   *                 e sempre o canto superior esquerdo dessa caixa.
   * @returns {{itens: Array, caixa: object, linhas: number, avisos: string[], spec: object}}
   */
  layout.calcular = function (spec, itens, caixa) {
    var s = layout.normalizar(spec);
    var lista = copiarItens(itens);
    var avisos = [];
    var horizontal = s.direcao === 'horizontal';
    var i, j;

    if (s.ordem === 'inversa') lista.reverse();

    var base = caixa && isFinite(caixa.x) && isFinite(caixa.y) &&
      isFinite(caixa.largura) && isFinite(caixa.altura)
      ? { x: caixa.x, y: caixa.y, largura: caixa.largura, altura: caixa.altura }
      : layout.envolver(lista);

    var padIni = horizontal ? s.padding.esquerda : s.padding.topo;
    var padFim = horizontal ? s.padding.direita : s.padding.base;
    var padCruzIni = horizontal ? s.padding.topo : s.padding.esquerda;
    var padCruzFim = horizontal ? s.padding.base : s.padding.direita;

    // Espaco disponivel no eixo principal: a quebra fixa a medida do quadro;
    // sem quebra, so o ajuste "caixa" fixa. Caso contrario o quadro abraca
    // o conteudo e a distribuicao nao tem folga para trabalhar.
    var mainDisp = null;
    if (s.quebra > 0) {
      mainDisp = s.quebra - padIni - padFim;
    } else if (s.ajuste === 'caixa') {
      mainDisp = (horizontal ? base.largura : base.altura) - padIni - padFim;
    }

    var espalha = s.distribuicao === 'entre' || s.distribuicao === 'ao-redor' || s.distribuicao === 'uniforme';
    if (espalha && mainDisp === null) {
      mainDisp = (horizontal ? base.largura : base.altura) - padIni - padFim;
      avisos.push('A distribuição com espaço precisa de um quadro de medida fixa; foi usada a área atual do conjunto.');
    }

    if (mainDisp !== null && mainDisp <= 0) {
      throw new Error('O preenchimento interno não deixa espaço no eixo principal. Reduza o preenchimento ou aumente o quadro.');
    }

    var cruzDisp = null;
    if (s.ajuste === 'caixa' && !(s.quebra > 0)) {
      cruzDisp = (horizontal ? base.altura : base.largura) - padCruzIni - padCruzFim;
      if (cruzDisp <= 0) {
        throw new Error('O preenchimento interno não deixa espaço no eixo transversal. Reduza o preenchimento ou aumente o quadro.');
      }
    }

    /* Quebra em linhas ------------------------------------------------ */

    function medidaPrincipal(item) { return horizontal ? item.w : item.h; }
    function medidaTransversal(item) { return horizontal ? item.h : item.w; }

    var linhas = [];
    var atual = [];
    var usado = 0;

    for (i = 0; i < lista.length; i++) {
      var m = medidaPrincipal(lista[i]);
      if (s.quebra > 0 && atual.length && usado + s.gap + m > mainDisp + EPS) {
        linhas.push(atual);
        atual = [];
        usado = 0;
      }
      if (atual.length) usado += s.gap;
      atual.push(lista[i]);
      usado += m;
      if (s.quebra > 0 && m > mainDisp + EPS && atual.length === 1) {
        avisos.push('"' + (lista[i].id === undefined ? 'um item' : lista[i].id) + '" é maior que a quebra e vai ultrapassar o quadro.');
      }
    }
    if (atual.length) linhas.push(atual);

    /* Posicoes no eixo principal, linha a linha ----------------------- */

    function planoDaLinha(itensLinha) {
      var soma = 0, k;
      var n = itensLinha.length;
      for (k = 0; k < n; k++) soma += medidaPrincipal(itensLinha[k]);

      if (mainDisp === null) {
        return { inicio: 0, gap: s.gap, comprimento: soma + s.gap * (n - 1) };
      }

      var livre = mainDisp - soma;
      var plano;

      switch (s.distribuicao) {
        case 'entre':
          plano = { inicio: 0, gap: n > 1 ? livre / (n - 1) : 0, comprimento: mainDisp };
          break;
        case 'ao-redor':
          var ar = livre / n;
          plano = { inicio: ar / 2, gap: ar, comprimento: mainDisp };
          break;
        case 'uniforme':
          var un = livre / (n + 1);
          plano = { inicio: un, gap: un, comprimento: mainDisp };
          break;
        default:
          var bloco = soma + s.gap * (n - 1);
          var sobra = mainDisp - bloco;
          plano = {
            inicio: s.distribuicao === 'centro' ? sobra / 2 : (s.distribuicao === 'fim' ? sobra : 0),
            gap: s.gap,
            comprimento: mainDisp
          };
          if (sobra < -EPS) {
            avisos.push('O conteúdo passa do quadro em ' + Math.abs(Math.round(sobra)) + ' px no eixo principal.');
          }
      }

      if (espalha && plano.gap < -EPS) {
        avisos.push('Os itens ficaram sobrepostos: não cabem no quadro com essa distribuição.');
      }
      return plano;
    }

    /* Montagem final -------------------------------------------------- */

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
      for (j = 0; j < linha.length; j++) {
        alturaLinha = Math.max(alturaLinha, medidaTransversal(linha[j]));
      }
      // Linha unica em quadro de medida fixa: o alinhamento vale contra o
      // quadro inteiro, nao so contra o item mais alto.
      if (linhas.length === 1 && cruzDisp !== null) alturaLinha = cruzDisp;

      var cursorPrincipal = plano.inicio;

      for (j = 0; j < linha.length; j++) {
        var item = linha[j];
        var mp = medidaPrincipal(item);
        var mt = medidaTransversal(item);
        var novoMt = mt;
        var deslocamentoCruz = 0;

        switch (s.alinhamento) {
          case 'centro':
            deslocamentoCruz = (alturaLinha - mt) / 2;
            break;
          case 'fim':
            deslocamentoCruz = alturaLinha - mt;
            break;
          case 'esticar':
            novoMt = alturaLinha;
            break;
          default:
            deslocamentoCruz = 0;
        }

        var posPrincipal = origemPrincipal + cursorPrincipal;
        var posCruz = origemTransversal + cursorCruz + deslocamentoCruz;

        var novo = {
          id: item.id,
          ref: item.ref,
          linha: i,
          x: horizontal ? posPrincipal : posCruz,
          y: horizontal ? posCruz : posPrincipal,
          w: horizontal ? mp : novoMt,
          h: horizontal ? novoMt : mp,
          anterior: { x: item.x, y: item.y, w: item.w, h: item.h }
        };

        if (s.arredondar) {
          novo.x = Math.round(novo.x);
          novo.y = Math.round(novo.y);
          novo.w = Math.round(novo.w);
          novo.h = Math.round(novo.h);
        } else {
          novo.x = arredondar(novo.x);
          novo.y = arredondar(novo.y);
          novo.w = arredondar(novo.w);
          novo.h = arredondar(novo.h);
        }

        novo.dx = novo.x - item.x;
        novo.dy = novo.y - item.y;
        novo.escalaX = item.w ? (novo.w / item.w) * 100 : 100;
        novo.escalaY = item.h ? (novo.h / item.h) * 100 : 100;
        novo.moveu = Math.abs(novo.dx) > EPS || Math.abs(novo.dy) > EPS;
        novo.redimensionou = Math.abs(novo.w - item.w) > EPS || Math.abs(novo.h - item.h) > EPS;

        resultado.push(novo);
        cursorPrincipal += mp + plano.gap;
      }

      cursorCruz += alturaLinha + (i < linhas.length - 1 ? s.gapLinha : 0);
    }

    var totalPrincipal = (mainDisp !== null ? mainDisp : maiorComprimento) + padIni + padFim;
    var totalTransversal = (cruzDisp !== null && linhas.length === 1 ? cruzDisp : cursorCruz) + padCruzIni + padCruzFim;

    return {
      itens: resultado,
      caixa: {
        x: base.x,
        y: base.y,
        largura: horizontal ? totalPrincipal : totalTransversal,
        altura: horizontal ? totalTransversal : totalPrincipal
      },
      linhas: linhas.length,
      avisos: avisos,
      spec: s
    };
  };

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
  layout.lerTag = function (nome) {
    var texto = String(nome);
    var achado = texto.match(RE_TAG);
    if (!achado) return null;

    var bruto = {};
    var pares = achado[1].split(';');
    for (var i = 0; i < pares.length; i++) {
      var par = pares[i].replace(/^\s+|\s+$/g, '');
      if (!par) continue;
      var corte = par.indexOf('=');
      if (corte < 1) {
        throw new Error('Etiqueta @auto inválida em "' + texto + '": trecho "' + par + '".');
      }
      bruto[par.substring(0, corte).replace(/\s+/g, '')] = par.substring(corte + 1).replace(/^\s+|\s+$/g, '');
    }

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
    if (s.unidade && s.unidade !== 'px') partes.push('un=' + s.unidade);

    return '@auto[' + partes.join(';') + ']';
  };

  /** Nome do quadro com a etiqueta atualizada (substitui a anterior). */
  layout.escreverTag = function (nome, spec) {
    return (layout.nomeLimpo(nome) + ' ' + layout.montarTag(spec)).replace(/^\s+/, '');
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
