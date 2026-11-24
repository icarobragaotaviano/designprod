/**
 * ibd-medida.jsx — contas das marcas de medida (cotas) da selecao.
 *
 * Recebe o retangulo da selecao, a resolucao do documento e as opcoes, e
 * devolve o plano pronto: os retangulos que formam a linha e as hastes, o
 * texto de cada rotulo e onde ele deve ficar. Nao chama nenhuma API da
 * Adobe — quem desenha no Photoshop e ibd-ps-medida.jsx. Por isso as contas
 * rodam inteiras em Node, em `npm run test:medida`.
 *
 * Coordenadas em pixels do documento, origem no canto superior esquerdo,
 * y para baixo. Retangulo = [esquerda, topo, direita, base], base exclusiva.
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
 *   #include "../../../core/extendscript/ibd-medida.jsx"
 */
#include "ibd-core.jsx"

(function (IBD) {
  var medida = {};

  /** Espaco fino entre numero e unidade, como no Size Marks: "120 px". */
  var ESPACO_UNIDADE = '\u200A';

  medida.UNIDADES = ['px', 'mm', 'cm', 'pt'];
  medida.DIMENSOES = ['auto', 'largura', 'altura', 'ambas'];
  medida.POSICOES = ['inicio', 'centro', 'fim'];

  /** Casas decimais do modo automatico: o que faz sentido ler em cada unidade. */
  medida.DECIMAIS_AUTO = { px: 0, mm: 1, cm: 2, pt: 1 };

  medida.PADRAO = {
    dimensao: 'auto',       // auto: paisagem -> largura; retrato ou quadrado -> altura
    unidade: 'px',
    decimais: 'auto',       // 'auto' ou 0 a 4
    separador: ',',
    mostrarPx: true,        // acrescenta "/ 300 px" quando a unidade nao e px
    posicao: 'inicio',      // inicio: topo/esquerda; centro; fim: base/direita
    tamanhoTexto: 10,       // pt
    fonte: 'ArialMT'        // nome PostScript
  };

  /* ---------------------------------------------------------------- *
   * Opcoes
   * ---------------------------------------------------------------- */

  /**
   * Completa com os padroes e recusa valor incoerente com mensagem.
   * Chave desconhecida e ignorada; valor vazio vira o padrao.
   */
  medida.normalizar = function (entrada) {
    var o = {};
    var k;
    for (k in medida.PADRAO) {
      if (!Object.prototype.hasOwnProperty.call(medida.PADRAO, k)) continue;
      var v = entrada ? entrada[k] : undefined;
      o[k] = v === undefined || v === null || v === '' ? medida.PADRAO[k] : v;
    }

    if (medida.DIMENSOES.indexOf(o.dimensao) === -1) {
      throw new Error('Dimensão desconhecida: "' + o.dimensao + '". Use auto, largura, altura ou ambas.');
    }
    if (medida.UNIDADES.indexOf(o.unidade) === -1) {
      throw new Error('Unidade desconhecida: "' + o.unidade + '". Use ' + medida.UNIDADES.join(', ') + '.');
    }
    if (o.decimais !== 'auto') {
      var d = Number(o.decimais);
      if (!isFinite(d) || d < 0 || d > 4 || Math.floor(d) !== d) {
        throw new Error('Casas decimais precisam ser "auto" ou um inteiro de 0 a 4.');
      }
      o.decimais = d;
    }
    if (o.separador !== ',' && o.separador !== '.') {
      throw new Error('Separador decimal precisa ser vírgula ou ponto.');
    }
    if (medida.POSICOES.indexOf(o.posicao) === -1) {
      throw new Error('Posição desconhecida: "' + o.posicao + '". Use inicio, centro ou fim.');
    }

    var t = typeof o.tamanhoTexto === 'number'
      ? o.tamanhoTexto
      : parseFloat(String(o.tamanhoTexto).replace(',', '.'));
    // 1296 pt e o maior corpo que o Photoshop aceita.
    if (!isFinite(t) || t < 1 || t > 1296) {
      throw new Error('O tamanho do texto precisa estar entre 1 e 1296 pt.');
    }
    o.tamanhoTexto = t;
    o.mostrarPx = o.mostrarPx === true || o.mostrarPx === 'true';
    o.fonte = String(o.fonte).trim() || medida.PADRAO.fonte;
    return o;
  };

  /* ---------------------------------------------------------------- *
   * Numeros e rotulo
   * ---------------------------------------------------------------- */

  /** Converte pixels do documento na unidade pedida. */
  medida.converter = function (px, unidade, resolucao) {
    if (unidade === 'px') return px;
    if (!isFinite(resolucao) || resolucao <= 0) throw new Error('Resolução do documento inválida.');
    if (unidade === 'mm') return px * 25.4 / resolucao;
    if (unidade === 'cm') return px * 2.54 / resolucao;
    if (unidade === 'pt') return px * 72 / resolucao;
    throw new Error('Unidade desconhecida: "' + unidade + '".');
  };

  /**
   * Numero com a quantidade de casas pedida e o separador escolhido.
   * Arredonda meio para cima sem o erro de ponto flutuante do toFixed
   * (0,35 com uma casa da 0,4, nao 0,3).
   * @param {boolean} fixo mantem zeros a direita (12,50); sem ele sai 12,5
   */
  medida.numero = function (valor, decimais, separador, fixo) {
    if (!isFinite(valor)) throw new Error('Valor inválido para formatar: ' + valor);
    var fator = Math.pow(10, decimais);
    var n = Math.round(Number((Math.abs(valor) * fator).toPrecision(12)));
    var inteiro = Math.floor(n / fator);
    var texto = String(inteiro);

    if (decimais > 0) {
      var frac = String(n - inteiro * fator);
      while (frac.length < decimais) frac = '0' + frac;
      if (!fixo) frac = frac.replace(/0+$/, '');
      if (frac.length) texto += (separador || ',') + frac;
    }
    return (valor < 0 && n !== 0 ? '-' : '') + texto;
  };

  function casas(o) {
    return o.decimais === 'auto' ? medida.DECIMAIS_AUTO[o.unidade] : o.decimais;
  }

  /** So o numero na unidade principal, sem o sufixo. */
  medida.valor = function (px, resolucao, opcoes) {
    return medida.numero(
      medida.converter(px, opcoes.unidade, resolucao),
      casas(opcoes), opcoes.separador, opcoes.decimais !== 'auto'
    );
  };

  /** Texto do rotulo: "16,9 mm / 200 px". */
  medida.rotulo = function (px, resolucao, opcoes) {
    var o = opcoes;
    var texto = medida.valor(px, resolucao, o) + ESPACO_UNIDADE + o.unidade;
    if (o.mostrarPx && o.unidade !== 'px') {
      texto += ' / ' + medida.numero(px, 0, o.separador, false) + ESPACO_UNIDADE + 'px';
    }
    return texto;
  };

  /* ---------------------------------------------------------------- *
   * Geometria
   * ---------------------------------------------------------------- */

  /** Quais medidas marcar. A regra automatica e a do Size Marks. */
  medida.eixos = function (largura, altura, dimensao) {
    if (dimensao === 'largura') return ['largura'];
    if (dimensao === 'altura') return ['altura'];
    if (dimensao === 'ambas') return ['largura', 'altura'];
    return largura > altura ? ['largura'] : ['altura'];
  };

  /**
   * Espessura, hastes e afastamento proporcionais a resolucao. Em 72 ppi da
   * o desenho do Size Marks (linha de 1 px, haste de 3 px para cada lado);
   * em 300 ppi a linha passa a ter 4 px em vez de sumir na impressao.
   */
  medida.metricas = function (resolucao) {
    if (!isFinite(resolucao) || resolucao <= 0) throw new Error('Resolução do documento inválida.');
    var escala = resolucao / 72;
    var espessura = Math.max(1, Math.round(escala));
    var haste = Math.max(espessura + 1, Math.round(3 * escala));
    return {
      espessura: espessura,
      haste: haste,                                            // meia altura da haste
      afastamento: haste + Math.max(2, Math.round(2 * escala)) // linha -> caixa do texto
    };
  };

  /**
   * Plano completo das marcas.
   * @param {{x, y, w, h}} caixa retangulo da selecao, em px
   * @param {number} resolucao ppi do documento
   * @param {object} opcoes ver medida.PADRAO
   * @returns {{caixa, eixos, retangulos, rotulos, nome, metricas, opcoes}}
   */
  medida.planejar = function (caixa, resolucao, opcoes) {
    var o = medida.normalizar(opcoes);
    if (!caixa) throw new Error('Não há seleção para medir.');

    // Selecao anti-serrilhada ou vinda de um tracado pode ter borda
    // fracionada: a cota fica no pixel inteiro mais proximo.
    var x1 = Math.round(caixa.x);
    var y1 = Math.round(caixa.y);
    var x2 = Math.round(caixa.x + caixa.w);
    var y2 = Math.round(caixa.y + caixa.h);
    if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) {
      throw new Error('A seleção tem uma coordenada inválida.');
    }
    if (x2 - x1 < 1 || y2 - y1 < 1) {
      throw new Error('A seleção precisa ter ao menos 1 px de largura e de altura.');
    }

    var w = x2 - x1;
    var h = y2 - y1;
    var m = medida.metricas(resolucao);
    var t = m.espessura;
    var eixos = medida.eixos(w, h, o.dimensao);
    var ambas = eixos.length === 2;
    var retangulos = [];
    var rotulos = [];

    // Linha horizontal (largura) e vertical (altura), dentro da selecao.
    var ly = o.posicao === 'inicio' ? y1 : o.posicao === 'fim' ? y2 - t : y1 + Math.floor((h - t) / 2);
    var lx = o.posicao === 'inicio' ? x1 : o.posicao === 'fim' ? x2 - t : x1 + Math.floor((w - t) / 2);

    // Com as duas linhas no centro elas se cruzam no meio; cada rotulo vai
    // para o meio de uma das metades para nao ficar em cima da outra linha.
    var cruzam = ambas && o.posicao === 'centro';

    if (eixos.indexOf('largura') > -1) {
      var hy1 = Math.floor(ly + t / 2 - m.haste);
      var hy2 = Math.ceil(ly + t / 2 + m.haste);
      retangulos.push([x1, ly, x2, ly + t]);
      retangulos.push([x1, hy1, x1 + t, hy2]);
      retangulos.push([x2 - t, hy1, x2, hy2]);
      rotulos.push({
        eixo: 'largura',
        px: w,
        texto: medida.rotulo(w, resolucao, o),
        alvo: {
          orientacao: 'h',
          centro: cruzam ? (x1 + lx) / 2 : (x1 + x2) / 2,
          antes: ly - m.afastamento,        // acima: a base do texto fica aqui
          depois: ly + t + m.afastamento,   // abaixo: o topo do texto fica aqui
          lado: o.posicao === 'fim' ? 'depois' : 'antes'
        }
      });
    }

    if (eixos.indexOf('altura') > -1) {
      var hx1 = Math.floor(lx + t / 2 - m.haste);
      var hx2 = Math.ceil(lx + t / 2 + m.haste);
      retangulos.push([lx, y1, lx + t, y2]);
      retangulos.push([hx1, y1, hx2, y1 + t]);
      retangulos.push([hx1, y2 - t, hx2, y2]);
      rotulos.push({
        eixo: 'altura',
        px: h,
        texto: medida.rotulo(h, resolucao, o),
        alvo: {
          orientacao: 'v',
          centro: cruzam ? (ly + t + y2) / 2 : (y1 + y2) / 2,
          antes: lx - m.afastamento,        // a esquerda: o fim do texto fica aqui
          depois: lx + t + m.afastamento,   // a direita: o inicio do texto fica aqui
          lado: o.posicao === 'inicio' ? 'antes' : 'depois'
        }
      });
    }

    return {
      caixa: { x: x1, y: y1, w: w, h: h },
      eixos: eixos,
      retangulos: retangulos,
      rotulos: rotulos,
      nome: medida.nome(w, h, eixos, resolucao, o),
      metricas: m,
      opcoes: o
    };
  };

  /** Nome do grupo no painel Camadas: "Medida L 120 px", "Medida 120 × 80 px". */
  medida.nome = function (largura, altura, eixos, resolucao, opcoes) {
    var u = ' ' + opcoes.unidade;
    if (eixos.length === 2) {
      return 'Medida ' + medida.valor(largura, resolucao, opcoes) + ' \u00D7 ' +
        medida.valor(altura, resolucao, opcoes) + u;
    }
    return eixos[0] === 'largura'
      ? 'Medida L ' + medida.valor(largura, resolucao, opcoes) + u
      : 'Medida A ' + medida.valor(altura, resolucao, opcoes) + u;
  };

  function limitar(v, minimo, maximo) {
    if (maximo < minimo) return minimo;
    return Math.max(minimo, Math.min(maximo, v));
  }

  /**
   * Onde a caixa do texto deve ficar, depois de medida no app.
   *
   * O rotulo vai para o lado pedido; se ali ele sairia da area visivel, vai
   * para o outro lado da linha. Ao longo da linha ele e empurrado para dentro
   * da area. Devolve o canto superior esquerdo, em pixel inteiro.
   *
   * @param {object} alvo o `alvo` de um rotulo do plano
   * @param {{w, h}} texto caixa do texto ja criado
   * @param {{x, y, w, h}} [tela] area visivel: a tela ou a prancheta. Sem x e y,
   *   comeca em 0. Sem tela, nada e ajustado.
   * @returns {{x, y, lado, virou}}
   */
  medida.encaixar = function (alvo, texto, tela) {
    var w = texto.w;
    var h = texto.h;
    var tx = tela && tela.x ? tela.x : 0;
    var ty = tela && tela.y ? tela.y : 0;

    function posicao(lado) {
      if (alvo.orientacao === 'h') {
        return { x: alvo.centro - w / 2, y: lado === 'antes' ? alvo.antes - h : alvo.depois };
      }
      return { x: lado === 'antes' ? alvo.antes - w : alvo.depois, y: alvo.centro - h / 2 };
    }

    function cabe(p) {
      if (!tela) return true;
      return alvo.orientacao === 'h'
        ? p.y >= ty && p.y + h <= ty + tela.h
        : p.x >= tx && p.x + w <= tx + tela.w;
    }

    var lado = alvo.lado;
    var p = posicao(lado);
    var virou = false;

    if (!cabe(p)) {
      var outro = lado === 'antes' ? 'depois' : 'antes';
      var q = posicao(outro);
      if (cabe(q)) {
        p = q;
        lado = outro;
        virou = true;
      }
    }

    if (tela) {
      if (alvo.orientacao === 'h') p.x = limitar(p.x, tx, tx + tela.w - w);
      else p.y = limitar(p.y, ty, ty + tela.h - h);
    }

    return { x: Math.round(p.x), y: Math.round(p.y), lado: lado, virou: virou };
  };

  IBD.medida = medida;
})($.global.IBD);
