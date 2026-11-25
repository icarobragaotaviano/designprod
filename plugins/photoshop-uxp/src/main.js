/**
 * Painel IBD Ferramentas (Photoshop UXP).
 *
 * Exibe scripts, rotinas UXP e actions em grade de icones ("iconezinhos")
 * ou lista detalhada, com busca instantanea, favoritos e mostrar/ocultar funcoes.
 */
const { executarExtendScript, caminhoNoDisco } = require('./lib/es-bridge.js');
const { ferramentas: ferramentasUXP } = require('./lib/ferramentas-uxp.js');
const { resolverIconeId, iconeSvg } = require('./lib/icones.js');
const fs = require('uxp').storage.localFileSystem;

const elLista = document.getElementById('lista');
const elFiltro = document.getElementById('filtro');
const elStatus = document.getElementById('status');
const elVersao = document.getElementById('versao');
const elMarca = document.getElementById('marca');
const elFavContador = document.getElementById('fav-contador');
const elAbas = document.getElementById('abas');
const btnModoGrade = document.getElementById('modo-grade');
const btnModoLista = document.getElementById('modo-lista');
const btnGerenciar = document.getElementById('btn-gerenciar');
const elOcultasBadge = document.getElementById('ocultas-badge');

const CHAVE_FAV = 'ibd-ps-uxp-favoritos-v1';
const CHAVE_MODO = 'ibd-ps-uxp-modo-v1';
const CHAVE_OCULTAS = 'ibd-ps-uxp-ocultas-v1';

let ferramentas = [];
let abaAtiva = 'todos';
let modoVis = 'grade';
let gerenciando = false;
let favoritos = [];
let ocultas = [];

function carregarEstado() {
  try {
    const brutoFav = window.localStorage.getItem(CHAVE_FAV);
    if (brutoFav) {
      const l = JSON.parse(brutoFav);
      if (Array.isArray(l)) favoritos = l;
    }
    const brutoOc = window.localStorage.getItem(CHAVE_OCULTAS);
    if (brutoOc) {
      const lo = JSON.parse(brutoOc);
      if (Array.isArray(lo)) ocultas = lo;
    }
    const m = window.localStorage.getItem(CHAVE_MODO);
    if (m === 'grade' || m === 'lista') modoVis = m;
  } catch (e) {}
}

function salvarFavoritos() {
  try { window.localStorage.setItem(CHAVE_FAV, JSON.stringify(favoritos)); } catch (e) {}
}

function salvarOcultas() {
  try { window.localStorage.setItem(CHAVE_OCULTAS, JSON.stringify(ocultas)); } catch (e) {}
}

function salvarModo() {
  try { window.localStorage.setItem(CHAVE_MODO, modoVis); } catch (e) {}
}

function ehFavorito(id) {
  return favoritos.indexOf(id) > -1;
}

function ehOculta(id) {
  return ocultas.indexOf(id) > -1;
}

function alternarFavorito(id) {
  const i = favoritos.indexOf(id);
  if (i > -1) favoritos.splice(i, 1);
  else favoritos.push(id);
  salvarFavoritos();
  render();
}

function definirOculta(id, esconder) {
  const i = ocultas.indexOf(id);
  if (esconder && i === -1) ocultas.push(id);
  else if (!esconder && i > -1) ocultas.splice(i, 1);
  salvarOcultas();
  render();
}

function mostrarTodas() {
  ocultas = [];
  salvarOcultas();
  status('Todas as funcoes estao visiveis.', 'sucesso');
  render();
}

function status(texto, tipo) {
  elStatus.textContent = texto;
  elStatus.parentElement.className = 'rodape' + (tipo ? ' ' + tipo : '');
}

async function carregarCatalogo() {
  try {
    const pasta = await fs.getPluginFolder();
    const arquivo = await pasta.getEntry('catalog.json');
    const catalogo = JSON.parse(await arquivo.read());

    elMarca.textContent = catalogo.marca || 'IBD';
    elVersao.textContent = 'v' + (catalogo.versao || '0.0.0');

    const doPhotoshop = (catalogo.ferramentas || [])
      .filter((f) => f.app === 'photoshop')
      .map((f) => ({ ...f, icone: f.icone || resolverIconeId(f.id, f.tipo) }));
    const uxpComIcone = ferramentasUXP.map((f) => ({
      ...f,
      icone: f.icone || resolverIconeId(f.id, f.tipo || 'uxp')
    }));
    ferramentas = [...uxpComIcone, ...doPhotoshop];
  } catch (e) {
    status('Nao foi possivel ler catalog.json: ' + e.message, 'erro');
    ferramentas = ferramentasUXP.map((f) => ({ ...f, icone: resolverIconeId(f.id, 'uxp') }));
  }
}

function tituloCurto(titulo) {
  return String(titulo || '')
    .replace(/\s*\([^)]*\)/g, '')
    .trim();
}

function filtrarLista(incluirOcultas) {
  const termo = elFiltro.value.trim().toLowerCase();
  return ferramentas.filter((f) => {
    if (!incluirOcultas && ehOculta(f.id)) return false;
    if (!incluirOcultas) {
      if (abaAtiva === 'favoritos' && !ehFavorito(f.id)) return false;
      if (abaAtiva === 'scripts' && f.tipo === 'action') return false;
      if (abaAtiva === 'actions' && f.tipo !== 'action') return false;
    }
    if (!termo) return true;
    return (
      f.titulo.toLowerCase().includes(termo) ||
      f.descricao.toLowerCase().includes(termo) ||
      (f.tags || []).join(' ').toLowerCase().includes(termo)
    );
  });
}

function atualizarControlesTopo() {
  const ocultasValidas = ferramentas.filter((f) => ehOculta(f.id)).length;
  const favValidos = favoritos.filter((id) => ferramentas.some((f) => f.id === id && !ehOculta(f.id))).length;
  elFavContador.textContent = String(favValidos);

  if (elOcultasBadge) {
    elOcultasBadge.textContent = String(ocultasValidas);
    elOcultasBadge.hidden = ocultasValidas === 0;
  }

  btnModoGrade.setAttribute('aria-pressed', String(!gerenciando && modoVis === 'grade'));
  btnModoLista.setAttribute('aria-pressed', String(!gerenciando && modoVis === 'lista'));
  if (btnGerenciar) btnGerenciar.setAttribute('aria-pressed', String(gerenciando));
  elLista.className = 'lista ' + (gerenciando ? 'modo-lista' : (modoVis === 'grade' ? 'modo-grade' : 'modo-lista'));

  elAbas.querySelectorAll('.aba').forEach((b) => {
    b.setAttribute('aria-selected', String(!gerenciando && b.dataset.aba === abaAtiva));
  });
}

function criarBotaoEstrela(f) {
  const ativo = ehFavorito(f.id);
  const star = document.createElement('button');
  star.type = 'button';
  star.className = 'star-btn' + (ativo ? ' ativo' : '');
  star.title = ativo ? 'Remover dos favoritos' : 'Fixar nos favoritos';
  star.setAttribute('aria-pressed', String(ativo));
  star.textContent = ativo ? '★' : '☆';
  star.onclick = (ev) => {
    ev.stopPropagation();
    alternarFavorito(f.id);
  };
  return star;
}

function renderGerenciar() {
  elLista.innerHTML = '';
  const todas = filtrarLista(true);

  const barra = document.createElement('div');
  barra.className = 'gerenciar-barra';
  const info = document.createElement('span');
  info.className = 'gerenciar-info';
  const visCount = todas.filter((f) => !ehOculta(f.id)).length;
  info.textContent = `${visCount} de ${todas.length} visiveis`;
  barra.appendChild(info);

  const acoes = document.createElement('div');
  acoes.className = 'gerenciar-acoes';
  const btnTodas = document.createElement('button');
  btnTodas.type = 'button';
  btnTodas.textContent = 'Mostrar todas';
  btnTodas.onclick = mostrarTodas;
  acoes.appendChild(btnTodas);

  const btnOk = document.createElement('button');
  btnOk.type = 'button';
  btnOk.className = 'primario';
  btnOk.textContent = 'Concluir';
  btnOk.onclick = () => {
    gerenciando = false;
    render();
  };
  acoes.appendChild(btnOk);
  barra.appendChild(acoes);
  elLista.appendChild(barra);

  for (const f of todas) {
    const oculta = ehOculta(f.id);
    const row = document.createElement('div');
    row.className = 'gerenciar-item' + (oculta ? ' oculta' : '');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = !oculta;
    chk.onchange = () => definirOculta(f.id, !chk.checked);
    row.appendChild(chk);

    const iconeBox = document.createElement('span');
    iconeBox.className = 'icone-badge pequeno';
    iconeBox.innerHTML = iconeSvg(f.icone || resolverIconeId(f.id, f.tipo), null, 16);
    row.appendChild(iconeBox);

    const nm = document.createElement('span');
    nm.className = 'gerenciar-nome';
    nm.textContent = f.titulo;
    row.appendChild(nm);

    const st = document.createElement('span');
    st.className = 'gerenciar-estado';
    st.textContent = oculta ? 'Oculta' : 'Visivel';
    row.appendChild(st);

    row.onclick = (ev) => {
      if (ev.target === chk) return;
      definirOculta(f.id, !oculta);
    };
    elLista.appendChild(row);
  }
}

function render() {
  atualizarControlesTopo();
  if (gerenciando) {
    renderGerenciar();
    return;
  }

  const visiveis = filtrarLista(false);
  elLista.innerHTML = '';

  if (!visiveis.length) {
    const ocultasCount = ferramentas.filter((f) => ehOculta(f.id)).length;
    const vazio = document.createElement('div');
    vazio.className = 'vazio';
    vazio.textContent = abaAtiva === 'favoritos'
      ? 'Nenhuma ferramenta favoritada visivel. Clique na estrela ☆ em qualquer icone para fixar aqui.'
      : (ocultasCount > 0
          ? `Nenhuma ferramenta visivel (${ocultasCount} oculta(s)).`
          : 'Nenhuma ferramenta encontrada para esse filtro.');
    if (ocultasCount > 0) {
      const br = document.createElement('br');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vazio-btn';
      btn.textContent = 'Gerenciar funcoes ocultas';
      btn.onclick = () => { gerenciando = true; render(); };
      vazio.appendChild(br);
      vazio.appendChild(btn);
    }
    elLista.appendChild(vazio);
    return;
  }

  for (const ferramenta of visiveis) {
    elLista.appendChild(modoVis === 'grade' ? montarTileIcone(ferramenta) : montarCartaoLista(ferramenta));
  }
}

function montarTileIcone(ferramenta) {
  const tile = document.createElement('div');
  tile.className = 'tile';
  tile.title = ferramenta.titulo + ' — ' + ferramenta.descricao;

  const topo = document.createElement('div');
  topo.className = 'tile-topo';

  const iconeBox = document.createElement('span');
  iconeBox.className = 'icone-badge';
  iconeBox.innerHTML = iconeSvg(ferramenta.icone || resolverIconeId(ferramenta.id, ferramenta.tipo), null, 22);
  topo.appendChild(iconeBox);
  topo.appendChild(criarBotaoEstrela(ferramenta));
  tile.appendChild(topo);

  const nome = document.createElement('div');
  nome.className = 'tile-titulo';
  nome.textContent = tituloCurto(ferramenta.titulo);
  tile.appendChild(nome);

  const pe = document.createElement('div');
  pe.className = 'tile-pe';
  const tipoBadge = document.createElement('span');
  tipoBadge.className = 'etiqueta-mini';
  tipoBadge.textContent = ferramenta.tipo === 'uxp' ? 'UXP' : (ferramenta.tipo === 'action' ? 'ATN' : 'JSX');
  pe.appendChild(tipoBadge);
  tile.appendChild(pe);

  tile.onclick = () => {
    if (ferramenta.tipo === 'action') mostrarAjudaAction(ferramenta);
    else executar(ferramenta, tile);
  };

  return tile;
}

function montarCartaoLista(ferramenta) {
  const cartao = document.createElement('div');
  cartao.className = 'cartao';

  const cab = document.createElement('div');
  cab.className = 'cartao-cab';

  const iconeBox = document.createElement('span');
  iconeBox.className = 'icone-badge pequeno';
  iconeBox.innerHTML = iconeSvg(ferramenta.icone || resolverIconeId(ferramenta.id, ferramenta.tipo), null, 18);
  cab.appendChild(iconeBox);

  const titulo = document.createElement('div');
  titulo.className = 'cartao-titulo';
  titulo.textContent = ferramenta.titulo;
  cab.appendChild(titulo);
  cab.appendChild(criarBotaoEstrela(ferramenta));
  cartao.appendChild(cab);

  const descricao = document.createElement('div');
  descricao.className = 'cartao-descricao';
  descricao.textContent = ferramenta.descricao;
  cartao.appendChild(descricao);

  const acoes = document.createElement('div');
  acoes.className = 'cartao-acoes';

  if (ferramenta.tipo === 'action') {
    const botaoAjuda = document.createElement('button');
    botaoAjuda.textContent = 'Como carregar';
    botaoAjuda.onclick = () => mostrarAjudaAction(ferramenta);
    acoes.appendChild(botaoAjuda);

    const botaoCaminho = document.createElement('button');
    botaoCaminho.className = 'secundario';
    botaoCaminho.textContent = 'Ver caminho';
    botaoCaminho.onclick = () => mostrarCaminho(ferramenta);
    acoes.appendChild(botaoCaminho);

    const etiqueta = document.createElement('span');
    etiqueta.className = 'etiqueta';
    etiqueta.textContent = 'Action .atn';
    acoes.appendChild(etiqueta);
  } else {
    const botao = document.createElement('button');
    botao.textContent = 'Executar';
    botao.onclick = () => executar(ferramenta, botao);
    acoes.appendChild(botao);

    const etiqueta = document.createElement('span');
    etiqueta.className = 'etiqueta';
    etiqueta.textContent = ferramenta.tipo === 'uxp' ? 'UXP' : 'ExtendScript';
    acoes.appendChild(etiqueta);
  }

  cartao.appendChild(acoes);
  return cartao;
}

async function executar(ferramenta, alvoEl) {
  if (alvoEl && 'disabled' in alvoEl) alvoEl.disabled = true;
  if (alvoEl) alvoEl.classList && alvoEl.classList.add('executando');
  status('Executando: ' + ferramenta.titulo + '...');

  try {
    if (ferramenta.tipo === 'uxp') {
      const mensagem = await ferramenta.executar();
      status(mensagem || 'Concluido.', 'sucesso');
      return;
    }

    const caminho = 'bundle/' + ferramenta.arquivo;
    const resultado = await executarExtendScript(caminho, 'IBD — ' + ferramenta.titulo);

    if (resultado.ok) {
      status('Concluido: ' + ferramenta.titulo, 'sucesso');
    } else {
      status('Falhou: ' + resultado.erro + ' — use Arquivo > Scripts > Procurar.', 'erro');
      await mostrarCaminho(ferramenta);
    }
  } catch (e) {
    status('Erro: ' + (e.message || e), 'erro');
  } finally {
    if (alvoEl && 'disabled' in alvoEl) alvoEl.disabled = false;
    if (alvoEl) alvoEl.classList && alvoEl.classList.remove('executando');
  }
}

async function mostrarCaminho(ferramenta) {
  const caminho = await caminhoNoDisco('bundle/' + ferramenta.arquivo);
  if (caminho) status(caminho);
  else status('Arquivo nao encontrado no pacote do plugin.', 'erro');
}

async function mostrarAjudaAction(ferramenta) {
  const caminho = await caminhoNoDisco('bundle/' + ferramenta.arquivo);
  status('Janela > Acoes (Alt+F9) > Carregar Acoes: ' + (caminho || ferramenta.arquivo));
}

elFiltro.addEventListener('input', render);
elAbas.addEventListener('click', (e) => {
  const btn = e.target.closest('.aba');
  if (!btn) return;
  gerenciando = false;
  abaAtiva = btn.dataset.aba;
  render();
});
btnModoGrade.addEventListener('click', () => {
  gerenciando = false;
  modoVis = 'grade';
  salvarModo();
  render();
});
btnModoLista.addEventListener('click', () => {
  gerenciando = false;
  modoVis = 'lista';
  salvarModo();
  render();
});
if (btnGerenciar) {
  btnGerenciar.addEventListener('click', () => {
    gerenciando = !gerenciando;
    render();
  });
}

carregarEstado();
carregarCatalogo().then(render);
