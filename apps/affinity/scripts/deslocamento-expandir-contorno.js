/**
 * @ibd-id affinity/deslocamento-expandir-contorno
 * @ibd-titulo Deslocamento e contorno vetorial
 * @ibd-descricao Cria caminho deslocado sem preenchimento e com contorno tecnico no Affinity (SDK Beta 3.3+: exato em retangulos/elipses e poligonal em curvas).
 * @ibd-app affinity
 * @ibd-versao 1.0.0
 * @ibd-tags offset, deslocamento, contorno, curva, affinity
 * @ibd-doc docs/ferramentas-vetor.md
 */
'use strict';

const { Document } = require('/document.js');
const { AddChildNodesCommandBuilder, NodeChildType } = require('/commands.js');
const { Dialog, DialogResult } = require('/dialog.js');
const { Curve, CurveBuilder, PolyCurve, Rectangle } = require('/geometry.js');
const { PolyCurveNodeDefinition } = require('/nodes.js');
const { FillDescriptor, BlendMode } = require('/fills.js');
const { RGBA8 } = require('/colours.js');
const { LineStyle, LineStyleDescriptor, LineCap, LineJoin, LineType, StrokeAlignment } = require('/linestyle.js');
const { Selection } = require('/selections.js');
const { UnitType } = require('/units.js');

const doc = Document.current;
if (!doc) {
  console.log('[IBD] Abra um documento no Affinity antes de executar.');
} else if (!doc.selection || doc.selection.length === 0) {
  console.log('[IBD] Selecione pelo menos uma forma ou curva vetorial.');
} else {
  const dpi = doc.dpi || 96;
  const conv = doc.unitValueConverter;
  const mmToPx = conv.getConversionFactor(UnitType.Millimetre, UnitType.Pixel);

  const CANTOS = ['Mitra (reto)', 'Arredondado', 'Chanfrado'];
  const CORES = [
    { nome: 'Magenta corte', rgba: [230, 0, 126] },
    { nome: 'Vermelho',      rgba: [220, 30, 30] },
    { nome: 'Ciano',         rgba: [0, 160, 230] },
    { nome: 'Preto',         rgba: [20, 20, 20] }
  ];

  const dlg = Dialog.create('IBD — Deslocamento e Contorno (Affinity Beta)');
  dlg.initialWidth = 420;
  const col = dlg.addColumn();

  const grpAviso = col.addGroup('Nota SDK Beta 3.3+');
  const notaSdk = grpAviso.addStaticText(
    'Nota',
    'A API Beta nao expoe Contour Tool nem Expand Stroke; retangulos/elipses sao exatos e curvas usam amostragem poligonal.'
  );
  notaSdk.isFullWidth = true;

  const grp = col.addGroup('Parametros');
  const editOffset = grp.addUnitValueEditor('Deslocamento (+ / -)', UnitType.Pixel, UnitType.Millimetre, 2 * mmToPx, -500 * mmToPx, 500 * mmToPx);
  editOffset.value = 2 * mmToPx;
  const cbCanto = grp.addComboBox('Cantos', CANTOS, 0);
  const editMitra = grp.addTextBox('Limite de mitra', '4');
  const editStroke = grp.addUnitValueEditor('Espessura contorno', UnitType.Point, UnitType.Point, 1, 0.1, 200);
  editStroke.value = 1;
  const cbCor = grp.addComboBox('Cor do contorno', CORES.map((c) => c.nome), 0);
  const chkManter = grp.addCheckBox('Manter objeto original', true);
  const chkUnificar = grp.addCheckBox('Unificar resultados (Union)', false);

  function extrairPontosBezier(curve) {
    const beziers = curve.beziers;
    const pts = [];
    if (!beziers || beziers.length === 0) return pts;
    const EPS = 1e-4;
    for (let i = 0; i < beziers.length; i++) {
      const bz = beziers[i];
      const d1 = Math.hypot(bz.c1.x - bz.start.x, bz.c1.y - bz.start.y);
      const d2 = Math.hypot(bz.c2.x - bz.end.x, bz.c2.y - bz.end.y);
      const linear = d1 < EPS && d2 < EPS;
      const passos = linear ? 1 : 16;
      const inicio = (i === 0) ? 0 : 1;
      for (let s = inicio; s <= passos; s++) {
        const pt = bz.evaluate(s / passos);
        if (pts.length === 0 || Math.hypot(pt.x - pts[pts.length - 1].x, pt.y - pts[pts.length - 1].y) > 1e-3) {
          pts.push({ x: pt.x, y: pt.y });
        }
      }
    }
    if (curve.isClosed && pts.length > 1) {
      const f = pts[0], l = pts[pts.length - 1];
      if (Math.hypot(f.x - l.x, f.y - l.y) < 1e-3) pts.pop();
    }
    return pts;
  }

  function areaAssinada(pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      a += p1.x * p2.y - p2.x * p1.y;
    }
    return a * 0.5;
  }

  function deslocarPoligono(pts, dist, fechado, modoCanto, mlim) {
    if (pts.length < (fechado ? 3 : 2)) return null;
    const dir = (fechado && areaAssinada(pts) < 0) ? -1 : 1; // Normal para fora independente do sentido horario/anti-horario
    const n = pts.length;
    const d = dist * dir;
    const segs = [];

    for (let i = 0; i < (fechado ? n : n - 1); i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      // Normal externa em coordenadas Y-para-baixo com dir=+1 para sentido horario (areaAssinada > 0)
      const nx = (dy / len) * d;
      const ny = (-dx / len) * d;
      segs.push({ ax: a.x + nx, ay: a.y + ny, bx: b.x + nx, by: b.y + ny, ux: dx / len, uy: dy / len, nx: nx, ny: ny, ox: a.x, oy: a.y });
    }
    if (segs.length === 0) return null;

    const saida = [];
    if (!fechado) {
      saida.push({ x: segs[0].ax, y: segs[0].ay });
    }

    const total = segs.length;
    for (let i = (fechado ? 0 : 1); i < total; i++) {
      const sPrev = segs[(i - 1 + total) % total];
      const sCurr = segs[i];
      const denom = sPrev.ux * sCurr.uy - sPrev.uy * sCurr.ux;
      const px = sCurr.ox;
      const py = sCurr.oy;

      if (Math.abs(denom) < 1e-5) {
        saida.push({ x: sCurr.ax, y: sCurr.ay });
        continue;
      }

      const rx = sCurr.ax - sPrev.ax;
      const ry = sCurr.ay - sPrev.ay;
      const t = (rx * sCurr.uy - ry * sCurr.ux) / denom;
      const ix = sPrev.ax + t * sPrev.ux;
      const iy = sPrev.ay + t * sPrev.uy;
      const distMitra = Math.hypot(ix - px, iy - py);
      const cantoExternoConvexo = (denom * d) > 0;

      if (cantoExternoConvexo && modoCanto === 'Arredondado') {
        const a1 = Math.atan2(sPrev.by - py, sPrev.bx - px);
        const a2 = Math.atan2(sCurr.ay - py, sCurr.ax - px);
        let diff = a2 - a1;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        const passos = Math.max(2, Math.min(8, Math.ceil(Math.abs(diff) / (Math.PI / 12))));
        for (let k = 0; k <= passos; k++) {
          const ang = a1 + (diff * k) / passos;
          saida.push({ x: px + Math.cos(ang) * Math.abs(dist), y: py + Math.sin(ang) * Math.abs(dist) });
        }
      } else if (cantoExternoConvexo && (modoCanto === 'Chanfrado' || distMitra > Math.abs(dist) * mlim)) {
        saida.push({ x: sPrev.bx, y: sPrev.by });
        saida.push({ x: sCurr.ax, y: sCurr.ay });
      } else {
        saida.push({ x: ix, y: iy });
      }
    }

    if (!fechado) {
      const ult = segs[segs.length - 1];
      saida.push({ x: ult.bx, y: ult.by });
    }
    return saida;
  }

  function construirCurvaDeslocada(node, offsetPx, modoCanto, mlim) {
    const polyOrig = node.polyCurve;
    if (!polyOrig || polyOrig.curveCount === 0) return null;

    const polyNova = PolyCurve.create();
    const xf = node.transformInterface ? node.transformInterface.transform : null;

    for (let i = 0; i < polyOrig.curveCount; i++) {
      const cRaw = polyOrig.at(i);
      const c = cRaw;
      if (c.isRectangle) {
        const box = c.getBoundingBox(xf);
        const nw = box.width + 2 * offsetPx;
        const nh = box.height + 2 * offsetPx;
        if (nw > 0 && nh > 0) {
          polyNova.addCurve(Curve.createRectangle(new Rectangle(box.x - offsetPx, box.y - offsetPx, nw, nh)));
        }
        continue;
      }
      if (c.isEllipse) {
        const box = c.getBoundingBox(xf);
        const nw = box.width + 2 * offsetPx;
        const nh = box.height + 2 * offsetPx;
        if (nw > 0 && nh > 0) {
          polyNova.addCurve(Curve.createEllipse(new Rectangle(box.x - offsetPx, box.y - offsetPx, nw, nh)));
        }
        continue;
      }

      if (xf && typeof c.transform === 'function') c.transform(xf);
      const pts = extrairPontosBezier(c);
      const deslocados = deslocarPoligono(pts, offsetPx, c.isClosed, modoCanto, mlim);
      if (!deslocados || deslocados.length < 2) continue;

      const cb = CurveBuilder.create().beginXY(deslocados[0].x, deslocados[0].y);
      for (let p = 1; p < deslocados.length; p++) {
        cb.lineToXY(deslocados[p].x, deslocados[p].y);
      }
      if (c.isClosed) cb.close();
      polyNova.addCurve(cb.createCurve());
    }

    return polyNova.curveCount > 0 ? polyNova : null;
  }

  if (dlg.runModal() === DialogResult.Ok) {
    const offsetPx = editOffset.value;
    const modoCanto = CANTOS[cbCanto.selectedIndex] || 'Mitra (reto)';
    const mlimRaw = parseFloat(String(editMitra.text).replace(',', '.'));
    const mlim = (isNaN(mlimRaw) || mlimRaw < 1) ? 4 : mlimRaw;
    const strokePt = editStroke.value > 0 ? editStroke.value : 1;
    const strokePx = (strokePt * dpi) / 72;
    const corDef = CORES[cbCor.selectedIndex] || CORES[0];

    if (offsetPx === 0) {
      console.log('[IBD] Informe um deslocamento diferente de zero.');
    } else {
      const joinEnum = modoCanto === 'Arredondado'
        ? LineJoin.Round
        : (modoCanto === 'Chanfrado' ? LineJoin.Bevel : LineJoin.Miter);

      const lineStyle = LineStyle.create({
        cap: LineCap.Round,
        join: joinEnum,
        type: LineType.Solid,
        weight: strokePx,
        miterLimit: mlim
      });
      const lineStyleDesc = LineStyleDescriptor.create(lineStyle, {
        strokeAlignment: StrokeAlignment.Centre
      });
      const strokeFill = FillDescriptor.createSolid(
        RGBA8(corDef.rgba[0], corDef.rgba[1], corDef.rgba[2]),
        BlendMode.Normal
      );
      const noFill = FillDescriptor.createNone();

      const origNodes = [];
      for (const item of doc.selection.items) {
        if (item.node) origNodes.push(item.node);
      }

      const cmdBuilder = AddChildNodesCommandBuilder.create();
      let adicionados = 0;
      let ignorados = 0;

      for (const node of origNodes) {
        const poly = node.polyCurve ? construirCurvaDeslocada(node, offsetPx, modoCanto, mlim) : null;
        if (!poly) {
          ignorados++;
          continue;
        }
        cmdBuilder.addPolyCurveNode(
          PolyCurveNodeDefinition.create(poly, noFill, strokeFill, lineStyleDesc, null)
        );
        adicionados++;
      }

      if (adicionados === 0) {
        console.log('[IBD] Nenhuma curva vetorial valida foi gerada (verifique se o deslocamento negativo anulou a forma).');
      } else {
        const addCmd = cmdBuilder.createCommand(true, NodeChildType.Main);
        doc.executeCommand(addCmd, false);

        if (chkUnificar.value && doc.selection && doc.selection.length > 1) {
          doc.boolOpUnion(doc.selection);
        }
        if (!chkManter.value) {
          doc.deleteSelection(Selection.create(doc, origNodes));
        }

        console.log('[IBD] Contorno gerado para ' + adicionados + ' objeto(s).' +
          (ignorados > 0 ? ' Ignorados: ' + ignorados + '.' : ''));
      }
    }
  }
}
