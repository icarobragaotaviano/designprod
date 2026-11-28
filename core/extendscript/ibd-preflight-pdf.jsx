/* Salva em um segundo documento, preservando o AI aberto e a resolução de vínculos relativos. */
var IBDPreflightPDF=(function(p){
  function presets(legado){
    var opcoes=app.PDFPresetsList, out=[];
    var filtro=legado ? /pdf.?x[ _-]*1a/i : /pdf.?x[ _-]*4/i;
    for(var i=0;i<opcoes.length;i++)if(filtro.test(opcoes[i]))out.push(opcoes[i]);
    return out;
  }

  function salvar(doc,arquivo,o,relatorio){
    if(!doc.saved || !/\.ai$/i.test(doc.name))throw Error('Salve o original como AI antes de exportar.');
    var fonte=doc.fullName;
    if(!fonte.exists)throw Error('O AI precisa estar em uma pasta local.');
    var log=new File(arquivo.parent.fsName+'/'+decodeURI(arquivo.name).replace(/\.pdf$/i,'')+'_RELATORIO_PREFLIGHT.txt');
    if(arquivo.exists || log.exists)throw Error('Escolha um nome livre para o PDF e o relatório.');
    var copia=IBD.fs.caminhoLivre(fonte.parent,'.designprod-preflight-'+(new Date()).getTime(),'ai');
    var trabalho=null, interacao=app.userInteractionLevel;
    try{
      if(!fonte.copy(copia.fsName))throw Error('A pasta do AI precisa permitir gravar uma cópia temporária.');
      app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS;
      trabalho=app.open(copia);
      var op=new PDFSaveOptions();
      op.pDFPreset=o.pdfPreset;
      op.artboardRange='1-'+trabalho.artboards.length;
      op.preserveEditability=false;
      op.viewAfterSaving=false;
      op.bleedLink=true;
      var b=o.sangria*p.pt;
      op.bleedOffsetRect=[b,b,b,b];
      IBD.fs.escreverTexto(log,relatorio);
      trabalho.saveAs(arquivo,op);
      if(!arquivo.exists || !arquivo.length)throw Error('O Illustrator não gravou o PDF.');
      return log;
    }catch(e){
      if(log.exists && !arquivo.exists)log.remove();
      throw e;
    }finally{
      app.userInteractionLevel=interacao;
      if(trabalho)p.fechar(trabalho);
      if(copia.exists)copia.remove();
    }
  }
  return {presets:presets,salvar:salvar};
}(IBDPP));
