const TraceDrawPlugin = {
  name: 'IBD · Calendário',
  description: 'Desenha a referência de corte e a faixa de segurança em uma camada técnica. Use unidades de milímetro.',
  version: '1.0',
  commands: [{
    name: 'Calendário 210 × 150 · faixa de 14 mm',
    run() {
      ActiveLayer.CreateRectangle(0, 0, 210, 150);
      ActiveLayer.CreateRectangle(0, 0, 210, 14);
    }
  }]
};
