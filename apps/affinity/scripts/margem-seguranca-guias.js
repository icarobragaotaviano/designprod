/**
 * @ibd-id affinity/margem-seguranca-guias
 * @ibd-titulo Criar margem de segurança interna (guias)
 * @ibd-descricao Adiciona quatro guias internas nativas (esq., dir., topo e base) na unidade escolhida do documento ou prancheta ativa (SDK Beta 3.3+).
 * @ibd-app affinity
 * @ibd-versao 1.0.0
 * @ibd-tags guias, margem, seguranca, prancheta, affinity
 * @ibd-doc docs/ferramentas-vetor.md
 */
'use strict';

const { Document } = require('/document.js');
const { DocumentCommand, CompoundCommandBuilder } = require('/commands.js');
const { Dialog, DialogResult } = require('/dialog.js');
const { UnitType } = require('/units.js');

function encontrarPranchetaSelecionada(doc) {
  const sel = doc.selection;
  if (!sel || sel.length === 0) return null;
  for (let i = 0; i < sel.length; i++) {
    let node = null;
    try { node = sel.at(i).node; } catch (e) { continue; }
    let prof = 0;
    while (node && prof < 12) {
      const ai = node.artboardInterface;
      if (ai && ai.isArtboardEnabled === true) {
        const box = ai.spreadBaseBox;
        const desc = (ai.description && String(ai.description).trim())
          ? String(ai.description).trim()
          : 'Prancheta ativa';
        return { x: box.x, y: box.y, w: box.width, h: box.height, desc };
      }
      node = node.parent;
      prof++;
    }
  }
  return null;
}

const doc = Document.current;
if (!doc) {
  console.log('[IBD] Abra um documento no Affinity antes de executar.');
} else {
  const conv = doc.unitValueConverter;
  const mmToPx = conv.getConversionFactor(UnitType.Millimetre, UnitType.Pixel);
  const pxToMm = 1 / mmToPx;

  const hasArtboards = !!(doc.hasArtboards && doc.artboards && doc.artboards.length > 0);
  const prancheta = hasArtboards ? encontrarPranchetaSelecionada(doc) : null;

  if (hasArtboards && !prancheta) {
    const aviso = Dialog.create('IBD — Margem de seguranca');
    aviso.initialWidth = 420;
    const colAviso = aviso.addColumn();
    const grpAviso = colAviso.addGroup('');
    const t1 = grpAviso.addStaticText('Nenhuma prancheta selecionada.', '');
    const t2 = grpAviso.addStaticText(
      'No Affinity SDK, novas guias pertencem a prancheta em foco. Selecione a prancheta desejada (ou um objeto dentro dela) e rode novamente.',
      ''
    );
    t1.isFullWidth = true;
    t2.isFullWidth = true;
    aviso.runModal();
    console.log('[IBD] Cancelado: documento possui pranchetas, mas nenhuma esta selecionada.');
  } else {
    const alvo = prancheta || {
      x: 0,
      y: 0,
      w: doc.widthPixels,
      h: doc.heightPixels,
      desc: 'Pagina inteira'
    };

    const unidades = [
      { nome: 'mm', tipo: UnitType.Millimetre, fatorPx: mmToPx },
      { nome: 'cm', tipo: UnitType.Centimetre, fatorPx: conv.getConversionFactor(UnitType.Centimetre, UnitType.Pixel) },
      { nome: 'px', tipo: UnitType.Pixel, fatorPx: 1 }
    ];
    let idxUnid = unidades.findIndex((u) => String(doc.units).toLowerCase().indexOf(u.nome) === 0);
    if (String(doc.units) === 'Pixel') idxUnid = 2;
    if (idxUnid < 0) idxUnid = 0;

    const dlg = Dialog.create('IBD — Margem de seguranca (guias)');
    dlg.initialWidth = 400;
    const col = dlg.addColumn();

    const grpAlvo = col.addGroup('Alvo');
    grpAlvo.addStaticText(
      'Area',
      alvo.desc + ' (' + (alvo.w * pxToMm).toFixed(1) + ' x ' + (alvo.h * pxToMm).toFixed(1) + ' mm)'
    );

    const grpCfg = col.addGroup('Configuracao');
    const margEdit = grpCfg.addUnitValueEditor('Margem interna', UnitType.Pixel, unidades[idxUnid].tipo, 5 * mmToPx, 0, null);
    margEdit.value = 5 * mmToPx; // Workaround SDK: maxValue null zera valor inicial no construtor
    const chkPreview = grpCfg.addCheckBox('Pre-visualizacao ao vivo', true);
    const infoStatus = grpCfg.addStaticText('Area util', '-');

    const montarComandos = () => {
      const m = margEdit.value;
      if (!(m > 0) || (2 * m) >= alvo.w || (2 * m) >= alvo.h) return null;
      return [
        DocumentCommand.createAddGuide(false, alvo.x + m),
        DocumentCommand.createAddGuide(false, alvo.x + alvo.w - m),
        DocumentCommand.createAddGuide(true, alvo.y + m),
        DocumentCommand.createAddGuide(true, alvo.y + alvo.h - m)
      ];
    };

    const atualizarPreview = () => {
      doc.clearPreviews();
      const cmds = montarComandos();
      if (!cmds) {
        infoStatus.text = 'Margem invalida ou maior que a area util';
        return;
      }
      const m = margEdit.value;
      const utilW = ((alvo.w - 2 * m) * pxToMm).toFixed(1);
      const utilH = ((alvo.h - 2 * m) * pxToMm).toFixed(1);
      infoStatus.text = utilW + ' x ' + utilH + ' mm';

      if (chkPreview.value) {
        const cb = CompoundCommandBuilder.create();
        for (const cmd of cmds) cb.addCommand(cmd);
        doc.executeCommand(cb.createCommand(), true);
      }
    };

    dlg.onControlValueChangedHandler = atualizarPreview;
    atualizarPreview();

    const res = dlg.runModal();
    doc.clearPreviews();

    if (res === DialogResult.Ok) {
      const cmds = montarComandos();
      if (!cmds) {
        console.log('[IBD] Margem invalida para o tamanho da prancheta/pagina.');
      } else {
        const cb = CompoundCommandBuilder.create();
        for (const cmd of cmds) cb.addCommand(cmd);
        doc.executeCommand(cb.createCommand(), false);
        console.log('[IBD] 4 guias de margem criadas em: ' + alvo.desc);
      }
    } else {
      console.log('[IBD] Operacao cancelada.');
    }
  }
}
