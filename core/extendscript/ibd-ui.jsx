/**
 * ibd-ui.jsx — ScriptUI: barra de progresso e formulario generico.
 * Requer ibd-core.jsx carregado antes.
 *
 * O formulario existe para que nenhum script precise desenhar dialogo
 * do zero: descreve-se os campos, recebe-se os valores.
 */
#include "ibd-core.jsx"

(function (IBD) {
  var ui = {};

  /**
   * Barra de progresso em janela flutuante.
   * @param {number} total numero de passos
   * @param {string} titulo
   * @returns {{atualizar: Function, cancelado: Function, fechar: Function}}
   */
  ui.progresso = function (total, titulo) {
    var janela = new Window('palette', titulo || IBD.MARCA, undefined, { closeButton: false });
    janela.orientation = 'column';
    janela.alignChildren = 'fill';
    janela.margins = 16;
    janela.spacing = 8;
    janela.preferredSize.width = 380;

    var rotulo = janela.add('statictext', undefined, 'Preparando...');
    rotulo.characters = 44;
    var barra = janela.add('progressbar', undefined, 0, Math.max(total, 1));
    barra.preferredSize.height = 10;
    var botao = janela.add('button', undefined, 'Cancelar');

    var abortado = false;
    botao.onClick = function () {
      abortado = true;
      rotulo.text = 'Cancelando...';
    };

    janela.show();
    janela.update();

    return {
      atualizar: function (passo, texto) {
        barra.value = passo;
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

  /**
   * Formulario generico.
   *
   * campos: array de objetos
   *   { id, rotulo, tipo: 'texto'|'numero'|'pasta'|'arquivo'|'escolha'|'booleano',
   *     padrao, opcoes: string[] (escolha), ajuda }
   *
   * @returns {object|null} mapa id -> valor, ou null se cancelado
   */
  ui.formulario = function (titulo, campos, textoOk) {
    var janela = new Window('dialog', titulo || IBD.MARCA);
    janela.orientation = 'column';
    janela.alignChildren = 'fill';
    janela.margins = 16;
    janela.spacing = 10;

    var controles = {};
    var i;

    for (i = 0; i < campos.length; i++) {
      controles[campos[i].id] = montarCampo(janela, campos[i]);
    }

    var linhaBotoes = janela.add('group');
    linhaBotoes.alignment = 'right';
    linhaBotoes.add('button', undefined, 'Cancelar', { name: 'cancel' });
    linhaBotoes.add('button', undefined, textoOk || 'Executar', { name: 'ok' });

    if (janela.show() !== 1) return null;

    var valores = {};
    for (i = 0; i < campos.length; i++) {
      valores[campos[i].id] = lerCampo(campos[i], controles[campos[i].id]);
    }
    return valores;
  };

  function montarCampo(pai, campo) {
    var grupo = pai.add('group');
    grupo.orientation = 'row';
    grupo.alignChildren = ['left', 'center'];
    grupo.alignment = 'fill';

    if (campo.tipo !== 'booleano') {
      var rotulo = grupo.add('statictext', undefined, campo.rotulo);
      rotulo.preferredSize.width = 130;
    }

    var controle;

    switch (campo.tipo) {
      case 'booleano':
        controle = grupo.add('checkbox', undefined, campo.rotulo);
        controle.value = !!campo.padrao;
        break;

      case 'escolha':
        controle = grupo.add('dropdownlist', undefined, campo.opcoes || []);
        controle.selection = indiceDe(campo.opcoes, campo.padrao);
        controle.preferredSize.width = 220;
        break;

      case 'numero':
        controle = grupo.add('edittext', undefined, String(campo.padrao === undefined ? '' : campo.padrao));
        controle.characters = 8;
        break;

      case 'pasta':
      case 'arquivo':
        controle = grupo.add('edittext', undefined, campo.padrao ? String(campo.padrao) : '');
        controle.characters = 28;
        controle.alignment = ['fill', 'center'];
        var procurar = grupo.add('button', undefined, '...');
        procurar.preferredSize.width = 34;
        procurar.onClick = (function (entrada, tipo, rotuloCampo) {
          return function () {
            var escolhido = tipo === 'pasta'
              ? Folder.selectDialog(rotuloCampo)
              : File.openDialog(rotuloCampo);
            if (escolhido) entrada.text = escolhido.fsName;
          };
        })(controle, campo.tipo, campo.rotulo);
        break;

      default:
        controle = grupo.add('edittext', undefined, campo.padrao ? String(campo.padrao) : '');
        controle.characters = 28;
        controle.alignment = ['fill', 'center'];
    }

    if (campo.ajuda) {
      var ajuda = pai.add('statictext', undefined, campo.ajuda, { multiline: true });
      ajuda.preferredSize.height = 26;
      ajuda.enabled = false;
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

  /** Relatorio final padronizado, com contagem de sucesso e falha. */
  ui.resumo = function (titulo, linhas) {
    IBD.alerta(linhas.join('\n'), titulo || IBD.MARCA);
  };

  IBD.ui = ui;
})($.global.IBD);
