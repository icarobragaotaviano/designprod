/**
 * @ibd-id aftereffects/organizar-projeto
 * @ibd-titulo Organizar projeto
 * @ibd-descricao Cria a estrutura de pastas padrão do estúdio e move composições, sólidos, imagens, vídeos e áudio para os lugares certos.
 * @ibd-app aftereffects
 * @ibd-versao 1.0.0
 * @ibd-tags organizacao, projeto
 */

#include "../../../core/extendscript/ibd-ui.jsx"

(function () {
  IBD.exigirHost(['aftereffects']);

  if (!app.project) {
    IBD.alerta('Abra um projeto antes de rodar este script.');
    return;
  }

  var ESTRUTURA = ['01_COMPS', '02_PRECOMPS', '03_IMAGENS', '04_VIDEO', '05_AUDIO', '06_SOLIDOS'];

  var opcoes = IBD.ui.formulario('Organizar projeto', [
    {
      id: 'separarPrecomps',
      rotulo: 'Separar precomps',
      tipo: 'booleano',
      padrao: true,
      ajuda: 'Composicoes usadas dentro de outras vao para 02_PRECOMPS.'
    },
    { id: 'confirmar', rotulo: 'Mover itens ja organizados', tipo: 'booleano', padrao: false }
  ]);

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
