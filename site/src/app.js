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

  var elListaFavoritos = document.getElementById('lista-favoritos');
  var elResultadosFavoritos = document.getElementById('resultados-favoritos');
  var elContadorFavoritos = document.getElementById('contador-favoritos');
  var btnLimparFavoritos = document.getElementById('limpar-favoritos');
  var elLista = document.getElementById('lista');
  var elBusca = document.getElementById('busca');
  var elFiltros = document.getElementById('filtros');
  var elContagem = document.getElementById('contagem');
  var elAcoes = document.getElementById('acoes-repo');

  var CHAVE_FAVORITOS = 'ibd-designprod-favoritos-v1';
  var plataforma = 'todas';
  document.querySelectorAll('[data-plataforma]').forEach(function (botao) {
    botao.addEventListener('click', function () {
      plataforma = botao.dataset.plataforma;
      estado.app = 'todos';
      mostrarArea('biblioteca');
      gravarEndereco();
      render();
    });
  });
  var estado = { termo: '', app: 'todos', selecionado: null, area: 'biblioteca' };
  var elDetalhes = document.getElementById('detalhes');
  var elResultados = document.getElementById('resultados');
  var elTitulo = document.getElementById('titulo-biblioteca');
  var elContexto = document.getElementById('contexto');

  var mapaFerramentas = {};
  ferramentas.forEach(function (f) { mapaFerramentas[f.id] = f; });

  function carregarFavoritos() {
    try {
      var bruto = window.localStorage.getItem(CHAVE_FAVORITOS);
      if (!bruto) return [];
      var lista = JSON.parse(bruto);
      if (!Array.isArray(lista)) return [];
      var vistos = {};
      return lista.filter(function (id) {
        if (typeof id !== 'string' || !mapaFerramentas[id] || vistos[id]) return false;
        vistos[id] = true;
        return true;
      });
    } catch (e) {
      return [];
    }
  }

  function salvarFavoritos() {
    try {
      window.localStorage.setItem(CHAVE_FAVORITOS, JSON.stringify(favoritos));
    } catch (e) {}
  }

  var favoritos = carregarFavoritos();
  var confirmandoLimpeza = false;
  var limparTimer = null;

  function cancelarConfirmacaoLimpeza() {
    confirmandoLimpeza = false;
    if (limparTimer) { clearTimeout(limparTimer); limparTimer = null; }
    if (btnLimparFavoritos) btnLimparFavoritos.textContent = 'Limpar favoritos';
  }

  function ehFavorito(id) {
    return favoritos.indexOf(id) > -1;
  }

  function alternarFavorito(id) {
    cancelarConfirmacaoLimpeza();
    var idx = favoritos.indexOf(id);
    if (idx > -1) favoritos.splice(idx, 1);
    else favoritos.push(id);
    salvarFavoritos();
    render();
  }

  function atualizarContexto() {
    if (!elContexto) return;
    if (estado.area === 'favoritos') elContexto.textContent = 'Favoritos salvos';
    else if (estado.area === 'instalacao') elContexto.textContent = 'Guia de instalação';
    else elContexto.textContent = estado.app === 'todos' ? 'Todos os aplicativos' : nomeDoApp(estado.app);
  }

  function mostrarArea(area) {
    if (['biblioteca', 'favoritos', 'instalacao'].indexOf(area) === -1) area = 'biblioteca';
    estado.area = area;
    document.getElementById('biblioteca').hidden = area !== 'biblioteca';
    document.getElementById('favoritos').hidden = area !== 'favoritos';
    document.getElementById('instalacao').hidden = area !== 'instalacao';
    document.getElementById('propriedades').hidden = area === 'instalacao';
    document.getElementById('abrir-biblioteca').setAttribute('aria-pressed', String(area === 'biblioteca'));
    document.getElementById('abrir-favoritos').setAttribute('aria-pressed', String(area === 'favoritos'));
    document.getElementById('abrir-instalacao').setAttribute('aria-pressed', String(area === 'instalacao'));
    atualizarContexto();
  }
  document.getElementById('abrir-biblioteca').addEventListener('click', function () {
    mostrarArea('biblioteca');
    gravarEndereco();
    render();
  });
  document.getElementById('abrir-favoritos').addEventListener('click', function () {
    mostrarArea('favoritos');
    gravarEndereco();
    render();
  });
  document.getElementById('abrir-instalacao').addEventListener('click', function () {
    mostrarArea('instalacao');
    gravarEndereco();
  });
  document.getElementById('ajuda-instalar').addEventListener('click', function () {
    mostrarArea('instalacao');
    gravarEndereco();
    document.getElementById('titulo-instalacao').setAttribute('tabindex', '-1');
    document.getElementById('titulo-instalacao').focus();
  });
  if (btnLimparFavoritos) {
    btnLimparFavoritos.addEventListener('click', function () {
      if (!confirmandoLimpeza) {
        confirmandoLimpeza = true;
        btnLimparFavoritos.textContent = 'Confirmar limpeza?';
        limparTimer = setTimeout(cancelarConfirmacaoLimpeza, 4000);
        return;
      }
      favoritos = [];
      cancelarConfirmacaoLimpeza();
      salvarFavoritos();
      render();
    });
  }
  ['grade', 'lista'].forEach(function (modo) {
    document.getElementById('modo-' + modo).addEventListener('click', function () {
      if (estado.area === 'instalacao') mostrarArea('biblioteca');
      var classe = 'grade' + (modo === 'lista' ? ' em-lista' : '');
      elLista.className = classe;
      if (elListaFavoritos) elListaFavoritos.className = classe;
      ['grade', 'lista'].forEach(function (opcao) {
        document.getElementById('modo-' + opcao).setAttribute('aria-pressed', String(opcao === modo));
      });
    });
  });

  function iconeApp(id) {
    var abreviacoes = {
      todos: '▦',
      photoshop: 'Ps',
      illustrator: 'Ai',
      indesign: 'Id',
      aftereffects: 'Ae',
      coreldraw: 'Cd',
      affinity: 'Af',
      tracedraw: 'Td'
    };
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
      if (app !== 'todos') plataforma = app === 'web' ? 'online' : 'desktop';
      mostrarArea('biblioteca');
      gravarEndereco();
      render();
    });
    elFiltros.appendChild(b);
  });

  /* Busca ------------------------------------------------------------ */

  function combina(f, termo) {
    if (!termo) return true;
    var versoes = (f.versoes || []).map(function (v) { return nomeDoApp(v.app) + ' ' + v.titulo; }).join(' ');
    var alvo = [versoes, f.titulo, f.descricao, f.id, (f.tags || []).join(' ')].join(' ').toLowerCase();
    // Todas as palavras precisam aparecer: "auto photoshop" filtra de verdade.
    return termo.split(/\s+/).every(function (palavra) {
      return alvo.indexOf(palavra) > -1;
    });
  }

  elBusca.addEventListener('input', function () {
    estado.termo = elBusca.value.trim().toLowerCase();
    if (estado.area === 'instalacao') mostrarArea('biblioteca');
    gravarEndereco();
    render();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) {
      e.preventDefault();
      if (estado.area === 'instalacao') mostrarArea('biblioteca');
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
    if (estado.area !== 'biblioteca') partes.push('aba=' + encodeURIComponent(estado.area));
    if (plataforma !== 'todas') partes.push('plataforma=' + plataforma);
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
      if (chave === 'aba' && ['biblioteca', 'favoritos', 'instalacao'].indexOf(valor) > -1) estado.area = valor;
      if (chave === 'app' && appsPresentes.indexOf(valor) > -1) estado.app = valor;
      if (chave === 'plataforma' && ['online', 'desktop'].indexOf(valor) !== -1) plataforma = valor;
      if (chave === 'q') { estado.termo = valor.toLowerCase(); elBusca.value = valor; }
    });
  }

  /* Cartoes ---------------------------------------------------------- */

  function criarEstrelaSvg(ativa, tamanho) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    var s = tamanho || 14;
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('width', String(s));
    svg.setAttribute('height', String(s));
    svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M10 1.8l2.5 5.1 5.6.8-4 3.9.9 5.6L10 14.5l-5 2.7.9-5.6-4-3.9 5.6-.8z');
    p.setAttribute('fill', ativa ? 'currentColor' : 'none');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '1.6');
    p.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(p);
    return svg;
  }

  function montarBotaoFavorito(f) {
    var ativo = ehFavorito(f.id);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'favoritar';
    btn.setAttribute('aria-pressed', String(ativo));
    var rotulo = ativo ? 'Remover ' + f.titulo + ' dos favoritos' : 'Favoritar ' + f.titulo;
    btn.setAttribute('aria-label', rotulo);
    btn.title = ativo ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
    btn.appendChild(criarEstrelaSvg(ativo, 14));
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      alternarFavorito(f.id);
    });
    return btn;
  }

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
    app.textContent = f.abrir ? 'Online' : 'Desktop · ' + nomeDoApp(f.app);
    topo.appendChild(iconeApp(f.app));
    topo.appendChild(h2);
    topo.appendChild(app);
    topo.appendChild(montarBotaoFavorito(f));
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

    if (f.abrir) pe.appendChild(elo(f.abrir, 'Abrir app', false));
    if (f.baixar) {
      var rotuloBaixar = f.tipo === 'action' ? 'Baixar action' : 'Baixar';
      var baixar = elo(f.baixar, rotuloBaixar, false);
      baixar.className = 'elo principal';
      baixar.setAttribute('download', f.baixarNome);
      var detalheDownload = ' · arquivo independente';
      if (f.tipo === 'action') {
        detalheDownload = ' · conjunto de ações para carregar no Photoshop';
      } else if (f.app === 'coreldraw') {
        detalheDownload = ' · módulo VBA (.bas) para importar no GlobalMacros do CorelDRAW';
      } else if (f.app === 'affinity') {
        detalheDownload = ' · script JavaScript (.js) para Affinity (3.3+)';
      } else if (f.app === 'tracedraw') {
        detalheDownload = ' · script JavaScript (.js) para o painel Scripts do TraceDraw';
      } else if (f.coreEmbutido) {
        detalheDownload = ' · com a biblioteca do estúdio embutida, roda sozinho';
      }
      baixar.title = f.baixarNome + ' · ' + f.baixarTamanho + ' KB' + detalheDownload;
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
    [elLista, elListaFavoritos].forEach(function (grade) {
      if (!grade) return;
      Array.prototype.forEach.call(grade.querySelectorAll('.cartao'), function (cartao) {
        var selecionado = cartao.dataset.ferramenta === f.id;
        cartao.classList.toggle('selecionado', selecionado);
        cartao.querySelector('.selecionar-ferramenta').setAttribute('aria-pressed', String(selecionado));
      });
    });
    renderDetalhes(f);
    if (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) {
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
      ['Tipo', f.abrir ? 'Online' : 'Desktop · ' + f.tipo],
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
    if (f.abrir) acoes.appendChild(elo(f.abrir, 'Abrir app', false));
    if (f.baixar) {
      var baixar = elo(f.baixar, f.tipo === 'action' ? 'Baixar action' : 'Baixar ferramenta', false);
      baixar.className = 'elo principal';
      baixar.setAttribute('download', f.baixarNome);
      acoes.appendChild(baixar);
    }
    var ativo = ehFavorito(f.id);
    var btnFav = document.createElement('button');
    btnFav.type = 'button';
    btnFav.className = 'elo botao-favorito';
    btnFav.setAttribute('aria-pressed', String(ativo));
    btnFav.appendChild(criarEstrelaSvg(ativo, 14));
    btnFav.appendChild(document.createTextNode(ativo ? 'Remover dos favoritos' : 'Adicionar aos favoritos'));
    btnFav.addEventListener('click', function () { alternarFavorito(f.id); });
    acoes.appendChild(btnFav);
    if (f.docUrl) acoes.appendChild(elo(f.docUrl, 'Abrir documentação', true));
    if (f.codigo) acoes.appendChild(elo(f.codigo, f.codigoRotulo || 'Ver código', false));
    elDetalhes.appendChild(acoes);
    if (f.versoes && f.versoes.length) {
      var h = document.createElement('h4');
      h.textContent = 'Versões por software e ferramentas relacionadas';
      var lista = document.createElement('ul');
      lista.className = 'versoes-editores';
      f.versoes.forEach(function (versao) {
        var item = document.createElement('li');
        var a = elo(versao.abrir || versao.baixar, nomeDoApp(versao.app) + ' · ' + versao.titulo, false);
        if (versao.baixar) a.setAttribute('download', versao.baixarNome);
        item.appendChild(a);
        lista.appendChild(item);
      });
      elDetalhes.appendChild(h);
      elDetalhes.appendChild(lista);
    }
  }

  /* Render ------------------------------------------------------------ */

  function listarFavoritas(termo) {
    return favoritos
      .map(function (id) { return mapaFerramentas[id]; })
      .filter(function (f) { return !!f && combina(f, termo); });
  }

  function renderFavoritos(visiveisFav) {
    if (elContadorFavoritos) elContadorFavoritos.textContent = String(favoritos.length);
    if (!elListaFavoritos) return;
    if (btnLimparFavoritos) btnLimparFavoritos.hidden = favoritos.length === 0;

    var totalFav = visiveisFav.length;
    if (elResultadosFavoritos) {
      elResultadosFavoritos.textContent = totalFav + (totalFav === 1 ? ' favorito' : ' favoritos');
    }

    elListaFavoritos.innerHTML = '';

    if (favoritos.length === 0) {
      var bloco = document.createElement('div');
      bloco.className = 'vazio vazio-favoritos';
      bloco.appendChild(criarEstrelaSvg(false, 28));
      var tituloVazio = document.createElement('strong');
      tituloVazio.textContent = 'Nenhuma ferramenta favoritada ainda';
      bloco.appendChild(tituloVazio);
      bloco.appendChild(document.createTextNode(
        'Clique na estrela nos cartões ou em Propriedades para reunir aqui seus atalhos mais usados.'
      ));
      var explorar = document.createElement('button');
      explorar.type = 'button';
      explorar.textContent = 'Explorar ferramentas';
      explorar.addEventListener('click', function () {
        mostrarArea('biblioteca');
        gravarEndereco();
        render();
      });
      bloco.appendChild(explorar);
      elListaFavoritos.appendChild(bloco);
      return;
    }

    if (!visiveisFav.length) {
      var semBusca = document.createElement('div');
      semBusca.className = 'vazio';
      semBusca.appendChild(document.createTextNode('Nenhum favorito combina com essa busca. '));
      var limparBuscaFav = document.createElement('button');
      limparBuscaFav.type = 'button';
      limparBuscaFav.textContent = 'Limpar busca';
      limparBuscaFav.addEventListener('click', function () {
        estado.termo = '';
        elBusca.value = '';
        gravarEndereco();
        render();
      });
      semBusca.appendChild(limparBuscaFav);
      elListaFavoritos.appendChild(semBusca);
      return;
    }

    visiveisFav.forEach(function (f) { elListaFavoritos.appendChild(montarCartao(f)); });
  }

  function render() {
    document.querySelectorAll('[data-plataforma]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.plataforma === plataforma));
    });
    var visiveis = ferramentas.filter(function (f) {
      return (plataforma === 'todas' || plataforma === (f.abrir ? 'online' : 'desktop')) && (estado.app === 'todos' || f.app === estado.app) && combina(f, estado.termo);
    });
    var visiveisFav = listarFavoritas(estado.termo);

    Array.prototype.forEach.call(elFiltros.children, function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.app === estado.app));
    });

    var listaAtiva = estado.area === 'favoritos' ? visiveisFav : visiveis;
    var selecionada = listaAtiva.filter(function (f) { return f.id === estado.selecionado; })[0] || listaAtiva[0];
    estado.selecionado = selecionada ? selecionada.id : null;
    renderDetalhes(selecionada);

    var total = visiveis.length;
    elResultados.textContent = total + (total === 1 ? ' ferramenta' : ' ferramentas');
    elContagem.textContent = total + ' de ' + ferramentas.length + ' ferramentas · ' + favoritos.length + ' favoritos';
    elTitulo.textContent = estado.app === 'todos' ? 'Todas as ferramentas' : nomeDoApp(estado.app);
    atualizarContexto();
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
        plataforma = 'todas';
        estado.app = 'todos';
        elBusca.value = '';
        gravarEndereco();
        render();
      });
      vazio.appendChild(limpar);
      elLista.appendChild(vazio);
    } else {
      visiveis.forEach(function (f) { elLista.appendChild(montarCartao(f)); });
    }

    renderFavoritos(visiveisFav);
  }

  window.addEventListener('storage', function (e) {
    if (e.key === CHAVE_FAVORITOS) {
      favoritos = carregarFavoritos();
      render();
    }
  });

  lerEndereco();
  mostrarArea(estado.area);
  render();
})();
