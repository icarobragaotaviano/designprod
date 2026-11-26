/* Geometria da montagem Illustrator. Tudo em mm, a partir do canto superior esquerdo. */
(function (root) {
  'use strict';
  var PT = 72 / 25.4;
  var indiceBorda = { left: 0, top: 1, right: 2, bottom: 3 };
  var oposto = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
  var patches = [
    [100, 0, 0, 0], [0, 100, 0, 0], [0, 0, 100, 0], [0, 0, 0, 100],
    [50, 0, 0, 0], [0, 50, 0, 0], [0, 0, 50, 0], [0, 0, 0, 50],
    [0, 100, 100, 0], [100, 0, 100, 0], [100, 100, 0, 0], [100, 100, 100, 0],
    [50, 40, 40, 0], [50, 40, 40, 100]
  ];

  function calcular(valores, maquina) {
    var sangria = valores.bleed;
    var sobra = maquina.compartilhado ? sangria : 0;
    var margens = { top: maquina.margem, bottom: maquina.margem, left: maquina.margem, right: maquina.margem };
    if (maquina.barra) {
      var borda = maquina.pincaLado === 'top' ? 'bottom' : 'top';
      margens[borda] = Math.max(margens[borda], maquina.patchH + 3);
    }
    margens[maquina.pincaLado] += maquina.pinca;
    var folga = maquina.compartilhado ? 0 : maquina.folga || 0;
    var parametros = Object.assign({}, valores, {
      bleed: maquina.compartilhado ? 0 : sangria,
      left: margens.left + sobra, right: margens.right + sobra,
      tail: margens.top + sobra, grip: margens.bottom + sobra, bar: 0,
      gapX: folga, gapY: folga, allowMixed: !maquina.compartilhado
    });
    if (maquina.compartilhado && parametros.orientation === 'mixed') {
      throw Error('Para corte simples, escolha uma grade uniforme em 0° ou 90°.');
    }
    var plano = root.FolhaOperacoes.executar({ versaoContrato: 1, operacao: 'montar-pecas', parametros: parametros });
    return { plano: plano, maquina: { pincaLado: maquina.pincaLado, pinca: maquina.pinca },
      sangria: sangria, compartilhado: maquina.compartilhado };
  }

  function importar(plano) {
    return { plano: plano, maquina: { pincaLado: 'bottom', pinca: plano.parametros.grip },
      sangria: plano.parametros.bleed, compartilhado: false };
  }

  function caixa(x1, y1, x2, y2) { return [x1, y1, x2, y2]; }

  function limites(itens, sangria) {
    return itens.reduce(function (b, p) {
      return caixa(Math.min(b[0], p.x - sangria), Math.min(b[1], p.y - sangria),
        Math.max(b[2], p.x + p.w + sangria), Math.max(b[3], p.y + p.h + sangria));
    }, caixa(Infinity, Infinity, -Infinity, -Infinity));
  }

  function imprimirEm(s, maquina) {
    var b = caixa(0, 0, s.sw, s.sh);
    var indice = indiceBorda[maquina.pincaLado];
    b[indice] += indice < 2 ? maquina.pinca : -maquina.pinca;
    return b;
  }

  function sobrepoe(a, b) {
    return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  }

  function coordenadas(itens, eixo, dimensao) {
    var medidas = [];
    itens.forEach(function (p) { medidas.push(p[eixo], p[eixo] + p[dimensao]); });
    return medidas.sort(function (a, b) { return a - b; }).filter(function (v, i) {
      return !i || v - medidas[i - 1] > 0.00001;
    });
  }

  function tecnicas(montagem, opcoes) {
    var plano = montagem.plano, s = plano.parametros, itens = plano.faces[0].items;
    var trim = limites(itens, 0), arte = limites(itens, montagem.sangria);
    var area = imprimirEm(s, montagem.maquina);
    var stroke = opcoes.stroke;
    var folga = stroke / (2 * PT) + 0.00001;
    var offset = Math.max(opcoes.offset, montagem.sangria + folga);
    var compr = opcoes.comprimento;
    var ocupados = [arte], linhas = [], miras = [], escala = [], avisos = [], os = [];
    if (offset > opcoes.offset + 0.0001) avisos.push('Afastamento das marcas ajustado para ' + offset.toFixed(2) + ' mm pela sangria.');

    function reservar(b, pad) {
      var c = caixa(b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad);
      if (c[0] < area[0] || c[1] < area[1] || c[2] > area[2] || c[3] > area[3] ||
          ocupados.some(function (outra) { return sobrepoe(c, outra); })) return false;
      ocupados.push(c);
      return true;
    }

    function linha(x1, y1, x2, y2) {
      if (reservar(caixa(x1, y1, x2, y2), folga)) {
        linhas.push([x1, y1, x2, y2]);
        return true;
      }
      return false;
    }

    var faltantes = 0;
    coordenadas(itens, 'x', 'w').forEach(function (x) {
      var cima = linha(x, trim[1] - offset - compr, x, trim[1] - offset);
      var baixo = linha(x, trim[3] + offset, x, trim[3] + offset + compr);
      if (!cima && !baixo) faltantes += 1;
    });
    coordenadas(itens, 'y', 'h').forEach(function (y) {
      var esquerda = linha(trim[0] - offset - compr, y, trim[0] - offset, y);
      var direita = linha(trim[2] + offset, y, trim[2] + offset + compr, y);
      if (!esquerda && !direita) faltantes += 1;
    });
    if (faltantes) avisos.push(faltantes + ' posição(ões) de corte sem marca. Aumente a margem livre ou reduza o comprimento.');

    function faixas(largura, altura) {
      var x = (area[0] + area[2] - largura) / 2;
      var candidatas = {
        top: caixa(x, area[1] + 1, x + largura, area[1] + 1 + altura),
        bottom: caixa(x, area[3] - 1 - altura, x + largura, area[3] - 1)
      };
      var primeira = oposto[montagem.maquina.pincaLado];
      return primeira === 'bottom' ? [candidatas.bottom, candidatas.top] : [candidatas.top, candidatas.bottom];
    }

    if (opcoes.barra) {
      var faixa = faixas(opcoes.patchW * patches.length, opcoes.patchH)
        .find(function (b) { return reservar(b, 0.1); });
      if (faixa) {
        escala = patches.map(function (cmyk, i) {
          return [faixa[0] + i * opcoes.patchW, faixa[1], opcoes.patchW, opcoes.patchH].concat(cmyk);
        });
      } else avisos.push('A barra CMYK não cabe na margem imprimível disponível.');
    }

    if (opcoes.os) {
      var largura = Math.min(area[2] - area[0] - 2, Math.max(30, opcoes.os.length * 1.8));
      if (largura > 0) {
        var faixasOS = faixas(largura, 4);
        var locais = faixasOS.concat(faixasOS.map(function (b) { return caixa(area[0] + 1, b[1], area[0] + 1 + largura, b[3]); }),
          faixasOS.map(function (b) { return caixa(area[2] - 1 - largura, b[1], area[2] - 1, b[3]); }));
        os = locais.find(function (b) { return reservar(b, 0.1); }) || [];
      }
      if (!os.length) avisos.push('A identificação da OS não cabe na margem livre.');
    }

    if (opcoes.registro) {
      var raio = 2.5, alcance = raio * 1.6, margem = alcance + folga + 0.25;
      var centroX = (area[0] + area[2]) / 2, centroY = (area[1] + area[3]) / 2;
      var esq = area[0] + margem, dir = area[2] - margem, topo = area[1] + margem, base = area[3] - margem;
      var candidatos = [
        [[centroX, topo], [esq, topo], [dir, topo]],
        [[centroX, base], [dir, base], [esq, base]],
        [[esq, centroY], [esq, topo], [esq, base]],
        [[dir, centroY], [dir, base], [dir, topo]]
      ];
      candidatos.forEach(function (lista) {
        var p = lista.find(function (c) {
          return reservar(caixa(c[0] - alcance, c[1] - alcance, c[0] + alcance, c[1] + alcance), folga);
        });
        if (p) miras.push(p.concat(raio));
      });
      if (miras.length < 4) avisos.push(miras.length + ' de 4 miras de registro couberam nas margens livres.');
    }
    return { trim: trim, arte: arte, area: area, linhas: linhas, miras: miras, escala: escala,
      os: os, avisos: avisos, faltantes: faltantes };
  }

  function codificar(plano, copiar) {
    var s = plano.parametros;
    var texto = [[1, s.sw, s.sh, s.bleed, copiar ? 1 : 0, plano.faces.length].join(',')];
    plano.faces.forEach(function (face) {
      texto.push(face.items.map(function (p) { return [p.x, p.y, p.w, p.h, p.angle].join(','); }).join(';'));
    });
    return texto.join('|');
  }

  function codificarTecnicas(m, t, o, vincular) {
    return [[m.sangria, m.compartilhado ? 1 : 0, o.stroke, vincular ? 1 : 0, o.arteSangrada ? 1 : 0].join(','),
      t.trim.join(','), t.linhas.join(';'), t.miras.join(';'), t.escala.join(';'), t.os.join(',')].join('|');
  }

  root.IBDFolhaProducao = { calcular: calcular, importar: importar, limites: limites, imprimirEm: imprimirEm,
    tecnicas: tecnicas, codificar: codificar, codificarTecnicas: codificarTecnicas };
})(typeof globalThis !== 'undefined' ? globalThis : this);
