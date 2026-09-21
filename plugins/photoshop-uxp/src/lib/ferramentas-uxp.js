/**
 * Ferramentas escritas direto em UXP (API moderna do Photoshop).
 *
 * Diferenca para os scripts .jsx: rodam sem a ponte ExtendScript, com API
 * suportada pela Adobe. Ferramenta nova que so precisa mexer em camadas
 * deveria nascer aqui; o que depende de recurso que a UXP ainda nao expoe
 * continua em apps/photoshop/scripts.
 */
const { app, core } = require('photoshop');

/** Percorre camadas e grupos recursivamente. */
function percorrer(camadas, visitar) {
  for (const camada of camadas) {
    visitar(camada);
    if (camada.layers && camada.layers.length) percorrer(camada.layers, visitar);
  }
}

const ferramentas = [
  {
    id: 'photoshop/uxp/renomear-selecionadas',
    titulo: 'Renomear camadas selecionadas',
    descricao: 'Renomeia as camadas selecionadas em sequencia, usando o nome do documento como prefixo.',
    app: 'photoshop',
    tipo: 'uxp',
    tags: ['camadas', 'organizacao'],
    async executar() {
      const doc = app.activeDocument;
      if (!doc) return 'Nenhum documento aberto.';

      const selecionadas = doc.activeLayers;
      if (!selecionadas.length) return 'Selecione ao menos uma camada.';

      const prefixo = doc.name.replace(/\.[^.]+$/, '').replace(/[^\w\-]+/g, '-');

      await core.executeAsModal(
        async () => {
          selecionadas.forEach((camada, i) => {
            camada.name = `${prefixo}_${String(i + 1).padStart(2, '0')}`;
          });
        },
        { commandName: 'IBD — Renomear camadas' }
      );

      return `${selecionadas.length} camada(s) renomeada(s).`;
    }
  },
  {
    id: 'photoshop/uxp/limpar-nomes',
    titulo: 'Limpar nomes de camadas',
    descricao: 'Remove sufixos de duplicacao ("copy", "copia") e espacos sobrando dos nomes de todas as camadas.',
    app: 'photoshop',
    tipo: 'uxp',
    tags: ['camadas', 'organizacao'],
    async executar() {
      const doc = app.activeDocument;
      if (!doc) return 'Nenhum documento aberto.';

      const renomear = [];
      percorrer(doc.layers, (camada) => {
        const limpo = camada.name
          .replace(/\s*(c[oó]pia|copy)(\s+\d+)?$/i, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (limpo && limpo !== camada.name) renomear.push([camada, limpo]);
      });

      if (!renomear.length) return 'Nenhum nome precisava de ajuste.';

      await core.executeAsModal(
        async () => {
          for (const [camada, nome] of renomear) camada.name = nome;
        },
        { commandName: 'IBD — Limpar nomes de camadas' }
      );

      return `${renomear.length} nome(s) ajustado(s).`;
    }
  }
];

module.exports = { ferramentas };
