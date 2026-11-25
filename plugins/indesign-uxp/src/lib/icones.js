/* Gerado automaticamente a partir de tools/lib/icones.mjs — nao edite manualmente. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IBDIcones = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  var PALETA_ICONES = [
  {
    "nome": "Ouro IBD",
    "hex": "#f0c419",
    "fundo": "#242014"
  },
  {
    "nome": "Azul Técnico",
    "hex": "#68a8e8",
    "fundo": "#142234"
  },
  {
    "nome": "Verde Corte",
    "hex": "#52b788",
    "fundo": "#13281e"
  },
  {
    "nome": "Magenta Faca",
    "hex": "#ec4899",
    "fundo": "#2f1426"
  },
  {
    "nome": "Laranja Vetor",
    "hex": "#f59e0b",
    "fundo": "#2e1f11"
  },
  {
    "nome": "Violeta Layout",
    "hex": "#a78bfa",
    "fundo": "#211b36"
  }
];
  var ICONES = {
  "guia-interna": {
    "rotulo": "Margem de segurança",
    "cor": "#68a8e8",
    "paths": [
      {
        "tipo": "rect",
        "x": 3,
        "y": 3,
        "w": 18,
        "h": 18,
        "rx": 1.5,
        "stroke": true
      },
      {
        "tipo": "rect",
        "x": 7,
        "y": 7,
        "w": 10,
        "h": 10,
        "rx": 1,
        "dash": "2 2",
        "stroke": true
      }
    ]
  },
  "guia-externa": {
    "rotulo": "Guias da seleção",
    "cor": "#68a8e8",
    "paths": [
      {
        "tipo": "rect",
        "x": 7,
        "y": 7,
        "w": 10,
        "h": 10,
        "rx": 1,
        "fill": true
      },
      {
        "tipo": "line",
        "x1": 4,
        "y1": 2,
        "x2": 4,
        "y2": 22
      },
      {
        "tipo": "line",
        "x1": 20,
        "y1": 2,
        "x2": 20,
        "y2": 22
      },
      {
        "tipo": "line",
        "x1": 2,
        "y1": 4,
        "x2": 22,
        "y2": 4
      },
      {
        "tipo": "line",
        "x1": 2,
        "y1": 20,
        "x2": 22,
        "y2": 20
      }
    ]
  },
  "cotas": {
    "rotulo": "Cotas e dimensões",
    "cor": "#f0c419",
    "paths": [
      {
        "tipo": "rect",
        "x": 5,
        "y": 5,
        "w": 14,
        "h": 10,
        "rx": 1.5,
        "stroke": true
      },
      {
        "tipo": "line",
        "x1": 5,
        "y1": 19,
        "x2": 19,
        "y2": 19
      },
      {
        "tipo": "line",
        "x1": 5,
        "y1": 17,
        "x2": 5,
        "y2": 21
      },
      {
        "tipo": "line",
        "x1": 19,
        "y1": 17,
        "x2": 19,
        "y2": 21
      }
    ]
  },
  "contorno-offset": {
    "rotulo": "Deslocamento e contorno",
    "cor": "#ec4899",
    "paths": [
      {
        "tipo": "rect",
        "x": 3.5,
        "y": 3.5,
        "w": 17,
        "h": 17,
        "rx": 4,
        "stroke": true
      },
      {
        "tipo": "rect",
        "x": 7.5,
        "y": 7.5,
        "w": 9,
        "h": 9,
        "rx": 2,
        "dash": "2 2",
        "stroke": true
      }
    ]
  },
  "sangria": {
    "rotulo": "Sangria na tela",
    "cor": "#f59e0b",
    "paths": [
      {
        "tipo": "rect",
        "x": 6,
        "y": 6,
        "w": 12,
        "h": 12,
        "rx": 1,
        "stroke": true
      },
      {
        "tipo": "line",
        "x1": 12,
        "y1": 2,
        "x2": 12,
        "y2": 5
      },
      {
        "tipo": "line",
        "x1": 12,
        "y1": 19,
        "x2": 12,
        "y2": 22
      },
      {
        "tipo": "line",
        "x1": 2,
        "y1": 12,
        "x2": 5,
        "y2": 12
      },
      {
        "tipo": "line",
        "x1": 19,
        "y1": 12,
        "x2": 22,
        "y2": 12
      }
    ]
  },
  "remendo": {
    "rotulo": "Remendo de adesivo",
    "cor": "#52b788",
    "paths": [
      {
        "tipo": "rect",
        "x": 4,
        "y": 4,
        "w": 16,
        "h": 16,
        "rx": 2,
        "dash": "3 2",
        "stroke": true
      },
      {
        "tipo": "rect",
        "x": 8,
        "y": 8,
        "w": 8,
        "h": 8,
        "rx": 1,
        "fill": true
      }
    ]
  },
  "auto-layout": {
    "rotulo": "Auto layout",
    "cor": "#a78bfa",
    "paths": [
      {
        "tipo": "rect",
        "x": 3,
        "y": 4,
        "w": 18,
        "h": 16,
        "rx": 2,
        "stroke": true
      },
      {
        "tipo": "rect",
        "x": 6,
        "y": 7,
        "w": 4,
        "h": 10,
        "rx": 1,
        "fill": true
      },
      {
        "tipo": "rect",
        "x": 12,
        "y": 7,
        "w": 6,
        "h": 6,
        "rx": 1,
        "fill": true
      }
    ]
  },
  "alinhar": {
    "rotulo": "Alinhar e distribuir",
    "cor": "#a78bfa",
    "paths": [
      {
        "tipo": "line",
        "x1": 4,
        "y1": 3,
        "x2": 4,
        "y2": 21
      },
      {
        "tipo": "rect",
        "x": 7,
        "y": 5,
        "w": 13,
        "h": 5,
        "rx": 1,
        "fill": true
      },
      {
        "tipo": "rect",
        "x": 7,
        "y": 13,
        "w": 8,
        "h": 5,
        "rx": 1,
        "fill": true
      }
    ]
  },
  "exportar": {
    "rotulo": "Exportar arquivos",
    "cor": "#68a8e8",
    "paths": [
      {
        "tipo": "rect",
        "x": 4,
        "y": 8,
        "w": 16,
        "h": 12,
        "rx": 2,
        "stroke": true
      },
      {
        "tipo": "line",
        "x1": 12,
        "y1": 14,
        "x2": 12,
        "y2": 4
      },
      {
        "tipo": "line",
        "x1": 8.5,
        "y1": 7.5,
        "x2": 12,
        "y2": 4
      },
      {
        "tipo": "line",
        "x1": 15.5,
        "y1": 7.5,
        "x2": 12,
        "y2": 4
      }
    ]
  },
  "pdf": {
    "rotulo": "Fechamento PDF",
    "cor": "#f29ca6",
    "paths": [
      {
        "tipo": "rect",
        "x": 5,
        "y": 3,
        "w": 14,
        "h": 18,
        "rx": 2,
        "stroke": true
      },
      {
        "tipo": "line",
        "x1": 8.5,
        "y1": 10,
        "x2": 15.5,
        "y2": 10
      },
      {
        "tipo": "line",
        "x1": 8.5,
        "y1": 14,
        "x2": 15.5,
        "y2": 14
      },
      {
        "tipo": "line",
        "x1": 8.5,
        "y1": 17.5,
        "x2": 13,
        "y2": 17.5
      }
    ]
  },
  "redimensionar": {
    "rotulo": "Redimensionar imagem",
    "cor": "#52b788",
    "paths": [
      {
        "tipo": "rect",
        "x": 4,
        "y": 4,
        "w": 16,
        "h": 16,
        "rx": 2,
        "stroke": true
      },
      {
        "tipo": "line",
        "x1": 8,
        "y1": 16,
        "x2": 16,
        "y2": 8
      },
      {
        "tipo": "line",
        "x1": 12,
        "y1": 8,
        "x2": 16,
        "y2": 8
      },
      {
        "tipo": "line",
        "x1": 16,
        "y1": 8,
        "x2": 16,
        "y2": 12
      }
    ]
  },
  "precos": {
    "rotulo": "Textos e preços",
    "cor": "#f0c419",
    "paths": [
      {
        "tipo": "rect",
        "x": 4,
        "y": 5,
        "w": 16,
        "h": 14,
        "rx": 2,
        "stroke": true
      },
      {
        "tipo": "circle",
        "cx": 8.5,
        "cy": 9.5,
        "r": 1.5,
        "fill": true
      },
      {
        "tipo": "line",
        "x1": 8,
        "y1": 15,
        "x2": 16,
        "y2": 15
      },
      {
        "tipo": "line",
        "x1": 12,
        "y1": 10,
        "x2": 16,
        "y2": 10
      }
    ]
  },
  "ofertas": {
    "rotulo": "Cartaz de ofertas",
    "cor": "#f0c419",
    "paths": [
      {
        "tipo": "rect",
        "x": 5,
        "y": 3,
        "w": 14,
        "h": 18,
        "rx": 2,
        "stroke": true
      },
      {
        "tipo": "rect",
        "x": 8,
        "y": 6.5,
        "w": 8,
        "h": 4,
        "rx": 1,
        "fill": true
      },
      {
        "tipo": "line",
        "x1": 8,
        "y1": 14,
        "x2": 16,
        "y2": 14
      },
      {
        "tipo": "line",
        "x1": 8,
        "y1": 17.5,
        "x2": 14,
        "y2": 17.5
      }
    ]
  },
  "organizacao": {
    "rotulo": "Organizar pastas e camadas",
    "cor": "#68a8e8",
    "paths": [
      {
        "tipo": "rect",
        "x": 3,
        "y": 5,
        "w": 18,
        "h": 14,
        "rx": 2,
        "stroke": true
      },
      {
        "tipo": "line",
        "x1": 3,
        "y1": 9.5,
        "x2": 21,
        "y2": 9.5
      },
      {
        "tipo": "line",
        "x1": 7.5,
        "y1": 14,
        "x2": 16.5,
        "y2": 14
      }
    ]
  },
  "auditoria": {
    "rotulo": "Auditoria e conferência",
    "cor": "#52b788",
    "paths": [
      {
        "tipo": "circle",
        "cx": 10.5,
        "cy": 10.5,
        "r": 6,
        "stroke": true
      },
      {
        "tipo": "line",
        "x1": 15,
        "y1": 15,
        "x2": 20,
        "y2": 20
      },
      {
        "tipo": "line",
        "x1": 8,
        "y1": 10.5,
        "x2": 13,
        "y2": 10.5
      }
    ]
  },
  "acao": {
    "rotulo": "Rotina rápida",
    "cor": "#f0c419",
    "paths": [
      {
        "tipo": "line",
        "x1": 13,
        "y1": 3,
        "x2": 6,
        "y2": 13
      },
      {
        "tipo": "line",
        "x1": 6,
        "y1": 13,
        "x2": 12,
        "y2": 13
      },
      {
        "tipo": "line",
        "x1": 12,
        "y1": 13,
        "x2": 11,
        "y2": 21
      },
      {
        "tipo": "line",
        "x1": 11,
        "y1": 21,
        "x2": 18,
        "y2": 11
      },
      {
        "tipo": "line",
        "x1": 18,
        "y1": 11,
        "x2": 12,
        "y2": 11
      },
      {
        "tipo": "line",
        "x1": 12,
        "y1": 11,
        "x2": 13,
        "y2": 3
      }
    ]
  }
};
  function resolverIconeId(id, tipo) {
  const s = String(id || '').toLowerCase();
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
  function iconeSvg(iconeId, corOverride, tamanho) {
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
  }
  return {
    PALETA_ICONES: PALETA_ICONES,
    ICONES: ICONES,
    resolverIconeId: resolverIconeId,
    iconeSvg: iconeSvg
  };
}));
