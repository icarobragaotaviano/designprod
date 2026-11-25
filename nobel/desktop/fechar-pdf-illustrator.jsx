#target illustrator
(function () {
  if (!app.documents.length) { alert("Abra um documento."); return; }
  var origem = app.activeDocument;
  if (!origem.saved || !/\.ai$/i.test(origem.name)) { alert("Salve o mestre editável antes de fechar o PDF."); return; }
  var arquivoOrigem;
  try { arquivoOrigem = origem.fullName; } catch (e) { alert("Salve o mestre editável em disco primeiro."); return; }
  var w = new Window("dialog","IBD · Fechar PDF");
  w.add("statictext", undefined, "Escolha a predefinição PDF/X homologada pelo fornecedor.");
  var presets = w.add("dropdownlist",undefined,app.PDFPresetsList);
  if (!presets.items.length) { alert("Nenhuma predefinição disponível."); return; }
  presets.selection = 0;
  var web = w.add("checkbox",undefined,"Web-to-Print · desativar marcas e converter textos na cópia");
  w.add("statictext",undefined,"Enobrecimento W2P · organize as pranchetas pela ordem indicada no plano.");
  var b = w.add("group"); b.add("button",undefined,"Continuar",{name:"ok"}); b.add("button",undefined,"Cancelar",{name:"cancel"});
  if (w.show() !== 1) return;
  var pdf = File.saveDialog("Salvar cópia PDF");
  if (!pdf) return;
  if (!/\.pdf$/i.test(pdf.name)) pdf = new File(pdf.fsName + ".pdf");
  if (pdf.fsName === arquivoOrigem.fsName || pdf.exists) { alert("Escolha um nome novo para o PDF."); return; }
  var temporario = new File(arquivoOrigem.parent.fsName + "/ibd-fechamento-" + new Date().getTime() + ".ai");
  var copia;
  try {
    if (!arquivoOrigem.copy(temporario)) throw Error("Não foi possível criar a cópia do mestre.");
    copia = app.open(temporario);
    var cfg = new PDFSaveOptions();
    cfg.pDFPreset = presets.selection.text;
    cfg.preserveEditability = false;
    cfg.viewAfterSaving = false;
    if (web.value) {
      cfg.trimMarks = false; cfg.registrationMarks = false; cfg.colorBars = false; cfg.pageInformation = false; cfg.bleedMarks = false;
      for (var i = copia.textFrames.length - 1; i >= 0; i--) {
        if (!copia.textFrames[i].contents) continue;
        try { copia.textFrames[i].createOutline(); }
        catch (e) { throw Error("Desbloqueie o texto que precisa ser convertido em curvas no mestre."); }
      }
    }
    copia.saveAs(pdf,cfg);
    alert("PDF gravado. Confira caixas, transparências e separações no arquivo final.");
  } catch (e) { alert(e.message); }
  finally {
    if (copia) copia.close(SaveOptions.DONOTSAVECHANGES);
    if (temporario.exists) temporario.remove();
  }
}());
