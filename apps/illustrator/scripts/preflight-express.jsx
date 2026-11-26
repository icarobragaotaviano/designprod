/**
 * @ibd-id illustrator/preflight-express
 * @ibd-titulo Preflight express
 * @ibd-descricao Revisa preto composto em textos pequenos, códigos de barras e traços finos. Converte tipografia em curvas em uma cópia AI.
 * @ibd-app illustrator
 * @ibd-versao 1.0.0
 * @ibd-tags preflight, preto, CMYK, overprint, tipografia, curvas
 * @ibd-doc docs/folha/README.md
 */
#target illustrator
#include "../../../core/extendscript/ibd-ui.jsx"
#include "../../../core/extendscript/ibd-preimpressao.jsx"

(function (p) {
  var titulo = 'Preflight express';
  var acoes = ['Higienizar preto', 'Converter tipografia em curvas'];

  function codigoBarras(item) {
    while (item && item.typename !== 'Document') {
      if (/barcode|c[oó]digo de barras|(?:^|[^a-z])(?:ean|upc|gtin|code[ -]?128|itf)(?=$|[^a-z])/i.test(item.name || '')) return true;
      item = item.parent;
    }
    return false;
  }

  function planoPreto(d, limite, selecao) {
    var plano = [], frames = 0, barras = 0, tracos = 0;
    function incluir(item, cor, sobre) {
      var anterior = item[cor];
      if (!p.rico(anterior)) return false;
      plano.push({item:item, campo:cor, cor:anterior, sobre:sobre, sobreAntes:item[sobre]});
      return true;
    }
    function noEscopo(item) {
      if (!selecao) return true;
      while (item && item.typename !== 'Document') {
        if (item.selected) return true;
        item = item.parent;
      }
      return false;
    }
    for (var i=0;i<d.textFrames.length;i++) {
      var t=d.textFrames[i];
      if (!p.editavel(t) || !noEscopo(t)) continue;
      var chars=t.textRange.characters, alterou=false;
      for (var j=0;j<chars.length;j++) {
        var at=chars[j].characterAttributes;
        if (!(at.size<24)) continue;
        if (incluir(at,'fillColor','overprintFill')) alterou=true;
        if (at.strokeWeight>0 && incluir(at,'strokeColor','overprintStroke')) alterou=true;
      }
      if (alterou) frames++;
    }
    for (var k=0;k<d.pathItems.length;k++) {
      var item=d.pathItems[k];
      if (!p.editavel(item) || !noEscopo(item) || item.guides || item.clipping) continue;
      if (item.parent.typename==='CompoundPathItem' && item.parent.pathItems[0]!==item) continue;
      var codigo=codigoBarras(item);
      if (codigo && item.filled && incluir(item,'fillColor','fillOverprint')) barras++;
      if (item.stroked && (codigo || item.strokeWidth<=limite) && incluir(item,'strokeColor','strokeOverprint')) tracos++;
    }
    return {plano:plano, frames:frames, barras:barras, tracos:tracos};
  }

  function aplicarPreto(plano) {
    var puro=p.cmyk(0,0,0,100), i=0;
    try {
      for (;i<plano.length;i++) {
        var x=plano[i];
        x.item[x.campo]=puro;
        x.item[x.sobre]=true;
      }
    } catch(e) {
      for (var j=i;j>=0;j--) {
        var y=plano[j];
        try { y.item[y.campo]=y.cor; y.item[y.sobre]=y.sobreAntes; } catch (_) {}
      }
      throw e;
    }
  }

  function textoInvisivel(texto) {
    return String(texto).replace(/[\s\u0003\u200b\ufeff]/g,'');
  }

  function verificarTextos(frames) {
    for (var i=0;i<frames.length;i++) {
      var t=frames[i];
      if (t.kind===TextType.POINTTEXT || !textoInvisivel(t.contents)) continue;
      var linhas=t.lines, visiveis='';
      for (var j=0;j<linhas.length;j++) visiveis+=textoInvisivel(linhas[j].contents);
      if (visiveis!==textoInvisivel(t.contents)) {
        throw Error('Existe texto encadeado ou excedente em uma caixa. Confira a composição antes de converter em curvas.');
      }
    }
  }

  function converterFrame(t) {
    var cadeia=[], item=t;
    while (item.typename!=='Document') {
      var prop=item.typename==='Layer' ? 'visible' : 'hidden';
      cadeia.push({obj:item, prop:prop, valor:item[prop], locked:item.locked});
      item=item.parent;
    }
    try {
      for (var i=cadeia.length-1;i>=0;i--) {
        var c=cadeia[i];
        if (c.locked) c.obj.locked=false;
        if (c.prop==='visible' && !c.valor) c.obj.visible=true;
        if (c.prop==='hidden' && c.valor) c.obj.hidden=false;
      }
      if (textoInvisivel(t.contents)) {
        cadeia[0].obj=t.createOutline();
      } else {
        t.remove();
        cadeia.shift();
      }
    } finally {
      for (var j=0;j<cadeia.length;j++) {
        var x=cadeia[j];
        x.obj[x.prop]=x.valor;
        x.obj.locked=x.locked;
      }
    }
  }

  function converter(d, arquivo, frames) {
    var op=new IllustratorSaveOptions();
    op.pdfCompatible=true;
    d.saveAs(arquivo,op);
    try {
      for (var j=0;j<frames.length;j++) converterFrame(frames[j]);
      if (d.textFrames.length) throw Error('Ainda há caixas de texto no documento.');
      d.save();
    } catch (e) {
      throw Error('A cópia inicial foi gravada. A conversão em curvas ficou incompleta. '+e.message);
    }
  }

  p.executar(titulo,function () {
    var v=IBD.ui.formulario(titulo,[{id:'acao',rotulo:'Operação',tipo:'escolha',opcoes:acoes,padrao:acoes[0]}],'Continuar');
    if (!v) return;
    if (v.acao===acoes[0]) {
      var d=p.doc(true);
      var op=IBD.ui.formulario(acoes[0],[
        {id:'traco',rotulo:'Espessura máxima de traço (pt)',padrao:'0,75'},
        {id:'escopo',rotulo:'Escopo',tipo:'escolha',opcoes:['Documento','Seleção'],padrao:'Documento'}
      ],'Analisar',{subtitulo:'Use Barcode, Código de barras ou EAN no nome de grupos vetoriais para identificá-los.'});
      if (!op) return;
      var result=planoPreto(d,p.num(op.traco,'Espessura',0.05,5),op.escopo==='Seleção');
      var info=result.frames+' caixas de texto, '+result.barras+' preenchimentos de barras e '+result.tracos+' traços.';
      if (!result.plano.length) { IBD.ui.resumo(titulo,['Nenhum preto composto compatível no escopo selecionado.']); return; }
      if (!confirm(info+'\nConverter para K100 e ativar sobreimpressão?')) return;
      aplicarPreto(result.plano);
      IBD.ui.resumo(titulo,[info,result.plano.length+' atributos convertidos para K100 com sobreimpressão.']);
    } else {
      var original=p.doc(false), frames=[];
      for (var i=0;i<original.textFrames.length;i++) frames.push(original.textFrames[i]);
      if (!frames.length) { IBD.ui.resumo(titulo,['O documento não contém caixas de texto editáveis.']); return; }
      verificarTextos(frames);
      var f=p.salvarArquivo('Salvar uma cópia AI com a tipografia em curvas','ai');
      if (!f) return;
      converter(original,f,frames);
      IBD.ui.resumo(titulo,[frames.length+' caixas de texto processadas em todas as pranchetas.',f.fsName]);
    }
  });
}(IBDPP));
