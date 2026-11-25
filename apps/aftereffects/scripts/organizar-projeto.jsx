/**
 * @ibd-id aftereffects/organizar-projeto
 * @ibd-titulo Organizar pastas do projeto
 * @ibd-descricao Cria a estrutura padrão de pastas no painel Project e move composições, sólidos, imagens, vídeos e áudios para seus respectivos diretórios.
 * @ibd-app aftereffects
 * @ibd-versao 1.0.0
 * @ibd-tags organizacao, projeto
 */

#target aftereffects

#include "../../../core/extendscript/ibd-ui.jsx"

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
