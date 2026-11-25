#target illustrator
(function () {
  if (!app.documents.length) { alert("Abra um documento."); return; }
  var doc = app.activeDocument;
  var input = prompt("Limite de cobertura CMYK (%)", "300");
  if (input === null) return;
  var tac = Number(input.replace(",", "."));
  if (!(tac > 0 && tac <= 400)) { alert("Limite inválido."); return; }
  var hits = [], entries = [];
  function item(obj, msg, owner, fn) {
    hits.push(owner);
    entries.push({ msg: (owner.name || owner.typename) + " · " + msg, fix: fn });
  }
  function color(c, over, owner, place, size, attributes) {
    if (!c) return;
    if (c.typename === "RGBColor") item(c, "RGB em " + place, owner);
    if (c.typename === "SpotColor" && c.spot.colorType === ColorModel.REGISTRATION) item(c, "Cor Registro em " + place, owner);
    if (c.typename !== "CMYKColor") return;
    var cmy = c.cyan + c.magenta + c.yellow, total = cmy + c.black;
    if (total > tac) item(c, "TAC " + total.toFixed(1) + "% em " + place, owner);
    var fill = place === "preenchimento";
    if (total === 0 && over) item(c, "Branco em sobreimpressão (" + place + ")", owner, function () {
      if (attributes) { if (fill) attributes.overprintFill = false; else attributes.overprintStroke = false; }
      else if (fill) owner.fillOverprint = false;
      else owner.strokeOverprint = false;
    });
    if (attributes && size <= 10 && c.black >= 85 && cmy > 0 && fill) item(c, "Texto pequeno com preto composto", owner, function () {
      var k = new CMYKColor(); k.black = 100;
      attributes.fillColor = k;
      attributes.overprintFill = true;
    });
  }
  function points(obj) {
    if (obj.guides || obj.clipping) return;
    if (obj.filled) color(obj.fillColor, obj.fillOverprint, obj, "preenchimento");
    if (obj.stroked) {
      color(obj.strokeColor, obj.strokeOverprint, obj, "contorno");
      if (obj.strokeWidth < 0.25) item(obj, "Filete abaixo de 0,25 pt", obj);
    }
  }
  var i, j, a, obj;
  for (i = 0; i < doc.pathItems.length; i++) points(doc.pathItems[i]);
  for (i = 0; i < doc.textFrames.length; i++) {
    obj = doc.textFrames[i];
    if (!obj.contents) continue;
    item(obj, "Texto editável. Confirme a exigência de curvas do destino.", obj);
    for (j = 0; j < obj.textRange.characters.length; j++) {
      a = obj.textRange.characters[j].characterAttributes;
      color(a.fillColor, a.overprintFill, obj, "preenchimento", a.size, a);
      color(a.strokeColor, a.overprintStroke, obj, "contorno", a.size, a);
    }
  }
  for (i = 0; i < doc.rasterItems.length; i++) {
    obj = doc.rasterItems[i];
    if (String(obj.imageColorSpace).indexOf("RGB") >= 0) item(obj, "Imagem RGB", obj);
    item(obj, "Conferir resolução efetiva no tamanho de saída", obj);
  }
  for (i = 0; i < doc.placedItems.length; i++) item(doc.placedItems[i], "Conferir perfil e resolução do vínculo", doc.placedItems[i]);
  if (!entries.length) { alert("Nenhuma ocorrência nas propriedades verificadas."); return; }
  var w = new Window("dialog", "IBD · Auditoria de arte");
  w.add("statictext", undefined, entries.length + " ocorrência(s). Correções alteram o documento aberto.");
  var lista = w.add("listbox", undefined, []); lista.preferredSize = [680,320];
  for (i = 0; i < entries.length; i++) lista.add("item", entries[i].msg);
  var controls = w.add("group");
  var localizar = controls.add("button", undefined, "Selecionar objeto");
  var corrigir = controls.add("button", undefined, "Corrigir ocorrência");
  controls.add("button", undefined, "Fechar", {name:"cancel"});
  localizar.onClick = function () {
    if (!lista.selection) return;
    try {
      var alvo = hits[lista.selection.index];
      doc.selection = null;
      alvo.selected = true;
      var b = alvo.visibleBounds;
      app.activeDocument.views[0].centerPoint = [(b[0]+b[2])/2,(b[1]+b[3])/2];
      app.redraw();
    } catch (e) { alert("Não foi possível selecionar o objeto. " + e.message); }
  };
  corrigir.onClick = function () {
    if (!lista.selection) return;
    var r = entries[lista.selection.index];
    if (!r.fix) { alert("Ocorrência de conferência manual."); return; }
    if (!confirm("Aplicar esta correção ao documento aberto?")) return;
    try { r.fix(); r.fix = null; lista.selection.text = "Corrigido · " + r.msg; app.redraw(); }
    catch (e) { alert(e.message); }
  };
  w.show();
}());
