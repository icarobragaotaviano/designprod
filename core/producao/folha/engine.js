/* Folha: pure geometry, folding, plate setup, finishing and large-format calculations. All dimensions are mm. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Folha = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  const FOLD_PATTERNS = {
    'F4-1': {
      code: 'F4-1',
      name: '4 páginas · 2×1 · 1 dobra vertical',
      pages: 4,
      cols: 2,
      rows: 1,
      folds: [{ seq: 1, dir: 'v', label: '1ª dobra · Lombada vertical' }]
    },
    'F8-1': {
      code: 'F8-1',
      name: '8 páginas · 2×2 · 2 dobras em cruz',
      pages: 8,
      cols: 2,
      rows: 2,
      folds: [
        { seq: 1, dir: 'h', label: '1ª dobra · Horizontal (cabeça)' },
        { seq: 2, dir: 'v', label: '2ª dobra · Lombada vertical' }
      ]
    },
    'F16-1': {
      code: 'F16-1',
      name: '16 páginas · 4×2 · 3 dobras em cruz',
      pages: 16,
      cols: 4,
      rows: 2,
      folds: [
        { seq: 1, dir: 'v', label: '1ª dobra · Vertical central' },
        { seq: 2, dir: 'h', label: '2ª dobra · Horizontal (cabeça)' },
        { seq: 3, dir: 'v', label: '3ª dobra · Lombada vertical' }
      ]
    },
    'LOOSE-2': {
      code: 'LOOSE-2',
      name: 'Folhas soltas 2-up (Espiral / Wire-O / Bloco)',
      pages: 4,
      cols: 2,
      rows: 1,
      folds: []
    }
  };

  const PAPER_PRESETS = [
    { id: 'nobel-t9', label: 'Padrão Nobel T9 · 220 × 380 mm', sw: 220, sh: 380 },
    { id: 'nobel-t9-l', label: 'Padrão Nobel T9 Paisagem · 380 × 220 mm', sw: 380, sh: 220 },
    { id: 'nobel-t8', label: 'Padrão Nobel T8 · 238 × 328 mm', sw: 238, sh: 328 },
    { id: 'nobel-t8-l', label: 'Padrão Nobel T8 Paisagem · 328 × 238 mm', sw: 328, sh: 238 },
    { id: 'nobel-t4', label: 'Padrão Nobel T4 · 328 × 478 mm', sw: 328, sh: 478 },
    { id: 'nobel-t4-l', label: 'Padrão Nobel T4 Paisagem · 478 × 328 mm', sw: 478, sh: 328 },
    { id: 'sra3', label: 'SRA3 · 320 × 450 mm', sw: 320, sh: 450 },
    { id: 'sra3-l', label: 'SRA3 Paisagem · 450 × 320 mm', sw: 450, sh: 320 },
    { id: 'a3', label: 'A3 · 297 × 420 mm', sw: 297, sh: 420 },
    { id: 'a4', label: 'A4 · 210 × 297 mm', sw: 210, sh: 297 },
    { id: 'a4plus-220', label: 'A4+ gráfico · 220 × 320 mm', sw: 220, sh: 320 },
    { id: 'a4plus-225', label: 'A4+ gráfico · 225 × 320 mm', sw: 225, sh: 320 },
    { id: 'a4plus-230', label: 'A4+ gráfico · 230 × 330 mm', sw: 230, sh: 330 },
    { id: 'a4plus-sub', label: 'Super A4 sublimação · 230 × 350 mm', sw: 230, sh: 350 },
    { id: 'oficio-320', label: 'Ofício / Folio · 216 × 320 mm', sw: 216, sh: 320 },
    { id: 'oficio-330', label: 'Ofício / Folio · 216 × 330 mm', sw: 216, sh: 330 },
    { id: 'super-a3', label: 'Super A3 / A3+ · 330 × 480 mm', sw: 330, sh: 480 },
    { id: 'meia-folha', label: 'Meia folha (1/2) · 480 × 660 mm', sw: 480, sh: 660 },
    { id: 'folha-inteira', label: 'Folha inteira (BB) · 660 × 960 mm', sw: 660, sh: 960 },
    { id: 'formato-76', label: 'Formato 76 × 112 cm · 760 × 1120 mm', sw: 760, sh: 1120 }
  ];

  const PIECE_PRESET_GROUPS = [
    {
      group: '1 · Série ISO A (A4, A5, A6, A3 e série completa A0–A10)',
      items: [
        { id: 'a4', label: 'A4 · 210 × 297 mm (Folha / Revista / Catálogo)', pw: 210, ph: 297 },
        { id: 'a5', label: 'A5 · 148 × 210 mm (Flyer / Livro / Bloco)', pw: 148, ph: 210 },
        { id: 'a6', label: 'A6 · 105 × 148 mm (Panfleto / Postal / Bolso)', pw: 105, ph: 148 },
        { id: 'a3', label: 'A3 · 297 × 420 mm (Cartaz / Cardápio / Folder)', pw: 297, ph: 420 },
        { id: 'a7', label: 'A7 · 74 × 105 mm (Mini Flyer / Tag / Comanda)', pw: 74, ph: 105 },
        { id: 'a8', label: 'A8 · 52 × 74 mm (Cartão / Etiqueta ISO)', pw: 52, ph: 74 },
        { id: 'a9', label: 'A9 · 37 × 52 mm (Selo / Mini Etiqueta)', pw: 37, ph: 52 },
        { id: 'a10', label: 'A10 · 26 × 37 mm (Micro Etiqueta)', pw: 26, ph: 37 },
        { id: 'a2', label: 'A2 · 420 × 594 mm (Pôster Médio / Cartaz)', pw: 420, ph: 594 },
        { id: 'a1', label: 'A1 · 594 × 841 mm (Pôster Grande / Planta)', pw: 594, ph: 841 },
        { id: 'a0', label: 'A0 · 841 × 1189 mm (Planta / Pôster Máximo)', pw: 841, ph: 1189 },
        { id: 'a4-l', label: 'A4 Paisagem · 297 × 210 mm', pw: 297, ph: 210 },
        { id: 'a5-l', label: 'A5 Paisagem · 210 × 148 mm', pw: 210, ph: 148 },
        { id: 'a6-l', label: 'A6 Paisagem · 148 × 105 mm', pw: 148, ph: 105 },
        { id: 'a3-l', label: 'A3 Paisagem · 420 × 297 mm', pw: 420, ph: 297 }
      ]
    },
    {
      group: '2 · Formatos de Mercado: Carta, Ofício, DL, Série B e Quadrados',
      items: [
        { id: 'carta', label: 'Carta (Letter) · 216 × 279 mm', pw: 216, ph: 279 },
        { id: 'oficio', label: 'Ofício (Legal) · 216 × 356 mm', pw: 216, ph: 356 },
        { id: 'oficio-2', label: 'Ofício 2 (Fólio) · 216 × 330 mm', pw: 216, ph: 330 },
        { id: 'meio-oficio', label: 'Meio Ofício · 165 × 216 mm', pw: 165, ph: 216 },
        { id: 'dl', label: 'DL (1/3 de A4) · 99 × 210 mm (Folder / Filipeta)', pw: 99, ph: 210 },
        { id: 'b5', label: 'B5 (ISO) · 176 × 250 mm (Livro / Caderno)', pw: 176, ph: 250 },
        { id: 'b6', label: 'B6 (ISO) · 125 × 176 mm (Livro Compacto)', pw: 125, ph: 176 },
        { id: 'b4', label: 'B4 (ISO) · 250 × 353 mm', pw: 250, ph: 353 },
        { id: 'quad-100', label: 'Quadrado Pequeno · 100 × 100 mm', pw: 100, ph: 100 },
        { id: 'quad-148', label: 'Quadrado Médio · 148 × 148 mm', pw: 148, ph: 148 },
        { id: 'quad-200', label: 'Quadrado Catálogo · 200 × 200 mm', pw: 200, ph: 200 },
        { id: 'quad-210', label: 'Quadrado Grande · 210 × 210 mm', pw: 210, ph: 210 }
      ]
    },
    {
      group: '3 · Comerciais Mais Comuns (Cartões, Panfletos, Folders e Pastas)',
      items: [
        { id: 'cv-br', label: 'Cartão de Visita Padrão BR · 90 × 50 mm', pw: 90, ph: 50 },
        { id: 'cv-br-v', label: 'Cartão de Visita Vertical · 50 × 90 mm', pw: 50, ph: 90 },
        { id: 'cv-iso', label: 'Cartão de Visita Internacional / ISO · 85 × 55 mm', pw: 85, ph: 55 },
        { id: 'cv-duplo', label: 'Cartão de Visita Duplo Aberto · 180 × 50 mm', pw: 180, ph: 50 },
        { id: 'panfleto-10x15', label: 'Panfleto Comercial 10×15 · 100 × 150 mm', pw: 100, ph: 150 },
        { id: 'panfleto-10x14', label: 'Panfleto Comercial 10×14 · 100 × 140 mm', pw: 100, ph: 140 },
        { id: 'panfleto-14x20', label: 'Panfleto Comercial 14×20 · 140 × 200 mm', pw: 140, ph: 200 },
        { id: 'panfleto-15x21', label: 'Panfleto Comercial 15×21 · 150 × 210 mm', pw: 150, ph: 210 },
        { id: 'filipeta-10x21', label: 'Filipeta / Comanda · 100 × 210 mm', pw: 100, ph: 210 },
        { id: 'folder-a4-aberto', label: 'Folder A4 Aberto (2 ou 3 dobras) · 297 × 210 mm', pw: 297, ph: 210 },
        { id: 'folder-20x21-aberto', label: 'Folder 1 Dobra Aberto · 200 × 210 mm', pw: 200, ph: 210 },
        { id: 'folder-63x21', label: 'Folder 3 Painéis A4 Aberto · 630 × 210 mm', pw: 630, ph: 210 },
        { id: 'pasta-fechada', label: 'Pasta Executiva Fechada · 220 × 310 mm', pw: 220, ph: 310 },
        { id: 'pasta-aberta', label: 'Pasta c/ Orelha Aberta · 450 × 310 mm', pw: 450, ph: 310 },
        { id: 'cartaz-30x42', label: 'Cartaz Comercial · 300 × 420 mm', pw: 300, ph: 420 },
        { id: 'cartaz-31x45', label: 'Cartaz Supermercado · 310 × 450 mm', pw: 310, ph: 450 }
      ]
    },
    {
      group: '4 · Editorial: Livros, Revistas, Apostilas, Agendas e Jornais',
      items: [
        { id: 'livro-br', label: 'Livro Padrão Brasileiro · 160 × 230 mm', pw: 160, ph: 230 },
        { id: 'livro-tec', label: 'Livro Técnico / Acadêmico · 170 × 240 mm', pw: 170, ph: 240 },
        { id: 'livro-lit', label: 'Livro Literatura / Romance · 140 × 210 mm', pw: 140, ph: 210 },
        { id: 'livro-pocket', label: 'Livro Pocket (De Bolso) · 120 × 180 mm', pw: 120, ph: 180 },
        { id: 'revista-padrao', label: 'Revista Padrão Comercial · 205 × 275 mm', pw: 205, ph: 275 },
        { id: 'revista-a4', label: 'Revista / Catálogo A4 · 210 × 297 mm', pw: 210, ph: 297 },
        { id: 'apostila-univ', label: 'Apostila / Caderno Universitário · 200 × 275 mm', pw: 200, ph: 275 },
        { id: 'agenda-exec', label: 'Agenda Executiva · 145 × 205 mm', pw: 145, ph: 205 },
        { id: 'livreto-a5', label: 'Livreto / Manual A5 · 148 × 210 mm', pw: 148, ph: 210 },
        { id: 'livreto-a6', label: 'Livreto / Manual de Bolso A6 · 105 × 148 mm', pw: 105, ph: 148 },
        { id: 'jornal-tabloide', label: 'Jornal Tabloide · 280 × 380 mm', pw: 280, ph: 380 },
        { id: 'jornal-standard', label: 'Jornal Standard · 320 × 520 mm', pw: 320, ph: 520 }
      ]
    },
    {
      group: '5 · Tamanhos Específicos (Etiquetas, Tags, Ingressos, PDV e Envelopes)',
      items: [
        { id: 'etiq-50x30', label: 'Etiqueta Adesiva Pequena · 50 × 30 mm', pw: 50, ph: 30 },
        { id: 'etiq-50x50', label: 'Etiqueta Adesiva Quadrada · 50 × 50 mm', pw: 50, ph: 50 },
        { id: 'rotulo-80x50', label: 'Rótulo / Etiqueta de Produto · 80 × 50 mm', pw: 80, ph: 50 },
        { id: 'etiq-100x150', label: 'Etiqueta Logística / E-commerce · 100 × 150 mm', pw: 100, ph: 150 },
        { id: 'tag-90', label: 'Tag de Roupa Padrão · 50 × 90 mm', pw: 50, ph: 90 },
        { id: 'tag-85', label: 'Tag de Roupa Slim · 40 × 85 mm', pw: 40, ph: 85 },
        { id: 'marcador-180', label: 'Marcador de Página · 50 × 180 mm', pw: 50, ph: 180 },
        { id: 'marcador-210', label: 'Marcador de Página Largo · 50 × 210 mm', pw: 50, ph: 210 },
        { id: 'ingresso-150x50', label: 'Ingresso / Ticket c/ Canhoto · 150 × 50 mm', pw: 150, ph: 50 },
        { id: 'rifa-200x70', label: 'Rifa / Vale c/ Serrilha · 200 × 70 mm', pw: 200, ph: 70 },
        { id: 'talao-140x200', label: 'Talão de Pedido / Orçamento · 140 × 200 mm', pw: 140, ph: 200 },
        { id: 'pulseira-250x20', label: 'Pulseira de Identificação (Evento) · 250 × 20 mm', pw: 250, ph: 20 },
        { id: 'door-hanger', label: 'Aviso de Porta (Door Hanger) · 90 × 210 mm', pw: 90, ph: 210 },
        { id: 'ventarola', label: 'Ventarola / Abanador · 180 × 220 mm', pw: 180, ph: 220 },
        { id: 'wobbler', label: 'Wobbler de PDV · 120 × 120 mm', pw: 120, ph: 120 },
        { id: 'jogo-americano', label: 'Jogo Americano / Bandeja · 420 × 300 mm', pw: 420, ph: 300 },
        { id: 'solapa-100x80', label: 'Solapa de Embalagem Aberta · 100 × 80 mm', pw: 100, ph: 80 },
        { id: 'cinta-300x60', label: 'Cinta / Sleeve de Embalagem · 300 × 60 mm', pw: 300, ph: 60 },
        { id: 'calendario-mesa', label: 'Calendário de Mesa (Base) · 210 × 150 mm', pw: 210, ph: 150 },
        { id: 'folhinha-240x340', label: 'Calendário de Parede / Folhinha · 240 × 340 mm', pw: 240, ph: 340 },
        { id: 'ima-50x45', label: 'Ímã de Geladeira · 50 × 45 mm', pw: 50, ph: 45 },
        { id: 'convite-150x210', label: 'Convite / Postal Especial · 150 × 210 mm', pw: 150, ph: 210 },
        { id: 'env-oficio', label: 'Envelope Ofício (DL) Fechado · 229 × 114 mm', pw: 229, ph: 114 },
        { id: 'env-meio-saco', label: 'Envelope Meio Saco (A5) Fechado · 162 × 229 mm', pw: 162, ph: 229 },
        { id: 'env-saco-a4', label: 'Envelope Saco Padrão (A4) Fechado · 240 × 340 mm', pw: 240, ph: 340 }
      ]
    }
  ];

  const PIECE_PRESETS = PIECE_PRESET_GROUPS.flatMap(g => g.items.map(it => ({ ...it, group: g.group })));

  const PROCESS_PROFILES = {
    offset: {
      code: 'offset',
      name: 'Offset Plana (Chapa CTP)',
      usesPlates: true,
      defaultGrip: 12,
      defaultTail: 10,
      defaultSideMargin: 10,
      defaultBar: 8,
      defaultSetup: 25,
      defaultWaste: 3
    },
    pb: {
      code: 'pb',
      name: 'Preto & Branco (1×1 Editorial / Miolo)',
      usesPlates: true,
      defaultGrip: 10,
      defaultTail: 8,
      defaultSideMargin: 8,
      defaultBar: 6,
      defaultSetup: 15,
      defaultWaste: 2
    },
    digital: {
      code: 'digital',
      name: 'Digital Color (Toner / Produção)',
      usesPlates: false,
      defaultGrip: 5,
      defaultTail: 5,
      defaultSideMargin: 5,
      defaultBar: 0,
      defaultSetup: 2,
      defaultWaste: 1
    },
    laser: {
      code: 'laser',
      name: 'Laser / Impressão Rápida (Fusor Térmico)',
      usesPlates: false,
      defaultGrip: 5,
      defaultTail: 5,
      defaultSideMargin: 5,
      defaultBar: 0,
      defaultSetup: 1,
      defaultWaste: 0
    },
    plotter: {
      code: 'plotter',
      name: 'Plotter Grande Formato (Solvente / UV / Látex)',
      usesPlates: false,
      defaultGrip: 10,
      defaultTail: 10,
      defaultSideMargin: 10,
      defaultBar: 0,
      defaultSetup: 0,
      defaultWaste: 2
    }
  };

  const defaults = {
    version: 4,
    mode: 'flat',
    process: 'offset',
    pw: 90,
    ph: 50,
    sw: 320,
    sh: 450,
    bleed: 3,
    gapX: 0,
    gapY: 0,
    left: 10,
    right: 10,
    grip: 12,
    tail: 10,
    bar: 0,
    sideGuide: 'left',
    qty: 1000,
    setup: 0,
    waste: 0,
    gsm: 150,
    caliper: 0.1,
    grain: 'none',
    pieceGrain: 'free',
    style: 'single',
    colorsFront: 4,
    colorsBack: 4,
    spotColors: 0,
    screenLpi: 175,
    plateView: false,
    plateW: 400,
    plateH: 510,
    plateGrip: 35,
    platePunch: 'bacher',
    orientation: 'auto',
    // Editorial, Gutters & Binding
    pages: 16,
    foldPattern: 'F4-1',
    binding: 'saddle', // 'saddle' | 'perfect' | 'spiral' | 'wireo' | 'pad'
    spineGutter: 0,
    headTrim: 4,
    footTrim: 0,
    faceGutter: 0,
    bindingMargin: 10,
    milling: 0,
    creepMode: 'manual',
    creep: 0,
    offsetX: 0,
    offsetY: 0,
    sectionAngle: 0,
    // Finishing & Mechanical Interferences
    lamination: 'none', // 'none' | 'matte' | 'gloss' | 'soft'
    varnish: 'none', // 'none' | 'water' | 'total_uv' | 'spot_uv'
    hotStamping: false,
    emboss: false,
    dieCut: false,
    drill: false,
    perforation: false,
    perfOffset: 25,
    crease: false,
    numbering: false,
    padding: false,
    // Large Format / Visual Communication (mode === 'visual')
    hem: 30, // bainha dobrada
    weld: 25, // sobreposição de solda para emenda
    polePocketTop: 0, // bolsa superior para bastão
    polePocketBottom: 0, // bolsa inferior para bastão
    grommetSpacing: 250, // espaçamento entre ilhós (0 = sem ilhós)
    grommetInset: 15, // distância do centro do ilhós à borda final
    safeMargin: 35, // margem de segurança estrutural interna
    // Technical Marks & Visual Preflight
    showCutMarks: true,
    marks: false,
    markLength: 5,
    markOffset: 2,
    markStroke: 0.35,
    bleedMarks: false,
    regMarks: true,
    colorBar: true,
    colorBarPos: 'top', // 'top' | 'bottom' | 'both'
    centerCrossMarks: false,
    sheetInfoStrip: true,
    collationMarks: true,
    showPreflightOverlay: true,
    // Free Visualization Mode (Tab 04) & Mixed Cut toggle
    freeMarginMode: 'auto', // 'auto' | 'zero' | 'custom'
    freeStrategy: 'best', // 'best' | 'normal' | 'rotate' | 'mixed'
    allowMixed: true,
    // Sheet Comparison Mode (Tab 05)
    compareLayout: 'side', // 'side' | 'overlay'
    compareShowMetrics: true,
    compareSheets: [
      { id: 'cmp-1', name: 'A4', w: 210, h: 297 },
      { id: 'cmp-2', name: 'A5', w: 148, h: 210 }
    ],
    // Sheet Suggestion Mode (Tab 06 · Sugestões de Imposição por Tamanho da Peça)
    suggestSort: 'usage', // 'usage' | 'effective' | 'count' | 'area'
    suggestFamily: 'all', // 'all' | 'nobel' | 'digital' | 'offset_large'
    suggestMarginPreset: 'process', // 'process' | 'offset' | 'digital' | 'zero'
    suggestSelectedId: '',
    customPapers: [],
    edits: {},
    extras: [],
    pageOverrides: {}
  };

  const clone = o => JSON.parse(JSON.stringify(o));

  function buildCompareInfo(rawSheets) {
    const fallback = [
      { id: 'cmp-1', name: 'A4', w: 210, h: 297 },
      { id: 'cmp-2', name: 'A5', w: 148, h: 210 }
    ];
    const source = Array.isArray(rawSheets) && rawSheets.length ? rawSheets : fallback;
    const items = source.slice(0, 8).map((entry, idx) => {
      const w = Number(entry?.w);
      const h = Number(entry?.h);
      const valid = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 && w <= 25000 && h <= 25000;
      const cleanW = valid ? Number(w.toFixed(2)) : 210;
      const cleanH = valid ? Number(h.toFixed(2)) : 297;
      const areaMm2 = cleanW * cleanH;
      return {
        index: idx + 1,
        id: String(entry?.id || `cmp-${idx + 1}`),
        name: String(entry?.name || `Formato ${idx + 1}`).trim() || `Formato ${idx + 1}`,
        w: cleanW,
        h: cleanH,
        valid,
        areaMm2,
        areaCm2: Number((areaMm2 / 100).toFixed(1)),
        areaM2: Number((areaMm2 / 1e6).toFixed(4)),
        perimeterMm: Number((2 * (cleanW + cleanH)).toFixed(1)),
        orientationLabel: cleanW > cleanH ? 'Paisagem' : cleanW < cleanH ? 'Retrato' : 'Quadrado'
      };
    });

    const first = items[0] || { w: 210, h: 297, areaMm2: 62370 };
    const sortedByArea = [...items].sort((a, b) => a.areaMm2 - b.areaMm2);
    const smallest = sortedByArea[0] || first;
    const largest = sortedByArea[sortedByArea.length - 1] || first;

    for (const item of items) {
      item.ratioVsFirst = Number((item.areaMm2 / Math.max(1, first.areaMm2)).toFixed(2));
      item.ratioVsSmallest = Number((item.areaMm2 / Math.max(1, smallest.areaMm2)).toFixed(2));
      item.pctOfLargest = Number(((item.areaMm2 / Math.max(1, largest.areaMm2)) * 100).toFixed(1));
      item.deltaW = Number((item.w - first.w).toFixed(1));
      item.deltaH = Number((item.h - first.h).toFixed(1));
      const fit0 = Math.floor(largest.w / item.w) * Math.floor(largest.h / item.h);
      const fit90 = Math.floor(largest.w / item.h) * Math.floor(largest.h / item.w);
      item.fitInLargest = Math.max(fit0, fit90);
    }

    return {
      items,
      count: items.length,
      smallest,
      largest,
      first,
      maxRatio: Number((largest.areaMm2 / Math.max(1, smallest.areaMm2)).toFixed(2))
    };
  }

  function validate(s) {
    if (s.mode === 'compare') {
      const list = Array.isArray(s.compareSheets) ? s.compareSheets : [];
      if (!list.length) return ['Adicione ao menos 1 tamanho para comparar.'];
      for (let i = 0; i < list.length; i++) {
        const w = Number(list[i]?.w);
        const h = Number(list[i]?.h);
        if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(h) || h <= 0) {
          return [`Formato #${i + 1}: informe largura e altura positivas em mm.`];
        }
        if (w > 25000 || h > 25000) {
          return [`Formato #${i + 1}: medida máxima de 25.000 mm por lado.`];
        }
      }
      return [];
    }
    if (s.mode === 'suggest') {
      const sErr = [];
      for (const key of ['pw', 'ph', 'qty', 'gsm']) {
        if (!Number.isFinite(s[key]) || s[key] <= 0) sErr.push(`${key}: informe um número positivo.`);
      }
      for (const key of ['bleed', 'gapX', 'gapY', 'setup', 'waste']) {
        if (s[key] !== undefined && (!Number.isFinite(s[key]) || s[key] < 0)) {
          sErr.push(`${key}: informe um número não negativo.`);
        }
      }
      if (!Number.isInteger(s.qty) || !Number.isInteger(s.setup)) {
        sErr.push('Tiragem e acerto devem ser inteiros.');
      }
      if (s.waste > 100) sErr.push('Perdas devem estar entre 0 e 100%.');
      if (s.pw > 5000 || s.ph > 5000) {
        sErr.push('Peça acima de 5.000 mm: utilize o modo Grandes Formatos (Comunicação Visual).');
      }
      return sErr;
    }
    const errors = [];
    for (const key of ['pw', 'ph', 'sw', 'sh', 'qty', 'gsm', 'caliper', 'pages']) {
      if (!Number.isFinite(s[key]) || s[key] <= 0) errors.push(`${key}: informe um número positivo.`);
    }
    for (const key of [
      'bleed', 'gapX', 'gapY', 'left', 'right', 'grip', 'tail', 'bar', 'setup', 'waste',
      'creep', 'headTrim', 'footTrim', 'spineGutter', 'faceGutter', 'bindingMargin', 'milling',
      'colorsFront', 'colorsBack', 'spotColors', 'plateW', 'plateH', 'plateGrip',
      'perfOffset', 'hem', 'weld', 'polePocketTop', 'polePocketBottom', 'grommetSpacing', 'grommetInset', 'safeMargin',
      'markLength', 'markOffset', 'markStroke'
    ]) {
      if (s[key] !== undefined && (!Number.isFinite(s[key]) || s[key] < 0)) {
        errors.push(`${key}: informe um número não negativo.`);
      }
    }
    for (const key of ['offsetX', 'offsetY']) {
      if (!Number.isFinite(s[key])) errors.push('Posição inválida.');
    }
    if (!Number.isInteger(s.qty) || !Number.isInteger(s.pages) || !Number.isInteger(s.setup)) {
      errors.push('Tiragem, páginas e acerto devem ser inteiros.');
    }
    if (!Number.isInteger(s.colorsFront ?? 4) || !Number.isInteger(s.colorsBack ?? 4)) {
      errors.push('Número de cores deve ser inteiro.');
    }
    if (s.pages > 512) errors.push('Limite desta simulação: 512 páginas.');
    if (s.waste > 100) errors.push('Perdas devem estar entre 0 e 100%.');
    const maxDim = s.mode === 'visual' ? 25000 : 5000;
    if (s.sw > maxDim || s.sh > maxDim || s.pw > maxDim || s.ph > maxDim) {
      errors.push(`Formato máximo desta modalidade: ${maxDim.toLocaleString('pt-BR')} mm por lado.`);
    }
    return errors;
  }

  function area(s) {
    if (s.mode === 'free') {
      if (s.freeMarginMode === 'zero') {
        return { x: 0, y: 0, w: s.sw, h: s.sh };
      }
      if (s.freeMarginMode === 'auto') {
        const hasOuterMarks = s.marks || s.bleedMarks || s.regMarks || s.centerCrossMarks;
        const basePad = hasOuterMarks ? Math.min(12, Math.max(6, (s.markOffset || 2) + (s.markLength || 5) + 1)) : 0;
        const topExtra = s.colorBar && (s.colorBarPos === 'top' || s.colorBarPos === 'both') ? 6 : 0;
        const botExtra = (s.colorBar && (s.colorBarPos === 'bottom' || s.colorBarPos === 'both') ? 6 : 0) + (s.sheetInfoStrip ? 5 : 0);
        const l = Math.min(basePad, s.sw * 0.15);
        const r = l;
        const t = Math.min(basePad + topExtra, s.sh * 0.18);
        const b = Math.min(basePad + botExtra, s.sh * 0.18);
        return { x: l, y: t, w: s.sw - l - r, h: s.sh - t - b };
      }
    }
    let l = s.left;
    let r = s.right;
    let t = s.tail + s.bar;
    let b = s.grip;
    if (s.mode === 'book' || s.style === 'sheetwise' || s.style === 'turn' || s.style === 'perfector') {
      l = r = Math.max(l, r);
    }
    if ((s.mode === 'flat' && s.style === 'tumble') || s.style === 'perfector') {
      t = b = Math.max(t, b);
    }
    return { x: l, y: t, w: s.sw - l - r, h: s.sh - t - b };
  }

  function region(s, a) {
    const r = { ...a };
    if (s.style === 'turn') r.w = s.sw / 2 - a.x - s.gapX / 2;
    if (s.style === 'tumble') r.h = s.sh / 2 - a.y - s.gapY / 2;
    return r;
  }

  function allowed(s, angle) {
    if (s.pieceGrain === 'free' || s.grain === 'none') return true;
    const axis = angle % 180 === 0
      ? (s.pieceGrain === 'height' ? 'y' : 'x')
      : (s.pieceGrain === 'height' ? 'x' : 'y');
    return axis === s.grain;
  }

  function fits(a, b) {
    return (
      b.x >= a.x - 1e-7 &&
      b.y >= a.y - 1e-7 &&
      b.x + b.w <= a.x + a.w + 1e-7 &&
      b.y + b.h <= a.y + a.h + 1e-7
    );
  }

  function overlap(a, b) {
    return (
      a.x < b.x + b.w - 1e-7 &&
      a.x + a.w > b.x + 1e-7 &&
      a.y < b.y + b.h - 1e-7 &&
      a.y + a.h > b.y + 1e-7
    );
  }

  function bounds(p, bleed) {
    return { x: p.x - bleed, y: p.y - bleed, w: p.w + 2 * bleed, h: p.h + 2 * bleed };
  }

  function grid(s, r, angle) {
    const w = angle === 90 ? s.ph : s.pw;
    const h = angle === 90 ? s.pw : s.ph;
    const bw = w + 2 * s.bleed;
    const bh = h + 2 * s.bleed;
    const c = Math.max(0, Math.floor((r.w + s.gapX + 1e-7) / (bw + s.gapX)));
    const rows = Math.max(0, Math.floor((r.h + s.gapY + 1e-7) / (bh + s.gapY)));
    const n = allowed(s, angle) ? c * rows : 0;
    const usedW = c > 0 ? c * bw + (c - 1) * s.gapX : 0;
    const usedH = rows > 0 ? rows * bh + (rows - 1) * s.gapY : 0;
    const remW = Math.max(0, r.w - usedW);
    const remH = Math.max(0, r.h - usedH);
    const largestScrapStrip = Math.max(remW * r.h, remH * r.w);
    const cuts = c > 0 && rows > 0 ? c + rows + 2 : 0;
    return { w, h, c, rows, n, angle, mixed: false, largestScrapStrip, cuts };
  }

  function pickBetterUniform(g0, g90) {
    if (g90.n !== g0.n) return g90.n > g0.n ? g90 : g0;
    if (g0.n === 0) return g0;
    if (Math.abs((g90.largestScrapStrip || 0) - (g0.largestScrapStrip || 0)) > 1) {
      return g90.largestScrapStrip > g0.largestScrapStrip ? g90 : g0;
    }
    if ((g90.cuts || 0) !== (g0.cuts || 0)) {
      return g90.cuts < g0.cuts ? g90 : g0;
    }
    return g0;
  }

  function mixedGrid(s, r) {
    if (!allowed(s, 0) || !allowed(s, 90)) return { n: 0, placements: [], mixed: true };
    const configs = [
      { wA: s.pw, hA: s.ph, angA: 0, wB: s.ph, hB: s.pw, angB: 90 },
      { wA: s.ph, hA: s.pw, angA: 90, wB: s.pw, hB: s.ph, angB: 0 }
    ];
    let best = { n: 0, placements: [], mixed: true, desc: '', cuts: Infinity, spanArea: Infinity };

    const consider = (n, placements, desc, cuts, spanArea) => {
      if (
        n > best.n ||
        (n === best.n && n > 0 && (cuts < best.cuts || (cuts === best.cuts && spanArea < best.spanArea - 1)))
      ) {
        best = { n, placements, mixed: true, desc, cuts, spanArea };
      }
    };

    for (const cfg of configs) {
      const bwA = cfg.wA + 2 * s.bleed;
      const bhA = cfg.hA + 2 * s.bleed;
      const bwB = cfg.wB + 2 * s.bleed;
      const bhB = cfg.hB + 2 * s.bleed;
      const maxCA = Math.max(0, Math.floor((r.w + s.gapX + 1e-7) / (bwA + s.gapX)));
      const maxRA = Math.max(0, Math.floor((r.h + s.gapY + 1e-7) / (bhA + s.gapY)));

      // 1) Corte guilhotinado vertical: bloco A à esquerda + bloco B na faixa direita
      for (let cA = 1; cA <= maxCA; cA++) {
        const usedWA = cA * bwA + (cA - 1) * s.gapX;
        const remW = r.w - usedWA - s.gapX;
        const cB = remW > 0 ? Math.max(0, Math.floor((remW + s.gapX + 1e-7) / (bwB + s.gapX))) : 0;
        const rB = Math.max(0, Math.floor((r.h + s.gapY + 1e-7) / (bhB + s.gapY)));
        if (cB <= 0 || rB <= 0 || maxRA <= 0) continue;

        // Verifica também se abaixo do bloco A cabe uma faixa extra girada (em B) mantendo corte guilhotinado no bloco A
        const usedHA = maxRA * bhA + (maxRA - 1) * s.gapY;
        const remHA = r.h - usedHA - s.gapY;
        const extraRB = remHA > 0 ? Math.max(0, Math.floor((remHA + s.gapY + 1e-7) / (bhB + s.gapY))) : 0;
        const extraCB = extraRB > 0 ? Math.max(0, Math.floor((usedWA + s.gapX + 1e-7) / (bwB + s.gapX))) : 0;
        const extraN = extraCB * extraRB;

        const n = cA * maxRA + extraN + cB * rB;
        const usedWB = cB * bwB + (cB - 1) * s.gapX;
        const totalW = usedWA + s.gapX + usedWB;
        const totalHA = usedHA + (extraN > 0 ? s.gapY + extraRB * bhB + (extraRB - 1) * s.gapY : 0);
        const totalHB = rB * bhB + (rB - 1) * s.gapY;
        const totalH = Math.max(totalHA, totalHB);
        const cuts = cA + maxRA + cB + rB + (extraN > 0 ? extraCB + extraRB + 1 : 0) + 3;

        if (n > best.n || (n === best.n && cuts <= best.cuts)) {
          // Preserve o rendimento calculado sem materializar grades acima do limite editável.
          if (n > 700) {
            consider(n, [], '', cuts, totalW * totalH);
            continue;
          }
          const xStart = r.x + (r.w - totalW) / 2;
          const yStartA = r.y + (r.h - totalHA) / 2 + s.bleed;
          const yStartB = r.y + (r.h - totalHB) / 2 + s.bleed;
          const placements = [];
          let idx = 0;
          for (let row = 0; row < maxRA; row++) {
            for (let col = 0; col < cA; col++) {
              placements.push({
                id: `p${idx++}`,
                x: xStart + s.bleed + col * (bwA + s.gapX),
                y: yStartA + row * (bhA + s.gapY),
                w: cfg.wA,
                h: cfg.hA,
                angle: cfg.angA,
                sku: 'A'
              });
            }
          }
          if (extraN > 0) {
            const extraW = extraCB * bwB + (extraCB - 1) * s.gapX;
            const xStartExtra = xStart + (usedWA - extraW) / 2 + s.bleed;
            const yStartExtra = yStartA - s.bleed + usedHA + s.gapY + s.bleed;
            for (let row = 0; row < extraRB; row++) {
              for (let col = 0; col < extraCB; col++) {
                placements.push({
                  id: `p${idx++}`,
                  x: xStartExtra + col * (bwB + s.gapX),
                  y: yStartExtra + row * (bhB + s.gapY),
                  w: cfg.wB,
                  h: cfg.hB,
                  angle: cfg.angB,
                  sku: 'A'
                });
              }
            }
          }
          const xStartB = xStart + usedWA + s.gapX + s.bleed;
          for (let row = 0; row < rB; row++) {
            for (let col = 0; col < cB; col++) {
              placements.push({
                id: `p${idx++}`,
                x: xStartB + col * (bwB + s.gapX),
                y: yStartB + row * (bhB + s.gapY),
                w: cfg.wB,
                h: cfg.hB,
                angle: cfg.angB,
                sku: 'A'
              });
            }
          }
          const desc = extraN > 0
            ? `Corte misto: ${cA}×${maxRA} (${cfg.angA}°) + ${cB}×${rB} + ${extraCB}×${extraRB} (${cfg.angB}°)`
            : `Corte misto: ${cA}×${maxRA} (${cfg.angA}°) + ${cB}×${rB} (${cfg.angB}°)`;
          consider(n, placements, desc, cuts, totalW * totalH);
        }
      }

      // 2) Corte guilhotinado horizontal: bloco A no topo + bloco B na faixa inferior
      for (let rA = 1; rA <= maxRA; rA++) {
        const usedHA = rA * bhA + (rA - 1) * s.gapY;
        const remH = r.h - usedHA - s.gapY;
        const rB = remH > 0 ? Math.max(0, Math.floor((remH + s.gapY + 1e-7) / (bhB + s.gapY))) : 0;
        const cB = Math.max(0, Math.floor((r.w + s.gapX + 1e-7) / (bwB + s.gapX)));
        if (cB <= 0 || rB <= 0 || maxCA <= 0) continue;

        const usedWA = maxCA * bwA + (maxCA - 1) * s.gapX;
        const remWA = r.w - usedWA - s.gapX;
        const extraCB = remWA > 0 ? Math.max(0, Math.floor((remWA + s.gapX + 1e-7) / (bwB + s.gapX))) : 0;
        const extraRB = extraCB > 0 ? Math.max(0, Math.floor((usedHA + s.gapY + 1e-7) / (bhB + s.gapY))) : 0;
        const extraN = extraCB * extraRB;

        const n = maxCA * rA + extraN + cB * rB;
        const usedHB = rB * bhB + (rB - 1) * s.gapY;
        const totalH = usedHA + s.gapY + usedHB;
        const totalWA = usedWA + (extraN > 0 ? s.gapX + extraCB * bwB + (extraCB - 1) * s.gapX : 0);
        const totalWB = cB * bwB + (cB - 1) * s.gapX;
        const totalW = Math.max(totalWA, totalWB);
        const cuts = maxCA + rA + cB + rB + (extraN > 0 ? extraCB + extraRB + 1 : 0) + 3;

        if (n > best.n || (n === best.n && cuts <= best.cuts)) {
          // Preserve o rendimento calculado sem materializar grades acima do limite editável.
          if (n > 700) {
            consider(n, [], '', cuts, totalW * totalH);
            continue;
          }
          const yStart = r.y + (r.h - totalH) / 2;
          const xStartA = r.x + (r.w - totalWA) / 2 + s.bleed;
          const xStartB = r.x + (r.w - totalWB) / 2 + s.bleed;
          const placements = [];
          let idx = 0;
          for (let row = 0; row < rA; row++) {
            for (let col = 0; col < maxCA; col++) {
              placements.push({
                id: `p${idx++}`,
                x: xStartA + col * (bwA + s.gapX),
                y: yStart + s.bleed + row * (bhA + s.gapY),
                w: cfg.wA,
                h: cfg.hA,
                angle: cfg.angA,
                sku: 'A'
              });
            }
          }
          if (extraN > 0) {
            const extraH = extraRB * bhB + (extraRB - 1) * s.gapY;
            const xStartExtra = xStartA - s.bleed + usedWA + s.gapX + s.bleed;
            const yStartExtra = yStart + (usedHA - extraH) / 2 + s.bleed;
            for (let row = 0; row < extraRB; row++) {
              for (let col = 0; col < extraCB; col++) {
                placements.push({
                  id: `p${idx++}`,
                  x: xStartExtra + col * (bwB + s.gapX),
                  y: yStartExtra + row * (bhB + s.gapY),
                  w: cfg.wB,
                  h: cfg.hB,
                  angle: cfg.angB,
                  sku: 'A'
                });
              }
            }
          }
          const yStartB = yStart + usedHA + s.gapY + s.bleed;
          for (let row = 0; row < rB; row++) {
            for (let col = 0; col < cB; col++) {
              placements.push({
                id: `p${idx++}`,
                x: xStartB + col * (bwB + s.gapX),
                y: yStartB + row * (bhB + s.gapY),
                w: cfg.wB,
                h: cfg.hB,
                angle: cfg.angB,
                sku: 'A'
              });
            }
          }
          const desc = extraN > 0
            ? `Corte misto: ${maxCA}×${rA} (${cfg.angA}°) + ${cB}×${rB} + ${extraCB}×${extraRB} (${cfg.angB}°)`
            : `Corte misto: ${maxCA}×${rA} (${cfg.angA}°) + ${cB}×${rB} (${cfg.angB}°)`;
          consider(n, placements, desc, cuts, totalW * totalH);
        }
      }
    }

    return best;
  }

  function signaturePages(s, patternCode, sigIndex, totalPages) {
    const pat = FOLD_PATTERNS[patternCode] || FOLD_PATTERNS['F4-1'];
    const pps = pat.pages;
    if (s.binding === 'saddle') {
      const half = pps / 2;
      const lowStart = sigIndex * half + 1;
      const highStart = totalPages - (sigIndex + 1) * half + 1;
      const p = {};
      for (let k = 1; k <= half; k++) p[k] = lowStart + (k - 1);
      for (let k = 1; k <= half; k++) p[half + k] = highStart + (k - 1);
      return p;
    } else {
      const start = sigIndex * pps + 1;
      const p = {};
      for (let k = 1; k <= pps; k++) p[k] = start + (k - 1);
      return p;
    }
  }

  function buildSignatureCells(s, patternCode, sigIndex, totalPages, maxCreep) {
    const pat = FOLD_PATTERNS[patternCode] || FOLD_PATTERNS['F4-1'];
    const p = signaturePages(s, pat.code, sigIndex, totalPages);
    const totalLeaves = totalPages / 4;
    const leavesInSig = pat.pages / 4;
    const isLooseBinding = s.binding === 'spiral' || s.binding === 'wireo' || s.binding === 'pad';

    function pageLeafIndex(pageNo) {
      if (isLooseBinding) return 0;
      if (s.binding === 'saddle') {
        const d1 = Math.floor((pageNo - 1) / 2);
        const d2 = Math.floor((totalPages - pageNo) / 2);
        return Math.min(d1, d2);
      } else {
        const localPage = ((pageNo - 1) % pat.pages) + 1;
        const d1 = Math.floor((localPage - 1) / 2);
        const d2 = Math.floor((pat.pages - localPage) / 2);
        return Math.min(d1, d2);
      }
    }

    function pageShift(pageNo) {
      if (isLooseBinding) return 0;
      const denom = s.binding === 'saddle' ? Math.max(1, totalLeaves - 1) : Math.max(1, leavesInSig - 1);
      const maxSteps = s.binding === 'saddle' ? totalLeaves : leavesInSig;
      if (maxSteps <= 1) return 0;
      const li = pageLeafIndex(pageNo);
      return (maxCreep * li) / denom;
    }

    let frontGrid = [];
    let backGrid = [];

    if (pat.code === 'LOOSE-2') {
      // Folhas soltas 2-up (p1 e p3 na frente; p2 e p4 no verso espelhado)
      frontGrid = [[{ page: p[1], angle: 0 }, { page: p[3], angle: 0 }]];
      backGrid = [[{ page: p[4], angle: 0 }, { page: p[2], angle: 0 }]];
    } else if (pat.code === 'F4-1') {
      frontGrid = [[{ page: p[4], angle: 0 }, { page: p[1], angle: 0 }]];
      backGrid = [[{ page: p[2], angle: 0 }, { page: p[3], angle: 0 }]];
    } else if (pat.code === 'F8-1') {
      frontGrid = [
        [{ page: p[5], angle: 180 }, { page: p[4], angle: 180 }],
        [{ page: p[8], angle: 0 }, { page: p[1], angle: 0 }]
      ];
      backGrid = [
        [{ page: p[3], angle: 180 }, { page: p[6], angle: 180 }],
        [{ page: p[2], angle: 0 }, { page: p[7], angle: 0 }]
      ];
    } else if (pat.code === 'F16-1') {
      frontGrid = [
        [
          { page: p[5], angle: 180 },
          { page: p[12], angle: 180 },
          { page: p[9], angle: 180 },
          { page: p[8], angle: 180 }
        ],
        [
          { page: p[4], angle: 0 },
          { page: p[13], angle: 0 },
          { page: p[16], angle: 0 },
          { page: p[1], angle: 0 }
        ]
      ];
      backGrid = [
        [
          { page: p[7], angle: 180 },
          { page: p[10], angle: 180 },
          { page: p[11], angle: 180 },
          { page: p[6], angle: 180 }
        ],
        [
          { page: p[2], angle: 0 },
          { page: p[15], angle: 0 },
          { page: p[14], angle: 0 },
          { page: p[3], angle: 0 }
        ]
      ];
    }

    const overrides = s.pageOverrides || {};
    const decorate = gridRows =>
      gridRows.map((row, rIdx) =>
        row.map((cell, cIdx) => {
          const ov = overrides[String(cell.page)];
          const isForcedBlank = ov === 'blank';
          const effectivePage = typeof ov === 'number' && ov > 0 ? ov : cell.page;
          const isBlank = isForcedBlank || effectivePage > s.pages;
          const sh = pageShift(cell.page);
          const spineDir = cIdx % 2 === 0 ? 1 : -1;
          return {
            row: rIdx,
            col: cIdx,
            slotPage: cell.page,
            page: effectivePage,
            isBlank,
            angle: cell.angle,
            shift: sh,
            dx: sh * spineDir
          };
        })
      );

    const fCells = decorate(frontGrid);
    const bCells = decorate(backGrid);

    const frontFlat = fCells.flat().map(c => c.page);
    const backFlat = bCells.flat().map(c => c.page);

    const backingPairs = [];
    for (let r = 0; r < pat.rows; r++) {
      for (let c = 0; c < pat.cols; c++) {
        const fc = fCells[r][c];
        const bc = bCells[r][pat.cols - 1 - c];
        backingPairs.push({
          front: fc.slotPage,
          back: bc.slotPage,
          valid: Math.abs(fc.slotPage - bc.slotPage) === 1 && Math.min(fc.slotPage, bc.slotPage) % 2 === 1
        });
      }
    }

    const shifts = fCells.flat().map(c => c.shift);
    const maxShiftInSig = shifts.length ? Math.max(...shifts) : 0;

    return {
      index: sigIndex,
      pattern: pat.code,
      cols: pat.cols,
      rows: pat.rows,
      front: frontFlat,
      back: backFlat,
      frontCells: fCells,
      backCells: bCells,
      backingPairs,
      shift: maxShiftInSig
    };
  }

  function bookPlan(s) {
    const patCode = FOLD_PATTERNS[s.foldPattern] ? s.foldPattern : 'F4-1';
    const pat = FOLD_PATTERNS[patCode];
    const total = Math.ceil(s.pages / pat.pages) * pat.pages;
    const numSigs = total / pat.pages;
    const totalLeaves = total / 4;
    const leavesInSig = pat.pages / 4;
    const isLooseBinding = s.binding === 'spiral' || s.binding === 'wireo' || s.binding === 'pad';
    const creepLeaves = isLooseBinding ? 0 : s.binding === 'saddle' ? totalLeaves : leavesInSig;
    const autoCreep = creepLeaves > 1 ? Number(((creepLeaves - 1) * (s.caliper || 0.1) * (Math.PI / 2)).toFixed(2)) : 0;
    const maxCreep = isLooseBinding ? 0 : s.creepMode === 'auto' ? autoCreep : (s.creep || 0);

    return Array.from({ length: numSigs }, (_, i) =>
      buildSignatureCells(s, patCode, i, total, maxCreep)
    );
  }

  function computeGrommets(pw, ph, spacing, inset) {
    if (!spacing || spacing <= 0) return [];
    const pts = [];
    const xMin = inset;
    const xMax = Math.max(inset, pw - inset);
    const yMin = inset;
    const yMax = Math.max(inset, ph - inset);
    const spanX = Math.max(0, xMax - xMin);
    const spanY = Math.max(0, yMax - yMin);
    const nx = Math.max(1, Math.round(spanX / spacing));
    const ny = Math.max(1, Math.round(spanY / spacing));

    // Top and bottom edges
    for (let i = 0; i <= nx; i++) {
      const x = xMin + (spanX * i) / nx;
      pts.push({ x, y: yMin });
      if (spanY > 0) pts.push({ x, y: yMax });
    }
    // Left and right inner edges
    for (let j = 1; j < ny; j++) {
      const y = yMin + (spanY * j) / ny;
      pts.push({ x: xMin, y });
      if (spanX > 0) pts.push({ x: xMax, y });
    }
    return pts;
  }

  function pressGuides(s, isBack) {
    if (s.mode === 'visual') {
      return {
        gripper: 'bottom',
        side: 'left',
        passNote: `Comunicação Visual · Área estrutural com bainha (${s.hem} mm), solda (${s.weld} mm) e ilhós`
      };
    }
    const proc = PROCESS_PROFILES[s.process] || PROCESS_PROFILES.offset;
    const baseSide = s.sideGuide === 'right' ? 'right' : 'left';
    const oppositeSide = baseSide === 'left' ? 'right' : 'left';
    if (!proc.usesPlates) {
      return {
        gripper: 'bottom',
        side: isBack ? oppositeSide : baseSide,
        passNote: `${proc.name} · ${isBack ? 'Verso (Duplex automático)' : 'Frente'} · Margem não imprimível de segurança`
      };
    }
    if (!isBack || s.style === 'single') {
      return { gripper: 'bottom', side: baseSide, passNote: '1ª passada · Pinça inferior · Esquadro ' + (baseSide === 'left' ? 'esquerdo' : 'direito') };
    }
    if (s.style === 'sheetwise' || (s.mode === 'book' && s.style !== 'perfector')) {
      return { gripper: 'bottom', side: oppositeSide, passNote: 'Retiro (Sheetwise) · Mesma pinça · Esquadro invertido (' + (oppositeSide === 'left' ? 'esquerdo' : 'direito') + ')' };
    }
    if (s.style === 'turn') {
      return { gripper: 'bottom', side: oppositeSide, passNote: 'Tira-retira (Work-and-turn) · Mesma forma e pinça · Esquadro invertido' };
    }
    if (s.style === 'tumble') {
      return { gripper: 'top', side: baseSide, passNote: 'Cambalhota (Work-and-tumble) · Mesma forma · Pinça na borda oposta (superior)' };
    }
    if (s.style === 'perfector') {
      return { gripper: 'top', side: baseSide, passNote: 'Reversão (Perfector) · 1 passagem · Tambor inverte pinça para a borda traseira' };
    }
    return { gripper: 'bottom', side: baseSide, passNote: '' };
  }

  function computePaperAnalysis({
    s,
    a,
    items,
    base,
    plan,
    count,
    forms,
    net,
    variableLoss,
    makeready,
    total,
    mass,
    extra,
    visualInfo,
    freeComparison,
    activeStrategyKey
  }) {
    const sheetMm2 = Math.max(1, s.sw * s.sh);
    const usableMm2 = Math.max(0, Math.min(sheetMm2, a.w * a.h));
    const rawMarginMm2 = Math.max(0, sheetMm2 - usableMm2);

    const toMetric = (mm2, refMm2) => {
      const safeMm2 = Math.max(0, mm2);
      return {
        mm2: Number(safeMm2.toFixed(1)),
        cm2: Number((safeMm2 / 100).toFixed(2)),
        m2: Number((safeMm2 / 1e6).toFixed(4)),
        massKg: Number(((safeMm2 * s.gsm) / 1e9).toFixed(3)),
        sheetsEq: Number((safeMm2 / sheetMm2).toFixed(2)),
        pct: refMm2 > 0 ? Number(((safeMm2 / refMm2) * 100).toFixed(2)) : 0
      };
    };

    let usefulMm2 = 0;
    let bleedGapMm2 = 0;

    if (s.mode === 'book') {
      const pat = FOLD_PATTERNS[s.foldPattern] || FOLD_PATTERNS['F4-1'];
      const pagesPerSide = pat.cols * pat.rows;
      usefulMm2 = Math.min(sheetMm2, pagesPerSide * s.pw * s.ph);
      const blockMm2 = base[0] ? Math.min(usableMm2, base[0].w * base[0].h) : usefulMm2;
      bleedGapMm2 = Math.max(0, blockMm2 - usefulMm2);
    } else if (s.mode === 'visual') {
      const formsSafe = Math.max(1, forms || visualInfo?.numPanels || 1);
      usefulMm2 = Math.min(sheetMm2, (s.pw * s.ph) / formsSafe);
      const cutPerSheetMm2 = visualInfo ? Math.min(sheetMm2, (visualInfo.cutW * visualInfo.cutH) / formsSafe) : usefulMm2;
      bleedGapMm2 = Math.max(0, cutPerSheetMm2 - usefulMm2);
    } else {
      usefulMm2 = Math.min(sheetMm2, items.reduce((sum, p) => sum + p.w * p.h, 0));
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of items) {
        minX = Math.min(minX, p.x - s.bleed);
        minY = Math.min(minY, p.y - s.bleed);
        maxX = Math.max(maxX, p.x + p.w + s.bleed);
        maxY = Math.max(maxY, p.y + p.h + s.bleed);
      }
      if (Number.isFinite(minX)) {
        const clipW = Math.max(0, Math.min(a.x + a.w, maxX) - Math.max(a.x, minX));
        const clipH = Math.max(0, Math.min(a.y + a.h, maxY) - Math.max(a.y, minY));
        const envelopeMm2 = Math.min(usableMm2, clipW * clipH);
        bleedGapMm2 = Math.max(0, Math.min(Math.max(0, sheetMm2 - usefulMm2), envelopeMm2 - usefulMm2));
      }
    }

    const marginMm2 = Math.min(rawMarginMm2, Math.max(0, sheetMm2 - usefulMm2 - bleedGapMm2));
    const outerScrapMm2 = Math.max(0, sheetMm2 - usefulMm2 - bleedGapMm2 - marginMm2);
    const sheetLossMm2 = Math.max(0, sheetMm2 - usefulMm2);

    const sheet = {
      areaCm2: Number((sheetMm2 / 100).toFixed(2)),
      usableCm2: Number((usableMm2 / 100).toFixed(2)),
      useful: toMetric(usefulMm2, sheetMm2),
      bleedGap: toMetric(bleedGapMm2, sheetMm2),
      outerScrap: toMetric(outerScrapMm2, sheetMm2),
      margin: toMetric(marginMm2, sheetMm2),
      totalLoss: toMetric(sheetLossMm2, sheetMm2)
    };

    const grossAreaMm2 = Math.max(0, total * sheetMm2);
    let deliveredUsefulMm2 = 0;
    let remainderMm2 = 0;
    let remainderNote = '';
    let extraUnits = extra || 0;

    if (s.mode === 'book') {
      const pat = FOLD_PATTERNS[s.foldPattern] || FOLD_PATTERNS['F4-1'];
      const totalSlots = Math.max(1, (plan?.length || 1) * pat.pages);
      const blankPagesPerBook = Math.max(0, totalSlots - s.pages);
      const deliveredRatio = Math.min(1, s.pages / totalSlots);
      deliveredUsefulMm2 = net * usefulMm2 * deliveredRatio;
      remainderMm2 = Math.max(0, net * usefulMm2 - deliveredUsefulMm2);
      extraUnits = blankPagesPerBook;
      remainderNote = blankPagesPerBook > 0
        ? `${blankPagesPerBook} pág(s) em branco de fechamento × ${s.qty} ex.`
        : 'Cadernos fechados sem páginas em branco';
    } else if (s.mode === 'visual') {
      deliveredUsefulMm2 = net * usefulMm2;
      remainderMm2 = 0;
      remainderNote = 'Sem excedente de unidades';
    } else if (net > 0 && count > 0) {
      const deliveredPoses = Math.max(0, Math.min(net * count, net * count - extraUnits));
      deliveredUsefulMm2 = net * usefulMm2 * (deliveredPoses / (net * count));
      remainderMm2 = Math.max(0, net * usefulMm2 - deliveredUsefulMm2);
      remainderNote = extraUnits > 0
        ? `${extraUnits} peça(s) excedente(s) na última folha`
        : 'Múltiplo exato sem sobra na última folha';
    }

    const impositionScrapMm2 = Math.max(0, net * (sheetMm2 - usefulMm2));
    const makereadyMm2 = makeready * sheetMm2;
    const variableWasteMm2 = variableLoss * sheetMm2;
    const totalLossMm2 = Math.max(0, grossAreaMm2 - deliveredUsefulMm2);

    const job = {
      netSheets: net,
      variableLossSheets: variableLoss,
      makereadySheets: makeready,
      totalSheets: total,
      extraUnits,
      remainderNote,
      grossAreaM2: Number((grossAreaMm2 / 1e6).toFixed(3)),
      grossMassKg: Number(mass.toFixed(3)),
      effectiveUsagePct: grossAreaMm2 > 0 ? Number(((deliveredUsefulMm2 / grossAreaMm2) * 100).toFixed(2)) : 0,
      totalLossPct: grossAreaMm2 > 0 ? Number(((totalLossMm2 / grossAreaMm2) * 100).toFixed(2)) : 0,
      totalLoss: toMetric(totalLossMm2, grossAreaMm2),
      breakdown: {
        delivered: toMetric(deliveredUsefulMm2, grossAreaMm2),
        impositionScrap: toMetric(impositionScrapMm2, grossAreaMm2),
        remainder: toMetric(remainderMm2, grossAreaMm2),
        makeready: toMetric(makereadyMm2, grossAreaMm2),
        variableWaste: toMetric(variableWasteMm2, grossAreaMm2)
      }
    };

    let alternatives = [];
    if ((s.mode === 'flat' || s.mode === 'free') && freeComparison) {
      const pieceMm2 = s.pw * s.ph;
      const options = [freeComparison.normal, freeComparison.rotate, freeComparison.mixed].filter(Boolean);
      alternatives = options.map((opt) => {
        const fitsSheet = !opt.disabled && opt.count > 0;
        if (!fitsSheet) {
          return {
            key: opt.key,
            title: opt.title,
            desc: opt.desc,
            count: opt.count,
            disabled: !!opt.disabled,
            fits: false,
            isCurrent: opt.key === activeStrategyKey,
            totalSheets: 0,
            netSheets: 0,
            extra: 0,
            massKg: 0,
            sheetUsagePct: opt.usage || 0,
            effectiveUsagePct: 0,
            totalLossPct: 100,
            savedSheetsVsCurrent: 0,
            savedMassKgVsCurrent: 0
          };
        }
        const optNet = Math.ceil(s.qty / opt.count);
        const optVar = Math.ceil((optNet * s.waste) / 100);
        const optMakeready = s.setup * forms;
        const optTotal = optNet + optVar + optMakeready;
        const optExtra = optNet * opt.count - s.qty;
        const optGrossMm2 = optTotal * sheetMm2;
        const optDeliveredMm2 = Math.min(optNet * opt.count * pieceMm2, s.qty * pieceMm2);
        const optEffPct = optGrossMm2 > 0 ? Number(((optDeliveredMm2 / optGrossMm2) * 100).toFixed(2)) : 0;
        const optMassKg = Number(((optGrossMm2 * s.gsm) / 1e9).toFixed(3));
        return {
          key: opt.key,
          title: opt.title,
          desc: opt.desc,
          count: opt.count,
          disabled: false,
          fits: true,
          isCurrent: opt.key === activeStrategyKey,
          netSheets: optNet,
          totalSheets: optTotal,
          extra: optExtra,
          massKg: optMassKg,
          sheetUsagePct: opt.usage,
          effectiveUsagePct: optEffPct,
          totalLossPct: Number((100 - optEffPct).toFixed(2)),
          savedSheetsVsCurrent: total > 0 ? total - optTotal : 0,
          savedMassKgVsCurrent: total > 0 ? Number((mass - optMassKg).toFixed(3)) : 0
        };
      });
    }

    return { sheet, job, alternatives };
  }

  function classifySheetPreset(preset) {
    const id = String(preset.id || '');
    const minD = Math.min(preset.sw, preset.sh);
    const maxD = Math.max(preset.sw, preset.sh);
    const key = `${minD}x${maxD}`;
    if (id.startsWith('nobel-')) {
      const origin = key === '238x328'
        ? '1/8 da folha 66×96 cm'
        : key === '328x478'
          ? '1/4 da folha 66×96 cm'
          : 'Formato Nobel T9 (22×38 cm)';
      return { family: 'nobel', familyLabel: 'Padrão Nobel', isNobel: true, nobelOrigin: origin };
    }
    if (maxD >= 600 || id === 'meia-folha' || id === 'folha-inteira' || id === 'formato-76') {
      const origin = key === '480x660'
        ? '1/2 da folha 66×96 cm'
        : key === '660x960'
          ? 'Folha inteira BB (66×96 cm)'
          : key === '760x1120'
            ? 'Folha inteira AA (76×112 cm)'
            : 'Grande formato Offset';
      return { family: 'offset_large', familyLabel: 'Offset Grande', isNobel: false, nobelOrigin: origin };
    }
    return { family: 'digital', familyLabel: 'Digital / Comercial', isNobel: false, nobelOrigin: '' };
  }

  function buildUniqueSheetCatalog(customPapers = []) {
    const map = new Map();
    const addCandidate = (entry, isCustom = false) => {
      const sw = Number(entry?.sw);
      const sh = Number(entry?.sh);
      if (!Number.isFinite(sw) || !Number.isFinite(sh) || sw <= 0 || sh <= 0) return;
      const minD = Math.min(sw, sh);
      const maxD = Math.max(sw, sh);
      const dimKey = `${minD}x${maxD}`;
      if (map.has(dimKey)) return;
      const rawLabel = String(entry.label || entry.name || `${minD} × ${maxD} mm`);
      const cleanName = rawLabel
        .replace(/\s*Paisagem\b/i, '')
        .replace(/\s*·\s*\d+(?:[.,]\d+)?\s*[×x]\s*\d+(?:[.,]\d+)?\s*mm/i, '')
        .trim();
      const meta = isCustom
        ? { family: maxD >= 600 ? 'offset_large' : 'digital', familyLabel: 'Personalizada', isNobel: false, nobelOrigin: 'Folha cadastrada' }
        : classifySheetPreset(entry);
      map.set(dimKey, {
        id: isCustom ? String(entry.id || `custom-${dimKey}`) : String(entry.id || `sheet-${dimKey}`).replace(/-l$/, ''),
        name: cleanName || `${minD} × ${maxD} mm`,
        sw: minD,
        sh: maxD,
        isCustom,
        ...meta
      });
    };

    for (const preset of PAPER_PRESETS) addCandidate(preset, false);
    if (Array.isArray(customPapers)) {
      for (const cp of customPapers) addCandidate(cp, true);
    }
    return Array.from(map.values());
  }

  function resolveSuggestionMargins(s) {
    const preset = s.suggestMarginPreset || 'process';
    if (preset === 'zero') {
      return { left: 0, right: 0, grip: 0, tail: 0, bar: 0, setup: 0, waste: 0, process: 'digital' };
    }
    if (preset === 'digital') {
      const p = PROCESS_PROFILES.digital;
      return {
        left: p.defaultSideMargin,
        right: p.defaultSideMargin,
        grip: p.defaultGrip,
        tail: p.defaultTail,
        bar: p.defaultBar,
        setup: s.setup ?? p.defaultSetup,
        waste: s.waste ?? p.defaultWaste,
        process: 'digital'
      };
    }
    if (preset === 'offset') {
      const p = PROCESS_PROFILES.offset;
      return {
        left: p.defaultSideMargin,
        right: p.defaultSideMargin,
        grip: p.defaultGrip,
        tail: p.defaultTail,
        bar: p.defaultBar,
        setup: s.setup ?? p.defaultSetup,
        waste: s.waste ?? p.defaultWaste,
        process: 'offset'
      };
    }
    const prof = PROCESS_PROFILES[s.process] || PROCESS_PROFILES.offset;
    return {
      left: Number.isFinite(s.left) ? s.left : prof.defaultSideMargin,
      right: Number.isFinite(s.right) ? s.right : prof.defaultSideMargin,
      grip: Number.isFinite(s.grip) ? s.grip : prof.defaultGrip,
      tail: Number.isFinite(s.tail) ? s.tail : prof.defaultTail,
      bar: Number.isFinite(s.bar) ? s.bar : prof.defaultBar,
      setup: Number.isFinite(s.setup) ? s.setup : prof.defaultSetup,
      waste: Number.isFinite(s.waste) ? s.waste : prof.defaultWaste,
      process: prof.code
    };
  }

  function suggestImpositions(rawParams = {}) {
    const s = { ...defaults, ...rawParams, mode: 'flat' };
    const pw = Number(s.pw);
    const ph = Number(s.ph);
    if (!Number.isFinite(pw) || pw <= 0 || !Number.isFinite(ph) || ph <= 0) {
      return {
        pw: 0,
        ph: 0,
        pieceAreaCm2: 0,
        totalEvaluatedSheets: 0,
        oversizedForStandardSheets: false,
        suggestions: [],
        topRecommendation: null
      };
    }

    const margins = resolveSuggestionMargins(s);
    const allowMixed = s.allowMixed !== false;
    const familyFilter = s.suggestFamily || 'all';
    const sortBy = s.suggestSort || 'usage';
    const catalog = buildUniqueSheetCatalog(s.customPapers);
    const filteredCatalog = catalog.filter(sheetEntry => {
      if (familyFilter === 'all') return true;
      if (sheetEntry.isCustom) return true;
      return sheetEntry.family === familyFilter;
    });

    const suggestions = [];

    for (const sheetEntry of filteredCatalog) {
      const orientations = sheetEntry.sw === sheetEntry.sh
        ? [{ sw: sheetEntry.sw, sh: sheetEntry.sh, sheetOrientation: 'Quadrada' }]
        : [
            { sw: sheetEntry.sw, sh: sheetEntry.sh, sheetOrientation: 'Retrato' },
            { sw: sheetEntry.sh, sh: sheetEntry.sw, sheetOrientation: 'Paisagem' }
          ];

      let bestEval = null;

      for (const orient of orientations) {
        const evalBase = {
          ...s,
          mode: 'flat',
          process: margins.process,
          sw: orient.sw,
          sh: orient.sh,
          left: margins.left,
          right: margins.right,
          grip: margins.grip,
          tail: margins.tail,
          bar: margins.bar,
          setup: margins.setup,
          waste: margins.waste,
          orientation: 'auto',
          allowMixed,
          edits: {},
          extras: [],
          plateView: false
        };

        const autoRes = compute(evalBase);
        const uniformOk = !autoRes.errors.length && autoRes.count > 0;
        let chosen = uniformOk ? { res: autoRes, strategyKey: autoRes.items[0]?.angle === 90 ? 'rotate' : 'normal', orientReq: 'auto' } : null;
        let mixedGain = 0;

        if (allowMixed) {
          const mixedRes = compute({ ...evalBase, orientation: 'mixed' });
          if (!mixedRes.errors.length && mixedRes.count > 0) {
            const uniformCount = uniformOk ? autoRes.count : 0;
            if (mixedRes.count > uniformCount) {
              mixedGain = mixedRes.count - uniformCount;
              chosen = { res: mixedRes, strategyKey: 'mixed', orientReq: 'mixed' };
            }
          }
        }

        if (!chosen) continue;
        const r = chosen.res;
        const sheetUsagePct = Number(r.usage.toFixed(1));
        const effectiveUsagePct = Number((r.paperAnalysis?.job?.effectiveUsagePct ?? r.usage).toFixed(1));
        const totalLossPct = Number((r.paperAnalysis?.job?.totalLossPct ?? Math.max(0, 100 - effectiveUsagePct)).toFixed(1));
        const grossAreaM2 = Number((r.paperAnalysis?.job?.grossAreaM2 ?? ((r.total * orient.sw * orient.sh) / 1e6)).toFixed(3));
        const scrapMassKg = Number((r.paperAnalysis?.job?.totalLoss?.massKg ?? 0).toFixed(3));
        const cutsEstimate = chosen.strategyKey === 'mixed'
          ? Math.min(40, r.count + 4)
          : (() => {
              const xs = new Set(r.items.map(it => Number(it.x.toFixed(2))));
              const ys = new Set(r.items.map(it => Number(it.y.toFixed(2))));
              return xs.size + ys.size + 2;
            })();

        const candidate = {
          id: sheetEntry.id,
          name: sheetEntry.name,
          family: sheetEntry.family,
          familyLabel: sheetEntry.familyLabel,
          isNobel: sheetEntry.isNobel,
          isCustom: sheetEntry.isCustom,
          nobelOrigin: sheetEntry.nobelOrigin,
          sw: orient.sw,
          sh: orient.sh,
          sheetOrientation: orient.sheetOrientation,
          count: r.count,
          strategyKey: chosen.strategyKey,
          strategyOrientation: chosen.orientReq,
          strategyTitle: chosen.strategyKey === 'mixed'
            ? 'Corte Misto (0° + 90°)'
            : chosen.strategyKey === 'rotate'
              ? 'Paisagem (90°)'
              : 'Retrato (0°)',
          mixedGain,
          layoutNote: r.layoutNote,
          sheetUsagePct,
          effectiveUsagePct,
          totalLossPct,
          netSheets: r.net,
          totalSheets: r.total,
          extraPieces: r.extra,
          grossAreaM2,
          massKg: Number(r.mass.toFixed(3)),
          scrapMassKg,
          cutsEstimate,
          forms: r.forms,
          plates: r.plates,
          usesPlates: r.usesPlates,
          clicks: r.clicks,
          passes: r.passes,
          ream: r.ream,
          area: r.area,
          items: r.items,
          base: r.base,
          paperAnalysis: r.paperAnalysis,
          freeComparison: r.freeComparison,
          warnings: r.warnings,
          score: Number((sheetUsagePct * 0.55 + effectiveUsagePct * 0.4 + (r.extra === 0 ? 4 : 0) + (sheetEntry.isNobel ? 1.5 : 0)).toFixed(1)),
          tags: []
        };

        if (
          !bestEval ||
          candidate.count > bestEval.count ||
          (candidate.count === bestEval.count && candidate.effectiveUsagePct > bestEval.effectiveUsagePct) ||
          (candidate.count === bestEval.count && candidate.effectiveUsagePct === bestEval.effectiveUsagePct && candidate.cutsEstimate < bestEval.cutsEstimate)
        ) {
          bestEval = candidate;
        }
      }

      if (bestEval) suggestions.push(bestEval);
    }

    suggestions.sort((a, b) => {
      if (sortBy === 'effective') {
        return (b.effectiveUsagePct - a.effectiveUsagePct) || (b.sheetUsagePct - a.sheetUsagePct) || (b.count - a.count);
      }
      if (sortBy === 'count') {
        return (b.count - a.count) || (b.sheetUsagePct - a.sheetUsagePct) || (b.effectiveUsagePct - a.effectiveUsagePct);
      }
      if (sortBy === 'area') {
        return (a.grossAreaM2 - b.grossAreaM2) || (b.effectiveUsagePct - a.effectiveUsagePct) || (b.sheetUsagePct - a.sheetUsagePct);
      }
      // default: 'usage' (melhor aproveitamento na folha, desempatado por aproveitamento real e peças/folha)
      return (b.sheetUsagePct - a.sheetUsagePct) || (b.effectiveUsagePct - a.effectiveUsagePct) || (b.count - a.count);
    });

    const maxUsage = suggestions.length ? Math.max(...suggestions.map(x => x.sheetUsagePct)) : 0;
    const maxEff = suggestions.length ? Math.max(...suggestions.map(x => x.effectiveUsagePct)) : 0;
    const maxCount = suggestions.length ? Math.max(...suggestions.map(x => x.count)) : 0;
    const minArea = suggestions.length ? Math.min(...suggestions.map(x => x.grossAreaM2)) : Infinity;

    suggestions.forEach((item, idx) => {
      item.rank = idx + 1;
      const tags = [];
      if (idx === 0) tags.push('★ Recomendada #1');
      if (item.isNobel) tags.push('Padrão Nobel');
      if (item.sheetUsagePct === maxUsage && idx > 0) tags.push('Maior aproveitamento');
      if (item.effectiveUsagePct === maxEff && item.effectiveUsagePct > 0) tags.push('Menor desperdício');
      if (item.grossAreaM2 === minArea && suggestions.length > 1) tags.push('Menor consumo m²');
      if (item.count === maxCount && suggestions.length > 1 && item.count > 1) tags.push('Mais peças/folha');
      if (item.mixedGain > 0) tags.push(`Corte misto +${item.mixedGain}`);
      if (item.extraPieces === 0) tags.push('Múltiplo exato');
      item.tags = tags.slice(0, 4);
    });

    const maxResults = Number.isInteger(rawParams.maxResults) && rawParams.maxResults > 0
      ? rawParams.maxResults
      : suggestions.length;
    const list = suggestions.slice(0, maxResults);

    return {
      pw,
      ph,
      bleed: s.bleed,
      gapX: s.gapX,
      gapY: s.gapY,
      qty: s.qty,
      marginPreset: s.suggestMarginPreset || 'process',
      margins,
      sortBy,
      familyFilter,
      pieceAreaCm2: Number(((pw * ph) / 100).toFixed(2)),
      totalEvaluatedSheets: filteredCatalog.length,
      oversizedForStandardSheets: list.length === 0,
      suggestions: list,
      topRecommendation: list[0] || null
    };
  }

  function compute(rawState) {
    const s = { ...defaults, ...rawState };
    const errors = validate(s);
    const warnings = [];
    if (errors.length) return { errors, warnings, items: [], plan: [] };

    if (s.mode === 'suggest') {
      const suggestInfo = suggestImpositions(s);
      const chosen =
        suggestInfo.suggestions.find(item => item.id === s.suggestSelectedId) ||
        suggestInfo.topRecommendation ||
        null;
      if (!chosen) {
        return {
          errors,
          warnings: [
            `A peça (${s.pw} × ${s.ph} mm + sangria ${s.bleed} mm) não cabe em nenhuma folha padrão do filtro atual. Experimente remover o filtro de família ou usar Grandes Formatos (Plotter).`
          ],
          items: [],
          plan: [],
          base: [],
          area: null,
          processName: 'Recomendação de Folhas',
          usesPlates: false,
          clicks: 0,
          passes: 0,
          count: 0,
          forms: 0,
          plates: 0,
          net: 0,
          variableLoss: 0,
          makeready: 0,
          total: 0,
          mass: 0,
          ream: 0,
          usage: 0,
          extra: 0,
          layoutNote: 'Peça excede os formatos de folha filtrados',
          suggestInfo,
          activeSuggestion: null,
          paperAnalysis: null,
          preflightMarkers: [],
          finishTags: []
        };
      }
      return {
        errors,
        warnings: chosen.warnings || [],
        items: chosen.items,
        plan: [],
        base: chosen.base,
        area: chosen.area,
        region: chosen.area,
        processName: (PROCESS_PROFILES[suggestInfo.margins.process] || PROCESS_PROFILES.offset).name,
        usesPlates: chosen.usesPlates,
        clicks: chosen.clicks,
        passes: chosen.passes,
        count: chosen.count,
        forms: chosen.forms,
        plates: chosen.plates,
        net: chosen.netSheets,
        variableLoss: chosen.paperAnalysis?.job?.variableLossSheets || 0,
        makeready: chosen.paperAnalysis?.job?.makereadySheets || 0,
        total: chosen.totalSheets,
        mass: chosen.massKg,
        ream: chosen.ream,
        usage: chosen.sheetUsagePct,
        extra: chosen.extraPieces,
        layoutNote: `${chosen.name} (${chosen.sw}×${chosen.sh} mm) · ${chosen.layoutNote}`,
        suggestInfo,
        activeSuggestion: chosen,
        freeComparison: chosen.freeComparison,
        paperAnalysis: chosen.paperAnalysis,
        preflightMarkers: [],
        finishTags: []
      };
    }

    if (s.mode === 'compare') {
      const compareInfo = buildCompareInfo(s.compareSheets);
      return {
        errors,
        warnings,
        items: [],
        plan: [],
        base: [],
        area: { x: 0, y: 0, w: compareInfo.largest.w, h: compareInfo.largest.h },
        processName: 'Comparação em escala real (mm)',
        usesPlates: false,
        clicks: 0,
        passes: 0,
        count: compareInfo.count,
        forms: 0,
        plates: 0,
        net: 0,
        variableLoss: 0,
        makeready: 0,
        total: 0,
        mass: 0,
        ream: 0,
        usage: 0,
        extra: 0,
        layoutNote: `${compareInfo.count} tamanho(s) em escala proporcional 1:1`,
        compareInfo,
        paperAnalysis: null,
        preflightMarkers: [],
        finishTags: []
      };
    }

    const proc = PROCESS_PROFILES[s.process] || PROCESS_PROFILES.offset;
    const usesPlates = s.mode === 'visual' ? false : proc.usesPlates;

    const a = area(s);
    if (a.w <= 0 || a.h <= 0) {
      return { errors: ['As reservas da máquina consomem toda a folha.'], warnings, items: [], plan: [] };
    }

    let items = [];
    let plan = [];
    let base = [];
    let count = 0;
    let forms = 0;
    let plates = 0;
    let net = 0;
    let pressPasses = 0;
    let r = a;
    let layoutNote = '';
    let spineWidth = 0;
    let effectiveCreep = s.creep || 0;
    let visualInfo = null;
    let freeComparison = null;
    let activeStrategyKey = '';
    const preflightMarkers = [];
    const skuCounts = { A: 0, B: 0, C: 0, D: 0 };

    const spot = s.spotColors || 0;
    const varnishPlate = s.varnish === 'spot_uv' ? 1 : 0;
    const cFront = (s.process === 'pb' ? 1 : (s.colorsFront ?? 4)) + spot + varnishPlate;
    const cBack = s.style === 'single' ? 0 : (s.process === 'pb' ? 1 : (s.colorsBack ?? 4)) + spot;

    if (s.mode === 'visual') {
      // Comunicação Visual / Grandes Formatos (Banners, Faixas, Lonas e Painéis)
      const cutW = s.pw + 2 * (s.hem || 0);
      const cutH = s.ph + 2 * (s.hem || 0) + (s.polePocketTop || 0) + (s.polePocketBottom || 0);
      const usableMediaW = a.w;
      const weldOverlap = s.weld || 25;

      // Calculate panels if cutW exceeds media width
      let numPanels = 1;
      const panels = [];
      if (cutW <= usableMediaW) {
        panels.push({ index: 1, w: cutW, h: cutH, overlapLeft: 0, overlapRight: 0 });
      } else {
        const effStep = Math.max(50, usableMediaW - weldOverlap);
        numPanels = Math.ceil((cutW - weldOverlap) / effStep);
        const basePanelW = cutW / numPanels;
        for (let i = 0; i < numPanels; i++) {
          const ovL = i > 0 ? weldOverlap / 2 : 0;
          const ovR = i < numPanels - 1 ? weldOverlap / 2 : 0;
          panels.push({
            index: i + 1,
            w: Number((basePanelW + ovL + ovR).toFixed(1)),
            h: cutH,
            overlapLeft: ovL,
            overlapRight: ovR
          });
        }
      }

      const grommets = computeGrommets(s.pw, s.ph, s.grommetSpacing, s.grommetInset);
      visualInfo = {
        finalW: s.pw,
        finalH: s.ph,
        cutW,
        cutH,
        hem: s.hem,
        weld: s.weld,
        polePocketTop: s.polePocketTop,
        polePocketBottom: s.polePocketBottom,
        safeMargin: s.safeMargin,
        grommets,
        grommetsPerPiece: grommets.length,
        totalGrommets: grommets.length * s.qty,
        numPanels,
        panels,
        totalAreaM2: Number((((cutW * cutH) / 1e6) * s.qty).toFixed(2))
      };

      base = [{ id: 'banner', x: s.hem, y: s.hem + s.polePocketTop, w: s.pw, h: s.ph, cutW, cutH, angle: 0 }];
      items = base;
      count = 1;
      forms = numPanels;
      plates = 0;
      net = s.qty * numPanels;
      pressPasses = 1;
      layoutNote = `Formato final ${s.pw}×${s.ph} mm · Corte bruto c/ bainha/bolsa: ${cutW}×${cutH} mm · ${numPanels} pano(s) · ${grommets.length} ilhós/peça`;

      if (s.grommetSpacing > 0 && s.safeMargin < s.grommetInset + 10) {
        const msg = `Margem de segurança (${s.safeMargin} mm) muito próxima do centro do ilhós (${s.grommetInset} mm). Recomenda-se ≥ ${s.grommetInset + 15} mm.`;
        warnings.push(msg);
        preflightMarkers.push({
          level: 'warning',
          code: 'GROMMET_MARGIN',
          label: `ILHÓS PRÓXIMO À MARGEM (${s.safeMargin} mm)`,
          detail: msg,
          x: s.hem,
          y: s.hem + s.polePocketTop,
          w: s.pw,
          h: Math.max(25, s.safeMargin)
        });
      }
      if (numPanels > 1) {
        const msg = `Peça dividida em ${numPanels} panos para caber na largura útil da mídia (${usableMediaW} mm), com sobreposição de solda de ${weldOverlap} mm.`;
        warnings.push(msg);
        preflightMarkers.push({
          level: 'warning',
          code: 'PANEL_WELD',
          label: `DIVISÃO EM ${numPanels} PANOS (SOLDA ${weldOverlap} mm)`,
          detail: msg,
          x: cutW / numPanels - weldOverlap / 2,
          y: 0,
          w: weldOverlap,
          h: cutH
        });
      }
      if (s.polePocketTop > 0 && s.grommetSpacing > 0) {
        const msg = 'Bolsa para bastão e ilhós ativos simultaneamente: confirme se os ilhós devem ser aplicados apenas nas laterais ou cantos.';
        warnings.push(msg);
        preflightMarkers.push({
          level: 'warning',
          code: 'POCKET_GROMMET',
          label: 'BOLSA DE BASTÃO + ILHÓS',
          detail: msg,
          x: s.hem,
          y: s.hem,
          w: s.pw,
          h: s.polePocketTop
        });
      }
    } else if (s.mode === 'book') {
      const pat = FOLD_PATTERNS[s.foldPattern] || FOLD_PATTERNS['F4-1'];
      plan = bookPlan(s);
      const totalPadded = plan.length * pat.pages;
      const totalLeaves = totalPadded / 4;
      const leavesInSig = pat.pages / 4;
      const isLooseBinding = s.binding === 'spiral' || s.binding === 'wireo' || s.binding === 'pad';
      const creepLeaves = isLooseBinding ? 0 : s.binding === 'saddle' ? totalLeaves : leavesInSig;

      if (isLooseBinding) {
        effectiveCreep = 0;
      } else if (s.creepMode === 'auto') {
        effectiveCreep = creepLeaves > 1 ? Number(((creepLeaves - 1) * s.caliper * (Math.PI / 2)).toFixed(2)) : 0;
      }

      const bookSheets = totalPadded / 2;
      const glueFactor = s.binding === 'perfect' ? 0.5 : s.binding === 'spiral' || s.binding === 'wireo' ? 2.5 : 0;
      spineWidth = Number((bookSheets * s.caliper + glueFactor).toFixed(2));

      const millingAllowance = (s.binding === 'perfect' || isLooseBinding ? (s.milling || 0) * 2 : 0) + (s.spineGutter || 0);
      const faceGap = pat.cols > 2 ? (s.faceGutter || 0) : 0;
      const headGap = pat.rows > 1 ? (s.headTrim || 0) : 0;
      const w = pat.cols * s.pw + (pat.cols / 2) * millingAllowance + faceGap;
      const h = pat.rows * s.ph + headGap + (s.footTrim || 0);
      const x = a.x + (a.w - w) / 2 + s.offsetX;
      const y = a.y + (a.h - h) / 2 + s.offsetY;

      base = [{
        id: 'section',
        x,
        y,
        w,
        h,
        angle: s.sectionAngle,
        cols: pat.cols,
        rows: pat.rows,
        headGap,
        faceGap,
        millingAllowance,
        bindingMargin: s.bindingMargin || 0
      }];
      items = base;
      count = 1;
      forms = plan.length * 2;
      plates = usesPlates ? plan.length * (cFront + (s.process === 'pb' ? 1 : (s.colorsBack ?? 4) + spot)) : 0;
      net = s.qty * plan.length;
      pressPasses = s.style === 'perfector' ? 1 : 2;
      layoutNote = `${pat.name} · ${plan.length} caderno(s) · Lombada: ${spineWidth} mm`;

      if (!fits(a, bounds(base[0], s.bleed))) {
        const msg = `O caderno aberto (${w} × ${h} mm + sangria) ultrapassa a área imprimível (${a.w} × ${a.h} mm).`;
        errors.push(msg);
        preflightMarkers.push({
          level: 'error',
          code: 'BOOK_OUT_OF_BOUNDS',
          label: `CADERNO EXCEDE ÁREA ÚTIL (${w}×${h} mm)`,
          detail: msg,
          x: x - s.bleed,
          y: y - s.bleed,
          w: w + 2 * s.bleed,
          h: h + 2 * s.bleed
        });
      }
      if (s.grain === 'x') {
        const msg = 'Fibra transversal à lombada vertical. Confira o substrato e a dobra.';
        warnings.push(msg);
        preflightMarkers.push({
          level: 'warning',
          code: 'BOOK_GRAIN',
          label: 'FIBRA TRANSVERSAL À LOMBADA',
          detail: msg,
          x: x + w / 2 - 12,
          y: y + 8,
          w: 24,
          h: h - 16
        });
      }
      if (s.pages % pat.pages) {
        warnings.push(`${totalPadded - s.pages} página(s) em branco adicionada(s) ao final.`);
      }
      if (pat.rows > 1 && headGap < 2) {
        const msg = 'Dobras cruzadas (8p/16p) exigem abertura/refilo de cabeça (recomendado ≥ 3 mm).';
        warnings.push(msg);
        preflightMarkers.push({
          level: 'warning',
          code: 'HEAD_TRIM',
          label: `REFILO DE CABEÇA CURTO (${headGap} mm)`,
          detail: msg,
          x,
          y: y + s.ph - 3,
          w,
          h: Math.max(6, headGap + 6)
        });
      }
      if (effectiveCreep >= s.pw / 2) {
        const msg = 'A compensação alcança metade da largura da página.';
        errors.push(msg);
        preflightMarkers.push({
          level: 'error',
          code: 'CREEP_MAX',
          label: `CREEP EXCESSIVO (${effectiveCreep} mm)`,
          detail: msg,
          x: x + w / 2 - 16,
          y,
          w: 32,
          h
        });
      }
      if (s.binding === 'perfect' && pat.pages === 4 && (s.creep || 0) > 0) {
        warnings.push('Compensação manual ignorada: cadernos independentes de uma folha.');
      }
      if ((s.binding === 'spiral' || s.binding === 'wireo') && (s.bindingMargin || 0) < 8) {
        const msg = `Encadernação ${s.binding === 'wireo' ? 'Wire-O' : 'Espiral'} exige margem interna de furação ≥ 8–10 mm para não atingir o conteúdo.`;
        warnings.push(msg);
        preflightMarkers.push({
          level: 'warning',
          code: 'BINDING_MARGIN',
          label: `MARGEM DE FURAÇÃO CURTA (${s.bindingMargin} mm)`,
          detail: msg,
          x: x + w / 2 - 10,
          y,
          w: 20,
          h
        });
      }
      warnings.push(
        s.binding === 'saddle'
          ? 'Canoa: folhas de dobra simples encaixadas, da externa para a interna.'
          : s.binding === 'perfect'
            ? 'Alceado: cadernos independentes de 4 páginas. Fresagem e capa ainda não modeladas.'
            : s.binding === 'wireo'
              ? `Wire-O (Duplo Anel): prever refilo nos 4 lados e margem de furação de ${s.bindingMargin} mm (passo 2:1 ou 3:1).`
              : s.binding === 'spiral'
                ? `Espiral: prever refilo nos 4 lados e margem de furação de ${s.bindingMargin} mm.`
                : `Blocagem: prever margem de colagem/destaque e serrilha se aplicável.`
      );
    } else {
      // mode === 'flat' or mode === 'free' (Aba 04 · Visualização Livre)
      const isFree = s.mode === 'free';
      const effS = isFree ? { ...s, style: 'single', pieceGrain: 'free', grain: 'none' } : s;
      r = region(effS, a);
      const gs = [grid(effS, r, 0), grid(effS, r, 90)];
      const mixedAllowed = s.allowMixed !== false;
      const mixed = mixedAllowed
        ? mixedGrid(effS, r)
        : { n: 0, placements: [], mixed: true, disabled: true };

      const sheetArea = s.sw * s.sh;
      const pieceArea = s.pw * s.ph;
      const bestUniformGrid = pickBetterUniform(gs[0], gs[1]);
      const bestUniform = bestUniformGrid.angle === 90 ? 'rotate' : 'normal';
      const maxUniformCount = bestUniformGrid.n;
      const winnerKey = mixedAllowed && mixed.n > maxUniformCount ? 'mixed' : bestUniform;
      const winnerCount = mixedAllowed ? Math.max(maxUniformCount, mixed.n) : maxUniformCount;

      freeComparison = {
        normal: {
          key: 'normal',
          title: 'Retrato (0°)',
          count: gs[0].n,
          desc: `${gs[0].c} col × ${gs[0].rows} lin`,
          usage: Number((((gs[0].n * pieceArea) / sheetArea) * 100).toFixed(1))
        },
        rotate: {
          key: 'rotate',
          title: 'Paisagem (90°)',
          count: gs[1].n,
          desc: `${gs[1].c} col × ${gs[1].rows} lin`,
          usage: Number((((gs[1].n * pieceArea) / sheetArea) * 100).toFixed(1))
        },
        mixed: {
          key: 'mixed',
          title: 'Corte Misto (0° + 90°)',
          count: mixed.n,
          disabled: !mixedAllowed,
          desc: !mixedAllowed ? 'Desativado' : (mixed.desc || 'Combinação 0° + 90°'),
          usage: !mixedAllowed ? 0 : Number((((mixed.n * pieceArea) / sheetArea) * 100).toFixed(1))
        },
        winnerKey,
        winnerCount
      };

      let useMixed = false;
      let g = gs[0];
      const requestedOrient = isFree
        ? (s.freeStrategy === 'best' || !s.freeStrategy ? winnerKey : s.freeStrategy)
        : s.orientation;
      const activeOrient = !mixedAllowed && requestedOrient === 'mixed' ? bestUniform : requestedOrient;

      if (activeOrient === 'normal') {
        g = gs[0];
      } else if (activeOrient === 'rotate') {
        g = gs[1];
      } else if (activeOrient === 'mixed') {
        if (mixedAllowed && (mixed.n > Math.max(gs[0].n, gs[1].n) || (isFree && mixed.n > 0))) {
          useMixed = true;
        } else {
          g = gs[1].n > gs[0].n ? gs[1] : gs[0];
          if (!isFree) warnings.push('O corte misto não superou a grade uniforme para estas medidas.');
        }
      } else {
        g = pickBetterUniform(gs[0], gs[1]);
        if (!mixedAllowed && !isFree && s.orientation === 'mixed') {
          warnings.push('Corte misto desativado: exibindo a melhor grade uniforme (0° ou 90°).');
        } else if (mixedAllowed && mixed.n > g.n) {
          warnings.push(`Dica de aproveitamento: a orientação "Corte misto (0° + 90°)" comporta ${mixed.n} peças (+${mixed.n - g.n} por folha).`);
        }
      }

      activeStrategyKey = useMixed ? 'mixed' : g.angle === 90 ? 'rotate' : 'normal';

      if (useMixed) {
        if (mixed.n > 700) {
          return { errors: ['Mais de 700 posições na grade mista. Aumente a peça ou reduza a folha.'], warnings, items: [], plan: [], capacity: mixed.n };
        }
        layoutNote = mixed.desc;
        if (!isFree) warnings.push('Corte misto (Dutch cut) ativo: peças em 0° e 90° possuem sentidos de fibra perpendiculares.');
        for (const p of mixed.placements) {
          const edit = s.edits[p.id];
          if (edit?.deleted) continue;
          base.push({ ...p, ...edit });
        }
      } else {
        if (g.n > 600) {
          return { errors: ['Mais de 600 posições na grade. Aumente a peça para editar a montagem.'], warnings, items: [], plan: [], capacity: g.n };
        }
        layoutNote = `${g.c} col × ${g.rows} lin (${g.angle}°)`;
        const x0 = r.x + (r.w - (g.c * (g.w + 2 * s.bleed) + (g.c - 1) * s.gapX)) / 2 + s.bleed;
        const y0 = r.y + (r.h - (g.rows * (g.h + 2 * s.bleed) + (g.rows - 1) * s.gapY)) / 2 + s.bleed;
        for (let row = 0; row < g.rows && g.n; row++) {
          for (let col = 0; col < g.c; col++) {
            const id = `p${row * g.c + col}`;
            const p = {
              id,
              x: x0 + col * (g.w + 2 * s.bleed + s.gapX),
              y: y0 + row * (g.h + 2 * s.bleed + s.gapY),
              w: g.w,
              h: g.h,
              angle: g.angle,
              sku: 'A'
            };
            const edit = s.edits[id];
            if (edit?.deleted) continue;
            base.push({ ...p, ...edit });
          }
        }
      }

      base.push(...s.extras.map(ex => ({ sku: 'A', ...ex })));
      if (base.length > 700) {
        return { errors: ['Limite de 700 posições editáveis.'], warnings, items: [], plan: [] };
      }

      for (const p of base) {
        if (![p.x, p.y, p.w, p.h, p.angle].every(Number.isFinite)) {
          errors.push('Posição inválida.');
          continue;
        }
        const sku = p.sku || 'A';
        items.push({ ...p, sku, label: 'F', source: p.id });
        skuCounts[sku] = (skuCounts[sku] || 0) + 1;

        if (!fits(r, bounds(p, s.bleed))) {
          const msg = `Peça ${p.id}: fora da área permitida.`;
          errors.push(msg);
          preflightMarkers.push({
            level: 'error',
            code: 'OUT_OF_BOUNDS',
            label: `FORA DA ÁREA (${p.id})`,
            detail: msg,
            x: p.x - s.bleed,
            y: p.y - s.bleed,
            w: p.w + 2 * s.bleed,
            h: p.h + 2 * s.bleed
          });
        }
        if (!allowed(effS, p.angle)) {
          const msg = `Peça ${p.id}: rotação incompatível com a fibra.`;
          errors.push(msg);
          preflightMarkers.push({
            level: 'error',
            code: 'GRAIN_CONFLICT',
            label: `CONFLITO DE FIBRA (${p.id})`,
            detail: msg,
            x: p.x,
            y: p.y,
            w: p.w,
            h: p.h
          });
        }

        if (effS.style === 'turn') {
          items.push({ ...p, sku, id: p.id + 'v', source: p.id, x: s.sw - p.x - p.w, label: 'V' });
          skuCounts[sku] = (skuCounts[sku] || 0) + 1;
        }
        if (effS.style === 'tumble') {
          items.push({ ...p, sku, id: p.id + 'v', source: p.id, y: s.sh - p.y - p.h, angle: (p.angle + 180) % 360, label: 'V' });
          skuCounts[sku] = (skuCounts[sku] || 0) + 1;
        }
      }

      let overlapErrorPushed = false;
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const b1 = bounds(items[i], s.bleed);
          const b2 = bounds(items[j], s.bleed);
          if (overlap(b1, b2)) {
            if (!overlapErrorPushed) {
              errors.push('Há sobreposição entre peças ou suas sangrias.');
              overlapErrorPushed = true;
            }
            const ix = Math.max(b1.x, b2.x);
            const iy = Math.max(b1.y, b2.y);
            const iw = Math.max(6, Math.min(b1.x + b1.w, b2.x + b2.w) - ix);
            const ih = Math.max(6, Math.min(b1.y + b1.h, b2.y + b2.h) - iy);
            if (preflightMarkers.filter(m => m.code === 'OVERLAP').length < 6) {
              preflightMarkers.push({
                level: 'error',
                code: 'OVERLAP',
                label: `COLISÃO (${items[i].id} × ${items[j].id})`,
                detail: 'Há sobreposição entre peças ou suas sangrias.',
                x: ix,
                y: iy,
                w: iw,
                h: ih
              });
            }
          }
        }
      }

      count = items.length;
      forms = effS.style === 'sheetwise' || effS.style === 'perfector' ? 2 : 1;
      plates = !usesPlates
        ? 0
        : effS.style === 'single'
          ? cFront
          : (effS.style === 'turn' || effS.style === 'tumble')
            ? Math.max(cFront, cBack)
            : cFront + cBack;
      net = count ? Math.ceil(s.qty / count) : 0;
      pressPasses = effS.style === 'single' || effS.style === 'perfector' ? 1 : 2;
      if (!count) {
        const msg = 'Nenhuma peça cabe com estas medidas e restrições.';
        errors.push(msg);
        preflightMarkers.push({
          level: 'error',
          code: 'NO_FIT',
          label: `PEÇA (${s.pw}×${s.ph}) NÃO CABE NA FOLHA`,
          detail: msg,
          x: a.x,
          y: a.y,
          w: a.w,
          h: a.h
        });
      }
    }

    // Finishing & Mechanical Interferences validation
    const finishTags = [];
    if (s.lamination && s.lamination !== 'none') {
      const lamNames = { matte: 'Laminação BOPP Fosca', gloss: 'Laminação BOPP Brilho', soft: 'Laminação Soft Touch' };
      finishTags.push(lamNames[s.lamination] || s.lamination);
      if (s.gsm < 150) {
        const msg = 'Laminação em papel abaixo de 150 g/m² possui alto risco de encanoamento.';
        warnings.push(msg);
        preflightMarkers.push({
          level: 'warning',
          code: 'LAMINATION_GSM',
          label: `LAMINAÇÃO EM ${s.gsm} g/m² (< 150 g/m²)`,
          detail: msg,
          x: a.x,
          y: a.y,
          w: a.w,
          h: Math.min(18, a.h * 0.15)
        });
      }
    }
    if (s.varnish && s.varnish !== 'none') {
      const varNames = { water: 'Verniz Base Água', total_uv: 'Verniz UV Total', spot_uv: 'Verniz UV Localizado (Máscara)' };
      finishTags.push(varNames[s.varnish] || s.varnish);
      if (s.varnish === 'spot_uv' && (!s.lamination || s.lamination === 'none')) {
        warnings.push('Verniz UV Localizado geralmente requer Laminação BOPP Fosca ou Soft Touch prévia para contraste e ancoragem.');
      }
    }
    if (s.hotStamping) {
      finishTags.push('Hot Stamping (Clichê)');
      warnings.push('Hot Stamping: prever clichê metálico e margem de registro mecânico.');
    }
    if (s.emboss) {
      finishTags.push('Relevo Seco (Macho/Fêmea)');
      warnings.push('Relevo Seco: atenção ao verso da área gravada (baixa relevo invertido no retiro).');
    }
    if (s.dieCut) {
      finishTags.push('Faca Especial (Corte e Vinco)');
      if ((s.mode === 'flat' || s.mode === 'free') && (s.gapX < 6 || s.gapY < 6) && count > 1) {
        const msg = 'Faca Especial (Corte e Vinco): recomenda-se espaçamento (gap) mínimo de 6 a 10 mm entre peças para alojar as borrachas ejetoras na madeira da faca.';
        warnings.push(msg);
        if (items[0]) {
          preflightMarkers.push({
            level: 'warning',
            code: 'DIECUT_GAP',
            label: `GAP DE FACA CURTO (${Math.min(s.gapX, s.gapY)} mm < 6 mm)`,
            detail: msg,
            x: items[0].x,
            y: items[0].y,
            w: items[0].w,
            h: items[0].h
          });
        }
      }
    }
    if (s.drill) finishTags.push('Furação Mecânica');
    if (s.perforation) finishTags.push(`Serrilha / Picote (${s.perfOffset} mm)`);
    if (s.crease) finishTags.push('Vinco Mecânico');
    if (s.numbering) finishTags.push('Numeração Sequencial');
    if (s.padding) finishTags.push('Blocagem (Cola)');

    if ((s.mode === 'book' || s.crease) && s.gsm >= 170 && !s.crease) {
      warnings.push('Gramatura ≥ 170 g/m²: recomenda-se ativar Vinco Mecânico prévio à dobra para evitar quebra de fibra na lombada.');
    }

    // Process-specific warnings and plate validation
    const plateFits = !usesPlates || !s.plateView || (s.plateW >= s.sw && s.plateH >= s.sh + s.plateGrip);
    if (usesPlates && s.plateView && !plateFits) {
      const msg = `A folha (${s.sw} × ${s.sh} mm + pinça de chapa de ${s.plateGrip} mm) excede o tamanho da chapa CTP (${s.plateW} × ${s.plateH} mm).`;
      errors.push(msg);
      preflightMarkers.push({
        level: 'error',
        code: 'PLATE_OVERFLOW',
        label: `FOLHA EXCEDE CHAPA CTP (${s.plateW}×${s.plateH} mm)`,
        detail: msg,
        x: (s.sw - s.plateW) / 2,
        y: -(s.plateH - s.sh - s.plateGrip),
        w: s.plateW,
        h: s.plateH
      });
    }
    if (!usesPlates && s.mode !== 'visual' && s.mode !== 'free' && (s.style === 'turn' || s.style === 'tumble')) {
      warnings.push(`${proc.name}: como não há gravação de chapa, Work-and-Turn / Tumble não economiza matriz; prefira Duplex (Sheetwise).`);
    }
    if (s.process === 'laser' && s.mode !== 'free') {
      warnings.push('Laser (Fusor Térmico): considere dilatação/encolhimento de 0,5 a 1,5 mm no registro frente/verso.');
      if (s.gsm > 220) warnings.push('Laser: gramatura acima de 220 g/m² exige alimentação manual (bypass) e pode não passar no duplex automático.');
    }
    if (s.grain === 'none' && s.mode !== 'visual' && s.mode !== 'free') warnings.push('Sentido da fibra não informado.');
    if (s.marks && s.mode !== 'visual' && s.mode !== 'free') warnings.push('Marcas de corte ilustrativas: confira folga, sobreposição e área imprimível antes de produzir.');

    const variableLoss = Math.ceil((net * s.waste) / 100);
    const makeready = s.setup * forms;
    const total = net + variableLoss + makeready;
    const sidesPrinted = s.mode === 'book' || (s.mode === 'flat' && s.style !== 'single') ? 2 : 1;
    const totalClicks = total * sidesPrinted;
    const mass = (total * s.sw * s.sh * s.gsm) / 1e9;
    const ream = (s.sw * s.sh * s.gsm * 500) / 1e9;
    const usage = s.mode === 'visual'
      ? Math.min(100, ((visualInfo.cutW * visualInfo.cutH) / (s.sw * s.sh)) * 100)
      : (items.reduce((v, p) => v + p.w * p.h, 0) / (s.sw * s.sh)) * 100;
    const extra = s.mode === 'flat' || s.mode === 'free' ? net * count - s.qty : 0;
    const paperAnalysis = computePaperAnalysis({
      s,
      a,
      items,
      base,
      plan,
      count,
      forms,
      net,
      variableLoss,
      makeready,
      total,
      mass,
      usage,
      extra,
      visualInfo,
      freeComparison,
      activeStrategyKey
    });

    return {
      errors: [...new Set(errors)],
      warnings,
      preflightMarkers,
      freeComparison,
      paperAnalysis,
      area: a,
      region: r,
      items,
      base,
      plan,
      count,
      forms,
      plates,
      usesPlates,
      processName: proc.name,
      clicks: totalClicks,
      finishTags,
      visualInfo,
      plateInfo: {
        w: s.plateW,
        h: s.plateH,
        grip: s.plateGrip,
        punch: s.platePunch,
        lpi: s.screenLpi,
        fits: plateFits
      },
      net,
      variableLoss,
      makeready,
      total,
      passes: total * pressPasses,
      mass,
      ream,
      usage,
      extra,
      layoutNote,
      spineWidth,
      effectiveCreep,
      skuCounts
    };
  }

  return {
    FOLD_PATTERNS,
    PAPER_PRESETS,
    PIECE_PRESET_GROUPS,
    PIECE_PRESETS,
    PROCESS_PROFILES,
    defaults,
    clone,
    compute,
    suggestImpositions,
    bookPlan,
    computeGrommets,
    area,
    overlap,
    allowed,
    pressGuides
  };
});
