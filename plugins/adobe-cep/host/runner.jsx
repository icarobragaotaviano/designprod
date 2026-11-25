/* ExtendScript host runner (ES3) para extensao CEP IBD Ferramentas. */
function ibdExecutarArquivo(caminho) {
  try {
    var f = new File(caminho);
    if (!f.exists) {
      return 'ERRO:Arquivo nao encontrado -> ' + caminho;
    }
    $.evalFile(f);
    return 'OK';
  } catch (e) {
    return 'ERRO:' + (e && e.message ? e.message : String(e));
  }
}
