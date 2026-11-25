/**
 * @ibd-id tracedraw/deslocamento-expandir-contorno
 * @ibd-titulo Gerar contorno deslocado e expandido
 * @ibd-descricao Gera caminho deslocado do PathData selecionado (cantos Mitra, Arredondado ou Chanfrado), limpa preenchimento e aplica traço técnico CMYK/RGB.
 * @ibd-app tracedraw
 * @ibd-versao 1.0.0
 * @ibd-tags offset, deslocamento, contorno, curva, tracedraw
 * @ibd-doc docs/ferramentas-vetor.md
 */
(function () {
  // === Parametros editaveis (painel Scripts nao possui caixas modais) ===
  var DESLOCAMENTO_MM = 2;      // Positivo = para fora | Negativo = para dentro
  var CANTOS = 'M';             // 'M' (Mitra), 'R' (Arredondado), 'C' (Chanfrado)
  var LIMITE_MITRA = 4;
  var ESPESSURA_PT = 1;         // Sera convertido automaticamente para mm no TraceDraw
  var COR_CMYK = [0, 100, 0, 0]; // [C, M, Y, K] de 0 a 100 (padrao Magenta corte)
  var MANTER_ORIGINAL = true;
  var PASSOS_CURVA = 16;
  // ======================================================================

  if (typeof ActiveDocument === 'undefined' || !ActiveDocument) {
    print('[IBD] Abra um documento no TraceDraw antes de executar.');
    return;
  }

  var sel = ActiveDocument.Selection;
  if (!sel || sel.Count === 0) {
    print('[IBD] Selecione pelo menos um objeto vetorial no TraceDraw.');
    return;
  }
  if (!DESLOCAMENTO_MM || isNaN(DESLOCAMENTO_MM)) {
    print('[IBD] Informe DESLOCAMENTO_MM diferente de zero.');
    return;
  }
  if (!(ESPESSURA_PT > 0)) {
    print('[IBD] ESPESSURA_PT deve ser maior que zero.');
    return;
  }

  function parsePathData(d) {
    var tokens = String(d || '').match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g);
    if (!tokens) return [];

    var subpaths = [];
    var atual = null;
    var cmd = '';
    var i = 0;
    var cx = 0, cy = 0;
    var sx = 0, sy = 0;
    var prevC2x = null, prevC2y = null;

    function num() { return parseFloat(tokens[i++]); }
    function hasNum() { return i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i]); }
    function novoSub(x, y) {
      atual = { pts: [{ x: x, y: y }], closed: false };
      subpaths.push(atual);
      sx = x; sy = y;
    }
    function pushPt(x, y) {
      if (!atual) novoSub(x, y);
      var ult = atual.pts[atual.pts.length - 1];
      if (!ult || Math.hypot(x - ult.x, y - ult.y) > 1e-4) {
        atual.pts.push({ x: x, y: y });
      }
    }
    function addCubic(x0, y0, x1, y1, x2, y2, x3, y3) {
      var lin = Math.hypot(x1 - x0, y1 - y0) < 1e-4 && Math.hypot(x2 - x3, y2 - y3) < 1e-4;
      var steps = lin ? 1 : PASSOS_CURVA;
      for (var s = 1; s <= steps; s++) {
        var t = s / steps;
        var u = 1 - t;
        var px = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
        var py = u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
        pushPt(px, py);
      }
    }
    function addQuad(x0, y0, qx, qy, x2, y2) {
      addCubic(
        x0, y0,
        x0 + (2 / 3) * (qx - x0), y0 + (2 / 3) * (qy - y0),
        x2 + (2 / 3) * (qx - x2), y2 + (2 / 3) * (qy - y2),
        x2, y2
      );
    }

    while (i < tokens.length) {
      if (/^[a-zA-Z]$/.test(tokens[i])) cmd = tokens[i++];
      var rel = cmd >= 'a' && cmd <= 'z';
      var upper = cmd.toUpperCase();

      if (upper === 'Z') {
        if (atual) atual.closed = true;
        cx = sx; cy = sy;
        prevC2x = null; prevC2y = null;
        continue;
      }

      if (upper === 'M') {
        var mx = num() + (rel ? cx : 0);
        var my = num() + (rel ? cy : 0);
        cx = mx; cy = my;
        novoSub(mx, my);
        prevC2x = null; prevC2y = null;
        cmd = rel ? 'l' : 'L';
        while (hasNum()) {
          var lx = num() + (rel ? cx : 0);
          var ly = num() + (rel ? cy : 0);
          cx = lx; cy = ly;
          pushPt(cx, cy);
        }
      } else if (upper === 'L') {
        while (hasNum()) {
          cx = num() + (rel ? cx : 0);
          cy = num() + (rel ? cy : 0);
          pushPt(cx, cy);
        }
        prevC2x = null; prevC2y = null;
      } else if (upper === 'H') {
        while (hasNum()) {
          cx = num() + (rel ? cx : 0);
          pushPt(cx, cy);
        }
        prevC2x = null; prevC2y = null;
      } else if (upper === 'V') {
        while (hasNum()) {
          cy = num() + (rel ? cy : 0);
          pushPt(cx, cy);
        }
        prevC2x = null; prevC2y = null;
      } else if (upper === 'C') {
        while (hasNum()) {
          var x1 = num() + (rel ? cx : 0), y1 = num() + (rel ? cy : 0);
          var x2 = num() + (rel ? cx : 0), y2 = num() + (rel ? cy : 0);
          var x3 = num() + (rel ? cx : 0), y3 = num() + (rel ? cy : 0);
          addCubic(cx, cy, x1, y1, x2, y2, x3, y3);
          cx = x3; cy = y3;
          prevC2x = x2; prevC2y = y2;
        }
      } else if (upper === 'S') {
        while (hasNum()) {
          var sx1 = prevC2x !== null ? (2 * cx - prevC2x) : cx;
          var sy1 = prevC2y !== null ? (2 * cy - prevC2y) : cy;
          var sx2 = num() + (rel ? cx : 0), sy2 = num() + (rel ? cy : 0);
          var sx3 = num() + (rel ? cx : 0), sy3 = num() + (rel ? cy : 0);
          addCubic(cx, cy, sx1, sy1, sx2, sy2, sx3, sy3);
          cx = sx3; cy = sy3;
          prevC2x = sx2; prevC2y = sy2;
        }
      } else if (upper === 'Q') {
        while (hasNum()) {
          var qx = num() + (rel ? cx : 0), qy = num() + (rel ? cy : 0);
          var qex = num() + (rel ? cx : 0), qey = num() + (rel ? cy : 0);
          addQuad(cx, cy, qx, qy, qex, qey);
          cx = qex; cy = qey;
          prevC2x = qx; prevC2y = qy;
        }
      } else {
        while (hasNum()) num();
        prevC2x = null; prevC2y = null;
      }
    }

    return subpaths;
  }

  function areaAssinada(pts) {
    var a = 0;
    for (var i = 0; i < pts.length; i++) {
      var p1 = pts[i], p2 = pts[(i + 1) % pts.length];
      a += p1.x * p2.y - p2.x * p1.y;
    }
    return a * 0.5;
  }

  function deslocarSubpath(sub, dist, canto, mlim) {
    var pts = sub.pts.slice();
    if (sub.closed && pts.length > 1) {
      var prim = pts[0], ult = pts[pts.length - 1];
      if (Math.hypot(prim.x - ult.x, prim.y - ult.y) < 1e-4) pts.pop();
    }
    if (pts.length < (sub.closed ? 3 : 2)) return null;

    var dir = (sub.closed && areaAssinada(pts) < 0) ? -1 : 1;
    var d = dist * dir;
    var n = pts.length;
    var segs = [];

    for (var i = 0; i < (sub.closed ? n : n - 1); i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      var dx = b.x - a.x, dy = b.y - a.y;
      var len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      // Normal externa em coordenadas Y-para-cima com dir=+1 para poligono anti-horario
      var nx = (dy / len) * d;
      var ny = (-dx / len) * d;
      segs.push({ ax: a.x + nx, ay: a.y + ny, bx: b.x + nx, by: b.y + ny, ux: dx / len, uy: dy / len, ox: a.x, oy: a.y });
    }
    if (segs.length === 0) return null;

    var saida = [];
    if (!sub.closed) saida.push({ x: segs[0].ax, y: segs[0].ay });

    var total = segs.length;
    for (var j = (sub.closed ? 0 : 1); j < total; j++) {
      var sPrev = segs[(j - 1 + total) % total];
      var sCurr = segs[j];
      var denom = sPrev.ux * sCurr.uy - sPrev.uy * sCurr.ux;
      var px = sCurr.ox, py = sCurr.oy;

      if (Math.abs(denom) < 1e-5) {
        saida.push({ x: sCurr.ax, y: sCurr.ay });
        continue;
      }

      var rx = sCurr.ax - sPrev.ax;
      var ry = sCurr.ay - sPrev.ay;
      var t = (rx * sCurr.uy - ry * sCurr.ux) / denom;
      var ix = sPrev.ax + t * sPrev.ux;
      var iy = sPrev.ay + t * sPrev.uy;
      var distMitra = Math.hypot(ix - px, iy - py);
      var convexo = (denom * d) > 0;

      if (convexo && canto === 'R') {
        var a1 = Math.atan2(sPrev.by - py, sPrev.bx - px);
        var a2 = Math.atan2(sCurr.ay - py, sCurr.ax - px);
        var diff = a2 - a1;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        var passos = Math.max(2, Math.min(8, Math.ceil(Math.abs(diff) / (Math.PI / 12))));
        for (var k = 0; k <= passos; k++) {
          var ang = a1 + (diff * k) / passos;
          saida.push({ x: px + Math.cos(ang) * Math.abs(dist), y: py + Math.sin(ang) * Math.abs(dist) });
        }
      } else if (convexo && (canto === 'C' || distMitra > Math.abs(dist) * mlim)) {
        saida.push({ x: sPrev.bx, y: sPrev.by });
        saida.push({ x: sCurr.ax, y: sCurr.ay });
      } else {
        saida.push({ x: ix, y: iy });
      }
    }

    if (!sub.closed) {
      var ultSeg = segs[segs.length - 1];
      saida.push({ x: ultSeg.bx, y: ultSeg.by });
    }
    return { pts: saida, closed: sub.closed };
  }

  function paraSvg(subpathsDeslocados) {
    var partes = [];
    for (var s = 0; s < subpathsDeslocados.length; s++) {
      var sp = subpathsDeslocados[s];
      if (!sp.pts.length) continue;
      partes.push('M ' + sp.pts[0].x.toFixed(4) + ' ' + sp.pts[0].y.toFixed(4));
      for (var p = 1; p < sp.pts.length; p++) {
        partes.push('L ' + sp.pts[p].x.toFixed(4) + ' ' + sp.pts[p].y.toFixed(4));
      }
      if (sp.closed) partes.push('Z');
    }
    return partes.join(' ');
  }

  function coletarFolhas(shape, destino) {
    if (shape.Type === 'group' && shape.Children && shape.Children.length) {
      for (var c = 0; c < shape.Children.length; c++) {
        coletarFolhas(shape.Children[c], destino);
      }
    } else {
      destino.push(shape);
    }
  }

  var originais = [];
  var folhas = [];
  sel.forEach(function (item) {
    originais.push(item);
    coletarFolhas(item, folhas);
  });

  var espessuraMm = ESPESSURA_PT * (25.4 / 72);
  var cor = Color.CMYK(COR_CMYK[0] || 0, COR_CMYK[1] || 0, COR_CMYK[2] || 0, COR_CMYK[3] || 0);
  var criados = [];
  var ignorados = 0;

  for (var f = 0; f < folhas.length; f++) {
    var dStr = '';
    try { dStr = folhas[f].PathData; } catch (ePath) { dStr = ''; }
    if (!dStr) { ignorados++; continue; }

    var subs = parsePathData(dStr);
    var novosSubs = [];
    for (var k = 0; k < subs.length; k++) {
      var res = deslocarSubpath(subs[k], DESLOCAMENTO_MM, CANTOS, LIMITE_MITRA);
      if (res && res.pts.length >= 2) novosSubs.push(res);
    }

    if (!novosSubs.length) { ignorados++; continue; }
    var novoSvg = paraSvg(novosSubs);
    var contorno = ActiveLayer.CreatePath(novoSvg);
    contorno.Name = (folhas[f].Name || 'Objeto') + ' (Contorno ' + DESLOCAMENTO_MM + 'mm)';
    contorno.Fill.ApplyNoFill();
    contorno.Outline.SetProperties(espessuraMm, cor);
    criados.push(contorno);
  }

  if (!MANTER_ORIGINAL && criados.length > 0) {
    for (var o = 0; o < originais.length; o++) {
      originais[o].Delete();
    }
  }

  if (criados.length === 0) {
    print('[IBD] Nenhuma forma gerou contorno valido (verifique se a selecao possui caminhos vetoriais ou reduza o recuo negativo).');
  } else {
    if (typeof ShapeRange !== 'undefined') {
      new ShapeRange(criados.map(function (c) { return c.id; })).CreateSelection();
    }
    print('[IBD] Contorno de ' + DESLOCAMENTO_MM + ' mm criado para ' + criados.length + ' objeto(s).' +
      (ignorados > 0 ? ' Ignorados: ' + ignorados + '.' : ''));
  }
})();
