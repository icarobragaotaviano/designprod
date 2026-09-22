/**
 * @ibd-id photoshop/auto-layout-reaplicar
 * @ibd-titulo Reaplicar auto layout
 * @ibd-descricao Reorganiza os grupos que já têm regra de auto layout no nome, do mais interno para o mais externo, depois de editar o conteúdo.
 * @ibd-app photoshop
 * @ibd-versao 1.0.0
 * @ibd-tags auto-layout, layout, camadas, atualizar
 *
 * Família Auto Layout. Guia: docs/auto-layout.md. Testes: npm run test:layout.
 * A execução dentro do Photoshop ainda precisa ser validada.
 *
 * É o passo que falta no Photoshop: trocou um texto, o item mudou de largura
 * e o resto da fila continua onde estava. Este script recalcula tudo que
 * carrega a etiqueta @auto, em um único passo de histórico.
 */

#target photoshop

#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-prefs.jsx"
#include "../../../core/extendscript/ibd-ps-camadas.jsx"

(function () {
  var ID = 'photoshop/auto-layout-reaplicar';

  IBD.exigirHost(['photoshop']);

  if (!app.documents.length) {
    IBD.alerta('Abra o documento com os quadros de auto layout.');
    return;
  }

  var doc = app.activeDocument;

  /* 1. Quadros com etiqueta ------------------------------------------- */

  var todos = IBD.ps.emPixels(function () { return IBD.ps.quadros(doc); });

  if (!todos.length) {
    IBD.alerta(
      'Nenhum quadro de auto layout neste documento.\n\n' +
      'Rode "Auto layout do quadro" em um grupo e marque\n' +
      '"Guardar a regra no nome do grupo".'
    );
    return;
  }

  var ativo = null;
  try {
    var camadaAtiva = doc.activeLayer;
    if (camadaAtiva && camadaAtiva.typename === 'LayerSet' && IBD.layout.temTag(camadaAtiva.name)) {
      ativo = camadaAtiva;
    }
  } catch (e) { ativo = null; }

  var salvas = IBD.prefs.ler(ID) || {};
  var opcoesAlvo = ['Todos os quadros do documento (' + todos.length + ')'];
  if (ativo) opcoesAlvo.push('Só o quadro selecionado');

  var resposta = IBD.ui.formulario('Reaplicar auto layout', [
    {
      id: 'alvo', rotulo: 'Quadros', tipo: 'escolha', opcoes: opcoesAlvo,
      padrao: ativo && salvas.alvo === 'Só o quadro selecionado' ? 'Só o quadro selecionado' : opcoesAlvo[0]
    },
    { id: 'comEfeitos', rotulo: 'Medir incluindo efeitos de camada', tipo: 'booleano', padrao: !!salvas.comEfeitos },
    { id: 'incluirOcultas', rotulo: 'Incluir camadas ocultas', tipo: 'booleano', padrao: !!salvas.incluirOcultas },
    {
      id: 'redimensionar', rotulo: 'Deixar "Esticar" alterar o tamanho', tipo: 'booleano',
      padrao: !!salvas.redimensionar,
      ajuda: 'Só vale para quadros cuja regra usa alinhamento Esticar.'
    }
  ], 'Reaplicar');

  if (!resposta) return;
  IBD.prefs.gravar(ID, resposta);

  // Ordem inversa da varredura: um quadro aninhado é recalculado antes do
  // quadro que o contém, para o de fora medir o filho já no tamanho novo.
  var alvos = resposta.alvo === 'Só o quadro selecionado' && ativo ? [ativo] : todos.reverse();

  /* 2. Recalcular ------------------------------------------------------ */

  var feitos = [];
  var pulados = [];
  var avisos = [];
  var totalMovidas = 0;

  var execucao = IBD.executar('Reaplicação do layout', function () {
    IBD.ps.historico(doc, 'IBD — Reaplicar auto layout', function () {
      IBD.ps.emPixels(function () {
        for (var i = 0; i < alvos.length; i++) {
          var quadro = alvos[i];
          var nome = IBD.layout.nomeLimpo(quadro.name);

          try {
            var etiqueta = IBD.layout.lerTag(quadro.name);
            if (!etiqueta) {
              pulados.push({ nome: nome, motivo: 'a etiqueta sumiu do nome' });
              continue;
            }

            var camadas = [];
            for (var j = 0; j < quadro.layers.length; j++) camadas.push(quadro.layers[j]);

            var medida = IBD.ps.medir(camadas, {
              comEfeitos: resposta.comEfeitos,
              incluirOcultas: resposta.incluirOcultas
            });

            if (!medida.itens.length) {
              pulados.push({ nome: nome, motivo: 'nenhuma camada mensurável dentro do grupo' });
              continue;
            }

            var plano = IBD.layout.calcular(etiqueta.spec, medida.itens);
            var relatorio = IBD.ps.aplicar(plano.itens, { redimensionar: resposta.redimensionar });
            totalMovidas += relatorio.movidas;

            feitos.push({
              nome: nome,
              movidas: relatorio.movidas,
              itens: medida.itens.length,
              largura: Math.round(plano.caixa.largura),
              altura: Math.round(plano.caixa.altura)
            });

            for (var a = 0; a < plano.avisos.length; a++) avisos.push(nome + ': ' + plano.avisos[a]);
            for (var f = 0; f < relatorio.falhas.length; f++) {
              avisos.push(nome + ': não foi possível mover "' + relatorio.falhas[f].nome + '" — ' + relatorio.falhas[f].motivo);
            }
          } catch (erroQuadro) {
            // Um quadro com regra corrompida não pode derrubar os outros.
            pulados.push({ nome: nome, motivo: erroQuadro.message || String(erroQuadro) });
          }
        }
      });
    });
    return true;
  });
  if (!execucao.ok) return;

  /* 3. Relatório ------------------------------------------------------- */

  var linhas = [];
  linhas.push(feitos.length + ' quadro(s) reaplicado(s), ' + totalMovidas + ' camada(s) reposicionada(s).');
  linhas.push('');

  for (var k = 0; k < feitos.length; k++) {
    linhas.push('  • ' + feitos[k].nome + ' — ' + feitos[k].itens + ' item(ns), ' +
      feitos[k].largura + ' × ' + feitos[k].altura + ' px');
  }

  if (pulados.length) {
    linhas.push('');
    linhas.push('Fora da reaplicação:');
    for (var p = 0; p < pulados.length; p++) {
      linhas.push('  • ' + pulados[p].nome + ' — ' + pulados[p].motivo);
    }
  }

  if (avisos.length) {
    linhas.push('');
    for (var v = 0; v < avisos.length; v++) linhas.push('Atenção: ' + avisos[v]);
  }

  IBD.ui.resumo('Reaplicar auto layout', linhas);
})();
