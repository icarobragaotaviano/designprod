/* Folha no CEP do Illustrator. A prévia e a montagem usam as mesmas coordenadas. */
(function (root) {
  'use strict';

  root.IBDIniciarFolha = function (cs) {
    function id(nome) { return document.getElementById('folha-' + nome); }
    var painel = id('painel');
    if (!painel) return;
    var form = id('form'), arquivo = id('arquivo'), previa = id('previa'), diagrama = id('diagrama');
    var aplicar = id('aplicar'), saida = id('saida'), status = id('status'), formato = id('formato');
    var resumoSaida = painel.querySelector('.folha-saida');
    var metricas = id('metricas'), provador = id('provador'), diagnosticos = id('diagnosticos');
    var barra = id('barra'), sangrada = id('sangrada'), producao = root.IBDFolhaProducao;
    var montagem, tecnicas, opcoes, origem, ocupado = false, podeAplicar = false, revisao = 0;
    if (!root.FolhaOperacoes || !producao) {
      previa.textContent = 'O Folha requer uma versão do painel CEP com suporte ao motor JavaScript atual.';
      form.hidden = true;
      resumoSaida.hidden = true;
      return;
    }

    root.Folha.PAPER_PRESETS.forEach(function (papel) {
      var option = document.createElement('option');
      option.value = papel.id;
      option.textContent = papel.label;
      formato.appendChild(option);
    });
    formato.value = 'nobel-t4';

    function novo() { return saida.value === 'producao' || saida.value === 'vinculada'; }

    function mostrarDiagnosticos(mensagens) {
      diagnosticos.textContent = '';
      mensagens.forEach(function (mensagem) {
        var item = document.createElement('li');
        item.textContent = mensagem;
        diagnosticos.appendChild(item);
      });
      diagnosticos.hidden = !mensagens.length;
    }

    function focarPrevia() {
      if (painel.hidden) return;
      var titulo = id('titulo-previa');
      titulo.focus({ preventScroll: true });
      titulo.scrollIntoView({ block: 'nearest' });
    }

    function limpar(mensagem) {
      montagem = null;
      podeAplicar = false;
      aplicar.disabled = true;
      metricas.hidden = true;
      provador.hidden = true;
      diagrama.textContent = '';
      painel.classList.remove('folha-calculada');
      previa.textContent = 'Calcule a montagem ou importe um plano.';
      mostrarDiagnosticos(mensagem ? [mensagem] : []);
      status.textContent = '';
    }

    function lerOpcoes() {
      function numero(nome) {
        var campo = id(nome);
        if (!campo.checkValidity()) throw Error('Medida inválida nas opções de marcas.');
        return Number(campo.value);
      }
      return {
        offset: numero('offset'), comprimento: numero('comprimento'), stroke: numero('stroke'),
        registro: id('registro').checked, barra: barra.checked, arteSangrada: sangrada.checked,
        patchW: barra.checked ? numero('patch-w') : 5, patchH: barra.checked ? numero('patch-h') : 5,
        os: id('os').value.trim()
      };
    }

    function desenho(nome, atributos) {
      var el = document.createElementNS('http://www.w3.org/2000/svg', nome);
      Object.keys(atributos).forEach(function (chave) { el.setAttribute(chave, atributos[chave]); });
      diagrama.appendChild(el);
      return el;
    }

    function desenhar(plano, t, m) {
      var s = plano.parametros;
      diagrama.textContent = '';
      diagrama.setAttribute('viewBox', '0 0 ' + s.sw + ' ' + s.sh);
      function ret(b, fill, stroke) {
        desenho('rect', { x: b[0], y: b[1], width: b[2] - b[0], height: b[3] - b[1],
          fill: fill, stroke: stroke || 'none', 'vector-effect': 'non-scaling-stroke' });
      }
      ret([0, 0, s.sw, s.sh], '#f7f6f1');
      var a = producao.imprimirEm(s, m.maquina);
      if (a[0]) ret([0, 0, a[0], s.sh], '#f2c674');
      if (a[1]) ret([0, 0, s.sw, a[1]], '#f2c674');
      if (a[2] < s.sw) ret([a[2], 0, s.sw, s.sh], '#f2c674');
      if (a[3] < s.sh) ret([0, a[3], s.sw, s.sh], '#f2c674');
      var itens = plano.faces[0].items;
      if (m.compartilhado) ret(producao.limites(itens, m.sangria), '#e8ecd8');
      itens.forEach(function (p) {
        if (!m.compartilhado) ret(producao.limites([p], m.sangria), '#e8ecd8');
        ret([p.x, p.y, p.x + p.w, p.y + p.h], p.label === 'V' ? '#d1e0ef' : '#c7d89c', '#536449');
      });
      function linha(l) {
        desenho('line', { x1: l[0], y1: l[1], x2: l[2], y2: l[3],
          stroke: '#171713', 'vector-effect': 'non-scaling-stroke' });
      }
      if (t) {
        t.linhas.forEach(linha);
        t.miras.forEach(function (p) {
          var d = p[2] * 1.6;
          desenho('circle', { cx: p[0], cy: p[1], r: p[2], fill: 'none', stroke: '#171713' });
          linha([p[0] - d, p[1], p[0] + d, p[1]]);
          linha([p[0], p[1] - d, p[0], p[1] + d]);
        });
        t.escala.forEach(function (b) {
          var rgb = b.slice(4, 7).map(function (canal) { return Math.round(255 * (1 - canal / 100) * (1 - b[7] / 100)); });
          ret([b[0], b[1], b[0] + b[2], b[1] + b[3]], 'rgb(' + rgb.join(',') + ')');
        });
        if (t.os.length) desenho('text', { x: t.os[0], y: t.os[3] - 0.5, 'font-size': 2.5, fill: '#171713' }).textContent = opcoes.os;
      }
      provador.hidden = false;
    }

    function atualizar() {
      var m = montagem;
      if (!m) return;
      podeAplicar = false;
      aplicar.disabled = true;
      var plano = m.plano, r = plano.resultado, s = plano.parametros;
      var mensagens = plano.diagnosticos.map(function (item) { return item.mensagem; });
      if (s.pieceGrain !== 'free' && s.grain === 'none') mensagens.push('Informe o sentido da fibra para aplicar a restrição do vinco.');
      var pronto = plano.materializavel && plano.faces.length;
      metricas.hidden = !pronto;
      provador.hidden = true;
      painel.classList.toggle('folha-calculada', Boolean(pronto));
      if (pronto) {
        var areaFinal = r.count * s.pw * s.ph;
        var folga = m.compartilhado ? 2 * m.sangria : 0;
        function percentual(area) {
          return (100 * areaFinal / area).toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + '%';
        }
        id('poses').textContent = r.count;
        id('rendimento').textContent = percentual(s.sw * s.sh);
        id('total').textContent = r.total.toLocaleString('pt-BR');
        previa.textContent = (origem === 'arquivo' ? 'Plano importado · ' : '') + s.sw + ' × ' + s.sh + ' mm · ' +
          r.layoutNote + ' · ' + percentual((r.area.w + folga) * (r.area.h + folga)) + ' da área útil · ' +
          plano.faces.length + (plano.faces.length === 1 ? ' face' : ' faces');
        if (r.freeComparison) previa.textContent += ' · 0°: ' + r.freeComparison.normal.count +
          ' / 90°: ' + r.freeComparison.rotate.count;
      } else {
        previa.textContent = 'Montagem indisponível para estas medidas.';
      }
      tecnicas = null;
      if (pronto) {
        try {
          if (saida.value !== 'prova' && s.style !== 'single') {
            mensagens.push('Para este plano de frente e verso, selecione Prova geométrica.');
          } else if (novo()) {
            opcoes = lerOpcoes();
            tecnicas = producao.tecnicas(m, opcoes);
            mensagens = mensagens.concat(tecnicas.avisos);
            if (saida.value === 'vinculada' && m.sangria > 0 && !opcoes.arteSangrada) {
              mensagens.push('A arte será posicionada até o corte. Confira a necessidade de sangria antes de imprimir.');
            }
            podeAplicar = !tecnicas.faltantes && (!opcoes.barra || tecnicas.escala.length > 0);
          } else podeAplicar = true;
        } catch (erro) { mensagens.push(erro.message); }
        desenhar(plano, tecnicas, m);
      }
      mostrarDiagnosticos(mensagens);
      aplicar.disabled = ocupado || !podeAplicar;
    }

    function calcularManual() {
      var valores = {};
      ['sw', 'sh', 'pw', 'ph', 'bleed', 'qty'].forEach(function (chave) {
        valores[chave] = Number(form.elements[chave].value);
      });
      ['orientation', 'grain', 'pieceGrain'].forEach(function (chave) { valores[chave] = form.elements[chave].value; });
      var usarBarra = novo() && barra.checked;
      var patchH = id('patch-h');
      if (usarBarra && !patchH.checkValidity()) throw Error('Altura do patch inválida.');
      montagem = producao.calcular(valores, {
        margem: Number(form.elements.margem.value), pinca: Number(form.elements.pinca.value),
        folga: Number(form.elements.folga.value),
        pincaLado: form.elements.pincaLado.value, compartilhado: form.elements.corte.value === 'simples',
        barra: usarBarra, patchH: Number(patchH.value)
      });
    }

    form.addEventListener('input', function (evento) {
      if (evento.target.name === 'corte') form.elements.folga.disabled = evento.target.value === 'simples';
      if (evento.target === formato) {
        var p = root.Folha.PAPER_PRESETS.find(function (papel) { return papel.id === formato.value; });
        if (p) { form.elements.sw.value = p.sw; form.elements.sh.value = p.sh; }
      } else if (evento.target.name === 'sw' || evento.target.name === 'sh') formato.value = '';
      origem = null;
      revisao += 1;
      limpar();
    });
    form.addEventListener('invalid', function (evento) {
      var detalhe = evento.target.closest('details');
      if (detalhe) detalhe.open = true;
    }, true);
    form.addEventListener('submit', function (evento) {
      evento.preventDefault();
      revisao += 1;
      limpar();
      origem = 'manual';
      try { calcularManual(); atualizar(); }
      catch (erro) { limpar(erro.message); }
      focarPrevia();
    });

    resumoSaida.addEventListener('input', function (evento) {
      revisao += 1;
      status.textContent = '';
      id('marcas').hidden = !novo();
      id('sangrada-opcao').hidden = saida.value !== 'vinculada';
      id('patches').hidden = !barra.checked;
      try {
        if (origem === 'manual' && (!montagem || evento.target === saida ||
            evento.target === barra || evento.target === id('patch-h'))) calcularManual();
        atualizar();
      } catch (erro) { limpar(erro.message); }
    });

    arquivo.addEventListener('change', function () {
      var selecionado = arquivo.files[0];
      if (!selecionado) return;
      var leitura = ++revisao;
      origem = null;
      limpar();
      arquivo.value = '';
      if (selecionado.size > 4 * 1024 * 1024) {
        limpar('O arquivo Folha excede 4 MB.');
        focarPrevia();
        return;
      }
      var leitor = new FileReader();
      leitor.onload = function () {
        if (leitura !== revisao) return;
        try {
          var entrada = JSON.parse(String(leitor.result).replace(/^\uFEFF/, ''));
          if (entrada.operacao !== 'montar-pecas') throw Error('Selecione um plano de Montagem e virada.');
          montagem = producao.importar(root.FolhaOperacoes.executar(entrada));
          origem = 'arquivo';
          if (montagem.plano.parametros.style !== 'single') {
            saida.value = 'prova';
            id('marcas').hidden = true;
            id('sangrada-opcao').hidden = true;
          }
          atualizar();
        } catch (erro) { limpar(erro instanceof SyntaxError ? 'O arquivo não contém um plano Folha válido.' : erro.message); }
        focarPrevia();
      };
      leitor.onerror = function () {
        if (leitura !== revisao) return;
        limpar('Não foi possível ler o plano.');
        focarPrevia();
      };
      leitor.readAsText(selecionado);
    });

    function argumento(valor) {
      return JSON.stringify(valor).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    }

    aplicar.addEventListener('click', function () {
      if (!montagem || !podeAplicar || ocupado) return;
      var geo = argumento(producao.codificar(montagem.plano, saida.value === 'selecao'));
      var comando = 'ibdAplicarFolha(' + geo + ')';
      var criandoNovo = novo();
      if (criandoNovo) {
        var tec = argumento(producao.codificarTecnicas(montagem, tecnicas, opcoes, saida.value === 'vinculada'));
        comando = 'ibdGerarFolha(' + geo + ',' + tec + ',' + argumento(opcoes.os) + ')';
      }
      ocupado = true;
      aplicar.disabled = true;
      status.textContent = 'Gerando montagem no Illustrator…';
      var emAplicacao = revisao;
      cs.evalScript(comando, function (res) {
        ocupado = false;
        aplicar.disabled = !podeAplicar;
        if (emAplicacao === revisao) {
          status.textContent = res && res.indexOf('OK') === 0
            ? (criandoNovo ? 'Montagem CMYK criada.' : 'Pranchetas Folha criadas.') + res.slice(2)
            : (res || 'Sem resposta do Illustrator.');
        }
      });
    });
  };
})(window);
