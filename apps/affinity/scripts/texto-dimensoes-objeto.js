/**
 * @ibd-id affinity/texto-dimensoes-objeto
 * @ibd-titulo Texto com dimensoes do objeto
 * @ibd-descricao Cria texto artistico com as dimensoes combinadas dos objetos selecionados na unidade escolhida no Affinity (SDK Beta 3.3+).
 * @ibd-app affinity
 * @ibd-versao 1.0.0
 * @ibd-tags dimensoes, medida, texto, cota, affinity
 * @ibd-doc docs/ferramentas-vetor.md
 */
'use strict';

const { Document } = require('/document.js');
const { DocumentCommand } = require('/commands.js');
const { Dialog, DialogResult } = require('/dialog.js');
const { Transform } = require('/geometry.js');
const { ArtTextNodeDefinition } = require('/nodes.js');
const { StoryBuilder } = require('/storybuilder.js');
const { FillDescriptor, BlendMode } = require('/fills.js');
const { RGBA8 } = require('/colours.js');
const { ParagraphAlignXType } = require('/paragraphatts.js');
const { Selection } = require('/selections.js');
const { UnitType } = require('/units.js');

const doc = Document.current;
if (!doc) {
  console.log('[IBD] Abra um documento no Affinity antes de executar.');
} else if (!doc.selection || doc.selection.length === 0) {
  console.log('[IBD] Selecione pelo menos um objeto para medir.');
} else {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const item of doc.selection.items) {
    const node = item.node;
    if (!node) continue;
    const box = node.spreadBaseBox || (node.baseBoxInterface && node.baseBoxInterface.baseBox);
    if (!box) continue;
    if (box.x < minX) minX = box.x;
    if (box.y < minY) minY = box.y;
    if (box.x + box.width > maxX) maxX = box.x + box.width;
    if (box.y + box.height > maxY) maxY = box.y + box.height;
  }

  if (!isFinite(minX)) {
    console.log('[IBD] Nao foi possivel obter a caixa delimitadora da selecao.');
  } else {
    const dpi = doc.dpi || 96;
    const conv = doc.unitValueConverter;
    const mmToPx = conv.getConversionFactor(UnitType.Millimetre, UnitType.Pixel);
    const pxToMm = 25.4 / dpi;

    const UNIDADES = ['mm', 'cm', 'm', 'px', 'in', 'pt'];
    const DECIMAIS = ['0', '1', '2', '3', '4'];
    const POSICOES = ['Abaixo', 'Acima', 'Centro'];

    const wPx = maxX - minX;
    const hPx = maxY - minY;

    function converterDePx(px, unid) {
      switch (unid) {
        case 'mm': return px * pxToMm;
        case 'cm': return (px * pxToMm) / 10;
        case 'm':  return (px * pxToMm) / 1000;
        case 'in': return px / dpi;
        case 'pt': return (px * 72) / dpi; // Conversao exata evita inconsistencia conhecida do Point no SDK
        default:   return px;
      }
    }

    function formatar(unid, casas, virgula) {
      const wStr = converterDePx(wPx, unid).toFixed(casas);
      const hStr = converterDePx(hPx, unid).toFixed(casas);
      const sepW = virgula ? wStr.replace('.', ',') : wStr;
      const sepH = virgula ? hStr.replace('.', ',') : hStr;
      return sepW + ' x ' + sepH + ' ' + unid;
    }

    const dlg = Dialog.create('IBD — Dimensoes do objeto selecionado');
    dlg.initialWidth = 390;
    const col = dlg.addColumn();
    const grp = col.addGroup('Formato');

    const cbUnid = grp.addComboBox('Unidade', UNIDADES, 0);
    const cbDec = grp.addComboBox('Casas decimais', DECIMAIS, 1);
    const chkVirgula = grp.addCheckBox('Usar virgula decimal (PT-BR)', true);
    const editFonte = grp.addUnitValueEditor('Tamanho da fonte', UnitType.Point, UnitType.Point, 10, 2, 500);
    editFonte.value = 10;
    const cbPos = grp.addComboBox('Posicao do texto', POSICOES, 0);
    const editGap = grp.addUnitValueEditor('Afastamento (mm)', UnitType.Pixel, UnitType.Millimetre, 3 * mmToPx, 0, null);
    editGap.value = 3 * mmToPx;
    const txtPreview = grp.addStaticText('Previa', '');

    const atualizar = () => {
      const unid = UNIDADES[cbUnid.selectedIndex] || 'mm';
      const dec = cbDec.selectedIndex >= 0 ? cbDec.selectedIndex : 1;
      txtPreview.text = formatar(unid, dec, chkVirgula.value);
    };
    dlg.onControlValueChangedHandler = atualizar;
    atualizar();

    if (dlg.runModal() === DialogResult.Ok) {
      const unid = UNIDADES[cbUnid.selectedIndex] || 'mm';
      const dec = cbDec.selectedIndex >= 0 ? cbDec.selectedIndex : 1;
      const rotulo = formatar(unid, dec, chkVirgula.value);
      const fontPt = editFonte.value > 0 ? editFonte.value : 10;
      const fontPx = fontPt * dpi / 72;
      const gapPx = Math.max(0, editGap.value);
      const posModo = POSICOES[cbPos.selectedIndex] || 'Abaixo';

      const sb = StoryBuilder.create();
      sb.setToArtisticTextDefaultStyle(dpi, doc.format);
      const ga = sb.glyphAtts;
      ga.height = fontPx;
      ga.brushFill = FillDescriptor.createSolid(RGBA8(20, 20, 20), BlendMode.Normal);
      sb.setGlyphAtts(ga);
      const pa = sb.paragraphAtts;
      pa.alignXType = ParagraphAlignXType.Centre;
      sb.setParagraphAtts(pa);
      sb.addText(rotulo);

      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      let initY = maxY + gapPx + fontPx * 0.85;
      if (posModo === 'Acima') initY = minY - gapPx - fontPx * 0.15;
      if (posModo === 'Centro') initY = cy + fontPx * 0.35;

      const def = ArtTextNodeDefinition.createFromStoryBuilder({ x: cx, y: initY }, sb);
      doc.addNode(def);

      // Ajuste fino da caixa real caso a fonte altere o deslocamento da linha de base
      const added = doc.selection && doc.selection.nodes ? doc.selection.nodes.first : null;
      if (added && added.spreadBaseBox) {
        const ab = added.spreadBaseBox;
        const aCx = ab.x + ab.width / 2;
        let dy = 0;
        if (posModo === 'Abaixo') dy = (maxY + gapPx) - ab.y;
        else if (posModo === 'Acima') dy = (minY - gapPx) - (ab.y + ab.height);
        else dy = cy - (ab.y + ab.height / 2);

        const dx = cx - aCx;
        if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
          doc.executeCommand(
            DocumentCommand.createTransform(Selection.create(doc, added), Transform.createTranslate(dx, dy))
          );
        }
      }

      console.log('[IBD] Texto criado: ' + rotulo);
    }
  }
}
