/**
 * IBD Ferramentas — Painel encaixavel para After Effects (ScriptUI Panel).
 * Copie este arquivo para a pasta "Scripts/ScriptUI Panels/" do After Effects
 * e abra em Janela (Window) > IBD Ferramentas Painel.jsx.
 *
 * Gerado automaticamente por tools/build-plugin.mjs — v0.1.0
 */
#target aftereffects

(function (thisObj) {
/* ----- ibd-core.jsx ----- */
/**
 * ibd-core.jsx — nucleo comum dos scripts ExtendScript do estudio.
 *
 * ExtendScript e ES3: nao existe let/const, arrow function, JSON nativo
 * nem varios metodos de Array/String. Este arquivo normaliza isso e
 * expoe o namespace global IBD, usado por todos os scripts de apps/.
 *
 * Uso dentro de um script:
 *   #include "../../../core/extendscript/ibd-core.jsx"
 *
 * Compatibilidade: Photoshop, Illustrator, InDesign, After Effects,
 * Premiere Pro (painel de scripts) e Bridge.
 */

// eslint-disable-next-line no-unused-vars
var IBD = (function (host) {
  var api = host.IBD || {};

  api.VERSAO = '0.1.0';
  api.MARCA = 'IBD';

  /* ---------------------------------------------------------------- *
   * Polyfills ES5 minimos
   * ---------------------------------------------------------------- */

  if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (item, from) {
      var i = from || 0;
      for (; i < this.length; i++) {
        if (this[i] === item) return i;
      }
      return -1;
    };
  }

  if (!Array.prototype.forEach) {
    Array.prototype.forEach = function (fn, escopo) {
      for (var i = 0; i < this.length; i++) fn.call(escopo, this[i], i, this);
    };
  }

  if (!Array.prototype.map) {
    Array.prototype.map = function (fn, escopo) {
      var saida = [];
      for (var i = 0; i < this.length; i++) saida.push(fn.call(escopo, this[i], i, this));
      return saida;
    };
  }

  if (!Array.prototype.filter) {
    Array.prototype.filter = function (fn, escopo) {
      var saida = [];
      for (var i = 0; i < this.length; i++) {
        if (fn.call(escopo, this[i], i, this)) saida.push(this[i]);
      }
      return saida;
    };
  }

  if (!String.prototype.trim) {
    String.prototype.trim = function () {
      return String(this).replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, '');
    };
  }

  if (!Object.keys) {
    Object.keys = function (obj) {
      var chaves = [];
      for (var k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) chaves.push(k);
      }
      return chaves;
    };
  }

  /* ---------------------------------------------------------------- *
   * Host: qual app Adobe esta executando
   * ---------------------------------------------------------------- */

  /**
   * Identificador curto do app hospedeiro.
   * @returns {string} photoshop | illustrator | indesign | aftereffects |
   *                   premiere | bridge | desconhecido
   */
  api.host = function () {
    var nome = '';
    try {
      nome = String(BridgeTalk.appName).toLowerCase();
    } catch (e) {
      try {
        nome = String(app.name).toLowerCase();
      } catch (e2) {
        nome = '';
      }
    }
    if (nome.indexOf('photoshop') > -1) return 'photoshop';
    if (nome.indexOf('illustrator') > -1) return 'illustrator';
    if (nome.indexOf('indesign') > -1) return 'indesign';
    if (nome.indexOf('aftereffects') > -1 || nome.indexOf('after effects') > -1) return 'aftereffects';
    if (nome.indexOf('premiere') > -1) return 'premiere';
    if (nome.indexOf('bridge') > -1) return 'bridge';
    return 'desconhecido';
  };

  /**
   * Interrompe o script com mensagem clara quando o app nao e suportado.
   * @param {string[]} suportados lista de ids aceitos, ex: ['photoshop']
   */
  api.exigirHost = function (suportados) {
    var atual = api.host();
    if (suportados.indexOf(atual) === -1) {
      api.alerta(
        'Este script roda em: ' + suportados.join(', ') + '.\n' +
        'App detectado: ' + atual + '.'
      );
      throw new Error('Host nao suportado: ' + atual);
    }
    return atual;
  };

  /* ---------------------------------------------------------------- *
   * JSON (ExtendScript nao tem nativo)
   * ---------------------------------------------------------------- */

  api.json = {};

  api.json.stringify = function (valor, indentacao) {
    var pad = indentacao === undefined ? '' : indentacao;
    return serializar(valor, pad, '');
  };

  function serializar(valor, pad, prefixo) {
    var t = typeof valor;
    if (valor === null || valor === undefined) return 'null';
    if (t === 'number') return isFinite(valor) ? String(valor) : 'null';
    if (t === 'boolean') return valor ? 'true' : 'false';
    if (t === 'string') return citar(valor);

    var quebra = pad ? '\n' : '';
    var dentro = prefixo + pad;
    var sep = pad ? ',' + quebra + dentro : ',';
    var i;

    if (valor instanceof Array) {
      if (!valor.length) return '[]';
      var itens = [];
      for (i = 0; i < valor.length; i++) itens.push(serializar(valor[i], pad, dentro));
      return '[' + quebra + dentro + itens.join(sep) + quebra + prefixo + ']';
    }

    var chaves = Object.keys(valor);
    if (!chaves.length) return '{}';
    var pares = [];
    for (i = 0; i < chaves.length; i++) {
      pares.push(citar(chaves[i]) + (pad ? ': ' : ':') + serializar(valor[chaves[i]], pad, dentro));
    }
    return '{' + quebra + dentro + pares.join(sep) + quebra + prefixo + '}';
  }

  function citar(texto) {
    var s = String(texto)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    return '"' + s + '"';
  }

  /**
   * Parser JSON restrito. Rejeita conteudo que nao seja JSON valido antes
   * de avaliar, para nao executar codigo arbitrario vindo de arquivo.
   */
  api.json.parse = function (texto) {
    var limpo = String(texto).replace(/^\uFEFF/, '');
    var seguro = limpo
      .replace(/"(\\.|[^"\\])*"/g, '')
      .replace(/-?\d+(\.\d*)?([eE][+\-]?\d+)?/g, '')
      .replace(/true|false|null/g, '')
      .replace(/[\s\[\]{}:,]/g, '');
    if (seguro !== '') {
      throw new Error('JSON invalido.');
    }
    return eval('(' + limpo + ')');
  };

  /* ---------------------------------------------------------------- *
   * Log e mensagens
   * ---------------------------------------------------------------- */

  api.silencioso = false;

  api.log = function (mensagem) {
    $.writeln('[' + api.MARCA + '] ' + mensagem);
  };

  api.alerta = function (mensagem, titulo) {
    if (api.silencioso) {
      api.log('ALERTA: ' + mensagem);
      return;
    }
    alert(String(mensagem), titulo || api.MARCA);
  };

  api.confirmar = function (mensagem) {
    if (api.silencioso) return true;
    return confirm(String(mensagem), false, api.MARCA);
  };

  /**
   * Executa uma funcao capturando erro e reportando de forma legivel.
   * Retorna { ok: boolean, valor: *, erro: Error|null }.
   */
  api.executar = function (rotulo, fn) {
    try {
      return { ok: true, valor: fn(), erro: null };
    } catch (e) {
      var detalhe = rotulo + ': ' + (e.message || e);
      if (e.line) detalhe += '\n(linha ' + e.line + ')';
      api.log('ERRO ' + detalhe);
      api.alerta(detalhe, api.MARCA + ' — erro');
      return { ok: false, valor: null, erro: e };
    }
  };

  /* ---------------------------------------------------------------- *
   * Utilidades de texto
   * ---------------------------------------------------------------- */

  /** Remove acentos, espacos e caracteres proibidos em nome de arquivo. */
  api.slug = function (texto) {
    var s = String(texto);
    var de = 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ';
    var para = 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN';
    var saida = '';
    for (var i = 0; i < s.length; i++) {
      var idx = de.indexOf(s.charAt(i));
      saida += idx > -1 ? para.charAt(idx) : s.charAt(i);
    }
    return saida
      .replace(/[^A-Za-z0-9\-_ ]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  /** Preenche com zeros a esquerda: pad(7, 3) -> "007" */
  api.pad = function (numero, digitos) {
    var s = String(numero);
    while (s.length < digitos) s = '0' + s;
    return s;
  };

  /** Carimbo de data AAAAMMDD-HHMM, util em nome de pasta de export. */
  api.carimbo = function () {
    var d = new Date();
    return (
      d.getFullYear() +
      api.pad(d.getMonth() + 1, 2) +
      api.pad(d.getDate(), 2) +
      '-' +
      api.pad(d.getHours(), 2) +
      api.pad(d.getMinutes(), 2)
    );
  };

  host.IBD = api;
  return api;
})($.global);

/* ----- ibd-prefs.jsx ----- */
/**
 * ibd-prefs.jsx — preferencias por script, gravadas em JSON na pasta
 * de dados do usuario. Serve para o script lembrar a ultima pasta de
 * saida, o ultimo formato escolhido, etc.
 *
 * Requer ibd-core.jsx e ibd-fs.jsx.
 */

(function (IBD) {
  var prefs = {};

  function arquivoDe(idScript) {
    return new File(IBD.fs.pastaDados().fsName + '/prefs-' + IBD.slug(idScript) + '.json');
  }

  /** Le as preferencias do script; devolve {} quando nao houver. */
  prefs.ler = function (idScript) {
    try {
      return IBD.fs.lerJSON(arquivoDe(idScript)) || {};
    } catch (e) {
      IBD.log('Preferencias ilegiveis de ' + idScript + ': ' + e.message);
      return {};
    }
  };

  /** Grava (merge raso) e devolve o estado final. */
  prefs.gravar = function (idScript, valores) {
    var atual = prefs.ler(idScript);
    var chaves = Object.keys(valores);
    for (var i = 0; i < chaves.length; i++) {
      var v = valores[chaves[i]];
      if (v instanceof Folder || v instanceof File) v = v.fsName;
      atual[chaves[i]] = v;
    }
    try {
      IBD.fs.escreverJSON(arquivoDe(idScript), atual);
    } catch (e) {
      IBD.log('Nao foi possivel gravar preferencias: ' + e.message);
    }
    return atual;
  };

  IBD.prefs = prefs;
})($.global.IBD);

/* ----- ibd-ui.jsx ----- */
/**
 * ibd-ui.jsx — ScriptUI Visual 2.0: cabecalho visual, paineis agrupados,
 * previa grafica em tempo real, chips de atalho, progresso e resumo.
 * Requer ibd-core.jsx carregado antes.
 *
 * Mantem compatibilidade retroativa com chamadas simples de formulario e
 * degradacao segura em ambientes simulados sem ScriptUIGraphics.
 */

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
    box.margins = 12;
    box.spacing = 10;
    pintarFundo(box, [0.094, 0.102, 0.122, 1]);

    var selo = box.add('statictext', undefined, tagBadge || IBD.MARCA || 'IBD');
    selo.preferredSize.width = 44;
    pintarFundo(selo, [0.941, 0.769, 0.098, 1]);
    pintarTexto(selo, [0.086, 0.094, 0.114, 1], 12, true);

    var col = box.add('group');
    col.orientation = 'column';
    col.alignChildren = ['left', 'top'];
    col.spacing = 2;

    var lblTitulo = col.add('statictext', undefined, String(titulo || IBD.MARCA));
    pintarTexto(lblTitulo, [0.894, 0.906, 0.933, 1], 13, true);

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
    janela.margins = 14;
    janela.spacing = 10;
    if (cfg.largura) janela.preferredSize.width = cfg.largura;

    criarCabecalhoVisual(
      janela,
      titulo || IBD.MARCA,
      cfg.subtitulo || 'Configure os parametros abaixo e acompanhe a previa.',
      cfg.tag || IBD.MARCA
    );

    var controles = {};
    var previews = [];
    var grupos = {};
    var i;

    function obterContainer(nomeGrupo) {
      if (!nomeGrupo) return janela;
      if (!grupos[nomeGrupo]) {
        var pnl = janela.add('panel', undefined, nomeGrupo);
        pnl.orientation = 'column';
        pnl.alignChildren = 'fill';
        pnl.margins = 12;
        pnl.spacing = 8;
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
      if (!previews.length) return;
      var vals = lerTodosValores();
      for (var p = 0; p < previews.length; p++) {
        previews[p].valores = vals;
        if (previews[p].legendaFn && previews[p].caption) {
          try { previews[p].caption.text = String(previews[p].legendaFn(vals) || ''); } catch (eCap) {}
        }
        try {
          if (typeof previews[p].canvas.notify === 'function') previews[p].canvas.notify('onDraw');
        } catch (eDraw) {}
      }
    }

    for (i = 0; i < campos.length; i++) {
      var campo = campos[i];
      var pai = obterContainer(campo.grupo);

      if (campo.tipo === 'preview') {
        var prev = montarPreview(pai, campo, lerTodosValores);
        previews.push(prev);
        controles[campo.id] = prev.canvas;
      } else {
        controles[campo.id] = montarCampo(pai, campo, cfg.rotuloLargura || 150, atualizarPrevias);
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
    btnOk.preferredSize.width = 118;

    if (janela.show() !== 1) return null;

    var valores = {};
    for (i = 0; i < campos.length; i++) {
      if (campos[i].tipo === 'preview') continue;
      valores[campos[i].id] = lerCampo(campos[i], controles[campos[i].id]);
    }
    return valores;
  };

  function montarPreview(pai, campo, lerValoresFn) {
    var box = pai.add('group');
    box.orientation = 'column';
    box.alignChildren = 'fill';
    box.spacing = 4;

    var canvas = box.add('panel', undefined, '');
    var largura = campo.largura || 360;
    var altura = campo.altura || 126;
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

  function ligarEvento(ctrl, cb) {
    if (!ctrl || !cb) return;
    try {
      ctrl.onChange = cb;
      ctrl.onChanging = cb;
      ctrl.onClick = cb;
    } catch (e) {}
  }

  function montarCampo(pai, campo, rotuloLargura, aoAlterar) {
    var grupo = pai.add('group');
    grupo.orientation = 'row';
    grupo.alignChildren = ['left', 'center'];
    grupo.alignment = 'fill';

    if (campo.tipo !== 'booleano') {
      var rotulo = grupo.add('statictext', undefined, campo.rotulo);
      rotulo.preferredSize.width = rotuloLargura;
    }

    var controle;

    switch (campo.tipo) {
      case 'booleano':
        controle = grupo.add('checkbox', undefined, campo.rotulo);
        controle.value = !!campo.padrao;
        ligarEvento(controle, aoAlterar);
        break;

      case 'escolha':
        controle = grupo.add('dropdownlist', undefined, campo.opcoes || []);
        controle.selection = indiceDe(campo.opcoes, campo.padrao);
        controle.preferredSize.width = 210;
        ligarEvento(controle, aoAlterar);
        break;

      case 'numero':
        controle = grupo.add('edittext', undefined, String(campo.padrao === undefined ? '' : campo.padrao));
        controle.characters = 10;
        ligarEvento(controle, aoAlterar);
        break;

      case 'pasta':
      case 'arquivo':
        controle = grupo.add('edittext', undefined, campo.padrao ? String(campo.padrao) : '');
        controle.characters = 26;
        controle.alignment = ['fill', 'center'];
        ligarEvento(controle, aoAlterar);
        var procurar = grupo.add('button', undefined, 'Procurar...');
        procurar.preferredSize.width = 76;
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
        controle.characters = 24;
        controle.alignment = ['fill', 'center'];
        ligarEvento(controle, aoAlterar);
    }

    /* Chips de atalho rapido (presets) ------------------------------- */
    if (campo.presets && campo.presets.length) {
      var rowPresets = pai.add('group');
      rowPresets.orientation = 'row';
      rowPresets.alignChildren = ['left', 'center'];
      rowPresets.spacing = 4;

      var lblAtalho = rowPresets.add('statictext', undefined, 'Atalhos:');
      lblAtalho.preferredSize.width = rotuloLargura;
      pintarTexto(lblAtalho, [0.58, 0.62, 0.68, 1], 10, false);

      for (var p = 0; p < campo.presets.length; p++) {
        var pr = campo.presets[p];
        var labelBtn = typeof pr === 'object' && pr !== null ? String(pr.rotulo) : String(pr);
        var valorBtn = typeof pr === 'object' && pr !== null ? pr.valor : pr;
        var chip = rowPresets.add('button', undefined, labelBtn);
        chip.preferredSize.height = 22;
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
      rowCores.spacing = 6;

      var lblCor = rowCores.add('statictext', undefined, 'Cores:');
      lblCor.preferredSize.width = rotuloLargura;
      pintarTexto(lblCor, [0.58, 0.62, 0.68, 1], 10, false);

      for (var cIdx = 0; cIdx < campo.cores.length; cIdx++) {
        var corDef = campo.cores[cIdx];
        var wrapCor = rowCores.add('group');
        wrapCor.orientation = 'row';
        wrapCor.spacing = 3;
        var swatch = wrapCor.add('panel', undefined, '');
        swatch.preferredSize.width = 14;
        swatch.preferredSize.height = 14;
        if (corDef.rgb) {
          pintarFundo(swatch, ui.desenho.cor(corDef.rgb[0], corDef.rgb[1], corDef.rgb[2], 1));
        }
        var btnCor = wrapCor.add('button', undefined, corDef.curto || corDef.valor);
        btnCor.preferredSize.height = 22;
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
      ajuda.preferredSize.height = 24;
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
      win.show();
    } catch (e) {
      IBD.alerta(lista.join('\n'), titulo || IBD.MARCA);
    }
  };

  IBD.ui = ui;
})($.global.IBD);

  var FERRAMENTAS = [
    {
      id: "aftereffects/organizar-projeto",
      titulo: "Organizar pastas do projeto",
      descricao: "Cria a estrutura padrão de pastas no painel Project e move composições, sólidos, imagens, vídeos e áudios para seus respectivos diretórios.",
      icone: "organizacao",
      executar: function () {
/**
 * @ibd-id aftereffects/organizar-projeto
 * @ibd-titulo Organizar pastas do projeto
 * @ibd-descricao Cria a estrutura padrão de pastas no painel Project e move composições, sólidos, imagens, vídeos e áudios para seus respectivos diretórios.
 * @ibd-app aftereffects
 * @ibd-versao 1.0.0
 * @ibd-tags organizacao, projeto
 */



(function () {
  IBD.exigirHost(['aftereffects']);

  if (!app.project) {
    IBD.alerta('Abra um projeto antes de rodar este script.');
    return;
  }

  var ESTRUTURA = ['01_COMPS', '02_PRECOMPS', '03_IMAGENS', '04_VIDEO', '05_AUDIO', '06_SOLIDOS'];

  var opcoes = IBD.ui.formulario('Organizar pastas do projeto', [
    {
      id: 'previa',
      tipo: 'preview',
      grupo: 'Estrutura de pastas',
      largura: 360,
      altura: 86,
      legenda: function (v) {
        return v.separarPrecomps ? '01_COMPS · 02_PRECOMPS · 03_IMAGENS · 04_VIDEO · 05_AUDIO · 06_SOLIDOS' : '01_COMPS · 03_IMAGENS · 04_VIDEO · 05_AUDIO · 06_SOLIDOS';
      },
      desenhar: function (g, w, h, v, d) {
        var pastasPrev = v.separarPrecomps
          ? ['01_COMPS', '02_PRECOMPS', '03_IMAGENS', '04_VIDEO', '05_AUDIO', '06_SOLIDOS']
          : ['01_COMPS', '03_IMAGENS', '04_VIDEO', '05_AUDIO', '06_SOLIDOS'];
        for (var k = 0; k < pastasPrev.length; k++) {
          var col = k % 3, row = Math.floor(k / 3);
          var px = 14 + col * 114, py = 14 + row * 32;
          d.retangulo(g, px, py, 104, 24, d.cor(32, 38, 48, 1), d.cor(104, 168, 232, 0.8), 1);
          d.texto(g, pastasPrev[k], px + 8, py + 5, d.cor(228, 231, 238, 1), 9, true);
        }
      }
    },
    {
      id: 'separarPrecomps',
      rotulo: 'Separar precomps',
      grupo: 'Regras de organização',
      tipo: 'booleano',
      padrao: true,
      ajuda: 'Composicoes usadas dentro de outras vao para 02_PRECOMPS.'
    },
    { id: 'confirmar', rotulo: 'Mover itens ja organizados', grupo: 'Regras de organização', tipo: 'booleano', padrao: false }
  ], 'Organizar projeto', {
    subtitulo: 'Cria as pastas padrão no painel Project e classifica os itens',
    largura: 420
  });

  if (!opcoes) return;

  app.beginUndoGroup('IBD — Organizar projeto');

  var movidos = 0;
  var barra = null;

  try {
    var pastas = {};
    for (var p = 0; p < ESTRUTURA.length; p++) {
      pastas[ESTRUTURA[p]] = obterOuCriarPasta(ESTRUTURA[p]);
    }

    var itens = [];
    for (var i = 1; i <= app.project.numItems; i++) {
      var item = app.project.item(i);
      if (item instanceof FolderItem) continue;
      if (!opcoes.confirmar && item.parentFolder !== app.project.rootFolder) continue;
      itens.push(item);
    }

    var usadasComoPrecomp = opcoes.separarPrecomps ? mapearPrecomps() : {};

    barra = IBD.ui.progresso(itens.length, 'Organizando projeto');

    for (var k = 0; k < itens.length; k++) {
      if (barra.cancelado()) break;
      barra.atualizar(k, itens[k].name);
      var destino = classificar(itens[k], usadasComoPrecomp, pastas);
      if (destino && itens[k].parentFolder !== destino) {
        itens[k].parentFolder = destino;
        movidos++;
      }
    }
  } catch (e) {
    IBD.alerta('Erro ao organizar: ' + (e.message || e));
  } finally {
    if (barra) barra.fechar();
    app.endUndoGroup();
  }

  IBD.ui.resumo('Organizar projeto', [
    'Itens movidos: ' + movidos,
    '',
    'Estrutura: ' + ESTRUTURA.join(', '),
    'Use Editar > Desfazer para reverter tudo de uma vez.'
  ]);

  function obterOuCriarPasta(nome) {
    for (var i = 1; i <= app.project.numItems; i++) {
      var item = app.project.item(i);
      if (item instanceof FolderItem && item.name === nome && item.parentFolder === app.project.rootFolder) {
        return item;
      }
    }
    return app.project.items.addFolder(nome);
  }

  /** Marca por id as comps que aparecem como camada dentro de outra comp. */
  function mapearPrecomps() {
    var mapa = {};
    for (var i = 1; i <= app.project.numItems; i++) {
      var comp = app.project.item(i);
      if (!(comp instanceof CompItem)) continue;
      for (var c = 1; c <= comp.numLayers; c++) {
        var camada = comp.layer(c);
        if (camada.source && camada.source instanceof CompItem) {
          mapa[camada.source.id] = true;
        }
      }
    }
    return mapa;
  }

  function classificar(item, precomps, pastas) {
    if (item instanceof CompItem) {
      return precomps[item.id] ? pastas['02_PRECOMPS'] : pastas['01_COMPS'];
    }

    if (item instanceof FootageItem) {
      var fonte = item.mainSource;

      if (fonte instanceof SolidSource) return pastas['06_SOLIDOS'];

      if (fonte instanceof FileSource) {
        if (item.hasVideo && item.hasAudio) return pastas['04_VIDEO'];
        if (!item.hasVideo && item.hasAudio) return pastas['05_AUDIO'];
        if (item.duration > 0 && item.frameRate > 0) return pastas['04_VIDEO'];
        return pastas['03_IMAGENS'];
      }
    }

    return null;
  }
})();
      }
    }
  ];

  var win = (thisObj instanceof Panel)
    ? thisObj
    : new Window('palette', 'IBD Ferramentas', undefined, { resizeable: true });
  win.orientation = 'column';
  win.alignChildren = ['fill', 'top'];
  win.spacing = 8;
  win.margins = 10;

  var cab = win.add('panel', undefined, '');
  cab.orientation = 'row';
  cab.alignChildren = ['left', 'center'];
  cab.alignment = 'fill';
  cab.margins = 8;
  try {
    var gCab = cab.graphics;
    gCab.backgroundColor = gCab.newBrush(gCab.BrushType.SOLID_COLOR, [0.094, 0.102, 0.122, 1]);
  } catch (e) {}
  var selo = cab.add('statictext', undefined, 'IBD');
  try {
    var gSelo = selo.graphics;
    gSelo.backgroundColor = gSelo.newBrush(gSelo.BrushType.SOLID_COLOR, [0.941, 0.769, 0.098, 1]);
    gSelo.foregroundColor = gSelo.newPen(gSelo.PenType.SOLID_COLOR, [0.086, 0.094, 0.114, 1], 1);
  } catch (e) {}
  cab.add('statictext', undefined, 'After Effects · v0.1.0');

  var grpBusca = win.add('group');
  grpBusca.orientation = 'row';
  grpBusca.alignChildren = ['fill', 'center'];
  grpBusca.add('statictext', undefined, 'Filtrar:');
  var inpBusca = grpBusca.add('edittext', undefined, '');
  inpBusca.alignment = ['fill', 'center'];

  var listaGrupo = win.add('panel', undefined, 'Ferramentas instaladas');
  listaGrupo.orientation = 'column';
  listaGrupo.alignChildren = ['fill', 'top'];
  listaGrupo.alignment = ['fill', 'fill'];
  listaGrupo.spacing = 6;
  listaGrupo.margins = 8;

  var lblStatus = win.add('statictext', undefined, 'Pronto. Clique em Executar.');

  function desenharMiniIcone(canvas, iconeId) {
    canvas.onDraw = function () {
      var g = this.graphics;
      var c = IBD.ui.desenho;
      c.fundo(g, 24, 24, c.cor(24, 26, 31), c.cor(58, 64, 77));
      if (iconeId === 'organizacao') {
        c.retangulo(g, 4, 6, 16, 12, null, c.cor(104, 168, 232), 1.5);
        c.linha(g, 4, 10, 20, 10, c.cor(104, 168, 232), 1.5);
      } else {
        c.retangulo(g, 5, 5, 14, 14, null, c.cor(240, 196, 25), 1.5);
        c.linha(g, 8, 12, 16, 12, c.cor(240, 196, 25), 1.5);
      }
    };
  }

  function preencher(filtro) {
    while (listaGrupo.children.length > 0) {
      listaGrupo.remove(listaGrupo.children[0]);
    }
    var q = String(filtro || '').toLowerCase().replace(/^\s+|\s+$/g, '');
    for (var i = 0; i < FERRAMENTAS.length; i++) {
      var item = FERRAMENTAS[i];
      if (q && item.titulo.toLowerCase().indexOf(q) === -1 && item.descricao.toLowerCase().indexOf(q) === -1) {
        continue;
      }
      var row = listaGrupo.add('panel', undefined, '');
      row.orientation = 'row';
      row.alignChildren = ['left', 'center'];
      row.alignment = 'fill';
      row.margins = 8;
      row.spacing = 8;

      var iconeCanvas = row.add('group');
      iconeCanvas.preferredSize.width = 24;
      iconeCanvas.preferredSize.height = 24;
      desenharMiniIcone(iconeCanvas, item.icone);

      var colTxt = row.add('group');
      colTxt.orientation = 'column';
      colTxt.alignChildren = ['left', 'top'];
      colTxt.alignment = ['fill', 'center'];
      colTxt.spacing = 2;
      colTxt.add('statictext', undefined, item.titulo);
      var sub = colTxt.add('statictext', undefined, item.descricao, { multiline: true });
      sub.preferredSize.width = 180;

      var btn = row.add('button', undefined, 'Executar');
      (function (alvo) {
        btn.onClick = function () {
          lblStatus.text = 'Executando: ' + alvo.titulo + '...';
          try {
            alvo.executar();
            lblStatus.text = 'Concluido: ' + alvo.titulo;
          } catch (err) {
            lblStatus.text = 'Erro: ' + (err && err.message ? err.message : err);
          }
        };
      })(item);
    }
    win.layout.layout(true);
  }

  inpBusca.onChanging = function () {
    preencher(inpBusca.text);
  };

  win.onResizing = win.onResize = function () {
    this.layout.resize();
  };

  preencher('');

  if (win instanceof Window) {
    win.center();
    win.show();
  } else {
    win.layout.layout(true);
  }
})(this);
