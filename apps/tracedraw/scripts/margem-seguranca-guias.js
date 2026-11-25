/**
 * @ibd-id tracedraw/margem-seguranca-guias
 * @ibd-titulo Criar margem de segurança interna (guias)
 * @ibd-descricao Cria quadro retangular de margem de segurança (mm) na camada 06_GUIAS bloqueada para a página ativa ou todas (configure no topo do script).
 * @ibd-app tracedraw
 * @ibd-versao 1.0.0
 * @ibd-tags guias, margem, seguranca, tracedraw
 * @ibd-doc docs/ferramentas-vetor.md
 */
(function () {
  // === Parametros editaveis (painel Scripts nao possui caixas modais) ===
  var MARGEM_MM = 5;
  var APLICAR_TODAS_PAGINAS = false;
  var NOME_CAMADA = '06_GUIAS';
  var BLOQUEAR_CAMADA = true;
  // ======================================================================

  if (typeof ActivePage === 'undefined' || !ActivePage) {
    print('[IBD] Abra um documento no TraceDraw antes de executar.');
    return;
  }
  if (!(MARGEM_MM > 0)) {
    print('[IBD] MARGEM_MM deve ser maior que zero.');
    return;
  }

  function obterOuCriarCamada(pagina, nome) {
    var existente = pagina.Layers ? pagina.Layers.Find(nome) : null;
    if (existente) return existente;
    return pagina.CreateLayer(nome);
  }

  function aplicarNaPagina(pagina) {
    var w = pagina.SizeWidth;
    var h = pagina.SizeHeight;
    if ((2 * MARGEM_MM) >= w || (2 * MARGEM_MM) >= h) {
      return false;
    }

    var camada = obterOuCriarCamada(pagina, NOME_CAMADA);
    var bloqueadaAntes = camada.Locked;
    if (bloqueadaAntes) camada.Locked = false;

    var quadro = camada.CreateRectangle(
      MARGEM_MM,
      MARGEM_MM,
      w - (2 * MARGEM_MM),
      h - (2 * MARGEM_MM),
      0
    );
    quadro.Name = 'Margem de seguranca (' + MARGEM_MM + ' mm)';
    quadro.Fill.ApplyNoFill();
    quadro.Outline.SetProperties(0.25, Color.CMYK(100, 0, 0, 0));

    camada.Locked = BLOQUEAR_CAMADA;
    return true;
  }

  var criadas = 0;
  var ignoradas = 0;

  if (APLICAR_TODAS_PAGINAS && ActiveDocument && ActiveDocument.Pages) {
    var pagAtual = ActivePage;
    ActiveDocument.Pages.forEach(function (pg) {
      if (aplicarNaPagina(pg)) criadas++;
      else ignoradas++;
    });
    if (pagAtual && typeof pagAtual.Activate === 'function') pagAtual.Activate();
  } else {
    if (aplicarNaPagina(ActivePage)) criadas++;
    else ignoradas++;
  }

  if (criadas === 0) {
    print('[IBD] A margem de ' + MARGEM_MM + ' mm excede o tamanho util da pagina.');
  } else {
    print('[IBD] Margem de seguranca de ' + MARGEM_MM + ' mm criada em ' + criadas + ' pagina(s) na camada "' + NOME_CAMADA + '".' +
      (ignoradas > 0 ? ' Ignoradas: ' + ignoradas + '.' : ''));
  }
})();
