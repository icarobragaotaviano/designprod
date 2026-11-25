/* Folha no CEP do Illustrator. O host recebe somente a geometria numérica recalculada. */
(function (root) {
  'use strict';

  root.IBDIniciarFolha = function (cs) {
    var painel = document.getElementById('folha-painel');
    if (!painel) return;
    painel.hidden = false;
    var form = document.getElementById('folha-form');
    var arquivo = document.getElementById('folha-arquivo');
    var previa = document.getElementById('folha-previa');
    var diagrama = document.getElementById('folha-diagrama');
    var aplicar = document.getElementById('folha-aplicar');
    var arte = document.getElementById('folha-arte');
    var plano;
    var ocupado = false;
    var revisao = 0;
    if (!root.FolhaOperacoes) {
      previa.textContent = 'O Folha requer uma versão do painel CEP com suporte ao motor JavaScript atual.';
      aplicar.disabled = true;
      arquivo.disabled = true;
      form.hidden = true;
      return;
    }

    function limpar(mensagem) {
      plano = null;
      aplicar.disabled = true;
      arte.checked = false;
      arte.disabled = true;
      diagrama.setAttribute('hidden', '');
      diagrama.textContent = '';
      previa.textContent = mensagem || '';
    }

    function calcular(entrada) {
      limpar();
      try {
        if (entrada.operacao !== 'montar-pecas') throw Error('Selecione um plano de Montagem e virada.');
        var calculado = root.FolhaOperacoes.executar(entrada);
        var r = calculado.resultado;
        var mensagens = calculado.diagnosticos.map(function (item) { return item.mensagem; });
        previa.textContent = (calculado.materializavel ? r.count + ' peças por folha · ' + r.total + ' folhas · ' + calculado.faces.length + ' face(s). ' : '') + mensagens.join(' ');
        if (!calculado.materializavel || !calculado.faces.length) return;
        plano = calculado;
        var s = plano.parametros;
        diagrama.setAttribute('viewBox', '0 0 ' + s.sw + ' ' + s.sh);
        diagrama.removeAttribute('hidden');
        function desenhar(p, cor) {
          var ret = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          ret.setAttribute('x', p.x); ret.setAttribute('y', p.y);
          ret.setAttribute('width', p.w); ret.setAttribute('height', p.h);
          ret.setAttribute('fill', cor); ret.setAttribute('stroke', '#333');
          diagrama.appendChild(ret);
        }
        desenhar({x: 0, y: 0, w: s.sw, h: s.sh}, '#fff');
        plano.faces[0].items.forEach(function (p) { desenhar(p, p.label === 'V' ? '#92b8e2' : '#bbd398'); });
        arte.disabled = s.style !== 'single' || ocupado;
        aplicar.disabled = ocupado;
      } catch (erro) {
        limpar(erro.message);
      }
    }

    form.addEventListener('input', function () { revisao += 1; limpar(); });
    form.addEventListener('submit', function (evento) {
      evento.preventDefault();
      revisao += 1;
      var valores = {};
      ['sw', 'sh', 'pw', 'ph', 'bleed', 'gapX', 'qty'].forEach(function (chave) {
        valores[chave] = Number(form.elements[chave].value);
      });
      valores.gapY = valores.gapX;
      calcular({ versaoContrato: 1, operacao: 'montar-pecas', parametros: valores });
    });
    arquivo.addEventListener('change', function () {
      var selecionado = arquivo.files[0];
      if (!selecionado) return;
      var leitura = ++revisao;
      limpar();
      arquivo.value = '';
      if (selecionado.size > 4 * 1024 * 1024) { limpar('O arquivo Folha excede 4 MB.'); return; }
      var leitor = new FileReader();
      leitor.onload = function () {
        if (leitura !== revisao) return;
        try { calcular(JSON.parse(String(leitor.result).replace(/^\uFEFF/, ''))); }
        catch (erro) { limpar('O arquivo não contém um plano Folha válido.'); }
      };
      leitor.onerror = function () { if (leitura === revisao) limpar('Não foi possível ler o plano.'); };
      leitor.readAsText(selecionado);
    });
    aplicar.addEventListener('click', function () {
      if (!plano || ocupado) return;
      var s = plano.parametros;
      var texto = [[1, s.sw, s.sh, s.bleed, arte.checked ? 1 : 0, plano.faces.length].join(',')];
      plano.faces.forEach(function (face) {
        texto.push(face.items.map(function (p) { return [p.x, p.y, p.w, p.h, p.angle].join(','); }).join(';'));
      });
      ocupado = true;
      aplicar.disabled = true;
      arte.disabled = true;
      var emAplicacao = revisao;
      cs.evalScript('ibdAplicarFolha(' + JSON.stringify(texto.join('|')) + ')', function (res) {
        ocupado = false;
        aplicar.disabled = !plano;
        arte.disabled = !plano || plano.parametros.style !== 'single';
        if (emAplicacao === revisao) previa.textContent = res === 'OK' ? 'Pranchetas Folha criadas.' : (res || 'Sem resposta do Illustrator.');
      });
    });
  };
})(window);
