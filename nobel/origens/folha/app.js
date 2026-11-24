'use strict';

const $ = id => document.getElementById(id);
const F = Folha;

let state = F.clone(F.defaults);
let history = [];
let future = [];
let selected = null;
let selectedSlot = null;
let face = 'front';
let sheet = 0;
let result;
let lastSvg = '';
let pending = false;
let stageZoom = 1;
let stagePanX = 0;
let stagePanY = 0;
let stageDragged = false;
let debounceTimer = null;
let activeInputSnapshot = null;
let activeGlossaryCategory = 'Todas';
let activePopoverTermId = null;
let lastFreeBleed = 3;
const openCustomCreator = { paper: false, piece: false };

// Track open/closed state of <details class="cfg-group"> across re-renders
const openGroups = new Set([
  'flat-process',
  'flat-piece',
  'book-process',
  'book-editorial',
  'book-gutters',
  'visual-piece',
  'visual-structure',
  'visual-roll',
  'free-sheet',
  'free-piece',
  'free-strategy',
  'free-marks',
  'compare-controls',
  'compare-items',
  'suggest-piece',
  'suggest-options'
]);

const GLOSSARY_CATEGORIES = [
  'Formatos e Substratos',
  'Folha, Máquina e Orientação',
  'Imposição e Geometria',
  'Editorial e Encadernação',
  'Chapa CTP, Cor e Impressão',
  'Marcas Técnicas de Pré-Impressão',
  'Acabamentos, Enobrecimentos e Interferências',
  'Comunicação Visual e Grandes Formatos',
  'Produção, Tiragem e Validação'
];

const GLOSSARY = {
  nobel_t8: {
    term: 'Padrão Nobel T9 (220 × 380), T8 (238 × 328) e T4 (328 × 478 mm)',
    category: 'Formatos e Substratos',
    shortDefinition: 'Formatos de folha cortada usados na gráfica, incluindo T9 (220 × 380 mm), T8 (238 × 328 mm) e T4 (328 × 478 mm) derivados da folha inteira 66 × 96 cm.',
    practicalUse: 'Permitem imprimir em máquinas offset de pequeno e médio porte (como GTO e Ryobi) ou digitais com aproveitamento padronizado de papel.',
    example: '1 folha 660 × 960 mm gera 4 folhas Nobel T4 (328 × 478 mm) ou 8 folhas Nobel T8 (238 × 328 mm); T9 mede 220 × 380 mm.',
    related: ['sheet_format', 'sra3', 'trim_size']
  },
  super_a4: {
    term: 'Super A4 / A4+ · formatos comerciais de folha',
    category: 'Formatos e Substratos',
    shortDefinition: 'O A4 acabado mede 210 × 297 mm. A4+ é uma designação comercial cuja medida depende do fornecedor.',
    practicalUse: 'Para refile, escolha a folha gráfica de 220 × 320, 225 × 320 ou 230 × 330 mm. O modelo de sublimação mede 230 × 350 mm. Confira o limite de alimentação da máquina.',
    example: 'Com 5 mm de sangria por lado, a peça A4 ocupa 220 × 307 mm antes das marcas e reservas. Em Ofício de 216 mm de largura, 3 mm de sangria por lado já ocupam toda a largura.',
    related: ['sheet_format', 'bleed', 'sra3']
  },
  sra3: {
    term: 'SRA3 (320 × 450 mm) e Super A3 (330 × 480 mm)',
    category: 'Formatos e Substratos',
    shortDefinition: 'Formatos de folha com área suplementar além do A3 (297 × 420 mm) para acomodar sangria, marcas de corte, barra de cor e pinça.',
    practicalUse: 'Simule a montagem com as reservas da máquina e a sangria do trabalho.',
    example: 'Para dois A4 em SRA3 ou Super A3, confira o encaixe após reservar sangria, calha, pinça e marcas.',
    related: ['nobel_t8', 'sheet_format', 'bleed']
  },
  iso_a: {
    term: 'Série ISO A (A0 a A10)',
    category: 'Formatos e Substratos',
    shortDefinition: 'Padrão internacional (ISO 216) baseado na proporção 1:√2, onde cada formato equivale exatamente à metade do anterior.',
    practicalUse: 'Facilita reduções, ampliações e dobras sucessivas sem alterar a proporção da página fechada.',
    example: 'A0 (841 × 1189 mm) → A3 (297 × 420 mm) → A4 (210 × 297 mm) → A5 (148 × 210 mm) → A6 (105 × 148 mm).',
    related: ['trim_size', 'sra3']
  },
  sheet_format: {
    term: 'Formato de folha de entrada (Folha de máquina)',
    category: 'Formatos e Substratos',
    shortDefinition: 'Largura e altura em milímetros da folha de papel alimentada na impressora antes da impressão e do refilo final.',
    practicalUse: 'Determina quantas peças cabem por folha (n-up), o aproveitamento percentual do papel e a compatibilidade com a boca da impressora.',
    example: 'Folhas comuns: Nobel T9 (220 × 380 mm), Nobel T8 (238 × 328 mm), Nobel T4 (328 × 478 mm), SRA3 (320 × 450 mm), Meia-folha (480 × 660 mm) e Inteira (660 × 960 mm).',
    related: ['nobel_t8', 'sra3', 'printable_area']
  },
  trim_size: {
    term: 'Formato final refilado (Trim size)',
    category: 'Formatos e Substratos',
    shortDefinition: 'Medida exata da peça gráfica pronta ou da página fechada após o corte final na guilhotina ou faca.',
    practicalUse: 'É a referência central da imposição: todas as marcas de corte apontam para esta linha e a sangria se projeta para fora dela.',
    example: 'Cartão de visita BR: 90 × 50 mm · Folheto A5: 148 × 210 mm · Livro padrão: 160 × 230 mm.',
    related: ['bleed', 'crop_marks', 'iso_a']
  },
  gsm: {
    term: 'Gramatura (g/m²)',
    category: 'Formatos e Substratos',
    shortDefinition: 'Massa do papel, cartão ou lona medida em gramas por metro quadrado de superfície.',
    practicalUse: 'Usada para calcular o peso da resma, a massa total da tiragem em quilogramas e estimar a espessura da folha quando o caliper não é informado.',
    example: 'Offset 75–90 g/m² (miolo de livro), Couchê 115–150 g/m² (folhetos), Cartão/Couchê 250–300 g/m² (capas e cartões), Lona 440 g/m² (banners).',
    related: ['caliper', 'ream_mass', 'spine_width']
  },
  caliper: {
    term: 'Espessura do papel (Caliper / Bulk)',
    category: 'Formatos e Substratos',
    shortDefinition: 'Espessura física real de uma única folha de substrato medida em milímetros com micrômetro.',
    practicalUse: 'Indispensável no modo Editorial para calcular com precisão a largura da lombada e a compensação automática de creep.',
    example: 'Papel Offset 90 g/m² tem cerca de 0,11 mm; papel Pólen Bold 90 g/m² pode chegar a 0,14 mm.',
    related: ['gsm', 'spine_width', 'creep']
  },
  grain: {
    term: 'Sentido de fibra (Grain direction)',
    category: 'Formatos e Substratos',
    shortDefinition: 'Alinhamento predominante das fibras de celulose formado durante a fabricação do papel.',
    practicalUse: 'Dobras, vincos e a lombada de livros devem ficar paralelos à fibra para evitar rachaduras, ondulação na colagem e efeito mola.',
    example: 'Em um livro 148 × 210 mm, a fibra na página deve correr na vertical (paralela aos 210 mm da lombada).',
    related: ['piece_grain', 'spine_width', 'crease']
  },
  piece_grain: {
    term: 'Restrição de fibra na peça',
    category: 'Formatos e Substratos',
    shortDefinition: 'Regra que trava a rotação da peça na folha para garantir que a fibra do papel fique paralela à altura ou à largura da peça.',
    practicalUse: 'Impede que o algoritmo gire a peça em 90° ou aplique corte misto quando a dobra ou encadernação exige sentido de fibra rigoroso.',
    example: 'Escolha "Paralela à altura da peça" para capas, folders e cartuchos dobráveis.',
    related: ['grain', 'orientation', 'dutch_cut']
  },
  grip: {
    term: 'Pinça de máquina (Gripper margin)',
    category: 'Folha, Máquina e Orientação',
    shortDefinition: 'Faixa na borda dianteira da folha onde as pinças mecânicas da impressora seguram e tracionam o papel.',
    practicalUse: 'Nenhuma imagem, sangria ou marca pode invadir a pinça, pois as garras impedem o contato da blanqueta com o papel nessa região.',
    example: 'Offset plana exige tipicamente 10 a 12 mm de pinça; impressoras digitais usam margem não imprimível de 4 a 5 mm.',
    related: ['tail', 'side_guide', 'plate_grip', 'tumble']
  },
  tail: {
    term: 'Contrapinça (Margem traseira / Tail)',
    category: 'Folha, Máquina e Orientação',
    shortDefinition: 'Margem na borda oposta à pinça de entrada da folha.',
    practicalUse: 'Acomoda barras de controle densitométrico, tiras técnicas e garante folga para variações dimensionais da folha. No Work-and-tumble e Perfector, torna-se a pinça da 2ª passada.',
    example: 'Em Offset costuma ter de 6 a 10 mm; se usar Work-and-tumble, deve ser igualada à pinça (10–12 mm).',
    related: ['grip', 'color_bar', 'tumble', 'perfector']
  },
  side_margins: {
    term: 'Margens laterais (Esquerda e Direita)',
    category: 'Folha, Máquina e Orientação',
    shortDefinition: 'Reservas livres nas bordas esquerda e direita da folha de impressão.',
    practicalUse: 'Abrem espaço para o esquadro lateral de puxada/empurra, alvos de registro e marcas de corte externas.',
    example: 'Tipicamente 5 a 8 mm em Offset e 4 a 5 mm em impressão Digital.',
    related: ['side_guide', 'printable_area', 'reg_marks']
  },
  side_guide: {
    term: 'Esquadro lateral (Side lay / Guia lateral)',
    category: 'Folha, Máquina e Orientação',
    shortDefinition: 'Mecanismo lateral da impressora que encosta ou puxa a folha sempre na mesma referência antes da impressão.',
    practicalUse: 'Garante o registro lateral perfeito entre cores e entre frente e verso. Em Sheetwise e Work-and-turn, o lado físico na folha se inverte na virada.',
    example: 'Se a 1ª passada usa esquadro esquerdo na frente, no Sheetwise o operador alinha a mesma borda física do papel no retiro.',
    related: ['grip', 'sheetwise', 'turn']
  },
  printable_area: {
    term: 'Área útil imprimível da folha',
    category: 'Folha, Máquina e Orientação',
    shortDefinition: 'Retângulo interno da folha disponível para receber peças, sangrias e marcas após descontar pinça, contrapinça, margens laterais e reserva da barra de cor.',
    practicalUse: 'Representado pela linha tracejada na folha; qualquer peça ou sangria que ultrapasse essa área gera erro no Preflight.',
    example: 'Em uma folha 328 × 478 mm com margens de 6 mm, pinça 10 mm, contrapinça 8 mm e barra 8 mm, a área útil é 316 × 452 mm.',
    related: ['sheet_format', 'grip', 'tail', 'color_bar']
  },
  style: {
    term: 'Modo de impressão e virada (Work style)',
    category: 'Folha, Máquina e Orientação',
    shortDefinition: 'Método operacional usado na gráfica para imprimir a frente (reto) e o verso (retiro) da folha.',
    practicalUse: 'Define quantas formas/chapas CTP serão gravadas, como a folha é virada na máquina e qual borda serve de pinça e esquadro.',
    example: 'Opções: Somente frente (Simplex), Sheetwise, Perfector, Work-and-turn (Tira-retira) e Work-and-tumble (Cambalhota).',
    related: ['simplex', 'sheetwise', 'perfector', 'turn', 'tumble']
  },
  simplex: {
    term: 'Somente frente (Simplex · 1×0 ou 4×0)',
    category: 'Folha, Máquina e Orientação',
    shortDefinition: 'Impressão realizada apenas em uma face do substrato, mantendo o verso em branco.',
    practicalUse: 'Reduz o número de chapas e passagens pela metade; comum em rótulos, cartazes, blocos e banners.',
    example: '4×0 significa 4 cores CMYK na frente e 0 cores no verso.',
    related: ['style', 'colors_front']
  },
  sheetwise: {
    term: 'Sheetwise (Duas formas · Frente e Retiro)',
    category: 'Folha, Máquina e Orientação',
    shortDefinition: 'Imposição em que um jogo de chapas imprime a frente da folha e outro jogo distinto imprime o verso.',
    practicalUse: 'Mantém a mesma borda de pinça nas duas passagens e vira a folha lateralmente, exigindo espelhamento horizontal das posições no verso.',
    example: 'Padrão universal para cadernos editoriais e tiragens longas em que a folha inteira é ocupada por frentes na 1ª passada.',
    related: ['style', 'grip', 'side_guide']
  },
  perfector: {
    term: 'Perfector (Reversão automática em 1 passagem)',
    category: 'Folha, Máquina e Orientação',
    shortDefinition: 'Impressora equipada com cilindro de reversão que imprime frente e verso da folha em uma única passagem pela máquina.',
    practicalUse: 'Dobra a produtividade em livros e catálogos, porém na reversão a pinça passa para a borda traseira da folha (exigindo contrapinça igual à pinça).',
    example: 'Em uma máquina 8 cores com reversão (4+4), cada folha pronta consome apenas 1 passagem.',
    related: ['style', 'grip', 'tail']
  },
  turn: {
    term: 'Work-and-turn (Tira-retira lateral · Mesma chapa)',
    category: 'Folha, Máquina e Orientação',
    shortDefinition: 'Frente e verso da peça são montados lado a lado na mesma chapa CTP. Após imprimir metade da tiragem, a folha é virada da esquerda para a direita mantendo a mesma pinça.',
    practicalUse: 'Economiza um jogo inteiro de chapas CTP e um acerto de máquina em tiragens pequenas e médias.',
    example: 'Exige número par de colunas e simetria horizontal em relação ao eixo central vertical da folha.',
    related: ['style', 'tumble', 'ctp_plate']
  },
  tumble: {
    term: 'Work-and-tumble (Cambalhota · Troca de pinça)',
    category: 'Folha, Máquina e Orientação',
    shortDefinition: 'Frente e verso são montados na metade superior e inferior da mesma chapa. Na virada, a borda traseira (contrapinça) entra na pinça.',
    practicalUse: 'Útil para peças alongadas quando não cabem lado a lado no Work-and-turn, mas exige guilhotinar/esquadrar as folhas com precisão para não perder registro.',
    example: 'Requer que a margem de contrapinça (tail) seja exatamente igual à pinça (grip).',
    related: ['style', 'turn', 'grip', 'tail']
  },
  imposition: {
    term: 'Imposição gráfica (Montagem na folha)',
    category: 'Imposição e Geometria',
    shortDefinition: 'Arranjo técnico de peças avulsas ou páginas de caderno sobre a folha de impressão para otimizar aproveitamento, registro e acabamento.',
    practicalUse: 'Garante que, após impressão, dobra e corte em guilhotina, todas as peças saiam na medida exata e as páginas fiquem na sequência correta.',
    example: 'Montar 24 cartões de visita 90 × 50 mm em uma folha Nobel T4 (328 × 478 mm).',
    related: ['ganging', 'orientation', 'dutch_cut']
  },
  ganging: {
    term: 'Ganging (Montagem conjugada por SKU)',
    category: 'Imposição e Geometria',
    shortDefinition: 'Combinação de diferentes modelos ou artes (SKUs A, B, C, D) de mesmo formato na mesma folha de impressão.',
    practicalUse: 'Divide o custo de chapas CTP e acerto de máquina entre vários clientes ou variações de produto em uma única tiragem.',
    example: 'Em uma folha com 10 poses, alocar 5 unidades para o SKU A e 5 unidades para o SKU B.',
    related: ['imposition', 'makeready']
  },
  bleed: {
    term: 'Sangria externa (Bleed)',
    category: 'Imposição e Geometria',
    shortDefinition: 'Extensão do fundo, fotos ou grafismos além da linha de corte final da peça.',
    practicalUse: 'Evita o aparecimento de filetes brancos nas bordas caso a lâmina da guilhotina sofra microvariações mecânicas.',
    example: 'Padrão comercial e editorial: 3 mm em cada lado externo; facas especiais e grandes formatos: 3 a 5 mm.',
    related: ['trim_size', 'gap_xy', 'bleed_marks']
  },
  gap_xy: {
    term: 'Espaçamento entre peças (Gap X / Gap Y)',
    category: 'Imposição e Geometria',
    shortDefinition: 'Distância livre entre as linhas de corte final de duas peças vizinhas nos eixos horizontal (X) e vertical (Y).',
    practicalUse: 'Acomoda a sangria das duas peças adjacentes e permite a entrada da lâmina da guilhotina (duplo corte) ou os fios de aço de uma faca especial.',
    example: '0 mm (corte seco/fio único sem sangria), 4 a 6 mm (duplo corte com sangria de 2–3 mm), 6 a 10 mm (faca de corte e vinco).',
    related: ['bleed', 'die_cut', 'crop_marks']
  },
  orientation: {
    term: 'Orientação e estratégia de aproveitamento',
    category: 'Imposição e Geometria',
    shortDefinition: 'Escolha entre manter as peças a 0° (Retrato), girá-las a 90° (Paisagem), testar a melhor grade uniforme ou combinar 0° + 90° (Corte misto).',
    practicalUse: 'Maximiza o número de peças por folha (n-up) e reduz o consumo total de papel da Ordem de Produção.',
    example: 'Alterar de 0° para Corte Misto pode elevar uma montagem de 8 para 10 peças por folha.',
    related: ['dutch_cut', 'piece_grain', 'usage']
  },
  dutch_cut: {
    term: 'Corte misto (Dutch cut · 0° + 90°)',
    category: 'Imposição e Geometria',
    shortDefinition: 'Arranjo que combina fileiras de peças na orientação normal (0°) com peças giradas a 90° na faixa residual da folha.',
    practicalUse: 'Extrai peças extras da sobra lateral ou inferior da folha quando a peça não tem restrição rígida de sentido de fibra.',
    example: 'Muito usado em cartões, panfletos e etiquetas planas para ganhar 10% a 25% mais peças por folha.',
    related: ['orientation', 'piece_grain']
  },
  free_mode: {
    term: 'Montagem rápida (Visualização livre)',
    category: 'Imposição e Geometria',
    shortDefinition: 'Modo direto em que você informa apenas tamanho da folha e tamanho da peça para comparar instantaneamente Retrato (0°), Paisagem (90°) e Corte Misto (0°+90°).',
    practicalUse: 'Ideal para orçamentistas e operadores que precisam descobrir em segundos quantas peças cabem na folha e ajustar marcas técnicas.',
    example: 'Compara automaticamente as 3 estratégias e destaca com ★ a que entrega mais peças por folha.',
    related: ['orientation', 'dutch_cut', 'crop_marks']
  },
  pages: {
    term: 'Total de páginas do miolo',
    category: 'Editorial e Encadernação',
    shortDefinition: 'Quantidade total de páginas numeradas (frentes e versos) que compõem a publicação editorial.',
    practicalUse: 'Determina a quantidade de cadernos necessários conforme o padrão de dobra (múltiplos de 4, 8 ou 16 páginas). Se sobrar espaço no último caderno, o sistema indica páginas em branco.',
    example: 'Um catálogo de 32 páginas em padrão F8-1 (8 págs/caderno) exige 4 cadernos.',
    related: ['fold_pattern', 'signature', 'binding']
  },
  signature: {
    term: 'Caderno editorial (Signature)',
    category: 'Editorial e Encadernação',
    shortDefinition: 'Folha impressa frente e verso que, após ser dobrada em sequência, forma um grupo ordenado de páginas de um livro ou revista.',
    practicalUse: 'Unidade básica da produção editorial; os cadernos são encaixados uns nos outros (canoa) ou alceados em sequência (lombada quadrada).',
    example: 'Caderno de 4 páginas (1 dobra), 8 páginas (2 dobras em cruz) ou 16 páginas (3 dobras em cruz).',
    related: ['fold_pattern', 'binding', 'collation_marks']
  },
  fold_pattern: {
    term: 'Padrão de dobra e imposição (F4-1, F8-1, F16-1, 2-up)',
    category: 'Editorial e Encadernação',
    shortDefinition: 'Esquema catálogo (estilo Preps) que define quantas páginas entram por caderno, quais ficam de cabeça para baixo (180°) e a ordem das dobras.',
    practicalUse: 'Garante que, ao dobrar a folha na dobradeira, a paginação siga em ordem contínua (1, 2, 3... N) e com cabeças alinhadas.',
    example: 'F8-1 impõe 4 páginas na frente e 4 no verso em grade 2×2 com a linha superior girada a 180°.',
    related: ['signature', 'head_trim', 'sheetwise']
  },
  binding: {
    term: 'Método de encadernação',
    category: 'Editorial e Encadernação',
    shortDefinition: 'Processo de união dos cadernos ou folhas soltas para formar o volume final.',
    practicalUse: 'Define como os cadernos são acumulados (encaixados vs. alceados), o cálculo de creep, a fresagem de lombada e a margem de furação.',
    example: 'Grampo/Canoa (revistas até ~64–80 págs), Lombada quadrada PUR/Hotmelt (livros), Espiral, Wire-O ou Blocagem.',
    related: ['saddle_stitch', 'perfect_bind', 'spiral_wireo']
  },
  saddle_stitch: {
    term: 'Grampo / Canoa (Saddle-stitch · Cadernos encaixados)',
    category: 'Editorial e Encadernação',
    shortDefinition: 'Encadernação em que os cadernos dobrados são encaixados um dentro do outro e grampeados na dobra central.',
    practicalUse: 'Como os cadernos acumulam espessura no centro, os cadernos internos se projetam para fora no corte frontal, exigindo compensação de creep.',
    example: 'Em um livreto de 4 cadernos em canoa, o Caderno #1 é a capa/externo e o Caderno #4 é o central.',
    related: ['binding', 'creep', 'spine_width']
  },
  perfect_bind: {
    term: 'Lombada quadrada (Cola PUR / Hotmelt · Cadernos alceados)',
    category: 'Editorial e Encadernação',
    shortDefinition: 'Encadernação em que os cadernos são empilhados em sequência (alceados), a dobra da lombada é fresada e recebe aplicação de cola estrutural com capa envolvente.',
    practicalUse: 'Exige reserva de fresagem na calha central (milling) para que a fresa remova a dobra e ancoragem da cola penetre nas fibras.',
    example: 'Recomenda-se lombada mínima de ~2,5 a 3 mm e fresagem de 2 a 3 mm na medianiz central.',
    related: ['binding', 'milling', 'spine_width', 'collation_marks']
  },
  spiral_wireo: {
    term: 'Espiral e Wire-O (Furação mecânica em folhas soltas)',
    category: 'Editorial e Encadernação',
    shortDefinition: 'Encadernação mecânica onde as folhas são refiladas nos 4 lados e perfuradas na margem interna para passagem de espiral ou garra metálica dupla (Wire-O).',
    practicalUse: 'Exige margem interna de encadernação generosa (mínimo 10 a 15 mm) para que os furos não atinjam textos ou imagens.',
    example: 'Combinado com o padrão "Folhas soltas 2-up (LOOSE-2)" para imprimir duas páginas lado a lado com corte central.',
    related: ['binding', 'binding_margin', 'drill']
  },
  spine_gutter: {
    term: 'Medianiz / Calha central (Spine gutter)',
    category: 'Editorial e Encadernação',
    shortDefinition: 'Espaço técnico aberto entre os pares de páginas esquerda e direita na região da dobra ou corte da lombada.',
    practicalUse: 'Acomoda sangria interna ou reserva para encadernações em folhas soltas, espiral e lombada fresada.',
    example: 'Em canoa costuma ser 0 mm (páginas unidas pela dobra); em espiral/wire-o de 6 a 12 mm.',
    related: ['milling', 'binding_margin', 'face_gutter']
  },
  binding_margin: {
    term: 'Margem interna de segurança de encadernação',
    category: 'Editorial e Encadernação',
    shortDefinition: 'Zona segura dentro da página, junto à lombada, onde não devem ficar textos importantes devido à sombra da cola ou aos furos do espiral/wire-o.',
    practicalUse: 'Exibida no diagrama editorial como uma faixa de segurança âmbar junto à lombada de cada página.',
    example: 'Use 8 a 12 mm em lombada quadrada (cola perde abertura) e 10 a 15 mm em espiral ou wire-o.',
    related: ['spiral_wireo', 'perfect_bind', 'spine_gutter']
  },
  head_trim: {
    term: 'Refilo de cabeça e calha de pé (Head / Foot trim)',
    category: 'Editorial e Encadernação',
    shortDefinition: 'Abertura entre fileiras de páginas em cadernos de 8 ou 16 páginas para permitir a abertura da cabeça na guilhotina trilateral.',
    practicalUse: 'Sem o refilo de cabeça em cadernos com dobra horizontal (F8-1 e F16-1), as páginas ficariam unidas pelo topo e não poderiam ser folheadas.',
    example: 'Tipicamente 4 a 8 mm de abertura entre as páginas cabeça-com-cabeça.',
    related: ['fold_pattern', 'face_gutter']
  },
  face_gutter: {
    term: 'Calha frontal / Corte de boca (Face gutter)',
    category: 'Editorial e Encadernação',
    shortDefinition: 'Espaçamento entre pares de páginas que formam a borda frontal (boca) em cadernos de 16 páginas (F16-1).',
    practicalUse: 'Garante sangria e margem de refilo quando a dobra intermediária do caderno de 16 páginas é aberta pela guilhotina.',
    example: 'Valor habitual entre 4 e 8 mm.',
    related: ['fold_pattern', 'head_trim']
  },
  milling: {
    term: 'Fresagem de lombada (Milling)',
    category: 'Editorial e Encadernação',
    shortDefinition: 'Desbaste mecânico de 1 a 3 mm na dobra traseira dos cadernos na encadernadora de lombada quadrada.',
    practicalUse: 'Remove a dobra fechada e cria micro-ranhuras nas folhas para penetração da cola PUR ou Hotmelt.',
    example: 'Informe 2 a 3 mm em Lombada Quadrada; em Canoa (grampo) mantenha 0 mm.',
    related: ['perfect_bind', 'spine_gutter']
  },
  creep: {
    term: 'Compensação de encavalamento (Creep / Shingling)',
    category: 'Editorial e Encadernação',
    shortDefinition: 'Recuo progressivo da mancha gráfica em direção à lombada nas folhas mais internas de um caderno dobrado.',
    practicalUse: 'Corrige o efeito físico em que as folhas internas "empurram" para fora na dobra e têm sua margem externa cortada mais estreita na guilhotina.',
    example: 'Pode ser calculado automaticamente pela espessura do papel (caliper) ou definido manualmente em mm.',
    related: ['caliper', 'saddle_stitch', 'spine_width']
  },
  spine_width: {
    term: 'Largura estimada da lombada (Spine width)',
    category: 'Editorial e Encadernação',
    shortDefinition: 'Espessura total do miolo fechado na região da lombada, calculada a partir do número de folhas, espessura do papel (caliper) e acréscimo de cola.',
    practicalUse: 'Essencial para diagramar a arte da capa em livros e catálogos de lombada quadrada.',
    example: '160 páginas (80 folhas) em papel de 0,11 mm com Lombada Quadrada (+0,6 mm de cola) resultam em ~9,4 mm de lombada.',
    related: ['caliper', 'gsm', 'perfect_bind']
  },
  process: {
    term: 'Processo produtivo de impressão',
    category: 'Chapa CTP, Cor e Impressão',
    shortDefinition: 'Tecnologia de impressão selecionada para a Ordem de Produção: Offset Plana, Digital Color, Preto & Branco Editorial, Laser ou Plotter.',
    practicalUse: 'Ajusta automaticamente o perfil de pinça, margens, uso de chapas CTP vs. cliques digitais, barra de cor e acerto de máquina.',
    example: 'Offset usa chapas CTP e pinça de 10 mm; Digital contabiliza cliques e usa margens de 4–5 mm.',
    related: ['ctp_plate', 'clicks', 'grip']
  },
  ctp_plate: {
    term: 'Chapa CTP (Computer-to-Plate)',
    category: 'Chapa CTP, Cor e Impressão',
    shortDefinition: 'Matriz de alumínio gravada a laser diretamente do arquivo digital (1 chapa por cor/separação em cada forma de impressão).',
    practicalUse: 'A folha de papel deve caber dentro da largura da chapa e respeitar a distância de pinça da chapa até a borda do papel.',
    example: 'Um impresso 4×4 (CMYK frente e verso) em Sheetwise usa 2 formas × 4 cores = 8 chapas CTP.',
    related: ['plate_grip', 'plate_punch', 'screen_lpi', 'spot_colors']
  },
  plate_grip: {
    term: 'Pinça da chapa ao início do papel (Plate-to-sheet grip)',
    category: 'Chapa CTP, Cor e Impressão',
    shortDefinition: 'Distância em milímetros entre a borda inferior da chapa CTP presa no cilindro e a borda dianteira da folha de papel.',
    practicalUse: 'Usada pelo setor de pré-impressão para posicionar a imposição na altura exata de registro da impressora offset.',
    example: 'Máquinas GTO 52 / SM 52 usam tipicamente 35 mm; Speedmaster 74 usa ~42 mm.',
    related: ['ctp_plate', 'grip', 'plate_punch']
  },
  plate_punch: {
    term: 'Furação de registro da chapa (Plate punch)',
    category: 'Chapa CTP, Cor e Impressão',
    shortDefinition: 'Sistema de furos de precisão na borda da chapa CTP (Bacher, Heidelberg, Komori) que encaixa nos pinos de registro da impressora.',
    practicalUse: 'Garante que todas as chapas (C, M, Y, K e Pantones) entrem já alinhadas na máquina, reduzindo o tempo e a perda de papel no acerto.',
    example: 'Bacher Control 2000 (220 / 425 mm) ou Heidelberg Autoplate.',
    related: ['ctp_plate', 'plate_grip', 'makeready']
  },
  screen_lpi: {
    term: 'Lineatura de retícula (LPI — Lines Per Inch)',
    category: 'Chapa CTP, Cor e Impressão',
    shortDefinition: 'Densidade de pontos de meio-tom por polegada linear gravada na chapa CTP.',
    practicalUse: 'Deve ser compatível com a lisura do papel: papéis revestidos (couchê) aceitam retículas altas; papéis porosos exigem lineaturas menores para evitar ganho de ponto excessivo.',
    example: '175 a 200 LPI para Couchê; 133 a 150 LPI para Offset/Pólen; 85 a 100 LPI para jornal.',
    related: ['ctp_plate', 'gsm']
  },
  colors_front: {
    term: 'Cores de impressão (Frente CMYK / Verso CMYK)',
    category: 'Chapa CTP, Cor e Impressão',
    shortDefinition: 'Quantidade de tintas de processo (Ciano, Magenta, Amarelo e Preto) aplicadas na frente e no verso da folha.',
    practicalUse: 'Determina diretamente o número de chapas CTP gravadas ou o tipo de clique (cor vs. P&B) na impressão digital.',
    example: '4×4 = colorido frente e verso; 4×1 = frente colorida e verso preto; 1×1 = miolo editorial preto e branco.',
    related: ['spot_colors', 'ctp_plate', 'clicks']
  },
  spot_colors: {
    term: 'Cores especiais (Pantone / Spot colors)',
    category: 'Chapa CTP, Cor e Impressão',
    shortDefinition: 'Tintas pré-misturadas (sistema Pantone ou metálicas/fluorescentes) impressas em unidade separada além da policromia CMYK.',
    practicalUse: 'Cada cor especial adiciona chapas extras por forma de impressão para garantir fidelidade absoluta de marca.',
    example: '4 cores CMYK + 1 Pantone Institucional = 5 chapas na frente.',
    related: ['colors_front', 'ctp_plate', 'spot_uv']
  },
  crop_marks: {
    term: 'Marcas de corte final (Crop marks)',
    category: 'Marcas Técnicas de Pré-Impressão',
    shortDefinition: 'Fios finos desenhados fora da peça que indicam ao operador de guilhotina exatamente onde realizar o refilo final.',
    practicalUse: 'Ficam recuados em relação à linha de corte (offset da marca) para nunca invadir a área de sangria ou aparecer na peça pronta.',
    example: 'Comprimento típico de 5 mm com recuo de 2 a 3,5 mm da linha de corte.',
    related: ['bleed_marks', 'mark_offset', 'trim_size']
  },
  bleed_marks: {
    term: 'Marcas de limite de sangria (Bleed marks)',
    category: 'Marcas Técnicas de Pré-Impressão',
    shortDefinition: 'Marcas tracejadas externas que delimitam até onde a sangria de cada peça se estende.',
    practicalUse: 'Ajudam a conferir visualmente na montagem se as sangrias de peças vizinhas se tocam ou se invadem a área de margem da folha.',
    example: 'Posicionadas exatamente a +3 mm (ou o valor da sangria) para fora da linha de corte.',
    related: ['bleed', 'crop_marks']
  },
  mark_offset: {
    term: 'Comprimento, recuo e espessura do fio da marca',
    category: 'Marcas Técnicas de Pré-Impressão',
    shortDefinition: 'Parâmetros geométricos dos fios de corte: tamanho do traço (mm), distância até o corte (mm) e espessura da linha (mm).',
    practicalUse: 'Se o recuo for menor que a sangria, a ponta da marca entra na área sangrada; por isso o sistema protege o recuo automaticamente.',
    example: 'Comprimento: 5 mm · Recuo: 2,5 mm · Espessura: 0,25 a 0,35 mm.',
    related: ['crop_marks', 'bleed']
  },
  reg_marks: {
    term: 'Alvos de registro (⊕ Registration marks)',
    category: 'Marcas Técnicas de Pré-Impressão',
    shortDefinition: 'Cruzes com círculos concêntricos gravadas em todas as separações de cor nas margens da folha.',
    practicalUse: 'Permitem ao impressor conferir com conta-fios se as chapas Ciano, Magenta, Amarelo, Preto e Pantone estão perfeitamente sobrepostas.',
    example: 'Quando todas as cores estão em registro, o alvo ⊕ parece uma única linha preta nítida.',
    related: ['center_cross', 'color_bar', 'side_guide']
  },
  center_cross: {
    term: 'Cruzes de centro nos 4 eixos (┼ Center marks)',
    category: 'Marcas Técnicas de Pré-Impressão',
    shortDefinition: 'Marcas posicionadas no centro exato das bordas superior, inferior, esquerda e direita da folha.',
    practicalUse: 'Servem de referência para centralizar a forma na chapa, alinhar frentes com versos e regular o esquadro da dobradeira.',
    example: 'Essenciais em imposições Work-and-turn e cadernos editoriais.',
    related: ['reg_marks', 'turn', 'signature']
  },
  color_bar: {
    term: 'Barra de controle densitométrica (Color bar)',
    category: 'Marcas Técnicas de Pré-Impressão',
    shortDefinition: 'Faixa de patches sólidos e reticulados de CMYK e escala de cinza impressa na margem da folha (geralmente na contrapinça).',
    practicalUse: 'Permite medir com densitômetro ou espectrofotômetro a carga de tinta, o equilíbrio de cinzas e o ganho de ponto ao longo da tiragem.',
    example: 'Exige reserva de 6 a 10 mm na folha para não colidir com a sangria das peças.',
    related: ['tail', 'printable_area', 'colors_front']
  },
  slug_strip: {
    term: 'Tira técnica de identificação (Slug info)',
    category: 'Marcas Técnicas de Pré-Impressão',
    shortDefinition: 'Linha de texto técnico gravada na margem externa da folha com dados de folha, peça, sangria, quantidade por folha e aproveitamento.',
    practicalUse: 'Identifica a folha impressa no chão de fábrica antes do refilo, evitando trocas de caderno ou confusão de medidas na guilhotina.',
    example: 'Imprime no rodapé fora da área de corte final.',
    related: ['crop_marks', 'collation_marks']
  },
  collation_marks: {
    term: 'Marca de alceamento progressiva (Collation mark)',
    category: 'Marcas Técnicas de Pré-Impressão',
    shortDefinition: 'Tarja preta impressa na dobra externa da lombada de cada caderno, cuja posição desce em escada do Caderno #1 até o último.',
    practicalUse: 'Permite bater o olho na pilha de livros alceados e identificar imediatamente se algum caderno foi esquecido, duplicado ou invertido.',
    example: 'No alceamento correto, as tarjas na lombada formam uma escadinha diagonal perfeita.',
    related: ['signature', 'perfect_bind']
  },
  lamination: {
    term: 'Laminação de superfície (BOPP Fosca, Brilho e Soft Touch)',
    category: 'Acabamentos, Enobrecimentos e Interferências',
    shortDefinition: 'Aplicação térmica de filme plástico fino (BOPP ou poliéster) sobre a folha impressa.',
    practicalUse: 'Protege contra atrito e umidade, aumenta a resistência ao rasgo nos vincos/dobras e confere acabamento fosco, brilhante ou aveludado (Soft Touch).',
    example: 'Obrigatória em capas e cartões com fundo chapado escuro que receberão dobra ou vinco.',
    related: ['spot_uv', 'crease', 'hot_stamping']
  },
  spot_uv: {
    term: 'Verniz (Base água, UV Total e UV Localizado)',
    category: 'Acabamentos, Enobrecimentos e Interferências',
    shortDefinition: 'Camada líquida transparente aplicada para proteção (base água), alto brilho geral (UV Total) ou destaque seletivo em áreas específicas (UV Localizado).',
    practicalUse: 'O Verniz UV Localizado exige 1 matriz/fotolito adicional de reserva (máscara) e registro rigoroso sobre laminação fosca ou soft touch.',
    example: 'Ao selecionar Verniz UV Localizado em Offset, o sistema contabiliza +1 matriz técnica no resumo.',
    related: ['lamination', 'spot_colors', 'ctp_plate']
  },
  die_cut: {
    term: 'Faca especial de corte e vinco (Die-cut)',
    category: 'Acabamentos, Enobrecimentos e Interferências',
    shortDefinition: 'Molde de madeira com lâminas de aço cortantes e vincantes usado em máquina corte-e-vinco plana ou cilíndrica.',
    practicalUse: 'Necessário para pastas com bolsa, embalagens, tags com contorno curvo e janelas. Exige espaçamento maior entre peças (6 a 10 mm) para fixação das borrachas.',
    example: 'O Preflight alerta caso o espaçamento X/Y esteja abaixo de 6 mm com Faca Especial ativa.',
    related: ['gap_xy', 'crease', 'bleed']
  },
  hot_stamping: {
    term: 'Hot stamping (Estampagem metálica a quente)',
    category: 'Acabamentos, Enobrecimentos e Interferências',
    shortDefinition: 'Transferência de fita metálica (ouro, prata, cobre, holográfico) para o papel por meio de clichê metálico aquecido e pressão.',
    practicalUse: 'Valoriza capas, convites, certificados e embalagens; não pode ser aplicado por baixo de laminação térmica comum.',
    example: 'Exige clichê gravado em latão ou magnésio e margem segura das bordas de corte.',
    related: ['emboss', 'lamination', 'spot_uv']
  },
  emboss: {
    term: 'Relevo seco / Alto e baixo-relevo (Embossing / Debossing)',
    category: 'Acabamentos, Enobrecimentos e Interferências',
    shortDefinition: 'Deformação física das fibras do papel ou cartão entre um clichê macho e uma contramatriz fêmea, sem uso de tinta.',
    practicalUse: 'Cria volume tátil em logotipos e títulos. Como deforma o papel, a área marcada também fica visível em baixo-relevo no verso da folha.',
    example: 'Funciona melhor em papéis e cartões acima de 180–240 g/m².',
    related: ['hot_stamping', 'gsm', 'die_cut']
  },
  perforation: {
    term: 'Serrilha / Picote destacável (Perforation)',
    category: 'Acabamentos, Enobrecimentos e Interferências',
    shortDefinition: 'Linha de microcortes tracejados que permite destacar facilmente um canhoto, cupom ou boleto com as mãos.',
    practicalUse: 'Posicione a serrilha com folga mínima de 5 mm das bordas e do box de numeração para não fragilizar a peça.',
    example: 'Ingresso 150 × 50 mm com serrilha de canhoto a 35 mm da borda esquerda.',
    related: ['numbering', 'padding', 'crease']
  },
  crease: {
    term: 'Vinco mecânico (Crease / Scoring)',
    category: 'Acabamentos, Enobrecimentos e Interferências',
    shortDefinition: 'Sulco prensado no papel ou cartão para criar uma dobradiça limpa sem quebrar as fibras superficiais nem rachar a camada de tinta.',
    practicalUse: 'Indispensável quando o papel tem gramatura igual ou superior a 170 g/m² e precisa ser dobrado.',
    example: 'O Preflight emite aviso automático se um material editorial acima de 170 g/m² não tiver vinco mecânico ativo.',
    related: ['gsm', 'grain', 'die_cut']
  },
  drill: {
    term: 'Furação mecânica (Drilling / Punching)',
    category: 'Acabamentos, Enobrecimentos e Interferências',
    shortDefinition: 'Perfuração circular ou retangular com broca oca ou punção para arquivo, tags, calendários, espiral ou wire-o.',
    practicalUse: 'Exige recuo mínimo da borda para que o furo não rasgue o papel durante o manuseio.',
    example: 'Furos de arquivo padrão a 10–12 mm da margem esquerda.',
    related: ['spiral_wireo', 'binding_margin']
  },
  numbering: {
    term: 'Numeração sequencial mecânica ou digital',
    category: 'Acabamentos, Enobrecimentos e Interferências',
    shortDefinition: 'Impressão de números progressivos (Nº 0001, 0002...) em talões, ingressos, rifas, cautelas e formulários de controle.',
    practicalUse: 'Demarcada visualmente na folha para evitar que textos, furos ou a linha de serrilha invadam a área do numerador.',
    example: 'Caixa de numeração reservada a pelo menos 5 mm da linha de corte e da serrilha.',
    related: ['perforation', 'padding']
  },
  padding: {
    term: 'Blocagem (Colagem de topo ou lateral em blocos)',
    category: 'Acabamentos, Enobrecimentos e Interferências',
    shortDefinition: 'União de pilhas de folhas refiladas por aplicação de cola flexível em uma das bordas (geralmente topo ou esquerda), com cartão de fundo.',
    practicalUse: 'Permite destacar folhas avulsas uma a uma em receituários, blocos de anotações, comandas e talões.',
    example: 'Indicada no diagrama por uma tarja vermelha na borda de colagem de cada peça.',
    related: ['numbering', 'perforation', 'spiral_wireo']
  },
  hem: {
    term: 'Bainha de reforço perimetral (Hem)',
    category: 'Comunicação Visual e Grandes Formatos',
    shortDefinition: 'Dobra da própria lona sobre si mesma nas 4 bordas externas, soldada a quente ou colada para duplicar a espessura do material.',
    practicalUse: 'Aumenta drasticamente a resistência mecânica à tração do vento onde os ilhós serão aplicados. Soma-se ao tamanho de corte bruto da lona.',
    example: 'Um banner visível de 800 × 1200 mm com bainha de 30 mm precisa ser cortado com 860 × 1260 mm.',
    related: ['grommets', 'weld', 'safe_margin']
  },
  weld: {
    term: 'Divisão em panos e Sobreposição de solda (Weld overlap)',
    category: 'Comunicação Visual e Grandes Formatos',
    shortDefinition: 'Quando a largura do painel ultrapassa a boca útil da bobina da plotter, a peça é dividida em panos verticais unidos por solda térmica ou alta frequência.',
    practicalUse: 'O sistema calcula automaticamente quantos panos são necessários e adiciona a faixa de sobreposição de solda entre eles.',
    example: 'Emendas seguras de lona exigem de 20 a 40 mm de sobreposição de solda.',
    related: ['roll_width', 'hem']
  },
  pole_pocket: {
    term: 'Bolsa para bastão / tubete (Pole pocket)',
    category: 'Comunicação Visual e Grandes Formatos',
    shortDefinition: 'Dobra maior no topo e/ou na base do banner formando um túnel para passagem de bastão de madeira, alumínio ou tubo de ferro.',
    practicalUse: 'Adiciona altura de corte bruto acima e abaixo da área visível do banner.',
    example: 'Bolsa de 50 a 80 mm para bastão de banner tradicional ou tubete de fachada.',
    related: ['hem', 'grommets']
  },
  grommets: {
    term: 'Ilhós metálicos (Espaçamento e Recuo de centro)',
    category: 'Comunicação Visual e Grandes Formatos',
    shortDefinition: 'Anéis metálicos prensados ao longo do perímetro da lona (sobre a bainha) para passagem de abraçadeiras, cordas ou cabos de aço.',
    practicalUse: 'O sistema calcula a distribuição perimetral uniforme e soma o total de ilhós por peça e na tiragem.',
    example: 'Espaçamento de 200 a 300 mm com centro do ilhós a 15 mm da borda externa.',
    related: ['hem', 'safe_margin']
  },
  safe_margin: {
    term: 'Margem interna de segurança estrutural',
    category: 'Comunicação Visual e Grandes Formatos',
    shortDefinition: 'Recuo interno dentro do formato visível do banner/lona onde textos, telefones e logotipos não devem entrar.',
    practicalUse: 'Impede que os ilhós perfurem informações importantes ou que a costura da bainha esconda letras nas bordas.',
    example: 'Mantenha textos a pelo menos 35–50 mm da borda visível quando houver ilhós.',
    related: ['grommets', 'hem']
  },
  roll_width: {
    term: 'Largura de mídia / bobina da plotter',
    category: 'Comunicação Visual e Grandes Formatos',
    shortDefinition: 'Largura total do rolo de lona, vinil adesivo, tecido ou chapa rígida alimentado no equipamento de grande formato.',
    practicalUse: 'Determina se a peça sairá inteira em 1 único pano ou se precisará ser fatiada em múltiplos panos com solda.',
    example: 'Bobinas padrão de mercado: 1,00 m, 1,22 m, 1,52 m, 2,50 m e 3,20 m.',
    related: ['weld', 'hem']
  },
  qty_waste: {
    term: 'Tiragem, Acerto (Makeready) e Perdas variáveis',
    category: 'Produção, Tiragem e Validação',
    shortDefinition: 'Parâmetros que convertem a quantidade líquida desejada pelo cliente na quantidade bruta de folhas que devem entrar em máquina.',
    practicalUse: 'Inclui as folhas de acerto de cor/registro por forma (makeready) mais a porcentagem de perda variável de tiragem e acabamento.',
    example: '1.000 folhas líquidas + 3% de perda (30 fls) + 100 folhas de acerto = 1.130 folhas brutas.',
    related: ['usage', 'ctp_plate', 'ream_mass']
  },
  makeready: {
    term: 'Folhas de acerto por forma (Makeready / Setup)',
    category: 'Produção, Tiragem e Validação',
    shortDefinition: 'Folhas consumidas no início de cada entrada de máquina para entintar a impressora, casar o registro das chapas e ajustar a dobradeira.',
    practicalUse: 'Multiplicadas pelo número de formas do trabalho para evitar falta de exemplares na entrega final.',
    example: 'Em Offset 4 cores costuma-se reservar de 50 a 150 folhas por forma; em Digital de 2 a 10 folhas.',
    related: ['qty_waste', 'ctp_plate']
  },
  usage: {
    term: 'Aproveitamento da folha (%) e Indicadores de produção',
    category: 'Produção, Tiragem e Validação',
    shortDefinition: 'Relação percentual entre a soma das áreas finais das peças impostas e a área total da folha de entrada.',
    practicalUse: 'Indica a eficiência geométrica do corte: quanto maior o aproveitamento, menor o volume de aparas refiladas no lixo.',
    example: 'Aproveitamentos acima de 70–75% são excelentes; abaixo de 50% sugerem testar outro formato de folha ou corte misto.',
    related: ['orientation', 'dutch_cut', 'sheet_format']
  },
  clicks: {
    term: 'Cliques digitais e Passagens na máquina',
    category: 'Produção, Tiragem e Validação',
    shortDefinition: 'Em impressão Digital e Laser, cada face impressa é tarifada como 1 clique (1 folha duplex frente e verso = 2 cliques).',
    practicalUse: 'Permite orçar com exatidão contratos de locação/produção digital e estimar o tempo de máquina.',
    example: '500 folhas em Duplex (Frente e Verso) = 1.000 cliques digitais.',
    related: ['process', 'simplex', 'sheetwise']
  },
  ream_mass: {
    term: 'Massa total (kg) e Peso da resma (500 folhas)',
    category: 'Produção, Tiragem e Validação',
    shortDefinition: 'Cálculo físico do peso do papel baseado na área da folha (m²), gramatura (g/m²) e quantidade total de folhas.',
    practicalUse: 'Essencial para logística de transporte, compra de papel em quilos e conferência de estoque.',
    example: 'Fórmula: Largura (m) × Altura (m) × Gramatura (g/m²) ÷ 1000 × Total de folhas.',
    related: ['gsm', 'sheet_format']
  },
  preflight: {
    term: 'Preflight geométrico e de acabamento',
    category: 'Produção, Tiragem e Validação',
    shortDefinition: 'Inspeção automática em tempo real que verifica colisões entre peças, invasão de pinça/margens, limites de chapa CTP, múltiplos de páginas e regras de acabamento.',
    practicalUse: 'Separa claramente Erros bloqueantes (● vermelhos, que impedem produzir ou exportar) de Avisos preventivos (△ âmbar, boas práticas de oficina). Não substitui a revisão de fontes/imagens dentro do PDF da arte.',
    example: 'Clique em "Localizar na folha" em qualquer alerta para destacar a região exata no diagrama.',
    related: ['grip', 'bleed', 'printable_area']
  }
};

function applyStageZoom() {
  const stageEl = $('stage');
  if (!stageEl) return;
  const canvas = stageEl.querySelector('.stage-canvas');
  if (canvas) {
    canvas.style.transform = `translate(${stagePanX.toFixed(1)}px, ${stagePanY.toFixed(1)}px) scale(${stageZoom.toFixed(3)})`;
  }
  const pct = Math.round(stageZoom * 100);
  if ($('zoomReset')) $('zoomReset').textContent = `${pct}%`;
  if ($('zoomRange')) $('zoomRange').value = String(pct);
}

function setStageZoom(nextZoom, focalX = null, focalY = null) {
  const clamped = Math.min(5, Math.max(0.5, Number(nextZoom.toFixed(2))));
  const stageEl = $('stage');
  if (focalX !== null && focalY !== null && stageEl) {
    const rect = stageEl.getBoundingClientRect();
    const cx = focalX - (rect.left + rect.width / 2);
    const cy = focalY - (rect.top + rect.height / 2);
    const ratio = clamped / stageZoom;
    stagePanX = cx - (cx - stagePanX) * ratio;
    stagePanY = cy - (cy - stagePanY) * ratio;
  }
  stageZoom = clamped;
  if (Math.abs(stageZoom - 1) < 0.01 && focalX === null) {
    stagePanX = 0;
    stagePanY = 0;
  }
  applyStageZoom();
}

const SKU_PALETTE = {
  A: { front: '#dce8cf', back: '#d4e3ec', stroke: '#6c8a62' },
  B: { front: '#f2e2c4', back: '#e8d8bd', stroke: '#9c7a44' },
  C: { front: '#dfdaf0', back: '#d5d0e8', stroke: '#6f6594' },
  D: { front: '#f0d8d8', back: '#e6cece', stroke: '#965d5d' }
};

try {
  const saved = JSON.parse(localStorage.getItem('folha-v5') || localStorage.getItem('folha-v4'));
  if (saved) state = { ...F.clone(F.defaults), ...saved, version: 4 };
} catch {}

const urlParams = new URLSearchParams(location.search);
const nobelId = urlParams.get('nobel');
const nobelPreset = F.PAPER_PRESETS.find(p => p.id === nobelId && ['nobel-t4', 'nobel-t8', 'nobel-t9'].includes(p.id));
if (nobelPreset) {
  state.sw = nobelPreset.sw;
  state.sh = nobelPreset.sh;
  state.plateW = Math.max(state.plateW, state.sw + 60);
  state.plateH = Math.max(state.plateH, state.sh + state.plateGrip + 40);
  state.edits = {};
  state.extras = [];
}
const osParam = urlParams.get('os');
const titleParam = urlParams.get('title');
const qtyParam = Number(urlParams.get('qty'));
if (Number.isFinite(qtyParam) && qtyParam >= 1) {
  state.qty = Math.round(qtyParam);
}
if (nobelPreset && !urlParams.get('modulo') && !osParam) {
  window.history.replaceState(null, '', location.pathname);
}

const CUSTOM_PRESETS_KEY = 'folha-custom-presets-v1';
const COMPARE_COLORS = [
  { fill: '#2a624a22', stroke: '#2a624a', solid: '#2a624a' },
  { fill: '#2b6cb022', stroke: '#2b6cb0', solid: '#2b6cb0' },
  { fill: '#b76e1e22', stroke: '#b76e1e', solid: '#b76e1e' },
  { fill: '#7c4d9b22', stroke: '#7c4d9b', solid: '#7c4d9b' },
  { fill: '#b4231822', stroke: '#b42318', solid: '#b42318' },
  { fill: '#0e749022', stroke: '#0e7490', solid: '#0e7490' },
  { fill: '#6d4c4122', stroke: '#6d4c41', solid: '#6d4c41' },
  { fill: '#4338ca22', stroke: '#4338ca', solid: '#4338ca' }
];
const COMPARE_EXTRA_DEFAULTS = [
  { name: 'A4', w: 210, h: 297 },
  { name: 'A5', w: 148, h: 210 },
  { name: 'Nobel T9', w: 220, h: 380 },
  { name: 'Nobel T8', w: 238, h: 328 },
  { name: 'Nobel T4', w: 328, h: 478 },
  { name: 'A3', w: 297, h: 420 },
  { name: 'SRA3', w: 320, h: 450 },
  { name: 'Folha Inteira', w: 660, h: 960 }
];

let applyingRemoteCloudState = false;
let workspaceSyncTimer = null;

function sanitizeCustomPresetsObj(parsed) {
  const cleanList = (arr, wKey, hKey) =>
    (Array.isArray(arr) ? arr : [])
      .filter(item => item && Number.isFinite(Number(item[wKey])) && Number.isFinite(Number(item[hKey])) && Number(item[wKey]) > 0 && Number(item[hKey]) > 0)
      .slice(0, 60)
      .map((item, idx) => ({
        id: String(item.id || `custom-${idx}`).slice(0, 80),
        name: String(item.name || `${item[wKey]}×${item[hKey]}`).trim().slice(0, 60) || `${item[wKey]}×${item[hKey]}`,
        [wKey]: Number(item[wKey]),
        [hKey]: Number(item[hKey]),
        custom: true
      }));
  return {
    papers: cleanList(parsed?.papers, 'sw', 'sh'),
    pieces: cleanList(parsed?.pieces, 'pw', 'ph')
  };
}

function readCustomPresets() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_PRESETS_KEY) || '{}');
    return sanitizeCustomPresetsObj(parsed);
  } catch {
    return { papers: [], pieces: [] };
  }
}

function saveCustomPresets(next, { syncCloud = true } = {}) {
  const clean = sanitizeCustomPresetsObj(next);
  try {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(clean));
  } catch {}
  if (syncCloud && !applyingRemoteCloudState && typeof cloudHooks?.onSaveCustomPresets === 'function') {
    Promise.resolve(cloudHooks.onSaveCustomPresets(clean)).catch(() => {});
  }
  return clean;
}

function scheduleWorkspaceCloudSync() {
  if (applyingRemoteCloudState || typeof cloudHooks?.onSaveWorkspace !== 'function') return;
  clearTimeout(workspaceSyncTimer);
  workspaceSyncTimer = setTimeout(() => {
    if (applyingRemoteCloudState || typeof cloudHooks?.onSaveWorkspace !== 'function') return;
    Promise.resolve(cloudHooks.onSaveWorkspace(F.clone(state))).catch(() => {});
  }, 1100);
}

function getAllPaperPresets() {
  const custom = readCustomPresets().papers.map(p => ({
    ...p,
    label: `★ ${p.name} · ${p.sw} × ${p.sh} mm`
  }));
  return [...F.PAPER_PRESETS, ...custom];
}

function getAllPiecePresetGroups() {
  const customPieces = readCustomPresets().pieces.map(p => ({
    ...p,
    label: `★ ${p.name} · ${p.pw} × ${p.ph} mm`
  }));
  const base = F.PIECE_PRESET_GROUPS || [];
  if (!customPieces.length) return base;
  return [{ group: '★ Meus tamanhos cadastrados', items: customPieces }, ...base];
}

function getCompareCatalogGroups() {
  const custom = readCustomPresets();
  const customEntries = [
    ...custom.papers.map(p => ({ id: p.id, name: p.name, label: `★ ${p.name} · ${p.sw} × ${p.sh} mm`, w: p.sw, h: p.sh })),
    ...custom.pieces.map(p => ({ id: p.id, name: p.name, label: `★ ${p.name} · ${p.pw} × ${p.ph} mm`, w: p.pw, h: p.ph }))
  ];
  const groups = [];
  if (customEntries.length) {
    groups.push({ group: '★ Meus tamanhos cadastrados', items: customEntries });
  }
  groups.push({
    group: 'Folhas de máquina (Nobel T9/T8/T4, SRA3, A4+, BB)',
    items: F.PAPER_PRESETS.map(p => ({
      id: p.id,
      name: p.label.split(' · ')[0],
      label: p.label,
      w: p.sw,
      h: p.sh
    }))
  });
  for (const g of F.PIECE_PRESET_GROUPS || []) {
    groups.push({
      group: g.group,
      items: g.items.map(it => ({
        id: it.id,
        name: it.label.split(' · ')[0],
        label: it.label,
        w: it.pw,
        h: it.ph
      }))
    });
  }
  return groups;
}

function getCompareList(s = state) {
  const list = Array.isArray(s.compareSheets) && s.compareSheets.length
    ? s.compareSheets
    : COMPARE_EXTRA_DEFAULTS.slice(0, 2);
  return list.slice(0, 8).map((item, idx) => ({
    id: item?.id || `cmp-${idx + 1}`,
    name: String(item?.name || `Formato ${idx + 1}`),
    w: Number(item?.w) > 0 ? Number(item.w) : 210,
    h: Number(item?.h) > 0 ? Number(item.h) : 297
  }));
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderPaperAnalysisHtml(result, state, fmt) {
  const pa = result?.paperAnalysis;
  if (!pa || !pa.job || !pa.sheet) return '';
  const { sheet, job, alternatives = [] } = pa;
  const fmtPct = n => `${Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  const fmtDec = (n, d = 2) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

  const segments = [
    { key: 'delivered', label: 'Papel útil entregue', color: 'seg-delivered', item: job.breakdown.delivered },
    { key: 'impositionScrap', label: 'Aparas, sangrias & reservas', color: 'seg-scrap', item: job.breakdown.impositionScrap },
    { key: 'remainder', label: 'Sobra última folha / págs. brancas', color: 'seg-remainder', item: job.breakdown.remainder },
    { key: 'makeready', label: 'Acerto de máquina', color: 'seg-makeready', item: job.breakdown.makeready },
    { key: 'variableWaste', label: `Quebra variável (${state.waste}%)`, color: 'seg-waste', item: job.breakdown.variableWaste }
  ];

  const barHtml = segments
    .filter(seg => seg.item.pct > 0)
    .map(seg => `<div class="paper-loss-seg ${seg.color}" style="width:${Math.max(0.5, seg.item.pct)}%" title="${escapeHTML(seg.label)}: ${fmtPct(seg.item.pct)} (${fmtDec(seg.item.massKg, 2)} kg)"></div>`)
    .join('');

  const legendHtml = segments
    .map(seg => `
      <div class="paper-loss-leg-item">
        <span class="paper-loss-dot ${seg.color}" aria-hidden="true"></span>
        <div>
          <strong>${escapeHTML(seg.label)}</strong>
          <small>${fmtPct(seg.item.pct)} · ${fmtDec(seg.item.m2, 2)} m² · ${fmtDec(seg.item.massKg, 2)} kg (${fmt(seg.item.sheetsEq)} fls eq.)</small>
        </div>
      </div>
    `)
    .join('');

  const altRowsHtml = alternatives.length
    ? `
      <div class="paper-loss-alt">
        <h5>Comparativo de aproveitamento e perdas por orientação (mesma tiragem de ${fmt(state.qty)} un.)</h5>
        <div class="paper-loss-table-wrap">
          <table class="paper-loss-table">
            <thead>
              <tr>
                <th>Estratégia</th>
                <th>Peças / fl</th>
                <th>Folhas totais</th>
                <th>Sobra últ. fl</th>
                <th>Aprov. real</th>
                <th>Perda total</th>
                <th>Comparação</th>
              </tr>
            </thead>
            <tbody>
              ${alternatives.map(alt => {
                if (!alt.fits) {
                  return `<tr class="is-disabled"><td>${escapeHTML(alt.title)}</td><td>0</td><td colspan="5">${alt.disabled ? 'Desativado no painel' : 'Não comporta na folha'}</td></tr>`;
                }
                const diffBadge = alt.isCurrent
                  ? '<span class="paper-alt-pill is-current">Em uso</span>'
                  : alt.savedSheetsVsCurrent > 0
                    ? `<span class="paper-alt-pill is-saving">Economiza ${fmt(alt.savedSheetsVsCurrent)} fls (${fmtDec(alt.savedMassKgVsCurrent, 2)} kg)</span>`
                    : alt.savedSheetsVsCurrent < 0
                      ? `<span class="paper-alt-pill is-extra">+${fmt(Math.abs(alt.savedSheetsVsCurrent))} fls</span>`
                      : '<span class="paper-alt-pill">Mesmo consumo</span>';
                return `
                  <tr class="${alt.isCurrent ? 'is-current-row' : ''}">
                    <td><b>${escapeHTML(alt.title)}</b></td>
                    <td>${fmt(alt.count)}</td>
                    <td>${fmt(alt.totalSheets)} fls <small>(${fmtDec(alt.massKg, 2)} kg)</small></td>
                    <td>${fmt(alt.extra)}</td>
                    <td><b>${fmtPct(alt.effectiveUsagePct)}</b></td>
                    <td class="paper-loss-val">${fmtPct(alt.totalLossPct)}</td>
                    <td>${diffBadge}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `
    : '';

  const activeSheetW = state.mode === 'suggest' && result.activeSuggestion ? result.activeSuggestion.sw : state.sw;
  const activeSheetH = state.mode === 'suggest' && result.activeSuggestion ? result.activeSuggestion.sh : state.sh;
  return `
    <section class="paper-loss-panel" aria-label="Análise completa de aproveitamento do papel e perdas">
      <div class="paper-loss-head">
        <div>
          <h4>Aproveitamento Total do Papel &amp; Mapa de Perdas</h4>
          <p class="muted-small">Folha ${activeSheetW}×${activeSheetH} mm (${fmt(sheet.areaCm2)} cm²) · Tiragem bruta de ${fmt(job.totalSheets)} folhas (${fmtDec(job.grossAreaM2, 2)} m² · ${fmtDec(job.grossMassKg, 2)} kg)</p>
        </div>
        <div class="paper-loss-badges">
          <span class="paper-kpi-pill is-good">Aproveitamento real: <b>${fmtPct(job.effectiveUsagePct)}</b></span>
          <span class="paper-kpi-pill is-bad">Perda total: <b>${fmtPct(job.totalLossPct)}</b> (${fmtDec(job.totalLoss.massKg, 2)} kg · ${fmtDec(job.totalLoss.m2, 2)} m²)</span>
        </div>
      </div>

      <div class="paper-loss-bar" role="img" aria-label="Proporção de aproveitamento real e perdas do trabalho">${barHtml}</div>
      <div class="paper-loss-legend">${legendHtml}</div>

      <div class="paper-loss-grid">
        <div class="paper-loss-card">
          <h5>Decomposição por Folha (Geometria da Imposição)</h5>
          <ul>
            <li><span>Peças úteis na folha</span><b>${fmtPct(sheet.useful.pct)} · ${fmt(sheet.useful.cm2)} cm²</b></li>
            <li><span>Reservas de máquina (pinça / margens / barra)</span><b>${fmtPct(sheet.margin.pct)} · ${fmt(sheet.margin.cm2)} cm²</b></li>
            <li><span>Sangrias, medianiz e refilo do bloco</span><b>${fmtPct(sheet.bleedGap.pct)} · ${fmt(sheet.bleedGap.cm2)} cm²</b></li>
            <li><span>Apara externa restante da folha</span><b>${fmtPct(sheet.outerScrap.pct)} · ${fmt(sheet.outerScrap.cm2)} cm²</b></li>
            <li class="is-total"><span>Total de apara/perda geométrica por folha</span><b>${fmtPct(sheet.totalLoss.pct)} · ${fmt(sheet.totalLoss.cm2)} cm²</b></li>
          </ul>
        </div>

        <div class="paper-loss-card">
          <h5>Perdas Acumuladas na Tiragem (${fmt(job.totalSheets)} folhas)</h5>
          <ul>
            <li><span>Papel líquido entregue (${state.mode === 'book' ? fmt(state.qty) + ' ex. / ' + fmt(state.pages) + ' págs' : fmt(state.qty) + ' un.'})</span><b>${fmtPct(job.breakdown.delivered.pct)} · ${fmtDec(job.breakdown.delivered.massKg, 2)} kg</b></li>
            <li><span>Aparas e margens nas ${fmt(job.netSheets)} fls líquidas</span><b>${fmtPct(job.breakdown.impositionScrap.pct)} · ${fmtDec(job.breakdown.impositionScrap.massKg, 2)} kg</b></li>
            <li><span>Excedente (${escapeHTML(job.remainderNote)})</span><b>${fmtPct(job.breakdown.remainder.pct)} · ${fmtDec(job.breakdown.remainder.massKg, 2)} kg</b></li>
            <li><span>Acerto de máquina (${fmt(job.makereadySheets)} fls) + quebra ${state.waste}% (${fmt(job.variableLossSheets)} fls)</span><b>${fmtPct(job.breakdown.makeready.pct + job.breakdown.variableWaste.pct)} · ${fmtDec(job.breakdown.makeready.massKg + job.breakdown.variableWaste.massKg, 2)} kg</b></li>
            <li class="is-total"><span>Total desperdiçado / perdido</span><b>${fmt(job.totalLoss.sheetsEq)} fls eq. · ${fmtDec(job.totalLoss.m2, 2)} m² · ${fmtDec(job.totalLoss.massKg, 2)} kg</b></li>
          </ul>
        </div>
      </div>

      ${altRowsHtml}
    </section>
  `;
}

function infoBtn(termId, label = '') {
  if (!termId || !GLOSSARY[termId]) return '';
  const aria = label ? `Explicação técnica sobre ${label}` : `Explicação técnica sobre ${GLOSSARY[termId].term}`;
  return `<button type="button" class="info-btn" data-term="${termId}" aria-label="${escapeHTML(aria)}" title="Ver explicação técnica">ⓘ</button>`;
}

const numeric = (id, title, min = 0, step = 'any', unit = '', termId = '') => {
  const parts = String(title).split(' · ');
  const mainTitle = parts[0];
  const resolvedUnit = unit || parts[1] || '';
  return `<label for="${id}">
    <span class="label-head">
      <span class="label-text">${mainTitle}${resolvedUnit ? ` <em class="unit-tag">${resolvedUnit}</em>` : ''}</span>
      ${infoBtn(termId, mainTitle)}
    </span>
    <input data-key="${id}" id="${id}" type="number" min="${min}" step="${step}" value="${state[id]}">
  </label>`;
};

const select = (id, title, options, termId = '') =>
  `<label class="full" for="${id}">
    <span class="label-head">
      <span class="label-text">${title}</span>
      ${infoBtn(termId, title)}
    </span>
    <select data-key="${id}" id="${id}">${options
      .map(([v, l]) => `<option value="${v}" ${String(state[id]) === String(v) ? 'selected' : ''}>${l}</option>`)
      .join('')}</select>
  </label>`;

const checkField = (id, labelHtml, termId = '') => {
  const plain = String(labelHtml).replace(/<[^>]+>/g, '');
  return `<label class="full check-row" for="${id}">
    <span class="check-label-left">
      <input data-key="${id}" id="${id}" type="checkbox" ${state[id] ? 'checked' : ''}>
      <span>${labelHtml}</span>
    </span>
    ${infoBtn(termId, plain)}
  </label>`;
};

function cfgGroup(groupId, title, badgeText, bodyHtml, termId = '') {
  const isOpen = openGroups.has(groupId);
  return `<details class="cfg-group" data-group="${groupId}" ${isOpen ? 'open' : ''}>
    <summary>
      <span class="cfg-title">${title}</span>
      <span class="cfg-badge" data-group-badge="${groupId}">${escapeHTML(badgeText)}</span>
    </summary>
    <div class="cfg-body">
      ${termId ? `<div class="full" style="display:flex;justify-content:flex-end;margin-bottom:-4px">${infoBtn(termId, title)}</div>` : ''}
      ${bodyHtml}
    </div>
  </details>`;
}

function getGroupBadges(s = state, res = result) {
  const usesPlates = s.mode !== 'visual' && s.mode !== 'free' && (F.PROCESS_PROFILES[s.process] || F.PROCESS_PROFILES.offset).usesPlates;
  const finishCount = (res && res.finishTags ? res.finishTags.length : 0);
  const finishSummary = finishCount === 0 ? 'Nenhum ativo' : finishCount === 1 ? res.finishTags[0] : `${finishCount} ativos`;
  const activeMarks = [
    s.marks && 'Corte',
    s.bleedMarks && 'Sangria',
    s.regMarks && 'Registro',
    s.centerCrossMarks && 'Centro',
    s.colorBar && 'Barra',
    s.sheetInfoStrip && 'Slug',
    s.mode === 'book' && s.collationMarks && 'Alceamento'
  ].filter(Boolean);
  const marksSummary = s.showCutMarks === false
    ? (activeMarks.length ? `Ocultas (${activeMarks.length} salvas)` : 'Ocultas')
    : activeMarks.length
      ? `${activeMarks.length} marcas (${activeMarks.slice(0, 2).join('+')})`
      : 'Sem marcas';
  const procShort = { offset: 'Offset', digital: 'Digital', pb: 'P&B', laser: 'Laser', plotter: 'Plotter' }[s.process] || s.process;
  const fc = res?.freeComparison;
  const cmp = res?.compareInfo;

  return {
    'flat-process': `${procShort} · ${s.sw}×${s.sh} mm`,
    'flat-piece': `${s.pw}×${s.ph} mm · ${res ? res.count : 0}/fl`,
    'flat-margins': `Pinça ${s.grip} mm · Esq. ${s.sideGuide === 'left' ? '◀' : '▶'}`,
    'flat-finish': finishSummary,
    'flat-ctp': usesPlates ? `${s.plateW}×${s.plateH} · ${s.screenLpi} LPI` : 'N/A',
    'flat-colors': `${s.colorsFront}×${s.style === 'single' ? 0 : s.colorsBack} · ${s.gsm} g/m²`,
    'flat-marks': marksSummary,
    'book-process': `${procShort} · ${s.sw}×${s.sh} mm`,
    'book-editorial': `${s.pages}p · ${s.foldPattern} · ${s.pw}×${s.ph}`,
    'book-gutters': `Lomb. ${res ? res.spineWidth : 0} mm · Calha ${s.spineGutter}`,
    'book-margins': `Pinça ${s.grip} mm · Fibra ${s.grain === 'none' ? 'Livre' : s.grain.toUpperCase()}`,
    'book-finish': finishSummary,
    'book-ctp': usesPlates ? `${s.plateW}×${s.plateH} · ${s.screenLpi} LPI` : 'N/A',
    'book-colors': `${s.gsm} g/m² · ${s.caliper} mm`,
    'book-marks': marksSummary,
    'visual-piece': `${s.pw}×${s.ph} mm · ${s.qty} un.`,
    'visual-structure': `Bainha ${s.hem} · Ilhós ${s.grommetSpacing || 'Sem'}`,
    'visual-roll': `Bobina ${s.sw} mm`,
    'free-sheet': `${s.sw} × ${s.sh} mm`,
    'free-piece': `${s.pw} × ${s.ph} mm · Sangria ${s.bleed}`,
    'free-strategy': fc ? `★ ${fc.winnerCount} pçs/fl (${fc[fc.winnerKey]?.usage || 0}%)` : 'Auto',
    'free-marks': marksSummary,
    'compare-controls': `${s.compareLayout === 'overlay' ? 'Sobrepostos' : 'Lado a lado'} · ${cmp ? cmp.count : getCompareList(s).length} tamanhos`,
    'compare-items': `${cmp ? cmp.count : getCompareList(s).length} selecionado(s)`,
    'suggest-piece': `${s.pw}×${s.ph} mm · Sangria ${s.bleed}`,
    'suggest-options': `${res?.suggestInfo?.suggestions?.length || 0} folhas sugeridas`
  };
}

function updateGroupBadgesDom() {
  const badges = getGroupBadges(state, result);
  document.querySelectorAll('[data-group-badge]').forEach(el => {
    const key = el.dataset.groupBadge;
    if (badges[key] !== undefined) el.textContent = badges[key];
  });
}

function applyProcessProfile(s, procCode) {
  s.process = procCode;
  const prof = F.PROCESS_PROFILES[procCode] || F.PROCESS_PROFILES.offset;
  s.grip = prof.defaultGrip;
  s.tail = prof.defaultTail;
  s.left = prof.defaultSideMargin;
  s.right = prof.defaultSideMargin;
  s.bar = prof.defaultBar;
  s.setup = prof.defaultSetup;
  s.waste = prof.defaultWaste;

  if (procCode === 'offset') {
    s.colorsFront = 4;
    s.colorsBack = s.style === 'single' ? 0 : 4;
    s.colorBar = true;
    s.regMarks = true;
    s.marks = true;
    s.screenLpi = 175;
  } else if (procCode === 'pb') {
    s.colorsFront = 1;
    s.colorsBack = s.style === 'single' ? 0 : 1;
    s.spotColors = 0;
    s.colorBar = true;
    s.regMarks = true;
    s.marks = true;
    s.screenLpi = 150;
  } else if (procCode === 'digital') {
    s.colorsFront = 4;
    s.colorsBack = s.style === 'single' ? 0 : 4;
    s.spotColors = 0;
    s.colorBar = false;
    s.regMarks = false;
    s.marks = true;
    s.plateView = false;
    if (s.style === 'turn' || s.style === 'tumble') s.style = 'sheetwise';
  } else if (procCode === 'laser') {
    s.colorsFront = 1;
    s.colorsBack = s.style === 'single' ? 0 : 1;
    s.spotColors = 0;
    s.colorBar = false;
    s.regMarks = false;
    s.marks = true;
    s.plateView = false;
    if (s.style === 'turn' || s.style === 'tumble') s.style = 'sheetwise';
  } else if (procCode === 'plotter') {
    s.colorsFront = 4;
    s.colorsBack = 0;
    s.style = 'single';
    s.colorBar = false;
    s.regMarks = false;
    s.plateView = false;
  }
}

function renderQuickPaperButtons() {
  return `<div class="full editactions">
    <button type="button" data-quickpaper="220,380" title="Padrão Nobel T9 (220 × 380 mm)">Nobel T9</button>
    <button type="button" data-quickpaper="238,328" title="Padrão Nobel T8 (238 × 328 mm)">Nobel T8</button>
    <button type="button" data-quickpaper="328,478" title="Padrão Nobel T4 (328 × 478 mm)">Nobel T4</button>
    <button type="button" data-quickpaper="320,450" title="SRA3 (320 × 450 mm)">SRA3</button>
    <button type="button" data-quickpaper="660,960" title="Folha inteira 66 × 96 cm">66×96 cm</button>
  </div>`;
}

function renderCustomPresetBox(kind) {
  const isPaper = kind === 'paper';
  const custom = readCustomPresets();
  const list = isPaper ? custom.papers : custom.pieces;
  const wKey = isPaper ? 'sw' : 'pw';
  const hKey = isPaper ? 'sh' : 'ph';
  const isOpen = !!openCustomCreator[kind];
  const curW = isPaper ? state.sw : state.pw;
  const curH = isPaper ? state.sh : state.ph;

  return `<div class="custom-preset-box">
    <div class="editactions" style="margin-top:0">
      <button type="button" data-toggle-custom="${kind}">
        ${isOpen ? '− Fechar cadastro' : isPaper ? '+ Cadastrar novo tamanho de folha' : '+ Cadastrar novo tamanho de peça'}
      </button>
    </div>
    ${
      isOpen
        ? `<div class="custom-preset-form">
            <label class="full" for="customName_${kind}">
              <span class="label-head"><span class="label-text">${isPaper ? 'Nome da folha' : 'Nome da peça'} (opcional)</span></span>
              <input id="customName_${kind}" type="text" placeholder="${isPaper ? 'Ex.: Folha Especial 25×35' : 'Ex.: Tag Loja 50×80'}" maxlength="60">
            </label>
            <label for="customW_${kind}">
              <span class="label-head"><span class="label-text">Largura <em class="unit-tag">mm</em></span></span>
              <input id="customW_${kind}" type="number" min="1" step="any" value="${curW}">
            </label>
            <label for="customH_${kind}">
              <span class="label-head"><span class="label-text">Altura <em class="unit-tag">mm</em></span></span>
              <input id="customH_${kind}" type="number" min="1" step="any" value="${curH}">
            </label>
            <div class="full editactions" style="margin-top:2px">
              <button type="button" class="primary" data-save-custom="${kind}">Salvar e aplicar</button>
              <button type="button" data-cancel-custom="${kind}">Cancelar</button>
            </div>
          </div>`
        : ''
    }
    ${
      list.length
        ? `<div class="custom-chip-row">${list
            .map(
              (item, idx) => `<span class="custom-chip">
                <button type="button" class="custom-chip-apply" data-apply-custom="${kind}" data-idx="${idx}" title="Aplicar ${escapeHTML(item.name)} (${item[wKey]} × ${item[hKey]} mm)">★ ${escapeHTML(item.name)} · ${item[wKey]}×${item[hKey]}</button>
                <button type="button" class="custom-chip-del" data-del-custom="${kind}" data-idx="${idx}" title="Excluir ${escapeHTML(item.name)}" aria-label="Excluir ${escapeHTML(item.name)}">×</button>
              </span>`
            )
            .join('')}</div>`
        : ''
    }
  </div>`;
}

function renderMarksGroup({ isFree = false, book = false, usesPlates = true, badge = '' }) {
  const groupId = isFree ? 'free-marks' : book ? 'book-marks' : 'flat-marks';
  const groupTitle = isFree
    ? '4 · Marcas Técnicas de Pré-Impressão'
    : `${book ? (usesPlates ? '8' : '7') : usesPlates ? '7' : '6'} · Marcas Técnicas de Pré-Impressão`;
  const hiddenHint = state.showCutMarks === false
    ? `<p class="marks-muted-note">Visualização limpa ativa: todas as marcas estão ocultas na folha, mas suas seleções abaixo continuam salvas.</p>`
    : '';

  return cfgGroup(
    groupId,
    groupTitle,
    badge,
    `
      ${checkField('showCutMarks', '<b>Exibir marcas técnicas na visualização</b> (geral)', 'crop_marks')}
      ${hiddenHint}
      ${checkField('marks', isFree ? '<b>Marcas de corte final nos cantos</b>' : 'Marcas de corte e linhas de dobra', 'crop_marks')}
      ${checkField('bleedMarks', 'Marcas de limite de sangria externa', 'bleed_marks')}
      ${numeric('markLength', 'Comprimento do fio', 1, 0.5, 'mm', 'mark_offset')}
      ${numeric('markOffset', 'Recuo ao corte', 0, 0.5, 'mm', 'mark_offset')}
      ${isFree ? numeric('markStroke', 'Espessura do fio', 0.1, 0.05, 'mm', 'mark_offset') : ''}
      ${checkField('regMarks', isFree ? 'Alvos de registro (⊕) e esquadro' : 'Alvos de registro (⊕) e indicador de esquadro', 'reg_marks')}
      ${checkField('centerCrossMarks', isFree ? 'Cruzes de centro nos 4 eixos (┼)' : 'Cruzes de centro nos 4 eixos da folha (┼)', 'center_cross')}
      ${checkField('colorBar', isFree ? 'Barra de controle densitométrica (CMYK)' : `Barra densitométrica (${state.process === 'pb' ? 'Escala K' : 'CMYK + Cinzas'})`, 'color_bar')}
      ${
        isFree
          ? select('colorBarPos', 'Posição da barra de cor', [
              ['top', 'Topo da folha (Superior)'],
              ['bottom', 'Base da folha (Inferior)'],
              ['both', 'Dupla (Topo + Base)']
            ], 'color_bar')
          : ''
      }
      ${checkField('sheetInfoStrip', 'Tira técnica (Slug) com ficha na borda', 'slug_strip')}
      ${book ? checkField('collationMarks', 'Marca de alceamento progressiva na lombada', 'collation_marks') : ''}
    `
  );
}

function renderCompareFields() {
  const list = getCompareList(state);
  const groups = getCompareCatalogGroups();

  const slotsHtml = list
    .map((item, idx) => {
      const col = COMPARE_COLORS[idx % COMPARE_COLORS.length];
      const curVal = `${item.w},${item.h}`;
      let marked = false;
      const optionsHtml = groups
        .map(
          g => `<optgroup label="${escapeHTML(g.group)}">${g.items
            .map(opt => {
              const val = `${opt.w},${opt.h}`;
              const isSel = !marked && val === curVal && (!opt.name || item.name.toLowerCase().includes(opt.name.toLowerCase()) || curVal === `${opt.w},${opt.h}`);
              if (isSel) marked = true;
              return `<option value="${val}" data-cmp-label="${escapeHTML(opt.name)}" ${isSel ? 'selected' : ''}>${escapeHTML(opt.label)}</option>`;
            })
            .join('')}</optgroup>`
        )
        .join('');

      return `<div class="compare-slot-card">
        <div class="compare-slot-head">
          <span class="compare-slot-title">
            <i class="compare-color-dot" style="background:${col.solid}"></i>
            <span>#${idx + 1} · ${escapeHTML(item.name)}</span>
          </span>
          <div class="compare-slot-actions">
            <button type="button" data-cmp-swap="${idx}" title="Inverter Largura × Altura">⇄ L×A</button>
            ${list.length > 1 ? `<button type="button" data-cmp-del="${idx}" title="Remover tamanho #${idx + 1}" aria-label="Remover tamanho ${idx + 1}">×</button>` : ''}
          </div>
        </div>
        <label class="full" for="cmpPreset_${idx}">
          <span class="label-head"><span class="label-text">Formato padrão</span></span>
          <select id="cmpPreset_${idx}" data-cmp-preset="${idx}">
            <option value="" ${!marked ? 'selected' : ''}>Personalizado (${item.w} × ${item.h} mm)</option>
            ${optionsHtml}
          </select>
        </label>
        <label for="cmpW_${idx}">
          <span class="label-head"><span class="label-text">Largura <em class="unit-tag">mm</em></span></span>
          <input id="cmpW_${idx}" data-cmp-idx="${idx}" data-cmp-field="w" type="number" min="1" step="any" value="${item.w}">
        </label>
        <label for="cmpH_${idx}">
          <span class="label-head"><span class="label-text">Altura <em class="unit-tag">mm</em></span></span>
          <input id="cmpH_${idx}" data-cmp-idx="${idx}" data-cmp-field="h" type="number" min="1" step="any" value="${item.h}">
        </label>
        <label class="full" for="cmpName_${idx}">
          <span class="label-head"><span class="label-text">Nome na legenda</span></span>
          <input id="cmpName_${idx}" data-cmp-idx="${idx}" data-cmp-field="name" type="text" value="${escapeHTML(item.name)}" maxlength="40">
        </label>
      </div>`;
    })
    .join('');

  return `
    <section class="free-simple-card" aria-label="Exibição e quantidade">
      <div class="free-card-head">
        <h3>Comparação &amp; Disposição</h3>
      </div>
      <div class="free-toggles-list">
        <label class="full" for="compareCount">
          <span class="label-head"><span class="label-text">Quantidade de formatos</span></span>
          <select id="compareCount">
            ${[1, 2, 3, 4, 5, 6, 7, 8]
              .map(n => `<option value="${n}" ${list.length === n ? 'selected' : ''}>${n} ${n === 1 ? 'tamanho' : 'tamanhos'}</option>`)
              .join('')}
          </select>
        </label>
        <div class="compare-add-remove-row">
          <button type="button" id="compareAddBtn" ${list.length >= 8 ? 'disabled' : ''}>+ Adicionar</button>
          <button type="button" id="compareRemoveBtn" ${list.length <= 1 ? 'disabled' : ''}>− Remover</button>
        </div>
        ${select('compareLayout', 'Disposição na visualização', [
          ['side', 'Lado a lado em escala 1:1 (mm)'],
          ['overlay', 'Sobrepostos no canto (0,0)']
        ])}
        <label class="full check-row free-toggle-row" for="compareShowMetrics">
          <span class="check-label-left">
            <input data-key="compareShowMetrics" id="compareShowMetrics" type="checkbox" ${state.compareShowMetrics !== false ? 'checked' : ''}>
            <span>Exibir cotas e áreas (cm²)</span>
          </span>
        </label>
      </div>
    </section>

    <section class="free-simple-card" aria-label="Tamanhos comparados">
      <div class="free-card-head">
        <h3>Folhas &amp; Tamanhos (${list.length})</h3>
      </div>
      <div class="compare-slots-stack">
        ${slotsHtml}
      </div>
    </section>
  `;
}

function renderFreeComparisonCards(fc) {
  if (!fc) return '';
  return `<div class="full free-compare-grid" id="freeCompareCards">
    ${['normal', 'rotate', 'mixed']
      .map(k => {
        const item = fc[k];
        const isDisabled = !!item.disabled;
        const isWin = !isDisabled && fc.winnerKey === k && item.count > 0;
        const isActive = !isDisabled && (state.freeStrategy === 'best' ? fc.winnerKey : state.freeStrategy) === k;
        return `<button type="button" class="free-card ${isActive ? 'active' : ''} ${isDisabled ? 'is-disabled' : ''}" data-freestrategy="${k}" ${isDisabled ? 'disabled' : ''}>
          <span class="free-card-top">${item.title} ${isDisabled ? '<b>DESATIVADO</b>' : isWin ? '<b>★ MELHOR</b>' : ''}</span>
          <strong>${isDisabled ? '—' : `${item.count} pçs/folha`}</strong>
          <small>${item.desc}${isDisabled ? '' : ` · ${item.usage}%`}</small>
        </button>`;
      })
      .join('')}
  </div>`;
}

function renderSuggestFields(pieceSelectedMarked, pieceGroupsHtml) {
  const sug = result?.suggestInfo;
  const countFound = sug?.suggestions?.length || 0;
  return `
    <section class="free-simple-card" aria-label="Informe apenas o tamanho da peça">
      <div class="free-card-head">
        <h3>1 · Tamanho da Peça</h3>
        <button type="button" class="free-swap-btn" id="swapPieceDim" title="Inverter Largura × Altura da peça">⇄ L×A</button>
      </div>
      <p class="note" style="margin:0 0 10px">Digite apenas as medidas da peça para receber automaticamente o ranking das melhores folhas e orientações.</p>
      <label class="full" for="piecePreset">
        <span class="label-head">
          <span class="label-text">Preset de peça (opcional)</span>
        </span>
        <select id="piecePreset">
          <option value="" ${!pieceSelectedMarked ? 'selected' : ''}>Personalizado (${state.pw} × ${state.ph} mm)</option>
          ${pieceGroupsHtml}
        </select>
      </label>
      <div class="full editactions">
        <button type="button" data-quickpiece="210,297" title="A4 (210 × 297 mm)">A4</button>
        <button type="button" data-quickpiece="148,210" title="A5 (148 × 210 mm)">A5</button>
        <button type="button" data-quickpiece="105,148" title="A6 (105 × 148 mm)">A6</button>
        <button type="button" data-quickpiece="297,420" title="A3 (297 × 420 mm)">A3</button>
        <button type="button" data-quickpiece="90,50" title="Cartão de Visita BR (90 × 50 mm)">90×50</button>
        <button type="button" data-quickpiece="100,150" title="Panfleto 10×15 (100 × 150 mm)">10×15</button>
      </div>
      <div class="free-dim-grid">
        ${numeric('pw', 'Largura da peça', 1, 'any', 'mm')}
        ${numeric('ph', 'Altura da peça', 1, 'any', 'mm')}
      </div>
      ${renderCustomPresetBox('piece')}
    </section>

    <section class="free-simple-card" aria-label="Parâmetros e filtros da sugestão">
      <div class="free-card-head">
        <h3>2 · Critérios &amp; Margens</h3>
        <span class="pill">${countFound} folhas</span>
      </div>
      <div class="free-dim-grid">
        ${numeric('bleed', 'Sangria', 0, 0.5, 'mm')}
        ${numeric('qty', 'Tiragem', 1, 1, 'un.')}
        ${numeric('gapX', 'Espaçamento X', 0, 0.5, 'mm')}
        ${numeric('gapY', 'Espaçamento Y', 0, 0.5, 'mm')}
      </div>
      <div class="full editactions" style="margin:8px 0 10px">
        <button type="button" data-quickgap="0">Gap 0 mm</button>
        <button type="button" data-quickgap="4">Gap 4 mm</button>
        <button type="button" data-quickgap="6">Gap 6 mm</button>
      </div>
      ${select('suggestMarginPreset', 'Margens / Processo de máquina', [
        ['process', `Perfil atual (${state.process.toUpperCase()} · pinça ${state.grip} mm)`],
        ['offset', 'Offset Plana (pinça 12 · laterais 10 · barra 8 mm)'],
        ['digital', 'Digital / Laser (margem 5 mm nos 4 lados)'],
        ['zero', 'Sem margens (aproveitamento bruto / teste máximo)']
      ])}
      ${select('suggestSort', 'Priorizar sugestões por', [
        ['usage', 'Melhor aproveitamento na folha (%)'],
        ['effective', 'Menor desperdício real na tiragem (%)'],
        ['count', 'Mais peças por folha (n-up)'],
        ['area', 'Menor consumo total de papel (m²)']
      ])}
      ${select('suggestFamily', 'Filtrar família de folhas', [
        ['all', 'Todas as folhas cadastradas (Nobel, Digital e Offset)'],
        ['nobel', 'Somente Padrão Nobel (T9, T8, T4)'],
        ['digital', 'Somente Digital / Comercial (A4, A4+, A3, SRA3, A3+)'],
        ['offset_large', 'Somente Offset Grandes (Meia folha, 66×96, 76×112)']
      ])}
      <label class="full check-row free-toggle-row" for="allowMixed" style="margin-top:8px">
        <span class="check-label-left">
          <input data-key="allowMixed" id="allowMixed" type="checkbox" ${state.allowMixed !== false ? 'checked' : ''}>
          <span>Permitir corte misto (0° + 90°) nas sugestões</span>
        </span>
      </label>
    </section>
  `;
}

function fields() {
  const book = state.mode === 'book';
  const visual = state.mode === 'visual';
  const free = state.mode === 'free';
  const compare = state.mode === 'compare';
  const suggest = state.mode === 'suggest';
  const badges = getGroupBadges(state, result);

  if (compare) {
    $('fields').innerHTML = renderCompareFields(badges);
    bindFieldEvents();
    return;
  }

  const usesPlates = !visual && !free && (F.PROCESS_PROFILES[state.process] || F.PROCESS_PROFILES.offset).usesPlates;
  const usable = F.area(state);
  const bleed = Number(state.bleed) || 0;
  const width = 210 + 2 * bleed;
  const height = 297 + 2 * bleed;
  const fitsA4 = (width <= usable.w && height <= usable.h) || (height <= usable.w && width <= usable.h);
  const a4Guide = `<details class="full"><summary>A4 com sangria: conferir dimensões</summary>
    <p>A4 final: 210 × 297 mm. Com ${bleed} mm de sangria por lado: ${width} × ${height} mm.
    Área útil: ${usable.w} × ${usable.h} mm. ${fitsA4 ? 'Há espaço geométrico para uma peça em pelo menos uma orientação.' : 'A peça excede a área útil nas duas orientações.'}
    Confira marcas, fibra e modo de impressão na montagem.</p>${infoBtn('super_a4', 'Formatos comerciais A4+')}</details>`;
  const currentPaperVal = `${state.sw},${state.sh}`;
  const currentPieceVal = `${state.pw},${state.ph}`;
  const allPapers = getAllPaperPresets();
  let paperSelectedMarked = false;
  const paperOptionsHtml = allPapers
    .map(p => {
      const val = `${p.sw},${p.sh}`;
      const isSel = !paperSelectedMarked && val === currentPaperVal;
      if (isSel) paperSelectedMarked = true;
      return `<option value="${val}" ${isSel ? 'selected' : ''}>${escapeHTML(p.label)}</option>`;
    })
    .join('');

  let pieceSelectedMarked = false;
  const pieceGroupsHtml = getAllPiecePresetGroups()
    .map(
      g =>
        `<optgroup label="${escapeHTML(g.group)}">${g.items
          .map(it => {
            const val = `${it.pw},${it.ph}`;
            const isSel = !pieceSelectedMarked && val === currentPieceVal;
            if (isSel) pieceSelectedMarked = true;
            return `<option value="${val}" ${isSel ? 'selected' : ''}>${escapeHTML(it.label)}</option>`;
          })
          .join('')}</optgroup>`
    )
    .join('');

  if (suggest) {
    $('fields').innerHTML = renderSuggestFields(pieceSelectedMarked, pieceGroupsHtml);
    bindFieldEvents();
    return;
  }

  if (free) {
    const bleedActive = Number(state.bleed) > 0 && state.bleedMarks !== false;
    $('fields').innerHTML = `
      <section class="free-simple-card" aria-label="Tamanho da folha">
        <div class="free-card-head">
          <h3>Tamanho da Folha</h3>
          <button type="button" class="free-swap-btn" id="swapSheetDim" title="Inverter Largura × Altura da folha">⇄ L×A</button>
        </div>
        <label class="full" for="paperPreset">
          <span class="label-head">
            <span class="label-text">Preset de folha</span>
          </span>
          <select id="paperPreset">
            <option value="" ${!paperSelectedMarked ? 'selected' : ''}>Personalizado (${state.sw} × ${state.sh} mm)</option>
            ${paperOptionsHtml}
          </select>
        </label>
        ${renderQuickPaperButtons()}
        <div class="free-dim-grid">
          ${numeric('sw', 'Largura', 1, 'any', 'mm')}
          ${numeric('sh', 'Altura', 1, 'any', 'mm')}
        </div>
        ${renderCustomPresetBox('paper')}
      </section>

      <section class="free-simple-card" aria-label="Tamanho da peça">
        <div class="free-card-head">
          <h3>Tamanho da Peça</h3>
          <button type="button" class="free-swap-btn" id="swapPieceDim" title="Inverter Largura × Altura da peça">⇄ L×A</button>
        </div>
        <label class="full" for="piecePreset">
          <span class="label-head">
            <span class="label-text">Preset de peça</span>
          </span>
          <select id="piecePreset">
            <option value="" ${!pieceSelectedMarked ? 'selected' : ''}>Personalizado (${state.pw} × ${state.ph} mm)</option>
            ${pieceGroupsHtml}
          </select>
        </label>
        <div class="full editactions">
          <button type="button" data-quickpiece="210,297" title="A4 (210 × 297 mm)">A4</button>
          <button type="button" data-quickpiece="148,210" title="A5 (148 × 210 mm)">A5</button>
          <button type="button" data-quickpiece="105,148" title="A6 (105 × 148 mm)">A6</button>
          <button type="button" data-quickpiece="297,420" title="A3 (297 × 420 mm)">A3</button>
          <button type="button" data-quickpiece="90,50" title="Cartão de Visita BR (90 × 50 mm)">90×50</button>
          <button type="button" data-quickpiece="100,150" title="Panfleto 10×15 (100 × 150 mm)">10×15</button>
        </div>
        <div class="free-dim-grid">
          ${numeric('pw', 'Largura', 1, 'any', 'mm')}
          ${numeric('ph', 'Altura', 1, 'any', 'mm')}
        </div>
        <button type="button" class="suggest-jump-btn full" data-open-suggest="1">💡 Ver folhas sugeridas para ${state.pw}×${state.ph} mm →</button>
        ${renderCustomPresetBox('piece')}
      </section>

      <section class="free-simple-card" aria-label="Marcas de corte, sangria e corte misto">
        <div class="free-card-head">
          <h3>Corte &amp; Sangria</h3>
        </div>
        <div class="free-toggles-list">
          <label class="full check-row free-toggle-row" for="marks">
            <span class="check-label-left">
              <input data-key="marks" id="marks" type="checkbox" ${state.marks ? 'checked' : ''}>
              <span>Marcas de corte</span>
            </span>
          </label>
          <label class="full check-row free-toggle-row" for="freeBleedEnabled">
            <span class="check-label-left">
              <input id="freeBleedEnabled" type="checkbox" ${bleedActive ? 'checked' : ''}>
              <span>Sangria</span>
            </span>
          </label>
          ${
            bleedActive
              ? `<div class="free-bleed-size">${numeric('bleed', 'Medida da sangria', 0.5, 0.5, 'mm')}</div>`
              : ''
          }
          <label class="full check-row free-toggle-row" for="allowMixed">
            <span class="check-label-left">
              <input data-key="allowMixed" id="allowMixed" type="checkbox" ${state.allowMixed !== false ? 'checked' : ''}>
              <span>Corte misto (0° + 90°)</span>
            </span>
          </label>
        </div>
      </section>
    `;
    bindFieldEvents();
    return;
  } else if (visual) {
    $('fields').innerHTML = [
      cfgGroup(
        'visual-piece',
        '1 · Peça de Comunicação Visual',
        badges['visual-piece'],
        `
          <label class="full" for="visualPreset">
            <span class="label-head">
              <span class="label-text">Predefinição de grande formato</span>
              ${infoBtn('trim_size', 'Predefinição de grande formato')}
            </span>
            <select id="visualPreset">
              <option value="">Personalizado (${state.pw} × ${state.ph} mm)</option>
              <option value="800,1200">Banner Padrão · 800 × 1200 mm</option>
              <option value="1000,1500">Banner Grande · 1000 × 1500 mm</option>
              <option value="3000,700">Faixa de Rua · 3000 × 700 mm</option>
              <option value="2000,1000">Lona / Painel · 2000 × 1000 mm</option>
              <option value="3000,2000">Backdrop Evento · 3000 × 2000 mm (Emenda)</option>
              <option value="9000,3000">Outdoor / Empena · 9000 × 3000 mm (Panos)</option>
            </select>
          </label>
          ${numeric('pw', 'Largura final visível', 50, 'any', 'mm', 'trim_size')}
          ${numeric('ph', 'Altura final visível', 50, 'any', 'mm', 'trim_size')}
          ${numeric('qty', 'Quantidade de peças', 1, 1, 'un.', 'qty_waste')}
          ${numeric('gsm', 'Gramatura da lona/vinil', 50, 'any', 'g/m²', 'gsm')}
        `
      ),
      cfgGroup(
        'visual-structure',
        '2 · Bainha, Solda, Bastão e Ilhós',
        badges['visual-structure'],
        `
          ${numeric('hem', 'Bainha de reforço', 0, 'any', 'mm', 'hem')}
          ${numeric('weld', 'Sobreposição de solda', 0, 'any', 'mm', 'weld')}
          ${numeric('polePocketTop', 'Bolsa bastão superior', 0, 'any', 'mm', 'pole_pocket')}
          ${numeric('polePocketBottom', 'Bolsa bastão inferior', 0, 'any', 'mm', 'pole_pocket')}
          ${numeric('grommetSpacing', 'Espaçamento ilhós (0=sem)', 0, 'any', 'mm', 'grommets')}
          ${numeric('grommetInset', 'Centro do ilhós à borda', 5, 'any', 'mm', 'grommets')}
          ${numeric('safeMargin', 'Margem int. de segurança', 0, 'any', 'mm', 'safe_margin')}
        `
      ),
      cfgGroup(
        'visual-roll',
        '3 · Mídia / Bobina da Plotter',
        badges['visual-roll'],
        `
          <label class="full" for="rollPreset">
            <span class="label-head">
              <span class="label-text">Largura de bobina / chapa padrão</span>
              ${infoBtn('roll_width', 'Largura de bobina da plotter')}
            </span>
            <select id="rollPreset">
              <option value="">Personalizado (${state.sw} × ${state.sh} mm)</option>
              <option value="1000,5000">Bobina Lona/Vinil 1,00 m (1000 mm)</option>
              <option value="1220,5000">Bobina Lona/Vinil 1,22 m (1220 mm)</option>
              <option value="1520,5000">Bobina Lona/Vinil 1,52 m (1520 mm)</option>
              <option value="2500,5000">Bobina Lona 2,50 m (2500 mm)</option>
              <option value="3200,5000">Bobina Lona 3,20 m (3200 mm)</option>
              <option value="1220,2440">Chapa Rígida PS/PVC/ACM · 1220 × 2440 mm</option>
            </select>
          </label>
          ${numeric('sw', 'Largura da mídia/bobina', 100, 'any', 'mm', 'roll_width')}
          ${numeric('sh', 'Comprimento de referência', 100, 'any', 'mm', 'roll_width')}
          ${numeric('left', 'Margem lateral de pinça/rolete', 0, 'any', 'mm', 'side_margins')}
          ${numeric('waste', 'Perdas variáveis', 0, 'any', '%', 'qty_waste')}
        `
      )
    ].join('');
  } else {
    const processAndSheetGroup = cfgGroup(
      book ? 'book-process' : 'flat-process',
      '1 · Processo e Folha de Máquina',
      badges[book ? 'book-process' : 'flat-process'],
      `
        ${select('process', 'Processo produtivo', [
          ['offset', 'Offset Plana (Chapa CTP · CMYK / Pantone)'],
          ['digital', 'Digital Color (Toner / Produção · Cliques)'],
          ['pb', 'Preto & Branco (1×1 Editorial / Miolo)'],
          ['laser', 'Laser / Impressão Rápida (Fusor Térmico)']
        ], 'process')}
        <label class="full" for="paperPreset">
          <span class="label-head">
            <span class="label-text">Formato da folha de máquina</span>
            ${infoBtn('nobel_t8', 'Formato de folha padrão e Padrão Nobel')}
          </span>
          <select id="paperPreset">
            <option value="" ${!paperSelectedMarked ? 'selected' : ''}>Personalizado (${state.sw} × ${state.sh} mm)</option>
            ${paperOptionsHtml}
          </select>
        </label>
          ${a4Guide}
        ${renderQuickPaperButtons()}
        ${renderCustomPresetBox('paper')}
        ${numeric('sw', 'Largura da folha', 1, 'any', 'mm', 'sheet_format')}
        ${numeric('sh', 'Altura da folha', 1, 'any', 'mm', 'sheet_format')}
      `
    );

    const pieceAndImpositionGroup = book
      ? cfgGroup(
          'book-editorial',
          '2 · Página Fechada, Cadernos e Encadernação',
          badges['book-editorial'],
          `
            <label class="full" for="piecePreset">
              <span class="label-head">
                <span class="label-text">Formato da página fechada (Série A &amp; Editorial)</span>
                ${infoBtn('trim_size', 'Formato da página fechada')}
              </span>
              <select id="piecePreset">
                <option value="" ${!pieceSelectedMarked ? 'selected' : ''}>Personalizado (${state.pw} × ${state.ph} mm)</option>
                ${pieceGroupsHtml}
              </select>
            </label>
            <div class="full editactions">
              <button type="button" data-quickpiece="148,210" title="A5 (148 × 210 mm)">A5</button>
              <button type="button" data-quickpiece="210,297" title="A4 (210 × 297 mm)">A4</button>
              <button type="button" data-quickpiece="160,230" title="Livro Padrão BR (160 × 230 mm)">16×23</button>
              <button type="button" data-quickpiece="140,210" title="Livro Comercial (140 × 210 mm)">14×21</button>
              <button type="button" id="swapPieceDim" title="Inverter Largura × Altura">⇄ L×A</button>
            </div>
            ${renderCustomPresetBox('piece')}
            ${numeric('pw', 'Largura da página fechada', 1, 'any', 'mm', 'trim_size')}
            ${numeric('ph', 'Altura da página fechada', 1, 'any', 'mm', 'trim_size')}
            ${numeric('pages', 'Total de páginas', 4, 1, 'págs', 'pages')}
            ${numeric('qty', 'Exemplares (tiragem)', 1, 1, 'un.', 'qty_waste')}
            ${numeric('bleed', 'Sangria externa', 0, 'any', 'mm', 'bleed')}
            ${select('foldPattern', 'Padrão de dobra / imposição', [
              ['F4-1', 'F4-1 · 4 págs (2×1 · 1 dobra vertical)'],
              ['F8-1', 'F8-1 · 8 págs (2×2 · 2 dobras em cruz)'],
              ['F16-1', 'F16-1 · 16 págs (4×2 · 3 dobras em cruz)'],
              ['LOOSE-2', 'Folhas soltas 2-up (Espiral / Wire-O / Bloco)']
            ], 'fold_pattern')}
            ${select('binding', 'Método de encadernação', [
              ['saddle', 'Grampo / Canoa (Saddle-stitch · encaixado)'],
              ['perfect', 'Lombada quadrada (Cola PUR / Hotmelt · alceado)'],
              ['spiral', 'Espiral (Plástico / Metálico · furação)'],
              ['wireo', 'Wire-O (Duplo anel · furação)'],
              ['pad', 'Blocagem editorial (Cola no topo/lateral)']
            ], 'binding')}
            ${select('style', 'Modo de virada na máquina', [
              ['sheetwise', usesPlates ? 'Sheetwise · 2 formas (frente + retiro)' : 'Duplex Automático (Frente e Verso)'],
              ['perfector', 'Perfector · reversão em 1 passagem']
            ], 'style')}
          `
        )
      : cfgGroup(
          'flat-piece',
          '2 · Formato Final, Tiragem e Imposição',
          badges['flat-piece'],
          `
            <label class="full" for="piecePreset">
              <span class="label-head">
                <span class="label-text">Predefinição de formato final (Série A &amp; Mercado)</span>
                ${infoBtn('trim_size', 'Predefinição de formato final')}
              </span>
              <select id="piecePreset">
                <option value="" ${!pieceSelectedMarked ? 'selected' : ''}>Personalizado (${state.pw} × ${state.ph} mm)</option>
                ${pieceGroupsHtml}
              </select>
            </label>
            <div class="full editactions">
              <button type="button" data-quickpiece="210,297" title="A4 (210 × 297 mm)">A4</button>
              <button type="button" data-quickpiece="148,210" title="A5 (148 × 210 mm)">A5</button>
              <button type="button" data-quickpiece="105,148" title="A6 (105 × 148 mm)">A6</button>
              <button type="button" data-quickpiece="297,420" title="A3 (297 × 420 mm)">A3</button>
              <button type="button" data-quickpiece="90,50" title="Cartão de Visita BR (90 × 50 mm)">90×50</button>
              <button type="button" data-quickpiece="100,150" title="Panfleto 10×15 (100 × 150 mm)">10×15</button>
              <button type="button" id="swapPieceDim" title="Inverter Largura × Altura (Retrato ⇄ Paisagem)">⇄ L×A</button>
            </div>
            ${renderCustomPresetBox('piece')}
            ${numeric('pw', 'Largura da peça', 1, 'any', 'mm', 'trim_size')}
            ${numeric('ph', 'Altura da peça', 1, 'any', 'mm', 'trim_size')}
            <button type="button" class="suggest-jump-btn full" data-open-suggest="1">💡 Sugerir melhor folha para ${state.pw}×${state.ph} mm →</button>
            ${numeric('bleed', 'Sangria externa', 0, 'any', 'mm', 'bleed')}
            ${numeric('qty', 'Peças desejadas (tiragem)', 1, 1, 'un.', 'qty_waste')}
            ${numeric('gapX', 'Espaçamento entre peças X', 0, 'any', 'mm', 'gap_xy')}
            ${numeric('gapY', 'Espaçamento entre peças Y', 0, 'any', 'mm', 'gap_xy')}
            <div class="full editactions">
              <button type="button" data-quickgap="0">0 mm (Fio único)</button>
              <button type="button" data-quickgap="4">4 mm (Duplo corte)</button>
              <button type="button" data-quickgap="6">6 mm (Sangria dupla)</button>
              <button type="button" data-quickgap="8">8 mm (Faca C&amp;V)</button>
            </div>
            ${select('style', 'Modo de impressão (Work style)', [
              ['single', 'Somente frente (Simplex)'],
              ['sheetwise', usesPlates ? 'Sheetwise · formas distintas' : 'Duplex · Frente e Verso'],
              ['perfector', 'Perfector · reversão 1 passagem'],
              ['turn', 'Work-and-turn · mesma pinça'],
              ['tumble', 'Work-and-tumble · troca de pinça']
            ], 'style')}
            <label class="full check-row" for="flatMixedToggle">
              <span class="check-label-left">
                <input id="flatMixedToggle" type="checkbox" ${state.allowMixed !== false && state.orientation === 'mixed' ? 'checked' : ''}>
                <span><b>Ativar corte misto (0° + 90°)</b></span>
              </span>
              ${infoBtn('dutch_cut', 'Ativar ou desativar corte misto')}
            </label>
            ${select('orientation', 'Orientação / aproveitamento', [
              ['auto', 'Melhor grade uniforme (0° ou 90°)'],
              ['mixed', 'Corte misto (Dutch cut · 0° + 90°)'],
              ['normal', 'Manter 0° (Retrato)'],
              ['rotate', 'Forçar 90° (Paisagem)']
            ], 'orientation')}
          `
        );

    const editorialGuttersGroup = book
      ? cfgGroup(
          'book-gutters',
          '3 · Medianizes (Gutters), Lombada e Creep',
          badges['book-gutters'],
          `
            ${numeric('spineGutter', 'Medianiz / calha central', 0, 'any', 'mm', 'spine_gutter')}
            ${numeric('bindingMargin', 'Margem int. encadernação', 0, 'any', 'mm', 'binding_margin')}
            ${numeric('headTrim', 'Refilo / abertura cabeça', 0, 'any', 'mm', 'head_trim')}
            ${numeric('footTrim', 'Refilo / calha de pé', 0, 'any', 'mm', 'head_trim')}
            ${numeric('faceGutter', 'Calha frontal (16p)', 0, 'any', 'mm', 'face_gutter')}
            ${numeric('milling', 'Fresagem de lombada', 0, 'any', 'mm', 'milling')}
            ${select('creepMode', 'Compensação de Creep (Shingling)', [
              ['manual', 'Manual (informado abaixo)'],
              ['auto', 'Automático pela espessura medida (caliper)']
            ], 'creep')}
            ${numeric('creep', 'Creep manual máx.', 0, 'any', 'mm', 'creep')}
          `
        )
      : '';

    const marginsAndGrainGroup = cfgGroup(
      book ? 'book-margins' : 'flat-margins',
      `${book ? '4' : '3'} · Margens de Máquina, Pinça e Fibra`,
      badges[book ? 'book-margins' : 'flat-margins'],
      `
        ${numeric('left', 'Margem esquerda', 0, 'any', 'mm', 'side_margins')}
        ${numeric('right', 'Margem direita', 0, 'any', 'mm', 'side_margins')}
        ${numeric('grip', usesPlates ? 'Pinça de papel (inferior)' : 'Margem inferior', 0, 'any', 'mm', 'grip')}
        ${numeric('tail', usesPlates ? 'Contrapinça (superior)' : 'Margem superior', 0, 'any', 'mm', 'tail')}
        ${numeric('bar', 'Reserva barra de cor', 0, 'any', 'mm', 'color_bar')}
        ${select('sideGuide', 'Esquadro lateral (1ª passada)', [
          ['left', 'Esquadro esquerdo (◀)'],
          ['right', 'Esquadro direito (▶)']
        ], 'side_guide')}
        ${select('grain', 'Sentido da fibra na folha', [
          ['none', 'Não informada'],
          ['y', 'Vertical ↕ (paralela à altura)'],
          ['x', 'Horizontal ↔ (paralela à largura)']
        ], 'grain')}
        ${
          !book
            ? select('pieceGrain', 'Restrição de fibra na peça', [
                ['free', 'Livre (permite girar p/ maior aproveitamento)'],
                ['height', 'Paralela à altura da peça'],
                ['width', 'Paralela à largura da peça']
              ], 'piece_grain')
            : ''
        }
      `
    );

    const finishGroup = cfgGroup(
      book ? 'book-finish' : 'flat-finish',
      `${book ? '5' : '4'} · Acabamentos, Enobrecimento e Interferências`,
      badges[book ? 'book-finish' : 'flat-finish'],
      `
        ${select('lamination', 'Laminação de superfície', [
          ['none', 'Sem laminação'],
          ['matte', 'Laminação BOPP Fosca'],
          ['gloss', 'Laminação BOPP Brilho'],
          ['soft', 'Laminação Soft Touch (Aveludada)']
        ], 'lamination')}
        ${select('varnish', 'Verniz', [
          ['none', 'Sem verniz'],
          ['water', 'Verniz Base Água (Proteção)'],
          ['total_uv', 'Verniz UV Total Brilho'],
          ['spot_uv', 'Verniz UV Localizado (+1 matriz de máscara)']
        ], 'spot_uv')}
        ${checkField('dieCut', 'Faca Especial (Corte e Vinco)', 'die_cut')}
        ${checkField('hotStamping', 'Hot Stamping (Clichê metálico)', 'hot_stamping')}
        ${checkField('emboss', 'Relevo Seco / Alto-Relevo', 'emboss')}
        ${checkField('drill', 'Furação mecânica (Arquivo / Tag / Espiral)', 'drill')}
        ${checkField('perforation', 'Serrilha / Picote destacável', 'perforation')}
        ${state.perforation ? numeric('perfOffset', 'Posição da serrilha', 3, 'any', 'mm', 'perforation') : ''}
        ${checkField('crease', 'Vinco mecânico de dobra', 'crease')}
        ${checkField('numbering', 'Numeração sequencial (Talão / Ingresso)', 'numbering')}
        ${checkField('padding', 'Blocagem (Cola no topo/lateral)', 'padding')}
      `
    );

    const ctpGroup = usesPlates
      ? cfgGroup(
          book ? 'book-ctp' : 'flat-ctp',
          `${book ? '6' : '5'} · Montagem de Chapa CTP (Offset)`,
          badges[book ? 'book-ctp' : 'flat-ctp'],
          `
            ${checkField('plateView', '<b>Visualizar Chapa CTP e furação no diagrama</b>', 'ctp_plate')}
            <label class="full" for="platePreset">
              <span class="label-head">
                <span class="label-text">Formato de chapa CTP padrão</span>
                ${infoBtn('ctp_plate', 'Formato de chapa CTP')}
              </span>
              <select id="platePreset">
                <option value="">Personalizado (${state.plateW} × ${state.plateH} mm)</option>
                <option value="370,450,35">GTO 46 / Ryobi · 370 × 450 mm (pinça 35)</option>
                <option value="400,510,35">GTO 52 / SM 52 · 400 × 510 mm (pinça 35)</option>
                <option value="510,400,35">SM 52 Paisagem · 510 × 400 mm (pinça 35)</option>
                <option value="605,745,42">Speedmaster 74 · 605 × 745 mm (pinça 42)</option>
                <option value="790,1030,45">Speedmaster 102 · 790 × 1030 mm (pinça 45)</option>
              </select>
            </label>
            ${numeric('plateW', 'Largura da chapa', 50, 'any', 'mm', 'ctp_plate')}
            ${numeric('plateH', 'Altura da chapa', 50, 'any', 'mm', 'ctp_plate')}
            ${numeric('plateGrip', 'Pinça chapa → papel', 0, 'any', 'mm', 'plate_grip')}
            ${numeric('screenLpi', 'Lineatura', 60, 1, 'LPI', 'screen_lpi')}
            ${select('platePunch', 'Furação de registro (Punch)', [
              ['bacher', 'Bacher Control 2000 (220 / 425 mm)'],
              ['heidelberg', 'Heidelberg CPC / Autoplate'],
              ['komori', 'Komori / Protocol'],
              ['none', 'Sem furação na chapa']
            ], 'plate_punch')}
          `
        )
      : '';

    const colorsGroup = cfgGroup(
      book ? 'book-colors' : 'flat-colors',
      `${book ? (usesPlates ? '7' : '6') : usesPlates ? '6' : '5'} · Cores, Substrato e Perdas`,
      badges[book ? 'book-colors' : 'flat-colors'],
      `
        ${numeric('colorsFront', usesPlates ? 'Cores Frente (CMYK)' : 'Canais Frente', 0, 1, 'cores', 'colors_front')}
        ${numeric('colorsBack', usesPlates ? 'Cores Verso (CMYK)' : 'Canais Verso', 0, 1, 'cores', 'colors_front')}
        ${usesPlates ? numeric('spotColors', 'Cores especiais (Pantone)', 0, 1, 'cores', 'spot_colors') : ''}
        ${numeric('gsm', 'Gramatura do papel', 1, 'any', 'g/m²', 'gsm')}
        ${numeric('caliper', 'Espessura medida (Caliper)', 0.001, 'any', 'mm', 'caliper')}
        ${numeric('setup', usesPlates ? 'Acerto por forma' : 'Provas / acerto', 0, 1, 'folhas', 'makeready')}
        ${numeric('waste', 'Perdas variáveis', 0, 'any', '%', 'qty_waste')}
      `
    );

    const marksGroup = renderMarksGroup({
      isFree: false,
      book,
      usesPlates,
      badge: badges[book ? 'book-marks' : 'flat-marks']
    });

    $('fields').innerHTML = [
      processAndSheetGroup,
      pieceAndImpositionGroup,
      editorialGuttersGroup,
      marginsAndGrainGroup,
      finishGroup,
      ctpGroup,
      colorsGroup,
      marksGroup
    ].join('');
  }

  bindFieldEvents();
}

const GEOMETRY_KEYS = [
  'pw', 'ph', 'bleed', 'gapX', 'gapY', 'sw', 'sh', 'left', 'right', 'grip', 'tail', 'bar',
  'headTrim', 'footTrim', 'spineGutter', 'faceGutter', 'bindingMargin', 'milling',
  'hem', 'weld', 'polePocketTop', 'polePocketBottom', 'grommetSpacing', 'grommetInset', 'safeMargin',
  'markLength', 'markOffset', 'markStroke'
];

function bindFreeStrategyCards() {
  $('fields').querySelectorAll('[data-freestrategy]').forEach(btn => {
    btn.onclick = () => {
      change(s => {
        s.freeStrategy = btn.dataset.freestrategy;
        s.edits = {};
        s.extras = [];
        selected = null;
      });
    };
  });
}

function bindFieldEvents() {
  $('fields').querySelectorAll('details.cfg-group').forEach(det => {
    det.addEventListener('toggle', () => {
      const g = det.dataset.group;
      if (!g) return;
      if (det.open) openGroups.add(g);
      else openGroups.delete(g);
    });
  });

  $('fields').querySelectorAll('[data-key]').forEach(el => {
    if (el.type === 'number') {
      el.onfocus = () => {
        activeInputSnapshot = F.clone(state);
      };
      el.oninput = () => {
        handleReactiveNumberInput(el);
      };
      el.onblur = () => {
        commitNumberInputOnBlur(el);
      };
      el.onkeydown = e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          applySettings();
        }
      };
      return;
    }

    el.onchange = () => {
      change(s => {
        const key = el.dataset.key;
        if (key === 'process') {
          applyProcessProfile(s, el.value);
          s.edits = {};
          s.extras = [];
          selected = null;
          selectedSlot = null;
          return;
        }
        s[key] = el.type === 'checkbox' ? el.checked : el.value;
        if (key === 'allowMixed' && !s.allowMixed && s.freeStrategy === 'mixed') {
          s.freeStrategy = 'best';
        }
        if (key === 'orientation' && s.orientation === 'mixed') {
          s.allowMixed = true;
        }
        if (key === 'binding' && (s.binding === 'spiral' || s.binding === 'wireo')) {
          s.drill = true;
          if (s.bindingMargin < 10) s.bindingMargin = 10;
        }
        if (key === 'binding' && s.binding === 'pad') {
          s.padding = true;
        }
        if (['orientation', 'allowMixed', 'freeStrategy', 'freeMarginMode', 'style', 'grain', 'pieceGrain', 'foldPattern', 'colorBar', 'colorBarPos', 'compareLayout', 'compareShowMetrics', 'suggestMarginPreset', 'suggestSort', 'suggestFamily'].includes(key)) {
          s.edits = {};
          s.extras = [];
          s.suggestSelectedId = '';
          selected = null;
          selectedSlot = null;
        }
        if (key === 'foldPattern') {
          if (s.foldPattern === 'F16-1' && (s.sw < 600 || s.sh < 450)) {
            s.sw = 660;
            s.sh = 480;
          } else if (s.foldPattern === 'F8-1' && (s.sw < 328 || s.sh < 450)) {
            s.sw = 328;
            s.sh = 478;
          }
        }
      });
    };
  });

  if ($('flatMixedToggle')) {
    $('flatMixedToggle').onchange = e => {
      const enabled = e.target.checked;
      change(s => {
        s.allowMixed = enabled;
        s.orientation = enabled ? 'mixed' : (s.orientation === 'mixed' ? 'auto' : s.orientation);
        s.edits = {};
        s.extras = [];
        selected = null;
      });
    };
  }

  bindFreeStrategyCards();
  bindCustomPresetControls();
  bindCompareFieldControls();

  if ($('visualPreset')) {
    $('visualPreset').onchange = e => {
      if (e.target.value) {
        change(s => {
          [s.pw, s.ph] = e.target.value.split(',').map(Number);
        });
      }
    };
  }

  if ($('rollPreset')) {
    $('rollPreset').onchange = e => {
      if (e.target.value) {
        change(s => {
          [s.sw, s.sh] = e.target.value.split(',').map(Number);
          s.right = s.left;
        });
      }
    };
  }

  $('fields').querySelectorAll('[data-open-suggest]').forEach(btn => {
    btn.onclick = () => setMode('suggest');
  });

  if ($('piecePreset')) {
    $('piecePreset').onchange = e => {
      if (e.target.value) {
        change(s => {
          [s.pw, s.ph] = e.target.value.split(',').map(Number);
          s.edits = {};
          s.extras = [];
          s.suggestSelectedId = '';
          selected = null;
        });
      }
    };
  }

  $('fields').querySelectorAll('[data-quickpiece]').forEach(btn => {
    btn.onclick = () => {
      const [pw, ph] = btn.dataset.quickpiece.split(',').map(Number);
      change(s => {
        s.pw = pw;
        s.ph = ph;
        s.edits = {};
        s.extras = [];
        s.suggestSelectedId = '';
        selected = null;
      });
    };
  });

  if ($('swapPieceDim')) {
    $('swapPieceDim').onclick = () => {
      change(s => {
        const tmp = s.pw;
        s.pw = s.ph;
        s.ph = tmp;
        s.edits = {};
        s.extras = [];
        s.suggestSelectedId = '';
        selected = null;
      });
    };
  }

  if ($('swapSheetDim')) {
    $('swapSheetDim').onclick = () => {
      change(s => {
        const tmp = s.sw;
        s.sw = s.sh;
        s.sh = tmp;
        s.edits = {};
        s.extras = [];
        selected = null;
      });
    };
  }

  if ($('freeBleedEnabled')) {
    $('freeBleedEnabled').onchange = e => {
      const enabled = e.target.checked;
      change(s => {
        if (enabled) {
          s.bleed = lastFreeBleed > 0 ? lastFreeBleed : 3;
          s.bleedMarks = true;
        } else {
          if (Number(s.bleed) > 0) lastFreeBleed = Number(s.bleed);
          s.bleed = 0;
          s.bleedMarks = false;
        }
        s.edits = {};
        s.extras = [];
        selected = null;
      });
    };
  }

  if ($('paperPreset')) {
    $('paperPreset').onchange = e => {
      if (e.target.value) {
        change(s => {
          [s.sw, s.sh] = e.target.value.split(',').map(Number);
          if (s.plateW < s.sw + 40) s.plateW = s.sw + 60;
          if (s.plateH < s.sh + s.plateGrip + 20) s.plateH = s.sh + s.plateGrip + 40;
          s.edits = {};
          s.extras = [];
          selected = null;
        });
      }
    };
  }

  $('fields').querySelectorAll('[data-quickpaper]').forEach(btn => {
    btn.onclick = () => {
      const [sw, sh] = btn.dataset.quickpaper.split(',').map(Number);
      change(s => {
        s.sw = sw;
        s.sh = sh;
        if (s.plateW < s.sw + 40) s.plateW = s.sw + 60;
        if (s.plateH < s.sh + s.plateGrip + 20) s.plateH = s.sh + s.plateGrip + 40;
        s.edits = {};
        s.extras = [];
        selected = null;
      });
    };
  });

  $('fields').querySelectorAll('[data-quickgap]').forEach(btn => {
    btn.onclick = () => {
      const gVal = Number(btn.dataset.quickgap);
      change(s => {
        s.gapX = gVal;
        s.gapY = gVal;
        s.edits = {};
        s.extras = [];
        s.suggestSelectedId = '';
        selected = null;
      });
    };
  });

  if ($('platePreset')) {
    $('platePreset').onchange = e => {
      if (e.target.value) {
        change(s => {
          const [pw, ph, pg] = e.target.value.split(',').map(Number);
          s.plateW = pw;
          s.plateH = ph;
          s.plateGrip = pg;
          s.plateView = true;
        });
      }
    };
  }
}

function handleReactiveNumberInput(el) {
  const raw = el.value.trim();
  const minVal = el.min !== '' ? Number(el.min) : 0;
  const num = Number(raw);
  const key = el.dataset.key;

  if (raw === '' || !Number.isFinite(num) || num < minVal) {
    markPending();
    return;
  }

  if ($('calcFeedback')) {
    $('calcFeedback').textContent = '⏳ Atualizando folha…';
    $('calcFeedback').classList.add('is-typing');
  }

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (activeInputSnapshot) {
      history.push(activeInputSnapshot);
      if (history.length > 80) history.shift();
      future = [];
      activeInputSnapshot = null;
    }
    if (GEOMETRY_KEYS.includes(key) && state[key] !== num) {
      state.edits = {};
      state.extras = [];
      state.suggestSelectedId = '';
      selected = null;
    }
    if (state.mode === 'suggest' && key === 'qty' && state[key] !== num) {
      state.suggestSelectedId = '';
    }
    state[key] = num;
    if (state.mode === 'free' && key === 'bleed') {
      if (num > 0) {
        lastFreeBleed = num;
        state.bleedMarks = true;
      } else {
        state.bleed = 0;
        state.bleedMarks = false;
      }
    }
    if (state.mode === 'visual' && key === 'left') {
      state.right = num;
    }
    pending = false;
    updateOutputs();
    if ($('calcFeedback')) {
      $('calcFeedback').textContent = '⚡ Cálculo automático ativo em tempo real (mm)';
      $('calcFeedback').classList.remove('is-typing');
    }
  }, 180);
}

function commitNumberInputOnBlur(el) {
  clearTimeout(debounceTimer);
  const raw = el.value.trim();
  const num = Number(raw);
  const key = el.dataset.key;
  if (raw !== '' && Number.isFinite(num)) {
    if (state[key] !== num) {
      if (activeInputSnapshot) {
        history.push(activeInputSnapshot);
        if (history.length > 80) history.shift();
        future = [];
      }
      if (GEOMETRY_KEYS.includes(key)) {
        state.edits = {};
        state.extras = [];
        state.suggestSelectedId = '';
        selected = null;
      }
      if (state.mode === 'suggest' && key === 'qty') {
        state.suggestSelectedId = '';
      }
      state[key] = num;
      if (state.mode === 'free' && key === 'bleed') {
        if (num > 0) {
          lastFreeBleed = num;
          state.bleedMarks = true;
        } else {
          state.bleed = 0;
          state.bleedMarks = false;
        }
      }
      pending = false;
      updateOutputs();
    }
  }
  activeInputSnapshot = null;
  if ($('calcFeedback')) {
    $('calcFeedback').textContent = '⚡ Cálculo automático ativo em tempo real (mm)';
    $('calcFeedback').classList.remove('is-typing');
  }
}

function markPending() {
  pending = true;
  $('export').disabled = true;
  $('save').disabled = true;
  $('status').textContent = 'Digite um valor numérico válido ou clique em Recalcular';
  if ($('calcFeedback')) {
    $('calcFeedback').textContent = '⚠ Aguardando número válido…';
    $('calcFeedback').classList.add('is-typing');
  }
}

function applySettings() {
  clearTimeout(debounceTimer);
  change(s => {
    let reset = false;
    $('fields').querySelectorAll('input[type=number][data-key]').forEach(el => {
      const v = el.value === '' ? null : Number(el.value);
      if (GEOMETRY_KEYS.includes(el.dataset.key) && s[el.dataset.key] !== v) reset = true;
      s[el.dataset.key] = v;
    });
    if (s.mode === 'free') {
      if (Number(s.bleed) > 0) {
        lastFreeBleed = Number(s.bleed);
        s.bleedMarks = true;
      } else {
        s.bleed = 0;
        s.bleedMarks = false;
      }
    }
    if (reset) {
      s.edits = {};
      s.extras = [];
      selected = null;
    }
  });
}

function change(fn) {
  clearTimeout(debounceTimer);
  history.push(F.clone(state));
  if (history.length > 80) history.shift();
  future = [];
  fn(state);
  render();
}

function bindCustomPresetControls() {
  const applyDim = (kind, w, h, labelName = '') => {
    change(s => {
      if (s.mode === 'compare') {
        const cur = getCompareList(s);
        const entry = {
          id: `cmp-${Date.now().toString(36)}`,
          name: labelName || `${w}×${h} mm`,
          w,
          h
        };
        if (cur.length < 8) cur.push(entry);
        else cur[cur.length - 1] = entry;
        s.compareSheets = cur;
        return;
      }
      if (kind === 'paper') {
        s.sw = w;
        s.sh = h;
        if (s.plateW < s.sw + 40) s.plateW = s.sw + 60;
        if (s.plateH < s.sh + s.plateGrip + 20) s.plateH = s.sh + s.plateGrip + 40;
      } else {
        s.pw = w;
        s.ph = h;
      }
      s.edits = {};
      s.extras = [];
      selected = null;
    });
  };

  $('fields').querySelectorAll('[data-toggle-custom]').forEach(btn => {
    btn.onclick = () => {
      const kind = btn.dataset.toggleCustom;
      openCustomCreator[kind] = !openCustomCreator[kind];
      render();
    };
  });

  $('fields').querySelectorAll('[data-cancel-custom]').forEach(btn => {
    btn.onclick = () => {
      openCustomCreator[btn.dataset.cancelCustom] = false;
      render();
    };
  });

  $('fields').querySelectorAll('[data-save-custom]').forEach(btn => {
    btn.onclick = () => {
      const kind = btn.dataset.saveCustom;
      const isPaper = kind === 'paper';
      const wKey = isPaper ? 'sw' : 'pw';
      const hKey = isPaper ? 'sh' : 'ph';
      const listKey = isPaper ? 'papers' : 'pieces';
      const wVal = Number($(`customW_${kind}`)?.value);
      const hVal = Number($(`customH_${kind}`)?.value);
      if (!Number.isFinite(wVal) || !Number.isFinite(hVal) || wVal <= 0 || hVal <= 0 || wVal > 25000 || hVal > 25000) {
        $('status').textContent = 'Informe largura e altura válidas (> 0 mm) para cadastrar.';
        return;
      }
      const rawName = String($(`customName_${kind}`)?.value || '').trim();
      const name = (rawName || `${wVal}×${hVal} mm`).slice(0, 60);
      const custom = readCustomPresets();
      custom[listKey].push({
        id: `custom-${kind}-${Date.now().toString(36)}`,
        name,
        [wKey]: Number(wVal.toFixed(2)),
        [hKey]: Number(hVal.toFixed(2))
      });
      saveCustomPresets(custom);
      openCustomCreator[kind] = false;
      applyDim(kind, Number(wVal.toFixed(2)), Number(hVal.toFixed(2)), name);
    };
  });

  $('fields').querySelectorAll('[data-apply-custom]').forEach(btn => {
    btn.onclick = () => {
      const kind = btn.dataset.applyCustom;
      const idx = Number(btn.dataset.idx);
      const isPaper = kind === 'paper';
      const custom = readCustomPresets();
      const item = (isPaper ? custom.papers : custom.pieces)[idx];
      if (!item) return;
      applyDim(kind, isPaper ? item.sw : item.pw, isPaper ? item.sh : item.ph, item.name);
    };
  });

  $('fields').querySelectorAll('[data-del-custom]').forEach(btn => {
    btn.onclick = () => {
      const kind = btn.dataset.delCustom;
      const idx = Number(btn.dataset.idx);
      const listKey = kind === 'paper' ? 'papers' : 'pieces';
      const custom = readCustomPresets();
      custom[listKey].splice(idx, 1);
      saveCustomPresets(custom);
      render();
    };
  });
}

function bindCompareFieldControls() {
  if (state.mode !== 'compare') return;

  const setCompareCount = count => {
    const n = Math.max(1, Math.min(8, Math.round(count)));
    change(s => {
      const cur = getCompareList(s);
      while (cur.length < n) {
        const seed = COMPARE_EXTRA_DEFAULTS[cur.length % COMPARE_EXTRA_DEFAULTS.length];
        cur.push({ id: `cmp-${Date.now().toString(36)}-${cur.length}`, name: seed.name, w: seed.w, h: seed.h });
      }
      s.compareSheets = cur.slice(0, n);
    });
  };

  if ($('compareCount')) {
    $('compareCount').onchange = e => setCompareCount(Number(e.target.value));
  }
  if ($('compareAddBtn')) {
    $('compareAddBtn').onclick = () => setCompareCount(getCompareList(state).length + 1);
  }
  if ($('compareRemoveBtn')) {
    $('compareRemoveBtn').onclick = () => setCompareCount(getCompareList(state).length - 1);
  }

  $('fields').querySelectorAll('[data-cmp-preset]').forEach(sel => {
    sel.onchange = e => {
      if (!e.target.value) return;
      const idx = Number(sel.dataset.cmpPreset);
      const opt = e.target.selectedOptions?.[0];
      const [w, h] = e.target.value.split(',').map(Number);
      const label = opt?.dataset?.cmpLabel || `${w}×${h}`;
      change(s => {
        const cur = getCompareList(s);
        if (!cur[idx]) return;
        cur[idx] = { ...cur[idx], name: label, w, h };
        s.compareSheets = cur;
      });
    };
  });

  $('fields').querySelectorAll('[data-cmp-field]').forEach(inp => {
    const field = inp.dataset.cmpField;
    const idx = Number(inp.dataset.cmpIdx);
    const applyLive = () => {
      const cur = getCompareList(state);
      if (!cur[idx]) return;
      if (field === 'name') {
        cur[idx].name = String(inp.value || '').slice(0, 40) || `Formato ${idx + 1}`;
      } else {
        const val = Number(inp.value);
        if (!Number.isFinite(val) || val <= 0) return;
        cur[idx][field] = val;
      }
      state.compareSheets = cur;
      updateOutputs();
    };
    inp.oninput = applyLive;
    inp.onchange = () => {
      applyLive();
      render();
    };
  });

  $('fields').querySelectorAll('[data-cmp-swap]').forEach(btn => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.cmpSwap);
      change(s => {
        const cur = getCompareList(s);
        if (!cur[idx]) return;
        const w = cur[idx].w;
        cur[idx].w = cur[idx].h;
        cur[idx].h = w;
        s.compareSheets = cur;
      });
    };
  });

  $('fields').querySelectorAll('[data-cmp-del]').forEach(btn => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.cmpDel);
      change(s => {
        const cur = getCompareList(s);
        if (cur.length <= 1) return;
        cur.splice(idx, 1);
        s.compareSheets = cur;
      });
    };
  });

  $('fields').querySelectorAll('[data-cmp-use-sheet]').forEach(btn => {
    btn.onclick = () => {
      const item = getCompareList(state)[Number(btn.dataset.cmpUseSheet)];
      if (!item) return;
      change(s => {
        s.mode = 'flat';
        s.sw = item.w;
        s.sh = item.h;
        if (s.plateW < s.sw + 40) s.plateW = s.sw + 60;
        if (s.plateH < s.sh + s.plateGrip + 20) s.plateH = s.sh + s.plateGrip + 40;
        s.edits = {};
        s.extras = [];
        selected = null;
      });
    };
  });

  $('fields').querySelectorAll('[data-cmp-use-piece]').forEach(btn => {
    btn.onclick = () => {
      const item = getCompareList(state)[Number(btn.dataset.cmpUsePiece)];
      if (!item) return;
      change(s => {
        s.mode = 'flat';
        s.pw = item.w;
        s.ph = item.h;
        s.edits = {};
        s.extras = [];
        selected = null;
      });
    };
  });
}

function setMode(mode) {
  if (mode === state.mode) return;
  change(s => {
    s.mode = mode;
    if (mode === 'suggest') {
      if (s.process === 'plotter') applyProcessProfile(s, 'offset');
      s.suggestSelectedId = '';
      selected = null;
      selectedSlot = null;
      face = 'front';
      sheet = 0;
      return;
    }
    if (mode === 'compare') {
      s.compareSheets = getCompareList(s);
      selected = null;
      selectedSlot = null;
      face = 'front';
      sheet = 0;
      return;
    }
    s.edits = {};
    s.extras = [];
    s.offsetX = 0;
    s.offsetY = 0;
    s.sectionAngle = 0;
    if (mode === 'book') {
      if (s.process === 'plotter') applyProcessProfile(s, 'offset');
      s.pw = 148;
      s.ph = 210;
      if (s.foldPattern === 'F16-1') {
        s.sw = 660;
        s.sh = 480;
      } else if (s.foldPattern === 'F8-1') {
        s.sw = 328;
        s.sh = 478;
      } else {
        s.sw = 450;
        s.sh = 320;
      }
      if (s.style !== 'perfector') s.style = 'sheetwise';
    } else if (mode === 'visual') {
      applyProcessProfile(s, 'plotter');
      s.pw = 800;
      s.ph = 1200;
      s.sw = 1000;
      s.sh = 1500;
      s.gsm = 440;
      s.hem = 30;
      s.weld = 25;
      s.grommetSpacing = 250;
      s.grommetInset = 15;
      s.safeMargin = 35;
    } else if (mode === 'free') {
      if (s.process === 'plotter') applyProcessProfile(s, 'offset');
      s.freeStrategy = 'best';
      s.freeMarginMode = 'auto';
      s.allowMixed = true;
      s.showCutMarks = true;
      s.marks = true;
      if (Number(s.bleed) > 0) lastFreeBleed = Number(s.bleed);
      s.bleedMarks = Number(s.bleed) > 0;
      s.regMarks = false;
      s.centerCrossMarks = false;
      s.colorBar = false;
      s.sheetInfoStrip = false;
      s.gapX = 0;
      s.gapY = 0;
      if (s.pw > 500) {
        s.pw = 90;
        s.ph = 50;
        s.sw = 328;
        s.sh = 478;
      }
    } else {
      if (s.process === 'plotter') applyProcessProfile(s, 'offset');
      if (s.pw > 500) {
        s.pw = 90;
        s.ph = 50;
        s.sw = 328;
        s.sh = 478;
      }
    }
    selected = null;
    selectedSlot = null;
    face = 'front';
    sheet = 0;
  });
}

function rect(x, y, w, h, fill, stroke, extra = '') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="0.45" ${extra}/>`;
}

function text(x, y, str, size = 5, extra = '') {
  return `<text x="${x}" y="${y}" font-family="system-ui,sans-serif" font-size="${size}" text-anchor="middle" fill="#2f4b3f" ${extra}>${str}</text>`;
}

function crops(p, bleed, s = state) {
  const off = Math.max(s.markOffset ?? 2, bleed + 0.4);
  const d = Math.max(1, s.markLength ?? 5);
  const sw = Math.max(0.1, s.markStroke ?? 0.35);
  const { x, y, w, h } = p;
  let out = s.marks
    ? `<path d="M ${x - off - d} ${y} h ${d} M ${x} ${y - off - d} v ${d} M ${x + w + off} ${y} h ${d} M ${x + w} ${y - off - d} v ${d} M ${x - off - d} ${y + h} h ${d} M ${x} ${y + h + off} v ${d} M ${x + w + off} ${y + h} h ${d} M ${x + w} ${y + h + off} v ${d}" stroke="#203029" stroke-width="${sw}" fill="none"/>`
    : '';
  if (s.bleedMarks && bleed > 0) {
    const bx = x - bleed;
    const by = y - bleed;
    const bw = w + 2 * bleed;
    const bh = h + 2 * bleed;
    const boff = Math.max(0.8, (s.markOffset ?? 2) * 0.6);
    const bd = d * 0.75;
    out += `<path d="M ${bx - boff - bd} ${by} h ${bd} M ${bx} ${by - boff - bd} v ${bd} M ${bx + bw + boff} ${by} h ${bd} M ${bx + bw} ${by - boff - bd} v ${bd} M ${bx - boff - bd} ${by + bh} h ${bd} M ${bx} ${by + bh + boff} v ${bd} M ${bx + bw + boff} ${by + bh} h ${bd} M ${bx + bw} ${by + bh + boff} v ${bd}" stroke="#2b6cb0" stroke-width="${(sw * 0.85).toFixed(2)}" stroke-dasharray="1.2 0.8" fill="none"/>`;
  }
  return out;
}

function drawCenterCrossMarks(sw, sh, a, strokeW = 0.3) {
  const cx = sw / 2;
  const cy = sh / 2;
  const topY = Math.max(3, a.y / 2);
  const botY = Math.min(sh - 3, a.y + a.h + (sh - (a.y + a.h)) / 2);
  const leftX = Math.max(3, a.x / 2);
  const rightX = Math.min(sw - 3, a.x + a.w + (sw - (a.x + a.w)) / 2);
  const arm = 3.2;
  const cross = (x, y) =>
    `<path d="M ${x - arm} ${y} h ${arm * 2} M ${x} ${y - arm} v ${arm * 2}" stroke="#1d2d26" stroke-width="${strokeW}" fill="none"/><circle cx="${x}" cy="${y}" r="1.4" stroke="#1d2d26" stroke-width="${strokeW * 0.85}" fill="none"/>`;
  return `<g aria-label="Cruzes de centro da folha">${cross(cx, topY)}${cross(cx, botY)}${cross(leftX, cy)}${cross(rightX, cy)}</g>`;
}

function drawSheetInfoStrip(s, res) {
  const slugY = s.sh - 1.8;
  const info = `FOLHA ${s.sw}×${s.sh} mm · PEÇA ${s.pw}×${s.ph} mm (SANGRIA ${s.bleed} mm · GAP ${s.gapX}×${s.gapY} mm) · ${res.count} UP (${res.layoutNote || ''}) · APROVEITAMENTO ${res.usage.toFixed(1)}%`;
  return `<g aria-label="Tira técnica da folha">${text(s.sw / 2, slugY, escapeHTML(info), Math.min(3.1, Math.max(2.1, s.sw / 130)), 'fill="#354b41" font-weight="600"')}</g>`;
}

function drawPreflightOverlay(s, res, viewW = s.sw, viewH = s.sh) {
  if (s.showPreflightOverlay === false) return '';
  const markers = res.preflightMarkers || [];
  const hasIssues = res.errors.length > 0 || res.warnings.length > 0 || markers.length > 0;
  if (!hasIssues) return '';

  const u = Math.max(2.6, Math.min(viewW, viewH) / 95);
  let out = `<defs>
    <pattern id="preflightErrHatch" width="${(u * 2.2).toFixed(1)}" height="${(u * 2.2).toFixed(1)}" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="${(u * 2.2).toFixed(1)}" stroke="#d93829" stroke-width="${(u * 0.55).toFixed(2)}" stroke-opacity="0.38"/>
    </pattern>
    <pattern id="preflightWarnHatch" width="${(u * 2.4).toFixed(1)}" height="${(u * 2.4).toFixed(1)}" patternTransform="rotate(-45 0 0)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="${(u * 2.4).toFixed(1)}" stroke="#d97706" stroke-width="${(u * 0.5).toFixed(2)}" stroke-opacity="0.32"/>
    </pattern>
  </defs>`;

  out += `<g class="preflight-overlay" aria-label="Alertas visuais do Preflight">`;

  for (const m of markers) {
    const isErr = m.level === 'error';
    const strokeCol = isErr ? '#c92a2a' : '#d97706';
    const fillPat = isErr ? 'url(#preflightErrHatch)' : 'url(#preflightWarnHatch)';
    const bx = m.x;
    const by = m.y;
    const bw = Math.max(u * 4, m.w);
    const bh = Math.max(u * 3, m.h);
    out += `<rect x="${bx.toFixed(2)}" y="${by.toFixed(2)}" width="${bw.toFixed(2)}" height="${bh.toFixed(2)}" rx="${(u * 0.5).toFixed(2)}" fill="${fillPat}" stroke="${strokeCol}" stroke-width="${(u * 0.32).toFixed(2)}" stroke-dasharray="${(u * 0.9).toFixed(1)} ${(u * 0.45).toFixed(1)}"/>`;

    const labelStr = `⚠ ${m.label}`;
    const pillW = Math.min(viewW * 0.85, Math.max(u * 16, labelStr.length * u * 0.62));
    const pillH = u * 1.9;
    const px = Math.min(viewW - pillW - u, Math.max(u, bx + bw / 2 - pillW / 2));
    const py = Math.min(viewH - pillH - u, Math.max(u, by + bh / 2 - pillH / 2));
    out += `<rect x="${px.toFixed(2)}" y="${py.toFixed(2)}" width="${pillW.toFixed(2)}" height="${pillH.toFixed(2)}" rx="${(pillH / 2).toFixed(2)}" fill="${strokeCol}" fill-opacity="0.94" stroke="#ffffff" stroke-width="${(u * 0.14).toFixed(2)}"/>`;
    out += text(px + pillW / 2, py + pillH * 0.68, escapeHTML(labelStr), u * 0.92, 'fill="#ffffff" font-weight="700"');
  }

  const hudLines = [
    ...res.errors.slice(0, 2).map(e => ({ isErr: true, txt: `● ERRO: ${e}` })),
    ...res.warnings.slice(0, 2).map(w => ({ isErr: false, txt: `△ AVISO: ${w}` }))
  ];
  if (hudLines.length > 0) {
    const lineH = u * 1.55;
    const hudH = u * 1.2 + hudLines.length * lineH;
    const maxChars = Math.max(...hudLines.map(l => l.txt.length));
    const hudW = Math.min(viewW * 0.92, Math.max(u * 26, maxChars * u * 0.48));
    const hx = Math.max(u * 0.8, (viewW - hudW) / 2);
    const hy = u * 0.8;
    const borderCol = res.errors.length > 0 ? '#c92a2a' : '#d97706';
    out += `<rect x="${hx.toFixed(2)}" y="${hy.toFixed(2)}" width="${hudW.toFixed(2)}" height="${hudH.toFixed(2)}" rx="${(u * 0.6).toFixed(2)}" fill="#ffffff" fill-opacity="0.94" stroke="${borderCol}" stroke-width="${(u * 0.28).toFixed(2)}"/>`;
    hudLines.forEach((l, idx) => {
      const shortTxt = l.txt.length > 88 ? l.txt.slice(0, 86) + '…' : l.txt;
      out += text(
        hx + hudW / 2,
        hy + u * 1.35 + idx * lineH,
        escapeHTML(shortTxt),
        u * 0.84,
        `fill="${l.isErr ? '#b91c1c' : '#92400e'}" font-weight="700"`
      );
    });
  }

  out += `</g>`;
  return out;
}

function drawRegTarget(cx, cy, r = 2.6) {
  return `<g stroke="#263830" stroke-width="0.25" fill="none">
    <circle cx="${cx}" cy="${cy}" r="${r}"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.45}"/>
    <path d="M ${cx - r * 1.4} ${cy} h ${r * 2.8} M ${cx} ${cy - r * 1.4} v ${r * 2.8}"/>
  </g>`;
}

function drawColorBar(sw, y, h, left, right, isPB = false) {
  const barW = Math.max(40, sw - left - right - 20);
  const x0 = (sw - barW) / 2;
  const patches = isPB
    ? ['#000000', '#222222', '#444444', '#666666', '#888888', '#aaaaaa', '#cccccc', '#e0e0e0']
    : ['#00a0e3', '#e5007f', '#ffed00', '#1d1d1b', '#00a0e388', '#e5007f88', '#ffed0088', '#1d1d1b88', '#444444', '#888888', '#cccccc'];
  const patchW = 6;
  const count = Math.max(8, Math.min(48, Math.floor(barW / patchW)));
  const actualW = barW / count;
  const ph = Math.min(5, Math.max(2.5, h - 2));
  const py = y + (h - ph) / 2;
  let out = `<g aria-label="Barra de controle densitométrica">`;
  for (let i = 0; i < count; i++) {
    out += `<rect x="${(x0 + i * actualW).toFixed(2)}" y="${py.toFixed(2)}" width="${actualW.toFixed(2)}" height="${ph.toFixed(2)}" fill="${patches[i % patches.length]}" stroke="#ffffff" stroke-width="0.15"/>`;
  }
  out += `</g>`;
  return out;
}

function drawSideGuide(sw, sh, side) {
  const isLeft = side === 'left';
  const x = isLeft ? 0 : sw;
  const dir = isLeft ? 1 : -1;
  const y = sh * 0.55;
  return `<g aria-label="Esquadro lateral ${isLeft ? 'esquerdo' : 'direito'}">
    <polygon points="${x},${y} ${x + dir * 5.5},${y - 3.2} ${x + dir * 5.5},${y + 3.2}" fill="#d4882a"/>
    <text x="${x + dir * 7}" y="${y + 1.2}" font-family="system-ui,sans-serif" font-size="3.2" text-anchor="${isLeft ? 'start' : 'end'}" fill="#8a5210" font-weight="700">ESQUADRO</text>
  </g>`;
}

function drawPlateFrame(s) {
  const px = (s.sw - s.plateW) / 2;
  const py = s.sh + s.plateGrip - s.plateH;
  const pw = s.plateW;
  const ph = s.plateH;
  const bottomY = py + ph;
  const cx = s.sw / 2;

  let out = `<g aria-label="Chapa CTP ${pw}x${ph}mm">`;
  out += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="2" fill="#d7e1e8" stroke="#687d8c" stroke-width="0.7"/>`;
  out += `<line x1="${px}" y1="${bottomY - 8}" x2="${px + pw}" y2="${bottomY - 8}" stroke="#7b909f" stroke-width="0.35" stroke-dasharray="4 2"/>`;
  out += text(cx, py + 6, `CHAPA CTP · ${pw} × ${ph} mm · ${s.screenLpi} LPI · Furação: ${s.platePunch.toUpperCase()}`, Math.min(4.2, pw / 65), 'fill="#2c4454" font-weight="700"');

  if (s.platePunch !== 'none') {
    const offsets = s.platePunch === 'bacher' ? [-110, 0, 110] : s.platePunch === 'heidelberg' ? [-140, -45, 45, 140] : [-100, 100];
    for (const off of offsets) {
      if (Math.abs(off) < pw / 2 - 12) {
        out += `<rect x="${cx + off - 4}" y="${bottomY - 5.5}" width="8" height="3.2" rx="1.2" fill="#445866"/>`;
      }
    }
  }

  if (s.plateGrip > 0) {
    out += `<path d="M ${cx} ${s.sh} v ${s.plateGrip}" stroke="#2c4454" stroke-width="0.4" stroke-dasharray="1.5 1.5"/>`;
    out += text(cx, s.sh + s.plateGrip / 2 + 1.2, `Pinça de chapa → papel: ${s.plateGrip} mm`, Math.min(3.6, s.plateGrip * 0.4), 'fill="#2c4454" font-weight="700"');
  }
  out += `</g>`;
  return out;
}

function drawMechanicalOverlays(s, p) {
  let out = '';
  if (s.dieCut) {
    out += `<rect x="${p.x + 0.6}" y="${p.y + 0.6}" width="${p.w - 1.2}" height="${p.h - 1.2}" rx="${Math.min(4, Math.min(p.w, p.h) * 0.08)}" fill="none" stroke="#d91b77" stroke-width="0.45"/>`;
  }
  if (s.perforation) {
    const off = Math.min(p.w - 4, Math.max(3, s.perfOffset || 20));
    const px = p.x + off;
    out += `<line x1="${px}" y1="${p.y}" x2="${px}" y2="${p.y + p.h}" stroke="#b84a27" stroke-width="0.4" stroke-dasharray="1.5 1.2"/>`;
  }
  if (s.crease && s.mode === 'flat') {
    const cx = p.x + p.w / 2;
    out += `<line x1="${cx}" y1="${p.y - 1.5}" x2="${cx}" y2="${p.y + p.h + 1.5}" stroke="#2b6cb0" stroke-width="0.4" stroke-dasharray="2.5 1"/>`;
  }
  if (s.drill && s.mode === 'flat') {
    const r = Math.min(2.2, Math.min(p.w, p.h) * 0.05);
    const h1 = p.y + p.h * 0.3;
    const h2 = p.y + p.h * 0.7;
    out += `<circle cx="${p.x + 6}" cy="${h1}" r="${r}" fill="#ffffff" stroke="#445866" stroke-width="0.35"/>`;
    out += `<circle cx="${p.x + 6}" cy="${h2}" r="${r}" fill="#ffffff" stroke="#445866" stroke-width="0.35"/>`;
  }
  if (s.numbering) {
    const nw = Math.min(18, p.w * 0.28);
    const nh = Math.min(7, p.h * 0.18);
    const nx = p.x + p.w - nw - 3;
    const ny = p.y + p.h - nh - 3;
    out += `<rect x="${nx}" y="${ny}" width="${nw}" height="${nh}" fill="#fff8e8" stroke="#c27d28" stroke-width="0.25"/>`;
    out += text(nx + nw / 2, ny + nh * 0.7, 'Nº 0001', Math.min(3.2, nh * 0.65), 'fill="#9c4221" font-weight="700"');
  }
  if (s.padding && s.mode === 'flat') {
    out += `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="1.8" fill="#d9483b"/>`;
  }
  return out;
}

function drawVisualCommunication(s, vInfo) {
  const cutW = vInfo.cutW;
  const cutH = vInfo.cutH;
  const pad = Math.max(40, Math.min(cutW, cutH) * 0.08);
  const fSize = Math.max(12, Math.min(cutW, cutH) * 0.032);
  const strokeW = Math.max(1.5, Math.min(cutW, cutH) * 0.003);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${cutW + pad * 2} ${cutH + pad * 2}" width="${cutW + pad * 2}mm" height="${cutH + pad * 2}mm" role="img" aria-label="Esquema de Comunicação Visual ${s.pw}x${s.ph}mm">`;
  svg += `<rect x="0" y="0" width="${cutW}" height="${cutH}" fill="#e6ecf0" stroke="#647a8a" stroke-width="${strokeW}" stroke-dasharray="${strokeW * 4} ${strokeW * 2}"/>`;

  const fx = vInfo.hem;
  const fy = vInfo.hem + vInfo.polePocketTop;

  if (vInfo.polePocketTop > 0) {
    svg += `<rect x="${fx}" y="${vInfo.hem}" width="${s.pw}" height="${vInfo.polePocketTop}" fill="#d6e2ec" stroke="#4f6d82" stroke-width="${strokeW * 0.8}" stroke-dasharray="${strokeW * 3} ${strokeW * 2}"/>`;
    svg += text(fx + s.pw / 2, vInfo.hem + vInfo.polePocketTop / 2 + fSize * 0.3, `BOLSA DE BASTÃO SUPERIOR · ${vInfo.polePocketTop} mm`, fSize * 0.75, 'fill="#2c4a60" font-weight="700"');
  }
  if (vInfo.polePocketBottom > 0) {
    const by = fy + s.ph;
    svg += `<rect x="${fx}" y="${by}" width="${s.pw}" height="${vInfo.polePocketBottom}" fill="#d6e2ec" stroke="#4f6d82" stroke-width="${strokeW * 0.8}" stroke-dasharray="${strokeW * 3} ${strokeW * 2}"/>`;
    svg += text(fx + s.pw / 2, by + vInfo.polePocketBottom / 2 + fSize * 0.3, `BOLSA DE BASTÃO INFERIOR · ${vInfo.polePocketBottom} mm`, fSize * 0.75, 'fill="#2c4a60" font-weight="700"');
  }

  svg += `<rect x="${fx}" y="${fy}" width="${s.pw}" height="${s.ph}" fill="#dce8cf" stroke="#284f40" stroke-width="${strokeW * 1.3}"/>`;

  if (vInfo.safeMargin > 0 && s.pw > vInfo.safeMargin * 2 && s.ph > vInfo.safeMargin * 2) {
    svg += `<rect x="${fx + vInfo.safeMargin}" y="${fy + vInfo.safeMargin}" width="${s.pw - vInfo.safeMargin * 2}" height="${s.ph - vInfo.safeMargin * 2}" fill="none" stroke="#2b6cb0" stroke-width="${strokeW * 0.9}" stroke-dasharray="${strokeW * 4} ${strokeW * 2.5}"/>`;
    svg += text(
      fx + s.pw / 2,
      fy + vInfo.safeMargin + fSize * 1.1,
      `ÁREA DE SEGURANÇA ESTRUTURAL (recuo ${vInfo.safeMargin} mm)`,
      fSize * 0.7,
      'fill="#2b6cb0" font-weight="700"'
    );
  }

  if (vInfo.numPanels > 1) {
    const panelStep = cutW / vInfo.numPanels;
    for (let i = 1; i < vInfo.numPanels; i++) {
      const sx = i * panelStep;
      const wHalf = (vInfo.weld || 25) / 2;
      svg += `<rect x="${sx - wHalf}" y="0" width="${wHalf * 2}" height="${cutH}" fill="#d9822b33" stroke="#c06014" stroke-width="${strokeW * 0.8}" stroke-dasharray="${strokeW * 3} ${strokeW * 2}"/>`;
      svg += text(sx, cutH / 2 - fSize, `SOLDA ${i} (${vInfo.weld} mm)`, fSize * 0.75, 'fill="#9c4221" font-weight="700"');
    }
    for (let i = 0; i < vInfo.numPanels; i++) {
      const pxCenter = (i + 0.5) * panelStep;
      svg += text(pxCenter, fy + s.ph / 2 + fSize * 1.6, `PANO ${i + 1} (${vInfo.panels[i].w} mm)`, fSize * 0.85, 'fill="#243e36" font-weight="700"');
    }
  }

  const gRadius = Math.max(6, Math.min(cutW, cutH) * 0.012);
  for (const g of vInfo.grommets) {
    const gx = fx + g.x;
    const gy = fy + g.y;
    svg += `<circle cx="${gx}" cy="${gy}" r="${gRadius}" fill="#ffffff" stroke="#b85d19" stroke-width="${strokeW * 1.1}"/>`;
    svg += `<circle cx="${gx}" cy="${gy}" r="${gRadius * 0.45}" fill="#445866"/>`;
  }

  svg += text(
    fx + s.pw / 2,
    fy + s.ph / 2,
    `FORMATO VISÍVEL ${s.pw} × ${s.ph} mm`,
    fSize * 1.15,
    'fill="#1e372f" font-weight="800"'
  );
  svg += text(
    cutW / 2,
    -pad * 0.35,
    `CORTE BRUTO C/ BAINHA (${vInfo.hem} mm): ${cutW} × ${cutH} mm · ${vInfo.grommetsPerPiece} ILHÓS`,
    fSize * 0.8,
    'fill="#36544a" font-weight="700"'
  );

  svg += drawPreflightOverlay(s, result, cutW, cutH);
  svg += '</svg>';
  return svg;
}

function drawCompareSheets(s, cmp) {
  const items = cmp.items || [];
  if (!items.length) return '';
  const maxW = Math.max(...items.map(i => i.w));
  const maxH = Math.max(...items.map(i => i.h));
  const showMeta = s.compareShowMetrics !== false;
  const overlay = s.compareLayout === 'overlay';
  const strokeBase = Math.max(0.6, Math.min(2.4, Math.max(maxW, maxH) * 0.0032));
  const baseFont = Math.max(7, Math.min(24, Math.max(maxW, maxH) * 0.036));
  const padX = Math.max(18, Math.round(maxW * 0.09));
  const padTop = Math.max(24, Math.round(maxH * 0.1));
  const padBot = Math.max(26, Math.round(maxH * 0.13));

  if (overlay) {
    const sorted = items
      .map((item, idx) => ({ item, idx, col: COMPARE_COLORS[idx % COMPARE_COLORS.length] }))
      .sort((a, b) => b.item.areaMm2 - a.item.areaMm2);
    const viewW = maxW + padX * 2;
    const viewH = maxH + padTop + padBot;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-padX} ${-padTop} ${viewW} ${viewH}" width="${viewW}mm" height="${viewH}mm" role="img" aria-label="Comparação de formatos sobrepostos">`;
    svg += `<rect x="${-padX}" y="${-padTop}" width="${viewW}" height="${viewH}" fill="#f8f9f6"/>`;
    for (const entry of sorted) {
      const { item, col } = entry;
      svg += `<rect x="0" y="0" width="${item.w}" height="${item.h}" fill="${col.fill}" stroke="${col.stroke}" stroke-width="${(strokeBase * 1.15).toFixed(2)}"/>`;
      if (showMeta) {
        const ty = Math.max(baseFont * 1.1, item.h - baseFont * 0.45);
        const tx = item.w - baseFont * 0.35;
        svg += `<text x="${tx}" y="${ty}" font-family="system-ui,sans-serif" font-size="${(baseFont * 0.72).toFixed(1)}" font-weight="700" text-anchor="end" fill="${col.solid}">#${item.index} ${escapeHTML(item.name)} (${item.w}×${item.h})</text>`;
      }
    }
    svg += `<text x="${maxW / 2}" y="${maxH + baseFont * 1.35}" font-family="system-ui,sans-serif" font-size="${(baseFont * 0.85).toFixed(1)}" font-weight="700" text-anchor="middle" fill="#203029">Sobreposição no canto (0, 0) · ${items.length} formatos em escala 1:1 (mm)</text>`;
    svg += '</svg>';
    return svg;
  }

  const gap = Math.max(18, Math.round(maxW * 0.14));
  const totalW = items.reduce((sum, it) => sum + it.w, 0) + gap * Math.max(0, items.length - 1);
  const viewW = totalW + padX * 2;
  const viewH = maxH + padTop + padBot;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-padX} ${-padTop} ${viewW} ${viewH}" width="${viewW}mm" height="${viewH}mm" role="img" aria-label="Comparação de folhas lado a lado">`;
  svg += `<rect x="${-padX}" y="${-padTop}" width="${viewW}" height="${viewH}" fill="#f8f9f6"/>`;
  svg += `<line x1="0" y1="${maxH}" x2="${totalW}" y2="${maxH}" stroke="#9aa896" stroke-width="${(strokeBase * 0.85).toFixed(2)}" stroke-dasharray="3 2"/>`;
  if (items.length > 1) {
    svg += `<line x1="0" y1="0" x2="${totalW}" y2="0" stroke="#c8d1c4" stroke-width="${(strokeBase * 0.65).toFixed(2)}" stroke-dasharray="2 3"/>`;
  }

  let curX = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const col = COMPARE_COLORS[i % COMPARE_COLORS.length];
    const yTop = maxH - item.h;
    const cx = curX + item.w / 2;
    const cy = yTop + item.h / 2;
    const innerScale = Math.max(5.5, Math.min(baseFont * 0.95, Math.min(item.w * 0.12, item.h * 0.15)));

    svg += `<rect x="${curX}" y="${yTop}" width="${item.w}" height="${item.h}" fill="${col.fill}" stroke="${col.stroke}" stroke-width="${(strokeBase * 1.15).toFixed(2)}"/>`;
    svg += `<text x="${cx}" y="${cy - innerScale * 0.55}" font-family="system-ui,sans-serif" font-size="${(innerScale * 1.05).toFixed(1)}" font-weight="700" text-anchor="middle" dominant-baseline="middle" fill="${col.solid}">#${item.index} · ${escapeHTML(item.name)}</text>`;
    svg += `<text x="${cx}" y="${cy + innerScale * 0.65}" font-family="ui-monospace,monospace" font-size="${(innerScale * 0.85).toFixed(1)}" font-weight="600" text-anchor="middle" dominant-baseline="middle" fill="#203029">${item.w} × ${item.h} mm</text>`;
    if (showMeta) {
      svg += `<text x="${cx}" y="${yTop - baseFont * 0.45}" font-family="ui-monospace,monospace" font-size="${(baseFont * 0.7).toFixed(1)}" font-weight="700" text-anchor="middle" fill="${col.solid}">${item.areaCm2.toLocaleString('pt-BR')} cm² (${item.ratioVsFirst}×)</text>`;
      svg += `<text x="${cx}" y="${maxH + baseFont * 1.15}" font-family="ui-monospace,monospace" font-size="${(baseFont * 0.7).toFixed(1)}" text-anchor="middle" fill="#3a4c42">${item.w} × ${item.h} mm</text>`;
    }
    curX += item.w + gap;
  }

  svg += '</svg>';
  return svg;
}

let suggestShowAll = false;

function computeWithCustomPapers(s = state) {
  const custom = readCustomPresets();
  return F.compute({ ...s, customPapers: custom.papers });
}

function applySuggestionToMode(item, targetMode = 'flat') {
  if (!item) return;
  const margins = result?.suggestInfo?.margins;
  change(s => {
    s.mode = targetMode;
    s.sw = item.sw;
    s.sh = item.sh;
    if (targetMode === 'flat') {
      if (margins) {
        if (s.suggestMarginPreset === 'offset') applyProcessProfile(s, 'offset');
        else if (s.suggestMarginPreset === 'digital') applyProcessProfile(s, 'digital');
        s.left = margins.left;
        s.right = margins.right;
        s.grip = margins.grip;
        s.tail = margins.tail;
        s.bar = margins.bar;
      }
      if (item.strategyKey === 'mixed') {
        s.allowMixed = true;
        s.orientation = 'mixed';
      } else {
        s.orientation = item.strategyKey === 'rotate' ? 'rotate' : 'normal';
      }
      if (s.plateW < s.sw + 40) s.plateW = s.sw + 60;
      if (s.plateH < s.sh + s.plateGrip + 20) s.plateH = s.sh + s.plateGrip + 40;
    } else if (targetMode === 'free') {
      s.freeStrategy = item.strategyKey || 'best';
      s.allowMixed = item.strategyKey === 'mixed' ? true : s.allowMixed !== false;
      s.freeMarginMode = s.suggestMarginPreset === 'zero' ? 'auto' : 'custom';
      if (margins && s.freeMarginMode === 'custom') {
        s.left = margins.left;
        s.right = margins.right;
        s.grip = margins.grip;
        s.tail = margins.tail;
        s.bar = margins.bar;
      }
    }
    s.edits = {};
    s.extras = [];
    selected = null;
    selectedSlot = null;
    face = 'front';
    sheet = 0;
  });
}

function drawMiniSuggestionSvg(item) {
  if (!item || !item.sw || !item.sh) return '';
  const pad = Math.max(4, Math.min(item.sw, item.sh) * 0.03);
  const a = item.area;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${item.sw + pad * 2} ${item.sh + pad * 2}" class="suggest-mini-svg" aria-hidden="true">`;
  out += `<rect x="0" y="0" width="${item.sw}" height="${item.sh}" rx="2" fill="#f7f9f5" stroke="#98a895" stroke-width="${Math.max(1.2, item.sw * 0.004).toFixed(2)}"/>`;
  if (a) {
    out += `<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="none" stroke="#c3d0c1" stroke-width="${Math.max(0.8, item.sw * 0.0025).toFixed(2)}" stroke-dasharray="4 3"/>`;
  }
  const strokeW = Math.max(0.7, Math.min(item.sw, item.sh) * 0.003);
  const maxDraw = Math.min(item.items.length, 260);
  for (let i = 0; i < maxDraw; i++) {
    const p = item.items[i];
    const isRot = p.angle === 90 || p.angle === 270;
    const fill = item.strategyKey === 'mixed' && isRot ? '#f3dfa8' : '#cfe2bf';
    const stroke = item.strategyKey === 'mixed' && isRot ? '#b57b1b' : '#4a6b48';
    out += `<rect x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" width="${p.w.toFixed(1)}" height="${p.h.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW.toFixed(2)}"/>`;
  }
  out += '</svg>';
  return out;
}

function renderSuggestGallery(suggestInfo, activeSuggestion) {
  const gallery = $('suggestGallery');
  if (!gallery) return;
  if (state.mode !== 'suggest' || !suggestInfo) {
    gallery.hidden = true;
    gallery.innerHTML = '';
    return;
  }
  gallery.hidden = false;

  const list = suggestInfo.suggestions || [];
  const fmt = n => (Number.isFinite(n) ? n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—');

  const sortButtons = [
    ['usage', 'Melhor aproveitamento %'],
    ['effective', 'Menor desperdício real'],
    ['count', 'Mais peças/folha'],
    ['area', 'Menor consumo (m²)']
  ]
    .map(
      ([k, label]) =>
        `<button type="button" class="${state.suggestSort === k ? 'active' : ''}" data-suggest-sort="${k}">${label}</button>`
    )
    .join('');

  if (!list.length) {
    gallery.innerHTML = `
      <div class="suggest-empty-card">
        <h3>Nenhuma folha padrão comporta ${suggestInfo.pw} × ${suggestInfo.ph} mm ${suggestInfo.bleed ? `(+${suggestInfo.bleed} mm de sangria)` : ''}</h3>
        <p>Com as margens e o filtro atual (${escapeHTML(suggestInfo.familyFilter)}), a peça excede as folhas planas cadastradas. Você pode remover o filtro de família, testar sem margens ou abrir direto em Grandes Formatos (Plotter).</p>
        <div class="editactions">
          ${state.suggestFamily !== 'all' ? '<button type="button" id="suggestClearFamilyBtn">Mostrar todas as folhas</button>' : ''}
          ${state.suggestMarginPreset !== 'zero' ? '<button type="button" id="suggestTryZeroMarginBtn">Testar sem margens</button>' : ''}
          <button type="button" class="primary" id="suggestJumpVisualBtn">Abrir em Grandes Formatos (Plotter) →</button>
        </div>
      </div>
    `;
    if ($('suggestClearFamilyBtn')) {
      $('suggestClearFamilyBtn').onclick = () => change(s => { s.suggestFamily = 'all'; s.suggestSelectedId = ''; });
    }
    if ($('suggestTryZeroMarginBtn')) {
      $('suggestTryZeroMarginBtn').onclick = () => change(s => { s.suggestMarginPreset = 'zero'; s.suggestSelectedId = ''; });
    }
    if ($('suggestJumpVisualBtn')) {
      $('suggestJumpVisualBtn').onclick = () => {
        const keepW = state.pw;
        const keepH = state.ph;
        change(s => {
          s.mode = 'visual';
          applyProcessProfile(s, 'plotter');
          s.pw = keepW;
          s.ph = keepH;
          s.sw = Math.max(1000, Math.ceil((keepW + 100) / 100) * 100);
          s.sh = Math.max(1500, Math.ceil((keepH + 100) / 100) * 100);
        });
      };
    }
    return;
  }

  const visibleList = suggestShowAll ? list : list.slice(0, 9);
  const cardsHtml = visibleList
    .map(item => {
      const isActive = activeSuggestion && activeSuggestion.id === item.id;
      const isTop = item.rank === 1;
      return `
        <article class="suggest-card ${isActive ? 'is-selected' : ''} ${isTop ? 'is-top' : ''}" data-suggest-pick="${escapeHTML(item.id)}" tabindex="0" role="button" aria-pressed="${isActive ? 'true' : 'false'}">
          <div class="suggest-card-head">
            <span class="suggest-rank">${isTop ? '★ #1' : `#${item.rank}`}</span>
            <span class="suggest-family-pill is-${escapeHTML(item.family)}">${escapeHTML(item.familyLabel)}</span>
          </div>
          <div class="suggest-card-title">
            <h4>${escapeHTML(item.name)}</h4>
            <p>${item.sw} × ${item.sh} mm · ${escapeHTML(item.sheetOrientation)}</p>
          </div>
          <div class="suggest-mini-wrap">
            ${drawMiniSuggestionSvg(item)}
          </div>
          <div class="suggest-kpis">
            <div><b>${fmt(item.count)}</b><span>peças/fl</span></div>
            <div><b>${item.sheetUsagePct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</b><span>folha</span></div>
            <div><b>${fmt(item.totalSheets)}</b><span>fls (${fmt(suggestInfo.qty)} un)</span></div>
            <div><b>${item.totalLossPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</b><span>perda real</span></div>
          </div>
          <div class="suggest-meta-line">
            <span>${escapeHTML(item.layoutNote)}</span>
            ${item.nobelOrigin ? `<small title="Corte a partir da folha matriz">${escapeHTML(item.nobelOrigin)}</small>` : ''}
          </div>
          <div class="suggest-tags">
            ${item.tags.map(t => `<span class="suggest-tag ${t.includes('★') ? 'is-accent' : ''}">${escapeHTML(t)}</span>`).join('')}
          </div>
          <div class="suggest-card-actions">
            <button type="button" class="primary" data-suggest-apply-flat="${escapeHTML(item.id)}">Aplicar em Peças →</button>
            <button type="button" data-suggest-apply-free="${escapeHTML(item.id)}">Rápida</button>
          </div>
        </article>
      `;
    })
    .join('');

  gallery.innerHTML = `
    <div class="suggest-gallery-head">
      <div>
        <h3>Sugestões de Imposição para ${suggestInfo.pw} × ${suggestInfo.ph} mm</h3>
        <p>${list.length} folha(s) compatível(is) avaliada(s) em Retrato e Paisagem · Clique em um card para visualizar acima em escala real.</p>
      </div>
      <div class="suggest-sort-bar" role="group" aria-label="Ordenação rápida">${sortButtons}</div>
    </div>
    <div class="suggest-cards-grid">${cardsHtml}</div>
    ${
      list.length > 9
        ? `<div class="suggest-more-row"><button type="button" id="suggestToggleMoreBtn">${suggestShowAll ? 'Mostrar apenas top 9' : `Ver todas as ${list.length} folhas sugeridas`}</button></div>`
        : ''
    }
  `;

  gallery.querySelectorAll('[data-suggest-sort]').forEach(btn => {
    btn.onclick = () => {
      change(s => {
        s.suggestSort = btn.dataset.suggestSort;
        s.suggestSelectedId = '';
      });
    };
  });

  gallery.querySelectorAll('[data-suggest-pick]').forEach(card => {
    const selectCard = e => {
      if (e.target.closest('button')) return;
      state.suggestSelectedId = card.dataset.suggestPick;
      updateOutputs();
      $('stage')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    card.onclick = selectCard;
    card.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectCard(e);
      }
    };
  });

  gallery.querySelectorAll('[data-suggest-apply-flat]').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const target = list.find(x => x.id === btn.dataset.suggestApplyFlat);
      applySuggestionToMode(target, 'flat');
    };
  });

  gallery.querySelectorAll('[data-suggest-apply-free]').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const target = list.find(x => x.id === btn.dataset.suggestApplyFree);
      applySuggestionToMode(target, 'free');
    };
  });

  if ($('suggestToggleMoreBtn')) {
    $('suggestToggleMoreBtn').onclick = () => {
      suggestShowAll = !suggestShowAll;
      renderSuggestGallery(result.suggestInfo, result.activeSuggestion);
    };
  }
}

function draw() {
  if (state.mode === 'suggest' && !result.activeSuggestion) {
    $('stage').innerHTML = `<div class="suggest-stage-empty"><strong>Peça ${state.pw} × ${state.ph} mm excede as folhas padrão filtradas.</strong><span>Ajuste o filtro ou escolha Grandes Formatos (Plotter) nos cartões abaixo.</span></div>`;
    lastSvg = '';
    return;
  }
  if (!result.area) {
    $('stage').textContent = 'Revise os dados do trabalho para gerar a montagem.';
    lastSvg = '';
    return;
  }
  const isSuggest = state.mode === 'suggest' && Boolean(result.activeSuggestion);
  const sugMargins = result.suggestInfo?.margins || {};
  const s = isSuggest
    ? {
        ...state,
        mode: 'flat',
        sw: result.activeSuggestion.sw,
        sh: result.activeSuggestion.sh,
        left: sugMargins.left ?? state.left,
        right: sugMargins.right ?? state.right,
        grip: sugMargins.grip ?? state.grip,
        tail: sugMargins.tail ?? state.tail,
        bar: sugMargins.bar ?? state.bar,
        process: sugMargins.process || state.process,
        plateView: false
      }
    : state;

  if (s.mode === 'compare' && result.compareInfo) {
    const svg = drawCompareSheets(s, result.compareInfo);
    lastSvg = svg;
    $('stage').innerHTML = `<div class="stage-canvas">${svg}</div>`;
    applyStageZoom();
    return;
  }

  if (s.mode === 'visual' && result.visualInfo) {
    const svg = drawVisualCommunication(s, result.visualInfo);
    lastSvg = svg;
    $('stage').innerHTML = `<div class="stage-canvas">${svg}</div>`;
    applyStageZoom();
    return;
  }

  const isFree = s.mode === 'free';
  const showMarks = isFree ? true : s.showCutMarks !== false;
  const a = result.area;
  const back = !isFree && face === 'back' && (s.mode === 'book' || s.style !== 'single');
  const guides = F.pressGuides(s, back);
  const showPlate = !isFree && result.usesPlates && s.plateView;

  const padX = showPlate ? Math.max(16, (s.plateW - s.sw) / 2 + 12) : 12;
  const padTop = showPlate ? Math.max(16, s.plateH - s.sh - s.plateGrip + 12) : 12;
  const padBot = showPlate ? Math.max(16, s.plateGrip + 12) : 12;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-padX} ${-padTop} ${s.sw + padX * 2} ${s.sh + padTop + padBot}" width="${s.sw + padX * 2}mm" height="${s.sh + padTop + padBot}mm" role="img" aria-label="Esquema de imposição, ${back ? 'verso' : 'frente'}">`;

  if (showPlate) {
    svg += drawPlateFrame(s);
  }

  svg += rect(0, 0, s.sw, s.sh, 'white', '#adb8a9');

  const gripOnTop = guides.gripper === 'top';
  if (!isFree || s.freeMarginMode === 'custom') {
    const gripY = gripOnTop ? 0 : s.sh - s.grip;
    const tailY = gripOnTop ? s.sh - s.tail : 0;
    svg += rect(0, gripY, s.sw, s.grip, result.usesPlates ? '#f7e6c4' : '#ecefe9', 'none');
    svg += rect(0, tailY, s.sw, s.tail, '#eef0eb', 'none');

    if (showMarks && s.colorBar && s.bar > 0) {
      const barY = gripOnTop ? s.grip : s.tail;
      svg += rect(0, barY, s.sw, s.bar, '#f3f1ec', 'none');
      svg += drawColorBar(s.sw, barY, s.bar, a.x, a.x, s.process === 'pb');
    }

    const gripLabel = result.usesPlates
      ? `PINÇA (${gripOnTop ? 'BORDA OPOSTA / TRASEIRA' : 'BORDA DIANTEIRA'}) · ${s.grip} mm`
      : `MARGEM NÃO IMPRIMÍVEL (${s.process.toUpperCase()}) · ${s.grip} mm`;
    if (s.grip > 0) {
      svg += text(
        s.sw / 2,
        gripOnTop ? Math.min(s.grip - 1.2, 5) : s.sh - Math.max(1.5, s.grip * 0.25),
        gripLabel,
        Math.min(3.8, Math.max(2.6, s.grip / 2 + 0.6)),
        'fill="#855114" font-weight="600"'
      );
    }
  } else if (!isFree && showMarks && s.colorBar) {
    const pos = s.colorBarPos || 'top';
    if (pos === 'top' || pos === 'both') {
      svg += drawColorBar(s.sw, 1.5, 4.5, a.x, a.x, false);
    }
    if (pos === 'bottom' || pos === 'both') {
      svg += drawColorBar(s.sw, s.sh - (s.sheetInfoStrip ? 9.5 : 6), 4.5, a.x, a.x, false);
    }
  }

  svg += rect(a.x, a.y, a.w, a.h, 'none', '#95a590', 'stroke-dasharray="3 2"');

  if (!isFree && s.grain !== 'none') {
    svg += text(s.sw - 18, gripOnTop ? s.sh - 3 : 5, s.grain === 'y' ? 'FIBRA ↕' : 'FIBRA ↔', 3.2);
  }

  if (!isFree && showMarks && s.regMarks) {
    svg += drawSideGuide(s.sw, s.sh, guides.side);
    const rx1 = Math.max(3.2, a.x / 2);
    const rx2 = Math.min(s.sw - 3.2, s.sw - a.x / 2);
    const ryMid = a.y + a.h / 2;
    svg += drawRegTarget(rx1, ryMid, Math.min(2.6, Math.max(1.8, a.x * 0.28)));
    svg += drawRegTarget(rx2, ryMid, Math.min(2.6, Math.max(1.8, a.x * 0.28)));
    svg += drawRegTarget(s.sw / 2, Math.max(3.5, a.y - 3.5), 2.2);
    svg += drawRegTarget(s.sw / 2, Math.min(s.sh - 3.5, a.y + a.h + 3.5), 2.2);
  }

  if (!isFree && showMarks && s.centerCrossMarks) {
    svg += drawCenterCrossMarks(s.sw, s.sh, a, s.markStroke || 0.3);
  }

  if (s.mode === 'book' && result.items.length) {
    const p = { ...result.items[0] };
    const entry = result.plan[sheet];
    if (back) p.x = s.sw - p.x - p.w;

    const cells = back ? entry.backCells : entry.frontCells;
    const cols = entry.cols;
    const rows = entry.rows;
    const headGap = p.headGap || 0;
    const faceGap = p.faceGap || 0;
    const millGap = p.millingAllowance || 0;
    const bindMargin = p.bindingMargin || 0;

    svg += `<g data-piece="section" role="button" tabindex="0" aria-label="Selecionar caderno" transform="rotate(${p.angle} ${p.x + p.w / 2} ${p.y + p.h / 2})">`;
    svg += rect(
      p.x - s.bleed,
      p.y - s.bleed,
      p.w + 2 * s.bleed,
      p.h + 2 * s.bleed,
      '#f2f5eb',
      '#93a783',
      'stroke-dasharray="2 1"'
    );

    for (let rIdx = 0; rIdx < rows; rIdx++) {
      for (let cIdx = 0; cIdx < cols; cIdx++) {
        const cell = cells[rIdx][cIdx];
        const pairIdx = Math.floor(cIdx / 2);
        const inPairRight = cIdx % 2 === 1;
        const x = p.x + cIdx * s.pw + pairIdx * (millGap + faceGap) + (inPairRight ? millGap : 0);
        const y = p.y + rIdx * (s.ph + headGap);
        const cx = x + s.pw / 2;
        const cy = y + s.ph / 2;
        const isSlotSelected = selectedSlot === cell.slotPage;

        svg += `<g data-slot="${cell.slotPage}">`;
        svg += rect(
          x,
          y,
          s.pw,
          s.ph,
          cell.isBlank ? '#f4f5f2' : back ? '#d8e5ee' : '#e0ecd4',
          isSlotSelected ? '#d38b28' : selected === 'section' ? '#5e7e52' : '#809873',
          isSlotSelected ? 'style="stroke-width:1.4"' : ''
        );

        if (bindMargin > 0 && bindMargin < s.pw * 0.45) {
          const bmX = inPairRight ? x : x + s.pw - bindMargin;
          svg += `<rect x="${bmX}" y="${y}" width="${bindMargin}" height="${s.ph}" fill="#c8852722" stroke="none"/>`;
          if (s.binding === 'spiral' || s.binding === 'wireo' || s.drill) {
            const holeX = inPairRight ? x + bindMargin / 2 : x + s.pw - bindMargin / 2;
            const holeSteps = 8;
            for (let hIdx = 1; hIdx < holeSteps; hIdx++) {
              const hy = y + (s.ph * hIdx) / holeSteps;
              svg += s.binding === 'wireo'
                ? `<rect x="${holeX - 1.1}" y="${hy - 1.1}" width="2.2" height="2.2" fill="#ffffff" stroke="#5a6d7c" stroke-width="0.3"/>`
                : `<circle cx="${holeX}" cy="${hy}" r="1.1" fill="#ffffff" stroke="#5a6d7c" stroke-width="0.3"/>`;
            }
          }
        }

        const marginIn = Math.max(bindMargin, Math.min(10, s.pw * 0.12));
        const contentX = x + marginIn + cell.dx;
        const contentY = y + Math.min(18, s.ph * 0.12);
        const contentW = Math.max(2, s.pw - 2 * marginIn);
        const contentH = Math.max(2, s.ph - 2 * Math.min(18, s.ph * 0.12));
        svg += rect(contentX, contentY, contentW, contentH, 'none', '#95a588', 'stroke-dasharray="2 1.5"');

        const headArrow = cell.angle === 180 ? '↓ CABEÇA (180°)' : '↑ CABEÇA (0°)';
        const headY = cell.angle === 180 ? y + s.ph - 8 : y + 10;
        const footY = cell.angle === 180 ? y + 10 : y + s.ph - 7;
        svg += text(cx, headY, headArrow, Math.min(4.2, s.pw / 18), 'font-weight="600"');
        svg += text(
          cx,
          cy,
          cell.isBlank ? `BRANCO (${cell.slotPage})` : String(cell.page),
          Math.min(22, Math.min(s.pw, s.ph) / 4.2),
          `dominant-baseline="middle" font-weight="700" transform="rotate(${cell.angle} ${cx} ${cy})"`
        );
        svg += text(
          cx + cell.dx,
          footY,
          `creep ${cell.shift.toFixed(2)} mm`,
          Math.min(3.3, s.pw / 22),
          'fill="#5c6e62"'
        );
        svg += `</g>`;
      }
    }

    const pat = F.FOLD_PATTERNS[s.foldPattern] || F.FOLD_PATTERNS['F4-1'];
    if (pat.code === 'F4-1' || pat.code === 'LOOSE-2') {
      const fx = p.x + p.w / 2;
      svg += `<path d="M ${fx} ${p.y - 4} v ${p.h + 8}" stroke="#c27d28" stroke-width="0.7" stroke-dasharray="3 1.5"/>`;
      svg += text(fx, p.y - 5, pat.code === 'LOOSE-2' ? 'CORTE CENTRAL (2-UP)' : '1ª DOBRA (LOMBADA)', 3.2, 'fill="#9c5e14" font-weight="700"');
    } else if (pat.code === 'F8-1') {
      const fy = p.y + s.ph + headGap / 2;
      const fx = p.x + p.w / 2;
      svg += `<path d="M ${p.x - 4} ${fy} h ${p.w + 8}" stroke="#b84a27" stroke-width="0.7" stroke-dasharray="4 1.5"/>`;
      svg += text(p.x + p.w + 6, fy + 1, '1ª DOBRA', 3.1, 'fill="#b84a27" font-weight="700" text-anchor="start"');
      svg += `<path d="M ${fx} ${p.y - 4} v ${p.h + 8}" stroke="#c27d28" stroke-width="0.7" stroke-dasharray="3 1.5"/>`;
      svg += text(fx, p.y - 5, '2ª DOBRA (LOMBADA)', 3.2, 'fill="#9c5e14" font-weight="700"');
    } else if (pat.code === 'F16-1') {
      const fxCenter = p.x + p.w / 2;
      const fy = p.y + s.ph + headGap / 2;
      const fxSpineRight = p.x + s.pw * 3 + millGap * 1.5 + faceGap;
      svg += `<path d="M ${fxCenter} ${p.y - 4} v ${p.h + 8}" stroke="#2b6cb0" stroke-width="0.7" stroke-dasharray="4 1.5"/>`;
      svg += text(fxCenter, p.y - 5, '1ª DOBRA (VERTICAL)', 3.1, 'fill="#2b6cb0" font-weight="700"');
      svg += `<path d="M ${p.x - 4} ${fy} h ${p.w + 8}" stroke="#b84a27" stroke-width="0.7" stroke-dasharray="4 1.5"/>`;
      svg += text(p.x + p.w + 5, fy + 1, '2ª DOBRA', 3.1, 'fill="#b84a27" font-weight="700" text-anchor="start"');
      svg += `<path d="M ${fxSpineRight} ${p.y - 3} v ${p.h + 6}" stroke="#c27d28" stroke-width="0.7" stroke-dasharray="3 1.5"/>`;
      svg += text(fxSpineRight, p.y + p.h + 7, '3ª DOBRA (LOMBADA)', 3.1, 'fill="#9c5e14" font-weight="700"');
    }

    if (showMarks && s.collationMarks && !back) {
      const spineX = pat.code === 'F16-1' ? p.x + s.pw * 3 + millGap * 1.5 + faceGap : p.x + p.w / 2;
      const stepH = Math.min(10, Math.max(4, s.ph / (result.plan.length + 2)));
      const stepY = p.y + (rows === 2 ? s.ph + headGap : 0) + 12 + sheet * stepH;
      svg += `<rect x="${spineX - 1.5}" y="${stepY}" width="3" height="${stepH}" fill="#1d1d1b"/>`;
      svg += text(spineX, stepY - 1.2, `CAD. ${sheet + 1}`, 2.6, 'fill="#1d1d1b" font-weight="700"');
    }

    if (showMarks && (s.marks || s.bleedMarks)) svg += crops(p, s.bleed, s);
    svg += '</g>';
  } else {
    for (const original of result.items) {
      const p = { ...original };
      if (back && (s.style === 'sheetwise' || s.style === 'perfector')) {
        if (s.style === 'sheetwise') p.x = s.sw - p.x - p.w;
        if (s.style === 'perfector') {
          p.y = s.sh - p.y - p.h;
          p.angle = (p.angle + 180) % 360;
        }
        p.label = 'V';
      }
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      const mixedAltColor = (isSuggest || isFree || s.orientation === 'mixed') && (p.angle === 90 || p.angle === 270) && (p.sku || 'A') === 'A' && result.items.some(it => it.angle === 0);
      const pal = mixedAltColor ? SKU_PALETTE.B : (SKU_PALETTE[p.sku || 'A'] || SKU_PALETTE.A);
      const fill = p.label === 'V' ? pal.back : pal.front;
      const isSel = !isSuggest && selected === p.source;

      svg += `<g data-piece="${p.source}" role="button" tabindex="0" aria-label="Selecionar peça ${p.source} SKU ${p.sku || 'A'}">`;
      if (!isFree || (s.bleed > 0 && s.bleedMarks !== false)) {
        svg += rect(
          p.x - s.bleed,
          p.y - s.bleed,
          p.w + 2 * s.bleed,
          p.h + 2 * s.bleed,
          '#f1f4ea',
          '#a5b195',
          'stroke-dasharray="1 1"'
        );
      }
      svg += rect(
        p.x,
        p.y,
        p.w,
        p.h,
        fill,
        isSel && !isFree ? '#d28b26' : pal.stroke,
        isSel && !isFree ? 'style="stroke-width:1.5"' : ''
      );
      if (!isFree) svg += drawMechanicalOverlays(s, p);
      const tag = s.style === 'single' || isFree ? p.sku || 'A' : `${p.label}·${p.sku || 'A'}`;
      svg += text(
        cx,
        cy,
        `↑ ${tag}`,
        Math.min(p.w, p.h) / 4.8,
        `dominant-baseline="middle" font-weight="600" transform="rotate(${p.angle} ${cx} ${cy})"`
      );
      if (showMarks && (s.marks || s.bleedMarks)) svg += crops(p, s.bleed, s);
      svg += '</g>';
    }
  }

  if (s.mode === 'flat' && s.style === 'turn') {
    svg += `<path d="M ${s.sw / 2} 0 v ${s.sh}" stroke="#ce8a35" stroke-dasharray="3 2" stroke-width="0.65"/>`;
    svg += text(s.sw / 2, 5, 'EIXO DE VIRADA (TURN)', 3.2, 'fill="#a66418" font-weight="700"');
  }
  if (s.mode === 'flat' && s.style === 'tumble') {
    svg += `<path d="M 0 ${s.sh / 2} h ${s.sw}" stroke="#ce8a35" stroke-dasharray="3 2" stroke-width="0.65"/>`;
    svg += text(24, s.sh / 2 - 2, 'EIXO DE CAMBALHOTA (TUMBLE)', 3.2, 'fill="#a66418" font-weight="700"');
  }

  if (!isFree && showMarks && s.sheetInfoStrip) {
    svg += drawSheetInfoStrip(s, result);
  }

  if (!isFree) svg += drawPreflightOverlay(s, result, s.sw, s.sh);

  svg += '</svg>';
  lastSvg = svg;
  $('stage').innerHTML = `<div class="stage-canvas">${svg}</div>`;
  applyStageZoom();

  if (!isSuggest) {
    $('stage').querySelectorAll('[data-piece]').forEach(el => {
      const pick = e => {
        if (stageDragged) return;
        const slotEl = e.target.closest('[data-slot]');
        if (slotEl) selectedSlot = Number(slotEl.dataset.slot);
        selected = el.dataset.piece;
        draw();
        inspector();
      };
      el.onclick = pick;
      el.onkeydown = e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selected = el.dataset.piece;
          draw();
          inspector();
        }
      };
    });
  }
}

function inspector() {
  const sec = $('inspectorSection');
  const badge = $('inspectorBadge');
  if (state.mode === 'suggest') {
    const act = result.activeSuggestion;
    if (sec) sec.classList.toggle('has-selection', Boolean(act));
    if (badge) {
      badge.textContent = act ? `#${act.rank} · ${act.name}` : 'Sem folha compatível';
      badge.classList.toggle('is-selected', Boolean(act));
    }
    if (!act) {
      $('selectionHelp').textContent = 'Nenhuma folha do filtro atual comporta esta peça. Ajuste os critérios ou use Grandes Formatos.';
      $('inspector').innerHTML = '';
      return;
    }
    $('selectionHelp').textContent = `Prévia ativa: ${act.name} (${act.sw} × ${act.sh} mm · ${act.sheetOrientation}) — ${act.count} peças/folha com ${act.sheetUsagePct}% de aproveitamento.`;
    $('inspector').innerHTML = `
      <p class="note">
        <b>Estratégia:</b> ${escapeHTML(act.strategyTitle)} (${escapeHTML(act.layoutNote)})<br>
        <b>Tiragem (${state.qty.toLocaleString('pt-BR')} un.):</b> ${act.totalSheets.toLocaleString('pt-BR')} folhas (${act.grossAreaM2.toLocaleString('pt-BR')} m² · ${act.massKg.toLocaleString('pt-BR')} kg)<br>
        <b>Perda real total:</b> ${act.totalLossPct.toLocaleString('pt-BR')}% · <b>Cortes est.:</b> ~${act.cutsEstimate}
        ${act.nobelOrigin ? `<br><b>Corte matriz:</b> ${escapeHTML(act.nobelOrigin)}` : ''}
      </p>
      <div class="editactions">
        <button id="inspectorApplySuggestFlat" type="button" class="wide primary">Aplicar em Peças avulsas →</button>
        <button id="inspectorApplySuggestFree" type="button" class="wide">Abrir em Montagem rápida →</button>
      </div>
    `;
    if ($('inspectorApplySuggestFlat')) {
      $('inspectorApplySuggestFlat').onclick = () => applySuggestionToMode(act, 'flat');
    }
    if ($('inspectorApplySuggestFree')) {
      $('inspectorApplySuggestFree').onclick = () => applySuggestionToMode(act, 'free');
    }
    return;
  }
  if (state.mode === 'compare' && result.compareInfo) {
    const cmp = result.compareInfo;
    if (sec) sec.classList.remove('has-selection');
    if (badge) {
      badge.textContent = `${cmp.count} tamanho(s)`;
      badge.classList.remove('is-selected');
    }
    $('selectionHelp').textContent = `Comparando ${cmp.count} formato(s) em escala real 1:1 (mm). Maior: ${cmp.largest.name} (${cmp.largest.w} × ${cmp.largest.h} mm) · Menor: ${cmp.smallest.name} (${cmp.smallest.w} × ${cmp.smallest.h} mm).`;
    $('inspector').innerHTML = `
      <p class="note"><b>Razão de área (Maior ÷ Menor):</b> ${cmp.maxRatio}×<br><b>Disposição:</b> ${state.compareLayout === 'overlay' ? 'Sobrepostos no canto (0,0)' : 'Lado a lado em escala real'}</p>
      <div class="editactions">
        <button id="toggleCompareLayoutBtn" type="button" class="wide">${state.compareLayout === 'overlay' ? 'Ver lado a lado' : 'Sobrepor no canto (0,0)'}</button>
      </div>
    `;
    if ($('toggleCompareLayoutBtn')) {
      $('toggleCompareLayoutBtn').onclick = () => {
        change(s => {
          s.compareLayout = s.compareLayout === 'overlay' ? 'side' : 'overlay';
        });
      };
    }
    return;
  }

  if (state.mode === 'visual') {
    if (sec) sec.classList.remove('has-selection');
    if (badge) {
      badge.textContent = 'Planta Estrutural';
      badge.classList.remove('is-selected');
    }
    const v = result.visualInfo;
    $('selectionHelp').textContent = v
      ? `Peça de grande formato (${v.finalW} × ${v.finalH} mm) · Corte c/ bainha/bolsa: ${v.cutW} × ${v.cutH} mm.`
      : 'Configure as dimensões do banner/lona na coluna Configurar.';
    $('inspector').innerHTML = v
      ? `<p class="note"><b>Panos de montagem:</b> ${v.numPanels}<br><b>Ilhós por peça:</b> ${v.grommetsPerPiece} (${v.totalGrommets} na tiragem)<br><b>Área total bruta:</b> ${v.totalAreaM2} m²</p>`
      : '';
    return;
  }

  const book = state.mode === 'book';
  const p = result.base?.find(item => item.id === selected);
  if (sec) sec.classList.toggle('has-selection', Boolean(p));
  if (badge) {
    badge.textContent = p ? (book ? `Caderno ativo` : `Peça #${p.id} · SKU ${p.sku || 'A'}`) : 'Coordenadas X/Y';
    badge.classList.toggle('is-selected', Boolean(p));
  }

  $('selectionHelp').textContent = p
    ? book
      ? `Caderno selecionado (${state.foldPattern}). Clique também em qualquer página na folha para substituir ou deixar em branco.`
      : `Peça #${p.id} (Modelo/SKU ${p.sku || 'A'}) selecionada · edite X/Y, gire ou altere o SKU para ganging.`
    : 'Clique em uma peça ou caderno na folha para inspecionar e editar.';
  $('inspector').innerHTML = '';
  if (!p) return;

  const slotInfo = book && selectedSlot
    ? `<div style="margin-top:12px;padding-top:10px;border-top:1px solid #e2e6de">
        <label>Posição de página selecionada: <b>Slot ${selectedSlot}</b>
          <input id="overridePage" type="number" min="1" placeholder="Nº da página" value="${typeof state.pageOverrides?.[selectedSlot] === 'number' ? state.pageOverrides[selectedSlot] : selectedSlot}">
        </label>
        <div class="editactions">
          <button id="applyOverride" type="button">Renumerar página</button>
          <button id="forceBlank" type="button">${state.pageOverrides?.[selectedSlot] === 'blank' ? 'Restaurar página' : 'Forçar Branco'}</button>
        </div>
      </div>`
    : '';

  $('inspector').innerHTML = `
    <div class="inspectgrid">
      <label for="editX">X · mm<input id="editX" type="number" step="0.1" value="${p.x.toFixed(2)}"></label>
      <label for="editY">Y · mm<input id="editY" type="number" step="0.1" value="${p.y.toFixed(2)}"></label>
    </div>
    ${
      !book
        ? `<label style="margin-top:8px" for="editSku">
            <span class="label-head">
              <span class="label-text">Modelo / SKU (Ganging)</span>
              ${infoBtn('ganging', 'Modelo SKU Ganging')}
            </span>
            <select id="editSku">
              <option value="A" ${(p.sku || 'A') === 'A' ? 'selected' : ''}>SKU A (Verde)</option>
              <option value="B" ${p.sku === 'B' ? 'selected' : ''}>SKU B (Âmbar)</option>
              <option value="C" ${p.sku === 'C' ? 'selected' : ''}>SKU C (Lavanda)</option>
              <option value="D" ${p.sku === 'D' ? 'selected' : ''}>SKU D (Coral)</option>
            </select>
          </label>`
        : ''
    }
    <button id="applyPosition" type="button" class="wide primary">Aplicar posição</button>
    <div class="editactions">
      <button id="rotatePiece" type="button">Girar ${book ? '180' : '90'}°</button>
      <button id="centerPiece" type="button">Centralizar</button>
      ${book ? '' : '<button id="duplicate" type="button">Duplicar</button><button id="remove" type="button">Remover</button>'}
    </div>
    ${slotInfo}
  `;

  $('applyPosition').onclick = () => {
    const x = Number($('editX').value);
    const y = Number($('editY').value);
    if ($('editX').value === '' || $('editY').value === '' || ![x, y].every(Number.isFinite)) return;
    change(s => {
      if (book) {
        s.offsetX += x - p.x;
        s.offsetY += y - p.y;
      } else {
        edit(s, p, { x, y });
      }
    });
  };

  for (const id of ['editX', 'editY']) $(id).oninput = markPending;

  if ($('editSku')) {
    $('editSku').onchange = e => {
      change(s => edit(s, p, { sku: e.target.value }));
    };
  }

  $('rotatePiece').onclick = () =>
    change(s => {
      if (book) s.sectionAngle = (s.sectionAngle + 180) % 360;
      else edit(s, p, { angle: (p.angle + 90) % 360, w: p.h, h: p.w, x: p.x + (p.w - p.h) / 2, y: p.y + (p.h - p.w) / 2 });
    });

  $('centerPiece').onclick = () =>
    change(s => {
      if (book) {
        s.offsetX = 0;
        s.offsetY = 0;
      } else {
        const r = result.region || result.area;
        edit(s, p, { x: r.x + (r.w - p.w) / 2, y: r.y + (r.h - p.h) / 2 });
      }
    });

  if (!book) {
    $('duplicate').onclick = () =>
      change(s => {
        const id = 'extra' + Date.now();
        s.extras.push({ ...p, id, x: p.x + p.w + 2 * s.bleed + s.gapX });
        selected = id;
      });
    $('remove').onclick = () =>
      change(s => {
        if (s.extras.some(q => q.id === p.id)) s.extras = s.extras.filter(q => q.id !== p.id);
        else s.edits[p.id] = { deleted: true };
        selected = null;
      });
  }

  if ($('applyOverride')) {
    $('applyOverride').onclick = () => {
      const val = Number($('overridePage').value);
      if (!Number.isInteger(val) || val < 1) return;
      change(s => {
        s.pageOverrides = s.pageOverrides || {};
        if (val === selectedSlot) delete s.pageOverrides[selectedSlot];
        else s.pageOverrides[selectedSlot] = val;
      });
    };
    $('forceBlank').onclick = () => {
      change(s => {
        s.pageOverrides = s.pageOverrides || {};
        if (s.pageOverrides[selectedSlot] === 'blank') delete s.pageOverrides[selectedSlot];
        else s.pageOverrides[selectedSlot] = 'blank';
      });
    };
  }
}

function edit(s, p, values) {
  const i = s.extras.findIndex(q => q.id === p.id);
  if (i >= 0) s.extras[i] = { ...p, ...values };
  else s.edits[p.id] = { ...s.edits[p.id], ...values };
}

function getPreflightActionableNote(msg, isError) {
  const m = msg.toLowerCase();
  if (m.includes('cabe na área útil') || m.includes('nenhuma peça') || m.includes('não cabe')) {
    return 'Consequência: a peça somada à sangria excede a área imprimível. Solução: escolha uma folha maior (ex.: Nobel T4 / SRA3), reduza margens ou diminua a peça.';
  }
  if (m.includes('ultrapassa a área útil') || m.includes('invade')) {
    return 'Consequência: corte da arte na pinça ou margem da máquina. Solução: clique em "Restaurar montagem automática" ou centralize a peça.';
  }
  if (m.includes('sobrepõem') || m.includes('colis')) {
    return 'Consequência: uma peça cortará a outra na guilhotina. Solução: aumente o espaçamento X/Y ou restaure a montagem automática.';
  }
  if (m.includes('chapa ctp')) {
    return 'Consequência: a folha não cabe fisicamente na matriz de alumínio. Solução: selecione um preset de chapa CTP maior na seção Montagem de Chapa CTP.';
  }
  if (m.includes('faca especial')) {
    return 'Consequência: espaço insuficiente para emborrachamento da faca. Solução: aumente o Espaçamento X e Y para pelo menos 6 a 8 mm.';
  }
  if (m.includes('fibra')) {
    return 'Consequência: risco de rachar a dobra ou ondular a lombada. Solução: ajuste o sentido da fibra da folha ou gire o formato de entrada.';
  }
  if (m.includes('contrapinça') || m.includes('tumble') || m.includes('perfector')) {
    return 'Consequência: perda de registro frente/verso na virada de pinça. Solução: iguale a margem de contrapinça ao valor da pinça.';
  }
  if (m.includes('vinco')) {
    return 'Consequência: papéis ≥ 170 g/m² quebram a fibra ao dobrar a seco. Solução: ative o "Vinco mecânico de dobra" na seção de Acabamentos.';
  }
  if (m.includes('ilhós')) {
    return 'Consequência: o anel metálico pode furar textos ou rasgar a borda. Solução: aumente a bainha e a margem interna de segurança.';
  }
  return isError
    ? 'Consequência: bloqueio geométrico de produção. Ajuste as dimensões ou margens destacadas na folha.'
    : 'Recomendação preventiva de oficina para evitar perdas no acabamento.';
}

function updateOutputs() {
  result = computeWithCustomPapers(state);
  sheet = Math.min(sheet, Math.max(0, result.plan.length - 1));
  $('save').disabled = false;

  updateGroupBadgesDom();

  if (state.mode === 'free' && $('freeCompareCards') && result.freeComparison) {
    const container = $('freeCompareCards').parentElement;
    if (container) {
      $('freeCompareCards').outerHTML = renderFreeComparisonCards(result.freeComparison);
      bindFreeStrategyCards();
    }
  }

  $('flatTab').classList.toggle('active', state.mode === 'flat');
  $('bookTab').classList.toggle('active', state.mode === 'book');
  if ($('visualTab')) $('visualTab').classList.toggle('active', state.mode === 'visual');
  if ($('freeTab')) $('freeTab').classList.toggle('active', state.mode === 'free');
  if ($('compareTab')) $('compareTab').classList.toggle('active', state.mode === 'compare');
  if ($('suggestTab')) $('suggestTab').classList.toggle('active', state.mode === 'suggest');

  document.body.dataset.folhaMode = state.mode;
  $('workspace')?.classList.toggle('is-free-mode', state.mode === 'free');
  $('workspace')?.classList.toggle('is-compare-mode', state.mode === 'compare');
  $('workspace')?.classList.toggle('is-suggest-mode', state.mode === 'suggest');
  if (['free', 'compare'].includes(state.mode) && ['check', 'result'].includes(document.body.dataset.mobileView)) {
    document.body.dataset.mobileView = 'stage';
    document.querySelectorAll('#mobileNav button[data-mobile-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mobileTab === 'stage');
    });
  }

  const showMarks = state.showCutMarks !== false;
  if ($('toggleMarksBtn')) {
    $('toggleMarksBtn').disabled = state.mode === 'compare' || state.mode === 'visual' || (state.mode === 'suggest' && !result.activeSuggestion);
    $('toggleMarksBtn').classList.toggle('active', showMarks);
    $('toggleMarksBtn').textContent = showMarks ? '✂ Marcas visíveis' : '✂ Marcas ocultas';
  }
  if ($('showCutMarks')) {
    $('showCutMarks').checked = showMarks;
  }

  const showPreflight = state.showPreflightOverlay !== false;
  if ($('togglePreflightBtn')) {
    $('togglePreflightBtn').disabled = state.mode === 'compare';
    $('togglePreflightBtn').classList.toggle('active', showPreflight);
    $('togglePreflightBtn').textContent = showPreflight ? '👁 Alertas visíveis' : '👁 Alertas ocultos';
  }
  if ($('showPreflightCheck')) {
    $('showPreflightCheck').checked = showPreflight;
  }

  $('front').classList.toggle('active', face === 'front');
  $('back').classList.toggle('active', face === 'back');
  $('front').disabled = state.mode === 'compare' || state.mode === 'suggest';
  $('back').disabled = state.mode === 'compare' || state.mode === 'visual' || state.mode === 'free' || state.mode === 'suggest' || (state.mode === 'flat' && state.style === 'single');
  if ($('back').disabled) face = 'front';

  const guides = F.pressGuides(state, face === 'back');
  const cmpInfo = result.compareInfo;
  const sugAct = result.activeSuggestion;
  const sugInfo = result.suggestInfo;
  $('dimensions').textContent =
    state.mode === 'suggest' && sugInfo
      ? sugAct
        ? `Peça ${sugInfo.pw} × ${sugInfo.ph} mm → Sugestão #${sugAct.rank}: ${sugAct.name} (${sugAct.sw} × ${sugAct.sh} mm · ${sugAct.sheetOrientation}) · ${sugAct.layoutNote}`
        : `Peça ${sugInfo.pw} × ${sugInfo.ph} mm · Nenhuma folha padrão compatível no filtro atual`
      : state.mode === 'compare' && cmpInfo
        ? `${cmpInfo.count} tamanho(s) em escala real 1:1 (mm) · ${state.compareLayout === 'overlay' ? 'Sobrepostos no canto (0,0)' : 'Lado a lado'}`
        : state.mode === 'free'
          ? `Folha ${state.sw} × ${state.sh} mm · Peça ${state.pw} × ${state.ph} mm${state.bleed > 0 && state.bleedMarks !== false ? ` · Sangria ${state.bleed} mm` : ' · Sem sangria'}${state.marks ? ' · Marcas de corte' : ' · Sem marcas de corte'} · ${state.allowMixed !== false ? 'Corte misto' : 'Grade uniforme'}`
          : `${state.sw} × ${state.sh} mm · ${result.processName} · ${result.layoutNote || ''} · ${guides.passNote}`;
  $('canvasTitle').textContent =
    state.mode === 'suggest' && sugInfo
      ? sugAct
        ? `Sugestão #${sugAct.rank}: ${sugAct.name} · ${sugAct.count} ${sugAct.count === 1 ? 'peça' : 'peças'}/fl (${sugAct.sheetUsagePct}%)`
        : `Sugestões de Imposição · Peça ${sugInfo.pw} × ${sugInfo.ph} mm`
      : state.mode === 'compare' && cmpInfo
        ? `Comparação de Formatos (${cmpInfo.items.map(i => i.name).slice(0, 3).join(' × ')}${cmpInfo.count > 3 ? ` +${cmpInfo.count - 3}` : ''})`
        : state.mode === 'book'
          ? `Caderno ${sheet + 1} de ${result.plan.length} (${state.foldPattern})`
          : state.mode === 'visual'
            ? `Planta Estrutural de Grande Formato (${state.pw} × ${state.ph} mm)`
            : state.mode === 'free'
              ? `Montagem Rápida · ${result.count} ${result.count === 1 ? 'peça' : 'peças'}/folha (${result.usage.toFixed(1)}%)`
              : `Montagem da folha (${result.processName})`;

  $('sheetNav').innerHTML =
    state.mode === 'book'
      ? result.plan
          .map(
            (p, i) =>
              `<button type="button" data-sheet="${i}" class="${i === sheet ? 'active' : ''}">Caderno ${i + 1} · F: [${p.front.join(', ')}]</button>`
          )
          .join('')
      : '';

  $('sheetNav').querySelectorAll('button').forEach(el => {
    el.onclick = () => {
      sheet = Number(el.dataset.sheet);
      updateOutputs();
    };
  });

  draw();
  renderSuggestGallery(result.suggestInfo, result.activeSuggestion);
  inspector();

  $('convention').textContent =
    state.mode === 'suggest' && sugInfo
      ? sugAct
        ? `Sugestões automáticas para peça ${sugInfo.pw} × ${sugInfo.ph} mm (${sugInfo.suggestions.length} folhas testadas em Retrato e Paisagem). Clique em qualquer folha abaixo para comparar ou em "Aplicar em Peças" para editar a imposição completa.`
        : `A peça ${sugInfo.pw} × ${sugInfo.ph} mm excede as folhas planas do filtro atual. Remova o filtro de família ou utilize o modo Grandes Formatos (Plotter).`
      : state.mode === 'compare' && cmpInfo
        ? `Comparador proporcional em escala 1:1 (mm): escolha entre 1 e 8 formatos lado a lado ou sobrepostos (0,0), inclusive tamanhos Nobel T9/T8/T4 e os seus tamanhos cadastrados manualmente.`
        : state.mode === 'visual'
          ? `Planta de comunicação visual com bainha dobrada (${state.hem} mm), sobreposição de solda (${state.weld} mm), bolsas de bastão e ilhós a cada ${state.grommetSpacing} mm. A área tracejada azul delimita a zona segura para textos e logotipos.`
          : state.mode === 'free'
            ? `Montagem rápida: compara Retrato (0°), Paisagem (90°)${state.allowMixed !== false ? ' e Corte Misto (0°+90°)' : ''} para encontrar o maior aproveitamento na folha (${result.count} pçs/folha · ${result.usage.toFixed(1)}%), com marcas técnicas de pré-impressão ajustáveis.`
            : state.mode === 'book'
              ? `Imposição editorial ${state.foldPattern} (${result.processName}). Medianiz central: ${state.spineGutter} mm · Margem de encadernação: ${state.bindingMargin} mm · Lombada estimada: ${result.spineWidth} mm. Creep desloca a mancha em direção à lombada.`
              : !result.usesPlates
                ? `${result.processName}: impressão direta sem chapas CTP (${result.clicks.toLocaleString('pt-BR')} cliques previstos). Margem de segurança uniforme nos 4 lados e duplex automático no verso.`
                : state.style === 'turn' || state.style === 'tumble'
                  ? 'A mesma forma (chapa CTP) imprime frente e verso nas duas passagens. No Work-and-turn a pinça é mantida e o esquadro lateral se inverte; no Work-and-tumble a pinça passa para a borda oposta.'
                  : state.style === 'perfector'
                    ? 'Reversão automática (Perfector): frente e verso em 1 única passagem de máquina, trocando a pinça para a borda traseira na reversão.'
                    : 'Frente e verso vistos pelo lado impresso. Sheetwise espelha a posição horizontal no retiro e inverte o lado do esquadro para manter o registro.';

  const fmt = n => (Number.isFinite(n) ? n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—');
  const valid = !result.errors.length;

  const metrics =
    state.mode === 'compare' && cmpInfo
      ? [
          [cmpInfo.count, 'tamanhos comparados', 'sheet_format'],
          [cmpInfo.smallest.areaCm2, `menor área · cm² (${cmpInfo.smallest.name})`, 'trim_size'],
          [cmpInfo.largest.areaCm2, `maior área · cm² (${cmpInfo.largest.name})`, 'sheet_format'],
          [cmpInfo.maxRatio, 'razão maior ÷ menor (×)', 'usage']
        ]
      : state.mode === 'visual' && result.visualInfo
      ? [
          [result.visualInfo.numPanels, 'panos por peça', 'weld'],
          [result.visualInfo.grommetsPerPiece, 'ilhós por peça', 'grommets'],
          [result.visualInfo.totalGrommets, 'ilhós totais na tiragem', 'grommets'],
          [result.visualInfo.totalAreaM2, 'área bruta total · m²', 'hem'],
          [result.visualInfo.cutW, 'largura de corte · mm', 'hem'],
          [result.visualInfo.cutH, 'altura de corte · mm', 'hem'],
          [result.total, 'panos totais (c/ perdas)', 'qty_waste'],
          [result.paperAnalysis?.job?.effectiveUsagePct ?? result.usage, 'aprov. total real · %', 'usage'],
          [result.paperAnalysis?.job?.totalLossPct ?? 0, 'perda total papel · %', 'qty_waste'],
          [result.mass, 'massa estimada · kg', 'ream_mass']
        ]
      : [
          [state.mode === 'book' ? result.plan.length : result.count, state.mode === 'book' ? 'cadernos / exemplar' : 'peças por folha', state.mode === 'book' ? 'signature' : 'imposition'],
          [result.total, 'folhas totais (c/ perdas)', 'qty_waste'],
          [
            result.usesPlates ? result.plates : result.clicks,
            result.usesPlates ? `chapas CTP (${result.forms} forma${result.forms > 1 ? 's' : ''})` : `cliques / impressões (${state.process})`,
            result.usesPlates ? 'ctp_plate' : 'clicks'
          ],
          [result.passes, 'passagens na máquina', 'clicks'],
          [result.usage, 'aprov. na folha · %', 'usage'],
          [result.paperAnalysis?.job?.effectiveUsagePct ?? result.usage, 'aprov. total real · %', 'usage'],
          [result.paperAnalysis?.job?.totalLossPct ?? (100 - result.usage), 'perda total papel · %', 'qty_waste'],
          [result.paperAnalysis?.job?.totalLoss?.massKg ?? 0, 'papel perdido · kg', 'qty_waste'],
          [result.mass, 'massa total · kg', 'ream_mass'],
          [state.mode === 'book' ? result.spineWidth : result.extra, state.mode === 'book' ? 'lombada estimada · mm' : 'sobra na última folha', state.mode === 'book' ? 'spine_width' : 'qty_waste']
        ];

  $('metrics').innerHTML = metrics
    .map(
      ([n, l, termKey]) => `<div class="metric">
        <div class="metric-top">
          <b>${valid ? fmt(n) : '—'}</b>
          ${infoBtn(termKey, l)}
        </div>
        <span>${l}</span>
      </div>`
    )
    .join('');

  const errCount = result.errors.length;
  const warnCount = result.warnings.length;
  const statusEl = $('status');
  if (statusEl) {
    statusEl.classList.toggle('has-error', errCount > 0);
    statusEl.classList.toggle('has-warn', errCount === 0 && warnCount > 0);
    statusEl.textContent =
      errCount > 0
        ? `● ${errCount} erro(s) geométrico(s) — corrija para exportar`
        : warnCount > 0
          ? `△ Montagem válida com ${warnCount} aviso(s) técnico(s)`
          : '✓ Montagem validada · pronta para conferência';
  }
  $('export').disabled = !valid;

  const mBadge = $('mobileCheckBadge');
  if (mBadge) {
    const totalIssues = errCount + warnCount;
    mBadge.hidden = totalIssues === 0;
    mBadge.textContent = String(totalIssues);
    mBadge.style.background = errCount > 0 ? '#b42318' : '#b54708';
  }

  $('checks').innerHTML = `
    <div class="preflight-summary-bar">
      <div class="pf-counts">
        <span class="pf-count-err">● ${errCount} erro(s)</span>
        <span class="pf-count-warn">△ ${warnCount} aviso(s)</span>
      </div>
      <span>${showPreflight ? '👁 Visível na folha' : '🙈 Oculto na folha'}</span>
    </div>
    <p class="preflight-scope-note">Escopo: valida geometria da folha, pinça, margens, chapa CTP, paginação e acabamentos parametrizados (não inspeciona fontes/imagens internas de arquivos PDF).</p>
    <ul class="preflight-list">
      ${result.errors
        .map(
          e => `<li class="preflight-card error">
            <div class="pf-card-head"><span>● ERRO: ${escapeHTML(e)}</span></div>
            <div class="pf-card-fix">${escapeHTML(getPreflightActionableNote(e, true))}</div>
            <div class="pf-card-actions">
              <button type="button" class="pf-focus-btn" data-focus-sheet="1">🔍 Localizar na folha</button>
            </div>
          </li>`
        )
        .join('')}
      ${
        valid
          ? `<li class="preflight-card ok">
              <div class="pf-card-head"><span>✓ Sem colisões ou violações bloqueantes de margem, pinça ou chapa.</span></div>
            </li>`
          : ''
      }
      ${result.warnings
        .map(
          w => `<li class="preflight-card warning">
            <div class="pf-card-head"><span>△ AVISO: ${escapeHTML(w)}</span></div>
            <div class="pf-card-fix">${escapeHTML(getPreflightActionableNote(w, false))}</div>
            <div class="pf-card-actions">
              <button type="button" class="pf-focus-btn" data-focus-sheet="1">🔍 Mostrar na folha</button>
            </div>
          </li>`
        )
        .join('')}
    </ul>
  `;

  $('checks').querySelectorAll('[data-focus-sheet]').forEach(btn => {
    btn.onclick = () => {
      state.showPreflightOverlay = true;
      stagePanX = 0;
      stagePanY = 0;
      setStageZoom(1.15);
      updateOutputs();
      if (window.innerWidth < 1200) {
        setMobileView('stage');
      } else {
        $('stage')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };
  });

  let planHtml = '';
  if (state.mode === 'suggest' && sugInfo) {
    const sugList = sugInfo.suggestions || [];
    if (sugList.length) {
      planHtml += `<p><b>Ranking Completo de Folhas Sugeridas para Peça ${sugInfo.pw} × ${sugInfo.ph} mm (Sangria ${sugInfo.bleed} mm · Tiragem ${fmt(sugInfo.qty)} un.):</b></p>`;
      planHtml += `<table>
        <thead>
          <tr>
            <th>#</th>
            <th>Folha</th>
            <th>Formato (mm)</th>
            <th>Peças/fl</th>
            <th>Estratégia</th>
            <th>Aprov. folha</th>
            <th>Aprov. real</th>
            <th>Folhas totais</th>
            <th>Área / Massa</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          ${sugList
            .map(it => {
              const isAct = sugAct && sugAct.id === it.id;
              return `<tr class="${isAct ? 'is-current-row' : ''}">
                <td><b>${it.rank === 1 ? '★ #1' : `#${it.rank}`}</b></td>
                <td><b>${escapeHTML(it.name)}</b> <small>(${escapeHTML(it.familyLabel)})</small></td>
                <td>${it.sw} × ${it.sh} <small>(${escapeHTML(it.sheetOrientation)})</small></td>
                <td><b>${fmt(it.count)}</b></td>
                <td>${escapeHTML(it.layoutNote)}${it.mixedGain > 0 ? ` <span class="sku-badge">+${it.mixedGain} misto</span>` : ''}</td>
                <td><b>${it.sheetUsagePct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</b></td>
                <td>${it.effectiveUsagePct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</td>
                <td>${fmt(it.totalSheets)} fls <small>(sobra ${fmt(it.extraPieces)})</small></td>
                <td>${it.grossAreaM2.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m² · ${it.massKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</td>
                <td>
                  <button type="button" class="pf-focus-btn" data-plan-pick="${escapeHTML(it.id)}">Ver</button>
                  <button type="button" class="pf-focus-btn" data-plan-apply="${escapeHTML(it.id)}">Aplicar</button>
                </td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>`;
    } else {
      planHtml += `<p>Nenhuma folha padrão compatível encontrada no filtro atual para <b>${sugInfo.pw} × ${sugInfo.ph} mm</b>.</p>`;
    }
  } else if (state.mode === 'compare' && cmpInfo) {
    planHtml += `<p><b>Tabela Comparativa de Tamanhos (Referência #1: ${escapeHTML(cmpInfo.first.name)} · ${cmpInfo.first.w} × ${cmpInfo.first.h} mm):</b></p>`;
    planHtml += `<table>
      <thead>
        <tr>
          <th>#</th>
          <th>Formato</th>
          <th>Largura × Altura</th>
          <th>Área</th>
          <th>Razão vs #1</th>
          <th>Dif. mm vs #1 (ΔL / ΔA)</th>
          <th>Cabem na maior</th>
        </tr>
      </thead>
      <tbody>
        ${cmpInfo.items
          .map((it, idx) => {
            const col = COMPARE_COLORS[idx % COMPARE_COLORS.length];
            const dl = it.deltaW > 0 ? `+${it.deltaW}` : `${it.deltaW}`;
            const dh = it.deltaH > 0 ? `+${it.deltaH}` : `${it.deltaH}`;
            return `<tr>
              <td><span class="compare-color-dot" style="display:inline-block;background:${col.solid}"></span> #${it.index}</td>
              <td><b>${escapeHTML(it.name)}</b> <small>(${it.orientationLabel})</small></td>
              <td><b>${it.w} × ${it.h} mm</b></td>
              <td>${fmt(it.areaCm2)} cm² <small>(${it.areaM2} m²)</small></td>
              <td><b>${it.ratioVsFirst}×</b> <small>(${it.pctOfLargest}% da maior)</small></td>
              <td>${idx === 0 ? 'Referência' : `${dl} / ${dh} mm`}</td>
              <td>${it.fitInLargest}× na ${escapeHTML(cmpInfo.largest.name)}</td>
            </tr>`;
          })
          .join('')}
      </tbody>
    </table>`;
  } else if (state.mode === 'free' && result.freeComparison) {
    const fc = result.freeComparison;
    planHtml += `<p><b>Comparativo Automático de Montagem Rápida (Folha ${state.sw} × ${state.sh} mm · Peça ${state.pw} × ${state.ph} mm):</b></p>`;
    planHtml += `<table>
      <thead><tr><th>Estratégia</th><th>Peças / Folha</th><th>Arranjo</th><th>Aproveitamento</th><th>Folhas p/ ${fmt(state.qty)} un.</th></tr></thead>
      <tbody>
        ${['normal', 'rotate', 'mixed']
          .map(k => {
            const it = fc[k];
            const isDisabled = !!it.disabled;
            const isWin = !isDisabled && fc.winnerKey === k && it.count > 0;
            return `<tr>
              <td><b>${it.title}</b> ${isDisabled ? '<span class="sku-badge">DESATIVADO</span>' : isWin ? '<span class="sku-badge">★ MELHOR</span>' : ''}</td>
              <td><b>${isDisabled ? '—' : it.count}</b></td>
              <td>${it.desc}</td>
              <td>${isDisabled ? '—' : `${it.usage}%`}</td>
              <td>${!isDisabled && it.count ? fmt(Math.ceil(state.qty / it.count)) : '—'}</td>
            </tr>`;
          })
          .join('')}
      </tbody>
    </table>`;
  } else if (state.mode === 'visual' && result.visualInfo) {
    const v = result.visualInfo;
    planHtml += `<p><b>Especificação Estrutural de Grande Formato:</b> Formato visível: <b>${v.finalW} × ${v.finalH} mm</b> · Corte bruto com bainha (${v.hem} mm) e bolsas (${v.polePocketTop}/${v.polePocketBottom} mm): <b>${v.cutW} × ${v.cutH} mm</b> · Margem de segurança: <b>${v.safeMargin} mm</b>.</p>`;
    planHtml += `<table>
      <thead><tr><th>Pano</th><th>Largura c/ solda</th><th>Altura de corte</th><th>Solda Esq.</th><th>Solda Dir.</th></tr></thead>
      <tbody>
        ${v.panels.map(p => `<tr><td>Pano #${p.index}</td><td>${p.w} mm</td><td>${p.h} mm</td><td>${p.overlapLeft} mm</td><td>${p.overlapRight} mm</td></tr>`).join('')}
      </tbody>
    </table>`;
  } else if (state.mode === 'book' && result.plan.length) {
    const pat = F.FOLD_PATTERNS[state.foldPattern] || F.FOLD_PATTERNS['F4-1'];
    const bindNames = {
      saddle: 'Grampo / Canoa (Saddle-stitch)',
      perfect: 'Lombada Quadrada (Cola PUR / Hotmelt)',
      spiral: 'Espiral (Furação mecânica)',
      wireo: 'Wire-O (Duplo Anel)',
      pad: 'Blocagem Editorial'
    };
    planHtml += `<p><b>Encadernação:</b> ${bindNames[state.binding] || state.binding} · <b>Lombada estimada:</b> ${result.spineWidth} mm · <b>Medianiz central:</b> ${state.spineGutter} mm · <b>Margem de encadernação:</b> ${state.bindingMargin} mm.</p>`;
    if (pat.folds.length) {
      planHtml += `<p><b>Sequência de dobras (${pat.name}):</b> ${pat.folds.map(f => f.label).join(' → ')}.</p>`;
    }
    planHtml += `<table>
      <thead>
        <tr>
          <th>Caderno</th>
          <th>Padrão</th>
          <th>Frente (ordem na grade)</th>
          <th>Verso (ordem na grade)</th>
          <th>Registro F/V</th>
          <th>Creep máx.</th>
        </tr>
      </thead>
      <tbody>
        ${result.plan
          .map(
            p => `<tr>
              <td>#${p.index + 1}</td>
              <td>${p.pattern} (${p.cols}×${p.rows})</td>
              <td>${p.frontCells
                .map((row, r) => `L${r + 1}: [${row.map(c => (c.isBlank ? 'Branco' : `${c.page}${c.angle ? '↓' : '↑'}`)).join(' | ')}]`)
                .join(' · ')}</td>
              <td>${p.backCells
                .map((row, r) => `L${r + 1}: [${row.map(c => (c.isBlank ? 'Branco' : `${c.page}${c.angle ? '↓' : '↑'}`)).join(' | ')}]`)
                .join(' · ')}</td>
              <td>${p.backingPairs.every(bp => bp.valid) ? '✓ Par ímpar/par OK' : '⚠ Revisar'}</td>
              <td>${p.shift.toFixed(2)} mm</td>
            </tr>`
          )
          .join('')}
      </tbody>
    </table>`;
  } else if (state.mode === 'flat' && result.skuCounts) {
    const activeSkus = Object.entries(result.skuCounts).filter(([, c]) => c > 0);
    planHtml += `<p><b>Distribuição de modelos na folha (Ganging) · Espaçamento ${state.gapX} × ${state.gapY} mm:</b> ${activeSkus
      .map(([k, c]) => `<span class="sku-badge">SKU ${k}: ${c}/folha (${fmt(c * result.net)} un. líquidas)</span>`)
      .join(' ')}</p>`;
  }

  if (result.finishTags && result.finishTags.length) {
    planHtml += `<p><b>Acabamentos, Enobrecimentos e Interferências Mecânicas:</b> ${result.finishTags
      .map(t => `<span class="sku-badge">${escapeHTML(t)}</span>`)
      .join(' ')}</p>`;
  }

  if (state.mode !== 'compare' && (state.mode !== 'suggest' || result.activeSuggestion)) {
    planHtml += `<p><b>Resumo de Produção (${result.processName}):</b> Folhas líquidas: <b>${fmt(result.net)}</b> · Perdas variáveis (${state.waste}%): <b>${fmt(
      result.variableLoss
    )}</b> · Acerto (${state.setup} fls × ${result.forms} formas): <b>${fmt(result.makeready)}</b> · Total bruto: <b>${fmt(
      result.total
    )} folhas</b>.</p>`;

    if (result.usesPlates) {
      planHtml += `<p><b>Especificação de Chapa CTP:</b> ${result.forms} forma(s) × cores (${state.colorsFront}F / ${
        state.style === 'single' ? 0 : state.colorsBack
      }V${state.spotColors ? ` + ${state.spotColors} Pantone` : ''}${state.varnish === 'spot_uv' ? ' + 1 Máscara UV' : ''}) = <b>${result.plates} chapa(s) CTP</b> · Chapa: <b>${state.plateW} × ${
        state.plateH
      } mm</b> · Pinça chapa→papel: <b>${state.plateGrip} mm</b> · Retícula: <b>${state.screenLpi} LPI</b> · Furação: <b>${state.platePunch.toUpperCase()}</b>.</p>`;
    } else if (state.mode !== 'visual') {
      planHtml += `<p><b>Especificação Digital / Laser:</b> Processo sem gravação de chapa (0 chapas) · Total de cliques: <b>${fmt(
        result.clicks
      )}</b> (${state.style === 'single' ? 'Simplex 1 lado' : 'Duplex 2 lados'}) · Passagens na impressora: <b>${fmt(result.passes)}</b>.</p>`;
    }
  }

  if (valid && result.paperAnalysis && state.mode !== 'compare') {
    planHtml += renderPaperAnalysisHtml(result, state, fmt);
  }

  $('plan').innerHTML = planHtml;
  if (state.mode === 'suggest' && sugInfo?.suggestions?.length) {
    $('plan').querySelectorAll('[data-plan-pick]').forEach(btn => {
      btn.onclick = () => {
        state.suggestSelectedId = btn.dataset.planPick;
        updateOutputs();
        $('stage')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
    });
    $('plan').querySelectorAll('[data-plan-apply]').forEach(btn => {
      btn.onclick = () => {
        const target = sugInfo.suggestions.find(x => x.id === btn.dataset.planApply);
        applySuggestionToMode(target, 'flat');
      };
    });
  }
  $('undo').disabled = !history.length;
  $('redo').disabled = !future.length;

  try {
    localStorage.setItem('folha-v5', JSON.stringify(state));
  } catch {}
  scheduleWorkspaceCloudSync();
}

function render() {
  pending = false;
  result = computeWithCustomPapers(state);
  sheet = Math.min(sheet, Math.max(0, result.plan.length - 1));
  fields();
  updateOutputs();
}

/* Contextual Popover (ⓘ) & Glossary Modal */
function showTermPopover(termId, anchorEl) {
  const entry = GLOSSARY[termId];
  const pop = $('termPopover');
  if (!entry || !pop) return;

  activePopoverTermId = termId;
  document.querySelectorAll('.info-btn.is-active').forEach(b => b.classList.remove('is-active'));
  if (anchorEl) anchorEl.classList.add('is-active');

  $('popoverTermCategory').textContent = entry.category;
  $('popoverTermTitle').textContent = entry.term;
  $('popoverTermDef').textContent = entry.shortDefinition;
  $('popoverTermUse').innerHTML = `<b>Na prática:</b> ${escapeHTML(entry.practicalUse)}`;
  $('popoverTermExample').textContent = entry.example ? `Ex.: ${entry.example}` : '';
  $('popoverTermRelated').innerHTML = (entry.related || [])
    .filter(r => GLOSSARY[r])
    .map(r => `<button type="button" class="rel-chip" data-pop-rel="${r}">${escapeHTML(GLOSSARY[r].term.split(' (')[0])}</button>`)
    .join('');

  $('popoverTermRelated').querySelectorAll('[data-pop-rel]').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      showTermPopover(btn.dataset.popRel, anchorEl);
    };
  });

  pop.hidden = false;
  if (anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - popRect.width / 2;
    left = Math.max(12, Math.min(window.innerWidth - popRect.width - 12, left));
    let top = rect.bottom + 8;
    if (top + popRect.height > window.innerHeight - 12) {
      top = Math.max(12, rect.top - popRect.height - 8);
    }
    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(top)}px`;
  }
}

function hideTermPopover() {
  const pop = $('termPopover');
  if (pop) pop.hidden = true;
  activePopoverTermId = null;
  document.querySelectorAll('.info-btn.is-active').forEach(b => b.classList.remove('is-active'));
}

function renderGlossaryList(highlightTermId = null) {
  const q = ($('glossarySearch')?.value || '').trim().toLowerCase();
  const entries = Object.entries(GLOSSARY)
    .filter(([id, item]) => {
      if (activeGlossaryCategory !== 'Todas' && item.category !== activeGlossaryCategory) return false;
      if (!q) return true;
      const hay = `${id} ${item.term} ${item.category} ${item.shortDefinition} ${item.practicalUse} ${item.example}`.toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => a[1].term.localeCompare(b[1].term, 'pt-BR'));

  if ($('glossaryCount')) {
    $('glossaryCount').textContent = `${entries.length} termo(s)`;
  }

  const listEl = $('glossaryList');
  if (!listEl) return;

  if (!entries.length) {
    listEl.innerHTML = `<div class="glossary-card" style="grid-column:1/-1"><p>Nenhum termo encontrado para "<b>${escapeHTML(q)}</b>". Tente limpar o filtro de categoria ou buscar outra palavra.</p></div>`;
    return;
  }

  listEl.innerHTML = entries
    .map(
      ([id, item]) => `<article class="glossary-card ${highlightTermId === id ? 'is-highlighted' : ''}" id="glossary-term-${id}">
        <span class="term-cat-badge" style="align-self:flex-start">${escapeHTML(item.category)}</span>
        <h3>${escapeHTML(item.term)}</h3>
        <p>${escapeHTML(item.shortDefinition)}</p>
        <div class="glossary-card-use"><b>Aplicação prática:</b> ${escapeHTML(item.practicalUse)}</div>
        ${item.example ? `<div class="glossary-card-ex">Ex.: ${escapeHTML(item.example)}</div>` : ''}
        ${
          item.related && item.related.length
            ? `<div class="term-popover-related" style="margin-bottom:0">
                ${item.related
                  .filter(r => GLOSSARY[r])
                  .map(r => `<button type="button" class="rel-chip" data-gloss-jump="${r}">${escapeHTML(GLOSSARY[r].term.split(' (')[0])}</button>`)
                  .join('')}
              </div>`
            : ''
        }
      </article>`
    )
    .join('');

  listEl.querySelectorAll('[data-gloss-jump]').forEach(btn => {
    btn.onclick = () => {
      openGlossaryModal(btn.dataset.glossJump);
    };
  });

  if (highlightTermId) {
    const target = document.getElementById(`glossary-term-${highlightTermId}`);
    if (target) {
      setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 40);
    }
  }
}

function renderGlossaryCategories() {
  const catEl = $('glossaryCategories');
  if (!catEl) return;
  const allCats = ['Todas', ...GLOSSARY_CATEGORIES];
  catEl.innerHTML = allCats
    .map(c => `<button type="button" class="${activeGlossaryCategory === c ? 'active' : ''}" data-gcat="${escapeHTML(c)}">${escapeHTML(c)}</button>`)
    .join('');
  catEl.querySelectorAll('[data-gcat]').forEach(btn => {
    btn.onclick = () => {
      activeGlossaryCategory = btn.dataset.gcat;
      renderGlossaryCategories();
      renderGlossaryList();
    };
  });
}

function openGlossaryModal(termId = null) {
  hideTermPopover();
  const modal = $('glossaryModal');
  if (!modal) return;
  if (termId && GLOSSARY[termId]) {
    activeGlossaryCategory = 'Todas';
    if ($('glossarySearch')) $('glossarySearch').value = '';
  }
  renderGlossaryCategories();
  renderGlossaryList(termId);
  modal.hidden = false;
  if (!termId) {
    $('glossarySearch')?.focus();
  }
}

function closeGlossaryModal() {
  const modal = $('glossaryModal');
  if (modal) modal.hidden = true;
}

let hoverTimer = null;
document.addEventListener('mouseover', e => {
  const infoBtnEl = e.target.closest('.info-btn[data-term]');
  if (!infoBtnEl) return;
  if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    showTermPopover(infoBtnEl.dataset.term, infoBtnEl);
  }, 240);
});

document.addEventListener('mouseout', e => {
  const infoBtnEl = e.target.closest('.info-btn[data-term]');
  if (infoBtnEl) clearTimeout(hoverTimer);
});

document.addEventListener('click', e => {
  const infoBtnEl = e.target.closest('.info-btn[data-term]');
  if (infoBtnEl) {
    e.preventDefault();
    e.stopPropagation();
    const tId = infoBtnEl.dataset.term;
    if (activePopoverTermId === tId && !$('termPopover')?.hidden) {
      hideTermPopover();
    } else {
      showTermPopover(tId, infoBtnEl);
    }
    return;
  }
  if (!e.target.closest('#termPopover')) {
    hideTermPopover();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!$('termPopover')?.hidden) hideTermPopover();
    else if (!$('glossaryModal')?.hidden) closeGlossaryModal();
  }
});

if ($('closeTermPopover')) $('closeTermPopover').onclick = hideTermPopover;
if ($('openGlossaryFromPopover')) {
  $('openGlossaryFromPopover').onclick = () => {
    openGlossaryModal(activePopoverTermId);
  };
}
if ($('openGlossary')) $('openGlossary').onclick = () => openGlossaryModal();
if ($('openGlossaryFromRef')) $('openGlossaryFromRef').onclick = () => openGlossaryModal();
if ($('closeGlossary')) $('closeGlossary').onclick = closeGlossaryModal;
if ($('glossaryModal')) {
  $('glossaryModal').addEventListener('click', e => {
    if (e.target === $('glossaryModal')) closeGlossaryModal();
  });
}
if ($('glossarySearch')) {
  $('glossarySearch').oninput = () => renderGlossaryList();
}

if ($('expandAllGroups')) {
  $('expandAllGroups').onclick = () => {
    const detailsList = Array.from($('fields').querySelectorAll('details.cfg-group'));
    const allOpen = detailsList.every(d => d.open);
    detailsList.forEach(d => {
      d.open = !allOpen;
      if (d.dataset.group) {
        if (!allOpen) openGroups.add(d.dataset.group);
        else openGroups.delete(d.dataset.group);
      }
    });
    $('expandAllGroups').textContent = !allOpen ? 'Recolher avançados' : 'Expandir tudo';
  };
}

/* Mobile & Tablet Task Bar Navigation */
function setMobileView(pane) {
  document.body.dataset.mobileView = pane;
  document.querySelectorAll('#mobileNav [data-mobile-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mobileTab === pane);
  });
}

if ($('mobileNav')) {
  document.body.dataset.mobileView = 'stage';
  $('mobileNav').querySelectorAll('[data-mobile-tab]').forEach(btn => {
    btn.onclick = () => setMobileView(btn.dataset.mobileTab);
  });
}

function templates() {
  let entries = [];
  try {
    entries = JSON.parse(localStorage.getItem('folha-models') || '[]');
  } catch {}
  return Array.isArray(entries) ? entries : [];
}

function listTemplates() {
  $('templates').innerHTML =
    '<option value="">Carregar modelo salvo…</option>' +
    templates()
      .map((t, i) => `<option value="${i}">${escapeHTML(t.name)}</option>`)
      .join('');
}

$('applySettings').onclick = applySettings;
$('flatTab').onclick = () => setMode('flat');
$('bookTab').onclick = () => setMode('book');
if ($('visualTab')) $('visualTab').onclick = () => setMode('visual');
if ($('freeTab')) $('freeTab').onclick = () => setMode('free');
if ($('compareTab')) $('compareTab').onclick = () => setMode('compare');
if ($('suggestTab')) $('suggestTab').onclick = () => setMode('suggest');

function toggleTechnicalMarks(val) {
  state.showCutMarks = typeof val === 'boolean' ? val : state.showCutMarks === false;
  render();
}
if ($('toggleMarksBtn')) {
  $('toggleMarksBtn').onclick = () => toggleTechnicalMarks();
}

function togglePreflightOverlay(val) {
  state.showPreflightOverlay = typeof val === 'boolean' ? val : state.showPreflightOverlay === false;
  updateOutputs();
}
if ($('togglePreflightBtn')) {
  $('togglePreflightBtn').onclick = () => togglePreflightOverlay();
}
if ($('showPreflightCheck')) {
  $('showPreflightCheck').onchange = e => togglePreflightOverlay(e.target.checked);
}
$('front').onclick = () => {
  face = 'front';
  updateOutputs();
};
$('back').onclick = () => {
  face = 'back';
  updateOutputs();
};
$('undo').onclick = () => {
  if (history.length) {
    future.push(F.clone(state));
    state = history.pop();
    selected = null;
    render();
  }
};
$('redo').onclick = () => {
  if (future.length) {
    history.push(F.clone(state));
    state = future.pop();
    selected = null;
    render();
  }
};
$('reset').onclick = () =>
  change(s => {
    s.edits = {};
    s.extras = [];
    s.pageOverrides = {};
    s.offsetX = 0;
    s.offsetY = 0;
    s.sectionAngle = 0;
    selected = null;
    selectedSlot = null;
  });
const cloudHooks = {
  onSaveTemplate: null,
  onDeleteTemplate: null,
  onSaveCustomPresets: null,
  onSaveWorkspace: null
};

$('save').onclick = () => {
  if (result.errors.length) {
    $('status').textContent = 'Corrija os conflitos antes de salvar o modelo.';
    return;
  }
  const name = $('modelName').value.trim() || 'Meu trabalho';
  const entries = templates();
  const old = entries.findIndex(t => t.name === name);
  const entry = { name, state: F.clone(state) };
  if (old >= 0) entries[old] = entry;
  else entries.push(entry);
  try {
    localStorage.setItem('folha-models', JSON.stringify(entries));
    listTemplates();
    $('status').textContent = '✓ Modelo salvo neste navegador';
    if (typeof cloudHooks.onSaveTemplate === 'function') {
      cloudHooks.onSaveTemplate(entry).then(synced => {
        if (synced) $('status').textContent = '✓ Modelo salvo e sincronizado no Supabase';
      }).catch(() => {});
    }
  } catch {
    $('status').textContent = 'Não foi possível salvar neste navegador.';
  }
};
$('templates').onchange = e => {
  if (e.target.value === '') return;
  const entry = templates()[Number(e.target.value)];
  if (entry) {
    change(() => {
      state = { ...F.clone(F.defaults), ...entry.state, version: 4 };
      selected = null;
      selectedSlot = null;
      sheet = 0;
      face = 'front';
    });
    $('modelName').value = entry.name;
  }
};
$('export').onclick = () => {
  if (pending || result.errors.length) return;
  const blob = new Blob([lastSvg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `folha-${state.process}-${state.mode}-${sheet + 1}-${face}.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('printSheet').onclick = () => window.print();

if ($('zoomIn')) $('zoomIn').onclick = () => setStageZoom(stageZoom + 0.25);
if ($('zoomOut')) $('zoomOut').onclick = () => setStageZoom(stageZoom - 0.25);
if ($('toggleStageFocus')) {
  const applyFocusMode = (next) => {
    const ws = $('workspace');
    if (!ws) return;
    ws.classList.toggle('is-stage-focused', next);
    const btn = $('toggleStageFocus');
    btn.classList.toggle('active', next);
    btn.setAttribute('aria-pressed', String(next));
    btn.textContent = next ? '↙ Sair do foco' : '⛶ Foco';
  };
  $('toggleStageFocus').onclick = () => {
    const ws = $('workspace');
    applyFocusMode(!ws?.classList.contains('is-stage-focused'));
  };
  document.addEventListener('keydown', e => {
    if (document.body.dataset.suiteModule && document.body.dataset.suiteModule !== 'folha') return;
    if (document.querySelector('dialog[open]')) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
    if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      applyFocusMode(!$('workspace')?.classList.contains('is-stage-focused'));
    } else if (e.key === 'Escape' && $('workspace')?.classList.contains('is-stage-focused')) {
      applyFocusMode(false);
    }
  });
}
if ($('zoomReset')) {
  $('zoomReset').onclick = () => {
    stagePanX = 0;
    stagePanY = 0;
    setStageZoom(1);
  };
}
if ($('zoom200')) {
  $('zoom200').onclick = () => {
    stagePanX = 0;
    stagePanY = 0;
    setStageZoom(2);
  };
}
if ($('zoomRange')) {
  $('zoomRange').oninput = e => {
    setStageZoom(Number(e.target.value) / 100);
  };
}

if ($('stage')) {
  const stageEl = $('stage');
  stageEl.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      const step = e.deltaY < 0 ? 0.15 : -0.15;
      setStageZoom(stageZoom + step, e.clientX, e.clientY);
    },
    { passive: false }
  );

  stageEl.addEventListener('dblclick', e => {
    if (stageZoom > 1.05) {
      stagePanX = 0;
      stagePanY = 0;
      setStageZoom(1);
    } else {
      setStageZoom(2, e.clientX, e.clientY);
    }
  });

  let isPanning = false;
  let startX = 0;
  let startY = 0;
  let originPanX = 0;
  let originPanY = 0;
  let pinchStartDist = 0;
  let pinchStartZoom = 1;

  stageEl.addEventListener(
    'touchstart',
    e => {
      if (e.touches.length === 2) {
        isPanning = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDist = Math.hypot(dx, dy);
        pinchStartZoom = stageZoom;
      }
    },
    { passive: true }
  );

  stageEl.addEventListener(
    'touchmove',
    e => {
      if (e.touches.length === 2 && pinchStartDist > 10) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        setStageZoom(pinchStartZoom * (dist / pinchStartDist), midX, midY);
      }
    },
    { passive: false }
  );

  stageEl.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    isPanning = true;
    stageDragged = false;
    startX = e.clientX;
    startY = e.clientY;
    originPanX = stagePanX;
    originPanY = stagePanY;
  });

  window.addEventListener('pointermove', e => {
    if (!isPanning) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.hypot(dx, dy) > 4) {
      stageDragged = true;
      stageEl.classList.add('is-panning');
    }
    if (stageDragged) {
      stagePanX = originPanX + dx;
      stagePanY = originPanY + dy;
      applyStageZoom();
    }
  });

  window.addEventListener('pointerup', () => {
    if (!isPanning) return;
    isPanning = false;
    stageEl.classList.remove('is-panning');
    setTimeout(() => {
      stageDragged = false;
    }, 30);
  });
}

if (osParam && $('modelName')) {
  $('modelName').value = titleParam ? `OS ${osParam} · ${titleParam}` : (osParam.startsWith('OS') ? osParam : `OS ${osParam}`);
}

window.FolhaStudio = {
  getJobName() {
    return $('modelName') ? $('modelName').value.trim() : '';
  },
  getImpositionInfo() {
    return {
      os: $('modelName') ? $('modelName').value.trim() : '',
      poses: result && Number.isFinite(result.count) && result.count >= 1 ? Math.min(64, Math.max(1, result.count)) : 1,
      qty: state && Number.isFinite(state.qty) ? state.qty : null
    };
  },
  getTemplates() {
    return templates();
  },
  getCustomPresets() {
    return readCustomPresets();
  },
  applyCloudCustomPresets(remotePresets, { merge = false } = {}) {
    if (!remotePresets || typeof remotePresets !== 'object') return readCustomPresets();
    const incoming = sanitizeCustomPresetsObj(remotePresets);
    let next = incoming;
    if (merge) {
      const local = readCustomPresets();
      const mergeList = (a, b, wKey, hKey) => {
        const map = new Map();
        for (const item of [...a, ...b]) {
          const key = `${String(item.name || '').toLowerCase()}::${item[wKey]}x${item[hKey]}`;
          if (!map.has(key)) map.set(key, item);
        }
        return Array.from(map.values()).slice(0, 60);
      };
      next = {
        papers: mergeList(local.papers, incoming.papers, 'sw', 'sh'),
        pieces: mergeList(local.pieces, incoming.pieces, 'pw', 'ph')
      };
    }
    const prevJson = JSON.stringify(readCustomPresets());
    const nextJson = JSON.stringify(next);
    if (prevJson === nextJson) return next;
    applyingRemoteCloudState = true;
    try {
      saveCustomPresets(next, { syncCloud: false });
      render();
    } finally {
      applyingRemoteCloudState = false;
    }
    return next;
  },
  getWorkspaceState() {
    return F.clone(state);
  },
  applyCloudWorkspaceState(remoteState) {
    if (!remoteState || typeof remoteState !== 'object') return;
    const candidate = { ...F.clone(F.defaults), ...remoteState, version: 4 };
    if (JSON.stringify(candidate) === JSON.stringify(state)) return;
    applyingRemoteCloudState = true;
    try {
      state = candidate;
      selected = null;
      selectedSlot = null;
      sheet = 0;
      face = 'front';
      render();
    } finally {
      applyingRemoteCloudState = false;
    }
  },
  mergeCloudTemplates(remoteEntries = []) {
    if (!Array.isArray(remoteEntries) || !remoteEntries.length) return templates();
    const localEntries = templates();
    const mergedMap = new Map();
    for (const item of localEntries) {
      if (item && item.name) mergedMap.set(item.name, item);
    }
    for (const remote of remoteEntries) {
      if (remote && remote.name && remote.state) {
        mergedMap.set(remote.name, { name: remote.name, state: remote.state });
      }
    }
    const merged = Array.from(mergedMap.values());
    try {
      localStorage.setItem('folha-models', JSON.stringify(merged));
      listTemplates();
    } catch {}
    return merged;
  },
  setCloudHooks(hooks = {}) {
    for (const key of ['onSaveTemplate', 'onDeleteTemplate', 'onSaveCustomPresets', 'onSaveWorkspace']) {
      if (typeof hooks[key] === 'function' || hooks[key] === null) {
        cloudHooks[key] = hooks[key];
      }
    }
  },
  openWithOrder({ os = '', title = '', qty = null, numbering = false } = {}) {
    if ($('modelName') && (os || title)) {
      const cleanOs = String(os).trim();
      const prefix = cleanOs && !/^OS\b/i.test(cleanOs) ? `OS ${cleanOs}` : cleanOs;
      $('modelName').value = [prefix, String(title).trim()].filter(Boolean).join(' · ');
    }
    if ((Number.isFinite(qty) && qty >= 1) || numbering) {
      change(s => {
        if (Number.isFinite(qty) && qty >= 1) s.qty = Math.round(qty);
        if (numbering) {
          s.numbering = true;
          s.padding = true;
        }
      });
    } else {
      render();
    }
  }
};

listTemplates();
render();
