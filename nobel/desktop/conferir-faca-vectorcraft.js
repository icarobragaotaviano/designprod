/* VectorCraft · IBD Gráfica. Executar pelo menu de scripts.
   Inspeção somente de leitura das camadas FACA, MEIO-CORTE e MEIO_CORTE. */
(function () {
  'use strict';

  function validarPonto(p) {
    if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite)) {
      throw Error('Coordenada de âncora inválida.');
    }
    return p;
  }

  // Menor rotação lexicográfica em tempo linear. Um caminho fechado pode
  // iniciar em qualquer nó, inclusive quando outro caminho percorre o inverso.
  function rotacaoMinima(lista) {
    let i = 0, j = 1, k = 0;
    const n = lista.length;
    while (i < n && j < n && k < n) {
      const a = lista[(i + k) % n], b = lista[(j + k) % n];
      if (a === b) { k++; continue; }
      if (a > b) { i += k + 1; if (i === j) i++; }
      else { j += k + 1; if (i === j) j++; }
      k = 0;
    }
    const inicio = Math.min(i,j);
    return lista.slice(inicio).concat(lista.slice(0,inicio));
  }

  function assinatura(sub) {
    const pontos = sub.anchors.map(a => {
      const p = validarPonto(a.p);
      return [p, validarPonto(a.in || p), validarPonto(a.out || p)];
    });
    function codificar(lista) {
      const tokens = lista.map(a => JSON.stringify(a));
      return JSON.stringify(sub.closed ? rotacaoMinima(tokens) : tokens);
    }
    const direta = codificar(pontos);
    const inversa = codificar(pontos.reverse().map(a => [a[0],a[2],a[1]]));
    return (sub.closed ? 'F' : 'A') + (direta < inversa ? direta : inversa);
  }

  const resposta = vc.run('document.json', {});
  const documento = resposta.document || resposta;
  if (!Array.isArray(documento.layers)) throw Error('A versão do editor não disponibilizou as camadas.');
  const ocorrencias = [];
  let total = 0, camadas = 0;
  function visitar(no, grupo, vistos) {
    if (no.hidden || no.visible === false) return;
    const tipo = no.kind || {};
    const nome = String(no.name || '').trim().toUpperCase().replace(/_/g,'-');
    if (tipo.type === 'layer' && (nome === 'FACA' || nome === 'MEIO-CORTE')) {
      camadas++;
      grupo = nome;
    }
    if (grupo && tipo.path && Array.isArray(tipo.path.subpaths)) {
      tipo.path.subpaths.forEach((sub,idx) => {
        const ref = grupo + ' · ' + (no.name || 'Objeto '+no.id) + ' (#'+no.id+', traçado '+(idx+1)+')';
        total++;
        if (!sub.closed) ocorrencias.push(ref+' — aberto');
        if (!Array.isArray(sub.anchors) || sub.anchors.length < 2) { ocorrencias.push(ref+' — menos de dois nós'); return; }
        const chave = assinatura(sub);
        if (vistos.has(chave)) ocorrencias.push(ref+' — coincide com '+vistos.get(chave));
        else vistos.set(chave,ref);
      });
    }
    const filhos = tipo.children || tipo.members || [];
    if (Array.isArray(filhos)) filhos.forEach(filho => visitar(filho,grupo,vistos));
  }
  const vistos = new Map();
  documento.layers.forEach(no => visitar(no,'',vistos));
  let resumo = total+' traçado(s) conferido(s). '+ocorrencias.length+' ocorrência(s).';
  if (!camadas) resumo = 'Nomeie a camada de corte FACA ou MEIO-CORTE e execute novamente.';
  else if (!total) resumo = 'Nenhum caminho legível nas camadas de corte visíveis.';
  const texto = [resumo].concat(ocorrencias).join('\n');
  vc.log(texto);
  alert([resumo].concat(ocorrencias.slice(0,10), ocorrencias.length>10 ? ['Lista completa no console de scripts.'] : []).join('\n'),'IBD · Conferência de faca');
}());
