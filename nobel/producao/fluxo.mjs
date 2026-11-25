export const substratos = {
  'Revestido': {tac:300,icc:'ISO Coated v2 300% (ECI)'},
  'Não revestido': {tac:280,icc:'PSO Uncoated v3 (FOGRA52)'}
};
export const pretos = {'Puro':[0,0,0,100],'Rico neutro':[50,40,40,100],'Rico frio':[60,30,20,100],'Rico quente':[30,50,40,100]};
export const achados = [
  ['rgb','Bloqueador','Elementos em RGB','Algumas cores podem mudar na impressão. Ajuste o arquivo ao perfil de saída combinado.'],
  ['resolucao','Bloqueador','Resolução crítica','A imagem pode sair serrilhada ou sem nitidez no tamanho final.'],
  ['sangria','Bloqueador','Falta de sangria','O corte pode deixar um filete branco na borda.'],
  ['seguranca','Bloqueador','Texto fora da margem','Parte do texto pode ser cortada no acabamento.'],
  ['fonte','Bloqueador','Fonte ausente ou aberta','O texto pode mudar de aparência ou perder caracteres na abertura.'],
  ['faca','Bloqueador','Faca vetorial ausente','O acabamento precisa de um contorno vetorial separado.'],
  ['escala','Bloqueador','Escala incorreta','O tamanho do arquivo é diferente do tamanho pedido.'],
  ['preto','Alerta','Preto composto em texto pequeno','O texto pode apresentar contornos fora de registro.'],
  ['tac','Alerta','Excesso de cobertura de tinta','A cobertura precisa ser ajustada ao papel para manter a qualidade da impressão.'],
  ['qr','Alerta','Código sem área livre','O código precisa de espaço livre ao redor para facilitar a leitura.'],
  ['proporcao','Alerta','Proporção incompatível','A imagem pode precisar de recorte ou enquadramento para o formato pedido.']
];
export function triagem(ids){
  const itens=achados.filter(a=>ids.includes(a[0]));
  const bloqueadores=itens.filter(([,nivel])=>nivel==='Bloqueador').length;
  const score=Math.max(0,100-25*bloqueadores-8*(itens.length-bloqueadores));
  const status=bloqueadores?'Requer correção ou novo envio':itens.length?'Ajuste rápido na pré-impressão':'Pronto para conferência no RIP';
  const mensagem=itens.length?'Olá! Na conferência da sua arte, encontramos estes pontos:\n\n'+itens.map(([, ,rotulo,exp])=>'• '+rotulo+'. '+exp).join('\n')+'\n\nVocê pode enviar o arquivo ajustado ou pedir um orçamento de arte-finalização.':'Olá! Na triagem, a arte passou pelos itens conferidos. Vamos encaminhar para a conferência de produção.';
  return {score,status,mensagem};
}
export function slug(t) {
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w.-]+/g,'_').replace(/^[._]+|[._]+$/g,'').slice(0,40);
}
export function passaporte(d) {
  const base=['OS'+slug(d.os),slug(d.cliente),slug(d.produto),d.largura+'x'+d.altura,d.cores.replace('×','x'),slug(d.papel),slug(d.acabamento)].filter(Boolean).join('_');
  const formato=d.largura+' × '+d.altura+' mm';
  const aberto=d.abertaL&&d.abertaA?d.abertaL+' × '+d.abertaA+' mm':null;
  const nome=base+'.pdf';
  const cliente=['Olá, '+d.cliente+'! Confira a prova de '+d.produto+' (OS '+d.os+').','Formato final '+formato+(aberto?' · aberto '+aberto:'.'),'Papel '+d.papel+' · '+d.tiragem+' unidade(s) · '+d.cores+' · acabamento '+d.acabamento+'.','Confira textos, medidas e acabamentos antes de aprovar. As cores em tela podem variar na impressão. O corte está sujeito à tolerância de '+d.tolerancia+' mm combinada para o serviço.'].join('\n');
  const ficha={'OS':d.os,'Cliente':d.cliente,'Produto':d.produto,'Formato fechado':formato,'Formato aberto':aberto,'Cores':d.cores,'Papel e gramatura':d.papel,'Tiragem':d.tiragem,'Processo':d.processo,'Folha de máquina':d.folha,'Aproveitamento':d.rendimento,'Fibra':d.fibra,'Pinça (mm)':d.pinca,'ICC':d.icc,'Padrão PDF':d.pdf,'Receita de preto':d.preto,'Quebra de acerto':d.acerto,'Roteiro de acabamento':d.acabamento,'Preflight conferido por':d.conferente||'Pendente'};
  return {versao:1,nome,cliente,ficha};
}
export function tintaBranca({midia,lado,faces,choke,largura,altura,spot}){
  const espelho=midia==='Transparente'&&lado==='Interno do vidro';
  if(2*choke>=Math.min(largura,altura))throw Error('O recuo precisa caber na silhueta.');
  const camadas=faces==='Duas faces'?['Cor A','Branco','Blackout','Branco','Cor B']:espelho?['Cor','Branco']:['Branco','Cor'];
  return {espelho,camadas,spot,choke,base:[choke,choke,largura-2*choke,altura-2*choke]};
}
