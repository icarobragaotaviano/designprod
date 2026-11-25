/**
 * ibd-ui.jsx — ScriptUI Visual 2.0: cabecalho visual, paineis agrupados,
 * previa grafica em tempo real, chips de atalho, progresso e resumo.
 * Requer ibd-core.jsx carregado antes.
 *
 * Mantem compatibilidade retroativa com chamadas simples de formulario e
 * degradacao segura em ambientes simulados sem ScriptUIGraphics.
 */
#include "ibd-core.jsx"

(function (IBD) {
  var ui = {};

  function temGraficos(ctrl) {
    return !!(ctrl && ctrl.graphics && ctrl.graphics.newBrush && ctrl.graphics.newPen);
  }

  function pintarFundo(ctrl, rgba) {
    try {
      if (!temGraficos(ctrl)) return;
      var g = ctrl.graphics;
      ctrl.graphics.backgroundColor = g.newBrush(g.BrushType.SOLID_COLOR, rgba);
    } catch (e) {}
  }

  function pintarTexto(ctrl, rgba, tam, negrito) {
    try {
      if (!temGraficos(ctrl)) return;
      var g = ctrl.graphics;
      g.foregroundColor = g.newPen(g.PenType.SOLID_COLOR, rgba, 1);
      if (tam && typeof ScriptUI !== 'undefined' && ScriptUI.newFont) {
        g.font = ScriptUI.newFont(
          g.font ? g.font.family : 'dialog',
          negrito ? ScriptUI.FontStyle.BOLD : ScriptUI.FontStyle.REGULAR,
          tam
        );
      }
    } catch (e) {}
  }

  function criarCabecalhoVisual(pai, titulo, subtitulo, tagBadge) {
    var box = pai.add('panel', undefined, '');
    box.orientation = 'row';
    box.alignChildren = ['left', 'center'];
    box.alignment = 'fill';
    box.margins = 8;
    box.spacing = 8;
    pintarFundo(box, [0.094, 0.102, 0.122, 1]);

    var selo = box.add('statictext', undefined, tagBadge || IBD.MARCA || 'IBD');
    selo.preferredSize.width = 42;
    pintarFundo(selo, [0.941, 0.769, 0.098, 1]);
    pintarTexto(selo, [0.086, 0.094, 0.114, 1], 11, true);

    var col = box.add('group');
    col.orientation = 'column';
    col.alignChildren = ['left', 'top'];
    col.spacing = 1;

    var lblTitulo = col.add('statictext', undefined, String(titulo || IBD.MARCA));
    pintarTexto(lblTitulo, [0.894, 0.906, 0.933, 1], 12, true);

    if (subtitulo) {
      var lblSub = col.add('statictext', undefined, String(subtitulo));
      pintarTexto(lblSub, [0.714, 0.737, 0.784, 1], 10, false);
    }

    return box;
  }

  /* Helpers de desenho para previas ao vivo (ScriptUIGraphics) ------- */

  ui.desenho = {
    cor: function (r, g, b, a) {
      return [r / 255, g / 255, b / 255, a === undefined ? 1 : a];
    },
    fundo: function (g, w, h, rgba, bordaRgba) {
      try {
        var b = g.newBrush(g.BrushType.SOLID_COLOR, rgba);
        g.newPath();
        g.rectPath(0, 0, w, h);
        g.fillPath(b);
        if (bordaRgba) {
          var p = g.newPen(g.PenType.SOLID_COLOR, bordaRgba, 1);
          g.newPath();
          g.rectPath(0.5, 0.5, w - 1, h - 1);
          g.strokePath(p);
        }
      } catch (e) {}
    },
    retangulo: function (g, x, y, w, h, fillRgba, strokeRgba, espessura) {
      try {
        if (fillRgba) {
          g.newPath();
          g.rectPath(x, y, w, h);
          g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, fillRgba));
        }
        if (strokeRgba) {
          g.newPath();
          g.rectPath(x, y, w, h);
          g.strokePath(g.newPen(g.PenType.SOLID_COLOR, strokeRgba, espessura || 1));
        }
      } catch (e) {}
    },
    circulo: function (g, x, y, w, h, fillRgba, strokeRgba, espessura) {
      try {
        if (fillRgba) {
          g.newPath();
          g.ellipsePath(x, y, w, h);
          g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, fillRgba));
        }
        if (strokeRgba) {
          g.newPath();
          g.ellipsePath(x, y, w, h);
          g.strokePath(g.newPen(g.PenType.SOLID_COLOR, strokeRgba, espessura || 1));
        }
      } catch (e) {}
    },
    linha: function (g, x1, y1, x2, y2, rgba, espessura) {
      try {
        var p = g.newPen(g.PenType.SOLID_COLOR, rgba, espessura || 1);
        g.newPath();
        g.moveto(x1, y1);
        g.lineto(x2, y2);
        g.strokePath(p);
      } catch (e) {}
    },
    tracejado: function (g, x1, y1, x2, y2, rgba, espessura, passo) {
      var dx = x2 - x1;
      var dy = y2 - y1;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) return;
      var seg = passo || 6;
      var n = Math.max(1, Math.floor(dist / (seg * 1.7)));
      var i;
      for (i = 0; i < n; i++) {
        var t0 = i / n;
        var t1 = Math.min(1, (i + 0.58) / n);
        ui.desenho.linha(g, x1 + dx * t0, y1 + dy * t0, x1 + dx * t1, y1 + dy * t1, rgba, espessura || 1);
      }
    },
    texto: function (g, str, x, y, rgba, tam, negrito) {
      try {
        var p = g.newPen(g.PenType.SOLID_COLOR, rgba, 1);
        var f = g.font;
        if (tam && typeof ScriptUI !== 'undefined' && ScriptUI.newFont) {
          f = ScriptUI.newFont(f ? f.family : 'dialog', negrito ? ScriptUI.FontStyle.BOLD : ScriptUI.FontStyle.REGULAR, tam);
        }
        g.drawString(String(str), p, x, y, f);
      } catch (e) {}
    }
  };

  /* Progresso visual ------------------------------------------------- */

  ui.progresso = function (total, titulo) {
    var alvoTotal = Math.max(total || 1, 1);
    var janela = new Window('palette', titulo || IBD.MARCA, undefined, { closeButton: false });
    janela.orientation = 'column';
    janela.alignChildren = 'fill';
    janela.margins = 14;
    janela.spacing = 10;
    janela.preferredSize.width = 400;

    criarCabecalhoVisual(janela, titulo || IBD.MARCA, 'Processando tarefas em andamento...', 'IBD');

    var rotulo = janela.add('statictext', undefined, 'Preparando... (0%)');
    rotulo.characters = 46;
    var barra = janela.add('progressbar', undefined, 0, alvoTotal);
    barra.preferredSize.height = 12;

    var linhaBase = janela.add('group');
    linhaBase.orientation = 'row';
    linhaBase.alignment = 'fill';
    var pctTexto = linhaBase.add('statictext', undefined, '0 / ' + alvoTotal);
    pctTexto.preferredSize.width = 140;
    var espaco = linhaBase.add('group');
    espaco.alignment = ['fill', 'center'];
    var botao = linhaBase.add('button', undefined, 'Cancelar');

    var abortado = false;
    botao.onClick = function () {
      abortado = true;
      rotulo.text = 'Cancelando...';
    };

    try { janela.center(); } catch (eCenter) {}
    janela.show();
    janela.update();

    return {
      atualizar: function (passo, texto) {
        var atual = Math.max(0, Math.min(alvoTotal, passo || 0));
        var pct = Math.round((atual / alvoTotal) * 100);
        barra.value = atual;
        pctTexto.text = atual + ' / ' + alvoTotal + ' (' + pct + '%)';
        if (texto !== undefined) rotulo.text = String(texto);
        janela.update();
      },
      cancelado: function () {
        return abortado;
      },
      fechar: function () {
        janela.close();
      }
    };
  };

  /* Formulario visual ------------------------------------------------ */

  /**
   * Formulario generico visual.
   *
   * campos: array de objetos
   *   { id, rotulo, tipo: 'texto'|'numero'|'pasta'|'arquivo'|'escolha'|'booleano'|'preview',
   *     padrao, opcoes: string[], ajuda, grupo, presets: Array, cores: Array,
   *     desenhar: Function(g, w, h, valores, desenho, captionCtrl), legenda: string }
   *
   * opcoesUi (opcional): { subtitulo, largura, rotuloLargura, tag }
   *
   * @returns {object|null} mapa id -> valor, ou null se cancelado
   */
  ui.formulario = function (titulo, campos, textoOk, opcoesUi) {
    var cfg = opcoesUi || {};
    var janela = new Window('dialog', titulo || IBD.MARCA);
    janela.orientation = 'column';
    janela.alignChildren = 'fill';
    janela.margins = 10;
    janela.spacing = 7;

    criarCabecalhoVisual(
      janela,
      titulo || IBD.MARCA,
      cfg.subtitulo || 'Configure os parametros abaixo e acompanhe a previa.',
      cfg.tag || IBD.MARCA
    );

    var controles = {};
    var previews = [];
    var grupos = {};
    var ordemGrupos = [];
    var pesosGrupo = {};
    var totalCamposReais = 0;
    var i;

    for (i = 0; i < campos.length; i++) {
      var cm = campos[i];
      if (cm.tipo === 'preview') continue;
      totalCamposReais++;
      if (cm.grupo) {
        if (!pesosGrupo[cm.grupo]) {
          ordemGrupos.push(cm.grupo);
          pesosGrupo[cm.grupo] = 0;
        }
        pesosGrupo[cm.grupo] += 1 + (cm.presets && cm.presets.length ? 0.6 : 0) +
          (cm.cores && cm.cores.length ? 0.6 : 0) + (cm.ajuda ? 0.5 : 0);
      }
    }

    // Divide em 2 colunas quando ha varios grupos/campos para evitar estouro vertical em telas 1080p/125-150% DPI.
    var duasColunas = cfg.colunas === 2 ||
      (cfg.colunas !== 1 && (ordemGrupos.length >= 3 || (ordemGrupos.length >= 2 && totalCamposReais >= 7)));

    if (cfg.largura) {
      janela.preferredSize.width = duasColunas ? Math.max(cfg.largura, 660) : cfg.largura;
    } else if (duasColunas) {
      janela.preferredSize.width = 680;
    }

    var areaPreview = janela.add('group');
    areaPreview.orientation = 'column';
    areaPreview.alignChildren = 'fill';
    areaPreview.spacing = 4;

    var paiGrupos = {};
    if (duasColunas) {
      var linhaCols = janela.add('group');
      linhaCols.orientation = 'row';
      linhaCols.alignChildren = ['fill', 'top'];
      linhaCols.alignment = 'fill';
      linhaCols.spacing = 8;

      var colEsq = linhaCols.add('group');
      colEsq.orientation = 'column';
      colEsq.alignChildren = 'fill';
      colEsq.alignment = ['fill', 'top'];
      colEsq.spacing = 6;

      var colDir = linhaCols.add('group');
      colDir.orientation = 'column';
      colDir.alignChildren = 'fill';
      colDir.alignment = ['fill', 'top'];
      colDir.spacing = 6;

      var pesoEsq = 0;
      var pesoDir = 0;
      for (i = 0; i < ordemGrupos.length; i++) {
        var gn = ordemGrupos[i];
        if (pesoEsq <= pesoDir) {
          paiGrupos[gn] = colEsq;
          pesoEsq += pesosGrupo[gn] + 0.8;
        } else {
          paiGrupos[gn] = colDir;
          pesoDir += pesosGrupo[gn] + 0.8;
        }
      }
    }

    var rotuloLarg = cfg.rotuloLargura || (duasColunas ? 116 : 148);
    var escolhaLarg = duasColunas ? 168 : 210;
    var janelaAberta = false;

    function obterContainer(nomeGrupo, ehPreview) {
      if (ehPreview) {
        if (!nomeGrupo) return areaPreview;
        var chavePrev = '__prev__' + nomeGrupo;
        if (!grupos[chavePrev]) {
          var pnlP = areaPreview.add('panel', undefined, nomeGrupo);
          pnlP.orientation = 'column';
          pnlP.alignChildren = 'fill';
          pnlP.margins = 8;
          pnlP.spacing = 4;
          grupos[chavePrev] = pnlP;
        }
        return grupos[chavePrev];
      }
      if (!nomeGrupo) return janela;
      if (!grupos[nomeGrupo]) {
        var destino = (duasColunas && paiGrupos[nomeGrupo]) ? paiGrupos[nomeGrupo] : janela;
        var pnl = destino.add('panel', undefined, nomeGrupo);
        pnl.orientation = 'column';
        pnl.alignChildren = 'fill';
        pnl.margins = 9;
        pnl.spacing = 5;
        grupos[nomeGrupo] = pnl;
      }
      return grupos[nomeGrupo];
    }

    function lerTodosValores() {
      var vals = {};
      for (var k = 0; k < campos.length; k++) {
        var c = campos[k];
        if (c.tipo === 'preview') continue;
        vals[c.id] = lerCampo(c, controles[c.id]);
      }
      return vals;
    }

    function atualizarPrevias() {
      var vals = lerTodosValores();
      if (typeof cfg.aoMudar === 'function') {
        try { cfg.aoMudar(controles, vals); } catch (eHook) {}
      }
      if (!previews.length) return;
      for (var p = 0; p < previews.length; p++) {
        previews[p].valores = vals;
        if (previews[p].legendaFn && previews[p].caption) {
          try { previews[p].caption.text = String(previews[p].legendaFn(vals) || ''); } catch (eCap) {}
        }
        if (janelaAberta) {
          try {
            if (typeof previews[p].canvas.notify === 'function') previews[p].canvas.notify('onDraw');
          } catch (eDraw) {}
        }
      }
    }

    for (i = 0; i < campos.length; i++) {
      var campo = campos[i];
      var ehPrev = campo.tipo === 'preview';
      var pai = obterContainer(campo.grupo, ehPrev);

      if (ehPrev) {
        var prev = montarPreview(pai, campo, lerTodosValores, duasColunas);
        previews.push(prev);
        controles[campo.id] = prev.canvas;
      } else {
        controles[campo.id] = montarCampo(pai, campo, rotuloLarg, escolhaLarg, atualizarPrevias);
      }
    }

    atualizarPrevias();

    var linhaBotoes = janela.add('group');
    linhaBotoes.orientation = 'row';
    linhaBotoes.alignment = 'right';
    linhaBotoes.spacing = 8;
    var btnCancel = linhaBotoes.add('button', undefined, 'Cancelar', { name: 'cancel' });
    btnCancel.preferredSize.width = 92;
    var btnOk = linhaBotoes.add('button', undefined, textoOk || 'Executar', { name: 'ok' });
    btnOk.preferredSize.width = 122;

    try {
      janela.onShow = function () {
        janelaAberta = true;
        atualizarPrevias();
      };
    } catch (eShow) {}

    try { janela.center(); } catch (eCenter) {}
    if (janela.show() !== 1) return null;

    var valores = {};
    for (i = 0; i < campos.length; i++) {
      if (campos[i].tipo === 'preview') continue;
      valores[campos[i].id] = lerCampo(campos[i], controles[campos[i].id]);
    }
    return valores;
  };

  function montarPreview(pai, campo, lerValoresFn, duasColunas) {
    var box = pai.add('group');
    box.orientation = 'column';
    box.alignChildren = 'fill';
    box.spacing = 3;

    var canvas = box.add('panel', undefined, '');
    var largura = campo.largura || (duasColunas ? 600 : 360);
    var altura = duasColunas ? Math.min(campo.altura || 96, 98) : (campo.altura || 112);
    canvas.preferredSize.width = largura;
    canvas.preferredSize.height = altura;
    pintarFundo(canvas, [0.078, 0.086, 0.102, 1]);

    var reg = {
      canvas: canvas,
      caption: null,
      legendaFn: typeof campo.legenda === 'function' ? campo.legenda : null,
      valores: {}
    };

    var caption = box.add('statictext', undefined, typeof campo.legenda === 'string' ? campo.legenda : '');
    caption.preferredSize.width = largura;
    pintarTexto(caption, [0.714, 0.737, 0.784, 1], 10, false);
    reg.caption = caption;

    try {
      canvas.onDraw = function () {
        var g = canvas.graphics;
        if (!g || !g.newBrush) return;
        var w = (canvas.size && canvas.size[0]) ? canvas.size[0] : largura;
        var h = (canvas.size && canvas.size[1]) ? canvas.size[1] : altura;
        ui.desenho.fundo(g, w, h, [0.078, 0.086, 0.102, 1], [0.227, 0.251, 0.302, 1]);
        var vals = reg.valores || (lerValoresFn ? lerValoresFn() : {});
        if (typeof campo.desenhar === 'function') {
          try { campo.desenhar(g, w, h, vals, ui.desenho, caption); } catch (eDes) {}
        }
      };
    } catch (eHook) {}

    return reg;
  }

  function ligarEvento(ctrl, tipo, cb) {
    if (!ctrl || !cb) return;
    try {
      if (tipo === 'booleano') {
        ctrl.onClick = cb;
      } else if (tipo === 'escolha') {
        ctrl.onChange = cb;
      } else {
        ctrl.onChanging = cb;
        ctrl.onChange = cb;
      }
    } catch (e) {}
  }

  function montarCampo(pai, campo, rotuloLargura, escolhaLargura, aoAlterar) {
    var grupo = pai.add('group');
    grupo.orientation = 'row';
    grupo.alignChildren = ['left', 'center'];
    grupo.alignment = 'fill';
    grupo.spacing = 6;

    if (campo.tipo !== 'booleano') {
      var rotulo = grupo.add('statictext', undefined, campo.rotulo);
      rotulo.preferredSize.width = rotuloLargura;
    }

    var controle;

    switch (campo.tipo) {
      case 'booleano':
        controle = grupo.add('checkbox', undefined, campo.rotulo);
        controle.value = !!campo.padrao;
        ligarEvento(controle, 'booleano', aoAlterar);
        break;

      case 'escolha':
        controle = grupo.add('dropdownlist', undefined, campo.opcoes || []);
        controle.selection = indiceDe(campo.opcoes, campo.padrao);
        controle.preferredSize.width = escolhaLargura || 210;
        ligarEvento(controle, 'escolha', aoAlterar);
        break;

      case 'numero':
        controle = grupo.add('edittext', undefined, String(campo.padrao === undefined ? '' : campo.padrao));
        controle.characters = 10;
        ligarEvento(controle, 'numero', aoAlterar);
        break;

      case 'pasta':
      case 'arquivo':
        controle = grupo.add('edittext', undefined, campo.padrao ? String(campo.padrao) : '');
        controle.characters = 22;
        controle.alignment = ['fill', 'center'];
        ligarEvento(controle, campo.tipo, aoAlterar);
        var procurar = grupo.add('button', undefined, 'Procurar...');
        procurar.preferredSize.width = 74;
        procurar.onClick = (function (entrada, tipo, rotuloCampo) {
          return function () {
            var escolhido = tipo === 'pasta'
              ? Folder.selectDialog(rotuloCampo)
              : File.openDialog(rotuloCampo);
            if (escolhido) {
              entrada.text = escolhido.fsName;
              if (aoAlterar) aoAlterar();
            }
          };
        })(controle, campo.tipo, campo.rotulo);
        break;

      default:
        controle = grupo.add('edittext', undefined, campo.padrao ? String(campo.padrao) : '');
        controle.characters = 20;
        controle.alignment = ['fill', 'center'];
        ligarEvento(controle, 'texto', aoAlterar);
    }

    /* Chips de atalho rapido (presets) ------------------------------- */
    if (campo.presets && campo.presets.length) {
      var rowPresets = pai.add('group');
      rowPresets.orientation = 'row';
      rowPresets.alignChildren = ['left', 'center'];
      rowPresets.spacing = 3;

      var lblAtalho = rowPresets.add('statictext', undefined, 'Atalhos:');
      lblAtalho.preferredSize.width = rotuloLargura;
      pintarTexto(lblAtalho, [0.58, 0.62, 0.68, 1], 10, false);

      for (var p = 0; p < campo.presets.length; p++) {
        var pr = campo.presets[p];
        var labelBtn = typeof pr === 'object' && pr !== null ? String(pr.rotulo) : String(pr);
        var valorBtn = typeof pr === 'object' && pr !== null ? pr.valor : pr;
        var chip = rowPresets.add('button', undefined, labelBtn);
        chip.preferredSize.height = 20;
        chip.onClick = (function (ctrlAlvo, tipoAlvo, opcoesAlvo, val) {
          return function () {
            if (tipoAlvo === 'escolha') {
              ctrlAlvo.selection = indiceDe(opcoesAlvo, String(val));
            } else {
              ctrlAlvo.text = String(val);
            }
            if (aoAlterar) aoAlterar();
          };
        })(controle, campo.tipo, campo.opcoes, valorBtn);
      }
    }

    /* Amostras visuais de cor (swatches) ---------------------------- */
    if (campo.cores && campo.cores.length) {
      var rowCores = pai.add('group');
      rowCores.orientation = 'row';
      rowCores.alignChildren = ['left', 'center'];
      rowCores.spacing = 4;

      var lblCor = rowCores.add('statictext', undefined, 'Cores:');
      lblCor.preferredSize.width = rotuloLargura;
      pintarTexto(lblCor, [0.58, 0.62, 0.68, 1], 10, false);

      for (var cIdx = 0; cIdx < campo.cores.length; cIdx++) {
        var corDef = campo.cores[cIdx];
        var wrapCor = rowCores.add('group');
        wrapCor.orientation = 'row';
        wrapCor.spacing = 2;
        var swatch = wrapCor.add('panel', undefined, '');
        swatch.preferredSize.width = 12;
        swatch.preferredSize.height = 12;
        if (corDef.rgb) {
          pintarFundo(swatch, ui.desenho.cor(corDef.rgb[0], corDef.rgb[1], corDef.rgb[2], 1));
        }
        var btnCor = wrapCor.add('button', undefined, corDef.curto || corDef.valor);
        btnCor.preferredSize.height = 20;
        btnCor.onClick = (function (ctrlAlvo, opcoesAlvo, val) {
          return function () {
            ctrlAlvo.selection = indiceDe(opcoesAlvo, val);
            if (aoAlterar) aoAlterar();
          };
        })(controle, campo.opcoes, corDef.valor);
      }
    }

    if (campo.ajuda) {
      var ajuda = pai.add('statictext', undefined, campo.ajuda, { multiline: true });
      ajuda.preferredSize.height = 22;
      pintarTexto(ajuda, [0.58, 0.62, 0.68, 1], 10, false);
    }

    return controle;
  }

  function lerCampo(campo, controle) {
    switch (campo.tipo) {
      case 'booleano':
        return controle.value;
      case 'escolha':
        return controle.selection ? controle.selection.text : null;
      case 'numero':
        var n = parseFloat(String(controle.text).replace(',', '.'));
        return isNaN(n) ? campo.padrao : n;
      case 'pasta':
        return controle.text ? new Folder(controle.text) : null;
      case 'arquivo':
        return controle.text ? new File(controle.text) : null;
      default:
        return String(controle.text).trim();
    }
  }

  function indiceDe(opcoes, valor) {
    if (!opcoes || !opcoes.length) return null;
    for (var i = 0; i < opcoes.length; i++) {
      if (opcoes[i] === valor) return i;
    }
    return 0;
  }

  /** Relatorio final padronizado em cartao visual (ou alerta em modo simulado). */
  ui.resumo = function (titulo, linhas) {
    var lista = linhas || [];
    if (typeof ScriptUI === 'undefined') {
      IBD.alerta(lista.join('\n'), titulo || IBD.MARCA);
      return;
    }
    try {
      var win = new Window('dialog', titulo || IBD.MARCA);
      win.orientation = 'column';
      win.alignChildren = 'fill';
      win.margins = 14;
      win.spacing = 10;
      win.preferredSize.width = 400;

      criarCabecalhoVisual(win, titulo || IBD.MARCA, 'Execucao concluida', 'OK');

      var corpo = win.add('panel', undefined, 'Resumo');
      corpo.orientation = 'column';
      corpo.alignChildren = 'fill';
      corpo.margins = 12;
      corpo.spacing = 4;

      var i;
      for (i = 0; i < lista.length; i++) {
        var ln = corpo.add('statictext', undefined, String(lista[i]), { multiline: true });
        ln.preferredSize.width = 350;
      }

      var rodape = win.add('group');
      rodape.alignment = 'right';
      rodape.add('button', undefined, 'Fechar', { name: 'ok' });
      try { win.center(); } catch (eCenter) {}
      win.show();
    } catch (e) {
      IBD.alerta(lista.join('\n'), titulo || IBD.MARCA);
    }
  };

  IBD.ui = ui;
})($.global.IBD);
