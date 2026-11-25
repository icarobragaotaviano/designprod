/* Logica do painel universal Adobe CEP (Illustrator, After Effects, InDesign, Photoshop). */
(function () {
  'use strict';

  var MAPA_HOST = {
    ILST: 'illustrator',
    AEFT: 'aftereffects',
    IDSN: 'indesign',
    PHXS: 'photoshop',
    PHSP: 'photoshop'
  };
  var NOMES_APP = {
    illustrator: 'Illustrator',
    aftereffects: 'After Effects',
    indesign: 'InDesign',
    photoshop: 'Photoshop'
  };

  var cs = new window.CSInterface();
  var icones = window.IBDIcones || { resolverIconeId: function () { return 'acao'; }, iconeSvg: function () { return ''; } };
  var catalogo = window.IBDCatalogo || { marca: 'IBD', versao: '0.1.0', ferramentas: [] };

  var env = cs.getHostEnvironment();
  var appDetectado = MAPA_HOST[env && env.appName] || 'illustrator';
  var appAtivo = appDetectado;

  var CHAVE_FAV = 'ibd-cep-favoritos-v1';
  var CHAVE_MODO = 'ibd-cep-modo-v1';
  var abaAtiva = 'todos';
  var modoVis = 'grade';
  var favoritos = [];

  try {
    var f = window.localStorage.getItem(CHAVE_FAV);
    if (f) {
      var arr = JSON.parse(f);
      if (Array.isArray(arr)) favoritos = arr;
    }
    var m = window.localStorage.getItem(CHAVE_MODO);
    if (m === 'grade' || m === 'lista') modoVis = m;
  } catch (e) {}

  var elLista = document.getElementById('lista');
  var elFiltro = document.getElementById('filtro');
  var elSelApp = document.getElementById('sel-app');
  var elStatus = document.getElementById('status');
  var elNomeHost = document.getElementById('nome-host');
  var elMarca = document.getElementById('marca');
  var elVersao = document.getElementById('versao');
  var elFavContador = document.getElementById('fav-contador');
  var elAbas = document.getElementById('abas');
  var btnGrade = document.getElementById('modo-grade');
  var btnLista = document.getElementById('modo-lista');

  elMarca.textContent = catalogo.marca || 'IBD';
  elVersao.textContent = 'v' + (catalogo.versao || '0.1.0');
  elSelApp.value = appAtivo;

  function salvarFavoritos() {
    try { window.localStorage.setItem(CHAVE_FAV, JSON.stringify(favoritos)); } catch (e) {}
  }
  function salvarModo() {
    try { window.localStorage.setItem(CHAVE_MODO, modoVis); } catch (e) {}
  }
  function ehFav(id) { return favoritos.indexOf(id) > -1; }
  function alternarFav(id) {
    var i = favoritos.indexOf(id);
    if (i > -1) favoritos.splice(i, 1);
    else favoritos.push(id);
    salvarFavoritos();
    render();
  }
  function status(txt, tipo) {
    elStatus.textContent = txt;
    elStatus.parentElement.className = 'rodape' + (tipo ? ' ' + tipo : '');
  }
  function tituloCurto(t) {
    return String(t || '').replace(/\s*\([^)]*\)/g, '').trim();
  }

  function scriptsDoApp(appId) {
    return (catalogo.ferramentas || []).filter(function (f) {
      return f.app === appId && f.tipo === 'script';
    });
  }

  function filtrar() {
    var termo = elFiltro.value.trim().toLowerCase();
    return scriptsDoApp(appAtivo).filter(function (f) {
      if (abaAtiva === 'favoritos' && !ehFav(f.id)) return false;
      if (!termo) return true;
      return (
        f.titulo.toLowerCase().indexOf(termo) > -1 ||
        f.descricao.toLowerCase().indexOf(termo) > -1 ||
        (f.tags || []).join(' ').toLowerCase().indexOf(termo) > -1
      );
    });
  }

  function criarEstrela(f) {
    var ativo = ehFav(f.id);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'star-btn' + (ativo ? ' ativo' : '');
    btn.textContent = ativo ? '★' : '☆';
    btn.title = ativo ? 'Remover dos favoritos' : 'Favoritar';
    btn.onclick = function (e) {
      e.stopPropagation();
      alternarFav(f.id);
    };
    return btn;
  }

  function executar(f) {
    var baseExt = cs.getSystemPath(window.SystemPath.EXTENSION) || '';
    var norm = baseExt.replace(/\\/g, '/').replace(/\/+$/, '');
    var relStandalone = 'bundle/standalone/' + f.arquivo.replace(/^apps\//, '');
    var caminho = norm ? (norm + '/' + relStandalone) : relStandalone;

    status('Executando: ' + f.titulo + '...');
    cs.evalScript('ibdExecutarArquivo(' + JSON.stringify(caminho) + ')', function (res) {
      if (res && String(res).indexOf('ERRO:') === 0) {
        status(String(res).replace(/^ERRO:/, ''), 'erro');
      } else {
        status('Concluido: ' + f.titulo, 'sucesso');
      }
    });
  }

  function render() {
    elNomeHost.textContent = NOMES_APP[appAtivo] || appAtivo;
    var doApp = scriptsDoApp(appAtivo);
    var favCount = favoritos.filter(function (id) {
      return doApp.some(function (f) { return f.id === id; });
    }).length;
    elFavContador.textContent = String(favCount);

    btnGrade.setAttribute('aria-pressed', String(modoVis === 'grade'));
    btnLista.setAttribute('aria-pressed', String(modoVis === 'lista'));
    elLista.className = 'lista ' + (modoVis === 'grade' ? 'modo-grade' : 'modo-lista');

    var abas = elAbas.querySelectorAll('.aba');
    for (var i = 0; i < abas.length; i++) {
      abas[i].setAttribute('aria-selected', String(abas[i].getAttribute('data-aba') === abaAtiva));
    }

    var visiveis = filtrar();
    elLista.innerHTML = '';
    if (!visiveis.length) {
      var vazio = document.createElement('div');
      vazio.className = 'vazio';
      vazio.textContent = abaAtiva === 'favoritos'
        ? 'Nenhum favorito neste software. Clique na estrela ☆ para fixar.'
        : 'Nenhuma ferramenta encontrada.';
      elLista.appendChild(vazio);
      return;
    }

    visiveis.forEach(function (f) {
      var iconeId = f.icone || icones.resolverIconeId(f.id, f.tipo);
      if (modoVis === 'grade') {
        var tile = document.createElement('div');
        tile.className = 'tile';
        tile.title = f.titulo + ' — ' + f.descricao;
        var topo = document.createElement('div');
        topo.className = 'tile-topo';
        var badge = document.createElement('span');
        badge.className = 'icone-badge';
        badge.innerHTML = icones.iconeSvg(iconeId, null, 22);
        topo.appendChild(badge);
        topo.appendChild(criarEstrela(f));
        tile.appendChild(topo);
        var nm = document.createElement('div');
        nm.className = 'tile-titulo';
        nm.textContent = tituloCurto(f.titulo);
        tile.appendChild(nm);
        var pe = document.createElement('div');
        pe.className = 'tile-pe';
        var tp = document.createElement('span');
        tp.className = 'etiqueta-mini';
        tp.textContent = 'JSX';
        pe.appendChild(tp);
        tile.appendChild(pe);
        tile.onclick = function () { executar(f); };
        elLista.appendChild(tile);
      } else {
        var card = document.createElement('div');
        card.className = 'cartao';
        var cab = document.createElement('div');
        cab.className = 'cartao-cab';
        var badgeP = document.createElement('span');
        badgeP.className = 'icone-badge pequeno';
        badgeP.innerHTML = icones.iconeSvg(iconeId, null, 18);
        cab.appendChild(badgeP);
        var tit = document.createElement('div');
        tit.className = 'cartao-titulo';
        tit.textContent = f.titulo;
        cab.appendChild(tit);
        cab.appendChild(criarEstrela(f));
        card.appendChild(cab);
        var desc = document.createElement('div');
        desc.className = 'cartao-descricao';
        desc.textContent = f.descricao;
        card.appendChild(desc);
        var ac = document.createElement('div');
        ac.className = 'cartao-acoes';
        var bExec = document.createElement('button');
        bExec.type = 'button';
        bExec.textContent = 'Executar';
        bExec.onclick = function () { executar(f); };
        ac.appendChild(bExec);
        card.appendChild(ac);
        elLista.appendChild(card);
      }
    });
  }

  elFiltro.addEventListener('input', render);
  elSelApp.addEventListener('change', function () {
    appAtivo = elSelApp.value;
    render();
  });
  elAbas.addEventListener('click', function (e) {
    var b = e.target;
    while (b && b !== elAbas && !b.getAttribute('data-aba')) b = b.parentNode;
    if (b && b.getAttribute('data-aba')) {
      abaAtiva = b.getAttribute('data-aba');
      render();
    }
  });
  btnGrade.addEventListener('click', function () { modoVis = 'grade'; salvarModo(); render(); });
  btnLista.addEventListener('click', function () { modoVis = 'lista'; salvarModo(); render(); });

  render();
}());
