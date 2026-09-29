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

  var estado = { termo: '', app: 'todos', selecionado: null };
  var elDetalhes = document.getElementById('detalhes');
  var elResultados = document.getElementById('resultados');
  var elTitulo = document.getElementById('titulo-biblioteca');
  var elContexto = document.getElementById('contexto');

  function mostrarArea(area) {
    var instalacao = area === 'instalacao';
    document.getElementById('biblioteca').hidden = instalacao;
    document.getElementById('instalacao').hidden = !instalacao;
    document.getElementById('propriedades').hidden = instalacao;
    document.getElementById('abrir-biblioteca').setAttribute('aria-pressed', String(!instalacao));
    document.getElementById('abrir-instalacao').setAttribute('aria-pressed', String(instalacao));
  }
  document.getElementById('abrir-biblioteca').addEventListener('click', function () { mostrarArea('biblioteca'); });
  document.getElementById('abrir-instalacao').addEventListener('click', function () { mostrarArea('instalacao'); });
  document.getElementById('ajuda-instalar').addEventListener('click', function () {
    mostrarArea('instalacao');
    document.getElementById('titulo-instalacao').setAttribute('tabindex', '-1');
    document.getElementById('titulo-instalacao').focus();
  });
  ['grade', 'lista'].forEach(function (modo) {
    document.getElementById('modo-' + modo).addEventListener('click', function () {
      mostrarArea('biblioteca');
      elLista.className = 'grade' + (modo === 'lista' ? ' em-lista' : '');
      ['grade', 'lista'].forEach(function (opcao) {
        document.getElementById('modo-' + opcao).setAttribute('aria-pressed', String(opcao === modo));
      });
    });
  });

  function iconeApp(id) {
    var abreviacoes = { todos: '▦', photoshop: 'Ps', illustrator: 'Ai', indesign: 'Id', aftereffects: 'Ae' };
    var icone = document.createElement('span');
    icone.className = 'app-icone';
    icone.dataset.app = id;
    icone.setAttribute('aria-hidden', 'true');
    icone.textContent = abreviacoes[id] || id.substring(0, 2);
    return icone;
  }

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
    b.appendChild(iconeApp(app));
    b.appendChild(document.createTextNode(app === 'todos' ? 'Todos os aplicativos' : nomeDoApp(app)));
    var quantos = document.createElement('span');
    quantos.className = 'quantos';
    quantos.textContent = contarNoApp(app);
    b.appendChild(quantos);
    b.addEventListener('click', function () {
      estado.app = app;
      mostrarArea('biblioteca');
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
    mostrarArea('biblioteca');
    gravarEndereco();
    render();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) {
      e.preventDefault();
      mostrarArea('biblioteca');
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
      var valor;
      try { valor = decodeURIComponent(par.substring(corte + 1)); } catch (e) { return; }
      if (chave === 'app' && appsPresentes.indexOf(valor) > -1) estado.app = valor;
      if (chave === 'q') { estado.termo = valor.toLowerCase(); elBusca.value = valor; }
    });
  }

  /* Cartoes ---------------------------------------------------------- */

  function montarCartao(f) {
    var cartao = document.createElement('article');
    cartao.className = 'cartao' + (f.id === estado.selecionado ? ' selecionado' : '');
    cartao.dataset.ferramenta = f.id;

    var topo = document.createElement('div');
    topo.className = 'cartao-topo';
    var h2 = document.createElement('h2');
    var selecionar = document.createElement('button');
    selecionar.type = 'button';
    selecionar.className = 'selecionar-ferramenta';
    selecionar.textContent = f.titulo;
    selecionar.setAttribute('aria-pressed', String(f.id === estado.selecionado));
    selecionar.setAttribute('aria-controls', 'detalhes');
    selecionar.addEventListener('click', function () { selecionarFerramenta(f); });
    h2.appendChild(selecionar);
    var app = document.createElement('span');
    app.className = 'app';
    app.textContent = nomeDoApp(f.app);
    topo.appendChild(iconeApp(f.app));
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
      var rotuloBaixar = f.tipo === 'action' ? 'Baixar action' : 'Baixar';
      var baixar = elo(f.baixar, rotuloBaixar, false);
      baixar.className = 'elo principal';
      baixar.setAttribute('download', f.baixarNome);
      baixar.title = f.baixarNome + ' · ' + f.baixarTamanho + ' KB' +
        (f.tipo === 'action'
          ? ' · conjunto de ações para carregar no Photoshop'
          : (f.coreEmbutido
              ? ' · com a biblioteca do estúdio embutida, roda sozinho'
              : ' · arquivo independente'));
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

  /* Propriedades: metadados e links do mesmo catálogo, sem executar scripts. */
  function selecionarFerramenta(f) {
    estado.selecionado = f.id;
    Array.prototype.forEach.call(elLista.querySelectorAll('.cartao'), function (cartao) {
      var selecionado = cartao.dataset.ferramenta === f.id;
      cartao.classList.toggle('selecionado', selecionado);
      cartao.querySelector('.selecionar-ferramenta').setAttribute('aria-pressed', String(selecionado));
    });
    renderDetalhes(f);
    if (window.matchMedia('(max-width: 900px)').matches) {
      var painel = document.getElementById('titulo-propriedades');
      painel.setAttribute('tabindex', '-1');
      painel.focus();
      painel.scrollIntoView({ block: 'start' });
    }
  }

  function renderDetalhes(f) {
    elDetalhes.innerHTML = '';
    if (!f) {
      var vazio = document.createElement('p');
      vazio.className = 'miudo';
      vazio.textContent = 'Nenhuma ferramenta selecionada.';
      elDetalhes.appendChild(vazio);
      return;
    }
    elDetalhes.appendChild(iconeApp(f.app));
    var titulo = document.createElement('h3');
    titulo.textContent = f.titulo;
    elDetalhes.appendChild(titulo);
    var descricao = document.createElement('p');
    descricao.className = 'descricao';
    descricao.textContent = f.descricao;
    elDetalhes.appendChild(descricao);
    var propriedades = document.createElement('dl');
    var itens = [
      ['Aplicativo', nomeDoApp(f.app)],
      ['Tipo', f.tipo === 'action' ? 'Action' : 'Script'],
      ['Versão', 'v' + f.versao]
    ];
    if (f.baixarTamanho) itens.push(['Tamanho', f.baixarTamanho + ' KB']);
    itens.forEach(function (item) {
      var termo = document.createElement('dt');
      termo.textContent = item[0];
      var valor = document.createElement('dd');
      valor.textContent = item[1];
      propriedades.appendChild(termo);
      propriedades.appendChild(valor);
    });
    elDetalhes.appendChild(propriedades);
    var acoes = document.createElement('div');
    acoes.className = 'detalhes-acoes';
    if (f.baixar) {
      var baixar = elo(f.baixar, f.tipo === 'action' ? 'Baixar action' : 'Baixar ferramenta', false);
      baixar.className = 'elo principal';
      baixar.setAttribute('download', f.baixarNome);
      acoes.appendChild(baixar);
    }
    if (f.docUrl) acoes.appendChild(elo(f.docUrl, 'Abrir documentação', true));
    if (f.codigo) acoes.appendChild(elo(f.codigo, f.codigoRotulo || 'Ver código', false));
    elDetalhes.appendChild(acoes);
  }

  /* Render ------------------------------------------------------------ */

  function render() {
    var visiveis = ferramentas.filter(function (f) {
      return (estado.app === 'todos' || f.app === estado.app) && combina(f, estado.termo);
    });

    Array.prototype.forEach.call(elFiltros.children, function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.app === estado.app));
    });

    var selecionada = visiveis.filter(function (f) { return f.id === estado.selecionado; })[0] || visiveis[0];
    estado.selecionado = selecionada ? selecionada.id : null;
    renderDetalhes(selecionada);
    var total = visiveis.length;
    elResultados.textContent = total + (total === 1 ? ' ferramenta' : ' ferramentas');
    elContagem.textContent = total + ' de ' + ferramentas.length + ' ferramentas';
    elTitulo.textContent = estado.app === 'todos' ? 'Todas as ferramentas' : nomeDoApp(estado.app);
    elContexto.textContent = estado.app === 'todos' ? 'Todos os aplicativos' : nomeDoApp(estado.app);
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
