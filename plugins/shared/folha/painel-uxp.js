/** Interface Folha usada pelos painéis UXP do Photoshop e do InDesign. */
const { defaults } = require('./engine.js');
const { executar } = require('./operacoes.js');
const fs = require('uxp').storage.localFileSystem;

const tarefas = [
  ['montar-pecas', 'Montar peças'],
  ['planejar-cadernos', 'Planejar cadernos'],
  ['planejar-lona', 'Planejar lona'],
  ['avaliar-orientacoes', 'Avaliar orientações'],
  ['comparar-folhas', 'Comparar folhas'],
  ['sugerir-folhas', 'Sugerir folhas']
];
const camposPeca = [['pw', 'Largura final (mm)'], ['ph', 'Altura final (mm)']];
const camposFolha = [['sw', 'Largura da folha (mm)'], ['sh', 'Altura da folha (mm)']];
const camposTiragem = [['qty', 'Tiragem'], ['bleed', 'Sangria por lado (mm)']];
const camposGrade = [['gapX', 'Intervalo horizontal (mm)'], ['gapY', 'Intervalo vertical (mm)']];
const processos = ['offset', 'digital', 'pb', 'laser'];
const orientacoes = [['auto', 'Automática'], ['normal', 'Retrato'], ['rotate', 'Paisagem'], ['mixed', 'Corte misto']];
const viradas = [
  ['single', 'Somente frente'], ['sheetwise', 'Sheetwise'], ['perfector', 'Perfector'],
  ['turn', 'Work-and-Turn'], ['tumble', 'Work-and-Tumble']
];
const esquema = {
  'montar-pecas': [
    ...camposPeca, ...camposFolha, ...camposTiragem, ...camposGrade,
    ['process', 'Processo', processos], ['style', 'Modo de impressão', viradas],
    ['orientation', 'Orientação', orientacoes],
    ['left', 'Esquadro esquerdo (mm)'], ['right', 'Esquadro direito (mm)'],
    ['grip', 'Pinça (mm)'], ['tail', 'Contrapinça (mm)'],
    ['gsm', 'Gramatura (g/m²)'], ['setup', 'Acerto por forma'], ['waste', 'Perdas (%)']
  ],
  'planejar-cadernos': [
    ...camposPeca, ...camposFolha, ...camposTiragem, ['pages', 'Páginas'],
    ['foldPattern', 'Dobra', ['F4-1', 'F8-1', 'F16-1', ['LOOSE-2', 'Folhas soltas 2-up']]],
    ['binding', 'Encadernação', [
      ['saddle', 'Canoa'], ['perfect', 'Lombada quadrada'], ['spiral', 'Espiral'],
      ['wireo', 'Wire-O'], ['pad', 'Bloco']
    ]],
    ['creepMode', 'Compensação de creep', [['manual', 'Manual'], ['auto', 'Automática']]],
    ['creep', 'Creep manual (mm)'], ['caliper', 'Espessura do papel (mm)'],
    ['milling', 'Fresagem (mm)'], ['headTrim', 'Refile de cabeça (mm)'],
    ['style', 'Modo de impressão', viradas.slice(1, 3)]
  ],
  'planejar-lona': [
    ...camposPeca, ['sw', 'Largura da mídia (mm)'], ['sh', 'Comprimento da mídia (mm)'],
    ['qty', 'Tiragem'], ['hem', 'Bainha (mm)'], ['weld', 'Solda (mm)'],
    ['polePocketTop', 'Bolsa superior (mm)'], ['polePocketBottom', 'Bolsa inferior (mm)'],
    ['grommetSpacing', 'Intervalo entre ilhós (mm)'], ['grommetInset', 'Recuo dos ilhós (mm)']
  ],
  'avaliar-orientacoes': [...camposPeca, ...camposFolha, ...camposTiragem, ...camposGrade],
  'comparar-folhas': [],
  'sugerir-folhas': [
    ...camposPeca, ...camposTiragem, ...camposGrade, ['process', 'Processo', processos],
    ['suggestFamily', 'Família', [['all', 'Todas'], ['nobel', 'Nobel'], ['digital', 'Digital'], ['offset_large', 'Offset']]],
    ['suggestSort', 'Ordenar por', [
      ['usage', 'Aproveitamento da folha'], ['effective', 'Aproveitamento real'],
      ['count', 'Peças por folha'], ['area', 'Menor área bruta']
    ]]
  ]
};

function criar(tag, texto, classe) {
  const el = document.createElement(tag);
  if (texto !== undefined) el.textContent = texto;
  if (classe) el.className = classe;
  return el;
}

function seletor(opcoes, valor, rotulo) {
  const select = criar('select');
  select.setAttribute('aria-label', rotulo);
  for (const opcao of opcoes) {
    const [id, nome] = Array.isArray(opcao) ? opcao : [opcao, opcao];
    const opt = criar('option', nome);
    opt.setAttribute('value', id);
    if (id === valor) opt.setAttribute('selected', 'selected');
    select.appendChild(opt);
  }
  return select;
}

function botao(rotulo, clique, classe = '') {
  const el = criar('button', rotulo, classe);
  el.type = 'button';
  el.addEventListener('click', clique);
  return el;
}

function mostrarGeometria(alvo, largura, altura, itens) {
  if (!(largura > 0 && altura > 0) || !itens.length) return;
  const escala = 200 / Math.max(largura, altura);
  const folha = criar('div', undefined, 'folha-uxp-prancha');
  folha.setAttribute('role', 'img');
  folha.setAttribute('aria-label', `Diagrama de ${largura} por ${altura} mm, ${itens.length} posição(ões)`);
  folha.style.width = largura * escala + 'px';
  folha.style.height = altura * escala + 'px';
  for (const item of itens) {
    const peca = criar('div', undefined, 'folha-uxp-peca');
    peca.style.left = item.x * escala + 'px';
    peca.style.top = item.y * escala + 'px';
    peca.style.width = item.w * escala + 'px';
    peca.style.height = item.h * escala + 'px';
    folha.appendChild(peca);
  }
  alvo.appendChild(folha);
}

function montarResultado(alvo, plano) {
  alvo.innerHTML = '';
  const { resultado: r, parametros: p } = plano;
  if (r.layoutNote) alvo.appendChild(criar('p', r.layoutNote));
  for (const erro of r.errors || []) alvo.appendChild(criar('p', erro, 'folha-uxp-erro'));
  for (const aviso of r.warnings || []) alvo.appendChild(criar('p', aviso));
  if (r.errors?.length) return;
  if (r.compareInfo) {
    const { items } = r.compareInfo;
    const largura = Math.max(...items.map((item) => item.w));
    const altura = Math.max(...items.map((item) => item.h));
    for (const folha of items) {
      alvo.appendChild(criar('p', `${folha.name} · ${folha.w} × ${folha.h} mm · ${folha.areaCm2} cm²`));
      mostrarGeometria(alvo, largura, altura, [{ x: 0, y: 0, w: folha.w, h: folha.h }]);
    }
    return;
  }
  if (r.suggestInfo) {
    for (const s of r.suggestInfo.suggestions) {
      alvo.appendChild(criar('p', `${s.rank}. ${s.name} · ${s.sw} × ${s.sh} mm · ${s.count} peças · ${s.totalSheets} folhas`));
    }
  }
  if (r.freeComparison) {
    const linhas = [
      ['normal', 'Retrato'], ['rotate', 'Paisagem'], ['mixed', 'Corte misto']
    ];
    for (const [id, nome] of linhas) {
      if (r.freeComparison[id]) alvo.appendChild(criar('p', `${nome} · ${r.freeComparison[id].count} peças`));
    }
  }
  if (r.plan?.length) {
    for (const caderno of r.plan) {
      const face = (cells) => cells.map((linha) => linha.map((c) => c.isBlank ? 'branco' : c.page).join(' · ')).join(' / ');
      alvo.appendChild(criar('p', `Caderno ${caderno.index + 1} · Frente ${face(caderno.frontCells)} · Verso ${face(caderno.backCells)}`));
    }
  }
  if (Number.isFinite(r.total)) {
    alvo.appendChild(criar('p', `${r.total} folhas · ${r.count} peças por folha · ${r.usage.toFixed(1)}% de aproveitamento`));
  }
  if (r.visualInfo) {
    for (const painel of r.visualInfo.panels) {
      alvo.appendChild(criar('p', `Pano ${painel.index} · ${painel.w} × ${painel.h} mm`));
    }
  }
  const largura = r.visualInfo?.cutW ?? r.activeSuggestion?.sw ?? p.sw ?? defaults.sw;
  const altura = r.visualInfo?.cutH ?? r.activeSuggestion?.sh ?? p.sh ?? defaults.sh;
  if (plano.faces?.length) {
    const nomes = { frente: 'Frente', verso: 'Verso', 'forma-unica': 'Forma única' };
    for (const face of plano.faces) {
      alvo.appendChild(criar('p', nomes[face.id]));
      mostrarGeometria(alvo, largura, altura, face.items);
    }
  } else {
    mostrarGeometria(alvo, largura, altura, r.items || []);
  }
}

function iniciarPainelFolha(alvo, { voltar, status, aplicarEditorial }) {
  const titulo = criar('h2', 'Folha');
  const seletorTarefa = seletor(tarefas, tarefas[0][0], 'Operação do Folha');
  const form = criar('div', undefined, 'folha-uxp-campos');
  const acoes = criar('div', undefined, 'folha-uxp-acoes');
  const resultado = criar('div', undefined, 'folha-uxp-resultado');
  resultado.setAttribute('aria-live', 'polite');
  let atual = null;
  let campos = [];
  let leituras = {};
  let ocupado = false;

  function invalidar() {
    atual = null;
    resultado.innerHTML = '';
    exportar.disabled = true;
    if (aplicar) aplicar.disabled = true;
  }

  function mostrar(plano) {
    atual = plano;
    montarResultado(resultado, plano);
    exportar.disabled = Boolean(plano.resultado.errors?.length);
    if (aplicar) aplicar.disabled = plano.operacao !== 'planejar-cadernos' || !plano.materializavel;
    status(exportar.disabled ? 'Confira os erros do cálculo.' : 'Cálculo do Folha concluído.', exportar.disabled ? 'erro' : 'sucesso');
  }

  function montarCampos(operacao, parametros = {}) {
    seletorTarefa.setAttribute('value', operacao);
    form.innerHTML = '';
    leituras = { ...parametros };
    campos = esquema[operacao].map(([id, rotulo, opcoes]) => {
      const grupo = criar('div', undefined, 'folha-uxp-campo');
      grupo.appendChild(criar('span', rotulo));
      const valor = parametros[id] ?? (id === 'style' && operacao === 'planejar-cadernos' ? 'sheetwise' : defaults[id]);
      const entrada = opcoes ? seletor(opcoes, valor, rotulo) : criar('input');
      if (!opcoes) {
        entrada.type = 'text';
        entrada.value = String(valor);
        entrada.setAttribute('aria-label', rotulo);
      }
      entrada.addEventListener('input', invalidar);
      entrada.addEventListener('change', invalidar);
      grupo.appendChild(entrada);
      form.appendChild(grupo);
      return [id, rotulo, entrada, Boolean(opcoes)];
    });
    if (operacao === 'comparar-folhas') {
      leituras.compareSheets = parametros.compareSheets || defaults.compareSheets;
      const rotulo = 'Formatos em mm, um por linha (210 × 297)';
      const campo = criar('div', undefined, 'folha-uxp-campo folha-uxp-campo-largo');
      campo.appendChild(criar('span', rotulo));
      const linha = criar('textarea');
      linha.setAttribute('aria-label', rotulo);
      linha.value = leituras.compareSheets.map((f) => `${f.w} × ${f.h}`).join('\n');
      linha.addEventListener('input', invalidar);
      campo.appendChild(linha);
      form.appendChild(campo);
      campos.push(['compareSheets', rotulo, linha, false]);
    }
    invalidar();
  }

  function calcular() {
    try {
      const parametros = { ...leituras };
      for (const [id, rotulo, entrada, texto] of campos) {
        const valor = String(entrada.value || '').trim();
        if (id === 'compareSheets') {
          const linhas = valor.split(/\r?\n/).filter((linha) => linha.trim());
          if (linhas.length > 8) throw Error('Informe até oito formatos.');
          parametros[id] = linhas.map((linha, i) => {
            const [w, h, extra] = linha.split(/[x×]/i).map((v) => Number(v.trim().replace(',', '.')));
            if (!(w > 0 && h > 0) || extra !== undefined) throw Error(`Confira as medidas do formato ${i + 1}.`);
            return { ...leituras.compareSheets?.[i], id: `cmp-${i + 1}`, w, h };
          });
        } else {
          const numero = Number(valor.replace(',', '.'));
          if (!valor || (!texto && !Number.isFinite(numero))) throw Error(`Confira o campo ${rotulo}.`);
          parametros[id] = texto ? valor : numero;
        }
      }
      mostrar(executar({ versaoContrato: 1, operacao: seletorTarefa.value, parametros }));
    } catch (e) {
      invalidar();
      status(e.message, 'erro');
    }
  }

  async function acaoArquivo(acao) {
    if (ocupado) return;
    ocupado = true;
    try {
      await acao();
    } catch (e) {
      status(e.message, 'erro');
    } finally {
      ocupado = false;
    }
  }

  const importar = botao('Abrir plano', () => acaoArquivo(async () => {
    const arquivo = await fs.getFileForOpening({ types: ['json'] });
    if (!arquivo) return;
    const conteudo = await arquivo.read();
    if (conteudo.length > 4 * 1024 * 1024) throw Error('O plano excede 4 MB.');
    const { versaoContrato, operacao, parametros } = JSON.parse(conteudo.replace(/^\uFEFF/, ''));
    const plano = executar({ versaoContrato, operacao, parametros });
    montarCampos(plano.operacao, plano.parametros);
    mostrar(plano);
  }));
  const exportar = botao('Salvar plano', () => acaoArquivo(async () => {
    const plano = atual;
    if (!plano) return;
    const arquivo = await fs.getFileForSaving(`folha-${plano.operacao}.json`, { types: ['json'] });
    if (!arquivo) return;
    await arquivo.write(JSON.stringify(plano, null, 2));
    status('Plano salvo.', 'sucesso');
  }));
  const aplicar = aplicarEditorial && botao('Criar prova em novo documento', () => acaoArquivo(async () => {
    if (!atual) return;
    const paginas = await aplicarEditorial(atual);
    status(`Prova criada em novo documento · ${paginas} face(s).`, 'sucesso');
  }));
  acoes.appendChild(botao('Calcular', calcular, 'folha-uxp-primario'));
  acoes.appendChild(importar);
  acoes.appendChild(exportar);
  if (aplicar) acoes.appendChild(aplicar);

  alvo.appendChild(botao('Voltar às ferramentas', voltar));
  alvo.appendChild(titulo);
  alvo.appendChild(seletorTarefa);
  alvo.appendChild(form);
  alvo.appendChild(acoes);
  alvo.appendChild(resultado);
  seletorTarefa.addEventListener('change', () => montarCampos(seletorTarefa.value));
  montarCampos(tarefas[0][0]);
}

function abrirPainelFolha(status, aplicarEditorial) {
  const atalho = document.getElementById('abrir-folha');
  const painel = document.getElementById('folha-painel');
  const ferramentas = [
    atalho.parentElement,
    document.getElementById('abas'),
    document.getElementById('lista')
  ];
  if (!painel.firstChild) {
    iniciarPainelFolha(painel, {
      status,
      aplicarEditorial,
      voltar() {
        painel.style.display = 'none';
        for (const el of ferramentas) el.style.display = '';
        atalho.focus();
        status('Pronto.');
      }
    });
  }
  for (const el of ferramentas) el.style.display = 'none';
  painel.style.display = 'block';
  painel.firstChild.focus();
  status('Escolha uma operação do Folha.');
}

module.exports = { abrirPainelFolha };
