/**
 * Painel IBD Ferramentas (InDesign UXP).
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

const CHAVE_FAV = 'ibd-id-uxp-favoritos-v1';
const CHAVE_MODO = 'ibd-id-uxp-modo-v1';

let ferramentas = [];
let abaAtiva = 'todos';
let modoVis = 'grade';
let favoritos = [];

function carregarEstado() {
  try {
    const brutoFav = window.localStorage.getItem(CHAVE_FAV);
    if (brutoFav) {
      const l = JSON.parse(brutoFav);
      if (Array.isArray(l)) favoritos = l;
    }
    const m = window.localStorage.getItem(CHAVE_MODO);
    if (m === 'grade' || m === 'lista') modoVis = m;
  } catch (e) {}
}

function salvarFavoritos() {
  try { window.localStorage.setItem(CHAVE_FAV, JSON.stringify(favoritos)); } catch (e) {}
}
function salvarModo() {
  try { window.localStorage.setItem(CHAVE_MODO, modoVis); } catch (e) {}
}
function ehFavorito(id) { return favoritos.indexOf(id) > -1; }
function alternarFavorito(id) {
  const i = favoritos.indexOf(id);
  if (i > -1) favoritos.splice(i, 1);
  else favoritos.push(id);
  salvarFavoritos();
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

function filtrarLista() {
  const termo = elFiltro.value.trim().toLowerCase();
  return ferramentas.filter((f) => {
    if (abaAtiva === 'favoritos' && !ehFavorito(f.id)) return false;
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

function render() {
  const favValidos = favoritos.filter((id) => ferramentas.some((f) => f.id === id)).length;
  elFavContador.textContent = String(favValidos);
  btnModoGrade.setAttribute('aria-pressed', String(modoVis === 'grade'));
  btnModoLista.setAttribute('aria-pressed', String(modoVis === 'lista'));
  elLista.className = 'lista ' + (modoVis === 'grade' ? 'modo-grade' : 'modo-lista');
  elAbas.querySelectorAll('.aba').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aba === abaAtiva)));

  const visiveis = filtrarLista();
  elLista.innerHTML = '';
  if (!visiveis.length) {
    const vazio = document.createElement('div');
    vazio.className = 'vazio';
    vazio.textContent = abaAtiva === 'favoritos'
      ? 'Nenhum favorito ainda. Clique na estrela ☆ para fixar ferramentas aqui.'
      : 'Nenhuma ferramenta encontrada.';
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
  abaAtiva = b.dataset.aba;
  render();
});
btnModoGrade.addEventListener('click', () => { modoVis = 'grade'; salvarModo(); render(); });
btnModoLista.addEventListener('click', () => { modoVis = 'lista'; salvarModo(); render(); });

carregarEstado();
carregarCatalogo().then(render);
