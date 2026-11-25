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
  var mascara = w.add("checkbox",undefined,"Intercalar máscara K100 antes de cada arte");
  mascara.enabled = false;
  web.onClick = function () { mascara.enabled = web.value; if (!web.value) mascara.value = false; };
  w.add("statictext",undefined,"Máscaras vetoriais em camadas MASCARA_FRENTE e MASCARA_VERSO. Use uma ou duas pranchetas.");
  var b = w.add("group"); b.add("button",undefined,"Continuar",{name:"ok"}); b.add("button",undefined,"Cancelar",{name:"cancel"});
  if (w.show() !== 1) return;
  var pdf = File.saveDialog("Salvar cópia PDF");
  if (!pdf) return;
  if (!/\.pdf$/i.test(pdf.name)) pdf = new File(pdf.fsName + ".pdf");
  if (pdf.fsName === arquivoOrigem.fsName || pdf.exists) { alert("Escolha um nome novo para o PDF."); return; }
  var temporario = new File(arquivoOrigem.parent.fsName + "/ibd-fechamento-" + new Date().getTime() + ".ai");
  var copia;
  function intercalar(doc) {
    if (doc.documentColorSpace !== DocumentColorSpace.CMYK) throw Error("Use um mestre CMYK para intercalar as máscaras.");
    var lados = doc.artboards.length;
    if (lados < 1 || lados > 2) throw Error("Use uma prancheta por face, na ordem frente e verso.");
    var nome = ["MASCARA_FRENTE", "MASCARA_VERSO"];
    var x = doc.visibleBounds[2]+144;
    var abas=[], camadas=[], grupos=[];
    var preto=new CMYKColor(); preto.black=100;
    function pintar(p) {
      if (p.typename === "PathItem") {
        if (p.clipping || p.guides) return;
        if (p.filled) { p.fillColor=preto; p.fillOverprint=false; }
        if (p.stroked) { p.strokeColor=preto; p.strokeOverprint=false; }
        if (!p.filled && !p.stroked) throw Error("Máscara vetorial sem preenchimento ou traço.");
      } else if (p.typename === "GroupItem") {
        for (var i=0;i<p.pageItems.length;i++) if(p.pageItems[i].parent===p)pintar(p.pageItems[i]);
      } else if (p.typename === "CompoundPathItem") {
        for (var j=0;j<p.pathItems.length;j++)pintar(p.pathItems[j]);
      } else throw Error("Use apenas vetores nas máscaras.");
    }
    for(var i=0;i<lados;i++){
      var r=doc.artboards[i].artboardRect;
      abas.push(r);
      x=Math.max(x,r[2]+144);
      var c;
      try{c=doc.layers.getByName(nome[i]);}catch(e){throw Error("Camada ausente: "+nome[i]);}
      var items=[];
      c.visible=true; c.locked=false;
      for(var j=0;j<c.pageItems.length;j++){
        var item=c.pageItems[j];
        if(item.parent!==c||item.hidden)continue;
        var b=item.visibleBounds;
        if(b[0]<r[0]-.01||b[1]>r[1]+.01||b[2]>r[2]+.01||b[3]<r[3]-.01)throw Error("A máscara deve caber na prancheta da face: "+nome[i]);
        items.push(item);
      }
      if(!items.length||c.layers.length)throw Error("Coloque a máscara vetorial diretamente em "+nome[i]+".");
      camadas.push(c); grupos.push(items);
    }
    var destino=doc.layers.add(); destino.name="IBD · Máscaras K100";
    for(var lado=lados-1;lado>=0;lado--){
      var alvo=abas[lado], w=alvo[2]-alvo[0];
      doc.artboards.insert([x,alvo[1],x+w,alvo[3]],lado);
      for(var idx=grupos[lado].length-1;idx>=0;idx--){
        var p=grupos[lado][idx].duplicate(destino,ElementPlacement.PLACEATBEGINNING);
        p.locked=false;
        pintar(p);
        p.translate(x-alvo[0],0);
      }
      camadas[lado].visible=false;
      x+=w+144;
    }
  }
  try {
    if (!arquivoOrigem.copy(temporario)) throw Error("Não foi possível criar a cópia do mestre.");
    copia = app.open(temporario);
    var cfg = new PDFSaveOptions();
    cfg.pDFPreset = presets.selection.text;
    cfg.preserveEditability = false;
    cfg.viewAfterSaving = false;
    if (web.value) {
      if (mascara.value) intercalar(copia);
      cfg.artboardRange = "";
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
