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
    var msg = (e && e.message) ? String(e.message) : String(e);
    if (e && e.line) msg += ' (linha ' + e.line + ')';
    return 'ERRO:' + msg;
  }
}
