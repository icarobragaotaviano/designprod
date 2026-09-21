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
