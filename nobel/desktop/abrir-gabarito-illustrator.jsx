#target illustrator
(function () {
  var arquivo = File.openDialog("Escolha a prova SVG exportada pela Bancada Nobel");
  if (!arquivo) return;
  if (!/\.svg$/i.test(arquivo.name)) { alert("Selecione um SVG."); return; }
  app.open(arquivo);
}());
