/**
 * @ibd-id illustrator/preflight-digital
 * @ibd-titulo Preflight digital
 * @ibd-descricao Audita pranchetas para produção digital, estima cliques, localiza ocorrências, aplica correções escolhidas e fecha PDF/X com relatório.
 * @ibd-app illustrator
 * @ibd-versao 1.0.0
 * @ibd-tags preflight, digital, konica minolta, ricoh, k-only, quinta cor, pdfx, rip
 * @ibd-doc docs/folha/README.md
 */
#target illustrator
#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-fs.jsx"
#include "../../../core/extendscript/ibd-preimpressao.jsx"
#include "../../../core/extendscript/ibd-editorial.jsx"
#include "../../../core/extendscript/ibd-preflight-regras.jsx"
#include "../../../core/extendscript/ibd-preflight-imagens.jsx"
#include "../../../core/extendscript/ibd-preflight-digital.jsx"
#include "../../../core/extendscript/ibd-preflight-pdf.jsx"

(function (p,e,regras,preflight,pdf) {
  var titulo='Preflight digital';
  var modos=['Colorido (CMYK)','P&B estrito','Híbrido'];
  var saidas=['PDF/X-4 · RIP moderno','PDF/X-1a · PostScript legado'];

  function escolher(titulo,campos,acao,subtitulo){
    return IBD.ui.formulario(titulo,campos,acao,{largura:730,rotuloLargura:150,subtitulo:subtitulo});
  }
  function nomes(lista){
    var rotulos=[];
    for(var i=0;i<lista.length;i++)rotulos.push(lista[i].nome);
    return rotulos;
  }
  function porNome(lista,valor){
    for(var i=0;i<lista.length;i++)if(lista[i].nome===valor)return lista[i];
    throw Error('Preset ausente.');
  }

  function configurar(){
    var v=escolher(titulo,[
      e.escolha('maquina','Equipamento',nomes(regras.maquinas),null,'Trabalho'),
      e.escolha('modo','Modo',modos,null,'Trabalho'),
      e.campo('coloridas','Páginas coloridas no híbrido','1-2','Trabalho'),
      e.escolha('substrato','Substrato',nomes(regras.substratos),null,'Saída'),
      e.escolha('saida','RIP',saidas,null,'Saída'),
      e.simNao('duplex','Verificar pares frente e verso',false,'Saída')
    ],'Ajustar limites','Modo híbrido: a sequência 1-2,5 deixa as demais pranchetas em P&B.');
    if(!v)return null;
    var maquina=porNome(regras.maquinas,v.maquina), substrato=porNome(regras.substratos,v.substrato);
    var l=escolher('Limites para a análise',[
      e.campo('maxW','Máximo da bandeja (largura)',String(maquina.w),'Folha em mm'),
      e.campo('maxH','Máximo da bandeja (altura)',String(maquina.h),'Folha em mm'),
      e.campo('folhaW','Padrão do job (largura)','0','Folha em mm'),
      e.campo('folhaH','Padrão do job (altura)','0','Folha em mm'),
      e.campo('pinca','Pinça superior (mm)',String(maquina.pinca),'Produção'),
      e.campo('sangria','Sangria prevista (mm)','3','Produção'),
      e.campo('seg','Segurança da arte (mm)','4','Produção'),
      e.campo('tac','TAC de referência (%)',String(substrato.tac),'Cor'),
      e.campo('spots','Nomes de 5ª cor','White, Clear, NeonPink, NeonYellow, Gold, Silver','Cor')
    ],'Auditar documento','Use 0 quando um limite for desconhecido. Ajuste bandeja, pinça e TAC de acordo com o seu equipamento e substrato.');
    if(!l)return null;
    var o={maquina:maquina,modo:v.modo,coloridas:v.coloridas,substrato:substrato,legado:v.saida===saidas[1],duplex:v.duplex,
      maxW:p.num(l.maxW,'Largura máxima',0,3000),maxH:p.num(l.maxH,'Altura máxima',0,3000),
      folhaW:p.num(l.folhaW,'Largura padrão',0,3000),folhaH:p.num(l.folhaH,'Altura padrão',0,3000),
      pinca:p.num(l.pinca,'Pinça',0,35),sangria:p.num(l.sangria,'Sangria',0,25),
      seg:p.num(l.seg,'Segurança',0,35),tac:p.num(l.tac,'TAC',0,400),spots:[]};
    if((!o.maxW)!==(!o.maxH) || (!o.folhaW)!==(!o.folhaH))throw Error('Preencha as duas medidas de cada formato ou deixe ambas em 0.');
    var spots=l.spots.split(',');
    for(var i=0;i<spots.length;i++){
      var nome=spots[i].replace(/^\s+|\s+$/g,'');
      if(nome)o.spots.push(nome);
    }
    return o;
  }

  function verAchados(a){
    var win=new Window('dialog','Preflight digital · resultados');
    win.alignChildren=['fill','top'];
    var cm=0,mono=0,incertos=0;
    for(var i=0;i<a.paginas.length;i++){
      var pg=a.paginas[i];
      if(pg.colorida)cm++;
      else if(pg.indefinida)incertos++;
      else if(pg.arte)mono++;
    }
    win.add('statictext',undefined,a.criticos+' bloqueio(s) · '+a.alertas+' atenção(ões)');
    win.add('statictext',undefined,'Estimativa · '+cm+' colorida(s) · '+mono+' só preto · '+incertos+' a conferir');
    var lista=win.add('listbox',undefined,[],{numberOfColumns:3,showHeaders:true,
      columnTitles:['Gravidade','Prancheta','Ocorrência'],columnWidths:[90,68,360]});
    lista.preferredSize=[590,295];
    var ordenado=[], k;
    for(k=0;k<a.achados.length;k++)if(a.achados[k].nivel==='Bloqueio')ordenado.push(a.achados[k]);
    for(k=0;k<a.achados.length;k++)if(a.achados[k].nivel!=='Bloqueio')ordenado.push(a.achados[k]);
    for(k=0;k<ordenado.length;k++){
      var x=ordenado[k], li=lista.add('item',x.nivel);
      li.subItems[0].text=x.pagina ? String(x.pagina) : 'Documento';
      li.subItems[1].text=x.regra;
    }
    var detalhe=win.add('statictext',undefined,'',{multiline:true});
    detalhe.preferredSize=[590,43];
    var linha=win.add('group');
    var localizar=linha.add('button',undefined,'Localizar');
    var guias=linha.add('button',undefined,'Criar guias');
    var fix=linha.add('button',undefined,'Escolher correções');
    var pdfBtn=linha.add('button',undefined,'Fechar PDF/X');
    var fim=win.add('group');
    var txt=fim.add('button',undefined,'Salvar relatório');
    fim.add('button',undefined,'Fechar',{name:'cancel'});
    fix.enabled=a.fixes.length>0;
    pdfBtn.enabled=a.criticos===0;
    var resposta=null;
    function acao(id){
      resposta={id:id,achado:lista.selection ? ordenado[lista.selection.index] : null};
      win.close(1);
    }
    lista.onChange=function (){
      var item=lista.selection ? ordenado[lista.selection.index] : null;
      detalhe.text=item ? item.texto : 'Selecione uma ocorrência para ver os detalhes.';
      localizar.enabled=!!item && (!!item.pagina || !!item.bounds);
    };
    if(lista.items.length)lista.selection=0;
    lista.onChange();
    lista.onDoubleClick=function(){if(localizar.enabled)acao('localizar');};
    localizar.onClick=function(){acao('localizar');};
    guias.onClick=function(){acao('guias');};
    fix.onClick=function(){acao('corrigir');};
    pdfBtn.onClick=function(){acao('pdf');};
    txt.onClick=function(){acao('relatorio');};
    win.show();return resposta;
  }

  function correcoes(a){
    var campos=[], n={};
    for(var i=0;i<a.fixes.length;i++)n[a.fixes[i].tipo]=(n[a.fixes[i].tipo]||0)+1;
    for(var key in preflight.fixos)if(n[key]){
      campos.push(e.simNao(key,preflight.fixos[key]+' ('+n[key]+')',false));
    }
    var v=escolher('Correções de pré-impressão',campos,'Aplicar selecionadas',
      'As opções alteram objetos editáveis no documento aberto. Vetores comuns e texto são tratados separadamente de vínculos, imagens e cores especiais.');
    return v ? preflight.corrigir(a.fixes,v) : 0;
  }

  p.executar(titulo,function (){
    var d=p.doc(false), o=configurar();
    if(!o)return;
    var a=preflight.analisar(d,o), historico=[];
    while(true){
      var acao=verAchados(a);
      if(!acao)return;
      if(acao.id==='localizar'){
        preflight.localizar(d,acao.achado);
        return;
      }
      if(acao.id==='guias'){
        preflight.desenharMargens(d,o);
        return;
      }
      if(acao.id==='corrigir'){
        var total=correcoes(a);
        if(total){
          historico.push(total+' atributo(s) alterado(s) em '+(new Date()).toLocaleString());
          a=preflight.analisar(d,o);
        }
      }
      if(acao.id==='relatorio'){
        var f=p.salvarArquivo('Salvar relatório de preflight','txt');
        if(f)IBD.fs.escreverTexto(f,preflight.relatorio(a,o,d,historico));
      }
      if(acao.id==='pdf'){
        if(!d.saved)throw Error('Salve o arquivo AI antes de fechar o PDF.');
        var presets=pdf.presets(o.legado);
        if(!presets.length)throw Error('Instale um preset PDF/X adequado e inclua PDF/X-4 ou PDF/X-1a no nome.');
        var v=escolher('Fechar PDF/X',[e.escolha('preset','Preset do Illustrator',presets,null,'Perfil e saída')],'Escolher arquivo',
          'Use o preset aprovado para o equipamento. O Output Intent e a conversão de cor vêm desse preset.');
        if(!v)continue;
        var fpdf=p.salvarArquivo('Salvar PDF para produção','pdf');
        if(!fpdf)continue;
        o.pdfPreset=v.preset;
        var saida=pdf.salvar(d,fpdf,o,preflight.relatorio(a,o,d,historico));
        IBD.ui.resumo(titulo,['PDF gerado com '+o.pdfPreset,fpdf.fsName,saida.fsName]);
        return;
      }
    }
  });
}(IBDPP,IBDEditorial,IBDPreflightRegras,IBDPreflightDigital,IBDPreflightPDF));
