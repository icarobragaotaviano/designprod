/**
 * @ibd-id photoshop/alinhar-distribuir
 * @ibd-titulo Alinhar e distribuir camadas
 * @ibd-descricao Alinha as camadas selecionadas pela seleção, pela tela ou por uma camada de referência e distribui o espaço entre elas.
 * @ibd-app photoshop
 * @ibd-versao 1.0.0
 * @ibd-tags auto-layout, alinhar, distribuir, camadas, espacamento
 *
 * Família Auto Layout. Guia: docs/auto-layout.md. Testes: npm run test:layout.
 * A execução dentro do Photoshop ainda precisa ser validada.
 *
 * O Photoshop alinha camadas pela barra de opções, mas sempre pela seleção
 * inteira e sem espaçamento fixo. Aqui dá para escolher a referência e pedir
 * um espaço exato em mm entre as peças — o que a arte-final precisa.
 */

#target photoshop

#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-prefs.jsx"
#include "../../../core/extendscript/ibd-ps-camadas.jsx"

(function () {
  var ID = 'photoshop/alinhar-distribuir';

  var REFERENCIAS = {
    'Área das camadas selecionadas': 'selecao',
    'Tela do documento': 'tela',
    'Camada ativa (fica parada)': 'ativa'
  };
  var HORIZONTAIS = { 'Não alterar': 'nenhum', 'Esquerda': 'inicio', 'Centro': 'centro', 'Direita': 'fim' };
  var VERTICAIS = { 'Não alterar': 'nenhum', 'Topo': 'inicio', 'Meio': 'centro', 'Base': 'fim' };
  var DISTRIBUICOES = {
    'Não distribuir': null,
    'Horizontal — espaço igual entre bordas': { eixo: 'horizontal', modo: 'bordas' },
    'Horizontal — centros igualmente espaçados': { eixo: 'horizontal', modo: 'centros' },
    'Horizontal — espaço fixo': { eixo: 'horizontal', modo: 'fixo' },
    'Vertical — espaço igual entre bordas': { eixo: 'vertical', modo: 'bordas' },
    'Vertical — centros igualmente espaçados': { eixo: 'vertical', modo: 'centros' },
    'Vertical — espaço fixo': { eixo: 'vertical', modo: 'fixo' }
  };

  function listar(mapa) {
    var saida = [];
    for (var k in mapa) {
      if (Object.prototype.hasOwnProperty.call(mapa, k)) saida.push(k);
    }
    return saida;
  }

  IBD.exigirHost(['photoshop']);

  if (!app.documents.length) {
    IBD.alerta('Abra um documento antes de alinhar camadas.');
    return;
  }

  var doc = app.activeDocument;
  var resolucao = doc.resolution;

  var camadas = IBD.ps.emPixels(function () { return IBD.ps.selecionadas(doc); });

  if (camadas.length < 2) {
    IBD.alerta(
      'Selecione ao menos duas camadas no painel Camadas.\n\n' +
      'Para organizar o conteúdo de um grupo inteiro, use "Auto layout do quadro".'
    );
    return;
  }

  /* 1. Opções ---------------------------------------------------------- */

  var salvas = IBD.prefs.ler(ID) || {};

  var resposta = IBD.ui.formulario('Alinhar e distribuir — ' + camadas.length + ' camadas', [
    {
      id: 'referencia', rotulo: 'Alinhar em relação a', tipo: 'escolha', opcoes: listar(REFERENCIAS),
      padrao: salvas.referencia || 'Área das camadas selecionadas'
    },
    { id: 'horizontal', rotulo: 'Horizontal', tipo: 'escolha', opcoes: listar(HORIZONTAIS), padrao: salvas.horizontal || 'Não alterar' },
    { id: 'vertical', rotulo: 'Vertical', tipo: 'escolha', opcoes: listar(VERTICAIS), padrao: salvas.vertical || 'Não alterar' },
    {
      id: 'distribuir', rotulo: 'Distribuir', tipo: 'escolha', opcoes: listar(DISTRIBUICOES),
      padrao: salvas.distribuir || 'Não distribuir',
      ajuda: 'A distribuição roda depois do alinhamento e mantém a primeira e a última camada no lugar.'
    },
    { id: 'unidade', rotulo: 'Unidade', tipo: 'escolha', opcoes: ['px', 'mm', 'cm', 'pt'], padrao: salvas.unidade || 'px' },
    { id: 'espaco', rotulo: 'Espaço fixo', tipo: 'numero', padrao: salvas.espaco === undefined ? 10 : salvas.espaco },
    { id: 'comEfeitos', rotulo: 'Medir incluindo efeitos de camada', tipo: 'booleano', padrao: !!salvas.comEfeitos },
    { id: 'incluirOcultas', rotulo: 'Incluir camadas ocultas', tipo: 'booleano', padrao: !!salvas.incluirOcultas }
  ], 'Aplicar');

  if (!resposta) return;
  IBD.prefs.gravar(ID, resposta);

  var modoH = HORIZONTAIS[resposta.horizontal] || 'nenhum';
  var modoV = VERTICAIS[resposta.vertical] || 'nenhum';
  var distrib = DISTRIBUICOES[resposta.distribuir] || null;

  if (modoH === 'nenhum' && modoV === 'nenhum' && !distrib) {
    IBD.alerta('Nada foi pedido: escolha um alinhamento, uma distribuição, ou os dois.');
    return;
  }

  /* 2. Medir e calcular ------------------------------------------------ */

  var medida = null;
  var finais = null;
  var caixa = null;

  var calculo = IBD.executar('Cálculo do alinhamento', function () {
    return IBD.ps.emPixels(function () {
      medida = IBD.ps.medir(camadas, {
        comEfeitos: resposta.comEfeitos,
        incluirOcultas: resposta.incluirOcultas
      });

      if (medida.itens.length < 2) {
        throw new Error(
          'Menos de duas camadas puderam ser medidas.\n' +
          'Camadas vazias, ocultas ou bloqueadas ficam de fora.'
        );
      }

      var referencia = REFERENCIAS[resposta.referencia] || 'selecao';
      if (referencia === 'tela') {
        caixa = { x: 0, y: 0, largura: doc.width.as('px'), altura: doc.height.as('px') };
      } else if (referencia === 'ativa') {
        var alvo = IBD.ps.limites(doc.activeLayer, !!resposta.comEfeitos);
        if (!alvo) throw new Error('A camada ativa não tem pixels para servir de referência.');
        caixa = { x: alvo.x, y: alvo.y, largura: alvo.w, altura: alvo.h };
      } else {
        caixa = IBD.layout.envolver(medida.itens);
      }

      var passo = medida.itens;
      if (modoH !== 'nenhum' || modoV !== 'nenhum') {
        passo = IBD.layout.alinhar(passo, caixa, modoH, modoV).itens;
      }
      if (distrib) {
        var espacoPx = IBD.ps.emPx(resposta.espaco, resposta.unidade || 'px', resolucao);
        passo = IBD.layout.distribuir(passo, distrib.eixo, distrib.modo, espacoPx).itens;
      }

      // Os passos encadeados guardam o deslocamento de cada etapa; o que
      // interessa para mover a camada é a diferença contra a posição original.
      finais = [];
      for (var i = 0; i < passo.length; i++) {
        var origem = null;
        for (var j = 0; j < medida.itens.length; j++) {
          if (medida.itens[j].ref === passo[i].ref) { origem = medida.itens[j]; break; }
        }
        if (!origem) continue;
        var dx = passo[i].x - origem.x;
        var dy = passo[i].y - origem.y;
        finais.push({
          id: passo[i].id, ref: passo[i].ref, dx: dx, dy: dy,
          moveu: Math.abs(dx) > 0.000001 || Math.abs(dy) > 0.000001,
          redimensionou: false
        });
      }
      return true;
    });
  });
  if (!calculo.ok) return;

  /* 3. Aplicar --------------------------------------------------------- */

  var relatorio = null;
  var aplicacao = IBD.executar('Aplicação do alinhamento', function () {
    IBD.ps.historico(doc, 'IBD — Alinhar e distribuir', function () {
      IBD.ps.emPixels(function () {
        relatorio = IBD.ps.aplicar(finais, { redimensionar: false });
      });
    });
    return true;
  });
  if (!aplicacao.ok) return;

  /* 4. Relatório ------------------------------------------------------- */

  var linhas = [];
  linhas.push(relatorio.movidas + ' camada(s) movida(s) de ' + medida.itens.length + ' consideradas.');
  linhas.push('Referência: ' + Math.round(caixa.largura) + ' × ' + Math.round(caixa.altura) + ' px' +
    ' em ' + Math.round(caixa.x) + ', ' + Math.round(caixa.y) + '.');

  if (medida.descartadas.length) {
    linhas.push('');
    linhas.push('Fora do alinhamento:');
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

  IBD.ui.resumo('Alinhar e distribuir', linhas);
})();
