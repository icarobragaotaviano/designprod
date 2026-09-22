/**
 * Painel IBD Ferramentas.
 *
 * O painel nao conhece nenhuma ferramenta por nome: ele le catalog.json,
 * gerado por tools/build-catalog.mjs a partir dos metadados dos scripts.
 * Ferramenta nova no repositorio aparece aqui depois de "npm run catalog"
 * e "npm run build:plugin" — sem editar este arquivo.
 */
const { executarExtendScript, caminhoNoDisco } = require('./lib/es-bridge.js');
const { ferramentas: ferramentasUXP } = require('./lib/ferramentas-uxp.js');
const fs = require('uxp').storage.localFileSystem;

const elLista = document.getElementById('lista');
const elFiltro = document.getElementById('filtro');
const elStatus = document.getElementById('status');
const elVersao = document.getElementById('versao');
const elMarca = document.getElementById('marca');

let ferramentas = [];

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

    // O painel roda dentro do Photoshop: so scripts deste app sao executaveis.
    const doPhotoshop = (catalogo.ferramentas || []).filter((f) => f.app === 'photoshop');
    ferramentas = [...ferramentasUXP, ...doPhotoshop];
  } catch (e) {
    status('Nao foi possivel ler catalog.json: ' + e.message, 'erro');
    ferramentas = [...ferramentasUXP];
  }
}

function render() {
  const termo = elFiltro.value.trim().toLowerCase();
  const visiveis = ferramentas.filter((f) => {
    if (!termo) return true;
    return (
      f.titulo.toLowerCase().includes(termo) ||
      f.descricao.toLowerCase().includes(termo) ||
      (f.tags || []).join(' ').toLowerCase().includes(termo)
    );
  });

  elLista.innerHTML = '';

  if (!visiveis.length) {
    const vazio = document.createElement('div');
    vazio.className = 'vazio';
    vazio.textContent = 'Nenhuma ferramenta encontrada.';
    elLista.appendChild(vazio);
    return;
  }

  for (const ferramenta of visiveis) {
    elLista.appendChild(montarCartao(ferramenta));
  }
}

function montarCartao(ferramenta) {
  const cartao = document.createElement('div');
  cartao.className = 'cartao';

  const titulo = document.createElement('div');
  titulo.className = 'cartao-titulo';
  titulo.textContent = ferramenta.titulo;
  cartao.appendChild(titulo);

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

async function executar(ferramenta, botao) {
  botao.disabled = true;
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
    botao.disabled = false;
  }
}

async function mostrarCaminho(ferramenta) {
  const caminho = await caminhoNoDisco('bundle/' + ferramenta.arquivo);
  if (caminho) {
    status(caminho);
  } else {
    status('Arquivo nao encontrado no pacote do plugin.', 'erro');
  }
}

async function mostrarAjudaAction(ferramenta) {
  const caminho = await caminhoNoDisco('bundle/' + ferramenta.arquivo);
  status('Para carregar esta action: abra Janela > Ações (Alt+F9) > menu do painel > Carregar Ações (ou dê duplo clique no arquivo: ' + (caminho || ferramenta.arquivo) + ').');
}

elFiltro.addEventListener('input', render);

carregarCatalogo().then(render);
