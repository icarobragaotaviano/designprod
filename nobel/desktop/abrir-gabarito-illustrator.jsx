#target illustrator
(function () {
  var arquivo = File.openDialog("Escolha a prova SVG exportada pela DesignProd");
  if (!arquivo) return;
  if (!/\.svg$/i.test(arquivo.name)) { alert("Selecione um SVG."); return; }
  app.open(arquivo);
}());
