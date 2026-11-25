/**
 * ibd-formatos.jsx — catalogo compartilhado de papeis padrao (Nobel primeiro
 * + formatos graficos e ISO do app) e pecas graficas mais comuns (ES3).
 *
 * Uso:
 *   #include "../../../core/extendscript/ibd-formatos.jsx"
 */

#include "ibd-core.jsx"

(function (IBD) {
  var formatos = {};

  /**
   * Papeis padrao: primeiro os formatos Padrao Nobel (T9, T8, T4),
   * seguidos pelos formatos presentes no app (ISO A, graficos, Oficio, B e folhas).
   */
  formatos.PAPEIS = [
    { id: 'nobel-t9', rotulo: 'Padrao Nobel T9 — 220 x 380 mm', curto: 'T9', w: 220, h: 380, grupo: 'Nobel' },
    { id: 'nobel-t8', rotulo: 'Padrao Nobel T8 — 238 x 328 mm', curto: 'T8', w: 238, h: 328, grupo: 'Nobel' },
    { id: 'nobel-t4', rotulo: 'Padrao Nobel T4 — 328 x 478 mm', curto: 'T4', w: 328, h: 478, grupo: 'Nobel' },

    { id: 'a4', rotulo: 'A4 — 210 x 297 mm', curto: 'A4', w: 210, h: 297, grupo: 'ISO' },
    { id: 'a5', rotulo: 'A5 — 148 x 210 mm', curto: 'A5', w: 148, h: 210, grupo: 'ISO' },
    { id: 'a6', rotulo: 'A6 — 105 x 148 mm', curto: 'A6', w: 105, h: 148, grupo: 'ISO' },
    { id: 'a7', rotulo: 'A7 — 74 x 105 mm', curto: 'A7', w: 74, h: 105, grupo: 'ISO' },
    { id: 'a3', rotulo: 'A3 — 297 x 420 mm', curto: 'A3', w: 297, h: 420, grupo: 'ISO' },
    { id: 'sra3', rotulo: 'SRA3 — 320 x 450 mm', curto: 'SRA3', w: 320, h: 450, grupo: 'Grafico' },
    { id: 'super-a3', rotulo: 'Super A3 / A3+ — 330 x 480 mm', curto: 'A3+', w: 330, h: 480, grupo: 'Grafico' },
    { id: 'a4-220x320', rotulo: 'A4+ grafico — 220 x 320 mm', curto: 'A4+ 220', w: 220, h: 320, grupo: 'Grafico' },
    { id: 'a4-225x320', rotulo: 'A4+ grafico — 225 x 320 mm', curto: 'A4+ 225', w: 225, h: 320, grupo: 'Grafico' },
    { id: 'a4-230x330', rotulo: 'A4+ grafico — 230 x 330 mm', curto: 'A4+ 230', w: 230, h: 330, grupo: 'Grafico' },
    { id: 'super-a4', rotulo: 'Super A4 sublimacao — 230 x 350 mm', curto: 'Super A4', w: 230, h: 350, grupo: 'Grafico' },
    { id: 'a2', rotulo: 'A2 — 420 x 594 mm', curto: 'A2', w: 420, h: 594, grupo: 'ISO' },
    { id: 'a1', rotulo: 'A1 — 594 x 841 mm', curto: 'A1', w: 594, h: 841, grupo: 'ISO' },
    { id: 'a0', rotulo: 'A0 — 841 x 1189 mm', curto: 'A0', w: 841, h: 1189, grupo: 'ISO' },

    { id: 'carta', rotulo: 'Carta (Letter) — 216 x 279 mm', curto: 'Carta', w: 216, h: 279, grupo: 'Escritorio' },
    { id: 'oficio-320', rotulo: 'Oficio / Folio — 216 x 320 mm', curto: 'Oficio 320', w: 216, h: 320, grupo: 'Escritorio' },
    { id: 'oficio-330', rotulo: 'Oficio 2 / Folio — 216 x 330 mm', curto: 'Oficio 330', w: 216, h: 330, grupo: 'Escritorio' },
    { id: 'legal', rotulo: 'Oficio (Legal) — 216 x 356 mm', curto: 'Legal', w: 216, h: 356, grupo: 'Escritorio' },
    { id: 'meio-oficio', rotulo: 'Meio Oficio — 165 x 216 mm', curto: 'Meio Of.', w: 165, h: 216, grupo: 'Escritorio' },

    { id: 'b4', rotulo: 'B4 (ISO) — 250 x 353 mm', curto: 'B4', w: 250, h: 353, grupo: 'ISO B' },
    { id: 'b5', rotulo: 'B5 (ISO) — 176 x 250 mm', curto: 'B5', w: 176, h: 250, grupo: 'ISO B' },
    { id: 'b6', rotulo: 'B6 (ISO) — 125 x 176 mm', curto: 'B6', w: 125, h: 176, grupo: 'ISO B' },

    { id: 'meia-folha', rotulo: 'Meia folha (1/2) — 480 x 660 mm', curto: '1/2 Folha', w: 480, h: 660, grupo: 'Offset' },
    { id: 'folha-64x88', rotulo: 'Folha 64 x 88 cm — 640 x 880 mm', curto: '64x88', w: 640, h: 880, grupo: 'Offset' },
    { id: 'folha-bb', rotulo: 'Folha inteira (BB) — 660 x 960 mm', curto: 'BB 66x96', w: 660, h: 960, grupo: 'Offset' },
    { id: 'formato-76x112', rotulo: 'Formato 76 x 112 cm — 760 x 1120 mm', curto: '76x112', w: 760, h: 1120, grupo: 'Offset' }
  ];

  /**
   * Pecas graficas mais comuns (com cartao 90x50, panfletos 140x100, 140x200,
   * 100x150, A4, A5 no topo e todas as pecas do app).
   */
  formatos.PECAS = [
    { id: 'cartao-90x50', rotulo: 'Cartao de visita BR — 90 x 50 mm', curto: '90x50', w: 90, h: 50 },
    { id: 'panfleto-140x100', rotulo: 'Panfleto — 140 x 100 mm', curto: '140x100', w: 140, h: 100 },
    { id: 'panfleto-100x140', rotulo: 'Panfleto vertical — 100 x 140 mm', curto: '100x140', w: 100, h: 140 },
    { id: 'panfleto-140x200', rotulo: 'Panfleto — 140 x 200 mm', curto: '140x200', w: 140, h: 200 },
    { id: 'panfleto-100x150', rotulo: 'Panfleto / Postal — 100 x 150 mm', curto: '100x150', w: 100, h: 150 },
    { id: 'panfleto-150x210', rotulo: 'Panfleto — 150 x 210 mm', curto: '150x210', w: 150, h: 210 },
    { id: 'a4', rotulo: 'A4 — 210 x 297 mm', curto: 'A4', w: 210, h: 297 },
    { id: 'a5', rotulo: 'A5 — 148 x 210 mm', curto: 'A5', w: 148, h: 210 },
    { id: 'a6', rotulo: 'A6 — 105 x 148 mm', curto: 'A6', w: 105, h: 148 },
    { id: 'a3', rotulo: 'A3 — 297 x 420 mm', curto: 'A3', w: 297, h: 420 },

    { id: 'cartao-iso', rotulo: 'Cartao de visita ISO — 85 x 55 mm', curto: '85x55', w: 85, h: 55 },
    { id: 'cartao-duplo', rotulo: 'Cartao duplo — 180 x 50 mm', curto: '180x50', w: 180, h: 50 },
    { id: 'filipeta', rotulo: 'Filipeta / Comanda — 100 x 210 mm', curto: '100x210', w: 100, h: 210 },
    { id: 'dl', rotulo: 'DL — 99 x 210 mm', curto: 'DL', w: 99, h: 210 },
    { id: 'folder-a4', rotulo: 'Folder A4 aberto — 297 x 210 mm', curto: 'Folder A4', w: 297, h: 210 },
    { id: 'folder-1dobra', rotulo: 'Folder 1 dobra aberto — 200 x 210 mm', curto: 'Folder 1D', w: 200, h: 210 },
    { id: 'folder-3paineis', rotulo: 'Folder 3 paineis aberto — 630 x 210 mm', curto: 'Folder 3P', w: 630, h: 210 },
    { id: 'pasta-fechada', rotulo: 'Pasta executiva fechada — 220 x 310 mm', curto: 'Pasta F', w: 220, h: 310 },
    { id: 'pasta-aberta', rotulo: 'Pasta aberta — 450 x 310 mm', curto: 'Pasta A', w: 450, h: 310 },
    { id: 'cartaz-300x420', rotulo: 'Cartaz pequeno — 300 x 420 mm', curto: '300x420', w: 300, h: 420 },
    { id: 'cartaz-310x450', rotulo: 'Cartaz A3+ — 310 x 450 mm', curto: '310x450', w: 310, h: 450 },

    { id: 'a7', rotulo: 'A7 — 74 x 105 mm', curto: 'A7', w: 74, h: 105 },
    { id: 'a8', rotulo: 'A8 — 52 x 74 mm', curto: 'A8', w: 52, h: 74 },
    { id: 'a2', rotulo: 'A2 — 420 x 594 mm', curto: 'A2', w: 420, h: 594 },
    { id: 'a1', rotulo: 'A1 — 594 x 841 mm', curto: 'A1', w: 594, h: 841 },
    { id: 'a0', rotulo: 'A0 — 841 x 1189 mm', curto: 'A0', w: 841, h: 1189 },

    { id: 'quad-100', rotulo: 'Quadrado — 100 x 100 mm', curto: '100x100', w: 100, h: 100 },
    { id: 'quad-148', rotulo: 'Quadrado — 148 x 148 mm', curto: '148x148', w: 148, h: 148 },
    { id: 'quad-200', rotulo: 'Quadrado — 200 x 200 mm', curto: '200x200', w: 200, h: 200 },
    { id: 'quad-210', rotulo: 'Quadrado — 210 x 210 mm', curto: '210x210', w: 210, h: 210 },

    { id: 'livro-br', rotulo: 'Livro BR — 160 x 230 mm', curto: '160x230', w: 160, h: 230 },
    { id: 'livro-tec', rotulo: 'Livro tecnico — 170 x 240 mm', curto: '170x240', w: 170, h: 240 },
    { id: 'livro-rom', rotulo: 'Livro romance — 140 x 210 mm', curto: '140x210', w: 140, h: 210 },
    { id: 'livro-pocket', rotulo: 'Livro pocket — 120 x 180 mm', curto: '120x180', w: 120, h: 180 },
    { id: 'revista', rotulo: 'Revista — 205 x 275 mm', curto: '205x275', w: 205, h: 275 },
    { id: 'apostila', rotulo: 'Apostila — 200 x 275 mm', curto: '200x275', w: 200, h: 275 },
    { id: 'agenda', rotulo: 'Agenda / Caderno — 145 x 205 mm', curto: '145x205', w: 145, h: 205 },
    { id: 'tabloide', rotulo: 'Tabloide — 280 x 380 mm', curto: '280x380', w: 280, h: 380 },
    { id: 'standard', rotulo: 'Standard — 320 x 520 mm', curto: '320x520', w: 320, h: 520 },

    { id: 'etq-50x30', rotulo: 'Etiqueta pequena — 50 x 30 mm', curto: '50x30', w: 50, h: 30 },
    { id: 'etq-50x50', rotulo: 'Etiqueta quadrada — 50 x 50 mm', curto: '50x50', w: 50, h: 50 },
    { id: 'etq-80x50', rotulo: 'Etiqueta media — 80 x 50 mm', curto: '80x50', w: 80, h: 50 },
    { id: 'etq-100x150', rotulo: 'Etiqueta envio — 100 x 150 mm', curto: '100x150', w: 100, h: 150 },
    { id: 'tag-50x90', rotulo: 'Tag roupa — 50 x 90 mm', curto: '50x90', w: 50, h: 90 },
    { id: 'tag-40x85', rotulo: 'Tag pequena — 40 x 85 mm', curto: '40x85', w: 40, h: 85 },
    { id: 'marcador-180', rotulo: 'Marcador — 50 x 180 mm', curto: '50x180', w: 50, h: 180 },
    { id: 'marcador-210', rotulo: 'Marcador — 50 x 210 mm', curto: '50x210', w: 50, h: 210 },
    { id: 'ingresso', rotulo: 'Ingresso — 150 x 50 mm', curto: '150x50', w: 150, h: 50 },
    { id: 'rifa', rotulo: 'Rifa — 200 x 70 mm', curto: '200x70', w: 200, h: 70 },
    { id: 'talao', rotulo: 'Talao — 140 x 200 mm', curto: 'Talao', w: 140, h: 200 },
    { id: 'pulseira', rotulo: 'Pulseira — 250 x 20 mm', curto: '250x20', w: 250, h: 20 },
    { id: 'door-hanger', rotulo: 'Door hanger — 90 x 210 mm', curto: '90x210', w: 90, h: 210 },
    { id: 'ventarola', rotulo: 'Ventarola — 180 x 220 mm', curto: '180x220', w: 180, h: 220 },
    { id: 'wobbler', rotulo: 'Wobbler — 120 x 120 mm', curto: '120x120', w: 120, h: 120 },
    { id: 'jogo-americano', rotulo: 'Jogo americano — 420 x 300 mm', curto: '420x300', w: 420, h: 300 },
    { id: 'solapa', rotulo: 'Solapa — 100 x 80 mm', curto: '100x80', w: 100, h: 80 },
    { id: 'cinta', rotulo: 'Cinta — 300 x 60 mm', curto: '300x60', w: 300, h: 60 },
    { id: 'calendario', rotulo: 'Calendario mesa — 210 x 150 mm', curto: '210x150', w: 210, h: 150 },
    { id: 'folhinha', rotulo: 'Folhinha — 240 x 340 mm', curto: '240x340', w: 240, h: 340 },
    { id: 'ima', rotulo: 'Ima de geladeira — 50 x 45 mm', curto: '50x45', w: 50, h: 45 },
    { id: 'env-dl', rotulo: 'Envelope DL — 229 x 114 mm', curto: 'Env DL', w: 229, h: 114 },
    { id: 'env-c5', rotulo: 'Envelope C5 — 162 x 229 mm', curto: 'Env C5', w: 162, h: 229 },
    { id: 'env-saco', rotulo: 'Envelope Saco A4 — 240 x 340 mm', curto: 'Env A4', w: 240, h: 340 }
  ];

  formatos.rotulos = function (lista) {
    var out = [];
    for (var i = 0; i < lista.length; i++) out.push(lista[i].rotulo);
    return out;
  };

  formatos.porRotulo = function (lista, rotulo) {
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].rotulo === rotulo) return lista[i];
    }
    return lista[0];
  };

  formatos.aplicarOrientacao = function (item, orientacao) {
    var w = item.w;
    var h = item.h;
    var ori = String(orientacao || '');
    if (ori.indexOf('Retrato') === 0) {
      if (w > h) { var tmp1 = w; w = h; h = tmp1; }
    } else if (ori.indexOf('Paisagem') === 0) {
      if (h > w) { var tmp2 = w; w = h; h = tmp2; }
    }
    return { w: w, h: h };
  };

  IBD.formatos = formatos;
})($.global.IBD);
