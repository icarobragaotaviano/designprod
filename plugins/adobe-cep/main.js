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
  if (env && env.appName === 'ILST' && window.IBDIniciarFolha) {
    var ferramentas = document.getElementById('vista-ferramentas');
    var rodape = document.getElementById('rodape-ferramentas');
    var painelFolha = document.getElementById('folha-painel');
    var abrirFerramentas = document.getElementById('abrir-ferramentas');
    var abrirFolha = document.getElementById('abrir-folha');

    function mostrarFolha(ativo) {
      ferramentas.hidden = ativo;
      rodape.hidden = ativo;
      painelFolha.hidden = !ativo;
      abrirFerramentas.setAttribute('aria-pressed', String(!ativo));
      abrirFolha.setAttribute('aria-pressed', String(ativo));
    }

    window.IBDIniciarFolha(cs);
    abrirFerramentas.addEventListener('click', function () { mostrarFolha(false); });
    abrirFolha.addEventListener('click', function () { mostrarFolha(true); });
    document.getElementById('vistas-painel').hidden = false;
  }

  var CHAVE_FAV = 'ibd-cep-favoritos-v1';
  var CHAVE_MODO = 'ibd-cep-modo-v1';
  var CHAVE_OCULTAS = 'ibd-cep-ocultas-v1';
  var abaAtiva = 'todos';
  var modoVis = 'grade';
  var gerenciando = false;
  var favoritos = [];
  var ocultas = [];

  try {
    var f = window.localStorage.getItem(CHAVE_FAV);
    if (f) {
      var arr = JSON.parse(f);
      if (Array.isArray(arr)) favoritos = arr;
    }
    var oc = window.localStorage.getItem(CHAVE_OCULTAS);
    if (oc) {
      var arrOc = JSON.parse(oc);
      if (Array.isArray(arrOc)) ocultas = arrOc;
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
  var btnGerenciar = document.getElementById('btn-gerenciar');
  var elOcultasBadge = document.getElementById('ocultas-badge');

  elMarca.textContent = catalogo.marca || 'IBD';
  elVersao.textContent = 'v' + (catalogo.versao || '0.1.0');
  elSelApp.value = appAtivo;

  function salvarFavoritos() {
    try { window.localStorage.setItem(CHAVE_FAV, JSON.stringify(favoritos)); } catch (e) {}
  }
  function salvarOcultas() {
    try { window.localStorage.setItem(CHAVE_OCULTAS, JSON.stringify(ocultas)); } catch (e) {}
  }
  function salvarModo() {
    try { window.localStorage.setItem(CHAVE_MODO, modoVis); } catch (e) {}
  }
  function ehFav(id) { return favoritos.indexOf(id) > -1; }
  function ehOculta(id) { return ocultas.indexOf(id) > -1; }
  function alternarFav(id) {
    var i = favoritos.indexOf(id);
    if (i > -1) favoritos.splice(i, 1);
    else favoritos.push(id);
    salvarFavoritos();
    render();
  }
  function definirOculta(id, esconder) {
    var i = ocultas.indexOf(id);
    if (esconder && i === -1) ocultas.push(id);
    else if (!esconder && i > -1) ocultas.splice(i, 1);
    salvarOcultas();
    render();
  }
  function mostrarTodasDoApp() {
    var doApp = scriptsDoApp(appAtivo);
    var mapa = {};
    doApp.forEach(function (f) { mapa[f.id] = true; });
    ocultas = ocultas.filter(function (id) { return !mapa[id]; });
    salvarOcultas();
    status('Todas as funcoes de ' + (NOMES_APP[appAtivo] || appAtivo) + ' estao visiveis.', 'sucesso');
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

  function filtrar(incluirOcultas) {
    var termo = elFiltro.value.trim().toLowerCase();
    return scriptsDoApp(appAtivo).filter(function (f) {
      if (!incluirOcultas && ehOculta(f.id)) return false;
      if (!incluirOcultas && abaAtiva === 'favoritos' && !ehFav(f.id)) return false;
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
      var texto = res === undefined || res === null ? '' : String(res);
      if (texto.indexOf('ERRO:') === 0) {
        status(texto.replace(/^ERRO:/, ''), 'erro');
      } else if (!texto || texto === 'EvalScript error.' || texto === 'undefined') {
        status('Erro de execucao no host (' + (texto || 'sem resposta') + '). Confira a versao do script.', 'erro');
      } else {
        status('Concluido: ' + f.titulo, 'sucesso');
      }
    });
  }

  function renderGerenciar() {
    elLista.className = 'lista modo-lista';
    elLista.innerHTML = '';

    var todas = filtrar(true);
    var barra = document.createElement('div');
    barra.className = 'gerenciar-barra';
    var info = document.createElement('span');
    info.className = 'gerenciar-info';
    var visCount = todas.filter(function (f) { return !ehOculta(f.id); }).length;
    info.textContent = visCount + ' de ' + todas.length + ' visiveis';
    barra.appendChild(info);

    var acoes = document.createElement('div');
    acoes.className = 'gerenciar-acoes';
    var btnTodas = document.createElement('button');
    btnTodas.type = 'button';
    btnTodas.textContent = 'Mostrar todas';
    btnTodas.onclick = mostrarTodasDoApp;
    acoes.appendChild(btnTodas);

    var btnOk = document.createElement('button');
    btnOk.type = 'button';
    btnOk.className = 'primario';
    btnOk.textContent = 'Concluir';
    btnOk.onclick = function () {
      gerenciando = false;
      render();
    };
    acoes.appendChild(btnOk);
    barra.appendChild(acoes);
    elLista.appendChild(barra);

    todas.forEach(function (f) {
      var oculta = ehOculta(f.id);
      var row = document.createElement('label');
      row.className = 'gerenciar-item' + (oculta ? ' oculta' : '');
      var chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = !oculta;
      chk.onchange = function () { definirOculta(f.id, !chk.checked); };
      row.appendChild(chk);

      var iconeId = f.icone || icones.resolverIconeId(f.id, f.tipo);
      var badge = document.createElement('span');
      badge.className = 'icone-badge pequeno';
      badge.innerHTML = icones.iconeSvg(iconeId, null, 16);
      row.appendChild(badge);

      var nm = document.createElement('span');
      nm.className = 'gerenciar-nome';
      nm.textContent = f.titulo;
      row.appendChild(nm);

      var st = document.createElement('span');
      st.className = 'gerenciar-estado';
      st.textContent = oculta ? 'Oculta' : 'Visivel';
      row.appendChild(st);

      elLista.appendChild(row);
    });
  }

  function render() {
    elNomeHost.textContent = NOMES_APP[appAtivo] || appAtivo;
    var doApp = scriptsDoApp(appAtivo);
    var ocultasDoApp = doApp.filter(function (f) { return ehOculta(f.id); }).length;
    var favCount = favoritos.filter(function (id) {
      return doApp.some(function (f) { return f.id === id && !ehOculta(f.id); });
    }).length;
    elFavContador.textContent = String(favCount);

    if (elOcultasBadge) {
      elOcultasBadge.textContent = String(ocultasDoApp);
      elOcultasBadge.hidden = ocultasDoApp === 0;
    }

    btnGrade.setAttribute('aria-pressed', String(!gerenciando && modoVis === 'grade'));
    btnLista.setAttribute('aria-pressed', String(!gerenciando && modoVis === 'lista'));
    if (btnGerenciar) btnGerenciar.setAttribute('aria-pressed', String(gerenciando));

    var abas = elAbas.querySelectorAll('.aba');
    for (var i = 0; i < abas.length; i++) {
      abas[i].setAttribute('aria-selected', String(!gerenciando && abas[i].getAttribute('data-aba') === abaAtiva));
    }

    if (gerenciando) {
      renderGerenciar();
      return;
    }

    elLista.className = 'lista ' + (modoVis === 'grade' ? 'modo-grade' : 'modo-lista');
    var visiveis = filtrar(false);
    elLista.innerHTML = '';
    if (!visiveis.length) {
      var vazio = document.createElement('div');
      vazio.className = 'vazio';
      vazio.textContent = abaAtiva === 'favoritos'
        ? 'Nenhum favorito visivel neste software. Clique na estrela ☆ para fixar.'
        : (ocultasDoApp > 0
            ? 'Nenhuma ferramenta visivel (' + ocultasDoApp + ' oculta(s)).'
            : 'Nenhuma ferramenta encontrada.');
      if (ocultasDoApp > 0) {
        var br = document.createElement('br');
        var btnReexibir = document.createElement('button');
        btnReexibir.type = 'button';
        btnReexibir.className = 'vazio-btn';
        btnReexibir.textContent = 'Gerenciar funcoes ocultas';
        btnReexibir.onclick = function () { gerenciando = true; render(); };
        vazio.appendChild(br);
        vazio.appendChild(btnReexibir);
      }
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
      gerenciando = false;
      abaAtiva = b.getAttribute('data-aba');
      render();
    }
  });
  btnGrade.addEventListener('click', function () { gerenciando = false; modoVis = 'grade'; salvarModo(); render(); });
  btnLista.addEventListener('click', function () { gerenciando = false; modoVis = 'lista'; salvarModo(); render(); });
  if (btnGerenciar) {
    btnGerenciar.addEventListener('click', function () {
      gerenciando = !gerenciando;
      render();
    });
  }

  render();
}());
