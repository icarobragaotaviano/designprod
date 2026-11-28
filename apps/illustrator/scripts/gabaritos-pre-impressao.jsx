/**
 * @ibd-id illustrator/gabaritos-pre-impressao
 * @ibd-titulo Gabaritos de pré-impressão
 * @ibd-descricao Cria formas no corte ou na sangria, pranchetas em lote, faca de capa dura com lombada e guias de encadernação.
 * @ibd-app illustrator
 * @ibd-versao 1.0.1
 * @ibd-tags gabarito, prancheta, capa dura, faca, lombada, wire-o, espiral, sangria
 * @ibd-doc docs/folha/README.md
 */
#target illustrator
#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-preimpressao.jsx"

(function (p) {
  var titulo = 'Gabaritos de pré-impressão', pt = p.pt;
  var acoes = ['Forma na prancheta', 'Pranchetas em lote', 'Lombada e capa dura', 'Guia Wire-o / espiral'];
  function texto(id, rotulo, padrao, grupo) { return {id:id, rotulo:rotulo, padrao:padrao, grupo:grupo}; }
  function escolha(id, rotulo, opcoes, grupo) { return {id:id, rotulo:rotulo, tipo:'escolha', opcoes:opcoes, padrao:opcoes[0], grupo:grupo}; }

  function forma(d, a, v) {
    var f = 0;
    if (v.limite === 'Sangria (BleedBox)') f = p.num(v.sangria, 'Sangria', 0, 30);
    p.retanguloPrancheta(d,a,f,v.estilo==='Sem preenchimento');
  }

  function lote(v) {
    var d = p.medidas(v.formato, v.largura, v.altura);
    if (v.orientacao === 'Paisagem' && d[1] > d[0]) d.reverse();
    p.novaGrade(d, p.num(v.qtd,'Quantidade',1,200,true), p.num(v.colunas,'Colunas',1,50,true), p.num(v.intervalo,'Intervalo',0,100));
  }

  function capa(v) {
    var w=p.num(v.largura,'Largura do papelão',20,1000), h=p.num(v.altura,'Altura do papelão',20,1000);
    var paginas=p.num(v.paginas,'Páginas do miolo',2,2000,true);
    var g=p.num(v.gramatura,'Gramatura',40,500);
    var canal=p.num(v.canal,'Canaleta',5,10), vira=p.num(v.vira,'Vira',15,20);
    // Estimativas editáveis para cálculo preliminar. O caliper medido tem precedência.
    var volumes = {'Couchê':0.8,'Offset':1.2,'Pólen':1.5};
    var medido = v.caliper !== '';
    var caliper = medido ? p.num(v.caliper,'Caliper',0.025,2) : g * volumes[v.papel] / 1000;
    var m=p.margensCapa(w,h,paginas,caliper,canal,vira);
    if (m.largura > 2000) throw Error('A capa aberta ultrapassa 2.000 mm.');
    var d=p.novaGrade([m.largura,m.altura],1,1,0,['CAPA ABERTA · MATERIAL DE REVESTIMENTO']);
    try {
      var a=d.artboards[0].artboardRect;
      var painel=d.layers[0]; painel.name='Papelões e canaletas'; painel.printable=false;
      var cores=[p.cmyk(100,0,0,0),p.cmyk(0,100,0,0),p.cmyk(100,0,0,0)];
      var nomes=['Contracapa','Lombada','Frente'];
      for (var i=0;i<3;i++) {
        var c=m.paineis[i];
        p.ret(painel,a,c[0],c[1],c[2],c[3],cores[i],0.5).name=nomes[i];
      }
      for (var j=0;j<2;j++) {
        var b=m.paineis[j];
        p.ret(painel,a,b[0]+b[2],vira,canal,h,p.cmyk(0,50,100,0),0.5).name='Canaleta '+(j+1);
      }
      var faca=d.layers.add(); faca.name='Faca externa da vira'; faca.printable=false;
      p.ret(faca,a,0,0,m.largura,m.altura,p.preta(d),0.5).name='Corte do material de revestimento';
      IBD.ui.resumo(titulo,[
        'Montagem aberta · '+m.largura.toFixed(2)+' × '+m.altura.toFixed(2)+' mm',
        'Lombada do miolo · '+m.lombada.toFixed(2)+' mm · '+Math.ceil(paginas/2)+' folhas',
        'Caliper · '+caliper.toFixed(4)+' mm'+(medido ? ' (informado)' : ' (estimado)'),
        'Confira a espessura do miolo encadernado e as folgas da encadernação antes de produzir.'
      ]);
    } catch (e) { p.fechar(d); throw e; }
  }

  function guia(d,a,v) {
    var margem=p.num(v.margem,'Margem de encadernação',1,60);
    var w=(a[2]-a[0])/pt,h=(a[1]-a[3])/pt;
    var segmento;
    if (v.borda==='Superior' || v.borda==='Inferior') {
      if (margem>=h) throw Error('Margem maior que a altura da peça.');
      var y=v.borda==='Superior' ? margem : h-margem;
      segmento=[0,y,w,y];
    } else {
      if (margem>=w) throw Error('Margem maior que a largura da peça.');
      var x=v.borda==='Esquerda' ? margem : w-margem;
      segmento=[x,0,x,h];
    }
    var layer=d.layers.add(); layer.name='Guia de encadernação · '+v.borda+' · '+margem+' mm';
    try {
      layer.printable=false;
      p.linha(layer,a,segmento,p.preta(d),0.35,false).guides=true;
      layer.locked=true;
    } catch (e) { try { layer.remove(); } catch (_) {} throw e; }
  }

  p.executar(titulo,function () {
    var acao=IBD.ui.formulario(titulo,[escolha('acao','Operação',acoes)],'Continuar');
    if (!acao) return;
    var campos, v;
    if (acao.acao===acoes[1]) {
      campos=[escolha('formato','Formato',['A4','A5','T4','T8','SRA3','10 × 15 cm','Personalizado'],'Formato'),
        escolha('orientacao','Orientação',['Original','Paisagem'],'Formato'),
        texto('largura','Largura manual (mm)','210','Formato'),texto('altura','Altura manual (mm)','297','Formato'),
        texto('qtd','Pranchetas','12','Grade'),texto('colunas','Colunas','4','Grade'),texto('intervalo','Intervalo (mm)','10','Grade')];
      v=IBD.ui.formulario(acoes[1],campos,'Criar'); if (v) lote(v);
    } else if (acao.acao===acoes[2]) {
      campos=[texto('largura','Cada papelão (largura mm)','215','Papelões'),texto('altura','Cada papelão (altura mm)','303','Papelões'),
        texto('canal','Canaleta (mm)','7','Papelões'),texto('vira','Vira (mm)','18','Papelões'),
        texto('paginas','Páginas do miolo','128','Miolo'),escolha('papel','Papel',['Couchê','Offset','Pólen'],'Miolo'),
        texto('gramatura','Gramatura (g/m²)','115','Miolo'),texto('caliper','Caliper medido (mm)','','Miolo')];
      v=IBD.ui.formulario(acoes[2],campos,'Planificar',{subtitulo:'Informe as dimensões reais dos papelões. Caliper vazio usa estimativa pelo papel e gramatura.'});
      if (v) capa(v);
    } else {
      var d=p.doc(false), a=d.artboards[d.artboards.getActiveArtboardIndex()].artboardRect;
      if (acao.acao===acoes[0]) {
        campos=[escolha('limite','Limite',['Corte (TrimBox)','Sangria (BleedBox)']),texto('sangria','Sangria (mm)','3'),
          escolha('estilo','Estilo',['Fundo chapado','Sem preenchimento'])];
        v=IBD.ui.formulario(acoes[0],campos,'Criar forma'); if(v) forma(d,a,v);
      } else {
        campos=[escolha('borda','Encadernação',['Superior','Inferior','Esquerda','Direita']),texto('margem','Recuo (mm)','15')];
        v=IBD.ui.formulario(acoes[3],campos,'Criar guia'); if(v) guia(d,a,v);
      }
    }
  });
}(IBDPP));
