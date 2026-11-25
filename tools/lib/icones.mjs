/**
 * Biblioteca compartilhada de icones ("iconezinhos") das ferramentas.
 *
 * Gera:
 *  - SVG vetorial 24x24 para a vitrine, painel UXP e extensao CEP
 *  - PNG RGBA real (48x48 e 96x96 @2x) via zlib para manifestos UXP (.ccx)
 *  - ICO BGRA 32-bit DIB real (32x32) para barras do CorelDRAW (SetIcon2)
 */
import zlib from 'node:zlib';
import { crc32 } from './zip.mjs';

export const PALETA_ICONES = [
  { nome: 'Ouro IBD', hex: '#f0c419', fundo: '#242014' },
  { nome: 'Azul Técnico', hex: '#68a8e8', fundo: '#142234' },
  { nome: 'Verde Corte', hex: '#52b788', fundo: '#13281e' },
  { nome: 'Magenta Faca', hex: '#ec4899', fundo: '#2f1426' },
  { nome: 'Laranja Vetor', hex: '#f59e0b', fundo: '#2e1f11' },
  { nome: 'Violeta Layout', hex: '#a78bfa', fundo: '#211b36' }
];

/**
 * Definicoes vetoriais simples em caixa 24x24: usadas tanto em SVG
 * quanto rasterizadas por software para PNG e ICO em Node puro.
 */
export const ICONES = {
  'guia-interna': {
    rotulo: 'Margem de segurança',
    cor: '#68a8e8',
    paths: [
      { tipo: 'rect', x: 3, y: 3, w: 18, h: 18, rx: 1.5, stroke: true },
      { tipo: 'rect', x: 7, y: 7, w: 10, h: 10, rx: 1, dash: '2 2', stroke: true }
    ]
  },
  'guia-externa': {
    rotulo: 'Guias da seleção',
    cor: '#68a8e8',
    paths: [
      { tipo: 'rect', x: 7, y: 7, w: 10, h: 10, rx: 1, fill: true },
      { tipo: 'line', x1: 4, y1: 2, x2: 4, y2: 22 },
      { tipo: 'line', x1: 20, y1: 2, x2: 20, y2: 22 },
      { tipo: 'line', x1: 2, y1: 4, x2: 22, y2: 4 },
      { tipo: 'line', x1: 2, y1: 20, x2: 22, y2: 20 }
    ]
  },
  cotas: {
    rotulo: 'Cotas e dimensões',
    cor: '#f0c419',
    paths: [
      { tipo: 'rect', x: 5, y: 5, w: 14, h: 10, rx: 1.5, stroke: true },
      { tipo: 'line', x1: 5, y1: 19, x2: 19, y2: 19 },
      { tipo: 'line', x1: 5, y1: 17, x2: 5, y2: 21 },
      { tipo: 'line', x1: 19, y1: 17, x2: 19, y2: 21 }
    ]
  },
  'contorno-offset': {
    rotulo: 'Deslocamento e contorno',
    cor: '#ec4899',
    paths: [
      { tipo: 'rect', x: 3.5, y: 3.5, w: 17, h: 17, rx: 4, stroke: true },
      { tipo: 'rect', x: 7.5, y: 7.5, w: 9, h: 9, rx: 2, dash: '2 2', stroke: true }
    ]
  },
  sangria: {
    rotulo: 'Sangria na tela',
    cor: '#f59e0b',
    paths: [
      { tipo: 'rect', x: 6, y: 6, w: 12, h: 12, rx: 1, stroke: true },
      { tipo: 'line', x1: 12, y1: 2, x2: 12, y2: 5 },
      { tipo: 'line', x1: 12, y1: 19, x2: 12, y2: 22 },
      { tipo: 'line', x1: 2, y1: 12, x2: 5, y2: 12 },
      { tipo: 'line', x1: 19, y1: 12, x2: 22, y2: 12 }
    ]
  },
  remendo: {
    rotulo: 'Remendo de adesivo',
    cor: '#52b788',
    paths: [
      { tipo: 'rect', x: 4, y: 4, w: 16, h: 16, rx: 2, dash: '3 2', stroke: true },
      { tipo: 'rect', x: 8, y: 8, w: 8, h: 8, rx: 1, fill: true }
    ]
  },
  'auto-layout': {
    rotulo: 'Auto layout',
    cor: '#a78bfa',
    paths: [
      { tipo: 'rect', x: 3, y: 4, w: 18, h: 16, rx: 2, stroke: true },
      { tipo: 'rect', x: 6, y: 7, w: 4, h: 10, rx: 1, fill: true },
      { tipo: 'rect', x: 12, y: 7, w: 6, h: 6, rx: 1, fill: true }
    ]
  },
  alinhar: {
    rotulo: 'Alinhar e distribuir',
    cor: '#a78bfa',
    paths: [
      { tipo: 'line', x1: 4, y1: 3, x2: 4, y2: 21 },
      { tipo: 'rect', x: 7, y: 5, w: 13, h: 5, rx: 1, fill: true },
      { tipo: 'rect', x: 7, y: 13, w: 8, h: 5, rx: 1, fill: true }
    ]
  },
  exportar: {
    rotulo: 'Exportar arquivos',
    cor: '#68a8e8',
    paths: [
      { tipo: 'rect', x: 4, y: 8, w: 16, h: 12, rx: 2, stroke: true },
      { tipo: 'line', x1: 12, y1: 14, x2: 12, y2: 4 },
      { tipo: 'line', x1: 8.5, y1: 7.5, x2: 12, y2: 4 },
      { tipo: 'line', x1: 15.5, y1: 7.5, x2: 12, y2: 4 }
    ]
  },
  pdf: {
    rotulo: 'Fechamento PDF',
    cor: '#f29ca6',
    paths: [
      { tipo: 'rect', x: 5, y: 3, w: 14, h: 18, rx: 2, stroke: true },
      { tipo: 'line', x1: 8.5, y1: 10, x2: 15.5, y2: 10 },
      { tipo: 'line', x1: 8.5, y1: 14, x2: 15.5, y2: 14 },
      { tipo: 'line', x1: 8.5, y1: 17.5, x2: 13, y2: 17.5 }
    ]
  },
  redimensionar: {
    rotulo: 'Redimensionar imagem',
    cor: '#52b788',
    paths: [
      { tipo: 'rect', x: 4, y: 4, w: 16, h: 16, rx: 2, stroke: true },
      { tipo: 'line', x1: 8, y1: 16, x2: 16, y2: 8 },
      { tipo: 'line', x1: 12, y1: 8, x2: 16, y2: 8 },
      { tipo: 'line', x1: 16, y1: 8, x2: 16, y2: 12 }
    ]
  },
  precos: {
    rotulo: 'Textos e preços',
    cor: '#f0c419',
    paths: [
      { tipo: 'rect', x: 4, y: 5, w: 16, h: 14, rx: 2, stroke: true },
      { tipo: 'circle', cx: 8.5, cy: 9.5, r: 1.5, fill: true },
      { tipo: 'line', x1: 8, y1: 15, x2: 16, y2: 15 },
      { tipo: 'line', x1: 12, y1: 10, x2: 16, y2: 10 }
    ]
  },
  ofertas: {
    rotulo: 'Cartaz de ofertas',
    cor: '#f0c419',
    paths: [
      { tipo: 'rect', x: 5, y: 3, w: 14, h: 18, rx: 2, stroke: true },
      { tipo: 'rect', x: 8, y: 6.5, w: 8, h: 4, rx: 1, fill: true },
      { tipo: 'line', x1: 8, y1: 14, x2: 16, y2: 14 },
      { tipo: 'line', x1: 8, y1: 17.5, x2: 14, y2: 17.5 }
    ]
  },
  organizacao: {
    rotulo: 'Organizar pastas e camadas',
    cor: '#68a8e8',
    paths: [
      { tipo: 'rect', x: 3, y: 5, w: 18, h: 14, rx: 2, stroke: true },
      { tipo: 'line', x1: 3, y1: 9.5, x2: 21, y2: 9.5 },
      { tipo: 'line', x1: 7.5, y1: 14, x2: 16.5, y2: 14 }
    ]
  },
  auditoria: {
    rotulo: 'Auditoria e conferência',
    cor: '#52b788',
    paths: [
      { tipo: 'circle', cx: 10.5, cy: 10.5, r: 6, stroke: true },
      { tipo: 'line', x1: 15, y1: 15, x2: 20, y2: 20 },
      { tipo: 'line', x1: 8, y1: 10.5, x2: 13, y2: 10.5 }
    ]
  },
  papel: {
    rotulo: 'Papel padrão',
    cor: '#68a8e8',
    paths: [
      { tipo: 'rect', x: 5, y: 3, w: 14, h: 18, rx: 1.5, stroke: true },
      { tipo: 'line', x1: 8.5, y1: 8, x2: 15.5, y2: 8 },
      { tipo: 'line', x1: 8.5, y1: 12, x2: 15.5, y2: 12 },
      { tipo: 'line', x1: 8.5, y1: 16, x2: 12.5, y2: 16 }
    ]
  },
  peca: {
    rotulo: 'Peça gráfica padrão',
    cor: '#f0c419',
    paths: [
      { tipo: 'rect', x: 3.5, y: 6, w: 17, h: 12, rx: 1.5, stroke: true },
      { tipo: 'rect', x: 6.5, y: 9, w: 5, h: 6, rx: 0.8, fill: true },
      { tipo: 'line', x1: 13.5, y1: 10, x2: 17.5, y2: 10 },
      { tipo: 'line', x1: 13.5, y1: 14, x2: 16.5, y2: 14 }
    ]
  },
  acao: {
    rotulo: 'Rotina rápida',
    cor: '#f0c419',
    paths: [
      { tipo: 'line', x1: 13, y1: 3, x2: 6, y2: 13 },
      { tipo: 'line', x1: 6, y1: 13, x2: 12, y2: 13 },
      { tipo: 'line', x1: 12, y1: 13, x2: 11, y2: 21 },
      { tipo: 'line', x1: 11, y1: 21, x2: 18, y2: 11 },
      { tipo: 'line', x1: 18, y1: 11, x2: 12, y2: 11 },
      { tipo: 'line', x1: 12, y1: 11, x2: 13, y2: 3 }
    ]
  }
};

/** Resolve qual icone usar para uma ferramenta a partir do id/tipo. */
export function resolverIconeId(id, tipo) {
  const s = String(id || '').toLowerCase();
  if (s.includes('papel-padrao')) return 'papel';
  if (s.includes('peca-padrao')) return 'peca';
  if (s.includes('margem-seguranca')) return 'guia-interna';
  if (s.includes('guias-selecao-margem') && s.includes('illustrator')) return 'guia-externa';
  if (s.includes('remendo') || s.includes('guias-selecao-margem')) return 'remendo';
  if (s.includes('dimensoes') || s.includes('medida') || s.includes('cotas')) return 'cotas';
  if (s.includes('deslocamento') || s.includes('camada-tecnica') || s.includes('exportar-corte')) return 'contorno-offset';
  if (s.includes('sangria')) return 'sangria';
  if (s.includes('auto-layout')) return 'auto-layout';
  if (s.includes('alinhar-distribuir')) return 'alinhar';
  if (s.includes('pdf')) return 'pdf';
  if (s.includes('exportar')) return 'exportar';
  if (s.includes('redimensionar') || s.includes('150-dpi') || s.includes('lote-imagens')) return 'redimensionar';
  if (s.includes('ofertas')) return 'ofertas';
  if (s.includes('precos') || s.includes('place-holder')) return 'precos';
  if (s.includes('organizar') || s.includes('pasta') || s.includes('renomear') || s.includes('limpar') || s.includes('uxp/painel')) return 'organizacao';
  if (s.includes('auditar') || s.includes('conferir') || s.includes('preflight') || s.includes('triagem') || s.includes('preto-tac')) return 'auditoria';
  if (tipo === 'action' || s.includes('imposicao')) return 'acao';
  return 'acao';
}

export function iconeSvg(iconeId, corOverride, tamanho = 20) {
  const def = ICONES[iconeId] || ICONES.acao;
  const cor = corOverride || def.cor || '#f0c419';
  const partes = [];
  for (const p of def.paths) {
    if (p.tipo === 'rect') {
      const attrs = p.fill
        ? `fill="${cor}" stroke="none"`
        : `fill="none" stroke="${cor}" stroke-width="1.8"${p.dash ? ` stroke-dasharray="${p.dash}"` : ''}`;
      partes.push(`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.rx || 0}" ${attrs}/>`);
    } else if (p.tipo === 'circle') {
      const attrs = p.fill ? `fill="${cor}" stroke="none"` : `fill="none" stroke="${cor}" stroke-width="1.8"`;
      partes.push(`<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" ${attrs}/>`);
    } else if (p.tipo === 'line') {
      partes.push(`<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${cor}" stroke-width="1.8" stroke-linecap="round"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${tamanho}" height="${tamanho}" aria-hidden="true">${partes.join('')}</svg>`;
}

/**
 * Gera modulo UMD sem dependencias para rodar identico em UXP (CommonJS),
 * CEP (HTML5) e vitrine Web (browser <script>).
 */
export function gerarCodigoIconesJs() {
  const fnResolver = `function resolverIconeId(id, tipo) {
    var s = String(id || '').toLowerCase();
    if (s.indexOf('papel-padrao') > -1) return 'papel';
    if (s.indexOf('peca-padrao') > -1) return 'peca';
    if (s.indexOf('margem-seguranca') > -1) return 'guia-interna';
    if (s.indexOf('guias-selecao-margem') > -1 && s.indexOf('illustrator') > -1) return 'guia-externa';
    if (s.indexOf('remendo') > -1 || s.indexOf('guias-selecao-margem') > -1) return 'remendo';
    if (s.indexOf('dimensoes') > -1 || s.indexOf('medida') > -1 || s.indexOf('cotas') > -1) return 'cotas';
    if (s.indexOf('deslocamento') > -1 || s.indexOf('camada-tecnica') > -1 || s.indexOf('exportar-corte') > -1) return 'contorno-offset';
    if (s.indexOf('sangria') > -1) return 'sangria';
    if (s.indexOf('auto-layout') > -1) return 'auto-layout';
    if (s.indexOf('alinhar-distribuir') > -1) return 'alinhar';
    if (s.indexOf('pdf') > -1) return 'pdf';
    if (s.indexOf('exportar') > -1) return 'exportar';
    if (s.indexOf('redimensionar') > -1 || s.indexOf('150-dpi') > -1 || s.indexOf('lote-imagens') > -1) return 'redimensionar';
    if (s.indexOf('ofertas') > -1) return 'ofertas';
    if (s.indexOf('precos') > -1 || s.indexOf('place-holder') > -1) return 'precos';
    if (s.indexOf('organizar') > -1 || s.indexOf('pasta') > -1 || s.indexOf('renomear') > -1 || s.indexOf('limpar') > -1 || s.indexOf('uxp/painel') > -1) return 'organizacao';
    if (s.indexOf('auditar') > -1 || s.indexOf('conferir') > -1 || s.indexOf('preflight') > -1 || s.indexOf('triagem') > -1 || s.indexOf('preto-tac') > -1) return 'auditoria';
    if (tipo === 'action' || s.indexOf('imposicao') > -1) return 'acao';
    return 'acao';
  }`;
  const fnSvg = `function iconeSvg(iconeId, corOverride, tamanho) {
    var def = ICONES[iconeId] || ICONES.acao;
    var cor = corOverride || def.cor || '#f0c419';
    var tam = tamanho || 20;
    var partes = [];
    for (var i = 0; i < def.paths.length; i++) {
      var p = def.paths[i];
      if (p.tipo === 'rect') {
        var ra = p.fill
          ? 'fill="' + cor + '" stroke="none"'
          : 'fill="none" stroke="' + cor + '" stroke-width="1.8"' + (p.dash ? ' stroke-dasharray="' + p.dash + '"' : '');
        partes.push('<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="' + (p.rx || 0) + '" ' + ra + '/>');
      } else if (p.tipo === 'circle') {
        var ca = p.fill ? 'fill="' + cor + '" stroke="none"' : 'fill="none" stroke="' + cor + '" stroke-width="1.8"';
        partes.push('<circle cx="' + p.cx + '" cy="' + p.cy + '" r="' + p.r + '" ' + ca + '/>');
      } else if (p.tipo === 'line') {
        partes.push('<line x1="' + p.x1 + '" y1="' + p.y1 + '" x2="' + p.x2 + '" y2="' + p.y2 + '" stroke="' + cor + '" stroke-width="1.8" stroke-linecap="round"/>');
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="' + tam + '" height="' + tam + '" aria-hidden="true">' + partes.join('') + '</svg>';
  }`;

  return `/* Gerado automaticamente a partir de tools/lib/icones.mjs — nao edite manualmente. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IBDIcones = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  var PALETA_ICONES = ${JSON.stringify(PALETA_ICONES, null, 2)};
  var ICONES = ${JSON.stringify(ICONES, null, 2)};
  ${fnResolver}
  ${fnSvg}
  return {
    PALETA_ICONES: PALETA_ICONES,
    ICONES: ICONES,
    resolverIconeId: resolverIconeId,
    iconeSvg: iconeSvg
  };
}));
`;
}

/* Rasterizacao minimalista e limpa para PNG (UXP) e ICO (CorelDRAW) ---- */

function parseHex(hex) {
  const clean = String(hex || '#f0c419').replace(/^#/, '');
  const n = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

function rasterizarIconeRGBA(iconeId, tamanho, corHex, fundoHex) {
  const def = ICONES[iconeId] || ICONES.acao;
  const fg = parseHex(corHex || def.cor || '#f0c419');
  const bg = parseHex(fundoHex || '#1e222a');
  const borda = parseHex('#3a404d');
  const buf = Buffer.alloc(tamanho * tamanho * 4, 0);
  const s = tamanho / 24;

  function blend(px, py, rgba, alpha = 1) {
    if (px < 0 || py < 0 || px >= tamanho || py >= tamanho || alpha <= 0) return;
    const i = (py * tamanho + px) * 4;
    const a = Math.min(1, alpha * (rgba[3] / 255));
    const inv = 1 - a;
    buf[i] = Math.round(rgba[0] * a + buf[i] * inv);
    buf[i + 1] = Math.round(rgba[1] * a + buf[i + 1] * inv);
    buf[i + 2] = Math.round(rgba[2] * a + buf[i + 2] * inv);
    buf[i + 3] = Math.min(255, Math.round(255 * (a + (buf[i + 3] / 255) * inv)));
  }

  // Fundo arredondado estilo badge
  const pad = Math.max(1, Math.round(tamanho * 0.06));
  const r = Math.max(3, Math.round(tamanho * 0.2));
  for (let y = pad; y < tamanho - pad; y++) {
    for (let x = pad; x < tamanho - pad; x++) {
      const dx = Math.max(pad + r - x, 0, x - (tamanho - 1 - pad - r));
      const dy = Math.max(pad + r - y, 0, y - (tamanho - 1 - pad - r));
      const d = Math.hypot(dx, dy);
      if (d <= r) {
        const ehBorda = x === pad || x === tamanho - 1 - pad || y === pad || y === tamanho - 1 - pad || d >= r - 1.2;
        blend(x, y, ehBorda ? borda : bg, 1);
      }
    }
  }

  function strokeLine(x1, y1, x2, y2, w) {
    const steps = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) * s * 3));
    const rad = Math.max(0.7, (w * s) / 2);
    for (let k = 0; k <= steps; k++) {
      const cx = (x1 + ((x2 - x1) * k) / steps) * s;
      const cy = (y1 + ((y2 - y1) * k) / steps) * s;
      const minX = Math.floor(cx - rad - 1), maxX = Math.ceil(cx + rad + 1);
      const minY = Math.floor(cy - rad - 1), maxY = Math.ceil(cy + rad + 1);
      for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
          const dist = Math.hypot(px + 0.5 - cx, py + 0.5 - cy);
          if (dist <= rad) blend(px, py, fg, 1);
          else if (dist <= rad + 0.7) blend(px, py, fg, 1 - (dist - rad) / 0.7);
        }
      }
    }
  }

  function drawRect(x, y, w, h, fill) {
    if (fill) {
      const x0 = Math.round(x * s), y0 = Math.round(y * s);
      const x1 = Math.round((x + w) * s), y1 = Math.round((y + h) * s);
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) blend(px, py, fg, 1);
      }
    } else {
      strokeLine(x, y, x + w, y, 1.8);
      strokeLine(x + w, y, x + w, y + h, 1.8);
      strokeLine(x + w, y + h, x, y + h, 1.8);
      strokeLine(x, y + h, x, y, 1.8);
    }
  }

  for (const p of def.paths) {
    if (p.tipo === 'rect') drawRect(p.x, p.y, p.w, p.h, !!p.fill);
    else if (p.tipo === 'line') strokeLine(p.x1, p.y1, p.x2, p.y2, 1.8);
    else if (p.tipo === 'circle') {
      const segs = 24;
      for (let i = 0; i < segs; i++) {
        const a1 = (i * 2 * Math.PI) / segs;
        const a2 = ((i + 1) * 2 * Math.PI) / segs;
        strokeLine(
          p.cx + Math.cos(a1) * p.r, p.cy + Math.sin(a1) * p.r,
          p.cx + Math.cos(a2) * p.r, p.cy + Math.sin(a2) * p.r,
          p.fill ? p.r * 1.4 : 1.8
        );
      }
    }
  }
  return buf;
}

function pngChunk(tipo, dados) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(dados.length, 0);
  const tag = Buffer.from(tipo, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tag, dados])) >>> 0, 0);
  return Buffer.concat([len, tag, dados, crc]);
}

export function gerarPngIcone(iconeId, tamanho = 48, corHex, fundoHex) {
  const rgba = rasterizarIconeRGBA(iconeId, tamanho, corHex, fundoHex);
  const stride = tamanho * 4 + 1;
  const raw = Buffer.alloc(stride * tamanho);
  for (let y = 0; y < tamanho; y++) {
    raw[y * stride] = 0; // filtro None
    rgba.copy(raw, y * stride + 1, y * tamanho * 4, (y + 1) * tamanho * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tamanho, 0);
  ihdr.writeUInt32BE(tamanho, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

/** Gera arquivo .ico BMP 32-bit BGRA compativel com CorelDRAW SetIcon2. */
export function gerarIcoIcone(iconeId, tamanho = 32, corHex, fundoHex) {
  const rgba = rasterizarIconeRGBA(iconeId, tamanho, corHex, fundoHex);
  const xorSize = tamanho * tamanho * 4;
  const andRow = Math.ceil(tamanho / 32) * 4;
  const andSize = andRow * tamanho;
  const bih = Buffer.alloc(40);
  bih.writeUInt32LE(40, 0);
  bih.writeInt32LE(tamanho, 4);
  bih.writeInt32LE(tamanho * 2, 8); // altura dobrada inclui XOR + AND mask
  bih.writeUInt16LE(1, 12); // planes
  bih.writeUInt16LE(32, 14); // 32 bpp BGRA
  bih.writeUInt32LE(0, 16); // BI_RGB
  bih.writeUInt32LE(xorSize + andSize, 20);

  const xor = Buffer.alloc(xorSize);
  const andMask = Buffer.alloc(andSize, 0);
  for (let y = 0; y < tamanho; y++) {
    const srcY = tamanho - 1 - y; // DIB e bottom-up
    for (let x = 0; x < tamanho; x++) {
      const si = (srcY * tamanho + x) * 4;
      const di = (y * tamanho + x) * 4;
      xor[di] = rgba[si + 2];     // B
      xor[di + 1] = rgba[si + 1]; // G
      xor[di + 2] = rgba[si];     // R
      xor[di + 3] = rgba[si + 3]; // A
      if (rgba[si + 3] < 128) {
        const byteIdx = y * andRow + (x >> 3);
        andMask[byteIdx] |= (0x80 >> (x & 7));
      }
    }
  }

  const imageData = Buffer.concat([bih, xor, andMask]);
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(1, 4); // 1 image
  header[6] = tamanho >= 256 ? 0 : tamanho;
  header[7] = tamanho >= 256 ? 0 : tamanho;
  header[8] = 0;
  header[9] = 0;
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(imageData.length, 14);
  header.writeUInt32LE(22, 18); // offset apos header + dir entry

  return Buffer.concat([header, imageData]);
}
