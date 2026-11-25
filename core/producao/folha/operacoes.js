/* Contrato compartilhado entre Node, Bancada Nobel, CEP e UXP. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.FolhaOperacoes = factory(root.Folha);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (motor) {
  'use strict';

  const versaoContrato = 1;
  const revisaoMotor = '5fd54fe928c9897275ee62c74a4bd42ce469f2db+designprod.1';
  const modos = Object.freeze({
    'montar-pecas': 'flat',
    'planejar-cadernos': 'book',
    'planejar-lona': 'visual',
    'avaliar-orientacoes': 'free',
    'comparar-folhas': 'compare',
    'sugerir-folhas': 'suggest'
  });

  function objeto(valor) {
    return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
  }

  function normalizar(parametros, modo) {
    if (!objeto(parametros)) throw new TypeError('Informe os parâmetros da operação.');
    const efetivos = motor.clone(motor.defaults);
    for (const chave of Object.keys(efetivos)) {
      if (parametros[chave] !== undefined) efetivos[chave] = motor.clone(parametros[chave]);
    }
    efetivos.mode = modo;
    if (!objeto(efetivos.edits) || Object.values(efetivos.edits).some(valor => !objeto(valor))) {
      throw new TypeError('Edições de peças inválidas.');
    }
    if (!objeto(efetivos.pageOverrides) || Object.values(efetivos.pageOverrides).some(valor =>
      valor !== 'blank' && (!Number.isInteger(valor) || valor < 1))) {
      throw new TypeError('Substituições de páginas inválidas.');
    }
    for (const chave of ['extras', 'compareSheets', 'customPapers']) {
      if (!Array.isArray(efetivos[chave]) || efetivos[chave].some(valor => !objeto(valor))) {
        throw new TypeError(`Lista inválida em ${chave}.`);
      }
    }
    return efetivos;
  }

  function diagnosticos(resultado) {
    const marcadores = resultado.preflightMarkers || [];
    const lista = marcadores.map(m => ({
      codigo: m.code,
      gravidade: m.level === 'error' ? 'erro' : 'aviso',
      mensagem: m.detail || m.label,
      regiao: { x: m.x, y: m.y, w: m.w, h: m.h }
    }));
    for (const [gravidade, mensagens] of [['erro', resultado.errors], ['aviso', resultado.warnings]]) {
      for (const mensagem of mensagens || []) {
        if (!lista.some(item => item.gravidade === gravidade && item.mensagem === mensagem)) {
          lista.push({ codigo: /^Mais de (600|700) posições|^Limite de 700 posições/.test(mensagem)
            ? 'LIMITE_EDITAVEL' : (gravidade === 'erro' ? 'ENTRADA_INVALIDA' : 'AVISO_MOTOR'), gravidade, mensagem });
        }
      }
    }
    return lista;
  }

  function facesMontagem(s, r) {
    if (!r.items?.length) return [];
    const unica = s.style === 'turn' || s.style === 'tumble';
    const faces = [{ id: unica ? 'forma-unica' : 'frente', items: r.items, guias: motor.pressGuides(s, false) }];
    if (s.style === 'sheetwise' || s.style === 'perfector') {
      const horizontal = s.style === 'sheetwise';
      faces.push({ id: 'verso', guias: motor.pressGuides(s, true), items: r.items.map(p => ({
        ...p,
        label: 'V',
        x: horizontal ? s.sw - p.x - p.w : p.x,
        y: horizontal ? p.y : s.sh - p.y - p.h,
        angle: horizontal ? p.angle : (p.angle + 180) % 360
      })) });
    }
    return faces;
  }

  function executar(pedido) {
    if (!objeto(pedido) || pedido.versaoContrato !== versaoContrato) {
      throw new TypeError('Versão do contrato Folha incompatível.');
    }
    const { operacao } = pedido;
    if (!Object.prototype.hasOwnProperty.call(modos, operacao)) throw new TypeError('Operação Folha desconhecida.');
    const parametros = normalizar(pedido.parametros, modos[operacao]);
    const resultado = motor.compute(parametros);
    const faces = parametros.mode === 'flat' ? facesMontagem(parametros, resultado) : [];
    const temGeometria = resultado.items?.length || resultado.plan?.length || resultado.visualInfo;
    return {
      versaoContrato, operacao, revisaoMotor, parametros, unidade: 'mm', origem: 'superior_esquerdo',
      diagnosticos: diagnosticos(resultado),
      materializavel: Boolean(temGeometria) && !resultado.errors.length && parametros.mode !== 'suggest',
      faces,
      resultado
    };
  }

  return { versaoContrato, revisaoMotor, executar };
});
