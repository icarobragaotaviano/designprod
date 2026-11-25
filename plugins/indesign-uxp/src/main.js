/**
 * Painel IBD Ferramentas (InDesign UXP) com mostrar/ocultar funcoes.
 */
const { executarInDesignScript, caminhoNoDisco, caminhoStandalone } = require('./lib/id-bridge.js');
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

const CHAVE_FAV = 'ibd-id-uxp-favoritos-v1';
const CHAVE_MODO = 'ibd-id-uxp-modo-v1';
const CHAVE_OCULTAS = 'ibd-id-uxp-ocultas-v1';

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
function ehFavorito(id) { return favoritos.indexOf(id) > -1; }
function ehOculta(id) { return ocultas.indexOf(id) > -1; }
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
    ferramentas = (catalogo.ferramentas || [])
      .filter((f) => f.app === 'indesign')
      .map((f) => ({ ...f, icone: f.icone || resolverIconeId(f.id, f.tipo) }));
  } catch (e) {
    status('Nao foi possivel ler catalog.json: ' + e.message, 'erro');
  }
}

function tituloCurto(t) { return String(t || '').replace(/\s*\([^)]*\)/g, '').trim(); }

function filtrarLista(incluirOcultas) {
  const termo = elFiltro.value.trim().toLowerCase();
  return ferramentas.filter((f) => {
    if (!incluirOcultas && ehOculta(f.id)) return false;
    if (!incluirOcultas && abaAtiva === 'favoritos' && !ehFavorito(f.id)) return false;
    if (!termo) return true;
    return (
      f.titulo.toLowerCase().includes(termo) ||
      f.descricao.toLowerCase().includes(termo) ||
      (f.tags || []).join(' ').toLowerCase().includes(termo)
    );
  });
}

function criarBotaoEstrela(f) {
  const ativo = ehFavorito(f.id);
  const star = document.createElement('button');
  star.type = 'button';
  star.className = 'star-btn' + (ativo ? ' ativo' : '');
  star.title = ativo ? 'Remover dos favoritos' : 'Fixar nos favoritos';
  star.textContent = ativo ? '★' : '☆';
  star.onclick = (ev) => { ev.stopPropagation(); alternarFavorito(f.id); };
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
  btnOk.onclick = () => { gerenciando = false; render(); };
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
    iconeBox.innerHTML = iconeSvg(f.icone, null, 16);
    row.appendChild(iconeBox);

    const nm = document.createElement('span');
    nm.className = 'gerenciar-nome';
    nm.textContent = f.titulo;
    row.appendChild(nm);

    const st = document.createElement('span');
    st.className = 'gerenciar-estado';
    st.textContent = oculta ? 'Oculta' : 'Visivel';
    row.appendChild(st);

    row.onclick = (ev) => { if (ev.target !== chk) definirOculta(f.id, !oculta); };
    elLista.appendChild(row);
  }
}

function render() {
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
  elAbas.querySelectorAll('.aba').forEach((b) => b.setAttribute('aria-selected', String(!gerenciando && b.dataset.aba === abaAtiva)));

  if (gerenciando) {
    renderGerenciar();
    return;
  }

  const visiveis = filtrarLista(false);
  elLista.innerHTML = '';
  if (!visiveis.length) {
    const vazio = document.createElement('div');
    vazio.className = 'vazio';
    vazio.textContent = abaAtiva === 'favoritos'
      ? 'Nenhum favorito visivel. Clique na estrela ☆ para fixar ferramentas aqui.'
      : (ocultasValidas > 0 ? `Nenhuma ferramenta visivel (${ocultasValidas} oculta(s)).` : 'Nenhuma ferramenta encontrada.');
    if (ocultasValidas > 0) {
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
    if (modoVis === 'grade') {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.title = ferramenta.titulo + ' — ' + ferramenta.descricao;
      const topo = document.createElement('div');
      topo.className = 'tile-topo';
      const iconeBox = document.createElement('span');
      iconeBox.className = 'icone-badge';
      iconeBox.innerHTML = iconeSvg(ferramenta.icone, null, 22);
      topo.appendChild(iconeBox);
      topo.appendChild(criarBotaoEstrela(ferramenta));
      tile.appendChild(topo);
      const nome = document.createElement('div');
      nome.className = 'tile-titulo';
      nome.textContent = tituloCurto(ferramenta.titulo);
      tile.appendChild(nome);
      const pe = document.createElement('div');
      pe.className = 'tile-pe';
      const et = document.createElement('span');
      et.className = 'etiqueta-mini';
      et.textContent = 'JSX';
      pe.appendChild(et);
      tile.appendChild(pe);
      tile.onclick = () => executar(ferramenta, tile);
      elLista.appendChild(tile);
    } else {
      const cartao = document.createElement('div');
      cartao.className = 'cartao';
      const cab = document.createElement('div');
      cab.className = 'cartao-cab';
      const iconeBox = document.createElement('span');
      iconeBox.className = 'icone-badge pequeno';
      iconeBox.innerHTML = iconeSvg(ferramenta.icone, null, 18);
      cab.appendChild(iconeBox);
      const titulo = document.createElement('div');
      titulo.className = 'cartao-titulo';
      titulo.textContent = ferramenta.titulo;
      cab.appendChild(titulo);
      cab.appendChild(criarBotaoEstrela(ferramenta));
      cartao.appendChild(cab);
      const desc = document.createElement('div');
      desc.className = 'cartao-descricao';
      desc.textContent = ferramenta.descricao;
      cartao.appendChild(desc);
      const acoes = document.createElement('div');
      acoes.className = 'cartao-acoes';
      const btn = document.createElement('button');
      btn.textContent = 'Executar';
      btn.onclick = () => executar(ferramenta, btn);
      acoes.appendChild(btn);
      cartao.appendChild(acoes);
      elLista.appendChild(cartao);
    }
  }
}

async function executar(ferramenta, alvo) {
  if (alvo && 'disabled' in alvo) alvo.disabled = true;
  if (alvo) alvo.classList && alvo.classList.add('executando');
  status('Executando: ' + ferramenta.titulo + '...');
  try {
    const res = await executarInDesignScript(ferramenta.arquivo);
    if (res.ok) status('Concluido: ' + ferramenta.titulo, 'sucesso');
    else {
      const caminho = await caminhoNoDisco(caminhoStandalone(ferramenta.arquivo));
      status('Falhou: ' + res.erro + (caminho ? ' · Manual: ' + caminho : ''), 'erro');
    }
  } finally {
    if (alvo && 'disabled' in alvo) alvo.disabled = false;
    if (alvo) alvo.classList && alvo.classList.remove('executando');
  }
}

elFiltro.addEventListener('input', render);
elAbas.addEventListener('click', (e) => {
  const b = e.target.closest('.aba');
  if (!b) return;
  gerenciando = false;
  abaAtiva = b.dataset.aba;
  render();
});
btnModoGrade.addEventListener('click', () => { gerenciando = false; modoVis = 'grade'; salvarModo(); render(); });
btnModoLista.addEventListener('click', () => { gerenciando = false; modoVis = 'lista'; salvarModo(); render(); });
if (btnGerenciar) btnGerenciar.addEventListener('click', () => { gerenciando = !gerenciando; render(); });

carregarEstado();
carregarCatalogo().then(render);
