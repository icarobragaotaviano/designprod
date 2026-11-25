/**
 * @ibd-id tracedraw/texto-dimensoes-objeto
 * @ibd-titulo Texto com dimensoes do objeto
 * @ibd-descricao Calcula a caixa delimitadora da selecao e cria texto artistico com Largura x Altura na unidade configurada no TraceDraw.
 * @ibd-app tracedraw
 * @ibd-versao 1.0.0
 * @ibd-tags dimensoes, medida, texto, cota, tracedraw
 * @ibd-doc docs/ferramentas-vetor.md
 */
(function () {
  // === Parametros editaveis (painel Scripts nao possui caixas modais) ===
  var UNIDADE = 'mm';           // 'mm' | 'cm' | 'm' | 'px' | 'in' | 'pt'
  var CASAS_DECIMAIS = 1;       // 0 a 4
  var USAR_VIRGULA = true;      // true -> 12,5 x 8,0 mm | false -> 12.5 x 8.0 mm
  var POSICAO = 'Abaixo';       // 'Abaixo' | 'Acima' | 'Centro'
  var AFASTAMENTO_MM = 3;
  var FONTE_NOME = 'Arial';
  var TAMANHO_FONTE_PT = 10;
  var NOME_CAMADA = '01_TEXTOS';
  // ======================================================================

  if (typeof ActiveDocument === 'undefined' || !ActiveDocument) {
    print('[IBD] Abra um documento no TraceDraw antes de executar.');
    return;
  }

  var sel = ActiveDocument.Selection;
  if (!sel || sel.Count === 0) {
    print('[IBD] Selecione pelo menos um objeto no TraceDraw para medir.');
    return;
  }

  var FATORES_MM = {
    mm: 1,
    cm: 10,
    m: 1000,
    in: 25.4,
    pt: 25.4 / 72,
    px: 25.4 / 96
  };
  var fator = FATORES_MM[UNIDADE];
  if (!fator) {
    print('[IBD] Unidade invalida: ' + UNIDADE + '. Use mm, cm, m, px, in ou pt.');
    return;
  }

  var minL = Infinity;
  var minB = Infinity;
  var maxR = -Infinity;
  var maxT = -Infinity;

  sel.forEach(function (item) {
    var b = item.Bounds;
    if (!b) return;
    if (b.left < minL) minL = b.left;
    if (b.bottom < minB) minB = b.bottom;
    if (b.right > maxR) maxR = b.right;
    if (b.top > maxT) maxT = b.top;
  });

  if (!isFinite(minL)) {
    print('[IBD] Nao foi possivel obter os limites dos objetos selecionados.');
    return;
  }

  var casas = Math.max(0, Math.min(4, Math.round(CASAS_DECIMAIS)));
  var wTxt = ((maxR - minL) / fator).toFixed(casas);
  var hTxt = ((maxT - minB) / fator).toFixed(casas);
  if (USAR_VIRGULA) {
    wTxt = wTxt.replace('.', ',');
    hTxt = hTxt.replace('.', ',');
  }
  var rotulo = wTxt + ' x ' + hTxt + ' ' + UNIDADE;

  var camadaTexto = ActivePage.Layers.Find(NOME_CAMADA);
  if (!camadaTexto) camadaTexto = ActivePage.CreateLayer(NOME_CAMADA);
  var bloqueadaAntes = camadaTexto.Locked;
  if (bloqueadaAntes) camadaTexto.Locked = false;

  var cx = (minL + maxR) / 2;
  var cy = (minB + maxT) / 2;
  var yInit = POSICAO === 'Acima' ? (maxT + AFASTAMENTO_MM) : (minB - AFASTAMENTO_MM - (TAMANHO_FONTE_PT * 25.4 / 72));
  if (POSICAO === 'Centro') yInit = cy;

  var txt = camadaTexto.CreateArtisticText(cx, yInit, rotulo, FONTE_NOME, TAMANHO_FONTE_PT);
  txt.Fill.ApplyUniformFill(Color.CMYK(0, 0, 0, 100));
  txt.Outline.SetNoOutline();

  var tb = txt.Bounds;
  if (tb) {
    var dx = cx - tb.centerX;
    var dy = 0;
    if (POSICAO === 'Acima') {
      dy = (maxT + AFASTAMENTO_MM) - tb.bottom;
    } else if (POSICAO === 'Centro') {
      dy = cy - tb.centerY;
    } else {
      dy = (minB - AFASTAMENTO_MM) - tb.top;
    }
    txt.Move(dx, dy);
  }

  if (bloqueadaAntes) camadaTexto.Locked = true;
  print('[IBD] Texto criado: ' + rotulo);
})();
