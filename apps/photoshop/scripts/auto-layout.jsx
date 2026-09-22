/**
 * @ibd-id photoshop/auto-layout
 * @ibd-titulo Auto layout do quadro
 * @ibd-descricao Distribui as camadas de um grupo em linha ou coluna com espaçamento, preenchimento e alinhamento, e guarda a regra no nome do grupo.
 * @ibd-app photoshop
 * @ibd-versao 1.0.0
 * @ibd-tags auto-layout, layout, camadas, espacamento, alinhamento
 * @ibd-doc docs/auto-layout.md
 *
 * Família Auto Layout. Guia: docs/auto-layout.md. Testes: npm run test:layout.
 * A execução dentro do Photoshop ainda precisa ser validada.
 *
 * O quadro é um grupo de camadas. As camadas de dentro são os itens.
 * Com o grupo selecionado, a regra escolhida aqui fica gravada no nome dele
 * e pode ser reaplicada depois por photoshop/auto-layout-reaplicar.
 */

#target photoshop

#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-prefs.jsx"
#include "../../../core/extendscript/ibd-ps-camadas.jsx"

(function () {
  var ID = 'photoshop/auto-layout';

  var DIRECOES = { 'Horizontal — em linha': 'horizontal', 'Vertical — em coluna': 'vertical' };
  var DISTRIBUICOES = {
    'Início': 'inicio',
    'Centro': 'centro',
    'Fim': 'fim',
    'Espaço entre': 'entre',
    'Espaço ao redor': 'ao-redor',
    'Espaço uniforme': 'uniforme'
  };
  var ALINHAMENTOS = { 'Início': 'inicio', 'Centro': 'centro', 'Fim': 'fim', 'Esticar': 'esticar' };
  var ORDENS = { 'Do documento': 'documento', 'Inversa': 'inversa' };
  var AJUSTES = { 'Abraçar o conteúdo': 'conteudo', 'Manter a área atual': 'caixa' };

  function rotuloDe(mapa, valor, padrao) {
    for (var k in mapa) {
      if (Object.prototype.hasOwnProperty.call(mapa, k) && mapa[k] === valor) return k;
    }
    return padrao;
  }

  function listar(mapa) {
    var saida = [];
    for (var k in mapa) {
      if (Object.prototype.hasOwnProperty.call(mapa, k)) saida.push(k);
    }
    return saida;
  }

  IBD.exigirHost(['photoshop']);

  if (!app.documents.length) {
    IBD.alerta('Abra um documento antes de rodar o auto layout.');
    return;
  }

  var doc = app.activeDocument;
  var resolucao = doc.resolution;

  /* 1. Alvo: um grupo (quadro) ou as camadas selecionadas ------------- */

  var quadro = null;
  var camadas = [];

  IBD.ps.emPixels(function () {
    var ativa = null;
    try { ativa = doc.activeLayer; } catch (e) { ativa = null; }

    if (ativa && ativa.typename === 'LayerSet') {
      quadro = ativa;
      for (var i = 0; i < quadro.layers.length; i++) camadas.push(quadro.layers[i]);
    } else {
      var selecao = IBD.ps.selecionadas(doc);
      // Um grupo entre as selecionadas também vale como quadro.
      if (selecao.length === 1 && selecao[0].typename === 'LayerSet') {
        quadro = selecao[0];
        for (var j = 0; j < quadro.layers.length; j++) camadas.push(quadro.layers[j]);
      } else {
        camadas = selecao;
      }
    }
  });

  if (!camadas.length) {
    IBD.alerta(
      'Nada para organizar.\n\n' +
      'Selecione o grupo que será o quadro — as camadas de dentro viram os itens —\n' +
      'ou selecione duas ou mais camadas soltas no painel Camadas.'
    );
    return;
  }

  /* 2. Valores iniciais: etiqueta do grupo > última escolha > padrão --- */

  var salvas = IBD.prefs.ler(ID) || {};
  var doNome = null;

  if (quadro) {
    var leitura = IBD.executar('Etiqueta do grupo', function () { return IBD.layout.lerTag(quadro.name); });
    if (leitura.ok) doNome = leitura.valor;
  }

  var specInicial = doNome ? doNome.spec : null;
  var unidade = specInicial && specInicial.unidade ? specInicial.unidade : (salvas.unidade || 'px');

  function paraUnidade(px) {
    var v = IBD.ps.dePx(px, unidade, resolucao);
    return Math.round(v * 100) / 100;
  }

  var padInicial = specInicial
    ? [specInicial.padding.topo, specInicial.padding.direita, specInicial.padding.base, specInicial.padding.esquerda]
    : null;

  var campos = [
    {
      id: 'direcao', rotulo: 'Direção', tipo: 'escolha', opcoes: listar(DIRECOES),
      padrao: specInicial ? rotuloDe(DIRECOES, specInicial.direcao) : (salvas.direcao || 'Horizontal — em linha')
    },
    { id: 'unidade', rotulo: 'Unidade', tipo: 'escolha', opcoes: ['px', 'mm', 'cm', 'pt'], padrao: unidade },
    {
      id: 'gap', rotulo: 'Espaço entre itens', tipo: 'numero',
      padrao: specInicial ? paraUnidade(specInicial.gap) : (salvas.gap === undefined ? 24 : salvas.gap)
    },
    {
      id: 'padding', rotulo: 'Preenchimento', tipo: 'texto',
      padrao: padInicial
        ? padInicial[0] === padInicial[1] && padInicial[1] === padInicial[2] && padInicial[2] === padInicial[3]
          ? String(paraUnidade(padInicial[0]))
          : paraUnidade(padInicial[0]) + ' ' + paraUnidade(padInicial[1]) + ' ' + paraUnidade(padInicial[2]) + ' ' + paraUnidade(padInicial[3])
        : (salvas.padding === undefined ? '0' : salvas.padding),
      ajuda: 'Um valor para os quatro lados, dois para vertical e horizontal, ou quatro: topo direita base esquerda.'
    },
    {
      id: 'distribuicao', rotulo: 'Eixo principal', tipo: 'escolha', opcoes: listar(DISTRIBUICOES),
      padrao: specInicial ? rotuloDe(DISTRIBUICOES, specInicial.distribuicao) : (salvas.distribuicao || 'Início'),
      ajuda: 'As opções de espaço repartem a sobra do quadro e ignoram o espaço entre itens.'
    },
    {
      id: 'alinhamento', rotulo: 'Eixo transversal', tipo: 'escolha', opcoes: listar(ALINHAMENTOS),
      padrao: specInicial ? rotuloDe(ALINHAMENTOS, specInicial.alinhamento) : (salvas.alinhamento || 'Início')
    },
    {
      id: 'ajuste', rotulo: 'Medida do quadro', tipo: 'escolha', opcoes: listar(AJUSTES),
      padrao: specInicial ? rotuloDe(AJUSTES, specInicial.ajuste) : (salvas.ajuste || 'Abraçar o conteúdo')
    },
    {
      id: 'quebra', rotulo: 'Quebrar em', tipo: 'numero',
      padrao: specInicial ? paraUnidade(specInicial.quebra) : (salvas.quebra === undefined ? 0 : salvas.quebra),
      ajuda: 'Medida do quadro no eixo principal a partir da qual os itens passam para a linha seguinte. 0 não quebra.'
    },
    {
      id: 'gapLinha', rotulo: 'Espaço entre linhas', tipo: 'numero',
      padrao: specInicial ? paraUnidade(specInicial.gapLinha) : (salvas.gapLinha === undefined ? 24 : salvas.gapLinha)
    },
    {
      id: 'ordem', rotulo: 'Ordem dos itens', tipo: 'escolha', opcoes: listar(ORDENS),
      padrao: specInicial ? rotuloDe(ORDENS, specInicial.ordem) : (salvas.ordem || 'Do documento')
    },
    { id: 'comEfeitos', rotulo: 'Medir incluindo efeitos de camada', tipo: 'booleano', padrao: !!salvas.comEfeitos },
    { id: 'incluirOcultas', rotulo: 'Incluir camadas ocultas', tipo: 'booleano', padrao: !!salvas.incluirOcultas },
    {
      id: 'redimensionar', rotulo: 'Deixar "Esticar" alterar o tamanho', tipo: 'booleano',
      padrao: !!salvas.redimensionar,
      ajuda: 'Sem isso, Esticar só alinha. Com isso, camadas de pixel são reamostradas.'
    },
    { id: 'salvarRegra', rotulo: 'Guardar a regra no nome do grupo', tipo: 'booleano', padrao: salvas.salvarRegra === undefined ? true : !!salvas.salvarRegra }
  ];

  var titulo = quadro
    ? 'Auto layout — quadro "' + IBD.layout.nomeLimpo(quadro.name) + '"'
    : 'Auto layout — ' + camadas.length + ' camadas selecionadas';

  var resposta = IBD.ui.formulario(titulo, campos, 'Aplicar layout');
  if (!resposta) return;
  IBD.prefs.gravar(ID, resposta);

  /* 3. Especificação em pixels do documento --------------------------- */

  var montagem = IBD.executar('Leitura das medidas', function () {
    var un = resposta.unidade || 'px';
    var pad = IBD.layout.lerPadding(resposta.padding);
    return {
      direcao: DIRECOES[resposta.direcao] || 'horizontal',
      gap: IBD.ps.emPx(resposta.gap, un, resolucao),
      gapLinha: IBD.ps.emPx(resposta.gapLinha, un, resolucao),
      padding: [
        IBD.ps.emPx(pad[0], un, resolucao),
        IBD.ps.emPx(pad[1], un, resolucao),
        IBD.ps.emPx(pad[2], un, resolucao),
        IBD.ps.emPx(pad[3], un, resolucao)
      ],
      distribuicao: DISTRIBUICOES[resposta.distribuicao] || 'inicio',
      alinhamento: ALINHAMENTOS[resposta.alinhamento] || 'inicio',
      quebra: IBD.ps.emPx(resposta.quebra, un, resolucao),
      ordem: ORDENS[resposta.ordem] || 'documento',
      ajuste: AJUSTES[resposta.ajuste] || 'conteudo',
      unidade: un
    };
  });
  if (!montagem.ok) return;
  var spec = montagem.valor;

  /* 4. Medir, calcular, aplicar --------------------------------------- */

  var medida = null;
  var plano = null;

  var preparo = IBD.executar('Medição das camadas', function () {
    return IBD.ps.emPixels(function () {
      medida = IBD.ps.medir(camadas, { comEfeitos: resposta.comEfeitos, incluirOcultas: resposta.incluirOcultas });
      if (!medida.itens.length) {
        throw new Error(
          'Nenhuma camada pôde ser medida.\n' +
          'Camadas vazias, ocultas ou bloqueadas ficam de fora do layout.'
        );
      }
      plano = IBD.layout.calcular(spec, medida.itens);
      return true;
    });
  });
  if (!preparo.ok) return;

  var relatorio = null;
  var aplicacao = IBD.executar('Aplicação do layout', function () {
    IBD.ps.historico(doc, 'IBD — Auto layout', function () {
      IBD.ps.emPixels(function () {
        relatorio = IBD.ps.aplicar(plano.itens, { redimensionar: resposta.redimensionar });
        if (quadro && resposta.salvarRegra) {
          quadro.name = IBD.layout.escreverTag(quadro.name, spec);
        }
      });
    });
    return true;
  });
  if (!aplicacao.ok) return;

  /* 5. Relatório ------------------------------------------------------ */

  var linhas = [];
  linhas.push(relatorio.movidas + ' camada(s) reposicionada(s) de ' + medida.itens.length + ' no layout.');
  if (relatorio.redimensionadas) linhas.push(relatorio.redimensionadas + ' camada(s) esticada(s).');
  linhas.push('Quadro: ' + Math.round(plano.caixa.largura) + ' × ' + Math.round(plano.caixa.altura) + ' px' +
    (plano.linhas > 1 ? ' em ' + plano.linhas + ' linhas.' : '.'));
  linhas.push(IBD.layout.descrever(spec));

  if (medida.descartadas.length) {
    linhas.push('');
    linhas.push('Fora do layout:');
    for (var d = 0; d < medida.descartadas.length; d++) {
      linhas.push('  • ' + medida.descartadas[d].nome + ' — ' + medida.descartadas[d].motivo);
    }
  }

  if (relatorio.falhas.length) {
    linhas.push('');
    linhas.push('Não foi possível mover:');
    for (var f = 0; f < relatorio.falhas.length; f++) {
      linhas.push('  • ' + relatorio.falhas[f].nome + ' — ' + relatorio.falhas[f].motivo);
    }
  }

  if (plano.avisos.length) {
    linhas.push('');
    for (var a = 0; a < plano.avisos.length; a++) linhas.push('Atenção: ' + plano.avisos[a]);
  }

  linhas.push('');
  if (quadro && resposta.salvarRegra) {
    linhas.push('Regra guardada em "' + quadro.name + '".');
    linhas.push('Depois de editar o conteúdo, rode "Reaplicar auto layout".');
  } else if (!quadro) {
    linhas.push('As camadas soltas foram posicionadas, mas a regra não foi guardada:');
    linhas.push('agrupe-as (Ctrl+G / Cmd+G) e rode de novo para poder reaplicar.');
  }

  IBD.ui.resumo('Auto layout', linhas);
})();
