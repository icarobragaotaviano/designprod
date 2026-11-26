const folha = (classe, corpo) => `<div class="folha ${classe}">${corpo}</div>`;
const cortes = ['tl', 'tr', 'bl', 'br'].map(lado => `<i class="marca ${lado}"></i>`).join('');
const linha = '<i class="vinco-guia"></i><i class="vinco ponta-topo"></i><i class="vinco ponta-base"></i>';
const folhas = (n, render) => Array.from({ length: n }, (_, i) => render(i)).join('');
const mini = () => '<div class="mes-mini"><i></i>' + '<b></b>'.repeat(7) + '</div>';
const cmyk = (valores) => `<div class="tintas">${valores.map((n, i) => `<span class="canal canal-${i}" style="--valor:${n}%"><b>${'CMYK'[i]}</b><span>${n}%</span></span>`).join('')}</div>`;

export const figuras = {
  'forma-na-prancheta': ['A sangria de 3 mm expande os quatro lados do formato de corte.',
    folha('bleed', '<div class="limite corte"><b>100 × 150</b><span>Corte</span></div><small>106 × 156 com sangria</small>')],
  'pranchetas-em-lote': ['Seis pranchetas T8 em três colunas, com 8 mm de intervalo.',
    '<div class="folhas-lote">' + folhas(6, i => folha('lote', `<b>${String(i+1).padStart(2, '0')}</b>`)) + '</div>'],
  'lombada-e-capa-dura': ['Vista aberta. A vira circunda papelões, canaletas e lombada. Espessuras destacadas no esquema.',
    folha('capa-dura', '<small>Vira · 18 mm</small><div class="papeloes"><b>Contracapa</b><i></i><em aria-label="Lombada de 6,4 mm"></em><i></i><b>Frente</b></div><small>Canaletas · 7 mm</small>')],
  'wire-o': ['A guia horizontal demarca os primeiros 15 mm da prancheta.',
    folha('wire', `<div class="furo-faixa">${'<i></i>'.repeat(10)}</div><div class="wire-limite">15 mm</div><b>Área da arte</b>`)],
  'auto-k100': ['Ciano, magenta e amarelo zerados. Preto em 100%.',
    `<div class="antes-depois"><div><small>Preto composto</small>${cmyk([40,35,30,100])}</div><span aria-hidden="true">→</span><div><small>Preto puro</small>${cmyk([0,0,0,100])}</div></div>`],
  'tipografia-em-curvas': ['A letra vira um contorno com pontos de ancoragem na cópia.',
    `<div class="antes-depois curvas">${folha('letra', '<b>Aa</b><small>Texto editável</small>')}<span aria-hidden="true">→</span>${folha('letra ancora', '<b>Aa</b><i></i><i></i><i></i><i></i><small>Curvas</small>')}</div>`],
  'marcas-de-corte': ['As hastes começam fora da faixa azul de sangria.',
    folha('com-marcas', `<div class="arte-marcada"><b>Peça final</b></div>${cortes}`)],
  'vinco-externo': ['Dois traços externos indicam o vinco em X = 100 mm. A linha central aparece como referência no esquema.',
    folha('com-marcas folder', `<div class="arte-marcada"><b>Painel 1</b><b>Painel 2</b></div>${linha}${cortes}`)],
  'mascara-spot': ['A máscara mantém a posição do logo e usa uma separação spot própria.',
    `<div class="antes-depois spot">${folha('logo', '<b></b><small>Arte CMYK</small>')}<span aria-hidden="true">+</span>${folha('logo verniz', '<b></b><small>Verniz_UV</small>')}</div>`],
  'pdf-de-enobrecimento': ['Três páginas registradas no mesmo formato. Arte, prova magenta e máscara em K100.',
    '<div class="paginas-pdf">' + ['CMYK', 'Magenta', 'K100'].map((nome, i) =>
      folha('pdf pdf-' + (i+1), `<div class="prova-arte"></div><div class="prova-mascara"></div><small>${nome}</small>`)).join('') + '</div>'],
  'calendario-anual': ['Mesa com 14 faces, parede com 12 meses reunidos e bolso com seis meses por face.',
    `<div class="modelos-calendario">${folha('cal mesa', '<small>Mesa</small><b>2028</b>' + mini())}${folha('cal parede', '<small>Parede</small><b>2028</b><div>' + mini().repeat(12) + '</div>')}${folha('cal bolso', '<small>Bolso</small><div>' + mini().repeat(6) + '</div>')}</div>`],
  'imposicao-sra3': ['Grade de 3 × 7 cartões. A faixa inferior é a reserva de pinça.',
    folha('imposicao', `<div>${'<i></i>'.repeat(21)}</div><small>Pinça inferior</small>`)],
  'impressao-e-corte': ['Arte repetida e faca vetorial ocupam as mesmas oito posições.',
    `<div class="antes-depois printcut">${folha('print-arte', '<div>' + '<i></i>'.repeat(8) + '</div><small>Impressão</small>')}<span aria-hidden="true">=</span>${folha('print-faca', '<div>' + '<i></i>'.repeat(8) + '</div><small>Faca</small>')}</div>`]
};
