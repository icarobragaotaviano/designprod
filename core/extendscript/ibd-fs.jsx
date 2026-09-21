/**
 * ibd-fs.jsx — arquivos e pastas.
 * Requer ibd-core.jsx carregado antes.
 */
#include "ibd-core.jsx"

(function (IBD) {
  var fs = {};

  /** Junta partes de caminho com "/" (ExtendScript aceita "/" nos dois SOs). */
  fs.juntar = function () {
    var partes = [];
    for (var i = 0; i < arguments.length; i++) {
      var p = String(arguments[i]).replace(/^\/+|\/+$/g, '');
      if (p) partes.push(p);
    }
    var base = String(arguments[0]);
    var prefixo = base.charAt(0) === '/' ? '/' : '';
    return prefixo + partes.join('/');
  };

  /** Cria a pasta e todos os niveis acima. Retorna o Folder. */
  fs.garantirPasta = function (caminho) {
    var pasta = caminho instanceof Folder ? caminho : new Folder(caminho);
    if (pasta.exists) return pasta;
    var pai = pasta.parent;
    if (pai && !pai.exists) fs.garantirPasta(pai);
    if (!pasta.create()) {
      throw new Error('Nao foi possivel criar a pasta: ' + pasta.fsName);
    }
    return pasta;
  };

  /** Nome do arquivo sem extensao. */
  fs.semExtensao = function (arquivo) {
    var nome = arquivo instanceof File ? decodeURI(arquivo.name) : String(arquivo);
    return nome.replace(/\.[^.]+$/, '');
  };

  /** Extensao em minusculas, sem ponto. */
  fs.extensao = function (arquivo) {
    var nome = arquivo instanceof File ? decodeURI(arquivo.name) : String(arquivo);
    var m = nome.match(/\.([^.]+)$/);
    return m ? m[1].toLowerCase() : '';
  };

  /**
   * Devolve um File que ainda nao existe, acrescentando -01, -02...
   * Evita sobrescrever export anterior sem avisar.
   */
  fs.caminhoLivre = function (pasta, nomeBase, extensao) {
    var tentativa = new File(fs.juntar(String(pasta), nomeBase + '.' + extensao));
    var n = 1;
    while (tentativa.exists) {
      tentativa = new File(fs.juntar(String(pasta), nomeBase + '-' + IBD.pad(n, 2) + '.' + extensao));
      n++;
      if (n > 999) throw new Error('Excesso de arquivos com o nome ' + nomeBase);
    }
    return tentativa;
  };

  fs.escreverTexto = function (caminho, conteudo, codificacao) {
    var arquivo = caminho instanceof File ? caminho : new File(caminho);
    if (arquivo.parent && !arquivo.parent.exists) fs.garantirPasta(arquivo.parent);
    arquivo.encoding = codificacao || 'UTF-8';
    if (!arquivo.open('w')) throw new Error('Nao foi possivel escrever: ' + arquivo.fsName);
    try {
      arquivo.write(conteudo);
    } finally {
      arquivo.close();
    }
    return arquivo;
  };

  fs.lerTexto = function (caminho, codificacao) {
    var arquivo = caminho instanceof File ? caminho : new File(caminho);
    if (!arquivo.exists) return null;
    arquivo.encoding = codificacao || 'UTF-8';
    if (!arquivo.open('r')) throw new Error('Nao foi possivel ler: ' + arquivo.fsName);
    try {
      return arquivo.read();
    } finally {
      arquivo.close();
    }
  };

  fs.lerJSON = function (caminho) {
    var texto = fs.lerTexto(caminho);
    return texto === null ? null : IBD.json.parse(texto);
  };

  fs.escreverJSON = function (caminho, valor) {
    return fs.escreverTexto(caminho, IBD.json.stringify(valor, '  '));
  };

  /**
   * Lista arquivos de uma pasta filtrando por extensoes.
   * @param {Folder|string} pasta
   * @param {string[]} extensoes ex: ['psd','tif']; vazio = todos
   * @param {boolean} recursivo
   */
  fs.listar = function (pasta, extensoes, recursivo) {
    var alvo = pasta instanceof Folder ? pasta : new Folder(pasta);
    var achados = [];
    if (!alvo.exists) return achados;
    var itens = alvo.getFiles();
    for (var i = 0; i < itens.length; i++) {
      var item = itens[i];
      if (item instanceof Folder) {
        if (recursivo) achados = achados.concat(fs.listar(item, extensoes, true));
        continue;
      }
      if (!extensoes || !extensoes.length || extensoes.indexOf(fs.extensao(item)) > -1) {
        achados.push(item);
      }
    }
    return achados;
  };

  /** Pasta de dados do estudio: ~/Library/.../IBD ou %APPDATA%\IBD */
  fs.pastaDados = function () {
    return fs.garantirPasta(new Folder(Folder.userData.fsName + '/' + IBD.MARCA));
  };

  /** Pasta padrao de saida na Area de Trabalho, ja com carimbo de data. */
  fs.pastaSaidaPadrao = function (rotulo) {
    var nome = IBD.slug(rotulo || 'export') + '-' + IBD.carimbo();
    return fs.garantirPasta(new Folder(Folder.desktop.fsName + '/' + nome));
  };

  IBD.fs = fs;
})($.global.IBD);
