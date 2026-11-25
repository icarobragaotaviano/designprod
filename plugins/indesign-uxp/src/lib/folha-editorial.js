/** Transforma faces do Folha em quadros técnicos de uma prova nova no InDesign. */
const { app, ScriptLanguage, UndoModes } = require('indesign');

function montarProvaEditorial(plano) {
  if (plano.operacao !== 'planejar-cadernos' || !plano.materializavel) {
    throw Error('Calcule um plano editorial válido antes de criar a prova.');
  }
  const { parametros: s, resultado } = plano;
  const [secao] = resultado.items;
  if (!Number.isFinite(secao.angle) || secao.angle % 90 !== 0) {
    throw Error('A prova do InDesign usa rotações de seção em múltiplos de 90°.');
  }
  const angulo = ((secao.angle % 360) + 360) % 360;
  const cos = Math.round(Math.cos(angulo * Math.PI / 180));
  const sin = Math.round(Math.sin(angulo * Math.PI / 180));
  const largura = sin !== 0 ? s.ph : s.pw;
  const altura = sin !== 0 ? s.pw : s.ph;
  const faces = [];
  for (const caderno of resultado.plan) {
    for (const verso of [false, true]) {
      const xSecao = verso ? s.sw - secao.x - secao.w : secao.x;
      const centroX = xSecao + secao.w / 2;
      const centroY = secao.y + secao.h / 2;
      const celulas = verso ? caderno.backCells : caderno.frontCells;
      const quadros = [];
      for (const linha of celulas) {
        for (const celula of linha) {
          const { row, col } = celula;
          const par = Math.floor(col / 2);
          const fresagem = secao.millingAllowance || 0;
          const intervalo = par * (fresagem + (secao.faceGap || 0)) + (col % 2) * fresagem;
          const dx = col * s.pw + intervalo + s.pw / 2 - secao.w / 2;
          const dy = row * (s.ph + (secao.headGap || 0)) + s.ph / 2 - secao.h / 2;
          const x = centroX + dx * cos - dy * sin - largura / 2;
          const y = centroY + dx * sin + dy * cos - altura / 2;
          const rotacao = (angulo + celula.angle) % 360;
          const pagina = celula.isBlank ? `Branco (${celula.slotPage})` : `Página ${celula.page}`;
          quadros.push({
            limites: [y, x, y + altura, x + largura],
            rotulo: `${pagina} · ${rotacao}° · creep ${celula.shift} mm`
          });
        }
      }
      const titulo = `Caderno ${caderno.index + 1} · ${verso ? 'Verso' : 'Frente'}`;
      faces.push({ titulo, quadros });
    }
  }
  return { largura: s.sw, altura: s.sh, faces };
}

// Corpo serializado para o runtime ExtendScript do InDesign. Use apenas sintaxe ES3.
function criarDocumento(prova) {
  var unidade = app.scriptPreferences.measurementUnit;
  var doc;
  try {
    app.scriptPreferences.measurementUnit = MeasurementUnits.MILLIMETERS;
    doc = app.documents.add();
    doc.documentPreferences.facingPages = false;
    doc.documentPreferences.pagesPerDocument = 1;
    doc.documentPreferences.pageWidth = prova.largura;
    doc.documentPreferences.pageHeight = prova.altura;
    doc.viewPreferences.rulerOrigin = RulerOrigin.PAGE_ORIGIN;
    doc.zeroPoint = [0, 0];
    var tinta = doc.colors.add({ name: 'Folha - quadros de prova', model: ColorModel.PROCESS,
      space: ColorSpace.CMYK, colorValue: [0, 0, 0, 100] });
    for (var i = 0; i < prova.faces.length; i++) {
      var face = prova.faces[i];
      var pagina = i === 0 ? doc.pages[0] : doc.pages.add();
      pagina.insertLabel('ibd-folha-face', face.titulo);
      for (var j = 0; j < face.quadros.length; j++) {
        var quadro = face.quadros[j];
        var caixa = pagina.textFrames.add({ geometricBounds: quadro.limites, contents: quadro.rotulo });
        caixa.label = face.titulo + ' | ' + quadro.rotulo;
        caixa.strokeColor = tinta;
        caixa.strokeWeight = '0.25 pt';
      }
    }
  } catch (erro) {
    if (doc && doc.isValid) doc.close(SaveOptions.NO);
    throw erro;
  } finally {
    app.scriptPreferences.measurementUnit = unidade;
  }
}

function aplicarEditorial(plano) {
  const prova = montarProvaEditorial(plano);
  const codigo = '(' + criarDocumento.toString() + ')(' + JSON.stringify(prova) + ');';
  app.doScript(codigo, ScriptLanguage.JAVASCRIPT, [], UndoModes.ENTIRE_SCRIPT, 'Folha — Criar prova editorial');
  return prova.faces.length;
}

module.exports = { aplicarEditorial };
