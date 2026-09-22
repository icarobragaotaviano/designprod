/**
 * Vitrine do catalogo.
 *
 * Nao existe lista de ferramentas escrita aqui: os dados vem do bloco
 * <script id="dados">, que tools/build-site.mjs preenche a partir de
 * catalog.json. Ferramenta nova aparece nesta pagina so por existir no
 * repositorio com o cabecalho @ibd-* certo — o mesmo contrato do painel UXP.
 */
(function () {
  'use strict';

  var dados = JSON.parse(document.getElementById('dados').textContent);
  var ferramentas = dados.ferramentas || [];

  var elLista = document.getElementById('lista');
  var elBusca = document.getElementById('busca');
  var elFiltros = document.getElementById('filtros');
  var elContagem = document.getElementById('contagem');
  var elAcoes = document.getElementById('acoes-repo');

  var estado = { termo: '', app: 'todos' };

  /* Cabecalho ------------------------------------------------------- */

  var nomesApps = dados.nomesApps || {};
  function nomeDoApp(id) { return nomesApps[id] || id; }

  var appsPresentes = [];
  ferramentas.forEach(function (f) {
    if (appsPresentes.indexOf(f.app) === -1) appsPresentes.push(f.app);
  });

  elContagem.textContent = ferramentas.length + ' ferramentas · ' +
    appsPresentes.map(nomeDoApp).join(', ');

  (dados.acoes || []).forEach(function (acao) {
    var a = document.createElement('a');
    a.className = 'botao' + (acao.secundaria ? ' secundario' : '');
    a.href = acao.url;
    a.textContent = acao.rotulo;
    if (acao.externa) { a.rel = 'noopener'; a.target = '_blank'; }
    elAcoes.appendChild(a);
  });

  /* Download do painel UXP ------------------------------------------- */

  var elPainel = document.getElementById('baixar-painel');
  if (elPainel && dados.painel) {
    var botao = document.createElement('a');
    botao.className = 'botao';
    botao.href = dados.painel.ccx;
    botao.setAttribute('download', dados.painel.nome);
    botao.textContent = 'Baixar o painel · v' + dados.painel.versao + ' · ' + dados.painel.tamanho + ' KB';
    elPainel.appendChild(botao);

    var nota = document.createElement('p');
    nota.className = 'nota-painel';
    nota.appendChild(document.createTextNode(
      'Duplo clique instala pelo Creative Cloud. O pacote não é assinado pela Adobe: se o Creative Cloud recusar, baixe o '
    ));

    var alternativo = document.createElement('a');
    alternativo.href = dados.painel.zip;
    alternativo.setAttribute('download', '');
    alternativo.textContent = 'mesmo pacote em .zip';
    nota.appendChild(alternativo);

    nota.appendChild(document.createTextNode(
      ', descompacte e aponte o Adobe UXP Developer Tool para o manifest.json.'
    ));
    elPainel.appendChild(nota);
  }

  /* Filtros ---------------------------------------------------------- */

  function contarNoApp(app) {
    if (app === 'todos') return ferramentas.length;
    return ferramentas.filter(function (f) { return f.app === app; }).length;
  }

  ['todos'].concat(appsPresentes).forEach(function (app) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'filtro';
    b.dataset.app = app;
    b.setAttribute('aria-pressed', String(app === estado.app));
    b.innerHTML = '';
    b.appendChild(document.createTextNode(app === 'todos' ? 'Todos' : nomeDoApp(app)));
    var quantos = document.createElement('span');
    quantos.className = 'quantos';
    quantos.textContent = contarNoApp(app);
    b.appendChild(quantos);
    b.addEventListener('click', function () {
      estado.app = app;
      gravarEndereco();
      render();
    });
    elFiltros.appendChild(b);
  });

  /* Busca ------------------------------------------------------------ */

  function combina(f, termo) {
    if (!termo) return true;
    var alvo = [f.titulo, f.descricao, f.id, (f.tags || []).join(' ')].join(' ').toLowerCase();
    // Todas as palavras precisam aparecer: "auto photoshop" filtra de verdade.
    return termo.split(/\s+/).every(function (palavra) {
      return alvo.indexOf(palavra) > -1;
    });
  }

  elBusca.addEventListener('input', function () {
    estado.termo = elBusca.value.trim().toLowerCase();
    gravarEndereco();
    render();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== elBusca) {
      e.preventDefault();
      elBusca.focus();
      elBusca.select();
    }
    if (e.key === 'Escape' && document.activeElement === elBusca) {
      elBusca.value = '';
      estado.termo = '';
      gravarEndereco();
      render();
    }
  });

  /* Endereco: o filtro fica no link, dá para compartilhar ------------ */

  function gravarEndereco() {
    var partes = [];
    if (estado.app !== 'todos') partes.push('app=' + encodeURIComponent(estado.app));
    if (estado.termo) partes.push('q=' + encodeURIComponent(estado.termo));
    var novo = partes.length ? '#' + partes.join('&') : ' ';
    history.replaceState(null, '', novo === ' ' ? location.pathname + location.search : novo);
  }

  function lerEndereco() {
    var bruto = location.hash.replace(/^#/, '');
    if (!bruto) return;
    bruto.split('&').forEach(function (par) {
      var corte = par.indexOf('=');
      if (corte < 1) return;
      var chave = par.substring(0, corte);
      var valor = decodeURIComponent(par.substring(corte + 1));
      if (chave === 'app' && appsPresentes.indexOf(valor) > -1) estado.app = valor;
      if (chave === 'q') { estado.termo = valor.toLowerCase(); elBusca.value = valor; }
    });
  }

  /* Cartoes ---------------------------------------------------------- */

  function montarCartao(f) {
    var cartao = document.createElement('article');
    cartao.className = 'cartao';

    var topo = document.createElement('div');
    topo.className = 'cartao-topo';
    var h2 = document.createElement('h2');
    h2.textContent = f.titulo;
    var app = document.createElement('span');
    app.className = 'app';
    app.textContent = nomeDoApp(f.app);
    topo.appendChild(h2);
    topo.appendChild(app);
    cartao.appendChild(topo);

    var p = document.createElement('p');
    p.className = 'descricao';
    p.textContent = f.descricao;
    cartao.appendChild(p);

    if (f.tags && f.tags.length) {
      var ul = document.createElement('ul');
      ul.className = 'tags';
      (f.tags || []).forEach(function (tag) {
        var li = document.createElement('li');
        li.textContent = tag;
        ul.appendChild(li);
      });
      cartao.appendChild(ul);
    }

    var pe = document.createElement('div');
    pe.className = 'cartao-pe';

    if (f.baixar) {
      var baixar = elo(f.baixar, 'Baixar', false);
      baixar.className = 'elo principal';
      baixar.setAttribute('download', f.baixarNome);
      baixar.title = f.baixarNome + ' · ' + f.baixarTamanho + ' KB' +
        (f.coreEmbutido
          ? ' · com a biblioteca do estúdio embutida, roda sozinho'
          : ' · arquivo independente');
      pe.appendChild(baixar);
    }

    if (f.codigo) {
      pe.appendChild(elo(f.codigo, f.codigoRotulo || 'Ver código', false));
    }
    if (f.docUrl) {
      pe.appendChild(elo(f.docUrl, 'Documentação', true));
    }
    var versao = document.createElement('span');
    versao.className = 'versao';
    versao.textContent = 'v' + f.versao;
    pe.appendChild(versao);

    cartao.appendChild(pe);
    return cartao;
  }

  function elo(url, rotulo, externo) {
    var a = document.createElement('a');
    a.className = 'elo';
    a.href = url;
    a.textContent = rotulo;
    if (externo) { a.rel = 'noopener'; a.target = '_blank'; }
    return a;
  }

  /* Render ------------------------------------------------------------ */

  function render() {
    var visiveis = ferramentas.filter(function (f) {
      return (estado.app === 'todos' || f.app === estado.app) && combina(f, estado.termo);
    });

    Array.prototype.forEach.call(elFiltros.children, function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.app === estado.app));
    });

    elLista.innerHTML = '';

    if (!visiveis.length) {
      var vazio = document.createElement('div');
      vazio.className = 'vazio';
      vazio.appendChild(document.createTextNode('Nenhuma ferramenta com esse filtro. '));
      var limpar = document.createElement('button');
      limpar.type = 'button';
      limpar.textContent = 'Limpar busca';
      limpar.addEventListener('click', function () {
        estado.termo = '';
        estado.app = 'todos';
        elBusca.value = '';
        gravarEndereco();
        render();
      });
      vazio.appendChild(limpar);
      elLista.appendChild(vazio);
      return;
    }

    visiveis.forEach(function (f) { elLista.appendChild(montarCartao(f)); });
  }

  lerEndereco();
  render();
})();
