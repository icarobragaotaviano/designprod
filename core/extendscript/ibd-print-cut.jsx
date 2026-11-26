/* Geometria Print & Cut em mm, com origem no topo esquerdo e Y para baixo. */
#include "../../nobel/imposicao/grade.js"

var IBDPrintCut = (function () {
  var tolerancia = 0.025;
  var unidadesPorMm = 40;

  function planejar(o, arte, faca) {
    var marca = o.marca !== 'nenhuma';
    var meiaLinha = o.marca === 'l' ? (1.8 / imposicaoPt) / 2 : 0;
    var reserva = marca ? o.recuo + o.tamanho + o.respiro + meiaLinha : 0;
    var margem = Math.max(o.margem, reserva);
    var grade = imposicaoGrade({
      largura: o.largura, altura: o.altura, margem: margem, espaco: o.espaco,
      quantidade: 0, colunas: o.colunas, linhas: o.linhas, marcas: 0
    }, arte, faca);
    var raio = imposicaoTraco / 2;
    var esquerda = Math.min(arte[0], faca[0] - raio);
    var topo = Math.min(arte[1], faca[1] - raio);
    var direita = Math.max(arte[2], faca[2] + raio);
    var base = Math.max(arte[3], faca[3] + raio);
    var ultima = grade.posicoes[grade.posicoes.length - 1];
    var primeira = grade.posicoes[0];
    var folgaX = (o.largura - (ultima[0] + direita - primeira[0] - esquerda)) / 2 - margem;
    var folgaY = (o.altura - (ultima[1] + base - primeira[1] - topo)) / 2 - margem;
    for (var i = 0; i < grade.posicoes.length; i++) {
      grade.posicoes[i][0] += folgaX;
      grade.posicoes[i][1] += folgaY;
    }
    var marcas = [];
    if (marca) {
      for (var y = 0; y < 2; y++) for (var x = 0; x < 2; x++) {
        var vx = x ? o.largura - o.recuo : o.recuo;
        var vy = y ? o.altura - o.recuo : o.recuo;
        var dx = (x ? -1 : 1) * o.tamanho;
        var dy = (y ? -1 : 1) * o.tamanho;
        var pontos = [[vx + dx, vy], [vx, vy], [vx, vy + dy]];
        if (o.marca === 'quadrado') pontos.push([vx + dx, vy + dy]);
        else if (o.marca === 'circulo') pontos = [[vx + dx / 2, vy + dy / 2]];
        marcas.push(pontos);
      }
    }
    return { posicoes: grade.posicoes, marcas: marcas, margem: margem };
  }

  function reta(p) {
    return { anchor: p, left: p, right: p };
  }

  function retangulo(b) {
    var p = imposicaoVertices(b);
    return [reta(p[0]), reta(p[1]), reta(p[2]), reta(p[3])];
  }

  function distancia2(a, b) {
    var x = a[0] - b[0], y = a[1] - b[1];
    return x * x + y * y;
  }

  function afastamento2(p, a, b) {
    var d = distancia2(a, b);
    if (!d) return distancia2(p, a);
    var t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / d;
    t = Math.max(0, Math.min(1, t));
    return distancia2(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
  }

  function meio(a, b) {
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  }

  function dividir(a, b, c, d, pontos, nivel) {
    if (pontos.length >= 50000 || nivel > 16) throw Error('Curva complexa demais para exportar nesta tolerância.');
    if (Math.max(afastamento2(b, a, d), afastamento2(c, a, d)) <= tolerancia * tolerancia) {
      pontos.push(d);
      return;
    }
    var ab = meio(a, b), bc = meio(b, c), cd = meio(c, d);
    var abc = meio(ab, bc), bcd = meio(bc, cd), m = meio(abc, bcd);
    dividir(a, ab, abc, m, pontos, nivel + 1);
    dividir(m, bcd, cd, d, pontos, nivel + 1);
  }

  function polilinha(nos) {
    if (nos.length < 2) throw Error('O contorno da faca tem poucos nós.');
    var pontos = [nos[0].anchor];
    for (var i = 0; i < nos.length; i++) {
      var a = nos[i], b = nos[(i + 1) % nos.length];
      dividir(a.anchor, a.right, b.left, b.anchor, pontos, 0);
    }
    return pontos;
  }

  function plt(curvas, posicoes, o) {
    var linhas = ['IN;', 'SP1;', 'PA;'];
    var optico = o.origem === 'marca';
    var origem = optico ? o.recuo : 0;
    if (optico && o.marca === 'circulo') origem += o.tamanho / 2;
    for (var i = 0; i < posicoes.length; i++) for (var j = 0; j < curvas.length; j++) {
      var dx = posicoes[i][0], dy = posicoes[i][1], ultima, inicio, n = 0;
      var p;
      for (var k = 0; k < curvas[j].length; k++) {
        if (linhas.length > 1000000) throw Error('A saída PLT excede um milhão de comandos. Reduza a grade ou simplifique a faca.');
        p = curvas[j][k];
        var x = p[0] + dx - origem;
        var y = optico ? p[1] + dy - origem : o.altura - p[1] - dy;
        if (!isFinite(x) || !isFinite(y) || x < -0.0001 || y < -0.0001 ||
            p[0] + dx > o.largura + 0.0001 || p[1] + dy > o.altura + 0.0001) {
          throw Error('A faca ultrapassa a folha ou a origem escolhida para o PLT.');
        }
        var coord = Math.round(x * unidadesPorMm) + ',' + Math.round(y * unidadesPorMm);
        if (k === 0) inicio = coord;
        if (coord === ultima) continue;
        linhas.push((n++ ? 'PD' : 'PU') + coord + ';');
        ultima = coord;
      }
      if (n < 4 || ultima !== inicio) throw Error('A faca colapsa na resolução da plotter ou não está fechada.');
      linhas.push('PU;');
    }
    linhas.push('SP0;');
    return linhas.join('\n') + '\n';
  }

  return { planejar: planejar, retangulo: retangulo, polilinha: polilinha, plt: plt };
}());
